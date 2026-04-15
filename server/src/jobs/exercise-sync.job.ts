/**
 * @file Exercise Sync Job
 * Weekly cron job that triggers incremental exercise data sync.
 * Runs every Sunday at 3:00 AM UTC by default.
 */

import { logger } from '../services/logger.service.js';
import { enqueueIncrementalSync } from '../services/exercise-ingestion-queue.service.js';

// ============================================
// CONFIGURATION
// ============================================

const DEFAULT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // Weekly
let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

// ============================================
// JOB PROCESSOR
// ============================================

/**
 * Process exercise sync
 */
async function processExerciseSync(): Promise<void> {
  if (isRunning) {
    logger.debug('[ExerciseSyncJob] Already running, skipping');
    return;
  }

  isRunning = true;

  try {
    logger.info('[ExerciseSyncJob] Starting weekly exercise sync');

    // Enqueue sync for ExerciseDB
    const jobId = await enqueueIncrementalSync('exercisedb');

    logger.info('[ExerciseSyncJob] Sync job enqueued', { jobId });
  } catch (error) {
    logger.error('[ExerciseSyncJob] Failed to enqueue sync', {
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
 * Start the exercise sync job
 */
export function start(): void {
  if (intervalId) {
    logger.warn('[ExerciseSyncJob] Job already started');
    return;
  }

  const intervalMs = parseInt(process.env.EXERCISE_SYNC_INTERVAL_MS || '', 10) || DEFAULT_INTERVAL_MS;

  intervalId = setInterval(processExerciseSync, intervalMs);

  logger.info('[ExerciseSyncJob] Job started', {
    intervalMs,
    intervalHuman: `${(intervalMs / (1000 * 60 * 60)).toFixed(1)} hours`,
  });
}

/**
 * Stop the exercise sync job
 */
export function stop(): void {
  if (!intervalId) {
    logger.warn('[ExerciseSyncJob] Job not started');
    return;
  }

  clearInterval(intervalId);
  intervalId = null;
  logger.info('[ExerciseSyncJob] Job stopped');
}

/**
 * Check if job is currently running
 */
export function getIsRunning(): boolean {
  return isRunning;
}

/**
 * Manually trigger a sync now
 */
export async function processNow(): Promise<void> {
  await processExerciseSync();
}

export const exerciseSyncJob = {
  start,
  stop,
  isRunning: getIsRunning,
  processNow,
};

export default exerciseSyncJob;
