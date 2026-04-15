/**
 * @file Life Goals Controller
 * @description API endpoints for life goals and daily intentions
 */

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../types/index.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { lifeGoalsService } from '../../services/wellbeing/life-goals.service.js';
import { motivationTierService } from '../../services/motivation-tier.service.js';
import { goalDecompositionService } from '../../services/goal-decomposition.service.js';
import { logger } from '../../services/logger.service.js';
import type { MotivationTier, GoalActionResponseType } from '../../../../shared/types/domain/wellbeing.js';

class LifeGoalsController {
  // ============================================
  // LIFE GOALS
  // ============================================

  createGoal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { category, title, description, motivation, tracking_method, target_value, target_unit, detection_keywords, is_primary } = req.body;

    if (!category || !title) {
      throw ApiError.badRequest('category and title are required');
    }

    const goal = await lifeGoalsService.createGoal(userId, {
      category,
      title,
      description,
      motivation,
      trackingMethod: tracking_method,
      targetValue: target_value,
      targetUnit: target_unit,
      detectionKeywords: detection_keywords,
      isPrimary: is_primary,
    });

    ApiResponse.success(res, { goal }, { message: 'Life goal created successfully', statusCode: 201 }, undefined, req);
  });

  getGoals = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const status = req.query.status as string | undefined;
    const category = req.query.category as string | undefined;

    const goals = await lifeGoalsService.getGoals(userId, { status, category: category as any });

    ApiResponse.success(res, { goals }, 'Life goals retrieved successfully', undefined, req);
  });

  getGoal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const goal = await lifeGoalsService.getGoalById(userId, req.params.id);

    ApiResponse.success(res, { goal }, 'Life goal retrieved successfully', undefined, req);
  });

  updateGoal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { category, title, description, motivation, tracking_method, target_value, target_unit, detection_keywords, is_primary, status, current_value, progress } = req.body;

    const goal = await lifeGoalsService.updateGoal(userId, req.params.id, {
      category,
      title,
      description,
      motivation,
      trackingMethod: tracking_method,
      targetValue: target_value,
      targetUnit: target_unit,
      detectionKeywords: detection_keywords,
      isPrimary: is_primary,
      status,
      currentValue: current_value,
      progress,
    });

    ApiResponse.success(res, { goal }, 'Life goal updated successfully', undefined, req);
  });

  deleteGoal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    await lifeGoalsService.deleteGoal(userId, req.params.id);

    ApiResponse.success(res, {}, 'Life goal deleted successfully', undefined, req);
  });

  getGoalEntries = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await lifeGoalsService.getGoalEntries(userId, req.params.id, { page, limit });

    ApiResponse.success(res, result, 'Goal entries retrieved successfully', undefined, req);
  });

  // ============================================
  // DAILY INTENTIONS
  // ============================================

  setIntention = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { intention_text, checkin_id, domain } = req.body;
    if (!intention_text) {
      throw ApiError.badRequest('intention_text is required');
    }

    const intention = await lifeGoalsService.setIntention(userId, intention_text, checkin_id, domain);

    ApiResponse.success(res, { intention }, { message: 'Intention set successfully', statusCode: 201 }, undefined, req);
  });

  /**
   * @route   POST /api/v1/journal/intentions/bulk
   * @desc    Set up to 3 intentions at once (replaces existing for today)
   * @access  Private
   */
  bulkSetIntentions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { intentions, checkin_id } = req.body;
    if (!Array.isArray(intentions) || intentions.length === 0) {
      throw ApiError.badRequest('intentions must be a non-empty array');
    }
    if (intentions.length > 3) {
      throw ApiError.badRequest('Maximum 3 intentions per day');
    }

    const result = await lifeGoalsService.bulkSetIntentions(userId, intentions, checkin_id);

    ApiResponse.success(res, { intentions: result }, { message: 'Intentions set successfully', statusCode: 201 }, undefined, req);
  });

  getTodayIntention = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const intention = await lifeGoalsService.getTodayIntention(userId);

    ApiResponse.success(res, { intention }, 'Today\'s intention retrieved', undefined, req);
  });

  /**
   * @route   GET /api/v1/journal/intentions/today
   * @desc    Get all today's intentions (array)
   * @access  Private
   */
  getTodayIntentions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const intentions = await lifeGoalsService.getTodayIntentions(userId);

    ApiResponse.success(res, { intentions }, 'Today\'s intentions retrieved', undefined, req);
  });

  /**
   * @route   GET /api/v1/journal/intentions/fulfillment-rate
   * @desc    Get intention fulfillment rate
   * @access  Private
   */
  getFulfillmentRate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const days = parseInt(req.query.days as string) || 30;
    const result = await lifeGoalsService.getIntentionFulfillmentRate(userId, days);

    ApiResponse.success(res, result, 'Fulfillment rate retrieved', undefined, req);
  });

  updateIntention = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { fulfilled, reflection } = req.body;

    const intention = await lifeGoalsService.updateIntention(userId, req.params.id, { fulfilled, reflection });

    ApiResponse.success(res, { intention }, 'Intention updated successfully', undefined, req);
  });

  // ============================================
  // MILESTONES
  // ============================================

  createMilestone = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { title, description, target_date, target_value, sort_order } = req.body;
    if (!title) throw ApiError.badRequest('title is required');

    const milestone = await lifeGoalsService.createMilestone(userId, req.params.goalId, {
      title,
      description,
      targetDate: target_date,
      targetValue: target_value,
      sortOrder: sort_order,
    });

    ApiResponse.success(res, { milestone }, { message: 'Milestone created successfully', statusCode: 201 }, undefined, req);
  });

  getMilestones = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const milestones = await lifeGoalsService.getMilestones(userId, req.params.goalId);

    ApiResponse.success(res, { milestones }, 'Milestones retrieved successfully', undefined, req);
  });

  updateMilestone = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { title, description, target_date, target_value, current_value, sort_order, completed } = req.body;

    const milestone = await lifeGoalsService.updateMilestone(userId, req.params.milestoneId, {
      title,
      description,
      targetDate: target_date,
      targetValue: target_value,
      currentValue: current_value,
      sortOrder: sort_order,
      completed,
    });

    ApiResponse.success(res, { milestone }, 'Milestone updated successfully', undefined, req);
  });

  completeMilestone = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const milestone = await lifeGoalsService.completeMilestone(userId, req.params.milestoneId);

    ApiResponse.success(res, { milestone }, 'Milestone completed', undefined, req);
  });

  deleteMilestone = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    await lifeGoalsService.deleteMilestone(userId, req.params.milestoneId);

    ApiResponse.success(res, {}, 'Milestone deleted successfully', undefined, req);
  });

  // ============================================
  // CHECK-INS
  // ============================================

  createCheckin = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { progress_value, note, mood_about_goal } = req.body;

    const checkin = await lifeGoalsService.createCheckin(userId, req.params.goalId, {
      progressValue: progress_value,
      note,
      moodAboutGoal: mood_about_goal,
    });

    ApiResponse.success(res, { checkin }, { message: 'Check-in recorded', statusCode: 201 }, undefined, req);
  });

  getCheckins = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const limit = parseInt(req.query.limit as string) || 30;
    const checkins = await lifeGoalsService.getCheckins(userId, req.params.goalId, limit);

    ApiResponse.success(res, { checkins }, 'Check-ins retrieved successfully', undefined, req);
  });

  getCheckinStreak = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const streak = await lifeGoalsService.getCheckinStreak(userId, req.params.goalId);

    ApiResponse.success(res, { streak }, 'Check-in streak retrieved', undefined, req);
  });

  // ============================================
  // DASHBOARD
  // ============================================

  getGoalDashboard = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const dashboard = await lifeGoalsService.getLifeGoalDashboard(userId, req.params.id);

    ApiResponse.success(res, { dashboard }, 'Goal dashboard retrieved', undefined, req);
  });

  // ============================================
  // MOTIVATION PROFILE
  // ============================================

  /**
   * @route   GET /api/v1/journal/motivation-profile
   * @desc    Get or create the user's motivation profile
   * @access  Private
   */
  getMotivationProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const profile = await motivationTierService.getProfile(userId);

    ApiResponse.success(res, { profile }, 'Motivation profile retrieved', undefined, req);
  });

  /**
   * @route   POST /api/v1/journal/motivation-profile
   * @desc    Create or update the user's declared motivation tier
   * @access  Private
   */
  setMotivationProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { tier } = req.body;
    const validTiers: MotivationTier[] = ['low', 'medium', 'high'];
    if (!tier || !validTiers.includes(tier)) {
      throw ApiError.badRequest('tier must be one of: low, medium, high');
    }

    const profile = await motivationTierService.setDeclaredTier(userId, tier);

    ApiResponse.success(res, { profile }, { message: 'Motivation profile updated', statusCode: 201 }, undefined, req);
  });

  /**
   * @route   PUT /api/v1/journal/motivation-profile/tier
   * @desc    Update the user's declared motivation tier only
   * @access  Private
   */
  updateMotivationTier = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { tier } = req.body;
    const validTiers: MotivationTier[] = ['low', 'medium', 'high'];
    if (!tier || !validTiers.includes(tier)) {
      throw ApiError.badRequest('tier must be one of: low, medium, high');
    }

    const profile = await motivationTierService.setDeclaredTier(userId, tier);

    ApiResponse.success(res, { profile }, 'Motivation tier updated', undefined, req);
  });

  // ============================================
  // GOAL DECOMPOSITION & ACTIONS
  // ============================================

  /**
   * @route   POST /api/v1/journal/goals/:goalId/decompose
   * @desc    Decompose a life goal into actionable steps via AI
   * @access  Private
   */
  decomposeGoal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { goalId } = req.params;
    const result = await goalDecompositionService.decomposeGoal(userId, goalId);

    ApiResponse.success(res, result, { message: 'Goal decomposed successfully', statusCode: 201 }, undefined, req);
  });

  /**
   * @route   GET /api/v1/journal/goals/:goalId/actions
   * @desc    Get all actions for a goal
   * @access  Private
   */
  getGoalActions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { goalId } = req.params;
    const actions = await goalDecompositionService.getActions(userId, goalId);

    ApiResponse.success(res, { actions }, 'Goal actions retrieved successfully', undefined, req);
  });

  /**
   * @route   POST /api/v1/journal/goals/:goalId/actions/:actionId/respond
   * @desc    Record accept/edit/skip response to an action
   * @access  Private
   */
  respondToAction = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { actionId } = req.params;
    const { responseType, editedTitle, editedDescription } = req.body;

    const validResponses: GoalActionResponseType[] = ['accept', 'edit', 'skip'];
    if (!responseType || !validResponses.includes(responseType)) {
      throw ApiError.badRequest('responseType must be one of: accept, edit, skip');
    }

    await goalDecompositionService.respondToAction(userId, actionId, responseType, {
      title: editedTitle,
      description: editedDescription,
    });

    ApiResponse.success(res, {}, 'Action response recorded', undefined, req);
  });

  /**
   * @route   POST /api/v1/journal/goals/:goalId/actions/:actionId/complete
   * @desc    Mark an action as completed
   * @access  Private
   */
  completeAction = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { actionId } = req.params;
    await goalDecompositionService.completeAction(userId, actionId);

    ApiResponse.success(res, {}, 'Action completed', undefined, req);
  });

  /**
   * @route   PUT /api/v1/journal/goals/:goalId/actions/:actionId
   * @desc    Update an action's title or description
   * @access  Private
   */
  updateAction = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { actionId } = req.params;
    const { title, description } = req.body;

    const action = await goalDecompositionService.updateAction(userId, actionId, { title, description });

    ApiResponse.success(res, { action }, 'Action updated successfully', undefined, req);
  });

  // ============================================
  // AI GOAL GENERATION FROM ASSESSMENT
  // ============================================

  /**
   * @route   POST /api/v1/journal/goals/from-assessment
   * @desc    Generate personalized goal suggestions from onboarding assessment answers
   * @access  Private
   */
  generateGoalsFromAssessment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { answers, motivationTier } = req.body;

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      throw ApiError.badRequest('answers must be a non-empty array of { question, answer } objects');
    }

    const validTiers = ['low', 'medium', 'high'];
    if (!motivationTier || !validTiers.includes(motivationTier)) {
      throw ApiError.badRequest('motivationTier must be one of: low, medium, high');
    }

    const { aiProviderService } = await import('../../services/ai-provider.service.js');

    const systemPrompt = `You are a life coaching AI. Based on a user's assessment answers, suggest 3-5 personalized life goals.

For each goal, provide:
- title: a clear, specific goal title (max 100 chars)
- category: one of: spiritual, social, productivity, happiness, anxiety_management, creative, personal_growth, financial, faith, relationships, education, career, health_wellness
- actions: 3 preview action titles (short, actionable)

The user's motivation tier is: ${motivationTier}
- low: suggest easy, small goals. Micro-actions only.
- medium: suggest moderate, structured goals.
- high: suggest ambitious, challenging goals.

Respond with ONLY valid JSON: { "goals": [...] }`;

    const userPrompt = answers
      .map((a: { question: string; answer: string }) => `Q: ${a.question}\nA: ${a.answer}`)
      .join('\n\n');

    try {
      const response = await aiProviderService.generateCompletion({
        systemPrompt,
        userPrompt,
        jsonMode: true,
        maxTokens: 1000,
        temperature: 0.7,
      });

      const parsed = JSON.parse(response.content);
      ApiResponse.success(res, parsed.goals || [], 'Goal suggestions generated successfully', undefined, req);
    } catch (error) {
      logger.error('Failed to generate goals from assessment', { error, userId });
      throw ApiError.internal('Failed to generate goal suggestions');
    }
  });
}

export const lifeGoalsController = new LifeGoalsController();
export default lifeGoalsController;
