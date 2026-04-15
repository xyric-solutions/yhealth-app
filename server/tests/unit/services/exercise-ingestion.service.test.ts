/**
 * Exercise Ingestion Service Unit Tests
 *
 * Tests for ETL pipeline: transformation, deduplication, batch upsert,
 * lookup table population, and cache invalidation.
 */

import { jest } from '@jest/globals';
import type { ExerciseDBExercise, RapidAPIExercise } from '../../../src/types/exercise-ingestion.types.js';

// ============================================
// MOCKS
// ============================================

const mockQuery = jest.fn<any>();
const mockTransaction = jest.fn<any>();

jest.unstable_mockModule('../../../src/database/pg.js', () => ({
  query: mockQuery,
  transaction: mockTransaction,
}));

jest.unstable_mockModule('../../../src/services/logger.service.js', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const mockCacheDeleteByPattern = jest.fn<() => number>().mockReturnValue(0);
jest.unstable_mockModule('../../../src/services/cache.service.js', () => ({
  cache: {
    getOrSet: jest.fn(),
    deleteByPattern: mockCacheDeleteByPattern,
  },
}));

const mockAxiosGet = jest.fn<any>();
jest.unstable_mockModule('axios', () => ({
  default: { get: mockAxiosGet },
}));

jest.unstable_mockModule('../../../src/utils/asyncHandler.js', () => ({
  asyncHandler: jest.fn(),
  withRetry: jest.fn<any>().mockImplementation((fn: () => Promise<unknown>) => fn()),
  withTimeout: jest.fn(),
}));

jest.unstable_mockModule('../../../src/config/env.config.js', () => ({
  env: {
    exercisedb: {
      rapidApiKey: 'test-rapid-api-key',
      rapidApiHost: 'exercisedb.p.rapidapi.com',
    },
  },
}));

// Dynamic imports after mocks
const {
  transformExerciseDB,
  transformRapidAPI,
  batchUpsert,
  populateLookupTables,
  invalidateExerciseCache,
} = await import('../../../src/services/exercise-ingestion.service.js');

// ============================================
// FIXTURES
// ============================================

function makeExerciseDBExercise(overrides: Partial<ExerciseDBExercise> = {}): ExerciseDBExercise {
  return {
    exerciseId: 'edb-001',
    name: 'barbell bench press',
    gifUrl: 'https://example.com/bench-press.gif',
    targetMuscles: ['Pectorals'],
    bodyParts: ['Chest'],
    equipments: ['Barbell'],
    secondaryMuscles: ['Triceps', 'Anterior Deltoid'],
    instructions: ['Step:1 Lie on a flat bench.', 'Step:2 Press the barbell up.'],
    ...overrides,
  };
}

function makeRapidAPIExercise(overrides: Partial<RapidAPIExercise> = {}): RapidAPIExercise {
  return {
    id: 'rap-001',
    name: 'dumbbell curl',
    bodyPart: 'upper arms',
    target: 'biceps',
    equipment: 'dumbbell',
    gifUrl: 'https://example.com/curl.gif',
    secondaryMuscles: ['forearms'],
    instructions: ['Step:1 Stand with dumbbells.', 'Step:2 Curl up.'],
    ...overrides,
  };
}

/** Shorthand for pg result */
function qr<T>(rows: T[] = []) {
  return { rows, rowCount: rows.length, command: 'SELECT' as const, oid: 0, fields: [] };
}

// ============================================
// TESTS
// ============================================

describe('ExerciseIngestionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-establish mock implementations (resetMocks: true in config clears them)
    mockCacheDeleteByPattern.mockReturnValue(0);
    mockTransaction.mockImplementation(async (fn: (client: unknown) => Promise<unknown>) => fn({ query: mockQuery }));
  });

  // ------------------------------------------
  // transformExerciseDB
  // ------------------------------------------
  describe('transformExerciseDB', () => {
    it('should transform an ExerciseDB exercise to internal format', () => {
      const raw = makeExerciseDBExercise();
      const result = transformExerciseDB(raw);

      expect(result.name).toBe('Barbell bench press');
      expect(result.slug).toBe('exercisedb-barbell-bench-press-edb-001');
      expect(result.source).toBe('exercisedb');
      expect(result.sourceId).toBe('edb-001');
      expect(result.primaryMuscleGroup).toBe('pectorals');
      expect(result.secondaryMuscleGroups).toEqual(['triceps', 'anterior deltoid']);
      expect(result.equipmentRequired).toEqual(['barbell']);
      expect(result.bodyPart).toBe('chest');
      expect(result.targetMuscles).toEqual(['pectorals']);
    });

    it('should capitalize first letter of name', () => {
      const raw = makeExerciseDBExercise({ name: 'low bar squat' });
      const result = transformExerciseDB(raw);
      expect(result.name).toBe('Low bar squat');
    });

    it('should strip "Step:N " prefix from instructions', () => {
      const raw = makeExerciseDBExercise();
      const result = transformExerciseDB(raw);
      expect(result.instructions[0]).toBe('Lie on a flat bench.');
      expect(result.instructions[1]).toBe('Press the barbell up.');
    });

    it('should use first instruction as description', () => {
      const raw = makeExerciseDBExercise();
      const result = transformExerciseDB(raw);
      expect(result.description).toBe('Lie on a flat bench.');
    });

    it('should set description to null when no instructions', () => {
      const raw = makeExerciseDBExercise({ instructions: [] });
      const result = transformExerciseDB(raw);
      expect(result.description).toBeNull();
    });

    it('should infer category as cardio for cardio body parts', () => {
      const raw = makeExerciseDBExercise({ bodyParts: ['cardio'], equipments: ['body weight'] });
      const result = transformExerciseDB(raw);
      expect(result.category).toBe('cardio');
    });

    it('should infer difficulty as advanced for barbell equipment', () => {
      const raw = makeExerciseDBExercise({ equipments: ['Barbell'] });
      const result = transformExerciseDB(raw);
      expect(result.difficultyLevel).toBe('advanced');
    });

    it('should infer difficulty as beginner for body weight', () => {
      const raw = makeExerciseDBExercise({ equipments: ['body weight'] });
      const result = transformExerciseDB(raw);
      expect(result.difficultyLevel).toBe('beginner');
    });

    it('should extract gif media URLs', () => {
      const raw = makeExerciseDBExercise();
      const result = transformExerciseDB(raw);
      expect(result.mediaUrls).toHaveLength(1);
      expect(result.mediaUrls[0]).toEqual({
        type: 'gif',
        url: 'https://example.com/bench-press.gif',
        isPrimary: true,
      });
    });

    it('should handle missing gifUrl', () => {
      const raw = makeExerciseDBExercise({ gifUrl: '' });
      const result = transformExerciseDB(raw);
      expect(result.mediaUrls).toHaveLength(0);
    });

    it('should generate tags from category, body part, and equipment', () => {
      const raw = makeExerciseDBExercise();
      const result = transformExerciseDB(raw);
      expect(result.tags).toContain('strength');
      expect(result.tags).toContain('chest');
      expect(result.tags).toContain('barbell');
    });

    it('should store external metadata', () => {
      const raw = makeExerciseDBExercise();
      const result = transformExerciseDB(raw);
      expect(result.externalMetadata).toEqual({
        originalName: 'barbell bench press',
        originalEquipments: ['Barbell'],
        originalBodyParts: ['Chest'],
      });
    });
  });

  // ------------------------------------------
  // transformRapidAPI
  // ------------------------------------------
  describe('transformRapidAPI', () => {
    it('should transform a RapidAPI exercise to internal format', () => {
      const raw = makeRapidAPIExercise();
      const result = transformRapidAPI(raw);

      expect(result.name).toBe('Dumbbell curl');
      expect(result.slug).toBe('rapidapi-dumbbell-curl-rap-001');
      expect(result.source).toBe('rapidapi');
      expect(result.sourceId).toBe('rap-001');
      expect(result.primaryMuscleGroup).toBe('biceps');
      expect(result.equipmentRequired).toEqual(['dumbbell']);
      expect(result.bodyPart).toBe('upper arms');
    });

    it('should set category to strength by default', () => {
      const raw = makeRapidAPIExercise();
      const result = transformRapidAPI(raw);
      expect(result.category).toBe('strength');
    });

    it('should set difficulty to intermediate by default', () => {
      const raw = makeRapidAPIExercise();
      const result = transformRapidAPI(raw);
      expect(result.difficultyLevel).toBe('intermediate');
    });

    it('should strip step prefixes from instructions', () => {
      const raw = makeRapidAPIExercise();
      const result = transformRapidAPI(raw);
      expect(result.instructions[0]).toBe('Stand with dumbbells.');
    });

    it('should include bodyPart, equipment, target in tags', () => {
      const raw = makeRapidAPIExercise();
      const result = transformRapidAPI(raw);
      expect(result.tags).toContain('upper arms');
      expect(result.tags).toContain('dumbbell');
      expect(result.tags).toContain('biceps');
    });
  });

  // ------------------------------------------
  // batchUpsert
  // ------------------------------------------
  describe('batchUpsert', () => {
    it('should return dry run result without hitting database', async () => {
      const exercises = [transformExerciseDB(makeExerciseDBExercise())];
      const result = await batchUpsert(exercises, { dryRun: true });

      expect(result.inserted).toBe(1);
      expect(result.updated).toBe(0);
      expect(result.failed).toBe(0);
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('should call transaction for real upserts', async () => {
      const mockClient = {
        query: jest.fn<any>().mockResolvedValue({
          rows: [{ id: 'uuid-1', is_insert: true }],
        }),
      };
      mockTransaction.mockImplementation(async (cb: (client: unknown) => Promise<void>) => {
        await cb(mockClient);
      });

      const exercises = [transformExerciseDB(makeExerciseDBExercise())];
      const result = await batchUpsert(exercises);

      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(result.inserted).toBe(1);
      expect(result.updated).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('should count updates when is_insert is false', async () => {
      const mockClient = {
        query: jest.fn<any>().mockResolvedValue({
          rows: [{ id: 'uuid-1', is_insert: false }],
        }),
      };
      mockTransaction.mockImplementation(async (cb: (client: unknown) => Promise<void>) => {
        await cb(mockClient);
      });

      const exercises = [transformExerciseDB(makeExerciseDBExercise())];
      const result = await batchUpsert(exercises);

      expect(result.inserted).toBe(0);
      expect(result.updated).toBe(1);
    });

    it('should handle individual exercise failures gracefully', async () => {
      const mockClient = {
        query: jest.fn<any>()
          .mockResolvedValueOnce(undefined) // SAVEPOINT sp_0
          .mockResolvedValueOnce({ rows: [{ id: 'uuid-1', is_insert: true }] }) // 1st exercise succeeds
          .mockResolvedValueOnce(undefined) // RELEASE SAVEPOINT sp_0
          .mockResolvedValueOnce(undefined) // SAVEPOINT sp_1
          .mockRejectedValueOnce(new Error('Unique constraint violation')) // 2nd exercise fails
          .mockResolvedValueOnce(undefined), // ROLLBACK TO SAVEPOINT sp_1
      };
      mockTransaction.mockImplementation(async (cb: (client: unknown) => Promise<void>) => {
        await cb(mockClient);
      });

      const exercises = [
        transformExerciseDB(makeExerciseDBExercise({ exerciseId: 'edb-001' })),
        transformExerciseDB(makeExerciseDBExercise({ exerciseId: 'edb-002', name: 'squat' })),
      ];
      const result = await batchUpsert(exercises);

      expect(result.inserted).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe('Unique constraint violation');
    });

    it('should insert media when mediaUrls are present', async () => {
      const mockClient = {
        query: jest.fn<any>()
          .mockResolvedValueOnce(undefined) // SAVEPOINT sp_0
          .mockResolvedValueOnce({ rows: [{ id: 'uuid-1', is_insert: true }] }) // upsert
          .mockResolvedValueOnce({ rows: [] }) // media insert
          .mockResolvedValueOnce(undefined), // RELEASE SAVEPOINT sp_0
      };
      mockTransaction.mockImplementation(async (cb: (client: unknown) => Promise<void>) => {
        await cb(mockClient);
      });

      const exercises = [transformExerciseDB(makeExerciseDBExercise())];
      await batchUpsert(exercises);

      // Calls: SAVEPOINT, upsert, media INSERT, RELEASE SAVEPOINT
      expect(mockClient.query).toHaveBeenCalledTimes(4);
      const mediaCall = mockClient.query.mock.calls[2][0] as string;
      expect(mediaCall).toContain('exercise_media');
    });

    it('should handle empty exercise array', async () => {
      const result = await batchUpsert([]);
      expect(result.inserted).toBe(0);
      expect(result.updated).toBe(0);
      expect(result.failed).toBe(0);
      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  // ------------------------------------------
  // populateLookupTables
  // ------------------------------------------
  describe('populateLookupTables', () => {
    it('should extract unique muscles, equipment, and body parts', async () => {
      mockQuery
        // muscles query
        .mockResolvedValueOnce(qr([{ name: 'chest' }, { name: 'triceps' }]))
        // muscle inserts
        .mockResolvedValueOnce(qr())
        .mockResolvedValueOnce(qr())
        // equipment query
        .mockResolvedValueOnce(qr([{ name: 'barbell' }]))
        // equipment insert
        .mockResolvedValueOnce(qr())
        // body parts query
        .mockResolvedValueOnce(qr([{ name: 'chest' }]))
        // body parts insert
        .mockResolvedValueOnce(qr());

      const result = await populateLookupTables();

      expect(result.muscles).toBe(2);
      expect(result.equipment).toBe(1);
      expect(result.bodyParts).toBe(1);
    });

    it('should skip empty or whitespace names', async () => {
      mockQuery
        .mockResolvedValueOnce(qr([{ name: '' }, { name: '  ' }, { name: 'chest' }]))
        .mockResolvedValueOnce(qr()) // only 'chest' inserted
        .mockResolvedValueOnce(qr([])) // equipment
        .mockResolvedValueOnce(qr([])); // body parts

      const result = await populateLookupTables();
      expect(result.muscles).toBe(1);
    });

    it('should use ON CONFLICT DO NOTHING for duplicate slugs', async () => {
      mockQuery
        .mockResolvedValueOnce(qr([{ name: 'chest' }]))
        .mockResolvedValueOnce(qr())
        .mockResolvedValueOnce(qr([]))
        .mockResolvedValueOnce(qr([]));

      await populateLookupTables();

      const muscleInsertCall = mockQuery.mock.calls[1][0] as string;
      expect(muscleInsertCall).toContain('ON CONFLICT');
      expect(muscleInsertCall).toContain('DO NOTHING');
    });
  });

  // ------------------------------------------
  // invalidateExerciseCache
  // ------------------------------------------
  describe('invalidateExerciseCache', () => {
    it('should delete cache entries matching exercises pattern', () => {
      mockCacheDeleteByPattern.mockReturnValue(5);
      invalidateExerciseCache();
      expect(mockCacheDeleteByPattern).toHaveBeenCalledTimes(1);
      const pattern = mockCacheDeleteByPattern.mock.calls[0][0] as RegExp;
      expect(pattern.test('exercises:list:abc123')).toBe(true);
      expect(pattern.test('exercises:id:uuid')).toBe(true);
      expect(pattern.test('workouts:list:abc')).toBe(false);
    });
  });
});
