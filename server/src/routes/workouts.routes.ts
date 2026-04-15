/**
 * @file Workout Routes
 * API endpoints for workout plans and logging
 */

import { Router, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import authenticate from '../middlewares/auth.middleware.js';
import { workoutPlanService, type DayWorkout } from '../services/workout-plan.service.js';
import { aiProviderService } from '../services/ai-provider.service.js';
import { logger } from '../services/logger.service.js';
import { query as dbQuery } from '../database/pg.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { embeddingQueueService } from '../services/embedding-queue.service.js';
import { JobPriorities } from '../config/queue.config.js';

const router = Router();

/** Format a Date as YYYY-MM-DD in local timezone (avoids UTC shift from toISOString) */
function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Inject computed scheduledDate into each DayWorkout based on plan startDate.
 * Finds the Monday of the start date's week and assigns YYYY-MM-DD to each day.
 */
function injectDatesIntoSchedule(
  schedule: Record<string, DayWorkout | null>,
  startDateStr: string
): Record<string, DayWorkout | null> {
  const startDate = new Date(startDateStr + 'T00:00:00');
  const dayOfWeek = startDate.getDay(); // 0=Sun, 1=Mon...
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(startDate);
  monday.setDate(startDate.getDate() + mondayOffset);

  const dayOffsets: Record<string, number> = {
    monday: 0, tuesday: 1, wednesday: 2, thursday: 3,
    friday: 4, saturday: 5, sunday: 6,
  };

  for (const [day, workout] of Object.entries(schedule)) {
    if (workout && dayOffsets[day] !== undefined) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + dayOffsets[day]);
      workout.scheduledDate = formatLocalDate(date);
    }
  }
  return schedule;
}

// All routes require authentication
router.use(authenticate);

// ============================================
// EXERCISE LIBRARY
// ============================================

/**
 * GET /api/workouts/exercises
 * Get exercise library with optional filters
 */
router.get(
  '/exercises',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { category, difficulty, muscleGroup, equipment } = req.query;

    const exercises = await workoutPlanService.getExercises({
      category: category as string,
      difficulty: difficulty as string,
      muscleGroup: muscleGroup as string,
      equipment: equipment ? [equipment as string] : undefined,
    });

    res.json({
      success: true,
      data: { exercises },
    });
  })
);

/**
 * GET /api/workouts/exercises/:id
 * Get exercise details
 */
router.get(
  '/exercises/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const exercises = await workoutPlanService.getExercises();
    const exercise = exercises.find((e) => e.id === id);

    if (!exercise) {
      res.status(404).json({
        success: false,
        error: 'Exercise not found',
      });
      return;
    }

    res.json({
      success: true,
      data: { exercise },
    });
  })
);

// ============================================
// WORKOUT PLANS
// ============================================

/**
 * GET /api/workouts/plans
 * Get user's workout plans
 */
router.get(
  '/plans',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;

    const plans = await workoutPlanService.getUserPlans(userId);

    res.json({
      success: true,
      data: { plans },
    });
  })
);

/**
 * GET /api/workouts/plans/:id
 * Get specific workout plan
 */
router.get(
  '/plans/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;

    const plans = await workoutPlanService.getUserPlans(userId);
    const plan = plans.find((p) => p.id === id);

    if (!plan) {
      res.status(404).json({
        success: false,
        error: 'Workout plan not found',
      });
      return;
    }

    res.json({
      success: true,
      data: { plan },
    });
  })
);

/**
 * POST /api/workouts/plans/generate
 * Generate AI workout plan
 */
router.post(
  '/plans/generate',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const {
      planId,
      goalCategory,
      durationWeeks,
      workoutsPerWeek,
      timePerWorkout,
      fitnessLevel,
      availableEquipment,
      workoutLocation,
      focusAreas,
    } = req.body;

    const plan = await workoutPlanService.generatePlan({
      userId,
      planId,
      goalCategory: goalCategory || 'overall_optimization',
      durationWeeks: durationWeeks || 4,
      workoutsPerWeek: workoutsPerWeek || 3,
      timePerWorkout: timePerWorkout || 45,
      fitnessLevel: fitnessLevel || 'beginner',
      availableEquipment: availableEquipment || ['bodyweight'],
      workoutLocation: workoutLocation || 'home',
      focusAreas: focusAreas || ['full_body'],
    });

    res.status(201).json({
      success: true,
      data: { plan },
    });
  })
);

