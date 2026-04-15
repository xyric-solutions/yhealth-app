/**
 * @file Accountability Trigger Evaluation Job
 * Background job that evaluates user-defined accountability triggers
 * and sends social messages when conditions are met.
 *
 * Runs every 2 hours. For each user with accountability enabled:
 * 1. Evaluates all active triggers
 * 2. Optionally attempts AI coach intervention first
 * 3. Sends messages to trusted contacts/groups via existing chat system
 * 4. Evaluates SOS conditions for emergency contacts
 *
 * Consent is checked at EVERY step. No message sent without explicit opt-in.
 */

import { query } from '../database/pg.js';
import { logger } from '../services/logger.service.js';

// ============================================
// CONFIGURATION
// ============================================

const JOB_INTERVAL_MS = process.env.ACCOUNTABILITY_JOB_INTERVAL_MS
  ? parseInt(process.env.ACCOUNTABILITY_JOB_INTERVAL_MS, 10)
  : 2 * 60 * 60 * 1000; // Default: 2 hours
const STARTUP_DELAY_MS = process.env.ACCOUNTABILITY_STARTUP_DELAY_MS
  ? parseInt(process.env.ACCOUNTABILITY_STARTUP_DELAY_MS, 10)
  : 780_000; // 13 minutes (after status pattern analysis at 720s)
const BATCH_SIZE = 5;
const INTER_BATCH_DELAY_MS = 2000;

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;
let startupTimeoutId: NodeJS.Timeout | null = null;

// ============================================
// TIMEZONE HELPER
// ============================================

function getUserLocalHour(timezone: string): number {
  try {
    const now = new Date();
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const localDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const offsetMs = localDate.getTime() - utcDate.getTime();
    const localTime = new Date(now.getTime() + offsetMs);
    return localTime.getUTCHours();
  } catch {
    return new Date().getUTCHours();
  }
}

// ============================================
// JOB PROCESSOR
// ============================================

async function processAccountabilityTriggers(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  const startTime = Date.now();

  try {
    // Get users with accountability enabled
    const usersResult = await query<{ user_id: string; timezone: string }>(
      `SELECT ac.user_id, COALESCE(u.timezone, 'UTC') as timezone
       FROM accountability_consent ac
       JOIN users u ON u.id = ac.user_id AND u.is_active = true
       WHERE ac.enabled = true`
    );

    const users = usersResult.rows;

    if (users.length === 0) {
      logger.debug('[AccountabilityJob] No users with accountability enabled');
      isRunning = false;
      return;
    }

    logger.info('[AccountabilityJob] Starting trigger evaluation', { userCount: users.length });

    let triggered = 0;
    let aiIntervened = 0;
    let blocked = 0;
    let errors = 0;

    // Lazy-load the service to avoid circular imports
    const { accountabilityTriggerService } = await import('../services/accountability-trigger.service.js');

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (user) => {
          try {
            // Skip if user's local time is outside 7AM-10PM
            const localHour = getUserLocalHour(user.timezone);
            if (localHour < 7 || localHour >= 22) return;

            await accountabilityTriggerService.evaluateTriggersForUser(user.user_id);
            triggered++;
          } catch (error) {
            errors++;
            logger.warn('[AccountabilityJob] Error processing user', {
              userId: user.user_id,
              error: error instanceof Error ? error.message : 'unknown',
            });
          }
        })
      );

      // Stagger batches
      if (i + BATCH_SIZE < users.length) {
        await new Promise(resolve => setTimeout(resolve, INTER_BATCH_DELAY_MS));
      }
    }

    // SOS evaluation — check ALL users with SOS enabled (even outside normal hours)
    const sosResult = await query<{ user_id: string }>(
      `SELECT ac.user_id
       FROM accountability_consent ac
       JOIN users u ON u.id = ac.user_id AND u.is_active = true
       WHERE ac.enabled = true AND ac.allow_sos_alerts = true`
    );

    let sosTriggered = 0;
    for (let i = 0; i < sosResult.rows.length; i += BATCH_SIZE) {
      const batch = sosResult.rows.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (user) => {
          try {
            await accountabilityTriggerService.evaluateSOS(user.user_id);
            sosTriggered++;
          } catch (error) {
            logger.warn('[AccountabilityJob] SOS evaluation error', {
              userId: user.user_id,
              error: error instanceof Error ? error.message : 'unknown',
            });
          }
        })
      );
    }

    const duration = Date.now() - startTime;
    logger.info('[AccountabilityJob] Completed', {
      duration: `${duration}ms`,
      usersProcessed: users.length,
      triggered,
      aiIntervened,
      blocked,
      sosTriggered,
      errors,
    });
  } catch (error) {
    logger.error('[AccountabilityJob] Fatal error', {
      error: error instanceof Error ? error.message : 'unknown',
    });
  } finally {
    isRunning = false;
  }
}

// ============================================
// LIFECYCLE
// ============================================

function start(): void {
  if (intervalId) return;

  startupTimeoutId = setTimeout(() => {
    processAccountabilityTriggers();
    intervalId = setInterval(processAccountabilityTriggers, JOB_INTERVAL_MS);
    logger.info('[AccountabilityJob] Started', { intervalMs: JOB_INTERVAL_MS });
  }, STARTUP_DELAY_MS);
}

function stop(): void {
  if (startupTimeoutId) {
    clearTimeout(startupTimeoutId);
    startupTimeoutId = null;
  }
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  logger.info('[AccountabilityJob] Stopped');
}

export const accountabilityTriggerJob = { start, stop };
