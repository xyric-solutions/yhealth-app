import { Router } from 'express';
import { stressController } from '../controllers/stress.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createStressLogSchema,
  getLogsQuerySchema,
  getSummaryQuerySchema,
} from '../validators/stress.validator.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   POST /v1/wellbeing/stress/logs
 * @desc    Create a new stress log
 * @access  Private
 */
router.post(
  '/logs',
  validate(createStressLogSchema),
  stressController.createLog
);

/**
 * @route   GET /v1/wellbeing/stress/logs
 * @desc    Get stress logs with optional date range filter
 * @access  Private
 */
router.get(
  '/logs',
  validate(getLogsQuerySchema, 'query'),
  stressController.getLogs
);

/**
 * @route   GET /v1/wellbeing/stress/summary
 * @desc    Get stress summary (daily rollup) for a date range
 * @access  Private
 */
router.get(
  '/summary',
  validate(getSummaryQuerySchema, 'query'),
  stressController.getSummary
);

/**
 * @route   GET /v1/wellbeing/stress/extreme-status
 * @desc    Check for extreme stress streak (crisis escalation)
 * @access  Private
 */
router.get(
  '/extreme-status',
  stressController.getExtremeStressStatus
);

/**
 * @route   GET /v1/wellbeing/stress/patterns
 * @desc    Get multi-signal stress patterns (F7.5)
 * @access  Private
 */
router.get(
  '/patterns',
  stressController.getMultiSignalPatterns
);

/**
 * @route   GET /v1/wellbeing/stress/alerts
 * @desc    Get proactive stress alerts (F7.5)
 * @access  Private
 */
router.get(
  '/alerts',
  stressController.getStressAlerts
);

export default router;

