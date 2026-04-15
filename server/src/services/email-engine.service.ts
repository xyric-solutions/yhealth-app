/**
 * Email Engine Service
 * Centralized orchestrator for all outbound email.
 * Routes emails through preferences check → logging → queue (or inline fallback).
 */

import { randomUUID } from 'crypto';
import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import { mailHelper, EMAIL_SUBJECTS } from '../helper/mail.js';
import { emailQueueService, type EmailCategory, type EmailPriority, type EmailJobData } from './email-queue.service.js';

// ============================================================================
// Types
// ============================================================================

export interface SendEmailOptions {
  userId?: string;
  template: string;
  recipient: string;
  subject?: string;
  data: Record<string, unknown>;
  category?: EmailCategory;
  priority?: EmailPriority;
}

export interface EmailPreference {
  category: string;
  enabled: boolean;
  frequency: string;
}

export interface EmailAnalytics {
  totalSent: number;
  totalFailed: number;
  totalQueued: number;
  byTemplate: Array<{ template: string; count: number }>;
  byCategory: Array<{ category: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
}

// ============================================================================
// Email Engine
// ============================================================================

class EmailEngine {
  private static instance: EmailEngine;

  private constructor() {}

  static getInstance(): EmailEngine {
    if (!EmailEngine.instance) {
      EmailEngine.instance = new EmailEngine();
    }
    return EmailEngine.instance;
  }

