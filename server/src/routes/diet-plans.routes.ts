/**
 * Diet Plans Routes
 * CRUD operations for user diet plans and meal logging
 * Includes AI generation for plans, meals, and recipes
 */

import { Router, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import authenticate from '../middlewares/auth.middleware.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { ApiError } from '../utils/ApiError.js';
import { query as dbQuery } from '../database/pg.js';
import { logger } from '../services/logger.service.js';
import { aiProviderService } from '../services/ai-provider.service.js';
import { reminderSchedulerService } from '../services/reminder-scheduler.service.js';
import { embeddingQueueService } from '../services/embedding-queue.service.js';
import { proactiveMessagingService } from '../services/proactive-messaging.service.js';
import { JobPriorities } from '../config/queue.config.js';
import { cache } from '../services/cache.service.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Types
interface DietPlan {
  id: string;
  userId: string;
  planId: string | null;
  name: string;
  description: string | null;
  goalCategory: string;
  dailyCalories: number | null;
  proteinGrams: number | null;
  carbsGrams: number | null;
  fatGrams: number | null;
  fiberGrams: number | null;
  dietaryPreferences: string[];
  allergies: string[];
  excludedFoods: string[];
  mealsPerDay: number;
  snacksPerDay: number;
  mealTimes: Record<string, string>;
  weeklyMeals: Record<string, unknown>;
  suggestedRecipes: unknown[];
  shoppingList: unknown[];
  adherenceRate: number;
  status: string;
  startDate: string;
  endDate: string | null;
  aiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DietPlanRow {
  id: string;
  user_id: string;
  plan_id: string | null;
  name: string;
  description: string | null;
  goal_category: string;
  daily_calories: number | null;
  protein_grams: number | null;
  carbs_grams: number | null;
  fat_grams: number | null;
  fiber_grams: number | null;
  dietary_preferences: string[] | null;
  allergies: string[] | null;
  excluded_foods: string[] | null;
  meals_per_day: number;
  snacks_per_day: number;
  meal_times: Record<string, string> | null;
  weekly_meals: Record<string, unknown> | null;
  suggested_recipes: unknown[] | null;
  shopping_list: unknown[] | null;
  adherence_rate: number;
  status: string;
  start_date: Date;
  end_date: Date | null;
  ai_generated: boolean;
  created_at: Date;
  updated_at: Date;
}

interface MealLog {
  id: string;
  userId: string;
  dietPlanId: string | null;
  mealType: string;
  mealName: string | null;
  description: string | null;
  calories: number | null;
  proteinGrams: number | null;
  carbsGrams: number | null;
  fatGrams: number | null;
  fiberGrams: number | null;
  foods: unknown[];
  photoUrl: string | null;
  eatenAt: string;
  hungerBefore: number | null;
  satisfactionAfter: number | null;
  notes: string | null;
  aiFeedback: string | null;
  healthScore: number | null;
  createdAt: string;
  updatedAt: string;
}

interface MealLogRow {
  id: string;
  user_id: string;
  diet_plan_id: string | null;
  meal_type: string;
  meal_name: string | null;
  description: string | null;
  calories: number | null;
  protein_grams: number | null;
  carbs_grams: number | null;
  fat_grams: number | null;
  fiber_grams: number | null;
  foods: unknown[] | null;
  photo_url: string | null;
  eaten_at: Date;
  hunger_before: number | null;
  satisfaction_after: number | null;
  notes: string | null;
  ai_feedback: string | null;
  health_score: number | null;
  created_at: Date;
  updated_at: Date;
}

// Transform functions
function transformDietPlan(row: DietPlanRow): DietPlan {
  return {
    id: row.id,
    userId: row.user_id,
    planId: row.plan_id,
    name: row.name,
    description: row.description,
    goalCategory: row.goal_category,
    dailyCalories: row.daily_calories,
    proteinGrams: row.protein_grams,
    carbsGrams: row.carbs_grams,
    fatGrams: row.fat_grams,
    fiberGrams: row.fiber_grams,
    dietaryPreferences: row.dietary_preferences || [],
    allergies: row.allergies || [],
    excludedFoods: row.excluded_foods || [],
    mealsPerDay: row.meals_per_day,
    snacksPerDay: row.snacks_per_day,
    mealTimes: row.meal_times || {},
    weeklyMeals: row.weekly_meals || {},
    suggestedRecipes: row.suggested_recipes || [],
    shoppingList: row.shopping_list || [],
    adherenceRate: row.adherence_rate,
    status: row.status,
    startDate: typeof row.start_date === 'string'
      ? row.start_date
      : row.start_date.toISOString().split('T')[0],
    endDate: row.end_date
      ? (typeof row.end_date === 'string'
        ? row.end_date
        : row.end_date.toISOString().split('T')[0])
      : null,
    aiGenerated: row.ai_generated,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function transformMealLog(row: MealLogRow): MealLog {
  return {
    id: row.id,
    userId: row.user_id,
    dietPlanId: row.diet_plan_id,
    mealType: row.meal_type,
    mealName: row.meal_name,
    description: row.description,
    calories: row.calories,
    proteinGrams: row.protein_grams,
    carbsGrams: row.carbs_grams,
    fatGrams: row.fat_grams,
    fiberGrams: row.fiber_grams,
    foods: row.foods || [],
    photoUrl: row.photo_url,
    eatenAt: row.eaten_at.toISOString(),
    hungerBefore: row.hunger_before,
    satisfactionAfter: row.satisfaction_after,
    notes: row.notes,
    aiFeedback: row.ai_feedback,
    healthScore: row.health_score,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

// ============================================
// AI GENERATION ENDPOINTS
// ============================================

/**
 * POST /api/diet-plans/generate
 * Generate a diet plan using AI based on description
 */
router.post(
  '/generate',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { description, goalCategory = 'weight_loss', dailyCalories, dietaryPreferences = [], allergies = [] } = req.body;

    if (!description?.trim()) {
      throw ApiError.badRequest('Description is required for AI generation');
    }

    if (!aiProviderService.isAvailable()) {
      throw ApiError.serviceUnavailable('AI generation is not available. No AI providers configured.');
    }

    const systemPrompt = `You are a professional nutritionist. Create a personalized diet plan based on the user's description. Always respond with valid JSON.

Respond ONLY with a JSON object in this exact format (no markdown, no code blocks):
{
  "name": "Plan name",
  "description": "Brief plan description",
  "dailyCalories": 2000,
  "proteinGrams": 120,
  "carbsGrams": 200,
  "fatGrams": 65,
  "fiberGrams": 30,
  "mealsPerDay": 3,
  "snacksPerDay": 2,
  "mealTimes": {"breakfast": "07:00", "lunch": "12:00", "dinner": "19:00"},
  "weeklyMeals": {
    "monday": {"breakfast": "Meal description", "lunch": "Meal description", "dinner": "Meal description"},
    "tuesday": {"breakfast": "...", "lunch": "...", "dinner": "..."}
  },
  "tips": ["Tip 1", "Tip 2", "Tip 3"]
}

Consider:
- Goal: ${goalCategory.replace('_', ' ')}
- Target calories: ${dailyCalories || 'calculate based on goal'}
- Dietary preferences: ${dietaryPreferences.length > 0 ? dietaryPreferences.join(', ') : 'none specified'}
- Allergies/restrictions: ${allergies.length > 0 ? allergies.join(', ') : 'none specified'}

Create a balanced, practical, and sustainable plan.`;

    const userPrompt = `Create a diet plan for: "${description}"`;

    try {
      const response = await aiProviderService.generateCompletion({
        systemPrompt,
        userPrompt,
        maxTokens: 2000,
        temperature: 0.7,
      });

      // Parse AI response
      let planData: {
        name?: string;
        description?: string;
        dailyCalories?: number;
        proteinGrams?: number;
        carbsGrams?: number;
        fatGrams?: number;
        fiberGrams?: number;
        mealsPerDay?: number;
        snacksPerDay?: number;
        mealTimes?: Record<string, string>;
        weeklyMeals?: Record<string, unknown>;
        tips?: string[];
      } = {};

      try {
        let jsonStr = response.content.trim();
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1].trim();
        }
        planData = JSON.parse(jsonStr);
      } catch {
        logger.warn('[Diet Plans] Failed to parse AI response', { userId, response: response.content });
        throw ApiError.internal('Failed to parse AI response');
      }

      // Create the diet plan in database
      const result = await dbQuery<DietPlanRow>(
        `INSERT INTO diet_plans (
          user_id, name, description, goal_category,
          daily_calories, protein_grams, carbs_grams, fat_grams, fiber_grams,
          dietary_preferences, allergies, excluded_foods,
          meals_per_day, snacks_per_day, meal_times, weekly_meals,
          suggested_recipes, status, ai_generated
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *`,
        [
          userId,
          planData.name || 'AI Generated Plan',
          planData.description || description,
          goalCategory,
          planData.dailyCalories || dailyCalories || null,
          planData.proteinGrams ?? null,
          planData.carbsGrams ?? null,
          planData.fatGrams ?? null,
          planData.fiberGrams ?? null,
          JSON.stringify(dietaryPreferences),
          JSON.stringify(allergies),
          JSON.stringify([]),
          planData.mealsPerDay || 3,
          planData.snacksPerDay || 2,
          JSON.stringify(planData.mealTimes || {}),
          JSON.stringify(planData.weeklyMeals || {}),
          JSON.stringify([]),
          'active',
          true,
        ]
      );

      // Deactivate other plans
      await dbQuery(
        `UPDATE diet_plans SET status = 'draft' WHERE user_id = $1 AND id != $2 AND status = 'active'`,
        [userId, result.rows[0].id]
      );

      logger.info('[Diet Plans] AI generated diet plan', { userId, planId: result.rows[0].id, provider: response.provider });

      res.status(201).json({
        success: true,
        data: {
          plan: transformDietPlan(result.rows[0]),
          tips: planData.tips || [],
          provider: response.provider,
        },
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[Diet Plans] AI generation failed', { userId, error: errorMessage });
      throw ApiError.internal(`Failed to generate diet plan: ${errorMessage}`);
    }
  })
);

/**
 * POST /api/diet-plans/meals/generate
 * Generate a meal using AI based on description
 * NOTE: This does NOT save to database - it just returns generated meal data
 * The user can then save it using POST /api/diet-plans/meals
 */
router.post(
  '/meals/generate',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { description, mealType = 'lunch', targetCalories, dietaryPreferences = [] } = req.body;

    if (!description?.trim()) {
      throw ApiError.badRequest('Description is required for AI generation');
    }

    if (!aiProviderService.isAvailable()) {
      throw ApiError.serviceUnavailable('AI generation is not available. No AI providers configured.');
    }

    const systemPrompt = `Nutrition expert. Return ONLY valid JSON.`;

    const constraints = [
      targetCalories ? `~${targetCalories} cal` : '',
      dietaryPreferences.length > 0 ? dietaryPreferences.join(', ') : '',
    ].filter(Boolean).join('. ');

    const userPrompt = `${mealType}: "${description}"${constraints ? ` (${constraints})` : ''}
JSON: {"mealName":"","description":"","calories":0,"proteinGrams":0,"carbsGrams":0,"fatGrams":0,"fiberGrams":0,"foods":[{"name":"","calories":0,"protein":0,"carbs":0,"fat":0,"portion":""}],"preparationTips":""}`;

    try {
      const response = await aiProviderService.generateCompletion({
        systemPrompt,
        userPrompt,
        maxTokens: 2048,
        temperature: 0.4,
        jsonMode: true,
      });

      // Parse AI response
      let mealData: {
        mealName?: string;
        description?: string;
        calories?: number;
        proteinGrams?: number;
        carbsGrams?: number;
        fatGrams?: number;
        fiberGrams?: number;
        foods?: Array<{ name: string; calories: number; protein: number; carbs: number; fat: number; portion: string }>;
        preparationTips?: string;
      } = {};

      try {
        let jsonStr = response.content.trim();
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1].trim();
        }
        // Extract JSON object if surrounded by extra text
        const objMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (objMatch) {
          jsonStr = objMatch[0];
        }
        mealData = JSON.parse(jsonStr);
      } catch (parseErr) {
        // Attempt to salvage truncated JSON by closing open structures
        try {
          let salvaged = response.content.trim();
          const objMatch2 = salvaged.match(/\{[\s\S]*/);
          if (objMatch2) {
            salvaged = objMatch2[0];
            // Remove trailing incomplete value (cut-off string/number)
            salvaged = salvaged.replace(/,\s*"[^"]*"?\s*:?\s*"?[^"{}[\]]*$/, '');
            // Close any open arrays and objects
            const openBraces = (salvaged.match(/\{/g) || []).length - (salvaged.match(/\}/g) || []).length;
            const openBrackets = (salvaged.match(/\[/g) || []).length - (salvaged.match(/\]/g) || []).length;
            salvaged += ']'.repeat(Math.max(0, openBrackets)) + '}'.repeat(Math.max(0, openBraces));
            mealData = JSON.parse(salvaged);
            logger.info('[Diet Plans] Salvaged truncated AI meal response', { userId });
          } else {
            throw parseErr;
          }
        } catch {
          logger.warn('[Diet Plans] Failed to parse AI meal response', { userId, response: response.content });
          throw ApiError.internal('Failed to generate meal. Please try again.');
        }
      }

      // Return the generated meal data WITHOUT saving to database
      // The client will display this for review and save it when user confirms
      logger.info('[Diet Plans] AI generated meal (not saved)', { userId, mealName: mealData.mealName, provider: response.provider });

      res.status(200).json({
        success: true,
        data: {
          // Return meal-like structure for client to use
          meal: {
            mealType,
            mealName: mealData.mealName || 'AI Generated Meal',
            description: mealData.description || description,
            calories: mealData.calories ?? null,
            proteinGrams: mealData.proteinGrams ?? null,
            carbsGrams: mealData.carbsGrams ?? null,
            fatGrams: mealData.fatGrams ?? null,
            fiberGrams: mealData.fiberGrams ?? null,
            foods: mealData.foods || [],
          },
          preparationTips: mealData.preparationTips || '',
          provider: response.provider,
        },
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[Diet Plans] AI meal generation failed', { userId, error: errorMessage });
      throw ApiError.internal(`Failed to generate meal: ${errorMessage}`);
    }
  })
);

/**
 * POST /api/diet-plans/recipes/generate
 * Generate a recipe using AI based on description
 */
router.post(
  '/recipes/generate',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { description, category = 'other', servings = 4, dietaryPreferences = [], difficulty = 'medium' } = req.body;

    if (!description?.trim()) {
      throw ApiError.badRequest('Description is required for AI generation');
    }

    if (!aiProviderService.isAvailable()) {
      throw ApiError.serviceUnavailable('AI generation is not available. No AI providers configured.');
    }

    const systemPrompt = `Chef & nutritionist. Return ONLY valid JSON.`;

    const recipeConstraints = [
      `${category}, ${difficulty}, ${servings} servings`,
      dietaryPreferences.length > 0 ? dietaryPreferences.join(', ') : '',
    ].filter(Boolean).join('. ');

    const userPrompt = `Recipe: "${description}" (${recipeConstraints})
JSON: {"name":"","description":"","category":"${category}","cuisine":"","servings":${servings},"caloriesPerServing":0,"proteinGrams":0,"carbsGrams":0,"fatGrams":0,"fiberGrams":0,"prepTimeMinutes":0,"cookTimeMinutes":0,"difficulty":"${difficulty}","ingredients":[{"name":"","quantity":"","unit":"","notes":""}],"instructions":[{"step":1,"description":""}],"tags":[],"dietaryFlags":[],"tips":""}`;

    try {
      const response = await aiProviderService.generateCompletion({
        systemPrompt,
        userPrompt,
        maxTokens: 1500,
        temperature: 0.5,
        jsonMode: true,
      });

      // Parse AI response
      let recipeData: {
        name?: string;
        description?: string;
        category?: string;
        cuisine?: string;
        servings?: number;
        caloriesPerServing?: number;
        proteinGrams?: number;
        carbsGrams?: number;
        fatGrams?: number;
        fiberGrams?: number;
        prepTimeMinutes?: number;
        cookTimeMinutes?: number;
        difficulty?: string;
        ingredients?: Array<{ name: string; quantity: string; unit: string; notes?: string }>;
        instructions?: Array<{ step: number; description: string }>;
        tags?: string[];
        dietaryFlags?: string[];
        tips?: string;
      } = {};

      try {
        let jsonStr = response.content.trim();
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1].trim();
        }
        recipeData = JSON.parse(jsonStr);
      } catch {
        logger.warn('[Diet Plans] Failed to parse AI recipe response', { userId, response: response.content });
        throw ApiError.internal('Failed to parse AI response');
      }

      // Calculate total time
      const totalTime = (recipeData.prepTimeMinutes || 0) + (recipeData.cookTimeMinutes || 0);

      // Create recipe in database
      const result = await dbQuery<RecipeRow>(
        `INSERT INTO user_recipes (
          user_id, name, description, category, cuisine,
          servings, calories_per_serving, protein_grams, carbs_grams, fat_grams, fiber_grams,
          ingredients, instructions, prep_time_minutes, cook_time_minutes, total_time_minutes,
          tags, dietary_flags, difficulty, source
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING *`,
        [
          userId,
          recipeData.name || 'AI Generated Recipe',
          recipeData.description || description,
          recipeData.category || category,
          recipeData.cuisine || null,
          recipeData.servings || servings,
          recipeData.caloriesPerServing ?? null,
          recipeData.proteinGrams ?? null,
          recipeData.carbsGrams ?? null,
          recipeData.fatGrams ?? null,
          recipeData.fiberGrams ?? null,
          JSON.stringify(recipeData.ingredients || []),
          JSON.stringify(recipeData.instructions || []),
          recipeData.prepTimeMinutes || null,
          recipeData.cookTimeMinutes || null,
          totalTime || null,
          JSON.stringify(recipeData.tags || []),
          JSON.stringify(recipeData.dietaryFlags || dietaryPreferences),
          recipeData.difficulty || difficulty,
          'ai_generated',
        ]
      );

      logger.info('[Diet Plans] AI generated recipe', { userId, recipeId: result.rows[0].id, provider: response.provider });

      res.status(201).json({
        success: true,
        data: {
          recipe: transformRecipe(result.rows[0]),
          tips: recipeData.tips || '',
          provider: response.provider,
        },
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[Diet Plans] AI recipe generation failed', { userId, error: errorMessage });
      throw ApiError.internal(`Failed to generate recipe: ${errorMessage}`);
    }
  })
);

// ============================================
// DIET PLANS CRUD
// ============================================

/**
 * GET /api/diet-plans
 * Get all diet plans for user
 */
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { status } = req.query;

    let sqlQuery = `
      SELECT * FROM diet_plans
      WHERE user_id = $1
    `;
    const params: (string | number | boolean | null | Date | object)[] = [userId];

    if (status) {
      sqlQuery += ` AND status = $2`;
      params.push(status);
    }

    sqlQuery += ` ORDER BY created_at DESC`;

    const result = await dbQuery<DietPlanRow>(sqlQuery, params);

    res.json({
      success: true,
      data: {
        plans: result.rows.map(transformDietPlan),
        total: result.rows.length,
      },
    });
  })
);

