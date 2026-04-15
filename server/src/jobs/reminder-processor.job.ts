/**
 * @file Reminder Processor Job
 * Background job that processes scheduled reminders and triggers notifications
 *
 * Architecture:
 * Client → API → Database
 *               ↓
 *         Scheduler / Queue (this job)
 *               ↓
 *      Notification Workers
 *         ↙            ↘
 *  Push / In-App     Email
 */

import { reminderSchedulerService } from '../services/reminder-scheduler.service.js';
import { taskService } from '../services/task.service.js';
import { workoutAlarmService } from '../services/workout-alarm.service.js';
import { notificationService } from '../services/notification.service.js';
import { socketService } from '../services/socket.service.js';
import { mailHelper } from '../helper/mail.js';
import { query } from '../database/pg.js';
import { logger } from '../services/logger.service.js';

// ============================================
// CONFIGURATION
// ============================================

const JOB_INTERVAL_MS = 60 * 1000; // Check every minute
let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

// ============================================
// JOB PROCESSOR
// ============================================

/**
 * Process pending reminders
 * This function is called periodically to check for and trigger due reminders
 */
async function processReminders(): Promise<void> {
  if (isRunning) {
    return;
  }

  isRunning = true;

  try {
    // Process scheduled reminders (meals, workouts, water, etc.)
    const remindersProcessed = await reminderSchedulerService.processReminders();

    if (remindersProcessed > 0) {
      logger.info('[ReminderJob] Processed scheduled reminders', { count: remindersProcessed });
    }

    // Process task reminders (user-created tasks with notifications)
    const tasksProcessed = await taskService.processTaskReminders();

    if (tasksProcessed > 0) {
      logger.info('[ReminderJob] Processed task reminders', { count: tasksProcessed });
    }

    // Process workout alarms
    const alarmsProcessed = await processWorkoutAlarms();

    if (alarmsProcessed > 0) {
      logger.info('[ReminderJob] Processed workout alarms', { count: alarmsProcessed });
    }
  } catch (error) {
    logger.error('[ReminderJob] Failed to process reminders', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    isRunning = false;
  }
}

/**
 * Process workout alarms that are due
 */
async function processWorkoutAlarms(): Promise<number> {
  try {
    const alarms = await workoutAlarmService.getAlarmsToTrigger();
    
    if (alarms.length > 0) {
      logger.info('[ReminderJob] Found alarms to process', {
        count: alarms.length,
        alarmIds: alarms.map(a => a.id),
        alarms: alarms.map(a => ({
          id: a.id,
          userId: a.userId,
          title: a.title,
          nextTriggerAt: a.nextTriggerAt,
          alarmTime: a.alarmTime,
        })),
      });
    }
  
  let processed = 0;

  for (const alarm of alarms) {
    try {
      // Get user timezone to verify trigger time
      const timezone = await workoutAlarmService.getUserTimezone(alarm.userId);
      const now = new Date();
      
      // Convert nextTriggerAt to user's local time for verification
      if (!alarm.nextTriggerAt) {
        logger.warn('[ReminderJob] Alarm has no nextTriggerAt', {
          alarmId: alarm.id,
          userId: alarm.userId,
        });
        continue;
      }
      const nextTriggerDate = new Date(alarm.nextTriggerAt);
      const userLocalTime = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(nextTriggerDate);
      
      const expectedAlarmTime = alarm.alarmTime;
      const actualTriggerTime = userLocalTime;
      
      const timeMatch = expectedAlarmTime === actualTriggerTime.substring(0, 5); // Compare HH:MM
      
      logger.info('[ReminderJob] Triggering alarm - time verification', {
        alarmId: alarm.id,
        userId: alarm.userId,
        title: alarm.title,
        expectedAlarmTime,
        actualTriggerTime,
        nextTriggerAt: alarm.nextTriggerAt,
        timezone,
        timeMatch,
        now: now.toISOString(),
        nowInUserTimezone: new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).format(now),
      });
      
      // If time doesn't match, log a warning but still trigger the alarm
      // The next trigger will be recalculated correctly
      if (!timeMatch) {
        logger.warn('[ReminderJob] Alarm triggered but time mismatch detected', {
          alarmId: alarm.id,
          userId: alarm.userId,
          expectedAlarmTime,
          actualTriggerTime,
          timezone,
          nextTriggerAt: alarm.nextTriggerAt,
        });
      }
      
      // Create in-app notification
      await notificationService.create({
        userId: alarm.userId,
        type: 'reminder',
        title: alarm.title,
        message: alarm.message || "Time for your workout! Let's get moving! 💪",
        icon: '⏰',
        actionUrl: '/dashboard?tab=workouts',
        actionLabel: 'Start Workout',
        category: 'workout',
        priority: 'high',
        relatedEntityType: alarm.workoutPlanId ? 'workout_plan' : undefined,
        relatedEntityId: alarm.workoutPlanId || undefined,
        metadata: {
          alarmId: alarm.id,
          alarmTime: alarm.alarmTime,
        },
      });

      // Emit WebSocket event to client for real-time alarm modal
      try {
        socketService.emitToUser(alarm.userId, 'alarm:triggered', {
          alarmId: alarm.id,
          title: alarm.title,
          message: alarm.message || "Time for your workout! Let's get moving! 💪",
          soundFile: alarm.soundFile || 'alarm.wav',
          soundEnabled: alarm.soundEnabled !== false, // Default to true if not set
          workoutPlanId: alarm.workoutPlanId,
          snoozeMinutes: alarm.snoozeMinutes,
        });
        
        logger.info('[ReminderJob] WebSocket event emitted successfully', {
          alarmId: alarm.id,
          userId: alarm.userId,
          title: alarm.title,
        });
      } catch (socketError) {
        logger.error('[ReminderJob] Failed to emit WebSocket event', {
          alarmId: alarm.id,
          userId: alarm.userId,
          error: socketError instanceof Error ? socketError.message : 'Unknown error',
          stack: socketError instanceof Error ? socketError.stack : undefined,
        });
        // Continue processing even if WebSocket fails
      }

      // Send email if notification type includes email
      if (alarm.notificationType === 'email' || alarm.notificationType === 'all') {
        await sendAlarmEmail(alarm.userId, alarm.title, alarm.message);
      }

      // Mark alarm as triggered and calculate next trigger time
      await workoutAlarmService.markTriggered(alarm.id);

      processed++;

      logger.info('[ReminderJob] Triggered workout alarm', {
        alarmId: alarm.id,
        userId: alarm.userId,
        title: alarm.title,
        notificationType: alarm.notificationType,
      });
    } catch (error) {
      logger.error('[ReminderJob] Failed to trigger workout alarm', {
        alarmId: alarm.id,
        userId: alarm.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Continue processing other alarms even if one fails
    }
  }

  return processed;
  } catch (error) {
    logger.error('[ReminderJob] Fatal error in processWorkoutAlarms', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    // Return 0 to prevent job crash
    return 0;
  }
}

/**
 * Send email notification for alarm
 */
async function sendAlarmEmail(
  userId: string,
  title: string,
  message: string | null
): Promise<void> {
  try {
    // Get user email and name
    const userResult = await query<{ email: string; first_name: string }>(
      `SELECT email, first_name FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      logger.warn('[ReminderJob] User not found for alarm email', { userId });
      return;
    }

    const user = userResult.rows[0];
    const emailContent = message || "It's time for your scheduled workout! Stay consistent and keep pushing towards your goals.";

    // Send email using the mail helper
    await mailHelper.send({
      email: user.email,
      subject: `⏰ ${title} - Balencia`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 28px;">⏰ ${title}</h1>
                    </td>
                  </tr>
                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px 30px;">
                      <p style="color: #333333; font-size: 18px; line-height: 1.6; margin: 0 0 20px 0;">
                        Hey ${user.first_name}! 👋
                      </p>
                      <p style="color: #666666; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                        ${emailContent}
                      </p>
                      <!-- CTA Button -->
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td align="center">
                            <a href="${mailHelper.getAppUrl()}/dashboard?tab=workouts"
                               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                              Start Your Workout 💪
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center;">
                      <p style="color: #999999; font-size: 14px; margin: 0;">
                        You're receiving this because you have alarm notifications enabled.
                        <br>
                        <a href="${mailHelper.getAppUrl()}/dashboard?tab=alarms" style="color: #667eea;">Manage your alarms</a>
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    logger.info('[ReminderJob] Sent alarm email', { userId, email: user.email, title });
  } catch (error) {
    logger.error('[ReminderJob] Failed to send alarm email', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================
// JOB LIFECYCLE
// ============================================

/**
 * Start the reminder processor job
 */
export function startReminderProcessor(): void {
  if (intervalId) {
    logger.warn('[ReminderJob] Already running');
    return;
  }

  logger.info('[ReminderJob] Starting reminder processor', {
    intervalMs: JOB_INTERVAL_MS,
  });

  // Run immediately on start
  processReminders();

  // Then run on interval
  intervalId = setInterval(processReminders, JOB_INTERVAL_MS);
}

/**
 * Stop the reminder processor job
 */
export function stopReminderProcessor(): void {
  if (!intervalId) {
    logger.warn('[ReminderJob] Not running');
    return;
  }

  clearInterval(intervalId);
  intervalId = null;

  logger.info('[ReminderJob] Stopped reminder processor');
}

/**
 * Check if the job is running
 */
export function isReminderProcessorRunning(): boolean {
  return intervalId !== null;
}

// ============================================
// EXPORTS
// ============================================

export const reminderProcessorJob = {
  start: startReminderProcessor,
  stop: stopReminderProcessor,
  isRunning: isReminderProcessorRunning,
  processNow: processReminders,
};

export default reminderProcessorJob;