/**
 * POST /api/workouts/plans
 * Create a new workout plan manually (with optional AI exercise suggestions)
 */
router.post(
  '/plans',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const {
      name,
      description,
      goalCategory = 'overall_optimization',
      fitnessLevel = 'beginner',
      durationWeeks = 4,
      workoutsPerWeek = 3,
      scheduledTime,
      availableEquipment = ['bodyweight'],
      workoutLocation = 'home',
      muscleGroups = [],
      exercises = [],
      weeklySchedule = {},
      isActive = false,
      startDate: clientStartDate,
    } = req.body;

    if (!name?.trim()) {
      res.status(400).json({
        success: false,
        error: 'Workout plan name is required',
      });
      return;
    }

    // Use client-provided start date or default to today
    const startDate = clientStartDate ? new Date(clientStartDate + 'T00:00:00') : new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + durationWeeks * 7);

    // If setting as active, deactivate other plans
    if (isActive) {
      await dbQuery(
        `UPDATE workout_plans SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND status = 'active'`,
        [userId]
      );
    }

    // Create the workout plan
    // Ensure weeklySchedule is properly formatted as JSONB
    // Inject computed dates into each day based on start date
    let weeklyScheduleJson = weeklySchedule && Object.keys(weeklySchedule).length > 0
      ? weeklySchedule
      : {};

    if (Object.keys(weeklyScheduleJson).length > 0) {
      const startDateStr = formatLocalDate(startDate);
      weeklyScheduleJson = injectDatesIntoSchedule(
        weeklyScheduleJson as Record<string, DayWorkout | null>,
        startDateStr
      );
    }

    const result = await dbQuery(
      `INSERT INTO workout_plans (
        user_id, name, description, goal_category,
        initial_difficulty_level, duration_weeks, workouts_per_week,
        weekly_schedule, available_equipment, workout_location,
        start_date, end_date, status, ai_generated
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::text[], $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        userId,
        name.trim(),
        description || null,
        goalCategory,
        fitnessLevel,
        durationWeeks,
        workoutsPerWeek,
        JSON.stringify(weeklyScheduleJson),
        availableEquipment,
        workoutLocation,
        formatLocalDate(startDate),
        formatLocalDate(endDate),
        isActive ? 'active' : 'draft',
        false,
      ]
    );

    logger.info('[Workouts] Created workout plan', { userId, planId: result.rows[0].id });

    // Enqueue embedding creation (async, non-blocking)
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'workout_plan',
      sourceId: result.rows[0].id,
      operation: 'create',
      priority: JobPriorities.CRITICAL,
    });

    // Parse the weekly_schedule from database (it's stored as JSONB)
    const storedWeeklySchedule = result.rows[0].weekly_schedule 
      ? (typeof result.rows[0].weekly_schedule === 'string' 
          ? JSON.parse(result.rows[0].weekly_schedule) 
          : result.rows[0].weekly_schedule)
      : weeklyScheduleJson;

    // Transform response to match client expectations
    const plan = {
      id: result.rows[0].id,
      name: result.rows[0].name,
      description: result.rows[0].description,
      muscleGroups: muscleGroups,
      exercises: exercises,
      duration: workoutsPerWeek * 45, // Estimated duration
      scheduledTime: scheduledTime || null, // Note: column doesn't exist yet
      difficulty: result.rows[0].initial_difficulty_level,
      isCustom: true,
      status: result.rows[0].status,
      weeklySchedule: storedWeeklySchedule, // Include the weekly schedule in response
      durationWeeks: result.rows[0].duration_weeks,
      workoutsPerWeek: result.rows[0].workouts_per_week,
      startDate: result.rows[0].start_date,
      endDate: result.rows[0].end_date,
    };

    res.status(201).json({
      success: true,
      data: { plan },
    });
  })
);

/**
 * PATCH /api/workouts/plans/:id
 * Update an existing workout plan
 */
router.patch(
  '/plans/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;
    const updates = req.body;

    // Verify ownership
    const existing = await dbQuery(
      `SELECT * FROM workout_plans WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Workout plan not found',
      });
      return;
    }

    // Build update query dynamically
    const fieldMapping: Record<string, string> = {
      name: 'name',
      description: 'description',
      goalCategory: 'goal_category',
      fitnessLevel: 'initial_difficulty_level',
      durationWeeks: 'duration_weeks',
      workoutsPerWeek: 'workouts_per_week',
      weeklySchedule: 'weekly_schedule',
      availableEquipment: 'available_equipment',
      workoutLocation: 'workout_location',
      status: 'status',
      // Note: scheduledTime column doesn't exist yet - migration needed
      // scheduledTime: 'scheduled_time',
    };

    const setClauses: string[] = [];
    const values: (string | number | boolean | null | object)[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(updates)) {
      const dbField = fieldMapping[key];
      if (dbField) {
        setClauses.push(`${dbField} = $${paramIndex}`);
        if (dbField === 'weekly_schedule') {
          values.push(JSON.stringify(value));
        } else if (dbField === 'available_equipment') {
          values.push(value as string[]);
        } else {
          values.push(value as string | number | boolean | null);
        }
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      res.status(400).json({
        success: false,
        error: 'No valid fields to update',
      });
      return;
    }

    // If setting as active, deactivate other plans
    if (updates.status === 'active') {
      await dbQuery(
        `UPDATE workout_plans SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND id != $2 AND status = 'active'`,
        [userId, id]
      );
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);

    const result = await dbQuery(
      `UPDATE workout_plans SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING *`,
      [...values, id, userId]
    );

    logger.info('[Workouts] Updated workout plan', { userId, planId: id });

    // Enqueue embedding update (async, non-blocking)
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'workout_plan',
      sourceId: id,
      operation: 'update',
      priority: JobPriorities.CRITICAL,
    });

    res.json({
      success: true,
      data: { plan: result.rows[0] },
    });
  })
);

