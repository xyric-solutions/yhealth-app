import type { Response } from 'express';
import { query, transaction } from '../database/pg.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../services/logger.service.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { notificationService } from '../services/notification.service.js';
import { goalDecompositionService } from '../services/goal-decomposition.service.js';
import { autoProgressService } from '../services/auto-progress.service.js';
import { embeddingQueueService } from '../services/embedding-queue.service.js';
import { JobPriorities } from '../config/queue.config.js';
import type {
  GoalDiscoveryInput,
  AssessmentModeInput,
  SubmitQuickAssessmentInput,
  DeepAssessmentMessageInput,
  GoalSetupInput,
  GoalCommitmentInput,
  AcceptSuggestedGoalsInput,
  UpdateGoalInput,
  DeleteGoalsInput,
} from '../validators/assessment.validator.js';

// Type definitions
type GoalCategory = 'weight_loss' | 'muscle_building' | 'sleep_improvement' | 'stress_wellness' | 'energy_productivity' | 'event_training' | 'health_condition' | 'habit_building' | 'overall_optimization' | 'custom';
type HealthPillar = 'fitness' | 'nutrition' | 'wellbeing';
type GoalStatus = 'draft' | 'active' | 'paused' | 'completed' | 'abandoned';
type AssessmentType = 'quick' | 'deep';

interface AssessmentResponseRow {
  id: string;
  user_id: string;
  assessment_type: AssessmentType;
  goal_category: GoalCategory;
  responses: object;
  conversation_transcript: object | null;
  extracted_insights: object | null;
  baseline_data: object;
  body_stats: object | null;
  is_complete: boolean;
  completed_at: Date | null;
  time_spent_seconds: number | null;
  switched_from_mode: AssessmentType | null;
  switched_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface UserGoalRow {
  id: string;
  user_id: string;
  category: GoalCategory;
  custom_goal_text: string | null;
  pillar: HealthPillar;
  is_primary: boolean;
  title: string;
  description: string;
  target_value: number;
  target_unit: string;
  current_value: number | null;
  start_value: number | null;
  start_date: Date;
  target_date: Date;
  duration_weeks: number;
  milestones: object;
  motivation: string;
  confidence_level: number;
  status: GoalStatus;
  progress: number;
  is_safety_checked: boolean;
  safety_warnings: string[];
  requires_doctor_consult: boolean;
  ai_suggested: boolean;
  ai_confidence_score: number | null;
  created_at: Date;
  updated_at: Date;
}

// Milestone interface for type safety
interface IMilestone {
  title: string;
  targetValue: number;
  targetDate: Date;
  isCompleted: boolean;
  completedAt?: Date;
  dayNumber: number;
}

// Goal category to pillar mapping
const CATEGORY_PILLAR_MAP: Record<GoalCategory, HealthPillar> = {
  weight_loss: 'fitness',
  muscle_building: 'fitness',
  sleep_improvement: 'wellbeing',
  stress_wellness: 'wellbeing',
  energy_productivity: 'wellbeing',
  event_training: 'fitness',
  health_condition: 'wellbeing',
  habit_building: 'wellbeing',
  overall_optimization: 'fitness',
  custom: 'wellbeing',
};

// Safety guardrails
const SAFETY_CHECKS = {
  weight_loss: {
    maxWeeklyLoss: 2, // lbs per week
    minCalories: { male: 1500, female: 1200 },
  },
  exercise: {
    maxDaysPerWeek: 6,
    minRestDays: 1,
  },
  sleep: {
    minHours: 6,
    recommendedMin: 7,
  },
};

/**
 * S01.2.1: Goal Discovery
 * POST /api/assessment/goal
 */
export const selectGoal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const data = req.body as GoalDiscoveryInput;

  const userResult = await query<{ id: string }>(
    'SELECT id FROM users WHERE id = $1',
    [userId]
  );
  if (userResult.rows.length === 0) throw ApiError.notFound('User not found');

  // Determine pillar from category
  const pillar = CATEGORY_PILLAR_MAP[data.category];

  // Create or update assessment response
  let assessmentResult = await query<AssessmentResponseRow>(
    'SELECT * FROM assessment_responses WHERE user_id = $1 AND is_complete = false ORDER BY created_at DESC LIMIT 1',
    [userId]
  );

