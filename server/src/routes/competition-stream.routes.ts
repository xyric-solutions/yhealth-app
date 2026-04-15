/**
 * @file Competition Stream Routes
 * @description API endpoints for competition live streams.
 *
 * Mount point: /api/v1/competitions  (and /api/competitions alias)
 *
 * Endpoints:
 *   GET /:competitionId/streams - Get active streams
 */

import { Router } from 'express';
import { getRoomParticipants } from '../controllers/competition-stream.controller.js';

const router = Router();

// GET /api/v1/competitions/:competitionId/streams - Get room participants (no auth required)
router.get('/:competitionId/streams', getRoomParticipants);

export default router;