/**
 * POST /api/diet-plans
 * Create a new diet plan
 */
router.post(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const {
      name,
      description,
      goalCategory = 'maintenance',
      dailyCalories,
      proteinGrams,
      carbsGrams,
      fatGrams,
      fiberGrams,
      dietaryPreferences = [],
      allergies = [],
      excludedFoods = [],
      mealsPerDay = 3,
      snacksPerDay = 2,
      mealTimes = {},
      weeklyMeals = {},
      suggestedRecipes = [],
      isActive = false,
    } = req.body;

    if (!name?.trim()) {
      throw ApiError.badRequest('Diet plan name is required');
    }

    // If setting as active, deactivate other plans (set them to 'draft')
    if (isActive) {
      await dbQuery(
        `UPDATE diet_plans SET status = 'draft' WHERE user_id = $1 AND status = 'active'`,
        [userId]
      );
    }

    const result = await dbQuery<DietPlanRow>(
      `INSERT INTO diet_plans (
        user_id, name, description, goal_category,
        daily_calories, protein_grams, carbs_grams, fat_grams, fiber_grams,
        dietary_preferences, allergies, excluded_foods,
        meals_per_day, snacks_per_day, meal_times, weekly_meals,
        suggested_recipes, status, ai_generated
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *`,
      [
        userId,
        name.trim(),
        description || null,
        goalCategory,
        dailyCalories || null,
        proteinGrams ?? null,
        carbsGrams ?? null,
        fatGrams ?? null,
        fiberGrams ?? null,
        JSON.stringify(dietaryPreferences),
        JSON.stringify(allergies),
        JSON.stringify(excludedFoods),
        mealsPerDay,
        snacksPerDay,
        JSON.stringify(mealTimes),
        JSON.stringify(weeklyMeals),
        JSON.stringify(suggestedRecipes),
        isActive ? 'active' : 'draft',
        false,
      ]
    );

    logger.info('[Diet Plans] Created diet plan', { userId, planId: result.rows[0].id });

    // Enqueue embedding creation (async, non-blocking)
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'diet_plan',
      sourceId: result.rows[0].id,
      operation: 'create',
      priority: JobPriorities.CRITICAL,
    });

    res.status(201).json({
      success: true,
      data: { plan: transformDietPlan(result.rows[0]) },
    });
  })
);

