/**
 * Nutrition Service
 *
 * Provides TDEE (Total Daily Energy Expenditure), BMR (Basal Metabolic Rate),
 * and macronutrient calculations based on user data and goals.
 *
 * Uses Mifflin-St Jeor equation for BMR calculation (most accurate for adults):
 * Men: BMR = (10 × weight in kg) + (6.25 × height in cm) - (5 × age in years) + 5
 * Women: BMR = (10 × weight in kg) + (6.25 × height in cm) - (5 × age in years) - 161
 */

import { logger } from './logger.service.js';

// Types
export type Gender = 'male' | 'female' | 'non_binary' | 'prefer_not_to_say';
export type ActivityLevel =
  | 'sedentary'        // Little or no exercise
  | 'lightly_active'   // Light exercise 1-3 days/week
  | 'moderately_active' // Moderate exercise 3-5 days/week
  | 'very_active'      // Hard exercise 6-7 days/week
  | 'extra_active';    // Very hard exercise, physical job, or training 2x/day

export type GoalType =
  | 'weight_loss'
  | 'aggressive_weight_loss'
  | 'muscle_building'
  | 'lean_bulk'
  | 'maintenance'
  | 'performance';

export interface UserMetrics {
  weightKg: number;
  heightCm: number;
  ageYears: number;
  gender: Gender;
  activityLevel: ActivityLevel;
  bodyFatPercentage?: number; // Optional, for more accurate calculations
}

export interface GoalParameters {
  goalType: GoalType;
  targetWeightKg?: number;
  weeklyWeightChangeKg?: number; // Positive for gain, negative for loss
  proteinPreference?: 'low' | 'moderate' | 'high'; // Affects protein ratio
}

export interface TDEEResult {
  bmr: number;                    // Basal Metabolic Rate
  tdee: number;                   // Total Daily Energy Expenditure
  activityMultiplier: number;     // Multiplier used
  method: 'mifflin_st_jeor' | 'katch_mcardle';
}

export interface MacroResult {
  calories: number;               // Daily calorie target
  protein: {
    grams: number;
    calories: number;
    percentage: number;
  };
  carbohydrates: {
    grams: number;
    calories: number;
    percentage: number;
  };
  fat: {
    grams: number;
    calories: number;
    percentage: number;
  };
  fiber: {
    minGrams: number;
    maxGrams: number;
  };
  water: {
    liters: number;
  };
}

export interface NutritionPlan {
  tdee: TDEEResult;
  macros: MacroResult;
  calorieAdjustment: number;      // Surplus or deficit
  weeklyWeightChange: number;     // Expected kg change per week
  safetyWarnings: string[];
  recommendations: string[];
}

// Activity level multipliers (Harris-Benedict activity factors)
const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,          // Desk job, little exercise
  lightly_active: 1.375,   // Light exercise 1-3 days/week
  moderately_active: 1.55, // Moderate exercise 3-5 days/week
  very_active: 1.725,      // Hard exercise 6-7 days/week
  extra_active: 1.9,       // Very intense exercise or physical job
};

// Calorie limits for safety
const SAFETY_LIMITS = {
  minCaloriesMale: 1500,
  minCaloriesFemale: 1200,
  minCaloriesGeneral: 1200,
  maxWeeklyLossKg: 0.9,    // ~2 lbs per week max
  maxWeeklyGainKg: 0.45,   // ~1 lb per week max for lean gains
  maxDeficitPercentage: 25, // Max 25% below TDEE
  maxSurplusPercentage: 20, // Max 20% above TDEE
};

// Caloric values
const CALORIES_PER_GRAM = {
  protein: 4,
  carbohydrates: 4,
  fat: 9,
};

// Calories per kg of body weight change
const CALORIES_PER_KG = 7700; // ~3500 cal per lb

class NutritionService {
  /**
   * Calculate BMR using Mifflin-St Jeor equation
   */
  calculateBMR(metrics: UserMetrics): number {
    const { weightKg, heightCm, ageYears, gender } = metrics;

    // Base calculation
    const baseBMR = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;

    // Gender-specific adjustment
    // For non-binary/prefer not to say, use average of male/female
    switch (gender) {
      case 'male':
        return Math.round(baseBMR + 5);
      case 'female':
        return Math.round(baseBMR - 161);
      default:
        // Average of male (+5) and female (-161) = -78
        return Math.round(baseBMR - 78);
    }
  }

  /**
   * Calculate BMR using Katch-McArdle equation (requires body fat percentage)
   * More accurate when body fat % is known
   */
  calculateBMRKatchMcArdle(weightKg: number, bodyFatPercentage: number): number {
    const leanBodyMass = weightKg * (1 - bodyFatPercentage / 100);
    return Math.round(370 + 21.6 * leanBodyMass);
  }