  let assessment: AssessmentResponseRow;
  if (assessmentResult.rows.length === 0) {
    const createResult = await query<AssessmentResponseRow>(
      `INSERT INTO assessment_responses (user_id, assessment_type, goal_category, responses, baseline_data)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, 'quick', data.category, '[]', '{}']
    );
    assessment = createResult.rows[0];
  } else {
    const updateResult = await query<AssessmentResponseRow>(
      'UPDATE assessment_responses SET goal_category = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [data.category, assessmentResult.rows[0].id]
    );
    assessment = updateResult.rows[0];
  }

  logger.info('Goal selected', { userId, category: data.category });

  ApiResponse.success(res, {
    goalCategory: data.category,
    customGoalText: data.customGoalText,
    pillar,
    assessmentId: assessment.id,
    nextStep: 'select_mode',
  }, 'Goal selected successfully');
});

/**
 * Select Assessment Mode (Quick vs Deep)
 * POST /api/assessment/mode
 */
export const selectMode = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const data = req.body as AssessmentModeInput;

  const assessmentResult = await query<AssessmentResponseRow>(
    'SELECT * FROM assessment_responses WHERE user_id = $1 AND is_complete = false ORDER BY created_at DESC LIMIT 1',
    [userId]
  );

  if (assessmentResult.rows.length === 0) {
    throw ApiError.badRequest('Please select a goal first');
  }

  const updatedResult = await query<AssessmentResponseRow>(
    'UPDATE assessment_responses SET assessment_type = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
    [data.mode, assessmentResult.rows[0].id]
  );

  logger.info('Assessment mode selected', { userId, mode: data.mode });

  ApiResponse.success(res, {
    mode: data.mode,
    assessmentId: updatedResult.rows[0].id,
  }, `${data.mode === 'quick' ? 'Quick' : 'Deep'} assessment selected`);
});

/**
 * Get Quick Assessment Questions
 * GET /api/assessment/questions
 */
export const getQuestions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const assessmentResult = await query<AssessmentResponseRow>(
    'SELECT * FROM assessment_responses WHERE user_id = $1 AND is_complete = false ORDER BY created_at DESC LIMIT 1',
    [userId]
  );

  if (assessmentResult.rows.length === 0) {
    throw ApiError.badRequest('Please select a goal first');
  }

  const assessment = assessmentResult.rows[0];

  // Get questions for this goal category + baseline questions
  const questionsResult = await query<{ id: string; question_id: string; text: string; type: string; category: string; pillar: string; order_num: number; is_required: boolean; options: object; slider_config: object }>(
    `SELECT * FROM assessment_questions
     WHERE (category = $1 OR category = 'baseline') AND is_active = true
     ORDER BY order_num ASC`,
    [assessment.goal_category]
  );

  // If no questions exist, return sample questions
  const sampleQuestions = questionsResult.rows.length > 0 ? questionsResult.rows : getSampleQuestions(assessment.goal_category);

  ApiResponse.success(res, {
    questions: sampleQuestions,
    totalQuestions: sampleQuestions.length,
    estimatedMinutes: Math.ceil(sampleQuestions.length * 0.5),
    goalCategory: assessment.goal_category,
  });
});

/**
 * S01.2.2: Submit Quick Assessment
 * POST /api/assessment/quick/submit
 */
export const submitQuickAssessment = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const data = req.body as SubmitQuickAssessmentInput;

    const assessmentResult = await query<AssessmentResponseRow>(
      'SELECT * FROM assessment_responses WHERE user_id = $1 AND is_complete = false ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    if (assessmentResult.rows.length === 0) {
      throw ApiError.badRequest('No active assessment found');
    }

    const assessment = assessmentResult.rows[0];

    // Validate minimum responses
    if (data.responses.length < 6) {
      throw ApiError.badRequest('Please answer at least 6 questions');
    }

    const responsesData = data.responses.map(r => ({
      questionId: r.questionId,
      value: r.value,
      answeredAt: new Date(),
    }));

    const bodyStatsData = data.bodyStats ? {
      heightCm: data.bodyStats.heightCm ?? 0,
      weightKg: data.bodyStats.weightKg ?? 0,
      targetWeightKg: data.bodyStats.targetWeightKg ?? 0,
      bodyFatPercentage: data.bodyStats.bodyFatPercentage ?? 0,
    } : null;

    // Extract baseline data from responses
    const baselineData = extractBaselineData(data.responses);

    const completedAt = new Date();
    const timeSpentSeconds = Math.floor(
      (Date.now() - assessment.created_at.getTime()) / 1000
    );

    // Use transaction to update both assessment and user
    const updatedAssessment = await transaction(async (client) => {
      const result = await client.query<AssessmentResponseRow>(
        `UPDATE assessment_responses SET
          responses = $1,
          body_stats = $2,
          baseline_data = $3,
          is_complete = true,
          completed_at = $4,
          time_spent_seconds = $5,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
        RETURNING *`,
        [
          JSON.stringify(responsesData),
          bodyStatsData ? JSON.stringify(bodyStatsData) : null,
          JSON.stringify(baselineData),
          completedAt,
          timeSpentSeconds,
          assessment.id,
        ]
      );

      await client.query(
        'UPDATE users SET onboarding_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['goals_pending', userId]
      );

      return result.rows[0];
    });

    logger.info('Quick assessment completed', {
      userId,
      responseCount: data.responses.length,
      timeSpent: timeSpentSeconds,
    });

    ApiResponse.success(res, {
      assessmentId: updatedAssessment.id,
      completedAt: updatedAssessment.completed_at,
      nextStep: 'goal_setup',
    }, 'Assessment completed successfully');
  }
);

/**
 * S01.2.3: Deep Assessment - Send Message
 * POST /api/assessment/deep/message
 */
export const sendDeepMessage = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const data = req.body as DeepAssessmentMessageInput;

  const assessmentResult = await query<AssessmentResponseRow>(
    `SELECT * FROM assessment_responses
     WHERE user_id = $1 AND is_complete = false AND assessment_type = 'deep'
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );

  if (assessmentResult.rows.length === 0) {
    throw ApiError.badRequest('Please start a deep assessment first');
  }

  const assessment = assessmentResult.rows[0];

  // Add user message to transcript
  const currentTranscript = (assessment.conversation_transcript as Array<{ role: string; message: string; timestamp: Date }>) || [];
  const userMessage = {
    role: 'user',
    message: data.message,
    timestamp: new Date(),
  };
  currentTranscript.push(userMessage);

  // Generate AI response (placeholder - integrate with AI service)
  const aiResponse = await generateAIResponse(assessment.goal_category, currentTranscript);

  const aiMessage = {
    role: 'ai',
    message: aiResponse.message,
    timestamp: new Date(),
  };
  currentTranscript.push(aiMessage);

  await query(
    `UPDATE assessment_responses SET conversation_transcript = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [JSON.stringify(currentTranscript), assessment.id]
  );

  ApiResponse.success(res, {
    aiResponse: aiResponse.message,
    isComplete: aiResponse.isComplete,
    suggestedNextStep: aiResponse.suggestedNextStep,
  });
});

/**
 * Complete Deep Assessment
 * POST /api/assessment/deep/complete
 */
export const completeDeepAssessment = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const assessmentResult = await query<AssessmentResponseRow>(
      `SELECT * FROM assessment_responses
       WHERE user_id = $1 AND is_complete = false AND assessment_type = 'deep'
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (assessmentResult.rows.length === 0) {
      throw ApiError.badRequest('No active deep assessment found');
    }

    const assessment = assessmentResult.rows[0];
    const conversationTranscript = (assessment.conversation_transcript as Array<{ role: string; message: string }>) || [];

    // Extract insights from conversation (placeholder)
    const extractedInsights = await extractInsightsFromConversation(conversationTranscript);

    const completedAt = new Date();
    const timeSpentSeconds = Math.floor(
      (Date.now() - assessment.created_at.getTime()) / 1000
    );

    const updatedAssessment = await transaction(async (client) => {
      const result = await client.query<AssessmentResponseRow>(
        `UPDATE assessment_responses SET
          extracted_insights = $1,
          is_complete = true,
          completed_at = $2,
          time_spent_seconds = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *`,
        [
          JSON.stringify(extractedInsights),
          completedAt,
          timeSpentSeconds,
          assessment.id,
        ]
      );

      await client.query(
        'UPDATE users SET onboarding_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['goals_pending', userId]
      );

      return result.rows[0];
    });

    logger.info('Deep assessment completed', {
      userId,
      messageCount: conversationTranscript.length,
    });

    ApiResponse.success(res, {
      assessmentId: updatedAssessment.id,
      insights: updatedAssessment.extracted_insights,
      nextStep: 'goal_setup',
    }, 'Assessment completed successfully');
  }
);

/**
 * Switch Assessment Mode
 * POST /api/assessment/switch-mode
 */
export const switchMode = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { targetMode } = req.body as { targetMode: AssessmentType };

