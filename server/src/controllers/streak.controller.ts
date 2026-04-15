/**
 * @file Streak Controller
 * Handles streak status, history, calendar, leaderboard, rewards, stats,
 * friend comparison, and streak-freeze operations.
 */

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { streakService } from '../services/streak.service.js';
import { query } from '../database/pg.js';

// ─────────────────────────────────────────────
// GET /api/streaks/status
// ─────────────────────────────────────────────

export const getStreakStatus = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const status = await streakService.getStreakStatus(userId);

    ApiResponse.success(res, status, 'Streak status retrieved successfully');
  }
);

// ─────────────────────────────────────────────
// GET /api/streaks/history
// ─────────────────────────────────────────────

export const getActivityHistory = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    const activityType = (req.query.activityType as string) || undefined;

    // Query streak_activity_log directly
    const countResult = await query(
      `SELECT COUNT(*) FROM streak_activity_log WHERE user_id = $1${activityType ? ' AND activity_type = $2' : ''}`,
      activityType ? [userId, activityType] : [userId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await query(
      `SELECT id, activity_date, activity_type, source_id, streak_day, xp_earned, created_at
       FROM streak_activity_log WHERE user_id = $1${activityType ? ' AND activity_type = $2' : ''}
       ORDER BY activity_date DESC, created_at DESC
       LIMIT $${activityType ? 3 : 2} OFFSET $${activityType ? 4 : 3}`,
      activityType ? [userId, activityType, limit, offset] : [userId, limit, offset]
    );

    ApiResponse.success(
      res,
      { activities: result.rows, total },
      'Activity history retrieved successfully'
    );
  }
);

// ─────────────────────────────────────────────
// GET /api/streaks/calendar/:month
// ─────────────────────────────────────────────

export const getCalendar = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { month } = req.params; // expected format: YYYY-MM
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw ApiError.badRequest('month parameter must be in YYYY-MM format');
    }

    const calendar = await streakService.getCalendar(userId, month);

    ApiResponse.success(res, calendar, 'Calendar data retrieved successfully');
  }
);

// ─────────────────────────────────────────────
// GET /api/streaks/leaderboard
// ─────────────────────────────────────────────

export const getStreakLeaderboard = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const segment = (req.query.segment as string) || 'global';
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 25;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const result = await streakService.getStreakLeaderboard(limit, offset, segment);

    ApiResponse.success(
      res,
      { entries: result.entries, total: result.total },
      'Streak leaderboard retrieved successfully'
    );
  }
);

// ─────────────────────────────────────────────
// GET /api/streaks/leaderboard/around-me
// ─────────────────────────────────────────────

export const getAroundMe = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const entries = await streakService.getAroundMe(userId);

    ApiResponse.success(res, entries, 'Nearby leaderboard entries retrieved successfully');
  }
);

// ─────────────────────────────────────────────
// GET /api/streaks/rewards
// ─────────────────────────────────────────────

export const getRewardTiers = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    // Fetch all reward tiers
    const rewardsResult = await query<{
      id: string;
      streak_days_required: number;
      title: string;
      description: string;
      reward_type: string;
      reward_value: unknown;
      icon: string;
      created_at: Date;
    }>(
      `SELECT id, streak_days_required, title, description,
              reward_type, reward_value, icon, created_at
       FROM streak_rewards
       ORDER BY streak_days_required ASC`
    );

    // Fetch user's current streak to determine unlock status
    const userStreakResult = await query<{ current_streak: number }>(
      `SELECT COALESCE(
         (SELECT current_streak FROM user_streaks WHERE user_id = $1),
         0
       ) AS current_streak`,
      [userId]
    );
    const currentStreak = userStreakResult.rows[0]?.current_streak ?? 0;

    const rewards = rewardsResult.rows.map((row) => ({
      id: row.id,
      streakDaysRequired: row.streak_days_required,
      title: row.title,
      description: row.description,
      rewardType: row.reward_type,
      rewardValue: row.reward_value,
      icon: row.icon,
      unlocked: currentStreak >= row.streak_days_required,
      createdAt: row.created_at,
    }));

    ApiResponse.success(res, { rewards, currentStreak }, 'Reward tiers retrieved successfully');
  }
);

// ─────────────────────────────────────────────
// GET /api/streaks/stats
// ─────────────────────────────────────────────

export const getAggregateStats = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const stats = await streakService.getStats(userId);

    ApiResponse.success(res, stats, 'Aggregate streak stats retrieved successfully');
  }
);

// ─────────────────────────────────────────────
// GET /api/streaks/compare/:friendId
// ─────────────────────────────────────────────

export const compareWithFriend = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { friendId } = req.params;
    if (!friendId) {
      throw ApiError.badRequest('friendId parameter is required');
    }

    const comparison = await streakService.compareWithFriend(userId, friendId);

    ApiResponse.success(res, comparison, 'Streak comparison retrieved successfully');
  }
);

// ─────────────────────────────────────────────
// POST /api/streaks/freeze/purchase
// ─────────────────────────────────────────────

export const purchaseFreeze = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const result = await streakService.purchaseFreeze(userId);

    ApiResponse.success(res, result, 'Streak freeze purchased successfully');
  }
);

// ─────────────────────────────────────────────
// POST /api/streaks/freeze/apply
// ─────────────────────────────────────────────

export const applyFreeze = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { date } = req.body as { date?: string };

    // Validate optional date format
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw ApiError.badRequest('date must be in YYYY-MM-DD format');
    }

    const result = await streakService.applyFreeze(userId, date);

    ApiResponse.success(res, result, 'Streak freeze applied successfully');
  }
);

export default {
  getStreakStatus,
  getActivityHistory,
  getCalendar,
  getStreakLeaderboard,
  getAroundMe,
  getRewardTiers,
  getAggregateStats,
  compareWithFriend,
  purchaseFreeze,
  applyFreeze,
};
