/**
 * @file Habit Service
 * @description Handles habit tracking with correlations and analytics (F7.3)
 */

import { query } from '../../database/pg.js';
import { ApiError } from '../../utils/ApiError.js';
import type {
  Habit,
  HabitLog,
  HabitTrackingType,
  HabitFrequency,
  DayOfWeek,
} from '@shared/types/domain/wellbeing.js';
import { calculateStreak } from './utils/pattern-detection.js';
import { correlateHabitWithMood } from './utils/correlation-engine.js';

// ============================================
// TYPES
// ============================================

export interface CreateHabitInput {
  habitName: string;
  category?: string;
  trackingType: HabitTrackingType;
  frequency: HabitFrequency;
  specificDays?: DayOfWeek[];
  description?: string;
  targetValue?: number;
  unit?: string;
  reminderEnabled?: boolean;
  reminderTime?: string;
}

export interface UpdateHabitInput extends Partial<CreateHabitInput> {
  isActive?: boolean;
  isArchived?: boolean;
}

export interface CreateHabitLogInput {
  completed: boolean;
  value?: number;
  note?: string;
  logDate?: string;
}

export interface HabitAnalytics {
  completionRate: number; // 0-100
  currentStreak: number;
  longestStreak: number;
  streakStartDate?: string;
  lastCompleted?: string;
  totalCompletions: number;
  totalDays: number;
  correlations?: Array<{
    metric: string;
    correlation: number;
    insight?: string;
  }>;
}

interface HabitRow {
  id: string;
  user_id: string;
  habit_name: string;
  category: string | null;
  tracking_type: HabitTrackingType;
  frequency: HabitFrequency;
  specific_days: DayOfWeek[];
  description: string | null;
  target_value: number | null;
  unit: string | null;
  is_active: boolean;
  is_archived: boolean;
  reminder_enabled: boolean;
  reminder_time: string | null;
  created_at: Date;
  updated_at: Date;
}

