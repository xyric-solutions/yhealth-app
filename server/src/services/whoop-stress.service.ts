/**
 * @file WHOOP Stress Intelligence Service
 * @description Calculates stress levels from physiological signals (HRV, HR, recovery)
 *
 * Balencia's Stress Monitor Intelligence Layer - interprets physiological signals
 * to estimate real-time stress signals and long-term patterns.
 *
 * This service does NOT diagnose medical or mental health conditions.
 * It presents insights as physiological arousal trends relative to the user's personal baseline.
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';

// ============================================
// TYPES
// ============================================

export interface StressLevel {
  level: 0 | 1 | 2 | 3; // 0=Low, 1=Mild, 2=Moderate, 3=High
  label: 'Low' | 'Mild' | 'Moderate' | 'High';
  score: number; // 0-100 normalized score
  description: string;
}

export interface StressSignals {
  hrv: number | null; // RMSSD in ms
  hrvBaseline: number | null; // 14-day baseline
  hrvDeviation: number | null; // % deviation from baseline
  rhr: number | null; // Resting heart rate
  rhrBaseline: number | null;
  rhrDeviation: number | null;
  recoveryScore: number | null;
  strain: number | null;
  confidence: number; // 0-1 signal confidence
}

export interface StressLoadType {
  type: 'physical' | 'non_exercise' | 'mixed' | 'unknown';
  label: string;
  description: string;
}

export interface StressTrend {
  date: string;
  level: number;
  score: number;
  hrv: number | null;
  rhr: number | null;
  recovery: number | null;
  strain: number | null;
  loadType: string;
}

export interface StressInsight {
  type: 'positive' | 'warning' | 'neutral' | 'suggestion';
  message: string;
  priority: number;
}

export interface StressAnalysis {
  current: {
    level: StressLevel;
    signals: StressSignals;
    loadType: StressLoadType;
    timestamp: string;
  };
  baseline: {
    hrvMedian: number | null;
    hrvRange: { min: number; max: number } | null;
    rhrMedian: number | null;
    rhrRange: { min: number; max: number } | null;
    recoveryAvg: number | null;
    daysOfData: number;
  };
  trends: {
    daily: StressTrend[];
    weeklyAvg: number | null;
    trend: 'improving' | 'worsening' | 'stable';
  };
  insights: StressInsight[];
  suggestions: string[];
  disclaimer: string;
}

// ============================================
// CONSTANTS
// ============================================

const BASELINE_DAYS = 14;

// Stress level thresholds based on deviation from baseline
const STRESS_THRESHOLDS = {
  LOW: { min: 0, max: 25, label: 'Low' as const },
  MILD: { min: 25, max: 50, label: 'Mild' as const },
  MODERATE: { min: 50, max: 75, label: 'Moderate' as const },
  HIGH: { min: 75, max: 100, label: 'High' as const },
};

// ============================================
// SERVICE CLASS
// ============================================

class WhoopStressService {
  /**
   * Get comprehensive stress analysis for a user
   */
  async getStressAnalysis(userId: string, startDate?: Date, endDate?: Date): Promise<StressAnalysis> {
    try {
      // Get baseline data (14 days)
      const baseline = await this.calculateBaseline(userId);

      // Get current metrics
      const currentMetrics = await this.getCurrentMetrics(userId);

      // Get trends for the date range
      const trends = await this.getStressTrends(userId, startDate, endDate);

      // Calculate current stress level
      const currentLevel = this.calculateStressLevel(currentMetrics, baseline);

      // Determine load type (physical vs non-exercise stress)
      const loadType = this.determineLoadType(currentMetrics);

      // Generate insights
      const insights = this.generateInsights(currentLevel, currentMetrics, baseline, trends);

      // Generate action suggestions
      const suggestions = this.generateSuggestions(currentLevel, loadType);

      const analysis: StressAnalysis = {
        current: {
          level: currentLevel,
          signals: {
            hrv: currentMetrics.hrv,
            hrvBaseline: baseline.hrvMedian,
            hrvDeviation: baseline.hrvMedian && currentMetrics.hrv
              ? ((baseline.hrvMedian - currentMetrics.hrv) / baseline.hrvMedian) * 100
              : null,
            rhr: currentMetrics.rhr,
            rhrBaseline: baseline.rhrMedian,
            rhrDeviation: baseline.rhrMedian && currentMetrics.rhr
              ? ((currentMetrics.rhr - baseline.rhrMedian) / baseline.rhrMedian) * 100
              : null,
            recoveryScore: currentMetrics.recovery,
            strain: currentMetrics.strain,
            confidence: this.calculateConfidence(currentMetrics, baseline),
          },
          loadType,
          timestamp: new Date().toISOString(),
        },
        baseline,
        trends: {
          daily: trends,
          weeklyAvg: trends.length > 0
            ? Math.round(trends.reduce((sum, t) => sum + t.score, 0) / trends.length)
            : null,
          trend: this.calculateTrend(trends),
        },
        insights,
        suggestions,
        disclaimer: 'This is not a medical assessment. Stress levels are calculated from physiological signals relative to your personal baseline. Consult a healthcare provider for medical concerns.',
      };

      return analysis;
    } catch (error) {
      logger.error('[WhoopStress] Error calculating stress analysis', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Calculate 14-day rolling baseline for the user
   */
  private async calculateBaseline(userId: string): Promise<StressAnalysis['baseline']> {
    const baselineEnd = new Date();
    const baselineStart = new Date();
    baselineStart.setDate(baselineStart.getDate() - BASELINE_DAYS);

    // Get recovery data for baseline period
    const recoveryData = await query<{
      value: any;
      recorded_at: Date;
    }>(
      `SELECT value, recorded_at FROM health_data_records
       WHERE user_id = $1 AND provider = 'whoop' AND data_type = 'recovery'
       AND recorded_at >= $2 AND recorded_at <= $3
       ORDER BY recorded_at ASC`,
      [userId, baselineStart, baselineEnd]
    );

    if (recoveryData.rows.length === 0) {
      return {
        hrvMedian: null,
        hrvRange: null,
        rhrMedian: null,
        rhrRange: null,
        recoveryAvg: null,
        daysOfData: 0,
      };
    }

    // Extract metrics
    const hrvValues: number[] = [];
    const rhrValues: number[] = [];
    const recoveryValues: number[] = [];

    for (const row of recoveryData.rows) {
      const hrv = row.value?.hrv_rmssd_milli || row.value?.hrv_rmssd_ms;
      const rhr = row.value?.resting_heart_rate_bpm || row.value?.resting_heart_rate;
      const recovery = row.value?.recovery_score;

      if (hrv && hrv > 0) hrvValues.push(hrv);
      if (rhr && rhr > 0) rhrValues.push(rhr);
      if (recovery !== undefined && recovery !== null) recoveryValues.push(recovery);
    }

    // Calculate medians and ranges
    const median = (arr: number[]) => {
      if (arr.length === 0) return null;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    return {
      hrvMedian: median(hrvValues),
      hrvRange: hrvValues.length > 0
        ? { min: Math.min(...hrvValues), max: Math.max(...hrvValues) }
        : null,
      rhrMedian: median(rhrValues),
      rhrRange: rhrValues.length > 0
        ? { min: Math.min(...rhrValues), max: Math.max(...rhrValues) }
        : null,
      recoveryAvg: recoveryValues.length > 0
        ? Math.round(recoveryValues.reduce((a, b) => a + b, 0) / recoveryValues.length)
        : null,
      daysOfData: recoveryData.rows.length,
    };
  }

  /**
   * Get current metrics (most recent data)
   */
  private async getCurrentMetrics(userId: string): Promise<{
    hrv: number | null;
    rhr: number | null;
    recovery: number | null;
    strain: number | null;
    hasActivity: boolean;
  }> {
    // Get latest recovery
    const recovery = await query<{ value: any }>(
      `SELECT value FROM health_data_records
       WHERE user_id = $1 AND provider = 'whoop' AND data_type = 'recovery'
       ORDER BY recorded_at DESC LIMIT 1`,
      [userId]
    );

    // Get latest strain (last 48 hours)
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    const strain = await query<{ value: any }>(
      `SELECT value FROM health_data_records
       WHERE user_id = $1 AND provider = 'whoop' AND data_type = 'strain'
       AND recorded_at >= $2
       ORDER BY recorded_at DESC LIMIT 1`,
      [userId, twoDaysAgo]
    );

    const recoveryValue = recovery.rows[0]?.value;
    const strainValue = strain.rows[0]?.value;

    return {
      hrv: recoveryValue?.hrv_rmssd_milli || recoveryValue?.hrv_rmssd_ms || null,
      rhr: recoveryValue?.resting_heart_rate_bpm || recoveryValue?.resting_heart_rate || null,
      recovery: recoveryValue?.recovery_score ?? null,
      strain: strainValue?.strain_score ?? strainValue?.score ?? null,
      hasActivity: (strainValue?.strain_score ?? strainValue?.score ?? 0) > 5,
    };
  }

  /**
   * Calculate stress level from current metrics and baseline
   */
  private calculateStressLevel(
    current: { hrv: number | null; rhr: number | null; recovery: number | null; strain: number | null },
    baseline: StressAnalysis['baseline']
  ): StressLevel {
    const factors: number[] = [];

    // HRV factor (lower HRV = higher stress)
    if (current.hrv && baseline.hrvMedian) {
      const hrvDeviation = (baseline.hrvMedian - current.hrv) / baseline.hrvMedian;
      // Normalize to 0-100 (positive deviation = stress)
      const hrvFactor = Math.max(0, Math.min(100, 50 + (hrvDeviation * 100)));
      factors.push(hrvFactor);
    }

    // RHR factor (higher RHR = higher stress, when not exercising)
    if (current.rhr && baseline.rhrMedian && (current.strain === null || current.strain < 10)) {
      const rhrDeviation = (current.rhr - baseline.rhrMedian) / baseline.rhrMedian;
      const rhrFactor = Math.max(0, Math.min(100, 50 + (rhrDeviation * 100)));
      factors.push(rhrFactor);
    }

    // Recovery factor (lower recovery = higher stress)
    if (current.recovery !== null) {
      // Inverse: 0 recovery = 100 stress, 100 recovery = 0 stress
      const recoveryFactor = Math.max(0, Math.min(100, 100 - current.recovery));
      factors.push(recoveryFactor);
    }

    // Calculate average stress score
    if (factors.length === 0) {
      return {
        level: 0,
        label: 'Low',
        score: 0,
        description: 'Unable to calculate stress level - insufficient data',
      };
    }

    const avgScore = Math.round(factors.reduce((a, b) => a + b, 0) / factors.length);

    // Map to 0-3 level
    let level: 0 | 1 | 2 | 3;
    let label: 'Low' | 'Mild' | 'Moderate' | 'High';
    let description: string;

    if (avgScore < STRESS_THRESHOLDS.LOW.max) {
      level = 0;
      label = 'Low';
      description = 'Your body is showing calm, relaxed physiological signals relative to your baseline.';
    } else if (avgScore < STRESS_THRESHOLDS.MILD.max) {
      level = 1;
      label = 'Mild';
      description = 'Your body is showing slightly elevated physiological arousal, but within normal variation.';
    } else if (avgScore < STRESS_THRESHOLDS.MODERATE.max) {
      level = 2;
      label = 'Moderate';
      description = 'Your body is showing sustained physiological strain compared to your recent baseline.';
    } else {
      level = 3;
      label = 'High';
      description = 'Your body is showing peak stress signals for you - consider recovery activities.';
    }

    return { level, label, score: avgScore, description };
  }

  /**
   * Determine if stress is physical (exercise) or non-exercise
   */
  private determineLoadType(current: {
    strain: number | null;
    hasActivity: boolean;
    hrv: number | null;
    rhr: number | null;
  }): StressLoadType {
    // High strain = physical load
    if (current.strain !== null && current.strain >= 10) {
      return {
        type: 'physical',
        label: 'Physical Load',
        description: 'Elevated signals appear related to physical activity or exercise.',
      };
    }

    // Low strain but elevated HR/suppressed HRV = non-exercise stress
    if (current.strain !== null && current.strain < 5) {
      return {
        type: 'non_exercise',
        label: 'Non-Exercise Stress',
        description: 'Elevated signals while inactive suggest mental or environmental stressors.',
      };
    }

    // Moderate strain - could be either
    if (current.strain !== null) {
      return {
        type: 'mixed',
        label: 'Mixed Signals',
        description: 'Signals show a mix of physical and non-physical stress indicators.',
      };
    }

    return {
      type: 'unknown',
      label: 'Unknown',
      description: 'Unable to determine stress source - insufficient activity data.',
    };
  }

  /**
   * Calculate confidence in the stress measurement
   */
  private calculateConfidence(
    current: { hrv: number | null; rhr: number | null; recovery: number | null },
    baseline: StressAnalysis['baseline']
  ): number {
    let signals = 0;
    let available = 0;

    if (current.hrv !== null) available++;
    if (baseline.hrvMedian !== null) available++;
    if (current.rhr !== null) available++;
    if (baseline.rhrMedian !== null) available++;
    if (current.recovery !== null) available++;

    signals = available;
    const maxSignals = 5;

    // Also factor in baseline days
    const baselineFactor = Math.min(1, baseline.daysOfData / 7);

    return Math.round((signals / maxSignals) * baselineFactor * 100) / 100;
  }

  /**
   * Get stress trends for date range
   */
  private async getStressTrends(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<StressTrend[]> {
    const effectiveEnd = endDate || new Date();
    const effectiveStart = startDate || (() => {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return d;
    })();

    // Get recovery data for the period
    const recoveryData = await query<{
      value: any;
      recorded_at: Date;
    }>(
      `SELECT value, recorded_at FROM health_data_records
       WHERE user_id = $1 AND provider = 'whoop' AND data_type = 'recovery'
       AND recorded_at >= $2 AND recorded_at <= $3
       ORDER BY recorded_at ASC`,
      [userId, effectiveStart, effectiveEnd]
    );

    // Get strain data for the period
    const strainData = await query<{
      value: any;
      recorded_at: Date;
    }>(
      `SELECT value, recorded_at FROM health_data_records
       WHERE user_id = $1 AND provider = 'whoop' AND data_type = 'strain'
       AND recorded_at >= $2 AND recorded_at <= $3
       ORDER BY recorded_at ASC`,
      [userId, effectiveStart, effectiveEnd]
    );

    // Create strain map by date
    const strainByDate = new Map<string, any>();
    for (const row of strainData.rows) {
      const dateKey = row.recorded_at.toISOString().split('T')[0];
      strainByDate.set(dateKey, row.value);
    }

    // Calculate daily stress from recovery
    const trends: StressTrend[] = [];

    for (const row of recoveryData.rows) {
      const dateKey = row.recorded_at.toISOString().split('T')[0];
      const hrv = row.value?.hrv_rmssd_milli || row.value?.hrv_rmssd_ms || null;
      const rhr = row.value?.resting_heart_rate_bpm || row.value?.resting_heart_rate || null;
      const recovery = row.value?.recovery_score ?? null;
      const strainValue = strainByDate.get(dateKey);
      const strain = strainValue?.strain_score ?? strainValue?.score ?? null;

      // Calculate stress score (inverse of recovery)
      const score = recovery !== null ? Math.max(0, 100 - recovery) : 50;
      const level = score < 25 ? 0 : score < 50 ? 1 : score < 75 ? 2 : 3;

      // Determine load type
      let loadType = 'unknown';
      if (strain !== null) {
        loadType = strain >= 10 ? 'physical' : strain < 5 ? 'non_exercise' : 'mixed';
      }

      trends.push({
        date: dateKey,
        level,
        score,
        hrv,
        rhr,
        recovery,
        strain,
        loadType,
      });
    }

    return trends;
  }

  /**
   * Calculate trend direction from historical data
   */
  private calculateTrend(trends: StressTrend[]): 'improving' | 'worsening' | 'stable' {
    if (trends.length < 3) return 'stable';

    const recent = trends.slice(-3);
    const older = trends.slice(-7, -3);

    if (older.length === 0) return 'stable';

    const recentAvg = recent.reduce((sum, t) => sum + t.score, 0) / recent.length;
    const olderAvg = older.reduce((sum, t) => sum + t.score, 0) / older.length;

    const diff = recentAvg - olderAvg;

    if (diff < -10) return 'improving'; // Lower stress = improving
    if (diff > 10) return 'worsening';
    return 'stable';
  }

  /**
   * Generate insights from stress analysis
   */
  private generateInsights(
    currentLevel: StressLevel,
    current: { hrv: number | null; rhr: number | null; recovery: number | null; strain: number | null },
    baseline: StressAnalysis['baseline'],
    trends: StressTrend[]
  ): StressInsight[] {
    const insights: StressInsight[] = [];

    // Current level insight
    insights.push({
      type: currentLevel.level <= 1 ? 'positive' : currentLevel.level === 2 ? 'neutral' : 'warning',
      message: currentLevel.description,
      priority: 1,
    });

    // HRV insight
    if (current.hrv && baseline.hrvMedian) {
      const deviation = ((baseline.hrvMedian - current.hrv) / baseline.hrvMedian) * 100;
      if (deviation > 20) {
        insights.push({
          type: 'warning',
          message: `Your HRV is ${Math.round(deviation)}% below your baseline, suggesting elevated physiological stress.`,
          priority: 2,
        });
      } else if (deviation < -20) {
        insights.push({
          type: 'positive',
          message: `Your HRV is ${Math.round(Math.abs(deviation))}% above your baseline, indicating strong recovery.`,
          priority: 2,
        });
      }
    }

    // Recovery insight
    if (current.recovery !== null) {
      if (current.recovery >= 67) {
        insights.push({
          type: 'positive',
          message: 'Your recovery score indicates your body is well-rested and ready for activity.',
          priority: 3,
        });
      } else if (current.recovery < 33) {
        insights.push({
          type: 'warning',
          message: 'Your recovery score is low. Consider prioritizing rest and recovery activities.',
          priority: 3,
        });
      }
    }

    // Trend insight
    if (trends.length >= 5) {
      const recentTrend = this.calculateTrend(trends);
      if (recentTrend === 'improving') {
        insights.push({
          type: 'positive',
          message: 'Your stress levels have been improving over the past few days.',
          priority: 4,
        });
      } else if (recentTrend === 'worsening') {
        insights.push({
          type: 'warning',
          message: 'Your stress signals have been elevated compared to earlier this week.',
          priority: 4,
        });
      }
    }

    // Baseline data insight
    if (baseline.daysOfData < 7) {
      insights.push({
        type: 'neutral',
        message: `Building your personal baseline... ${baseline.daysOfData}/7 days of data collected.`,
        priority: 5,
      });
    }

    return insights.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Generate action suggestions based on stress level
   */
  private generateSuggestions(level: StressLevel, loadType: StressLoadType): string[] {
    const suggestions: string[] = [];

    if (level.level >= 2) {
      // Moderate to high stress
      suggestions.push('Try a 5-minute guided breathing exercise to activate your parasympathetic nervous system.');
      suggestions.push('Consider a short walk or gentle stretching to release physical tension.');

      if (loadType.type === 'non_exercise') {
        suggestions.push('Take a screen break - look at something 20 feet away for 20 seconds.');
        suggestions.push('Hydration affects HRV - ensure you\'re drinking enough water.');
      }

      suggestions.push('Prioritize quality sleep tonight to support recovery.');
    } else if (level.level === 1) {
      // Mild stress
      suggestions.push('Your body is managing well. A brief mindfulness moment could maintain this balance.');
      suggestions.push('Stay hydrated and maintain your current routine.');
    } else {
      // Low stress
      suggestions.push('Great job! Your body is showing optimal recovery signals.');
      suggestions.push('This is a good time for productive work or challenging activities.');
    }

    return suggestions.slice(0, 3);
  }
}

export const whoopStressService = new WhoopStressService();
export default whoopStressService;
