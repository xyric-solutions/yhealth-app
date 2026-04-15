/**
 * @file Call Summary Controller
 * @description Handles call summary API endpoints
 */

import { Response } from 'express';
import { callSummaryService } from '../services/call-summary.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import type { AuthenticatedRequest } from '../types/index.js';

class CallSummaryController {
  /**
   * @route   GET /api/call-summaries
   * @desc    Get user's call summaries
   * @access  Private
   */
  getSummaries = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await callSummaryService.getSummariesForUser(userId, { page, limit });

    ApiResponse.success(
      res,
      {
        summaries: result.summaries,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      },
      'Call summaries retrieved successfully'
    );
  });

  /**
   * @route   GET /api/call-summaries/:callId
   * @desc    Get summary for a specific call
   * @access  Private
   */
  getSummaryByCallId = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { callId } = req.params;

    const summary = await callSummaryService.getSummaryByCallId(callId);

    if (!summary) {
      throw ApiError.notFound('Summary not found');
    }

    // Verify ownership
    if (summary.userId !== userId) {
      throw ApiError.forbidden('Access denied');
    }

    ApiResponse.success(res, summary, 'Call summary retrieved successfully');
  });

  /**
   * @route   POST /api/call-summaries/generate
   * @desc    Generate summary for a call (usually called automatically)
   * @access  Private
   */
  generateSummary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { callId, sessionType, depthMode, conversationId, duration } = req.body as {
      callId: string;
      sessionType: string;
      depthMode?: 'light' | 'deep';
      conversationId?: string;
      duration: number;
    };

    if (!callId || !sessionType || duration === undefined) {
      throw ApiError.badRequest('callId, sessionType, and duration are required');
    }

    const summary = await callSummaryService.generateSummary({
      callId,
      userId,
      sessionType: sessionType as any,
      depthMode,
      conversationId,
      duration,
    });

    ApiResponse.success(res, summary, 'Summary generated successfully', 201);
  });

  /**
   * @route   PATCH /api/call-summaries/action-items/:actionItemId
   * @desc    Update action item status
   * @access  Private
   */
  updateActionItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { actionItemId } = req.params;
    const { status } = req.body as { status: string };

    if (!status || !['pending', 'in_progress', 'completed', 'dismissed'].includes(status)) {
      throw ApiError.badRequest('Valid status is required');
    }

    const actionItem = await callSummaryService.updateActionItemStatus(
      actionItemId,
      userId,
      status as any
    );

    if (!actionItem) {
      throw ApiError.notFound('Action item not found');
    }

    ApiResponse.success(res, actionItem, 'Action item updated successfully');
  });

  /**
   * @route   GET /api/call-summaries/action-items/pending
   * @desc    Get all pending action items for user
   * @access  Private
   */
  getPendingActionItems = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    // Get all summaries and collect pending action items
    const { summaries } = await callSummaryService.getSummariesForUser(userId, { limit: 50 });
    
    const pendingItems = summaries
      .flatMap(s => s.actionItems)
      .filter(item => item.status === 'pending' || item.status === 'in_progress')
      .sort((a, b) => {
        // Sort by priority (high first) then by due date
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        return a.dueDate ? -1 : 1;
      });

    ApiResponse.success(res, { actionItems: pendingItems }, 'Pending action items retrieved');
  });
}

export const callSummaryController = new CallSummaryController();

