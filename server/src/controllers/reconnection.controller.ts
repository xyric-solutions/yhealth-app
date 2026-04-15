import type { Response } from 'express';
import { BaseController } from './base.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { goalReconnectionService } from '../services/goal-reconnection.service.js';
import type { AuthenticatedRequest } from '../types/index.js';
import type { ReconnectionResponse } from '../../../shared/types/domain/reconnection.js';

const VALID_RESPONSES: ReconnectionResponse[] = [
  'committed', 'paused', 'archived', 'snoozed', 'no_response',
];

class ReconnectionController extends BaseController {
  constructor() {
    super('ReconnectionController');
  }

  /** GET /api/reconnections */
  list = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId ?? '';
    const reconnections = await goalReconnectionService.getOpenForUser(userId);
    this.success(res, { reconnections });
  });

  /** GET /api/reconnections/:id */
  getOne = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId ?? '';
    const reconnection = await goalReconnectionService.getById(req.params.id, userId);
    if (!reconnection) throw new ApiError(404, 'Reconnection not found');
    this.success(res, { reconnection });
  });

  /** POST /api/reconnections/:id/respond */
  respond = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId ?? '';
    const { response, snoozeDays, checkinNote, moodAboutGoal } = req.body as {
      response?: ReconnectionResponse;
      snoozeDays?: number;
      checkinNote?: string;
      moodAboutGoal?: number;
    };
    if (!response || !VALID_RESPONSES.includes(response)) {
      throw new ApiError(400, `response must be one of: ${VALID_RESPONSES.join(', ')}`);
    }
    if (response === 'snoozed' && (!snoozeDays || snoozeDays <= 0)) {
      throw new ApiError(400, 'snoozeDays must be a positive integer when response is "snoozed"');
    }
    if (moodAboutGoal != null && (moodAboutGoal < 1 || moodAboutGoal > 5)) {
      throw new ApiError(400, 'moodAboutGoal must be between 1 and 5');
    }
    const reconnection = await goalReconnectionService.respond(
      req.params.id,
      userId,
      response,
      { snoozeDays, checkinNote, moodAboutGoal },
    );
    this.success(res, { reconnection });
  });

  /** POST /api/reconnections/:id/dismiss */
  dismiss = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId ?? '';
    const reconnection = await goalReconnectionService.dismiss(req.params.id, userId);
    if (!reconnection) throw new ApiError(404, 'Reconnection not found or already resolved');
    this.success(res, { reconnection });
  });
}

export const reconnectionController = new ReconnectionController();
