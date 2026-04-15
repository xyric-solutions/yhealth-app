/**
 * @file Workout Slot Calculator Service
 * Pure code function to compute valid slots for rescheduling
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import type { UserConstraints } from './workout-constraint.service.js';
import type { MissedTask } from './workout-audit.service.js';

// ============================================
// TYPES
// ============================================

export interface ValidSlot {
  date: Date;
  available: boolean;
  reason?: string;
  existingTasks: Array<{
    taskId: string;
    intensity: string;
    muscleGroups: string[];
  }>;
}

export interface WorkoutPlan {
  id: string;
  userId: string;
  startDate: Date;
  endDate: Date;
}

// ============================================
// SERVICE
// ============================================

class WorkoutSlotCalculatorService {
  /**
   * Compute valid slots for rescheduling missed tasks
   * Pure code function - no LLM involved
   */
  async computeValidSlots(
    plan: WorkoutPlan,
    constraints: UserConstraints,
    _missedTasks: MissedTask[],
    lookaheadDays: number = 14
  ): Promise<ValidSlot[]> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + lookaheadDays);

      // Get existing scheduled tasks in the lookahead period
      const existingTasksResult = await query<{
        id: string;
        scheduled_date: Date;
        intensity: string;
        muscle_groups: string[];
      }>(
        `SELECT id, scheduled_date, intensity, muscle_groups
         FROM workout_schedule_tasks
         WHERE user_id = $1
         AND workout_plan_id = $2
         AND scheduled_date >= $3
         AND scheduled_date <= $4
         AND status IN ('pending', 'completed', 'partial')
         ORDER BY scheduled_date ASC`,
        [plan.userId, plan.id, today, endDate]
      );

      const existingTasks = existingTasksResult.rows.map((t) => ({
        taskId: t.id,
        date: t.scheduled_date,
        intensity: t.intensity,
        muscleGroups: t.muscle_groups,
      }));

      // Group existing tasks by date
      const tasksByDate = new Map<string, typeof existingTasks>();
      for (const task of existingTasks) {
        const dateKey = task.date.toISOString().split('T')[0];
        if (!tasksByDate.has(dateKey)) {
          tasksByDate.set(dateKey, []);
        }
        tasksByDate.get(dateKey)!.push(task);
      }

      // Generate slots for each day in lookahead period
      const slots: ValidSlot[] = [];
      const currentDate = new Date(today);

      while (currentDate <= endDate) {
        const dateKey = currentDate.toISOString().split('T')[0];
        const dayOfWeek = this.getDayOfWeek(currentDate).toLowerCase();
        const existingTasksForDate = tasksByDate.get(dateKey) || [];

        // Check if day is available
        const isAvailableDay = constraints.availableDays.includes(dayOfWeek);
        const isRestDay = constraints.restDays.includes(dayOfWeek);

        // Check daily limits
        const sessionsToday = existingTasksForDate.length;
        const hardSessionsToday = existingTasksForDate.filter((t) => t.intensity === 'hard').length;

        let available = true;
        const reasons: string[] = [];

        if (!isAvailableDay) {
          available = false;
          reasons.push(`Not an available day (${dayOfWeek})`);
        }

        if (isRestDay) {
          available = false;
          reasons.push(`Rest day (${dayOfWeek})`);
        }

        if (sessionsToday >= constraints.maxSessionsPerDay) {
          available = false;
          reasons.push(`Max sessions per day reached (${sessionsToday}/${constraints.maxSessionsPerDay})`);
        }

        if (hardSessionsToday >= 1) {
          available = false;
          reasons.push(`Already has hard session today`);
        }

        // Check weekly limits
        const sessionsThisWeek = this.countSessionsInWeek(
          existingTasks,
          currentDate,
          constraints
        );
        if (sessionsThisWeek >= constraints.maxSessionsPerWeek) {
          available = false;
          reasons.push(`Max sessions per week reached (${sessionsThisWeek}/${constraints.maxSessionsPerWeek})`);
        }

        // Check 48h recovery for heavy leg workouts
        const hasHeavyLegRecently = this.hasHeavyLegWithinHours(
          existingTasks,
          currentDate,
          constraints.minRestHoursAfterHeavyLeg
        );
        if (hasHeavyLegRecently) {
          // Only block if we're trying to schedule another heavy leg
          // This will be checked more specifically during validation
        }

        slots.push({
          date: new Date(currentDate),
          available,
          reason: reasons.length > 0 ? reasons.join('; ') : undefined,
          existingTasks: existingTasksForDate,
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      logger.debug('[WorkoutSlotCalculator] Computed valid slots', {
        planId: plan.id,
        lookaheadDays,
        totalSlots: slots.length,
        availableSlots: slots.filter((s) => s.available).length,
      });

      return slots;
    } catch (error) {
      logger.error('[WorkoutSlotCalculator] Failed to compute valid slots', {
        planId: plan.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
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
   * Count sessions in the week containing the given date
   */
  private countSessionsInWeek(
    existingTasks: Array<{ date: Date }>,
    date: Date,
    _constraints: UserConstraints
  ): number {
    const weekKey = this.getWeekKey(date);
    return existingTasks.filter((t) => this.getWeekKey(t.date) === weekKey).length;
  }

  /**
   * Check if there's a heavy leg workout within specified hours
   */
  private hasHeavyLegWithinHours(
    existingTasks: Array<{ date: Date; intensity: string; muscleGroups: string[] }>,
    date: Date,
    hours: number
  ): boolean {
    const dateTime = date.getTime();
    return existingTasks.some((task) => {
      if (task.intensity === 'hard' && task.muscleGroups.includes('legs')) {
        const taskTime = task.date.getTime();
        const hoursDiff = Math.abs(dateTime - taskTime) / (1000 * 60 * 60);
        return hoursDiff < hours;
      }
      return false;
    });
  }
}

export const workoutSlotCalculatorService = new WorkoutSlotCalculatorService();

