import { Queue, QueueEvents } from 'bullmq';
import { redisConnection, queueConfig, QueueNames, JobPriorities } from '../config/queue.config.js';
import { env } from '../config/env.config.js';
import { logger } from './logger.service.js';

// ============================================================================
// Types
// ============================================================================

export interface EmbeddingJobData {
  userId: string;
  sourceType: string;
  sourceId: string;
  operation: 'create' | 'update' | 'delete';
  priority?: number;
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

// ============================================================================
// Embedding Queue Service
// ============================================================================

class EmbeddingQueueService {
  private queue: Queue;
  private queueEvents: QueueEvents;
  private isInitialized: boolean = false;

  constructor() {
    // Queue will be initialized lazily on first use
    this.queue = null as any;
    this.queueEvents = null as any;
  }

  /**
   * Initialize the queue and queue events
   * Called automatically on first use
   */
  private initialize(): void {
    if (this.isInitialized) return;

    // Skip initialization entirely when Redis is not configured
    if (!env.redis.enabled) {
      logger.info('[EmbeddingQueue] Redis not configured, embedding queue disabled');
      this.isInitialized = true; // Prevent repeated init attempts
      return;
    }

    try {
      this.queue = new Queue(QueueNames.EMBEDDING_SYNC, {
        connection: redisConnection,
        defaultJobOptions: queueConfig.defaultJobOptions,
      });

      this.queueEvents = new QueueEvents(QueueNames.EMBEDDING_SYNC, {
        connection: redisConnection,
      });

      this.setupEventListeners();
      this.isInitialized = true;

      // Get Redis connection info for logging (handle both ConnectionOptions and Redis instance)
      const redisInfo = typeof redisConnection === 'object' && 'host' in redisConnection
        ? `${redisConnection.host}:${redisConnection.port}`
        : 'configured';

      logger.info('[EmbeddingQueue] Queue initialized', {
        queueName: QueueNames.EMBEDDING_SYNC,
        redis: redisInfo,
      });
    } catch (error) {
      logger.warn('[EmbeddingQueue] Failed to initialize queue (Redis unavailable?)', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - allow the app to run without Redis/embedding queue
    }
  }

  /**
   * Setup event listeners for queue monitoring
   */
  private setupEventListeners(): void {
    // CRITICAL: Listen for 'error' on the Queue instance itself.
    // Without this, ioredis connection errors become uncaught exceptions
    // that crash the server via process.exit(1).
    this.queue.on('error', (error) => {
      logger.error('[EmbeddingQueue] Queue connection error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });

    this.queueEvents.on('completed', ({ jobId }) => {
      logger.debug('[EmbeddingQueue] Job completed', { jobId });
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error('[EmbeddingQueue] Job failed', { jobId, failedReason });
    });

    this.queueEvents.on('progress', ({ jobId, data }) => {
      logger.debug('[EmbeddingQueue] Job progress', { jobId, progress: data });
    });

    this.queueEvents.on('error', (error) => {
      logger.error('[EmbeddingQueue] QueueEvents error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });
  }

  /**
   * Enqueue a wellbeing embedding job
   * Convenience method for wellbeing data
   */
  async queueWellbeingEmbedding(
    userId: string,
    _wellbeingType: 'mood' | 'stress' | 'journal' | 'energy' | 'habits' | 'schedule',
    entryId: string,
    operation: 'create' | 'update' | 'delete' = 'create'
  ): Promise<void> {
    await this.enqueueEmbedding({
      userId,
      sourceType: 'wellbeing',
      sourceId: entryId,
      operation,
      priority: JobPriorities.MEDIUM,
    });
  }

  /**
   * Enqueue an embedding job
   * Prevents duplicate jobs by using deterministic jobId and checking for existing jobs
   */
  async enqueueEmbedding(data: EmbeddingJobData): Promise<void> {
    // Initialize queue on first use
    if (!this.isInitialized) {
      this.initialize();
    }

    // If queue failed to initialize (no Redis), silently skip
    if (!this.queue) {
      logger.debug('[EmbeddingQueue] Queue not available, skipping embedding job', {
        sourceType: data.sourceType,
        sourceId: data.sourceId,
      });
      return;
    }

    const jobName = `${data.operation}-${data.sourceType}`;
    const priority = data.priority || JobPriorities.MEDIUM;

    // Use deterministic jobId to prevent duplicates
    // Format: sourceType-sourceId-operation
    const jobId = `${data.sourceType}-${data.sourceId}-${data.operation}`;

    try {
      // Guard against Redis hanging — timeout after 5 seconds
      const withTimeout = <T>(promise: Promise<T>, ms = 5000): Promise<T> =>
        Promise.race([
          promise,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Redis operation timed out')), ms)
          ),
        ]);

      // Check if a job with this ID already exists (waiting or active)
      const existingJob = await withTimeout(this.queue.getJob(jobId));
      
      if (existingJob) {
        const state = await withTimeout(existingJob.getState());
        // If job is waiting or active, skip adding a duplicate
        if (state === 'waiting' || state === 'active' || state === 'delayed') {
          logger.debug('[EmbeddingQueue] Job already exists, skipping duplicate', {
            jobId,
            state,
            sourceType: data.sourceType,
            sourceId: data.sourceId,
            operation: data.operation,
          });
          return;
        }
        // If job is completed or failed, remove it first to allow re-queuing
        if (state === 'completed' || state === 'failed') {
          await withTimeout(existingJob.remove());
        }
      }

      await withTimeout(this.queue.add(jobName, data, {
        priority,
        jobId,
        removeOnComplete: {
          age: 3600, // Keep completed jobs for 1 hour
          count: 100, // Keep max 100 completed jobs
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours
        },
      }));

      logger.debug('[EmbeddingQueue] Enqueued embedding job', {
        jobId,
        jobName,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        operation: data.operation,
        priority,
      });
    } catch (error) {
      logger.error('[EmbeddingQueue] Failed to enqueue job', {
        jobId,
        jobName,
        sourceId: data.sourceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - we don't want to fail the main operation if queue is unavailable
    }
  }

  /**
   * Check if the async queue is available (Redis configured and queue initialized).
   * Used by chat services to decide between queued vs fire-and-forget embedding.
   */
  isAvailable(): boolean {
    if (!this.isInitialized) {
      this.initialize();
    }
    return !!this.queue;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<QueueStats> {
    if (!this.isInitialized) {
      this.initialize();
    }

    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.queue.getWaitingCount(),
        this.queue.getActiveCount(),
        this.queue.getCompletedCount(),
        this.queue.getFailedCount(),
        this.queue.getDelayedCount(),
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
        delayed,
      };
    } catch (error) {
      logger.error('[EmbeddingQueue] Failed to get queue stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      };
    }
  }

  /**
   * Get failed jobs for debugging
   */
  async getFailedJobs(limit: number = 10): Promise<any[]> {
    if (!this.isInitialized) {
      this.initialize();
    }

    try {
      const failedJobs = await this.queue.getFailed(0, limit - 1);
      return failedJobs.map((job) => ({
        id: job.id,
        name: job.name,
        data: job.data,
        failedReason: job.failedReason,
        stacktrace: job.stacktrace,
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp,
      }));
    } catch (error) {
      logger.error('[EmbeddingQueue] Failed to get failed jobs', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Retry a failed job
   */
  async retryFailedJob(jobId: string): Promise<boolean> {
    if (!this.isInitialized) {
      this.initialize();
    }

    try {
      const job = await this.queue.getJob(jobId);
      if (!job) {
        logger.warn('[EmbeddingQueue] Job not found for retry', { jobId });
        return false;
      }

      await job.retry();
      logger.info('[EmbeddingQueue] Job retry initiated', { jobId });
      return true;
    } catch (error) {
      logger.error('[EmbeddingQueue] Failed to retry job', {
        jobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Pause the queue (for maintenance)
   */
  async pauseQueue(): Promise<void> {
    if (!this.isInitialized) {
      this.initialize();
    }

    await this.queue.pause();
    logger.info('[EmbeddingQueue] Queue paused');
  }

  /**
   * Resume the queue
   */
  async resumeQueue(): Promise<void> {
    if (!this.isInitialized) {
      this.initialize();
    }

    await this.queue.resume();
    logger.info('[EmbeddingQueue] Queue resumed');
  }

  /**
   * Close queue and events (for graceful shutdown)
   */
  async close(): Promise<void> {
    if (!this.isInitialized) return;

    try {
      await this.queue.close();
      await this.queueEvents.close();
      this.isInitialized = false;
      logger.info('[EmbeddingQueue] Queue closed gracefully');
    } catch (error) {
      logger.error('[EmbeddingQueue] Failed to close queue', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

// Export singleton instance
export const embeddingQueueService = new EmbeddingQueueService();
export default embeddingQueueService;
