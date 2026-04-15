/**
 * @file Call Summaries Routes
 * @description API routes for call summaries and action items
 */

import { Router } from 'express';
import { callSummaryController } from '../controllers/call-summary.controller.js';
import authenticate from '../middlewares/auth.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/call-summaries
 * @desc    Get user's call summaries
 * @access  Private
 */
router.get('/', callSummaryController.getSummaries);

/**
 * @route   GET /api/call-summaries/action-items/pending
 * @desc    Get all pending action items
 * @access  Private
 */
router.get('/action-items/pending', callSummaryController.getPendingActionItems);

/**
 * @route   GET /api/call-summaries/:callId
 * @desc    Get summary for a specific call
 * @access  Private
 */
router.get('/:callId', callSummaryController.getSummaryByCallId);

/**
 * @route   POST /api/call-summaries/generate
 * @desc    Generate summary for a call
 * @access  Private
 */
router.post('/generate', callSummaryController.generateSummary);

/**
 * @route   PATCH /api/call-summaries/action-items/:actionItemId
 * @desc    Update action item status
 * @access  Private
 */
router.patch('/action-items/:actionItemId', callSummaryController.updateActionItem);

export default router;

