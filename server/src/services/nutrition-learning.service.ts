/**
 * Nutrition Learning Service
 *
 * Detects and tracks adherence patterns from nutrition data:
 * - Day-of-week patterns (e.g., "always under on Mondays")
 * - Meal-type patterns (e.g., "skips breakfast consistently")
 * - Workout-day patterns (e.g., "undereats on workout days")
 * - Blocker identification (e.g., "social events cause overconsumption")
 *
 * Uses pattern data to provide personalized recommendations.
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import { DeviationClassification } from './nutrition-analysis.service.js';

// ============================================
// TYPES
// ============================================

export type PatternType =
  | 'day_of_week'
  | 'meal_type'
  | 'workout_day'
  | 'recovery_level'
  | 'time_of_day'
  | 'streak'
  | 'blocker';

export interface AdherencePattern {
  id: string;
  userId: string;
  patternType: PatternType;
  patternKey: string;
  occurrences: number;
  totalObservations: number;
  successRate: number;
  averageDeviation: number;
  averageDeviationPercent: number;
  patternDetails: Record<string, unknown>;
  firstObserved: Date | null;
  lastOccurrence: Date | null;
  streakCount: number;
  aiInsight: string | null;
  recommendation: string | null;
  interventionType: string | null;
  confidenceScore: number;
  isValid: boolean;
  isActive: boolean;
}

export interface PatternAnalysis {
  userId: string;
  analyzedDays: number;
  patterns: AdherencePattern[];
  strengths: string[];
  challenges: string[];
  recommendations: string[];
}

export interface DayPattern {
  dayOfWeek: string;
  dayIndex: number;
  avgDeviation: number;
  avgDeviationPercent: number;
  successRate: number;
  observations: number;
}

export interface MealPattern {
  mealType: string;
  avgCalories: number;
  frequency: number; // How often logged per day
  missedDays: number;
  totalDays: number;
}

export interface WorkoutNutritionPattern {
  workoutDays: {
    avgCalories: number;
    avgDeviationPercent: number;
    successRate: number;
    count: number;
  };
  restDays: {
    avgCalories: number;
    avgDeviationPercent: number;
    successRate: number;
    count: number;
  };
  difference: number; // workoutDays.avgCalories - restDays.avgCalories
}

export interface Blocker {
  type: string;
  reason: string;
  frequency: number;
  avgDeviationWhenOccurs: number;
  suggestion: string;
}

// ============================================
// CONSTANTS
// ============================================

const MIN_OBSERVATIONS_FOR_VALIDITY = 3;
const CONFIDENCE_THRESHOLD = 0.6;
const SUCCESS_THRESHOLD = 5; // ±5% is considered "on target"

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// ============================================
// SERVICE CLASS
// ============================================

class NutritionLearningService {
  /**
   * Analyze all patterns for a user over a time period
   */
  async analyzePatterns(userId: string, days: number = 30): Promise<PatternAnalysis> {
    logger.info('[NutritionLearning] Analyzing patterns', { userId, days });

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get analysis history
    const analyses = await this.getAnalysisHistory(userId, startDate, endDate);

    if (analyses.length < MIN_OBSERVATIONS_FOR_VALIDITY) {
      return {
        userId,
        analyzedDays: analyses.length,
        patterns: [],
        strengths: [],
        challenges: [],
        recommendations: ['Log more meals to start seeing patterns in your nutrition habits.'],
      };
    }

    // Detect various pattern types
    const dayPatterns = await this.detectDayOfWeekPatterns(userId, analyses);
    const workoutPattern = await this.detectWorkoutPatterns(userId, startDate, endDate);
    const blockers = await this.identifyBlockers(userId, analyses);

    // Build pattern list
    const patterns: AdherencePattern[] = [];

    // Convert day patterns to adherence patterns
    for (const dp of dayPatterns) {
      if (dp.observations >= MIN_OBSERVATIONS_FOR_VALIDITY) {
        const pattern = await this.upsertPattern(userId, 'day_of_week', dp.dayOfWeek, {
          occurrences: dp.observations,
          successRate: dp.successRate,
          averageDeviation: dp.avgDeviation,
          averageDeviationPercent: dp.avgDeviationPercent,
          patternDetails: dp as unknown as Record<string, unknown>,
        });
        if (pattern) patterns.push(pattern);
      }
    }

    // Convert workout pattern
    if (workoutPattern && workoutPattern.workoutDays.count >= MIN_OBSERVATIONS_FOR_VALIDITY) {
      const pattern = await this.upsertPattern(
        userId,
        'workout_day',
        workoutPattern.difference > 0 ? 'eats_more_on_workout' : 'eats_less_on_workout',
        {
          occurrences: workoutPattern.workoutDays.count,
          successRate: workoutPattern.workoutDays.successRate,
          averageDeviation: workoutPattern.difference,
          averageDeviationPercent:
            workoutPattern.workoutDays.avgDeviationPercent -
            workoutPattern.restDays.avgDeviationPercent,
          patternDetails: workoutPattern as unknown as Record<string, unknown>,
        }
      );
      if (pattern) patterns.push(pattern);
    }

    // Generate insights
    const strengths = this.identifyStrengths(dayPatterns, workoutPattern);
    const challenges = this.identifyChallenges(dayPatterns, workoutPattern, blockers);
    const recommendations = this.generateRecommendations(patterns, blockers);

    return {
      userId,
      analyzedDays: analyses.length,
      patterns,
      strengths,
      challenges,
      recommendations,
    };
  }

  /**
   * Detect day-of-week patterns
   */
  async detectDayOfWeekPatterns(
    userId: string,
    analyses?: Array<{
      date: Date;
      deviationPercent: number;
      classification: DeviationClassification;
    }>
  ): Promise<DayPattern[]> {
    // If analyses not provided, fetch them
    if (!analyses) {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      analyses = await this.getAnalysisHistory(userId, startDate, endDate);
    }

    // Group by day of week
    const dayGroups: Record<
      number,
      Array<{ deviationPercent: number; classification: DeviationClassification }>
    > = {
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
    };

    for (const analysis of analyses) {
      const dayIndex = analysis.date.getDay();
      dayGroups[dayIndex].push({
        deviationPercent: analysis.deviationPercent,
        classification: analysis.classification,
      });
    }

    // Calculate stats for each day
    const patterns: DayPattern[] = [];

    for (let i = 0; i < 7; i++) {
      const dayData = dayGroups[i];
      if (dayData.length === 0) continue;

      const avgDeviationPercent =
        dayData.reduce((sum, d) => sum + d.deviationPercent, 0) / dayData.length;

      const successCount = dayData.filter(
        (d) => Math.abs(d.deviationPercent) <= SUCCESS_THRESHOLD
      ).length;

      patterns.push({
        dayOfWeek: DAY_NAMES[i],
        dayIndex: i,
        avgDeviation: 0, // Would need actual calorie data
        avgDeviationPercent: Math.round(avgDeviationPercent * 10) / 10,
        successRate: Math.round((successCount / dayData.length) * 100),
        observations: dayData.length,
      });
    }

    return patterns;
  }

  /**
   * Detect workout-day vs rest-day patterns
   */
  async detectWorkoutPatterns(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<WorkoutNutritionPattern | null> {
    // Get analyses with WHOOP workout data
    const result = await query<{
      analysis_date: string;
      actual_calories: number;
      deviation_percentage: number;
      whoop_workout_calories: number | null;
    }>(
      `SELECT analysis_date, actual_calories, deviation_percentage, whoop_workout_calories
       FROM nutrition_daily_analysis
       WHERE user_id = $1
         AND analysis_date >= $2::date
         AND analysis_date <= $3::date
         AND deviation_classification != 'missed_day'`,
      [userId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
    );

    if (result.rows.length < MIN_OBSERVATIONS_FOR_VALIDITY * 2) {
      return null;
    }

    const workoutDays = result.rows.filter((r) => (r.whoop_workout_calories || 0) > 100);
    const restDays = result.rows.filter((r) => !r.whoop_workout_calories || r.whoop_workout_calories < 100);

    if (workoutDays.length < MIN_OBSERVATIONS_FOR_VALIDITY || restDays.length < MIN_OBSERVATIONS_FOR_VALIDITY) {
      return null;
    }

    const calcStats = (
      days: typeof workoutDays
    ): { avgCalories: number; avgDeviationPercent: number; successRate: number; count: number } => {
      const avgCalories = days.reduce((s, d) => s + d.actual_calories, 0) / days.length;
      const avgDeviation =
        days.reduce((s, d) => s + Number(d.deviation_percentage), 0) / days.length;
      const successCount = days.filter(
        (d) => Math.abs(Number(d.deviation_percentage)) <= SUCCESS_THRESHOLD
      ).length;

      return {
        avgCalories: Math.round(avgCalories),
        avgDeviationPercent: Math.round(avgDeviation * 10) / 10,
        successRate: Math.round((successCount / days.length) * 100),
        count: days.length,
      };
    };

    const workoutStats = calcStats(workoutDays);
    const restStats = calcStats(restDays);

    return {
      workoutDays: workoutStats,
      restDays: restStats,
      difference: workoutStats.avgCalories - restStats.avgCalories,
    };
  }

  /**
   * Identify recurring blockers from user feedback
   */
  async identifyBlockers(
    userId: string,
    _analyses?: Array<{
      date: Date;
      deviationPercent: number;
      deviationReason: string | null;
    }>
  ): Promise<Blocker[]> {
    // Get analyses with deviation reasons
    const result = await query<{
      deviation_reason: string;
      deviation_percentage: number;
      count: number;
    }>(
      `SELECT deviation_reason,
              AVG(deviation_percentage) as deviation_percentage,
              COUNT(*) as count
       FROM nutrition_daily_analysis
       WHERE user_id = $1
         AND deviation_reason IS NOT NULL
         AND deviation_classification IN ('significant_under', 'severe_under', 'significant_over', 'severe_over')
       GROUP BY deviation_reason
       HAVING COUNT(*) >= 2
       ORDER BY count DESC`,
      [userId]
    );

    const blockers: Blocker[] = result.rows.map((row) => {
      const reason = row.deviation_reason;
      let suggestion = '';

      switch (reason) {
        case 'busy':
          suggestion =
            'Consider meal prepping on weekends or keeping healthy snacks accessible for busy days.';
          break;
        case 'social_event':
          suggestion =
            "Social events are part of life! Try eating lighter meals before events, and don't stress about occasional overages.";
          break;
        case 'stress':
          suggestion =
            'Stress affects eating patterns. Consider logging your stress level daily so we can better support you.';
          break;
        case 'travel':
          suggestion =
            'Travel disrupts routines. Pack healthy snacks and identify restaurants with nutritious options in advance.';
          break;
        case 'forgot':
          suggestion =
            'Setting meal reminders might help. Would you like me to help you configure those?';
          break;
        case 'sick':
          suggestion =
            "When you're not feeling well, nutrition takes a back seat - and that's okay. Focus on recovery.";
          break;
        default:
          suggestion = 'Understanding your patterns helps us provide better support.';
      }

      return {
        type: reason,
        reason: this.formatBlockerReason(reason),
        frequency: Number(row.count),
        avgDeviationWhenOccurs: Math.round(Number(row.deviation_percentage) * 10) / 10,
        suggestion,
      };
    });

    return blockers;
  }

  /**
   * Update pattern after new analysis
   */
  async updatePatternsFromAnalysis(analysis: {
    userId: string;
    date: Date;
    deviationPercent: number;
    classification: DeviationClassification;
    whoopWorkoutCalories: number;
  }): Promise<void> {
    const { userId, date, deviationPercent, classification, whoopWorkoutCalories } = analysis;

    // Update day-of-week pattern
    const dayOfWeek = DAY_NAMES[date.getDay()];
    await this.incrementPatternOccurrence(
      userId,
      'day_of_week',
      dayOfWeek,
      deviationPercent,
      classification
    );

    // Update workout-day pattern
    const isWorkoutDay = whoopWorkoutCalories > 100;
    const workoutKey = isWorkoutDay ? 'workout_day' : 'rest_day';
    await this.incrementPatternOccurrence(
      userId,
      'workout_day',
      workoutKey,
      deviationPercent,
      classification
    );

    logger.debug('[NutritionLearning] Patterns updated', {
      userId,
      date: date.toISOString().split('T')[0],
      dayOfWeek,
      isWorkoutDay,
    });
  }

  /**
   * Get personalized recommendations based on patterns
   */
  async getPersonalizedRecommendations(userId: string): Promise<string[]> {
    const patterns = await this.getActivePatterns(userId);
    const blockers = await this.identifyBlockers(userId);

    return this.generateRecommendations(patterns, blockers);
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  private async getAnalysisHistory(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<
    Array<{
      date: Date;
      deviationPercent: number;
      classification: DeviationClassification;
      deviationReason: string | null;
    }>
  > {
    const result = await query<{
      analysis_date: string;
      deviation_percentage: number;
      deviation_classification: DeviationClassification;
      deviation_reason: string | null;
    }>(
      `SELECT analysis_date, deviation_percentage, deviation_classification, deviation_reason
       FROM nutrition_daily_analysis
       WHERE user_id = $1
         AND analysis_date >= $2::date
         AND analysis_date <= $3::date
       ORDER BY analysis_date ASC`,
      [userId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
    );

    return result.rows.map((row) => ({
      date: new Date(row.analysis_date),
      deviationPercent: Number(row.deviation_percentage),
      classification: row.deviation_classification,
      deviationReason: row.deviation_reason,
    }));
  }

  private async upsertPattern(
    userId: string,
    patternType: PatternType,
    patternKey: string,
    data: {
      occurrences: number;
      successRate: number;
      averageDeviation: number;
      averageDeviationPercent: number;
      patternDetails: Record<string, unknown>;
    }
  ): Promise<AdherencePattern | null> {
    const confidenceScore = Math.min(
      100,
      (data.occurrences / MIN_OBSERVATIONS_FOR_VALIDITY) * CONFIDENCE_THRESHOLD * 100
    );
    const isValid = data.occurrences >= MIN_OBSERVATIONS_FOR_VALIDITY;

    // Generate AI insight
    const aiInsight = this.generatePatternInsight(patternType, patternKey, data);
    const recommendation = this.generatePatternRecommendation(patternType, patternKey, data);

    const result = await query<{ id: string }>(
      `INSERT INTO nutrition_adherence_patterns (
        user_id, pattern_type, pattern_key,
        occurrences, total_observations, success_rate,
        average_deviation, average_deviation_percent,
        pattern_details, last_occurrence,
        ai_insight, recommendation,
        confidence_score, is_valid, is_active
      ) VALUES (
        $1, $2, $3,
        $4, $4, $5,
        $6, $7,
        $8, CURRENT_DATE,
        $9, $10,
        $11, $12, true
      )
      ON CONFLICT (user_id, pattern_type, pattern_key) DO UPDATE SET
        occurrences = EXCLUDED.occurrences,
        total_observations = EXCLUDED.total_observations,
        success_rate = EXCLUDED.success_rate,
        average_deviation = EXCLUDED.average_deviation,
        average_deviation_percent = EXCLUDED.average_deviation_percent,
        pattern_details = EXCLUDED.pattern_details,
        last_occurrence = EXCLUDED.last_occurrence,
        ai_insight = EXCLUDED.ai_insight,
        recommendation = EXCLUDED.recommendation,
        confidence_score = EXCLUDED.confidence_score,
        is_valid = EXCLUDED.is_valid,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id`,
      [
        userId,
        patternType,
        patternKey,
        data.occurrences,
        data.successRate,
        data.averageDeviation,
        data.averageDeviationPercent,
        JSON.stringify(data.patternDetails),
        aiInsight,
        recommendation,
        confidenceScore,
        isValid,
      ]
    );

    if (result.rows.length === 0) return null;

    return {
      id: result.rows[0].id,
      userId,
      patternType,
      patternKey,
      occurrences: data.occurrences,
      totalObservations: data.occurrences,
      successRate: data.successRate,
      averageDeviation: data.averageDeviation,
      averageDeviationPercent: data.averageDeviationPercent,
      patternDetails: data.patternDetails,
      firstObserved: null,
      lastOccurrence: new Date(),
      streakCount: 0,
      aiInsight,
      recommendation,
      interventionType: null,
      confidenceScore,
      isValid,
      isActive: true,
    };
  }

  private async incrementPatternOccurrence(
    userId: string,
    patternType: PatternType,
    patternKey: string,
    deviationPercent: number,
    _classification: DeviationClassification
  ): Promise<void> {
    const isSuccess = Math.abs(deviationPercent) <= SUCCESS_THRESHOLD;

    await query(
      `INSERT INTO nutrition_adherence_patterns (
        user_id, pattern_type, pattern_key,
        occurrences, total_observations, success_rate,
        average_deviation_percent, last_occurrence,
        confidence_score, is_valid, is_active
      ) VALUES (
        $1, $2, $3,
        1, 1, $4,
        $5, CURRENT_DATE,
        20, false, true
      )
      ON CONFLICT (user_id, pattern_type, pattern_key) DO UPDATE SET
        occurrences = nutrition_adherence_patterns.occurrences + 1,
        total_observations = nutrition_adherence_patterns.total_observations + 1,
        success_rate = (
          (nutrition_adherence_patterns.success_rate * nutrition_adherence_patterns.occurrences + $4) /
          (nutrition_adherence_patterns.occurrences + 1)
        ),
        average_deviation_percent = (
          (nutrition_adherence_patterns.average_deviation_percent * nutrition_adherence_patterns.occurrences + $5) /
          (nutrition_adherence_patterns.occurrences + 1)
        ),
        last_occurrence = CURRENT_DATE,
        confidence_score = LEAST(100, ((nutrition_adherence_patterns.occurrences + 1) / $6::float) * $7 * 100),
        is_valid = (nutrition_adherence_patterns.occurrences + 1) >= $6,
        updated_at = CURRENT_TIMESTAMP`,
      [
        userId,
        patternType,
        patternKey,
        isSuccess ? 100 : 0,
        deviationPercent,
        MIN_OBSERVATIONS_FOR_VALIDITY,
        CONFIDENCE_THRESHOLD,
      ]
    );
  }

  private async getActivePatterns(userId: string): Promise<AdherencePattern[]> {
    const result = await query<{
      id: string;
      pattern_type: PatternType;
      pattern_key: string;
      occurrences: number;
      total_observations: number;
      success_rate: number;
      average_deviation: number;
      average_deviation_percent: number;
      pattern_details: Record<string, unknown>;
      ai_insight: string | null;
      recommendation: string | null;
      confidence_score: number;
      is_valid: boolean;
    }>(
      `SELECT * FROM nutrition_adherence_patterns
       WHERE user_id = $1 AND is_active = true AND is_valid = true
       ORDER BY confidence_score DESC`,
      [userId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId,
      patternType: row.pattern_type,
      patternKey: row.pattern_key,
      occurrences: row.occurrences,
      totalObservations: row.total_observations,
      successRate: Number(row.success_rate),
      averageDeviation: Number(row.average_deviation) || 0,
      averageDeviationPercent: Number(row.average_deviation_percent),
      patternDetails: row.pattern_details,
      firstObserved: null,
      lastOccurrence: null,
      streakCount: 0,
      aiInsight: row.ai_insight,
      recommendation: row.recommendation,
      interventionType: null,
      confidenceScore: Number(row.confidence_score),
      isValid: row.is_valid,
      isActive: true,
    }));
  }

  private identifyStrengths(
    dayPatterns: DayPattern[],
    workoutPattern: WorkoutNutritionPattern | null
  ): string[] {
    const strengths: string[] = [];

    // Best days
    const bestDays = dayPatterns
      .filter((d) => d.successRate >= 70 && d.observations >= 3)
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 2);

    if (bestDays.length > 0) {
      const dayNames = bestDays.map((d) => d.dayOfWeek).join(' and ');
      strengths.push(`You're most consistent on ${dayNames} (${bestDays[0].successRate}% on target).`);
    }

    // Good workout-day nutrition
    if (workoutPattern && workoutPattern.workoutDays.successRate >= 60) {
      strengths.push(
        `You fuel your workouts well - ${workoutPattern.workoutDays.successRate}% on target on training days.`
      );
    }

    // Overall consistency
    const avgSuccessRate =
      dayPatterns.reduce((s, d) => s + d.successRate * d.observations, 0) /
      dayPatterns.reduce((s, d) => s + d.observations, 0);

    if (avgSuccessRate >= 70) {
      strengths.push(
        `Your overall consistency is excellent - ${Math.round(avgSuccessRate)}% on target.`
      );
    }

    return strengths;
  }

  private identifyChallenges(
    dayPatterns: DayPattern[],
    workoutPattern: WorkoutNutritionPattern | null,
    blockers: Blocker[]
  ): string[] {
    const challenges: string[] = [];

    // Challenging days
    const hardDays = dayPatterns
      .filter((d) => d.successRate < 50 && d.observations >= 3)
      .sort((a, b) => a.successRate - b.successRate)
      .slice(0, 2);

    if (hardDays.length > 0) {
      const dayNames = hardDays.map((d) => d.dayOfWeek).join(' and ');
      challenges.push(
        `${dayNames} tend to be challenging (${hardDays[0].successRate}% on target).`
      );
    }

    // Undereating on workout days
    if (
      workoutPattern &&
      workoutPattern.difference < -200 &&
      workoutPattern.workoutDays.successRate < 50
    ) {
      challenges.push(
        `You tend to undereat on workout days (${Math.abs(workoutPattern.difference)} fewer calories than rest days).`
      );
    }

    // Top blockers
    if (blockers.length > 0) {
      const topBlocker = blockers[0];
      challenges.push(
        `${topBlocker.reason} has affected your nutrition ${topBlocker.frequency} times recently.`
      );
    }

    return challenges;
  }

  private generateRecommendations(
    patterns: AdherencePattern[],
    blockers: Blocker[]
  ): string[] {
    const recommendations: string[] = [];

    // Day-specific recommendations
    const lowSuccessDays = patterns
      .filter((p) => p.patternType === 'day_of_week' && p.successRate < 50)
      .sort((a, b) => a.successRate - b.successRate);

    if (lowSuccessDays.length > 0) {
      const day = lowSuccessDays[0].patternKey;
      recommendations.push(
        `Consider meal prepping for ${day}s - they seem to be your toughest days.`
      );
    }

    // Blocker recommendations
    for (const blocker of blockers.slice(0, 2)) {
      recommendations.push(blocker.suggestion);
    }

    // General recommendations if no specific issues
    if (recommendations.length === 0) {
      recommendations.push(
        "You're doing well! Keep logging meals to build more insights about your patterns."
      );
    }

    return recommendations;
  }

  private generatePatternInsight(
    patternType: PatternType,
    patternKey: string,
    data: { successRate: number; averageDeviationPercent: number }
  ): string {
    if (patternType === 'day_of_week') {
      if (data.successRate >= 70) {
        return `${this.capitalize(patternKey)} is one of your strongest days for nutrition consistency.`;
      } else if (data.successRate < 50) {
        return `${this.capitalize(patternKey)} tends to be challenging - you're ${Math.abs(data.averageDeviationPercent).toFixed(1)}% ${data.averageDeviationPercent < 0 ? 'under' : 'over'} target on average.`;
      }
    }

    if (patternType === 'workout_day') {
      if (patternKey === 'eats_more_on_workout') {
        return 'You naturally eat more on workout days, which is your body asking for fuel.';
      } else {
        return 'You tend to eat less on workout days. This could be appetite suppression from exercise.';
      }
    }

    return '';
  }

  private generatePatternRecommendation(
    patternType: PatternType,
    patternKey: string,
    data: { successRate: number; averageDeviationPercent: number }
  ): string {
    if (patternType === 'day_of_week' && data.successRate < 50) {
      return `Try preparing meals in advance for ${patternKey}s, or set extra reminders to log meals.`;
    }

    if (patternType === 'workout_day' && patternKey === 'eats_less_on_workout') {
      return 'Consider having a post-workout snack or meal prepared in advance to ensure adequate recovery nutrition.';
    }

    return '';
  }

  private formatBlockerReason(reason: string): string {
    const formatted: Record<string, string> = {
      busy: 'Busy schedule',
      social_event: 'Social events',
      stress: 'Stress-related',
      travel: 'Travel',
      forgot: 'Forgetting to log',
      sick: 'Illness',
      intentional: 'Intentional deviation',
      unintentional: 'Unintentional deviation',
    };
    return formatted[reason] || reason;
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

export const nutritionLearningService = new NutritionLearningService();
