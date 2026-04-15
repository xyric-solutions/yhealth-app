/**
 * @file Workout Plan Service
 * Handles workout plan generation, management, and adaptive difficulty
 */

import { pool } from '../database/pg.js';
import { logger } from './logger.service.js';
import { gamificationService } from './gamification.service.js';
import { embeddingQueueService } from './embedding-queue.service.js';
import { JobPriorities } from '../config/queue.config.js';

// ============================================
// TYPES
// ============================================

export interface Exercise {
  id: string;
  name: string;
  slug: string;
  category: string;
  primaryMuscleGroup: string;
  secondaryMuscleGroups: string[];
  equipmentRequired: string[];
  difficultyLevel: string;
  instructions: string[];
  tips: string[];
  defaultSets: number;
  defaultReps: number;
  defaultDurationSeconds?: number;
  defaultRestSeconds: number;
  caloriesPerMinute: number;
}

export interface WorkoutExercise {
  exerciseId: string;
  exercise?: Exercise;
  sets: number;
  reps: number;
  durationSeconds?: number;
  restSeconds: number;
  notes?: string;
}

export interface DayWorkout {
  dayOfWeek: string;
  workoutName: string;
  focusArea: string;
  exercises: WorkoutExercise[];
  estimatedDuration: number; // minutes
  estimatedCalories: number;
  multiplier?: number; // Progressive overload multiplier for this day
  isRestDay?: boolean;
  notes?: string;
  scheduledDate?: string; // YYYY-MM-DD — auto-computed from plan startDate + day offset
  scheduledTime?: string; // HH:mm — user-defined per day
}

// Progressive overload settings
export interface ProgressiveOverload {
  enabled: boolean;
  weightIncrementPercent: number; // e.g., 5 = 5% increase per week
  repsIncrement: number; // e.g., 1 = +1 rep per week
  deloadWeek?: number; // Which week is deload (e.g., 4)
  deloadMultiplier?: number; // e.g., 0.85 = 85% of normal load
}

// Week-level plan structure
export interface WeekPlan {
  weekNumber: number;
  multiplier: number; // Overall multiplier for this week
  days: Record<string, DayWorkout | null>; // monday, tuesday, etc.
  isDeloadWeek?: boolean;
  notes?: string;
}

// Full weeks structure
export type WeeksStructure = Record<string, WeekPlan>; // week_1, week_2, etc.

export interface WorkoutPlan {
  id: string;
  userId: string;
  planId?: string;
  name: string;
  description?: string;
  goalCategory: string;
  initialDifficultyLevel: string;
  currentDifficultyMultiplier: number;
  durationWeeks: number;
  workoutsPerWeek: number;
  // Legacy field - use 'weeks' for new plans
  weeklySchedule?: Record<string, DayWorkout>;
  // New week-by-week structure
  weeks?: WeeksStructure;
  scheduleDays?: string[]; // ['monday', 'tuesday', 'thursday', 'friday']
  progressiveOverload?: ProgressiveOverload;
  availableEquipment: string[];
  workoutLocation: string;
  totalWorkoutsCompleted: number;
  currentWeek: number;
  currentDay?: string;
  overallCompletionRate: number;
  status: string;
  startDate: string;
  endDate?: string;
  aiGenerated: boolean;
  notes?: string;
  createdAt: string;
}

// Calendar view types
export interface CalendarDay {
  date: string; // YYYY-MM-DD
  dayOfWeek: string;
  weekNumber: number;
  workout?: DayWorkout;
  isRestDay: boolean;
  isCompleted: boolean;
  isPast: boolean;
  isToday: boolean;
  isFuture: boolean;
}

export interface CalendarMonth {
  year: number;
  month: number;
  days: CalendarDay[];
  planId: string;
}

export interface WorkoutLog {
  id: string;
  userId: string;
  workoutPlanId?: string;
  scheduledDate: string;
  scheduledDayOfWeek?: string;
  workoutName?: string;
  startedAt?: string;
  completedAt?: string;
  durationMinutes?: number;
  status: 'pending' | 'completed' | 'skipped' | 'partial';
  exercisesCompleted: Array<{
    exerciseId: string;
    sets: Array<{
      reps: number;
      weight?: number;
      completed: boolean;
    }>;
    notes?: string;
  }>;
  totalSets: number;
  totalReps: number;
  totalVolume: number;
  difficultyRating?: number;
  energyLevel?: number;
  moodAfter?: number;
  notes?: string;
  progressPhotoKey?: string;
  xpEarned: number;
}

export interface GenerateWorkoutInput {
  userId: string;
  planId?: string;
  goalCategory: string;
  durationWeeks: number;
  workoutsPerWeek: number;
  availableEquipment: string[];
  workoutLocation: 'gym' | 'home' | 'outdoor';
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
  focusAreas?: string[];
  timePerWorkout?: number; // minutes
}

