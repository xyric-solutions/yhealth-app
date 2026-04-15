/**
 * @file Habit Controller
 * @description API endpoints for habit tracking (F7.3)
 */

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../types/index.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { habitService } from '../../services/wellbeing/habit.service.js';

class HabitController {
  /**
   * @route   GET /api/v1/wellbeing/habits
   * @desc    List user habits
   * @access  Private
   */
  getHabits = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const includeArchived = req.query.includeArchived === 'true';

    const habits = await habitService.getHabits(userId, includeArchived);

    ApiResponse.success(res, { habits }, 'Habits retrieved successfully', undefined, req);
  });

  /**
   * @route   POST /api/v1/wellbeing/habits
   * @desc    Create new habit
   * @access  Private
   */
  createHabit = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const {
      habit_name,
      category,
      tracking_type,
      frequency,
      specific_days,
      description,
      target_value,
      unit,
      reminder_enabled,
      reminder_time,
    } = req.body;

    if (!habit_name || !tracking_type || !frequency) {
      throw ApiError.badRequest('habit_name, tracking_type, and frequency are required');
    }

    const habit = await habitService.createHabit(userId, {
      habitName: habit_name,
      category,
      trackingType: tracking_type,
      frequency,
      specificDays: specific_days,
      description,
      targetValue: target_value,
      unit,
      reminderEnabled: reminder_enabled,
      reminderTime: reminder_time,
    });

    ApiResponse.success(
      res,
      { habit },
      {
        message: 'Habit created successfully',
        statusCode: 201,
      },
      undefined,
      req
    );
  });

  /**
   * @route   GET /api/v1/wellbeing/habits/:id
   * @desc    Get single habit
   * @access  Private
   */
  getHabit = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { id } = req.params;

    const habit = await habitService.getHabitById(userId, id);

    ApiResponse.success(res, { habit }, 'Habit retrieved successfully', undefined, req);
  });

  /**
   * @route   PUT /api/v1/wellbeing/habits/:id
   * @desc    Update habit
   * @access  Private
   */
  updateHabit = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { id } = req.params;

    const habit = await habitService.updateHabit(userId, id, req.body);

    ApiResponse.success(res, { habit }, 'Habit updated successfully', undefined, req);
  });

  /**
   * @route   DELETE /api/v1/wellbeing/habits/:id
   * @desc    Delete habit
   * @access  Private
   */
  deleteHabit = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { id } = req.params;

    await habitService.deleteHabit(userId, id);

    ApiResponse.success(res, {}, 'Habit deleted successfully', undefined, req);
  });

  /**
   * @route   POST /api/v1/wellbeing/habits/:id/log
   * @desc    Log habit completion
   * @access  Private
   */
  logCompletion = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { id } = req.params;
    const { completed, value, note, log_date } = req.body;

    if (typeof completed !== 'boolean') {
      throw ApiError.badRequest('completed is required and must be a boolean');
    }

    const habitLog = await habitService.logHabitCompletion(userId, id, {
      completed,
      value,
      note,
      logDate: log_date,
    });

    ApiResponse.success(
      res,
      { habitLog },
      {
        message: 'Habit logged successfully',
        statusCode: 201,
      },
      undefined,
      req
    );
  });

  /**
   * @route   GET /api/v1/wellbeing/habits/:id/logs
   * @desc    Get habit logs
   * @access  Private
   */
  getLogs = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { id } = req.params;
    const days = parseInt(req.query.days as string) || 30;

    const logs = await habitService.getHabitLogs(userId, id, days);

    ApiResponse.success(res, { logs }, 'Habit logs retrieved successfully', undefined, req);
  });

  /**
   * @route   GET /api/v1/wellbeing/habits/:id/analytics
   * @desc    Get habit analytics and correlations
   * @access  Private
   */
  getAnalytics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { id } = req.params;
    const days = parseInt(req.query.days as string) || 30;

    const analytics = await habitService.getHabitAnalytics(userId, id, days);

    ApiResponse.success(res, { analytics }, 'Habit analytics retrieved successfully', undefined, req);
  });
}

export const habitController = new HabitController();
export default habitController;

