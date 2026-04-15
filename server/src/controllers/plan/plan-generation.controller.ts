/**
 * @file Plan Generation Controller
 * @description Handles plan generation, safety validation, and onboarding
 */

import type { Response } from 'express';
import { query } from '../../database/pg.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { logger } from '../../services/logger.service.js';
import {
  nutritionService,
  safetyService,
  type NutritionPlan,
  type UserMetrics,
  type GoalParameters,
  type SafetyValidationResult,
  type UserHealthData,
} from '../../services/index.js';
import { notificationService } from '../../services/notification.service.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import type { GeneratePlanInput } from '../../validators/plan.validator.js';
import { modelFactory } from '../../services/model-factory.service.js';
import { embeddingQueueService } from '../../services/embedding-queue.service.js';
import { JobPriorities } from '../../config/queue.config.js';
import {
  type UserGoalRow,
  type UserPlanRow,
  type UserPreferencesRow,
  type AssessmentResponseRow,
  type UserRow,
  type IActivity,
  type IWeeklyFocus,
  mapPlanRow,
} from './plan.types.js';

/**
 * Generate AI Plan (internal helper)
 */
async function generateAIPlan(
  goal: UserGoalRow,
  preferences: UserPreferencesRow | undefined,
  _options: GeneratePlanInput,
  nutritionPlan: NutritionPlan | null = null
): Promise<{
  name: string;
  description: string;
  activities: IActivity[];
  weeklyFocuses: IWeeklyFocus[];
  coachMessage: string;
  nutritionPlan: NutritionPlan | null;
}> {
  const planName = `${goal.title} Plan`;
  const planDescription = `A ${goal.duration_weeks}-week plan to achieve ${goal.description.toLowerCase()}`;

  // Generate activities based on goal
  const activities: IActivity[] = [];
  let activityIndex = 0;

  // Workout activities for fitness goals
  if (goal.pillar === 'fitness') {
    activities.push({
      id: `act_${++activityIndex}`,
      type: 'workout',
      title: 'Strength Training',
      description: 'Full body workout focusing on compound movements',
      targetValue: 45,
      targetUnit: 'minutes',
      daysOfWeek: ['monday', 'wednesday', 'friday'],
      preferredTime: '07:00',
      duration: 45,
      instructions: ['Warm up for 5 minutes', 'Follow the exercise routine', 'Cool down and stretch'],
    });
  }

  // Nutrition tracking for all plans
  activities.push({
    id: `act_${++activityIndex}`,
    type: 'meal',
    title: 'Log Meals',
    description: 'Track your daily food intake',
    daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    preferredTime: '20:00',
    instructions: ['Log breakfast, lunch, and dinner', 'Include snacks and beverages'],
  });

  // Sleep routine
  if (goal.category === 'sleep_improvement' || goal.pillar === 'wellbeing') {
    activities.push({
      id: `act_${++activityIndex}`,
      type: 'sleep_routine',
      title: 'Evening Wind-Down',
      description: 'Prepare for quality sleep',
      targetValue: 30,
      targetUnit: 'minutes',
      daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
      preferredTime: '21:30',
      instructions: ['Dim lights', 'No screens 30 min before bed', 'Light stretching or reading'],
    });
  }

  // Daily check-in
  activities.push({
    id: `act_${++activityIndex}`,
    type: 'check_in',
    title: 'Daily Check-in',
    description: 'Rate your energy and mood',
    daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    preferredTime: preferences?.preferred_check_in_time || '09:00',
  });

  // Weekly reflection
  activities.push({
    id: `act_${++activityIndex}`,
    type: 'reflection',
    title: 'Weekly Reflection',
    description: 'Review your progress and set intentions',
    daysOfWeek: ['sunday'],
    preferredTime: '18:00',
    isOptional: true,
  });

  // Generate weekly focuses
  const weeklyFocuses: IWeeklyFocus[] = [];
  for (let week = 1; week <= Math.min(goal.duration_weeks, 12); week++) {
    let theme: string;
    let focus: string;
    let expectedOutcome: string;

    if (week === 1) {
      theme = 'Foundation';
      focus = 'Building habits and establishing baseline routines';
      expectedOutcome = 'Consistent daily tracking and initial momentum';
    } else if (week <= 4) {
      theme = 'Acceleration';
      focus = 'Increasing intensity and building consistency';
      expectedOutcome = 'Noticeable improvements in energy and adherence';
    } else if (week <= 8) {
      theme = 'Optimization';
      focus = 'Fine-tuning based on progress and feedback';
      expectedOutcome = 'Measurable progress toward goals';
    } else {
      theme = 'Mastery';
      focus = 'Solidifying habits for long-term success';
      expectedOutcome = 'Sustainable lifestyle changes';
    }

    weeklyFocuses.push({
      week,
      theme,
      focus,
      expectedOutcome,
      activities: activities.slice(0, 3).map(a => a.id),
    });
  }

  // Generate coach message
  const coachMessages: Record<string, string> = {
    supportive: "I'm so excited to be on this journey with you! This plan is designed just for you, and I'll be here every step of the way.",
    direct: "Your plan is ready. Follow it consistently and you'll see results. Let's get to work.",
    analytical: "I've analyzed your goals and data to create this optimized plan. The activities are sequenced for maximum effectiveness.",
    motivational: "This is YOUR time! I've created an amazing plan that's going to transform your life. Let's crush these goals together!",
  };

  const style = preferences?.coaching_style || 'supportive';
  const coachMessage = coachMessages[style] || coachMessages['supportive'];

  // Add nutrition-specific message if nutrition plan exists
  let nutritionMessage = '';
  if (nutritionPlan) {
    nutritionMessage = `\n\nBased on your profile, I've calculated your daily nutrition targets: ${nutritionPlan.macros.calories} calories with ${nutritionPlan.macros.protein.grams}g protein, ${nutritionPlan.macros.carbohydrates.grams}g carbs, and ${nutritionPlan.macros.fat.grams}g fat.`;
    if (nutritionPlan.safetyWarnings.length > 0) {
      nutritionMessage += ' Note: Please review the safety considerations in your plan.';
    }
  }

  return {
    name: planName,
    description: planDescription,
    activities,
    weeklyFocuses,
    coachMessage: coachMessage + nutritionMessage,
    nutritionPlan,
  };
}

