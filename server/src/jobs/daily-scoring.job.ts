/**
 * @file Daily Scoring Job
 * @description Timezone-aware daily scoring job that processes users when their local day ends
 * Runs hourly and processes users whose local midnight just passed
 */

import { query } from '../database/pg.js';
import { logger } from '../services/logger.service.js';
import { aiScoringService } from '../services/ai-scoring.service.js';
import { leaderboardService } from '../services/leaderboard.service.js';

// ============================================
// CONFIGURATION
// ============================================

const JOB_INTERVAL_MS = 60 * 60 * 1000; // Run every hour
let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

// ============================================
// JOB PROCESSOR
// ============================================

/**
 * Process daily scoring for users whose local day just ended
 */
async function processDailyScoring(): Promise<void> {
  if (isRunning) {
    return;
  }

  isRunning = true;

  try {
    // Get current UTC time
    const now = new Date();

    // Find users whose local time is in the first hour of the day (00:00–00:59)
    // so we only process when their local "yesterday" just ended.
    const result = await query<{
      id: string;
      timezone: string;
    }>(
      `SELECT id, timezone
       FROM users
       WHERE timezone IS NOT NULL
         AND is_active = true
         AND EXTRACT(HOUR FROM (NOW() AT TIME ZONE timezone)) = 0
       LIMIT 500`
    );

    let processed = 0;
    let errors = 0;

    for (const user of result.rows) {
      try {
        // Calculate user's local date (yesterday, since we're processing after midnight)
        const yesterday = new Date(now);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);

        // Get user's local date string
        const localDateResult = await query<{ local_date: string }>(
          `SELECT (($1::timestamptz AT TIME ZONE $2)::date)::text as local_date`,
          [yesterday.toISOString(), user.timezone]
        );

        if (localDateResult.rows.length === 0) continue;

        const localDate = localDateResult.rows[0].local_date;

        // Check if score already exists
        const existingScore = await aiScoringService.getDailyScore(user.id, localDate);
        if (existingScore) {
          continue;
        }

        // Calculate score
        const score = await aiScoringService.calculateDailyScore(user.id, yesterday);

        // Save score
        await aiScoringService.saveDailyScore(score);

        processed++;
      } catch (error) {
        errors++;
        logger.error('[DailyScoring] Failed to process user', {
          userId: user.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Continue processing other users
      }
    }

    if (processed > 0) {
      logger.info('[DailyScoring] Processed daily scores', { processed, errors });

      // Trigger leaderboard rank updates
      const datesToUpdate = new Set<string>();
      for (const user of result.rows) {
        try {
          const yesterday = new Date(now);
          yesterday.setUTCDate(yesterday.getUTCDate() - 1);
          const localDateResult = await query<{ local_date: string }>(
            `SELECT (($1::timestamptz AT TIME ZONE $2)::date)::text as local_date`,
            [yesterday.toISOString(), user.timezone]
          );
          if (localDateResult.rows.length > 0) {
            datesToUpdate.add(localDateResult.rows[0].local_date);
          }
        } catch {
          // Skip
        }
      }

      // Update ranks for each unique date
      for (const date of datesToUpdate) {
        await leaderboardService.updateRanks(date).catch((error) => {
          logger.error('[DailyScoring] Failed to update ranks', { date, error });
        });
      }
    }
  } catch (error) {
    logger.error('[DailyScoring] Fatal error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    isRunning = false;
  }
}

// ============================================
// JOB LIFECYCLE
// ============================================

/**
 * Start the daily scoring job
 */
export function startDailyScoring(): void {
  if (intervalId) {
    logger.warn('[DailyScoring] Already running');
    return;
  }

  logger.info('[DailyScoring] Starting daily scoring job', {
    intervalMs: JOB_INTERVAL_MS,
  });

  // Run immediately on start
  processDailyScoring();

  // Then run on interval
  intervalId = setInterval(processDailyScoring, JOB_INTERVAL_MS);
}

/**
 * Stop the daily scoring job
 */
export function stopDailyScoring(): void {
  if (!intervalId) {
    logger.warn('[DailyScoring] Not running');
    return;
  }

  clearInterval(intervalId);
  intervalId = null;

  logger.info('[DailyScoring] Stopped daily scoring job');
}

/**
 * Check if the job is running
 */
export function isDailyScoringRunning(): boolean {
  return intervalId !== null;
}

// ============================================
// EXPORTS
// ============================================

export const dailyScoringJob = {
  start: startDailyScoring,
  stop: stopDailyScoring,
  isRunning: isDailyScoringRunning,
  processNow: processDailyScoring,
};

export default dailyScoringJob;

