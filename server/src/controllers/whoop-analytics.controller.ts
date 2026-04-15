/**
 * @file WHOOP Analytics Controller
 * @description API endpoints for WHOOP analytics and insights
 */

import type { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { whoopAnalyticsService } from '../services/whoop-analytics.service.js';
import { whoopStressService } from '../services/whoop-stress.service.js';
import cache from '../services/cache.service.js';

/**
 * GET /api/whoop/analytics/overview
 * Get WHOOP dashboard overview
 * Query params: startDate (ISO string), endDate (ISO string)
 */
export const getWhoopOverview = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const currentUserId = req.user?.userId;
    if (!currentUserId) throw ApiError.unauthorized();

    // Allow viewing another user's data if userId query param is provided
    // For privacy, we'll verify they're in a chat together (to be implemented)
    const targetUserId = (req.query.userId as string) || currentUserId;

    // Parse date range from query parameters
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (req.query.startDate) {
      startDate = new Date(req.query.startDate as string);
      if (isNaN(startDate.getTime())) {
        throw ApiError.badRequest('Invalid startDate format. Use ISO 8601 format (YYYY-MM-DD)');
      }
    }

    if (req.query.endDate) {
      endDate = new Date(req.query.endDate as string);
      if (isNaN(endDate.getTime())) {
        throw ApiError.badRequest('Invalid endDate format. Use ISO 8601 format (YYYY-MM-DD)');
      }
      // Set to end of day
      endDate.setHours(23, 59, 59, 999);
    }

    // If only one date is provided, validate
    if ((startDate && !endDate) || (!startDate && endDate)) {
      throw ApiError.badRequest('Both startDate and endDate must be provided together, or neither');
    }

    // For daily view (chat context), use today's date
    if (!startDate && !endDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      startDate = today;
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
    }

    // Cache for 30 seconds per user — avoids 7 DB queries on repeat calls
    const startStr = startDate?.toISOString().split('T')[0] || 'today';
    const endStr = endDate?.toISOString().split('T')[0] || 'today';
    const cacheKey = `whoop-overview:${targetUserId}:${startStr}:${endStr}`;
    const overview = await cache.getOrSet(cacheKey, async () => {
      return whoopAnalyticsService.getWhoopOverview(targetUserId, startDate, endDate);
    }, 30);

    res.set('Cache-Control', 'private, max-age=30');
    ApiResponse.success(res, overview, 'WHOOP overview retrieved successfully');
  }
);

/**
 * GET /api/whoop/analytics/recovery
 * Get recovery trends
 * Query params: days (number, default 30), startDate (ISO string), endDate (ISO string)
 */
export const getRecoveryTrends = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    // If days parameter is provided, it takes precedence over explicit dates
    // Pass undefined for dates and let the service calculate from days
    const days = req.query.days ? parseInt(req.query.days as string) : undefined;
    
    // Parse date range from query parameters (only if days is not provided)
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (!req.query.days) {
      // Only use explicit dates if days parameter is not provided
      if (req.query.startDate) {
        startDate = new Date(req.query.startDate as string);
        if (isNaN(startDate.getTime())) {
          throw ApiError.badRequest('Invalid startDate format. Use ISO 8601 format (YYYY-MM-DD)');
        }
        startDate.setHours(0, 0, 0, 0);
      }

      if (req.query.endDate) {
        endDate = new Date(req.query.endDate as string);
        if (isNaN(endDate.getTime())) {
          throw ApiError.badRequest('Invalid endDate format. Use ISO 8601 format (YYYY-MM-DD)');
        }
        // Set to end of day
        endDate.setHours(23, 59, 59, 999);
      }

      // If only one date is provided, validate
      if ((startDate && !endDate) || (!startDate && endDate)) {
        throw ApiError.badRequest('Both startDate and endDate must be provided together, or neither');
      }
    }

    // Use default days value if not provided
    const effectiveDays = days || 30;
    const trends = await whoopAnalyticsService.getRecoveryTrends(userId, effectiveDays, startDate, endDate);

    ApiResponse.success(res, { trends, days, startDate, endDate }, 'Recovery trends retrieved successfully');
  }
);

