/**
 * @file Leaderboard Routes
 * @description API endpoints for leaderboards
 */

import { Router } from 'express';
import authenticate from '../middlewares/auth.middleware.js';
import { createRateLimiter } from '../middlewares/rateLimiter.middleware.js';
import {
  getDailyLeaderboard,
  getAroundMeLeaderboard,
  getUserRank,
} from '../controllers/leaderboard.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/v1/leaderboards/daily
 * Get daily leaderboard
 */
router.get(
  '/daily',
  createRateLimiter({ windowMs: 60 * 1000, max: 60, keyGenerator: 'user' }), // 60 requests per minute
  getDailyLeaderboard
);

/**
 * GET /api/v1/leaderboards/daily/around-me
 * Get "around me" leaderboard
 */
router.get(
  '/daily/around-me',
  createRateLimiter({ windowMs: 60 * 1000, max: 60, keyGenerator: 'user' }),
  getAroundMeLeaderboard
);

/**
 * GET /api/v1/leaderboards/daily/my-rank
 * Get user's current rank
 */
router.get(
  '/daily/my-rank',
  createRateLimiter({ windowMs: 60 * 1000, max: 60, keyGenerator: 'user' }),
  getUserRank
);

/**
 * GET /api/v1/leaderboards/weekly
 * Get weekly leaderboard
 */
router.get(
  '/weekly',
  createRateLimiter({ windowMs: 60 * 1000, max: 60, keyGenerator: 'user' }),
  getDailyLeaderboard // Reuse same handler, service will handle time period
);

/**
 * GET /api/v1/leaderboards/monthly
 * Get monthly leaderboard
 */
router.get(
  '/monthly',
  createRateLimiter({ windowMs: 60 * 1000, max: 60, keyGenerator: 'user' }),
  getDailyLeaderboard // Reuse same handler, service will handle time period
);

/**
 * GET /api/v1/leaderboards/all-time
 * Get all-time leaderboard
 */
router.get(
  '/all-time',
  createRateLimiter({ windowMs: 60 * 1000, max: 60, keyGenerator: 'user' }),
  getDailyLeaderboard // Reuse same handler, service will handle time period
);

export default router;

