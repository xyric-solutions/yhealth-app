/**
 * @file Water Intake Routes
 * API endpoints for water consumption tracking
 */

import { Router, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import authenticate from '../middlewares/auth.middleware.js';
import { waterIntakeService } from '../services/water-intake.service.js';
import cache from '../services/cache.service.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/water/today
 * Get today's water intake log
 */
router.get(
  '/today',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;

    const log = await waterIntakeService.getTodayLog(userId);

    res.json({
      success: true,
      data: { log },
    });
  })
);

/**
 * GET /api/water/stats
 * Get water intake statistics
 */
router.get(
  '/stats',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;

    const stats = await waterIntakeService.getStats(userId);

    res.json({
      success: true,
      data: { stats },
    });
  })
);

/**
 * GET /api/water/history
 * Get water intake history
 */
router.get(
  '/history',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { startDate, endDate } = req.query;

    // Default to last 30 days
    const end = (endDate as string) || new Date().toISOString().split('T')[0];
    const start =
      (startDate as string) ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const history = await waterIntakeService.getHistory(userId, start, end);

    res.json({
      success: true,
      data: { history },
    });
  })
);

/**
 * GET /api/water/:date
 * Get water intake log for a specific date
 */
router.get(
  '/:date',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { date } = req.params;

    const log = await waterIntakeService.getOrCreateLog(userId, date);

    res.json({
      success: true,
      data: { log },
    });
  })
);

/**
 * POST /api/water/add
 * Add water intake
 */
router.post(
  '/add',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { amountMl, type } = req.body;

    if (!amountMl || amountMl <= 0) {
      res.status(400).json({
        success: false,
        error: 'Amount in ml is required and must be positive',
      });
      return;
    }

    const log = await waterIntakeService.addWater(userId, amountMl, type);

    // Invalidate cached health metrics so next fetch reflects new water data
    cache.deleteByPattern(`^enhanced-health-metrics:${userId}:`);

    res.json({
      success: true,
      data: { log },
    });
  })
);

/**
 * POST /api/water/add-glass
 * Add a glass of water (250ml)
 */
router.post(
  '/add-glass',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;

    const log = await waterIntakeService.addGlass(userId);

    // Invalidate cached health metrics so next fetch reflects new water data
    cache.deleteByPattern(`^enhanced-health-metrics:${userId}:`);

    res.json({
      success: true,
      data: { log },
    });
  })
);

/**
 * POST /api/water/remove
 * Remove water intake (for corrections)
 */
router.post(
  '/remove',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { amountMl } = req.body;

    if (!amountMl || amountMl <= 0) {
      res.status(400).json({
        success: false,
        error: 'Amount in ml is required and must be positive',
      });
      return;
    }

    const log = await waterIntakeService.removeWater(userId, amountMl);

    // Invalidate cached health metrics so next fetch reflects updated water data
    cache.deleteByPattern(`^enhanced-health-metrics:${userId}:`);

    res.json({
      success: true,
      data: { log },
    });
  })
);

/**
 * PATCH /api/water/target
 * Set daily water target
 */
router.patch(
  '/target',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { targetMl } = req.body;

    if (!targetMl || targetMl <= 0) {
      res.status(400).json({
        success: false,
        error: 'Target in ml is required and must be positive',
      });
      return;
    }

    const log = await waterIntakeService.setTarget(userId, targetMl);

    res.json({
      success: true,
      data: { log },
    });
  })
);

export default router;