export interface DifficultyFeedback {
  completionRate: number;
  averageRating: number; // 1-5
  workoutsCompleted: number;
}

// ============================================
// SERVICE
// ============================================

class WorkoutPlanService {
  /** Format a Date as YYYY-MM-DD in local timezone (avoids UTC shift from toISOString) */
  private formatLocalDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Get all exercises from the library
   */
  async getExercises(filters?: {
    category?: string;
    muscleGroup?: string;
    equipment?: string[];
    difficulty?: string;
    searchQuery?: string;
  }): Promise<Exercise[]> {
    let query = `
      SELECT id, name, slug, category, primary_muscle_group, secondary_muscle_groups,
             equipment_required, difficulty_level, instructions, tips,
             default_sets, default_reps, default_duration_seconds,
             default_rest_seconds, calories_per_minute
      FROM exercises
      WHERE is_active = true
    `;
    const params: (string | string[])[] = [];
    let paramIndex = 1;

    if (filters?.category) {
      query += ` AND category = $${paramIndex++}`;
      params.push(filters.category);
    }

    if (filters?.muscleGroup) {
      query += ` AND (primary_muscle_group = $${paramIndex} OR $${paramIndex} = ANY(secondary_muscle_groups))`;
      params.push(filters.muscleGroup);
      paramIndex++;
    }

    if (filters?.equipment && filters.equipment.length > 0) {
      // Include exercises that require no equipment or only available equipment
      query += ` AND (equipment_required = '{}' OR equipment_required <@ $${paramIndex++})`;
      params.push(filters.equipment);
    }

    if (filters?.difficulty) {
      query += ` AND difficulty_level = $${paramIndex++}`;
      params.push(filters.difficulty);
    }

    if (filters?.searchQuery) {
      query += ` AND (name ILIKE $${paramIndex} OR $${paramIndex + 1} = ANY(tags))`;
      params.push(`%${filters.searchQuery}%`, filters.searchQuery.toLowerCase());
      paramIndex += 2;
    }

    query += ' ORDER BY name';

    const result = await pool.query(query, params);

    return result.rows.map(this.mapExerciseRow);
  }

  /**
   * Get exercise by ID
   */
  async getExerciseById(exerciseId: string): Promise<Exercise | null> {
    const result = await pool.query(
      `SELECT id, name, slug, category, primary_muscle_group, secondary_muscle_groups,
              equipment_required, difficulty_level, instructions, tips,
              default_sets, default_reps, default_duration_seconds,
              default_rest_seconds, calories_per_minute
       FROM exercises WHERE id = $1 AND is_active = true`,
      [exerciseId]
    );

    if (result.rows.length === 0) return null;
    return this.mapExerciseRow(result.rows[0]);
  }

  /**
   * Generate a workout plan based on user preferences
   */
  async generatePlan(input: GenerateWorkoutInput): Promise<WorkoutPlan> {
    // Get available exercises based on equipment and difficulty
    const exercises = await this.getExercises({
      equipment: input.availableEquipment,
      difficulty: input.fitnessLevel,
    });

    if (exercises.length === 0) {
      throw new Error('No exercises available for the specified criteria');
    }

    // Group exercises by muscle group
    const exercisesByMuscle = this.groupExercisesByMuscle(exercises);

    // Create workout schedule based on workouts per week
    const schedule = this.createWeeklySchedule(
      input.workoutsPerWeek,
      exercisesByMuscle,
      input.goalCategory,
      input.fitnessLevel,
      input.timePerWorkout || 45
    );

    // Calculate end date
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + input.durationWeeks * 7);

    // Create the plan in database
    const planName = this.generatePlanName(input.goalCategory, input.fitnessLevel);

    const result = await pool.query(
      `INSERT INTO workout_plans (
        user_id, plan_id, name, description, goal_category,
        initial_difficulty_level, duration_weeks, workouts_per_week,
        weekly_schedule, available_equipment, workout_location,
        start_date, end_date, ai_generated, ai_model
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true, 'rule-based')
      RETURNING *`,
      [
        input.userId,
        input.planId || null,
        planName,
        `AI-generated ${input.durationWeeks}-week ${input.goalCategory} program`,
        input.goalCategory,
        input.fitnessLevel,
        input.durationWeeks,
        input.workoutsPerWeek,
        JSON.stringify(schedule),
        input.availableEquipment,
        input.workoutLocation,
        this.formatLocalDate(startDate),
        this.formatLocalDate(endDate),
      ]
    );

    const plan = this.mapWorkoutPlanRow(result.rows[0]);
    logger.info(`Created workout plan ${plan.id} for user ${input.userId}`);

    // Enqueue embedding creation (async, non-blocking)
    await embeddingQueueService.enqueueEmbedding({
      userId: plan.userId,
      sourceType: 'workout_plan',
      sourceId: plan.id,
      operation: 'create',
      priority: JobPriorities.CRITICAL,
    });

