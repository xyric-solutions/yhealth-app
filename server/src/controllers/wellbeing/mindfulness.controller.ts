/**
 * @file Mindfulness Controller
 * @description API endpoints for mindfulness practices (F7.7)
 */

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../types/index.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { mindfulnessService } from '../../services/wellbeing/mindfulness.service.js';

class MindfulnessController {
  getPractices = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const practices = await mindfulnessService.getPractices(userId || undefined);
    ApiResponse.success(res, { practices }, 'Mindfulness practices retrieved successfully', undefined, req);
  });

  getRecommendation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const context = req.query.context as 'high_stress' | 'low_energy' | 'low_mood' | 'poor_sleep' | undefined;
    const practice = await mindfulnessService.getRecommendedPractice(userId, context);

    ApiResponse.success(res, { practice }, 'Mindfulness recommendation retrieved successfully', undefined, req);
  });

  logPractice = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { practice_name, practice_category, actual_duration_minutes, effectiveness_rating, context, note } = req.body;

    const practice = await mindfulnessService.logPractice(userId, {
      practiceName: practice_name,
      practiceCategory: practice_category,
      actualDurationMinutes: actual_duration_minutes,
      effectivenessRating: effectiveness_rating,
      context,
      note,
    });

    ApiResponse.success(res, { practice }, { message: 'Practice logged successfully', statusCode: 201 }, undefined, req);
  });

  getHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const limit = parseInt(req.query.limit as string) || 20;
    const history = await mindfulnessService.getPracticeHistory(userId, limit);

    ApiResponse.success(res, { history }, 'Practice history retrieved successfully', undefined, req);
  });
}

export const mindfulnessController = new MindfulnessController();
export default mindfulnessController;

