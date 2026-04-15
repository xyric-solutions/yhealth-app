/**
 * @file Life History Digest Job
 * @description Scheduled job that generates daily digest embeddings for users.
 * Runs every 6 hours (4x/day) to catch timezone rollovers.
 * Only generates one digest per user per day via upsert.
 */

import { query } from '../database/pg.js';
import { logger } from '../services/logger.service.js';
import { lifeHistoryEmbeddingService } from '../services/life-history-embedding.service.js';

// ============================================
// CONFIGURATION
// ============================================

const JOB_INTERVAL_MS = 6 * 60 * 60 * 1000; // Every 6 hours
const STARTUP_DELAY_MS = 180 * 1000; // 180s — staggered after daily-analysis (90s)
const BATCH_SIZE = 10;
const INTER_BATCH_DELAY_MS = 2000; // 2 seconds between batches
let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

// ============================================
// JOB PROCESSOR
// ============================================

async function processLifeHistoryDigests(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  try {
    // Find active users who have activity yesterday but no daily digest yet
    const result = await query<{ id: string; activity_date: string }>(
      `SELECT DISTINCT u.id, dates.activity_date
       FROM users u
       CROSS JOIN LATERAL (
         SELECT (CURRENT_DATE - INTERVAL '1 day')::date as activity_date
       ) dates
       WHERE u.is_active = true
         AND (
           EXISTS (SELECT 1 FROM daily_user_scores WHERE user_id = u.id AND date = dates.activity_date)
           OR EXISTS (SELECT 1 FROM workout_logs WHERE user_id = u.id AND date = dates.activity_date)
           OR EXISTS (SELECT 1 FROM meal_logs WHERE user_id = u.id AND date = dates.activity_date)
           OR EXISTS (SELECT 1 FROM mood_logs WHERE user_id = u.id AND DATE(created_at) = dates.activity_date)
           OR EXISTS (SELECT 1 FROM journal_entries WHERE user_id = u.id AND DATE(created_at) = dates.activity_date)
           OR EXISTS (SELECT 1 FROM habit_logs WHERE user_id = u.id AND date = dates.activity_date)
         )
         AND NOT EXISTS (
           SELECT 1 FROM user_life_history
           WHERE user_id = u.id AND event_date = dates.activity_date AND entry_type = 'daily_digest'
         )
       LIMIT 50`,
    );

    if (result.rows.length === 0) {
      logger.debug('[LifeHistoryJob] No users need daily digests');
      return;
    }

    let processed = 0;
    let errors = 0;

    for (let i = 0; i < result.rows.length; i += BATCH_SIZE) {
      const batch = result.rows.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async (user) => {
          try {
            await lifeHistoryEmbeddingService.generateDailyDigest(user.id, user.activity_date);
            processed++;
          } catch (error) {
            errors++;
            logger.error('[LifeHistoryJob] Failed to generate digest', {
              userId: user.id.slice(0, 8),
              date: user.activity_date,
              error: error instanceof Error ? error.message : 'Unknown',
            });
          }
        }),
      );

      if (i + BATCH_SIZE < result.rows.length) {
        await new Promise((resolve) => setTimeout(resolve, INTER_BATCH_DELAY_MS));
      }
    }

    if (processed > 0 || errors > 0) {
      logger.info('[LifeHistoryJob] Processing complete', { processed, errors, total: result.rows.length });
    }
  } catch (error) {
    logger.error('[LifeHistoryJob] Fatal error', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
  } finally {
    isRunning = false;
  }
}

// ============================================
// JOB LIFECYCLE
// ============================================

function startLifeHistoryDigest(): void {
  if (intervalId) {
    logger.warn('[LifeHistoryJob] Already running');
    return;
  }

  logger.info('[LifeHistoryJob] Starting life history digest job', {
    intervalMs: JOB_INTERVAL_MS,
    startupDelayMs: STARTUP_DELAY_MS,
    batchSize: BATCH_SIZE,
  });

  setTimeout(() => {
    processLifeHistoryDigests();
    intervalId = setInterval(processLifeHistoryDigests, JOB_INTERVAL_MS);
  }, STARTUP_DELAY_MS);
}

function stopLifeHistoryDigest(): void {
  if (!intervalId) return;
  clearInterval(intervalId);
  intervalId = null;
  logger.info('[LifeHistoryJob] Stopped');
}

function isLifeHistoryDigestRunning(): boolean {
  return intervalId !== null;
}

// ============================================
// EXPORTS
// ============================================

export const lifeHistoryDigestJob = {
  start: startLifeHistoryDigest,
  stop: stopLifeHistoryDigest,
  isRunning: isLifeHistoryDigestRunning,
  processNow: processLifeHistoryDigests,
};

export default lifeHistoryDigestJob;
