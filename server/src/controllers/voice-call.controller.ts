import { Response } from 'express';
import { voiceCallService } from '../services/voice-call.service.js';
import { crisisDetectionService } from '../services/crisis-detection.service.js';
import { voiceSessionService } from '../services/voice-session.service.js';
import type { SessionType, CallPurpose } from '../types/voice-call.types.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { query } from '../database/pg.js';
import { logger } from '../services/logger.service.js';
import type { AuthenticatedRequest } from '../types/index.js';
import type {
  CallInitiationRequest,
  WebRTCOffer,
  RTCIceCandidate,
} from '../types/voice-call.types.js';

class VoiceCallController {
  /**
   * @route   POST /api/voice-calls/initiate
   * @desc    Initiate a new voice call
   * @access  Private
   */
  initiate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const startTime = Date.now();
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    logger.info('[VoiceCallController] Call initiation request', {
      userId,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    const { channel, pre_call_context, session_type, call_purpose } = req.body as CallInitiationRequest & {
      session_type?: SessionType;
    };

    // Validate channel
    if (!channel || !['mobile_app', 'whatsapp', 'widget'].includes(channel)) {
      logger.warn('[VoiceCallController] Invalid channel', {
        userId,
        channel,
        validChannels: ['mobile_app', 'whatsapp', 'widget'],
      });
      throw ApiError.badRequest('Invalid channel. Must be mobile_app, whatsapp, or widget');
    }

    // Validate session_type if provided
    const validSessionTypes: SessionType[] = [
      'quick_checkin',
      'coaching_session',
      'emergency_support',
      'goal_review',
      'health_coach',
      'nutrition',
      'fitness',
      'wellness',
    ];
    if (session_type && !validSessionTypes.includes(session_type)) {
      logger.warn('[VoiceCallController] Invalid session_type', {
        userId,
        session_type,
        validTypes: validSessionTypes,
      });
      throw ApiError.badRequest(
        `Invalid session_type. Must be one of: ${validSessionTypes.join(', ')}`
      );
    }

    // Validate call_purpose if provided
    const validCallPurposes: CallPurpose[] = [
      'workout',
      'nutrition',
      'meal',
      'emotion',
      'emergency',
      'sleep',
      'stress',
      'goal_review',
      'general_health',
      'fitness',
      'wellness',
      'recovery',
    ];
    if (call_purpose && !validCallPurposes.includes(call_purpose)) {
      logger.warn('[VoiceCallController] Invalid call_purpose', {
        userId,
        call_purpose,
        validPurposes: validCallPurposes,
      });
      throw ApiError.badRequest(
        `Invalid call_purpose. Must be one of: ${validCallPurposes.join(', ')}`
      );
    }

    try {
      const result = await voiceCallService.initiateCall(userId, {
        channel,
        pre_call_context,
        session_type: session_type || 'quick_checkin',
        call_purpose,
      });

      const duration = Date.now() - startTime;
      logger.info('[VoiceCallController] Call initiated successfully', {
        userId,
        callId: result.callId,
        channel,
        sessionType: session_type || 'quick_checkin',
        callPurpose: call_purpose,
        duration,
      });

      ApiResponse.created(res, result, 'Call initiated successfully');
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('[VoiceCallController] Call initiation failed', {
        error: error?.message,
        errorCode: error?.code,
        userId,
        channel,
        sessionType: session_type,
        callPurpose: call_purpose,
        duration,
      });
      throw error;
    }
  });

  /**
   * @route   GET /api/voice-calls/:callId/status
   * @desc    Get call status
   * @access  Private
   */
  getStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { callId } = req.params;
    if (!callId) {
      throw ApiError.badRequest('Call ID is required');
    }

