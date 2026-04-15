/**
 * @file Activity Ingestion Service
 * @description Validates, normalizes, and ingests activity events from multiple sources
 * Publishes to event bus for async processing
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import { Queue } from 'bullmq';
import { redisConnection, queueConfig, QueueNames, JobPriorities } from '../config/queue.config.js';
import { env } from '../config/env.config.js';
import crypto from 'crypto';

// ============================================
// TYPES
// ============================================

export type ActivityEventType = 'workout' | 'nutrition' | 'wellbeing' | 'participation';
export type ActivityEventSource = 'manual' | 'whoop' | 'apple_health' | 'fitbit' | 'garmin' | 'oura' | 'camera_session' | 'integration';

export interface ActivityEventPayload {
  [key: string]: unknown;
}

export interface ActivityEventInput {
  type: ActivityEventType;
  source: ActivityEventSource;
  timestamp: string; // ISO 8601
  payload: ActivityEventPayload;
  idempotencyKey?: string;
}

export interface ActivityEvent {
  id: string;
  userId: string;
  type: ActivityEventType;
  source: ActivityEventSource;
  timestamp: Date;
  payload: ActivityEventPayload;
  confidence: number;
  flags: {
    verified?: boolean;
    anomaly_detected?: boolean;
    requires_review?: boolean;
  };
  idempotencyKey?: string;
  createdAt: Date;
}

// Confidence scores by source
const CONFIDENCE_SCORES: Record<ActivityEventSource, number> = {
  manual: 0.8,
  whoop: 0.95,
  apple_health: 0.95,
  fitbit: 0.95,
  garmin: 0.95,
  oura: 0.95,
  camera_session: 1.0,
  integration: 0.9,
};

// ============================================
// SERVICE
// ============================================

class ActivityIngestionService {
  private eventQueue: Queue | null = null;

  /**
   * Initialize event queue
   */
  private initializeQueue(): void {
    if (this.eventQueue) return;

    if (!env.redis.enabled) {
      logger.info('[ActivityIngestion] Redis not configured, event queue disabled');
      return;
    }

    try {
      this.eventQueue = new Queue(QueueNames.ACTIVITY_EVENT_PROCESSING, {
        connection: redisConnection,
        defaultJobOptions: queueConfig.defaultJobOptions,
      });
      this.eventQueue.on('error', (error) => {
        logger.error('[ActivityIngestion] Queue connection error', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });
      logger.info('[ActivityIngestion] Event queue initialized');
    } catch (error) {
      logger.error('[ActivityIngestion] Failed to initialize queue', { error });
    }
  }

  /**
   * Generate idempotency key from event data
   */
  private generateIdempotencyKey(
    userId: string,
    type: ActivityEventType,
    timestamp: string,
    payload: ActivityEventPayload
  ): string {
    const payloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex')
      .substring(0, 16);
    return `${userId}:${type}:${timestamp}:${payloadHash}`;
  }

  /**
   * Validate event input
   */
  private validateEvent(input: ActivityEventInput): void {
    if (!input.type || !['workout', 'nutrition', 'wellbeing', 'participation'].includes(input.type)) {
      throw new Error('Invalid event type');
    }

    if (!input.source) {
      throw new Error('Event source is required');
    }

    if (!input.timestamp) {
      throw new Error('Event timestamp is required');
    }

    if (!input.payload || typeof input.payload !== 'object') {
      throw new Error('Event payload is required and must be an object');
    }

    // Validate timestamp is valid ISO 8601
    const timestamp = new Date(input.timestamp);
    if (isNaN(timestamp.getTime())) {
      throw new Error('Invalid timestamp format');
    }
  }

  /**
   * Normalize event data
   */
  private normalizeEvent(input: ActivityEventInput, userId: string): ActivityEventInput {
    return {
      ...input,
      timestamp: new Date(input.timestamp).toISOString(),
      idempotencyKey: input.idempotencyKey || this.generateIdempotencyKey(userId, input.type, input.timestamp, input.payload),
    };
  }

  /**
   * Check for duplicate event (idempotency)
   */
  private async checkDuplicate(userId: string, idempotencyKey: string): Promise<boolean> {
    try {
      const result = await query<{ count: string }>(
        `SELECT COUNT(*) as count 
         FROM activity_events 
         WHERE user_id = $1 AND idempotency_key = $2`,
        [userId, idempotencyKey]
      );

      return parseInt(result.rows[0].count, 10) > 0;
    } catch (error) {
      logger.error('[ActivityIngestion] Error checking duplicate', { error });
      return false;
    }
  }

  /**
   * Detect anomalies in event (basic checks)
   */
  private detectAnomalies(input: ActivityEventInput): { anomaly_detected: boolean; requires_review: boolean } {
    const flags = {
      anomaly_detected: false,
      requires_review: false,
    };

    // Check for impossible values based on type
    if (input.type === 'workout') {
      const duration = (input.payload as { duration_minutes?: number }).duration_minutes;
      if (duration && (duration < 0 || duration > 1440)) {
        flags.anomaly_detected = true;
        flags.requires_review = true;
      }

      const calories = (input.payload as { calories_burned?: number }).calories_burned;
      if (calories && (calories < 0 || calories > 10000)) {
        flags.anomaly_detected = true;
        flags.requires_review = true;
      }
    }

    if (input.type === 'nutrition') {
      const calories = (input.payload as { calories?: number }).calories;
      if (calories && (calories < 0 || calories > 20000)) {
        flags.anomaly_detected = true;
        flags.requires_review = true;
      }
    }

    return flags;
  }

  /**
   * Ingest a single activity event
   */
  async ingestEvent(userId: string, input: ActivityEventInput): Promise<ActivityEvent> {
    // Validate
    this.validateEvent(input);

    // Normalize
    const normalized = this.normalizeEvent(input, userId);

    // Check for duplicates
    if (normalized.idempotencyKey) {
      const isDuplicate = await this.checkDuplicate(userId, normalized.idempotencyKey);
      if (isDuplicate) {
        logger.debug('[ActivityIngestion] Duplicate event detected', { userId, idempotencyKey: normalized.idempotencyKey });
        throw new Error('Duplicate event');
      }
    }

    // Detect anomalies
    const anomalyFlags = this.detectAnomalies(normalized);

    // Calculate confidence
    const confidence = CONFIDENCE_SCORES[normalized.source] || 0.8;

    // Insert event
    const result = await query<{
      id: string;
      user_id: string;
      type: ActivityEventType;
      source: ActivityEventSource;
      timestamp: Date;
      payload: ActivityEventPayload;
      confidence: number;
      flags: Record<string, unknown>;
      idempotency_key: string | null;
      created_at: Date;
    }>(
      `INSERT INTO activity_events 
       (user_id, type, source, timestamp, payload, confidence, flags, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, user_id, type, source, timestamp, payload, confidence, flags, idempotency_key, created_at`,
      [
        userId,
        normalized.type,
        normalized.source,
        normalized.timestamp,
        JSON.stringify(normalized.payload),
        confidence,
        JSON.stringify(anomalyFlags),
        normalized.idempotencyKey || null,
      ]
    );

    const row = result.rows[0];
    const event: ActivityEvent = {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      source: row.source,
      timestamp: row.timestamp,
      payload: row.payload as ActivityEventPayload,
      confidence: parseFloat(row.confidence.toString()),
      flags: (row.flags as { verified?: boolean; anomaly_detected?: boolean; requires_review?: boolean }) || {},
      idempotencyKey: row.idempotency_key || undefined,
      createdAt: row.created_at,
    };

    // Publish to event queue for async processing
    this.initializeQueue();
    if (this.eventQueue) {
      await this.eventQueue.add(
        'process-activity-event',
        {
          eventId: event.id,
          userId: event.userId,
          type: event.type,
          timestamp: event.timestamp.toISOString(),
        },
        {
          priority: JobPriorities.HIGH,
          jobId: `activity-event-${event.id}`,
        }
      ).catch((error) => {
        logger.error('[ActivityIngestion] Failed to enqueue event', { error, eventId: event.id });
      });
    }

    logger.info('[ActivityIngestion] Event ingested', {
      eventId: event.id,
      userId,
      type: event.type,
      source: event.source,
      confidence: event.confidence,
    });

    return event;
  }

  /**
   * Ingest multiple events in batch
   */
  async ingestEvents(userId: string, inputs: ActivityEventInput[]): Promise<ActivityEvent[]> {
    const events: ActivityEvent[] = [];

    for (const input of inputs) {
      try {
        const event = await this.ingestEvent(userId, input);
        events.push(event);
      } catch (error) {
        logger.error('[ActivityIngestion] Failed to ingest event in batch', {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
          input,
        });
        // Continue processing other events
      }
    }

    return events;
  }

  /**
   * Get events for a user
   */
  async getUserEvents(
    userId: string,
    options: {
      type?: ActivityEventType;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ events: ActivityEvent[]; total: number }> {
    let whereClause = 'WHERE user_id = $1';
    const params: (string | number)[] = [userId];
    let paramIndex = 2;

    if (options.type) {
      whereClause += ` AND type = $${paramIndex++}`;
      params.push(options.type);
    }

    if (options.startDate) {
      whereClause += ` AND timestamp >= $${paramIndex++}`;
      params.push(options.startDate);
    }

    if (options.endDate) {
      whereClause += ` AND timestamp <= $${paramIndex++}`;
      params.push(options.endDate);
    }

    // Get total count
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM activity_events ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get events
    const limit = options.limit || 100;
    const offset = options.offset || 0;
    whereClause += ` ORDER BY timestamp DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await query<{
      id: string;
      user_id: string;
      type: ActivityEventType;
      source: ActivityEventSource;
      timestamp: Date;
      payload: ActivityEventPayload;
      confidence: number;
      flags: Record<string, unknown>;
      idempotency_key: string | null;
      created_at: Date;
    }>(`SELECT * FROM activity_events ${whereClause}`, params);

    const events: ActivityEvent[] = result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      type: row.type,
      source: row.source,
      timestamp: row.timestamp,
      payload: row.payload as ActivityEventPayload,
      confidence: parseFloat(row.confidence.toString()),
      flags: (row.flags as { verified?: boolean; anomaly_detected?: boolean; requires_review?: boolean }) || {},
      idempotencyKey: row.idempotency_key || undefined,
      createdAt: row.created_at,
    }));

    return { events, total };
  }
}

// Export singleton instance
export const activityIngestionService = new ActivityIngestionService();
export default activityIngestionService;

