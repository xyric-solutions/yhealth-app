/**
 * Notification Engine Service
 * Centralized service for creating notifications and delivering them in real-time.
 * All server-side code should use this engine to create notifications,
 * ensuring consistent DB persistence + Socket.IO delivery.
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import { socketService } from './socket.service.js';

// ============================================
// TYPES
// ============================================

interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  icon: string | null;
  image_url: string | null;
  action_url: string | null;
  action_label: string | null;
  category: string | null;
  priority: string;
  is_read: boolean;
  read_at: Date | null;
  is_archived: boolean;
  archived_at: Date | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  metadata: Record<string, unknown> | null;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface SendNotificationOptions {
  userId: string;
  type: string;
  title: string;
  message: string;
  icon?: string;
  imageUrl?: string;
  actionUrl?: string;
  actionLabel?: string;
  category?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  relatedEntityType?: string;
  relatedEntityId?: string;
  metadata?: Record<string, unknown>;
  expiresAt?: string;
}

export interface NotificationCounts {
  unreadCount: number;
  urgentCount: number;
  highCount: number;
}

// ============================================
// NOTIFICATION ENGINE
// ============================================

class NotificationEngine {
  private static instance: NotificationEngine;
  private dedupMap = new Map<string, number>();
  private readonly DEDUP_WINDOW_MS = 60_000; // 60 seconds

  private constructor() {
    // Clean dedup map every 5 minutes
    setInterval(() => this.cleanDedupMap(), 5 * 60_000);
  }

  static getInstance(): NotificationEngine {
    if (!NotificationEngine.instance) {
      NotificationEngine.instance = new NotificationEngine();
    }
    return NotificationEngine.instance;
  }

  /**
   * Create a notification and deliver it in real-time via Socket.IO.
   * Returns the created notification or null if deduped/failed.
   */
  async send(options: SendNotificationOptions): Promise<NotificationRow | null> {
    const {
      userId,
      type,
      title,
      message,
      icon,
      imageUrl,
      actionUrl,
      actionLabel,
      category,
      priority = 'normal',
      relatedEntityType,
      relatedEntityId,
      metadata,
      expiresAt,
    } = options;

    // Dedup check: same user + type + entity within window
    const dedupKey = `${userId}:${type}:${relatedEntityId || 'none'}`;
    const lastSent = this.dedupMap.get(dedupKey);
    if (lastSent && Date.now() - lastSent < this.DEDUP_WINDOW_MS) {
      logger.debug('[NotificationEngine] Deduped notification', { dedupKey });
      return null;
    }

    try {
      // 1. Persist to DB
      const result = await query<NotificationRow>(
        `INSERT INTO notifications (
          user_id, type, title, message, icon, image_url, action_url, action_label,
          category, priority, related_entity_type, related_entity_id, metadata, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          userId,
          type,
          title,
          message,
          icon || null,
          imageUrl || null,
          actionUrl || null,
          actionLabel || null,
          category || null,
          priority,
          relatedEntityType || null,
          relatedEntityId || null,
          metadata ? JSON.stringify(metadata) : null,
          expiresAt || null,
        ]
      );

      const notification = result.rows[0];
      if (!notification) {
        logger.error('[NotificationEngine] INSERT returned no rows', { userId, type });
        return null;
      }

      // Update dedup map
      this.dedupMap.set(dedupKey, Date.now());

      // 2. Emit real-time notification event (lightweight payload)
      socketService.emitToUser(userId, 'notification:new', {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        icon: notification.icon,
        actionUrl: notification.action_url,
        createdAt: notification.created_at.toISOString(),
      });

      // 3. Emit updated unread counts
      const counts = await this.getUnreadCounts(userId);
      socketService.emitToUser(userId, 'notification:count', counts);

      // 4. Trigger email for urgent/high priority notifications (non-blocking)
      if (priority === 'urgent' || priority === 'high') {
        this.triggerEmailForNotification(userId, notification.title, notification.message).catch(() => {});
      }

      logger.info('[NotificationEngine] Sent notification', {
        userId,
        type,
        priority,
        notificationId: notification.id,
      });

      return notification;
    } catch (error) {
      logger.error('[NotificationEngine] Failed to send notification', {
        userId,
        type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Send notifications to multiple users in a batch.
   */
  async sendBatch(
    notifications: SendNotificationOptions[]
  ): Promise<void> {
    for (const options of notifications) {
      await this.send(options);
    }
  }

  /**
   * Get unread notification counts for a user.
   * Reusable by both the engine and the controller.
   */
  async getUnreadCounts(userId: string): Promise<NotificationCounts> {
    try {
      const result = await query<{ count: string; urgent: string; high: string }>(
        `SELECT
          COUNT(*) as count,
          COUNT(*) FILTER (WHERE priority = 'urgent') as urgent,
          COUNT(*) FILTER (WHERE priority = 'high') as high
         FROM notifications
         WHERE user_id = $1
           AND is_read = false
           AND is_archived = false
           AND (expires_at IS NULL OR expires_at > NOW())`,
        [userId]
      );

      return {
        unreadCount: parseInt(result.rows[0]?.count || '0'),
        urgentCount: parseInt(result.rows[0]?.urgent || '0'),
        highCount: parseInt(result.rows[0]?.high || '0'),
      };
    } catch (error) {
      logger.error('[NotificationEngine] Failed to get unread counts', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { unreadCount: 0, urgentCount: 0, highCount: 0 };
    }
  }

  /**
   * Emit updated counts after any read/archive/delete mutation.
   * Call this from the controller after DB mutations.
   */
  async emitCountUpdate(userId: string): Promise<void> {
    const counts = await this.getUnreadCounts(userId);
    socketService.emitToUser(userId, 'notification:count', counts);
  }

  /**
   * Trigger email for high-priority notifications (non-blocking helper)
   */
  private async triggerEmailForNotification(userId: string, title: string, message: string): Promise<void> {
    try {
      // Lazy import to avoid circular dependency
      const { emailEngine } = await import('./email-engine.service.js');

      // Get user email
      const result = await query<{ email: string }>(
        `SELECT email FROM users WHERE id = $1 AND is_email_verified = true`,
        [userId]
      );
      if (result.rows.length === 0) return;

      await emailEngine.send({
        userId,
        template: 'taskReminder',
        recipient: result.rows[0].email,
        data: { title, message, appUrl: process.env['APP_URL'] || 'https://balencia.app' },
        category: 'engagement',
        priority: 'high',
      });
    } catch (error) {
      logger.debug('[NotificationEngine] Email trigger failed (non-critical)', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private cleanDedupMap(): void {
    const now = Date.now();
    for (const [key, timestamp] of this.dedupMap.entries()) {
      if (now - timestamp > this.DEDUP_WINDOW_MS) {
        this.dedupMap.delete(key);
      }
    }
  }
}

export const notificationEngine = NotificationEngine.getInstance();
