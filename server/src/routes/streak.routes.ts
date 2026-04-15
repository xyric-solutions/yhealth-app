/**
 * @file Streak Routes
 * API endpoints for streak status, history, calendar, leaderboard,
 * rewards, stats, friend comparison, and streak-freeze operations.
 */

import { Router } from 'express';
import authenticate from '../middlewares/auth.middleware.js';
import * as streakController from '../controllers/streak.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ─── Read endpoints ──────────────────────────

// GET /api/streaks/status — current streak status
router.get('/status', streakController.getStreakStatus);

// GET /api/streaks/history — paginated activity history
router.get('/history', streakController.getActivityHistory);

// GET /api/streaks/calendar/:month — calendar heatmap data (YYYY-MM)
router.get('/calendar/:month', streakController.getCalendar);

// GET /api/streaks/leaderboard — streak leaderboard
router.get('/leaderboard', streakController.getStreakLeaderboard);

// GET /api/streaks/leaderboard/around-me — entries near the current user
router.get('/leaderboard/around-me', streakController.getAroundMe);

// GET /api/streaks/rewards — reward tiers with unlock status
router.get('/rewards', streakController.getRewardTiers);

// GET /api/streaks/stats — aggregate streak statistics
router.get('/stats', streakController.getAggregateStats);

// GET /api/streaks/compare/:friendId — compare streak with a friend
router.get('/compare/:friendId', streakController.compareWithFriend);

// ─── Write endpoints ─────────────────────────

// POST /api/streaks/freeze/purchase — buy a streak freeze
router.post('/freeze/purchase', streakController.purchaseFreeze);

// POST /api/streaks/freeze/apply — use a streak freeze
router.post('/freeze/apply', streakController.applyFreeze);

export default router;
