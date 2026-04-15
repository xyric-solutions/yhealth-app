/**
 * @file Health Correlation Service
 * @description Cross-pillar health-performance correlation detection
 * 6 detectors: sleep-mood, exercise-gratitude, best-day, sleep-energy, recovery-mood, stress-exercise
 * Pure SQL-based — no LLM needed
 */

import { query } from '../../database/pg.js';
import { logger } from '../logger.service.js';

// ============================================
// TYPES
// ============================================

interface CorrelationResult {
  patternType: string;
  headline: string;
  insight: string;
  correlationStrength: number; // -1 to 1
  dataPoints: number;
  confidence: 'high' | 'medium' | 'low';
  evidence: Record<string, unknown>;
}

const MIN_DATA_POINTS = 7;

// ============================================
// SERVICE
// ============================================

class HealthCorrelationService {
  /**
   * Run all correlation detectors for a user
   */
  async detectAllCorrelations(userId: string, windowDays: number = 30): Promise<CorrelationResult[]> {
    const results: CorrelationResult[] = [];

    const detectors = [
      this.detectSleepMoodNegative,
      this.detectExerciseGratitude,
      this.detectBestDayProfile,
      this.detectSleepEnergyCorrelation,
      this.detectRecoveryMoodCorrelation,
      this.detectStressExerciseInverse,
    ];

    for (const detector of detectors) {
      try {
        const result = await detector.call(this, userId, windowDays);
        if (result) results.push(result);
      } catch (error) {
        logger.error('[HealthCorrelation] Detector failed', { error, detector: detector.name });
      }
    }

    // Persist results to journal_patterns
    for (const result of results) {
      await this.upsertPattern(userId, result, windowDays);
    }

    return results;
  }

  /**
   * Get active correlations for a user
   */
  async getActiveCorrelations(userId: string): Promise<unknown[]> {
    const result = await query(
      `SELECT * FROM journal_patterns
       WHERE user_id = $1 AND is_active = true AND category = 'correlation'
       ORDER BY correlation_strength DESC NULLS LAST`,
      [userId]
    );
    return result.rows.map(this.mapPatternRow);
  }

