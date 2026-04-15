/**
 * @file Scoring Routes
 * @description API endpoints for daily scores
 */

import { Router } from 'express';
import authenticate from '../middlewares/auth.middleware.js';
import {
  getDailyScore,
  getScoreHistory,
} from '../controllers/scoring.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/v1/daily-score
 * Get user's daily score with explanation
 */
router.get('/', getDailyScore);

/**
 * GET /api/v1/daily-score/history
 * Get score history
 */
router.get('/history', getScoreHistory);

export default router;

