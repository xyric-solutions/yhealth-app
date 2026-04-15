/**
 * @file Scoring Controller
 * @description Handles daily score endpoints
 */

import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { aiScoringService } from '../services/ai-scoring.service.js';
import { leaderboardService } from '../services/leaderboard.service.js';
import type { AuthenticatedRequest } from '../types/index.js';

/**
 * Get user's daily score
 */
export const getDailyScore = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { date } = req.query;
    const targetDate = (date as string) || new Date().toISOString().split('T')[0];

    let score = await aiScoringService.getDailyScore(userId, targetDate);

    // If score doesn't exist, calculate it
    if (!score) {
      const calculatedScore = await aiScoringService.calculateDailyScore(
        userId,
        new Date(targetDate)
      );
      await aiScoringService.saveDailyScore(calculatedScore);
      score = calculatedScore;
    }

    // Get ranks
    const rankGlobal = await leaderboardService.getUserRank(userId, targetDate, 'global');
    const rankCountry = await leaderboardService.getUserRank(userId, targetDate, 'country');
    const rankFriends = await leaderboardService.getUserRank(userId, targetDate, 'friends');

    ApiResponse.success(
      res,
      {
        ...score,
        rank: {
          global: rankGlobal,
          country: rankCountry,
          friends: rankFriends,
        },
      },
      'Daily score retrieved successfully'
    );
  }
);

/**
 * Get user's score history
 */
export const getScoreHistory = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    // TODO: Implement score history query with startDate, endDate, limit filters
    // This would query daily_user_scores table
    // Simplified for MVP
    ApiResponse.success(res, { scores: [] }, 'Score history retrieved successfully');
  }
);