  /**
   * Dismiss a correlation insight
   */
  async dismissCorrelation(userId: string, patternId: string): Promise<void> {
    await query(
      `UPDATE journal_patterns SET is_active = false, dismissed_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [patternId, userId]
    );
  }

  // ============================================
  // DETECTORS
  // ============================================

  /**
   * Detector 1: Sleep-Mood Negative
   * "When you sleep <6h, mood is X% more negative"
   */
  private async detectSleepMoodNegative(userId: string, windowDays: number): Promise<CorrelationResult | null> {
    const result = await query<{
      low_sleep_avg_mood: number;
      normal_sleep_avg_mood: number;
      low_sleep_count: number;
      normal_sleep_count: number;
    }>(`
      WITH sleep_data AS (
        SELECT
          dhm.metric_date,
          dhm.sleep_hours,
          AVG(ml.happiness_rating) AS avg_mood
        FROM daily_health_metrics dhm
        JOIN mood_logs ml ON ml.user_id = dhm.user_id
          AND DATE(ml.logged_at) = dhm.metric_date
        WHERE dhm.user_id = $1
          AND dhm.metric_date >= CURRENT_DATE - $2::int
          AND dhm.sleep_hours IS NOT NULL
          AND ml.happiness_rating IS NOT NULL
        GROUP BY dhm.metric_date, dhm.sleep_hours
      )
      SELECT
        AVG(CASE WHEN sleep_hours < 6 THEN avg_mood END) AS low_sleep_avg_mood,
        AVG(CASE WHEN sleep_hours >= 6 THEN avg_mood END) AS normal_sleep_avg_mood,
        COUNT(CASE WHEN sleep_hours < 6 THEN 1 END)::int AS low_sleep_count,
        COUNT(CASE WHEN sleep_hours >= 6 THEN 1 END)::int AS normal_sleep_count
      FROM sleep_data
    `, [userId, windowDays]);

    const row = result.rows[0];
    if (!row || (row.low_sleep_count + row.normal_sleep_count) < MIN_DATA_POINTS) return null;
    if (!row.low_sleep_avg_mood || !row.normal_sleep_avg_mood) return null;

    const diff = row.normal_sleep_avg_mood - row.low_sleep_avg_mood;
    const pctDiff = Math.round((diff / row.normal_sleep_avg_mood) * 100);

    if (pctDiff < 10) return null; // Not significant

    return {
      patternType: 'sleep_mood_negative',
      headline: 'Sleep affects your mood',
      insight: `When you sleep less than 6 hours, your mood is ${pctDiff}% lower on average.`,
      correlationStrength: Math.min(diff / 5, 1),
      dataPoints: row.low_sleep_count + row.normal_sleep_count,
      confidence: pctDiff >= 25 ? 'high' : pctDiff >= 15 ? 'medium' : 'low',
      evidence: {
        lowSleepAvgMood: Number(row.low_sleep_avg_mood.toFixed(1)),
        normalSleepAvgMood: Number(row.normal_sleep_avg_mood.toFixed(1)),
        lowSleepDays: row.low_sleep_count,
        normalSleepDays: row.normal_sleep_count,
      },
    };
  }

  /**
   * Detector 2: Exercise-Gratitude
   * "After exercise, journal sentiment is X more positive"
   */
  private async detectExerciseGratitude(userId: string, windowDays: number): Promise<CorrelationResult | null> {
    const result = await query<{
      exercise_day_sentiment: number;
      no_exercise_sentiment: number;
      exercise_days: number;
      no_exercise_days: number;
    }>(`
      WITH day_data AS (
        SELECT
          d.entry_date,
          d.avg_sentiment,
          EXISTS(
            SELECT 1 FROM workout_logs wl
            WHERE wl.user_id = $1
              AND wl.scheduled_date = d.entry_date
              AND wl.status = 'completed'
          ) AS had_exercise
        FROM (
          SELECT
            je.logged_at::date AS entry_date,
            AVG(je.sentiment_score) AS avg_sentiment
          FROM journal_entries je
          WHERE je.user_id = $1
            AND je.logged_at >= CURRENT_DATE - $2::int
            AND je.sentiment_score IS NOT NULL
          GROUP BY je.logged_at::date
        ) d
      )
      SELECT
        AVG(CASE WHEN had_exercise THEN avg_sentiment END) AS exercise_day_sentiment,
        AVG(CASE WHEN NOT had_exercise THEN avg_sentiment END) AS no_exercise_sentiment,
        COUNT(CASE WHEN had_exercise THEN 1 END)::int AS exercise_days,
        COUNT(CASE WHEN NOT had_exercise THEN 1 END)::int AS no_exercise_days
      FROM day_data
    `, [userId, windowDays]);

    const row = result.rows[0];
    if (!row || (row.exercise_days + row.no_exercise_days) < MIN_DATA_POINTS) return null;
    if (row.exercise_day_sentiment === null || row.no_exercise_sentiment === null) return null;

    const diff = row.exercise_day_sentiment - row.no_exercise_sentiment;
    if (diff <= 0.05) return null;

    const multiplier = row.no_exercise_sentiment !== 0
      ? (row.exercise_day_sentiment / Math.abs(row.no_exercise_sentiment)).toFixed(1)
      : 'significantly';

    return {
      patternType: 'exercise_gratitude',
      headline: 'Exercise boosts your positivity',
      insight: `After exercise, your journal sentiment is ${multiplier}x more positive.`,
      correlationStrength: Math.min(diff, 1),
      dataPoints: row.exercise_days + row.no_exercise_days,
      confidence: diff >= 0.3 ? 'high' : diff >= 0.15 ? 'medium' : 'low',
      evidence: {
        exerciseDaySentiment: Number(row.exercise_day_sentiment.toFixed(2)),
        noExerciseSentiment: Number(row.no_exercise_sentiment.toFixed(2)),
        exerciseDays: row.exercise_days,
        noExerciseDays: row.no_exercise_days,
      },
    };
  }

  /**
   * Detector 3: Best Day Profile
   * "Your best days share: 7+ hours sleep, workout, low stress"
   */
  private async detectBestDayProfile(userId: string, windowDays: number): Promise<CorrelationResult | null> {
    const result = await query<{
      avg_sleep: number;
      pct_exercise: number;
      avg_stress: number;
      best_day_count: number;
    }>(`
      WITH rated_days AS (
        SELECT
          dc.checkin_date,
          dc.day_rating,
          NTILE(5) OVER (ORDER BY dc.day_rating DESC) AS quintile
        FROM daily_checkins dc
        WHERE dc.user_id = $1
          AND dc.checkin_type = 'evening'
          AND dc.day_rating IS NOT NULL
          AND dc.checkin_date >= CURRENT_DATE - $2::int
      ),
      best_days AS (
        SELECT checkin_date FROM rated_days WHERE quintile = 1
      )
      SELECT
        AVG(dhm.sleep_hours) AS avg_sleep,
        (COUNT(DISTINCT wl.scheduled_date)::float / NULLIF(COUNT(DISTINCT bd.checkin_date), 0) * 100) AS pct_exercise,
        AVG(dc.stress_score) AS avg_stress,
        COUNT(DISTINCT bd.checkin_date)::int AS best_day_count
      FROM best_days bd
      LEFT JOIN daily_health_metrics dhm ON dhm.user_id = $1 AND dhm.metric_date = bd.checkin_date
      LEFT JOIN workout_logs wl ON wl.user_id = $1 AND wl.scheduled_date = bd.checkin_date AND wl.status = 'completed'
      LEFT JOIN daily_checkins dc ON dc.user_id = $1 AND dc.checkin_date = bd.checkin_date AND dc.checkin_type = 'morning'
    `, [userId, windowDays]);

    const row = result.rows[0];
    if (!row || row.best_day_count < 3) return null;

    const factors: string[] = [];
    if (row.avg_sleep && row.avg_sleep >= 7) factors.push(`${row.avg_sleep.toFixed(0)}+ hours sleep`);
    if (row.pct_exercise && row.pct_exercise >= 50) factors.push('workout');
    if (row.avg_stress && row.avg_stress <= 4) factors.push('low stress');

    if (factors.length === 0) return null;

    return {
      patternType: 'best_day_profile',
      headline: 'Your best day recipe',
      insight: `Your best days share: ${factors.join(', ')}.`,
      correlationStrength: 0.7,
      dataPoints: row.best_day_count,
      confidence: row.best_day_count >= 7 ? 'high' : 'medium',
      evidence: {
        avgSleep: row.avg_sleep ? Number(row.avg_sleep.toFixed(1)) : null,
        pctExercise: row.pct_exercise ? Number(row.pct_exercise.toFixed(0)) : null,
        avgStress: row.avg_stress ? Number(row.avg_stress.toFixed(1)) : null,
        bestDayCount: row.best_day_count,
      },
    };
  }

  /**
   * Detector 4: Sleep-Energy Correlation (Pearson)
   */
  private async detectSleepEnergyCorrelation(userId: string, windowDays: number): Promise<CorrelationResult | null> {
    const result = await query<{ correlation: number; data_points: number }>(`
      SELECT
        CORR(dhm.sleep_hours, dc.energy_score) AS correlation,
        COUNT(*)::int AS data_points
      FROM daily_health_metrics dhm
      JOIN daily_checkins dc ON dc.user_id = dhm.user_id AND dc.checkin_date = dhm.metric_date
      WHERE dhm.user_id = $1
        AND dhm.metric_date >= CURRENT_DATE - $2::int
        AND dhm.sleep_hours IS NOT NULL
        AND dc.energy_score IS NOT NULL
    `, [userId, windowDays]);

    const row = result.rows[0];
    if (!row || row.data_points < MIN_DATA_POINTS || row.correlation === null) return null;

    const strength = Math.abs(row.correlation);
    if (strength < 0.2) return null;

    const direction = row.correlation > 0 ? 'positively' : 'negatively';

    return {
      patternType: 'sleep_energy_correlation',
      headline: 'Sleep & energy linked',
      insight: `Your sleep hours are ${direction} correlated with energy levels (r=${row.correlation.toFixed(2)}).`,
      correlationStrength: row.correlation,
      dataPoints: row.data_points,
      confidence: strength >= 0.5 ? 'high' : strength >= 0.3 ? 'medium' : 'low',
      evidence: { pearsonR: Number(row.correlation.toFixed(3)), dataPoints: row.data_points },
    };
  }

  /**
   * Detector 5: Recovery-Mood Correlation (Whoop recovery → mood)
   */
  private async detectRecoveryMoodCorrelation(userId: string, windowDays: number): Promise<CorrelationResult | null> {
    const result = await query<{ correlation: number; data_points: number }>(`
      SELECT
        CORR(dhm.recovery_score, ml.happiness_rating) AS correlation,
        COUNT(*)::int AS data_points
      FROM daily_health_metrics dhm
      JOIN mood_logs ml ON ml.user_id = dhm.user_id AND DATE(ml.logged_at) = dhm.metric_date
      WHERE dhm.user_id = $1
        AND dhm.metric_date >= CURRENT_DATE - $2::int
        AND dhm.recovery_score IS NOT NULL
        AND ml.happiness_rating IS NOT NULL
    `, [userId, windowDays]);

    const row = result.rows[0];
    if (!row || row.data_points < MIN_DATA_POINTS || row.correlation === null) return null;

    const strength = Math.abs(row.correlation);
    if (strength < 0.2) return null;

    return {
      patternType: 'recovery_mood_correlation',
      headline: 'Recovery predicts mood',
      insight: `Your Whoop recovery score correlates with mood (r=${row.correlation.toFixed(2)}).`,
      correlationStrength: row.correlation,
      dataPoints: row.data_points,
      confidence: strength >= 0.5 ? 'high' : strength >= 0.3 ? 'medium' : 'low',
      evidence: { pearsonR: Number(row.correlation.toFixed(3)), dataPoints: row.data_points },
    };
  }

  /**
   * Detector 6: Stress-Exercise Inverse
   * "Stress is X% lower on exercise days"
   */
  private async detectStressExerciseInverse(userId: string, windowDays: number): Promise<CorrelationResult | null> {
    const result = await query<{
      exercise_stress: number;
      no_exercise_stress: number;
      exercise_days: number;
      no_exercise_days: number;
    }>(`
      WITH day_stress AS (
        SELECT
          d.stress_date,
          d.avg_stress,
          EXISTS(
            SELECT 1 FROM workout_logs wl
            WHERE wl.user_id = $1
              AND wl.scheduled_date = d.stress_date
              AND wl.status = 'completed'
          ) AS had_exercise
        FROM (
          SELECT
            ml.logged_at::date AS stress_date,
            AVG(ml.stress_rating) AS avg_stress
          FROM mood_logs ml
          WHERE ml.user_id = $1
            AND ml.logged_at >= CURRENT_DATE - $2::int
            AND ml.stress_rating IS NOT NULL
          GROUP BY ml.logged_at::date
        ) d
      )
      SELECT
        AVG(CASE WHEN had_exercise THEN avg_stress END) AS exercise_stress,
        AVG(CASE WHEN NOT had_exercise THEN avg_stress END) AS no_exercise_stress,
        COUNT(CASE WHEN had_exercise THEN 1 END)::int AS exercise_days,
        COUNT(CASE WHEN NOT had_exercise THEN 1 END)::int AS no_exercise_days
      FROM day_stress
    `, [userId, windowDays]);

    const row = result.rows[0];
    if (!row || (row.exercise_days + row.no_exercise_days) < MIN_DATA_POINTS) return null;
    if (row.exercise_stress === null || row.no_exercise_stress === null) return null;

    const diff = row.no_exercise_stress - row.exercise_stress;
    const pctDiff = Math.round((diff / row.no_exercise_stress) * 100);

    if (pctDiff < 10) return null;

    return {
      patternType: 'stress_exercise_inverse',
      headline: 'Exercise reduces stress',
      insight: `Stress is ${pctDiff}% lower on days you exercise.`,
      correlationStrength: Math.min(diff / 5, 1),
      dataPoints: row.exercise_days + row.no_exercise_days,
      confidence: pctDiff >= 25 ? 'high' : pctDiff >= 15 ? 'medium' : 'low',
      evidence: {
        exerciseStress: Number(row.exercise_stress.toFixed(1)),
        noExerciseStress: Number(row.no_exercise_stress.toFixed(1)),
        exerciseDays: row.exercise_days,
        noExerciseDays: row.no_exercise_days,
      },
    };
  }

  // ============================================
  // HELPERS
  // ============================================

  private async upsertPattern(userId: string, result: CorrelationResult, windowDays: number): Promise<void> {
    await query(`
      INSERT INTO journal_patterns (
        user_id, pattern_type, pattern_description, correlation_strength,
        data_points, confidence, evidence, window_days, computed_at,
        is_active, category
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), true, 'correlation')
      ON CONFLICT (user_id, pattern_type)
      DO UPDATE SET
        pattern_description = EXCLUDED.pattern_description,
        correlation_strength = EXCLUDED.correlation_strength,
        data_points = EXCLUDED.data_points,
        confidence = EXCLUDED.confidence,
        evidence = EXCLUDED.evidence,
        window_days = EXCLUDED.window_days,
        computed_at = NOW(),
        is_active = true,
        category = 'correlation',
        updated_at = NOW()
    `, [
      userId,
      result.patternType,
      `${result.headline}: ${result.insight}`,
      result.correlationStrength,
      result.dataPoints,
      result.confidence,
      JSON.stringify(result.evidence),
      windowDays,
    ]);
  }

  private mapPatternRow(row: Record<string, unknown>) {
    return {
      id: row.id,
      userId: row.user_id,
      patternType: row.pattern_type,
      headline: (row.pattern_description as string)?.split(': ')[0] || '',
      insight: (row.pattern_description as string)?.split(': ').slice(1).join(': ') || '',
      correlationStrength: row.correlation_strength,
      dataPoints: row.data_points,
      confidence: row.confidence,
      evidence: row.evidence,
      windowDays: row.window_days,
      isActive: row.is_active,
      computedAt: row.computed_at,
      createdAt: row.created_at,
    };
  }
}

export const healthCorrelationService = new HealthCorrelationService();
export default healthCorrelationService;
