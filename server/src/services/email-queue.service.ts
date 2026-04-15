/**
 * Email Queue Service
 * BullMQ-powered email delivery queue with inline fallback when Redis is unavailable.
 * Follows the same lazy-init pattern as embedding-queue.service.ts.
 */

import { Queue, QueueEvents } from 'bullmq';
import { redisConnection, queueConfig, QueueNames, JobPriorities } from '../config/queue.config.js';
import { env } from '../config/env.config.js';
import { logger } from './logger.service.js';

// ============================================================================
// Types
// ============================================================================

export type EmailCategory = 'transactional' | 'engagement' | 'digest' | 'coaching' | 'marketing';

export type EmailPriority = 'critical' | 'high' | 'normal' | 'low';

export interface EmailJobData {
  logId: string;
  userId?: string;
  template: string;
  recipient: string;
  subject: string;
  data: Record<string, unknown>;
  category: EmailCategory;
  priority: EmailPriority;
  unsubscribeToken?: string;
}

export interface EmailQueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

// ============================================================================
// Email Queue Service
// ============================================================================

class EmailQueueService {
  private queue: Queue | null = null;
  private queueEvents: QueueEvents | null = null;
  private isInitialized = false;

  /**
   * Initialize the queue lazily on first use
   */
  private initialize(): void {
    if (this.isInitialized) return;

    if (!env.redis.enabled) {
      logger.info('[EmailQueue] Redis not configured, email queue disabled (using inline fallback)');
      this.isInitialized = true;
      return;
    }

    try {
      this.queue = new Queue(QueueNames.EMAIL, {
        connection: redisConnection,
        defaultJobOptions: {
          ...queueConfig.defaultJobOptions,
          removeOnComplete: {
            age: 172800, // Keep completed email jobs for 48 hours
            count: 2000,
          },
        },
      });

      this.queueEvents = new QueueEvents(QueueNames.EMAIL, {
        connection: redisConnection,
      });

      this.setupEventListeners();
      this.isInitialized = true;

      logger.info('[EmailQueue] Queue initialized', {
        queueName: QueueNames.EMAIL,
      });
    } catch (error) {
      logger.warn('[EmailQueue] Failed to initialize queue (Redis unavailable?)', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.isInitialized = true; // Prevent repeated init attempts
    }
  }

  private setupEventListeners(): void {
    if (!this.queue || !this.queueEvents) return;

    this.queue.on('error', (error) => {
      logger.error('[EmailQueue] Queue connection error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });

    this.queueEvents.on('completed', ({ jobId }) => {
      logger.debug('[EmailQueue] Job completed', { jobId });
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error('[EmailQueue] Job failed', { jobId, failedReason });
    });

    this.queueEvents.on('error', (error) => {
      logger.error('[EmailQueue] QueueEvents error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });
  }

  /**
   * Check if the queue is available (Redis connected)
   */
  isAvailable(): boolean {
    if (!this.isInitialized) this.initialize();
    return this.queue !== null;
  }

  /**
   * Enqueue an email for delivery.
   * Creates an email_logs row (status=queued) and adds a BullMQ job.
   * Returns the logId.
   */
  async enqueue(jobData: EmailJobData): Promise<string> {
    if (!this.isInitialized) this.initialize();

    if (!this.queue) {
      // No Redis — return logId, caller handles inline fallback
      return jobData.logId;
    }

    const priorityMap: Record<EmailPriority, number> = {
      critical: JobPriorities.CRITICAL,
      high: JobPriorities.HIGH,
      normal: JobPriorities.MEDIUM,
      low: JobPriorities.LOW,
    };

    try {
      await this.queue.add('send-email', jobData, {
        jobId: `email-${jobData.logId}`,
        priority: priorityMap[jobData.priority] || JobPriorities.MEDIUM,
      });

      logger.debug('[EmailQueue] Email enqueued', {
        logId: jobData.logId,
        template: jobData.template,
        recipient: jobData.recipient,
        priority: jobData.priority,
      });

      return jobData.logId;
    } catch (error) {
      logger.error('[EmailQueue] Failed to enqueue email', {
        logId: jobData.logId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Enqueue multiple emails (for digests/batch sends)
   */
  async enqueueBulk(jobs: EmailJobData[]): Promise<string[]> {
    const logIds: string[] = [];
    for (const job of jobs) {
      const logId = await this.enqueue(job);
      logIds.push(logId);
    }
    return logIds;
  }

  /**
   * Get queue statistics for monitoring
   */
  async getStats(): Promise<EmailQueueStats | null> {
    if (!this.isInitialized) this.initialize();
    if (!this.queue) return null;

    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.queue.getWaitingCount(),
        this.queue.getActiveCount(),
        this.queue.getCompletedCount(),
        this.queue.getFailedCount(),
        this.queue.getDelayedCount(),
      ]);

      return { waiting, active, completed, failed, delayed };
    } catch (error) {
      logger.error('[EmailQueue] Failed to get stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Graceful shutdown
   */
  async close(): Promise<void> {
    try {
      if (this.queueEvents) await this.queueEvents.close();
      if (this.queue) await this.queue.close();
      logger.info('[EmailQueue] Queue closed');
    } catch (error) {
      logger.error('[EmailQueue] Error closing queue', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const emailQueueService = new EmailQueueService();
