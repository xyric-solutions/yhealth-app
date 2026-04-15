/**
 * @file Activity Events Controller
 * @description Handles activity event ingestion endpoints
 */

import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { activityIngestionService } from '../services/activity-ingestion.service.js';
import type { AuthenticatedRequest } from '../types/index.js';

/**
 * Submit activity events (batch)
 */
export const submitActivityEvents = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { events } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      throw ApiError.badRequest('Events array is required');
    }

    if (events.length > 100) {
      throw ApiError.badRequest('Maximum 100 events per batch');
    }

    const ingestedEvents = await activityIngestionService.ingestEvents(userId, events);

    ApiResponse.success(
      res,
      {
        events: ingestedEvents,
        count: ingestedEvents.length,
      },
      'Activity events submitted successfully',
      201
    );
  }
);

/**
 * Get user's activity events
 */
export const getUserActivityEvents = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { type, startDate, endDate, limit, offset } = req.query;

    const result = await activityIngestionService.getUserEvents(userId, {
      type: type as 'workout' | 'nutrition' | 'wellbeing' | 'participation' | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    ApiResponse.success(res, result, 'Activity events retrieved successfully');
  }
);