  /**
   * Calculate TDEE (Total Daily Energy Expenditure)
   */
  calculateTDEE(metrics: UserMetrics): TDEEResult {
    let bmr: number;
    let method: 'mifflin_st_jeor' | 'katch_mcardle';

    // Use Katch-McArdle if body fat % is provided (more accurate)
    if (metrics.bodyFatPercentage && metrics.bodyFatPercentage > 0) {
      bmr = this.calculateBMRKatchMcArdle(metrics.weightKg, metrics.bodyFatPercentage);
      method = 'katch_mcardle';
    } else {
      bmr = this.calculateBMR(metrics);
      method = 'mifflin_st_jeor';
    }

    const activityMultiplier = ACTIVITY_MULTIPLIERS[metrics.activityLevel];
    const tdee = Math.round(bmr * activityMultiplier);

    return {
      bmr,
      tdee,
      activityMultiplier,
      method,
    };
  }

  /**
   * Calculate calorie target based on goal
   */
  calculateCalorieTarget(
    tdee: number,
    goal: GoalParameters,
    metrics: UserMetrics
  ): { calories: number; adjustment: number; weeklyChange: number; warnings: string[] } {
    const warnings: string[] = [];
    let adjustment = 0;
    let weeklyChange = 0;

    switch (goal.goalType) {
      case 'weight_loss':
        // Moderate deficit: 500 cal/day = ~0.45kg/week loss
        adjustment = -500;
        weeklyChange = -0.45;
        break;

      case 'aggressive_weight_loss':
        // Aggressive deficit: 750-1000 cal/day
        adjustment = -750;
        weeklyChange = -0.68;
        warnings.push('Aggressive weight loss may cause muscle loss. Consider adding resistance training.');
        break;

      case 'muscle_building':
        // Moderate surplus: 300-500 cal/day
        adjustment = 400;
        weeklyChange = 0.36;
        break;

      case 'lean_bulk':
        // Small surplus: 200-300 cal/day
        adjustment = 250;
        weeklyChange = 0.23;
        break;

      case 'maintenance':
        adjustment = 0;
        weeklyChange = 0;
        break;

      case 'performance':
        // Slight surplus for recovery
        adjustment = 200;
        weeklyChange = 0.18;
        break;
    }

    // If custom weekly weight change specified, override
    if (goal.weeklyWeightChangeKg) {
      weeklyChange = goal.weeklyWeightChangeKg;
      adjustment = Math.round((weeklyChange * CALORIES_PER_KG) / 7);

      // Safety checks for custom goals
      if (weeklyChange < -SAFETY_LIMITS.maxWeeklyLossKg) {
        warnings.push(
          `Target weight loss of ${Math.abs(weeklyChange).toFixed(2)}kg/week exceeds safe limit of ${SAFETY_LIMITS.maxWeeklyLossKg}kg/week.`
        );
      }
      if (weeklyChange > SAFETY_LIMITS.maxWeeklyGainKg) {
        warnings.push(
          `Target weight gain of ${weeklyChange.toFixed(2)}kg/week exceeds recommended limit of ${SAFETY_LIMITS.maxWeeklyGainKg}kg/week.`
        );
      }
    }

    let calories = tdee + adjustment;

    // Enforce minimum calories for safety
    const minCalories =
      metrics.gender === 'male'
        ? SAFETY_LIMITS.minCaloriesMale
        : metrics.gender === 'female'
          ? SAFETY_LIMITS.minCaloriesFemale
          : SAFETY_LIMITS.minCaloriesGeneral;

    if (calories < minCalories) {
      warnings.push(
        `Calculated calories (${calories}) below safe minimum. Adjusted to ${minCalories} calories.`
      );
      calories = minCalories;
      // Recalculate actual weekly change with adjusted calories
      adjustment = calories - tdee;
      weeklyChange = (adjustment * 7) / CALORIES_PER_KG;
    }

    // Check deficit/surplus percentage
    const changePercentage = Math.abs(adjustment / tdee) * 100;
    if (adjustment < 0 && changePercentage > SAFETY_LIMITS.maxDeficitPercentage) {
      warnings.push(
        `Calorie deficit of ${changePercentage.toFixed(1)}% exceeds recommended maximum of ${SAFETY_LIMITS.maxDeficitPercentage}%.`
      );
    }
    if (adjustment > 0 && changePercentage > SAFETY_LIMITS.maxSurplusPercentage) {
      warnings.push(
        `Calorie surplus of ${changePercentage.toFixed(1)}% exceeds recommended maximum of ${SAFETY_LIMITS.maxSurplusPercentage}%.`
      );
    }

    return {
      calories: Math.round(calories),
      adjustment,
      weeklyChange,
      warnings,
    };
  }

