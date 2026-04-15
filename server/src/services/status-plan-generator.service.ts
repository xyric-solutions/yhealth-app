/**
 * @file Status Plan Generator Service
 * @description Generates concrete alternative workouts, adapted meals, and recovery plans
 * when a user's activity status changes (e.g., sick, traveling, injured).
 */

import { logger } from './logger.service.js';
import { aiProviderService } from './ai-provider.service.js';
import { cache } from './cache.service.js';
import type { ActivityStatus } from '../types/activity-status.types.js';

// ============================================
// TYPES
// ============================================

export interface AlternativeWorkout {
  name: string;
  duration: number; // minutes
  intensity: 'very_low' | 'low' | 'moderate';
  exercises: Array<{
    name: string;
    sets?: number;
    reps?: string;
    duration?: string;
    notes?: string;
  }>;
  equipmentNeeded: string[];
  suitableFor: ActivityStatus[];
}

export interface MealSuggestion {
  name: string;
  category: 'comfort' | 'anti_inflammatory' | 'light' | 'hydrating' | 'energy';
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  description: string;
  approximateCalories: number;
  benefits: string[];
}

export interface RecoveryPlan {
  day: number;
  intensityPercent: number; // 50, 75, 100
  workoutModification: string;
  nutritionNote: string;
  wellbeingTip: string;
}

// ============================================
// FALLBACK DATA
// ============================================

const FALLBACK_WORKOUTS: Record<string, AlternativeWorkout[]> = {
  travel: [
    {
      name: 'Hotel Room Bodyweight Circuit',
      duration: 15,
      intensity: 'moderate',
      exercises: [
        { name: 'Bodyweight Squats', sets: 3, reps: '15' },
        { name: 'Push-ups', sets: 3, reps: '10-15' },
        { name: 'Plank', sets: 3, duration: '30s' },
        { name: 'Lunges', sets: 3, reps: '10 each leg' },
        { name: 'Burpees', sets: 2, reps: '8' },
      ],
      equipmentNeeded: [],
      suitableFor: ['travel', 'vacation'],
    },
    {
      name: 'Morning Mobility Flow',
      duration: 10,
      intensity: 'low',
      exercises: [
        { name: 'Cat-Cow Stretch', sets: 1, duration: '60s' },
        { name: 'Hip Circles', sets: 1, reps: '10 each direction' },
        { name: 'Shoulder Rolls', sets: 1, duration: '30s' },
        { name: 'Standing Forward Fold', sets: 1, duration: '45s' },
        { name: 'Gentle Spinal Twist', sets: 1, duration: '30s each side' },
      ],
      equipmentNeeded: [],
      suitableFor: ['travel', 'rest', 'stress'],
    },
  ],
  stress: [
    {
      name: 'Calming Yoga Flow',
      duration: 20,
      intensity: 'very_low',
      exercises: [
        { name: "Child's Pose", sets: 1, duration: '60s' },
        { name: 'Cat-Cow', sets: 1, duration: '60s' },
        { name: 'Gentle Warrior II', sets: 1, duration: '30s each side' },
        { name: 'Pigeon Pose', sets: 1, duration: '45s each side' },
        { name: 'Savasana', sets: 1, duration: '3 min' },
      ],
      equipmentNeeded: [],
      suitableFor: ['stress', 'rest'],
    },
    {
      name: 'Stress Relief Walk',
      duration: 25,
      intensity: 'low',
      exercises: [
        { name: 'Brisk Walking', duration: '20 min', notes: 'Outdoors if possible' },
        { name: 'Deep Breathing', duration: '5 min', notes: '4-7-8 pattern' },
      ],
      equipmentNeeded: [],
      suitableFor: ['stress'],
    },
  ],
  injury: [
    {
      name: 'Upper Body Focus (Lower Body Injury)',
      duration: 20,
      intensity: 'moderate',
      exercises: [
        { name: 'Seated Shoulder Press', sets: 3, reps: '12', notes: 'Use light weights' },
        { name: 'Seated Rows', sets: 3, reps: '12' },
        { name: 'Bicep Curls', sets: 3, reps: '10' },
        { name: 'Tricep Dips (Chair)', sets: 3, reps: '10' },
      ],
      equipmentNeeded: ['light dumbbells', 'chair'],
      suitableFor: ['injury'],
    },
  ],
  vacation: [
    {
      name: 'Beach/Park Active Fun',
      duration: 30,
      intensity: 'moderate',
      exercises: [
        { name: 'Walking/Jogging', duration: '15 min' },
        { name: 'Bodyweight Squats', sets: 2, reps: '15' },
        { name: 'Push-ups', sets: 2, reps: '10' },
        { name: 'Stretching', duration: '5 min' },
      ],
      equipmentNeeded: [],
      suitableFor: ['vacation', 'travel'],
    },
  ],
  rest: [
    {
      name: 'Gentle Restorative Stretch',
      duration: 15,
      intensity: 'very_low',
      exercises: [
        { name: 'Neck Rolls', sets: 1, duration: '30s each direction' },
        { name: 'Seated Forward Fold', sets: 1, duration: '60s' },
        { name: 'Supine Twist', sets: 1, duration: '45s each side' },
        { name: 'Legs Up the Wall', sets: 1, duration: '3 min' },
      ],
      equipmentNeeded: [],
      suitableFor: ['rest', 'stress', 'sick'],
    },
  ],
  sick: [
    {
      name: 'Light Recovery Walk',
      duration: 10,
      intensity: 'very_low',
      exercises: [
        { name: 'Slow Walking', duration: '10 min', notes: 'Indoors or gentle outdoor walk, stop if dizzy' },
      ],
      equipmentNeeded: [],
      suitableFor: ['sick'],
    },
  ],
};

