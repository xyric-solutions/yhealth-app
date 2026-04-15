/**
 * @file Activity Events Routes
 * @description API endpoints for activity event ingestion
 */

import { Router } from 'express';
import authenticate from '../middlewares/auth.middleware.js';
import { createRateLimiter } from '../middlewares/rateLimiter.middleware.js';
import {
  submitActivityEvents,
  getUserActivityEvents,
} from '../controllers/activity-events.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * POST /api/v1/activity-events
 * Submit activity events (batch)
 */
router.post(
  '/',
  createRateLimiter({ windowMs: 60 * 1000, max: 100, keyGenerator: 'user' }), // 100 requests per minute
  submitActivityEvents
);

/**
 * GET /api/v1/activity-events
 * Get user's activity events
 */
router.get(
  '/',
  createRateLimiter({ windowMs: 60 * 1000, max: 60, keyGenerator: 'user' }), // 60 requests per minute
  getUserActivityEvents
);

export default router;

