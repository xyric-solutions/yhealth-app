/**
 * @file Wellbeing Embedding Job
 * @description Background job to process wellbeing embedding queue and generate vector embeddings
 */

import { Worker } from 'bullmq';
import { redisConnection, QueueNames } from '../config/queue.config.js';
import { wellbeingEmbeddingService } from '../services/wellbeing-embedding.service.js';
import { logger } from '../services/logger.service.js';

// ============================================
// TYPES
// ============================================

interface EmbeddingJobData {
  userId: string;
  sourceType: string;
  sourceId: string;
  operation: 'create' | 'update' | 'delete';
  priority?: number;
}

// ============================================
// WORKER
// ============================================

let worker: Worker | null = null;

/**
 * Start the wellbeing embedding worker
 */
export function startWellbeingEmbeddingWorker(): void {
  if (worker) {
    logger.warn('[WellbeingEmbeddingJob] Worker already started');
    return;
  }

  try {
    worker = new Worker(
      QueueNames.EMBEDDING_SYNC,
      async (job) => {
        const data = job.data as EmbeddingJobData;
        
        // Only process wellbeing embeddings
        if (data.sourceType !== 'wellbeing') {
          logger.debug('[WellbeingEmbeddingJob] Skipping non-wellbeing embedding', {
            sourceType: data.sourceType,
            sourceId: data.sourceId,
          });
          return;
        }

        logger.info('[WellbeingEmbeddingJob] Processing wellbeing embedding', {
          userId: data.userId,
          sourceId: data.sourceId,
          operation: data.operation,
        });

        try {
          // Determine wellbeing type from metadata or sourceId pattern
          // For now, we'll need to query the database to determine the type
          // This is a simplified approach - in production, you might want to pass wellbeingType in job data
          const wellbeingType = await determineWellbeingType(data.userId, data.sourceId);
          
          if (!wellbeingType) {
            logger.warn('[WellbeingEmbeddingJob] Could not determine wellbeing type', {
              userId: data.userId,
              sourceId: data.sourceId,
            });
            return;
          }

          // Process the embedding
          await wellbeingEmbeddingService.processEmbedding(
            data.userId,
            wellbeingType,
            data.sourceId,
            data.operation
          );

          logger.info('[WellbeingEmbeddingJob] Successfully processed embedding', {
            userId: data.userId,
            sourceId: data.sourceId,
            operation: data.operation,
            wellbeingType,
          });
        } catch (error) {
          logger.error('[WellbeingEmbeddingJob] Failed to process embedding', {
            userId: data.userId,
            sourceId: data.sourceId,
            operation: data.operation,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          throw error; // Re-throw to mark job as failed
        }
      },
      {
        connection: redisConnection,
        concurrency: 5, // Process 5 jobs concurrently
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 100, // Keep max 100 completed jobs
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours
        },
      }
    );

    worker.on('completed', (job) => {
      logger.debug('[WellbeingEmbeddingJob] Job completed', {
        jobId: job.id,
        sourceId: job.data.sourceId,
      });
    });

    worker.on('failed', (job, err) => {
      logger.error('[WellbeingEmbeddingJob] Job failed', {
        jobId: job?.id,
        sourceId: job?.data?.sourceId,
        error: err.message,
      });
    });

    worker.on('error', (err) => {
      logger.error('[WellbeingEmbeddingJob] Worker error', {
        error: err.message,
      });
    });

    logger.info('[WellbeingEmbeddingJob] Worker started', {
      queueName: QueueNames.EMBEDDING_SYNC,
    });
  } catch (error) {
    logger.error('[WellbeingEmbeddingJob] Failed to start worker', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Stop the wellbeing embedding worker
 */
export function stopWellbeingEmbeddingWorker(): Promise<void> {
  return new Promise((resolve) => {
    if (!worker) {
      resolve();
      return;
    }

    worker.close().then(() => {
      worker = null;
      logger.info('[WellbeingEmbeddingJob] Worker stopped');
      resolve();
    }).catch((error) => {
      logger.error('[WellbeingEmbeddingJob] Error stopping worker', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      worker = null;
      resolve();
    });
  });
}

/**
 * Determine wellbeing type from entry ID
 * This queries the database to find which table the entry belongs to
 */
async function determineWellbeingType(
  userId: string,
  entryId: string
): Promise<'mood' | 'stress' | 'journal' | 'energy' | 'habits' | 'schedule' | null> {
  const { query } = await import('../database/pg.js');
  
  try {
    // Check each wellbeing table
    const checks = [
      { table: 'mood_logs', type: 'mood' as const },
      { table: 'stress_logs', type: 'stress' as const },
      { table: 'journal_entries', type: 'journal' as const },
      { table: 'energy_logs', type: 'energy' as const },
      { table: 'habits', type: 'habits' as const },
      { table: 'schedule_items', type: 'schedule' as const },
    ];

    for (const check of checks) {
      const result = await query(
        `SELECT id FROM ${check.table} WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [entryId, userId]
      );
      
      if (result.rows.length > 0) {
        return check.type;
      }
    }

    return null;
  } catch (error) {
    logger.error('[WellbeingEmbeddingJob] Error determining wellbeing type', {
      userId,
      entryId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

// Export job object for consistency
export const wellbeingEmbeddingJob = {
  start: startWellbeingEmbeddingWorker,
  stop: stopWellbeingEmbeddingWorker,
};

