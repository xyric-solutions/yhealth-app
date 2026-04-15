/**
 * @file Emotional Check-In Routes
 * @description API routes for emotional check-in screening sessions
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { emotionalCheckInController } from '../controllers/emotional-checkin.controller.js';
import { createUploadMiddleware } from '../middlewares/upload.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// EMOTIONAL CHECK-IN SESSIONS
// ============================================

/**
 * @route   POST /api/v1/wellbeing/emotional-checkin/start
 * @desc    Start new emotional check-in session
 * @access  Private
 */
router.post('/start', emotionalCheckInController.startCheckIn);

/**
 * @route   POST /api/v1/wellbeing/emotional-checkin/:sessionId/respond
 * @desc    Submit response to check-in question
 * @access  Private
 */
router.post('/:sessionId/respond', emotionalCheckInController.submitResponse);

/**
 * @route   GET /api/v1/wellbeing/emotional-checkin/:sessionId
 * @desc    Get check-in session status
 * @access  Private
 */
router.get('/:sessionId', emotionalCheckInController.getSession);

/**
 * @route   POST /api/v1/wellbeing/emotional-checkin/:sessionId/complete
 * @desc    Complete check-in session and get results
 * @access  Private
 */
router.post('/:sessionId/complete', emotionalCheckInController.completeSession);

/**
 * @route   GET /api/v1/wellbeing/emotional-checkin/history
 * @desc    Get past check-in sessions
 * @access  Private
 */
router.get('/history', emotionalCheckInController.getHistory);

/**
 * @route   GET /api/v1/wellbeing/emotional-checkin/trends
 * @desc    Get trend analysis
 * @access  Private
 */
router.get('/trends', emotionalCheckInController.getTrends);

/**
 * @route   POST /api/v1/wellbeing/emotional-checkin/:sessionId/analyze-camera
 * @desc    Analyze camera image for emotional check-in (legacy - server-side OpenAI)
 * @access  Private
 */
router.post(
  '/:sessionId/analyze-camera',
  createUploadMiddleware('image', 'image'),
  emotionalCheckInController.analyzeCameraImage
);

/**
 * @route   POST /api/v1/wellbeing/emotional-checkin/:sessionId/tensorflow-analysis
 * @desc    Process TensorFlow.js emotion analysis results (on-device processing)
 * @access  Private
 */
router.post('/:sessionId/tensorflow-analysis', emotionalCheckInController.processTensorFlowAnalysis);

/**
 * @route   GET /api/v1/wellbeing/emotional-checkin/enhanced-trends
 * @desc    Get enhanced trend analysis (7/30/90 day windows with pattern detection)
 * @access  Private
 */
router.get('/enhanced-trends', emotionalCheckInController.getEnhancedTrends);

/**
 * @route   GET /api/v1/wellbeing/emotional-checkin/incomplete
 * @desc    Get incomplete sessions that can be recovered
 * @access  Private
 */
router.get('/incomplete', emotionalCheckInController.getIncompleteSessions);

/**
 * @route   POST /api/v1/wellbeing/emotional-checkin/:sessionId/recover
 * @desc    Recover an incomplete session
 * @access  Private
 */
router.post('/:sessionId/recover', emotionalCheckInController.recoverSession);

export default router;