  const assessmentResult = await query<AssessmentResponseRow>(
    'SELECT * FROM assessment_responses WHERE user_id = $1 AND is_complete = false ORDER BY created_at DESC LIMIT 1',
    [userId]
  );

  if (assessmentResult.rows.length === 0) {
    throw ApiError.badRequest('No active assessment found');
  }

  const assessment = assessmentResult.rows[0];
  const previousMode = assessment.assessment_type;

  await query<AssessmentResponseRow>(
    `UPDATE assessment_responses SET
      assessment_type = $1,
      switched_from_mode = $2,
      switched_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING *`,
    [targetMode, previousMode, assessment.id]
  );

  logger.info('Assessment mode switched', { userId, from: previousMode, to: targetMode });

  ApiResponse.success(res, {
    previousMode,
    currentMode: targetMode,
  }, `Switched to ${targetMode} assessment`);
});

/**
 * S01.3.1: Get AI-Suggested Goals
 * GET /api/assessment/goals/suggested
 */
export const getSuggestedGoals = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const assessmentResult = await query<AssessmentResponseRow>(
    'SELECT * FROM assessment_responses WHERE user_id = $1 AND is_complete = true ORDER BY completed_at DESC LIMIT 1',
    [userId]
  );

  if (assessmentResult.rows.length === 0) {
    throw ApiError.badRequest('Please complete the assessment first');
  }

  const assessment = assessmentResult.rows[0];

  // Generate AI-suggested goals based on assessment
  const suggestedGoals = await generateSuggestedGoals(assessment);

  ApiResponse.success(res, {
    goals: suggestedGoals,
    assessmentId: assessment.id,
  });
});

/**
 * Create Custom Goal
 * POST /api/assessment/goals
 */
