/**
 * @file Schedule Routes
 * @description API routes for daily schedules
 */

import { Router, type Response } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { scheduleController } from '../controllers/schedule.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { scheduleContextService } from '../services/schedule-context.service.js';
import { specialDaysService } from '../services/special-days.service.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/schedules/context
 * @desc    Get AI-computed day context (stress, free windows, special days)
 * @access  Private
 */
router.get('/context', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }

  const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
  const [dayContext, specialDays] = await Promise.all([
    scheduleContextService.getDayContext(userId, date),
    specialDaysService.getSpecialDays(userId, date),
  ]);

  ApiResponse.success(res, { ...dayContext, specialDays });
}));

/**
 * @route   GET /api/v1/schedules/calendar
 * @desc    Get schedules for date range (calendar view)
 * @access  Private
 */
router.get('/calendar', scheduleController.getCalendarSchedules);

/**
 * @route   GET /api/v1/schedules/templates
 * @desc    Get all templates
 * @access  Private
 */
router.get('/templates', scheduleController.getTemplates);

/**
 * @route   POST /api/v1/schedules/templates
 * @desc    Create template
 * @access  Private
 */
router.post('/templates', scheduleController.createTemplate);

/**
 * @route   GET /api/v1/schedules/:date
 * @desc    Get schedule for specific date
 * @access  Private
 */
router.get('/:date', scheduleController.getScheduleByDate);

/**
 * @route   POST /api/v1/schedules
 * @desc    Create new schedule
 * @access  Private
 */
router.post('/', scheduleController.createSchedule);

/**
 * @route   GET /api/v1/schedules/:id
 * @desc    Get schedule by ID
 * @access  Private
 */
router.get('/:id', scheduleController.getScheduleById);

/**
 * @route   PUT /api/v1/schedules/:id
 * @desc    Update schedule
 * @access  Private
 */
router.put('/:id', scheduleController.updateSchedule);

/**
 * @route   DELETE /api/v1/schedules/:id
 * @desc    Delete schedule
 * @access  Private
 */
router.delete('/:id', scheduleController.deleteSchedule);

/**
 * @route   POST /api/v1/schedules/:id/items
 * @desc    Add item to schedule
 * @access  Private
 */
router.post('/:id/items', scheduleController.addScheduleItem);

/**
 * @route   POST /api/v1/schedules/:id/links
 * @desc    Create link between schedule items
 * @access  Private
 */
router.post('/:id/links', scheduleController.createScheduleLink);

/**
 * @route   POST /api/v1/schedules/:id/save-as-template
 * @desc    Save schedule as template
 * @access  Private
 */
router.post('/:id/save-as-template', scheduleController.saveScheduleAsTemplate);

/**
 * @route   POST /api/v1/schedules/:id/apply-template/:templateId
 * @desc    Apply template to schedule
 * @access  Private
 */
router.post('/:id/apply-template/:templateId', scheduleController.applyTemplate);

/**
 * @route   PUT /api/v1/schedules/items/:id
 * @desc    Update schedule item
 * @access  Private
 */
router.put('/items/:id', scheduleController.updateScheduleItem);

/**
 * @route   DELETE /api/v1/schedules/items/:id
 * @desc    Delete schedule item
 * @access  Private
 */
router.delete('/items/:id', scheduleController.deleteScheduleItem);

/**
 * @route   DELETE /api/v1/schedules/links/:id
 * @desc    Delete schedule link
 * @access  Private
 */
router.delete('/links/:id', scheduleController.deleteScheduleLink);

export default router;