interface HabitLogRow {
  id: string;
  user_id: string;
  habit_id: string;
  completed: boolean;
  value: number | null;
  note: string | null;
  log_date: Date;
  logged_at: Date;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// SERVICE CLASS
// ============================================

class HabitService {
  /**
   * Create a new habit
   */
  async createHabit(userId: string, input: CreateHabitInput): Promise<Habit> {
    if (!input.habitName || input.habitName.trim().length === 0) {
      throw ApiError.badRequest('Habit name is required');
    }

    // Check for duplicate active habit name
    const existing = await query<{ id: string }>(
      `SELECT id FROM habits
       WHERE user_id = $1 AND habit_name = $2 AND is_active = true AND is_archived = false`,
      [userId, input.habitName.trim()]
    );

    if (existing.rows.length > 0) {
      throw ApiError.badRequest('You already have an active habit with this name');
    }

    const result = await query<HabitRow>(
      `INSERT INTO habits (
        user_id, habit_name, category, tracking_type, frequency,
        specific_days, description, target_value, unit,
        reminder_enabled, reminder_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        userId,
        input.habitName.trim(),
        input.category || null,
        input.trackingType,
        input.frequency,
        input.specificDays || [],
        input.description || null,
        input.targetValue || null,
        input.unit || null,
        input.reminderEnabled || false,
        input.reminderTime || null,
      ]
    );

    return this.mapRowToHabit(result.rows[0]);
  }

  /**
   * Get all habits for a user
   */
  async getHabits(userId: string, includeArchived: boolean = false): Promise<Habit[]> {
    let queryText = `SELECT * FROM habits WHERE user_id = $1`;
    const params: (string | boolean)[] = [userId];

    if (!includeArchived) {
      queryText += ` AND is_archived = false`;
    }

    queryText += ` ORDER BY created_at DESC`;

    const result = await query<HabitRow>(queryText, params);

    return result.rows.map((row) => this.mapRowToHabit(row));
  }

  /**
   * Get a single habit by ID
   */
  async getHabitById(userId: string, habitId: string): Promise<Habit> {
    const result = await query<HabitRow>(
      `SELECT * FROM habits WHERE id = $1 AND user_id = $2`,
      [habitId, userId]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Habit not found');
    }

    return this.mapRowToHabit(result.rows[0]);
  }

  /**
   * Update a habit
   */
  async updateHabit(userId: string, habitId: string, input: UpdateHabitInput): Promise<Habit> {
    // Verify habit exists and belongs to user
    await this.getHabitById(userId, habitId);

    const updates: string[] = [];
    const values: (string | number | boolean | DayOfWeek[] | null)[] = [];
    let paramCount = 1;

    if (input.habitName !== undefined) {
      updates.push(`habit_name = $${paramCount++}`);
      values.push(input.habitName.trim());
    }

    if (input.category !== undefined) {
      updates.push(`category = $${paramCount++}`);
      values.push(input.category || null);
    }

    if (input.trackingType !== undefined) {
      updates.push(`tracking_type = $${paramCount++}`);
      values.push(input.trackingType);
    }

    if (input.frequency !== undefined) {
      updates.push(`frequency = $${paramCount++}`);
      values.push(input.frequency);
    }

    if (input.specificDays !== undefined) {
      updates.push(`specific_days = $${paramCount++}`);
      values.push(input.specificDays);
    }

    if (input.description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(input.description || null);
    }

    if (input.targetValue !== undefined) {
      updates.push(`target_value = $${paramCount++}`);
      values.push(input.targetValue || null);
    }

    if (input.unit !== undefined) {
      updates.push(`unit = $${paramCount++}`);
      values.push(input.unit || null);
    }

    if (input.reminderEnabled !== undefined) {
      updates.push(`reminder_enabled = $${paramCount++}`);
      values.push(input.reminderEnabled);
    }

    if (input.reminderTime !== undefined) {
      updates.push(`reminder_time = $${paramCount++}`);
      values.push(input.reminderTime || null);
    }

    if (input.isActive !== undefined) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(input.isActive);
    }

    if (input.isArchived !== undefined) {
      updates.push(`is_archived = $${paramCount++}`);
      values.push(input.isArchived);
    }

    if (updates.length === 0) {
      return this.getHabitById(userId, habitId);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(habitId, userId);

    const queryText = `UPDATE habits SET ${updates.join(', ')} WHERE id = $${paramCount++} AND user_id = $${paramCount++} RETURNING *`;

    const result = await query<HabitRow>(queryText, values);

    return this.mapRowToHabit(result.rows[0]);
  }

  /**
   * Delete a habit
   */
  async deleteHabit(userId: string, habitId: string): Promise<void> {
    const result = await query(
      `DELETE FROM habits WHERE id = $1 AND user_id = $2 RETURNING id`,
      [habitId, userId]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Habit not found');
    }
  }

  /**
   * Log habit completion
   */
  async logHabitCompletion(
    userId: string,
    habitId: string,
    input: CreateHabitLogInput
  ): Promise<HabitLog> {
    // Verify habit exists and belongs to user
    await this.getHabitById(userId, habitId);

    const logDate = input.logDate
      ? new Date(input.logDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    // Check if log already exists for this date
    const existing = await query<{ id: string }>(
      `SELECT id FROM habit_logs WHERE user_id = $1 AND habit_id = $2 AND log_date = $3`,
      [userId, habitId, logDate]
    );

    let result: { rows: HabitLogRow[] };

    if (existing.rows.length > 0) {
      // Update existing log
      result = await query<HabitLogRow>(
        `UPDATE habit_logs
         SET completed = $1, value = $2, note = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING *`,
        [input.completed, input.value || null, input.note || null, existing.rows[0].id]
      );
    } else {
      // Create new log
      result = await query<HabitLogRow>(
        `INSERT INTO habit_logs (user_id, habit_id, completed, value, note, log_date)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [userId, habitId, input.completed, input.value || null, input.note || null, logDate]
      );
    }

    return this.mapRowToHabitLog(result.rows[0]);
  }