  /**
   * Calculate macronutrient distribution
   */
  calculateMacros(
    calories: number,
    goal: GoalParameters,
    metrics: UserMetrics
  ): MacroResult {
    // Protein calculation based on goal and body weight
    let proteinGramsPerKg: number;

    switch (goal.goalType) {
      case 'muscle_building':
      case 'lean_bulk':
        // High protein for muscle building: 1.6-2.2g per kg
        proteinGramsPerKg = goal.proteinPreference === 'high' ? 2.2 : 2.0;
        break;
      case 'weight_loss':
      case 'aggressive_weight_loss':
        // Higher protein during deficit to preserve muscle: 1.8-2.4g per kg
        proteinGramsPerKg = goal.proteinPreference === 'high' ? 2.4 : 2.0;
        break;
      case 'performance':
        // Moderate-high for athletes: 1.4-2.0g per kg
        proteinGramsPerKg = goal.proteinPreference === 'high' ? 2.0 : 1.6;
        break;
      default:
        // Maintenance: 1.2-1.6g per kg
        proteinGramsPerKg = goal.proteinPreference === 'high' ? 1.6 : 1.4;
    }

    // Adjust for low protein preference
    if (goal.proteinPreference === 'low') {
      proteinGramsPerKg = Math.max(0.8, proteinGramsPerKg - 0.4);
    }

    const proteinGrams = Math.round(metrics.weightKg * proteinGramsPerKg);
    const proteinCalories = proteinGrams * CALORIES_PER_GRAM.protein;
    const proteinPercentage = (proteinCalories / calories) * 100;

    // Fat calculation: 0.8-1.2g per kg body weight (minimum 20% of calories)
    let fatGrams = Math.round(metrics.weightKg * 0.9);
    let fatCalories = fatGrams * CALORIES_PER_GRAM.fat;

    // Ensure minimum 20% from fat
    const minFatCalories = calories * 0.2;
    if (fatCalories < minFatCalories) {
      fatCalories = minFatCalories;
      fatGrams = Math.round(fatCalories / CALORIES_PER_GRAM.fat);
    }

    // Cap fat at 35% of calories
    const maxFatCalories = calories * 0.35;
    if (fatCalories > maxFatCalories) {
      fatCalories = maxFatCalories;
      fatGrams = Math.round(fatCalories / CALORIES_PER_GRAM.fat);
    }

    const fatPercentage = (fatCalories / calories) * 100;

    // Carbs: remaining calories
    const carbCalories = calories - proteinCalories - fatCalories;
    const carbGrams = Math.round(carbCalories / CALORIES_PER_GRAM.carbohydrates);
    const carbPercentage = (carbCalories / calories) * 100;

    // Fiber: 14g per 1000 calories (minimum 25g, maximum 40g)
    const fiberBase = (calories / 1000) * 14;
    const minFiber = Math.max(25, Math.round(fiberBase * 0.8));
    const maxFiber = Math.min(40, Math.round(fiberBase * 1.2));

    // Water: ~35ml per kg body weight
    const waterLiters = Math.round((metrics.weightKg * 35) / 1000 * 10) / 10;

    return {
      calories,
      protein: {
        grams: proteinGrams,
        calories: proteinCalories,
        percentage: Math.round(proteinPercentage),
      },
      carbohydrates: {
        grams: carbGrams,
        calories: carbCalories,
        percentage: Math.round(carbPercentage),
      },
      fat: {
        grams: fatGrams,
        calories: Math.round(fatCalories),
        percentage: Math.round(fatPercentage),
      },
      fiber: {
        minGrams: minFiber,
        maxGrams: maxFiber,
      },
      water: {
        liters: waterLiters,
      },
    };
  }

  /**
   * Generate complete nutrition plan
   */
  generateNutritionPlan(metrics: UserMetrics, goal: GoalParameters): NutritionPlan {
    logger.info('[Nutrition] Generating nutrition plan', {
      weightKg: metrics.weightKg,
      heightCm: metrics.heightCm,
      ageYears: metrics.ageYears,
      gender: metrics.gender,
      activityLevel: metrics.activityLevel,
      goalType: goal.goalType,
    });

    // Calculate TDEE
    const tdee = this.calculateTDEE(metrics);

    // Calculate calorie target
    const calorieResult = this.calculateCalorieTarget(tdee.tdee, goal, metrics);

    // Calculate macros
    const macros = this.calculateMacros(calorieResult.calories, goal, metrics);

    // Generate recommendations
    const recommendations = this.generateRecommendations(goal, macros, metrics);

    const plan: NutritionPlan = {
      tdee,
      macros,
      calorieAdjustment: calorieResult.adjustment,
      weeklyWeightChange: calorieResult.weeklyChange,
      safetyWarnings: calorieResult.warnings,
      recommendations,
    };

    logger.info('[Nutrition] Plan generated', {
      tdee: tdee.tdee,
      calories: macros.calories,
      proteinGrams: macros.protein.grams,
      weeklyChange: plan.weeklyWeightChange,
      warnings: plan.safetyWarnings.length,
    });

    return plan;
  }

