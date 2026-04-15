/**
 * @file Prediction Accuracy Service
 * @description Tracks prediction accuracy by comparing yesterday's predictions
 * from daily_analysis_reports with today's actual metrics from the snapshot.
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';

// ============================================
// TYPES
// ============================================

export interface PredictionAccuracyStat {
  overallAccuracy: number;
  byType: Record<string, { accuracy: number; count: number }>;
  recentPredictions: Array<{
    date: string;
    type: string;
    predicted: number;
    actual: number;
    accuracyPct: number;
  }>;
  totalTracked: number;
}

// ============================================
// SERVICE
// ============================================

class PredictionAccuracyService {
  private tableEnsured = false;

  private async ensureTable(): Promise<void> {
    if (this.tableEnsured) return;
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS prediction_accuracy_tracking (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          prediction_date DATE NOT NULL,
          prediction_type VARCHAR(50) NOT NULL,
          predicted_value NUMERIC(5,2),
          actual_value NUMERIC(5,2),
          accuracy_pct NUMERIC(5,2),
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_prediction_accuracy_user_date
          ON prediction_accuracy_tracking(user_id, prediction_date DESC)
      `);
      // Ensure unique constraint for ON CONFLICT
      await query(`
        DO $$ BEGIN
          ALTER TABLE prediction_accuracy_tracking
            ADD CONSTRAINT uq_prediction_accuracy_user_date_type
            UNIQUE(user_id, prediction_date, prediction_type);
        EXCEPTION WHEN duplicate_table THEN NULL;
        END $$
      `);
      this.tableEnsured = true;
    } catch (error) {
      logger.error('[PredictionAccuracy] Error ensuring table', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  /**
   * Track prediction accuracy: compare yesterday's predictions with today's actuals.
   * Called from daily analysis job after generating a report.
   */
  async trackPredictionAccuracy(userId: string, predictionDate: string): Promise<void> {
    await this.ensureTable();

    try {
      // Fetch yesterday's report (which contains predictions for today)
      const reportResult = await query<{
        predictions: Array<{ type: string; predicted_value: number; confidence: string }>;
      }>(
        `SELECT predictions FROM daily_analysis_reports
         WHERE user_id = $1 AND report_date = $2::date`,
        [userId, predictionDate]
      );

      if (reportResult.rows.length === 0 || !reportResult.rows[0].predictions) return;

      const predictions = typeof reportResult.rows[0].predictions === 'string'
        ? JSON.parse(reportResult.rows[0].predictions)
        : reportResult.rows[0].predictions;

      if (!Array.isArray(predictions) || predictions.length === 0) return;

      // Fetch today's snapshot for actuals (day after prediction)
      const todayResult = await query<{ snapshot: Record<string, unknown> }>(
        `SELECT snapshot FROM daily_analysis_reports
         WHERE user_id = $1 AND report_date = ($2::date + INTERVAL '1 day')::date`,
        [userId, predictionDate]
      );

      if (todayResult.rows.length === 0) return;

      const snapshot = typeof todayResult.rows[0].snapshot === 'string'
        ? JSON.parse(todayResult.rows[0].snapshot)
        : todayResult.rows[0].snapshot;

      // Map prediction types to snapshot fields
      const actualMapping: Record<string, number | null> = {
        energy: snapshot.energyLevel ?? null,
        mood: snapshot.moodLevel ?? null,
        sleep: snapshot.sleepHours ?? null,
        stress: snapshot.stressLevel ?? null,
        recovery: snapshot.recoveryScore ?? null,
      };

      // Collect valid predictions for batch insert
      const rows: Array<[string, string, string, number, number, number]> = [];
      for (const prediction of predictions) {
        const type = (prediction.type || prediction.prediction_type || '').toLowerCase();
        const predicted = prediction.predicted_value ?? prediction.value;
        const actual = actualMapping[type];

        if (predicted == null || actual == null) {
          if (predicted != null) {
            logger.debug('[PredictionAccuracy] No actual value for prediction type', { type, userId: userId.slice(0, 8) });
          }
          continue;
        }

        // Calculate accuracy: 100% - percentage error (capped at 0)
        const maxValue = type === 'sleep' ? 12 : 10; // sleep is hours, others are 0-10
        const error = Math.abs(predicted - actual);
        const accuracyPct = Math.max(0, Math.round((1 - error / maxValue) * 100));
        rows.push([userId, predictionDate, type, predicted, actual, accuracyPct]);
      }

      // Batch insert all predictions at once
      if (rows.length > 0) {
        const placeholders = rows
          .map((_, i) => `($${i * 6 + 1}, $${i * 6 + 2}::date, $${i * 6 + 3}, $${i * 6 + 4}, $${i * 6 + 5}, $${i * 6 + 6})`)
          .join(', ');
        const flatValues = rows.flat();

        await query(
          `INSERT INTO prediction_accuracy_tracking
             (user_id, prediction_date, prediction_type, predicted_value, actual_value, accuracy_pct)
           VALUES ${placeholders}
           ON CONFLICT ON CONSTRAINT uq_prediction_accuracy_user_date_type DO NOTHING`,
          flatValues
        );

        logger.debug('[PredictionAccuracy] Tracked predictions', {
          userId: userId.slice(0, 8),
          count: rows.length,
          date: predictionDate,
        });
      }
    } catch (error) {
      logger.error('[PredictionAccuracy] Error tracking accuracy', {
        userId: userId.slice(0, 8),
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  /**
   * Get accuracy statistics for a user.
   */
  async getAccuracyStats(userId: string, days: number = 30): Promise<PredictionAccuracyStat> {
    await this.ensureTable();

    const result = await query<{
      prediction_type: string;
      avg_accuracy: string;
      count: string;
    }>(
      `SELECT prediction_type,
              AVG(accuracy_pct) AS avg_accuracy,
              COUNT(*) AS count
       FROM prediction_accuracy_tracking
       WHERE user_id = $1
         AND prediction_date >= CURRENT_DATE - $2::integer * INTERVAL '1 day'
       GROUP BY prediction_type`,
      [userId, days]
    );

    const byType: Record<string, { accuracy: number; count: number }> = {};
    let totalAccuracy = 0;
    let totalCount = 0;

    for (const row of result.rows) {
      const accuracy = Math.round(parseFloat(row.avg_accuracy));
      const count = parseInt(row.count, 10);
      byType[row.prediction_type] = { accuracy, count };
      totalAccuracy += accuracy * count;
      totalCount += count;
    }

    // Recent predictions
    const recentResult = await query<{
      prediction_date: string;
      prediction_type: string;
      predicted_value: string;
      actual_value: string;
      accuracy_pct: string;
    }>(
      `SELECT prediction_date, prediction_type, predicted_value, actual_value, accuracy_pct
       FROM prediction_accuracy_tracking
       WHERE user_id = $1
       ORDER BY prediction_date DESC, prediction_type
       LIMIT 20`,
      [userId]
    );

    return {
      overallAccuracy: totalCount > 0 ? Math.round(totalAccuracy / totalCount) : 0,
      byType,
      recentPredictions: recentResult.rows.map((r) => ({
        date: r.prediction_date,
        type: r.prediction_type,
        predicted: parseFloat(r.predicted_value),
        actual: parseFloat(r.actual_value),
        accuracyPct: parseFloat(r.accuracy_pct),
      })),
      totalTracked: totalCount,
    };
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const predictionAccuracyService = new PredictionAccuracyService();
export default predictionAccuracyService;
