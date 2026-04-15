/**
 * @file Competitions Routes
 * @description API endpoints for competitions
 */

import { Router } from 'express';
import authenticate from '../middlewares/auth.middleware.js';
import { optionalAuth } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { competitionIdParamSchema } from '../validators/competitions.validator.js';
import {
  getActiveCompetitions,
  getCompetition,
  joinCompetition,
  leaveCompetition,
  getCompetitionLeaderboard,
  createCompetition,
  getAllCompetitions,
} from '../controllers/competitions.controller.js';

const router = Router();

// --- Public / optionally-authenticated GET routes ---

/**
 * GET /api/v1/competitions
 * Get active competitions (includes is_joined when authenticated)
 */
router.get('/', optionalAuth, getActiveCompetitions);

/**
 * GET /api/v1/competitions/active
 * Get active competitions (alias)
 */
router.get('/active', optionalAuth, getActiveCompetitions);

/**
 * GET /api/v1/competitions/:id
 * Get competition details
 */
router.get('/:id', optionalAuth, validate(competitionIdParamSchema, 'params'), getCompetition);

/**
 * GET /api/v1/competitions/:id/leaderboard
 * Get competition leaderboard
 */
router.get('/:id/leaderboard', optionalAuth, validate(competitionIdParamSchema, 'params'), getCompetitionLeaderboard);

// --- Authenticated action routes ---

/**
 * POST /api/v1/competitions/:id/join
 * Join competition (requires auth)
 */
router.post('/:id/join', authenticate, validate(competitionIdParamSchema, 'params'), joinCompetition);

/**
 * DELETE /api/v1/competitions/:id/leave
 * Leave competition (requires auth)
 */
router.delete('/:id/leave', authenticate, validate(competitionIdParamSchema, 'params'), leaveCompetition);

/**
 * Admin routes (require auth)
 */
router.post('/', authenticate, createCompetition);
router.get('/admin/all', authenticate, getAllCompetitions);

export default router;