const MEAL_SUGGESTIONS: Record<string, MealSuggestion[]> = {
  sick: [
    {
      name: 'Chicken Soup',
      category: 'comfort',
      mealType: 'lunch',
      description: 'Classic healing chicken soup with vegetables',
      approximateCalories: 300,
      benefits: ['hydrating', 'easy to digest', 'immune-boosting'],
    },
    {
      name: 'Ginger Lemon Tea with Honey',
      category: 'hydrating',
      mealType: 'snack',
      description: 'Warm ginger tea with lemon and honey',
      approximateCalories: 50,
      benefits: ['soothing', 'anti-inflammatory', 'hydrating'],
    },
    {
      name: 'Toast with Banana',
      category: 'light',
      mealType: 'breakfast',
      description: 'Light whole wheat toast with banana slices',
      approximateCalories: 250,
      benefits: ['easy on stomach', 'energy', 'potassium'],
    },
    {
      name: 'Rice Porridge (Khichdi)',
      category: 'comfort',
      mealType: 'dinner',
      description: 'Simple rice and lentil porridge with mild spices',
      approximateCalories: 350,
      benefits: ['easy to digest', 'protein', 'comforting'],
    },
  ],
  injury: [
    {
      name: 'Grilled Salmon with Leafy Greens',
      category: 'anti_inflammatory',
      mealType: 'lunch',
      description: 'Omega-3 rich salmon with spinach and kale',
      approximateCalories: 500,
      benefits: ['omega-3', 'anti-inflammatory', 'protein for recovery'],
    },
    {
      name: 'Berry Smoothie with Turmeric',
      category: 'anti_inflammatory',
      mealType: 'snack',
      description: 'Mixed berries, turmeric, ginger, and yogurt',
      approximateCalories: 200,
      benefits: ['antioxidants', 'anti-inflammatory', 'vitamin C'],
    },
    {
      name: 'Bone Broth',
      category: 'anti_inflammatory',
      mealType: 'snack',
      description: 'Rich bone broth with collagen',
      approximateCalories: 100,
      benefits: ['collagen', 'joint support', 'hydrating'],
    },
    {
      name: 'Grilled Chicken with Sweet Potato',
      category: 'energy',
      mealType: 'dinner',
      description: 'Lean protein with complex carbs for recovery',
      approximateCalories: 550,
      benefits: ['protein', 'complex carbs', 'vitamin A'],
    },
  ],
  stress: [
    {
      name: 'Dark Chocolate & Almonds',
      category: 'comfort',
      mealType: 'snack',
      description: 'Small portion of dark chocolate with almonds',
      approximateCalories: 200,
      benefits: ['magnesium', 'mood-boosting', 'healthy fats'],
    },
    {
      name: 'Oatmeal with Berries',
      category: 'comfort',
      mealType: 'breakfast',
      description: 'Warm oatmeal topped with mixed berries and honey',
      approximateCalories: 350,
      benefits: ['serotonin-boosting', 'fiber', 'antioxidants'],
    },
    {
      name: 'Avocado Toast with Egg',
      category: 'energy',
      mealType: 'lunch',
      description: 'Whole grain toast with avocado and poached egg',
      approximateCalories: 400,
      benefits: ['healthy fats', 'B vitamins', 'sustained energy'],
    },
  ],
  travel: [
    {
      name: 'Trail Mix',
      category: 'energy',
      mealType: 'snack',
      description: 'Nuts, dried fruit, and dark chocolate mix',
      approximateCalories: 250,
      benefits: ['portable', 'energy-dense', 'no refrigeration needed'],
    },
    {
      name: 'Protein Bar',
      category: 'energy',
      mealType: 'snack',
      description: 'High-protein, low-sugar bar',
      approximateCalories: 200,
      benefits: ['convenient', 'protein', 'portable'],
    },
    {
      name: 'Grilled Chicken Wrap',
      category: 'light',
      mealType: 'lunch',
      description: 'Simple wrap with chicken, veggies, and hummus',
      approximateCalories: 450,
      benefits: ['balanced macros', 'easy to find', 'portable'],
    },
  ],
  vacation: [
    {
      name: 'Fresh Fruit Plate',
      category: 'light',
      mealType: 'breakfast',
      description: 'Seasonal fresh fruits',
      approximateCalories: 200,
      benefits: ['vitamins', 'hydrating', 'light'],
    },
    {
      name: 'Grilled Fish with Vegetables',
      category: 'light',
      mealType: 'dinner',
      description: 'Local grilled fish with steamed vegetables',
      approximateCalories: 450,
      benefits: ['lean protein', 'omega-3', 'light'],
    },
  ],
  rest: [
    {
      name: 'Greek Yogurt with Granola',
      category: 'light',
      mealType: 'breakfast',
      description: 'Protein-rich yogurt with crunchy granola and honey',
      approximateCalories: 300,
      benefits: ['protein', 'probiotics', 'sustained energy'],
    },
    {
      name: 'Vegetable Stir-fry with Tofu',
      category: 'light',
      mealType: 'dinner',
      description: 'Mixed vegetables and tofu in light sauce',
      approximateCalories: 400,
      benefits: ['plant protein', 'fiber', 'micronutrients'],
    },
  ],
};

