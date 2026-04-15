/**
 * @file Task Routes
 * @description Routes for user task management with scheduling and notifications
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { apiLimiter } from '../middlewares/rateLimiter.middleware.js';
import {
  createTask,
  getTasks,
  getTask,
  updateTask,
  deleteTask,
  completeTask,
  getTodayTasks,
  getUpcomingTasks,
  getTaskStats,
} from '../controllers/task.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// TASK CRUD ROUTES
// ============================================

/**
 * @route   POST /api/tasks
 * @desc    Create a new task with scheduling
 * @access  Private
 * @body    {
 *   title: string (required),
 *   description?: string,
 *   category?: 'health' | 'fitness' | 'nutrition' | 'work' | 'personal' | 'general',
 *   priority?: 'low' | 'medium' | 'high' | 'urgent',
 *   scheduledAt: string (required, ISO date),
 *   reminderMinutesBefore?: number (default: 15),
 *   notifyPush?: boolean (default: true),
 *   notifyEmail?: boolean (default: true),
 *   notifySms?: boolean (default: false),
 *   isRecurring?: boolean,
 *   recurrencePattern?: 'daily' | 'weekly' | 'monthly' | 'yearly',
 *   recurrenceDays?: number[] (for weekly: 0-6),
 *   recurrenceEndDate?: string,
 *   color?: string,
 *   icon?: string,
 *   tags?: string[],
 *   metadata?: object
 * }
 */
router.post('/', apiLimiter, createTask);

/**
 * @route   GET /api/tasks
 * @desc    Get all tasks for the current user
 * @access  Private
 * @query   status, category, fromDate, toDate, limit, offset
 */
router.get('/', apiLimiter, getTasks);

/**
 * @route   GET /api/tasks/today
 * @desc    Get today's tasks
 * @access  Private
 */
router.get('/today', apiLimiter, getTodayTasks);

/**
 * @route   GET /api/tasks/upcoming
 * @desc    Get upcoming tasks for the next N days
 * @access  Private
 * @query   days (default: 7)
 */
router.get('/upcoming', apiLimiter, getUpcomingTasks);

/**
 * @route   GET /api/tasks/stats
 * @desc    Get task statistics
 * @access  Private
 */
router.get('/stats', apiLimiter, getTaskStats);

/**
 * @route   GET /api/tasks/:id
 * @desc    Get a specific task
 * @access  Private
 */
router.get('/:id', apiLimiter, getTask);

/**
 * @route   PATCH /api/tasks/:id
 * @desc    Update a task
 * @access  Private
 */
router.patch('/:id', apiLimiter, updateTask);

/**
 * @route   DELETE /api/tasks/:id
 * @desc    Delete a task
 * @access  Private
 */
router.delete('/:id', apiLimiter, deleteTask);

/**
 * @route   POST /api/tasks/:id/complete
 * @desc    Mark a task as completed
 * @access  Private
 */
router.post('/:id/complete', apiLimiter, completeTask);

export default router;