/**
 * PATCH /api/diet-plans/:id
 * Update a diet plan
 */
router.patch(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;
    const updates = req.body;

    // Verify ownership
    const existing = await dbQuery<DietPlanRow>(
      `SELECT * FROM diet_plans WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (existing.rows.length === 0) {
      throw ApiError.notFound('Diet plan not found');
    }

    // Build update query dynamically
    const allowedFields = [
      'name',
      'description',
      'goal_category',
      'daily_calories',
      'protein_grams',
      'carbs_grams',
      'fat_grams',
      'fiber_grams',
      'dietary_preferences',
      'allergies',
      'excluded_foods',
      'meals_per_day',
      'snacks_per_day',
      'meal_times',
      'weekly_meals',
      'suggested_recipes',
      'status',
      'end_date',
    ];

    const fieldMapping: Record<string, string> = {
      name: 'name',
      description: 'description',
      goalCategory: 'goal_category',
      dailyCalories: 'daily_calories',
      proteinGrams: 'protein_grams',
      carbsGrams: 'carbs_grams',
      fatGrams: 'fat_grams',
      fiberGrams: 'fiber_grams',
      dietaryPreferences: 'dietary_preferences',
      allergies: 'allergies',
      excludedFoods: 'excluded_foods',
      mealsPerDay: 'meals_per_day',
      snacksPerDay: 'snacks_per_day',
      mealTimes: 'meal_times',
      weeklyMeals: 'weekly_meals',
      suggestedRecipes: 'suggested_recipes',
      status: 'status',
      endDate: 'end_date',
    };

    // Valid goal_category enum values
    const validGoalCategories = [
      'weight_loss',
      'muscle_building',
      'sleep_improvement',
      'stress_wellness',
      'energy_productivity',
      'event_training',
      'health_condition',
      'habit_building',
      'overall_optimization',
      'custom',
    ];

    // Map common invalid values to valid enum values
    const goalCategoryMapping: Record<string, string> = {
      balanced: 'overall_optimization',
      'general health': 'overall_optimization',
      'general_health': 'overall_optimization',
      wellness: 'stress_wellness',
      fitness: 'muscle_building',
      nutrition: 'overall_optimization',
    };

    const setClauses: string[] = [];
    const values: (string | number | boolean | null | Date | object)[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      const dbField = fieldMapping[key];
      if (dbField && allowedFields.includes(dbField)) {
        setClauses.push(`${dbField} = $${paramIndex}`);
        
        // Validate and map goal_category
        if (dbField === 'goal_category') {
          let goalCategory = value as string;
          
          
          // Check if it's a valid enum value
          if (!validGoalCategories.includes(goalCategory)) {
            // Try to map it
            const mapped = goalCategoryMapping[goalCategory.toLowerCase()];
            if (mapped) {
              goalCategory = mapped;
              logger.warn('[Diet Plans] Mapped invalid goal_category', {
                userId,
                original: value,
                mapped: goalCategory,
              });
            } else {
              // Default to overall_optimization if no mapping found
              logger.warn('[Diet Plans] Invalid goal_category, using default', {
                userId,
                original: value,
                default: 'overall_optimization',
              });
              goalCategory = 'overall_optimization';
            }
          }
          
          
          values.push(goalCategory);
        }
        // JSON fields need stringify
        else if (['dietary_preferences', 'allergies', 'excluded_foods', 'meal_times', 'weekly_meals', 'suggested_recipes'].includes(dbField)) {
          values.push(JSON.stringify(value));
        } else {
          values.push(value as string | number | boolean | null | Date | object);
        }
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      throw ApiError.badRequest('No valid fields to update');
    }

    // If setting as active, deactivate other plans (set them to 'draft')
    if (updates.status === 'active') {
      await dbQuery(
        `UPDATE diet_plans SET status = 'draft' WHERE user_id = $1 AND id != $2 AND status = 'active'`,
        [userId, id]
      );
    }

    setClauses.push(`updated_at = NOW()`);

    const result = await dbQuery<DietPlanRow>(
      `UPDATE diet_plans SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING *`,
      [...values, id, userId]
    );

    logger.info('[Diet Plans] Updated diet plan', { userId, planId: id });

    // Enqueue embedding update (async, non-blocking)
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'diet_plan',
      sourceId: id,
      operation: 'update',
      priority: JobPriorities.CRITICAL,
    });

    res.json({
      success: true,
      data: { plan: transformDietPlan(result.rows[0]) },
    });
  })
);

/**
 * PATCH /api/diet-plans/:id/activate
 * Set a diet plan as active
 */
router.patch(
  '/:id/activate',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { createReminders = true } = req.body; // Option to create meal reminders

    // Verify ownership
    const existing = await dbQuery<DietPlanRow>(
      `SELECT * FROM diet_plans WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (existing.rows.length === 0) {
      throw ApiError.notFound('Diet plan not found');
    }

    // Deactivate all other plans (set them to 'draft')
    await dbQuery(
      `UPDATE diet_plans SET status = 'draft', updated_at = NOW() WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );

    // Activate this plan
    const result = await dbQuery<DietPlanRow>(
      `UPDATE diet_plans SET status = 'active', updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, userId]
    );

    const plan = transformDietPlan(result.rows[0]);

    // Create meal reminders from plan's meal times if requested
    let remindersCreated = 0;
    if (createReminders && plan.mealTimes && Object.keys(plan.mealTimes).length > 0) {
      try {
        const reminders = await reminderSchedulerService.createRemindersFromDietPlan(userId, id);
        remindersCreated = reminders.length;
        logger.info('[Diet Plans] Created meal reminders from diet plan', { userId, planId: id, count: remindersCreated });
      } catch (error) {
        // Log but don't fail the activation
        logger.warn('[Diet Plans] Failed to create reminders from diet plan', {
          userId,
          planId: id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info('[Diet Plans] Activated diet plan', { userId, planId: id });

    res.json({
      success: true,
      data: { plan, remindersCreated },
    });
  })
);

/**
 * DELETE /api/diet-plans/:id
 * Delete a diet plan
 */
router.delete(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;

    // Enqueue embedding deletion BEFORE actual delete (to preserve ID)
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'diet_plan',
      sourceId: id,
      operation: 'delete',
      priority: JobPriorities.MEDIUM,
    });

    const result = await dbQuery(
      `DELETE FROM diet_plans WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId]
    );

    if (result.rowCount === 0) {
      throw ApiError.notFound('Diet plan not found');
    }

    logger.info('[Diet Plans] Deleted diet plan', { userId, planId: id });

    res.json({
      success: true,
      message: 'Diet plan deleted successfully',
    });
  })
);

/**
 * DELETE /api/diet-plans
 * Delete multiple diet plans
 */
router.delete(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      throw ApiError.badRequest('ids array is required');
    }

    // Enqueue embedding deletions for all plans BEFORE actual delete
    await Promise.all(
      ids.map((id: string) =>
        embeddingQueueService.enqueueEmbedding({
          userId,
          sourceType: 'diet_plan',
          sourceId: id,
          operation: 'delete',
          priority: JobPriorities.MEDIUM,
        })
      )
    );

    const result = await dbQuery(
      `DELETE FROM diet_plans WHERE id = ANY($1) AND user_id = $2 RETURNING id`,
      [ids, userId]
    );

    logger.info('[Diet Plans] Deleted multiple diet plans', { userId, count: result.rowCount });

    res.json({
      success: true,
      message: `${result.rowCount} diet plan(s) deleted successfully`,
      deletedCount: result.rowCount,
    });
  })
);

// ============================================
// MEAL LOGS CRUD
// ============================================

/**
 * GET /api/diet-plans/meals
 * Get meal logs for a date range
 */
router.get(
  '/meals',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { date, startDate, endDate } = req.query;

    // Get user timezone for accurate date filtering
    const userTz = req.query.tz as string || 'UTC';
    // Sanitize timezone string to prevent SQL injection (allow only valid tz format)
    const safeTz = /^[A-Za-z_/+-]+$/.test(userTz) ? userTz : 'UTC';

    let sqlQuery = `SELECT * FROM meal_logs WHERE user_id = $1`;
    const params: (string | number | boolean | null | Date | object)[] = [userId];

    if (date) {
      // Use timezone-aware date comparison: convert eaten_at to user's timezone before extracting DATE
      sqlQuery += ` AND DATE(eaten_at AT TIME ZONE 'UTC' AT TIME ZONE '${safeTz}') = $2`;
      params.push(date);
    } else if (startDate && endDate) {
      sqlQuery += ` AND DATE(eaten_at AT TIME ZONE 'UTC' AT TIME ZONE '${safeTz}') >= $2 AND DATE(eaten_at AT TIME ZONE 'UTC' AT TIME ZONE '${safeTz}') <= $3`;
      params.push(startDate, endDate);
    } else {
      // Default to today in user's timezone
      sqlQuery += ` AND DATE(eaten_at AT TIME ZONE 'UTC' AT TIME ZONE '${safeTz}') = CURRENT_DATE`;
    }

    sqlQuery += ` ORDER BY eaten_at ASC`;

    const result = await dbQuery<MealLogRow>(sqlQuery, params);

    // Calculate totals
    const totals = result.rows.reduce(
      (acc: { calories: number; protein: number; carbs: number; fat: number }, row: MealLogRow) => ({
        calories: acc.calories + (row.calories || 0),
        protein: acc.protein + (row.protein_grams || 0),
        carbs: acc.carbs + (row.carbs_grams || 0),
        fat: acc.fat + (row.fat_grams || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    res.json({
      success: true,
      data: {
        meals: result.rows.map(transformMealLog),
        total: result.rows.length,
        totals,
      },
    });
  })
);

/**
 * POST /api/diet-plans/meals
 * Log a meal
 */
router.post(
  '/meals',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const {
      dietPlanId,
      mealType,
      mealName,
      description,
      calories,
      proteinGrams,
      carbsGrams,
      fatGrams,
      fiberGrams,
      foods = [],
      photoUrl,
      eatenAt,
      hungerBefore,
      satisfactionAfter,
      notes,
    } = req.body;

    if (!mealType) {
      throw ApiError.badRequest('Meal type is required');
    }

    // Deduplication: check for same meal name within ±5 minutes of eaten_at
    const targetTime = eatenAt ? new Date(eatenAt) : new Date();
    if (mealName) {
      const existing = await dbQuery<{ id: string }>(
        `SELECT id FROM meal_logs
         WHERE user_id = $1
           AND LOWER(TRIM(meal_name)) = LOWER(TRIM($2))
           AND eaten_at BETWEEN ($3::timestamp - INTERVAL '5 minutes') AND ($3::timestamp + INTERVAL '5 minutes')
         LIMIT 1`,
        [userId, mealName, targetTime]
      );
      if (existing.rows.length > 0) {
        logger.info('[Diet Plans] Duplicate meal blocked', { userId, mealName, eatenAt: targetTime.toISOString() });
        // Return the existing meal instead of creating a duplicate
        const existingMeal = await dbQuery<MealLogRow>(
          `SELECT * FROM meal_logs WHERE id = $1`, [existing.rows[0].id]
        );
        res.status(200).json({
          success: true,
          data: { meal: transformMealLog(existingMeal.rows[0]) },
          duplicate: true,
        });
        return;
      }
    }

    const result = await dbQuery<MealLogRow>(
      `INSERT INTO meal_logs (
        user_id, diet_plan_id, meal_type, meal_name, description,
        calories, protein_grams, carbs_grams, fat_grams, fiber_grams,
        foods, photo_url, eaten_at, hunger_before, satisfaction_after, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        userId,
        dietPlanId || null,
        mealType,
        mealName || null,
        description || null,
        calories ?? null,
        proteinGrams ?? null,
        carbsGrams ?? null,
        fatGrams ?? null,
        fiberGrams ?? null,
        JSON.stringify(foods),
        photoUrl || null,
        // Parse eatenAt - expect ISO string with timezone (from toISOString())
        // Convert to Date object - PostgreSQL TIMESTAMP will store the UTC time correctly
        // When read back, it will be converted to local timezone for display
        eatenAt ? new Date(eatenAt) : new Date(),
        hungerBefore || null,
        satisfactionAfter || null,
        notes || null,
      ]
    );

    const meal = result.rows[0];
    logger.info('[Diet Plans] Logged meal', { userId, mealId: meal.id, mealType });

    // Invalidate dashboard health metrics cache so calories/nutrition update immediately
    cache.deleteByPattern(`^enhanced-health-metrics:${userId}:`);

    // Enqueue embedding for meal log (async, non-blocking)
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'meal_log',
      sourceId: meal.id,
      operation: 'create',
      priority: JobPriorities.MEDIUM,
    });

    // Fire-and-forget: evaluate meal alignment against user goals
    proactiveMessagingService.checkAndSendMealAlignmentFeedback(userId, {
      mealType, mealName, calories, proteinGrams, carbsGrams, fatGrams, fiberGrams, foods,
    }).catch(err => logger.warn('[Diet Plans] Meal alignment check failed', { userId, error: (err as Error).message }));

    // Record for unified streak system
    import('../services/streak.service.js').then(({ streakService }) =>
      streakService.recordActivity(userId, 'meal_log', meal.id)
    ).catch(() => {});

    res.status(201).json({
      success: true,
      data: { meal: transformMealLog(meal) },
    });
  })
);