/**
 * DELETE /api/workouts/plans/:id
 * Delete a workout plan
 */
router.delete(
  '/plans/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;

    // Enqueue embedding deletion BEFORE actual delete (to preserve ID)
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'workout_plan',
      sourceId: id,
      operation: 'delete',
      priority: JobPriorities.MEDIUM,
    });

    const result = await dbQuery(
      `DELETE FROM workout_plans WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({
        success: false,
        error: 'Workout plan not found',
      });
      return;
    }

    logger.info('[Workouts] Deleted workout plan', { userId, planId: id });

    res.json({
      success: true,
      message: 'Workout plan deleted successfully',
    });
  })
);

/**
 * POST /api/workouts/plans/:id/activate
 * Activate a workout plan (deactivates others)
 */
router.post(
  '/plans/:id/activate',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;

    // Verify ownership
    const existing = await dbQuery(
      `SELECT * FROM workout_plans WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Workout plan not found',
      });
      return;
    }

    // Deactivate all other plans
    await dbQuery(
      `UPDATE workout_plans SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );

    // Activate this plan
    const result = await dbQuery(
      `UPDATE workout_plans SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [id]
    );

    logger.info('[Workouts] Activated workout plan', { userId, planId: id });

    res.json({
      success: true,
      data: { plan: result.rows[0] },
    });
  })
);

// ============================================
// AI EXERCISE SUGGESTIONS
// ============================================

/**
 * POST /api/workouts/exercises/suggest
 * Get AI-suggested exercises based on criteria
 */