export const createGoal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const data = req.body as GoalSetupInput;

  // Check existing goals count
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) FROM user_goals WHERE user_id = $1 AND status = 'active'`,
    [userId]
  );
  const existingGoalsCount = parseInt(countResult.rows[0].count, 10);

  if (existingGoalsCount >= 3) {
    throw ApiError.badRequest('Maximum 3 active goals allowed');
  }

  // Generate milestones
  const milestones = generateMilestones(
    data.currentValue || 0,
    data.targetValue,
    data.timeline.durationWeeks,
    data.targetUnit
  );

  // Run safety checks
  const safetyResult = runSafetyChecks({
    category: data.category,
    targetValue: data.targetValue,
    durationWeeks: data.timeline.durationWeeks,
  });

  // Use transaction to potentially update other primary goals and create new goal
  const goal = await transaction(async (client) => {
    // If setting as primary, unset other primary goals
    if (data.isPrimary) {
      await client.query(
        'UPDATE user_goals SET is_primary = false WHERE user_id = $1 AND is_primary = true',
        [userId]
      );
    }

    // Create the goal
    const result = await client.query<UserGoalRow>(
      `INSERT INTO user_goals (
        user_id, category, pillar, is_primary, title, description,
        target_value, target_unit, current_value, start_value,
        start_date, target_date, duration_weeks, milestones,
        motivation, confidence_level, ai_suggested,
        is_safety_checked, safety_warnings, requires_doctor_consult
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *`,
      [
        userId,
        data.category,
        data.pillar,
        data.isPrimary || existingGoalsCount === 0,
        data.title,
        data.description,
        data.targetValue,
        data.targetUnit,
        data.currentValue || null,
        data.currentValue || 0,
        new Date(data.timeline.startDate),
        new Date(data.timeline.targetDate),
        data.timeline.durationWeeks,
        JSON.stringify(milestones),
        data.motivation,
        7, // Default confidence
        false,
        true,
        safetyResult.warnings,
        safetyResult.requiresDoctorConsult,
      ]
    );

    return result.rows[0];
  });

  logger.info('Goal created', { userId, goalId: goal.id, category: data.category });

  // Enqueue embedding for goal (async, non-blocking)
  await embeddingQueueService.enqueueEmbedding({
    userId,
    sourceType: 'user_goal',
    sourceId: goal.id,
    operation: 'create',
    priority: JobPriorities.CRITICAL,
  });

  // Send notification for goal creation
  await notificationService.goalCreated(
    userId,
    goal.id,
    data.title,
    data.isPrimary || existingGoalsCount === 0
  );

  // Auto-generate achievements for this goal (fire-and-forget)
  import('../services/dynamic-achievements.service.js').then(({ dynamicAchievementsService }) => {
    dynamicAchievementsService.generateGoalAchievements(userId, {
      id: goal.id,
      title: data.title,
      description: data.description,
      category: data.category,
      target_value: data.targetValue,
      target_unit: data.targetUnit,
      status: 'active',
    }).catch((err: unknown) => {
      logger.error('Failed to generate goal achievements', {
        goalId: goal.id,
        error: err instanceof Error ? err.message : 'Unknown',
      });
    });
  }).catch(() => {});

  ApiResponse.created(res, {
    goal: mapGoalRow(goal),
    safetyWarnings: safetyResult.warnings,
    requiresDoctorConsult: safetyResult.requiresDoctorConsult,
  }, 'Goal created successfully');
});

/**
 * Accept AI-Suggested Goals
 * POST /api/assessment/goals/accept-suggested
 */
export const acceptSuggestedGoals = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    // Verify user exists before attempting to create goals
    const userCheck = await query<{ id: string }>('SELECT id FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      logger.error('[Assessment] User not found when accepting goals', { userId });
      throw ApiError.unauthorized('Your session has expired. Please sign out, re-run database setup (npm run db:setup), and sign in again.');
    }

    const data = req.body as AcceptSuggestedGoalsInput;

    const result = await transaction(async (client) => {
      const createdGoals: UserGoalRow[] = [];

      for (const goalData of data.goals) {
        const milestones = generateMilestones(
          0,
          goalData.targetValue,
          goalData.timeline.durationWeeks,
          goalData.targetUnit
        );

        const safetyResult = runSafetyChecks({
          category: goalData.category,
          targetValue: goalData.targetValue,
          durationWeeks: goalData.timeline.durationWeeks,
        });

        const result = await client.query<UserGoalRow>(
          `INSERT INTO user_goals (
            user_id, category, pillar, is_primary, title, description,
            target_value, target_unit, start_value,
            start_date, target_date, duration_weeks, milestones,
            motivation, confidence_level, ai_suggested,
            is_safety_checked, safety_warnings, requires_doctor_consult
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
          RETURNING *`,
          [
            userId,
            goalData.category,
            goalData.pillar,
            goalData.isPrimary,
            goalData.title,
            goalData.description,
            goalData.targetValue,
            goalData.targetUnit,
            0,
            new Date(goalData.timeline.startDate),
            new Date(goalData.timeline.targetDate),
            goalData.timeline.durationWeeks,
            JSON.stringify(milestones),
            goalData.motivation,
            goalData.confidenceLevel || 7,
            true,
            true,
            safetyResult.warnings,
            safetyResult.requiresDoctorConsult,
          ]
        );

        const goal = result.rows[0];
        createdGoals.push(goal);
      }

      await client.query(
        'UPDATE users SET onboarding_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['preferences_pending', userId]
      );

      return createdGoals;
    });

    logger.info('Suggested goals accepted', { userId, goalCount: result.length });

    // Send response immediately — don't block on side-effects
    ApiResponse.created(res, {
      goals: result.map(mapGoalRow),
      nextStep: 'integrations',
    }, 'Goals created successfully');

    // Fire-and-forget: enqueue embeddings and notifications after response
    for (const goal of result) {
      embeddingQueueService.enqueueEmbedding({
        userId,
        sourceType: 'user_goal',
        sourceId: goal.id,
        operation: 'create',
        priority: JobPriorities.CRITICAL,
      }).catch((err) => {
        logger.warn('[Assessment] Embedding enqueue failed (non-blocking)', {
          goalId: goal.id, error: err instanceof Error ? err.message : String(err),
        });
      });

      notificationService.goalCreated(userId, goal.id, goal.title, goal.is_primary).catch((err) => {
        logger.warn('[Assessment] Goal notification failed (non-blocking)', {
          goalId: goal.id, error: err instanceof Error ? err.message : String(err),
        });
      });
    }
  }
);

/**
 * S01.3.2: Commit to Goal
 * POST /api/assessment/goals/:goalId/commit
 */
export const commitToGoal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { goalId } = req.params;
  const data = req.body as GoalCommitmentInput;

  if (!goalId) throw ApiError.badRequest('Goal ID is required');

  const goalResult = await query<UserGoalRow>(
    'SELECT * FROM user_goals WHERE id = $1 AND user_id = $2',
    [goalId, userId]
  );

  if (goalResult.rows.length === 0) throw ApiError.notFound('Goal not found');

  const goal = goalResult.rows[0];

  // Update confidence level
  const updatedResult = await query<UserGoalRow>(
    'UPDATE user_goals SET confidence_level = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
    [data.confidenceLevel, goalId]
  );

  const updatedGoal = mapGoalRow(updatedResult.rows[0]);

  // If low confidence, suggest refinement
  if (data.confidenceLevel < 7) {
    ApiResponse.success(res, {
      goal: updatedGoal,
      needsRefinement: true,
      message: "I'm sensing some hesitation. What's holding you back? Let's adjust until you're at an 8 or higher.",
    });
    return;
  }

  // If unsafe and not acknowledged
  if (goal.safety_warnings && goal.safety_warnings.length > 0 && !data.acknowledgedSafetyWarnings) {
    ApiResponse.success(res, {
      goal: updatedGoal,
      safetyWarnings: goal.safety_warnings,
      requiresAcknowledgment: true,
    });
    return;
  }

  // Activate the goal
  const activatedResult = await query<UserGoalRow>(
    `UPDATE user_goals SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
    [goalId]
  );

  logger.info('Goal committed', { userId, goalId, confidence: data.confidenceLevel });

  ApiResponse.success(res, {
    goal: mapGoalRow(activatedResult.rows[0]),
    nextStep: 'integrations',
  }, 'Goal commitment confirmed');
});

