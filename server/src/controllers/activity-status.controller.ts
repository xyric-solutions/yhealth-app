import { Response } from 'express';
import { activityStatusService } from '../services/activity-status.service.js';
import { statusPlanAdjusterService } from '../services/status-plan-adjuster.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import type { AuthenticatedRequest } from '../types/index.js';
import type { ActivityStatus, SetStatusRequest } from '../types/activity-status.types.js';

class ActivityStatusController {
  /**
   * @route   GET /api/activity-status/current
   * @desc    Get user's current activity status
   * @access  Private
   */
  getCurrent = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    // Check cache first (10 second TTL for current status)
    const { cache } = await import('../services/cache.service.js');
    const cacheKey = `activity-status:current:${userId}`;
    const cached = cache.get<Awaited<ReturnType<typeof activityStatusService.getCurrentStatus>>>(cacheKey);
    
    if (cached) {
      ApiResponse.success(res, cached, 'Current status retrieved successfully');
      return;
    }

    const status = await activityStatusService.getCurrentStatus(userId);
    
    // Cache the response for 10 seconds
    cache.set(cacheKey, status, 10);
    
    ApiResponse.success(res, status, 'Current status retrieved successfully');
  });

  /**
   * @route   PUT /api/activity-status/current
   * @desc    Update user's current activity status
   * @access  Private
   */
  updateCurrent = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { status } = req.body as { status: ActivityStatus };
    if (!status || !['working', 'sick', 'injury', 'rest', 'vacation', 'travel', 'stress', 'excellent', 'good', 'fair', 'poor'].includes(status)) {
      throw ApiError.badRequest('Invalid activity status');
    }

    const result = await activityStatusService.updateCurrentStatus(userId, status);
    ApiResponse.success(res, result, 'Current status updated successfully');
  });

  /**
   * @route   GET /api/activity-status/history
   * @desc    Get status history for date range
   * @access  Private
   */
  getHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const startDateStr = req.query.startDate as string;
    const endDateStr = req.query.endDate as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    if (!startDateStr || !endDateStr) {
      throw ApiError.badRequest('startDate and endDate are required');
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw ApiError.badRequest('Invalid date format');
    }

    const history = await activityStatusService.getStatusHistory(userId, startDate, endDate, page, limit);
    ApiResponse.paginated(res, history.statuses, {
      page,
      limit,
      total: history.total,
    }, 'Status history retrieved successfully');
  });

  /**
   * @route   POST /api/activity-status/date
   * @desc    Set status for a specific date
   * @access  Private
   */
  setStatusForDate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { date, status, mood, notes } = req.body as SetStatusRequest;

    if (!date || !status) {
      throw ApiError.badRequest('Date and status are required');
    }

    if (!['working', 'sick', 'injury', 'rest', 'vacation', 'travel', 'stress', 'excellent', 'good', 'fair', 'poor'].includes(status)) {
      throw ApiError.badRequest('Invalid activity status');
    }

    const result = await activityStatusService.setStatusForDate(userId, date, status, mood, notes);
    ApiResponse.created(res, result, 'Status set successfully');
  });

  /**
   * @route   GET /api/activity-status/calendar
   * @desc    Get calendar data for a month
   * @access  Private
   */
  getCalendar = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;

    if (month < 1 || month > 12) {
      throw ApiError.badRequest('Month must be between 1 and 12');
    }

    const calendar = await activityStatusService.getStatusForMonth(userId, year, month);
    ApiResponse.success(res, calendar, 'Calendar data retrieved successfully');
  });

  /**
   * @route   GET /api/activity-status/stats
   * @desc    Get status statistics
   * @access  Private
   */
  getStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const startDateStr = req.query.startDate as string;
    const endDateStr = req.query.endDate as string;

    // Default to last 30 days if not provided
    const endDate = endDateStr ? new Date(endDateStr) : new Date();
    const startDate = startDateStr ? new Date(startDateStr) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw ApiError.badRequest('Invalid date format');
    }

    const stats = await activityStatusService.getStatusStats(userId, startDate, endDate);
    ApiResponse.success(res, stats, 'Status statistics retrieved successfully');
  });

  /**
   * @route   GET /api/activity-status/date/:date
   * @desc    Get status for a specific date
   * @access  Private
   */
  getStatusForDate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { date } = req.params;
    if (!date) {
      throw ApiError.badRequest('Date is required');
    }

    const status = await activityStatusService.getStatusForDate(userId, date);
    if (!status) {
      ApiResponse.success(res, null, 'No status found for this date');
      return;
    }

    ApiResponse.success(res, status, 'Status retrieved successfully');
  });

  /**
   * @route   DELETE /api/activity-status/date/:date
   * @desc    Delete status for a specific date
   * @access  Private
   */
  deleteStatusForDate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { date } = req.params;
    if (!date) {
      throw ApiError.badRequest('Date is required');
    }

    await activityStatusService.deleteStatusForDate(userId, date);
    ApiResponse.success(res, { success: true }, 'Status deleted successfully');
  });

  /**
   * @route   GET /api/activity-status/enhanced-current
   * @desc    Get enhanced current status with duration, overrides, and 7-day summary
   * @access  Private
   */
  getEnhancedCurrent = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const [current, daysSince, overrides, calendar] = await Promise.all([
      activityStatusService.getCurrentStatus(userId),
      activityStatusService.getDaysSinceLastWorkingStatus(userId),
      statusPlanAdjusterService.getActiveOverrides(userId),
      activityStatusService.getStatusForMonth(
        userId,
        new Date().getFullYear(),
        new Date().getMonth() + 1,
      ),
    ]);

    // Build 7-day summary from calendar data
    const today = new Date();
    const last7Days: Array<{ date: string; status: string }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0]!;
      const dayData = calendar.days.find((day) => day.date === dateStr);
      last7Days.push({ date: dateStr, status: dayData?.status || 'working' });
    }

    ApiResponse.success(res, {
      status: current.status,
      since: current.updatedAt,
      expectedEndDate: overrides?.expiresAt ?? null,
      daysInStatus: daysSince,
      activeOverrides: overrides,
      last7Days,
    }, 'Enhanced status retrieved');
  });
}

export const activityStatusController = new ActivityStatusController();