router.post(
  '/exercises/suggest',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const {
      muscleGroups = [],
      difficulty = 'beginner',
      equipment = [],
      duration = 45,
      goalCategory = 'overall_optimization',
    } = req.body;

    if (!aiProviderService.isAvailable()) {
      // Fall back to exercise library if AI not available
      const exercises = await workoutPlanService.getExercises({
        difficulty,
        equipment: equipment.length > 0 ? equipment : undefined,
      });

      // Filter by muscle groups and limit
      const filtered = exercises
        .filter(ex => muscleGroups.length === 0 || muscleGroups.includes(ex.primaryMuscleGroup))
        .slice(0, 10);

      res.json({
        success: true,
        data: {
          exercises: filtered.map(ex => ({
            name: ex.name,
            sets: ex.defaultSets,
            reps: ex.defaultReps,
            restSeconds: ex.defaultRestSeconds,
            muscleGroup: ex.primaryMuscleGroup,
            instructions: ex.instructions,
          })),
          provider: 'library',
        },
      });
      return;
    }

    const systemPrompt = `You are a certified personal trainer. Suggest exercises as valid JSON only — no markdown, no code blocks.

STRICT FORMAT — every exercise must match this exactly:
{"exercises":[{"name":"Barbell Squat","sets":4,"reps":"8-10","restSeconds":90,"muscleGroup":"Legs","instructions":["Feet shoulder-width, bar on upper back","Squat to parallel, drive through heels"],"tips":"Keep chest up"}],"workoutTips":["Warm up 5 min before starting"]}

RULES:
- Suggest 6-8 exercises for: ${muscleGroups.length > 0 ? muscleGroups.join(', ') : 'Full body'}, ${difficulty}, ${duration} min
- Equipment: ${equipment.length > 0 ? equipment.join(', ') : 'Bodyweight only'}
- Goal: ${goalCategory.replace('_', ' ')}
- instructions: MAX 2-3 SHORT steps (under 15 words each). NO long sentences.
- tips: ONE short sentence (under 15 words)
- muscleGroup: ONE primary muscle only (e.g. "Chest" not "Chest, Shoulders, Triceps")
- Keep total response COMPACT — under 2000 tokens`;

    try {
      const response = await aiProviderService.generateCompletion({
        systemPrompt,
        userPrompt: `Create a ${difficulty} workout targeting ${muscleGroups.length > 0 ? muscleGroups.join(', ') : 'full body'} for about ${duration} minutes.`,
        maxTokens: 3000,
        temperature: 0.7,
      });

      let exerciseData: {
        exercises?: Array<{
          name: string;
          sets: number;
          reps: string;
          restSeconds: number;
          muscleGroup: string;
          instructions?: string[];
          tips?: string;
        }>;
        workoutTips?: string[];
      } = {};

      try {
        let jsonStr = response.content.trim();
        // Strip markdown code blocks if present
        const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
          jsonStr = codeBlockMatch[1].trim();
        }
        // Extract JSON object if surrounded by extra text
        const objMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (objMatch) {
          jsonStr = objMatch[0];
        }
        exerciseData = JSON.parse(jsonStr);
      } catch {
        // Attempt to salvage truncated JSON
        try {
          let salvaged = response.content.trim();
          const objMatch = salvaged.match(/\{[\s\S]*/);
          if (objMatch) {
            salvaged = objMatch[0];
            // Remove trailing incomplete value
            salvaged = salvaged.replace(/,\s*\{[^}]*$/, '');  // Remove last incomplete exercise object
            salvaged = salvaged.replace(/,\s*"[^"]*"?\s*:?\s*"?[^"{}[\]]*$/, '');
            // Close open arrays and objects
            const openBraces = (salvaged.match(/\{/g) || []).length - (salvaged.match(/\}/g) || []).length;
            const openBrackets = (salvaged.match(/\[/g) || []).length - (salvaged.match(/\]/g) || []).length;
            salvaged += ']'.repeat(Math.max(0, openBrackets)) + '}'.repeat(Math.max(0, openBraces));
            exerciseData = JSON.parse(salvaged);
            logger.info('[Workouts] Salvaged truncated AI exercise response', { userId, exerciseCount: exerciseData.exercises?.length });
          } else {
            throw new Error('No JSON found');
          }
        } catch {
          logger.warn('[Workouts] Failed to parse AI exercise suggestions', { userId, response: response.content });
          res.status(500).json({
            success: false,
            error: 'Failed to parse AI response',
          });
          return;
        }
      }

      logger.info('[Workouts] AI suggested exercises', { userId, count: exerciseData.exercises?.length, provider: response.provider });

      res.json({
        success: true,
        data: {
          exercises: exerciseData.exercises || [],
          workoutTips: exerciseData.workoutTips || [],
          provider: response.provider,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[Workouts] AI exercise suggestion failed', { userId, error: errorMessage });
      res.status(500).json({
        success: false,
        error: `Failed to generate exercise suggestions: ${errorMessage}`,
      });
    }
  })
);

/**
 * POST /api/workouts/plans/generate-ai
 * Generate a complete workout plan using AI
 */
router.post(
  '/plans/generate-ai',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const {
      description,
      goalCategory = 'overall_optimization',
      fitnessLevel = 'beginner',
      durationWeeks = 4,
      workoutsPerWeek = 3,
      equipment = [],
      workoutLocation = 'home',
      timePerWorkout = 45,
      startDate: clientStartDate,
    } = req.body;

    if (!description?.trim()) {
      res.status(400).json({
        success: false,
        error: 'Description is required for AI generation',
      });
      return;
    }

    if (!aiProviderService.isAvailable()) {
      res.status(503).json({
        success: false,
        error: 'AI generation is not available. No AI providers configured.',
      });
      return;
    }

    // Map number of workouts per week to specific days
    const dayMappings: Record<number, string[]> = {
      2: ['monday', 'thursday'],
      3: ['monday', 'wednesday', 'friday'],
      4: ['monday', 'tuesday', 'thursday', 'friday'],
      5: ['monday', 'tuesday', 'wednesday', 'friday', 'saturday'],
      6: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    };
    const workoutDays = dayMappings[workoutsPerWeek] || dayMappings[3];
    const restDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      .filter(d => !workoutDays.includes(d));

    const systemPrompt = `You are an expert personal trainer. Create a personalized workout plan based on the user's description. Always respond with valid JSON.

CRITICAL REQUIREMENTS:
1. You MUST create EXACTLY ${workoutsPerWeek} workout days on these specific days: ${workoutDays.join(', ')}
2. These days MUST be rest days (set to null): ${restDays.join(', ')}
3. Each workout day MUST have 5-8 exercises with proper sets, reps, and rest times
4. Each exercise MUST include: name, sets (number), reps (string like "8-10"), restSeconds (number), muscleGroup (string)

Respond ONLY with a JSON object in this exact format (no markdown, no code blocks):
{
  "name": "Plan name (include goal and duration, e.g. '4-Week Muscle Building Plan')",
  "description": "Brief plan description",
  "muscleGroups": ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core"],
  "weeklySchedule": {
    "monday": {
      "dayOfWeek": "monday",
      "workoutName": "Push Day",
      "focusArea": "Chest, Shoulders, Triceps",
      "exercises": [
        {"name": "Barbell Bench Press", "sets": 4, "reps": "8-10", "restSeconds": 90, "muscleGroup": "Chest"},
        {"name": "Incline Dumbbell Press", "sets": 3, "reps": "10-12", "restSeconds": 60, "muscleGroup": "Chest"},
        {"name": "Overhead Press", "sets": 3, "reps": "8-10", "restSeconds": 90, "muscleGroup": "Shoulders"},
        {"name": "Lateral Raises", "sets": 3, "reps": "12-15", "restSeconds": 45, "muscleGroup": "Shoulders"},
        {"name": "Tricep Pushdowns", "sets": 3, "reps": "12-15", "restSeconds": 45, "muscleGroup": "Arms"},
        {"name": "Overhead Tricep Extension", "sets": 3, "reps": "10-12", "restSeconds": 45, "muscleGroup": "Arms"}
      ],
      "estimatedDuration": ${timePerWorkout},
      "estimatedCalories": ${Math.round(timePerWorkout * 7)}
    },
    "tuesday": null,
    "wednesday": { ... similar structure with different exercises ... },
    "thursday": null,
    "friday": { ... similar structure with different exercises ... },
    "saturday": null,
    "sunday": null
  },
  "tips": ["Tip 1", "Tip 2", "Tip 3"]
}

User requirements:
- Goal: ${goalCategory.replace('_', ' ')}
- Fitness level: ${fitnessLevel}
- Duration: ${durationWeeks} weeks
- Time per workout: ${timePerWorkout} minutes
- Location: ${workoutLocation}
- Equipment: ${equipment.length > 0 ? equipment.join(', ') : 'Bodyweight only'}

Generate a complete, well-structured workout plan with appropriate exercises for the ${fitnessLevel} level.`;

    try {
      const response = await aiProviderService.generateCompletion({
        systemPrompt,
        userPrompt: `Create a workout plan for: "${description}"`,
        maxTokens: 3000,
        temperature: 0.7,
      });

      let planData: {
        name?: string;
        description?: string;
        muscleGroups?: string[];
        weeklySchedule?: Record<string, unknown>;
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
        logger.warn('[Workouts] Failed to parse AI workout plan', { userId, response: response.content });
        res.status(500).json({
          success: false,
          error: 'Failed to parse AI response',
        });
        return;
      }

      // Save the plan to database
      const startDate = clientStartDate ? new Date(clientStartDate + 'T00:00:00') : new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + durationWeeks * 7);

      // Inject computed dates into each day of the schedule
      const startDateStr = formatLocalDate(startDate);
      if (planData.weeklySchedule && Object.keys(planData.weeklySchedule).length > 0) {
        planData.weeklySchedule = injectDatesIntoSchedule(
          planData.weeklySchedule as Record<string, DayWorkout | null>,
          startDateStr
        );
      }

      // Deactivate other plans
      await dbQuery(
        `UPDATE workout_plans SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND status = 'active'`,
        [userId]
      );

      const result = await dbQuery(
        `INSERT INTO workout_plans (
          user_id, name, description, goal_category,
          initial_difficulty_level, duration_weeks, workouts_per_week,
          weekly_schedule, available_equipment, workout_location,
          start_date, end_date, status, ai_generated, ai_model
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text[], $10, $11, $12, 'active', true, $13)
        RETURNING *`,
        [
          userId,
          planData.name || 'AI Generated Plan',
          planData.description || description,
          goalCategory,
          fitnessLevel,
          durationWeeks,
          workoutsPerWeek,
          JSON.stringify(planData.weeklySchedule || {}),
          equipment,
          workoutLocation,
          formatLocalDate(startDate),
          formatLocalDate(endDate),
          response.provider,
        ]
      );

      logger.info('[Workouts] AI generated workout plan', { userId, planId: result.rows[0].id, provider: response.provider });

      res.status(201).json({
        success: true,
        data: {
          plan: {
            ...result.rows[0],
            muscleGroups: planData.muscleGroups || [],
            weeklySchedule: planData.weeklySchedule || {},
          },
          tips: planData.tips || [],
          provider: response.provider,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[Workouts] AI workout plan generation failed', { userId, error: errorMessage });
      res.status(500).json({
        success: false,
        error: `Failed to generate workout plan: ${errorMessage}`,
      });
    }
  })
);

// ============================================
// TODAY'S WORKOUT
// ============================================

/**
 * GET /api/workouts/today
 * Get today's scheduled workout (requires planId query param)
 */
router.get(
  '/today',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { planId } = req.query;

    if (!planId) {
      res.status(400).json({
        success: false,
        error: 'planId query parameter is required',
      });
      return;
    }

    const workout = await workoutPlanService.getTodaysWorkout(planId as string);

    res.json({
      success: true,
      data: { workout },
    });
  })
);

