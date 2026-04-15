import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { stressService, type CreateStressLogInput } from '../services/stress.service.js';

// Create stress log
const createLog = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  // Transform snake_case from API to camelCase for service
  const body = req.body as {
    stress_rating: number;
    triggers?: string[];
    other_trigger?: string;
    note?: string;
    check_in_type: string;
    client_request_id: string;
    logged_at?: string;
  };

  const input: CreateStressLogInput = {
    stressRating: body.stress_rating,
    triggers: body.triggers as CreateStressLogInput['triggers'],
    otherTrigger: body.other_trigger,
    note: body.note,
    checkInType: body.check_in_type as CreateStressLogInput['checkInType'],
    clientRequestId: body.client_request_id,
    loggedAt: body.logged_at,
  };

  const log = await stressService.createStressLog(userId, input);

  ApiResponse.success(res, log, {
    message: 'Stress log created successfully',
    statusCode: 201,
  }, undefined, req);
});

// Get stress logs
const getLogs = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { from, to } = req.query as { from?: string; to?: string };
  const logs = await stressService.getStressLogs(userId, from, to);

  ApiResponse.success(res, logs, {
    message: 'Stress logs retrieved successfully',
  }, undefined, req);
});

// Get stress summary
const getSummary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { from, to } = req.query as { from?: string; to?: string };

  if (!from || !to) {
    throw ApiError.badRequest('Both "from" and "to" query parameters are required');
  }

  const summary = await stressService.getStressSummary(userId, from, to);

  ApiResponse.success(res, summary, {
    message: 'Stress summary retrieved successfully',
  }, undefined, req);
});

// Get extreme stress status (for crisis escalation)
const getExtremeStressStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const status = await stressService.checkExtremeStressStreak(userId);

  ApiResponse.success(res, status, {
    message: 'Extreme stress status retrieved successfully',
  }, undefined, req);
});

// Get multi-signal stress patterns (F7.5)
const getMultiSignalPatterns = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { from, to } = req.query as { from?: string; to?: string };

  if (!from || !to) {
    throw ApiError.badRequest('Both "from" and "to" query parameters are required');
  }

  const patterns = await stressService.getMultiSignalStressPatterns(userId, from, to);

  ApiResponse.success(res, patterns, {
    message: 'Multi-signal stress patterns retrieved successfully',
  }, undefined, req);
});

// Get proactive stress alerts (F7.5)
const getStressAlerts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const alerts = await stressService.getStressAlerts(userId);

  ApiResponse.success(res, { alerts }, {
    message: 'Stress alerts retrieved successfully',
  }, undefined, req);
});

export const stressController = {
  createLog,
  getLogs,
  getSummary,
  getExtremeStressStatus,
  getMultiSignalPatterns,
  getStressAlerts,
};