/**
 * GET /api/whoop/analytics/sleep
 * Get sleep analysis
 * Query params: days (number, default 30), startDate (ISO string), endDate (ISO string)
 */
export const getSleepAnalysis = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    // If days parameter is provided, it takes precedence over explicit dates
    // Pass undefined for dates and let the service calculate from days
    const days = req.query.days ? parseInt(req.query.days as string) : undefined;
    
    // Parse date range from query parameters (only if days is not provided)
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (!req.query.days) {
      // Only use explicit dates if days parameter is not provided
      if (req.query.startDate) {
        startDate = new Date(req.query.startDate as string);
        if (isNaN(startDate.getTime())) {
          throw ApiError.badRequest('Invalid startDate format. Use ISO 8601 format (YYYY-MM-DD)');
        }
        startDate.setHours(0, 0, 0, 0);
      }

      if (req.query.endDate) {
        endDate = new Date(req.query.endDate as string);
        if (isNaN(endDate.getTime())) {
          throw ApiError.badRequest('Invalid endDate format. Use ISO 8601 format (YYYY-MM-DD)');
        }
        // Set to end of day
        endDate.setHours(23, 59, 59, 999);
      }

      // If only one date is provided, validate
      if ((startDate && !endDate) || (!startDate && endDate)) {
        throw ApiError.badRequest('Both startDate and endDate must be provided together, or neither');
      }
    }

    // Use default days value if not provided
    const effectiveDays = days || 30;
    const trends = await whoopAnalyticsService.getSleepTrends(userId, effectiveDays, startDate, endDate);

    ApiResponse.success(res, { trends, days, startDate, endDate }, 'Sleep analysis retrieved successfully');
  }
);

/**
 * GET /api/whoop/analytics/strain
 * Get strain patterns
 * Query params: days (number, default 30), startDate (ISO string), endDate (ISO string)
 */
export const getStrainPatterns = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    // If days parameter is provided, it takes precedence over explicit dates
    // Pass undefined for dates and let the service calculate from days
    const days = req.query.days ? parseInt(req.query.days as string) : undefined;
    
    // Parse date range from query parameters (only if days is not provided)
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (!req.query.days) {
      // Only use explicit dates if days parameter is not provided
      if (req.query.startDate) {
        startDate = new Date(req.query.startDate as string);
        if (isNaN(startDate.getTime())) {
          throw ApiError.badRequest('Invalid startDate format. Use ISO 8601 format (YYYY-MM-DD)');
        }
        startDate.setHours(0, 0, 0, 0);
      }

      if (req.query.endDate) {
        endDate = new Date(req.query.endDate as string);
        if (isNaN(endDate.getTime())) {
          throw ApiError.badRequest('Invalid endDate format. Use ISO 8601 format (YYYY-MM-DD)');
        }
        // Set to end of day
        endDate.setHours(23, 59, 59, 999);
      }

      // If only one date is provided, validate
      if ((startDate && !endDate) || (!startDate && endDate)) {
        throw ApiError.badRequest('Both startDate and endDate must be provided together, or neither');
      }
    }

    // Use default days value if not provided
    const effectiveDays = days || 30;
    const trends = await whoopAnalyticsService.getStrainTrends(userId, effectiveDays, startDate, endDate);

    ApiResponse.success(res, { trends, days, startDate, endDate }, 'Strain patterns retrieved successfully');
  }
);

/**
 * GET /api/whoop/analytics/cycles
 * Get physiological cycle analysis
 * Query params: days (number, default 7), startDate (ISO string), endDate (ISO string)
 */
