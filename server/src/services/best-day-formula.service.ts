/**
 * @file Best Day Formula Service
 * @description Calculates how well a user is matching their personal "best day" formula
 * derived from their highest-rated days. Provides achievement score and streak tracking.
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import { healthCorrelationService } from './wellbeing/health-correlation.service.js';

// ============================================
// TYPES
// ============================================

export interface BestDayFormula {
  avgSleep: number | null;
  exerciseRate: number | null;
  avgStress: number | null;
  dataPoints: number;
  confidence: 'high' | 'medium' | 'low';
  criteria: Array<{
    label: string;
    threshold: string;
    met: boolean;
  }>;
}

export interface FormulaProgress {
  achievementScore: number; // 0-100
  formula: BestDayFormula;
  streak: number; // consecutive days >= 80% achievement
  todayMetrics: {
    sleepHours: number | null;
    exercised: boolean;
    stressLevel: number | null;
  };
}

// ============================================
// SERVICE
// ============================================

class BestDayFormulaService {
  /**
   * Get the user's best day formula from correlations.
   */
  async getFormula(userId: string): Promise<BestDayFormula> {
    const correlations = await healthCorrelationService.getActiveCorrelations(userId);

    const bestDayPattern = (correlations as Array<{
      pattern_type?: string;
      evidence?: Record<string, unknown>;
      correlation_strength?: number;
      data_points?: number;
      confidence?: string;
    }>).find((c) => c.pattern_type === 'best_day_profile');

    if (!bestDayPattern || !bestDayPattern.evidence) {
      return {
        avgSleep: null,
        exerciseRate: null,
        avgStress: null,
        dataPoints: 0,
        confidence: 'low',
        criteria: [],
      };
    }

    const evidence = bestDayPattern.evidence;
    const avgSleep = (evidence.avg_sleep as number) ?? null;
    const exerciseRate = (evidence.pct_exercise as number) ?? null;
    const avgStress = (evidence.avg_stress as number) ?? null;

    const criteria: BestDayFormula['criteria'] = [];
    if (avgSleep !== null) {
      criteria.push({ label: 'Sleep', threshold: `≥ ${avgSleep.toFixed(1)}h`, met: false });
    }
    if (exerciseRate !== null && exerciseRate > 50) {
      criteria.push({ label: 'Exercise', threshold: 'Workout completed', met: false });
    }
    if (avgStress !== null) {
      criteria.push({ label: 'Stress', threshold: `≤ ${Math.ceil(avgStress)}/10`, met: false });
    }

    return {
      avgSleep,
      exerciseRate,
      avgStress,
      dataPoints: (bestDayPattern.data_points as number) || 0,
      confidence: (bestDayPattern.confidence as 'high' | 'medium' | 'low') || 'low',
      criteria,
    };
  }

  /**
   * Calculate today's formula achievement score (0-100).
   */
  async getFormulaAchievementScore(userId: string, date?: string): Promise<FormulaProgress> {
    const formula = await this.getFormula(userId);
    const dateStr = date || new Date().toISOString().split('T')[0];

    // Get today's actual metrics
    const [sleepResult, workoutResult, checkinResult] = await Promise.all([
      query<{ sleep_hours: number | null }>(
        `SELECT sleep_hours FROM daily_health_metrics
         WHERE user_id = $1 AND metric_date = $2::date`,
        [userId, dateStr]
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM workout_logs
         WHERE user_id = $1 AND scheduled_date = $2::date AND status = 'completed'`,
        [userId, dateStr]
      ),
      query<{ stress_score: number | null }>(
        `SELECT stress_score FROM daily_checkins
         WHERE user_id = $1 AND checkin_date = $2::date AND checkin_type = 'morning'
         ORDER BY created_at DESC LIMIT 1`,
        [userId, dateStr]
      ),
    ]);

    const sleepHours = sleepResult.rows[0]?.sleep_hours ?? null;
    const exercised = parseInt(workoutResult.rows[0]?.count || '0', 10) > 0;
    const stressLevel = checkinResult.rows[0]?.stress_score ?? null;

    // Score each criterion
    let totalCriteria = 0;
    let metCriteria = 0;

    if (formula.avgSleep !== null) {
      totalCriteria++;
      if (sleepHours !== null && sleepHours >= formula.avgSleep * 0.9) {
        metCriteria++;
        if (formula.criteria.length > 0) formula.criteria[0].met = true;
      }
    }

    if (formula.exerciseRate !== null && formula.exerciseRate > 50) {
      totalCriteria++;
      if (exercised) {
        metCriteria++;
        const exIdx = formula.criteria.findIndex((c) => c.label === 'Exercise');
        if (exIdx >= 0) formula.criteria[exIdx].met = true;
      }
    }

    if (formula.avgStress !== null) {
      totalCriteria++;
      if (stressLevel !== null && stressLevel <= Math.ceil(formula.avgStress)) {
        metCriteria++;
        const stIdx = formula.criteria.findIndex((c) => c.label === 'Stress');
        if (stIdx >= 0) formula.criteria[stIdx].met = true;
      }
    }

    const achievementScore = totalCriteria > 0 ? Math.round((metCriteria / totalCriteria) * 100) : 0;

    // Calculate streak
    const streak = await this.getFormulaStreak(userId);

    return {
      achievementScore,
      formula,
      streak,
      todayMetrics: { sleepHours, exercised, stressLevel },
    };
  }

  /**
   * Get consecutive days where formula achievement was >= 80%.
   */
  async getFormulaStreak(userId: string): Promise<number> {
    try {
      // We check the last 30 days of daily_analysis_reports snapshots
      const result = await query<{
        report_date: string;
        snapshot: Record<string, unknown>;
      }>(
        `SELECT report_date, snapshot FROM daily_analysis_reports
         WHERE user_id = $1
         ORDER BY report_date DESC
         LIMIT 30`,
        [userId]
      );

      if (result.rows.length === 0) return 0;

      const formula = await this.getFormula(userId);
      if (formula.criteria.length === 0) return 0;

      let streak = 0;
      for (const row of result.rows) {
        const snap = typeof row.snapshot === 'string' ? JSON.parse(row.snapshot) : row.snapshot;
        let totalCriteria = 0;
        let met = 0;

        if (formula.avgSleep !== null) {
          totalCriteria++;
          if ((snap.sleepHours as number) >= formula.avgSleep * 0.9) met++;
        }
        if (formula.exerciseRate !== null && formula.exerciseRate > 50) {
          totalCriteria++;
          if ((snap.workoutsCompleted as number) > 0) met++;
        }
        if (formula.avgStress !== null) {
          totalCriteria++;
          if ((snap.stressLevel as number) <= Math.ceil(formula.avgStress)) met++;
        }

        const pct = totalCriteria > 0 ? (met / totalCriteria) * 100 : 0;
        if (pct >= 80) {
          streak++;
        } else {
          break;
        }
      }

      return streak;
    } catch (error) {
      logger.error('[BestDayFormula] Error calculating streak', {
        userId: userId.slice(0, 8),
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return 0;
    }
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const bestDayFormulaService = new BestDayFormulaService();
export default bestDayFormulaService;
