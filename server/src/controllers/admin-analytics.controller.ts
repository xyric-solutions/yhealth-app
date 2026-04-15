/**
 * Admin Analytics Controller
 * Handles comprehensive analytics endpoints for admin dashboard
 */

import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { getAnalyticsOverview } from '../services/admin-analytics.service.js';

/**
 * Get comprehensive analytics overview
 * GET /api/admin/analytics/overview?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
export const getAnalyticsOverviewHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    // Parse date range from query parameters
    let startDate: Date;
    let endDate: Date;

    if (req.query.startDate && req.query.endDate) {
      startDate = new Date(req.query.startDate as string);
      endDate = new Date(req.query.endDate as string);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw ApiError.badRequest('Invalid date format. Use YYYY-MM-DD format.');
      }

      // Set to start and end of day
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      if (startDate > endDate) {
        throw ApiError.badRequest('startDate must be before endDate');
      }
    } else {
      // Default to last 30 days
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
      startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
    }

    const analytics = await getAnalyticsOverview(startDate, endDate);

    ApiResponse.success(res, analytics, 'Analytics data retrieved successfully');
  }
);

