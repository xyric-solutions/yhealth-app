/**
 * @file Insights Controller
 * @description API endpoints for health correlations and theme insights
 */

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../types/index.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { healthCorrelationService } from '../../services/wellbeing/health-correlation.service.js';
import { themeDetectionService } from '../../services/wellbeing/theme-detection.service.js';

class InsightsController {
  /**
   * @route   GET /api/v1/wellbeing/insights/correlations
   * @desc    Get active health correlations
   */
  getCorrelations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const correlations = await healthCorrelationService.getActiveCorrelations(userId);
    ApiResponse.success(res, { correlations }, 'Correlations retrieved', undefined, req);
  });

  /**
   * @route   POST /api/v1/wellbeing/insights/:id/dismiss
   * @desc    Dismiss an insight
   */
  dismissInsight = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    await healthCorrelationService.dismissCorrelation(userId, req.params.id);
    ApiResponse.success(res, {}, 'Insight dismissed', undefined, req);
  });

  /**
   * @route   GET /api/v1/wellbeing/insights/themes
   * @desc    Get theme insights
   */
  getThemes = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const themes = await themeDetectionService.getThemeInsights(userId);
    ApiResponse.success(res, { themes }, 'Themes retrieved', undefined, req);
  });

  /**
   * @route   POST /api/v1/wellbeing/insights/compute
   * @desc    Trigger on-demand insight computation for the current user
   */
  computeNow = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const windowDays = Number(req.query.days) || 30;

    const [correlationsResult, themesResult] = await Promise.allSettled([
      healthCorrelationService.detectAllCorrelations(userId, windowDays),
      themeDetectionService.computeAggregateThemes(userId, windowDays),
    ]);

    const correlationsFound =
      correlationsResult.status === 'fulfilled' ? correlationsResult.value.length : 0;
    const themesFound =
      themesResult.status === 'fulfilled' ? themesResult.value.length : 0;

    ApiResponse.success(
      res,
      { correlationsFound, themesFound, windowDays },
      'Insights computed',
      undefined,
      req,
    );
  });
}

export const insightsController = new InsightsController();