  /**
   * Core send method — all email goes through here.
   * Returns the email log ID, or null if skipped/failed.
   */
  async send(options: SendEmailOptions): Promise<string | null> {
    const {
      userId,
      template,
      recipient,
      subject = this.resolveSubject(template),
      data,
      category = 'engagement',
      priority = 'normal',
    } = options;

    // Check preferences for non-transactional emails
    if (userId && category !== 'transactional') {
      const allowed = await this.checkPreferences(userId, category);
      if (!allowed) {
        logger.debug('[EmailEngine] Email skipped — user opted out', {
          userId,
          category,
          template,
        });
        return null;
      }
    }

    try {
      // Generate unsubscribe token for non-transactional
      let unsubscribeToken: string | undefined;
      if (userId && category !== 'transactional') {
        unsubscribeToken = await this.ensureUnsubscribeToken(userId, category);
      }

      // Create email log entry
      const logId = randomUUID();
      await query(
        `INSERT INTO email_logs (id, user_id, template, subject, recipient, status, category, metadata)
         VALUES ($1, $2, $3, $4, $5, 'queued', $6, $7)`,
        [
          logId,
          userId || null,
          template,
          subject,
          recipient,
          category,
          JSON.stringify({ priority, templateData: Object.keys(data) }),
        ]
      );

      // Route: queue (if Redis available) or inline fallback
      if (emailQueueService.isAvailable()) {
        const jobData: EmailJobData = {
          logId,
          userId: userId || undefined,
          template,
          recipient,
          subject,
          data,
          category,
          priority,
          unsubscribeToken,
        };

        await emailQueueService.enqueue(jobData);
        return logId;
      }

      // Inline fallback — send immediately
      return await this.sendInline(logId, template, recipient, subject, data, unsubscribeToken);
    } catch (error) {
      logger.error('[EmailEngine] Failed to send email', {
        userId,
        template,
        recipient,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Send transactional email (always inline, bypasses queue and preferences).
   * For auth emails, security alerts, etc. that can't wait.
   */
  async sendTransactional(options: Omit<SendEmailOptions, 'category' | 'priority'>): Promise<boolean> {
    const { userId, template, recipient, subject = this.resolveSubject(template), data } = options;

    try {
      // Log it
      const logId = randomUUID();
      await query(
        `INSERT INTO email_logs (id, user_id, template, subject, recipient, status, category)
         VALUES ($1, $2, $3, $4, $5, 'queued', 'transactional')`,
        [logId, userId || null, template, subject, recipient]
      );

      const result = await this.sendInline(logId, template, recipient, subject, data);
      return result !== null;
    } catch (error) {
      logger.error('[EmailEngine] Transactional email failed', {
        template,
        recipient,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Send engagement email (queued, respects preferences)
   */
  async sendEngagement(options: Omit<SendEmailOptions, 'category'>): Promise<string | null> {
    return this.send({ ...options, category: 'engagement' });
  }

  /**
   * Send email inline (bypass queue)
   */
  private async sendInline(
    logId: string,
    template: string,
    recipient: string,
    subject: string,
    data: Record<string, unknown>,
    unsubscribeToken?: string,
  ): Promise<string | null> {
    try {
      const appUrl = process.env['APP_URL'] || 'http://localhost:3000';
      const result = await mailHelper.send({
        email: recipient,
        subject,
        template,
        data: {
          ...data,
          unsubscribeUrl: unsubscribeToken ? `${appUrl}/api/email/unsubscribe/${unsubscribeToken}` : undefined,
        },
      });

      if (result) {
        await query(
          `UPDATE email_logs SET status = 'sent', sent_at = NOW(), attempts = 1, updated_at = NOW() WHERE id = $1`,
          [logId]
        );
        return logId;
      } else {
        await query(
          `UPDATE email_logs SET status = 'failed', last_error = 'MailHelper returned false', attempts = 1, updated_at = NOW() WHERE id = $1`,
          [logId]
        );
        return null;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await query(
        `UPDATE email_logs SET status = 'failed', last_error = $1, attempts = 1, updated_at = NOW() WHERE id = $2`,
        [errorMsg.substring(0, 2000), logId]
      ).catch(() => {});
      return null;
    }
  }

  // ============================================================================
  // Preferences
  // ============================================================================

  /**
   * Check if user has opted in for a category (default: true if no preference exists)
   */
  async checkPreferences(userId: string, category: string): Promise<boolean> {
    try {
      const result = await query<{ enabled: boolean }>(
        `SELECT enabled FROM email_preferences WHERE user_id = $1 AND category = $2`,
        [userId, category]
      );
      // Default to enabled if no preference set
      return result.rows.length === 0 || result.rows[0].enabled;
    } catch {
      return true; // Default to sending on error
    }
  }

  /**
   * Get all email preferences for a user
   */
  async getPreferences(userId: string): Promise<EmailPreference[]> {
    const categories: EmailCategory[] = ['transactional', 'engagement', 'digest', 'coaching', 'marketing'];

    const result = await query<{ category: string; enabled: boolean; frequency: string }>(
      `SELECT category, enabled, frequency FROM email_preferences WHERE user_id = $1`,
      [userId]
    );

    const existing = new Map(result.rows.map(r => [r.category, r]));

    return categories.map(cat => ({
      category: cat,
      enabled: existing.get(cat)?.enabled ?? (cat === 'transactional' ? true : true),
      frequency: existing.get(cat)?.frequency ?? 'immediate',
    }));
  }

  /**
   * Update a preference for a user + category
   */
  async updatePreference(
    userId: string,
    category: string,
    enabled: boolean,
    frequency?: string,
  ): Promise<void> {
    // Don't allow disabling transactional emails
    if (category === 'transactional' && !enabled) {
      throw new Error('Cannot disable transactional emails');
    }

    await query(
      `INSERT INTO email_preferences (user_id, category, enabled, frequency)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, category) DO UPDATE SET
         enabled = EXCLUDED.enabled,
         frequency = COALESCE(EXCLUDED.frequency, email_preferences.frequency),
         updated_at = NOW()`,
      [userId, category, enabled, frequency || 'immediate']
    );
  }

  // ============================================================================
  // Unsubscribe
  // ============================================================================

  /**
   * Ensure an unsubscribe token exists for a user + category, return it
   */
  private async ensureUnsubscribeToken(userId: string, category: string): Promise<string> {
    const result = await query<{ unsubscribe_token: string }>(
      `SELECT unsubscribe_token FROM email_preferences
       WHERE user_id = $1 AND category = $2 AND unsubscribe_token IS NOT NULL`,
      [userId, category]
    );

    if (result.rows.length > 0 && result.rows[0].unsubscribe_token) {
      return result.rows[0].unsubscribe_token;
    }

    // Generate and upsert
    const token = randomUUID();
    await query(
      `INSERT INTO email_preferences (user_id, category, unsubscribe_token)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, category) DO UPDATE SET
         unsubscribe_token = EXCLUDED.unsubscribe_token,
         updated_at = NOW()`,
      [userId, category, token]
    );

    return token;
  }

  /**
   * Process unsubscribe via token (public, no auth)
   */
  async processUnsubscribe(token: string): Promise<{ success: boolean; category: string | null }> {
    try {
      const result = await query<{ user_id: string; category: string }>(
        `UPDATE email_preferences SET enabled = false, updated_at = NOW()
         WHERE unsubscribe_token = $1
         RETURNING user_id, category`,
        [token]
      );

      if (result.rows.length === 0) {
        return { success: false, category: null };
      }

      logger.info('[EmailEngine] User unsubscribed via token', {
        userId: result.rows[0].user_id,
        category: result.rows[0].category,
      });

      return { success: true, category: result.rows[0].category };
    } catch (error) {
      logger.error('[EmailEngine] Failed to process unsubscribe', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { success: false, category: null };
    }
  }

  // ============================================================================
  // Analytics
  // ============================================================================

  /**
   * Get email analytics with optional filters
   */
  async getAnalytics(filters?: {
    userId?: string;
    template?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<EmailAnalytics> {
    const conditions: string[] = [];
    const params: (string | number | boolean | null)[] = [];
    let paramIndex = 1;

    if (filters?.userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(filters.userId);
    }
    if (filters?.template) {
      conditions.push(`template = $${paramIndex++}`);
      params.push(filters.template);
    }
    if (filters?.startDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(filters.endDate);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [totals, byTemplate, byCategory, byStatus] = await Promise.all([
      query<{ total_sent: string; total_failed: string; total_queued: string }>(
        `SELECT
          COUNT(*) FILTER (WHERE status = 'sent') as total_sent,
          COUNT(*) FILTER (WHERE status = 'failed') as total_failed,
          COUNT(*) FILTER (WHERE status = 'queued') as total_queued
         FROM email_logs ${where}`,
        params
      ),
      query<{ template: string; count: string }>(
        `SELECT template, COUNT(*) as count FROM email_logs ${where}
         GROUP BY template ORDER BY count DESC LIMIT 20`,
        params
      ),
      query<{ category: string; count: string }>(
        `SELECT category, COUNT(*) as count FROM email_logs ${where}
         GROUP BY category ORDER BY count DESC`,
        params
      ),
      query<{ status: string; count: string }>(
        `SELECT status, COUNT(*) as count FROM email_logs ${where}
         GROUP BY status ORDER BY count DESC`,
        params
      ),
    ]);

    const t = totals.rows[0];
    return {
      totalSent: parseInt(t?.total_sent || '0'),
      totalFailed: parseInt(t?.total_failed || '0'),
      totalQueued: parseInt(t?.total_queued || '0'),
      byTemplate: byTemplate.rows.map(r => ({ template: r.template, count: parseInt(r.count) })),
      byCategory: byCategory.rows.map(r => ({ category: r.category, count: parseInt(r.count) })),
      byStatus: byStatus.rows.map(r => ({ status: r.status, count: parseInt(r.count) })),
    };
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private resolveSubject(template: string): string {
    const key = template as keyof typeof EMAIL_SUBJECTS;
    return EMAIL_SUBJECTS[key] || `Balencia — ${template.replace(/[-_]/g, ' ')}`;
  }
}

export const emailEngine = EmailEngine.getInstance();