/**
 * S01.6.1: Generate Initial Plan
 * POST /api/plans/generate
 */
export const generatePlan = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const data = req.body as GeneratePlanInput;

  // Check if user has a goal
  const goalsResult = await query<UserGoalRow>(
    `SELECT * FROM user_goals WHERE user_id = $1 AND status = 'active' ORDER BY is_primary DESC`,
    [userId]
  );

  if (goalsResult.rows.length === 0) {
    throw ApiError.badRequest('Please set a goal first');
  }

  const goal = data.goalId
    ? goalsResult.rows.find(g => g.id === data.goalId) || goalsResult.rows[0]
    : goalsResult.rows[0];

  if (!goal) throw ApiError.notFound('Goal not found');

  // Get user preferences
  const prefsResult = await query<UserPreferencesRow>(
    'SELECT * FROM user_preferences WHERE user_id = $1',
    [userId]
  );
  const preferences = prefsResult.rows[0];

  // Get user data for age and gender
  const userResult = await query<UserRow>(
    'SELECT id, gender, date_of_birth FROM users WHERE id = $1',
    [userId]
  );
  const userData = userResult.rows[0];

  // Get assessment body stats
  const assessmentResult = await query<AssessmentResponseRow>(
    `SELECT body_stats, baseline_data FROM assessment_responses
     WHERE user_id = $1 AND is_complete = true
     ORDER BY completed_at DESC LIMIT 1`,
    [userId]
  );
  const bodyStats = assessmentResult.rows[0]?.body_stats;
  const baselineData = assessmentResult.rows[0]?.baseline_data;

  // Check for existing active plan (for this goal OR any recent active plan)
  const existingPlanResult = await query<UserPlanRow>(
    `SELECT * FROM user_plans WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC`,
    [userId]
  );

  // If there's already an active plan for this specific goal, return it instead of creating duplicate
  const existingPlanForGoal = existingPlanResult.rows.find(p => p.goal_id === goal.id);
  if (existingPlanForGoal && !data.regenerate) {
    // Return existing plan instead of creating duplicate
    logger.info('Returning existing active plan', { userId, planId: existingPlanForGoal.id });
    ApiResponse.success(res, {
      plan: mapPlanRow(existingPlanForGoal),
      message: 'Your plan is ready!',
      isExisting: true,
    }, 'Existing plan returned');
    return;
  }

  // Calculate nutrition plan and perform safety validation if we have body stats
  let nutritionPlan: NutritionPlan | null = null;
  let safetyValidation: SafetyValidationResult | null = null;

  if (bodyStats && userData?.date_of_birth && userData?.gender) {
    const ageYears = Math.floor(
      (Date.now() - new Date(userData.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    );

    // Build health data for safety validation
    const healthData: UserHealthData = {
      age: ageYears,
      gender: userData.gender,
      weightKg: bodyStats.weightKg,
      heightCm: bodyStats.heightCm,
      bodyFatPercentage: bodyStats.bodyFatPercentage,
    };

    // Perform safety validation before generating plan
    safetyValidation = safetyService.validateForPlanGeneration(healthData, {
      goalType: goal.category,
      targetWeightKg: bodyStats.targetWeightKg,
      weeklyWeightChangeKg: data.weeklyWeightChangeKg,
      activityLevel: nutritionService.activityDaysToLevel(baselineData?.activityDaysPerWeek ?? 3),
    });

    // Log safety validation results
    logger.info('Safety validation completed', {
      userId,
      riskLevel: safetyValidation.riskLevel,
      requiresDoctorConsult: safetyValidation.requiresDoctorConsult,
      warningsCount: safetyValidation.warnings.length,
    });

    // Block plan generation for critical risk without acknowledgment
    if (safetyValidation.riskLevel === 'critical' && !data.acknowledgedWarnings) {
      const error = new ApiError(400,
        'Your health profile requires medical consultation before proceeding. ' +
        'Please review the safety warnings and acknowledge them, or consult a healthcare provider.',
        {
          code: 'SAFETY_VALIDATION_REQUIRED',
          details: [
            { code: 'SAFETY_DATA', message: JSON.stringify(safetyValidation), field: 'safetyValidation' },
            { code: 'ACKNOWLEDGMENT_REQUIRED', message: 'true', field: 'requiresAcknowledgment' },
          ],
        }
      );
      throw error;
    }

    // Calculate nutrition plan
    const metrics: UserMetrics = {
      weightKg: bodyStats.weightKg,
      heightCm: bodyStats.heightCm,
      ageYears,
      gender: userData.gender,
      activityLevel: nutritionService.activityDaysToLevel(baselineData?.activityDaysPerWeek ?? 3),
      bodyFatPercentage: bodyStats.bodyFatPercentage,
    };

    const goalParams: GoalParameters = {
      goalType: nutritionService.goalCategoryToType(goal.category),
      targetWeightKg: bodyStats.targetWeightKg,
    };

    nutritionPlan = nutritionService.generateNutritionPlan(metrics, goalParams);

    // Validate nutrition plan safety
    const nutritionSafetyCheck = nutritionService.validatePlanSafety(nutritionPlan, metrics);
    if (!nutritionSafetyCheck.isSafe) {
      logger.warn('Nutrition plan has safety warnings', {
        userId,
        issues: nutritionSafetyCheck.issues,
      });
      // Add nutrition issues to safety warnings
      safetyValidation.warnings.push(...nutritionSafetyCheck.issues.map((issue) => ({
        code: 'NUTRITION_SAFETY',
        severity: 'moderate' as const,
        message: issue,
        recommendation: 'Consider adjusting your nutrition targets.',
        requiresConsent: false,
      })));
    }
  }

  // Generate the plan
  const generatedPlan = await generateAIPlan(goal, preferences, data, nutritionPlan);

  // Archive ALL existing active plans (to ensure only one active plan at a time)
  if (existingPlanResult.rows.length > 0) {
    const planIds = existingPlanResult.rows.map(p => p.id);
    await query(
      `UPDATE user_plans SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ANY($1)`,
      [planIds]
    );
    logger.info('Archived existing active plans', { userId, archivedPlanIds: planIds });
  }

  // Create the plan
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + goal.duration_weeks * 7 * 24 * 60 * 60 * 1000);

  // Prepare generation params with nutrition data
  const generationParams = {
    ...data,
    nutritionPlan: generatedPlan.nutritionPlan,
    safetyWarnings: generatedPlan.nutritionPlan?.safetyWarnings || [],
    recommendations: generatedPlan.nutritionPlan?.recommendations || [],
  };

  const planResult = await query<UserPlanRow>(
    `INSERT INTO user_plans (
      user_id, goal_id, name, description, pillar, goal_category,
      start_date, end_date, duration_weeks, current_week,
      status, activities, weekly_focuses,
      ai_generated, ai_model, generation_params, user_adjustments,
      overall_progress, weekly_completion_rates
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    RETURNING *`,
    [
      userId,
      goal.id,
      generatedPlan.name,
      generatedPlan.description,
      goal.pillar,
      goal.category,
      startDate,
      endDate,
      goal.duration_weeks,
      1,
      'active',
      JSON.stringify(generatedPlan.activities),
      JSON.stringify(generatedPlan.weeklyFocuses),
      true,
      'gpt-4',
      JSON.stringify(generationParams),
      '[]',
      0,
      '[]',
    ]
  );

  const plan = planResult.rows[0];

  // Update user onboarding status
  await query(
    `UPDATE users SET
      onboarding_status = 'completed',
      onboarding_completed_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND onboarding_status = 'plan_pending'`,
    [userId]
  );

  logger.info('Plan generated', {
    userId,
    goalId: goal.id,
    planId: plan.id,
    activities: generatedPlan.activities.length,
    hasNutritionPlan: !!generatedPlan.nutritionPlan,
  });

  // Enqueue embedding for user plan (async, non-blocking)
  await embeddingQueueService.enqueueEmbedding({
    userId,
    sourceType: 'user_plan',
    sourceId: plan.id,
    operation: 'create',
    priority: JobPriorities.CRITICAL,
  });

  ApiResponse.created(res, {
    plan: mapPlanRow(plan),
    message: generatedPlan.coachMessage,
    nutritionPlan: generatedPlan.nutritionPlan,
    safetyValidation: safetyValidation ? {
      riskLevel: safetyValidation.riskLevel,
      requiresDoctorConsult: safetyValidation.requiresDoctorConsult,
      warnings: safetyValidation.warnings,
      restrictions: safetyValidation.restrictions,
      recommendations: safetyValidation.recommendations,
      disclaimers: safetyValidation.disclaimers,
    } : null,
  }, 'Plan generated successfully');
});