// ============================================
// STATS & SCHEDULE
// ============================================

/**
 * GET /api/workouts/stats/weekly
 * Get weekly workout stats (completed, minutes, calories, streak)
 */
router.get(
  '/stats/weekly',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;

    // Get current week dates - use local timezone
    const today = new Date();
    const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dayOfWeek = todayLocal.getDay();
    const startOfWeek = new Date(todayLocal);
    startOfWeek.setDate(todayLocal.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)); // Monday
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Sunday
    endOfWeek.setHours(23, 59, 59, 999);

    // Format dates as YYYY-MM-DD using local timezone
    const formatLocalDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Get user's workout plans to determine weekly goal
    // Try active plans first, fallback to all plans so stats show even for draft plans
    let plans = await workoutPlanService.getUserPlans(userId, 'active');
    if (plans.length === 0) {
      plans = await workoutPlanService.getUserPlans(userId);
    }
    const activePlanIds = plans.map(p => p.id);

    // Get workout logs for this week
    const { logs } = await workoutPlanService.getWorkoutLogs(userId, {
      startDate: formatLocalDate(startOfWeek),
      endDate: formatLocalDate(endOfWeek),
    });

    // Count unique days with completed workouts for active plans only
    // This prevents counting orphaned logs from deleted plans
    const completedDates = new Set<string>();
    logs.forEach(l => {
      if ((l.status === 'completed' || l.status === 'partial') &&
          (!l.workoutPlanId || activePlanIds.includes(l.workoutPlanId))) {
        completedDates.add(l.scheduledDate);
      }
    });
    const weeklyWorkouts = completedDates.size;
    const totalMinutes = logs.reduce((sum, l) => sum + (l.durationMinutes || 0), 0);

    // Estimate calories: ~6-8 cal per minute of workout
    const caloriesBurned = logs.reduce((sum, l) => {
      const minutes = l.durationMinutes || 0;
      const volume = l.totalVolume || 0;
      // Higher volume = higher intensity = more calories
      const intensity = volume > 5000 ? 8 : volume > 2000 ? 7 : 6;
      return sum + (minutes * intensity);
    }, 0);

    // Use already fetched plans to determine weekly goal
    const weeklyGoal = plans.length > 0 ? plans[0].workoutsPerWeek : 5;

    // Calculate streak (consecutive days with completed workouts)
    let currentStreak = 0;
    const checkDate = new Date(todayLocal);
    checkDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < 30; i++) {
      const dateStr = formatLocalDate(checkDate);
      const dayLogs = logs.filter(l => l.scheduledDate === dateStr && (l.status === 'completed' || l.status === 'partial'));

      if (dayLogs.length > 0) {
        currentStreak++;
      } else if (i > 0) {
        // No workout on this day and it's not today - streak broken
        break;
      }
      // Skip today if no workout yet (don't break streak)
      checkDate.setDate(checkDate.getDate() - 1);
    }

    res.json({
      success: true,
      data: {
        stats: {
          weeklyWorkouts,
          weeklyGoal,
          totalMinutes,
          caloriesBurned,
          currentStreak,
        },
      },
    });
  })
);

