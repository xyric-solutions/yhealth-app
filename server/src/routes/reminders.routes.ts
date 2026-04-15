/**
 * @file Scheduled Reminders Routes
 * API endpoints for workout, meal, water, and custom reminders
 */

import { Router, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import authenticate from '../middlewares/auth.middleware.js';
import { reminderSchedulerService, ReminderType, NotificationChannel } from '../services/reminder-scheduler.service.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { ApiError } from '../utils/ApiError.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// REMINDERS CRUD
// ============================================

/**
 * GET /api/reminders
 * Get all reminders for user
 */
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { type } = req.query;

    const reminders = await reminderSchedulerService.getReminders(
      userId,
      type as ReminderType | undefined
    );

    res.json({
      success: true,
      data: { reminders },
    });
  })
);

/**
 * GET /api/reminders/summary
 * Get reminder schedule summary
 */
router.get(
  '/summary',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const summary = await reminderSchedulerService.getReminderSummary(userId);

    res.json({
      success: true,
      data: { summary },
    });
  })
);

/**
 * GET /api/reminders/today
 * Get today's reminders
 */
router.get(
  '/today',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const reminders = await reminderSchedulerService.getTodayReminders(userId);

    res.json({
      success: true,
      data: { reminders },
    });
  })
);

/**
 * GET /api/reminders/:id
 * Get a specific reminder
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;

    const reminder = await reminderSchedulerService.getReminder(userId, id);

    if (!reminder) {
      throw ApiError.notFound('Reminder not found');
    }

    res.json({
      success: true,
      data: { reminder },
    });
  })
);

/**
 * POST /api/reminders
 * Create a new reminder
 */
router.post(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const {
      reminderType,
      sourceType,
      sourceId,
      title,
      message,
      icon,
      reminderTime,
      daysOfWeek,
      timezone,
      notificationChannels,
      advanceMinutes,
      repeatIfMissed,
      snoozeMinutes,
      metadata,
    } = req.body;

    // Validate reminder type
    const validTypes: ReminderType[] = ['meal', 'workout', 'water', 'medication', 'custom'];
    if (!reminderType || !validTypes.includes(reminderType)) {
      throw ApiError.badRequest(`Reminder type must be one of: ${validTypes.join(', ')}`);
    }

    // Validate reminder time format (HH:MM or HH:MM:SS)
    if (!reminderTime || !/^\d{2}:\d{2}(:\d{2})?$/.test(reminderTime)) {
      throw ApiError.badRequest('Reminder time is required in HH:MM or HH:MM:SS format');
    }

    // Validate days of week if provided
    if (daysOfWeek && (!Array.isArray(daysOfWeek) || daysOfWeek.some((d: number) => d < 0 || d > 6))) {
      throw ApiError.badRequest('Days of week must be an array of numbers 0-6 (Sunday-Saturday)');
    }

    // Validate notification channels if provided
    const validChannels: NotificationChannel[] = ['push', 'email', 'whatsapp', 'sms'];
    if (notificationChannels) {
      if (!Array.isArray(notificationChannels)) {
        throw ApiError.badRequest('Notification channels must be an array');
      }
      const invalidChannel = notificationChannels.find((c: string) => !validChannels.includes(c as NotificationChannel));
      if (invalidChannel) {
        throw ApiError.badRequest(`Invalid notification channel: ${invalidChannel}. Valid: ${validChannels.join(', ')}`);
      }
    }

    const reminder = await reminderSchedulerService.createReminder(userId, {
      reminderType,
      sourceType,
      sourceId,
      title,
      message,
      icon,
      reminderTime,
      daysOfWeek,
      timezone,
      notificationChannels,
      advanceMinutes,
      repeatIfMissed,
      snoozeMinutes,
      metadata,
    });

    res.status(201).json({
      success: true,
      data: { reminder },
    });
  })
);

/**
 * PATCH /api/reminders/:id
 * Update a reminder
 */
router.patch(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;
    const {
      title,
      message,
      icon,
      reminderTime,
      daysOfWeek,
      timezone,
      notificationChannels,
      advanceMinutes,
      repeatIfMissed,
      snoozeMinutes,
      isEnabled,
      metadata,
    } = req.body;

    // Validate reminder time format if provided
    if (reminderTime && !/^\d{2}:\d{2}(:\d{2})?$/.test(reminderTime)) {
      throw ApiError.badRequest('Reminder time must be in HH:MM or HH:MM:SS format');
    }

    // Validate days of week if provided
    if (daysOfWeek && (!Array.isArray(daysOfWeek) || daysOfWeek.some((d: number) => d < 0 || d > 6))) {
      throw ApiError.badRequest('Days of week must be an array of numbers 0-6');
    }

    const reminder = await reminderSchedulerService.updateReminder(userId, id, {
      title,
      message,
      icon,
      reminderTime,
      daysOfWeek,
      timezone,
      notificationChannels,
      advanceMinutes,
      repeatIfMissed,
      snoozeMinutes,
      isEnabled,
      metadata,
    });

    if (!reminder) {
      throw ApiError.notFound('Reminder not found');
    }

    res.json({
      success: true,
      data: { reminder },
    });
  })
);

/**
 * PATCH /api/reminders/:id/toggle
 * Toggle reminder enabled state
 */
