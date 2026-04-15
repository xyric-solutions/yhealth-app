import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import { ApiError } from '../utils/ApiError.js';
import type {
  VoiceCall,
  CallInitiationRequest,
  CallInitiationResponse,
  CallStatusResponse,
  CallHistoryFilters,
  CallHistoryResponse,
  CallSummary,
  WebRTCOffer,
  WebRTCAnswer,
  RTCIceCandidate,
  RTCIceServer,
  VoiceCallEvent,
  SessionType,
} from '../types/voice-call.types.js';
import { vectorEmbeddingService } from './vector-embedding.service.js';
import { env } from '../config/env.config.js';

const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 2000, // 2s
  maxDelay: 10000, // 10s
  backoffMultiplier: 2,
};

// const CONNECTION_TIMEOUT = 30000; // 30 seconds (unused)

/**
 * Voice Call Service
 * Manages voice call lifecycle, WebRTC signaling, and call history
 */
class VoiceCallService {
  private schemaCache: {
    hasSessionType?: boolean;
    hasCallPurpose?: boolean;
    checkedAt?: number;
  } = {};

  /**
   * Check if a column exists in the voice_calls table
   * Uses caching to avoid repeated queries
   */
  private async checkColumnExists(columnName: string): Promise<boolean> {
    const cacheKey = `has${columnName.charAt(0).toUpperCase() + columnName.slice(1)}` as keyof typeof this.schemaCache;
    const cacheExpiry = 5 * 60 * 1000; // 5 minutes

    // Check cache
    if (
      this.schemaCache[cacheKey] !== undefined &&
      this.schemaCache.checkedAt &&
      Date.now() - this.schemaCache.checkedAt < cacheExpiry
    ) {
      return (this.schemaCache as any)[cacheKey] as boolean;
    }

    try {
      const result = await query<{ exists: boolean }>(
        `SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'voice_calls'
            AND column_name = $1
        ) as exists`,
        [columnName]
      );
      const exists = result.rows[0]?.exists || false;
      (this.schemaCache as any)[cacheKey] = exists;
      this.schemaCache.checkedAt = Date.now();
      return exists;
    } catch (error: any) {
      logger.warn('[VoiceCallService] Failed to check column existence', {
        error: error?.message,
        columnName,
      });
      // Default to false if check fails
      return false;
    }
  }

