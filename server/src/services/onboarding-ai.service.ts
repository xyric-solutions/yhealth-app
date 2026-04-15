/**
 * @file Onboarding AI Service
 * @description Comprehensive AI analysis of onboarding data to generate personalized plans
 * Analyzes: goals, assessment responses (MCQs), body images, body stats, and preferences
 */

import { aiProviderService } from './ai-provider.service.js';
import { env } from '../config/env.config.js';
import { logger } from './logger.service.js';
import { query } from '../database/pg.js';
import { embeddingQueueService } from './embedding-queue.service.js';
import { JobPriorities } from '../config/queue.config.js';

// Server-side question text lookup for DB-loaded assessments (client sends questionText, DB stores only questionId)
const QUESTION_TEXT_MAP: Record<string, string> = {
  activity_level: 'How many days per week are you currently active?',
  sleep_quality: 'How would you rate your sleep quality?',
  stress_level: 'What is your current stress level?',
  meals_per_day: 'How many meals do you typically eat per day?',
  biggest_challenge: 'What is your biggest health challenge?',
  water_intake: 'How many glasses of water do you drink per day?',
  workout_experience: 'How would you describe your workout experience?',
  workout_location: 'Where do you prefer to work out?',
  workout_duration: 'How long can you dedicate to each workout?',
  dietary_restrictions: 'Do you have any dietary restrictions?',
  energy_level: 'How would you rate your daily energy levels?',
  fitness_goal_timeline: 'When do you want to achieve your goal?',
  motivation_source: 'What motivates you to improve your health?',
  previous_attempts: 'Have you tried fitness programs before?',
  available_equipment: 'What equipment do you have access to?',
  cooking_skill: 'How would you rate your cooking skills?',
  food_prep_time: 'How much time can you spend on meal prep daily?',
  supplement_usage: 'Do you currently take any supplements?',
  injury_history: 'Do you have any injuries or physical limitations?',
  health_conditions: 'Do you have any health conditions we should know about?',
};

// Local type for generated workout schedule (matches GeneratedWorkoutPlan.weeklySchedule)
type GeneratedDayWorkout = {
  dayOfWeek: string;
  workoutName: string;
  focusArea: string;
  exercises: Array<{
    name: string;
    sets: number;
    reps: number;
    restSeconds: number;
    instructions?: string[];
  }>;
  estimatedDuration: number;
  estimatedCalories: number;
};

// ============================================
// TYPES
// ============================================

export interface OnboardingData {
  userId: string;
  // Goals
  selectedGoal: string;
  customGoalText?: string;
  confirmedGoals: Array<{
    id: string;
    category: string;
    pillar: string;
    title: string;
    description: string;
    targetValue?: number;
    targetUnit?: string;
    motivation?: string;
    confidenceLevel?: number;
  }>;
  planDurationWeeks: number;
  // Body Stats
  bodyStats: {
    weightKg?: number;
    heightCm?: number;
    targetWeightKg?: number;
    bodyFatPercentage?: number;
    waistCm?: number;
    hipCm?: number;
    chestCm?: number;
  };
  // Assessment Responses (MCQs)
  assessmentResponses: Array<{
    questionId: string;
    questionText: string;
    answer: string | string[] | number;
    category?: string;
  }>;
  // Body Images Analysis
  bodyImagesAnalysis?: {
    hasImages: boolean;
    imageTypes: string[];
    aiAnalysis?: Record<string, object>;
  };
  // Preferences
  preferences: {
    coachingStyle?: string;
    notificationFrequency?: string;
    preferredWorkoutTime?: string;
    preferredCheckInTime?: string;
  };
  // Diet Preferences
  dietPreferences: {
    dietType: string;
    allergies: string[];
    excludedFoods: string[];
    mealsPerDay: number;
    mealTimes: Record<string, string>;
  };
  // User Profile
  userProfile: {
    gender?: string;
    dateOfBirth?: string;
    age?: number;
  };
}

export interface GeneratedDietPlan {
  name: string;
  description: string;
  goalCategory: string;
  dailyCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  fiberGrams: number;
  mealsPerDay: number;
  snacksPerDay: number;
  mealTimes: Record<string, string>;
  weeklyMeals: Record<string, Record<string, string>>;
  dietaryPreferences: string[];
  allergies: string[];
  excludedFoods: string[];
  tips: string[];
  aiRationale: string;
}

export interface GeneratedWorkoutPlan {
  name: string;
  description: string;
  goalCategory: string;
  durationWeeks: number;
  workoutsPerWeek: number;
  workoutLocation: 'gym' | 'home' | 'outdoor';
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
  weeklySchedule: Record<string, {
    dayOfWeek: string;
    workoutName: string;
    focusArea: string;
    exercises: Array<{
      name: string;
      sets: number;
      reps: number;
      restSeconds: number;
      instructions?: string[];
    }>;
    estimatedDuration: number;
    estimatedCalories: number;
  }>;
  availableEquipment: string[];
  tips: string[];
  aiRationale: string;
}

export interface OnboardingAnalysisResult {
  dietPlan: GeneratedDietPlan;
  workoutPlan: GeneratedWorkoutPlan;
  overallAnalysis: {
    healthScore: number;
    riskFactors: string[];
    recommendations: string[];
    motivationalMessage: string;
  };
  provider: string;
}

// ============================================
// SERVICE
// ============================================

