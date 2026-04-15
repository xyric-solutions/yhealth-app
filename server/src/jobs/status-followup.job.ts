/**
 * @file Status Follow-Up Job
 * Background job that follows up on stale user statuses (sick, travel, etc.)
 * and auto-resets expired statuses after grace periods.
 *
 * Three tiers:
 *  1. Expired + not followed up → send check-in message
 *  2. Expired + followed up + 3 days past → auto-reset to working
 *  3. Extended absence (no end date, >14 days) → gentle nudge
 */

import { query } from '../database/pg.js';
import { logger } from '../services/logger.service.js';
import { activityStatusService } from '../services/activity-status.service.js';
import { statusPlanAdjusterService } from '../services/status-plan-adjuster.service.js';
import { proactiveMessagingService } from '../services/proactive-messaging.service.js';

// ============================================
// CONFIGURATION
// ============================================

const JOB_INTERVAL_MS = process.env.STATUS_FOLLOWUP_INTERVAL_MS
  ? parseInt(process.env.STATUS_FOLLOWUP_INTERVAL_MS, 10)
  : 2 * 60 * 60 * 1000; // Default: 2 hours
const STARTUP_DELAY_MS = process.env.STATUS_FOLLOWUP_STARTUP_DELAY_MS
  ? parseInt(process.env.STATUS_FOLLOWUP_STARTUP_DELAY_MS, 10)
  : 660_000; // Default: 11 minutes
const BATCH_SIZE = 5;
const INTER_BATCH_DELAY_MS = 2000;
let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;
let startupTimeoutId: NodeJS.Timeout | null = null;

// ============================================
// HELPERS
// ============================================

/**
 * Convert current UTC time to user's local time using their IANA timezone.
 * Returns a Date adjusted so getUTCHours()/getUTCDay() return user-local values.
 * Falls back to UTC if timezone is invalid.
 */
function getUserLocalTime(timezone: string): Date {
  try {
    const now = new Date();
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const localDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const utcOffset = (localDate.getTime() - utcDate.getTime()) / (1000 * 60);
    return new Date(now.getTime() + utcOffset * 60 * 1000);
  } catch {
    return new Date();
  }
}

/**
 * Build a follow-up message based on the user's status.
 */
function getFollowUpMessage(status: string): string {
  switch (status) {
    case 'sick':
      return "How are you feeling today? If you're better, I can restore your regular plan. Just let me know!";
    case 'injury':
      return "How's your recovery going? If you're feeling ready, I can adjust your plan back — or keep things light if you need more time.";
    case 'travel':
      return "Are you back from your trip? Let me know and I'll switch you back to your normal routine.";
    case 'vacation':
      return "Welcome back! Hope you had a great break. Ready to ease back into your routine? Just say the word.";
    case 'stress':
      return "How are you doing? If things have calmed down, I can bring back your regular plan with a gentle start.";
    case 'rest':
      return "Feeling rested? If you're ready to get moving again, I'll set up a smooth transition back.";
    default:
      return "Hey! Just checking in — are you ready to get back to your regular routine? Let me know how you're doing.";
  }
}

// ============================================
// JOB PROCESSOR
// ============================================