/**
 * GET /api/workouts/stats/prs
 * Get personal records from workout history
 */
router.get(
  '/stats/prs',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const limit = parseInt(req.query.limit as string) || 5;

    // Get all workout logs to find PRs
    const { logs } = await workoutPlanService.getWorkoutLogs(userId, { limit: 100 });

    // Track best performance for each exercise
    const exerciseBests: Record<string, { weight: number; reps: number; date: string; previousBest: number }> = {};

    // Sort logs by date ascending to track progression
    const sortedLogs = [...logs].sort((a, b) =>
      new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
    );

    for (const log of sortedLogs) {
      for (const exercise of log.exercisesCompleted) {
        const exerciseId = exercise.exerciseId;
        const exerciseName = exercise.notes || exerciseId; // notes often contains exercise name

        for (const set of exercise.sets) {
          if (set.completed && set.weight && set.weight > 0) {
            const key = exerciseName;
            const currentBest = exerciseBests[key];

            if (!currentBest || set.weight > currentBest.weight) {
              exerciseBests[key] = {
                weight: set.weight,
                reps: set.reps,
                date: log.scheduledDate,
                previousBest: currentBest?.weight || 0,
              };
            }
          }
        }
      }
    }

    // Convert to array and sort by most recent improvement
    const records = Object.entries(exerciseBests)
      .filter(([, data]) => data.previousBest > 0) // Only show exercises with improvement
      .map(([name, data]) => ({
        exerciseName: name,
        weight: data.weight,
        reps: data.reps,
        improvement: data.weight - data.previousBest,
        date: data.date,
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);

    res.json({
      success: true,
      data: { records },
    });
  })
);