// ============================================
// SERVICE
// ============================================

class StatusPlanGeneratorService {
  private static readonly WORKOUT_CACHE_TTL = 86400; // 24 hours

  /**
   * Generate alternative workouts suitable for the user's current activity status.
   * Attempts LLM generation first, falls back to pre-built templates.
   */
  async generateAlternativeWorkout(
    status: ActivityStatus,
    workoutType?: string,
  ): Promise<AlternativeWorkout[]> {
    const cacheKey = `status_alt_workout:${status}:${workoutType || 'general'}`;

    // Check cache first
    const cached = cache.get<AlternativeWorkout[]>(cacheKey);
    if (cached) {
      logger.debug(`[StatusPlanGenerator] Cache hit for alternative workouts: ${cacheKey}`);
      return cached;
    }

    // Try LLM generation
    try {
      const response = await aiProviderService.generateCompletion({
        systemPrompt: `You are a fitness coach. Generate 3 alternative workouts suitable for someone who is currently ${status}. Each workout should be safe and appropriate. Return a JSON array of objects with these fields: name (string), duration (number in minutes), intensity ("very_low" | "low" | "moderate"), exercises (array of {name, sets?, reps?, duration?, notes?}), equipmentNeeded (string[]), suitableFor (string[]).`,
        userPrompt: `Status: ${status}. Original workout type: ${workoutType || 'general fitness'}. Generate 3 alternatives.`,
        maxTokens: 800,
        temperature: 0.4,
        jsonMode: true,
      });

      const parsed = this.parseWorkoutResponse(response.content, status);
      if (parsed.length > 0) {
        cache.set(cacheKey, parsed, StatusPlanGeneratorService.WORKOUT_CACHE_TTL);
        logger.info(`[StatusPlanGenerator] LLM generated ${parsed.length} alternative workouts for status=${status}`);
        return parsed;
      }
    } catch (error) {
      logger.warn(`[StatusPlanGenerator] LLM generation failed for status=${status}, using fallback`, { error });
    }

    // Fallback to pre-built templates
    const fallback = this.getFallbackWorkouts(status);
    cache.set(cacheKey, fallback, StatusPlanGeneratorService.WORKOUT_CACHE_TTL);
    logger.info(`[StatusPlanGenerator] Using fallback workouts for status=${status} (${fallback.length} workouts)`);
    return fallback;
  }

