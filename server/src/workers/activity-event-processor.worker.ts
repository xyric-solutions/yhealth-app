/**
 * @file Activity Event Processor Worker
 * @description BullMQ worker that processes activity events asynchronously
 * Updates daily scores incrementally and handles deduplication
 */

import { Worker } from 'bullmq';
import { redisConnection, QueueNames } from '../config/queue.config.js';
import { logger } from '../services/logger.service.js';
import { aiScoringService } from '../services/ai-scoring.service.js';

// ============================================
// TYPES
// ============================================

interface ActivityEventJobData {
  eventId: string;
  userId: string;
  type: 'workout' | 'nutrition' | 'wellbeing' | 'participation';
  timestamp: string;
}

// ============================================
// WORKER
// ============================================

let worker: Worker | null = null;

/**
 * Start the activity event processor worker
 */
export function startActivityEventProcessor(): void {
  if (worker) {
    logger.warn('[ActivityEventProcessor] Worker already started');
    return;
  }

  try {
    worker = new Worker(
      QueueNames.ACTIVITY_EVENT_PROCESSING,
      async (job) => {
        const data = job.data as ActivityEventJobData;

        logger.info('[ActivityEventProcessor] Processing activity event', {
          eventId: data.eventId,
          userId: data.userId,
          type: data.type,
        });

        try {
          // Get user's local date for the event timestamp
          const eventDate = new Date(data.timestamp);
          
          // Recalculate daily score for the event date
          // This is incremental - we recalculate the entire day's score
          const score = await aiScoringService.calculateDailyScore(data.userId, eventDate);
          await aiScoringService.saveDailyScore(score);

          logger.info('[ActivityEventProcessor] Updated daily score', {
            eventId: data.eventId,
            userId: data.userId,
            date: score.date,
            totalScore: score.totalScore,
          });
        } catch (error) {
          logger.error('[ActivityEventProcessor] Failed to process event', {
            eventId: data.eventId,
            userId: data.userId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          throw error; // Re-throw to mark job as failed
        }
      },
      {
        connection: redisConnection,
        concurrency: 10, // Process 10 events concurrently
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 1000,
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours
          count: 5000,
        },
      }
    );

    worker.on('completed', (job) => {
      logger.debug('[ActivityEventProcessor] Job completed', {
        jobId: job.id,
        eventId: (job.data as ActivityEventJobData).eventId,
      });
    });

    worker.on('failed', (job, error) => {
      logger.error('[ActivityEventProcessor] Job failed', {
        jobId: job?.id,
        eventId: job ? (job.data as ActivityEventJobData).eventId : 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });

    logger.info('[ActivityEventProcessor] Worker started');
  } catch (error) {
    logger.error('[ActivityEventProcessor] Failed to start worker', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Stop the activity event processor worker
 */
export async function stopActivityEventProcessor(): Promise<void> {
  if (!worker) {
    logger.warn('[ActivityEventProcessor] Worker not started');
    return;
  }

  try {
    await worker.close();
    worker = null;
    logger.info('[ActivityEventProcessor] Worker stopped');
  } catch (error) {
    logger.error('[ActivityEventProcessor] Failed to stop worker', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Check if the worker is running
 */
export function isActivityEventProcessorRunning(): boolean {
  return worker !== null;
}

// ============================================
// EXPORTS
// ============================================

export const activityEventProcessor = {
  start: startActivityEventProcessor,
  stop: stopActivityEventProcessor,
  isRunning: isActivityEventProcessorRunning,
};

export default activityEventProcessor;