  /**
   * Get habit logs for a specific habit
   */
  async getHabitLogs(userId: string, habitId: string, days: number = 30): Promise<HabitLog[]> {
    // Verify habit exists
    await this.getHabitById(userId, habitId);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    // Get habit logs
    const logsResult = await query<HabitLogRow>(
      `SELECT * FROM habit_logs
       WHERE user_id = $1 AND habit_id = $2
       AND log_date >= $3 AND log_date <= $4
       ORDER BY log_date DESC`,
      [userId, habitId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
    );

    return logsResult.rows.map((row) => this.mapRowToHabitLog(row));
  }

  /**
   * Get habit analytics and correlations
   */
  async getHabitAnalytics(userId: string, habitId: string, days: number = 30): Promise<HabitAnalytics> {
    // Verify habit exists
    const habit = await this.getHabitById(userId, habitId);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    // Get habit logs
    const logsResult = await query<HabitLogRow>(
      `SELECT * FROM habit_logs
       WHERE user_id = $1 AND habit_id = $2
       AND log_date >= $3 AND log_date <= $4
       ORDER BY log_date ASC`,
      [userId, habitId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
    );

    const logs = logsResult.rows.map((row) => this.mapRowToHabitLog(row));

    // Calculate completion rate
    const totalLogs = logs.length;
    const completedLogs = logs.filter((l) => l.completed).length;
    const completionRate = totalLogs > 0 ? (completedLogs / totalLogs) * 100 : 0;

    // Calculate streak
    const dates = logs.map((l) => l.logDate);
    const completed = logs.map((l) => l.completed);
    const streak = calculateStreak(dates, completed);

    // Get last completed date
    const lastCompletedLog = logs.filter((l) => l.completed).sort((a, b) => 
      new Date(b.logDate).getTime() - new Date(a.logDate).getTime()
    )[0];

    // Calculate correlations with mood (if enough data)
    const correlations: HabitAnalytics['correlations'] = [];

    if (logs.length >= 14) {
      // Get mood data for correlation
      const moodResult = await query<{ logged_at: Date; happiness_rating: number | null }>(
        `SELECT logged_at, happiness_rating
         FROM mood_logs
         WHERE user_id = $1
         AND logged_at >= $2
         AND logged_at <= $3
         AND mode = 'deep'
         ORDER BY logged_at ASC`,
        [userId, startDate.toISOString(), endDate.toISOString()]
      );

      if (moodResult.rows.length >= 7) {
        // Map logs to dates with completion status
        const habitCompletionsByDate = new Map<string, boolean>();
        logs.forEach((log) => {
          habitCompletionsByDate.set(log.logDate, log.completed);
        });

        // Match mood ratings with habit completions
        const habitCompletions: boolean[] = [];
        const moodScores: number[] = [];

        moodResult.rows.forEach((mood) => {
          const date = new Date(mood.logged_at).toISOString().split('T')[0];
          const completed = habitCompletionsByDate.get(date) || false;

          if (mood.happiness_rating) {
            habitCompletions.push(completed);
            moodScores.push(mood.happiness_rating);
          }
        });

        if (habitCompletions.length >= 7) {
          const correlation = correlateHabitWithMood(
            habitCompletions,
            moodScores,
            habit.habitName
          );

          if (correlation) {
            correlations.push({
              metric: 'Mood',
              correlation: correlation.correlation,
              insight: correlation.insight,
            });
          }
        }
      }
    }

    return {
      completionRate: Math.round(completionRate * 100) / 100,
      currentStreak: streak.currentStreak,
      longestStreak: streak.longestStreak,
      streakStartDate: streak.streakStartDate,
      lastCompleted: lastCompletedLog?.logDate,
      totalCompletions: completedLogs,
      totalDays: totalLogs,
      correlations: correlations.length > 0 ? correlations : undefined,
    };
  }

  /**
   * Map database row to Habit interface
   */
  private mapRowToHabit(row: HabitRow): Habit {
    return {
      id: row.id,
      userId: row.user_id,
      habitName: row.habit_name,
      category: row.category || undefined,
      trackingType: row.tracking_type,
      frequency: row.frequency,
      specificDays: row.specific_days || [],
      description: row.description || undefined,
      targetValue: row.target_value || undefined,
      unit: row.unit || undefined,
      isActive: row.is_active,
      isArchived: row.is_archived,
      reminderEnabled: row.reminder_enabled,
      reminderTime: row.reminder_time || undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  /**
   * Map database row to HabitLog interface
   */
  private mapRowToHabitLog(row: HabitLogRow): HabitLog {
    return {
      id: row.id,
      userId: row.user_id,
      habitId: row.habit_id,
      completed: row.completed,
      value: row.value || undefined,
      note: row.note || undefined,
      logDate: new Date(row.log_date).toISOString().split('T')[0],
      loggedAt: row.logged_at.toISOString(),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}

export const habitService = new HabitService();
export default habitService;

