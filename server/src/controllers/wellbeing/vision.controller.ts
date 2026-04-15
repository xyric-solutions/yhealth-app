/**
 * @file Vision Testing Controller
 * @description Handles vision test and eye exercise API endpoints
 */

import type { Response } from 'express';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import { visionService } from '../../services/wellbeing/vision.service.js';
import {
  startVisionTestSchema,
  completeVisionTestSchema,
  startEyeExerciseSchema,
  completeEyeExerciseSchema,
  visionHistorySchema,
} from '../../validators/vision.validator.js';

class VisionController {

  // ============================================
  // COLOR VISION TESTS
  // ============================================

  startTest = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const body = startVisionTestSchema.parse(req.body);
    const session = await visionService.startTest(userId, body);

    ApiResponse.success(res, { session }, { message: 'Vision test started', statusCode: 201 }, undefined, req);
  });

  completeTest = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { sessionId } = req.params;
    if (!sessionId) throw ApiError.badRequest('Session ID is required');

    const body = completeVisionTestSchema.parse(req.body);
    const session = await visionService.completeTest(userId, sessionId, body);

    ApiResponse.success(res, { session }, { message: 'Vision test completed' }, undefined, req);
  });

  // ============================================
  // EYE EXERCISES
  // ============================================

  startExercise = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const body = startEyeExerciseSchema.parse(req.body);
    const session = await visionService.startExercise(userId, body);

    ApiResponse.success(res, { session }, { message: 'Eye exercise started', statusCode: 201 }, undefined, req);
  });

  completeExercise = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { sessionId } = req.params;
    if (!sessionId) throw ApiError.badRequest('Session ID is required');

    const body = completeEyeExerciseSchema.parse(req.body);
    const session = await visionService.completeExercise(userId, sessionId, body);

    ApiResponse.success(res, { session }, { message: 'Eye exercise completed' }, undefined, req);
  });

  // ============================================
  // HISTORY & STATS
  // ============================================

  getHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const filter = visionHistorySchema.parse(req.query);
    const result = await visionService.getHistory(userId, filter);

    ApiResponse.success(res, result, undefined, undefined, req);
  });

  getStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const stats = await visionService.getStats(userId);

    ApiResponse.success(res, { stats }, undefined, undefined, req);
  });

  getStreak = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const streak = await visionService.getStreak(userId);

    ApiResponse.success(res, { streak }, undefined, undefined, req);
  });

  getSessionById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { id } = req.params;
    if (!id) throw ApiError.badRequest('Session ID is required');

    const session = await visionService.getSessionById(userId, id);

    ApiResponse.success(res, { session }, undefined, undefined, req);
  });
}

export const visionController = new VisionController();
