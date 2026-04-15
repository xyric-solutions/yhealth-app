/**
 * @file Workout Audit Service
 * Handles daily workout progress auditing and missed task detection
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';

// ============================================
// TYPES
// ============================================

export interface WorkoutScheduleTask {
  id: string;
  user_id: string;
  workout_plan_id: string;
  scheduled_date: string | Date;
  workout_data: Record<string, unknown>;
  status: 'pending' | 'completed' | 'skipped' | 'partial' | 'missed';
  intensity: 'light' | 'medium' | 'hard';
  muscle_groups: string[];
  estimated_duration_minutes: number | null;
  original_scheduled_date: string | Date | null;
  reschedule_count: number;
  completed_at: Date | null;
  workout_log_id: string | null;
}

export interface MissedTask {
  taskId: string;
  scheduledDate: string | Date;
  workoutPlanId: string;
  workoutData: Record<string, unknown>;
  intensity: 'light' | 'medium' | 'hard';
  muscleGroups: string[];
  daysMissed: number;
}

// ============================================
// SERVICE
// ============================================

class WorkoutAuditService {
  /**
   * Audit daily progress for a user
   * Checks scheduled tasks for ALL previous days and marks as MISSED if no log exists
   */
  async auditDailyProgress(userId: string, date: Date = new Date()): Promise<{
    tasksChecked: number;
    tasksMarkedMissed: number;
    missedTasks: MissedTask[];
  }> {
    try {
      // Get today's date at midnight (check all days before today)
      const today = new Date(date);
      today.setHours(0, 0, 0, 0);

      // Get all pending tasks scheduled for today or earlier (that haven't been completed)
      // This checks ALL previous days, not just yesterday
      const tasksResult = await query<WorkoutScheduleTask>(
        `SELECT * FROM workout_schedule_tasks
         WHERE user_id = $1
         AND scheduled_date < $2
         AND status = 'pending'
         ORDER BY scheduled_date ASC`,
        [userId, today]
      );

      const tasks = tasksResult.rows;
      let tasksMarkedMissed = 0;
      const missedTasks: MissedTask[] = [];

      for (const task of tasks) {
        // Check if there's a completed workout log for this task
        const logResult = await query<{ id: string }>(
          `SELECT id FROM workout_logs
           WHERE user_id = $1
           AND workout_plan_id = $2
           AND scheduled_date = $3
           AND status IN ('completed', 'partial')`,
          [userId, task.workout_plan_id, task.scheduled_date]
        );

        // If no completed log exists, mark as missed
        if (logResult.rows.length === 0) {
          await this.markTaskAsMissed(task.id);
          tasksMarkedMissed++;

          const daysMissed = Math.floor(
            (date.getTime() - new Date(task.scheduled_date).getTime()) / (1000 * 60 * 60 * 24)
          );

          missedTasks.push({
            taskId: task.id,
            scheduledDate: task.scheduled_date,
            workoutPlanId: task.workout_plan_id,
            workoutData: task.workout_data as Record<string, unknown>,
            intensity: task.intensity,
            muscleGroups: task.muscle_groups,
            daysMissed,
          });
        }
      }

      logger.info('[WorkoutAudit] Daily progress audit completed', {
        userId,
        date: this.formatLocalDate(today),
        tasksChecked: tasks.length,
        tasksMarkedMissed,
      });

      return {
        tasksChecked: tasks.length,
        tasksMarkedMissed,
        missedTasks,
      };
    } catch (error) {
      logger.error('[WorkoutAudit] Failed to audit daily progress', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Detect missed tasks for a plan within a date range
   */
  async detectMissedTasks(
    userId: string,
    planId: string,
    startDate: Date,
    endDate: Date
  ): Promise<MissedTask[]> {
    try {
      const tasksResult = await query<WorkoutScheduleTask>(
        `SELECT * FROM workout_schedule_tasks
         WHERE user_id = $1
         AND workout_plan_id = $2
         AND scheduled_date >= $3
         AND scheduled_date <= $4
         AND status = 'missed'
         ORDER BY scheduled_date ASC`,
        [userId, planId, startDate, endDate]
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return tasksResult.rows.map((task) => {
        const daysMissed = Math.floor(
          (today.getTime() - new Date(task.scheduled_date).getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
          taskId: task.id,
          scheduledDate: task.scheduled_date,
          workoutPlanId: task.workout_plan_id,
          workoutData: task.workout_data as Record<string, unknown>,
          intensity: task.intensity,
          muscleGroups: task.muscle_groups,
          daysMissed,
        };
      });
    } catch (error) {
      logger.error('[WorkoutAudit] Failed to detect missed tasks', {
        userId,
        planId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Mark a task as missed
   */
  async markTaskAsMissed(taskId: string): Promise<void> {
    try {
      await query(
        `UPDATE workout_schedule_tasks
         SET status = 'missed',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         AND status = 'pending'`,
        [taskId]
      );

      logger.debug('[WorkoutAudit] Marked task as missed', { taskId });
    } catch (error) {
      logger.error('[WorkoutAudit] Failed to mark task as missed', {
        taskId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get all missed tasks for a user
   */
  async getMissedTasks(userId: string, workoutPlanId?: string): Promise<MissedTask[]> {
    try {
      let queryText = `SELECT * FROM workout_schedule_tasks
                       WHERE user_id = $1
                       AND status = 'missed'`;
      const params: (string | number | boolean | object | Date | null)[] = [userId];

      if (workoutPlanId) {
        queryText += ' AND workout_plan_id = $2';
        params.push(workoutPlanId);
      }

      queryText += ' ORDER BY scheduled_date ASC';

      const tasksResult = await query<WorkoutScheduleTask>(queryText, params);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return tasksResult.rows.map((task) => {
        const daysMissed = Math.floor(
          (today.getTime() - new Date(task.scheduled_date).getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
          taskId: task.id,
          scheduledDate: task.scheduled_date,
          workoutPlanId: task.workout_plan_id,
          workoutData: task.workout_data as Record<string, unknown>,
          intensity: task.intensity,
          muscleGroups: task.muscle_groups,
          daysMissed,
        };
      });
    } catch (error) {
      logger.error('[WorkoutAudit] Failed to get missed tasks', {
        userId,
        workoutPlanId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update last audit date for a plan
   */
  async updateLastAuditDate(planId: string, date: Date): Promise<void> {
    try {
      await query(
        `UPDATE user_plans
         SET last_audit_date = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [date, planId]
      );
    } catch (error) {
      logger.error('[WorkoutAudit] Failed to update last audit date', {
        planId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Populate workout_schedule_tasks from workout plan
   * Call this when a workout plan is created or activated
   */
  async populateScheduleTasksFromPlan(workoutPlanId: string): Promise<number> {
    try {
      // Get workout plan details
      const planResult = await query<{
        id: string;
        user_id: string;
        start_date: string | Date;
        end_date: string | Date | null;
        weekly_schedule: Record<string, unknown>;
        weeks: Record<string, unknown> | null;
        schedule_days: string[] | null;
      }>(
        `SELECT id, user_id, start_date, end_date, weekly_schedule, weeks, schedule_days
         FROM workout_plans
         WHERE id = $1`,
        [workoutPlanId]
      );

      if (planResult.rows.length === 0) {
        throw new Error('Workout plan not found');
      }

      const plan = planResult.rows[0];
      const startDate = new Date(plan.start_date);
      const endDate = plan.end_date ? new Date(plan.end_date) : new Date(Date.now() + 28 * 24 * 60 * 60 * 1000); // Default 4 weeks

      // Determine schedule days
      const scheduleDays = plan.schedule_days || ['monday', 'wednesday', 'friday'];
      
      // Generate tasks for each scheduled day
      let tasksCreated = 0;
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const dayOfWeek = this.getDayOfWeek(currentDate).toLowerCase();
        
        if (scheduleDays.includes(dayOfWeek)) {
          // Get workout data for this day (from weekly_schedule or weeks structure)
          const workoutData = this.getWorkoutForDay(plan.weekly_schedule, plan.weeks, dayOfWeek, currentDate, startDate);

          if (workoutData) {
            // Determine intensity and muscle groups from workout data
            const intensity = this.determineIntensity(workoutData);
            const muscleGroups = this.extractMuscleGroups(workoutData);

            // Check if task already exists
            const dateStr = this.formatLocalDate(currentDate);

            const existing = await query<{ id: string }>(
              `SELECT id FROM workout_schedule_tasks
               WHERE workout_plan_id = $1 AND scheduled_date = $2`,
              [workoutPlanId, dateStr]
            );

            if (existing.rows.length === 0) {
              await query(
                `INSERT INTO workout_schedule_tasks (
                  user_id, workout_plan_id, scheduled_date, workout_data,
                  intensity, muscle_groups, estimated_duration_minutes, status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
                [
                  plan.user_id,
                  workoutPlanId,
                  dateStr,
                  JSON.stringify(workoutData),
                  intensity,
                  muscleGroups,
                  workoutData.estimatedDuration || 45,
                ]
              );
              tasksCreated++;
            }
          }
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      logger.info('[WorkoutAudit] Populated schedule tasks from plan', {
        workoutPlanId,
        tasksCreated,
      });

      return tasksCreated;
    } catch (error) {
      logger.error('[WorkoutAudit] Failed to populate schedule tasks', {
        workoutPlanId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Helper to get day of week
   */
  private getDayOfWeek(date: Date): string {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  }

  /**
   * Format a Date as local "YYYY-MM-DD" string (avoids UTC shift from .toISOString())
   */
  private formatLocalDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  /**
   * Get workout data for a specific day
   */
  private getWorkoutForDay(
    weeklySchedule: Record<string, unknown>,
    weeks: Record<string, unknown> | null,
    dayOfWeek: string,
    currentDate: Date,
    startDate: Date
  ): Record<string, unknown> | null {
    // Try weeks structure first (new format)
    if (weeks) {
      const weekNumber = Math.floor((currentDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
      const weekKey = `week_${weekNumber}`;
      const weekData = weeks[weekKey] as Record<string, unknown> | undefined;
      if (weekData && weekData.days) {
        const dayData = (weekData.days as Record<string, unknown>)[dayOfWeek];
        if (dayData) {
          return dayData as Record<string, unknown>;
        }
      }
    }

    // Fallback to weekly_schedule (legacy format)
    if (weeklySchedule && weeklySchedule[dayOfWeek]) {
      return weeklySchedule[dayOfWeek] as Record<string, unknown>;
    }

    return null;
  }

  /**
   * Determine workout intensity from workout data
   */
  private determineIntensity(workoutData: Record<string, unknown>): 'light' | 'medium' | 'hard' {
    // Simple heuristic based on exercises and volume
    const exercises = (workoutData.exercises as Array<unknown>) || [];
    const totalVolume = exercises.reduce((sum: number, ex: any) => {
      return sum + ((ex.sets || 0) * (ex.reps || 0));
    }, 0);

    if (totalVolume > 200) return 'hard';
    if (totalVolume > 100) return 'medium';
    return 'light';
  }

  /**
   * Extract muscle groups from workout data
   */
  private extractMuscleGroups(workoutData: Record<string, unknown>): string[] {
    const exercises = (workoutData.exercises as Array<Record<string, unknown>>) || [];
    const muscleGroups = new Set<string>();

    for (const exercise of exercises) {
      if (exercise.exercise) {
        const ex = exercise.exercise as Record<string, unknown>;
        if (ex.primaryMuscleGroup) {
          muscleGroups.add(String(ex.primaryMuscleGroup).toLowerCase());
        }
        if (ex.secondaryMuscleGroups) {
          for (const mg of ex.secondaryMuscleGroups as string[]) {
            muscleGroups.add(mg.toLowerCase());
          }
        }
      }
    }

    return Array.from(muscleGroups);
  }
}

export const workoutAuditService = new WorkoutAuditService();