/**
 * Complete Onboarding
 * POST /api/plans/complete-onboarding
 */
export const completeOnboarding = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  // Check if user has an active plan
  const planResult = await query<UserPlanRow>(
    `SELECT * FROM user_plans WHERE user_id = $1 AND status = 'active' LIMIT 1`,
    [userId]
  );

  if (planResult.rows.length === 0) {
    // Check if user has goals - if yes, try to generate plans automatically
    const goalsResult = await query<{ id: string }>(
      `SELECT id FROM user_goals WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [userId]
    );

    if (goalsResult.rows.length > 0) {
      logger.info('[CompleteOnboarding] No plan found, attempting to generate from existing data', { userId });
      
      // Try to generate plans from existing onboarding data
      const { onboardingAIService } = await import('../../services/onboarding-ai.service.js');
      const onboardingData = await onboardingAIService.getOnboardingData(userId);
      
      if (onboardingData) {
        try {
          const result = await onboardingAIService.analyzeAndGeneratePlans(onboardingData);
          const planDurationWeeks = Math.max(onboardingData.planDurationWeeks || 4, 2);
          
          await onboardingAIService.savePlans(
            userId,
            result.dietPlan,
            result.workoutPlan,
            undefined,
            planDurationWeeks
          );
          
          logger.info('[CompleteOnboarding] Plans generated automatically', { userId });
        } catch (error) {
          logger.error('[CompleteOnboarding] Failed to auto-generate plans', {
            userId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          throw ApiError.badRequest('Please generate a plan first. Auto-generation failed.');
        }
      } else {
        throw ApiError.badRequest('Please generate a plan first');
      }
    } else {
      throw ApiError.badRequest('Please generate a plan first');
    }
  }

  // Re-fetch plan to ensure we have the latest
  const finalPlanResult = await query<UserPlanRow>(
    `SELECT * FROM user_plans WHERE user_id = $1 AND status = 'active' LIMIT 1`,
    [userId]
  );

  if (finalPlanResult.rows.length === 0) {
    throw ApiError.badRequest('Plan generation failed. Please try again.');
  }

  await query(
    `UPDATE users SET
      onboarding_status = 'completed',
      onboarding_completed_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1`,
    [userId]
  );

  logger.info('Onboarding completed', { userId, planId: finalPlanResult.rows[0].id });

  ApiResponse.success(res, {
    message: "You're all set! Your personalized plan is ready.",
    planId: finalPlanResult.rows[0].id,
  }, 'Onboarding complete');
});

/**
 * Safety Preview
 * POST /api/plans/safety-preview
 * Preview safety validation without generating a plan
 */
export const getSafetyPreview = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  // Get user data
  const userResult = await query<UserRow>(
    'SELECT id, gender, date_of_birth FROM users WHERE id = $1',
    [userId]
  );
  const userData = userResult.rows[0];

  // Get assessment body stats
  const assessmentResult = await query<AssessmentResponseRow>(
    `SELECT body_stats, baseline_data FROM assessment_responses
     WHERE user_id = $1 AND is_complete = true
     ORDER BY completed_at DESC LIMIT 1`,
    [userId]
  );
  const bodyStats = assessmentResult.rows[0]?.body_stats;
  const baselineData = assessmentResult.rows[0]?.baseline_data;

  if (!bodyStats || !userData?.date_of_birth || !userData?.gender) {
    throw ApiError.badRequest('Complete assessment required for safety preview');
  }

  const ageYears = Math.floor(
    (Date.now() - new Date(userData.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
  );

  // Build health data for safety validation
  const healthData: UserHealthData = {
    age: ageYears,
    gender: userData.gender,
    weightKg: bodyStats.weightKg,
    heightCm: bodyStats.heightCm,
    bodyFatPercentage: bodyStats.bodyFatPercentage,
  };

  // Get goal category from request or use default
  const { goalCategory, targetWeightKg, weeklyWeightChangeKg } = req.body;

  // Perform safety validation
  const safetyValidation = safetyService.validateForPlanGeneration(healthData, {
    goalType: goalCategory || 'maintenance',
    targetWeightKg: targetWeightKg || bodyStats.targetWeightKg,
    weeklyWeightChangeKg,
    activityLevel: nutritionService.activityDaysToLevel(baselineData?.activityDaysPerWeek ?? 3),
  });

  // Calculate BMI for display
  const bmi = safetyService.calculateBMI(bodyStats.weightKg, bodyStats.heightCm);

  ApiResponse.success(res, {
    healthProfile: {
      age: ageYears,
      gender: userData.gender,
      weightKg: bodyStats.weightKg,
      heightCm: bodyStats.heightCm,
      bmi,
      bmiCategory: safetyService.getBMICategory(bmi),
    },
    safetyValidation: {
      isApproved: safetyValidation.isApproved,
      riskLevel: safetyValidation.riskLevel,
      requiresDoctorConsult: safetyValidation.requiresDoctorConsult,
      warnings: safetyValidation.warnings,
      restrictions: safetyValidation.restrictions,
      recommendations: safetyValidation.recommendations,
      disclaimers: safetyValidation.disclaimers,
    },
    requiredConsents: safetyService.getRequiredConsents(safetyValidation.warnings),
  }, 'Safety preview generated');
});

/**
 * Create Manual Plan
 * POST /api/plans/create-manual
 * Create a custom plan with user-defined tasks
 */
export const createManualPlan = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { name, description, pillar, goalCategory, durationWeeks, activities } = req.body;

  if (!name || !pillar || !activities || activities.length === 0) {
    throw ApiError.badRequest('Name, pillar, and at least one activity are required');
  }

  // Validate activities
  const validatedActivities: IActivity[] = activities.map((a: Partial<IActivity>, index: number) => ({
    id: a.id || `act_${Date.now()}_${index}`,
    type: a.type || 'habit',
    title: a.title || `Task ${index + 1}`,
    description: a.description || '',
    targetValue: a.targetValue,
    targetUnit: a.targetUnit,
    daysOfWeek: a.daysOfWeek || ['monday', 'wednesday', 'friday'],
    preferredTime: a.preferredTime || '09:00',
    duration: a.duration,
    isOptional: a.isOptional || false,
    instructions: a.instructions,
  }));

  // Create the plan
  const startDate = new Date();
  const weeks = durationWeeks || 4;
  const endDate = new Date(startDate.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
  const category = goalCategory || 'custom';

  // First create a goal for this manual plan (required by database schema)
  const goalResult = await query<UserGoalRow>(
    `INSERT INTO user_goals (
      user_id, category, pillar, title, description,
      target_value, target_unit, current_value, start_value,
      start_date, target_date, duration_weeks,
      motivation, confidence_level, status, progress,
      is_safety_checked, ai_suggested
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    RETURNING *`,
    [
      userId,
      category,
      pillar,
      name,
      description || `Custom ${pillar} plan`,
      100,
      'percent',
      0, // current_value
      0, // start_value
      startDate,
      endDate,
      weeks,
      'Build better habits', // motivation
      7, // confidence_level (1-10)
      'active',
      0, // progress
      true, // is_safety_checked (manual plans bypass safety)
      false, // ai_suggested
    ]
  );

  const goalId = goalResult.rows[0]?.id;
  if (!goalId) {
    throw ApiError.internal('Failed to create goal for plan');
  }

  // Generate weekly focuses with progressive themes and task-specific content
  const weeklyFocuses: IWeeklyFocus[] = [];
  const taskTitles = validatedActivities.map(a => a.title).join(', ');

  const weeklyThemes = [
    { theme: 'Getting Started', focus: 'Establish your routine', outcome: 'Build initial momentum' },
    { theme: 'Building Foundation', focus: 'Strengthen daily habits', outcome: 'Develop consistency' },
    { theme: 'Gaining Momentum', focus: 'Increase engagement', outcome: 'See early progress' },
    { theme: 'Deepening Practice', focus: 'Refine your approach', outcome: 'Build confidence' },
    { theme: 'Mid-Point Check', focus: 'Assess and adjust', outcome: 'Optimize your routine' },
    { theme: 'Pushing Forward', focus: 'Challenge yourself', outcome: 'Break through plateaus' },
    { theme: 'Building Resilience', focus: 'Stay committed', outcome: 'Strengthen discipline' },
    { theme: 'Mastering Habits', focus: 'Perfect your routine', outcome: 'Achieve mastery' },
    { theme: 'Sustaining Progress', focus: 'Maintain momentum', outcome: 'Lock in gains' },
    { theme: 'Preparing to Finish', focus: 'Final push', outcome: 'Reach your goals' },
    { theme: 'Completion Phase', focus: 'Celebrate progress', outcome: 'Solidify achievements' },
    { theme: 'Beyond the Plan', focus: 'Plan for continuation', outcome: 'Lasting transformation' },
  ];

  for (let week = 1; week <= Math.min(weeks, 12); week++) {
    const themeData = weeklyThemes[week - 1] || weeklyThemes[weeklyThemes.length - 1];
    weeklyFocuses.push({
      week,
      theme: `Week ${week}: ${themeData.theme}`,
      focus: `${themeData.focus} with: ${taskTitles}`,
      expectedOutcome: themeData.outcome,
      activities: validatedActivities.map(a => a.id),
    });
  }

  const planResult = await query<UserPlanRow>(
    `INSERT INTO user_plans (
      user_id, goal_id, name, description, pillar, goal_category,
      start_date, end_date, duration_weeks, current_week,
      status, activities, weekly_focuses,
      ai_generated, user_adjustments,
      overall_progress, weekly_completion_rates
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    RETURNING *`,
    [
      userId,
      goalId,
      name,
      description || '',
      pillar,
      category,
      startDate,
      endDate,
      weeks,
      1,
      'active',
      JSON.stringify(validatedActivities),
      JSON.stringify(weeklyFocuses),
      false,
      '[]',
      0,
      '[]',
    ]
  );

  const plan = planResult.rows[0];

  // Send notification
  await notificationService.planUpdated(userId, plan.id, name, true);

  logger.info('Manual plan created', {
    userId,
    planId: plan.id,
    activities: validatedActivities.length,
  });

  // Enqueue embedding for user plan (async, non-blocking)
  await embeddingQueueService.enqueueEmbedding({
    userId,
    sourceType: 'user_plan',
    sourceId: plan.id,
    operation: 'create',
    priority: JobPriorities.CRITICAL,
  });

  // Also enqueue embedding for the associated goal
  await embeddingQueueService.enqueueEmbedding({
    userId,
    sourceType: 'user_goal',
    sourceId: goalId,
    operation: 'create',
    priority: JobPriorities.CRITICAL,
  });

  ApiResponse.created(res, {
    plan: mapPlanRow(plan),
    message: 'Your custom plan is ready! Start completing your tasks.',
  }, 'Plan created successfully');
});

/**
 * Generate AI Tasks
 * POST /api/plans/generate-tasks
 * Use AI to generate relevant tasks based on user goals
 */
export const generateAITasks = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { goalDescription, pillar, goalCategory, durationWeeks } = req.body;

  if (!goalDescription) {
    throw ApiError.badRequest('Goal description is required');
  }

  // Use AI to generate tasks
  const llm = modelFactory.getModel({
    tier: 'reasoning',
    temperature: 0.7,
  });

  const prompt = `You are an expert health and fitness coach. Based on the user's goal, generate a structured plan with specific, actionable tasks.

User Goal: ${goalDescription}
Health Pillar: ${pillar || 'fitness'}
Goal Category: ${goalCategory || 'habit_building'}
Duration: ${durationWeeks || 4} weeks

Generate a JSON response with the following structure:
{
  "planName": "Short descriptive name for the plan",
  "planDescription": "Brief description of what the plan will help achieve",
  "tasks": [
    {
      "id": "task_1",
      "title": "Task title",
      "description": "Brief description",
      "type": "workout|meal|sleep_routine|mindfulness|habit|check_in|reflection|learning",
      "daysOfWeek": ["monday", "wednesday", "friday"],
      "preferredTime": "09:00",
      "duration": 30
    }
  ]
}

Generate 4-7 tasks that are:
1. Specific and actionable
2. Realistic and achievable
3. Aligned with the user's goal
4. Properly scheduled throughout the week

Respond ONLY with valid JSON, no additional text.`;

  try {
    const response = await llm.invoke(prompt);
    const content = typeof response.content === 'string' ? response.content : '';

    // Parse the JSON response
    const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleanedContent);

    // Validate and format tasks
    const tasks = (parsed.tasks || []).map((t: Record<string, unknown>, index: number) => ({
      id: `task_${Date.now()}_${index}`,
      title: t.title || `Task ${index + 1}`,
      description: t.description || '',
      type: t.type || 'habit',
      daysOfWeek: t.daysOfWeek || ['monday', 'wednesday', 'friday'],
      preferredTime: t.preferredTime || '09:00',
      duration: t.duration || 30,
    }));

    logger.info('AI tasks generated', { userId, tasksCount: tasks.length });

    ApiResponse.success(res, {
      planName: parsed.planName || 'Your Custom Plan',
      planDescription: parsed.planDescription || goalDescription,
      tasks,
    }, 'Tasks generated successfully');
  } catch (error) {
    logger.error('Failed to generate AI tasks', { userId, error });

    // Return default tasks as fallback
    const defaultTasks = [
      {
        id: `task_${Date.now()}_0`,
        title: 'Daily Check-in',
        description: 'Track your progress and mood',
        type: 'check_in',
        daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        preferredTime: '09:00',
        duration: 5,
      },
      {
        id: `task_${Date.now()}_1`,
        title: 'Main Activity',
        description: 'Primary activity toward your goal',
        type: pillar === 'fitness' ? 'workout' : pillar === 'nutrition' ? 'meal' : 'mindfulness',
        daysOfWeek: ['monday', 'wednesday', 'friday'],
        preferredTime: '10:00',
        duration: 30,
      },
      {
        id: `task_${Date.now()}_2`,
        title: 'Weekly Reflection',
        description: 'Review progress and plan ahead',
        type: 'reflection',
        daysOfWeek: ['sunday'],
        preferredTime: '18:00',
        duration: 15,
      },
    ];

    ApiResponse.success(res, {
      planName: 'Your Custom Plan',
      planDescription: goalDescription,
      tasks: defaultTasks,
    }, 'Default tasks generated');
  }
});

/**
 * Generate AI Plans from Onboarding Data
 * POST /api/plans/generate-onboarding-plans
 * Analyzes all onboarding data (goals, MCQs, body stats, images, preferences)
 * and generates personalized diet and workout plans
 */
export const generateOnboardingPlans = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  // Import the onboarding AI service dynamically to avoid circular deps
  const { onboardingAIService } = await import('../../services/onboarding-ai.service.js');

  // Get the onboarding data from request body (passed from frontend)
  // or fetch from database if not provided
  let onboardingData = req.body.onboardingData;

  if (!onboardingData || Object.keys(onboardingData).length === 0) {
    // Fetch from database
    onboardingData = await onboardingAIService.getOnboardingData(userId);
    if (!onboardingData) {
      // Create minimal default data if nothing found
      logger.warn('[PlanGeneration] No onboarding data found, using minimal defaults', { userId });
      onboardingData = {
        userId,
        selectedGoal: 'weight_loss',
        confirmedGoals: [],
        planDurationWeeks: 4,
        bodyStats: {},
        assessmentResponses: [],
      };
    }
  } else {
    // Ensure userId is set correctly
    onboardingData.userId = userId;
  }

  // Get plan duration from onboarding data (minimum 2 weeks enforced)
  const planDurationWeeks = Math.max(onboardingData.planDurationWeeks || 4, 2);

  // Analyze body images if they exist but haven't been analyzed yet (fire and forget)
  // This is done asynchronously so it doesn't block plan generation
  (async () => {
    try {
      const { query } = await import('../../database/pg.js');
      const { r2Service } = await import('../../services/r2.service.js');
      const { aiCoachService } = await import('../../services/ai-coach.service.js');
      
      // Get all pending images
      const imagesResult = await query<{ id: string; image_type: string; image_key: string }>(
        `SELECT id, image_type, image_key
         FROM user_body_images
         WHERE user_id = $1 AND analysis_status IN ('pending', 'failed')
         ORDER BY created_at ASC`,
        [userId]
      );

      if (imagesResult.rows.length > 0) {
        logger.info('[PlanGeneration] Triggering body image analysis', {
          userId,
          pendingImages: imagesResult.rows.length,
        });

        // Analyze each image (non-blocking)
        for (const image of imagesResult.rows) {
          try {
            // Update status to processing
            await query(
              `UPDATE user_body_images SET analysis_status = 'processing', updated_at = CURRENT_TIMESTAMP
               WHERE id = $1`,
              [image.id]
            );

            // Get signed URL
            const imageUrl = await r2Service.getSignedUrl(image.image_key, 3600);

            // Get user's primary goal for context
            const goalResult = await query<{ category: string }>(
              `SELECT category FROM user_goals
               WHERE user_id = $1 AND status = 'active' AND is_primary = true
               ORDER BY created_at DESC LIMIT 1`,
              [userId]
            );

            const goalCategory = goalResult.rows[0]?.category || undefined;

            // Analyze
            // Map database image_type to HealthImageType (all body images are 'body_photo')
            const analysis = await aiCoachService.analyzeHealthImage(
              imageUrl,
              'body_photo',
              { goal: goalCategory as any }
            );

            // Save result
            await query(
              `UPDATE user_body_images
               SET analysis_status = 'completed',
                   analysis_result = $1,
                   analyzed_at = CURRENT_TIMESTAMP,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = $2`,
              [JSON.stringify(analysis), image.id]
            );
          } catch (err) {
            // Update status to failed
            await query(
              `UPDATE user_body_images SET analysis_status = 'failed', updated_at = CURRENT_TIMESTAMP
               WHERE id = $1`,
              [image.id]
            );

            logger.warn('[PlanGeneration] Body image analysis failed', {
              userId,
              imageId: image.id,
              error: err instanceof Error ? err.message : 'Unknown error',
            });
          }
        }
      }
    } catch (err) {
      logger.warn('[PlanGeneration] Could not trigger body image analysis', {
        userId,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  })();

  logger.info('[PlanGeneration] Generating AI plans from onboarding data', {
    userId,
    hasGoals: onboardingData.confirmedGoals?.length > 0,
    hasBodyStats: Object.keys(onboardingData.bodyStats || {}).length > 0,
    hasAssessment: onboardingData.assessmentResponses?.length > 0,
    hasBodyImages: onboardingData.bodyImagesAnalysis?.hasImages || false,
    planDurationWeeks,
  });

  try {
    // Fetch fresh onboarding data to include any newly analyzed body images
    const freshOnboardingData = await onboardingAIService.getOnboardingData(userId) || onboardingData;
    freshOnboardingData.userId = userId;
    
    // Generate plans using AI with fresh data
    const result = await onboardingAIService.analyzeAndGeneratePlans(freshOnboardingData);

    // Save the generated plans to database with proper duration
    const { userPlanId, dietPlanId, workoutPlanId } = await onboardingAIService.savePlans(
      userId,
      result.dietPlan,
      result.workoutPlan,
      undefined, // goalId - let it fetch from DB
      planDurationWeeks // Pass the duration from onboarding
    );

    // Update user onboarding status
    await query(
      `UPDATE users SET
        onboarding_status = 'completed',
        onboarding_completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND onboarding_status != 'completed'`,
      [userId]
    );

    logger.info('[PlanGeneration] AI plans generated successfully', {
      userId,
      userPlanId,
      dietPlanId,
      workoutPlanId,
      provider: result.provider,
      durationWeeks: planDurationWeeks,
    });

    ApiResponse.created(res, {
      userPlanId,
      dietPlan: {
        id: dietPlanId,
        ...result.dietPlan,
      },
      workoutPlan: {
        id: workoutPlanId,
        ...result.workoutPlan,
      },
      overallAnalysis: result.overallAnalysis,
      provider: result.provider,
      planSource: 'ai', // Indicates plan was generated by AI
    }, 'Personalized diet and workout plans generated successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[PlanGeneration] Failed to generate AI plans', { userId, error: errorMessage });

    if (error instanceof ApiError) throw error;
    throw ApiError.internal(`Failed to generate plans: ${errorMessage}`);
  }
});
