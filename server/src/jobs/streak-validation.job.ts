/**
 * @file Streak Validation Job
 * @description Timezone-aware hourly job that validates user streaks at their local midnight.
 * Each hour it determines which IANA timezones are crossing midnight and runs
 * streak validation (break or freeze) for users in those zones.
 */

import { streakService } from '../services/streak.service.js';
import { logger } from '../services/logger.service.js';

// ============================================
// CONFIGURATION
// ============================================

const JOB_INTERVAL_MS = 60 * 60 * 1000; // Every hour
let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

// ============================================
// TIMEZONE BUCKET MAP
// ============================================

/**
 * Common IANA timezone representatives for each UTC offset (in hours).
 * The streak service queries users by their stored timezone column.
 */
const timezonesByOffset: Record<number, string[]> = {
  0: ['UTC', 'Europe/London'],
  1: ['Europe/Paris', 'Europe/Berlin', 'Africa/Lagos'],
  2: ['Europe/Helsinki', 'Africa/Cairo', 'Europe/Istanbul'],
  3: ['Europe/Moscow', 'Asia/Riyadh', 'Africa/Nairobi'],
  4: ['Asia/Dubai', 'Asia/Tbilisi'],
  5: ['Asia/Karachi', 'Asia/Tashkent'],
  // 5.5 = Asia/Kolkata — handle separately if needed
  6: ['Asia/Dhaka', 'Asia/Almaty'],
  7: ['Asia/Bangkok', 'Asia/Jakarta'],
  8: ['Asia/Shanghai', 'Asia/Singapore', 'Asia/Hong_Kong'],
  9: ['Asia/Tokyo', 'Asia/Seoul'],
  10: ['Australia/Sydney', 'Pacific/Guam'],
  11: ['Pacific/Noumea'],
  12: ['Pacific/Auckland', 'Pacific/Fiji'],
  [-1]: ['Atlantic/Azores', 'Atlantic/Cape_Verde'],
  [-2]: ['America/Noronha'],
  [-3]: ['America/Sao_Paulo', 'America/Argentina/Buenos_Aires'],
  [-4]: ['America/New_York', 'America/Toronto'],
  [-5]: ['America/Chicago', 'America/Mexico_City'],
  [-6]: ['America/Denver'],
  [-7]: ['America/Los_Angeles', 'America/Vancouver'],
  [-8]: ['America/Anchorage'],
  [-9]: ['Pacific/Gambier'],
  [-10]: ['Pacific/Honolulu'],
  [-11]: ['Pacific/Midway'],
};

// ============================================
// JOB PROCESSOR
// ============================================

/**
 * Process streak validation for users whose local midnight just passed.
 */
async function processStreakValidation(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  try {
    // Get current UTC hour
    const now = new Date();
    const utcHour = now.getUTCHours();

    // Find IANA timezones where local time is approximately midnight (00:xx)
    // UTC hour 0 = midnight for UTC+0, UTC hour 1 = midnight for UTC-1, etc.
    const targetOffset = -utcHour; // offset in hours from UTC

    // Normalize to [-11, 12] range
    const normalizedOffset = ((targetOffset % 24) + 24) % 24;
    const adjustedOffset = normalizedOffset > 12 ? normalizedOffset - 24 : normalizedOffset;

    // Get timezones for current midnight bucket
    const timezones = timezonesByOffset[adjustedOffset] || [];

    if (timezones.length === 0) {
      logger.debug('[StreakValidation] No timezones to process for offset', { adjustedOffset });
      return;
    }

    let totalProcessed = 0;
    let totalBroken = 0;
    let totalFrozen = 0;

    for (const tz of timezones) {
      try {
        const result = await streakService.runMidnightValidation(tz);
        totalProcessed += result.usersProcessed;
        totalBroken += result.streaksBroken;
        totalFrozen += result.freezesApplied;
      } catch (err) {
        logger.error(`[StreakValidation] Failed for timezone ${tz}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (totalProcessed > 0) {
      logger.info('[StreakValidation] Completed', {
        timezones: timezones.length,
        usersProcessed: totalProcessed,
        streaksBroken: totalBroken,
        freezesApplied: totalFrozen,
      });
    }
  } catch (error) {
    logger.error('[StreakValidation] Job failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    isRunning = false;
  }
}

// ============================================
// JOB LIFECYCLE
// ============================================

/**
 * Start the streak validation job
 */
export function startStreakValidation(): void {
  if (intervalId) {
    logger.warn('[StreakValidation] Already running');
    return;
  }

  logger.info('[StreakValidation] Starting streak validation job (hourly)', {
    intervalMs: JOB_INTERVAL_MS,
  });

  // Run immediately on start
  processStreakValidation();

  // Then run on interval
  intervalId = setInterval(processStreakValidation, JOB_INTERVAL_MS);
}

/**
 * Stop the streak validation job
 */
export function stopStreakValidation(): void {
  if (!intervalId) {
    logger.warn('[StreakValidation] Not running');
    return;
  }

  clearInterval(intervalId);
  intervalId = null;

  logger.info('[StreakValidation] Stopped streak validation job');
}

/**
 * Check if the job is running
 */
export function isStreakValidationRunning(): boolean {
  return intervalId !== null;
}

// ============================================
// EXPORTS
// ============================================

export const streakValidationJob = {
  start: startStreakValidation,
  stop: stopStreakValidation,
  isRunning: isStreakValidationRunning,
  processNow: processStreakValidation,
};

export default streakValidationJob;
