import type { Response } from 'express';
import { BaseController } from './base.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { obstacleService } from '../services/obstacle.service.js';
import type { AuthenticatedRequest } from '../types/index.js';
import type { ObstacleUserResponse } from '../../../shared/types/domain/obstacle.js';

class ObstacleController extends BaseController {
  constructor() {
    super('ObstacleController');
  }

  /** GET /api/obstacles — list open obstacles for the user */
  list = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId ?? '';
    const obstacles = await obstacleService.getOpenObstaclesForUser(userId);
    this.success(res, { obstacles });
  });

  /** GET /api/obstacles/:id */
  getOne = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId ?? '';
    const obstacle = await obstacleService.getObstacleById(req.params.id, userId);
    if (!obstacle) throw new ApiError(404, 'Obstacle not found');
    this.success(res, { obstacle });
  });

  /** POST /api/obstacles/:id/diagnose — run one diagnostic turn */
  diagnose = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId ?? '';
    const { transcript } = req.body as {
      transcript?: Array<{ role: 'user' | 'assistant'; content: string }>;
    };
    if (!Array.isArray(transcript)) {
      throw new ApiError(400, 'transcript is required (array of {role, content})');
    }
    const result = await obstacleService.diagnoseTurn(req.params.id, userId, transcript);
    this.success(res, result);
  });

  /** POST /api/obstacles/:id/apply-adjustment */
  applyAdjustment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId ?? '';
    const { response, overridePayload } = req.body as {
      response?: ObstacleUserResponse;
      overridePayload?: Record<string, unknown>;
    };
    const allowed: ObstacleUserResponse[] = ['accepted', 'modified', 'declined', 'no_response'];
    if (!response || !allowed.includes(response)) {
      throw new ApiError(400, `response must be one of: ${allowed.join(', ')}`);
    }
    const obstacle = await obstacleService.applyAdjustment(
      req.params.id,
      userId,
      response,
      overridePayload,
    );
    this.success(res, { obstacle });
  });

  /** POST /api/obstacles/:id/dismiss — mark as no_response + resolved */
  dismiss = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId ?? '';
    const obstacle = await obstacleService.dismiss(req.params.id, userId);
    if (!obstacle) throw new ApiError(404, 'Obstacle not found or already resolved');
    this.success(res, { obstacle });
  });
}

export const obstacleController = new ObstacleController();
