/**
 * @file WHOOP Daily Sync Job
 * Runs every hour and syncs WHOOP data for users whose local time is the target hour.
 * Features: parallel user processing, exponential backoff retries, sync_logs entries,
 * automatic backfill for incomplete initial syncs.
 */

import { query } from '../database/pg.js';
import { logger } from '../services/logger.service.js';
import { fetchHistoricalData, isRetryableError } from '../services/whoop-data.service.js';
import type { SyncCounts } from '../services/whoop-data.service.js';
import { socketService } from '../services/socket.service.js';

// ============================================
// CONFIGURATION
// ============================================

const JOB_INTERVAL_MS = 60 * 60 * 1000; // Run every hour
const STARTUP_DELAY_MS = 240 * 1000; // 4-minute delay to let server warm up
const SYNC_HOUR = parseInt(process.env.WHOOP_SYNC_HOUR || '8', 10);
const SYNC_DAYS = 1; // Daily sync fetches last 1 day
const BACKFILL_DAYS = 90; // Initial backfill fetches 90 days

// Parallelism & retry config
const CONCURRENCY = parseInt(process.env.WHOOP_SYNC_CONCURRENCY || '3', 10);
const MAX_RETRIES = parseInt(process.env.WHOOP_SYNC_MAX_RETRIES || '3', 10);
const BASE_BACKOFF_MS = parseInt(process.env.WHOOP_SYNC_BACKOFF_BASE_MS || '2000', 10);
const MAX_BACKFILL_USERS_PER_RUN = 5;

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;
let startupTimeoutId: NodeJS.Timeout | null = null;

// ============================================
// HELPERS
// ============================================

interface SyncUser {
  id: string;
  timezone: string;
  last_sync_at: string | null;
  integration_id: string;
}

/**
 * Run async tasks with concurrency limit (worker pool pattern)
 */
async function processInBatches<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()!;
      await fn(item);
    }
  });
  await Promise.all(workers);
}

/**
 * Sync a single user with retry logic and sync_log entry
 */
async function syncUserWithRetry(user: SyncUser, syncDays: number, syncType: string): Promise<{
  success: boolean;
  counts?: SyncCounts;
  error?: string;
}> {
  const syncStartedAt = new Date();
  let lastError: string | undefined;
  let counts: SyncCounts | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      counts = await fetchHistoricalData(user.id, syncDays);

      // Success — update user_integrations
      await query(
        `UPDATE user_integrations
         SET last_sync_at = NOW(),
             last_sync_status = 'success',
             last_sync_error = NULL,
             sync_retry_count = 0,
             updated_at = NOW()
         WHERE user_id = $1 AND provider = 'whoop'`,
        [user.id]
      );

      // Write sync_log entry
      const duration = Date.now() - syncStartedAt.getTime();
      await writeSyncLog({
        userId: user.id,
        integrationId: user.integration_id,
        syncType,
        startedAt: syncStartedAt,
        durationMs: duration,
        status: 'success',
        counts,
      });

      // Notify frontend
      socketService.emitToUser(user.id, 'whoop-data-synced', {
        syncedAt: new Date().toISOString(),
        type: syncType === 'scheduled' ? 'auto' : syncType,
        ...counts,
      });

      return { success: true, counts };
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error';

      // Don't retry non-transient errors
      if (!isRetryableError(error) || attempt === MAX_RETRIES) {
        logger.error('[WhoopSyncJob] Sync failed (non-retryable or max retries)', {
          userId: user.id.slice(0, 8),
          attempt: attempt + 1,
          maxRetries: MAX_RETRIES,
          error: lastError,
        });
        break;
      }

      // Exponential backoff
      const delay = BASE_BACKOFF_MS * Math.pow(2, attempt);
      logger.warn('[WhoopSyncJob] Retrying sync after transient error', {
        userId: user.id.slice(0, 8),
        attempt: attempt + 1,
        delayMs: delay,
        error: lastError,
      });
      await new Promise(r => setTimeout(r, delay));
    }
  }

  // Failure — update user_integrations
  await query(
    `UPDATE user_integrations
     SET last_sync_status = 'error',
         last_sync_error = $1,
         sync_retry_count = sync_retry_count + 1,
         updated_at = NOW()
     WHERE user_id = $2 AND provider = 'whoop'`,
    [lastError || 'Unknown error', user.id]
  ).catch(e => logger.error('[WhoopSyncJob] Failed to update integration error status', {
    userId: user.id.slice(0, 8),
    error: e instanceof Error ? e.message : 'Unknown error',
  }));

  // Write failure sync_log entry
  const duration = Date.now() - syncStartedAt.getTime();
  await writeSyncLog({
    userId: user.id,
    integrationId: user.integration_id,
    syncType,
    startedAt: syncStartedAt,
    durationMs: duration,
    status: 'error',
    error: lastError,
    counts,
  }).catch(e => logger.error('[WhoopSyncJob] Failed to write sync_log', {
    error: e instanceof Error ? e.message : 'Unknown error',
  }));

  return { success: false, error: lastError };
}

/**
 * Write an entry to sync_logs
 */
