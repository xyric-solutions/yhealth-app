/**
 * @file Emotional Check-In Trends Service
 * @description Analyzes trends and calculates baselines for emotional check-ins
 * Supports 7/30/90 day analysis with pattern detection
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';

// ============================================
// TYPES
// ============================================

export interface UserBaseline {
  anxiety: number;
  mood: number;
  energy: number;
  stress: number;
  sampleSize: number;
  lastUpdated: string;
}

export interface TrendData {
  period: string;
  anxiety: number;
  mood: number;
  energy: number;
  change: {
    anxiety: number;
    mood: number;
    energy: number;
  };
}

export interface EnhancedTrendAnalysis {
  shortTerm: TrendWindow;
  mediumTerm: TrendWindow;
  longTerm: TrendWindow;
  patterns: PatternAnalysis;
  anomalies: Anomaly[];
  overallTrend: 'improving' | 'stable' | 'declining';
  confidenceScore: number;
}

export interface TrendWindow {
  window: '7d' | '30d' | '90d';
  days: number;
  trend: 'improving' | 'stable' | 'declining';
  delta: number; // Change from previous period
  average: {
    anxiety: number;
    mood: number;
    energy: number;
    stress: number;
  };
  sampleCount: number;
}

export interface PatternAnalysis {
  weekdayVsWeekend: {
    weekday: { mood: number; stress: number };
    weekend: { mood: number; stress: number };
    significant: boolean;
  };
  timeOfDay: {
    morning: { mood: number; energy: number };
    afternoon: { mood: number; energy: number };
    evening: { mood: number; energy: number };
  };
  triggers: {
    work: boolean;
    sleep: boolean;
    social: boolean;
    health: boolean;
  };
  consistency: {
    checkInFrequency: number; // Average check-ins per week
    streak: number; // Current consecutive days
    bestStreak: number;
  };
}

export interface Anomaly {
  date: string;
  metric: 'anxiety' | 'mood' | 'energy' | 'stress';
  value: number;
  expectedRange: { min: number; max: number };
  deviation: number; // Standard deviations from mean
  description: string;
}

// ============================================
// SERVICE CLASS
// ============================================

class EmotionalCheckInTrendsService {
  /**
   * Get user baseline from historical data
   */
  async getUserBaseline(userId: string): Promise<UserBaseline> {
    try {
      // Get last 30 days of data
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get mood logs
      const moodLogs = await query(
        `SELECT happiness_rating, anxiety_rating, energy_rating, stress_rating
         FROM mood_logs
         WHERE user_id = $1 AND logged_at >= $2 AND mode = 'deep'
         ORDER BY logged_at DESC
         LIMIT 50`,
        [userId, thirtyDaysAgo.toISOString()]
      );

      // Get stress logs
      const stressLogs = await query(
        `SELECT stress_rating
         FROM stress_logs
         WHERE user_id = $1 AND logged_at >= $2
         ORDER BY logged_at DESC
         LIMIT 50`,
        [userId, thirtyDaysAgo.toISOString()]
      );

      // Get energy logs
      const energyLogs = await query(
        `SELECT energy_rating
         FROM energy_logs
         WHERE user_id = $1 AND logged_at >= $2
         ORDER BY logged_at DESC
         LIMIT 50`,
        [userId, thirtyDaysAgo.toISOString()]
      );

      // Calculate averages
      const anxietyScores: number[] = [];
      const moodScores: number[] = [];
      const energyScores: number[] = [];
      const stressScores: number[] = [];

      // From mood logs
      for (const log of moodLogs.rows) {
        if (log.anxiety_rating) anxietyScores.push(log.anxiety_rating);
        if (log.happiness_rating) moodScores.push(log.happiness_rating);
        if (log.energy_rating) energyScores.push(log.energy_rating);
        if (log.stress_rating) stressScores.push(log.stress_rating);
      }

      // From stress logs
      for (const log of stressLogs.rows) {
        if (log.stress_rating) stressScores.push(log.stress_rating);
      }

      // From energy logs
      for (const log of energyLogs.rows) {
        if (log.energy_rating) energyScores.push(log.energy_rating);
      }

      const calculateAverage = (scores: number[]): number => {
        if (scores.length === 0) return 0;
        return scores.reduce((sum, score) => sum + score, 0) / scores.length;
      };

      const baseline: UserBaseline = {
        anxiety: calculateAverage(anxietyScores),
        mood: calculateAverage(moodScores) || 5, // Default to neutral if no data
        energy: calculateAverage(energyScores) || 5,
        stress: calculateAverage(stressScores),
        sampleSize: Math.max(
          anxietyScores.length,
          moodScores.length,
          energyScores.length,
          stressScores.length
        ),
        lastUpdated: new Date().toISOString(),
      };

      return baseline;
    } catch (error) {
      logger.error('[EmotionalCheckInTrends] Error calculating baseline', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Return default baseline if calculation fails
      return {
        anxiety: 0,
        mood: 5,
        energy: 5,
        stress: 0,
        sampleSize: 0,
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  /**
   * Get trend data comparing current period to previous
   */
  async getTrends(userId: string, timeWindow: 'week' | 'month' = 'week'): Promise<TrendData[]> {
    try {
      const now = new Date();
      const currentPeriodStart = new Date(now);
      const previousPeriodStart = new Date(now);

      if (timeWindow === 'week') {
        currentPeriodStart.setDate(now.getDate() - 7);
        previousPeriodStart.setDate(now.getDate() - 14);
      } else {
        currentPeriodStart.setMonth(now.getMonth() - 1);
        previousPeriodStart.setMonth(now.getMonth() - 2);
      }

      // Get current period data
      const currentData = await this.getPeriodData(userId, currentPeriodStart, now);

      // Get previous period data
      const previousData = await this.getPeriodData(userId, previousPeriodStart, currentPeriodStart);

      return [
        {
          period: timeWindow === 'week' ? 'This Week' : 'This Month',
          anxiety: currentData.anxiety,
          mood: currentData.mood,
          energy: currentData.energy,
          change: {
            anxiety: currentData.anxiety - previousData.anxiety,
            mood: currentData.mood - previousData.mood,
            energy: currentData.energy - previousData.energy,
          },
        },
        {
          period: timeWindow === 'week' ? 'Last Week' : 'Last Month',
          anxiety: previousData.anxiety,
          mood: previousData.mood,
          energy: previousData.energy,
          change: {
            anxiety: 0,
            mood: 0,
            energy: 0,
          },
        },
      ];
    } catch (error) {
      logger.error('[EmotionalCheckInTrends] Error getting trends', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Get aggregated data for a time period
   */
  private async getPeriodData(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ anxiety: number; mood: number; energy: number }> {
    // Get mood logs
    const moodLogs = await query(
      `SELECT AVG(anxiety_rating) as avg_anxiety, 
              AVG(happiness_rating) as avg_mood,
              AVG(energy_rating) as avg_energy
       FROM mood_logs
       WHERE user_id = $1 AND logged_at >= $2 AND logged_at < $3 AND mode = 'deep'`,
      [userId, startDate.toISOString(), endDate.toISOString()]
    );

    // Get stress logs
    const stressLogs = await query(
      `SELECT AVG(stress_rating) as avg_stress
       FROM stress_logs
       WHERE user_id = $1 AND logged_at >= $2 AND logged_at < $3`,
      [userId, startDate.toISOString(), endDate.toISOString()]
    );

    // Get energy logs
    const energyLogs = await query(
      `SELECT AVG(energy_rating) as avg_energy
       FROM energy_logs
       WHERE user_id = $1 AND logged_at >= $2 AND logged_at < $3`,
      [userId, startDate.toISOString(), endDate.toISOString()]
    );

    const moodRow = moodLogs.rows[0];
    const stressRow = stressLogs.rows[0];
    const energyRow = energyLogs.rows[0];

    return {
      anxiety: parseFloat(moodRow?.avg_anxiety || stressRow?.avg_stress || '0') || 0,
      mood: parseFloat(moodRow?.avg_mood || '5') || 5,
      energy: parseFloat(moodRow?.avg_energy || energyRow?.avg_energy || '5') || 5,
    };
  }

  // ============================================
  // ENHANCED TREND ANALYSIS (7/30/90 DAY)
  // ============================================

  /**
   * Get comprehensive trend analysis across multiple time windows
   */
  async getEnhancedTrends(userId: string): Promise<EnhancedTrendAnalysis> {
    try {
      // Calculate all time windows in parallel
      const [shortTerm, mediumTerm, longTerm, patterns, anomalies] = await Promise.all([
        this.getWindowAnalysis(userId, 7),
        this.getWindowAnalysis(userId, 30),
        this.getWindowAnalysis(userId, 90),
        this.analyzePatterns(userId),
        this.detectAnomalies(userId),
      ]);

      // Determine overall trend
      const overallTrend = this.determineOverallTrend(shortTerm, mediumTerm, longTerm);

      // Calculate confidence score based on data availability
      const confidenceScore = this.calculateConfidenceScore(shortTerm, mediumTerm, longTerm);

      return {
        shortTerm,
        mediumTerm,
        longTerm,
        patterns,
        anomalies,
        overallTrend,
        confidenceScore,
      };
    } catch (error) {
      logger.error('[EmotionalCheckInTrends] Error calculating enhanced trends', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Return default analysis
      return this.getDefaultEnhancedAnalysis();
    }
  }

  /**
   * Get analysis for a specific time window
   */
  private async getWindowAnalysis(userId: string, days: number): Promise<TrendWindow> {
    const windowLabel = days === 7 ? '7d' : days === 30 ? '30d' : '90d';

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const previousStartDate = new Date();
    previousStartDate.setDate(previousStartDate.getDate() - days * 2);

    // Get current period data
    const currentData = await this.getPeriodData(userId, startDate, new Date());

    // Get previous period data for comparison
    const previousData = await this.getPeriodData(userId, previousStartDate, startDate);

    // Calculate deltas
    const moodDelta = currentData.mood - previousData.mood;
    const anxietyDelta = currentData.anxiety - previousData.anxiety;

    // Determine trend (mood improving = good, anxiety decreasing = good)
    const moodTrend = moodDelta > 0.5 ? 1 : moodDelta < -0.5 ? -1 : 0;
    const anxietyTrend = anxietyDelta < -0.5 ? 1 : anxietyDelta > 0.5 ? -1 : 0;
    const combinedTrend = moodTrend + anxietyTrend;

    const trend: TrendWindow['trend'] =
      combinedTrend > 0 ? 'improving' : combinedTrend < 0 ? 'declining' : 'stable';

    // Get sample count
    const sampleCount = await this.getSampleCount(userId, startDate, new Date());

    return {
      window: windowLabel,
      days,
      trend,
      delta: moodDelta, // Use mood delta as primary metric
      average: {
        anxiety: currentData.anxiety,
        mood: currentData.mood,
        energy: currentData.energy,
        stress: currentData.anxiety, // Using anxiety as stress proxy
      },
      sampleCount,
    };
  }

  /**
   * Get sample count for a period
   */
  private async getSampleCount(userId: string, startDate: Date, endDate: Date): Promise<number> {
    const result = await query(
      `SELECT COUNT(*) as count FROM (
        SELECT logged_at FROM mood_logs WHERE user_id = $1 AND logged_at >= $2 AND logged_at < $3
        UNION ALL
        SELECT logged_at FROM stress_logs WHERE user_id = $1 AND logged_at >= $2 AND logged_at < $3
        UNION ALL
        SELECT logged_at FROM energy_logs WHERE user_id = $1 AND logged_at >= $2 AND logged_at < $3
      ) combined`,
      [userId, startDate.toISOString(), endDate.toISOString()]
    );

    return parseInt(result.rows[0]?.count || '0', 10);
  }

  /**
   * Analyze behavioral patterns
   */
  private async analyzePatterns(userId: string): Promise<PatternAnalysis> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Weekday vs Weekend analysis
    const weekdayVsWeekend = await this.analyzeWeekdayVsWeekend(userId, thirtyDaysAgo);

    // Time of day analysis
    const timeOfDay = await this.analyzeTimeOfDay(userId, thirtyDaysAgo);

    // Trigger analysis (from notes/context)
    const triggers = await this.analyzeTriggers(userId, thirtyDaysAgo);

    // Check-in consistency
    const consistency = await this.analyzeConsistency(userId);

    return {
      weekdayVsWeekend,
      timeOfDay,
      triggers,
      consistency,
    };
  }

  /**
   * Analyze weekday vs weekend patterns
   */
  private async analyzeWeekdayVsWeekend(userId: string, startDate: Date): Promise<PatternAnalysis['weekdayVsWeekend']> {
    const weekdayResult = await query(
      `SELECT AVG(happiness_rating) as avg_mood, AVG(stress_rating) as avg_stress
       FROM mood_logs
       WHERE user_id = $1 AND logged_at >= $2
         AND EXTRACT(DOW FROM logged_at) BETWEEN 1 AND 5`,
      [userId, startDate.toISOString()]
    );

    const weekendResult = await query(
      `SELECT AVG(happiness_rating) as avg_mood, AVG(stress_rating) as avg_stress
       FROM mood_logs
       WHERE user_id = $1 AND logged_at >= $2
         AND EXTRACT(DOW FROM logged_at) IN (0, 6)`,
      [userId, startDate.toISOString()]
    );

    const weekday = {
      mood: parseFloat(weekdayResult.rows[0]?.avg_mood || '5'),
      stress: parseFloat(weekdayResult.rows[0]?.avg_stress || '0'),
    };

    const weekend = {
      mood: parseFloat(weekendResult.rows[0]?.avg_mood || '5'),
      stress: parseFloat(weekendResult.rows[0]?.avg_stress || '0'),
    };

    // Significant if difference > 1 point
    const significant = Math.abs(weekday.mood - weekend.mood) > 1 ||
                       Math.abs(weekday.stress - weekend.stress) > 1;

    return { weekday, weekend, significant };
  }

  /**
   * Analyze time of day patterns
   */
  private async analyzeTimeOfDay(userId: string, startDate: Date): Promise<PatternAnalysis['timeOfDay']> {
    const morningResult = await query(
      `SELECT AVG(happiness_rating) as avg_mood, AVG(energy_rating) as avg_energy
       FROM mood_logs
       WHERE user_id = $1 AND logged_at >= $2
         AND EXTRACT(HOUR FROM logged_at) BETWEEN 5 AND 11`,
      [userId, startDate.toISOString()]
    );

    const afternoonResult = await query(
      `SELECT AVG(happiness_rating) as avg_mood, AVG(energy_rating) as avg_energy
       FROM mood_logs
       WHERE user_id = $1 AND logged_at >= $2
         AND EXTRACT(HOUR FROM logged_at) BETWEEN 12 AND 17`,
      [userId, startDate.toISOString()]
    );

    const eveningResult = await query(
      `SELECT AVG(happiness_rating) as avg_mood, AVG(energy_rating) as avg_energy
       FROM mood_logs
       WHERE user_id = $1 AND logged_at >= $2
         AND EXTRACT(HOUR FROM logged_at) BETWEEN 18 AND 23`,
      [userId, startDate.toISOString()]
    );

    return {
      morning: {
        mood: parseFloat(morningResult.rows[0]?.avg_mood || '5'),
        energy: parseFloat(morningResult.rows[0]?.avg_energy || '5'),
      },
      afternoon: {
        mood: parseFloat(afternoonResult.rows[0]?.avg_mood || '5'),
        energy: parseFloat(afternoonResult.rows[0]?.avg_energy || '5'),
      },
      evening: {
        mood: parseFloat(eveningResult.rows[0]?.avg_mood || '5'),
        energy: parseFloat(eveningResult.rows[0]?.avg_energy || '5'),
      },
    };
  }

  /**
   * Analyze common triggers from notes
   */
  private async analyzeTriggers(userId: string, startDate: Date): Promise<PatternAnalysis['triggers']> {
    const notesResult = await query(
      `SELECT context_note FROM mood_logs
       WHERE user_id = $1 AND logged_at >= $2 AND context_note IS NOT NULL
       UNION ALL
       SELECT note as context_note FROM stress_logs
       WHERE user_id = $1 AND logged_at >= $2 AND note IS NOT NULL`,
      [userId, startDate.toISOString()]
    );

    const allNotes = notesResult.rows.map((r: any) => (r.context_note || '').toLowerCase()).join(' ');

    return {
      work: allNotes.includes('work') || allNotes.includes('job') || allNotes.includes('office'),
      sleep: allNotes.includes('sleep') || allNotes.includes('tired') || allNotes.includes('fatigue'),
      social: allNotes.includes('friend') || allNotes.includes('family') || allNotes.includes('social'),
      health: allNotes.includes('sick') || allNotes.includes('pain') || allNotes.includes('health'),
    };
  }

  /**
   * Analyze check-in consistency
   */
  private async analyzeConsistency(userId: string): Promise<PatternAnalysis['consistency']> {
    // Get check-in frequency over last 4 weeks
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

    const frequencyResult = await query(
      `SELECT COUNT(DISTINCT DATE(started_at)) as check_in_days
       FROM emotional_checkin_sessions
       WHERE user_id = $1 AND started_at >= $2 AND completed_at IS NOT NULL`,
      [userId, fourWeeksAgo.toISOString()]
    );

    const checkInDays = parseInt(frequencyResult.rows[0]?.check_in_days || '0', 10);
    const checkInFrequency = checkInDays / 4; // Average per week

    // Get current streak
    const streakResult = await query(
      `WITH daily_checkins AS (
        SELECT DISTINCT DATE(started_at) as check_date
        FROM emotional_checkin_sessions
        WHERE user_id = $1 AND completed_at IS NOT NULL
        ORDER BY check_date DESC
      ),
      streak_calc AS (
        SELECT check_date,
               ROW_NUMBER() OVER (ORDER BY check_date DESC) as rn,
               check_date - (ROW_NUMBER() OVER (ORDER BY check_date DESC))::INTEGER as grp
        FROM daily_checkins
      )
      SELECT COUNT(*) as streak
      FROM streak_calc
      WHERE grp = (SELECT grp FROM streak_calc WHERE check_date = CURRENT_DATE)`,
      [userId]
    );

    const streak = parseInt(streakResult.rows[0]?.streak || '0', 10);

    return {
      checkInFrequency,
      streak,
      bestStreak: streak, // Simplified - would need separate query for historical best
    };
  }

  /**
   * Detect anomalies in recent data
   */
  private async detectAnomalies(userId: string): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get baseline stats
    const baseline = await this.getUserBaseline(userId);
    if (baseline.sampleSize < 5) {
      return []; // Not enough data for anomaly detection
    }

    // Get recent logs
    const moodLogs = await query(
      `SELECT logged_at, happiness_rating as mood, anxiety_rating as anxiety, energy_rating as energy
       FROM mood_logs
       WHERE user_id = $1 AND logged_at >= $2 AND mode = 'deep'
       ORDER BY logged_at DESC
       LIMIT 30`,
      [userId, thirtyDaysAgo.toISOString()]
    );

    // Calculate standard deviations (simplified)
    const moodStdDev = this.calculateStdDev(moodLogs.rows.map((r: any) => r.mood).filter(Boolean));
    const anxietyStdDev = this.calculateStdDev(moodLogs.rows.map((r: any) => r.anxiety).filter(Boolean));

    // Detect anomalies (> 2 standard deviations from mean)
    for (const log of moodLogs.rows) {
      if (log.mood && Math.abs(log.mood - baseline.mood) > 2 * moodStdDev) {
        anomalies.push({
          date: log.logged_at.toISOString(),
          metric: 'mood',
          value: log.mood,
          expectedRange: {
            min: baseline.mood - 2 * moodStdDev,
            max: baseline.mood + 2 * moodStdDev,
          },
          deviation: (log.mood - baseline.mood) / moodStdDev,
          description: log.mood > baseline.mood
            ? 'Unusually high mood detected'
            : 'Unusually low mood detected',
        });
      }

      if (log.anxiety && Math.abs(log.anxiety - baseline.anxiety) > 2 * anxietyStdDev) {
        anomalies.push({
          date: log.logged_at.toISOString(),
          metric: 'anxiety',
          value: log.anxiety,
          expectedRange: {
            min: Math.max(0, baseline.anxiety - 2 * anxietyStdDev),
            max: baseline.anxiety + 2 * anxietyStdDev,
          },
          deviation: (log.anxiety - baseline.anxiety) / anxietyStdDev,
          description: log.anxiety > baseline.anxiety
            ? 'Unusually high anxiety detected'
            : 'Unusually low anxiety detected',
        });
      }
    }

    // Limit to most recent 5 anomalies
    return anomalies.slice(0, 5);
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[]): number {
    if (values.length === 0) return 1;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
    return Math.sqrt(variance) || 1; // Avoid division by zero
  }

  /**
   * Determine overall trend from all windows
   */
  private determineOverallTrend(
    shortTerm: TrendWindow,
    mediumTerm: TrendWindow,
    longTerm: TrendWindow
  ): 'improving' | 'stable' | 'declining' {
    // Weight recent data more heavily
    const weights = { short: 0.5, medium: 0.3, long: 0.2 };
    const trendValues = {
      improving: 1,
      stable: 0,
      declining: -1,
    };

    const weightedSum =
      weights.short * trendValues[shortTerm.trend] +
      weights.medium * trendValues[mediumTerm.trend] +
      weights.long * trendValues[longTerm.trend];

    if (weightedSum > 0.3) return 'improving';
    if (weightedSum < -0.3) return 'declining';
    return 'stable';
  }

  /**
   * Calculate confidence score based on data availability
   */
  private calculateConfidenceScore(
    shortTerm: TrendWindow,
    mediumTerm: TrendWindow,
    longTerm: TrendWindow
  ): number {
    // Ideal samples: 7 for short, 30 for medium, 90 for long
    const shortRatio = Math.min(1, shortTerm.sampleCount / 7);
    const mediumRatio = Math.min(1, mediumTerm.sampleCount / 30);
    const longRatio = Math.min(1, longTerm.sampleCount / 90);

    // Weight recent data more in confidence calculation too
    const confidence = shortRatio * 0.5 + mediumRatio * 0.3 + longRatio * 0.2;
    return Math.round(confidence * 100) / 100;
  }

  /**
   * Get default enhanced analysis when no data available
   */
  private getDefaultEnhancedAnalysis(): EnhancedTrendAnalysis {
    const defaultWindow: TrendWindow = {
      window: '7d',
      days: 7,
      trend: 'stable',
      delta: 0,
      average: { anxiety: 0, mood: 5, energy: 5, stress: 0 },
      sampleCount: 0,
    };

    return {
      shortTerm: { ...defaultWindow, window: '7d', days: 7 },
      mediumTerm: { ...defaultWindow, window: '30d', days: 30 },
      longTerm: { ...defaultWindow, window: '90d', days: 90 },
      patterns: {
        weekdayVsWeekend: {
          weekday: { mood: 5, stress: 0 },
          weekend: { mood: 5, stress: 0 },
          significant: false,
        },
        timeOfDay: {
          morning: { mood: 5, energy: 5 },
          afternoon: { mood: 5, energy: 5 },
          evening: { mood: 5, energy: 5 },
        },
        triggers: { work: false, sleep: false, social: false, health: false },
        consistency: { checkInFrequency: 0, streak: 0, bestStreak: 0 },
      },
      anomalies: [],
      overallTrend: 'stable',
      confidenceScore: 0,
    };
  }
}

export const emotionalCheckinTrendsService = new EmotionalCheckInTrendsService();
export default emotionalCheckinTrendsService;

