/**
 * @file Mental Recovery Score Service
 * @description Calculates mental recovery scores incorporating emotion data
 */

import { logger } from './logger.service.js';
import { query } from '../database/pg.js';

// ============================================
// TYPES
// ============================================

export interface RecoveryScore {
  userId: string;
  scoreDate: string;
  recoveryScore: number; // 0-100
  components: {
    sleep: number;
    stress: number;
    mood: number;
    emotion: number;
    activity: number;
  };
  emotionContribution: number; // Percentage contribution
  emotionWeight: number; // Weight used for emotion (default 0.15)
  factors: {
    sleepHours?: number;
    stressLevel?: number;
    moodScore?: number;
    avgEmotionScore?: number;
    activityLevel?: number;
  };
  trend?: 'improving' | 'stable' | 'declining';
  previousScore?: number;
}

export interface RecoveryTrend {
  date: string;
  score: number;
  trend: 'improving' | 'stable' | 'declining';
}

interface RecoveryScoreRow {
  id: string;
  user_id: string;
  score_date: Date;
  recovery_score: number | string; // Can be DECIMAL from DB
  components: Record<string, number> | string; // Can be JSONB string
  emotion_contribution: number | string;
  emotion_weight: number | string;
  factors: Record<string, unknown> | string; // Can be JSONB string
  trend: string | null;
  previous_score: number | string | null;
}

// ============================================
// SERVICE CLASS
// ============================================

class MentalRecoveryScoreService {
  private readonly DEFAULT_EMOTION_WEIGHT = 0.15; // 15% default weight