/**
 * PATCH /api/diet-plans/meals/:id
 * Update a meal log
 */
router.patch(
  '/meals/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;
    const updates = req.body;

    // Verify ownership
    const existing = await dbQuery<MealLogRow>(
      `SELECT * FROM meal_logs WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (existing.rows.length === 0) {
      throw ApiError.notFound('Meal log not found');
    }

    const fieldMapping: Record<string, string> = {
      mealType: 'meal_type',
      mealName: 'meal_name',
      description: 'description',
      calories: 'calories',
      proteinGrams: 'protein_grams',
      carbsGrams: 'carbs_grams',
      fatGrams: 'fat_grams',
      fiberGrams: 'fiber_grams',
      foods: 'foods',
      photoUrl: 'photo_url',
      eatenAt: 'eaten_at',
      hungerBefore: 'hunger_before',
      satisfactionAfter: 'satisfaction_after',
      notes: 'notes',
    };

    const setClauses: string[] = [];
    const values: (string | number | boolean | null | Date | object)[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      const dbField = fieldMapping[key];
      if (dbField) {
        setClauses.push(`${dbField} = $${paramIndex}`);
        if (dbField === 'foods') {
          values.push(JSON.stringify(value));
        } else if (dbField === 'eaten_at') {
          // Parse the timestamp string and convert to Date object
          // Expect ISO string with timezone (from toISOString())
          // PostgreSQL TIMESTAMP will store this correctly
          const dateValue = value ? new Date(value as string) : new Date();
          values.push(dateValue);
        } else {
          values.push(value as string | number | boolean | null | Date | object);
        }
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      throw ApiError.badRequest('No valid fields to update');
    }

    setClauses.push(`updated_at = NOW()`);

    const result = await dbQuery<MealLogRow>(
      `UPDATE meal_logs SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING *`,
      [...values, id, userId]
    );

    logger.info('[Diet Plans] Updated meal log', { userId, mealId: id });

    cache.deleteByPattern(`^enhanced-health-metrics:${userId}:`);

    res.json({
      success: true,
      data: { meal: transformMealLog(result.rows[0]) },
    });
  })
);

/**
 * DELETE /api/diet-plans/meals/:id
 * Delete a meal log
 */
router.delete(
  '/meals/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;

    // Enqueue embedding deletion BEFORE actual delete (to preserve ID)
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'meal_log',
      sourceId: id,
      operation: 'delete',
      priority: JobPriorities.MEDIUM,
    });

    const result = await dbQuery(
      `DELETE FROM meal_logs WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId]
    );

    if (result.rowCount === 0) {
      throw ApiError.notFound('Meal log not found');
    }

    logger.info('[Diet Plans] Deleted meal log', { userId, mealId: id });

    cache.deleteByPattern(`^enhanced-health-metrics:${userId}:`);

    res.json({
      success: true,
      message: 'Meal deleted successfully',
    });
  })
);

