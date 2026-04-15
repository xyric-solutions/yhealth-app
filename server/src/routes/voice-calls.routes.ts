import { Router } from 'express';
import { voiceCallController } from '../controllers/voice-call.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { z } from 'zod';

const router = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const initiateCallSchema = z.object({
  channel: z.enum(['mobile_app', 'whatsapp', 'widget']),
  pre_call_context: z.string().max(500).optional(),
  session_type: z.enum([
    'quick_checkin',
    'coaching_session',
    'emergency_support',
    'goal_review',
    'health_coach',
    'nutrition',
    'fitness',
    'wellness',
  ]).optional(),
  call_purpose: z.enum([
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
  ]).optional(),
});

const endCallSchema = z.object({
  reason: z.string().max(200).optional(),
});

const webRTCOfferSchema = z.object({
  sdp: z.string().min(1),
  type: z.literal('offer'),
});

const iceCandidateSchema = z.object({
  candidate: z.string().min(1),
  sdpMLineIndex: z.number().nullable(),
  sdpMid: z.string().nullable(),
});

// ============================================================================
// Call Management Routes
// ============================================================================

/**
 * @route   POST /api/voice-calls/initiate
 * @desc    Initiate a new voice call
 * @access  Private
 */
router.post('/initiate', authenticate, validate(initiateCallSchema), voiceCallController.initiate);

/**
 * @route   GET /api/voice-calls/:callId/status
 * @desc    Get call status
 * @access  Private
 */
router.get('/:callId/status', authenticate, voiceCallController.getStatus);

/**
 * @route   POST /api/voice-calls/:callId/end
 * @desc    End a call
 * @access  Private
 */
router.post('/:callId/end', authenticate, validate(endCallSchema), voiceCallController.endCall);

/**
 * @route   GET /api/voice-calls/history
 * @desc    Get call history
 * @access  Private
 */
router.get('/history', authenticate, voiceCallController.getHistory);

/**
 * @route   GET /api/voice-calls/:callId
 * @desc    Get call details
 * @access  Private
 */
router.get('/:callId', authenticate, voiceCallController.getCall);

/**
 * @route   POST /api/voice-calls/:callId/retry
 * @desc    Retry a failed call connection
 * @access  Private
 */
router.post('/:callId/retry', authenticate, voiceCallController.retry);

// ============================================================================
// WebRTC Signaling Routes
// ============================================================================

/**
 * @route   POST /api/voice-calls/:callId/offer
 * @desc    Handle WebRTC offer
 * @access  Private
 */
router.post('/:callId/offer', authenticate, validate(webRTCOfferSchema), voiceCallController.handleOffer);

/**
 * @route   POST /api/voice-calls/:callId/ice-candidate
 * @desc    Handle ICE candidate
 * @access  Private
 */
router.post('/:callId/ice-candidate', authenticate, validate(iceCandidateSchema), voiceCallController.handleIceCandidate);

/**
 * @route   GET /api/voice-calls/:callId/ice-servers
 * @desc    Get ICE servers configuration
 * @access  Private
 */
router.get('/:callId/ice-servers', authenticate, voiceCallController.getIceServers);

/**
 * @route   POST /api/voice-calls/:callId/active
 * @desc    Mark call as active (connection established)
 * @access  Private
 */
router.post('/:callId/active', authenticate, voiceCallController.markActive);

/**
 * @route   POST /api/voice-calls/:callId/upgrade
 * @desc    Upgrade session type
 * @access  Private
 */
router.post(
  '/:callId/upgrade',
  authenticate,
  validate(z.object({
    sessionType: z.enum([
      'quick_checkin',
      'coaching_session',
      'emergency_support',
      'goal_review',
      'health_coach',
      'nutrition',
      'fitness',
      'wellness',
    ]),
  })),
  voiceCallController.upgrade
);

/**
 * @route   POST /api/voice-calls/:callId/emergency
 * @desc    Trigger emergency protocol
 * @access  Private
 */
router.post('/:callId/emergency', authenticate, voiceCallController.triggerEmergency);

/**
 * @route   GET /api/voice-calls/:callId/emotions
 * @desc    Get call emotions
 * @access  Private
 */
router.get('/:callId/emotions', authenticate, voiceCallController.getEmotions);

export default router;

