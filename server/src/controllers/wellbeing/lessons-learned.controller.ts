/**
 * @file Lessons Learned Controller
 * @description API endpoints for AI-extracted and user-entered lessons
 */

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../types/index.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { lessonsLearnedService } from '../../services/wellbeing/lessons-learned.service.js';

class LessonsLearnedController {
  /**
   * @route   GET /api/v1/journal/lessons
   * @desc    Get paginated lessons (filterable by domain, confirmed status)
   * @access  Private
   */
  getLessons = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const domain = req.query.domain as string | undefined;
    const confirmed = req.query.confirmed !== undefined
      ? req.query.confirmed === 'true'
      : undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await lessonsLearnedService.getLessons(userId, {
      domain: domain as any,
      confirmed,
      page,
      limit,
    });

    ApiResponse.success(res, result, 'Lessons retrieved', undefined, req);
  });

  /**
   * @route   POST /api/v1/journal/lessons/:id/confirm
   * @desc    Confirm an AI-extracted lesson
   * @access  Private
   */
  confirmLesson = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const lesson = await lessonsLearnedService.confirmLesson(userId, req.params.id);

    ApiResponse.success(res, { lesson }, 'Lesson confirmed', undefined, req);
  });

  /**
   * @route   POST /api/v1/journal/lessons/:id/dismiss
   * @desc    Dismiss a lesson
   * @access  Private
   */
  dismissLesson = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    await lessonsLearnedService.dismissLesson(userId, req.params.id);

    ApiResponse.success(res, {}, 'Lesson dismissed', undefined, req);
  });

  /**
   * @route   GET /api/v1/journal/lessons/reminders
   * @desc    Get lessons due for reminder (confirmed, >2 weeks old)
   * @access  Private
   */
  getReminders = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const lessons = await lessonsLearnedService.getLessonsForReminder(userId);

    ApiResponse.success(res, { lessons }, 'Lesson reminders retrieved', undefined, req);
  });

  /**
   * @route   POST /api/v1/journal/lessons/:id/reminded
   * @desc    Mark a lesson as reminded (still relevant)
   * @access  Private
   */
  markReminded = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    await lessonsLearnedService.markReminded(userId, req.params.id);

    ApiResponse.success(res, {}, 'Lesson marked as reminded', undefined, req);
  });

  /**
   * @route   GET /api/v1/journal/lessons/search
   * @desc    Search lessons by text
   * @access  Private
   */
  searchLessons = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const q = req.query.q as string;
    if (!q || q.trim().length === 0) {
      throw ApiError.badRequest('Search query (q) is required');
    }

    const lessons = await lessonsLearnedService.searchLessons(userId, q.trim());

    ApiResponse.success(res, { lessons }, 'Search results retrieved', undefined, req);
  });
}

export const lessonsLearnedController = new LessonsLearnedController();
export default lessonsLearnedController;
