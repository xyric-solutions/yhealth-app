/**
 * @file Yoga Controller
 * @description API endpoints for yoga & meditation module (F7.9)
 */

import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../types/index.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { yogaService } from '../../services/wellbeing/yoga.service.js';
import { yogaCoachService } from '../../services/yoga-coach.service.js';
import {
  listPosesSchema,
  getSessionsSchema,
  startSessionSchema,
  updateSessionLogSchema,
  completeSessionSchema,
  startMeditationSchema,
  historySchema,
} from '../../validators/yoga.validator.js';
import { analyseCoachSchema } from '../../validators/yoga-coach.validator.js';

class YogaController {
  // ============================================
  // POSE LIBRARY
  // ============================================

  /**
   * @route   GET /api/v1/wellbeing/yoga/poses
   * @desc    List/filter yoga poses
   * @access  Public (optional auth)
   */
  listPoses = asyncHandler(async (req: Request, res: Response) => {
    const filter = listPosesSchema.parse(req.query);

    const result = await yogaService.listPoses({
      ...filter,
      isRecovery: filter.isRecovery === 'true' ? true : filter.isRecovery === 'false' ? false : undefined,
    });

    ApiResponse.success(res, result, { message: 'Poses retrieved successfully' }, undefined, req);
  });

  /**
   * @route   GET /api/v1/wellbeing/yoga/poses/:slug
   * @desc    Get single pose detail
   * @access  Public (optional auth)
   */
  getPoseBySlug = asyncHandler(async (req: Request, res: Response) => {
    const { slug } = req.params;

    if (!slug) {
      throw ApiError.badRequest('Pose slug is required');
    }

    const pose = await yogaService.getPoseBySlug(slug);

    ApiResponse.success(res, { pose }, { message: 'Pose retrieved successfully' }, undefined, req);
  });

  // ============================================
  // SESSIONS
  // ============================================

  /**
   * @route   GET /api/v1/wellbeing/yoga/sessions/templates
   * @desc    Get system template sessions
   * @access  Public (optional auth)
   */
  getTemplates = asyncHandler(async (req: Request, res: Response) => {
    const templates = await yogaService.getTemplates();

    ApiResponse.success(res, { sessions: templates }, { message: 'Templates retrieved successfully' }, undefined, req);
  });

  /**
   * @route   GET /api/v1/wellbeing/yoga/sessions
   * @desc    Get user's saved sessions
   * @access  Private
   */
  getUserSessions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const filter = getSessionsSchema.parse(req.query);
    const sessions = await yogaService.getUserSessions(userId, filter);