// ============================================
// RECIPES CRUD
// ============================================

interface Recipe {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  category: string;
  cuisine: string | null;
  servings: number;
  caloriesPerServing: number | null;
  proteinGrams: number | null;
  carbsGrams: number | null;
  fatGrams: number | null;
  fiberGrams: number | null;
  ingredients: { name: string; quantity: string; unit: string; notes?: string }[];
  instructions: { step: number; description: string }[];
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  totalTimeMinutes: number | null;
  tags: string[];
  dietaryFlags: string[];
  imageUrl: string | null;
  difficulty: string;
  rating: number | null;
  timesMade: number;
  isFavorite: boolean;
  source: string;
  sourceUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RecipeRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  category: string;
  cuisine: string | null;
  servings: number;
  calories_per_serving: number | null;
  protein_grams: number | null;
  carbs_grams: number | null;
  fat_grams: number | null;
  fiber_grams: number | null;
  ingredients: { name: string; quantity: string; unit: string; notes?: string }[] | null;
  instructions: { step: number; description: string }[] | null;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  total_time_minutes: number | null;
  tags: string[] | null;
  dietary_flags: string[] | null;
  image_url: string | null;
  difficulty: string;
  rating: number | null;
  times_made: number;
  is_favorite: boolean;
  source: string;
  source_url: string | null;
  created_at: Date;
  updated_at: Date;
}

function transformRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    category: row.category,
    cuisine: row.cuisine,
    servings: row.servings,
    caloriesPerServing: row.calories_per_serving,
    proteinGrams: row.protein_grams,
    carbsGrams: row.carbs_grams,
    fatGrams: row.fat_grams,
    fiberGrams: row.fiber_grams,
    ingredients: row.ingredients || [],
    instructions: row.instructions || [],
    prepTimeMinutes: row.prep_time_minutes,
    cookTimeMinutes: row.cook_time_minutes,
    totalTimeMinutes: row.total_time_minutes,
    tags: row.tags || [],
    dietaryFlags: row.dietary_flags || [],
    imageUrl: row.image_url,
    difficulty: row.difficulty,
    rating: row.rating,
    timesMade: row.times_made,
    isFavorite: row.is_favorite,
    source: row.source,
    sourceUrl: row.source_url,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/**
 * GET /api/diet-plans/recipes
 * Get all recipes for user
 */
router.get(
  '/recipes',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { category, favorite } = req.query;

    let sqlQuery = `SELECT * FROM user_recipes WHERE user_id = $1`;
    const params: (string | number | boolean | null | Date | object)[] = [userId];
    let paramIndex = 2;

    if (category) {
      sqlQuery += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (favorite === 'true') {
      sqlQuery += ` AND is_favorite = true`;
    }

    sqlQuery += ` ORDER BY created_at DESC`;

    const result = await dbQuery<RecipeRow>(sqlQuery, params);

    res.json({
      success: true,
      data: {
        recipes: result.rows.map(transformRecipe),
        total: result.rows.length,
      },
    });
  })
);

