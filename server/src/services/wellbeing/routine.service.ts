/**
 * @file Routine Service
 * @description Handles wellbeing routines and completion tracking (F7.6)
 */

import { query } from '../../database/pg.js';
import { ApiError } from '../../utils/ApiError.js';
import type {
  WellbeingRoutine,
  RoutineCompletion,
  RoutineType,
  HabitFrequency,
  DayOfWeek,
  RoutineStep,
} from '@shared/types/domain/wellbeing.js';
import { calculateStreak } from './utils/pattern-detection.js';

interface RoutineRow {
  id: string;
  user_id: string;
  routine_name: string;
  routine_type: RoutineType;
  is_template: boolean;
  template_id: string | null;
  steps: any; // JSONB
  frequency: HabitFrequency;
  specific_days: DayOfWeek[];
  trigger_time: string | null;
  is_active: boolean;
  is_archived: boolean;
  created_at: Date;
  updated_at: Date;
}

interface CompletionRow {
  id: string;
  user_id: string;
  routine_id: string;
  completion_date: Date;
  steps_completed: any; // JSONB
  completion_rate: number | null;
  total_steps: number;
  completed_steps: number;
  started_at: Date | null;
  completed_at: Date | null;
  duration_seconds: number | null;
  created_at: Date;
  updated_at: Date;
}

// Routine templates
const ROUTINE_TEMPLATES: Array<{
  name: string;
  type: RoutineType;
  steps: RoutineStep[];
  description: string;
}> = [
  {
    name: 'Morning Energizer',
    type: 'morning',
    steps: [
      { step: 'Gratitude', durationMin: 2, order: 1, instructions: 'List 3 things you\'re grateful for' },
      { step: 'Intention Setting', durationMin: 1, order: 2, instructions: 'Set one intention for the day' },
      { step: 'Breathing Exercise', durationMin: 2, order: 3, instructions: 'Take 10 deep breaths' },
    ],
    description: 'Start your day with positivity and clarity',
  },
  {
    name: 'Evening Wind-Down',
    type: 'evening',
    steps: [
      { step: 'Daily Reflection', durationMin: 5, order: 1, instructions: 'Reflect on your day' },
      { step: 'Gratitude Practice', durationMin: 2, order: 2, instructions: 'What went well today?' },
      { step: 'Relaxation Breathing', durationMin: 3, order: 3, instructions: 'Progressive muscle relaxation' },
    ],
    description: 'Unwind and prepare for restful sleep',
  },
];

class RoutineService {
  async getTemplates(): Promise<typeof ROUTINE_TEMPLATES> {
    return ROUTINE_TEMPLATES;
  }