    ApiResponse.success(res, { sessions }, { message: 'Sessions retrieved successfully' }, undefined, req);
  });

  /**
   * @route   GET /api/v1/wellbeing/yoga/sessions/:id
   * @desc    Get session detail with phases
   * @access  Private
   */
  getSessionById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (!id) throw ApiError.badRequest('Session ID is required');

    const session = await yogaService.getSessionById(id, userId || undefined);

    ApiResponse.success(res, { session }, { message: 'Session retrieved successfully' }, undefined, req);
  });

  /**
   * @route   DELETE /api/v1/wellbeing/yoga/sessions/:id
   * @desc    Delete user session
   * @access  Private
   */
  deleteSession = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { id } = req.params;
    if (!id) throw ApiError.badRequest('Session ID is required');

    await yogaService.deleteSession(id, userId);

    ApiResponse.success(res, null, { message: 'Session deleted successfully' }, undefined, req);
  });

  // ============================================
  // AI COACH SESSION LOGS
  // ============================================

  /**
   * @route   POST /api/v1/wellbeing/yoga/coach/session/start
   * @desc    Start AI Coach pose practice session (no template needed)
   * @access  Private
   */
  startAICoachSession = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { poseSlug, poseName } = req.body;
    if (!poseSlug || !poseName) throw ApiError.badRequest('poseSlug and poseName are required');

    const log = await yogaService.startAICoachSession(userId, poseSlug, poseName);

    ApiResponse.success(res, { log }, { message: 'AI Coach session started', statusCode: 201 }, undefined, req);
  });

  /**
   * @route   POST /api/v1/wellbeing/yoga/coach/session/:logId/complete
   * @desc    Complete AI Coach session with score and duration
   * @access  Private
   */
  completeAICoachSession = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { logId } = req.params;
    if (!logId) throw ApiError.badRequest('Log ID is required');

    const { durationSeconds, averageScore, poseName } = req.body;

    const log = await yogaService.completeAICoachSession(logId, userId, {
      durationSeconds: durationSeconds || 0,
      averageScore: averageScore || 0,
      poseName: poseName || '',
    });

    ApiResponse.success(res, { log }, { message: 'AI Coach session completed' }, undefined, req);
  });

  // ============================================
  // SESSION LOGS
  // ============================================

  /**
   * @route   POST /api/v1/wellbeing/yoga/sessions/:id/start
   * @desc    Start a session, creates log entry
   * @access  Private
   */
  startSession = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { id } = req.params;
    const body = startSessionSchema.parse({ ...req.body, sessionId: id });

    const log = await yogaService.startSession(userId, body);

    ApiResponse.success(res, { log }, { message: 'Session started', statusCode: 201 }, undefined, req);
  });

  /**
   * @route   PATCH /api/v1/wellbeing/yoga/sessions/logs/:logId
   * @desc    Update in-progress session
   * @access  Private
   */
  updateSessionLog = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { logId } = req.params;
    if (!logId) throw ApiError.badRequest('Log ID is required');

    const body = updateSessionLogSchema.parse(req.body);
    const log = await yogaService.updateSessionLog(logId, userId, body);

    ApiResponse.success(res, { log }, { message: 'Session log updated' }, undefined, req);
  });

  /**
   * @route   POST /api/v1/wellbeing/yoga/sessions/logs/:logId/complete
   * @desc    Complete session with feedback
   * @access  Private
   */
  completeSession = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { logId } = req.params;
    if (!logId) throw ApiError.badRequest('Log ID is required');

    const body = completeSessionSchema.parse(req.body);
    const log = await yogaService.completeSession(logId, userId, body);

    ApiResponse.success(res, { log }, { message: 'Session completed' }, undefined, req);
  });

  // ============================================
  // MEDITATION TIMERS
  // ============================================

  /**
   * @route   POST /api/v1/wellbeing/yoga/meditation/start
   * @desc    Start meditation timer
   * @access  Private
   */
  startMeditation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const body = startMeditationSchema.parse(req.body);
    const timer = await yogaService.startMeditation(userId, body);

    ApiResponse.success(res, { timer }, { message: 'Meditation started', statusCode: 201 }, undefined, req);
  });

  /**
   * @route   POST /api/v1/wellbeing/yoga/meditation/:id/complete
   * @desc    Complete meditation timer
   * @access  Private
   */
  completeMeditation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { id } = req.params;
    if (!id) throw ApiError.badRequest('Timer ID is required');

    const timer = await yogaService.completeMeditation(id, userId);

    ApiResponse.success(res, { timer }, { message: 'Meditation completed' }, undefined, req);
  });

  // ============================================
  // HISTORY & PROGRESS
  // ============================================

  /**
   * @route   GET /api/v1/wellbeing/yoga/history
   * @desc    Get session history (paginated)
   * @access  Private
   */
  getHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const filter = historySchema.parse(req.query);
    const result = await yogaService.getHistory(userId, filter);

    ApiResponse.success(res, result, { message: 'History retrieved successfully' }, undefined, req);
  });

  /**
   * @route   GET /api/v1/wellbeing/yoga/stats
   * @desc    Get streak, total time, heatmap data
   * @access  Private
   */
  getStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const stats = await yogaService.getStats(userId);

    ApiResponse.success(res, { stats }, { message: 'Stats retrieved successfully' }, undefined, req);
  });

  /**
   * @route   GET /api/v1/wellbeing/yoga/streak
   * @desc    Get current streak
   * @access  Private
   */
  getStreak = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const streak = await yogaService.getStreak(userId);

    ApiResponse.success(res, { streak }, { message: 'Streak retrieved successfully' }, undefined, req);
  });

  // ============================================
  // AI POSE COACHING
  // ============================================

  /**
   * @route   POST /api/v1/wellbeing/yoga/coach
   * @desc    Analyse pose via Gemini Vision and return coaching feedback
   * @access  Private
   */
  analysePose = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const body = analyseCoachSchema.parse(req.body);

    // Fetch pose for name + joint targets
    const pose = await yogaService.getPoseBySlug(body.poseSlug);

    const result = await yogaCoachService.analysePose({
      poseSlug: body.poseSlug,
      poseName: pose.englishName,
      frameBase64: body.frameBase64,
      currentAngles: body.currentAngles,
      poseTargets: pose.jointTargets || null,
      elapsedSeconds: body.elapsedSeconds,
    });

    ApiResponse.success(res, result, { message: 'Pose analysed successfully' }, undefined, req);
  });
}

export const yogaController = new YogaController();
