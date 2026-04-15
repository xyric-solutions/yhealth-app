/**
 * @file Mood Controller
 * @description API endpoints for mood check-ins (F7.1)
 */

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../types/index.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { moodService } from '../../services/wellbeing/mood.service.js';
import { behavioralPatternService } from '../../services/wellbeing/behavioral-pattern.service.js';

class MoodController {
  /**
   * @route   POST /api/v1/wellbeing/mood
   * @desc    Log mood check-in
   * @access  Private
   */
  createMoodLog = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const {
      mood_emoji,
      descriptor,
      happiness_rating,
      energy_rating,
      stress_rating,
      anxiety_rating,
      emotion_tags,
      context_note,
      mode,
      logged_at,
      transition_trigger,
      trigger_category,
    } = req.body;

    if (!mode || !['light', 'deep'].includes(mode)) {
      throw ApiError.badRequest('Mode must be either "light" or "deep"');
    }

    const moodLog = await moodService.createMoodLog(userId, {
      moodEmoji: mood_emoji,
      descriptor,
      happinessRating: happiness_rating,
      energyRating: energy_rating,
      stressRating: stress_rating,
      anxietyRating: anxiety_rating,
      emotionTags: emotion_tags,
      contextNote: context_note,
      mode,
      loggedAt: logged_at,
      transitionTrigger: transition_trigger,
      triggerCategory: trigger_category,
    });

    // Fire-and-forget: detect behavioral patterns after mood log
    behavioralPatternService.detectPatterns(userId).catch(() => {});

    ApiResponse.success(
      res,
      { moodLog },
      {
        message: 'Mood check-in logged successfully',
        statusCode: 201,
      },
      undefined,
      req
    );
  });

  /**
   * @route   GET /api/v1/wellbeing/mood
   * @desc    List mood records
   * @access  Private
   */
  getMoodLogs = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const result = await moodService.getMoodLogs(userId, {
      startDate,
      endDate,
      page,
      limit,
    });

    ApiResponse.success(res, result, 'Mood logs retrieved successfully', undefined, req);
  });

  /**
   * @route   GET /api/v1/wellbeing/mood/timeline
   * @desc    Get mood timeline data for visualization
   * @access  Private
   */
  getMoodTimeline = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    if (!startDate || !endDate) {
      throw ApiError.badRequest('startDate and endDate query parameters are required');
    }

    const timeline = await moodService.getMoodTimeline(userId, startDate, endDate);

    ApiResponse.success(res, { timeline }, 'Mood timeline retrieved successfully', undefined, req);
  });

  /**
   * @route   GET /api/v1/wellbeing/mood/patterns
   * @desc    Get mood patterns and insights
   * @access  Private
   */
  getMoodPatterns = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const days = parseInt(req.query.days as string) || 30;

    const patterns = await moodService.getMoodPatterns(userId, days);

    ApiResponse.success(res, { patterns }, 'Mood patterns retrieved successfully', undefined, req);
  });

  /**
   * @route   GET /api/v1/wellbeing/mood/transitions/:date
   * @desc    Get mood arc transitions for a specific day
   * @access  Private
   */
  getMoodTransitions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { date } = req.params;
    if (!date) throw ApiError.badRequest('date parameter is required (YYYY-MM-DD)');

    const transitions = await moodService.getMoodTransitions(userId, date);

    ApiResponse.success(res, { transitions }, 'Mood transitions retrieved', undefined, req);
  });

  /**
   * @route   GET /api/v1/wellbeing/mood/transition-patterns
   * @desc    Get aggregate trigger→mood correlation patterns
   * @access  Private
   */
  getTransitionPatterns = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const days = parseInt(req.query.days as string) || 30;
    const patterns = await moodService.getTransitionPatterns(userId, days);

    ApiResponse.success(res, { patterns }, 'Transition patterns retrieved', undefined, req);
  });

  /**
   * @route   GET /api/v1/wellbeing/behavioral-patterns
   * @desc    Get active behavioral patterns for user
   * @access  Private
   */
  getBehavioralPatterns = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const patterns = await behavioralPatternService.getActivePatterns(userId);

    ApiResponse.success(res, { patterns }, 'Behavioral patterns retrieved', undefined, req);
  });

  /**
   * @route   POST /api/v1/wellbeing/behavioral-patterns/:id/acknowledge
   * @desc    Acknowledge a behavioral pattern
   * @access  Private
   */
  acknowledgeBehavioralPattern = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    await behavioralPatternService.acknowledgePattern(userId, req.params.id);

    ApiResponse.success(res, {}, 'Pattern acknowledged', undefined, req);
  });

  /**
   * @route   POST /api/v1/wellbeing/behavioral-patterns/:id/dismiss
   * @desc    Dismiss a behavioral pattern
   * @access  Private
   */
  dismissBehavioralPattern = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    await behavioralPatternService.dismissPattern(userId, req.params.id);

    ApiResponse.success(res, {}, 'Pattern dismissed', undefined, req);
  });
}

export const moodController = new MoodController();
export default moodController;

