/**
 * @file Voice Journal Controller
 * @description API endpoints for voice journaling sessions
 */

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../types/index.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { voiceJournalService } from '../../services/wellbeing/voice-journal.service.js';
import type { FileRequest } from '../../middlewares/upload.middleware.js';

class VoiceJournalController {
  /**
   * @route   POST /api/v1/journal/voice/start
   * @desc    Start a new voice journaling session
   */
  startSession = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const session = await voiceJournalService.startSession(userId);
    ApiResponse.success(res, { session }, 'Voice journal session started', 201, req);
  });

  /**
   * @route   GET /api/v1/journal/voice/active
   * @desc    Get active voice journal session
   */
  getActiveSession = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const session = await voiceJournalService.getActiveSession(userId);
    ApiResponse.success(res, { session }, session ? 'Active session found' : 'No active session', undefined, req);
  });

  /**
   * @route   POST /api/v1/journal/voice/:sessionId/turn
   * @desc    Submit a voice turn (multipart audio upload)
   */
  submitVoiceTurn = asyncHandler(async (req: FileRequest & AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { sessionId } = req.params;
    if (!sessionId) throw ApiError.badRequest('Session ID required');

    if (!req.file) {
      throw ApiError.badRequest('Audio file required');
    }

    const result = await voiceJournalService.processVoiceTurn(
      userId,
      sessionId,
      req.file.buffer
    );

    ApiResponse.success(res, result, 'Voice turn processed', undefined, req);
  });

  /**
   * @route   POST /api/v1/journal/voice/:sessionId/text-turn
   * @desc    Submit a text turn (fallback for no mic)
   */
  submitTextTurn = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { sessionId } = req.params;
    if (!sessionId) throw ApiError.badRequest('Session ID required');

    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      throw ApiError.badRequest('Text is required');
    }

    const result = await voiceJournalService.processTextTurn(userId, sessionId, text);
    ApiResponse.success(res, result, 'Text turn processed', undefined, req);
  });

  /**
   * @route   POST /api/v1/journal/voice/:sessionId/summarize
   * @desc    Generate summary from conversation
   */
  generateSummary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { sessionId } = req.params;
    if (!sessionId) throw ApiError.badRequest('Session ID required');

    const summary = await voiceJournalService.generateSummary(userId, sessionId);
    ApiResponse.success(res, { summary }, 'Summary generated', undefined, req);
  });

  /**
   * @route   POST /api/v1/journal/voice/:sessionId/approve
   * @desc    Approve summary and create journal entry
   */
  approveAndSave = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { sessionId } = req.params;
    if (!sessionId) throw ApiError.badRequest('Session ID required');

    const { editedText } = req.body;
    const result = await voiceJournalService.approveAndSave(userId, sessionId, editedText);
    ApiResponse.success(res, result, 'Journal entry created', 201, req);
  });

  /**
   * @route   POST /api/v1/journal/voice/:sessionId/abandon
   * @desc    Abandon a voice journal session
   */
  abandonSession = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { sessionId } = req.params;
    if (!sessionId) throw ApiError.badRequest('Session ID required');

    await voiceJournalService.abandonSession(userId, sessionId);
    ApiResponse.success(res, {}, 'Session abandoned', undefined, req);
  });
}

export const voiceJournalController = new VoiceJournalController();
