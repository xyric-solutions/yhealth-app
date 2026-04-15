/**
 * Adaptive Calorie Service
 *
 * Handles intelligent calorie redistribution when users deviate from targets:
 * - Generates redistribution plans (next_day, redistribute, gradual, skip)
 * - Applies safety limits
 * - Tracks user choices and adjustment effectiveness
 * - Integrates with WHOOP recovery data
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import {
  AnalysisResult,
} from './nutrition-analysis.service.js';

// ============================================
// TYPES
// ============================================

export type AdjustmentType = 'next_day' | 'redistribute' | 'gradual' | 'skip';

export type AdjustmentStatus =
  | 'proposed'
  | 'accepted'
  | 'active'
  | 'completed'
  | 'skipped'
  | 'expired';

export type UserChoice = 'accept' | 'modify' | 'skip' | null;

export interface NutritionUserPreferences {
  analysisTime: string;
  analysisEnabled: boolean;
  autoAdjustEnabled: boolean;
  maxDailyAdjustmentCalories: number;
  maxRedistributionDays: number;
  preferNextDayAdjustment: boolean;
  adjustmentStrategy: 'aggressive' | 'balanced' | 'conservative';
  notifyOnDeviation: boolean;
  deviationThresholdPercent: number;
  factorWorkoutCalories: boolean;
  workoutCalorieAddbackPercent: number;
  skipIfRecoveryBelow: number;
  increaseCarbsOnHighStrain: boolean;
}

export interface SafetyWarning {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface RedistributionPlan {
  [date: string]: number; // date -> calorie adjustment
}

export interface AdjustmentPlan {
  type: AdjustmentType;
  calorieDeficit: number;           // Original deficit (positive = under, negative = over)
  originalDeficit: number;
  redistributionDays: number;
  dailyAdjustment: number;          // Calories to add/subtract per day
  redistributionPlan: RedistributionPlan;
  skippedCalories: number;
  skipReason: string | null;
  safetyApproved: boolean;
  safetyWarnings: SafetyWarning[];
  coachingMessage: string;
}

export interface AdjustmentRecord {
  id: string;
  userId: string;
  analysisId: string;
  dietPlanId: string | null;
  type: AdjustmentType;
  calorieDeficit: number;
  originalDeficit: number;
  redistributionDays: number;
  dailyAdjustment: number;
  redistributionPlan: RedistributionPlan;
  skippedCalories: number;
  skipReason: string | null;
  userChoice: UserChoice;
  userModifiedPlan: RedistributionPlan | null;
  safetyApproved: boolean;
  safetyWarnings: SafetyWarning[];
  coachingMessage: string;
  status: AdjustmentStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  createdAt: Date;
}

export interface AdjustedTargets {
  baseCalories: number;
  adjustedCalories: number;
  adjustmentAmount: number;
  adjustmentReason: string;
  activeAdjustments: AdjustmentRecord[];
  workoutCalorieAdjustment: number;
}

export interface UserMetrics {
  gender: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say';
  goalType: string;
  baseCalories: number;
}

// ============================================
// CONSTANTS
// ============================================

const SAFETY_LIMITS = {
  minCaloriesMale: 1500,
  minCaloriesFemale: 1200,
  minCaloriesGeneral: 1200,
  maxDailyIncrease: 500,            // Max calories to add in one day
  maxDailyDecrease: 300,            // Max calories to subtract in one day
  maxRedistributionDays: 5,
  largeDeficitThreshold: 600,       // Deficit above this = gradual approach
  partialCompensationPercent: 50,   // For large deficits, only compensate this %
};

const DEFAULT_PREFERENCES: NutritionUserPreferences = {
  analysisTime: '21:00',
  analysisEnabled: true,
  autoAdjustEnabled: true,
  maxDailyAdjustmentCalories: 200,
  maxRedistributionDays: 3,
  preferNextDayAdjustment: false,
  adjustmentStrategy: 'balanced',
  notifyOnDeviation: true,
  deviationThresholdPercent: 15,
  factorWorkoutCalories: true,
  workoutCalorieAddbackPercent: 60,
  skipIfRecoveryBelow: 40,
  increaseCarbsOnHighStrain: true,
};

// ============================================
// SERVICE CLASS
// ============================================

class AdaptiveCalorieService {
  /**
   * Generate an adjustment plan based on analysis
   */
  async generateAdjustmentPlan(
    analysis: AnalysisResult,
    userPrefs: NutritionUserPreferences = DEFAULT_PREFERENCES,
    userMetrics?: UserMetrics
  ): Promise<AdjustmentPlan> {
    const { deviation, whoopContext } = analysis;

    logger.info('[AdaptiveCalorie] Generating adjustment plan', {
      userId: analysis.userId,
      classification: deviation.classification,
      calorieDeviation: deviation.calorieDeviation,
      recoveryScore: whoopContext.recoveryScore,
    });

    // For over-consumption, we generally don't recommend compensation
    // Just provide guidance
    if (deviation.calorieDeviation > 0) {
      return this.generateOverConsumptionPlan(analysis, userPrefs);
    }

    // For under-consumption, generate redistribution plan
    return this.generateUnderConsumptionPlan(analysis, userPrefs, userMetrics);
  }

  /**
   * Generate plan for under-consumption
   */
  private generateUnderConsumptionPlan(
    analysis: AnalysisResult,
    userPrefs: NutritionUserPreferences,
    userMetrics?: UserMetrics
  ): AdjustmentPlan {
    const { deviation, whoopContext } = analysis;
    const deficit = Math.abs(deviation.calorieDeviation); // Positive value

    // STEP 1: Check if we should skip based on recovery
    if (
      whoopContext.recoveryScore !== null &&
      whoopContext.recoveryScore < userPrefs.skipIfRecoveryBelow
    ) {
      return {
        type: 'skip',
        calorieDeficit: deficit,
        originalDeficit: deficit,
        redistributionDays: 0,
        dailyAdjustment: 0,
        redistributionPlan: {},
        skippedCalories: deficit,
        skipReason: 'low_recovery',
        safetyApproved: true,
        safetyWarnings: [],
        coachingMessage: this.generateLowRecoveryMessage(
          whoopContext.recoveryScore,
          deficit
        ),
      };
    }

    // STEP 2: Check for missed day - special handling
    if (deviation.classification === 'missed_day') {
      return {
        type: 'skip',
        calorieDeficit: deficit,
        originalDeficit: deficit,
        redistributionDays: 0,
        dailyAdjustment: 0,
        redistributionPlan: {},
        skippedCalories: deficit,
        skipReason: 'missed_day',
        safetyApproved: true,
        safetyWarnings: [],
        coachingMessage:
          "No meals were logged yesterday. Let's not try to make up for it - just focus on consistent eating today. Would you like to quickly log what you remember?",
      };
    }

    // STEP 3: Determine adjustment strategy
    const maxDaily = userPrefs.maxDailyAdjustmentCalories;
    const maxDays = userPrefs.maxRedistributionDays;

    let plan: AdjustmentPlan;

    // Small deficit: next day adjustment
    if (deficit <= maxDaily) {
      plan = this.generateNextDayPlan(deficit, userPrefs);
    }
    // Medium deficit: redistribute over multiple days
    else if (deficit <= maxDaily * maxDays) {
      plan = this.generateRedistributePlan(deficit, userPrefs);
    }
    // Large deficit: gradual approach with partial compensation
    else {
      plan = this.generateGradualPlan(deficit, userPrefs);
    }

    // STEP 4: Apply safety checks
    const safetyResult = this.applySafetyChecks(plan, analysis.targets.calories, userMetrics);
    plan.safetyApproved = safetyResult.approved;
    plan.safetyWarnings = safetyResult.warnings;

    // Adjust plan if safety requires
    if (safetyResult.adjustedDailyAmount !== plan.dailyAdjustment) {
      plan.dailyAdjustment = safetyResult.adjustedDailyAmount;
      plan.redistributionPlan = this.buildRedistributionPlan(
        plan.dailyAdjustment,
        plan.redistributionDays
      );
      plan.skippedCalories =
        plan.originalDeficit - plan.dailyAdjustment * plan.redistributionDays;
    }

    // STEP 5: Generate coaching message
    plan.coachingMessage = this.generateUnderCoachingMessage(plan, deviation.deviationPercent);

    return plan;
  }

  /**
   * Generate next-day adjustment plan
   */
  private generateNextDayPlan(
    deficit: number,
    _userPrefs: NutritionUserPreferences
  ): AdjustmentPlan {
    const tomorrow = this.getDateString(1);

    return {
      type: 'next_day',
      calorieDeficit: deficit,
      originalDeficit: deficit,
      redistributionDays: 1,
      dailyAdjustment: deficit,
      redistributionPlan: { [tomorrow]: deficit },
      skippedCalories: 0,
      skipReason: null,
      safetyApproved: true,
      safetyWarnings: [],
      coachingMessage: '',
    };
  }

  /**
   * Generate redistribute plan over multiple days
   */
  private generateRedistributePlan(
    deficit: number,
    userPrefs: NutritionUserPreferences
  ): AdjustmentPlan {
    const daysNeeded = Math.ceil(deficit / userPrefs.maxDailyAdjustmentCalories);
    const actualDays = Math.min(daysNeeded, userPrefs.maxRedistributionDays);
    const dailyAmount = Math.round(deficit / actualDays);
    const redistributionPlan = this.buildRedistributionPlan(dailyAmount, actualDays);

    return {
      type: 'redistribute',
      calorieDeficit: deficit,
      originalDeficit: deficit,
      redistributionDays: actualDays,
      dailyAdjustment: dailyAmount,
      redistributionPlan,
      skippedCalories: 0,
      skipReason: null,
      safetyApproved: true,
      safetyWarnings: [],
      coachingMessage: '',
    };
  }

  /**
   * Generate gradual plan for large deficits (partial compensation)
   */
  private generateGradualPlan(
    deficit: number,
    userPrefs: NutritionUserPreferences
  ): AdjustmentPlan {
    // Only compensate 50% of large deficits for sustainability
    const compensationAmount = Math.round(deficit * (SAFETY_LIMITS.partialCompensationPercent / 100));
    const skippedCalories = deficit - compensationAmount;

    const actualDays = userPrefs.maxRedistributionDays;
    const dailyAmount = Math.round(compensationAmount / actualDays);
    const redistributionPlan = this.buildRedistributionPlan(dailyAmount, actualDays);

    return {
      type: 'gradual',
      calorieDeficit: compensationAmount,
      originalDeficit: deficit,
      redistributionDays: actualDays,
      dailyAdjustment: dailyAmount,
      redistributionPlan,
      skippedCalories,
      skipReason: 'sustainability',
      safetyApproved: true,
      safetyWarnings: [
        {
          code: 'PARTIAL_COMPENSATION',
          message: `Only compensating ${SAFETY_LIMITS.partialCompensationPercent}% of the deficit for sustainability.`,
          severity: 'info',
        },
      ],
      coachingMessage: '',
    };
  }

  /**
   * Generate plan for over-consumption (no compensation, just guidance)
   */
  private generateOverConsumptionPlan(
    analysis: AnalysisResult,
    _userPrefs: NutritionUserPreferences
  ): AdjustmentPlan {
    const { deviation } = analysis;
    const excess = deviation.calorieDeviation;

    return {
      type: 'skip',
      calorieDeficit: -excess, // Negative because it's over
      originalDeficit: -excess,
      redistributionDays: 0,
      dailyAdjustment: 0,
      redistributionPlan: {},
      skippedCalories: excess,
      skipReason: 'over_consumption',
      safetyApproved: true,
      safetyWarnings: [],
      coachingMessage: this.generateOverCoachingMessage(excess, deviation.deviationPercent),
    };
  }

  /**
   * Build redistribution plan object
   */
  private buildRedistributionPlan(dailyAmount: number, days: number): RedistributionPlan {
    const plan: RedistributionPlan = {};
    for (let i = 1; i <= days; i++) {
      const date = this.getDateString(i);
      plan[date] = dailyAmount;
    }
    return plan;
  }

  /**
   * Apply safety checks to adjustment plan
   */
  private applySafetyChecks(
    plan: AdjustmentPlan,
    baseCalories: number,
    userMetrics?: UserMetrics
  ): {
    approved: boolean;
    warnings: SafetyWarning[];
    adjustedDailyAmount: number;
  } {
    const warnings: SafetyWarning[] = [];
    let adjustedDailyAmount = plan.dailyAdjustment;
    let approved = true;

    // Get minimum calories based on gender
    const minCalories = userMetrics
      ? userMetrics.gender === 'male'
        ? SAFETY_LIMITS.minCaloriesMale
        : userMetrics.gender === 'female'
          ? SAFETY_LIMITS.minCaloriesFemale
          : SAFETY_LIMITS.minCaloriesGeneral
      : SAFETY_LIMITS.minCaloriesGeneral;

    // Check if adjustment would push below minimum
    const adjustedTotal = baseCalories + plan.dailyAdjustment;
    if (adjustedTotal < minCalories) {
      const maxAdjustment = baseCalories - minCalories;
      if (plan.dailyAdjustment < 0) {
        // Can't subtract this much
        adjustedDailyAmount = Math.max(plan.dailyAdjustment, -maxAdjustment);
        warnings.push({
          code: 'MIN_CALORIES',
          message: `Adjustment capped to maintain safe minimum of ${minCalories} calories.`,
          severity: 'warning',
        });
      }
    }

    // Cap daily increase at safety limit
    if (plan.dailyAdjustment > SAFETY_LIMITS.maxDailyIncrease) {
      adjustedDailyAmount = SAFETY_LIMITS.maxDailyIncrease;
      warnings.push({
        code: 'MAX_INCREASE',
        message: `Daily increase capped at ${SAFETY_LIMITS.maxDailyIncrease} calories for digestive comfort.`,
        severity: 'info',
      });
    }

    // Cap daily decrease at safety limit
    if (plan.dailyAdjustment < -SAFETY_LIMITS.maxDailyDecrease) {
      adjustedDailyAmount = -SAFETY_LIMITS.maxDailyDecrease;
      warnings.push({
        code: 'MAX_DECREASE',
        message: `Daily decrease capped at ${SAFETY_LIMITS.maxDailyDecrease} calories to prevent crash dieting.`,
        severity: 'warning',
      });
    }

    // Conservative adjustment during aggressive weight loss
    if (userMetrics?.goalType === 'aggressive_weight_loss' && plan.dailyAdjustment > 0) {
      adjustedDailyAmount = Math.round(adjustedDailyAmount * 0.7);
      warnings.push({
        code: 'AGGRESSIVE_MODE',
        message: 'Reduced compensation during aggressive weight loss phase.',
        severity: 'info',
      });
    }

    return {
      approved,
      warnings,
      adjustedDailyAmount,
    };
  }

  /**
   * Store adjustment plan in database
   */
  async storeAdjustmentPlan(
    userId: string,
    analysisId: string,
    dietPlanId: string | null,
    plan: AdjustmentPlan
  ): Promise<string> {
    const startsAt = plan.redistributionDays > 0 ? this.getDateString(1) : null;
    const endsAt =
      plan.redistributionDays > 0 ? this.getDateString(plan.redistributionDays) : null;

    const result = await query<{ id: string }>(
      `INSERT INTO nutrition_calorie_adjustments (
        user_id, analysis_id, diet_plan_id,
        adjustment_type, calorie_deficit, original_deficit,
        redistribution_days, daily_adjustment, redistribution_plan,
        skipped_calories, skip_reason,
        safety_approved, safety_warnings,
        coaching_message, status, starts_at, ends_at
      ) VALUES (
        $1, $2, $3,
        $4, $5, $6,
        $7, $8, $9,
        $10, $11,
        $12, $13,
        $14, $15, $16, $17
      ) RETURNING id`,
      [
        userId,
        analysisId,
        dietPlanId,
        plan.type,
        plan.calorieDeficit,
        plan.originalDeficit,
        plan.redistributionDays,
        plan.dailyAdjustment,
        JSON.stringify(plan.redistributionPlan),
        plan.skippedCalories,
        plan.skipReason,
        plan.safetyApproved,
        JSON.stringify(plan.safetyWarnings),
        plan.coachingMessage,
        'proposed',
        startsAt,
        endsAt,
      ]
    );

    logger.info('[AdaptiveCalorie] Adjustment plan stored', {
      adjustmentId: result.rows[0].id,
      userId,
      type: plan.type,
      dailyAdjustment: plan.dailyAdjustment,
    });

    return result.rows[0].id;
  }

  /**
   * Apply user's choice to adjustment
   */
  async applyUserChoice(
    adjustmentId: string,
    userId: string,
    choice: UserChoice,
    modifiedPlan?: RedistributionPlan
  ): Promise<void> {
    let status: AdjustmentStatus;

    switch (choice) {
      case 'accept':
        status = 'active';
        break;
      case 'modify':
        status = 'active';
        break;
      case 'skip':
        status = 'skipped';
        break;
      default:
        throw new Error('Invalid choice');
    }

    await query(
      `UPDATE nutrition_calorie_adjustments
       SET user_choice = $1,
           user_modified_plan = $2,
           choice_made_at = CURRENT_TIMESTAMP,
           status = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND user_id = $5`,
      [choice, modifiedPlan ? JSON.stringify(modifiedPlan) : null, status, adjustmentId, userId]
    );

    // Update the analysis status
    await query(
      `UPDATE nutrition_daily_analysis
       SET status = 'adjustment_created', updated_at = CURRENT_TIMESTAMP
       WHERE id = (
         SELECT analysis_id FROM nutrition_calorie_adjustments WHERE id = $1
       )`,
      [adjustmentId]
    );

    logger.info('[AdaptiveCalorie] User choice applied', {
      adjustmentId,
      userId,
      choice,
      status,
    });
  }

  /**
   * Get today's adjusted calorie target
   */
  async getTodayAdjustedTarget(userId: string): Promise<AdjustedTargets | null> {
    const today = this.getDateString(0);

    // Get base calories from active diet plan
    const planResult = await query<{
      id: string;
      daily_calories: number;
    }>(
      `SELECT id, daily_calories FROM diet_plans
       WHERE user_id = $1 AND status = 'active'
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (planResult.rows.length === 0) {
      return null;
    }

    const baseCalories = planResult.rows[0].daily_calories || 0;

    // Get active adjustments that apply to today
    const adjustmentsResult = await query<{
      id: string;
      redistribution_plan: RedistributionPlan;
      daily_adjustment: number;
      adjustment_type: AdjustmentType;
      status: AdjustmentStatus;
    }>(
      `SELECT id, redistribution_plan, daily_adjustment, adjustment_type, status
       FROM nutrition_calorie_adjustments
       WHERE user_id = $1
         AND status = 'active'
         AND redistribution_plan ? $2`,
      [userId, today]
    );

    let totalAdjustment = 0;
    const activeAdjustments: AdjustmentRecord[] = [];

    for (const row of adjustmentsResult.rows) {
      const plan = row.redistribution_plan;
      if (plan[today]) {
        totalAdjustment += plan[today];
      }
    }

    // Get workout calorie adjustment (if user has workout today)
    const workoutAdjustment = await this.getWorkoutCalorieAdjustment(userId, today);

    const adjustedCalories = baseCalories + totalAdjustment + workoutAdjustment.adjustment;

    return {
      baseCalories,
      adjustedCalories,
      adjustmentAmount: totalAdjustment,
      adjustmentReason:
        totalAdjustment !== 0
          ? `Compensation from previous day${Math.abs(totalAdjustment) > 200 ? 's' : ''}`
          : 'On track',
      activeAdjustments,
      workoutCalorieAdjustment: workoutAdjustment.adjustment,
    };
  }

  /**
   * Get workout calorie adjustment for a day
   */
  private async getWorkoutCalorieAdjustment(
    userId: string,
    dateStr: string
  ): Promise<{ adjustment: number; workoutCalories: number }> {
    // Get user preferences
    const prefs = await this.getUserPreferences(userId);

    if (!prefs.factorWorkoutCalories) {
      return { adjustment: 0, workoutCalories: 0 };
    }

    // Get workout calories from WHOOP data
    const workoutResult = await query<{ calories_kcal: number }>(
      `SELECT calories_kcal FROM health_data_records
       WHERE user_id = $1
         AND data_type = 'workout'
         AND DATE(recorded_at) = $2::date`,
      [userId, dateStr]
    );

    const workoutCalories = workoutResult.rows.reduce(
      (sum, row) => sum + (row.calories_kcal || 0),
      0
    );

    if (workoutCalories === 0) {
      return { adjustment: 0, workoutCalories: 0 };
    }

    // Calculate adjustment based on addback percentage
    const adjustment = Math.round(workoutCalories * (prefs.workoutCalorieAddbackPercent / 100));

    return {
      adjustment,
      workoutCalories: Math.round(workoutCalories),
    };
  }

  /**
   * Get user preferences (with defaults)
   */
  async getUserPreferences(userId: string): Promise<NutritionUserPreferences> {
    const result = await query<{
      analysis_time: string;
      analysis_enabled: boolean;
      auto_adjust_enabled: boolean;
      max_daily_adjustment_calories: number;
      max_redistribution_days: number;
      prefer_next_day_adjustment: boolean;
      adjustment_strategy: 'aggressive' | 'balanced' | 'conservative';
      notify_on_deviation: boolean;
      deviation_threshold_percent: number;
      factor_workout_calories: boolean;
      workout_calorie_addback_percent: number;
      skip_if_recovery_below: number;
      increase_carbs_on_high_strain: boolean;
    }>(
      `SELECT * FROM nutrition_user_preferences WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return DEFAULT_PREFERENCES;
    }

    const row = result.rows[0];
    return {
      analysisTime: row.analysis_time || DEFAULT_PREFERENCES.analysisTime,
      analysisEnabled: row.analysis_enabled ?? DEFAULT_PREFERENCES.analysisEnabled,
      autoAdjustEnabled: row.auto_adjust_enabled ?? DEFAULT_PREFERENCES.autoAdjustEnabled,
      maxDailyAdjustmentCalories:
        row.max_daily_adjustment_calories || DEFAULT_PREFERENCES.maxDailyAdjustmentCalories,
      maxRedistributionDays:
        row.max_redistribution_days || DEFAULT_PREFERENCES.maxRedistributionDays,
      preferNextDayAdjustment:
        row.prefer_next_day_adjustment ?? DEFAULT_PREFERENCES.preferNextDayAdjustment,
      adjustmentStrategy: row.adjustment_strategy || DEFAULT_PREFERENCES.adjustmentStrategy,
      notifyOnDeviation: row.notify_on_deviation ?? DEFAULT_PREFERENCES.notifyOnDeviation,
      deviationThresholdPercent:
        Number(row.deviation_threshold_percent) || DEFAULT_PREFERENCES.deviationThresholdPercent,
      factorWorkoutCalories:
        row.factor_workout_calories ?? DEFAULT_PREFERENCES.factorWorkoutCalories,
      workoutCalorieAddbackPercent:
        row.workout_calorie_addback_percent || DEFAULT_PREFERENCES.workoutCalorieAddbackPercent,
      skipIfRecoveryBelow: row.skip_if_recovery_below || DEFAULT_PREFERENCES.skipIfRecoveryBelow,
      increaseCarbsOnHighStrain:
        row.increase_carbs_on_high_strain ?? DEFAULT_PREFERENCES.increaseCarbsOnHighStrain,
    };
  }

  /**
   * Save or update user preferences
   */
  async saveUserPreferences(
    userId: string,
    prefs: Partial<NutritionUserPreferences>
  ): Promise<void> {
    await query(
      `INSERT INTO nutrition_user_preferences (
        user_id, analysis_time, analysis_enabled, auto_adjust_enabled,
        max_daily_adjustment_calories, max_redistribution_days,
        prefer_next_day_adjustment, adjustment_strategy,
        notify_on_deviation, deviation_threshold_percent,
        factor_workout_calories, workout_calorie_addback_percent,
        skip_if_recovery_below, increase_carbs_on_high_strain
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      )
      ON CONFLICT (user_id) DO UPDATE SET
        analysis_time = COALESCE(EXCLUDED.analysis_time, nutrition_user_preferences.analysis_time),
        analysis_enabled = COALESCE(EXCLUDED.analysis_enabled, nutrition_user_preferences.analysis_enabled),
        auto_adjust_enabled = COALESCE(EXCLUDED.auto_adjust_enabled, nutrition_user_preferences.auto_adjust_enabled),
        max_daily_adjustment_calories = COALESCE(EXCLUDED.max_daily_adjustment_calories, nutrition_user_preferences.max_daily_adjustment_calories),
        max_redistribution_days = COALESCE(EXCLUDED.max_redistribution_days, nutrition_user_preferences.max_redistribution_days),
        prefer_next_day_adjustment = COALESCE(EXCLUDED.prefer_next_day_adjustment, nutrition_user_preferences.prefer_next_day_adjustment),
        adjustment_strategy = COALESCE(EXCLUDED.adjustment_strategy, nutrition_user_preferences.adjustment_strategy),
        notify_on_deviation = COALESCE(EXCLUDED.notify_on_deviation, nutrition_user_preferences.notify_on_deviation),
        deviation_threshold_percent = COALESCE(EXCLUDED.deviation_threshold_percent, nutrition_user_preferences.deviation_threshold_percent),
        factor_workout_calories = COALESCE(EXCLUDED.factor_workout_calories, nutrition_user_preferences.factor_workout_calories),
        workout_calorie_addback_percent = COALESCE(EXCLUDED.workout_calorie_addback_percent, nutrition_user_preferences.workout_calorie_addback_percent),
        skip_if_recovery_below = COALESCE(EXCLUDED.skip_if_recovery_below, nutrition_user_preferences.skip_if_recovery_below),
        increase_carbs_on_high_strain = COALESCE(EXCLUDED.increase_carbs_on_high_strain, nutrition_user_preferences.increase_carbs_on_high_strain),
        updated_at = CURRENT_TIMESTAMP`,
      [
        userId,
        prefs.analysisTime || DEFAULT_PREFERENCES.analysisTime,
        prefs.analysisEnabled ?? DEFAULT_PREFERENCES.analysisEnabled,
        prefs.autoAdjustEnabled ?? DEFAULT_PREFERENCES.autoAdjustEnabled,
        prefs.maxDailyAdjustmentCalories || DEFAULT_PREFERENCES.maxDailyAdjustmentCalories,
        prefs.maxRedistributionDays || DEFAULT_PREFERENCES.maxRedistributionDays,
        prefs.preferNextDayAdjustment ?? DEFAULT_PREFERENCES.preferNextDayAdjustment,
        prefs.adjustmentStrategy || DEFAULT_PREFERENCES.adjustmentStrategy,
        prefs.notifyOnDeviation ?? DEFAULT_PREFERENCES.notifyOnDeviation,
        prefs.deviationThresholdPercent || DEFAULT_PREFERENCES.deviationThresholdPercent,
        prefs.factorWorkoutCalories ?? DEFAULT_PREFERENCES.factorWorkoutCalories,
        prefs.workoutCalorieAddbackPercent || DEFAULT_PREFERENCES.workoutCalorieAddbackPercent,
        prefs.skipIfRecoveryBelow || DEFAULT_PREFERENCES.skipIfRecoveryBelow,
        prefs.increaseCarbsOnHighStrain ?? DEFAULT_PREFERENCES.increaseCarbsOnHighStrain,
      ]
    );

    logger.info('[AdaptiveCalorie] User preferences saved', { userId });
  }

  /**
   * Get pending adjustments for user
   */
  async getPendingAdjustments(userId: string): Promise<AdjustmentRecord[]> {
    const result = await query<{
      id: string;
      analysis_id: string;
      diet_plan_id: string | null;
      adjustment_type: AdjustmentType;
      calorie_deficit: number;
      original_deficit: number;
      redistribution_days: number;
      daily_adjustment: number;
      redistribution_plan: RedistributionPlan;
      skipped_calories: number;
      skip_reason: string | null;
      user_choice: UserChoice;
      safety_approved: boolean;
      safety_warnings: SafetyWarning[];
      coaching_message: string;
      status: AdjustmentStatus;
      starts_at: string | null;
      ends_at: string | null;
      created_at: string;
    }>(
      `SELECT * FROM nutrition_calorie_adjustments
       WHERE user_id = $1 AND status = 'proposed'
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId,
      analysisId: row.analysis_id,
      dietPlanId: row.diet_plan_id,
      type: row.adjustment_type,
      calorieDeficit: row.calorie_deficit,
      originalDeficit: row.original_deficit,
      redistributionDays: row.redistribution_days,
      dailyAdjustment: row.daily_adjustment,
      redistributionPlan: row.redistribution_plan,
      skippedCalories: row.skipped_calories,
      skipReason: row.skip_reason,
      userChoice: row.user_choice,
      userModifiedPlan: null,
      safetyApproved: row.safety_approved,
      safetyWarnings: row.safety_warnings,
      coachingMessage: row.coaching_message,
      status: row.status,
      startsAt: row.starts_at ? new Date(row.starts_at) : null,
      endsAt: row.ends_at ? new Date(row.ends_at) : null,
      createdAt: new Date(row.created_at),
    }));
  }

  // ============================================
  // COACHING MESSAGE GENERATORS
  // ============================================

  private generateLowRecoveryMessage(recoveryScore: number, deficit: number): string {
    return (
      `Your recovery is at ${recoveryScore}% today, which means your body is working hard to repair. ` +
      `Instead of trying to make up the ${deficit} calorie gap from yesterday, I'd suggest focusing on ` +
      `consistent, nourishing meals today. Good nutrition actually helps recovery - so just eat well ` +
      `and listen to your body.`
    );
  }

  private generateUnderCoachingMessage(plan: AdjustmentPlan, deviationPercent: number): string {
    const absPercent = Math.abs(deviationPercent).toFixed(1);

    if (plan.type === 'next_day') {
      return (
        `You were about ${absPercent}% under target yesterday. I can add ${plan.dailyAdjustment} ` +
        `calories to tomorrow's target - you probably won't even notice the difference. What do you think?`
      );
    }

    if (plan.type === 'redistribute') {
      return (
        `You were ${absPercent}% under target yesterday. Here's my suggestion: add about ` +
        `${plan.dailyAdjustment} calories per day for the next ${plan.redistributionDays} days. ` +
        `This gentle approach keeps you on track without feeling like you're stuffing yourself.`
      );
    }

    if (plan.type === 'gradual') {
      return (
        `Yesterday was significantly under target (${absPercent}%). Rather than trying to make up ` +
        `all of it - which rarely works and can lead to overeating - I suggest we add ` +
        `${plan.dailyAdjustment} calories per day for ${plan.redistributionDays} days. ` +
        `This covers about half the gap, which is more sustainable.`
      );
    }

    return "Let's focus on consistent eating today rather than trying to compensate.";
  }

  private generateOverCoachingMessage(excess: number, deviationPercent: number): string {
    const absPercent = Math.abs(deviationPercent).toFixed(1);

    if (deviationPercent <= 15) {
      return (
        `You went about ${absPercent}% over target yesterday (${excess} extra calories). ` +
        `That's really not a big deal - your body often naturally adjusts by being less hungry ` +
        `the next day. Just listen to your hunger cues today.`
      );
    }

    if (deviationPercent <= 30) {
      return (
        `Yesterday was a bigger eating day - ${absPercent}% over target. Social event? ` +
        `Celebration? Stress eating? Whatever the reason, restricting today usually backfires. ` +
        `Instead, just aim for your normal target and trust the process.`
      );
    }

    return (
      `Yesterday was significantly over target. The best approach isn't to punish yourself ` +
      `with restriction - that creates a cycle. Just return to your normal eating pattern ` +
      `today. One day doesn't undo your progress.`
    );
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  private getDateString(daysFromNow: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysFromNow);
    return date.toISOString().split('T')[0];
  }
}

export const adaptiveCalorieService = new AdaptiveCalorieService();