  /**
   * Calculate recovery score for a specific date
   */
  async calculateRecoveryScore(
    userId: string,
    date?: string
  ): Promise<RecoveryScore> {
    try {
      const scoreDate = date || new Date().toISOString().split('T')[0];

      // Get previous score for trend calculation
      const previousResult = await query<{ recovery_score: number | string }>(
        `SELECT recovery_score 
         FROM mental_recovery_scores 
         WHERE user_id = $1 AND score_date < $2::DATE
         ORDER BY score_date DESC 
         LIMIT 1`,
        [userId, scoreDate]
      );

      const previousScore =
        previousResult.rows.length > 0
          ? (typeof previousResult.rows[0].recovery_score === 'string' 
              ? parseFloat(previousResult.rows[0].recovery_score) 
              : previousResult.rows[0].recovery_score)
          : undefined;

      // Get emotion weight from user preferences or use default
      const preferencesResult = await query<{ emotion_weight?: number }>(
        `SELECT emotion_weight FROM user_preferences WHERE user_id = $1`,
        [userId]
      );

      const emotionWeight =
        preferencesResult.rows.length > 0 &&
        preferencesResult.rows[0].emotion_weight !== null
          ? preferencesResult.rows[0].emotion_weight || this.DEFAULT_EMOTION_WEIGHT
          : this.DEFAULT_EMOTION_WEIGHT;

      // Gather factors
      const factors = await this.gatherFactors(userId, scoreDate);

      // Calculate component scores
      const components = {
        sleep: this.calculateSleepScore(factors.sleepHours),
        stress: this.calculateStressScore(factors.stressLevel),
        mood: this.calculateMoodScore(factors.moodScore),
        emotion: this.calculateEmotionScore(factors.avgEmotionScore),
        activity: this.calculateActivityScore(factors.activityLevel),
      };

      // Calculate weighted recovery score
      // Emotion gets its weight, remaining weight distributed among other components
      const remainingWeight = 1 - emotionWeight;
      const otherComponentWeight = remainingWeight / 4; // 4 other components

      const recoveryScore = Math.round(
        components.sleep * otherComponentWeight +
          components.stress * otherComponentWeight +
          components.mood * otherComponentWeight +
          components.emotion * emotionWeight +
          components.activity * otherComponentWeight
      );

      // Calculate trend
      let trend: 'improving' | 'stable' | 'declining' = 'stable';
      if (previousScore !== undefined) {
        const diff = recoveryScore - previousScore;
        if (diff > 5) {
          trend = 'improving';
        } else if (diff < -5) {
          trend = 'declining';
        }
      }

      const score: RecoveryScore = {
        userId,
        scoreDate,
        recoveryScore: Math.max(0, Math.min(100, recoveryScore)),
        components,
        emotionContribution: (components.emotion * emotionWeight) / recoveryScore * 100,
        emotionWeight,
        factors,
        trend,
        previousScore,
      };

      // Save to database
      await this.saveRecoveryScore(score);

      logger.info('[MentalRecoveryScore] Recovery score calculated', {
        userId,
        scoreDate,
        recoveryScore: score.recoveryScore,
        trend,
        emotionContribution: score.emotionContribution.toFixed(2) + '%',
      });

      return score;
    } catch (error) {
      logger.error('[MentalRecoveryScore] Error calculating recovery score', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        date,
      });
      throw error;
    }
  }

  /**
   * Gather contributing factors for score calculation
   * Prioritizes WHOOP data when available, falls back to activity logs
   */
  private async gatherFactors(
    userId: string,
    date: string
  ): Promise<RecoveryScore['factors']> {
    const factors: RecoveryScore['factors'] = {};

    try {
      // ============================================
      // Calculate date range for WHOOP data queries
      // Use timestamp range to avoid timezone issues
      // ============================================
      const startOfDay = new Date(date + 'T00:00:00.000Z');
      const endOfDay = new Date(date + 'T23:59:59.999Z');

      // Also check previous day since WHOOP sleep data is often recorded for the previous night
      const previousDay = new Date(startOfDay);
      previousDay.setDate(previousDay.getDate() - 1);

      logger.debug('[MentalRecoveryScore] Querying WHOOP data', {
        userId,
        date,
        startOfDay: startOfDay.toISOString(),
        endOfDay: endOfDay.toISOString(),
      });

      // ============================================
      // 1. Get WHOOP data from health_data_records
      // ============================================

      // Get WHOOP sleep data - check both current day and previous day
      // Sleep data is typically recorded for the night ending on this date
      const whoopSleepResult = await query<{
        value: any;
        recorded_at: Date;
      }>(
        `SELECT value, recorded_at
         FROM health_data_records
         WHERE user_id = $1
           AND provider = 'whoop'
           AND data_type = 'sleep'
           AND recorded_at >= $2
           AND recorded_at <= $3
         ORDER BY recorded_at DESC
         LIMIT 1`,
        [userId, previousDay, endOfDay]
      );

      if (whoopSleepResult.rows.length > 0 && whoopSleepResult.rows[0].value) {
        const sleepValue = whoopSleepResult.rows[0].value;
        const durationMinutes = sleepValue.duration_minutes || sleepValue.total_in_bed_time_milli / 60000 || 0;
        if (durationMinutes > 0) {
          factors.sleepHours = durationMinutes / 60; // Convert minutes to hours
          logger.info('[MentalRecoveryScore] Found WHOOP sleep data', {
            userId,
            date,
            sleepHours: factors.sleepHours,
            sleepQuality: sleepValue.sleep_quality_score || sleepValue.sleep_performance_percentage,
            recordedAt: whoopSleepResult.rows[0].recorded_at,
          });
        }
      }

      if (!factors.sleepHours) {
        // Fallback: try generic health_data_records (non-WHOOP provider)
        const genericSleepResult = await query<{ value: any }>(
          `SELECT value
           FROM health_data_records
           WHERE user_id = $1
             AND data_type = 'sleep'
             AND recorded_at >= $2
             AND recorded_at <= $3
           ORDER BY recorded_at DESC
           LIMIT 1`,
          [userId, previousDay, endOfDay]
        );

        if (genericSleepResult.rows.length > 0 && genericSleepResult.rows[0].value) {
          const duration = genericSleepResult.rows[0].value.duration_minutes || genericSleepResult.rows[0].value.duration;
          if (duration) {
            factors.sleepHours = duration / 60;
          }
        } else {
          // Last fallback: try activity logs with sleep_routine type
          const sleepLogResult = await query<{ duration: number }>(
            `SELECT al.duration
             FROM activity_logs al
             JOIN user_plans up ON up.id = al.plan_id
             WHERE al.user_id = $1
               AND al.scheduled_date = $2::DATE
               AND al.status = 'completed'
               AND EXISTS (
                 SELECT 1 FROM jsonb_array_elements(up.activities::jsonb) AS act
                 WHERE act->>'id' = al.activity_id
                 AND act->>'type' = 'sleep_routine'
               )
             LIMIT 1`,
            [userId, date]
          );

          if (sleepLogResult.rows.length > 0 && sleepLogResult.rows[0].duration) {
            factors.sleepHours = sleepLogResult.rows[0].duration / 60;
          }
        }
      }

      // Get WHOOP recovery data for stress calculation
      // High recovery = low stress, Low recovery = high stress
      const whoopRecoveryResult = await query<{
        value: any;
        recorded_at: Date;
      }>(
        `SELECT value, recorded_at
         FROM health_data_records
         WHERE user_id = $1
           AND provider = 'whoop'
           AND data_type = 'recovery'
           AND recorded_at >= $2
           AND recorded_at <= $3
         ORDER BY recorded_at DESC
         LIMIT 1`,
        [userId, previousDay, endOfDay]
      );

      if (whoopRecoveryResult.rows.length > 0 && whoopRecoveryResult.rows[0].value) {
        const recoveryValue = whoopRecoveryResult.rows[0].value;
        const recoveryScore = recoveryValue.recovery_score ?? recoveryValue.score;
        if (recoveryScore !== null && recoveryScore !== undefined) {
          // Inverse of recovery score = stress level
          // Recovery 100 = Stress 0, Recovery 0 = Stress 100
          factors.stressLevel = 100 - recoveryScore;
          logger.info('[MentalRecoveryScore] Found WHOOP recovery data', {
            userId,
            date,
            recoveryScore,
            derivedStressLevel: factors.stressLevel,
            recordedAt: whoopRecoveryResult.rows[0].recorded_at,
          });
        }
      }

      if (factors.stressLevel === undefined) {
        // Fallback: Get stress level from activity status history
        const stressResult = await query<{ activity_status: string }>(
          `SELECT activity_status
           FROM activity_status_history
           WHERE user_id = $1 AND status_date = $2::DATE
           LIMIT 1`,
          [userId, date]
        );

        if (stressResult.rows.length > 0) {
          const status = stressResult.rows[0].activity_status;
          // Map activity status to stress level (0-100)
          if (status === 'stress') {
            factors.stressLevel = 80;
          } else if (status === 'excellent') {
            factors.stressLevel = 20;
          } else if (status === 'good') {
            factors.stressLevel = 40;
          } else if (status === 'fair') {
            factors.stressLevel = 60;
          } else if (status === 'poor') {
            factors.stressLevel = 80;
          } else {
            factors.stressLevel = 50; // Default
          }
        }
      }

      // Get WHOOP strain data for activity level
      const whoopStrainResult = await query<{
        value: any;
        recorded_at: Date;
      }>(
        `SELECT value, recorded_at
         FROM health_data_records
         WHERE user_id = $1
           AND provider = 'whoop'
           AND data_type = 'strain'
           AND recorded_at >= $2
           AND recorded_at <= $3
         ORDER BY recorded_at DESC
         LIMIT 1`,
        [userId, startOfDay, endOfDay]
      );

      if (whoopStrainResult.rows.length > 0 && whoopStrainResult.rows[0].value) {
        const strainValue = whoopStrainResult.rows[0].value;
        const strainScore = strainValue.strain_score ?? strainValue.score;
        const strainNormalized = strainValue.strain_score_normalized;

        if (strainScore !== null && strainScore !== undefined) {
          // WHOOP strain is 0-21 scale, normalize to 0-100
          // strain_score_normalized is already 0-100 if available
          if (strainNormalized !== null && strainNormalized !== undefined) {
            factors.activityLevel = strainNormalized;
          } else {
            // Normalize strain score (0-21) to 0-100
            factors.activityLevel = (strainScore / 21) * 100;
          }
          logger.info('[MentalRecoveryScore] Found WHOOP strain data', {
            userId,
            date,
            strainScore,
            strainNormalized,
            activityLevel: factors.activityLevel,
            recordedAt: whoopStrainResult.rows[0].recorded_at,
          });
        }
      }

      if (factors.activityLevel === undefined) {
        // Fallback: Get activity level from completion rate
        const activityResult = await query<{
          completed: number;
          total: number;
        }>(
          `SELECT
             COUNT(*) FILTER (WHERE status = 'completed') as completed,
             COUNT(*) as total
           FROM activity_logs
           WHERE user_id = $1 AND scheduled_date = $2::DATE`,
          [userId, date]
        );

        if (activityResult.rows.length > 0) {
          const row = activityResult.rows[0];
          if (row.total > 0) {
            factors.activityLevel = (row.completed / row.total) * 100;
          }
        }
      }

      // ============================================
      // 2. Get mood score from activity status history
      // ============================================
      const moodResult = await query<{ mood: number }>(
        `SELECT mood
         FROM activity_status_history
         WHERE user_id = $1 AND status_date = $2::DATE AND mood IS NOT NULL
         LIMIT 1`,
        [userId, date]
      );

      if (moodResult.rows.length > 0) {
        // Convert 1-5 scale to 0-100
        factors.moodScore = (moodResult.rows[0].mood / 5) * 100;
      }

      // ============================================
      // 3. Get average emotion score for the day
      // ============================================
      try {
        const emotionResult = await query<{ avg_confidence: number; dominant_emotion: string }>(
          `SELECT
             AVG(confidence_score) as avg_confidence,
             MODE() WITHIN GROUP (ORDER BY emotion_category) as dominant_emotion
           FROM emotion_logs
           WHERE user_id = $1
             AND DATE(timestamp) = $2::DATE`,
          [userId, date]
        );

        if (
          emotionResult.rows.length > 0 &&
          emotionResult.rows[0].avg_confidence !== null
        ) {
          const avgConfidence = emotionResult.rows[0].avg_confidence;
          const dominantEmotion = emotionResult.rows[0].dominant_emotion || 'neutral';

          // Convert emotion to score: positive emotions increase score, negative decrease
          const positiveEmotions: Array<string> = ['happy', 'calm', 'excited', 'joyful', 'content'];
          const negativeEmotions: Array<string> = ['sad', 'angry', 'anxious', 'stressed', 'distressed', 'frustrated'];

          let emotionScore = 50; // Neutral baseline

          // Adjust based on dominant emotion
          if (positiveEmotions.includes(dominantEmotion.toLowerCase())) {
            emotionScore = 70 + (avgConfidence / 100) * 30; // 70-100 range
          } else if (negativeEmotions.includes(dominantEmotion.toLowerCase())) {
            emotionScore = (avgConfidence / 100) * 50; // 0-50 range
          } else {
            // Neutral emotions
            emotionScore = 50 + (avgConfidence / 100) * 20; // 50-70 range
          }

          factors.avgEmotionScore = emotionScore;
        }
      } catch (_error) {
        // Emotion logs might not exist, use default
        logger.warn('[MentalRecoveryScore] Could not fetch emotion data', { userId, date });
      }

      logger.info('[MentalRecoveryScore] Gathered factors', { userId, date, factors });
      return factors;
    } catch (error) {
      logger.error('[MentalRecoveryScore] Error gathering factors', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        date,
      });
      return factors; // Return partial factors
    }
  }

  /**
   * Calculate sleep score component (0-100)
   */
  private calculateSleepScore(sleepHours?: number): number {
    if (!sleepHours) return 50; // Default if no data

    // Optimal sleep: 7-9 hours = 100
    // 6-7 or 9-10 = 75
    // 5-6 or 10-11 = 50
    // <5 or >11 = 25

    if (sleepHours >= 7 && sleepHours <= 9) {
      return 100;
    } else if ((sleepHours >= 6 && sleepHours < 7) || (sleepHours > 9 && sleepHours <= 10)) {
      return 75;
    } else if ((sleepHours >= 5 && sleepHours < 6) || (sleepHours > 10 && sleepHours <= 11)) {
      return 50;
    } else {
      return 25;
    }
  }

  /**
   * Calculate stress score component (0-100, inverse of stress level)
   */
  private calculateStressScore(stressLevel?: number): number {
    if (stressLevel === undefined) return 50; // Default
    return Math.max(0, 100 - stressLevel);
  }

  /**
   * Calculate mood score component (0-100)
   */
  private calculateMoodScore(moodScore?: number): number {
    if (moodScore === undefined) return 50; // Default
    return Math.max(0, Math.min(100, moodScore));
  }

  /**
   * Calculate emotion score component (0-100)
   */
  private calculateEmotionScore(avgEmotionScore?: number): number {
    if (avgEmotionScore === undefined) return 50; // Default
    return Math.max(0, Math.min(100, avgEmotionScore));
  }

  /**
   * Calculate activity score component (0-100)
   */
  private calculateActivityScore(activityLevel?: number): number {
    if (activityLevel === undefined) return 50; // Default
    return Math.max(0, Math.min(100, activityLevel));
  }

  /**
   * Save recovery score to database
   */
  private async saveRecoveryScore(score: RecoveryScore): Promise<void> {
    try {
      await query(
        `INSERT INTO mental_recovery_scores (
          user_id, score_date, recovery_score, components, emotion_contribution,
          emotion_weight, factors, trend, previous_score
        ) VALUES ($1, $2::DATE, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (user_id, score_date)
        DO UPDATE SET
          recovery_score = EXCLUDED.recovery_score,
          components = EXCLUDED.components,
          emotion_contribution = EXCLUDED.emotion_contribution,
          emotion_weight = EXCLUDED.emotion_weight,
          factors = EXCLUDED.factors,
          trend = EXCLUDED.trend,
          previous_score = EXCLUDED.previous_score,
          updated_at = CURRENT_TIMESTAMP`,
        [
          score.userId,
          score.scoreDate,
          score.recoveryScore,
          JSON.stringify(score.components),
          score.emotionContribution,
          score.emotionWeight,
          JSON.stringify(score.factors),
          score.trend || null,
          score.previousScore || null,
        ]
      );
    } catch (error) {
      logger.error('[MentalRecoveryScore] Error saving recovery score', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: score.userId,
        scoreDate: score.scoreDate,
      });
      throw error;
    }
  }

  /**
   * Get recovery trends over time
   */
  async getRecoveryTrends(
    userId: string,
    days: number = 30
  ): Promise<RecoveryTrend[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);

      // Calculate scores for missing dates in the range
      const today = new Date().toISOString().split('T')[0];
      const startDateStr = startDate.toISOString().split('T')[0];
      
      // Calculate today's score if missing
      try {
        await this.calculateRecoveryScore(userId, today);
      } catch (error) {
        logger.warn('[MentalRecoveryScore] Could not calculate today\'s score', { userId, error });
      }

      // Calculate scores for a few key dates if missing (last 7 days)
      for (let i = 0; i < Math.min(7, days); i++) {
        const checkDate = new Date();
        checkDate.setDate(checkDate.getDate() - i);
        const checkDateStr = checkDate.toISOString().split('T')[0];
        
        const hasScore = await query<{ count: string }>(
          `SELECT COUNT(*) as count FROM mental_recovery_scores 
           WHERE user_id = $1 AND score_date = $2::DATE`,
          [userId, checkDateStr]
        );
        
        if (parseInt(hasScore.rows[0]?.count || '0') === 0) {
          try {
            await this.calculateRecoveryScore(userId, checkDateStr);
          } catch (_error) {
            // Continue if calculation fails for a specific date
            logger.warn('[MentalRecoveryScore] Could not calculate score for date', { userId, date: checkDateStr });
          }
        }
      }

      const result = await query<RecoveryScoreRow>(
        `SELECT * FROM mental_recovery_scores
         WHERE user_id = $1 AND score_date >= $2::DATE AND score_date <= $3::DATE
         ORDER BY score_date ASC`,
        [userId, startDateStr, endDate.toISOString().split('T')[0]]
      );

      return result.rows.map(row => ({
        date: typeof row.score_date === 'string' ? row.score_date : row.score_date.toISOString().split('T')[0],
        score: typeof row.recovery_score === 'string' ? parseFloat(row.recovery_score) : row.recovery_score,
        trend: (row.trend as 'improving' | 'stable' | 'declining') || 'stable',
      }));
    } catch (error) {
      logger.error('[MentalRecoveryScore] Error getting recovery trends', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        days,
      });
      // Return empty array instead of throwing to allow frontend to handle gracefully
      return [];
    }
  }

  /**
   * Get recovery trends with component scores
   */
  async getRecoveryTrendsWithComponents(
    userId: string,
    days: number = 30
  ): Promise<Array<RecoveryTrend & {
    sleepScore?: number;
    stressScore?: number;
    moodScore?: number;
    emotionScore?: number;
    activityScore?: number;
  }>> {
    try {
      // First ensure we have recent scores calculated
      await this.getRecoveryTrends(userId, days);
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);

      const result = await query<RecoveryScoreRow>(
        `SELECT * FROM mental_recovery_scores
         WHERE user_id = $1 AND score_date >= $2::DATE AND score_date <= $3::DATE
         ORDER BY score_date ASC`,
        [userId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
      );

      return this.mapTrendsWithComponents(result.rows);
    } catch (error) {
      logger.error('[MentalRecoveryScore] Error getting recovery trends with components', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        days,
      });
      // Fallback to basic trends with default component scores
      const basicTrends = await this.getRecoveryTrends(userId, days);
      return basicTrends.map(t => ({ 
        ...t, 
        sleepScore: 50, 
        stressScore: 50, 
        moodScore: 50, 
        emotionScore: 50, 
        activityScore: 50 
      }));
    }
  }

  /**
   * Map database rows to trends with component scores
   */
  private mapTrendsWithComponents(rows: RecoveryScoreRow[]): Array<RecoveryTrend & {
    sleepScore?: number;
    stressScore?: number;
    moodScore?: number;
    emotionScore?: number;
    activityScore?: number;
  }> {
    return rows.map(row => {
      const components = typeof row.components === 'string' 
        ? JSON.parse(row.components) 
        : (row.components || {});
      
      return {
        date: typeof row.score_date === 'string' ? row.score_date : row.score_date.toISOString().split('T')[0],
        score: typeof row.recovery_score === 'string' ? parseFloat(row.recovery_score) : row.recovery_score,
        trend: (row.trend as 'improving' | 'stable' | 'declining') || 'stable',
        sleepScore: components?.sleep || 0,
        stressScore: components?.stress || 0,
        moodScore: components?.mood || 0,
        emotionScore: components?.emotion || 0,
        activityScore: components?.activity || 0,
      };
    });
  }

  /**
   * Update emotion weight for user
   */
  async updateEmotionWeight(userId: string, weight: number): Promise<void> {
    try {
      // Validate weight (0-1 range)
      if (weight < 0 || weight > 1) {
        throw new Error('Emotion weight must be between 0 and 1');
      }

      // Check if user preferences exist
      const preferencesResult = await query<{ id: string }>(
        `SELECT id FROM user_preferences WHERE user_id = $1`,
        [userId]
      );

      if (preferencesResult.rows.length === 0) {
        // Create preferences if they don't exist
        await query(
          `INSERT INTO user_preferences (user_id, emotion_weight) VALUES ($1, $2)`,
          [userId, weight]
        );
      } else {
        // Update existing preferences
        await query(
          `UPDATE user_preferences SET emotion_weight = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
          [weight, userId]
        );
      }

      logger.info('[MentalRecoveryScore] Emotion weight updated', { userId, weight });
    } catch (error) {
      logger.error('[MentalRecoveryScore] Error updating emotion weight', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        weight,
      });
      throw error;
    }
  }
}

export const mentalRecoveryScoreService = new MentalRecoveryScoreService();

