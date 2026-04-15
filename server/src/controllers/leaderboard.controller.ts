/**
 * @file Leaderboard Controller
 * @description Handles leaderboard query endpoints
 */

import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { leaderboardService } from '../services/leaderboard.service.js';
import { aiScoringService } from '../services/ai-scoring.service.js';
import { logger } from '../services/logger.service.js';
import type { AuthenticatedRequest } from '../types/index.js';

/**
 * Ensure daily scores exist for a given date, computing them if needed.
 * This lazy-initializes the leaderboard data.
 * Always materializes and updates ranks when scores exist (whether freshly
 * computed or previously created by the daily scoring job).
 */
async function ensureScoresExist(dateStr: string): Promise<void> {
  const hasScores = await aiScoringService.hasScoresForDate(dateStr);
  if (!hasScores) {
    logger.info('[Leaderboard] No scores for date, computing...', { date: dateStr });
    const computed = await aiScoringService.computeScoresForAllUsers(new Date(dateStr));
    logger.info('[Leaderboard] Computed scores for users', { date: dateStr, computed });
  }

  // Always materialize and update ranks if any scores exist
  // (whether freshly computed or from the daily scoring job)
  if (await aiScoringService.hasScoresForDate(dateStr)) {
    await leaderboardService.materializeLeaderboard('global', dateStr);
    await leaderboardService.updateRanks(dateStr);
  }
}

/**
 * Get daily leaderboard
 */
export const getDailyLeaderboard = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { date, type, segment, limit, offset } = req.query;
    const targetDate = (date as string) || new Date().toISOString().split('T')[0];

    // Ensure scores exist for the requested date
    await ensureScoresExist(targetDate);

    const leaderboard = await leaderboardService.getLeaderboard(
      (type as 'global' | 'country' | 'friends' | 'competition') || 'global',
      targetDate,
      {
        segment: segment as string | undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
      }
    );

    ApiResponse.success(res, leaderboard, 'Leaderboard retrieved successfully');
  }
);

/**
 * Get "around me" leaderboard
 */
export const getAroundMeLeaderboard = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { date, range } = req.query;
    const targetDate = (date as string) || new Date().toISOString().split('T')[0];

    await ensureScoresExist(targetDate);

    const leaderboard = await leaderboardService.getAroundMe(
      userId,
      targetDate,
      range ? parseInt(range as string, 10) : 50
    );

    ApiResponse.success(res, leaderboard, 'Around me leaderboard retrieved successfully');
  }
);

/**
 * Get user's current rank
 */
export const getUserRank = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { date, type } = req.query;
    const targetDate = (date as string) || new Date().toISOString().split('T')[0];

    await ensureScoresExist(targetDate);

    const rank = await leaderboardService.getUserRank(
      userId,
      targetDate,
      (type as 'global' | 'country' | 'friends') || 'global'
    );

    ApiResponse.success(
      res,
      { rank: rank || null },
      'User rank retrieved successfully'
    );
  }
);