  async createRoutine(userId: string, input: {
    routineName: string;
    routineType: RoutineType;
    steps: RoutineStep[];
    frequency?: HabitFrequency;
    specificDays?: DayOfWeek[];
    triggerTime?: string;
    templateId?: string;
  }): Promise<WellbeingRoutine> {
    if (!input.routineName || !input.steps || input.steps.length === 0) {
      throw ApiError.badRequest('Routine name and steps are required');
    }

    const result = await query<RoutineRow>(
      `INSERT INTO wellbeing_routines (
        user_id, routine_name, routine_type, steps, frequency,
        specific_days, trigger_time, template_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        userId,
        input.routineName,
        input.routineType,
        JSON.stringify(input.steps),
        input.frequency || 'daily',
        input.specificDays || [],
        input.triggerTime || null,
        input.templateId || null,
      ]
    );

    return this.mapRowToRoutine(result.rows[0]);
  }

  async getRoutines(userId: string, includeArchived = false): Promise<WellbeingRoutine[]> {
    let queryText = `SELECT * FROM wellbeing_routines WHERE user_id = $1`;
    const params: (string | boolean)[] = [userId];

    if (!includeArchived) {
      queryText += ` AND is_archived = false`;
    }

    queryText += ` ORDER BY created_at DESC`;

    const result = await query<RoutineRow>(queryText, params);
    return result.rows.map((r) => this.mapRowToRoutine(r));
  }

  async getRoutineById(userId: string, routineId: string): Promise<WellbeingRoutine> {
    const result = await query<RoutineRow>(
      `SELECT * FROM wellbeing_routines WHERE id = $1 AND user_id = $2`,
      [routineId, userId]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Routine not found');
    }

    return this.mapRowToRoutine(result.rows[0]);
  }

  async completeRoutine(userId: string, routineId: string, input: {
    stepsCompleted: Array<{ step: string; completed: boolean; completedAt?: string }>;
    startedAt?: string;
    completedAt?: string;
  }): Promise<RoutineCompletion> {
    await this.getRoutineById(userId, routineId);

    const routine = await this.getRoutineById(userId, routineId);
    const totalSteps = (routine.steps as RoutineStep[]).length;
    const completedSteps = input.stepsCompleted.filter((s) => s.completed).length;
    const completionRate = (completedSteps / totalSteps) * 100;

    const completionDate = new Date().toISOString().split('T')[0];

    // Check if completion exists
    const existing = await query<{ id: string }>(
      `SELECT id FROM routine_completions WHERE user_id = $1 AND routine_id = $2 AND completion_date = $3`,
      [userId, routineId, completionDate]
    );

    let result: { rows: CompletionRow[] };

    if (existing.rows.length > 0) {
      result = await query<CompletionRow>(
        `UPDATE routine_completions
         SET steps_completed = $1, completion_rate = $2, completed_steps = $3,
             started_at = $4, completed_at = $5, duration_seconds = $6, updated_at = CURRENT_TIMESTAMP
         WHERE id = $7
         RETURNING *`,
        [
          JSON.stringify(input.stepsCompleted),
          completionRate,
          completedSteps,
          input.startedAt || null,
          input.completedAt || null,
          input.startedAt && input.completedAt
            ? Math.floor((new Date(input.completedAt).getTime() - new Date(input.startedAt).getTime()) / 1000)
            : null,
          existing.rows[0].id,
        ]
      );
    } else {
      result = await query<CompletionRow>(
        `INSERT INTO routine_completions (
          user_id, routine_id, completion_date, steps_completed,
          completion_rate, total_steps, completed_steps,
          started_at, completed_at, duration_seconds
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          userId,
          routineId,
          completionDate,
          JSON.stringify(input.stepsCompleted),
          completionRate,
          totalSteps,
          completedSteps,
          input.startedAt || null,
          input.completedAt || null,
          input.startedAt && input.completedAt
            ? Math.floor((new Date(input.completedAt).getTime() - new Date(input.startedAt).getTime()) / 1000)
            : null,
        ]
      );
    }

    return this.mapRowToCompletion(result.rows[0]);
  }

  async getRoutineProgress(userId: string, routineId: string, days = 30): Promise<{
    completionRate: number;
    currentStreak: number;
    longestStreak: number;
    completions: RoutineCompletion[];
  }> {
    await this.getRoutineById(userId, routineId);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const result = await query<CompletionRow>(
      `SELECT * FROM routine_completions
       WHERE user_id = $1 AND routine_id = $2
       AND completion_date >= $3 AND completion_date <= $4
       ORDER BY completion_date DESC`,
      [userId, routineId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
    );

    const completions = result.rows.map((r) => this.mapRowToCompletion(r));
    const dates = completions.map((c) => c.completionDate);
    const completed = completions.map((c) => c.completionRate >= 80); // 80%+ considered complete

    const streak = calculateStreak(dates, completed);
    const avgCompletion = completions.length > 0
      ? completions.reduce((sum, c) => sum + c.completionRate, 0) / completions.length
      : 0;

    return {
      completionRate: Math.round(avgCompletion * 100) / 100,
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      completions,
    };
  }

  private mapRowToRoutine(row: RoutineRow): WellbeingRoutine {
    return {
      id: row.id,
      userId: row.user_id,
      routineName: row.routine_name,
      routineType: row.routine_type,
      isTemplate: row.is_template,
      templateId: row.template_id || undefined,
      steps: Array.isArray(row.steps) ? row.steps : (typeof row.steps === 'string' ? JSON.parse(row.steps) : []),
      frequency: row.frequency,
      specificDays: row.specific_days || [],
      triggerTime: row.trigger_time || undefined,
      isActive: row.is_active,
      isArchived: row.is_archived,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private mapRowToCompletion(row: CompletionRow): RoutineCompletion {
    return {
      id: row.id,
      userId: row.user_id,
      routineId: row.routine_id,
      completionDate: new Date(row.completion_date).toISOString().split('T')[0],
      stepsCompleted: Array.isArray(row.steps_completed)
        ? row.steps_completed
        : typeof row.steps_completed === 'string'
        ? JSON.parse(row.steps_completed)
        : [],
      completionRate: row.completion_rate || 0,
      totalSteps: row.total_steps,
      completedSteps: row.completed_steps,
      startedAt: row.started_at?.toISOString(),
      completedAt: row.completed_at?.toISOString(),
      durationSeconds: row.duration_seconds || undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}

export const routineService = new RoutineService();
export default routineService;

