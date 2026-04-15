/**
 * Nutrition Service Unit Tests
 *
 * Tests for TDEE, BMR, and macro calculations
 */

import { nutritionService } from '../../../src/services/nutrition.service.js';
import type {
  UserMetrics,
  GoalParameters,
} from '../../../src/services/nutrition.service.js';

describe('NutritionService', () => {
  describe('calculateBMR', () => {
    it('should calculate BMR correctly for males using Mifflin-St Jeor', () => {
      const metrics: UserMetrics = {
        weightKg: 80,
        heightCm: 180,
        ageYears: 30,
        gender: 'male',
        activityLevel: 'moderately_active',
      };

      const bmr = nutritionService.calculateBMR(metrics);

      // Mifflin-St Jeor: 10 * 80 + 6.25 * 180 - 5 * 30 + 5 = 1780
      expect(bmr).toBe(1780);
    });

    it('should calculate BMR correctly for females using Mifflin-St Jeor', () => {
      const metrics: UserMetrics = {
        weightKg: 65,
        heightCm: 165,
        ageYears: 25,
        gender: 'female',
        activityLevel: 'lightly_active',
      };

      const bmr = nutritionService.calculateBMR(metrics);

      // Mifflin-St Jeor: 10 * 65 + 6.25 * 165 - 5 * 25 - 161 = 1395
      // 650 + 1031.25 - 125 - 161 = 1395.25 → 1395
      expect(bmr).toBe(1395);
    });

    it('should use average for non-binary gender', () => {
      const metrics: UserMetrics = {
        weightKg: 70,
        heightCm: 170,
        ageYears: 30,
        gender: 'non_binary',
        activityLevel: 'sedentary',
      };

      const bmr = nutritionService.calculateBMR(metrics);

      // Should use -78 adjustment (average of +5 and -161)
      // 10 * 70 + 6.25 * 170 - 5 * 30 - 78 = 1535
      // 700 + 1062.5 - 150 - 78 = 1534.5 → 1535
      expect(bmr).toBe(1535);
    });
  });

  describe('calculateBMRKatchMcArdle', () => {
    it('should calculate BMR using lean body mass', () => {
      const weightKg = 80;
      const bodyFatPercentage = 20;

      const bmr = nutritionService.calculateBMRKatchMcArdle(weightKg, bodyFatPercentage);

      // Lean body mass = 80 * (1 - 0.20) = 64
      // BMR = 370 + 21.6 * 64 = 1752
      expect(bmr).toBe(1752);
    });

    it('should handle low body fat percentage', () => {
      const weightKg = 75;
      const bodyFatPercentage = 10;

      const bmr = nutritionService.calculateBMRKatchMcArdle(weightKg, bodyFatPercentage);

      // Lean body mass = 75 * 0.90 = 67.5
      // BMR = 370 + 21.6 * 67.5 = 1828
      expect(bmr).toBe(1828);
    });
  });

  describe('calculateTDEE', () => {
    it('should apply sedentary activity multiplier (1.2)', () => {
      const metrics: UserMetrics = {
        weightKg: 80,
        heightCm: 180,
        ageYears: 30,
        gender: 'male',
        activityLevel: 'sedentary',
      };

      const result = nutritionService.calculateTDEE(metrics);

      expect(result.bmr).toBe(1780);
      expect(result.activityMultiplier).toBe(1.2);
      expect(result.tdee).toBe(Math.round(1780 * 1.2)); // 2136
      expect(result.method).toBe('mifflin_st_jeor');
    });

    it('should apply very active multiplier (1.725)', () => {
      const metrics: UserMetrics = {
        weightKg: 70,
        heightCm: 175,
        ageYears: 25,
        gender: 'male',
        activityLevel: 'very_active',
      };

      const result = nutritionService.calculateTDEE(metrics);

      expect(result.activityMultiplier).toBe(1.725);
    });

    it('should use Katch-McArdle when body fat percentage is provided', () => {
      const metrics: UserMetrics = {
        weightKg: 80,
        heightCm: 180,
        ageYears: 30,
        gender: 'male',
        activityLevel: 'moderately_active',
        bodyFatPercentage: 15,
      };

      const result = nutritionService.calculateTDEE(metrics);

      expect(result.method).toBe('katch_mcardle');
      // Lean mass = 80 * 0.85 = 68
      // BMR = 370 + 21.6 * 68 = 1839
      expect(result.bmr).toBe(1839);
    });
  });

  describe('calculateCalorieTarget', () => {
    const defaultMetrics: UserMetrics = {
      weightKg: 80,
      heightCm: 180,
      ageYears: 30,
      gender: 'male',
      activityLevel: 'moderately_active',
    };

    it('should create 500 calorie deficit for weight loss', () => {
      const goal: GoalParameters = { goalType: 'weight_loss' };
      const result = nutritionService.calculateCalorieTarget(2500, goal, defaultMetrics);

      expect(result.adjustment).toBe(-500);
      expect(result.calories).toBe(2000);
      expect(result.weeklyChange).toBe(-0.45);
    });

    it('should create 750 calorie deficit for aggressive weight loss', () => {
      const goal: GoalParameters = { goalType: 'aggressive_weight_loss' };
      const result = nutritionService.calculateCalorieTarget(2500, goal, defaultMetrics);

      expect(result.adjustment).toBe(-750);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('muscle loss');
    });

    it('should create 400 calorie surplus for muscle building', () => {
      const goal: GoalParameters = { goalType: 'muscle_building' };
      const result = nutritionService.calculateCalorieTarget(2500, goal, defaultMetrics);

      expect(result.adjustment).toBe(400);
      expect(result.calories).toBe(2900);
    });

    it('should create no adjustment for maintenance', () => {
      const goal: GoalParameters = { goalType: 'maintenance' };
      const result = nutritionService.calculateCalorieTarget(2500, goal, defaultMetrics);

      expect(result.adjustment).toBe(0);
      expect(result.calories).toBe(2500);
    });

    it('should enforce minimum calories for males (1500)', () => {
      const goal: GoalParameters = { goalType: 'weight_loss' };
      const result = nutritionService.calculateCalorieTarget(1800, goal, defaultMetrics);

      expect(result.calories).toBe(1500);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('below safe minimum');
    });

    it('should enforce minimum calories for females (1200)', () => {
      const femaleMetrics: UserMetrics = { ...defaultMetrics, gender: 'female' };
      const goal: GoalParameters = { goalType: 'weight_loss' };
      const result = nutritionService.calculateCalorieTarget(1500, goal, femaleMetrics);

      expect(result.calories).toBe(1200);
    });

    it('should warn about excessive deficit percentage', () => {
      const goal: GoalParameters = { goalType: 'weight_loss', weeklyWeightChangeKg: -1.5 };
      const result = nutritionService.calculateCalorieTarget(2500, goal, defaultMetrics);

      expect(result.warnings.some(w => w.includes('exceeds'))).toBe(true);
    });

    it('should use custom weekly weight change when provided', () => {
      const goal: GoalParameters = {
        goalType: 'weight_loss',
        weeklyWeightChangeKg: -0.3,
      };
      const result = nutritionService.calculateCalorieTarget(2500, goal, defaultMetrics);

      // -0.3 kg/week = -0.3 * 7700 / 7 = -330 cal/day
      expect(result.adjustment).toBe(-330);
    });
  });

  describe('calculateMacros', () => {
    const defaultMetrics: UserMetrics = {
      weightKg: 80,
      heightCm: 180,
      ageYears: 30,
      gender: 'male',
      activityLevel: 'moderately_active',
    };

    it('should calculate macros for weight loss with higher protein', () => {
      const goal: GoalParameters = { goalType: 'weight_loss' };
      const result = nutritionService.calculateMacros(2000, goal, defaultMetrics);

      // Protein: 2.0g per kg = 160g (640 cal)
      expect(result.protein.grams).toBe(160);
      expect(result.protein.calories).toBe(640);

      // Fat: minimum 20% of calories
      expect(result.fat.percentage).toBeGreaterThanOrEqual(20);
      expect(result.fat.percentage).toBeLessThanOrEqual(35);

      // Total should equal target calories
      const totalCalories = result.protein.calories + result.carbohydrates.calories + result.fat.calories;
      expect(Math.abs(totalCalories - 2000)).toBeLessThan(10); // Allow small rounding difference
    });

    it('should calculate macros for muscle building with high protein', () => {
      const goal: GoalParameters = {
        goalType: 'muscle_building',
        proteinPreference: 'high',
      };
      const result = nutritionService.calculateMacros(3000, goal, defaultMetrics);

      // High protein preference = 2.2g per kg = 176g
      expect(result.protein.grams).toBe(176);
    });

    it('should calculate fiber based on calorie intake', () => {
      const goal: GoalParameters = { goalType: 'maintenance' };
      const result = nutritionService.calculateMacros(2500, goal, defaultMetrics);

      // 14g per 1000 calories = 35g base, min 25g, max 40g
      expect(result.fiber.minGrams).toBeGreaterThanOrEqual(25);
      expect(result.fiber.maxGrams).toBeLessThanOrEqual(40);
    });

    it('should calculate water intake based on body weight', () => {
      const goal: GoalParameters = { goalType: 'maintenance' };
      const result = nutritionService.calculateMacros(2500, goal, defaultMetrics);

      // 35ml per kg = 80 * 35 = 2800ml = 2.8L
      expect(result.water.liters).toBe(2.8);
    });

    it('should reduce protein for low preference', () => {
      const goal: GoalParameters = {
        goalType: 'maintenance',
        proteinPreference: 'low',
      };
      const result = nutritionService.calculateMacros(2500, goal, defaultMetrics);

      // Low preference reduces by 0.4g/kg, minimum 0.8g/kg
      // 80kg * 1.0g/kg = 80g (reduced from 1.4 default)
      expect(result.protein.grams).toBe(80);
    });
  });

  describe('generateNutritionPlan', () => {
    const defaultMetrics: UserMetrics = {
      weightKg: 80,
      heightCm: 180,
      ageYears: 30,
      gender: 'male',
      activityLevel: 'moderately_active',
    };

    it('should generate complete nutrition plan', () => {
      const goal: GoalParameters = { goalType: 'weight_loss' };
      const plan = nutritionService.generateNutritionPlan(defaultMetrics, goal);

      expect(plan.tdee).toBeDefined();
      expect(plan.macros).toBeDefined();
      expect(plan.calorieAdjustment).toBe(-500);
      expect(plan.weeklyWeightChange).toBe(-0.45);
      expect(plan.recommendations).toBeDefined();
      expect(plan.recommendations.length).toBeGreaterThan(0);
    });

    it('should include weight loss recommendations', () => {
      const goal: GoalParameters = { goalType: 'weight_loss' };
      const plan = nutritionService.generateNutritionPlan(defaultMetrics, goal);

      expect(plan.recommendations.some(r => r.includes('protein'))).toBe(true);
      expect(plan.recommendations.some(r => r.includes('fiber') || r.includes('satiety'))).toBe(true);
    });

    it('should include muscle building recommendations', () => {
      const goal: GoalParameters = { goalType: 'muscle_building' };
      const plan = nutritionService.generateNutritionPlan(defaultMetrics, goal);

      expect(plan.recommendations.some(r => r.includes('protein') || r.includes('sleep'))).toBe(true);
    });
  });

  describe('validatePlanSafety', () => {
    const defaultMetrics: UserMetrics = {
      weightKg: 80,
      heightCm: 180,
      ageYears: 30,
      gender: 'male',
      activityLevel: 'moderately_active',
    };

    it('should pass for safe nutrition plan', () => {
      const goal: GoalParameters = { goalType: 'maintenance' };
      const plan = nutritionService.generateNutritionPlan(defaultMetrics, goal);
      const result = nutritionService.validatePlanSafety(plan, defaultMetrics);

      expect(result.isSafe).toBe(true);
      expect(result.issues.length).toBe(0);
    });

    it('should flag unsafe calorie levels', () => {
      const plan = {
        tdee: { bmr: 1800, tdee: 2200, activityMultiplier: 1.2, method: 'mifflin_st_jeor' as const },
        macros: {
          calories: 1000, // Too low
          protein: { grams: 60, calories: 240, percentage: 24 },
          carbohydrates: { grams: 100, calories: 400, percentage: 40 },
          fat: { grams: 40, calories: 360, percentage: 36 },
          fiber: { minGrams: 25, maxGrams: 35 },
          water: { liters: 2.5 },
        },
        calorieAdjustment: -1200,
        weeklyWeightChange: -1.1,
        safetyWarnings: [],
        recommendations: [],
      };

      const result = nutritionService.validatePlanSafety(plan, defaultMetrics);

      expect(result.isSafe).toBe(false);
      expect(result.issues.some(i => i.includes('below safe minimum'))).toBe(true);
    });

    it('should flag excessive weekly weight loss', () => {
      const plan = {
        tdee: { bmr: 1800, tdee: 2200, activityMultiplier: 1.2, method: 'mifflin_st_jeor' as const },
        macros: {
          calories: 1500,
          protein: { grams: 120, calories: 480, percentage: 32 },
          carbohydrates: { grams: 150, calories: 600, percentage: 40 },
          fat: { grams: 47, calories: 420, percentage: 28 },
          fiber: { minGrams: 25, maxGrams: 35 },
          water: { liters: 2.5 },
        },
        calorieAdjustment: -700,
        weeklyWeightChange: -1.0, // Exceeds 0.9 kg limit
        safetyWarnings: [],
        recommendations: [],
      };

      const result = nutritionService.validatePlanSafety(plan, defaultMetrics);

      expect(result.isSafe).toBe(false);
      expect(result.issues.some(i => i.includes('Weekly weight loss'))).toBe(true);
    });

    it('should flag low protein intake', () => {
      const plan = {
        tdee: { bmr: 1800, tdee: 2200, activityMultiplier: 1.2, method: 'mifflin_st_jeor' as const },
        macros: {
          calories: 2000,
          protein: { grams: 50, calories: 200, percentage: 10 }, // Too low (should be 64g minimum)
          carbohydrates: { grams: 300, calories: 1200, percentage: 60 },
          fat: { grams: 67, calories: 600, percentage: 30 },
          fiber: { minGrams: 25, maxGrams: 35 },
          water: { liters: 2.5 },
        },
        calorieAdjustment: 0,
        weeklyWeightChange: 0,
        safetyWarnings: [],
        recommendations: [],
      };

      const result = nutritionService.validatePlanSafety(plan, defaultMetrics);

      expect(result.isSafe).toBe(false);
      expect(result.issues.some(i => i.includes('Protein target'))).toBe(true);
    });
  });

  describe('activityDaysToLevel', () => {
    it('should map 0 days to sedentary', () => {
      expect(nutritionService.activityDaysToLevel(0)).toBe('sedentary');
    });

    it('should map 1-2 days to lightly active', () => {
      expect(nutritionService.activityDaysToLevel(1)).toBe('lightly_active');
      expect(nutritionService.activityDaysToLevel(2)).toBe('lightly_active');
    });

    it('should map 3-4 days to moderately active', () => {
      expect(nutritionService.activityDaysToLevel(3)).toBe('moderately_active');
      expect(nutritionService.activityDaysToLevel(4)).toBe('moderately_active');
    });

    it('should map 5-6 days to very active', () => {
      expect(nutritionService.activityDaysToLevel(5)).toBe('very_active');
      expect(nutritionService.activityDaysToLevel(6)).toBe('very_active');
    });

    it('should map 7 days to extra active', () => {
      expect(nutritionService.activityDaysToLevel(7)).toBe('extra_active');
    });
  });

  describe('goalCategoryToType', () => {
    it('should map weight_loss category to weight_loss type', () => {
      expect(nutritionService.goalCategoryToType('weight_loss')).toBe('weight_loss');
    });

    it('should map muscle_building to muscle_building', () => {
      expect(nutritionService.goalCategoryToType('muscle_building')).toBe('muscle_building');
    });

    it('should map event_training to performance', () => {
      expect(nutritionService.goalCategoryToType('event_training')).toBe('performance');
    });

    it('should map sleep/stress/energy goals to maintenance', () => {
      expect(nutritionService.goalCategoryToType('sleep_improvement')).toBe('maintenance');
      expect(nutritionService.goalCategoryToType('stress_wellness')).toBe('maintenance');
      expect(nutritionService.goalCategoryToType('energy_productivity')).toBe('maintenance');
    });

    it('should default unknown categories to maintenance', () => {
      expect(nutritionService.goalCategoryToType('unknown_goal')).toBe('maintenance');
    });
  });
});
