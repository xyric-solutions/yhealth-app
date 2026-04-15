/**
 * @file Competitions Controller
 * @description Handles competition endpoints
 */

import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { competitionService } from '../services/competition.service.js';
import { aiScoringService } from '../services/ai-scoring.service.js';
import { logger } from '../services/logger.service.js';
import type { AuthenticatedRequest } from '../types/index.js';

/**
 * Get active competitions
 */
export const getActiveCompetitions = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const statusFilter = req.query.status as string | undefined;
    const competitions = await competitionService.getActiveCompetitions(statusFilter);

    // Get user's competition entries if user is authenticated
    let userCompetitionIds: string[] = [];
    if (userId) {
      try {
        userCompetitionIds = await competitionService.getUserCompetitionEntries(userId);
      } catch (error) {
        // Log error but don't fail the request - just return empty array
        logger.warn('[Competitions] Failed to get user competition entries', {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
        userCompetitionIds = [];
      }
    }

    // Map to frontend format (snake_case)
    const mappedCompetitions = competitions.map((comp) => ({
      id: comp.id,
      name: comp.name,
      type: comp.type,
      description: comp.description,
      start_date: comp.startDate.toISOString(),
      end_date: comp.endDate.toISOString(),
      status: comp.status,
      rules: comp.rules,
      eligibility: comp.eligibility,
      scoring_weights: comp.scoringWeights,
      anti_cheat_policy: comp.antiCheatPolicy,
      prize_metadata: comp.prizeMetadata,
      created_by: comp.createdBy,
      created_at: comp.createdAt.toISOString(),
      updated_at: comp.updatedAt.toISOString(),
      participant_count: (comp as any).participantCount || 0,
      is_joined: userId ? userCompetitionIds.includes(comp.id) : false,
    }));

    ApiResponse.success(res, { competitions: mappedCompetitions }, 'Competitions retrieved successfully');
  }
);

/**
 * Get competition by ID
 */
export const getCompetition = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const competition = await competitionService.getCompetition(id);

    if (!competition) {
      throw ApiError.notFound('Competition not found');
    }

    ApiResponse.success(res, { competition }, 'Competition retrieved successfully');
  }
);

/**
 * Join competition
 */
export const joinCompetition = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { id } = req.params;

    const entry = await competitionService.joinCompetition(userId, id);

    ApiResponse.success(res, { entry }, 'Joined competition successfully', 201);
  }
);

/**
 * Leave competition
 */
export const leaveCompetition = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { id } = req.params;

    await competitionService.leaveCompetition(userId, id);

    ApiResponse.success(res, null, 'Left competition successfully');
  }
);

/**
 * Get competition leaderboard
 * Returns data in LeaderboardResponse-compatible format for the LeaderboardList component
 */
export const getCompetitionLeaderboard = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { limit: limitParam, offset: offsetParam } = req.query;

    const limitVal = limitParam ? parseInt(limitParam as string, 10) : 100;
    const offsetVal = offsetParam ? parseInt(offsetParam as string, 10) : 0;

    // Fetch competition to get date range
    const competition = await competitionService.getCompetition(id);
    if (!competition) {
      throw ApiError.notFound('Competition not found');
    }

    // Ensure daily scores exist for the full competition date range
    // so that competition scoring has complete data to aggregate
    const startDate = new Date(competition.startDate);
    const endDate = new Date(competition.endDate);
    const today = new Date();
    const effectiveEnd = endDate < today ? endDate : today;
    const MAX_DAYS = 30;

    let daysProcessed = 0;
    for (let d = new Date(startDate); d <= effectiveEnd && daysProcessed < MAX_DAYS; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const hasScores = await aiScoringService.hasScoresForDate(dateStr);
      if (!hasScores) {
        await aiScoringService.computeScoresForAllUsers(new Date(d));
      }
      daysProcessed++;
    }

    // Update competition scores and ranks before returning
    await competitionService.updateCompetitionScores(id);

    const result = await competitionService.getCompetitionLeaderboard(id, limitVal, offsetVal);

    // Map to LeaderboardResponse-compatible format (snake_case, ranks array)
    const ranks = result.entries.map((entry) => ({
      user_id: entry.userId,
      rank: entry.currentRank ?? 0,
      total_score: Number(entry.currentScore) || 0,
      component_scores: { workout: 0, nutrition: 0, wellbeing: 0, biometrics: 0, engagement: 0, consistency: 0 },
      user: (entry as any).user || undefined,
    }));

    ApiResponse.success(res, {
      date: new Date().toISOString().split('T')[0],
      type: 'competition',
      segment: id,
      ranks,
      pagination: {
        total: result.total,
        limit: limitVal,
        offset: offsetVal,
      },
    }, 'Competition leaderboard retrieved successfully');
  }
);

/**
 * Admin: Create competition
 */
export const createCompetition = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    // Check admin role (simplified)
    // if (!req.user?.isAdmin) throw ApiError.forbidden();

    const {
      name,
      type,
      description,
      startDate,
      endDate,
      rules,
      eligibility,
      scoringWeights,
      antiCheatPolicy,
      prizeMetadata,
    } = req.body;

    const competition = await competitionService.createCompetition({
      name,
      type,
      description,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      rules,
      eligibility: eligibility || {},
      scoringWeights: scoringWeights || {},
      antiCheatPolicy: antiCheatPolicy || {},
      prizeMetadata: prizeMetadata || {},
      status: 'draft',
      createdBy: userId,
    });

    ApiResponse.success(res, { competition }, 'Competition created successfully', 201);
  }
);

/**
 * Admin: Get all competitions
 */
export const getAllCompetitions = asyncHandler(
  async (_req: AuthenticatedRequest, res: Response) => {
    // Simplified - would need pagination
    ApiResponse.success(res, { competitions: [] }, 'Competitions retrieved successfully');
  }
);

