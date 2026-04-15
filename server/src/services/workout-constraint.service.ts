/**
 * @file Workout Constraint Service
 * Handles user workout constraints and validates reschedule proposals
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';

// ============================================
// TYPES
// ============================================

export interface UserConstraints {
  userId: string;
  maxSessionsPerWeek: number;
  maxHardSessionsPerWeek: number;
  maxSessionsPerDay: number;
  availableDays: string[]; // day_of_week enum values
  restDays: string[];
  minRestHoursBetweenSessions: number;
  minRestHoursAfterHeavyLeg: number;
  preferredWorkoutTimes: Record<string, string[]>; // { "monday": ["09:00", "18:00"], ... }
  muscleGroupRecoveryHours: Record<string, number>; // { "legs": 48, "chest": 24, ... }
  avoidConsecutiveDays: boolean;
  maxWeeklyVolume?: number;
}

export interface RescheduleAction {
  action: 'move' | 'drop' | 'compress';
  taskId: string;
  oldDate: Date;
  newDate?: Date;
  reason: string;
}

export interface RescheduleProposal {
  actions: RescheduleAction[];
  policy: 'SLIDE_FORWARD' | 'FILL_GAPS' | 'DROP_OR_COMPRESS';
}

export interface ValidationError {
  type: string;
  message: string;
  action?: RescheduleAction;
}

// ============================================
// SERVICE
// ============================================

class WorkoutConstraintService {
  /**
   * Get user constraints (with defaults if not set)
   */
  async getUserConstraints(userId: string): Promise<UserConstraints> {
    try {
      const result = await query<{
        user_id: string;
        max_sessions_per_week: number;
        max_hard_sessions_per_week: number;
        max_sessions_per_day: number;
        available_days: string[];
        rest_days: string[];
        min_rest_hours_between_sessions: number;
        min_rest_hours_after_heavy_leg: number;
        preferred_workout_times: Record<string, string[]>;
        muscle_group_recovery_hours: Record<string, number>;
        avoid_consecutive_days: boolean;
        max_weekly_volume: number | null;
      }>(
        `SELECT * FROM user_workout_constraints WHERE user_id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        // Return defaults
        return this.getDefaultConstraints(userId);
      }

      const row = result.rows[0];
      return {
        userId: row.user_id,
        maxSessionsPerWeek: row.max_sessions_per_week,
        maxHardSessionsPerWeek: row.max_hard_sessions_per_week,
        maxSessionsPerDay: row.max_sessions_per_day,
        availableDays: row.available_days,
        restDays: row.rest_days,
        minRestHoursBetweenSessions: row.min_rest_hours_between_sessions,
        minRestHoursAfterHeavyLeg: row.min_rest_hours_after_heavy_leg,
        preferredWorkoutTimes: row.preferred_workout_times || {},
        muscleGroupRecoveryHours: row.muscle_group_recovery_hours || {
          legs: 48,
          chest: 24,
          back: 24,
          shoulders: 24,
          arms: 24,
        },
        avoidConsecutiveDays: row.avoid_consecutive_days,
        maxWeeklyVolume: row.max_weekly_volume || undefined,
      };
    } catch (error) {
      logger.error('[WorkoutConstraint] Failed to get user constraints', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Return defaults on error
      return this.getDefaultConstraints(userId);
    }
  }

  /**
   * Get default constraints
   */
  private getDefaultConstraints(userId: string): UserConstraints {
    return {
      userId,
      maxSessionsPerWeek: 5,
      maxHardSessionsPerWeek: 2,
      maxSessionsPerDay: 1,
      availableDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      restDays: ['sunday'],
      minRestHoursBetweenSessions: 24,
      minRestHoursAfterHeavyLeg: 48,
      preferredWorkoutTimes: {},
      muscleGroupRecoveryHours: {
        legs: 48,
        chest: 24,
        back: 24,
        shoulders: 24,
        arms: 24,
      },
      avoidConsecutiveDays: false,
    };
  }

  /**
   * Validate reschedule proposal against constraints
   * Returns array of validation errors (empty if valid)
   */
  async validateConstraints(
    proposal: RescheduleProposal,
    constraints: UserConstraints,
    existingTasks: Array<{ date: Date; intensity: string; muscleGroups: string[] }>,
    validSlots: Array<{ date: Date; available: boolean; reason?: string }>,
    taskData?: Map<string, { intensity: string; muscleGroups: string[] }>
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Group actions by new date to check daily limits
    const actionsByDate = new Map<string, RescheduleAction[]>();
    const hardSessionsByDate = new Map<string, number>();
    const sessionsByWeek = new Map<string, number>();
    const hardSessionsByWeek = new Map<string, number>();

    for (const action of proposal.actions) {
      if (action.action === 'move' && action.newDate) {
        const dateKey = action.newDate.toISOString().split('T')[0];
        const weekKey = this.getWeekKey(action.newDate);

        // Check if date is in valid slots
        const isValidSlot = validSlots.some(
          (slot) => slot.date.toISOString().split('T')[0] === dateKey && slot.available
        );
        if (!isValidSlot) {
          errors.push({
            type: 'invalid_slot',
            message: `Date ${dateKey} is not a valid slot`,
            action,
          });
          continue;
        }

        // Check available days
        const dayOfWeek = this.getDayOfWeek(action.newDate);
        if (!constraints.availableDays.includes(dayOfWeek.toLowerCase())) {
          errors.push({
            type: 'unavailable_day',
            message: `${dayOfWeek} is not an available day`,
            action,
          });
        }

        // Check rest days
        if (constraints.restDays.includes(dayOfWeek.toLowerCase())) {
          errors.push({
            type: 'rest_day',
            message: `${dayOfWeek} is a rest day`,
            action,
          });
        }

        // Count sessions per day
        if (!actionsByDate.has(dateKey)) {
          actionsByDate.set(dateKey, []);
        }
        actionsByDate.get(dateKey)!.push(action);

        // Count sessions per week
        if (!sessionsByWeek.has(weekKey)) {
          sessionsByWeek.set(weekKey, 0);
        }
        sessionsByWeek.set(weekKey, sessionsByWeek.get(weekKey)! + 1);

        // Check intensity for hard session limits
        const task = taskData ? taskData.get(action.taskId) : null;
        if (task && task.intensity === 'hard') {
          if (!hardSessionsByDate.has(dateKey)) {
            hardSessionsByDate.set(dateKey, 0);
          }
          hardSessionsByDate.set(dateKey, hardSessionsByDate.get(dateKey)! + 1);

          if (!hardSessionsByWeek.has(weekKey)) {
            hardSessionsByWeek.set(weekKey, 0);
          }
          hardSessionsByWeek.set(weekKey, hardSessionsByWeek.get(weekKey)! + 1);
        }
      }
    }

    // Check max sessions per day
    for (const [dateKey, actions] of actionsByDate.entries()) {
      const existingCount = existingTasks.filter(
        (t) => t.date.toISOString().split('T')[0] === dateKey
      ).length;
      const totalCount = existingCount + actions.length;

      if (totalCount > constraints.maxSessionsPerDay) {
        errors.push({
          type: 'max_sessions_per_day',
          message: `Date ${dateKey} exceeds max sessions per day (${constraints.maxSessionsPerDay})`,
        });
      }
    }

    // Check max hard sessions per day
    for (const [dateKey, count] of hardSessionsByDate.entries()) {
      if (count > 1) {
        errors.push({
          type: 'max_hard_sessions_per_day',
          message: `Date ${dateKey} has more than 1 hard session`,
        });
      }
    }

    // Check max sessions per week
    for (const [weekKey, count] of sessionsByWeek.entries()) {
      if (count > constraints.maxSessionsPerWeek) {
        errors.push({
          type: 'max_sessions_per_week',
          message: `Week ${weekKey} exceeds max sessions per week (${constraints.maxSessionsPerWeek})`,
        });
      }
    }

    // Check max hard sessions per week
    for (const [weekKey, count] of hardSessionsByWeek.entries()) {
      if (count > constraints.maxHardSessionsPerWeek) {
        errors.push({
          type: 'max_hard_sessions_per_week',
          message: `Week ${weekKey} exceeds max hard sessions per week (${constraints.maxHardSessionsPerWeek})`,
        });
      }
    }

    // Check 48h recovery after heavy leg
    for (const action of proposal.actions) {
      if (action.action === 'move' && action.newDate) {
        const task = taskData ? taskData.get(action.taskId) : null;
        if (task && task.muscleGroups.includes('legs') && task.intensity === 'hard') {
          // Check if there's another heavy leg within 48h
          const actionTime = action.newDate.getTime();
          for (const existingTask of existingTasks) {
            if (
              existingTask.muscleGroups.includes('legs') &&
              existingTask.intensity === 'hard'
            ) {
              const existingTime = existingTask.date.getTime();
              const hoursDiff = Math.abs(actionTime - existingTime) / (1000 * 60 * 60);
              if (hoursDiff < constraints.minRestHoursAfterHeavyLeg) {
                errors.push({
                  type: 'insufficient_recovery_heavy_leg',
                  message: `Heavy leg workout too close to another heavy leg (${Math.round(hoursDiff)}h < ${constraints.minRestHoursAfterHeavyLeg}h)`,
                  action,
                });
              }
            }
          }
        }
      }
    }

    // Check consecutive days if enabled
    if (constraints.avoidConsecutiveDays) {
      const allDates = new Set<string>();
      for (const action of proposal.actions) {
        if (action.action === 'move' && action.newDate) {
          allDates.add(action.newDate.toISOString().split('T')[0]);
        }
      }
      for (const existingTask of existingTasks) {
        allDates.add(existingTask.date.toISOString().split('T')[0]);
      }

      const sortedDates = Array.from(allDates)
        .map((d) => new Date(d))
        .sort((a, b) => a.getTime() - b.getTime());

      for (let i = 1; i < sortedDates.length; i++) {
        const daysDiff =
          (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff === 1) {
          errors.push({
            type: 'consecutive_days',
            message: `Consecutive workout days detected (${sortedDates[i - 1].toISOString().split('T')[0]} and ${sortedDates[i].toISOString().split('T')[0]})`,
          });
        }
      }
    }

    return errors;
  }

  /**
   * Helper to get day of week string
   */
  private getDayOfWeek(date: Date): string {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  }

  /**
   * Helper to get week key (YYYY-WW format)
   */
  private getWeekKey(date: Date): string {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `${d.getFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
  }


  /**
   * Update user constraints
   */
  async updateUserConstraints(
    userId: string,
    updates: Partial<UserConstraints>
  ): Promise<UserConstraints> {
    try {
      // Check if constraints exist
      const existing = await query(
        `SELECT user_id FROM user_workout_constraints WHERE user_id = $1`,
        [userId]
      );

      if (existing.rows.length === 0) {
        // Insert new constraints
        await query(
          `INSERT INTO user_workout_constraints (
            user_id, max_sessions_per_week, max_hard_sessions_per_week, max_sessions_per_day,
            available_days, rest_days, min_rest_hours_between_sessions, min_rest_hours_after_heavy_leg,
            preferred_workout_times, muscle_group_recovery_hours, avoid_consecutive_days, max_weekly_volume
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            userId,
            updates.maxSessionsPerWeek ?? 5,
            updates.maxHardSessionsPerWeek ?? 2,
            updates.maxSessionsPerDay ?? 1,
            updates.availableDays ?? ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
            updates.restDays ?? ['sunday'],
            updates.minRestHoursBetweenSessions ?? 24,
            updates.minRestHoursAfterHeavyLeg ?? 48,
            JSON.stringify(updates.preferredWorkoutTimes ?? {}),
            JSON.stringify(updates.muscleGroupRecoveryHours ?? { legs: 48, chest: 24, back: 24, shoulders: 24, arms: 24 }),
            updates.avoidConsecutiveDays ?? false,
            updates.maxWeeklyVolume ?? null,
          ]
        );
      } else {
        // Update existing constraints
        const setClauses: string[] = [];
        const values: (string | number | boolean | object | Date | null)[] = [];
        let paramIndex = 1;

        if (updates.maxSessionsPerWeek !== undefined) {
          setClauses.push(`max_sessions_per_week = $${paramIndex++}`);
          values.push(updates.maxSessionsPerWeek);
        }
        if (updates.maxHardSessionsPerWeek !== undefined) {
          setClauses.push(`max_hard_sessions_per_week = $${paramIndex++}`);
          values.push(updates.maxHardSessionsPerWeek);
        }
        if (updates.availableDays !== undefined) {
          setClauses.push(`available_days = $${paramIndex++}`);
          values.push(updates.availableDays);
        }
        if (updates.restDays !== undefined) {
          setClauses.push(`rest_days = $${paramIndex++}`);
          values.push(updates.restDays);
        }
        // Add more fields as needed...

        if (setClauses.length > 0) {
          values.push(userId);
          await query(
            `UPDATE user_workout_constraints 
             SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $${paramIndex}`,
            values
          );
        }
      }

      return await this.getUserConstraints(userId);
    } catch (error) {
      logger.error('[WorkoutConstraint] Failed to update user constraints', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}

export const workoutConstraintService = new WorkoutConstraintService();