    const status = await voiceCallService.getCallStatus(callId, userId);
    ApiResponse.success(res, status, 'Call status retrieved successfully');
  });

  /**
   * @route   POST /api/voice-calls/:callId/end
   * @desc    End a call
   * @access  Private
   */
  endCall = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { callId } = req.params;
    if (!callId) {
      throw ApiError.badRequest('Call ID is required');
    }

    const { reason } = req.body as { reason?: string };

    const summary = await voiceCallService.endCall(callId, userId, reason);
    ApiResponse.success(res, summary, 'Call ended successfully');
  });

  /**
   * @route   GET /api/voice-calls/history
   * @desc    Get call history
   * @access  Private
   */
  getHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const channel = req.query.channel as string | undefined;
    const status = req.query.status as string | undefined;

    const filters = {
      page,
      limit,
      ...(channel && { channel: channel as any }),
      ...(status && { status: status as any }),
    };

    const history = await voiceCallService.getCallHistory(userId, filters);
    ApiResponse.paginated(res, history.calls, {
      page: history.page,
      limit: history.limit,
      total: history.total,
    }, 'Call history retrieved successfully');
  });

  /**
   * @route   GET /api/voice-calls/:callId
   * @desc    Get call details
   * @access  Private
   */
  getCall = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { callId } = req.params;
    if (!callId) {
      throw ApiError.badRequest('Call ID is required');
    }

    const call = await voiceCallService.getCall(callId, userId);
    ApiResponse.success(res, call, 'Call details retrieved successfully');
  });

  /**
   * @route   POST /api/voice-calls/:callId/offer
   * @desc    Handle WebRTC offer
   * @access  Private
   */
  handleOffer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { callId } = req.params;
    if (!callId) {
      throw ApiError.badRequest('Call ID is required');
    }

    const offer = req.body as WebRTCOffer;
    if (!offer || !offer.sdp || offer.type !== 'offer') {
      throw ApiError.badRequest('Invalid WebRTC offer');
    }

    const answer = await voiceCallService.establishConnection(callId, userId, offer);
    ApiResponse.success(res, { answer }, 'Connection established successfully');
  });

  /**
   * @route   POST /api/voice-calls/:callId/ice-candidate
   * @desc    Handle ICE candidate
   * @access  Private
   */
  handleIceCandidate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { callId } = req.params;
    if (!callId) {
      throw ApiError.badRequest('Call ID is required');
    }

    const candidate = req.body as RTCIceCandidate;
    if (!candidate || !candidate.candidate) {
      throw ApiError.badRequest('Invalid ICE candidate');
    }

    await voiceCallService.handleIceCandidate(callId, userId, candidate);
    ApiResponse.success(res, { success: true }, 'ICE candidate processed successfully');
  });

  /**
   * @route   GET /api/voice-calls/:callId/ice-servers
   * @desc    Get ICE servers configuration
   * @access  Private
   */
  getIceServers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { callId } = req.params;
    if (!callId) {
      throw ApiError.badRequest('Call ID is required');
    }

    // Verify call ownership
    const call = await voiceCallService.getCall(callId, userId);

    // Return ICE servers from call record or default
    const iceServers = call.ice_servers || [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];

    ApiResponse.success(res, { iceServers }, 'ICE servers retrieved successfully');
  });

  /**
   * @route   POST /api/voice-calls/:callId/active
   * @desc    Mark call as active (connection established)
   * @access  Private
   */
  markActive = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { callId } = req.params;
    if (!callId) {
      throw ApiError.badRequest('Call ID is required');
    }

    await voiceCallService.markCallActive(callId, userId);
    ApiResponse.success(res, { success: true }, 'Call marked as active');
  });

  /**
   * @route   POST /api/voice-calls/:callId/retry
   * @desc    Retry a failed call connection
   * @access  Private
   */
  retry = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { callId } = req.params;
    if (!callId) {
      throw ApiError.badRequest('Call ID is required');
    }

    const success = await voiceCallService.retryConnection(callId, userId);
    ApiResponse.success(res, { success }, 'Call retry initiated');
  });

  /**
   * @route   POST /api/voice-calls/:callId/upgrade
   * @desc    Upgrade session type
   * @access  Private
   */
  upgrade = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { callId } = req.params;
    if (!callId) {
      throw ApiError.badRequest('Call ID is required');
    }

    const { sessionType } = req.body as { sessionType: SessionType };

    // Get conversation ID from call
    const callResult = await query<{ conversation_id: string | null }>(
      `SELECT conversation_id FROM voice_calls WHERE id = $1 AND user_id = $2`,
      [callId, userId]
    );

    if (callResult.rows.length === 0) {
      throw ApiError.notFound('Call not found');
    }

    const conversationId = callResult.rows[0].conversation_id;
    if (!conversationId) {
      throw ApiError.badRequest('Call does not have an associated conversation');
    }

    const upgradedSession = await voiceSessionService.upgradeSession(
      conversationId,
      sessionType
    );

    // Update call with new session type
    await query(
      `UPDATE voice_calls SET session_type = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [sessionType, callId]
    );

    ApiResponse.success(res, { session: upgradedSession }, 'Session upgraded successfully');
  });

  /**
   * @route   POST /api/voice-calls/:callId/emergency
   * @desc    Trigger emergency protocol
   * @access  Private
   */
  triggerEmergency = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { callId } = req.params;
    if (!callId) {
      throw ApiError.badRequest('Call ID is required');
    }

    await crisisDetectionService.triggerEmergencyProtocol(callId, userId);

    // Get crisis resources
    const resources = await crisisDetectionService.getCrisisResources();

    // Schedule follow-up check-in
    await crisisDetectionService.scheduleFollowUpCheckIn(userId, callId);

    ApiResponse.success(
      res,
      {
        emergency: true,
        resources,
        message: 'Emergency protocol activated. Resources have been provided.',
      },
      'Emergency protocol triggered successfully'
    );
  });

  /**
   * @route   GET /api/voice-calls/:callId/emotions
   * @desc    Get call emotions
   * @access  Private
   */
  getEmotions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { callId } = req.params;
    if (!callId) {
      throw ApiError.badRequest('Call ID is required');
    }

    const result = await query(
      `SELECT id, timestamp, emotion_category, confidence_score, source
       FROM emotion_logs
       WHERE call_id = $1 AND user_id = $2
       ORDER BY timestamp ASC`,
      [callId, userId]
    );

    const emotions = result.rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      category: row.emotion_category,
      confidence: row.confidence_score,
      source: row.source,
    }));

    // Get emotion summary from call if available
    const callResult = await query<{ emotion_summary: Record<string, unknown> | null }>(
      `SELECT emotion_summary FROM voice_calls WHERE id = $1 AND user_id = $2`,
      [callId, userId]
    );

    const summary = callResult.rows.length > 0 ? callResult.rows[0].emotion_summary : null;

    ApiResponse.success(res, { emotions, summary }, 'Call emotions retrieved successfully');
  });
}

export const voiceCallController = new VoiceCallController();