  /**
   * Generate personalized recommendations
   */
  private generateRecommendations(
    goal: GoalParameters,
    macros: MacroResult,
    _metrics: UserMetrics
  ): string[] {
    const recommendations: string[] = [];

    // Protein recommendations
    recommendations.push(
      `Aim for ${macros.protein.grams}g of protein daily, spread across 4-5 meals for optimal absorption.`
    );

    // Goal-specific recommendations
    switch (goal.goalType) {
      case 'weight_loss':
      case 'aggressive_weight_loss':
        recommendations.push(
          'Prioritize protein and fiber to maintain satiety during your calorie deficit.'
        );
        recommendations.push(
          'Incorporate resistance training 2-3x per week to preserve muscle mass.'
        );
        recommendations.push(
          'Stay hydrated - sometimes thirst is mistaken for hunger.'
        );
        break;

      case 'muscle_building':
      case 'lean_bulk':
        recommendations.push(
          'Consume protein within 2 hours before and after resistance training.'
        );
        recommendations.push(
          'Time your carbohydrates around workouts for optimal performance and recovery.'
        );
        recommendations.push(
          'Get 7-9 hours of sleep for muscle recovery and growth hormone production.'
        );
        break;

      case 'performance':
        recommendations.push(
          'Fuel properly before training with easily digestible carbohydrates.'
        );
        recommendations.push(
          'Consider intra-workout nutrition for sessions longer than 90 minutes.'
        );
        recommendations.push(
          'Prioritize recovery nutrition within 30 minutes post-workout.'
        );
        break;

      default:
        recommendations.push(
          'Maintain consistent meal timing to regulate hunger and energy levels.'
        );
    }

    // Hydration
    recommendations.push(
      `Drink at least ${macros.water.liters}L of water daily, more during exercise.`
    );

    // Fiber
    recommendations.push(
      `Include ${macros.fiber.minGrams}-${macros.fiber.maxGrams}g of fiber from whole foods daily.`
    );

    return recommendations;
  }

  /**
   * Validate if a nutrition plan is safe
   */
  validatePlanSafety(
    plan: NutritionPlan,
    metrics: UserMetrics
  ): { isSafe: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check minimum calories
    const minCalories =
      metrics.gender === 'male'
        ? SAFETY_LIMITS.minCaloriesMale
        : metrics.gender === 'female'
          ? SAFETY_LIMITS.minCaloriesFemale
          : SAFETY_LIMITS.minCaloriesGeneral;

    if (plan.macros.calories < minCalories) {
      issues.push(`Calorie target (${plan.macros.calories}) is below safe minimum (${minCalories}).`);
    }

    // Check weight change rate
    if (plan.weeklyWeightChange < -SAFETY_LIMITS.maxWeeklyLossKg) {
      issues.push(
        `Weekly weight loss target exceeds safe limit of ${SAFETY_LIMITS.maxWeeklyLossKg}kg/week.`
      );
    }

    // Check protein minimum (at least 0.8g per kg)
    const minProtein = metrics.weightKg * 0.8;
    if (plan.macros.protein.grams < minProtein) {
      issues.push(
        `Protein target (${plan.macros.protein.grams}g) is below minimum recommendation (${Math.round(minProtein)}g).`
      );
    }

    // Check fat minimum (at least 20% of calories)
    if (plan.macros.fat.percentage < 20) {
      issues.push(
        `Fat intake (${plan.macros.fat.percentage}%) is below recommended minimum of 20%.`
      );
    }

    return {
      isSafe: issues.length === 0,
      issues,
    };
  }

  /**
   * Convert activity days per week to activity level
   */
  activityDaysToLevel(daysPerWeek: number): ActivityLevel {
    if (daysPerWeek === 0) return 'sedentary';
    if (daysPerWeek <= 2) return 'lightly_active';
    if (daysPerWeek <= 4) return 'moderately_active';
    if (daysPerWeek <= 6) return 'very_active';
    return 'extra_active';
  }

  /**
   * Map goal category to goal type
   */
  goalCategoryToType(category: string): GoalType {
    const mapping: Record<string, GoalType> = {
      weight_loss: 'weight_loss',
      muscle_building: 'muscle_building',
      sleep_improvement: 'maintenance',
      stress_wellness: 'maintenance',
      energy_productivity: 'maintenance',
      event_training: 'performance',
      health_condition: 'maintenance',
      habit_building: 'maintenance',
      overall_optimization: 'maintenance',
      custom: 'maintenance',
    };

    return mapping[category] || 'maintenance';
  }
}

export const nutritionService = new NutritionService();