router.patch(
  '/:id/toggle',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;

    const reminder = await reminderSchedulerService.toggleReminder(userId, id);

    if (!reminder) {
      throw ApiError.notFound('Reminder not found');
    }

    res.json({
      success: true,
      data: { reminder },
    });
  })
);

/**
 * POST /api/reminders/:id/snooze
 * Snooze a reminder
 */
router.post(
  '/:id/snooze',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;

    const reminder = await reminderSchedulerService.snoozeReminder(userId, id);

    if (!reminder) {
      throw ApiError.notFound('Reminder not found');
    }

    res.json({
      success: true,
      data: { reminder },
      message: `Reminder snoozed for ${reminder.snoozeMinutes} minutes`,
    });
  })
);

/**
 * DELETE /api/reminders/:id
 * Delete a reminder
 */
router.delete(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;

    const deleted = await reminderSchedulerService.deleteReminder(userId, id);

    if (!deleted) {
      throw ApiError.notFound('Reminder not found');
    }

    res.json({
      success: true,
      message: 'Reminder deleted successfully',
    });
  })
);

// ============================================
// QUICK SETUP ENDPOINTS
// ============================================

/**
 * POST /api/reminders/setup/from-diet-plan
 * Create reminders from a diet plan's meal times
 */
router.post(
  '/setup/from-diet-plan',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { dietPlanId } = req.body;

    if (!dietPlanId) {
      throw ApiError.badRequest('Diet plan ID is required');
    }

    try {
      const reminders = await reminderSchedulerService.createRemindersFromDietPlan(userId, dietPlanId);

      res.status(201).json({
        success: true,
        data: { reminders },
        message: `Created ${reminders.length} meal reminders from diet plan`,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'Diet plan not found') {
        throw ApiError.notFound('Diet plan not found');
      }
      throw error;
    }
  })
);

/**
 * POST /api/reminders/setup/water
 * Set up water intake reminders throughout the day
 */
router.post(
  '/setup/water',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { startTime, endTime, intervalHours, glassesPerDay } = req.body;

    // Validate times if provided
    if (startTime && !/^\d{2}:\d{2}$/.test(startTime)) {
      throw ApiError.badRequest('Start time must be in HH:MM format');
    }
    if (endTime && !/^\d{2}:\d{2}$/.test(endTime)) {
      throw ApiError.badRequest('End time must be in HH:MM format');
    }

    const reminders = await reminderSchedulerService.createWaterReminders(userId, {
      startTime,
      endTime,
      intervalHours,
      glassesPerDay,
    });

    res.status(201).json({
      success: true,
      data: { reminders },
      message: `Created ${reminders.length} water reminders`,
    });
  })
);

/**
 * POST /api/reminders/setup/workout
 * Create a workout reminder (quick setup)
 */
router.post(
  '/setup/workout',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const {
      workoutPlanId,
      title = 'Workout Time!',
      message = "Time to exercise! Let's get moving.",
      reminderTime,
      daysOfWeek = [1, 2, 3, 4, 5], // Weekdays by default
      advanceMinutes = 10,
    } = req.body;

    if (!reminderTime || !/^\d{2}:\d{2}(:\d{2})?$/.test(reminderTime)) {
      throw ApiError.badRequest('Reminder time is required in HH:MM format');
    }

    const reminder = await reminderSchedulerService.createReminder(userId, {
      reminderType: 'workout',
      sourceType: workoutPlanId ? 'workout_plan' : 'manual',
      sourceId: workoutPlanId,
      title,
      message,
      icon: '💪',
      reminderTime,
      daysOfWeek,
      advanceMinutes,
      metadata: { workoutPlanId },
    });

    res.status(201).json({
      success: true,
      data: { reminder },
    });
  })
);

/**
 * POST /api/reminders/setup/meal
 * Create a single meal reminder (quick setup)
 */
router.post(
  '/setup/meal',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const {
      mealType = 'lunch',
      dietPlanId,
      title,
      message,
      reminderTime,
      daysOfWeek = [0, 1, 2, 3, 4, 5, 6],
      advanceMinutes = 5,
    } = req.body;

    if (!reminderTime || !/^\d{2}:\d{2}(:\d{2})?$/.test(reminderTime)) {
      throw ApiError.badRequest('Reminder time is required in HH:MM format');
    }

    const mealTitles: Record<string, string> = {
      breakfast: '🌅 Breakfast Time',
      lunch: '☀️ Lunch Time',
      dinner: '🌙 Dinner Time',
      snack: '🍎 Snack Time',
    };

    const reminder = await reminderSchedulerService.createReminder(userId, {
      reminderType: 'meal',
      sourceType: dietPlanId ? 'diet_plan' : 'manual',
      sourceId: dietPlanId,
      title: title || mealTitles[mealType] || 'Meal Time',
      message: message || `Time for ${mealType}! Don't forget to log your meal.`,
      icon: mealType === 'breakfast' ? '🌅' : mealType === 'lunch' ? '☀️' : mealType === 'dinner' ? '🌙' : '🍎',
      reminderTime,
      daysOfWeek,
      advanceMinutes,
      metadata: { mealType, dietPlanId },
    });

    res.status(201).json({
      success: true,
      data: { reminder },
    });
  })
);

export default router;
