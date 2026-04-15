/**
 * @file Stress Service
 * @description Handles self-reported stress logging with validation, idempotency, and summary rollup
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import { ApiError } from '../utils/ApiError.js';
import { mentalRecoveryScoreService } from './mental-recovery-score.service.js';

// ============================================
// TYPES
// ============================================

export type StressTrigger = 'Work' | 'Relationships' | 'Finances' | 'Health' | 'Family' | 'Uncertainty' | 'Time pressure' | 'Conflict' | 'Other';

export type CheckInType = 'daily' | 'on_demand';

export interface StressLog {
  id: string;
  userId: string;
  stressRating: number; // 1-10
  triggers: StressTrigger[];
  otherTrigger?: string;
  note?: string;
  checkInType: CheckInType;
  clientRequestId: string;
  loggedAt: string; // ISO timestamp
  createdAt: string;
  updatedAt: string;
}

export interface CreateStressLogInput {
  stressRating: number;
  triggers?: StressTrigger[];
  otherTrigger?: string;
  note?: string;
  checkInType: CheckInType;
  clientRequestId: string;
  loggedAt?: string; // Optional, defaults to now
}

export interface StressSummary {
  date: string;
  dailyAvg: number;
  dailyMax: number;
  logsCount: number;
  topTriggers: Array<{ trigger: StressTrigger; count: number }>;
}

export interface ExtremeStressStatus {
  hasExtremeStreak: boolean;
  consecutiveDays: number;
  startDate: string;
}

interface StressLogRow {
  id: string;
  user_id: string;
  stress_rating: number;
  triggers: string[];
  other_trigger: string | null;
  note: string | null;
  check_in_type: string;
  client_request_id: string;
  logged_at: Date;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// CONSTANTS
// ============================================

const VALID_TRIGGERS: StressTrigger[] = ['Work', 'Relationships', 'Finances', 'Health', 'Family', 'Uncertainty', 'Time pressure', 'Conflict', 'Other'];
const MAX_NOTE_LENGTH = 500;
const MAX_OTHER_TRIGGER_LENGTH = 100;

// ============================================
// SERVICE
// ============================================

class StressService {
  /**
   * Create a stress log with idempotency check
   */
  async createStressLog(userId: string, input: CreateStressLogInput): Promise<StressLog> {
    // Validate input
    this.validateInput(input);

    // Check for existing log with same client_request_id (idempotency)
    const existing = await query<StressLogRow>(
      `SELECT * FROM stress_logs 
       WHERE user_id = $1 AND client_request_id = $2`,
      [userId, input.clientRequestId]
    );

    if (existing.rows.length > 0) {
      logger.info('[StressService] Returning existing log (idempotency)', {
        userId,
        clientRequestId: input.clientRequestId,
        logId: existing.rows[0].id,
      });
      return this.mapLogRow(existing.rows[0]);
    }

    // Prepare logged_at timestamp
    const loggedAt = input.loggedAt 
      ? new Date(input.loggedAt).toISOString()
      : new Date().toISOString();

    // Insert new log
    // Convert triggers array to PostgreSQL text[] literal format
    const triggersArray = Array.isArray(input.triggers) && input.triggers.length > 0
      ? `{${input.triggers.map((t: string) => `"${t}"`).join(',')}}`
      : '{}';
    const result = await query<StressLogRow>(
      `INSERT INTO stress_logs (
        user_id, stress_rating, triggers, other_trigger, note,
        check_in_type, client_request_id, logged_at
      ) VALUES ($1, $2, $3::text[], $4, $5, $6, $7, $8::timestamptz)
      RETURNING *`,
      [
        userId,
        input.stressRating,
        triggersArray,
        input.otherTrigger || null,
        input.note || null,
        input.checkInType,
        input.clientRequestId,
        loggedAt,
      ]
    );

    const log = this.mapLogRow(result.rows[0]);

    // Trigger mental recovery score recalculation
    try {
      const logDate = new Date(loggedAt).toISOString().split('T')[0];
      await mentalRecoveryScoreService.calculateRecoveryScore(userId, logDate);
      logger.info('[StressService] Triggered recovery score recalculation', { userId, logDate });
    } catch (error) {
      // Don't fail the log creation if recovery score calculation fails
      logger.warn('[StressService] Failed to recalculate recovery score', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    logger.info('[StressService] Created stress log', {
      userId,
      logId: log.id,
      rating: log.stressRating,
      checkInType: log.checkInType,
    });

    return log;
  }

  /**
   * Get stress logs for a date range
   */
  async getStressLogs(
    userId: string,
    from?: string,
    to?: string
  ): Promise<StressLog[]> {
    let queryStr = `SELECT * FROM stress_logs WHERE user_id = $1`;
    const params: (string | Date)[] = [userId];
    let paramIndex = 2;

    if (from) {
      queryStr += ` AND DATE(logged_at) >= $${paramIndex}::DATE`;
      params.push(from);
      paramIndex++;
    }

    if (to) {
      queryStr += ` AND DATE(logged_at) <= $${paramIndex}::DATE`;
      params.push(to);
      paramIndex++;
    }

    queryStr += ` ORDER BY logged_at DESC`;

    const result = await query<StressLogRow>(queryStr, params);

    return result.rows.map(row => this.mapLogRow(row));
  }

  /**
   * Get today's stress logs
   */
  async getTodayLogs(userId: string): Promise<StressLog[]> {
    const today = new Date().toISOString().split('T')[0];
    return this.getStressLogs(userId, today, today);
  }

  /**
   * Get stress summary (daily rollup) for a date range
   */
  async getStressSummary(
    userId: string,
    from: string,
    to: string
  ): Promise<StressSummary[]> {
    // First get daily aggregates
    const dailyResult = await query<{
      date: string;
      daily_avg: string;
      daily_max: number;
      logs_count: string;
    }>(
      `SELECT 
        DATE(logged_at) as date,
        AVG(stress_rating)::DECIMAL(5,2) as daily_avg,
        MAX(stress_rating) as daily_max,
        COUNT(*)::INTEGER as logs_count
      FROM stress_logs
      WHERE user_id = $1 
        AND DATE(logged_at) >= $2::DATE 
        AND DATE(logged_at) <= $3::DATE
      GROUP BY DATE(logged_at)
      ORDER BY date DESC`,
      [userId, from, to]
    );

    // Get trigger counts per day
    const triggerResult = await query<{
      date: string;
      trigger: string;
      count: string;
    }>(
      `SELECT 
        DATE(logged_at) as date,
        unnest(triggers) as trigger,
        COUNT(*)::INTEGER as count
      FROM stress_logs
      WHERE user_id = $1 
        AND DATE(logged_at) >= $2::DATE 
        AND DATE(logged_at) <= $3::DATE
        AND triggers IS NOT NULL
        AND array_length(triggers, 1) > 0
      GROUP BY DATE(logged_at), unnest(triggers)
      ORDER BY date DESC, count DESC`,
      [userId, from, to]
    );

    // Group triggers by date
    const triggersByDate = new Map<string, Map<StressTrigger, number>>();
    for (const row of triggerResult.rows) {
      const trigger = row.trigger as StressTrigger;
      if (!VALID_TRIGGERS.includes(trigger)) continue;

      if (!triggersByDate.has(row.date)) {
        triggersByDate.set(row.date, new Map());
      }
      const dateMap = triggersByDate.get(row.date)!;
      dateMap.set(trigger, parseInt(row.count, 10));
    }

    // Build summary array
    const summaries: StressSummary[] = [];
    for (const row of dailyResult.rows) {
      const dateTriggers = triggersByDate.get(row.date) || new Map();
      const topTriggers = Array.from(dateTriggers.entries())
        .map(([trigger, count]) => ({ trigger, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      summaries.push({
        date: row.date,
        dailyAvg: parseFloat(row.daily_avg),
        dailyMax: row.daily_max,
        logsCount: parseInt(row.logs_count, 10),
        topTriggers,
      });
    }

    return summaries;
  }

  /**
   * Check for extreme stress streak (5+ consecutive days with max >= 9)
   */
  async checkExtremeStressStreak(userId: string): Promise<ExtremeStressStatus> {
    // Get last 7 days of daily max stress ratings
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const today = new Date().toISOString().split('T')[0];
    const fromDate = sevenDaysAgo.toISOString().split('T')[0];

    const result = await query<{
      date: string;
      daily_max: number;
    }>(
      `SELECT 
        DATE(logged_at) as date,
        MAX(stress_rating) as daily_max
      FROM stress_logs
      WHERE user_id = $1 
        AND DATE(logged_at) >= $2::DATE 
        AND DATE(logged_at) <= $3::DATE
      GROUP BY DATE(logged_at)
      ORDER BY date DESC`,
      [userId, fromDate, today]
    );

    // Check for consecutive days with max >= 9
    let consecutiveDays = 0;
    let startDate = '';
    const sortedDates = result.rows
      .map(r => ({ date: r.date, max: r.daily_max }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    for (let i = 0; i < sortedDates.length; i++) {
      const current = sortedDates[i];
      if (current.max >= 9) {
        if (consecutiveDays === 0) {
          startDate = current.date;
        }
        consecutiveDays++;

        // Check if next day is consecutive
        if (i < sortedDates.length - 1) {
          const next = sortedDates[i + 1];
          const currentDate = new Date(current.date);
          const nextDate = new Date(next.date);
          const daysDiff = Math.floor(
            (currentDate.getTime() - nextDate.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (daysDiff !== 1) {
            // Not consecutive, reset
            consecutiveDays = 0;
            startDate = '';
          }
        }
      } else {
        // Current day is not extreme, reset if we had a streak
        if (consecutiveDays > 0) {
          break;
        }
      }
    }

    return {
      hasExtremeStreak: consecutiveDays >= 5,
      consecutiveDays,
      startDate,
    };
  }

  /**
   * Validate input data
   */
  private validateInput(input: CreateStressLogInput): void {
    // Validate stress rating
    if (!input.stressRating || input.stressRating < 1 || input.stressRating > 10) {
      throw ApiError.badRequest('Stress rating must be between 1 and 10');
    }

    // Validate triggers
    if (input.triggers) {
      for (const trigger of input.triggers) {
        if (!VALID_TRIGGERS.includes(trigger)) {
          throw ApiError.badRequest(`Invalid trigger: ${trigger}. Must be one of: ${VALID_TRIGGERS.join(', ')}`);
        }
      }

      // If 'Other' is in triggers, other_trigger is required
      if (input.triggers.includes('Other')) {
        if (!input.otherTrigger || input.otherTrigger.trim().length === 0) {
          throw ApiError.badRequest('other_trigger is required when "Other" is selected in triggers');
        }
        if (input.otherTrigger.length > MAX_OTHER_TRIGGER_LENGTH) {
          throw ApiError.badRequest(`other_trigger must be ${MAX_OTHER_TRIGGER_LENGTH} characters or less`);
        }
      }
    }

    // Validate note
    if (input.note && input.note.length > MAX_NOTE_LENGTH) {
      throw ApiError.badRequest(`Note must be ${MAX_NOTE_LENGTH} characters or less`);
    }

    // Validate check_in_type
    if (!input.checkInType || !['daily', 'on_demand'].includes(input.checkInType)) {
      throw ApiError.badRequest('check_in_type must be "daily" or "on_demand"');
    }

    // Validate client_request_id
    if (!input.clientRequestId || input.clientRequestId.trim().length === 0) {
      throw ApiError.badRequest('client_request_id is required');
    }
  }

  /**
   * Get multi-signal stress patterns (F7.5 Enhancement)
   * Aggregates self-report, biometrics (HRV, RHR), journal sentiment, and app usage
   */
  async getMultiSignalStressPatterns(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    dailySignals: Array<{
      date: string;
      selfReport?: number;
      biometricScore?: number; // Calculated from HRV/RHR
      journalSentiment?: number; // From journal entries
      aggregatedScore?: number; // Weighted combination
    }>;
    patterns: {
      biometricCorrelation?: number;
      sentimentCorrelation?: number;
    };
  }> {
    // Get self-reported stress logs
    const stressLogs = await this.getStressLogs(userId, startDate, endDate);

    // Get biometric data (HRV and RHR)
    const biometricResult = await query<{
      recorded_at: Date;
      value: any;
      data_type: string;
    }>(
      `SELECT recorded_at, value, data_type
       FROM health_data_records
       WHERE user_id = $1
       AND data_type IN ('hrv', 'heart_rate')
       AND DATE(recorded_at) >= $2::DATE
       AND DATE(recorded_at) <= $3::DATE
       ORDER BY recorded_at ASC`,
      [userId, startDate, endDate]
    );

    // Get journal sentiment data
    const journalResult = await query<{
      logged_at: Date;
      sentiment_score: number | null;
    }>(
      `SELECT logged_at, sentiment_score
       FROM journal_entries
       WHERE user_id = $1
       AND DATE(logged_at) >= $2::DATE
       AND DATE(logged_at) <= $3::DATE
       AND sentiment_score IS NOT NULL
       ORDER BY logged_at ASC`,
      [userId, startDate, endDate]
    );

    // Group data by date
    const dailyData = new Map<string, {
      selfReport?: number[];
      hrv?: number[];
      rhr?: number[];
      sentiment?: number[];
    }>();

    // Process stress logs
    stressLogs.forEach((log) => {
      const date = log.loggedAt.split('T')[0];
      if (!dailyData.has(date)) {
        dailyData.set(date, {});
      }
      const dayData = dailyData.get(date)!;
      if (!dayData.selfReport) dayData.selfReport = [];
      dayData.selfReport.push(log.stressRating);
    });

    // Process biometric data
    biometricResult.rows.forEach((row) => {
      const date = new Date(row.recorded_at).toISOString().split('T')[0];
      if (!dailyData.has(date)) {
        dailyData.set(date, {});
      }
      const dayData = dailyData.get(date)!;

      if (row.data_type === 'hrv') {
        const hrvValue = row.value?.hrv_rmssd_ms || row.value?.hrv_rmssd_milli || row.value?.value;
        if (typeof hrvValue === 'number') {
          if (!dayData.hrv) dayData.hrv = [];
          dayData.hrv.push(hrvValue);
        }
      } else if (row.data_type === 'heart_rate') {
        const rhrValue = row.value?.resting_heart_rate_bpm || row.value?.resting_heart_rate || row.value?.value;
        if (typeof rhrValue === 'number') {
          if (!dayData.rhr) dayData.rhr = [];
          dayData.rhr.push(rhrValue);
        }
      }
    });

    // Process journal sentiment
    journalResult.rows.forEach((row) => {
      const date = new Date(row.logged_at).toISOString().split('T')[0];
      if (!dailyData.has(date)) {
        dailyData.set(date, {});
      }
      const dayData = dailyData.get(date)!;
      if (row.sentiment_score !== null) {
        if (!dayData.sentiment) dayData.sentiment = [];
        // Convert sentiment (-1 to 1) to stress indicator (1 to 10)
        // Lower sentiment = higher stress
        const stressFromSentiment = Math.max(1, Math.min(10, (1 - row.sentiment_score) * 5));
        dayData.sentiment.push(stressFromSentiment);
      }
    });

    // Calculate daily aggregated scores
    const dailySignals = Array.from(dailyData.entries()).map(([date, data]) => {
      const selfReport = data.selfReport?.length ? 
        data.selfReport.reduce((a, b) => a + b, 0) / data.selfReport.length : undefined;

      // Calculate biometric stress score from HRV/RHR
      // Lower HRV or higher RHR = higher stress
      let biometricScore: number | undefined;
      if (data.hrv?.length || data.rhr?.length) {
        // This is a simplified calculation - would need user baselines
        const avgHrv = data.hrv?.length ? 
          data.hrv.reduce((a, b) => a + b, 0) / data.hrv.length : 50; // Default baseline
        const avgRhr = data.rhr?.length ? 
          data.rhr.reduce((a, b) => a + b, 0) / data.rhr.length : 65; // Default baseline
        
        // Simple stress indicator (would need proper baseline comparison)
        biometricScore = Math.max(1, Math.min(10, 
          10 - ((avgHrv / 10) - (avgRhr / 10))
        ));
      }

      const journalSentiment = data.sentiment?.length ? 
        data.sentiment.reduce((a, b) => a + b, 0) / data.sentiment.length : undefined;

      // Weighted aggregated score (if all signals available)
      let aggregatedScore: number | undefined;
      if (selfReport !== undefined && biometricScore !== undefined && journalSentiment !== undefined) {
        aggregatedScore = (selfReport * 0.4) + (biometricScore * 0.3) + (journalSentiment * 0.3);
      }

      return {
        date,
        selfReport,
        biometricScore,
        journalSentiment,
        aggregatedScore,
      };
    }).sort((a, b) => a.date.localeCompare(b.date));

    // Calculate correlations
    const selfReports = dailySignals.map(s => s.selfReport).filter(s => s !== undefined) as number[];
    const biometricScores = dailySignals.map(s => s.biometricScore).filter(s => s !== undefined) as number[];
    const sentimentScores = dailySignals.map(s => s.journalSentiment).filter(s => s !== undefined) as number[];

    let biometricCorrelation: number | undefined;
    if (selfReports.length === biometricScores.length && selfReports.length >= 7) {
      const { calculateCorrelation } = await import('./wellbeing/utils/pattern-detection.js');
      biometricCorrelation = calculateCorrelation(selfReports, biometricScores);
    }

    let sentimentCorrelation: number | undefined;
    if (selfReports.length === sentimentScores.length && selfReports.length >= 7) {
      const { calculateCorrelation } = await import('./wellbeing/utils/pattern-detection.js');
      sentimentCorrelation = calculateCorrelation(selfReports, sentimentScores);
    }

    return {
      dailySignals,
      patterns: {
        biometricCorrelation,
        sentimentCorrelation,
      },
    };
  }

  /**
   * Get proactive stress alerts based on multi-signal patterns
   */
  async getStressAlerts(userId: string): Promise<Array<{
    type: 'high_self_report' | 'biometric_indicator' | 'sentiment_drop' | 'pattern_detected';
    severity: 'low' | 'medium' | 'high';
    message: string;
    date: string;
  }>> {
    const alerts: Array<{
      type: 'high_self_report' | 'biometric_indicator' | 'sentiment_drop' | 'pattern_detected';
      severity: 'low' | 'medium' | 'high';
      message: string;
      date: string;
    }> = [];

    // Check last 7 days
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Check for high self-reported stress
    const recentLogs = await this.getStressLogs(userId, startDateStr, endDate);
    const highStressDays = recentLogs.filter(log => log.stressRating >= 8);
    if (highStressDays.length >= 3) {
      alerts.push({
        type: 'high_self_report',
        severity: highStressDays.length >= 5 ? 'high' : 'medium',
        message: `You've reported high stress (8+) on ${highStressDays.length} of the last 7 days`,
        date: endDate,
      });
    }

    // TODO: Add more alert types as multi-signal data becomes available

    return alerts;
  }

  /**
   * Map database row to StressLog interface
   */
  private mapLogRow(row: StressLogRow): StressLog {
    return {
      id: row.id,
      userId: row.user_id,
      stressRating: row.stress_rating,
      triggers: (row.triggers || []) as StressTrigger[],
      otherTrigger: row.other_trigger || undefined,
      note: row.note || undefined,
      checkInType: row.check_in_type as CheckInType,
      clientRequestId: row.client_request_id,
      loggedAt: row.logged_at.toISOString(),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}

export const stressService = new StressService();