export const getCycleAnalysis = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    // If days parameter is provided, it takes precedence over explicit dates
    // Pass undefined for dates and let the service calculate from days
    const days = req.query.days ? parseInt(req.query.days as string) : undefined;
    
    // Parse date range from query parameters (only if days is not provided)
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (!req.query.days) {
      // Only use explicit dates if days parameter is not provided
      if (req.query.startDate) {
        startDate = new Date(req.query.startDate as string);
        if (isNaN(startDate.getTime())) {
          throw ApiError.badRequest('Invalid startDate format. Use ISO 8601 format (YYYY-MM-DD)');
        }
        startDate.setHours(0, 0, 0, 0);
      }

      if (req.query.endDate) {
        endDate = new Date(req.query.endDate as string);
        if (isNaN(endDate.getTime())) {
          throw ApiError.badRequest('Invalid endDate format. Use ISO 8601 format (YYYY-MM-DD)');
        }
        // Set to end of day
        endDate.setHours(23, 59, 59, 999);
      }

      // If only one date is provided, validate
      if ((startDate && !endDate) || (!startDate && endDate)) {
        throw ApiError.badRequest('Both startDate and endDate must be provided together, or neither');
      }
    }

    // Use default days value if not provided
    const effectiveDays = days || 7;
    const cycles = await whoopAnalyticsService.getCycleAnalysis(userId, effectiveDays, startDate, endDate);

    ApiResponse.success(res, { cycles, days, startDate, endDate }, 'Cycle analysis retrieved successfully');
  }
);

/**
 * GET /api/whoop/analytics/user-profile
 * Get user health profile data (daily metrics)
 * Query params: userId (required) - ID of user to view
 * Privacy: Only accessible if users are in a chat together
 */
export const getUserHealthProfile = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const currentUserId = req.user?.userId;
    if (!currentUserId) throw ApiError.unauthorized();

    const targetUserId = req.query.userId as string;
    if (!targetUserId) {
      throw ApiError.badRequest('userId query parameter is required');
    }

    // Privacy check: Verify users are in a chat together
    const { query } = await import('../database/pg.js');
    const chatCheck = await query<{ chat_id: string }>(
      `SELECT DISTINCT c.id as chat_id
       FROM chats c
       INNER JOIN chat_participants cp1 ON c.id = cp1.chat_id
       INNER JOIN chat_participants cp2 ON c.id = cp2.chat_id
       WHERE cp1.user_id = $1 
       AND cp2.user_id = $2
       AND cp1.left_at IS NULL
       AND cp2.left_at IS NULL
       LIMIT 1`,
      [currentUserId, targetUserId]
    );

    if (chatCheck.rows.length === 0) {
      throw ApiError.forbidden('You can only view health profiles of users you chat with');
    }

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    // Fetch daily health data
    const healthProfile = await whoopAnalyticsService.getUserHealthProfile(targetUserId, today, endDate);

    ApiResponse.success(res, healthProfile, 'User health profile retrieved successfully');
  }
);

/**
 * GET /api/whoop/analytics/stress
 * Get stress analysis based on HRV, heart rate, and recovery data
 * Query params: startDate (ISO string), endDate (ISO string)
 */
export const getStressAnalysis = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    // Parse date range from query parameters
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (req.query.startDate) {
      startDate = new Date(req.query.startDate as string);
      if (isNaN(startDate.getTime())) {
        throw ApiError.badRequest('Invalid startDate format. Use ISO 8601 format (YYYY-MM-DD)');
      }
    }

    if (req.query.endDate) {
      endDate = new Date(req.query.endDate as string);
      if (isNaN(endDate.getTime())) {
        throw ApiError.badRequest('Invalid endDate format. Use ISO 8601 format (YYYY-MM-DD)');
      }
      // Set to end of day
      endDate.setHours(23, 59, 59, 999);
    }

    const analysis = await whoopStressService.getStressAnalysis(userId, startDate, endDate);

    ApiResponse.success(res, analysis, 'Stress analysis retrieved successfully');
  }
);

export default {
  getWhoopOverview,
  getRecoveryTrends,
  getSleepAnalysis,
  getStrainPatterns,
  getCycleAnalysis,
  getUserHealthProfile,
  getStressAnalysis,
};

