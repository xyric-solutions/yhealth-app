/**
 * @file Breathing Controller
 * @description API endpoints for breathing tests and lung health tracking
 */

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../types/index.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { breathingService, type BreathingTestType } from '../../services/wellbeing/breathing.service.js';

class BreathingController {
  /**
   * @route   POST /api/v1/wellbeing/breathing
   * @desc    Save a breathing test result
   * @access  Private
   */
  createBreathingTest = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const {
      test_type,
      pattern_name,
      breath_hold_duration_seconds,
      total_cycles_completed,
      total_duration_seconds,
      average_inhale_duration,
      average_exhale_duration,
      average_hold_duration,
      consistency_score,
      difficulty_rating,
      notes,
      started_at,
    } = req.body;

    // Validate required fields
    if (!test_type) {
      throw ApiError.badRequest('test_type is required');
    }

    if (!total_duration_seconds || typeof total_duration_seconds !== 'number') {
      throw ApiError.badRequest('total_duration_seconds is required and must be a number');
    }

    if (!started_at) {
      throw ApiError.badRequest('started_at is required');
    }

    const breathingTest = await breathingService.createBreathingTest(userId, {
      testType: test_type as BreathingTestType,
      patternName: pattern_name,
      breathHoldDurationSeconds: breath_hold_duration_seconds,
      totalCyclesCompleted: total_cycles_completed,
      totalDurationSeconds: total_duration_seconds,
      averageInhaleDuration: average_inhale_duration,
      averageExhaleDuration: average_exhale_duration,
      averageHoldDuration: average_hold_duration,
      consistencyScore: consistency_score,
      difficultyRating: difficulty_rating,
      notes,
      startedAt: started_at,
    });

    ApiResponse.success(
      res,
      { breathingTest },
      {
        message: 'Breathing test saved successfully',
        statusCode: 201,
      },
      undefined,
      req
    );
  });

  /**
   * @route   GET /api/v1/wellbeing/breathing
   * @desc    Get breathing test history
   * @access  Private
   */
  getBreathingTests = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const testType = req.query.testType as BreathingTestType | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await breathingService.getBreathingTests(userId, {
      startDate,
      endDate,
      testType,
      page,
      limit,
    });

    ApiResponse.success(res, result, 'Breathing tests retrieved successfully', undefined, req);
  });

  /**
   * @route   GET /api/v1/wellbeing/breathing/timeline
   * @desc    Get breathing timeline data for visualization
   * @access  Private
   */
  getBreathingTimeline = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    if (!startDate || !endDate) {
      throw ApiError.badRequest('startDate and endDate query parameters are required');
    }

    const timeline = await breathingService.getBreathingTimeline(userId, startDate, endDate);

    ApiResponse.success(res, { timeline }, 'Breathing timeline retrieved successfully', undefined, req);
  });

  /**
   * @route   GET /api/v1/wellbeing/breathing/stats
   * @desc    Get breathing statistics and insights
   * @access  Private
   */
  getBreathingStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const days = parseInt(req.query.days as string) || 30;

    const stats = await breathingService.getBreathingStats(userId, days);

    ApiResponse.success(res, { stats }, 'Breathing stats retrieved successfully', undefined, req);
  });

  /**
   * @route   GET /api/v1/wellbeing/breathing/:id
   * @desc    Get a single breathing test by ID
   * @access  Private
   */
  getBreathingTestById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { id } = req.params;
    const breathingTest = await breathingService.getBreathingTestById(userId, id);

    ApiResponse.success(res, { breathingTest }, 'Breathing test retrieved successfully', undefined, req);
  });

  /**
   * @route   DELETE /api/v1/wellbeing/breathing/:id
   * @desc    Delete a breathing test
   * @access  Private
   */
  deleteBreathingTest = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { id } = req.params;
    await breathingService.deleteBreathingTest(userId, id);

    ApiResponse.success(res, null, 'Breathing test deleted successfully', undefined, req);
  });
}

export const breathingController = new BreathingController();
export default breathingController;
