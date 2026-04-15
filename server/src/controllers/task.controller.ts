/**
 * @file Task Controller
 * @description Handles user task CRUD operations and scheduling
 */

import type { Response } from 'express';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { taskService } from '../services/task.service.js';
import type { AuthenticatedRequest } from '../types/index.js';
import type {
  CreateTaskInput,
  UpdateTaskInput,
  TaskCategory,
  TaskStatus,
} from '../services/task.service.js';

/**
 * Create a new task
 * POST /api/tasks
 */
export const createTask = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const {
    title,
    description,
    category,
    priority,
    scheduledAt,
    reminderMinutesBefore,
    notifyPush,
    notifyEmail,
    notifySms,
    isRecurring,
    recurrencePattern,
    recurrenceDays,
    recurrenceEndDate,
    color,
    icon,
    tags,
    metadata,
  } = req.body as CreateTaskInput;

  if (!title || !scheduledAt) {
    throw ApiError.badRequest('Title and scheduledAt are required');
  }

  // Validate scheduledAt is a valid date in the future
  const scheduledDate = new Date(scheduledAt);
  if (isNaN(scheduledDate.getTime())) {
    throw ApiError.badRequest('Invalid scheduledAt date format');
  }

  const task = await taskService.createTask(userId, {
    title,
    description,
    category,
    priority,
    scheduledAt,
    reminderMinutesBefore,
    notifyPush,
    notifyEmail,
    notifySms,
    isRecurring,
    recurrencePattern,
    recurrenceDays,
    recurrenceEndDate,
    color,
    icon,
    tags,
    metadata,
  });

  ApiResponse.created(res, task, 'Task created successfully');
});

/**
 * Get all tasks for the current user
 * GET /api/tasks
 */
export const getTasks = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const {
    status,
    category,
    fromDate,
    toDate,
    limit,
    offset,
  } = req.query as {
    status?: TaskStatus;
    category?: TaskCategory;
    fromDate?: string;
    toDate?: string;
    limit?: string;
    offset?: string;
  };

  const result = await taskService.getTasks(userId, {
    status,
    category,
    fromDate,
    toDate,
    limit: limit ? parseInt(limit, 10) : undefined,
    offset: offset ? parseInt(offset, 10) : undefined,
  });

  ApiResponse.success(res, result);
});

/**
 * Get a specific task
 * GET /api/tasks/:id
 */
export const getTask = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { id } = req.params;
  const task = await taskService.getTask(userId, id);

  if (!task) {
    throw ApiError.notFound('Task not found');
  }

  ApiResponse.success(res, task);
});

/**
 * Update a task
 * PATCH /api/tasks/:id
 */
export const updateTask = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { id } = req.params;
  const updateData = req.body as UpdateTaskInput;

  // Validate scheduledAt if provided
  if (updateData.scheduledAt) {
    const scheduledDate = new Date(updateData.scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      throw ApiError.badRequest('Invalid scheduledAt date format');
    }
  }

  const task = await taskService.updateTask(userId, id, updateData);

  if (!task) {
    throw ApiError.notFound('Task not found');
  }

  ApiResponse.success(res, task, 'Task updated successfully');
});

/**
 * Delete a task
 * DELETE /api/tasks/:id
 */
export const deleteTask = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { id } = req.params;
  const deleted = await taskService.deleteTask(userId, id);

  if (!deleted) {
    throw ApiError.notFound('Task not found');
  }

  ApiResponse.success(res, { deleted: true }, 'Task deleted successfully');
});

/**
 * Complete a task
 * POST /api/tasks/:id/complete
 */
export const completeTask = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { id } = req.params;
  const task = await taskService.completeTask(userId, id);

  if (!task) {
    throw ApiError.notFound('Task not found');
  }

  ApiResponse.success(res, task, 'Task completed successfully');
});

/**
 * Get today's tasks
 * GET /api/tasks/today
 */
export const getTodayTasks = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const tasks = await taskService.getTodayTasks(userId);
  ApiResponse.success(res, { tasks, count: tasks.length });
});

/**
 * Get upcoming tasks
 * GET /api/tasks/upcoming
 */
export const getUpcomingTasks = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { days } = req.query as { days?: string };
  const daysNumber = days ? parseInt(days, 10) : 7;

  const tasks = await taskService.getUpcomingTasks(userId, daysNumber);
  ApiResponse.success(res, { tasks, count: tasks.length });
});

/**
 * Get task statistics
 * GET /api/tasks/stats
 */
export const getTaskStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const stats = await taskService.getTaskStats(userId);
  ApiResponse.success(res, stats);
});
