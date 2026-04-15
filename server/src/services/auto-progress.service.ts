/**
 * @file Auto-Progress Service
 * @description Calculates goal progress automatically from user data sources
 * (workouts, meals, mood, habits, journal entries) and task completion.
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';

export interface DataSignal {
  label: string;
  value: string;
  source: string;
  icon: string; // lucide icon name
}

export interface AutoProgressResult {
  taskCompletion: { completed: number; total: number; percentage: number };
  dataSignals: DataSignal[];
  calculatedProgress: number; // 0-100
}

interface UserGoalRow {
  id: string;
  pillar: string;
  title: string;
  target_value: number;
  target_unit: string;
  current_value: number;
  start_date: string | null;
  created_at: string;
}

class AutoProgressService {
  /**
   * Calculate auto-progress for an assessment goal (user_goals table)
   */
  async calculateForUserGoal(userId: string, goalId: string): Promise<AutoProgressResult> {
    // Get goal metadata
    const goalResult = await query<UserGoalRow>(
      `SELECT id, pillar, title, target_value, target_unit, current_value, start_date, created_at
       FROM user_goals WHERE id = $1 AND user_id = $2`,
      [goalId, userId]
    );

    if (goalResult.rows.length === 0) {
      return { taskCompletion: { completed: 0, total: 0, percentage: 0 }, dataSignals: [], calculatedProgress: 0 };
    }

    const goal = goalResult.rows[0];
    const sinceDate = goal.start_date || goal.created_at;

    // Get task completion (from goal_action_completions for today)
    const taskResult = await query<{ total: string; completed: string }>(
      `SELECT
        COUNT(ga.id) as total,
        COUNT(gac.id) as completed
       FROM goal_actions ga
       LEFT JOIN goal_action_completions gac
         ON gac.action_id = ga.id AND gac.completion_date = CURRENT_DATE AND gac.user_id = $1
       WHERE ga.user_goal_id = $2`,
      [userId, goalId]
    );

    const total = parseInt(taskResult.rows[0]?.total || '0');
    const completed = parseInt(taskResult.rows[0]?.completed || '0');
    const taskPct = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Get data signals based on pillar
    const signals = await this.getDataSignals(userId, goal.pillar, sinceDate);
    const signalPct = this.calculateSignalPercentage(signals, goal);

    // Calculate weighted progress
    const hasSignals = signals.length > 0;
    const hasTasks = total > 0;

    let calculatedProgress: number;
    if (hasTasks && hasSignals) {
      calculatedProgress = Math.round(taskPct * 0.6 + signalPct * 0.4);
    } else if (hasTasks) {
      calculatedProgress = taskPct;
    } else if (hasSignals) {
      calculatedProgress = signalPct;
    } else {
      // Fallback to existing progress
      const existingPct = goal.target_value > 0
        ? Math.round((goal.current_value / goal.target_value) * 100)
        : 0;
      calculatedProgress = Math.min(100, existingPct);
    }

    return {
      taskCompletion: { completed, total, percentage: taskPct },
      dataSignals: signals,
      calculatedProgress: Math.min(100, calculatedProgress),
    };
  }

  private async getDataSignals(userId: string, pillar: string, sinceDate: string): Promise<DataSignal[]> {
    const signals: DataSignal[] = [];
    const since = new Date(sinceDate).toISOString().split('T')[0];

    try {
      if (pillar === 'fitness') {
        // Workout completions
        const workouts = await query<{ count: string }>(
          `SELECT COUNT(*) as count FROM workout_logs
           WHERE user_id = $1 AND status = 'completed' AND scheduled_date >= $2`,
          [userId, since]
        );
        const wCount = parseInt(workouts.rows[0]?.count || '0');
        if (wCount > 0) {
          signals.push({ label: `${wCount} workouts completed`, value: String(wCount), source: 'workout_logs', icon: 'Dumbbell' });
        }

        // Active days (days with completed activities)
        const activeDays = await query<{ count: string }>(
          `SELECT COUNT(DISTINCT scheduled_date) as count FROM activity_logs
           WHERE user_id = $1 AND status = 'completed' AND scheduled_date >= $2`,
          [userId, since]
        );
        const adCount = parseInt(activeDays.rows[0]?.count || '0');
        if (adCount > 0) {
          signals.push({ label: `${adCount} active days`, value: String(adCount), source: 'activity_logs', icon: 'Activity' });
        }
      }

      if (pillar === 'nutrition') {
        // Meals logged
        const meals = await query<{ count: string }>(
          `SELECT COUNT(*) as count FROM meal_logs
           WHERE user_id = $1 AND eaten_at >= $2`,
          [userId, since]
        );
        const mCount = parseInt(meals.rows[0]?.count || '0');
        if (mCount > 0) {
          signals.push({ label: `${mCount} meals logged`, value: String(mCount), source: 'meal_logs', icon: 'Utensils' });
        }

        // Water tracking days
        const water = await query<{ count: string }>(
          `SELECT COUNT(DISTINCT log_date) as count FROM water_intake_logs
           WHERE user_id = $1 AND log_date >= $2`,
          [userId, since]
        );
        const wdCount = parseInt(water.rows[0]?.count || '0');
        if (wdCount > 0) {
          signals.push({ label: `${wdCount} days water tracked`, value: String(wdCount), source: 'water_intake_logs', icon: 'Droplets' });
        }
      }

      if (pillar === 'wellbeing') {
        // Mood entries
        const moods = await query<{ count: string }>(
          `SELECT COUNT(*) as count FROM mood_logs
           WHERE user_id = $1 AND logged_at >= $2`,
          [userId, since]
        );
        const moCount = parseInt(moods.rows[0]?.count || '0');
        if (moCount > 0) {
          signals.push({ label: `${moCount} mood entries`, value: String(moCount), source: 'mood_logs', icon: 'Smile' });
        }

        // Journal entries
        const journals = await query<{ count: string }>(
          `SELECT COUNT(*) as count FROM journal_entries
           WHERE user_id = $1 AND created_at >= $2`,
          [userId, since]
        );
        const jCount = parseInt(journals.rows[0]?.count || '0');
        if (jCount > 0) {
          signals.push({ label: `${jCount} journal entries`, value: String(jCount), source: 'journal_entries', icon: 'BookOpen' });
        }
      }

      // Habit completions (all pillars)
      const habits = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM habit_logs
         WHERE user_id = $1 AND completed = true AND log_date >= $2`,
        [userId, since]
      );
      const hCount = parseInt(habits.rows[0]?.count || '0');
      if (hCount > 0) {
        signals.push({ label: `${hCount} habits completed`, value: String(hCount), source: 'habit_logs', icon: 'CheckCircle2' });
      }
    } catch (error) {
      logger.warn('[AutoProgress] Error fetching data signals', {
        userId: userId.slice(0, 8),
        pillar,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }

    return signals;
  }

  private calculateSignalPercentage(signals: DataSignal[], goal: UserGoalRow): number {
    if (signals.length === 0) return 0;

    // Calculate days since start
    const startDate = new Date(goal.start_date || goal.created_at);
    const daysSinceStart = Math.max(1, Math.ceil((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const weeksElapsed = Math.max(1, Math.ceil(daysSinceStart / 7));

    // Define reasonable weekly targets per pillar
    const weeklyTargets: Record<string, number> = {
      fitness: 4,    // 4 workouts per week
      nutrition: 21, // 3 meals per day * 7
      wellbeing: 5,  // 5 mood/journal entries per week
    };

    const target = (weeklyTargets[goal.pillar] || 5) * weeksElapsed;
    const totalSignalValue = signals.reduce((sum, s) => sum + parseInt(s.value || '0'), 0);

    return Math.min(100, Math.round((totalSignalValue / target) * 100));
  }
}

export const autoProgressService = new AutoProgressService();
