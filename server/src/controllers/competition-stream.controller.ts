/**
 * @file Competition Stream Controller
 * @description HTTP endpoint for fetching competition video room participants.
 */

import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { competitionStreamService } from '../services/competition-stream.service.js';

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * GET /api/v1/competitions/:competitionId/streams
 * Returns the list of participants currently in the competition's video room.
 */
export const getRoomParticipants = asyncHandler(
  async (req: Request, res: Response) => {
    const { competitionId } = req.params;
    const participants = competitionStreamService.getRoomParticipants(competitionId);

    ApiResponse.success(
      res,
      { participants },
      'Room participants retrieved successfully',
    );
  },
);
