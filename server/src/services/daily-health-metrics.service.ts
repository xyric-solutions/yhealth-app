/**
 * @file Daily Health Metrics Service
 * @description Service for managing daily health metrics snapshots and history
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';

export interface DailBalenciaMetrics {
  sleepHours: number | null;
  recoveryScore: number | null;
  strainScore: number | null;
  cycleDay: number | null;
}

export interface DailBalenciaMetricsHistory {
  id: string;
  userId: string;
  metricDate: Date;
  sleepHours: number | null;
  recoveryScore: number | null;
  strainScore: number | null;
  cycleDay: number | null;
  provider: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Update daily health metrics for a user
 * Updates both the users table snapshot and the historical table
 */
export async function updateDailyMetrics(
  userId: string,
  date: Date,
  metrics: DailBalenciaMetrics,
  provider: string = 'whoop'
): Promise<void> {
  const metricDate = new Date(date);
  metricDate.setHours(0, 0, 0, 0);
  const dateString = metricDate.toISOString().split('T')[0];

  try {
    // Update users table snapshot (only if this is today's date)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isToday = metricDate.getTime() === today.getTime();

    if (isToday) {
      await query(
        `UPDATE users 
         SET daily_sleep_hours = $1,
             daily_recovery_score = $2,
             daily_strain_score = $3,
             daily_cycle_day = $4,
             daily_health_updated_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [
          metrics.sleepHours,
          metrics.recoveryScore,
          metrics.strainScore,
          metrics.cycleDay,
          userId,
        ]
      );
    }

    // Insert or update historical record
    await query(
      `INSERT INTO daily_health_metrics 
       (user_id, metric_date, sleep_hours, recovery_score, strain_score, cycle_day, provider, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, metric_date) 
       DO UPDATE SET
         sleep_hours = EXCLUDED.sleep_hours,
         recovery_score = EXCLUDED.recovery_score,
         strain_score = EXCLUDED.strain_score,
         cycle_day = EXCLUDED.cycle_day,
         provider = EXCLUDED.provider,
         updated_at = CURRENT_TIMESTAMP`,
      [
        userId,
        dateString,
        metrics.sleepHours,
        metrics.recoveryScore,
        metrics.strainScore,
        metrics.cycleDay,
        provider,
      ]
    );

    logger.debug('Daily health metrics updated', {
      userId,
      date: dateString,
      metrics,
      isToday,
    });
  } catch (error) {
    logger.error('Failed to update daily health metrics', {
      userId,
      date: dateString,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Get daily health metrics history for a date range
 */
export async function getDailyMetricsHistory(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<DailBalenciaMetricsHistory[]> {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const result = await query<{
    id: string;
    user_id: string;
    metric_date: Date;
    sleep_hours: number | null;
    recovery_score: number | null;
    strain_score: number | null;
    cycle_day: number | null;
    provider: string;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT id, user_id, metric_date, sleep_hours, recovery_score, 
            strain_score, cycle_day, provider, created_at, updated_at
     FROM daily_health_metrics
     WHERE user_id = $1 AND metric_date >= $2 AND metric_date <= $3
     ORDER BY metric_date DESC`,
    [userId, start, end]
  );

  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    metricDate: row.metric_date,
    sleepHours: row.sleep_hours,
    recoveryScore: row.recovery_score,
    strainScore: row.strain_score,
    cycleDay: row.cycle_day,
    provider: row.provider,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Get current daily health metrics from users table snapshot
 */
export async function getCurrentDailyMetrics(
  userId: string
): Promise<DailBalenciaMetrics | null> {
  const result = await query<{
    daily_sleep_hours: number | null;
    daily_recovery_score: number | null;
    daily_strain_score: number | null;
    daily_cycle_day: number | null;
    daily_health_updated_at: Date | null;
  }>(
    `SELECT daily_sleep_hours, daily_recovery_score, daily_strain_score, 
            daily_cycle_day, daily_health_updated_at
     FROM users
     WHERE id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  // Return null if no metrics have been set
  if (
    row.daily_sleep_hours === null &&
    row.daily_recovery_score === null &&
    row.daily_strain_score === null &&
    row.daily_cycle_day === null
  ) {
    return null;
  }

  return {
    sleepHours: row.daily_sleep_hours,
    recoveryScore: row.daily_recovery_score,
    strainScore: row.daily_strain_score,
    cycleDay: row.daily_cycle_day,
  };
}

/**
 * Extract daily metrics from WHOOP health data records
 * Helper function to parse recovery, sleep, and strain data
 */
export function extractMetricsFromWhoopData(
  recoveryData: any,
  sleepData: any,
  strainData: any,
  cycleData?: any
): DailBalenciaMetrics {
  return {
    sleepHours: sleepData?.duration_minutes
      ? parseFloat((sleepData.duration_minutes / 60).toFixed(2))
      : null,
    recoveryScore: recoveryData?.score ?? null,
    strainScore: strainData?.score ?? null,
    cycleDay: cycleData?.day ?? null,
  };
}

export const dailBalenciaMetricsService = {
  updateDailyMetrics,
  getDailyMetricsHistory,
  getCurrentDailyMetrics,
  extractMetricsFromWhoopData,
};

