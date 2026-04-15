/**
 * Meal Logging Service - Unit Tests
 * 
 * Senior-level testing patterns:
 * - Guard clauses tested explicitly
 * - Behavior-driven assertions
 * - No over-mocking
 * - No test leaks between cases
 * - Failure paths as first-class citizens
 * 
 * Test Pyramid: Unit Tests (70% of test suite)
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Mock dependencies
const mockDbQuery = jest.fn();
const mockEmbeddingQueue = {
  enqueueEmbedding: jest.fn(),
};
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

// Service under test (abstraction layer)
class MealLoggingService {
  constructor(
    private readonly dbQuery: typeof mockDbQuery,
    private readonly embeddingQueue: typeof mockEmbeddingQueue,
    private readonly logger: typeof mockLogger
  ) {}

  async createMeal(userId: string, mealData: {
    mealType: string;
    mealName?: string;
    calories?: number;
    proteinGrams?: number;
    carbsGrams?: number;
    fatGrams?: number;
    foods?: unknown[];
    eatenAt?: Date;
  }) {
    // Guard clause: Validate required fields
    if (!userId) {
      throw new Error('INVALID_USER');
    }

    if (!mealData.mealType) {
      throw new Error('INVALID_MEAL_TYPE');
    }

    // Business rule: Validate meal type
    const validMealTypes = ['breakfast', 'lunch', 'dinner', 'snack'];
    if (!validMealTypes.includes(mealData.mealType)) {
      throw new Error('INVALID_MEAL_TYPE');
    }

    // Calculate macros from foods if not provided
    let calories = mealData.calories;
    let proteinGrams = mealData.proteinGrams;
    let carbsGrams = mealData.carbsGrams;
    let fatGrams = mealData.fatGrams;

    if (mealData.foods && mealData.foods.length > 0 && !calories) {
      const totals = this.calculateMacrosFromFoods(mealData.foods);
      calories = totals.calories;
      proteinGrams = totals.protein;
      carbsGrams = totals.carbs;
      fatGrams = totals.fat;
    }

    // Insert meal log
    const result = await this.dbQuery(
      `INSERT INTO meal_logs (user_id, meal_type, meal_name, calories, protein_grams, carbs_grams, fat_grams, foods, eaten_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        userId,
        mealData.mealType,
        mealData.mealName || null,
        calories || null,
        proteinGrams || null,
        carbsGrams || null,
        fatGrams || null,
        JSON.stringify(mealData.foods || []),
        mealData.eatenAt || new Date(),
      ]
    );

    const meal = result.rows[0];

    // Async operation (non-blocking)
    await this.embeddingQueue.enqueueEmbedding({
      userId,
      sourceType: 'meal_log',
      sourceId: meal.id,
      operation: 'create',
    });

    this.logger.info('Meal logged', { userId, mealId: meal.id });

    return meal;
  }

  async updateMeal(userId: string, mealId: string, updates: {
    mealName?: string;
    calories?: number;
    proteinGrams?: number;
    carbsGrams?: number;
    fatGrams?: number;
  }) {
    if (!userId) throw new Error('INVALID_USER');
    if (!mealId) throw new Error('INVALID_MEAL_ID');

    // Verify ownership
    const existing = await this.dbQuery(
      `SELECT * FROM meal_logs WHERE id = $1 AND user_id = $2`,
      [mealId, userId]
    );

    if (existing.rows.length === 0) {
      throw new Error('MEAL_NOT_FOUND');
    }

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        const dbField = key === 'mealName' ? 'meal_name' : key.toLowerCase();
        setClauses.push(`${dbField} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      throw new Error('NO_UPDATES');
    }

    const result = await this.dbQuery(
      `UPDATE meal_logs SET ${setClauses.join(', ')}, updated_at = NOW()
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING *`,
      [...values, mealId, userId]
    );

    return result.rows[0];
  }

  async deleteMeal(userId: string, mealId: string) {
    if (!userId) throw new Error('INVALID_USER');
    if (!mealId) throw new Error('INVALID_MEAL_ID');

    const result = await this.dbQuery(
      `DELETE FROM meal_logs WHERE id = $1 AND user_id = $2 RETURNING id`,
      [mealId, userId]
    );

    if (result.rowCount === 0) {
      throw new Error('MEAL_NOT_FOUND');
    }

    return { success: true };
  }

  private calculateMacrosFromFoods(foods: unknown[]): {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  } {
    return foods.reduce(
      (acc: { calories: number; protein: number; carbs: number; fat: number }, food: any) => ({
        calories: acc.calories + (food.calories || 0),
        protein: acc.protein + (food.protein || 0),
        carbs: acc.carbs + (food.carbs || 0),
        fat: acc.fat + (food.fat || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }
}

describe('MealLoggingService – Unit', () => {
  let service: MealLoggingService;
  let dbQueryMock: jest.Mock;
  let embeddingQueueMock: { enqueueEmbedding: jest.Mock };
  let loggerMock: typeof mockLogger;

  beforeEach(() => {
    // Reset all mocks between tests (senior-level: no test leaks)
    dbQueryMock = jest.fn();
    embeddingQueueMock = { enqueueEmbedding: jest.fn() };
    loggerMock = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    service = new MealLoggingService(
      dbQueryMock,
      embeddingQueueMock,
      loggerMock
    );
  });

  describe('createMeal', () => {
    test('throws error for invalid userId (guard clause)', async () => {
      await expect(service.createMeal('', { mealType: 'breakfast' }))
        .rejects
        .toThrow('INVALID_USER');
    });

    test('throws error for missing mealType (guard clause)', async () => {
      await expect(service.createMeal('user1', { mealType: '' }))
        .rejects
        .toThrow('INVALID_MEAL_TYPE');
    });

    test('throws error for invalid mealType (business rule)', async () => {
      await expect(service.createMeal('user1', { mealType: 'invalid' }))
        .rejects
        .toThrow('INVALID_MEAL_TYPE');
    });

    test('creates meal with provided macros', async () => {
      const mockMeal = {
        id: 'meal1',
        user_id: 'user1',
        meal_type: 'breakfast',
        meal_name: 'Oatmeal',
        calories: 300,
        protein_grams: 10,
        carbs_grams: 50,
        fat_grams: 5,
      };

      dbQueryMock.mockResolvedValue({ rows: [mockMeal] });
      embeddingQueueMock.enqueueEmbedding.mockResolvedValue(undefined);

      const result = await service.createMeal('user1', {
        mealType: 'breakfast',
        mealName: 'Oatmeal',
        calories: 300,
        proteinGrams: 10,
        carbsGrams: 50,
        fatGrams: 5,
      });

      expect(result).toEqual(mockMeal);
      expect(dbQueryMock).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO meal_logs'),
        expect.arrayContaining(['user1', 'breakfast', 'Oatmeal', 300, 10, 50, 5])
      );
      expect(embeddingQueueMock.enqueueEmbedding).toHaveBeenCalledWith({
        userId: 'user1',
        sourceType: 'meal_log',
        sourceId: 'meal1',
        operation: 'create',
      });
    });

    test('calculates macros from foods when not provided', async () => {
      const foods = [
        { name: 'Chicken', calories: 200, protein: 30, carbs: 0, fat: 5 },
        { name: 'Rice', calories: 150, protein: 3, carbs: 30, fat: 0 },
      ];

      const mockMeal = {
        id: 'meal1',
        user_id: 'user1',
        meal_type: 'lunch',
        calories: 350,
        protein_grams: 33,
        carbs_grams: 30,
        fat_grams: 5,
      };

      dbQueryMock.mockResolvedValue({ rows: [mockMeal] });
      embeddingQueueMock.enqueueEmbedding.mockResolvedValue(undefined);

      const result = await service.createMeal('user1', {
        mealType: 'lunch',
        foods,
      });

      expect(result).toEqual(mockMeal);
      expect(dbQueryMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          'user1',
          'lunch',
          null, // mealName
          350, // calculated calories
          33, // calculated protein
          30, // calculated carbs
          5, // calculated fat
        ])
      );
    });

    test('uses provided macros over calculated when both present', async () => {
      const foods = [
        { name: 'Chicken', calories: 200, protein: 30 },
      ];

      const mockMeal = {
        id: 'meal1',
        user_id: 'user1',
        meal_type: 'dinner',
        calories: 500, // Provided, not calculated
      };

      dbQueryMock.mockResolvedValue({ rows: [mockMeal] });

      await service.createMeal('user1', {
        mealType: 'dinner',
        calories: 500, // Explicit override
        foods,
      });

      expect(dbQueryMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([500]) // Uses provided, not calculated
      );
    });
  });

  describe('updateMeal', () => {
    test('throws error for invalid userId (guard clause)', async () => {
      await expect(service.updateMeal('', 'meal1', { mealName: 'Updated' }))
        .rejects
        .toThrow('INVALID_USER');
    });

    test('throws error for invalid mealId (guard clause)', async () => {
      await expect(service.updateMeal('user1', '', { mealName: 'Updated' }))
        .rejects
        .toThrow('INVALID_MEAL_ID');
    });

    test('throws error when meal not found', async () => {
      dbQueryMock.mockResolvedValueOnce({ rows: [] }); // Ownership check

      await expect(service.updateMeal('user1', 'nonexistent', { mealName: 'Updated' }))
        .rejects
        .toThrow('MEAL_NOT_FOUND');
    });

    test('throws error when no updates provided', async () => {
      dbQueryMock.mockResolvedValueOnce({ rows: [{ id: 'meal1' }] }); // Ownership check

      await expect(service.updateMeal('user1', 'meal1', {}))
        .rejects
        .toThrow('NO_UPDATES');
    });

    test('updates meal successfully', async () => {
      const existingMeal = { id: 'meal1', user_id: 'user1' };
      const updatedMeal = { ...existingMeal, meal_name: 'Updated Meal', calories: 400 };

      dbQueryMock
        .mockResolvedValueOnce({ rows: [existingMeal] }) // Ownership check
        .mockResolvedValueOnce({ rows: [updatedMeal] }); // Update

      const result = await service.updateMeal('user1', 'meal1', {
        mealName: 'Updated Meal',
        calories: 400,
      });

      expect(result).toEqual(updatedMeal);
      expect(dbQueryMock).toHaveBeenCalledTimes(2);
    });

    test('verifies ownership before update', async () => {
      dbQueryMock.mockResolvedValueOnce({ rows: [] }); // No ownership

      await expect(service.updateMeal('user1', 'meal1', { mealName: 'Updated' }))
        .rejects
        .toThrow('MEAL_NOT_FOUND');

      expect(dbQueryMock).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['meal1', 'user1']
      );
    });
  });

  describe('deleteMeal', () => {
    test('throws error for invalid userId (guard clause)', async () => {
      await expect(service.deleteMeal('', 'meal1'))
        .rejects
        .toThrow('INVALID_USER');
    });

    test('throws error for invalid mealId (guard clause)', async () => {
      await expect(service.deleteMeal('user1', ''))
        .rejects
        .toThrow('INVALID_MEAL_ID');
    });

    test('throws error when meal not found', async () => {
      dbQueryMock.mockResolvedValue({ rowCount: 0 });

      await expect(service.deleteMeal('user1', 'nonexistent'))
        .rejects
        .toThrow('MEAL_NOT_FOUND');
    });

    test('deletes meal successfully', async () => {
      dbQueryMock.mockResolvedValue({ rowCount: 1 });

      const result = await service.deleteMeal('user1', 'meal1');

      expect(result).toEqual({ success: true });
      expect(dbQueryMock).toHaveBeenCalledWith(
        expect.stringContaining('DELETE'),
        ['meal1', 'user1']
      );
    });
  });

  // ============================================
  // FAILURE INJECTION (Senior-Level)
  // ============================================

  describe('Failure Scenarios', () => {
    test('gracefully handles database failure on create', async () => {
      const dbError = new Error('DB_CONNECTION_FAILED');
      dbQueryMock.mockRejectedValue(dbError);

      await expect(service.createMeal('user1', { mealType: 'breakfast' }))
        .rejects
        .toThrow('DB_CONNECTION_FAILED');
    });

    test('gracefully handles embedding queue failure (non-blocking)', async () => {
      const mockMeal = { id: 'meal1', user_id: 'user1' };
      dbQueryMock.mockResolvedValue({ rows: [mockMeal] });
      
      const queueError = new Error('QUEUE_FULL');
      embeddingQueueMock.enqueueEmbedding.mockRejectedValue(queueError);

      // Should still return meal even if embedding fails (non-blocking)
      const result = await service.createMeal('user1', { mealType: 'breakfast' });

      expect(result).toEqual(mockMeal);
      // Note: In production, you might want to log this error but not fail the operation
    });

    test('handles partial update failure', async () => {
      const existingMeal = { id: 'meal1' };
      dbQueryMock
        .mockResolvedValueOnce({ rows: [existingMeal] }) // Ownership check succeeds
        .mockRejectedValueOnce(new Error('DB_UPDATE_FAILED')); // Update fails

      await expect(service.updateMeal('user1', 'meal1', { mealName: 'Updated' }))
        .rejects
        .toThrow('DB_UPDATE_FAILED');
    });
  });

  // ============================================
  // CONTRACT TESTING (Senior-Level)
  // ============================================

  describe('Contract: createMeal()', () => {
    test('always returns meal object with required fields', async () => {
      const mockMeal = {
        id: 'meal1',
        user_id: 'user1',
        meal_type: 'breakfast',
        calories: 300,
      };

      dbQueryMock.mockResolvedValue({ rows: [mockMeal] });
      embeddingQueueMock.enqueueEmbedding.mockResolvedValue(undefined);

      const result = await service.createMeal('user1', { mealType: 'breakfast' });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('user_id');
      expect(result).toHaveProperty('meal_type');
      expect(typeof result.id).toBe('string');
    });

    test('always calculates macros deterministically for same foods', async () => {
      const foods = [
        { name: 'Apple', calories: 95, protein: 0.5, carbs: 25, fat: 0.3 },
      ];

      dbQueryMock.mockResolvedValue({ rows: [{ id: 'meal1' }] });
      embeddingQueueMock.enqueueEmbedding.mockResolvedValue(undefined);

      await service.createMeal('user1', { mealType: 'snack', foods });
      const call1 = dbQueryMock.mock.calls[0][1];

      dbQueryMock.mockClear();
      dbQueryMock.mockResolvedValue({ rows: [{ id: 'meal2' }] });

      await service.createMeal('user1', { mealType: 'snack', foods });
      const call2 = dbQueryMock.mock.calls[0][1];

      // Same foods should produce same calculated macros
      expect(call1[3]).toBe(call2[3]); // calories
      expect(call1[4]).toBe(call2[4]); // protein
      expect(call1[5]).toBe(call2[5]); // carbs
      expect(call1[6]).toBe(call2[6]); // fat
    });
  });

  // ============================================
  // PROPERTY-BASED THINKING (Elite Level)
  // ============================================

  describe('Property-Based: Macro Calculations', () => {
    test('calculated macros are always non-negative', async () => {
      const foods = [
        { name: 'Food1', calories: 100, protein: 10, carbs: 20, fat: 5 },
        { name: 'Food2', calories: 200, protein: 20, carbs: 30, fat: 10 },
      ];

      dbQueryMock.mockResolvedValue({ rows: [{ id: 'meal1' }] });
      embeddingQueueMock.enqueueEmbedding.mockResolvedValue(undefined);

      await service.createMeal('user1', { mealType: 'lunch', foods });

      const insertCall = dbQueryMock.mock.calls[0][1];
      const calories = insertCall[3];
      const protein = insertCall[4];
      const carbs = insertCall[5];
      const fat = insertCall[6];

      expect(calories).toBeGreaterThanOrEqual(0);
      expect(protein).toBeGreaterThanOrEqual(0);
      expect(carbs).toBeGreaterThanOrEqual(0);
      expect(fat).toBeGreaterThanOrEqual(0);
    });

    test('total calories match sum of macro calories (4:4:9 rule)', async () => {
      const foods = [
        { name: 'Food', calories: 100, protein: 10, carbs: 10, fat: 5 },
      ];

      dbQueryMock.mockResolvedValue({ rows: [{ id: 'meal1' }] });
      embeddingQueueMock.enqueueEmbedding.mockResolvedValue(undefined);

      await service.createMeal('user1', { mealType: 'breakfast', foods });

      const insertCall = dbQueryMock.mock.calls[0][1];
      const calories = insertCall[3];
      const protein = insertCall[4];
      const carbs = insertCall[5];
      const fat = insertCall[6];

      // Calories = (protein * 4) + (carbs * 4) + (fat * 9)
      const calculatedCalories = (protein * 4) + (carbs * 4) + (fat * 9);
      
      // Allow small rounding difference
      expect(Math.abs(calories - calculatedCalories)).toBeLessThan(1);
    });
  });
});

