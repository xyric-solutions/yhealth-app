/**
 * @file Exercise Ingestion Queue Service
 * Manages BullMQ jobs for exercise data ingestion.
 * Enqueues batch ingestion and sync jobs.
 */

import { Queue } from 'bullmq';
import { redisConnection, QueueNames, JobTypes, queueConfig } from '../config/queue.config.js';
import { logger } from './logger.service.js';

// ============================================
// QUEUE INSTANCE
// ============================================

let queue: Queue | null = null;

function getQueue(): Queue {
  if (!queue) {
    queue = new Queue(QueueNames.EXERCISE_INGESTION, {
      connection: redisConnection,
      defaultJobOptions: queueConfig.defaultJobOptions,
    });
  }
  return queue;
}

// ============================================
// ENQUEUE OPERATIONS
// ============================================

/**
 * Enqueue a full ingestion split into batch jobs
 */
export async function enqueueFullIngestion(
  source: 'exercisedb' | 'rapidapi',
  options: { batchSize?: number; totalEstimate?: number } = {}
): Promise<string[]> {
  const { batchSize = 500, totalEstimate = 1500 } = options;
  const q = getQueue();
  const jobIds: string[] = [];

  const totalBatches = Math.ceil(totalEstimate / batchSize);

  logger.info('[ExerciseIngestionQueue] Enqueueing full ingestion', {
    source,
    batchSize,
    totalEstimate,
    totalBatches,
  });

  for (let i = 0; i < totalBatches; i++) {
    const job = await q.add(
      JobTypes.INGEST_EXERCISE_BATCH,
      {
        source,
        batchOffset: i * batchSize,
        batchSize,
      },
      {
        priority: 3, // MEDIUM priority
        delay: i * 1000, // Stagger jobs by 1 second to respect rate limits
      }
    );
    if (job.id) jobIds.push(job.id);
  }

  logger.info('[ExerciseIngestionQueue] Full ingestion enqueued', {
    source,
    jobsCreated: jobIds.length,
  });

  return jobIds;
}

/**
 * Enqueue an incremental sync job
 */
export async function enqueueIncrementalSync(
  source: 'exercisedb' | 'rapidapi'
): Promise<string | null> {
  const q = getQueue();

  const job = await q.add(
    JobTypes.SYNC_EXERCISES,
    { source },
    {
      priority: 2, // LOW priority
      jobId: `sync-${source}-${Date.now()}`, // Prevent duplicate sync jobs
    }
  );

  logger.info('[ExerciseIngestionQueue] Sync job enqueued', {
    source,
    jobId: job.id,
  });

  return job.id || null;
}

/**
 * Get current ingestion status
 */
export async function getIngestionStatus(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const q = getQueue();

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    q.getWaitingCount(),
    q.getActiveCount(),
    q.getCompletedCount(),
    q.getFailedCount(),
    q.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

/**
 * Clean up completed/failed jobs
 */
export async function cleanQueue(grace: number = 3600000): Promise<void> {
  const q = getQueue();
  await q.clean(grace, 1000, 'completed');
  await q.clean(grace, 1000, 'failed');
  logger.info('[ExerciseIngestionQueue] Queue cleaned');
}

/**
 * Close the queue connection
 */
export async function closeQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}

// ============================================
// EXPORTS
// ============================================

export const exerciseIngestionQueueService = {
  enqueueFullIngestion,
  enqueueIncrementalSync,
  getIngestionStatus,
  cleanQueue,
  closeQueue,
};

export default exerciseIngestionQueueService;
