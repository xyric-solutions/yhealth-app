/**
 * @file Stress Reminder Job
 * Background job that sends evening stress check-in prompts at 8 PM local time
 */

import { query } from '../database/pg.js';
import { logger } from '../services/logger.service.js';
import { notificationService } from '../services/notification.service.js';
import { stressService } from '../services/stress.service.js';
import { mailHelper } from '../helper/mail.js';

// ============================================
// CONFIGURATION
// ============================================

const JOB_INTERVAL_MS = 60 * 1000; // Check every minute
const PROMPT_HOUR = 20; // 8 PM
const SUPPRESSION_HOUR = 18; // 6 PM - if logged after this, suppress prompt
let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

// ============================================
// JOB PROCESSOR
// ============================================

/**
 * Process stress reminders for users at 8 PM local time
 */
async function processStressReminders(): Promise<void> {
  if (isRunning) {
    return;
  }

  isRunning = true;

  try {
    // Get current UTC time
    const now = new Date();

    // Get all users with their timezones
    const usersResult = await query<{
      id: string;
      email: string;
      first_name: string;
      timezone: string;
      notification_channels: string;
    }>(
      `SELECT 
        u.id,
        u.email,
        u.first_name,
        COALESCE(up.timezone, 'UTC') as timezone,
        COALESCE(up.notification_channels::text, '{"push": true, "email": true}') as notification_channels
      FROM users u
      LEFT JOIN user_preferences up ON up.user_id = u.id
      WHERE u.email IS NOT NULL
        AND u.email != ''
      `,
      []
    );

    let processed = 0;

    for (const user of usersResult.rows) {
      try {
        // Get user's local time
        const userTimezone = user.timezone || 'UTC';
        const userLocalTime = new Date(
          now.toLocaleString('en-US', { timeZone: userTimezone })
        );
        const userHour = userLocalTime.getHours();
        const userMinute = userLocalTime.getMinutes();

        // Check if it's 8 PM (20:00) in user's local time (within 1 minute window)
        if (userHour !== PROMPT_HOUR || userMinute > 0) {
          continue;
        }

        // Check if user has already logged a "daily" stress log after 6 PM today
        const today = userLocalTime.toISOString().split('T')[0];
        const todayLogs = await stressService.getTodayLogs(user.id);

        // Check if there's a daily log after 6 PM local time
        const hasLoggedAfter6PM = todayLogs.some((log) => {
          if (log.checkInType !== 'daily') return false;

          const logTime = new Date(log.loggedAt);
          const logLocalTime = new Date(
            logTime.toLocaleString('en-US', { timeZone: userTimezone })
          );
          const logHour = logLocalTime.getHours();

          return logHour >= SUPPRESSION_HOUR;
        });

        if (hasLoggedAfter6PM) {
          logger.debug('[StressReminderJob] User already logged daily stress check-in', {
            userId: user.id,
            date: today,
          });
          continue;
        }

        // Parse notification channels
        let notificationChannels: { push?: boolean; email?: boolean } = {};
        try {
          notificationChannels = typeof user.notification_channels === 'string'
            ? JSON.parse(user.notification_channels)
            : user.notification_channels || {};
        } catch {
          notificationChannels = { push: true, email: true };
        }

        // Create in-app notification
        await notificationService.create({
          userId: user.id,
          type: 'reminder',
          title: 'How was your stress today?',
          message: 'Take a moment to check in and log your stress level.',
          icon: '😌',
          actionUrl: '/dashboard?tab=wellbeing',
          actionLabel: 'Log Stress',
          category: 'stress_checkin',
          priority: 'normal',
          metadata: {
            reminderType: 'stress_checkin',
            promptTime: 'evening',
          },
        });

        // Send web push notification if enabled
        if (notificationChannels.push) {
          // Note: Web push implementation would require service worker registration
          // and push subscription management. For now, we create the notification
          // which can be picked up by the frontend push service if configured.
          logger.debug('[StressReminderJob] Push notification created (requires frontend push service)', {
            userId: user.id,
          });
        }

        // Send email notification if push not enabled or as fallback
        if (!notificationChannels.push || notificationChannels.email) {
          try {
            await mailHelper.send({
              email: user.email,
              subject: 'How was your stress today? - Balencia',
              html: `
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>Stress Check-in Reminder</title>
                </head>
                <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
                    <tr>
                      <td align="center">
                        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                          <tr>
                            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
                              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">😌 How was your stress today?</h1>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 40px 30px;">
                              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                Hi ${user.first_name || 'there'},
                              </p>
                              <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                It's time for your evening stress check-in. Taking a moment to reflect on your stress levels helps you understand patterns and take better care of your mental wellbeing.
                              </p>
                              <div style="text-align: center; margin: 30px 0;">
                                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard?tab=wellbeing" 
                                   style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                                  Log Stress Level
                                </a>
                              </div>
                              <p style="color: #666666; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                                This reminder helps you build a consistent habit of tracking your stress. You can log your stress level anytime from the dashboard.
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

            logger.info('[StressReminderJob] Email notification sent', {
              userId: user.id,
              email: user.email,
            });
          } catch (emailError) {
            logger.error('[StressReminderJob] Failed to send email notification', {
              userId: user.id,
              error: emailError instanceof Error ? emailError.message : 'Unknown error',
            });
          }
        }

        processed++;

        logger.info('[StressReminderJob] Stress reminder sent', {
          userId: user.id,
          timezone: userTimezone,
          channels: {
            inApp: true,
            push: notificationChannels.push || false,
            email: notificationChannels.email !== false,
          },
        });
      } catch (error) {
        logger.error('[StressReminderJob] Failed to process reminder for user', {
          userId: user.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Continue processing other users even if one fails
      }
    }

    if (processed > 0) {
      logger.info('[StressReminderJob] Processed stress reminders', { count: processed });
    }
  } catch (error) {
    logger.error('[StressReminderJob] Failed to process stress reminders', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    isRunning = false;
  }
}

// ============================================
// JOB CONTROL
// ============================================

/**
 * Start the stress reminder job
 */
export function startStressReminderJob(): void {
  if (intervalId) {
    logger.warn('[StressReminderJob] Job is already running');
    return;
  }

  logger.info('[StressReminderJob] Starting stress reminder job');
  
  // Run immediately on start (for testing)
  processStressReminders().catch((error) => {
    logger.error('[StressReminderJob] Error in initial run', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  });

  // Then run every minute
  intervalId = setInterval(() => {
    processStressReminders().catch((error) => {
      logger.error('[StressReminderJob] Error in scheduled run', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });
  }, JOB_INTERVAL_MS);
}

/**
 * Stop the stress reminder job
 */
export function stopStressReminderJob(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('[StressReminderJob] Stress reminder job stopped');
  }
}

// Export job object for consistency with reminder-processor.job.ts
export const stressReminderJob = {
  start: startStressReminderJob,
  stop: stopStressReminderJob,
};

