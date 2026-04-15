/**
 * Email Controller
 * REST endpoints for email preferences, analytics, unsubscribe, and admin tools.
 */

import type { Request, Response } from 'express';
import { emailEngine } from '../services/email-engine.service.js';
import { emailQueueService } from '../services/email-queue.service.js';
import { query } from '../database/pg.js';
import { logger } from '../services/logger.service.js';
import {
  updatePreferenceSchema,
  emailCategorySchema,
  emailAnalyticsQuerySchema,
  emailLogsQuerySchema,
  sendTestEmailSchema,
} from '../validators/email.validator.js';

// ============================================================================
// User Preferences
// ============================================================================

/**
 * GET /api/email/preferences
 * Get current user's email preferences
 */
export async function getPreferences(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const preferences = await emailEngine.getPreferences(userId);
    res.json({ preferences });
  } catch (error) {
    logger.error('[EmailController] Failed to get preferences', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({ error: 'Failed to get email preferences' });
  }
}

/**
 * PUT /api/email/preferences/:category
 * Update a specific email preference
 */
export async function updatePreference(req: Request, res: Response): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const categoryParse = emailCategorySchema.safeParse(req.params['category']);
    if (!categoryParse.success) {
      res.status(400).json({ error: 'Invalid category', details: categoryParse.error.errors });
      return;
    }

    const bodyParse = updatePreferenceSchema.safeParse(req.body);
    if (!bodyParse.success) {
      res.status(400).json({ error: 'Invalid body', details: bodyParse.error.errors });
      return;
    }

    await emailEngine.updatePreference(
      userId,
      categoryParse.data,
      bodyParse.data.enabled,
      bodyParse.data.frequency,
    );

    res.json({ success: true, category: categoryParse.data, enabled: bodyParse.data.enabled });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('Cannot disable transactional')) {
      res.status(400).json({ error: message });
      return;
    }
    logger.error('[EmailController] Failed to update preference', { error: message });
    res.status(500).json({ error: 'Failed to update email preference' });
  }
}

// ============================================================================
// Unsubscribe (Public — no auth required)
// ============================================================================

/**
 * GET /api/email/unsubscribe/:token
 * One-click unsubscribe via email link
 */
export async function unsubscribe(req: Request, res: Response): Promise<void> {
  try {
    const token = req.params['token'];
    if (!token) {
      res.status(400).json({ error: 'Missing unsubscribe token' });
      return;
    }

    const result = await emailEngine.processUnsubscribe(token);

    if (result.success) {
      // Return a simple HTML page confirming unsubscribe
      res.setHeader('Content-Type', 'text/html');
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Unsubscribed - Balencia</title>
        <style>body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb;}
        .card{max-width:400px;text-align:center;padding:40px;background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);}
        h1{font-size:24px;margin:0 0 12px;color:#111827;} p{font-size:15px;color:#6b7280;line-height:1.5;margin:0 0 16px;}
        a{color:#3b82f6;text-decoration:none;font-weight:500;}</style></head>
        <body><div class="card">
          <h1>You've been unsubscribed</h1>
          <p>You won't receive <strong>${result.category}</strong> emails anymore.</p>
          <p>Changed your mind? <a href="${process.env['APP_URL'] || 'https://balencia.app'}/settings">Manage preferences</a></p>
        </div></body></html>
      `);
    } else {
      res.status(404).json({ error: 'Invalid or expired unsubscribe token' });
    }
  } catch (error) {
    logger.error('[EmailController] Unsubscribe failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({ error: 'Failed to process unsubscribe' });
  }
}

// ============================================================================
// Admin: Analytics & Logs
// ============================================================================

/**
 * GET /api/email/analytics
 * Get email analytics (admin)
 */
export async function getAnalytics(req: Request, res: Response): Promise<void> {
  try {
    const parse = emailAnalyticsQuerySchema.safeParse(req.query);
    if (!parse.success) {
      res.status(400).json({ error: 'Invalid query', details: parse.error.errors });
      return;
    }

    const analytics = await emailEngine.getAnalytics(parse.data);
    const queueStats = await emailQueueService.getStats();

    res.json({ analytics, queueStats });
  } catch (error) {
    logger.error('[EmailController] Failed to get analytics', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({ error: 'Failed to get email analytics' });
  }
}

/**
 * GET /api/email/logs
 * Get email logs with pagination (admin)
 */
export async function getLogs(req: Request, res: Response): Promise<void> {
  try {
    const parse = emailLogsQuerySchema.safeParse(req.query);
    if (!parse.success) {
      res.status(400).json({ error: 'Invalid query', details: parse.error.errors });
      return;
    }

    const { page, limit, status, category, template } = parse.data;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: (string | number | boolean | null)[] = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }
    if (category) {
      conditions.push(`category = $${paramIndex++}`);
      params.push(category);
    }
    if (template) {
      conditions.push(`template = $${paramIndex++}`);
      params.push(template);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [logsResult, countResult] = await Promise.all([
      query(
        `SELECT id, user_id, template, subject, recipient, status, category, provider, attempts, last_error, sent_at, created_at
         FROM email_logs ${where}
         ORDER BY created_at DESC
         LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...params, limit, offset]
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM email_logs ${where}`,
        params
      ),
    ]);

    const total = parseInt(countResult.rows[0]?.count || '0');

    res.json({
      logs: logsResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('[EmailController] Failed to get logs', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({ error: 'Failed to get email logs' });
  }
}

/**
 * POST /api/email/test
 * Send a test email (admin, dev only)
 */
export async function sendTestEmail(req: Request, res: Response): Promise<void> {
  try {
    const parse = sendTestEmailSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: 'Invalid body', details: parse.error.errors });
      return;
    }

    const userId = (req as any).user?.id;
    const { template, recipient, data } = parse.data;

    const logId = await emailEngine.send({
      userId,
      template,
      recipient,
      data: data || {},
      category: 'transactional',
      priority: 'high',
    });

    res.json({ success: true, logId });
  } catch (error) {
    logger.error('[EmailController] Failed to send test email', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({ error: 'Failed to send test email' });
  }
}