  /**
   * Get adapted meal suggestions for the user's current activity status.
   * Pure rule-based — no LLM calls.
   */
  getAdaptedMealSuggestions(status: ActivityStatus): MealSuggestion[] {
    const suggestions = MEAL_SUGGESTIONS[status];
    if (suggestions && suggestions.length > 0) {
      return suggestions;
    }

    // Default meals for statuses without specific suggestions
    logger.debug(`[StatusPlanGenerator] No specific meal suggestions for status=${status}, returning defaults`);
    return [
      {
        name: 'Balanced Bowl',
        category: 'energy',
        mealType: 'lunch',
        description: 'Grilled protein with whole grains, greens, and healthy fats',
        approximateCalories: 500,
        benefits: ['balanced macros', 'sustained energy', 'nutrient-dense'],
      },
      {
        name: 'Fruit & Nut Smoothie',
        category: 'energy',
        mealType: 'snack',
        description: 'Banana, almond butter, spinach, and protein powder',
        approximateCalories: 300,
        benefits: ['quick energy', 'protein', 'micronutrients'],
      },
    ];
  }

  /**
   * Generate a progressive recovery plan for returning to normal activity
   * after a status disruption. Pure rule-based.
   */
  generateRecoveryPlan(fromStatus: ActivityStatus, daysInStatus: number): RecoveryPlan[] {
    const plans: RecoveryPlan[] = [];

    // Determine ramp-up schedule based on status severity and duration
    const { phases, gradualDays } = this.calculateRampUp(fromStatus, daysInStatus);

    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      plans.push({
        day: phase.startDay,
        intensityPercent: phase.intensity,
        workoutModification: phase.workoutMod,
        nutritionNote: phase.nutritionNote,
        wellbeingTip: phase.wellbeingTip,
      });
    }

    logger.info(
      `[StatusPlanGenerator] Generated recovery plan from ${fromStatus} (${daysInStatus} days): ${gradualDays} ramp-up days`,
    );

    return plans;
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  /**
   * Parse LLM response into typed AlternativeWorkout array.
   */
  private parseWorkoutResponse(content: string, status: ActivityStatus): AlternativeWorkout[] {
    try {
      // Try to extract JSON array from the response
      let jsonStr = content.trim();

      // Handle cases where LLM wraps JSON in markdown code blocks
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(jsonStr);
      const workouts: AlternativeWorkout[] = Array.isArray(parsed) ? parsed : [parsed];

      // Validate and sanitize each workout
      return workouts
        .filter((w) => w && typeof w.name === 'string' && typeof w.duration === 'number')
        .map((w) => ({
          name: w.name,
          duration: Math.min(Math.max(w.duration, 5), 60), // Clamp 5-60 min
          intensity: ['very_low', 'low', 'moderate'].includes(w.intensity) ? w.intensity : 'low',
          exercises: Array.isArray(w.exercises)
            ? w.exercises.map((e: Record<string, unknown>) => ({
                name: String(e.name || 'Exercise'),
                ...(e.sets != null && { sets: Number(e.sets) }),
                ...(e.reps != null && { reps: String(e.reps) }),
                ...(e.duration != null && { duration: String(e.duration) }),
                ...(e.notes != null && { notes: String(e.notes) }),
              }))
            : [],
          equipmentNeeded: Array.isArray(w.equipmentNeeded) ? w.equipmentNeeded.map(String) : [],
          suitableFor: Array.isArray(w.suitableFor)
            ? (w.suitableFor as ActivityStatus[])
            : [status],
        }));
    } catch (error) {
      logger.warn('[StatusPlanGenerator] Failed to parse LLM workout response', { error });
      return [];
    }
  }

  /**
   * Get fallback workouts for a given status. Cross-references suitableFor
   * field to find workouts from other statuses that also apply.
   */
  private getFallbackWorkouts(status: ActivityStatus): AlternativeWorkout[] {
    // Direct match first
    const direct = FALLBACK_WORKOUTS[status];
    if (direct && direct.length > 0) {
      return direct;
    }

    // Search all fallback workouts for ones suitable for this status
    const crossMatch: AlternativeWorkout[] = [];
    for (const workouts of Object.values(FALLBACK_WORKOUTS)) {
      for (const workout of workouts) {
        if (workout.suitableFor.includes(status)) {
          crossMatch.push(workout);
        }
      }
    }

    if (crossMatch.length > 0) {
      return crossMatch;
    }

    // Ultimate fallback: gentle mobility for any unknown status
    return [
      {
        name: 'Gentle Full-Body Stretch',
        duration: 10,
        intensity: 'very_low',
        exercises: [
          { name: 'Neck Stretches', sets: 1, duration: '30s each side' },
          { name: 'Shoulder Circles', sets: 1, duration: '30s' },
          { name: 'Standing Side Stretch', sets: 1, duration: '30s each side' },
          { name: 'Hamstring Stretch', sets: 1, duration: '45s each leg' },
          { name: 'Deep Breathing', sets: 1, duration: '2 min' },
        ],
        equipmentNeeded: [],
        suitableFor: [status],
      },
    ];
  }

