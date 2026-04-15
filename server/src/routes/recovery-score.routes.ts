import { Router } from 'express';
import { mentalRecoveryController } from '../controllers/mental-recovery.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { z } from 'zod';

const router = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const updateEmotionWeightSchema = z.object({
  weight: z.number().min(0).max(1),
});

// ============================================================================
// Recovery Score Routes
// ============================================================================

/**
 * @route   GET /api/recovery-score
 * @desc    Get current recovery score
 * @access  Private
 */
router.get('/', authenticate, mentalRecoveryController.getCurrent);

/**
 * @route   GET /api/recovery-score/trends
 * @desc    Get recovery score trends
 * @access  Private
 */
router.get('/trends', authenticate, mentalRecoveryController.getTrends);

/**
 * @route   GET /api/recovery-score/history
 * @desc    Get historical scores
 * @access  Private
 */
router.get('/history', authenticate, mentalRecoveryController.getHistory);

/**
 * @route   PATCH /api/recovery-score/emotion-weight
 * @desc    Update emotion weight for recovery score calculation
 * @access  Private
 */
router.patch('/emotion-weight', authenticate, validate(updateEmotionWeightSchema), mentalRecoveryController.updateEmotionWeight);

export default router;