  /**
   * Initiate a new voice call
   */
  async initiateCall(
    userId: string,
    request: CallInitiationRequest
  ): Promise<CallInitiationResponse> {
    const startTime = Date.now();
    logger.info('[VoiceCallService] Initiating call', {
      userId,
      channel: request.channel,
      sessionType: request.session_type,
      callPurpose: request.call_purpose,
    });

    try {
      // Step 1: Clean up ALL stale 'initiating' calls older than 30 seconds (likely abandoned)
      // This is more aggressive to prevent blocking on old calls
      try {
        const cleanupResult = await query(
          `UPDATE voice_calls 
           SET status = 'cancelled', 
               ended_at = CURRENT_TIMESTAMP,
               error_message = 'Call abandoned - timeout'
           WHERE user_id = $1 
             AND status = 'initiating'
             AND initiated_at < NOW() - INTERVAL '30 seconds'`,
          [userId]
        );
        if (cleanupResult.rowCount && cleanupResult.rowCount > 0) {
          logger.info('[VoiceCallService] Cleaned up stale initiating calls', {
            userId,
            count: cleanupResult.rowCount,
          });
        }
      } catch (error: any) {
        logger.warn('[VoiceCallService] Failed to cleanup stale calls', {
          error: error?.message,
          userId,
        });
        // Continue - cleanup failure shouldn't block new calls
      }

      // Step 2: Check for rate limiting (only check for active/connecting calls)
      try {
        const recentCall = await query<VoiceCall>(
          `SELECT id, initiated_at 
           FROM voice_calls 
           WHERE user_id = $1 
             AND status IN ('connecting', 'active')
           ORDER BY initiated_at DESC
           LIMIT 1`,
          [userId]
        );

        if (recentCall.rows.length > 0) {
          const existingCall = recentCall.rows[0];
          const timeSinceInitiation = Math.floor(
            (Date.now() - new Date(existingCall.initiated_at).getTime()) / 1000
          );
          // Only block if the call is actually recent (within last 5 minutes)
          if (timeSinceInitiation < 300) {
            logger.warn('[VoiceCallService] Rate limit triggered - active/connecting call exists', {
              userId,
              existingCallId: existingCall.id,
              initiatedAt: existingCall.initiated_at,
              timeSinceInitiation: `${timeSinceInitiation}s`,
            });
            throw ApiError.tooManyRequests(
              `Please wait - you have an active call in progress.`
            );
          } else {
            // Old call stuck in connecting/active - cancel it
            logger.info('[VoiceCallService] Cancelling stale active/connecting call', {
              userId,
              callId: existingCall.id,
              timeSinceInitiation: `${timeSinceInitiation}s`,
            });
            await query(
              `UPDATE voice_calls SET status = 'cancelled', ended_at = CURRENT_TIMESTAMP, error_message = 'Stale call cancelled' WHERE id = $1`,
              [existingCall.id]
            );
          }
        }
      } catch (error: any) {
        if (error instanceof ApiError) {
          throw error;
        }
        logger.error('[VoiceCallService] Error checking rate limit', {
          error: error?.message,
          userId,
        });
      }

      // Step 3: Check for very recent 'initiating' calls (within last 3 seconds) to prevent rapid duplicates
      try {
        const veryRecentCall = await query<VoiceCall>(
          `SELECT id, initiated_at 
           FROM voice_calls 
           WHERE user_id = $1 
             AND status = 'initiating'
           ORDER BY initiated_at DESC
           LIMIT 1`,
          [userId]
        );

        if (veryRecentCall.rows.length > 0) {
          const existingCall = veryRecentCall.rows[0];
          const timeSinceInitiation = Math.floor(
            (Date.now() - new Date(existingCall.initiated_at).getTime()) / 1000
          );
          
          // Only block if the call is TRULY recent (within 3 seconds based on JS time)
          if (timeSinceInitiation >= 0 && timeSinceInitiation < 3) {
            logger.warn('[VoiceCallService] Rate limit triggered - very recent initiating call exists', {
              userId,
              existingCallId: existingCall.id,
              timeSinceInitiation: `${timeSinceInitiation}s`,
            });
            throw ApiError.tooManyRequests(
              `Please wait a moment before trying again.`
            );
          } else if (timeSinceInitiation >= 30) {
            // Old initiating call that wasn't cleaned up - cancel it now
            logger.info('[VoiceCallService] Cancelling stale initiating call', {
              userId,
              callId: existingCall.id,
              timeSinceInitiation: `${timeSinceInitiation}s`,
            });
            await query(
              `UPDATE voice_calls SET status = 'cancelled', ended_at = CURRENT_TIMESTAMP, error_message = 'Stale call cancelled' WHERE id = $1`,
              [existingCall.id]
            );
          }
        }
      } catch (error: any) {
        if (error instanceof ApiError) {
          throw error;
        }
        logger.error('[VoiceCallService] Error checking recent calls', {
          error: error?.message,
          userId,
        });
      }

      // Step 4: Validate and prepare call parameters
      const sessionType = request.session_type || 'quick_checkin';
      const callPurpose = request.call_purpose || null;

      // Validate sessionType matches expected enum values
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
      if (!validSessionTypes.includes(sessionType)) {
        logger.error('[VoiceCallService] Invalid session_type', {
          userId,
          sessionType,
          validTypes: validSessionTypes,
        });
        throw ApiError.badRequest(`Invalid session_type. Must be one of: ${validSessionTypes.join(', ')}`);
      }

      // Step 5: Check schema and create call record with appropriate columns
      const hasSessionType = await this.checkColumnExists('session_type');
      const hasCallPurpose = await this.checkColumnExists('call_purpose');

      logger.debug('[VoiceCallService] Schema check results', {
        userId,
        hasSessionType,
        hasCallPurpose,
        sessionType,
        callPurpose,
      });

      let callResult;
      try {
        if (hasSessionType && hasCallPurpose) {
          // Use all columns
          logger.debug('[VoiceCallService] Creating call with all columns', {
            userId,
            sessionType,
            callPurpose,
          });
          callResult = await query<VoiceCall>(
            `INSERT INTO voice_calls (user_id, channel, status, pre_call_context, session_type, call_purpose)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [userId, request.channel, 'initiating', request.pre_call_context || null, sessionType, callPurpose]
          );
        } else if (hasSessionType) {
          // Use session_type but not call_purpose
          logger.debug('[VoiceCallService] Creating call with session_type only', {
            userId,
            sessionType,
          });
          callResult = await query<VoiceCall>(
            `INSERT INTO voice_calls (user_id, channel, status, pre_call_context, session_type)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [userId, request.channel, 'initiating', request.pre_call_context || null, sessionType]
          );
        } else {
          // Use basic columns only
          logger.debug('[VoiceCallService] Creating call with basic columns only', {
            userId,
          });
          callResult = await query<VoiceCall>(
            `INSERT INTO voice_calls (user_id, channel, status, pre_call_context)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [userId, request.channel, 'initiating', request.pre_call_context || null]
          );
        }
        logger.debug('[VoiceCallService] Call record created successfully', {
          callId: callResult.rows[0].id,
          columnsUsed: hasSessionType && hasCallPurpose ? 'all' : hasSessionType ? 'session_type' : 'basic',
        });
      } catch (error: any) {
        logger.error('[VoiceCallService] Failed to create call record', {
          error: error?.message,
          errorCode: error?.code,
          errorDetail: error?.detail,
          userId,
          hasSessionType,
          hasCallPurpose,
          step: 'create_call_record',
        });
        throw error;
      }

      const call = callResult.rows[0];
      const callId = call.id;

      logger.info('[VoiceCallService] Call record created', {
        callId,
        userId,
        channel: request.channel,
        status: call.status,
      });

      // Step 6: Log call event
      try {
        await this.logCallEvent(callId, 'initiated', {
          channel: request.channel,
          pre_call_context: request.pre_call_context,
          call_purpose: callPurpose,
        });
      } catch (error: any) {
        logger.warn('[VoiceCallService] Failed to log call event', {
          error: error?.message,
          callId,
        });
        // Continue - event logging failure shouldn't block call
      }

      // Step 7: Get WebRTC configuration
      let webrtcConfig;
      try {
        webrtcConfig = await this.getWebRTCConfig(callId);
        logger.debug('[VoiceCallService] WebRTC config retrieved', {
          callId,
          signalingUrl: webrtcConfig.signalingUrl,
          iceServersCount: webrtcConfig.iceServers.length,
        });
      } catch (error: any) {
        logger.error('[VoiceCallService] Failed to get WebRTC config', {
          error: error?.message,
          callId,
        });
        // Use default config if retrieval fails
        webrtcConfig = {
          signalingUrl: `/api/voice-calls/${callId}/signaling`,
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        };
      }

      // Step 8: Update call with WebRTC session info
      try {
        await query(
          `UPDATE voice_calls 
           SET webrtc_session_id = $1, signaling_url = $2, ice_servers = $3
           WHERE id = $4`,
          [
            `session_${callId}`,
            webrtcConfig.signalingUrl,
            JSON.stringify(webrtcConfig.iceServers),
            callId,
          ]
        );
        logger.debug('[VoiceCallService] WebRTC info updated in call record', { callId });
      } catch (error: any) {
        logger.warn('[VoiceCallService] Failed to update WebRTC info', {
          error: error?.message,
          callId,
        });
        // Continue - WebRTC info update failure shouldn't block call
      }

      // Step 9: Pre-warm AI session (optional, for faster response)
      try {
        logger.debug('[VoiceCallService] Pre-warming AI session', {
          callId,
          userId,
          sessionType,
        });

        // Validate sessionType before creating conversation
        const validConversationSessionTypes = [
          'quick_checkin',
          'coaching_session',
          'emergency_support',
          'goal_review',
          'health_coach',
        ];
        const conversationSessionType = validConversationSessionTypes.includes(sessionType)
          ? sessionType
          : 'health_coach';

        const conversationId = await vectorEmbeddingService.createConversation({
          userId,
          sessionType: conversationSessionType as any,
        });

        // Update call with conversation ID (handle missing columns gracefully)
        try {
          await query(
            `UPDATE voice_calls SET session_id = $1, conversation_id = $1 WHERE id = $2`,
            [conversationId, callId]
          );
        } catch (updateError: any) {
          // If conversation_id column doesn't exist, try with session_id only
          if (updateError?.code === '42703') {
            try {
              await query(`UPDATE voice_calls SET session_id = $1 WHERE id = $2`, [
                conversationId,
                callId,
              ]);
            } catch (innerUpdateError: any) {
              // If session_id also doesn't exist, just log and continue
              logger.warn('[VoiceCallService] Could not update call with conversation ID', {
                error: innerUpdateError?.message,
                callId,
                conversationId,
              });
            }
          } else {
            throw updateError;
          }
        }

        logger.info('[VoiceCallService] AI session pre-warmed successfully', {
          callId,
          conversationId,
          sessionType: conversationSessionType,
        });
      } catch (error: any) {
        // Check if it's a table/column missing error (non-critical)
        if (error?.code === '42P01' || error?.code === '42703') {
          logger.warn('[VoiceCallService] Conversation table/column not available (non-blocking)', {
            error: error?.message,
            errorCode: error?.code,
            callId,
            userId,
            sessionType,
          });
        } else {
          logger.warn('[VoiceCallService] Failed to pre-warm AI session (non-blocking)', {
            error: error?.message,
            errorCode: error?.code,
            errorStack: error?.stack,
            callId,
            userId,
            sessionType,
          });
        }
        // Continue without pre-warming - this is optional and shouldn't block call initiation
      }

      const duration = Date.now() - startTime;
      logger.info('[VoiceCallService] Call initiated successfully', {
        callId,
        userId,
        channel: request.channel,
        duration,
      });

      return {
        callId,
        webrtcConfig,
        status: 'initiating',
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('[VoiceCallService] Error initiating call', {
        error: error?.message,
        errorCode: error?.code,
        errorStack: error?.stack,
        userId,
        channel: request.channel,
        sessionType: request.session_type,
        callPurpose: request.call_purpose,
        duration,
      });

      if (error instanceof ApiError) {
        throw error;
      }

      // Provide more specific error messages based on error type
      if (error?.code === '23503') {
        // Foreign key constraint violation
        throw ApiError.badRequest('Invalid user or related record not found');
      } else if (error?.code === '23505') {
        // Unique constraint violation
        throw ApiError.conflict('Call record already exists');
      } else if (error?.code === '23514') {
        // Check constraint violation
        throw ApiError.badRequest('Invalid call parameters');
      }

      throw ApiError.internal('Failed to initiate call');
    }
  }

  /**
   * Establish WebRTC connection (handle offer/answer exchange)
   */
  async establishConnection(
    callId: string,
    userId: string,
    offer: WebRTCOffer
  ): Promise<WebRTCAnswer> {
    try {
      // Verify call ownership
      const callResult = await query<VoiceCall>(
        `SELECT * FROM voice_calls WHERE id = $1 AND user_id = $2`,
        [callId, userId]
      );

      if (callResult.rows.length === 0) {
        throw ApiError.notFound('Call not found');
      }

      const call = callResult.rows[0];

      if (call.status === 'ended' || call.status === 'cancelled') {
        throw ApiError.badRequest('Call has already ended');
      }

      // Update status to connecting
      await query(
        `UPDATE voice_calls 
         SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        ['connecting', callId]
      );

      await this.logCallEvent(callId, 'signaling_started', {
        offer_type: offer.type,
      });

      // In a real implementation, this would:
      // 1. Process the WebRTC offer
      // 2. Generate an answer using WebRTC signaling server
      // 3. Return the answer SDP
      
      // For now, return a mock answer (will be replaced with actual WebRTC implementation)
      const answer: WebRTCAnswer = {
        sdp: 'mock-answer-sdp', // Replace with actual SDP from signaling server
        type: 'answer',
      };

      return answer;
    } catch (error) {
      logger.error('[VoiceCallService] Error establishing connection', { error, callId });
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to establish connection');
    }
  }

  /**
   * Handle ICE candidate exchange
   */
  async handleIceCandidate(
    callId: string,
    userId: string,
    candidate: RTCIceCandidate
  ): Promise<void> {
    try {
      // Verify call ownership
      const callResult = await query<VoiceCall>(
        `SELECT id FROM voice_calls WHERE id = $1 AND user_id = $2`,
        [callId, userId]
      );

      if (callResult.rows.length === 0) {
        throw ApiError.notFound('Call not found');
      }

      await this.logCallEvent(callId, 'ice_candidate_exchanged', {
        candidate: candidate.candidate,
        sdpMLineIndex: candidate.sdpMLineIndex,
        sdpMid: candidate.sdpMid,
      });
    } catch (error) {
      logger.error('[VoiceCallService] Error handling ICE candidate', { error, callId });
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to handle ICE candidate');
    }
  }

  /**
   * Update call status to active (called when connection is established)
   */
  async markCallActive(callId: string, userId: string): Promise<void> {
    try {
      const callResult = await query<VoiceCall>(
        `SELECT * FROM voice_calls WHERE id = $1 AND user_id = $2`,
        [callId, userId]
      );

      if (callResult.rows.length === 0) {
        throw ApiError.notFound('Call not found');
      }

      const call = callResult.rows[0];
      const now = new Date();
      const connectionDuration = call.connected_at
        ? Math.floor((now.getTime() - call.connected_at.getTime()) / 1000)
        : Math.floor((now.getTime() - call.initiated_at.getTime()) / 1000);

      await query(
        `UPDATE voice_calls 
         SET status = $1, 
             connected_at = COALESCE(connected_at, CURRENT_TIMESTAMP),
             connection_duration = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        ['active', connectionDuration, callId]
      );

      await this.logCallEvent(callId, 'connection_established', {
        connection_duration: connectionDuration,
      });
    } catch (error) {
      logger.error('[VoiceCallService] Error marking call active', { error, callId });
      throw error;
    }
  }

  /**
   * End a call
   */
  async endCall(callId: string, userId: string, reason?: string): Promise<CallSummary> {
    try {
      const callResult = await query<VoiceCall>(
        `SELECT * FROM voice_calls WHERE id = $1 AND user_id = $2`,
        [callId, userId]
      );

      if (callResult.rows.length === 0) {
        throw ApiError.notFound('Call not found');
      }

      const call = callResult.rows[0];

      if (call.status === 'ended') {
        // Call already ended, return existing summary
        return {
          callId,
          summary: call.call_summary || 'Call completed',
          duration: call.call_duration || 0,
        };
      }

      const now = new Date();
      const callDuration = call.connected_at
        ? Math.floor((now.getTime() - call.connected_at.getTime()) / 1000)
        : 0;

      // Generate call summary using AI
      let summary = 'Call completed';
      try {
        if (call.session_id) {
          // Get conversation summary from RAG service
          const conversation = await vectorEmbeddingService.getConversation(call.session_id, 10);
          if (conversation?.conversation) {
            // Use conversation title or generate summary from messages
            summary = conversation.conversation.title || 'Call completed';
          } else {
            // Generate summary from conversation messages
            summary = await this.generateCallSummary(callId, call.session_id);
          }
        }
      } catch (error) {
        logger.warn('[VoiceCallService] Failed to generate call summary', { error, callId });
        summary = reason || 'Call completed';
      }

      await query(
        `UPDATE voice_calls 
         SET status = $1,
             ended_at = CURRENT_TIMESTAMP,
             call_duration = $2,
             call_summary = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        ['ended', callDuration, summary, callId]
      );

      await this.logCallEvent(callId, 'call_ended', {
        duration: callDuration,
        reason: reason || 'user_ended',
      });

      return {
        callId,
        summary,
        duration: callDuration,
      };
    } catch (error) {
      logger.error('[VoiceCallService] Error ending call', { error, callId });
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to end call');
    }
  }

  /**
   * Get call status
   */
  async getCallStatus(callId: string, userId: string): Promise<CallStatusResponse> {
    try {
      const callResult = await query<VoiceCall>(
        `SELECT * FROM voice_calls WHERE id = $1 AND user_id = $2`,
        [callId, userId]
      );

      if (callResult.rows.length === 0) {
        throw ApiError.notFound('Call not found');
      }

      const call = callResult.rows[0];

      const response: CallStatusResponse = {
        status: call.status,
      };

      if (call.connection_duration !== null) {
        response.connectionDuration = call.connection_duration;
      }

      if (call.call_duration !== null) {
        response.callDuration = call.call_duration;
      }

      if (call.error_code || call.error_message) {
        response.error = {
          code: call.error_code || 'UNKNOWN_ERROR',
          message: call.error_message || 'An error occurred',
        };
      }

      return response;
    } catch (error) {
      logger.error('[VoiceCallService] Error getting call status', { error, callId });
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to get call status');
    }
  }

  /**
   * Get call history
   */
  async getCallHistory(
    userId: string,
    filters: CallHistoryFilters = {}
  ): Promise<CallHistoryResponse> {
    try {
      const page = filters.page || 1;
      const limit = Math.min(filters.limit || 20, 100);
      const offset = (page - 1) * limit;

      let whereConditions = ['user_id = $1'];
      const queryParams: (string | number | Date)[] = [userId];
      let paramIndex = 2;

      if (filters.channel) {
        whereConditions.push(`channel = $${paramIndex}`);
        queryParams.push(filters.channel);
        paramIndex++;
      }

      if (filters.status) {
        whereConditions.push(`status = $${paramIndex}`);
        queryParams.push(filters.status);
        paramIndex++;
      }

      if (filters.startDate) {
        whereConditions.push(`initiated_at >= $${paramIndex}`);
        queryParams.push(filters.startDate);
        paramIndex++;
      }

      if (filters.endDate) {
        whereConditions.push(`initiated_at <= $${paramIndex}`);
        queryParams.push(filters.endDate);
        paramIndex++;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM voice_calls ${whereClause}`,
        queryParams
      );
      const total = parseInt(countResult.rows[0].count, 10);

      // Get calls
      const callsResult = await query<VoiceCall>(
        `SELECT * FROM voice_calls 
         ${whereClause}
         ORDER BY initiated_at DESC
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...queryParams, limit, offset]
      );

      return {
        calls: callsResult.rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error('[VoiceCallService] Error getting call history', { error, userId });
      throw ApiError.internal('Failed to get call history');
    }
  }

  /**
   * Get call details
   */
  async getCall(callId: string, userId: string): Promise<VoiceCall> {
    try {
      const callResult = await query<VoiceCall>(
        `SELECT * FROM voice_calls WHERE id = $1 AND user_id = $2`,
        [callId, userId]
      );

      if (callResult.rows.length === 0) {
        throw ApiError.notFound('Call not found');
      }

      return callResult.rows[0];
    } catch (error) {
      logger.error('[VoiceCallService] Error getting call', { error, callId });
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to get call');
    }
  }

  /**
   * Retry connection for a failed call
   */
  async retryConnection(callId: string, userId: string): Promise<boolean> {
    try {
      const callResult = await query<VoiceCall>(
        `SELECT * FROM voice_calls WHERE id = $1 AND user_id = $2`,
        [callId, userId]
      );

      if (callResult.rows.length === 0) {
        throw ApiError.notFound('Call not found');
      }

      const call = callResult.rows[0];

      if (call.retry_count >= RETRY_CONFIG.maxRetries) {
        throw ApiError.badRequest('Maximum retry attempts reached');
      }

      if (call.status !== 'failed' && call.status !== 'timeout') {
        throw ApiError.badRequest('Call cannot be retried in current state');
      }

      // Reset call status and increment retry count
      await query(
        `UPDATE voice_calls 
         SET status = $1,
             retry_count = retry_count + 1,
             error_code = NULL,
             error_message = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        ['initiating', callId]
      );

      await this.logCallEvent(callId, 'initiated', {
        retry: true,
        retry_count: call.retry_count + 1,
      });

      return true;
    } catch (error) {
      logger.error('[VoiceCallService] Error retrying connection', { error, callId });
      if (error instanceof ApiError) {
        throw error;
      }
      throw ApiError.internal('Failed to retry connection');
    }
  }

  /**
   * Generate call summary using AI
   */
  private async generateCallSummary(callId: string, sessionId: string): Promise<string> {
    try {
      const conversation = await vectorEmbeddingService.getConversation(sessionId, 50);
      if (!conversation?.messages || conversation.messages.length === 0) {
        return 'Call completed - no conversation data available';
      }

      // Use AI to generate summary from conversation
      // For now, return a simple summary
      const messageCount = conversation.messages.length;
      return `Call completed with ${messageCount} messages exchanged.`;
    } catch (error) {
      logger.error('[VoiceCallService] Error generating call summary', { error, callId });
      return 'Call completed';
    }
  }

  /**
   * Get WebRTC configuration (ICE servers, signaling URL)
   */
  private async getWebRTCConfig(callId: string): Promise<{
    signalingUrl: string;
    iceServers: RTCIceServer[];
  }> {
    // Default STUN servers (public)
    const defaultIceServers: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];

    // If Twilio is configured, use Twilio TURN servers
    if (env.twilio.accountSid && env.twilio.authToken) {
      // In production, generate Twilio token for TURN servers
      // For now, use default STUN servers
      return {
        signalingUrl: `/api/voice-calls/${callId}/signaling`,
        iceServers: defaultIceServers,
      };
    }

    return {
      signalingUrl: `/api/voice-calls/${callId}/signaling`,
      iceServers: defaultIceServers,
    };
  }

  /**
   * Log call event
   */
  private async logCallEvent(
    callId: string,
    eventType: VoiceCallEvent['event_type'],
    eventData?: Record<string, unknown>
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO voice_call_events (call_id, event_type, event_data)
         VALUES ($1, $2, $3)`,
        [callId, eventType, eventData ? JSON.stringify(eventData) : null]
      );
    } catch (error) {
      logger.warn('[VoiceCallService] Failed to log call event', { error, callId, eventType });
      // Don't throw - event logging is non-critical
    }
  }

  /**
   * Mark call as failed
   */
  async markCallFailed(
    callId: string,
    errorCode: string,
    errorMessage: string
  ): Promise<void> {
    try {
      await query(
        `UPDATE voice_calls 
         SET status = $1,
             error_code = $2,
             error_message = $3,
             ended_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        ['failed', errorCode, errorMessage, callId]
      );

      await this.logCallEvent(callId, 'error_occurred', {
        error_code: errorCode,
        error_message: errorMessage,
      });
    } catch (error) {
      logger.error('[VoiceCallService] Error marking call as failed', { error, callId });
    }
  }
}

export const voiceCallService = new VoiceCallService();

