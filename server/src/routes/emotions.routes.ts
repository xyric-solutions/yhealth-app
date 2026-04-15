import { Router } from 'express';
import { emotionDataController } from '../controllers/emotion-data.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { z } from 'zod';

const router = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const updatePreferencesSchema = z.object({
  emotionLoggingEnabled: z.boolean().optional(),
  emotionDataRetentionDays: z.number().min(30).max(2555).optional(),
});

// ============================================================================
// Emotion Logs Routes
// ============================================================================

/**
 * @route   GET /api/emotions/logs
 * @desc    Get user's emotion logs (with privacy controls)
 * @access  Private
 */
router.get('/logs', authenticate, emotionDataController.getLogs);

/**
 * @route   DELETE /api/emotions/logs/:id
 * @desc    Delete specific emotion log
 * @access  Private
 */
router.delete('/logs/:id', authenticate, emotionDataController.deleteLog);

/**
 * @route   DELETE /api/emotions/logs
 * @desc    Delete all emotion logs
 * @access  Private
 */
router.delete('/logs', authenticate, emotionDataController.deleteAllLogs);

// ============================================================================
// Emotion Trends Routes
// ============================================================================

/**
 * @route   GET /api/emotions/trends
 * @desc    Get emotion trends
 * @access  Private
 */
router.get('/trends', authenticate, emotionDataController.getTrends);

// ============================================================================
// Emotion Preferences Routes
// ============================================================================

/**
 * @route   GET /api/emotions/preferences
 * @desc    Get emotion logging preferences
 * @access  Private
 */
router.get('/preferences', authenticate, emotionDataController.getPreferences);

/**
 * @route   PATCH /api/emotions/preferences
 * @desc    Update emotion logging preferences
 * @access  Private
 */
router.patch('/preferences', authenticate, validate(updatePreferencesSchema), emotionDataController.updatePreferences);

export default router;

