/**
 * Nutrition Analysis Service
 *
 * Provides automated daily nutrition analysis functionality:
 * - Aggregates meal logs for a given day
 * - Calculates deviation from targets
 * - Classifies deviations
 * - Fetches WHOOP context (workout calories, recovery, strain)
 * - Stores analysis results
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';

// ============================================
// TYPES
// ============================================

export type DeviationClassification =
  | 'on_target'           // Within ±5%
  | 'minor_under'         // -5% to -15%
  | 'significant_under'   // -15% to -30%
  | 'severe_under'        // > -30%
  | 'minor_over'          // +5% to +15%
  | 'significant_over'    // +15% to +30%
  | 'severe_over'         // > +30%
  | 'missed_day';         // No meals logged

export type DeviationReason =
  | 'intentional'
  | 'unintentional'
  | 'sick'
  | 'social_event'
  | 'forgot'
  | 'busy'
  | 'travel'
  | 'stress'
  | null;

export type AnalysisStatus =
  | 'analyzed'
  | 'pending_user_input'
  | 'adjustment_created'
  | 'dismissed';

export interface MealLogSummary {
  id: string;
  mealType: string;
  mealName: string | null;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  eatenAt: Date;
  hungerBefore: number | null;
  satisfactionAfter: number | null;
}

export interface DailyNutritionSummary {
  date: Date;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  mealCount: number;
  mealsLogged: MealLogSummary[];
  avgHungerBefore: number | null;
  avgSatisfactionAfter: number | null;
}

export interface NutritionTargets {
  calories: number;
  proteinGrams: number | null;
  carbsGrams: number | null;
  fatGrams: number | null;
  dietPlanId: string | null;
  dietPlanName: string | null;
}

export interface WhoopDayContext {
  workoutCalories: number;
  recoveryScore: number | null;
  strainScore: number | null;
  hasWorkout: boolean;
  workoutCount: number;
}

export interface DeviationAnalysis {
  calorieDeviation: number;         // Positive = over, negative = under
  deviationPercent: number;
  classification: DeviationClassification;
  proteinDeviation: number | null;
  carbsDeviation: number | null;
  fatDeviation: number | null;
}

export interface AIRecommendation {
  type: 'adjustment' | 'insight' | 'encouragement' | 'warning';
  message: string;
  priority: 'high' | 'medium' | 'low';
}

export interface AnalysisResult {
  id: string;
  userId: string;
  date: Date;
  summary: DailyNutritionSummary;
  targets: NutritionTargets;
  deviation: DeviationAnalysis;
  whoopContext: WhoopDayContext;
  aiAnalysis: string | null;
  aiRecommendations: AIRecommendation[];
  status: AnalysisStatus;
  deviationReason: DeviationReason;
  userNotes: string | null;
}

export interface CreateAnalysisInput {
  userId: string;
  date: Date;
  forceReanalyze?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const DEVIATION_THRESHOLDS = {
  onTarget: 5,           // ±5%
  minor: 15,             // ±5% to ±15%
  significant: 30,       // ±15% to ±30%
  // > 30% is severe
};

// ============================================
// SERVICE CLASS
// ============================================

class NutritionAnalysisService {
  /**
   * Analyze a single day's nutrition for a user
   */
  async analyzeDailyNutrition(input: CreateAnalysisInput): Promise<AnalysisResult | null> {
    const { userId, date, forceReanalyze = false } = input;
    const dateStr = this.formatDate(date);

    logger.info('[NutritionAnalysis] Starting daily analysis', {
      userId,
      date: dateStr,
      forceReanalyze,
    });

    try {
      // Check if analysis already exists for this day
      if (!forceReanalyze) {
        const existing = await this.getExistingAnalysis(userId, dateStr);
        if (existing) {
          logger.debug('[NutritionAnalysis] Using existing analysis', {
            userId,
            date: dateStr,
            analysisId: existing.id,
          });
          return existing;
        }
      }

      // Get user's active diet plan targets
      const targets = await this.getUserTargets(userId);
      if (!targets || targets.calories === 0) {
        logger.warn('[NutritionAnalysis] No active diet plan with calorie targets', {
          userId,
        });
        return null;
      }

      // Get daily meal summary
      const summary = await this.getDailyMealSummary(userId, date);

      // Get WHOOP context for the day
      const whoopContext = await this.getWhoopDayContext(userId, date);

      // Calculate deviation
      const deviation = this.calculateDeviation(summary, targets);

      // Generate AI analysis (placeholder for now)
      const aiAnalysis = this.generateBasicAnalysis(summary, targets, deviation, whoopContext);
      const aiRecommendations = this.generateRecommendations(deviation, whoopContext);

      // Determine initial status
      const status: AnalysisStatus =
        deviation.classification === 'on_target' ? 'analyzed' : 'analyzed';

      // Store analysis
      const analysisId = await this.storeAnalysis({
        userId,
        date: dateStr,
        dietPlanId: targets.dietPlanId,
        targets,
        summary,
        deviation,
        whoopContext,
        aiAnalysis,
        aiRecommendations,
        status,
      });

      logger.info('[NutritionAnalysis] Analysis completed', {
        userId,
        date: dateStr,
        analysisId,
        classification: deviation.classification,
        deviationPercent: deviation.deviationPercent,
      });

      return {
        id: analysisId,
        userId,
        date,
        summary,
        targets,
        deviation,
        whoopContext,
        aiAnalysis,
        aiRecommendations,
        status,
        deviationReason: null,
        userNotes: null,
      };
    } catch (error) {
      logger.error('[NutritionAnalysis] Failed to analyze daily nutrition', {
        userId,
        date: dateStr,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get existing analysis for a specific day
   */
  async getExistingAnalysis(userId: string, date: string): Promise<AnalysisResult | null> {
    const result = await query<{
      id: string;
      user_id: string;
      diet_plan_id: string | null;
      analysis_date: string;
      target_calories: number;
      target_protein_g: number | null;
      target_carbs_g: number | null;
      target_fat_g: number | null;
      actual_calories: number;
      actual_protein_g: number;
      actual_carbs_g: number;
      actual_fat_g: number;
      meals_logged: number;
      calorie_deviation: number;
      deviation_percentage: number;
      deviation_classification: DeviationClassification;
      whoop_workout_calories: number | null;
      whoop_recovery_score: number | null;
      whoop_strain_score: number | null;
      deviation_reason: DeviationReason;
      user_notes: string | null;
      ai_analysis: string | null;
      ai_recommendations: AIRecommendation[];
      status: AnalysisStatus;
    }>(
      `SELECT * FROM nutrition_daily_analysis
       WHERE user_id = $1 AND analysis_date = $2`,
      [userId, date]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];

    // Get meal details for this day
    const summary = await this.getDailyMealSummary(userId, new Date(date));

    return {
      id: row.id,
      userId: row.user_id,
      date: new Date(row.analysis_date),
      summary,
      targets: {
        calories: row.target_calories,
        proteinGrams: row.target_protein_g,
        carbsGrams: row.target_carbs_g,
        fatGrams: row.target_fat_g,
        dietPlanId: row.diet_plan_id,
        dietPlanName: null, // Would need join to get this
      },
      deviation: {
        calorieDeviation: row.calorie_deviation,
        deviationPercent: Number(row.deviation_percentage),
        classification: row.deviation_classification,
        proteinDeviation: null,
        carbsDeviation: null,
        fatDeviation: null,
      },
      whoopContext: {
        workoutCalories: row.whoop_workout_calories || 0,
        recoveryScore: row.whoop_recovery_score,
        strainScore: row.whoop_strain_score ? Number(row.whoop_strain_score) : null,
        hasWorkout: (row.whoop_workout_calories || 0) > 0,
        workoutCount: 0,
      },
      aiAnalysis: row.ai_analysis,
      aiRecommendations: row.ai_recommendations || [],
      status: row.status,
      deviationReason: row.deviation_reason,
      userNotes: row.user_notes,
    };
  }

  /**
   * Get user's active diet plan targets
   */
  async getUserTargets(userId: string): Promise<NutritionTargets | null> {
    const result = await query<{
      id: string;
      name: string;
      daily_calories: number | null;
      protein_grams: number | null;
      carbs_grams: number | null;
      fat_grams: number | null;
    }>(
      `SELECT id, name, daily_calories, protein_grams, carbs_grams, fat_grams
       FROM diet_plans
       WHERE user_id = $1 AND status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const plan = result.rows[0];
    return {
      calories: plan.daily_calories || 0,
      proteinGrams: plan.protein_grams,
      carbsGrams: plan.carbs_grams,
      fatGrams: plan.fat_grams,
      dietPlanId: plan.id,
      dietPlanName: plan.name,
    };
  }

  /**
   * Get aggregated meal data for a day
   */
  async getDailyMealSummary(userId: string, date: Date): Promise<DailyNutritionSummary> {
    const dateStr = this.formatDate(date);
    const nextDateStr = this.formatDate(new Date(date.getTime() + 24 * 60 * 60 * 1000));

    // Get individual meals
    const mealsResult = await query<{
      id: string;
      meal_type: string;
      meal_name: string | null;
      calories: number | null;
      protein_grams: number | null;
      carbs_grams: number | null;
      fat_grams: number | null;
      eaten_at: string;
      hunger_before: number | null;
      satisfaction_after: number | null;
    }>(
      `SELECT id, meal_type, meal_name, calories, protein_grams, carbs_grams, fat_grams,
              eaten_at, hunger_before, satisfaction_after
       FROM meal_logs
       WHERE user_id = $1
         AND eaten_at >= $2::date
         AND eaten_at < $3::date
       ORDER BY eaten_at ASC`,
      [userId, dateStr, nextDateStr]
    );

    const meals: MealLogSummary[] = mealsResult.rows.map((row) => ({
      id: row.id,
      mealType: row.meal_type,
      mealName: row.meal_name,
      calories: row.calories || 0,
      proteinGrams: row.protein_grams || 0,
      carbsGrams: row.carbs_grams || 0,
      fatGrams: row.fat_grams || 0,
      eatenAt: new Date(row.eaten_at),
      hungerBefore: row.hunger_before,
      satisfactionAfter: row.satisfaction_after,
    }));

    // Calculate totals
    const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0);
    const totalProtein = meals.reduce((sum, m) => sum + m.proteinGrams, 0);
    const totalCarbs = meals.reduce((sum, m) => sum + m.carbsGrams, 0);
    const totalFat = meals.reduce((sum, m) => sum + m.fatGrams, 0);

    // Calculate averages for hunger and satisfaction
    const hungerValues = meals.filter((m) => m.hungerBefore !== null).map((m) => m.hungerBefore!);
    const satisfactionValues = meals
      .filter((m) => m.satisfactionAfter !== null)
      .map((m) => m.satisfactionAfter!);

    const avgHunger =
      hungerValues.length > 0
        ? hungerValues.reduce((sum, v) => sum + v, 0) / hungerValues.length
        : null;
    const avgSatisfaction =
      satisfactionValues.length > 0
        ? satisfactionValues.reduce((sum, v) => sum + v, 0) / satisfactionValues.length
        : null;

    return {
      date,
      totalCalories,
      totalProtein,
      totalCarbs,
      totalFat,
      mealCount: meals.length,
      mealsLogged: meals,
      avgHungerBefore: avgHunger !== null ? Math.round(avgHunger * 10) / 10 : null,
      avgSatisfactionAfter: avgSatisfaction !== null ? Math.round(avgSatisfaction * 10) / 10 : null,
    };
  }

  /**
   * Get WHOOP data for the day
   */
  async getWhoopDayContext(userId: string, date: Date): Promise<WhoopDayContext> {
    const dateStr = this.formatDate(date);

    // Get workout data from health_data_records (WHOOP workouts)
    const workoutResult = await query<{
      calories_kcal: number | null;
    }>(
      `SELECT calories_kcal
       FROM health_data_records
       WHERE user_id = $1
         AND data_type = 'workout'
         AND DATE(recorded_at) = $2::date`,
      [userId, dateStr]
    );

    const workoutCalories = workoutResult.rows.reduce(
      (sum, row) => sum + (row.calories_kcal || 0),
      0
    );

    // Get recovery and strain from daily_health_metrics
    const metricsResult = await query<{
      recovery_score: number | null;
      strain_score: number | null;
    }>(
      `SELECT recovery_score, strain_score
       FROM daily_health_metrics
       WHERE user_id = $1 AND metric_date = $2::date`,
      [userId, dateStr]
    );

    const metrics = metricsResult.rows[0];

    return {
      workoutCalories: Math.round(workoutCalories),
      recoveryScore: metrics?.recovery_score || null,
      strainScore: metrics?.strain_score ? Number(metrics.strain_score) : null,
      hasWorkout: workoutResult.rows.length > 0,
      workoutCount: workoutResult.rows.length,
    };
  }

  /**
   * Calculate deviation from targets
   */
  calculateDeviation(
    summary: DailyNutritionSummary,
    targets: NutritionTargets
  ): DeviationAnalysis {
    // Check for missed day
    if (summary.mealCount === 0) {
      return {
        calorieDeviation: -targets.calories,
        deviationPercent: -100,
        classification: 'missed_day',
        proteinDeviation: null,
        carbsDeviation: null,
        fatDeviation: null,
      };
    }

    const calorieDeviation = summary.totalCalories - targets.calories;
    const deviationPercent =
      targets.calories > 0 ? (calorieDeviation / targets.calories) * 100 : 0;

    // Classify deviation
    const classification = this.classifyDeviation(deviationPercent);

    // Calculate macro deviations if targets exist
    const proteinDeviation =
      targets.proteinGrams !== null ? summary.totalProtein - targets.proteinGrams : null;
    const carbsDeviation =
      targets.carbsGrams !== null ? summary.totalCarbs - targets.carbsGrams : null;
    const fatDeviation =
      targets.fatGrams !== null ? summary.totalFat - targets.fatGrams : null;

    return {
      calorieDeviation,
      deviationPercent: Math.round(deviationPercent * 10) / 10,
      classification,
      proteinDeviation,
      carbsDeviation,
      fatDeviation,
    };
  }

  /**
   * Classify deviation percentage into categories
   */
  classifyDeviation(deviationPercent: number): DeviationClassification {
    const absPercent = Math.abs(deviationPercent);
    const isUnder = deviationPercent < 0;

    if (absPercent <= DEVIATION_THRESHOLDS.onTarget) {
      return 'on_target';
    }

    if (absPercent <= DEVIATION_THRESHOLDS.minor) {
      return isUnder ? 'minor_under' : 'minor_over';
    }

    if (absPercent <= DEVIATION_THRESHOLDS.significant) {
      return isUnder ? 'significant_under' : 'significant_over';
    }

    return isUnder ? 'severe_under' : 'severe_over';
  }

  /**
   * Generate basic AI analysis text
   */
  private generateBasicAnalysis(
    summary: DailyNutritionSummary,
    targets: NutritionTargets,
    deviation: DeviationAnalysis,
    whoopContext: WhoopDayContext
  ): string {
    if (deviation.classification === 'missed_day') {
      return "No meals were logged yesterday. That's okay - life happens! Would you like to quickly log what you remember eating, or shall we move forward?";
    }

    const absPercent = Math.abs(deviation.deviationPercent);
    const isUnder = deviation.calorieDeviation < 0;

    let analysis = '';

    // On target
    if (deviation.classification === 'on_target') {
      analysis = `Great job! You hit your target of ${targets.calories} calories with ${summary.totalCalories} consumed. `;
      if (whoopContext.hasWorkout) {
        analysis += `Especially impressive given your ${whoopContext.workoutCalories} cal workout burn!`;
      }
      return analysis;
    }

    // Under consumption
    if (isUnder) {
      analysis = `You consumed ${summary.totalCalories} calories, which is ${Math.abs(deviation.calorieDeviation)} cal (${absPercent.toFixed(1)}%) under your target. `;

      if (whoopContext.hasWorkout && whoopContext.workoutCalories > 200) {
        analysis += `With your ${whoopContext.workoutCalories} cal workout, your body might need some extra fuel. `;
      }

      if (deviation.classification === 'minor_under') {
        analysis += "This is a small deviation - nothing to stress about.";
      } else if (deviation.classification === 'significant_under') {
        analysis += "Would you like to add a bit more to your next few days to stay on track?";
      } else {
        analysis += "Let's talk about what happened and find a sustainable path forward.";
      }
    }
    // Over consumption
    else {
      analysis = `You consumed ${summary.totalCalories} calories, which is ${deviation.calorieDeviation} cal (${absPercent.toFixed(1)}%) over your target. `;

      if (deviation.classification === 'minor_over') {
        analysis += "One day above target isn't a big deal - your body naturally adjusts.";
      } else if (deviation.classification === 'significant_over') {
        analysis += "Special occasion or just extra hungry? Either way, one day doesn't define your progress.";
      } else {
        analysis += "Let's not stress about making up for it - a gentle approach works better than restriction.";
      }
    }

    return analysis;
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    deviation: DeviationAnalysis,
    whoopContext: WhoopDayContext
  ): AIRecommendation[] {
    const recommendations: AIRecommendation[] = [];

    // Missed day recommendations
    if (deviation.classification === 'missed_day') {
      recommendations.push({
        type: 'insight',
        message: 'Consider setting meal reminders to help with consistent logging.',
        priority: 'medium',
      });
      return recommendations;
    }

    // On target - celebrate
    if (deviation.classification === 'on_target') {
      recommendations.push({
        type: 'encouragement',
        message: "You're building great consistency! Keep it up.",
        priority: 'low',
      });
      return recommendations;
    }

    // Under consumption recommendations
    if (deviation.calorieDeviation < 0) {
      if (whoopContext.recoveryScore !== null && whoopContext.recoveryScore < 50) {
        recommendations.push({
          type: 'insight',
          message:
            'Your recovery is lower today. Focus on eating well rather than catching up - good nutrition helps recovery.',
          priority: 'high',
        });
      }

      if (deviation.classification !== 'minor_under') {
        recommendations.push({
          type: 'adjustment',
          message:
            'Would you like to add a small amount to your calorie target over the next few days?',
          priority: 'medium',
        });
      }
    }

    // Over consumption recommendations
    if (deviation.calorieDeviation > 0) {
      recommendations.push({
        type: 'insight',
        message:
          'Your body may naturally want less tomorrow. Listen to your hunger cues rather than restricting.',
        priority: 'medium',
      });

      if (whoopContext.hasWorkout) {
        recommendations.push({
          type: 'encouragement',
          message:
            'Active days often mean more hunger - fueling workouts is part of the process.',
          priority: 'low',
        });
      }
    }

    return recommendations;
  }

  /**
   * Store analysis in database
   */
  private async storeAnalysis(data: {
    userId: string;
    date: string;
    dietPlanId: string | null;
    targets: NutritionTargets;
    summary: DailyNutritionSummary;
    deviation: DeviationAnalysis;
    whoopContext: WhoopDayContext;
    aiAnalysis: string | null;
    aiRecommendations: AIRecommendation[];
    status: AnalysisStatus;
  }): Promise<string> {
    const result = await query<{ id: string }>(
      `INSERT INTO nutrition_daily_analysis (
        user_id, diet_plan_id, analysis_date,
        target_calories, target_protein_g, target_carbs_g, target_fat_g,
        actual_calories, actual_protein_g, actual_carbs_g, actual_fat_g, meals_logged,
        calorie_deviation, deviation_percentage, deviation_classification,
        whoop_workout_calories, whoop_recovery_score, whoop_strain_score,
        ai_analysis, ai_recommendations, status
      ) VALUES (
        $1, $2, $3,
        $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15,
        $16, $17, $18,
        $19, $20, $21
      )
      ON CONFLICT (user_id, analysis_date) DO UPDATE SET
        diet_plan_id = EXCLUDED.diet_plan_id,
        target_calories = EXCLUDED.target_calories,
        target_protein_g = EXCLUDED.target_protein_g,
        target_carbs_g = EXCLUDED.target_carbs_g,
        target_fat_g = EXCLUDED.target_fat_g,
        actual_calories = EXCLUDED.actual_calories,
        actual_protein_g = EXCLUDED.actual_protein_g,
        actual_carbs_g = EXCLUDED.actual_carbs_g,
        actual_fat_g = EXCLUDED.actual_fat_g,
        meals_logged = EXCLUDED.meals_logged,
        calorie_deviation = EXCLUDED.calorie_deviation,
        deviation_percentage = EXCLUDED.deviation_percentage,
        deviation_classification = EXCLUDED.deviation_classification,
        whoop_workout_calories = EXCLUDED.whoop_workout_calories,
        whoop_recovery_score = EXCLUDED.whoop_recovery_score,
        whoop_strain_score = EXCLUDED.whoop_strain_score,
        ai_analysis = EXCLUDED.ai_analysis,
        ai_recommendations = EXCLUDED.ai_recommendations,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id`,
      [
        data.userId,
        data.dietPlanId,
        data.date,
        data.targets.calories,
        data.targets.proteinGrams,
        data.targets.carbsGrams,
        data.targets.fatGrams,
        data.summary.totalCalories,
        data.summary.totalProtein,
        data.summary.totalCarbs,
        data.summary.totalFat,
        data.summary.mealCount,
        data.deviation.calorieDeviation,
        data.deviation.deviationPercent,
        data.deviation.classification,
        data.whoopContext.workoutCalories,
        data.whoopContext.recoveryScore,
        data.whoopContext.strainScore,
        data.aiAnalysis,
        JSON.stringify(data.aiRecommendations),
        data.status,
      ]
    );

    return result.rows[0].id;
  }

  /**
   * Get analysis history for a user
   */
  async getAnalysisHistory(
    userId: string,
    options: { startDate?: Date; endDate?: Date; limit?: number } = {}
  ): Promise<AnalysisResult[]> {
    const { startDate, endDate, limit = 30 } = options;

    let whereClause = 'WHERE user_id = $1';
    const params: (string | number)[] = [userId];
    let paramIndex = 2;

    if (startDate) {
      whereClause += ` AND analysis_date >= $${paramIndex}::date`;
      params.push(this.formatDate(startDate));
      paramIndex++;
    }

    if (endDate) {
      whereClause += ` AND analysis_date <= $${paramIndex}::date`;
      params.push(this.formatDate(endDate));
      paramIndex++;
    }

    params.push(limit);

    const result = await query<{
      id: string;
      user_id: string;
      diet_plan_id: string | null;
      analysis_date: string;
      target_calories: number;
      actual_calories: number;
      calorie_deviation: number;
      deviation_percentage: number;
      deviation_classification: DeviationClassification;
      whoop_workout_calories: number | null;
      whoop_recovery_score: number | null;
      ai_analysis: string | null;
      status: AnalysisStatus;
    }>(
      `SELECT id, user_id, diet_plan_id, analysis_date,
              target_calories, actual_calories, calorie_deviation,
              deviation_percentage, deviation_classification,
              whoop_workout_calories, whoop_recovery_score,
              ai_analysis, status
       FROM nutrition_daily_analysis
       ${whereClause}
       ORDER BY analysis_date DESC
       LIMIT $${paramIndex}`,
      params
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      date: new Date(row.analysis_date),
      summary: {
        date: new Date(row.analysis_date),
        totalCalories: row.actual_calories,
        totalProtein: 0,
        totalCarbs: 0,
        totalFat: 0,
        mealCount: 0,
        mealsLogged: [],
        avgHungerBefore: null,
        avgSatisfactionAfter: null,
      },
      targets: {
        calories: row.target_calories,
        proteinGrams: null,
        carbsGrams: null,
        fatGrams: null,
        dietPlanId: row.diet_plan_id,
        dietPlanName: null,
      },
      deviation: {
        calorieDeviation: row.calorie_deviation,
        deviationPercent: Number(row.deviation_percentage),
        classification: row.deviation_classification,
        proteinDeviation: null,
        carbsDeviation: null,
        fatDeviation: null,
      },
      whoopContext: {
        workoutCalories: row.whoop_workout_calories || 0,
        recoveryScore: row.whoop_recovery_score,
        strainScore: null,
        hasWorkout: (row.whoop_workout_calories || 0) > 0,
        workoutCount: 0,
      },
      aiAnalysis: row.ai_analysis,
      aiRecommendations: [],
      status: row.status,
      deviationReason: null,
      userNotes: null,
    }));
  }

  /**
   * Update user feedback on analysis
   */
  async updateDeviationFeedback(
    analysisId: string,
    userId: string,
    feedback: { reason: DeviationReason; notes?: string }
  ): Promise<void> {
    await query(
      `UPDATE nutrition_daily_analysis
       SET deviation_reason = $1, user_notes = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND user_id = $4`,
      [feedback.reason, feedback.notes || null, analysisId, userId]
    );

    logger.info('[NutritionAnalysis] Feedback updated', {
      analysisId,
      userId,
      reason: feedback.reason,
    });
  }

  /**
   * Format date as YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}

export const nutritionAnalysisService = new NutritionAnalysisService();