    return plan;
  }

  /**
   * Get user's workout plans
   */
  async getUserPlans(userId: string, status?: string): Promise<WorkoutPlan[]> {
    let query = 'SELECT * FROM workout_plans WHERE user_id = $1';
    const params: string[] = [userId];

    if (status) {
      query += ' AND status = $2';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    return result.rows.map(this.mapWorkoutPlanRow);
  }

  /**
   * Get workout plan by ID
   */
  async getPlanById(planId: string): Promise<WorkoutPlan | null> {
    const result = await pool.query('SELECT * FROM workout_plans WHERE id = $1', [planId]);
    if (result.rows.length === 0) return null;
    return this.mapWorkoutPlanRow(result.rows[0]);
  }

  /**
   * Get today's workout from a plan
   */
  async getTodaysWorkout(planId: string): Promise<DayWorkout | null> {
    const plan = await this.getPlanById(planId);
    if (!plan) return null;

    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = days[new Date().getDay()];

    return plan.weeklySchedule?.[today] || null;
  }

  /**
   * Log a workout completion
   */
  async logWorkout(
    userId: string,
    workoutPlanId: string | null,
    data: {
      scheduledDate: string;
      workoutName?: string;
      exercisesCompleted: WorkoutLog['exercisesCompleted'];
      durationMinutes?: number;
      difficultyRating?: number;
      energyLevel?: number;
      moodAfter?: number;
      notes?: string;
      progressPhotoKey?: string;
    }
  ): Promise<WorkoutLog> {
    // Calculate totals
    let totalSets = 0;
    let totalReps = 0;
    let totalVolume = 0;

    for (const exercise of data.exercisesCompleted) {
      for (const set of exercise.sets) {
        if (set.completed) {
          totalSets++;
          totalReps += set.reps;
          totalVolume += set.reps * (set.weight || 0);
        }
      }
    }

    // Calculate completion rate
    const totalPossibleSets = data.exercisesCompleted.reduce(
      (sum, e) => sum + e.sets.length,
      0
    );
    const completionRate = totalPossibleSets > 0 ? totalSets / totalPossibleSets : 1;

    // Determine status - if no exercises completed, mark as pending
    const status = data.exercisesCompleted.length === 0 ? 'pending' :
      completionRate === 1 ? 'completed' : completionRate > 0 ? 'partial' : 'skipped';

    // Check if a log already exists for this date/plan combination
    const existingLog = await pool.query(
      `SELECT id FROM workout_logs
       WHERE user_id = $1 AND scheduled_date = $2
       AND (workout_plan_id = $3 OR ($3 IS NULL AND workout_plan_id IS NULL))
       ORDER BY created_at DESC LIMIT 1`,
      [userId, data.scheduledDate, workoutPlanId]
    );

    let result;

    if (existingLog.rows.length > 0) {
      // Update existing log
      result = await pool.query(
        `UPDATE workout_logs SET
          workout_name = COALESCE($1, workout_name),
          completed_at = CASE WHEN $2::text = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END,
          duration_minutes = COALESCE($3, duration_minutes),
          status = $2::activity_log_status,
          exercises_completed = $4,
          total_sets = $5,
          total_reps = $6,
          total_volume = $7,
          difficulty_rating = COALESCE($8, difficulty_rating),
          energy_level = COALESCE($9, energy_level),
          mood_after = COALESCE($10, mood_after),
          notes = COALESCE($11, notes),
          progress_photo_key = COALESCE($12, progress_photo_key),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $13
        RETURNING *`,
        [
          data.workoutName,
          status,
          data.durationMinutes,
          JSON.stringify(data.exercisesCompleted),
          totalSets,
          totalReps,
          totalVolume,
          data.difficultyRating,
          data.energyLevel,
          data.moodAfter,
          data.notes,
          data.progressPhotoKey,
          existingLog.rows[0].id,
        ]
      );
      logger.debug(`Updated existing workout log ${existingLog.rows[0].id}`);
    } else {
      // Insert new workout log
      result = await pool.query(
        `INSERT INTO workout_logs (
          user_id, workout_plan_id, scheduled_date, workout_name,
          started_at, completed_at, duration_minutes, status,
          exercises_completed, total_sets, total_reps, total_volume,
          difficulty_rating, energy_level, mood_after, notes, progress_photo_key
        ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6, $7::activity_log_status, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *`,
        [
          userId,
          workoutPlanId,
          data.scheduledDate,
          data.workoutName,
          new Date().toISOString(),
          data.durationMinutes,
          status,
          JSON.stringify(data.exercisesCompleted),
          totalSets,
          totalReps,
          totalVolume,
          data.difficultyRating,
          data.energyLevel,
          data.moodAfter,
          data.notes,
          data.progressPhotoKey,
        ]
      );
      logger.debug(`Created new workout log ${result.rows[0].id}`);
    }

    const workoutLog = this.mapWorkoutLogRow(result.rows[0]);
    const isNewLog = existingLog.rows.length === 0;

    // Only award XP for new logs (not updates) to avoid duplicate XP
    if (isNewLog && (status === 'completed' || status === 'partial')) {
      const xpResult = await gamificationService.awardWorkoutXP(
        userId,
        workoutLog.id,
        completionRate
      );
      workoutLog.xpEarned = xpResult.xpEarned;

      // Update streak
      await gamificationService.updateStreak(userId);

      // Record for unified streak system
      try {
        const { streakService } = await import('./streak.service.js');
        await streakService.recordActivity(userId, 'workout', workoutLog.id);
      } catch { /* streak recording is non-blocking */ }
    } else {
      workoutLog.xpEarned = 0; // No XP for updates
    }

    // Update plan stats if applicable (always update to reflect current state)
    if (workoutPlanId) {
      await this.updatePlanStats(workoutPlanId);
    }

    logger.info(`${isNewLog ? 'Created' : 'Updated'} workout log ${workoutLog.id} for user ${userId}, status: ${status}`);

    // Enqueue embedding for workout log (async, non-blocking)
    await embeddingQueueService.enqueueEmbedding({
      userId: workoutLog.userId,
      sourceType: 'workout_log',
      sourceId: workoutLog.id,
      operation: isNewLog ? 'create' : 'update',
      priority: JobPriorities.MEDIUM,
    });

    return workoutLog;
  }

  /**
   * Get workout logs for a user
   */
  async getWorkoutLogs(
    userId: string,
    options?: {
      planId?: string;
      startDate?: string;
      endDate?: string;
      status?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ logs: WorkoutLog[]; total: number }> {
    let query = 'SELECT * FROM workout_logs WHERE user_id = $1';
    let countQuery = 'SELECT COUNT(*) FROM workout_logs WHERE user_id = $1';
    const params: (string | number)[] = [userId];
    let paramIndex = 2;

    if (options?.planId) {
      query += ` AND workout_plan_id = $${paramIndex}`;
      countQuery += ` AND workout_plan_id = $${paramIndex}`;
      params.push(options.planId);
      paramIndex++;
    }

    if (options?.startDate) {
      query += ` AND scheduled_date >= $${paramIndex}`;
      countQuery += ` AND scheduled_date >= $${paramIndex}`;
      params.push(options.startDate);
      paramIndex++;
    }

    if (options?.endDate) {
      query += ` AND scheduled_date <= $${paramIndex}`;
      countQuery += ` AND scheduled_date <= $${paramIndex}`;
      params.push(options.endDate);
      paramIndex++;
    }

    if (options?.status) {
      query += ` AND status = $${paramIndex}`;
      countQuery += ` AND status = $${paramIndex}`;
      params.push(options.status);
      paramIndex++;
    }

    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    query += ` ORDER BY scheduled_date DESC, created_at DESC`;
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(options?.limit || 20, options?.offset || 0);

    const result = await pool.query(query, params);

    return {
      logs: result.rows.map(this.mapWorkoutLogRow),
      total,
    };
  }

  /**
   * Adjust plan difficulty based on feedback
   */
  async adjustDifficulty(
    planId: string,
    feedback: DifficultyFeedback
  ): Promise<{ newMultiplier: number; adjustment: string }> {
    const plan = await this.getPlanById(planId);
    if (!plan) throw new Error('Plan not found');

    let newMultiplier = plan.currentDifficultyMultiplier;
    let adjustment = 'none';

    // Only adjust after minimum workouts
    if (feedback.workoutsCompleted >= 3) {
      // High completion rate and rated too easy -> increase difficulty
      if (feedback.completionRate > 0.9 && feedback.averageRating < 3) {
        newMultiplier = Math.min(newMultiplier * 1.1, 2.0);
        adjustment = 'increased';
      }
      // Low completion rate or rated too hard -> decrease difficulty
      else if (feedback.completionRate < 0.7 || feedback.averageRating > 4) {
        newMultiplier = Math.max(newMultiplier * 0.9, 0.5);
        adjustment = 'decreased';
      }
    }

    if (adjustment !== 'none') {
      await pool.query(
        `UPDATE workout_plans
         SET current_difficulty_multiplier = $1,
             difficulty_adjustment_reason = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [newMultiplier, adjustment, planId]
      );

      logger.info(`Adjusted difficulty for plan ${planId}: ${adjustment} to ${newMultiplier}`);
    }

    return { newMultiplier, adjustment };
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private mapExerciseRow(row: Record<string, unknown>): Exercise {
    return {
      id: row.id as string,
      name: row.name as string,
      slug: row.slug as string,
      category: row.category as string,
      primaryMuscleGroup: row.primary_muscle_group as string,
      secondaryMuscleGroups: row.secondary_muscle_groups as string[],
      equipmentRequired: row.equipment_required as string[],
      difficultyLevel: row.difficulty_level as string,
      instructions: row.instructions as string[],
      tips: row.tips as string[],
      defaultSets: row.default_sets as number,
      defaultReps: row.default_reps as number,
      defaultDurationSeconds: row.default_duration_seconds as number | undefined,
      defaultRestSeconds: row.default_rest_seconds as number,
      caloriesPerMinute: row.calories_per_minute as number,
    };
  }

  private mapWorkoutPlanRow(row: Record<string, unknown>): WorkoutPlan {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      planId: row.plan_id as string | undefined,
      name: row.name as string,
      description: row.description as string | undefined,
      goalCategory: row.goal_category as string,
      initialDifficultyLevel: row.initial_difficulty_level as string,
      currentDifficultyMultiplier: row.current_difficulty_multiplier as number,
      durationWeeks: row.duration_weeks as number,
      workoutsPerWeek: row.workouts_per_week as number,
      weeklySchedule: (() => {
        const schedule = row.weekly_schedule;
        if (!schedule) return {};
        if (typeof schedule === 'string') {
          try {
            return JSON.parse(schedule) as Record<string, DayWorkout>;
          } catch {
            return {};
          }
        }
        return schedule as Record<string, DayWorkout>;
      })(),
      availableEquipment: row.available_equipment as string[],
      workoutLocation: row.workout_location as string,
      totalWorkoutsCompleted: row.total_workouts_completed as number,
      currentWeek: row.current_week as number,
      overallCompletionRate: row.overall_completion_rate as number,
      status: row.status as string,
      startDate: typeof row.start_date === 'string'
        ? row.start_date
        : this.formatLocalDate(row.start_date as Date),
      endDate: row.end_date
        ? (typeof row.end_date === 'string'
          ? row.end_date
          : this.formatLocalDate(row.end_date as Date))
        : undefined,
      weeks: (() => {
        const w = row.weeks;
        if (!w) return undefined;
        if (typeof w === 'string') {
          try { return JSON.parse(w) as WeeksStructure; } catch { return undefined; }
        }
        return w as WeeksStructure;
      })(),
      scheduleDays: row.schedule_days as string[] | undefined,
      aiGenerated: row.ai_generated as boolean,
      createdAt: (row.created_at as Date).toISOString(),
    };
  }

  private mapWorkoutLogRow(row: Record<string, unknown>): WorkoutLog {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      workoutPlanId: row.workout_plan_id as string | undefined,
      scheduledDate: typeof row.scheduled_date === 'string'
        ? row.scheduled_date
        : this.formatLocalDate(row.scheduled_date as Date),
      scheduledDayOfWeek: row.scheduled_day_of_week as string | undefined,
      workoutName: row.workout_name as string | undefined,
      startedAt: row.started_at
        ? (row.started_at as Date).toISOString()
        : undefined,
      completedAt: row.completed_at
        ? (row.completed_at as Date).toISOString()
        : undefined,
      durationMinutes: row.duration_minutes as number | undefined,
      status: row.status as WorkoutLog['status'],
      exercisesCompleted: row.exercises_completed as WorkoutLog['exercisesCompleted'],
      totalSets: row.total_sets as number,
      totalReps: row.total_reps as number,
      totalVolume: row.total_volume as number,
      difficultyRating: row.difficulty_rating as number | undefined,
      energyLevel: row.energy_level as number | undefined,
      moodAfter: row.mood_after as number | undefined,
      notes: row.notes as string | undefined,
      progressPhotoKey: row.progress_photo_key as string | undefined,
      xpEarned: row.xp_earned as number,
    };
  }

  private groupExercisesByMuscle(
    exercises: Exercise[]
  ): Record<string, Exercise[]> {
    const groups: Record<string, Exercise[]> = {};

    for (const exercise of exercises) {
      const muscle = exercise.primaryMuscleGroup;
      if (!groups[muscle]) {
        groups[muscle] = [];
      }
      groups[muscle].push(exercise);
    }

    return groups;
  }

  private createWeeklySchedule(
    workoutsPerWeek: number,
    exercisesByMuscle: Record<string, Exercise[]>,
    goalCategory: string,
    fitnessLevel: string,
    timePerWorkout: number
  ): Record<string, DayWorkout> {
    const schedule: Record<string, DayWorkout> = {};
    const workoutDays = this.getWorkoutDays(workoutsPerWeek);

    // Define workout splits based on frequency
    const splits = this.getWorkoutSplit(workoutsPerWeek, goalCategory);

    workoutDays.forEach((day, index) => {
      const split = splits[index % splits.length];
      const exercises = this.selectExercisesForWorkout(
        exercisesByMuscle,
        split.muscleGroups,
        fitnessLevel,
        timePerWorkout
      );

      schedule[day] = {
        dayOfWeek: day,
        workoutName: split.name,
        focusArea: split.focus,
        exercises,
        estimatedDuration: this.calculateEstimatedDuration(exercises),
        estimatedCalories: this.calculateEstimatedCalories(exercises),
      };
    });

    return schedule;
  }

  private getWorkoutDays(workoutsPerWeek: number): string[] {
    const dayMappings: Record<number, string[]> = {
      2: ['monday', 'thursday'],
      3: ['monday', 'wednesday', 'friday'],
      4: ['monday', 'tuesday', 'thursday', 'friday'],
      5: ['monday', 'tuesday', 'wednesday', 'friday', 'saturday'],
      6: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    };

    return dayMappings[workoutsPerWeek] || dayMappings[3];
  }

  private getWorkoutSplit(
    workoutsPerWeek: number,
    _goalCategory: string
  ): Array<{ name: string; focus: string; muscleGroups: string[] }> {
    // Full body for 2-3 days, push/pull/legs for 4+
    if (workoutsPerWeek <= 3) {
      return [
        { name: 'Full Body A', focus: 'strength', muscleGroups: ['chest', 'back', 'legs', 'core'] },
        { name: 'Full Body B', focus: 'strength', muscleGroups: ['shoulders', 'arms', 'legs', 'core'] },
        { name: 'Full Body C', focus: 'conditioning', muscleGroups: ['full-body', 'core'] },
      ];
    }

    return [
      { name: 'Push', focus: 'chest/shoulders/triceps', muscleGroups: ['chest', 'shoulders', 'arms'] },
      { name: 'Pull', focus: 'back/biceps', muscleGroups: ['back', 'arms'] },
      { name: 'Legs', focus: 'lower body', muscleGroups: ['legs', 'core'] },
      { name: 'Upper', focus: 'upper body', muscleGroups: ['chest', 'back', 'shoulders'] },
      { name: 'Lower + Core', focus: 'legs and abs', muscleGroups: ['legs', 'core'] },
    ];
  }

  private selectExercisesForWorkout(
    exercisesByMuscle: Record<string, Exercise[]>,
    muscleGroups: string[],
    _fitnessLevel: string,
    targetMinutes: number
  ): WorkoutExercise[] {
    const selected: WorkoutExercise[] = [];
    const exercisesPerMuscle = Math.ceil(4 / muscleGroups.length);

    for (const muscle of muscleGroups) {
      const available = exercisesByMuscle[muscle] || [];
      const shuffled = [...available].sort(() => Math.random() - 0.5);
      const picked = shuffled.slice(0, exercisesPerMuscle);

      for (const exercise of picked) {
        selected.push({
          exerciseId: exercise.id,
          exercise,
          sets: exercise.defaultSets,
          reps: exercise.defaultReps,
          durationSeconds: exercise.defaultDurationSeconds,
          restSeconds: exercise.defaultRestSeconds,
        });
      }
    }

    // Limit based on time
    const maxExercises = Math.floor(targetMinutes / 8); // ~8 min per exercise
    return selected.slice(0, Math.max(maxExercises, 4));
  }

  private calculateEstimatedDuration(exercises: WorkoutExercise[]): number {
    let totalSeconds = 0;

    for (const ex of exercises) {
      const setsTime = ex.durationSeconds
        ? ex.sets * ex.durationSeconds
        : ex.sets * ex.reps * 3; // ~3 sec per rep
      const restTime = (ex.sets - 1) * ex.restSeconds;
      totalSeconds += setsTime + restTime;
    }

    return Math.ceil(totalSeconds / 60);
  }

  private calculateEstimatedCalories(exercises: WorkoutExercise[]): number {
    let totalCalories = 0;

    for (const ex of exercises) {
      if (ex.exercise) {
        const durationMin = ex.durationSeconds
          ? (ex.sets * ex.durationSeconds) / 60
          : (ex.sets * ex.reps * 3) / 60;
        totalCalories += durationMin * ex.exercise.caloriesPerMinute;
      }
    }

    return Math.round(totalCalories);
  }

  private generatePlanName(goalCategory: string, fitnessLevel: string): string {
    const goalNames: Record<string, string> = {
      weight_loss: 'Fat Burn',
      muscle_building: 'Muscle Builder',
      overall_optimization: 'Total Fitness',
      energy_productivity: 'Energy Boost',
      event_training: 'Performance',
    };

    const levelNames: Record<string, string> = {
      beginner: 'Starter',
      intermediate: 'Progressive',
      advanced: 'Elite',
    };

    const goalName = goalNames[goalCategory] || 'Custom';
    const levelName = levelNames[fitnessLevel] || '';

    return `${levelName} ${goalName} Program`.trim();
  }

  private async updatePlanStats(planId: string): Promise<void> {
    const result = await pool.query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed
       FROM workout_logs WHERE workout_plan_id = $1`,
      [planId]
    );

    const total = parseInt(result.rows[0].total, 10);
    const completed = parseInt(result.rows[0].completed, 10);
    const completionRate = total > 0 ? completed / total : 0;

    await pool.query(
      `UPDATE workout_plans
       SET total_workouts_completed = $1, overall_completion_rate = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [completed, completionRate, planId]
    );
  }

  // ============================================
  // PROGRESSIVE WEEKS GENERATION
  // ============================================

  /**
   * Generate progressive weeks structure from a base weekly schedule
   * Applies progressive overload multipliers for each week
   */
  generateProgressiveWeeks(
    baseSchedule: Record<string, DayWorkout>,
    durationWeeks: number,
    progressiveOverload?: ProgressiveOverload
  ): WeeksStructure {
    const weeks: WeeksStructure = {};
    const overload = progressiveOverload || {
      enabled: true,
      weightIncrementPercent: 5,
      repsIncrement: 1,
      deloadWeek: durationWeeks, // Default to last week
      deloadMultiplier: 0.85,
    };

    for (let weekNum = 1; weekNum <= durationWeeks; weekNum++) {
      const isDeloadWeek = overload.deloadWeek === weekNum;
      
      // Calculate multiplier based on progressive overload settings
      let multiplier: number;
      if (isDeloadWeek && overload.deloadMultiplier) {
        multiplier = overload.deloadMultiplier;
      } else if (overload.enabled) {
        // Progressive increase: Week 1 = 1.0, Week 2 = 1.05, Week 3 = 1.10, etc.
        multiplier = 1 + ((weekNum - 1) * overload.weightIncrementPercent) / 100;
      } else {
        multiplier = 1.0;
      }

      // Create week plan with adjusted exercises
      const days: Record<string, DayWorkout | null> = {};
      const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

      for (const day of allDays) {
        if (baseSchedule[day]) {
          const baseDay = baseSchedule[day];
          days[day] = {
            ...baseDay,
            multiplier,
            exercises: baseDay.exercises.map(ex => ({
              ...ex,
              // Apply progressive overload to reps
              reps: overload.enabled && !isDeloadWeek
                ? ex.reps + (weekNum - 1) * overload.repsIncrement
                : isDeloadWeek
                  ? Math.round(ex.reps * 0.9)
                  : ex.reps,
            })),
          };
        } else {
          days[day] = null; // Rest day
        }
      }

      weeks[`week_${weekNum}`] = {
        weekNumber: weekNum,
        multiplier,
        days,
        isDeloadWeek,
        notes: isDeloadWeek ? 'Deload week - reduce intensity to allow recovery' : undefined,
      };
    }

    return weeks;
  }

  /**
   * Get workout schedule for a specific week
   */
  async getWeekSchedule(planId: string, weekNumber: number): Promise<WeekPlan | null> {
    const result = await pool.query(
      `SELECT weeks, weekly_schedule, duration_weeks FROM workout_plans WHERE id = $1`,
      [planId]
    );

    if (result.rows.length === 0) return null;

    const { weeks, weekly_schedule, duration_weeks } = result.rows[0];

    // If new structure exists, use it
    if (weeks && weeks[`week_${weekNumber}`]) {
      return weeks[`week_${weekNumber}`] as WeekPlan;
    }

    // Fallback to legacy structure - all weeks are the same
    if (weekly_schedule && weekNumber <= duration_weeks) {
      return {
        weekNumber,
        multiplier: 1.0,
        days: weekly_schedule,
        isDeloadWeek: false,
      };
    }

    return null;
  }

  /**
   * Update a specific week's plan
   */
  async updateWeekSchedule(
    planId: string,
    weekNumber: number,
    weekPlan: Partial<WeekPlan>
  ): Promise<void> {
    const result = await pool.query(
      `SELECT weeks FROM workout_plans WHERE id = $1`,
      [planId]
    );

    if (result.rows.length === 0) {
      throw new Error('Workout plan not found');
    }

    const weeks = result.rows[0].weeks || {};
    weeks[`week_${weekNumber}`] = {
      ...weeks[`week_${weekNumber}`],
      ...weekPlan,
    };

    await pool.query(
      `UPDATE workout_plans SET weeks = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [JSON.stringify(weeks), planId]
    );
  }

  // ============================================
  // CALENDAR VIEW
  // ============================================

  /**
   * Get calendar view for a workout plan
   * Returns all days in a month with workout information
   */
  async getCalendarView(
    planId: string,
    year: number,
    month: number // 1-12
  ): Promise<CalendarMonth> {
    const plan = await this.getPlanById(planId);
    if (!plan) {
      throw new Error('Workout plan not found');
    }

    // Get completed workouts for the month
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0);
    
    const logsResult = await pool.query(
      `SELECT scheduled_date, status FROM workout_logs
       WHERE workout_plan_id = $1
         AND scheduled_date >= $2
         AND scheduled_date <= $3`,
      [planId, this.formatLocalDate(startOfMonth), this.formatLocalDate(endOfMonth)]
    );

    const completedDates = new Set(
      logsResult.rows
        .filter((r: { status: string }) => r.status === 'completed')
        .map((r: { scheduled_date: string }) => r.scheduled_date)
    );

    const days: CalendarDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const planStart = new Date(plan.startDate);
    const planEnd = plan.endDate ? new Date(plan.endDate) : null;

    // Generate all days in the month
    const daysInMonth = new Date(year, month, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dateStr = this.formatLocalDate(date);
      const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];

      // Calculate which week of the plan this day falls into
      const daysSinceStart = Math.floor((date.getTime() - planStart.getTime()) / (1000 * 60 * 60 * 24));
      const weekNumber = Math.floor(daysSinceStart / 7) + 1;

      // Check if this day is within the plan dates
      const isWithinPlan = date >= planStart && (!planEnd || date <= planEnd) && weekNumber <= plan.durationWeeks;

      let workout: DayWorkout | undefined;
      let isRestDay = true;

      if (isWithinPlan) {
        // Try to get workout from weeks structure
        if (plan.weeks && plan.weeks[`week_${weekNumber}`]) {
          const weekPlan = plan.weeks[`week_${weekNumber}`];
          const dayWorkout = weekPlan.days?.[dayOfWeek];
          if (dayWorkout) {
            workout = dayWorkout;
            isRestDay = false;
          }
        } else if (plan.weeklySchedule && plan.weeklySchedule[dayOfWeek]) {
          // Fallback to legacy structure
          workout = plan.weeklySchedule[dayOfWeek];
          isRestDay = false;
        }
      }

      days.push({
        date: dateStr,
        dayOfWeek,
        weekNumber: isWithinPlan ? weekNumber : 0,
        workout,
        isRestDay,
        isCompleted: completedDates.has(dateStr),
        isPast: date < today,
        isToday: date.getTime() === today.getTime(),
        isFuture: date > today,
      });
    }

    return {
      year,
      month,
      days,
      planId,
    };
  }

  /**
   * Get the current week number for a plan based on start date
   */
  getCurrentWeekNumber(plan: WorkoutPlan): number {
    const today = new Date();
    const startDate = new Date(plan.startDate);
    const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const weekNumber = Math.floor(daysSinceStart / 7) + 1;
    return Math.min(Math.max(1, weekNumber), plan.durationWeeks);
  }

  /**
   * Get all weeks summary for a plan
   */
  async getWeeksSummary(planId: string): Promise<Array<{
    weekNumber: number;
    multiplier: number;
    isDeloadWeek: boolean;
    workoutDays: string[];
    isCurrentWeek: boolean;
    completionRate: number;
  }>> {
    const plan = await this.getPlanById(planId);
    if (!plan) return [];

    const currentWeek = this.getCurrentWeekNumber(plan);
    const summary = [];

    for (let weekNum = 1; weekNum <= plan.durationWeeks; weekNum++) {
      const weekPlan = plan.weeks?.[`week_${weekNum}`];
      const workoutDays = weekPlan
        ? Object.keys(weekPlan.days || {}).filter(d => weekPlan.days[d] !== null)
        : Object.keys(plan.weeklySchedule || {});

      // Get completion rate for this week
      const startDate = new Date(plan.startDate);
      startDate.setDate(startDate.getDate() + (weekNum - 1) * 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);

      const logsResult = await pool.query(
        `SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'completed') as completed
         FROM workout_logs
         WHERE workout_plan_id = $1
           AND scheduled_date >= $2
           AND scheduled_date <= $3`,
        [planId, this.formatLocalDate(startDate), this.formatLocalDate(endDate)]
      );

      const total = parseInt(logsResult.rows[0].total, 10);
      const completed = parseInt(logsResult.rows[0].completed, 10);

      summary.push({
        weekNumber: weekNum,
        multiplier: weekPlan?.multiplier || 1.0,
        isDeloadWeek: weekPlan?.isDeloadWeek || false,
        workoutDays,
        isCurrentWeek: weekNum === currentWeek,
        completionRate: total > 0 ? completed / total : 0,
      });
    }

    return summary;
  }

  /**
   * Convert legacy weekly_schedule to weeks structure
   */
  async migratePlanToWeeksStructure(planId: string): Promise<void> {
    const result = await pool.query(
      `SELECT weekly_schedule, duration_weeks, progressive_overload
       FROM workout_plans WHERE id = $1`,
      [planId]
    );

    if (result.rows.length === 0) return;

    const { weekly_schedule, duration_weeks, progressive_overload } = result.rows[0];
    
    if (!weekly_schedule || Object.keys(weekly_schedule).length === 0) return;

    // Generate weeks from base schedule
    const weeks = this.generateProgressiveWeeks(
      weekly_schedule,
      duration_weeks,
      progressive_overload
    );

    await pool.query(
      `UPDATE workout_plans
       SET weeks = $1, schedule_days = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [JSON.stringify(weeks), Object.keys(weekly_schedule), planId]
    );

    logger.info('[WorkoutPlan] Migrated plan to weeks structure', { planId });
  }
}

// Export singleton instance
export const workoutPlanService = new WorkoutPlanService();