/**
 * Get User Goals
 * GET /api/assessment/goals
 */
export const getGoals = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { status } = req.query;

  let queryText = 'SELECT * FROM user_goals WHERE user_id = $1';
  const params: (string | GoalStatus)[] = [userId];

  if (status && typeof status === 'string') {
    queryText += ' AND status = $2';
    params.push(status as GoalStatus);
  }

  queryText += ' ORDER BY is_primary DESC, created_at DESC';

  const goalsResult = await query<UserGoalRow>(queryText, params);

  ApiResponse.success(res, { goals: goalsResult.rows.map(mapGoalRow) });
});

/**
 * Update Goal
 * PATCH /api/assessment/goals/:goalId
 */
export const updateGoal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { goalId } = req.params;
  const data = req.body as UpdateGoalInput;

  if (!goalId) throw ApiError.badRequest('Goal ID is required');

  const goalResult = await query<UserGoalRow>(
    'SELECT * FROM user_goals WHERE id = $1 AND user_id = $2',
    [goalId, userId]
  );

  if (goalResult.rows.length === 0) throw ApiError.notFound('Goal not found');

  const goal = goalResult.rows[0];

  // Build update query dynamically
  const updates: string[] = [];
  const values: (string | number | boolean | Date | object | null)[] = [];
  let paramIndex = 1;

  if (data.targetValue !== undefined) {
    updates.push(`target_value = $${paramIndex++}`);
    values.push(data.targetValue);
  }

  if (data.targetDate !== undefined) {
    updates.push(`target_date = $${paramIndex++}`);
    values.push(new Date(data.targetDate));
  }

  if (data.status !== undefined) {
    updates.push(`status = $${paramIndex++}`);
    values.push(data.status);
  }

  if (data.currentValue !== undefined) {
    updates.push(`current_value = $${paramIndex++}`);
    values.push(data.currentValue);

    // Calculate and update progress percentage
    const targetValue = data.targetValue || goal.target_value;
    const startValue = goal.start_value || 0;
    const range = targetValue - startValue;
    const currentProgress = range > 0 ? Math.round(((data.currentValue - startValue) / range) * 100) : 0;
    const clampedProgress = Math.max(0, Math.min(100, currentProgress));
    updates.push(`progress = $${paramIndex++}`);
    values.push(clampedProgress);
  }

  // If target changed, regenerate milestones and recalculate progress
  if (data.targetValue || data.targetDate) {
    const newTargetValue = data.targetValue || goal.target_value;
    const milestones = generateMilestones(
      goal.start_value || 0,
      newTargetValue,
      goal.duration_weeks,
      goal.target_unit
    );
    updates.push(`milestones = $${paramIndex++}`);
    values.push(JSON.stringify(milestones));

    // Recalculate progress if target changed (and currentValue wasn't already updated above)
    if (data.targetValue && data.currentValue === undefined) {
      const startValue = goal.start_value || 0;
      const currentValue = goal.current_value || startValue;
      const range = newTargetValue - startValue;
      const currentProgress = range > 0 ? Math.round(((currentValue - startValue) / range) * 100) : 0;
      const clampedProgress = Math.max(0, Math.min(100, currentProgress));
      updates.push(`progress = $${paramIndex++}`);
      values.push(clampedProgress);
    }
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');

  values.push(goalId);
  const updateQuery = `UPDATE user_goals SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

  const updatedResult = await query<UserGoalRow>(updateQuery, values);
  const updatedGoal = updatedResult.rows[0];

  logger.info('Goal updated', { userId, goalId });

  // Enqueue embedding update for goal (async, non-blocking)
  await embeddingQueueService.enqueueEmbedding({
    userId,
    sourceType: 'user_goal',
    sourceId: goalId,
    operation: 'update',
    priority: JobPriorities.CRITICAL,
  });

  // Send progress notification if currentValue was updated
  if (data.currentValue !== undefined) {
    const previousProgress = goal.progress || 0;
    const newProgress = mapGoalRow(updatedGoal).progress;
    await notificationService.goalProgressUpdated(
      userId,
      goalId,
      updatedGoal.title,
      newProgress,
      previousProgress
    );

    // Auto-complete goal when progress reaches 100%
    if (newProgress >= 100 && previousProgress < 100 && updatedGoal.status !== 'completed') {
      await query(
        'UPDATE user_goals SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['completed', goalId]
      );
      updatedGoal.status = 'completed';
      logger.info('Goal auto-completed (progress 100%)', { userId, goalId });
      await notificationService.goalCompleted(userId, goalId, updatedGoal.title);
    } else if (newProgress >= 100 && previousProgress < 100) {
      await notificationService.goalCompleted(userId, goalId, updatedGoal.title);
    }
  }

  ApiResponse.success(res, { goal: mapGoalRow(updatedGoal) }, 'Goal updated successfully');
});

/**
 * Delete Single Goal
 * DELETE /api/assessment/goals/:goalId
 */
export const deleteGoal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { goalId } = req.params;

  if (!goalId) throw ApiError.badRequest('Goal ID is required');

  const goalResult = await query<UserGoalRow>(
    'SELECT * FROM user_goals WHERE id = $1 AND user_id = $2',
    [goalId, userId]
  );

  if (goalResult.rows.length === 0) throw ApiError.notFound('Goal not found');

  // Enqueue embedding deletion BEFORE actual delete (to preserve ID)
  await embeddingQueueService.enqueueEmbedding({
    userId,
    sourceType: 'user_goal',
    sourceId: goalId,
    operation: 'delete',
    priority: JobPriorities.MEDIUM,
  });

  await query('DELETE FROM user_goals WHERE id = $1 AND user_id = $2', [goalId, userId]);

  logger.info('Goal deleted', { userId, goalId });

  ApiResponse.success(res, { deleted: true, goalId }, 'Goal deleted successfully');
});

/**
 * Delete Multiple Goals (Bulk Delete)
 * DELETE /api/assessment/goals
 */
export const deleteGoals = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const data = req.body as DeleteGoalsInput;

  if (!data.goalIds || data.goalIds.length === 0) {
    throw ApiError.badRequest('At least one goal ID is required');
  }

  // Verify all goals belong to user
  const goalsResult = await query<{ id: string }>(
    `SELECT id FROM user_goals WHERE id = ANY($1::uuid[]) AND user_id = $2`,
    [data.goalIds, userId]
  );

  if (goalsResult.rows.length === 0) {
    throw ApiError.notFound('No goals found');
  }

  const validIds = goalsResult.rows.map(r => r.id);

  // Enqueue embedding deletions BEFORE actual delete (to preserve IDs)
  await Promise.all(
    validIds.map((goalId) =>
      embeddingQueueService.enqueueEmbedding({
        userId,
        sourceType: 'user_goal',
        sourceId: goalId,
        operation: 'delete',
        priority: JobPriorities.MEDIUM,
      })
    )
  );

  // Delete the goals
  const deleteResult = await query(
    `DELETE FROM user_goals WHERE id = ANY($1::uuid[]) AND user_id = $2`,
    [validIds, userId]
  );

  logger.info('Goals deleted', { userId, count: deleteResult.rowCount, goalIds: validIds });

  ApiResponse.success(res, {
    deleted: true,
    count: deleteResult.rowCount,
    goalIds: validIds
  }, `${deleteResult.rowCount} goal(s) deleted successfully`);
});

// Helper function to map goal row to API format
function mapGoalRow(row: UserGoalRow) {
  // Calculate progress dynamically to ensure accuracy
  const startValue = row.start_value || 0;
  const currentValue = row.current_value ?? startValue;
  const targetValue = row.target_value;
  const range = targetValue - startValue;
  const calculatedProgress = range > 0 ? Math.round(((currentValue - startValue) / range) * 100) : 0;
  const progress = Math.max(0, Math.min(100, calculatedProgress));

  return {
    id: row.id,
    userId: row.user_id,
    category: row.category,
    customGoalText: row.custom_goal_text,
    pillar: row.pillar,
    isPrimary: row.is_primary,
    title: row.title,
    description: row.description,
    targetValue: row.target_value,
    targetUnit: row.target_unit,
    currentValue: row.current_value,
    startValue: row.start_value,
    startDate: row.start_date,
    targetDate: row.target_date,
    durationWeeks: row.duration_weeks,
    milestones: row.milestones,
    motivation: row.motivation,
    confidenceLevel: row.confidence_level,
    status: row.status,
    progress: progress,
    isSafetyChecked: row.is_safety_checked,
    safetyWarnings: row.safety_warnings,
    requiresDoctorConsult: row.requires_doctor_consult,
    aiSuggested: row.ai_suggested,
    aiConfidenceScore: row.ai_confidence_score,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Helper Functions

function getSampleQuestions(_category: GoalCategory) {
  const baselineQuestions = [
    {
      questionId: 'activity_level',
      text: 'How many days per week are you currently active?',
      type: 'slider',
      category: 'baseline',
      pillar: 'fitness',
      orderNum: 1,
      isRequired: true,
      sliderConfig: { min: 0, max: 7, step: 1 },
    },
    {
      questionId: 'sleep_quality',
      text: 'How would you rate your sleep quality?',
      type: 'emoji_scale',
      category: 'baseline',
      pillar: 'wellbeing',
      orderNum: 2,
      isRequired: true,
      sliderConfig: { min: 1, max: 10, step: 1 },
    },
    {
      questionId: 'stress_level',
      text: 'What is your current stress level?',
      type: 'emoji_scale',
      category: 'baseline',
      pillar: 'wellbeing',
      orderNum: 3,
      isRequired: true,
      sliderConfig: { min: 1, max: 10, step: 1 },
    },
    {
      questionId: 'meals_per_day',
      text: 'How many meals do you typically eat per day?',
      type: 'single_select',
      category: 'baseline',
      pillar: 'nutrition',
      orderNum: 4,
      isRequired: true,
      options: [
        { value: '1-2', label: '1-2 meals' },
        { value: '3', label: '3 meals' },
        { value: '4-5', label: '4-5 meals' },
        { value: '6+', label: '6 or more' },
      ],
    },
    {
      questionId: 'biggest_challenge',
      text: 'What is your biggest health challenge?',
      type: 'single_select',
      category: 'baseline',
      orderNum: 5,
      isRequired: true,
      options: [
        { value: 'time', label: 'Finding time' },
        { value: 'motivation', label: 'Staying motivated' },
        { value: 'knowledge', label: 'Knowing what to do' },
        { value: 'consistency', label: 'Being consistent' },
      ],
    },
  ];

  return baselineQuestions;
}

function extractBaselineData(responses: Array<{ questionId?: string; value?: string | string[] | number }>) {
  const baseline: Record<string, unknown> = {};

  for (const response of responses) {
    if (!response.questionId) continue;
    switch (response.questionId) {
      case 'activity_level':
        baseline['activityDaysPerWeek'] = response.value;
        break;
      case 'sleep_quality':
        baseline['sleepQuality'] = response.value;
        break;
      case 'stress_level':
        baseline['stressLevel'] = response.value;
        break;
      case 'meals_per_day':
        baseline['mealsPerDay'] = response.value;
        break;
    }
  }

  return baseline;
}

async function generateAIResponse(
  _category: GoalCategory,
  transcript: Array<{ role: string; message: string }>
) {
  const messageCount = transcript.length;

  if (messageCount < 6) {
    return {
      message: "That's helpful context. Tell me more about what's been holding you back from reaching your health goals?",
      isComplete: false,
      suggestedNextStep: 'continue',
    };
  }

  return {
    message: "Thank you for sharing all of this with me. I have a good understanding of your situation now. Let's move on to setting some meaningful goals together.",
    isComplete: true,
    suggestedNextStep: 'goal_setup',
  };
}

async function extractInsightsFromConversation(
  _transcript: Array<{ role: string; message: string }>
) {
  return {
    pastAttempts: ['Tried keto for 2 months', 'Used to go to gym regularly'],
    emotionalRelationship: 'Stress eating is a challenge',
    dailyRoutine: 'Busy work schedule, limited cooking time',
    supportSystem: 'Supportive partner',
    deepMotivation: 'Want to feel confident and energetic',
  };
}

async function generateSuggestedGoals(assessment: AssessmentResponseRow) {
  const category = assessment.goal_category;
  const pillar = CATEGORY_PILLAR_MAP[category];

  const now = new Date();
  const fourMonthsLater = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000);

  return [
    {
      category,
      pillar,
      isPrimary: true,
      title: category === 'weight_loss' ? 'Lose 20 lbs in 4 months' : 'Improve overall health',
      description: 'Sustainable weight loss through balanced nutrition and regular exercise',
      targetValue: 20,
      targetUnit: 'lbs',
      timeline: {
        startDate: now,
        targetDate: fourMonthsLater,
        durationWeeks: 16,
      },
      motivation: 'Feel confident and have more energy',
      confidenceScore: 78,
    },
    {
      category: 'habit_building' as GoalCategory,
      pillar: 'nutrition' as HealthPillar,
      isPrimary: false,
      title: 'Track meals 6 days/week for 90 days',
      description: 'Build awareness of eating habits through consistent tracking',
      targetValue: 6,
      targetUnit: 'days/week',
      timeline: {
        startDate: now,
        targetDate: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
        durationWeeks: 13,
      },
      motivation: 'Food awareness is key to success',
    },
  ];
}

function generateMilestones(
  startValue: number,
  targetValue: number,
  durationWeeks: number,
  _unit: string
): IMilestone[] {
  const milestones: IMilestone[] = [];
  const totalChange = targetValue - startValue;

  const milestoneDays = [30, 60, 90].filter(d => d <= durationWeeks * 7);

  for (const dayNumber of milestoneDays) {
    const progress = dayNumber / (durationWeeks * 7);
    const milestoneValue = startValue + (totalChange * progress);

    milestones.push({
      title: `${dayNumber}-day milestone`,
      targetValue: Math.round(milestoneValue * 10) / 10,
      targetDate: new Date(Date.now() + dayNumber * 24 * 60 * 60 * 1000),
      isCompleted: false,
      dayNumber,
    });
  }

  return milestones;
}

function runSafetyChecks(goal: { category: GoalCategory; targetValue: number; durationWeeks: number }) {
  const warnings: string[] = [];
  let requiresDoctorConsult = false;

  if (goal.category === 'weight_loss') {
    const weeklyLoss = goal.targetValue / goal.durationWeeks;
    if (weeklyLoss > SAFETY_CHECKS.weight_loss.maxWeeklyLoss) {
      warnings.push(
        `Losing more than ${SAFETY_CHECKS.weight_loss.maxWeeklyLoss} lbs/week is not recommended. Consider extending your timeline.`
      );
    }
  }

  if (goal.category === 'health_condition') {
    warnings.push(
      'Since you have a health condition, please consult with your doctor before starting this program.'
    );
    requiresDoctorConsult = true;
  }

  return { warnings, requiresDoctorConsult };
}

// ============================================
// GOAL ACTIONS & AUTO-PROGRESS
// ============================================

export const getGoalActions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { goalId } = req.params;
  let actions = await goalDecompositionService.getActionsWithDailyStatus(userId, goalId);

  if (actions.length === 0) {
    await goalDecompositionService.getOrCreateActionsForUserGoal(userId, goalId);
    actions = await goalDecompositionService.getActionsWithDailyStatus(userId, goalId);
    ApiResponse.success(res, { actions, generated: true });
    return;
  }

  ApiResponse.success(res, { actions, generated: false });
});

export const toggleGoalAction = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { actionId } = req.params;
  const completed = await goalDecompositionService.toggleActionCompletion(userId, actionId);

  ApiResponse.success(res, { completed });
});

export const getGoalAutoProgress = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { goalId } = req.params;
  const progress = await autoProgressService.calculateForUserGoal(userId, goalId);

  ApiResponse.success(res, { progress });
});

export default {
  selectGoal,
  selectMode,
  getQuestions,
  submitQuickAssessment,
  sendDeepMessage,
  completeDeepAssessment,
  switchMode,
  getSuggestedGoals,
  createGoal,
  acceptSuggestedGoals,
  commitToGoal,
  getGoals,
  updateGoal,
  deleteGoal,
  deleteGoals,
  getGoalActions,
  toggleGoalAction,
  getGoalAutoProgress,
};
