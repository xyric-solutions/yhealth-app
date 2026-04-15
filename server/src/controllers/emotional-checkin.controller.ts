/**
 * @file Emotional Check-In Controller
 * @description API endpoints for emotional check-in screening sessions
 */

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import type { FileRequest } from '../middlewares/upload.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { emotionalCheckInService, type CheckInResponse, type ScreeningType } from '../services/emotional-checkin.service.js';

class EmotionalCheckInController {
  /**
   * @route   POST /api/v1/wellbeing/emotional-checkin/start
   * @desc    Start a new emotional check-in session
   * @access  Private
   */
  startCheckIn = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { type } = req.body as { type?: ScreeningType };

    const result = await emotionalCheckInService.startCheckIn(userId, type);

    ApiResponse.success(
      res,
      result,
      {
        message: 'Emotional check-in session started',
        statusCode: 201,
      },
      undefined,
      req
    );
  });

  /**
   * @route   POST /api/v1/wellbeing/emotional-checkin/:sessionId/respond
   * @desc    Submit a response to a check-in question
   * @access  Private
   */
  submitResponse = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { sessionId } = req.params;
    const { questionId, value, text, conversationHistory } = req.body as {
      questionId: string;
      value: number | string;
      text?: string;
      conversationHistory?: Array<{ role: 'assistant' | 'user'; content: string; timestamp: string }>;
    };

    if (!questionId || value === undefined) {
      throw ApiError.badRequest('questionId and value are required');
    }

    const response: CheckInResponse = {
      questionId,
      value,
      text,
    };

    const mappedHistory = (conversationHistory || []).map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.timestamp),
    }));

    const result = await emotionalCheckInService.processResponse(
      sessionId,
      questionId,
      response,
      mappedHistory
    );

    ApiResponse.success(res, result, 'Response processed successfully', undefined, req);
  });

  /**
   * @route   GET /api/v1/wellbeing/emotional-checkin/:sessionId
   * @desc    Get check-in session status
   * @access  Private
   */
  getSession = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { sessionId } = req.params;

    const session = await emotionalCheckInService.getSession(sessionId);

    if (!session) {
      throw ApiError.notFound('Check-in session not found');
    }

    if (session.userId !== userId) {
      throw ApiError.forbidden('Access denied');
    }

    ApiResponse.success(res, { session }, 'Session retrieved successfully', undefined, req);
  });

  /**
   * @route   POST /api/v1/wellbeing/emotional-checkin/:sessionId/complete
   * @desc    Complete check-in session and get results
   * @access  Private
   */
  completeSession = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { sessionId } = req.params;

    const session = await emotionalCheckInService.getSession(sessionId);

    if (!session) {
      throw ApiError.notFound('Check-in session not found');
    }

    if (session.userId !== userId) {
      throw ApiError.forbidden('Access denied');
    }

    const completedSession = await emotionalCheckInService.completeSession(sessionId);

    ApiResponse.success(res, { session: completedSession }, 'Check-in completed successfully', undefined, req);
  });

  /**
   * @route   GET /api/v1/wellbeing/emotional-checkin/history
   * @desc    Get past check-in sessions
   * @access  Private
   */
  getHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await emotionalCheckInService.getCheckInHistory(userId, { page, limit });

    ApiResponse.success(res, result, 'Check-in history retrieved successfully', undefined, req);
  });

  /**
   * @route   GET /api/v1/wellbeing/emotional-checkin/trends
   * @desc    Get trend analysis for emotional check-ins
   * @access  Private
   */
  getTrends = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const timeWindow = (req.query.timeWindow as 'week' | 'month') || 'week';

    const { emotionalCheckinTrendsService } = await import('../services/emotional-checkin-trends.service.js');
    const trends = await emotionalCheckinTrendsService.getTrends(userId, timeWindow);
    const baseline = await emotionalCheckinTrendsService.getUserBaseline(userId);

    ApiResponse.success(
      res,
      { trends, baseline },
      'Trend analysis retrieved successfully',
      undefined,
      req
    );
  });

  /**
   * @route   POST /api/v1/wellbeing/emotional-checkin/:sessionId/analyze-camera
   * @desc    Analyze camera image for emotional check-in (legacy - server-side OpenAI)
   * @access  Private
   */
  analyzeCameraImage = asyncHandler(async (req: FileRequest & AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { sessionId } = req.params;
    const file = req.file;

    if (!file) {
      throw ApiError.badRequest('No image file provided');
    }

    const result = await emotionalCheckInService.analyzeCameraImage(
      sessionId,
      file.buffer,
      file.mimetype
    );

    ApiResponse.success(res, result, 'Camera image analyzed successfully', undefined, req);
  });

  /**
   * @route   POST /api/v1/wellbeing/emotional-checkin/:sessionId/tensorflow-analysis
   * @desc    Process TensorFlow.js emotion analysis results (on-device processing)
   * @access  Private
   */
  processTensorFlowAnalysis = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { sessionId } = req.params;
    const {
      dominant,
      distribution,
      engagement,
      stressIndicators,
      averageConfidence,
      sampleCount,
    } = req.body as {
      dominant: string;
      distribution: Record<string, number>;
      engagement: number;
      stressIndicators: {
        browFurrow: number;
        jawTension: number;
        eyeStrain: number;
      };
      averageConfidence: number;
      sampleCount: number;
    };

    // Validate required fields
    if (!dominant || !distribution || engagement === undefined || !stressIndicators) {
      throw ApiError.badRequest('Missing required analysis data');
    }

    // Import camera emotion service
    const { cameraEmotionService } = await import('../services/camera-emotion.service.js');

    const result = await cameraEmotionService.processEmotionAnalysis(userId, {
      sessionId,
      dominant: dominant as any,
      distribution: distribution as any,
      engagement,
      stressIndicators,
      averageConfidence,
      sampleCount,
    });

    ApiResponse.success(res, result, 'TensorFlow analysis processed successfully', undefined, req);
  });

  /**
   * @route   GET /api/v1/wellbeing/emotional-checkin/enhanced-trends
   * @desc    Get enhanced trend analysis (7/30/90 day windows with pattern detection)
   * @access  Private
   */
  getEnhancedTrends = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { emotionalCheckinTrendsService } = await import('../services/emotional-checkin-trends.service.js');
    const enhancedTrends = await emotionalCheckinTrendsService.getEnhancedTrends(userId);

    ApiResponse.success(
      res,
      enhancedTrends,
      'Enhanced trend analysis retrieved successfully',
      undefined,
      req
    );
  });

  /**
   * @route   GET /api/v1/wellbeing/emotional-checkin/incomplete
   * @desc    Get incomplete sessions that can be recovered
   * @access  Private
   */
  getIncompleteSessions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const sessions = await emotionalCheckInService.findIncompleteSessions(userId);

    ApiResponse.success(
      res,
      { sessions },
      'Incomplete sessions retrieved successfully',
      undefined,
      req
    );
  });

  /**
   * @route   POST /api/v1/wellbeing/emotional-checkin/:sessionId/recover
   * @desc    Recover an incomplete session
   * @access  Private
   */
  recoverSession = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { sessionId } = req.params;

    const recoveryData = await emotionalCheckInService.recoverSession(sessionId, userId);

    if (!recoveryData.recovered) {
      if (recoveryData.reason === 'session_not_found') {
        throw ApiError.notFound('Session not found');
      }
      if (recoveryData.reason === 'unauthorized') {
        throw ApiError.forbidden('Access denied');
      }
      if (recoveryData.reason === 'expired') {
        throw ApiError.badRequest('Session has expired');
      }
      if (recoveryData.reason === 'already_completed') {
        throw ApiError.badRequest('Session is already completed');
      }
    }

    ApiResponse.success(res, recoveryData, 'Session recovered successfully', undefined, req);
  });
}

export const emotionalCheckInController = new EmotionalCheckInController();
export default emotionalCheckInController;

