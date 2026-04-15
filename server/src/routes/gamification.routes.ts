/**
 * @file Gamification Routes
 * API endpoints for XP, levels, streaks, and achievements
 */

import { Router, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import authenticate from '../middlewares/auth.middleware.js';
import { gamificationService, XP_VALUES } from '../services/gamification.service.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/gamification/stats
 * Get user's gamification stats
 */
router.get(
  '/stats',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    const stats = await gamificationService.getUserStats(userId);

    res.json({
      success: true,
      data: { stats },
    });
  })
);

/**
 * GET /api/gamification/level-progress
 * Get detailed level progress
 */
router.get(
  '/level-progress',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    const stats = await gamificationService.getUserStats(userId);
    const progress = stats.levelProgress;

    res.json({
      success: true,
      data: { progress },
    });
  })
);

/**
 * GET /api/gamification/xp-values
 * Get XP value configuration
 */
router.get(
  '/xp-values',
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    res.json({
      success: true,
      data: { xpValues: XP_VALUES },
    });
  })
);

/**
 * GET /api/gamification/xp-history
 * Get XP transaction history
 */
router.get(
  '/xp-history',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { limit, offset } = req.query;

    const history = await gamificationService.getXPHistory(
      userId,
      limit ? parseInt(limit as string) : 50,
      offset ? parseInt(offset as string) : 0
    );

    res.json({
      success: true,
      data: { history },
    });
  })
);

/**
 * POST /api/gamification/streak/update
 * Update user's streak (called by daily activities)
 */
router.post(
  '/streak/update',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    const result = await gamificationService.updateStreak(userId);

    res.json({
      success: true,
      data: { streak: result },
    });
  })
);

/**
 * POST /api/gamification/daily-check
 * Check daily completion and award bonus XP
 */
router.post(
  '/daily-check',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;

    const result = await gamificationService.checkDailyCompletion(userId);

    res.json({
      success: true,
      data: { dailyCheck: result },
    });
  })
);

/**
 * GET /api/gamification/leaderboard
 * Get XP leaderboard (top users)
 */
router.get(
  '/leaderboard',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.id;
    const { limit } = req.query;

    const leaderboard = await gamificationService.getLeaderboard(
      limit ? parseInt(limit as string) : 10
    );

    // Find user's rank
    const userStats = await gamificationService.getUserStats(userId);
    const userRank = await gamificationService.getUserRank(userId);

    res.json({
      success: true,
      data: {
        leaderboard,
        userRank,
        userStats,
      },
    });
  })
);

export default router;
