/**
 * @file Exercise Ingestion Worker
 * BullMQ worker for asynchronous exercise data ingestion.
 * Processes batch ingestion and incremental sync jobs.
 */

import { Worker } from 'bullmq';
import { redisConnection, QueueNames, JobTypes } from '../config/queue.config.js';
import { logger } from '../services/logger.service.js';
import {
  fetchFromExerciseDB,
  fetchFromRapidAPI,
  transformExerciseDB,
  transformRapidAPI,
  batchUpsert,
  populateLookupTables,
  invalidateExerciseCache,
} from '../services/exercise-ingestion.service.js';

// ============================================
// TYPES
// ============================================

interface IngestBatchJobData {
  source: 'exercisedb' | 'rapidapi';
  batchOffset: number;
  batchSize: number;
}

interface SyncExercisesJobData {
  source: 'exercisedb' | 'rapidapi';
}

// ============================================
// WORKER
// ============================================

let worker: Worker | null = null;

/**
 * Start the exercise ingestion worker
 */
export function startExerciseIngestionWorker(): void {
  if (worker) {
    logger.warn('[ExerciseIngestionWorker] Worker already started');
    return;
  }

  try {
    worker = new Worker(
      QueueNames.EXERCISE_INGESTION,
      async (job): Promise<void> => {
        const jobType = job.name;

        if (jobType === JobTypes.INGEST_EXERCISE_BATCH) {
          const data = job.data as IngestBatchJobData;
          logger.info('[ExerciseIngestionWorker] Processing ingestion batch', {
            source: data.source,
            offset: data.batchOffset,
            batchSize: data.batchSize,
          });

          // Fetch batch
          const rawExercises = data.source === 'exercisedb'
            ? await fetchFromExerciseDB({ offset: data.batchOffset, limit: data.batchSize })
            : await fetchFromRapidAPI({ offset: data.batchOffset, limit: data.batchSize });

          // Transform
          const transformed = data.source === 'exercisedb'
            ? rawExercises.map(e => transformExerciseDB(e as any))
            : rawExercises.map(e => transformRapidAPI(e as any));

          // Upsert
          const result = await batchUpsert(transformed);

          logger.info('[ExerciseIngestionWorker] Batch complete', {
            source: data.source,
            offset: data.batchOffset,
            inserted: result.inserted,
            updated: result.updated,
            failed: result.failed,
          });
          return;
        }

        if (jobType === JobTypes.SYNC_EXERCISES) {
          const data = job.data as SyncExercisesJobData;
          logger.info('[ExerciseIngestionWorker] Starting sync', { source: data.source });

          // Full sync — fetch all and upsert (idempotent)
          const rawExercises = data.source === 'exercisedb'
            ? await fetchFromExerciseDB()
            : await fetchFromRapidAPI();

          const transformed = data.source === 'exercisedb'
            ? rawExercises.map(e => transformExerciseDB(e as any))
            : rawExercises.map(e => transformRapidAPI(e as any));

          const result = await batchUpsert(transformed);

          // Populate lookup tables after sync
          if (result.inserted > 0) {
            await populateLookupTables();
          }

          // Invalidate cache
          invalidateExerciseCache();

          logger.info('[ExerciseIngestionWorker] Sync complete', {
            source: data.source,
            inserted: result.inserted,
            updated: result.updated,
            failed: result.failed,
          });
          return;
        }

        logger.warn('[ExerciseIngestionWorker] Unknown job type', { jobType });
      },
      {
        connection: redisConnection,
        concurrency: 2, // Limit concurrency to respect API rate limits
        removeOnComplete: {
          age: 86400,  // 24 hours
          count: 500,
        },
        removeOnFail: {
          age: 604800,  // 7 days
          count: 1000,
        },
      }
    );

    worker.on('completed', (job) => {
      logger.debug('[ExerciseIngestionWorker] Job completed', {
        jobId: job.id,
        name: job.name,
      });
    });

    worker.on('failed', (job, error) => {
      logger.error('[ExerciseIngestionWorker] Job failed', {
        jobId: job?.id,
        name: job?.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });

    logger.info('[ExerciseIngestionWorker] Worker started');
  } catch (error) {
    logger.error('[ExerciseIngestionWorker] Failed to start worker', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Stop the exercise ingestion worker
 */
export async function stopExerciseIngestionWorker(): Promise<void> {
  if (!worker) {
    logger.warn('[ExerciseIngestionWorker] Worker not started');
    return;
  }

  try {
    await worker.close();
    worker = null;
    logger.info('[ExerciseIngestionWorker] Worker stopped');
  } catch (error) {
    logger.error('[ExerciseIngestionWorker] Failed to stop worker', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Check if worker is running
 */
export function isWorkerRunning(): boolean {
  return worker !== null;
}
