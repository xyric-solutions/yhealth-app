import { Router } from 'express';
import { activityStatusController } from '../controllers/activity-status.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createRateLimiter } from '../middlewares/rateLimiter.middleware.js';
import { z } from 'zod';

const router = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const updateCurrentStatusSchema = z.object({
  status: z.enum(['working', 'sick', 'injury', 'rest', 'vacation', 'travel', 'stress', 'excellent', 'good', 'fair', 'poor']),
});

const setStatusForDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  status: z.enum(['working', 'sick', 'injury', 'rest', 'vacation', 'travel', 'stress', 'excellent', 'good', 'fair', 'poor']),
  mood: z.number().min(1).max(5).optional(),
  notes: z.string().max(1000).optional(),
});

// ============================================================================
// Routes
// ============================================================================

/**
 * @route   GET /api/activity-status/current
 * @desc    Get user's current activity status
 * @access  Private
 */
router.get(
  '/current',
  authenticate,
  createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute per user (allows polling every 2 seconds)
    keyGenerator: 'user',
  }),
  activityStatusController.getCurrent
);

/**
 * @route   PUT /api/activity-status/current
 * @desc    Update user's current activity status
 * @access  Private
 */
router.put('/current', authenticate, validate(updateCurrentStatusSchema), activityStatusController.updateCurrent);

/**
 * @route   GET /api/activity-status/history
 * @desc    Get status history for date range
 * @access  Private
 */
router.get('/history', authenticate, activityStatusController.getHistory);

/**
 * @route   POST /api/activity-status/date
 * @desc    Set status for a specific date
 * @access  Private
 */
router.post('/date', authenticate, validate(setStatusForDateSchema), activityStatusController.setStatusForDate);

/**
 * @route   GET /api/activity-status/calendar
 * @desc    Get calendar data for a month
 * @access  Private
 */
router.get('/calendar', authenticate, activityStatusController.getCalendar);

/**
 * @route   GET /api/activity-status/stats
 * @desc    Get status statistics
 * @access  Private
 */
router.get('/stats', authenticate, activityStatusController.getStats);

/**
 * @route   GET /api/activity-status/enhanced-current
 * @desc    Get enhanced current status with duration, overrides, and 7-day summary
 * @access  Private
 */
router.get('/enhanced-current', authenticate, activityStatusController.getEnhancedCurrent);

/**
 * @route   GET /api/activity-status/date/:date
 * @desc    Get status for a specific date
 * @access  Private
 */
router.get('/date/:date', authenticate, activityStatusController.getStatusForDate);

/**
 * @route   DELETE /api/activity-status/date/:date
 * @desc    Delete status for a specific date
 * @access  Private
 */
router.delete('/date/:date', authenticate, activityStatusController.deleteStatusForDate);

export default router;

