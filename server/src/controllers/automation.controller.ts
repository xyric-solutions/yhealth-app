/**
 * @file Automation Controller
 * @description Handles automation settings, testing, and logs
 */

import type { Response } from 'express';
import { query } from '../database/pg.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../services/logger.service.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { scheduleAutomationJob } from '../jobs/schedule-automation.job.js';
import { scheduleAutomationService } from '../services/schedule-automation.service.js';

// ============================================
// CONTROLLER
// ============================================

class AutomationController {
  /**
   * Get user automation settings
   * GET /api/automation/settings
   */
  getSettings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const result = await query<{
      schedule_automation_enabled: boolean;
      activity_automation_enabled: boolean;
      schedule_reminder_minutes: number;
      ai_message_style: string;
      timezone: string;
    }>(
      `SELECT
         COALESCE(schedule_automation_enabled, true) as schedule_automation_enabled,
         COALESCE(activity_automation_enabled, true) as activity_automation_enabled,
         COALESCE(schedule_reminder_minutes, 5) as schedule_reminder_minutes,
         COALESCE(ai_message_style, 'friendly') as ai_message_style,
         COALESCE(timezone, 'UTC') as timezone
       FROM user_preferences
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('User preferences not found');
    }

    const prefs = result.rows[0];

    ApiResponse.success(res, {
      scheduleAutomationEnabled: prefs.schedule_automation_enabled,
      activityAutomationEnabled: prefs.activity_automation_enabled,
      scheduleReminderMinutes: prefs.schedule_reminder_minutes,
      aiMessageStyle: prefs.ai_message_style,
      timezone: prefs.timezone,
    });
  });

  /**
   * Update user automation settings
   * PATCH /api/automation/settings
   */
  updateSettings = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const {
      scheduleAutomationEnabled,
      activityAutomationEnabled,
      scheduleReminderMinutes,
      aiMessageStyle,
    } = req.body;

    // Validate inputs
    if (scheduleReminderMinutes !== undefined && (scheduleReminderMinutes < 0 || scheduleReminderMinutes > 60)) {
      throw ApiError.badRequest('Reminder minutes must be between 0 and 60');
    }

    if (aiMessageStyle && !['friendly', 'professional', 'motivational'].includes(aiMessageStyle)) {
      throw ApiError.badRequest('AI message style must be friendly, professional, or motivational');
    }

    // Build update query dynamically
    const updates: string[] = [];
    const values: (string | number | boolean)[] = [];
    let paramIndex = 1;

    if (scheduleAutomationEnabled !== undefined) {
      updates.push(`schedule_automation_enabled = $${paramIndex}`);
      values.push(scheduleAutomationEnabled);
      paramIndex++;
    }

    if (activityAutomationEnabled !== undefined) {
      updates.push(`activity_automation_enabled = $${paramIndex}`);
      values.push(activityAutomationEnabled);
      paramIndex++;
    }

    if (scheduleReminderMinutes !== undefined) {
      updates.push(`schedule_reminder_minutes = $${paramIndex}`);
      values.push(scheduleReminderMinutes);
      paramIndex++;
    }

    if (aiMessageStyle !== undefined) {
      updates.push(`ai_message_style = $${paramIndex}`);
      values.push(aiMessageStyle);
      paramIndex++;
    }

    if (updates.length === 0) {
      throw ApiError.badRequest('At least one setting must be provided');
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    await query(
      `UPDATE user_preferences
       SET ${updates.join(', ')}
       WHERE user_id = $${paramIndex}`,
      values
    );

    logger.info('[AutomationController] Updated automation settings', { userId, updates });

    ApiResponse.success(res, { message: 'Automation settings updated successfully' });
  });

  /**
   * Test automation for a specific activity
   * POST /api/automation/test
   */
  testAutomation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { activityLogId, messageType } = req.body;

    if (!activityLogId || !messageType) {
      throw ApiError.badRequest('activityLogId and messageType are required');
    }

    if (!['reminder', 'start', 'followup'].includes(messageType)) {
      throw ApiError.badRequest('messageType must be reminder, start, or followup');
    }

    // Get activity log
    const activityLogResult = await query<{
      id: string;
      user_id: string;
      plan_id: string;
      activity_id: string;
      scheduled_date: Date;
    }>(
      `SELECT id, user_id, plan_id, activity_id, scheduled_date
       FROM activity_logs
       WHERE id = $1 AND user_id = $2`,
      [activityLogId, userId]
    );

    if (activityLogResult.rows.length === 0) {
      throw ApiError.notFound('Activity log not found');
    }

    // Note: This is a simplified test - in production, you'd want to trigger
    // the actual automation service method
    logger.info('[AutomationController] Test automation triggered', {
      userId,
      activityLogId,
      messageType,
    });

    ApiResponse.success(res, {
      message: 'Test automation triggered (check logs for details)',
      activityLogId,
      messageType,
    });
  });

  /**
   * Get automation message history
   * GET /api/automation/logs
   */
  getLogs = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { limit = 50, offset = 0 } = req.query;

    // Get schedule automation logs
    const scheduleLogsResult = await query<{
      id: string;
      schedule_item_id: string;
      message_type: string;
      message_content: string;
      sent_at: Date;
    }>(
      `SELECT id, schedule_item_id, message_type, message_content, sent_at
       FROM schedule_automation_logs
       WHERE user_id = $1
       ORDER BY sent_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    // Get activity automation logs
    const activityLogsResult = await query<{
      id: string;
      activity_log_id: string;
      message_type: string;
      message_content: string;
      sent_at: Date;
    }>(
      `SELECT id, activity_log_id, message_type, message_content, sent_at
       FROM activity_automation_logs
       WHERE user_id = $1
       ORDER BY sent_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    ApiResponse.success(res, {
      scheduleLogs: scheduleLogsResult.rows.map((row) => ({
        id: row.id,
        sourceId: row.schedule_item_id,
        sourceType: 'schedule_item',
        messageType: row.message_type,
        messageContent: row.message_content,
        sentAt: row.sent_at,
      })),
      activityLogs: activityLogsResult.rows.map((row) => ({
        id: row.id,
        sourceId: row.activity_log_id,
        sourceType: 'activity_log',
        messageType: row.message_type,
        messageContent: row.message_content,
        sentAt: row.sent_at,
      })),
    });
  });

  /**
   * Get job status and metrics
   * GET /api/automation/status
   */
  getStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    // Check if user is admin (in production, use proper role check)
    const userResult = await query<{ role: string }>(
      `SELECT r.slug AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].role !== 'admin') {
      throw ApiError.forbidden('Only admins can view job status');
    }

    const metrics = scheduleAutomationJob.getMetrics ? scheduleAutomationJob.getMetrics() : null;
    const isRunning = scheduleAutomationJob.isRunning ? scheduleAutomationJob.isRunning() : false;

    ApiResponse.success(res, {
      isRunning,
      metrics: metrics || {
        totalProcessed: 0,
        totalErrors: 0,
        lastRunTime: null,
        averageProcessingTime: 0,
      },
    });
  });

  /**
   * Auto-create today's schedule and send message
   * POST /api/automation/create-today-schedule
   */
  createTodaySchedule = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    try {
      const result = await scheduleAutomationService.autoCreateTodaySchedule(userId);
      
      if (result.created) {
        ApiResponse.success(res, {
          message: 'Today\'s schedule created and message sent successfully',
          scheduleId: result.scheduleId,
          messageId: result.messageId,
        });
      } else {
        ApiResponse.success(res, {
          message: 'Schedule already exists for today',
          created: false,
        });
      }
    } catch (error) {
      logger.error('[AutomationController] Failed to create today\'s schedule', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw ApiError.internal('Failed to create today\'s schedule');
    }
  });
}

// ============================================
// EXPORTS
// ============================================

export const automationController = new AutomationController();
export default automationController;

