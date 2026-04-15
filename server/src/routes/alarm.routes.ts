/**
 * @file Workout Alarm Routes
 * API endpoints for workout reminders/alarms
 */

import { Router, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import authenticate from '../middlewares/auth.middleware.js';
import { workoutAlarmService } from '../services/workout-alarm.service.js';
import { pool } from '../database/pg.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/alarms
 * Get all workout alarms for user
 */
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const alarms = await workoutAlarmService.getAlarms(userId);

    res.json({
      success: true,
      data: { alarms },
    });
  })
);

/**
 * GET /api/alarms/summary
 * Get alarm schedule summary
 */
router.get(
  '/summary',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const summary = await workoutAlarmService.getScheduleSummary(userId);

    res.json({
      success: true,
      data: { summary },
    });
  })
);

/**
 * GET /api/alarms/today
 * Get today's alarms
 */
router.get(
  '/today',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const alarms = await workoutAlarmService.getTodayAlarms(userId);

    res.json({
      success: true,
      data: { alarms },
    });
  })
);

/**
 * GET /api/alarms/:id
 * Get a specific alarm
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;

    const alarm = await workoutAlarmService.getAlarm(userId, id);

    if (!alarm) {
      res.status(404).json({
        success: false,
        error: 'Alarm not found',
      });
      return;
    }

    res.json({
      success: true,
      data: { alarm },
    });
  })
);

/**
 * POST /api/alarms
 * Create a new workout alarm
 */
router.post(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { workoutPlanId, title, message, alarmTime, daysOfWeek, notificationType, soundEnabled, soundFile, vibrationEnabled, snoozeMinutes, timezone } = req.body;

    // If timezone is provided, update user preferences to persist it
    if (timezone && typeof timezone === 'string') {
      try {
        await pool.query(
          `INSERT INTO user_preferences (user_id, timezone, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (user_id)
           DO UPDATE SET timezone = $2, updated_at = NOW()`,
          [userId, timezone]
        );
      } catch (error) {
        console.error('Failed to update user timezone preference:', error);
      }
    }

    // Validate alarm time format (HH:MM) and values
    if (!alarmTime || !/^\d{2}:\d{2}$/.test(alarmTime)) {
      res.status(400).json({
        success: false,
        error: 'Alarm time is required in HH:MM format (24-hour format, e.g., 13:30)',
      });
      return;
    }
    
    // Validate hours (0-23) and minutes (0-59)
    const [hours, minutes] = alarmTime.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      res.status(400).json({
        success: false,
        error: 'Invalid alarm time: hours must be 0-23 and minutes must be 0-59',
      });
      return;
    }

    // Validate days of week
    if (daysOfWeek && (!Array.isArray(daysOfWeek) || daysOfWeek.some((d: number) => d < 0 || d > 6))) {
      res.status(400).json({
        success: false,
        error: 'Days of week must be an array of numbers 0-6 (Sunday-Saturday)',
      });
      return;
    }

    // Validate sound file if provided
    const allowedSounds = ['alarm.wav', 'azan1.mp3', 'azan2.mp3', 'azan3.mp3'];
    if (soundFile && !allowedSounds.includes(soundFile)) {
      res.status(400).json({
        success: false,
        error: `Sound file must be one of: ${allowedSounds.join(', ')}`,
      });
      return;
    }

    const alarm = await workoutAlarmService.createAlarm(userId, {
      workoutPlanId,
      title,
      message,
      alarmTime,
      daysOfWeek,
      notificationType,
      soundEnabled,
      soundFile,
      vibrationEnabled,
      snoozeMinutes,
    });

    res.status(201).json({
      success: true,
      data: { alarm },
    });
  })
);

/**
 * PATCH /api/alarms/:id
 * Update an alarm
 */
