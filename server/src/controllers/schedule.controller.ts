/**
 * @file Schedule Controller
 * @description API endpoints for daily schedules with drag-drop items and linking
 */

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { scheduleService } from '../services/schedule.service.js';

class ScheduleController {
  /**
   * @route   GET /api/v1/schedules/calendar
   * @desc    Get schedules for date range (calendar view)
   * @access  Private
   */
  getCalendarSchedules = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    if (!startDate || !endDate) {
      throw ApiError.badRequest('startDate and endDate are required');
    }

    const schedules = await scheduleService.getSchedulesForCalendar(userId, startDate, endDate);

    ApiResponse.success(res, { schedules }, 'Calendar schedules retrieved successfully', undefined, req);
  });

  /**
   * @route   GET /api/v1/schedules/:date
   * @desc    Get schedule for specific date
   * @access  Private
   */
  getScheduleByDate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { date } = req.params;

    const schedule = await scheduleService.getScheduleByDate(userId, date);

    if (!schedule) {
      ApiResponse.success(res, { schedule: null }, 'No schedule found for this date', undefined, req);
      return;
    }

    ApiResponse.success(res, { schedule }, 'Schedule retrieved successfully', undefined, req);
  });

  /**
   * @route   POST /api/v1/schedules
   * @desc    Create new schedule (or return existing if it already exists)
   * @access  Private
   */
  createSchedule = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { schedule_date, template_id, name, notes } = req.body;

    if (!schedule_date) {
      throw ApiError.badRequest('schedule_date is required');
    }

    // Check if schedule already exists before creating
    const existing = await scheduleService.getScheduleByDate(userId, schedule_date);
    const isNew = !existing;

    const schedule = await scheduleService.createSchedule(userId, {
      scheduleDate: schedule_date,
      templateId: template_id,
      name,
      notes,
    });

    ApiResponse.success(
      res,
      { schedule },
      {
        message: isNew ? 'Schedule created successfully' : 'Schedule already exists, returning existing schedule',
        statusCode: isNew ? 201 : 200,
      },
      undefined,
      req
    );
  });

  /**
   * @route   PUT /api/v1/schedules/:id
   * @desc    Update schedule
   * @access  Private
   */
  updateSchedule = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { id } = req.params;
    const { name, notes } = req.body;

    const schedule = await scheduleService.updateSchedule(userId, id, {
      name,
      notes,
    });

    ApiResponse.success(res, { schedule }, 'Schedule updated successfully', undefined, req);
  });

  /**
   * @route   DELETE /api/v1/schedules/:id
   * @desc    Delete schedule
   * @access  Private
   */
  deleteSchedule = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { id } = req.params;

    await scheduleService.deleteSchedule(userId, id);

    ApiResponse.success(res, {}, 'Schedule deleted successfully', undefined, req);
  });

  /**
   * @route   GET /api/v1/schedules/:id
   * @desc    Get schedule by ID
   * @access  Private
   */
  getScheduleById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { id } = req.params;

    const schedule = await scheduleService.getScheduleById(userId, id);

    ApiResponse.success(res, { schedule }, 'Schedule retrieved successfully', undefined, req);
  });

  /**
   * @route   POST /api/v1/schedules/:id/items
   * @desc    Add item to schedule
   * @access  Private
   */
  addScheduleItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { id } = req.params;
    const { title, description, start_time, end_time, duration_minutes, color, icon, category, position, metadata } =
      req.body;

    if (!title || !start_time || position === undefined) {
      throw ApiError.badRequest('title, start_time, and position are required');
    }

    const item = await scheduleService.addScheduleItem(userId, id, {
      title,
      description,
      startTime: start_time,
      endTime: end_time,
      durationMinutes: duration_minutes,
      color,
      icon,
      category,
      position,
      metadata,
    });

    ApiResponse.success(
      res,
      { item },
      {
        message: 'Schedule item added successfully',
        statusCode: 201,
      },
      undefined,
      req
    );
  });

  /**
   * @route   PUT /api/v1/schedules/items/:id
   * @desc    Update schedule item
   * @access  Private
   */
  updateScheduleItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { id } = req.params;
    const {
      title,
      description,
      start_time,
      end_time,
      duration_minutes,
      color,
      icon,
      category,
      position,
      metadata,
    } = req.body;

    const item = await scheduleService.updateScheduleItem(userId, id, {
      title,
      description,
      startTime: start_time,
      endTime: end_time,
      durationMinutes: duration_minutes,
      color,
      icon,
      category,
      position,
      metadata,
    });

    ApiResponse.success(res, { item }, 'Schedule item updated successfully', undefined, req);
  });

  /**
   * @route   DELETE /api/v1/schedules/items/:id
   * @desc    Delete schedule item
   * @access  Private
   */
  deleteScheduleItem = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { id } = req.params;

    await scheduleService.deleteScheduleItem(userId, id);

    ApiResponse.success(res, {}, 'Schedule item deleted successfully', undefined, req);
  });

  /**
   * @route   POST /api/v1/schedules/:id/links
   * @desc    Create link between schedule items
   * @access  Private
   */
  createScheduleLink = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { id } = req.params;
    const { source_item_id, target_item_id, link_type, delay_minutes, conditions } = req.body;

    if (!source_item_id || !target_item_id) {
      throw ApiError.badRequest('source_item_id and target_item_id are required');
    }

    const link = await scheduleService.createScheduleLink(userId, id, {
      sourceItemId: source_item_id,
      targetItemId: target_item_id,
      linkType: link_type,
      delayMinutes: delay_minutes,
      conditions,
    });

    ApiResponse.success(
      res,
      { link },
      {
        message: 'Schedule link created successfully',
        statusCode: 201,
      },
      undefined,
      req
    );
  });

  /**
   * @route   DELETE /api/v1/schedules/links/:id
   * @desc    Delete schedule link
   * @access  Private
   */
  deleteScheduleLink = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { id } = req.params;

    await scheduleService.deleteScheduleLink(userId, id);

    ApiResponse.success(res, {}, 'Schedule link deleted successfully', undefined, req);
  });

  /**
   * @route   GET /api/v1/schedules/templates
   * @desc    Get all templates
   * @access  Private
   */
  getTemplates = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const templates = await scheduleService.getTemplates(userId);

    ApiResponse.success(res, { templates }, 'Templates retrieved successfully', undefined, req);
  });

  /**
   * @route   POST /api/v1/schedules/templates
   * @desc    Create template
   * @access  Private
   */
  createTemplate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { name, description, is_default } = req.body;

    if (!name) {
      throw ApiError.badRequest('name is required');
    }

    const template = await scheduleService.createTemplate(userId, {
      name,
      description,
      isDefault: is_default,
    });

    ApiResponse.success(
      res,
      { template },
      {
        message: 'Template created successfully',
        statusCode: 201,
      },
      undefined,
      req
    );
  });

  /**
   * @route   POST /api/v1/schedules/:id/save-as-template
   * @desc    Save schedule as template
   * @access  Private
   */
  saveScheduleAsTemplate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { id } = req.params;
    const { template_name, description } = req.body;

    if (!template_name) {
      throw ApiError.badRequest('template_name is required');
    }

    const template = await scheduleService.saveScheduleAsTemplate(userId, id, template_name, description);

    ApiResponse.success(
      res,
      { template },
      {
        message: 'Schedule saved as template successfully',
        statusCode: 201,
      },
      undefined,
      req
    );
  });

  /**
   * @route   POST /api/v1/schedules/:id/apply-template/:templateId
   * @desc    Apply template to schedule
   * @access  Private
   */
  applyTemplate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { id, templateId } = req.params;

    await scheduleService.applyTemplateToSchedule(id, templateId);

    const schedule = await scheduleService.getScheduleById(userId, id);

    ApiResponse.success(res, { schedule }, 'Template applied successfully', undefined, req);
  });
}

export const scheduleController = new ScheduleController();
export default scheduleController;