  /**
   * Calculate the ramp-up schedule based on status type and duration.
   * Longer absences and more severe statuses get more gradual ramp-ups.
   */
  private calculateRampUp(
    fromStatus: ActivityStatus,
    daysInStatus: number,
  ): {
    phases: Array<{
      startDay: number;
      intensity: number;
      workoutMod: string;
      nutritionNote: string;
      wellbeingTip: string;
    }>;
    gradualDays: number;
  } {
    // Severity multiplier: how cautious should the ramp-up be
    const severityMap: Partial<Record<ActivityStatus, number>> = {
      sick: 1.5,
      injury: 2.0,
      stress: 1.0,
      rest: 0.8,
      travel: 0.7,
      vacation: 0.6,
    };
    const severity = severityMap[fromStatus] ?? 1.0;

    // Base ramp-up days: short absence = quick return, long absence = gradual
    let baseDays: number;
    if (daysInStatus <= 2) {
      baseDays = 2;
    } else if (daysInStatus <= 7) {
      baseDays = 3;
    } else if (daysInStatus <= 14) {
      baseDays = 5;
    } else {
      baseDays = 7;
    }

    const gradualDays = Math.ceil(baseDays * severity);

    // Build phases based on total ramp-up days
    if (gradualDays <= 2) {
      return {
        gradualDays,
        phases: [
          {
            startDay: 1,
            intensity: 50,
            workoutMod: 'Focus on form, reduce weights by half',
            nutritionNote: 'Eat nutrient-dense meals to fuel recovery',
            wellbeingTip: 'Get extra sleep tonight',
          },
          {
            startDay: 2,
            intensity: 100,
            workoutMod: 'Resume normal training',
            nutritionNote: 'Normal nutrition plan',
            wellbeingTip: 'Normal routine',
          },
        ],
      };
    }

    if (gradualDays <= 4) {
      return {
        gradualDays,
        phases: [
          {
            startDay: 1,
            intensity: 50,
            workoutMod: 'Focus on form, reduce weights by half',
            nutritionNote: 'Eat nutrient-dense meals to fuel recovery',
            wellbeingTip: 'Get extra sleep, avoid late nights',
          },
          {
            startDay: 2,
            intensity: 75,
            workoutMod: 'Increase volume slightly, listen to your body',
            nutritionNote: 'Maintain balanced nutrition with extra protein',
            wellbeingTip: 'Stay hydrated, take breaks between sets',
          },
          {
            startDay: gradualDays,
            intensity: 100,
            workoutMod: 'Resume normal training',
            nutritionNote: 'Normal nutrition plan',
            wellbeingTip: 'Normal routine',
          },
        ],
      };
    }

    // Extended ramp-up (5+ days)
    const midPoint = Math.ceil(gradualDays / 2);
    const threeQuarter = Math.ceil(gradualDays * 0.75);

    return {
      gradualDays,
      phases: [
        {
          startDay: 1,
          intensity: 30,
          workoutMod: 'Very light activity only — walking, gentle stretching',
          nutritionNote: 'Focus on anti-inflammatory and nutrient-rich foods',
          wellbeingTip: 'Prioritize sleep, consider meditation or journaling',
        },
        {
          startDay: midPoint,
          intensity: 50,
          workoutMod: 'Light workouts at half intensity, focus on form',
          nutritionNote: 'Increase protein intake for muscle recovery',
          wellbeingTip: 'Monitor energy levels, rest if feeling fatigued',
        },
        {
          startDay: threeQuarter,
          intensity: 75,
          workoutMod: 'Moderate workouts, gradually increase weights and volume',
          nutritionNote: 'Maintain balanced nutrition with adequate calories',
          wellbeingTip: 'Stay hydrated, ensure quality sleep',
        },
        {
          startDay: gradualDays,
          intensity: 100,
          workoutMod: 'Resume normal training — full intensity and volume',
          nutritionNote: 'Normal nutrition plan',
          wellbeingTip: 'Normal routine, stay consistent',
        },
      ],
    };
  }
}

export const statusPlanGeneratorService = new StatusPlanGeneratorService();