class OnboardingAIService {
  /**
   * Analyze all onboarding data and generate comprehensive plans
   * Falls back to default plans if AI is unavailable or fails
   */
  async analyzeAndGeneratePlans(data: OnboardingData): Promise<OnboardingAnalysisResult> {
    logger.info('[OnboardingAI] Starting comprehensive analysis', { userId: data.userId });

    // Always enrich with server-side user data for security and consistency
    const enrichedData = await this.enrichWithUserData(data);

    // Extract primary goal category for default plan fallback
    const primaryGoalCategory = enrichedData.confirmedGoals?.[0]?.category || data.selectedGoal || 'overall_optimization';
    const planDuration = enrichedData.planDurationWeeks || data.planDurationWeeks || 4;

    // If AI is not available, use default plan generator
    if (!aiProviderService.isAvailable()) {
      logger.warn('[OnboardingAI] AI service not available, using default plans');
      return this.getDefaultPlans(primaryGoalCategory, planDuration);
    }

    // Build comprehensive analysis prompt with enriched data
    const analysisPrompt = this.buildAnalysisPrompt(enrichedData);

    try {
      const response = await aiProviderService.generateCompletion({
        systemPrompt: this.getSystemPrompt(),
        userPrompt: analysisPrompt,
        maxTokens: 8192,
        temperature: 0.3,
        timeout: 180000, // 3 minutes — pro model needs more time for deep analysis
        model: env.gemini.reasoningModel, // Use gemini-2.5-pro for best plan quality
        jsonMode: true, // Native JSON output — no markdown wrapping
      });

      // Parse the response
      const result = this.parseAIResponse(response.content, primaryGoalCategory, planDuration);
      result.provider = response.provider;

      logger.info('[OnboardingAI] Analysis complete', {
        userId: data.userId,
        provider: response.provider,
        dietPlanName: result.dietPlan.name,
        workoutPlanName: result.workoutPlan.name,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isTimeout = errorMessage.toLowerCase().includes('timeout') || errorMessage.toLowerCase().includes('timed out');
      const isBalanceError = errorMessage.toLowerCase().includes('insufficient balance') || errorMessage.toLowerCase().includes('402');
      
      logger.warn('[OnboardingAI] AI analysis failed, falling back to default plans', {
        userId: data.userId,
        error: errorMessage,
        reason: isTimeout ? 'timeout' : isBalanceError ? 'insufficient_balance' : 'provider_error',
      });
      
      // CRITICAL: Return default plans instead of throwing
      // This ensures users can still complete onboarding even if AI is unavailable
      const defaultPlans = this.getDefaultPlans(primaryGoalCategory, planDuration);
      logger.info('[OnboardingAI] Generated default plans as fallback', {
        userId: data.userId,
        goalCategory: primaryGoalCategory,
        planDuration,
      });
      return defaultPlans;
    }
  }

  /**
   * Get user's complete onboarding data from database
   */
  async getOnboardingData(userId: string): Promise<OnboardingData | null> {
    try {
      // Get user profile
      const userResult = await query<{
        id: string;
        gender: string | null;
        date_of_birth: Date | null;
      }>(
        `SELECT id, gender, date_of_birth FROM users WHERE id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        return null;
      }

      const user = userResult.rows[0];
      const age = user.date_of_birth
        ? Math.floor((Date.now() - new Date(user.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
        : undefined;

      // Get assessment responses
      const assessmentResult = await query<{
        body_stats: Record<string, number> | null;
        baseline_data: Record<string, unknown> | null;
        responses: Array<{ questionId: string; answer: string | string[] | number }> | null;
      }>(
        `SELECT body_stats, baseline_data, responses FROM assessment_responses
         WHERE user_id = $1 AND is_complete = true
         ORDER BY completed_at DESC LIMIT 1`,
        [userId]
      );

      // Get user goals
      const goalsResult = await query<{
        id: string;
        category: string;
        pillar: string;
        title: string;
        description: string;
        target_value: number | null;
        target_unit: string | null;
        motivation: string | null;
        confidence_level: number | null;
        duration_weeks: number;
      }>(
        `SELECT id, category, pillar, title, description, target_value, target_unit,
                motivation, confidence_level, duration_weeks
         FROM user_goals WHERE user_id = $1 AND status = 'active'
         ORDER BY is_primary DESC, created_at DESC`,
        [userId]
      );

      // Get user preferences (using actual column names from user_preferences table)
      const prefsResult = await query<{
        coaching_style: string | null;
        coaching_intensity: string | null;
        preferred_check_in_time: string | null;
        focus_areas: string[] | null;
      }>(
        `SELECT coaching_style, coaching_intensity, preferred_check_in_time, focus_areas
         FROM user_preferences WHERE user_id = $1`,
        [userId]
      );

      // Get body images with analysis
      const imagesResult = await query<{
        image_type: string;
        analysis_status: string;
        analysis_result: object | null;
      }>(
        `SELECT image_type, analysis_status, analysis_result 
         FROM user_body_images 
         WHERE user_id = $1 AND capture_context = 'onboarding'
         ORDER BY created_at DESC`,
        [userId]
      );

      const assessment = assessmentResult.rows[0];
      const preferences = prefsResult.rows[0];
      const primaryGoal = goalsResult.rows[0];

      return {
        userId,
        selectedGoal: primaryGoal?.category || 'weight_loss',
        confirmedGoals: goalsResult.rows.map(g => ({
          id: g.id,
          category: g.category,
          pillar: g.pillar,
          title: g.title,
          description: g.description,
          targetValue: g.target_value ?? undefined,
          targetUnit: g.target_unit ?? undefined,
          motivation: g.motivation ?? undefined,
          confidenceLevel: g.confidence_level ?? undefined,
        })),
        planDurationWeeks: primaryGoal?.duration_weeks || 4,
        bodyStats: assessment?.body_stats || {},
        assessmentResponses: (assessment?.responses || []).map(r => ({
          questionId: r.questionId,
          questionText: QUESTION_TEXT_MAP[r.questionId] || r.questionId,
          answer: r.answer ?? (r as Record<string, unknown>).value,
        })),
        bodyImagesAnalysis: imagesResult.rows.length > 0 ? {
          hasImages: true,
          imageTypes: imagesResult.rows.map(r => r.image_type),
          aiAnalysis: imagesResult.rows
            .filter(r => r.analysis_status === 'completed' && r.analysis_result !== null)
            .reduce((acc, r) => {
              if (r.analysis_result) {
                acc[r.image_type] = r.analysis_result;
              }
              return acc;
            }, {} as Record<string, object>),
        } : undefined,
        preferences: {
          coachingStyle: preferences?.coaching_style ?? undefined,
          notificationFrequency: preferences?.coaching_intensity ?? undefined, // Use coaching_intensity as proxy
          preferredWorkoutTime: undefined, // Not stored in preferences table
          preferredCheckInTime: preferences?.preferred_check_in_time ?? undefined,
        },
        dietPreferences: {
          dietType: 'standard',
          allergies: [],
          excludedFoods: [],
          mealsPerDay: 3,
          mealTimes: {
            breakfast: '08:00',
            lunch: '12:30',
            dinner: '19:00',
          },
        },
        userProfile: {
          gender: user.gender ?? undefined,
          dateOfBirth: user.date_of_birth ? (user.date_of_birth instanceof Date ? user.date_of_birth.toISOString().split('T')[0] : String(user.date_of_birth).split('T')[0]) : undefined,
          age,
        },
      };
    } catch (error) {
      logger.error('[OnboardingAI] Failed to get onboarding data', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Enrich onboarding data with server-side user profile
   * Always fetches fresh data from DB for security and consistency
   */
  private async enrichWithUserData(data: OnboardingData): Promise<OnboardingData> {
    try {
      const userResult = await query<{
        id: string;
        gender: string | null;
        date_of_birth: Date | null;
      }>(
        `SELECT id, gender, date_of_birth FROM users WHERE id = $1`,
        [data.userId]
      );

      if (userResult.rows.length > 0) {
        const user = userResult.rows[0];
        const age = user.date_of_birth
          ? Math.floor((Date.now() - new Date(user.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
          : undefined;

        data.userProfile = {
          gender: user.gender ?? undefined,
          dateOfBirth: user.date_of_birth ? (user.date_of_birth instanceof Date ? user.date_of_birth.toISOString().split('T')[0] : String(user.date_of_birth).split('T')[0]) : undefined,
          age,
        };

        logger.info('[OnboardingAI] Enriched data with user profile', {
          userId: data.userId,
          hasGender: !!user.gender,
          hasAge: !!age,
        });
      }

      return data;
    } catch (error) {
      logger.warn('[OnboardingAI] Failed to enrich user data, continuing with original', {
        userId: data.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return data;
    }
  }

  /**
   * Save generated plans to database
   * Creates user_plans record FIRST, then links diet_plans and workout_plans
   * @param durationWeeks - Plan duration in weeks (minimum 2 weeks enforced)
   * @returns IDs for all created plan records
   */
  async savePlans(
    userId: string,
    dietPlan: GeneratedDietPlan,
    workoutPlan: GeneratedWorkoutPlan,
    goalId?: string,
    durationWeeks?: number
  ): Promise<{ userPlanId: string; dietPlanId: string; workoutPlanId: string }> {
    // Ensure minimum 2 weeks duration
    const planDuration = Math.max(durationWeeks || workoutPlan.durationWeeks || 4, 2);

    // Calculate start and end dates
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + planDuration * 7 * 24 * 60 * 60 * 1000);
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    logger.info('[OnboardingAI] Creating plans with duration', {
      userId,
      durationWeeks: planDuration,
      startDate: startDateStr,
      endDate: endDateStr,
    });

    // Get primary goal ID and details
    let primaryGoalId = goalId;
    let goalDetails: { pillar: string; category: string } | null = null;

    if (!primaryGoalId) {
      const goalResult = await query<{ id: string; pillar: string; category: string }>(
        `SELECT id, pillar, category FROM user_goals WHERE user_id = $1 AND status = 'active' ORDER BY is_primary DESC LIMIT 1`,
        [userId]
      );
      if (goalResult.rows.length > 0) {
        primaryGoalId = goalResult.rows[0].id;
        goalDetails = {
          pillar: goalResult.rows[0].pillar,
          category: goalResult.rows[0].category,
        };
      }
    } else {
      // Fetch goal details for provided goalId
      const goalResult = await query<{ pillar: string; category: string }>(
        `SELECT pillar, category FROM user_goals WHERE id = $1`,
        [primaryGoalId]
      );
      if (goalResult.rows.length > 0) {
        goalDetails = goalResult.rows[0];
      }
    }

    // If no goal found, create a default one
    if (!primaryGoalId) {
      logger.warn('[OnboardingAI] No active goal found, creating default goal', { userId });
      const defaultGoalResult = await query<{ id: string }>(
        `INSERT INTO user_goals (
          user_id, category, pillar, title, description,
          target_value, target_unit, duration_weeks,
          status, is_primary, ai_suggested
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id`,
        [
          userId,
          workoutPlan.goalCategory || 'overall_optimization',
          'fitness',
          workoutPlan.name || 'Health & Fitness Goal',
          workoutPlan.description || 'Improve overall health and fitness',
          100,
          'percent',
          planDuration,
          'active',
          true,
          true,
        ]
      );
      primaryGoalId = defaultGoalResult.rows[0].id;
      goalDetails = {
        pillar: 'fitness',
        category: workoutPlan.goalCategory || 'overall_optimization',
      };
    }

    // STEP 1: Archive all existing active plans
    await query(
      `UPDATE user_plans SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );
    await query(
      `UPDATE diet_plans SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );
    await query(
      `UPDATE workout_plans SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );

    // STEP 2: Create user_plans record FIRST (this is the main plan container)
    // Convert workout schedule to activities for the overview display
    const activities = this.convertWorkoutScheduleToActivities(workoutPlan, dietPlan);

    const userPlanResult = await query<{ id: string }>(
      `INSERT INTO user_plans (
        user_id, goal_id, name, description, pillar, goal_category,
        start_date, end_date, duration_weeks, current_week,
        status, activities, weekly_focuses,
        ai_generated, ai_model, generation_params, user_adjustments,
        overall_progress, weekly_completion_rates
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING id`,
      [
        userId,
        primaryGoalId,
        workoutPlan.name || dietPlan.name || 'Personalized Health Plan',
        workoutPlan.description || dietPlan.description || 'AI-generated plan tailored to your goals',
        goalDetails?.pillar || 'fitness',
        goalDetails?.category || 'overall_optimization',
        startDateStr,
        endDateStr,
        planDuration,
        1, // current_week starts at 1
        'active',
        JSON.stringify(activities), // populated from workout schedule
        JSON.stringify([]), // weekly_focuses - can be populated later
        true, // ai_generated
        'openai',
        JSON.stringify({
          dietPlanName: dietPlan.name,
          workoutPlanName: workoutPlan.name,
          generatedAt: new Date().toISOString(),
        }),
        '[]', // user_adjustments
        0, // overall_progress
        '[]', // weekly_completion_rates
      ]
    );

    const userPlanId = userPlanResult.rows[0].id;
    logger.info('[OnboardingAI] Created user_plans record', { userId, userPlanId });

    // STEP 3: Create diet_plans with correct plan_id FK
    // Validate goal categories to ensure they match database enum
    const validDietCategory = this.validateGoalCategory(dietPlan.goalCategory);
    const validWorkoutCategory = this.validateGoalCategory(workoutPlan.goalCategory);

    logger.info('[OnboardingAI] Validated goal categories', {
      dietOriginal: dietPlan.goalCategory,
      dietValidated: validDietCategory,
      workoutOriginal: workoutPlan.goalCategory,
      workoutValidated: validWorkoutCategory,
    });

    const dietResult = await query<{ id: string }>(
      `INSERT INTO diet_plans (
        user_id, plan_id, name, description, goal_category,
        daily_calories, protein_grams, carbs_grams, fat_grams, fiber_grams,
        dietary_preferences, allergies, excluded_foods,
        meals_per_day, snacks_per_day, meal_times, weekly_meals,
        suggested_recipes, status, start_date, end_date, ai_generated, ai_model
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING id`,
      [
        userId,
        userPlanId, // Correctly references user_plans.id
        dietPlan.name,
        dietPlan.description,
        validDietCategory,
        dietPlan.dailyCalories,
        dietPlan.proteinGrams,
        dietPlan.carbsGrams,
        dietPlan.fatGrams,
        dietPlan.fiberGrams,
        JSON.stringify(dietPlan.dietaryPreferences || []),
        JSON.stringify(dietPlan.allergies || []),
        JSON.stringify(dietPlan.excludedFoods || []),
        dietPlan.mealsPerDay,
        dietPlan.snacksPerDay,
        JSON.stringify(dietPlan.mealTimes),
        JSON.stringify(dietPlan.weeklyMeals),
        JSON.stringify([]), // suggested_recipes
        'active',
        startDateStr,
        endDateStr,
        true,
        'openai',
      ]
    );

    // STEP 4: Create workout_plans with correct plan_id FK
    const equipmentArray = Array.isArray(workoutPlan.availableEquipment)
      ? workoutPlan.availableEquipment
      : [];

    const workoutResult = await query<{ id: string }>(
      `INSERT INTO workout_plans (
        user_id, plan_id, name, description, goal_category,
        initial_difficulty_level, duration_weeks, workouts_per_week,
        weekly_schedule, available_equipment, workout_location,
        start_date, end_date, ai_generated, ai_model
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::text[], $11, $12, $13, $14, $15)
      RETURNING id`,
      [
        userId,
        userPlanId, // Correctly references user_plans.id
        workoutPlan.name,
        workoutPlan.description,
        validWorkoutCategory,
        workoutPlan.fitnessLevel,
        planDuration,
        workoutPlan.workoutsPerWeek,
        JSON.stringify(workoutPlan.weeklySchedule),
        equipmentArray,
        workoutPlan.workoutLocation,
        startDateStr,
        endDateStr,
        true,
        'openai',
      ]
    );

    const dietPlanId = dietResult.rows[0].id;
    const workoutPlanId = workoutResult.rows[0].id;

    logger.info('[OnboardingAI] Saved all plans to database', {
      userId,
      userPlanId,
      dietPlanId,
      workoutPlanId,
      durationWeeks: planDuration,
    });

    // Enqueue embeddings for diet and workout plans (async, non-blocking)
    await Promise.all([
      embeddingQueueService.enqueueEmbedding({
        userId,
        sourceType: 'diet_plan',
        sourceId: dietPlanId,
        operation: 'create',
        priority: JobPriorities.CRITICAL,
      }),
      embeddingQueueService.enqueueEmbedding({
        userId,
        sourceType: 'workout_plan',
        sourceId: workoutPlanId,
        operation: 'create',
        priority: JobPriorities.CRITICAL,
      }),
    ]);

    // Create meal logs from weekly meals (async, non-blocking)
    this.createMealLogsFromWeeklyMeals(userId, dietPlanId, dietPlan, startDateStr, planDuration)
      .catch((error) => {
        logger.error('[OnboardingAI] Failed to create meal logs from weekly meals', {
          userId,
          dietPlanId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });

    return {
      userPlanId,
      dietPlanId,
      workoutPlanId,
    };
  }

  /**
   * Create meal logs from weekly meals in diet plan
   * Converts the weekly_meals JSON structure into actual meal_logs entries
   */
  private async createMealLogsFromWeeklyMeals(
    userId: string,
    dietPlanId: string,
    dietPlan: GeneratedDietPlan,
    startDate: string,
    durationWeeks: number
  ): Promise<void> {
    try {
      if (!dietPlan.weeklyMeals || Object.keys(dietPlan.weeklyMeals).length === 0) {
        logger.warn('[OnboardingAI] No weekly meals to create logs from', { userId, dietPlanId });
        return;
      }

      const mealLogs: Array<{
        userId: string;
        dietPlanId: string;
        mealType: string;
        mealName: string;
        description: string;
        calories: number | null;
        proteinGrams: number | null;
        carbsGrams: number | null;
        fatGrams: number | null;
        fiberGrams: number | null;
        foods: unknown[];
        eatenAt: string;
      }> = [];

      const startDateObj = new Date(startDate);
      const mealTimes = dietPlan.mealTimes || {};

      // Generate meal logs for TODAY only (not entire plan duration)
      // Future meals are created day-by-day as the user progresses via daily scheduling
      const todayDayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][startDateObj.getDay()];
      const todayMealsEntries = Object.entries(dietPlan.weeklyMeals).filter(
        ([dayName]) => dayName.toLowerCase() === todayDayName
      );

      // If no meals for today's day name, use the first available day
      const mealsToCreate = todayMealsEntries.length > 0
        ? todayMealsEntries
        : Object.entries(dietPlan.weeklyMeals).slice(0, 1);

      // Only create meals for the 3 core meal types with fixed times
      const ALLOWED_MEAL_TYPES = ['breakfast', 'lunch', 'dinner'];
      const DEFAULT_MEAL_TIMES: Record<string, string> = { breakfast: '08:00', lunch: '13:00', dinner: '19:00' };
      const seenMealNames = new Set<string>();

      for (const [_dayName, dayMeals] of mealsToCreate) {
          const dayDate = new Date(startDateObj);

          // Process ONLY breakfast, lunch, dinner (skip snacks and extras)
          if (typeof dayMeals === 'object' && dayMeals !== null) {
            for (const [mealType, mealData] of Object.entries(dayMeals)) {
              if (!mealData) continue;
              // Skip non-core meal types (snacks, extras, etc.)
              if (!ALLOWED_MEAL_TYPES.includes(mealType.toLowerCase().replace(/[_\s\d]/g, ''))) continue;

              // Parse meal data - could be string or object
              let mealName = '';
              let description = '';
              let calories: number | null = null;
              let protein: number | null = null;
              let carbs: number | null = null;
              let fat: number | null = null;
              let fiber: number | null = null;
              let foods: unknown[] = [];

              if (typeof mealData === 'string') {
                // Simple string meal name
                mealName = mealData;
                description = mealData;
              } else if (typeof mealData === 'object' && mealData !== null) {
                // Structured meal object
                const meal = mealData as any;
                mealName = meal.name || meal.mealName || mealType;
                description = meal.description || mealName;
                calories = meal.calories || null;
                protein = meal.protein || meal.proteinGrams || null;
                carbs = meal.carbs || meal.carbsGrams || null;
                fat = meal.fat || meal.fatGrams || null;
                fiber = meal.fiber || meal.fiberGrams || null;
                foods = meal.foods || meal.ingredients || [];
              }

              // Get meal time for this meal type
              // Use default times if not specified in plan
              const mealTime = mealTimes[mealType] || DEFAULT_MEAL_TIMES[mealType] || '12:00';
              const [hours, minutes] = mealTime.split(':');
              const eatenAt = new Date(dayDate);
              eatenAt.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

              // Skip duplicate meal names (AI sometimes generates the same meal twice)
              const dedupeKey = `${mealType}:${mealName.toLowerCase().trim()}`;
              if (seenMealNames.has(dedupeKey)) continue;
              seenMealNames.add(dedupeKey);

              mealLogs.push({
                userId,
                dietPlanId,
                mealType,
                mealName: mealName.slice(0, 200),
                description: description.slice(0, 2000),
                calories,
                proteinGrams: protein,
                carbsGrams: carbs,
                fatGrams: fat,
                fiberGrams: fiber,
                foods: Array.isArray(foods) ? foods : [],
                eatenAt: eatenAt.toISOString(),
              });
            }
          }
        }

      // Batch insert meal logs (in chunks of 50 to avoid query size limits)
      const chunkSize = 50;
      for (let i = 0; i < mealLogs.length; i += chunkSize) {
        const chunk = mealLogs.slice(i, i + chunkSize);
        
        // Insert one by one to get IDs for embedding queue
        for (const meal of chunk) {
          const result = await query<{ id: string }>(
            `INSERT INTO meal_logs (
              user_id, diet_plan_id, meal_type, meal_name, description,
              calories, protein_grams, carbs_grams, fat_grams, fiber_grams,
              foods, eaten_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id`,
            [
              meal.userId,
              meal.dietPlanId,
              meal.mealType,
              meal.mealName,
              meal.description,
              meal.calories,
              meal.proteinGrams,
              meal.carbsGrams,
              meal.fatGrams,
              meal.fiberGrams,
              JSON.stringify(meal.foods),
              meal.eatenAt,
            ]
          );

          // Enqueue embedding for meal log (async, non-blocking)
          if (result.rows[0]?.id) {
            embeddingQueueService.enqueueEmbedding({
              userId,
              sourceType: 'meal_log',
              sourceId: result.rows[0].id,
              operation: 'create',
              priority: JobPriorities.MEDIUM,
            }).catch((err) => {
              logger.warn('[OnboardingAI] Failed to enqueue meal log embedding', {
                userId,
                mealLogId: result.rows[0].id,
                error: err instanceof Error ? err.message : 'Unknown error',
              });
            });
          }
        }
      }

      logger.info('[OnboardingAI] Created meal logs from weekly meals', {
        userId,
        dietPlanId,
        mealLogsCount: mealLogs.length,
        weeks: durationWeeks,
      });
    } catch (error) {
      logger.error('[OnboardingAI] Error creating meal logs from weekly meals', {
        userId,
        dietPlanId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Don't throw - this is non-critical, meal logs can be created manually
    }
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  /**
   * Convert workout schedule and diet plan to activities for user_plans
   * This enables the Overview page to show today's activities
   */
  private convertWorkoutScheduleToActivities(
    workoutPlan: GeneratedWorkoutPlan,
    dietPlan: GeneratedDietPlan
  ): Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    daysOfWeek: string[];
    preferredTime: string;
    duration?: number;
    isOptional?: boolean;
    instructions?: string[];
  }> {
    const activities: Array<{
      id: string;
      type: string;
      title: string;
      description: string;
      daysOfWeek: string[];
      preferredTime: string;
      duration?: number;
      isOptional?: boolean;
      instructions?: string[];
    }> = [];

    // Add workout activities from weekly schedule
    if (workoutPlan.weeklySchedule) {
      Object.entries(workoutPlan.weeklySchedule).forEach(([day, workout]) => {
        if (workout && workout.workoutName) {
          const exerciseList = workout.exercises
            .map(e => `${e.name}: ${e.sets}x${e.reps}`)
            .slice(0, 3)
            .join(', ');

          activities.push({
            id: `workout-${day}-${Date.now()}`,
            type: 'workout',
            title: workout.workoutName,
            description: `${workout.focusArea} - ${exerciseList}${workout.exercises.length > 3 ? '...' : ''}`,
            daysOfWeek: [day],
            preferredTime: '07:00', // Default morning workout
            duration: workout.estimatedDuration,
            isOptional: false,
            instructions: workout.exercises.map(e =>
              e.instructions ? e.instructions.join('. ') : `${e.name}: ${e.sets} sets x ${e.reps} reps, ${e.restSeconds}s rest`
            ),
          });
        }
      });
    }

    // Add meal tracking activities
    const mealDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    if (dietPlan.mealTimes) {
      // Add breakfast tracking
      activities.push({
        id: `meal-breakfast-${Date.now()}`,
        type: 'meal',
        title: 'Breakfast',
        description: `Track your breakfast (target: ~${Math.round(dietPlan.dailyCalories * 0.25)} cal)`,
        daysOfWeek: mealDays,
        preferredTime: dietPlan.mealTimes.breakfast || '08:00',
        isOptional: false,
      });

      // Add lunch tracking
      activities.push({
        id: `meal-lunch-${Date.now() + 1}`,
        type: 'meal',
        title: 'Lunch',
        description: `Track your lunch (target: ~${Math.round(dietPlan.dailyCalories * 0.35)} cal)`,
        daysOfWeek: mealDays,
        preferredTime: dietPlan.mealTimes.lunch || '12:30',
        isOptional: false,
      });

      // Add dinner tracking
      activities.push({
        id: `meal-dinner-${Date.now() + 2}`,
        type: 'meal',
        title: 'Dinner',
        description: `Track your dinner (target: ~${Math.round(dietPlan.dailyCalories * 0.30)} cal)`,
        daysOfWeek: mealDays,
        preferredTime: dietPlan.mealTimes.dinner || '19:00',
        isOptional: false,
      });

      // Add snacks if configured
      if (dietPlan.snacksPerDay > 0) {
        activities.push({
          id: `meal-snacks-${Date.now() + 3}`,
          type: 'meal',
          title: 'Snacks',
          description: `Track your ${dietPlan.snacksPerDay} snack(s) (target: ~${Math.round(dietPlan.dailyCalories * 0.10)} cal)`,
          daysOfWeek: mealDays,
          preferredTime: dietPlan.mealTimes.snack || '15:00',
          isOptional: true,
        });
      }
    }

    // Add water intake tracking
    activities.push({
      id: `hydration-${Date.now() + 4}`,
      type: 'habit',
      title: 'Water Intake',
      description: 'Track your daily water intake (8 glasses recommended)',
      daysOfWeek: mealDays,
      preferredTime: '09:00',
      isOptional: false,
    });

    logger.info('[OnboardingAI] Generated activities from plans', {
      totalActivities: activities.length,
      workoutActivities: activities.filter(a => a.type === 'workout').length,
      mealActivities: activities.filter(a => a.type === 'meal').length,
    });

    return activities;
  }

  /**
   * Validate and normalize goal category to match database enum
   * Maps invalid values to their closest valid equivalent
   */
  private validateGoalCategory(category: string | undefined): string {
    const validCategories = [
      'weight_loss',
      'muscle_building',
      'sleep_improvement',
      'stress_wellness',
      'energy_productivity',
      'event_training',
      'health_condition',
      'habit_building',
      'overall_optimization',
      'custom',
    ];

    if (!category) {
      return 'overall_optimization';
    }

    const normalized = category.toLowerCase().replace(/[- ]/g, '_');

    if (validCategories.includes(normalized)) {
      return normalized;
    }

    // Map common AI-generated values to valid enum values
    const mappings: Record<string, string> = {
      strength: 'muscle_building',
      endurance: 'event_training',
      flexibility: 'overall_optimization',
      cardio: 'weight_loss',
      weight_gain: 'muscle_building',
      fat_loss: 'weight_loss',
      general_fitness: 'overall_optimization',
      health: 'health_condition',
      wellness: 'stress_wellness',
      performance: 'event_training',
    };

    return mappings[normalized] || 'overall_optimization';
  }

  private getSystemPrompt(): string {
    return `You are an elite-level health and fitness coach with board-certified expertise in:
- Clinical nutrition science (ISSN-certified) — TDEE calculation, macro periodization, nutrient timing
- Exercise physiology (CSCS-level) — progressive overload, periodization, movement patterns
- Behavioral psychology — habit formation (BJ Fogg's Tiny Habits), motivation science, adherence optimization
- Sports medicine — injury prevention, recovery protocols, contraindicated exercises

Your task: Perform a DEEP analysis of the user's complete onboarding data and generate highly personalized, evidence-based plans.

## Analysis Protocol

1. **Goal Deep-Dive**: Examine primary + secondary goals, user's stated motivation, and confidence level (1-10). Low confidence (1-4) = simpler entry-level plans with quick wins. High confidence (7-10) = more ambitious programming.

2. **Body Composition Analysis**: Calculate BMI from weight/height. Estimate TDEE using Mifflin-St Jeor equation × activity multiplier derived from assessment responses. For weight loss: 300-500 kcal deficit. For muscle building: 200-400 kcal surplus. For maintenance goals: match TDEE.

3. **Lifestyle Pattern Analysis**: Extract sleep patterns, stress levels, activity level, time availability, and constraints from assessment responses. Tailor workout duration and meal complexity to realistic lifestyle capacity.

4. **Risk Factor Assessment**: Flag any concerning BMI ranges (<18.5 or >35), extreme calorie targets, or age-related considerations. Recommend medical consultation where appropriate.

5. **Progressive Programming**: Week 1-2 = adaptation phase (60-70% intensity). Week 3-4 = building phase. Week 5+ = progression phase. Never start at maximum intensity.

6. **Meal Specificity**: Provide SPECIFIC meal descriptions with actual food items and approximate portions (e.g., "200g grilled chicken breast with 150g brown rice and steamed broccoli" not just "protein with carbs and vegetables"). Respect all dietary restrictions, allergies, and excluded foods.

7. **Exercise Precision**: Include 2-3 form cues per exercise in instructions. Specify rest periods based on goal (30-60s for fat loss, 90-180s for strength). Use proper periodization (not random exercises).

## Output Requirements

Respond with a JSON object containing dietPlan, workoutPlan, and overallAnalysis. Fill ALL 7 days in weeklyMeals and weeklySchedule (rest days should have dayOfWeek and workoutName: "Rest Day" with exercises as empty array).

{
  "dietPlan": {
    "name": "string (creative, motivating name)",
    "description": "string (2-3 sentences explaining the nutritional strategy)",
    "goalCategory": "weight_loss|muscle_building|sleep_improvement|stress_wellness|energy_productivity|event_training|health_condition|habit_building|overall_optimization|custom",
    "dailyCalories": number,
    "proteinGrams": number,
    "carbsGrams": number,
    "fatGrams": number,
    "fiberGrams": number,
    "mealsPerDay": number,
    "snacksPerDay": number,
    "mealTimes": {"breakfast": "HH:MM", "lunch": "HH:MM", "dinner": "HH:MM"},
    "weeklyMeals": {
      "monday": {"breakfast": "specific meal with portions", "lunch": "specific meal", "dinner": "specific meal"},
      "tuesday": {"breakfast": "...", "lunch": "...", "dinner": "..."},
      "wednesday": {"breakfast": "...", "lunch": "...", "dinner": "..."},
      "thursday": {"breakfast": "...", "lunch": "...", "dinner": "..."},
      "friday": {"breakfast": "...", "lunch": "...", "dinner": "..."},
      "saturday": {"breakfast": "...", "lunch": "...", "dinner": "..."},
      "sunday": {"breakfast": "...", "lunch": "...", "dinner": "..."}
    },
    "dietaryPreferences": ["string"],
    "allergies": ["string"],
    "excludedFoods": ["string"],
    "tips": ["5 specific, actionable nutrition tips tailored to user's goal"],
    "aiRationale": "string — explain the caloric target calculation (TDEE - deficit or + surplus), macro ratio reasoning, and why this specific meal plan suits this user's lifestyle and goals"
  },
  "workoutPlan": {
    "name": "string (creative, motivating name)",
    "description": "string (2-3 sentences explaining the training philosophy)",
    "goalCategory": "same as dietPlan",
    "durationWeeks": number,
    "workoutsPerWeek": number,
    "workoutLocation": "gym|home|outdoor",
    "fitnessLevel": "beginner|intermediate|advanced",
    "weeklySchedule": {
      "monday": {
        "dayOfWeek": "monday",
        "workoutName": "string",
        "focusArea": "string (e.g., Upper Body Push, HIIT Cardio, Active Recovery)",
        "exercises": [
          {"name": "string", "sets": number, "reps": number, "restSeconds": number, "instructions": ["form cue 1", "form cue 2"]}
        ],
        "estimatedDuration": number (minutes),
        "estimatedCalories": number
      }
    },
    "availableEquipment": ["string"],
    "tips": ["5 specific training tips for this user's level and goal"],
    "aiRationale": "string — explain the split choice, progression strategy, and how this program addresses the user's specific goals and constraints"
  },
  "overallAnalysis": {
    "healthScore": number (1-100, based on BMI, activity level, goal realism),
    "riskFactors": ["any health concerns identified from the data"],
    "recommendations": ["3-5 personalized lifestyle recommendations beyond diet and exercise"],
    "motivationalMessage": "string — personalized, referencing the user's specific goals and motivation"
  }
}`;
  }

  private buildAnalysisPrompt(data: OnboardingData): string {
    const sections: string[] = [];

    // User Profile
    sections.push(`## USER PROFILE
- Gender: ${data.userProfile?.gender || 'Not specified'}
- Age: ${data.userProfile?.age || 'Not specified'} years old`);

    // Goals — with confidence interpretation
    const avgConfidence = data.confirmedGoals.length > 0
      ? data.confirmedGoals.reduce((sum, g) => sum + (g.confidenceLevel || 5), 0) / data.confirmedGoals.length
      : 5;
    const confidenceLevel = avgConfidence <= 4 ? 'LOW' : avgConfidence >= 7 ? 'HIGH' : 'MODERATE';

    sections.push(`## GOALS
Primary Goal: ${data.selectedGoal}
${data.customGoalText ? `Custom Goal Text: ${data.customGoalText}` : ''}
Plan Duration: ${data.planDurationWeeks} weeks
Average Confidence Level: ${avgConfidence.toFixed(1)}/10 (${confidenceLevel})
${confidenceLevel === 'LOW' ? '→ IMPORTANT: Low confidence — create simple, achievable plans with quick wins to build momentum.' : ''}
${confidenceLevel === 'HIGH' ? '→ High confidence — user is motivated for an ambitious but safe program.' : ''}

Confirmed Goals:
${data.confirmedGoals.map(g =>
  `- ${g.title} (${g.category}, pillar: ${g.pillar || 'general'}): ${g.description}
   Motivation: ${g.motivation || 'Not specified'}
   Confidence: ${g.confidenceLevel || 'Not specified'}/10`
).join('\n')}`);

    // Body Stats with TDEE estimation
    if (data.bodyStats && Object.keys(data.bodyStats).length > 0) {
      const weight = data.bodyStats.weightKg;
      const height = data.bodyStats.heightCm;
      const age = data.userProfile?.age;
      const gender = data.userProfile?.gender;

      let bmi: string = 'N/A';
      let bmr: string = 'N/A';
      let tdeeEstimate: string = 'N/A';

      if (weight && height) {
        const bmiVal = weight / ((height / 100) ** 2);
        bmi = bmiVal.toFixed(1);

        // Mifflin-St Jeor BMR estimation
        if (age) {
          const bmrVal = gender?.toLowerCase() === 'female'
            ? 10 * weight + 6.25 * height - 5 * age - 161
            : 10 * weight + 6.25 * height - 5 * age + 5;
          bmr = `${Math.round(bmrVal)} kcal/day`;
          // Assume lightly active (1.375) as default — LLM should adjust based on assessment
          tdeeEstimate = `~${Math.round(bmrVal * 1.375)} kcal/day (lightly active estimate — adjust based on assessment responses)`;
        }
      }

      sections.push(`## BODY MEASUREMENTS & METABOLIC ESTIMATES
- Weight: ${weight || 'N/A'} kg
- Height: ${height || 'N/A'} cm
- Target Weight: ${data.bodyStats.targetWeightKg || 'N/A'} kg
- Body Fat: ${data.bodyStats.bodyFatPercentage || 'N/A'}%
- Waist: ${data.bodyStats.waistCm || 'N/A'} cm
- Hip: ${data.bodyStats.hipCm || 'N/A'} cm
- Chest: ${data.bodyStats.chestCm || 'N/A'} cm
- BMI: ${bmi}
- Estimated BMR (Mifflin-St Jeor): ${bmr}
- Estimated TDEE: ${tdeeEstimate}

Use these values to calculate precise caloric targets. Adjust the activity multiplier based on the assessment responses below.`);
    }

    // Goal-specific coaching directive
    const goalDirectives: Record<string, string> = {
      weight_loss: 'Create a 300-500 kcal deficit from TDEE. Prioritize protein (1.6-2.2g/kg) to preserve muscle. Include 3-4 resistance training days + 2 cardio sessions.',
      muscle_building: 'Create a 200-400 kcal surplus from TDEE. Protein at 1.8-2.4g/kg. Focus on compound movements with progressive overload. 4-5 training days.',
      sleep_improvement: 'Focus on circadian-friendly meal timing (no heavy meals 3h before bed). Include evening wind-down routines. Moderate exercise intensity, no late workouts.',
      stress_wellness: 'Prioritize anti-inflammatory foods, adequate magnesium and omega-3s. Include yoga, meditation, and low-intensity steady-state cardio. Avoid overtraining.',
      energy_productivity: 'Balance blood sugar with regular protein-rich meals. Include morning movement for energy. Mix HIIT and steady-state for metabolic flexibility.',
      event_training: 'Periodize training toward event date. Taper in final 1-2 weeks. Fuel for performance, not restriction.',
      overall_optimization: 'Balanced approach across all domains. Moderate deficit if overweight, maintenance if healthy weight. Full-body training 3-4x/week.',
    };
    const directive = goalDirectives[data.selectedGoal] || goalDirectives['overall_optimization'];
    sections.push(`## GOAL-SPECIFIC COACHING DIRECTIVE
${directive}`);

    // Assessment Responses
    if (data.assessmentResponses && data.assessmentResponses.length > 0) {
      sections.push(`## ASSESSMENT RESPONSES (Lifestyle & Habits)
These reveal the user's current habits, constraints, and readiness. Use them to calibrate plan difficulty and meal complexity.

${data.assessmentResponses.map(r =>
  `Q: ${r.questionText || r.questionId}
A: ${Array.isArray(r.answer) ? r.answer.join(', ') : r.answer}${r.category ? ` [Category: ${r.category}]` : ''}`
).join('\n\n')}`);
    }

    // Body Images
    if (data.bodyImagesAnalysis?.hasImages) {
      const imageTypes = data.bodyImagesAnalysis.imageTypes?.join(', ') || 'Various';
      const analysis = data.bodyImagesAnalysis.aiAnalysis;

      if (analysis && Object.keys(analysis).length > 0) {
        sections.push(`## BODY IMAGES ANALYSIS
User has uploaded body images: ${imageTypes}

AI Analysis Results:
${Object.entries(analysis).map(([type, result]) =>
  `${type.toUpperCase()} View:
${JSON.stringify(result, null, 2)}`
).join('\n\n')}

Use these visual insights to adjust workout plans based on body composition, identify muscle imbalances, and set realistic progress expectations.`);
      } else {
        sections.push(`## BODY IMAGES
User has uploaded body images: ${imageTypes}
Note: Images uploaded but analysis pending. Use general guidelines based on goals and stats.`);
      }
    }

    // Diet Preferences
    const dietPrefs = data.dietPreferences || {};
    sections.push(`## DIET PREFERENCES
- Diet Type: ${dietPrefs.dietType || 'Standard'}
- Allergies: ${dietPrefs.allergies?.length > 0 ? dietPrefs.allergies.join(', ') : 'None'}
- Excluded Foods: ${dietPrefs.excludedFoods?.length > 0 ? dietPrefs.excludedFoods.join(', ') : 'None'}
- Meals Per Day: ${dietPrefs.mealsPerDay || 3}
- Meal Times: Breakfast at ${dietPrefs.mealTimes?.breakfast || '08:00'}, Lunch at ${dietPrefs.mealTimes?.lunch || '12:30'}, Dinner at ${dietPrefs.mealTimes?.dinner || '19:00'}

CRITICAL: All meal suggestions MUST respect allergies and excluded foods. Never suggest excluded items.`);

    // Preferences
    const prefs = data.preferences || {};
    sections.push(`## USER PREFERENCES
- Coaching Style: ${prefs.coachingStyle || 'Supportive'}
- Preferred Workout Time: ${prefs.preferredWorkoutTime || 'Morning'}
- Notification Frequency: ${prefs.notificationFrequency || 'Daily'}`);

    return `Analyze the following user data comprehensively and generate highly personalized diet and workout plans. Think step-by-step: first calculate metabolic needs, then design nutrition to match, then build a training program that complements the nutrition strategy.

${sections.join('\n\n')}

Generate the JSON response with SPECIFIC meals (real food items with approximate portions), SPECIFIC exercises (with form cues in instructions), and a DETAILED rationale explaining your reasoning for caloric targets and programming choices.`;
  }

  private parseAIResponse(content: string, goalCategory: string = 'overall_optimization', planDuration: number = 4): OnboardingAnalysisResult {
    try {
      // Clean up the response
      let jsonStr = content.trim();

      // Remove markdown code blocks if present
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(jsonStr);

      // Validate required fields
      if (!parsed.dietPlan || !parsed.workoutPlan || !parsed.overallAnalysis) {
        throw new Error('Missing required plan sections in AI response');
      }

      // Get goal-based defaults
      const defaults = this.getGoalBasedDefaults(goalCategory);

      return {
        dietPlan: {
          name: parsed.dietPlan.name || defaults.dietPlanName,
          description: parsed.dietPlan.description || '',
          goalCategory: parsed.dietPlan.goalCategory || goalCategory,
          dailyCalories: parsed.dietPlan.dailyCalories || defaults.dailyCalories,
          proteinGrams: parsed.dietPlan.proteinGrams || defaults.proteinGrams,
          carbsGrams: parsed.dietPlan.carbsGrams || defaults.carbsGrams,
          fatGrams: parsed.dietPlan.fatGrams || defaults.fatGrams,
          fiberGrams: parsed.dietPlan.fiberGrams || 25,
          mealsPerDay: parsed.dietPlan.mealsPerDay || defaults.mealsPerDay,
          snacksPerDay: parsed.dietPlan.snacksPerDay || 2,
          mealTimes: parsed.dietPlan.mealTimes || { breakfast: '08:00', lunch: '12:30', dinner: '19:00' },
          weeklyMeals: parsed.dietPlan.weeklyMeals || {},
          dietaryPreferences: parsed.dietPlan.dietaryPreferences || [],
          allergies: parsed.dietPlan.allergies || [],
          excludedFoods: parsed.dietPlan.excludedFoods || [],
          tips: parsed.dietPlan.tips || [],
          aiRationale: parsed.dietPlan.aiRationale || '',
        },
        workoutPlan: {
          name: parsed.workoutPlan.name || defaults.workoutPlanName,
          description: parsed.workoutPlan.description || '',
          goalCategory: parsed.workoutPlan.goalCategory || goalCategory,
          durationWeeks: parsed.workoutPlan.durationWeeks || planDuration,
          workoutsPerWeek: parsed.workoutPlan.workoutsPerWeek || defaults.workoutsPerWeek,
          workoutLocation: parsed.workoutPlan.workoutLocation || 'home',
          fitnessLevel: parsed.workoutPlan.fitnessLevel || 'beginner',
          weeklySchedule: parsed.workoutPlan.weeklySchedule || {},
          availableEquipment: parsed.workoutPlan.availableEquipment || [],
          tips: parsed.workoutPlan.tips || [],
          aiRationale: parsed.workoutPlan.aiRationale || '',
        },
        overallAnalysis: {
          healthScore: parsed.overallAnalysis.healthScore || 70,
          riskFactors: parsed.overallAnalysis.riskFactors || [],
          recommendations: parsed.overallAnalysis.recommendations || [],
          motivationalMessage: parsed.overallAnalysis.motivationalMessage || 'You are on your way to a healthier you!',
        },
        provider: 'unknown',
      };
    } catch (error) {
      logger.error('[OnboardingAI] Failed to parse AI response', {
        error: error instanceof Error ? error.message : 'Unknown error',
        content: content.substring(0, 500),
      });

      // Return default plans as fallback
      return this.getDefaultPlans(goalCategory, planDuration);
    }
  }

  /**
   * Get goal-specific default values for diet and workout plans
   */
  private getGoalBasedDefaults(goalCategory: string): {
    dietPlanName: string;
    workoutPlanName: string;
    dailyCalories: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
    mealsPerDay: number;
    workoutsPerWeek: number;
    workoutFocus: string;
  } {
    const defaults: Record<string, ReturnType<typeof this.getGoalBasedDefaults>> = {
      // Muscle Building / Weight Gain
      muscle_building: {
        dietPlanName: 'Muscle Building Nutrition Plan',
        workoutPlanName: 'Strength Training Program',
        dailyCalories: 2800,
        proteinGrams: 180,
        carbsGrams: 300,
        fatGrams: 90,
        mealsPerDay: 5,
        workoutsPerWeek: 4,
        workoutFocus: 'Hypertrophy and strength',
      },
      weight_gain: {
        dietPlanName: 'Healthy Weight Gain Plan',
        workoutPlanName: 'Progressive Strength Program',
        dailyCalories: 2600,
        proteinGrams: 150,
        carbsGrams: 320,
        fatGrams: 85,
        mealsPerDay: 5,
        workoutsPerWeek: 4,
        workoutFocus: 'Strength and mass building',
      },
      // Weight Loss / Fat Loss
      weight_loss: {
        dietPlanName: 'Sustainable Weight Loss Plan',
        workoutPlanName: 'Fat Burning Fitness Program',
        dailyCalories: 1800,
        proteinGrams: 140,
        carbsGrams: 150,
        fatGrams: 60,
        mealsPerDay: 4,
        workoutsPerWeek: 4,
        workoutFocus: 'Cardio and circuit training',
      },
      fat_loss: {
        dietPlanName: 'Body Recomposition Plan',
        workoutPlanName: 'Metabolic Training Program',
        dailyCalories: 1900,
        proteinGrams: 150,
        carbsGrams: 160,
        fatGrams: 65,
        mealsPerDay: 4,
        workoutsPerWeek: 5,
        workoutFocus: 'HIIT and resistance training',
      },
      // Endurance / Cardio
      endurance: {
        dietPlanName: 'Endurance Athlete Nutrition',
        workoutPlanName: 'Cardiovascular Endurance Program',
        dailyCalories: 2400,
        proteinGrams: 120,
        carbsGrams: 300,
        fatGrams: 70,
        mealsPerDay: 4,
        workoutsPerWeek: 5,
        workoutFocus: 'Cardio and stamina building',
      },
      cardio_improvement: {
        dietPlanName: 'Heart Health Nutrition Plan',
        workoutPlanName: 'Cardio Improvement Program',
        dailyCalories: 2200,
        proteinGrams: 100,
        carbsGrams: 260,
        fatGrams: 65,
        mealsPerDay: 4,
        workoutsPerWeek: 4,
        workoutFocus: 'Aerobic conditioning',
      },
      // Flexibility / Mobility
      flexibility: {
        dietPlanName: 'Anti-Inflammatory Nutrition',
        workoutPlanName: 'Flexibility & Mobility Program',
        dailyCalories: 2000,
        proteinGrams: 100,
        carbsGrams: 220,
        fatGrams: 70,
        mealsPerDay: 3,
        workoutsPerWeek: 4,
        workoutFocus: 'Stretching and yoga',
      },
      // General / Default
      overall_optimization: {
        dietPlanName: 'Balanced Nutrition Plan',
        workoutPlanName: 'Complete Fitness Program',
        dailyCalories: 2200,
        proteinGrams: 120,
        carbsGrams: 240,
        fatGrams: 70,
        mealsPerDay: 4,
        workoutsPerWeek: 4,
        workoutFocus: 'Balanced fitness',
      },
    };

    return defaults[goalCategory] || defaults.overall_optimization;
  }

  /**
   * Generate goal-specific workout schedule
   */
  private generateDefaultWeeklySchedule(goalCategory: string, workoutsPerWeek: number): Record<string, GeneratedDayWorkout> {
    const workoutDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const selectedDays = workoutDays.slice(0, workoutsPerWeek);

    // Goal-specific workout templates
    const workoutTemplates: Record<string, Array<{
      name: string;
      focusArea: string;
      exercises: Array<{ name: string; sets: number; reps: number; restSeconds: number; instructions: string[] }>;
      duration: number;
    }>> = {
      muscle_building: [
        {
          name: 'Upper Body Push',
          focusArea: 'Chest, shoulders, triceps',
          exercises: [
            { name: 'Push-ups', sets: 4, reps: 12, restSeconds: 90, instructions: ['Full range of motion'] },
            { name: 'Pike Push-ups', sets: 3, reps: 10, restSeconds: 90, instructions: ['For shoulder focus'] },
            { name: 'Diamond Push-ups', sets: 3, reps: 10, restSeconds: 60, instructions: ['Triceps focus'] },
            { name: 'Dips', sets: 3, reps: 12, restSeconds: 90, instructions: ['Use chair or bench'] },
          ],
          duration: 45,
        },
        {
          name: 'Lower Body',
          focusArea: 'Quads, glutes, hamstrings',
          exercises: [
            { name: 'Squats', sets: 4, reps: 15, restSeconds: 90, instructions: ['Go below parallel'] },
            { name: 'Lunges', sets: 3, reps: 12, restSeconds: 90, instructions: ['Each leg'] },
            { name: 'Glute Bridges', sets: 4, reps: 15, restSeconds: 60, instructions: ['Squeeze at top'] },
            { name: 'Calf Raises', sets: 3, reps: 20, restSeconds: 45, instructions: ['Full stretch'] },
          ],
          duration: 45,
        },
        {
          name: 'Upper Body Pull',
          focusArea: 'Back, biceps',
          exercises: [
            { name: 'Inverted Rows', sets: 4, reps: 10, restSeconds: 90, instructions: ['Use table or bar'] },
            { name: 'Superman Pulls', sets: 3, reps: 15, restSeconds: 60, instructions: ['Squeeze back'] },
            { name: 'Bicep Curls', sets: 3, reps: 12, restSeconds: 60, instructions: ['Use resistance band or weights'] },
            { name: 'Face Pulls', sets: 3, reps: 15, restSeconds: 45, instructions: ['Rear delts'] },
          ],
          duration: 40,
        },
        {
          name: 'Full Body Strength',
          focusArea: 'Compound movements',
          exercises: [
            { name: 'Burpees', sets: 3, reps: 10, restSeconds: 90, instructions: ['Full extension'] },
            { name: 'Mountain Climbers', sets: 3, reps: 20, restSeconds: 60, instructions: ['Fast pace'] },
            { name: 'Plank', sets: 3, reps: 60, restSeconds: 45, instructions: ['60 seconds hold'] },
            { name: 'Jumping Squats', sets: 3, reps: 12, restSeconds: 90, instructions: ['Explosive'] },
          ],
          duration: 35,
        },
      ],
      weight_loss: [
        {
          name: 'HIIT Circuit A',
          focusArea: 'Fat burning cardio',
          exercises: [
            { name: 'Jumping Jacks', sets: 4, reps: 30, restSeconds: 30, instructions: ['High intensity'] },
            { name: 'Burpees', sets: 4, reps: 10, restSeconds: 45, instructions: ['Full movement'] },
            { name: 'Mountain Climbers', sets: 4, reps: 20, restSeconds: 30, instructions: ['Fast pace'] },
            { name: 'High Knees', sets: 4, reps: 30, restSeconds: 30, instructions: ['Get knees up'] },
          ],
          duration: 30,
        },
        {
          name: 'Strength Circuit',
          focusArea: 'Build muscle, burn fat',
          exercises: [
            { name: 'Squats', sets: 3, reps: 20, restSeconds: 45, instructions: ['No rest at top'] },
            { name: 'Push-ups', sets: 3, reps: 15, restSeconds: 45, instructions: ['Chest to ground'] },
            { name: 'Lunges', sets: 3, reps: 16, restSeconds: 45, instructions: ['8 each leg'] },
            { name: 'Plank', sets: 3, reps: 45, restSeconds: 30, instructions: ['45 seconds'] },
          ],
          duration: 35,
        },
        {
          name: 'HIIT Circuit B',
          focusArea: 'Metabolic conditioning',
          exercises: [
            { name: 'Squat Jumps', sets: 4, reps: 12, restSeconds: 30, instructions: ['Explosive'] },
            { name: 'Push-up to Shoulder Tap', sets: 4, reps: 12, restSeconds: 30, instructions: ['Alternate taps'] },
            { name: 'Speed Skaters', sets: 4, reps: 20, restSeconds: 30, instructions: ['Side to side'] },
            { name: 'Bicycle Crunches', sets: 4, reps: 20, restSeconds: 30, instructions: ['Controlled'] },
          ],
          duration: 30,
        },
        {
          name: 'Active Recovery',
          focusArea: 'Light movement',
          exercises: [
            { name: 'Walking Lunges', sets: 3, reps: 20, restSeconds: 45, instructions: ['10 each leg'] },
            { name: 'Yoga Flow', sets: 1, reps: 10, restSeconds: 0, instructions: ['10 minutes flow'] },
            { name: 'Stretching', sets: 1, reps: 15, restSeconds: 0, instructions: ['15 minutes stretch'] },
          ],
          duration: 25,
        },
      ],
    };

    // Default template for other goals
    const defaultTemplate = [
      {
        name: 'Full Body A',
        focusArea: 'Full body strength',
        exercises: [
          { name: 'Squats', sets: 3, reps: 12, restSeconds: 60, instructions: ['Keep core tight'] },
          { name: 'Push-ups', sets: 3, reps: 10, restSeconds: 60, instructions: ['Full range of motion'] },
          { name: 'Plank', sets: 3, reps: 30, restSeconds: 45, instructions: ['Hold for 30 seconds'] },
        ],
        duration: 30,
      },
      {
        name: 'Cardio & Core',
        focusArea: 'Cardiovascular fitness',
        exercises: [
          { name: 'Jumping Jacks', sets: 3, reps: 20, restSeconds: 30, instructions: ['Moderate pace'] },
          { name: 'Mountain Climbers', sets: 3, reps: 15, restSeconds: 30, instructions: ['Each leg'] },
          { name: 'Bicycle Crunches', sets: 3, reps: 15, restSeconds: 45, instructions: ['Control movement'] },
        ],
        duration: 25,
      },
      {
        name: 'Full Body B',
        focusArea: 'Lower body focus',
        exercises: [
          { name: 'Lunges', sets: 3, reps: 10, restSeconds: 60, instructions: ['Alternate legs'] },
          { name: 'Glute Bridges', sets: 3, reps: 15, restSeconds: 45, instructions: ['Squeeze at top'] },
          { name: 'Superman Hold', sets: 3, reps: 10, restSeconds: 45, instructions: ['Hold 3 seconds'] },
        ],
        duration: 30,
      },
      {
        name: 'Active Recovery',
        focusArea: 'Flexibility and mobility',
        exercises: [
          { name: 'Light Stretching', sets: 1, reps: 15, restSeconds: 0, instructions: ['15 min total'] },
          { name: 'Walking', sets: 1, reps: 20, restSeconds: 0, instructions: ['20 min walk'] },
        ],
        duration: 35,
      },
    ];

    const templates = workoutTemplates[goalCategory] || defaultTemplate;
    const schedule: Record<string, GeneratedDayWorkout> = {};

    selectedDays.forEach((day, index) => {
      const template = templates[index % templates.length];
      schedule[day] = {
        dayOfWeek: day,
        workoutName: template.name,
        focusArea: template.focusArea,
        exercises: template.exercises,
        estimatedDuration: template.duration,
        estimatedCalories: Math.round(template.duration * 7), // ~7 cal/min estimate
      };
    });

    return schedule;
  }

  private getDefaultPlans(goalCategory: string = 'overall_optimization', planDuration: number = 4): OnboardingAnalysisResult {
    const defaults = this.getGoalBasedDefaults(goalCategory);

    // Generate goal-specific weekly schedule
    const weeklySchedule = this.generateDefaultWeeklySchedule(goalCategory, defaults.workoutsPerWeek);

    // Goal-specific tips
    const goalTips: Record<string, string[]> = {
      muscle_building: [
        'Eat in a caloric surplus (300-500 extra calories)',
        'Consume 1.6-2.2g protein per kg bodyweight',
        'Prioritize compound movements for strength',
        'Get 7-9 hours of sleep for recovery',
      ],
      weight_loss: [
        'Maintain a moderate caloric deficit (300-500 calories)',
        'Keep protein high to preserve muscle mass',
        'Stay active throughout the day',
        'Focus on whole, unprocessed foods',
      ],
      overall_optimization: [
        'Stay hydrated throughout the day',
        'Eat slowly and mindfully',
        'Include protein in every meal',
        'Get regular exercise and adequate sleep',
      ],
    };

    const tips = goalTips[goalCategory] || goalTips.overall_optimization;

    return {
      dietPlan: {
        name: defaults.dietPlanName,
        description: `A ${goalCategory.replace(/_/g, ' ')} focused nutrition plan designed to support your fitness goals`,
        goalCategory: goalCategory,
        dailyCalories: defaults.dailyCalories,
        proteinGrams: defaults.proteinGrams,
        carbsGrams: defaults.carbsGrams,
        fatGrams: defaults.fatGrams,
        fiberGrams: 25,
        mealsPerDay: defaults.mealsPerDay,
        snacksPerDay: 2,
        mealTimes: { breakfast: '08:00', lunch: '12:30', dinner: '19:00' },
        weeklyMeals: {
          monday: { breakfast: 'Protein oatmeal with berries', lunch: 'Grilled chicken salad', dinner: 'Salmon with vegetables and rice' },
          tuesday: { breakfast: 'Greek yogurt parfait', lunch: 'Turkey wrap with avocado', dinner: 'Stir-fry with tofu and vegetables' },
          wednesday: { breakfast: 'Eggs with whole grain toast', lunch: 'Quinoa bowl with chickpeas', dinner: 'Lean beef with sweet potato' },
          thursday: { breakfast: 'Protein smoothie bowl', lunch: 'Chicken salad sandwich', dinner: 'Pasta with lean meat sauce' },
          friday: { breakfast: 'Whole grain pancakes with protein', lunch: 'Fish tacos with cabbage slaw', dinner: 'Grilled chicken with brown rice' },
          saturday: { breakfast: 'Avocado toast with eggs', lunch: 'Mediterranean mezze plate', dinner: 'Homemade pizza with vegetables' },
          sunday: { breakfast: 'Protein French toast', lunch: 'Soup and whole grain bread', dinner: 'Roast chicken with vegetables' },
        },
        dietaryPreferences: [],
        allergies: [],
        excludedFoods: [],
        tips: tips,
        aiRationale: `This ${goalCategory.replace(/_/g, ' ')} nutrition plan is designed to provide ${defaults.dailyCalories} calories daily with ${defaults.proteinGrams}g of protein to support your goals.`,
      },
      workoutPlan: {
        name: defaults.workoutPlanName,
        description: `A ${defaults.workoutsPerWeek}-day per week program focused on ${defaults.workoutFocus}`,
        goalCategory: goalCategory,
        durationWeeks: planDuration,
        workoutsPerWeek: defaults.workoutsPerWeek,
        workoutLocation: 'home',
        fitnessLevel: 'beginner',
        weeklySchedule: weeklySchedule,
        availableEquipment: ['bodyweight'],
        tips: ['Warm up before each workout', 'Focus on form over speed', 'Rest adequately between sessions', 'Stay hydrated'],
        aiRationale: `This ${planDuration}-week program is designed for ${goalCategory.replace(/_/g, ' ')} with ${defaults.workoutsPerWeek} workouts per week.`,
      },
      overallAnalysis: {
        healthScore: 75,
        riskFactors: [],
        recommendations: [
          'Follow the plan consistently for best results',
          'Track your progress weekly',
          'Adjust intensity as you get stronger',
          'Listen to your body and rest when needed',
        ],
        motivationalMessage: `Your ${goalCategory.replace(/_/g, ' ')} journey starts now! Stay consistent and you will see results!`,
      },
      provider: 'default',
    };
  }
}

export const onboardingAIService = new OnboardingAIService();