/**
 * GET /api/workouts/schedule/weekly
 * Get weekly schedule from active workout plan
 */
router.get(
  '/schedule/weekly',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { planId } = req.query;

    // Get the specified plan, or first active plan, or fallback to any plan
    let plan;
    if (planId) {
      plan = await workoutPlanService.getPlanById(planId as string);
    } else {
      const activePlans = await workoutPlanService.getUserPlans(userId, 'active');
      if (activePlans.length > 0) {
        plan = activePlans[0];
      } else {
        // Fallback: use any plan (draft plans still have valid weekly schedules)
        const allPlans = await workoutPlanService.getUserPlans(userId);
        plan = allPlans.length > 0 ? allPlans[0] : null;
      }
    }

    if (!plan) {
      res.json({
        success: true,
        data: { schedule: [] },
      });
      return;
    }

    // Get this week's dates - use local date to match client calendar
    const today = new Date();
    // Normalize to start of day in local timezone
    const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const dayOfWeek = todayLocal.getDay();
    const startOfWeek = new Date(todayLocal);
    startOfWeek.setDate(todayLocal.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    startOfWeek.setHours(0, 0, 0, 0);

    // Get workout logs for this week
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    // Format dates as YYYY-MM-DD using local timezone
    const formatLocalDate = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    const { logs } = await workoutPlanService.getWorkoutLogs(userId, {
      startDate: formatLocalDate(startOfWeek),
      endDate: formatLocalDate(endOfWeek),
    });

    // Build schedule from plan's weeklySchedule
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayAbbrev = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const todayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    // Check if weeklySchedule has any workouts defined
    const weeklyScheduleObj = plan.weeklySchedule && typeof plan.weeklySchedule === 'object'
      ? plan.weeklySchedule as Record<string, DayWorkout | null>
      : null;
    const hasWeeklySchedule = weeklyScheduleObj &&
      Object.keys(weeklyScheduleObj).some(key => weeklyScheduleObj[key] !== null);

    const schedule = days.map((day, index) => {
      const workout = weeklyScheduleObj ? weeklyScheduleObj[day] : null;
      const dateForDay = new Date(startOfWeek);
      dateForDay.setDate(startOfWeek.getDate() + index);
      const dateStr = formatLocalDate(dateForDay);

      // Check if there's a log for this day - only mark as completed if status is 'completed' or 'partial'
      const dayLogs = logs.filter(l => l.scheduledDate === dateStr && l.workoutPlanId === plan.id);
      const hasLog = dayLogs.length > 0;
      // Only mark as completed if there's an actual completed or partial log
      const isCompleted = hasLog && dayLogs.some(l => l.status === 'completed' || l.status === 'partial');

      // Determine workout name - use workout from schedule, or log name, or plan name
      let workoutName = 'Rest Day';
      let isRest = true;

      if (workout) {
        // Has a workout scheduled for this day
        workoutName = workout.workoutName;
        isRest = false;
      } else if (!hasWeeklySchedule && hasLog) {
        // No weeklySchedule defined but has a log for this day - use log's workout name
        workoutName = dayLogs[0].workoutName || plan.name;
        isRest = false;
      } else if (!hasWeeklySchedule && plan.scheduleDays && plan.scheduleDays.includes(day)) {
        // No weeklySchedule but plan has scheduleDays — this day is a workout day
        workoutName = plan.name;
        isRest = false;
      } else if (!hasWeeklySchedule && !plan.scheduleDays && index === todayIndex) {
        // No weeklySchedule or scheduleDays but it's today - show plan name
        workoutName = plan.name;
        isRest = false;
      }

      return {
        day: dayAbbrev[index],
        dayName: day,
        name: workoutName,
        completed: isCompleted,
        isToday: index === todayIndex,
        isRest: isRest,
        scheduledTime: workout ? undefined : undefined,
        planId: plan.id,
      };
    });

    res.json({
      success: true,
      data: { schedule },
    });
  })
);