/**
 * GET /api/diet-plans/recipes/:id
 * Get a specific recipe
 */
router.get(
  '/recipes/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;

    const result = await dbQuery<RecipeRow>(
      `SELECT * FROM user_recipes WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Recipe not found');
    }

    res.json({
      success: true,
      data: { recipe: transformRecipe(result.rows[0]) },
    });
  })
);

/**
 * POST /api/diet-plans/recipes
 * Create a new recipe
 */
router.post(
  '/recipes',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const {
      name,
      description,
      category = 'other',
      cuisine,
      servings = 1,
      caloriesPerServing,
      proteinGrams,
      carbsGrams,
      fatGrams,
      fiberGrams,
      ingredients = [],
      instructions = [],
      prepTimeMinutes,
      cookTimeMinutes,
      totalTimeMinutes,
      tags = [],
      dietaryFlags = [],
      imageUrl,
      difficulty = 'medium',
      source = 'user',
      sourceUrl,
    } = req.body;

    if (!name?.trim()) {
      throw ApiError.badRequest('Recipe name is required');
    }

    const result = await dbQuery<RecipeRow>(
      `INSERT INTO user_recipes (
        user_id, name, description, category, cuisine,
        servings, calories_per_serving, protein_grams, carbs_grams, fat_grams, fiber_grams,
        ingredients, instructions, prep_time_minutes, cook_time_minutes, total_time_minutes,
        tags, dietary_flags, image_url, difficulty, source, source_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING *`,
      [
        userId,
        name.trim(),
        description || null,
        category,
        cuisine || null,
        servings,
        caloriesPerServing ?? null,
        proteinGrams ?? null,
        carbsGrams ?? null,
        fatGrams ?? null,
        fiberGrams ?? null,
        JSON.stringify(ingredients),
        JSON.stringify(instructions),
        prepTimeMinutes || null,
        cookTimeMinutes || null,
        totalTimeMinutes || null,
        JSON.stringify(tags),
        JSON.stringify(dietaryFlags),
        imageUrl || null,
        difficulty,
        source,
        sourceUrl || null,
      ]
    );

    logger.info('[Recipes] Created recipe', { userId, recipeId: result.rows[0].id });

    res.status(201).json({
      success: true,
      data: { recipe: transformRecipe(result.rows[0]) },
    });
  })
);

/**
 * PATCH /api/diet-plans/recipes/:id
 * Update a recipe
 */
router.patch(
  '/recipes/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;
    const updates = req.body;

    // Verify ownership
    const existing = await dbQuery<RecipeRow>(
      `SELECT * FROM user_recipes WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (existing.rows.length === 0) {
      throw ApiError.notFound('Recipe not found');
    }

    const fieldMapping: Record<string, string> = {
      name: 'name',
      description: 'description',
      category: 'category',
      cuisine: 'cuisine',
      servings: 'servings',
      caloriesPerServing: 'calories_per_serving',
      proteinGrams: 'protein_grams',
      carbsGrams: 'carbs_grams',
      fatGrams: 'fat_grams',
      fiberGrams: 'fiber_grams',
      ingredients: 'ingredients',
      instructions: 'instructions',
      prepTimeMinutes: 'prep_time_minutes',
      cookTimeMinutes: 'cook_time_minutes',
      totalTimeMinutes: 'total_time_minutes',
      tags: 'tags',
      dietaryFlags: 'dietary_flags',
      imageUrl: 'image_url',
      difficulty: 'difficulty',
      rating: 'rating',
      timesMade: 'times_made',
      isFavorite: 'is_favorite',
    };

    const jsonFields = ['ingredients', 'instructions', 'tags', 'dietary_flags'];

    const setClauses: string[] = [];
    const values: (string | number | boolean | null | Date | object)[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      const dbField = fieldMapping[key];
      if (dbField) {
        setClauses.push(`${dbField} = $${paramIndex}`);
        if (jsonFields.includes(dbField)) {
          values.push(JSON.stringify(value));
        } else {
          values.push(value as string | number | boolean | null | Date | object);
        }
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      throw ApiError.badRequest('No valid fields to update');
    }

    setClauses.push(`updated_at = NOW()`);

    const result = await dbQuery<RecipeRow>(
      `UPDATE user_recipes SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING *`,
      [...values, id, userId]
    );

    logger.info('[Recipes] Updated recipe', { userId, recipeId: id });

    res.json({
      success: true,
      data: { recipe: transformRecipe(result.rows[0]) },
    });
  })
);

/**
 * DELETE /api/diet-plans/recipes/:id
 * Delete a recipe
 */
router.delete(
  '/recipes/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;

    const result = await dbQuery(
      `DELETE FROM user_recipes WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId]
    );

    if (result.rowCount === 0) {
      throw ApiError.notFound('Recipe not found');
    }

    logger.info('[Recipes] Deleted recipe', { userId, recipeId: id });

    res.json({
      success: true,
      message: 'Recipe deleted successfully',
    });
  })
);

/**
 * DELETE /api/diet-plans/recipes
 * Delete multiple recipes
 */
router.delete(
  '/recipes',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      throw ApiError.badRequest('ids array is required');
    }

    const result = await dbQuery(
      `DELETE FROM user_recipes WHERE id = ANY($1) AND user_id = $2 RETURNING id`,
      [ids, userId]
    );

    logger.info('[Recipes] Deleted multiple recipes', { userId, count: result.rowCount });

    res.json({
      success: true,
      message: `${result.rowCount} recipe(s) deleted successfully`,
      deletedCount: result.rowCount,
    });
  })
);

/**
 * PATCH /api/diet-plans/recipes/:id/favorite
 * Toggle favorite status
 */
router.patch(
  '/recipes/:id/favorite',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;

    const result = await dbQuery<RecipeRow>(
      `UPDATE user_recipes SET is_favorite = NOT is_favorite, updated_at = NOW()
       WHERE id = $1 AND user_id = $2 RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Recipe not found');
    }

    logger.info('[Recipes] Toggled favorite', { userId, recipeId: id, isFavorite: result.rows[0].is_favorite });

    res.json({
      success: true,
      data: { recipe: transformRecipe(result.rows[0]) },
    });
  })
);

// ============================================
// PARAMETERIZED ROUTES (must come last)
// ============================================

/**
 * GET /api/diet-plans/:id
 * Get a specific diet plan
 * NOTE: This route MUST come after all /meals, /recipes, /generate routes
 * to avoid matching "meals" or "recipes" as :id
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;

    const result = await dbQuery<DietPlanRow>(
      `SELECT * FROM diet_plans WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Diet plan not found');
    }

    res.json({
      success: true,
      data: { plan: transformDietPlan(result.rows[0]) },
    });
  })
);

export default router;