async function writeSyncLog(params: {
  userId: string;
  integrationId: string;
  syncType: string;
  startedAt: Date;
  durationMs: number;
  status: string;
  counts?: SyncCounts;
  error?: string;
}): Promise<void> {
  const totalProcessed = params.counts
    ? params.counts.recovery + params.counts.sleep + params.counts.workouts
    : 0;

  await query(
    `INSERT INTO sync_logs (
      user_id, integration_id, provider, sync_type,
      started_at, completed_at, duration_ms,
      status, records_processed, records_created, records_updated, records_skipped,
      sync_errors, date_range_start, date_range_end
    ) VALUES ($1, $2, 'whoop', $3, $4, NOW(), $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      params.userId,
      params.integrationId,
      params.syncType,
      params.startedAt,
      params.durationMs,
      params.status,
      totalProcessed,
      params.counts?.created || 0,
      params.counts?.updated || 0,
      params.counts?.skipped || 0,
      params.error ? JSON.stringify({ message: params.error }) : null,
      new Date(Date.now() - SYNC_DAYS * 24 * 60 * 60 * 1000), // date_range_start
      new Date(), // date_range_end
    ]
  );
}

// ============================================
// JOB PROCESSOR
// ============================================

async function processWhoopSync(): Promise<void> {
  if (isRunning) return;
  isRunning = true;
  const startTime = Date.now();

  try {
    // Find users with active WHOOP integration whose local time is the target hour
    const usersResult = await query<SyncUser>(
      `SELECT u.id, COALESCE(u.timezone, 'UTC') as timezone, ui.last_sync_at, ui.id as integration_id
       FROM users u
       JOIN user_integrations ui ON ui.user_id = u.id
       WHERE ui.provider = 'whoop'
         AND ui.status = 'active'
         AND u.is_active = true
         AND EXTRACT(HOUR FROM (NOW() AT TIME ZONE COALESCE(u.timezone, 'UTC'))) = $1`,
      [SYNC_HOUR]
    );

    const users = usersResult.rows;

    if (users.length === 0) {
      logger.debug(`[WhoopSyncJob] No users in ${SYNC_HOUR}am window this hour`);
    } else {
      logger.info('[WhoopSyncJob] Starting daily WHOOP sync', {
        userCount: users.length,
        syncHour: SYNC_HOUR,
        concurrency: CONCURRENCY,
      });

      let synced = 0;
      let errors = 0;

      // Process users in parallel with concurrency limit
      await processInBatches(users, CONCURRENCY, async (user) => {
        logger.info('[WhoopSyncJob] Syncing WHOOP data', {
          userId: user.id.slice(0, 8),
          timezone: user.timezone,
          lastSync: user.last_sync_at,
        });

        const result = await syncUserWithRetry(user, SYNC_DAYS, 'scheduled');
        if (result.success) {
          synced++;
        } else {
          errors++;
        }
      });

      const duration = Date.now() - startTime;
      logger.info('[WhoopSyncJob] Daily sync complete', {
        synced,
        errors,
        total: users.length,
        durationMs: duration,
        avgPerUserMs: users.length > 0 ? Math.round(duration / users.length) : 0,
      });
    }

    // ---- Backfill Detection ----
    // After main sync, check for users needing initial backfill
    try {
      const pendingBackfills = await query<SyncUser>(
        `SELECT u.id, COALESCE(u.timezone, 'UTC') as timezone, ui.last_sync_at, ui.id as integration_id
         FROM users u
         JOIN user_integrations ui ON ui.user_id = u.id
         WHERE ui.provider = 'whoop'
           AND ui.status = 'active'
           AND ui.initial_sync_complete = false
           AND u.is_active = true
         LIMIT $1`,
        [MAX_BACKFILL_USERS_PER_RUN]
      );

      if (pendingBackfills.rows.length > 0) {
        logger.info('[WhoopSyncJob] Running backfill for incomplete initial syncs', {
          userCount: pendingBackfills.rows.length,
        });

        for (const user of pendingBackfills.rows) {
          try {
            logger.info('[WhoopSyncJob] Backfilling user', { userId: user.id.slice(0, 8) });
            const result = await syncUserWithRetry(user, BACKFILL_DAYS, 'backfill');

            if (result.success) {
              await query(
                `UPDATE user_integrations
                 SET initial_sync_complete = true, updated_at = NOW()
                 WHERE id = $1`,
                [user.integration_id]
              );
              logger.info('[WhoopSyncJob] Backfill complete for user', {
                userId: user.id.slice(0, 8),
                counts: result.counts,
              });
            }
          } catch (error) {
            logger.error('[WhoopSyncJob] Backfill failed for user', {
              userId: user.id.slice(0, 8),
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      }
    } catch (backfillError) {
      logger.error('[WhoopSyncJob] Error checking for pending backfills', {
        error: backfillError instanceof Error ? backfillError.message : 'Unknown error',
      });
    }
  } catch (error) {
    logger.error('[WhoopSyncJob] Job failed', {
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

export function startWhoopSyncJob(): void {
  if (intervalId !== null) {
    logger.warn('[WhoopSyncJob] Job is already running');
    return;
  }

  logger.info('[WhoopSyncJob] Starting WHOOP sync job', {
    intervalMs: JOB_INTERVAL_MS,
    syncHour: SYNC_HOUR,
    concurrency: CONCURRENCY,
    maxRetries: MAX_RETRIES,
    startupDelayMs: STARTUP_DELAY_MS,
  });

  startupTimeoutId = setTimeout(() => {
    startupTimeoutId = null;
    processWhoopSync().catch((error) => {
      logger.error('[WhoopSyncJob] Error in initial run', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });

    intervalId = setInterval(() => {
      processWhoopSync().catch((error) => {
        logger.error('[WhoopSyncJob] Error in scheduled run', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });
    }, JOB_INTERVAL_MS);
  }, STARTUP_DELAY_MS);
}

export function stopWhoopSyncJob(): void {
  logger.info('[WhoopSyncJob] Stopping WHOOP sync job');

  if (startupTimeoutId) {
    clearTimeout(startupTimeoutId);
    startupTimeoutId = null;
  }

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/** Expose processWhoopSync for admin manual trigger */
export { processWhoopSync };

export const whoopSyncJob = {
  start: startWhoopSyncJob,
  stop: stopWhoopSyncJob,
};