// ============================================
// WORKOUT LOGGING
// ============================================

/**
 * POST /api/workouts/logs
 * Log a completed workout
 */
router.post(
  '/logs',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const {
      workoutPlanId,
      scheduledDate,
      workoutName,
      exercisesCompleted,
      durationMinutes,
      difficultyRating,
      energyLevel,
      moodAfter,
      notes,
      progressPhotoKey,
    } = req.body;

    // logWorkout already awards XP internally
    const log = await workoutPlanService.logWorkout(userId, workoutPlanId || null, {
      scheduledDate: scheduledDate || formatLocalDate(new Date()),
      workoutName,
      exercisesCompleted: exercisesCompleted || [],
      durationMinutes,
      difficultyRating,
      energyLevel,
      moodAfter,
      notes,
      progressPhotoKey,
    });

    res.status(201).json({
      success: true,
      data: {
        log,
        xpEarned: log.xpEarned,
      },
    });
  })
);

/**
 * GET /api/workouts/logs/range
 * Get workout logs for a date range (for calendar view)
 */
router.get(
  '/logs/range',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { startDate, endDate, planId } = req.query;

    if (!startDate || !endDate) {
      res.status(400).json({
        success: false,
        error: { message: 'startDate and endDate query parameters are required' },
      });
      return;
    }

    const { logs } = await workoutPlanService.getWorkoutLogs(userId, {
      startDate: startDate as string,
      endDate: endDate as string,
      planId: planId as string | undefined,
      limit: 500,
    });

    res.json({
      success: true,
      data: { logs },
    });
  })
);

/**
 * GET /api/workouts/logs/:date
 * Get workout logs for a specific date
 */
router.get(
  '/logs/:date',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { date } = req.params;

    const { logs } = await workoutPlanService.getWorkoutLogs(userId, {
      startDate: date,
      endDate: date,
    });

    res.json({
      success: true,
      data: { logs },
    });
  })
);

/**
 * PATCH /api/workouts/plans/:id/difficulty
 * Adjust workout plan difficulty
 */
router.patch(
  '/plans/:id/difficulty',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { completionRate, averageRating, workoutsCompleted } = req.body;

    // Verify plan belongs to user
    const plans = await workoutPlanService.getUserPlans(userId);
    const plan = plans.find((p) => p.id === id);

    if (!plan) {
      res.status(404).json({
        success: false,
        error: 'Workout plan not found',
      });
      return;
    }

    const result = await workoutPlanService.adjustDifficulty(id, {
      completionRate: completionRate || 0,
      averageRating: averageRating || 3,
      workoutsCompleted: workoutsCompleted || 0,
    });

    res.json({
      success: true,
      data: result,
    });
  })
);

export default router;
