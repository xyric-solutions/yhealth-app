/**
 * @file Mental Recovery Score Controller
 * @description Handles mental recovery score endpoints
 */

import { Response } from 'express';
import { mentalRecoveryScoreService } from '../services/mental-recovery-score.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import type { AuthenticatedRequest } from '../types/index.js';

class MentalRecoveryController {
  /**
   * @route   GET /api/recovery-score
   * @desc    Get current recovery score
   * @access  Private
   */
  getCurrent = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const date = req.query.date as string | undefined;

    try {
      const score = await mentalRecoveryScoreService.calculateRecoveryScore(userId, date);
      
      // Transform to match frontend expectations
      const response = {
        ...score,
        sleepScore: score.components.sleep,
        stressScore: score.components.stress,
        moodScore: score.components.mood,
        emotionScore: score.components.emotion,
        activityScore: score.components.activity,
        factorsData: score.factors,
        components: score.components, // Also include components object for fallback
      };
      
      ApiResponse.success(res, response, 'Recovery score retrieved successfully');
    } catch (_error) {
      // If calculation fails, return a default score structure
      const defaultScore = {
        userId,
        scoreDate: date || new Date().toISOString().split('T')[0],
        recoveryScore: 50,
        sleepScore: 50,
        stressScore: 50,
        moodScore: 50,
        emotionScore: 50,
        activityScore: 50,
        components: {
          sleep: 50,
          stress: 50,
          mood: 50,
          emotion: 50,
          activity: 50,
        },
        emotionContribution: 0,
        emotionWeight: 0.15,
        factors: {},
        trend: 'stable' as const,
        factorsData: {},
      };
      
      ApiResponse.success(res, defaultScore, 'Recovery score retrieved (default values)');
    }
  });

  /**
   * @route   GET /api/recovery-score/trends
   * @desc    Get recovery score trends
   * @access  Private
   */
  getTrends = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const days = parseInt(req.query.days as string) || 30;
    
    // Enhance trends with component scores from database
    const enhancedTrends = await mentalRecoveryScoreService.getRecoveryTrendsWithComponents(userId, days);
    
    ApiResponse.success(res, { trends: enhancedTrends }, 'Recovery trends retrieved successfully');
  });

  /**
   * @route   GET /api/recovery-score/history
   * @desc    Get historical scores
   * @access  Private
   */
  getHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    if (!startDate || !endDate) {
      throw ApiError.badRequest('startDate and endDate are required');
    }

    // Calculate days from dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    const trends = await mentalRecoveryScoreService.getRecoveryTrends(userId, days);
    
    // Filter by date range
    const filteredTrends = trends.filter(
      trend => trend.date >= startDate && trend.date <= endDate
    );

    ApiResponse.success(res, { scores: filteredTrends }, 'Recovery score history retrieved successfully');
  });

  /**
   * @route   PATCH /api/recovery-score/emotion-weight
   * @desc    Update emotion weight for recovery score calculation
   * @access  Private
   */
  updateEmotionWeight = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { weight } = req.body as { weight: number };

    if (weight === undefined || weight < 0 || weight > 1) {
      throw ApiError.badRequest('Weight must be between 0 and 1');
    }

    await mentalRecoveryScoreService.updateEmotionWeight(userId, weight);
    ApiResponse.success(res, { updated: true, weight }, 'Emotion weight updated successfully');
  });
}

export const mentalRecoveryController = new MentalRecoveryController();