router.patch(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { title, message, alarmTime, daysOfWeek, isEnabled, notificationType, soundEnabled, soundFile, vibrationEnabled, snoozeMinutes, timezone } = req.body;

    // If timezone is provided, update user preferences to persist it
    if (timezone && typeof timezone === 'string') {
      try {
        await pool.query(
          `INSERT INTO user_preferences (user_id, timezone, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (user_id)
           DO UPDATE SET timezone = $2, updated_at = NOW()`,
          [userId, timezone]
        );
      } catch (error) {
        console.error('Failed to update user timezone preference:', error);
      }
    }

    // Validate alarm time format if provided
    if (alarmTime) {
      if (!/^\d{2}:\d{2}$/.test(alarmTime)) {
        res.status(400).json({
          success: false,
          error: 'Alarm time must be in HH:MM format (24-hour format, e.g., 13:30)',
        });
        return;
      }
      
      // Validate hours (0-23) and minutes (0-59)
      const [hours, minutes] = alarmTime.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        res.status(400).json({
          success: false,
          error: 'Invalid alarm time: hours must be 0-23 and minutes must be 0-59',
        });
        return;
      }
    }

    // Validate days of week if provided
    if (daysOfWeek && (!Array.isArray(daysOfWeek) || daysOfWeek.some((d: number) => d < 0 || d > 6))) {
      res.status(400).json({
        success: false,
        error: 'Days of week must be an array of numbers 0-6',
      });
      return;
    }

    // Validate sound file if provided
    const allowedSounds = ['alarm.wav', 'azan1.mp3', 'azan2.mp3', 'azan3.mp3'];
    if (soundFile && !allowedSounds.includes(soundFile)) {
      res.status(400).json({
        success: false,
        error: `Sound file must be one of: ${allowedSounds.join(', ')}`,
      });
      return;
    }

    const alarm = await workoutAlarmService.updateAlarm(userId, id, {
      title,
      message,
      alarmTime,
      daysOfWeek,
      isEnabled,
      notificationType,
      soundEnabled,
      soundFile,
      vibrationEnabled,
      snoozeMinutes,
    });

    if (!alarm) {
      res.status(404).json({
        success: false,
        error: 'Alarm not found',
      });
      return;
    }

    res.json({
      success: true,
      data: { alarm },
    });
  })
);

/**
 * PATCH /api/alarms/:id/toggle
 * Toggle alarm enabled state
 */
router.patch(
  '/:id/toggle',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;

    const alarm = await workoutAlarmService.toggleAlarm(userId, id);

    if (!alarm) {
      res.status(404).json({
        success: false,
        error: 'Alarm not found',
      });
      return;
    }

    res.json({
      success: true,
      data: { alarm },
    });
  })
);

/**
 * PATCH /api/alarms/:id/snooze
 * Snooze alarm for specified minutes
 */
router.patch(
  '/:id/snooze',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { minutes } = req.body;

    if (!minutes || typeof minutes !== 'number' || minutes <= 0) {
      res.status(400).json({
        success: false,
        error: 'Minutes must be a positive number',
      });
      return;
    }

    const alarm = await workoutAlarmService.snoozeAlarm(userId, id, minutes);

    if (!alarm) {
      res.status(404).json({
        success: false,
        error: 'Alarm not found',
      });
      return;
    }

    res.json({
      success: true,
      data: { alarm },
    });
  })
);

/**
 * PATCH /api/alarms/:id/dismiss
 * Dismiss alarm - mark as triggered and calculate next trigger time
 * This prevents the alarm from retriggering immediately
 */
router.patch(
  '/:id/dismiss',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;

    const alarm = await workoutAlarmService.dismissAlarm(userId, id);

    if (!alarm) {
      res.status(404).json({
        success: false,
        error: 'Alarm not found',
      });
      return;
    }

    res.json({
      success: true,
      data: { alarm },
    });
  })
);

/**
 * DELETE /api/alarms/:id
 * Delete an alarm
 */
router.delete(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;

    const deleted = await workoutAlarmService.deleteAlarm(userId, id);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: 'Alarm not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Alarm deleted successfully',
    });
  })
);

/**
 * POST /api/alarms/recalculate
 * Recalculate next_trigger_at for all user's alarms
 * Useful for fixing alarms with incorrect trigger times
 */
router.post(
  '/recalculate',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    
    // Get all user's enabled alarms
    const result = await pool.query(
      `SELECT id, alarm_time, days_of_week FROM workout_alarms 
       WHERE user_id = $1 AND is_enabled = true`,
      [userId]
    );

    let updated = 0;
    for (const row of result.rows) {
      const nextTriggerAt = await workoutAlarmService.recalculateAlarmTrigger(row.id, userId);
      if (nextTriggerAt) {
        updated++;
      }
    }

    res.json({
      success: true,
      message: `Recalculated ${updated} alarms`,
      data: { updated },
    });
  })
);

/**
 * POST /api/alarms/:id/test-trigger
 * Manually trigger an alarm for testing (development only)
 */
router.post(
  '/:id/test-trigger',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;

    const alarm = await workoutAlarmService.getAlarm(userId, id);
    if (!alarm) {
      res.status(404).json({
        success: false,
        error: 'Alarm not found',
      });
      return;
    }

    // Import reminder processor to trigger the alarm
    const { reminderProcessorJob } = await import('../jobs/reminder-processor.job.js');
    
    // Manually process alarms (this will trigger the alarm if it's due)
    await reminderProcessorJob.processNow();

    res.json({
      success: true,
      message: 'Alarm trigger processed. Check if alarm modal appeared.',
    });
  })
);

export default router;