async function processStatusFollowUps(): Promise<void> {
  if (isRunning) {
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    const statuses = await activityStatusService.getActiveNonWorkingStatuses();

    logger.info('[StatusFollowUpJob] Starting status follow-up check', {
      nonWorkingUsers: statuses.length,
    });

    let followUpsSent = 0;
    let autoResets = 0;
    let extendedNudges = 0;
    let skippedTimeWindow = 0;
    let errors = 0;

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Process in batches
    for (let i = 0; i < statuses.length; i += BATCH_SIZE) {
      const batch = statuses.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (entry) => {
          try {
            // Check user's local time — only process during 6AM-10PM
            const userLocalTime = getUserLocalTime(entry.timezone);
            const userHour = userLocalTime.getUTCHours();
            if (userHour < 6 || userHour >= 22) {
              skippedTimeWindow++;
              return;
            }

            const expectedEnd = entry.expected_end_date
              ? new Date(entry.expected_end_date)
              : null;

            // ── Tier 1: Expired + not followed up ──
            if (expectedEnd && expectedEnd < today && !entry.follow_up_sent) {
              const message = getFollowUpMessage(entry.activity_status);
              await proactiveMessagingService.sendProactiveMessage(
                entry.user_id,
                message,
                'status_followup'
              );
              await activityStatusService.markFollowUpSent(entry.user_id);
              followUpsSent++;
              logger.info('[StatusFollowUpJob] Sent follow-up message', {
                userId: entry.user_id.slice(0, 8),
                status: entry.activity_status,
              });
              return;
            }

            // ── Tier 2: Expired + followed up + 3 days past → auto-reset ──
            if (expectedEnd && entry.follow_up_sent) {
              const threeDaysAfterExpiry = new Date(expectedEnd);
              threeDaysAfterExpiry.setDate(threeDaysAfterExpiry.getDate() + 3);

              if (today >= threeDaysAfterExpiry) {
                // Auto-reset to working
                await activityStatusService.resetToWorking(entry.user_id);
                await statusPlanAdjusterService.clearOverrides(entry.user_id);

                // Send welcome-back message
                await proactiveMessagingService.sendProactiveMessage(
                  entry.user_id,
                  "Welcome back! I've restored your regular plan. Let's ease back in — today's workout will be lighter than usual.",
                  'status_welcome_back'
                );

                // Record auto-reset timestamp
                await query(
                  `UPDATE activity_status_history
                   SET auto_reset_at = NOW()
                   WHERE user_id = $1 AND status_date = $2`,
                  [entry.user_id, entry.status_date]
                );

                autoResets++;
                logger.info('[StatusFollowUpJob] Auto-reset user to working', {
                  userId: entry.user_id.slice(0, 8),
                  previousStatus: entry.activity_status,
                  daysPastExpiry: Math.floor((today.getTime() - expectedEnd.getTime()) / (1000 * 60 * 60 * 24)),
                });
                return;
              }
            }

            // ── Tier 3: Extended absence (no end date, >14 days) ──
            if (!expectedEnd && !entry.follow_up_sent) {
              const daysSinceLastWorking = await activityStatusService.getDaysSinceLastWorkingStatus(entry.user_id);

              if (daysSinceLastWorking > 14) {
                await proactiveMessagingService.sendProactiveMessage(
                  entry.user_id,
                  "It's been a while since your last active day. How are you doing? I'm here whenever you're ready to get back on track.",
                  'status_followup'
                );
                await activityStatusService.markFollowUpSent(entry.user_id);
                extendedNudges++;
                logger.info('[StatusFollowUpJob] Sent extended absence nudge', {
                  userId: entry.user_id.slice(0, 8),
                  daysSinceLastWorking,
                  status: entry.activity_status,
                });
              }
            }
          } catch (error) {
            errors++;
            logger.error('[StatusFollowUpJob] Error processing user', {
              userId: entry.user_id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        })
      );

      // Delay between batches
      if (i + BATCH_SIZE < statuses.length) {
        await new Promise((resolve) => setTimeout(resolve, INTER_BATCH_DELAY_MS));
      }
    }

    const duration = Date.now() - startTime;
    logger.info('[StatusFollowUpJob] Completed status follow-up check', {
      nonWorkingUsers: statuses.length,
      followUpsSent,
      autoResets,
      extendedNudges,
      skippedTimeWindow,
      errors,
      durationMs: duration,
    });
  } catch (error) {
    logger.error('[StatusFollowUpJob] Error in status follow-up job', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  } finally {
    isRunning = false;
  }
}

// ============================================
// JOB CONTROL
// ============================================

export function startStatusFollowUpJob(): void {
  if (intervalId !== null) {
    logger.warn('[StatusFollowUpJob] Job is already running');
    return;
  }

  logger.info('[StatusFollowUpJob] Starting status follow-up job', {
    intervalMs: JOB_INTERVAL_MS,
    startupDelayMs: STARTUP_DELAY_MS,
    batchSize: BATCH_SIZE,
  });

  startupTimeoutId = setTimeout(() => {
    startupTimeoutId = null;
    processStatusFollowUps().catch((error) => {
      logger.error('[StatusFollowUpJob] Error in initial run', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });

    intervalId = setInterval(() => {
      processStatusFollowUps().catch((error) => {
        logger.error('[StatusFollowUpJob] Error in scheduled run', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });
    }, JOB_INTERVAL_MS);
  }, STARTUP_DELAY_MS);
}

export function stopStatusFollowUpJob(): void {
  logger.info('[StatusFollowUpJob] Stopping status follow-up job');

  if (startupTimeoutId) {
    clearTimeout(startupTimeoutId);
    startupTimeoutId = null;
  }

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  const timeout = 30000;
  const startTime = Date.now();
  while (isRunning && Date.now() - startTime < timeout) {
    // Wait for current run to finish
  }

  if (isRunning) {
    logger.warn('[StatusFollowUpJob] Job did not finish within timeout');
  }
}

// ============================================
// EXPORTS
// ============================================

export const statusFollowUpJob = {
  start: startStatusFollowUpJob,
  stop: stopStatusFollowUpJob,
};
