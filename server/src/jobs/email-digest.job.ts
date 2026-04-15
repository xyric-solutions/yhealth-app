/**
 * Email Digest Job
 * Background job for weekly digests and re-engagement emails.
 * Follows the same interval + isRunning pattern as proactive-messaging.job.ts.
 */

import { query } from '../database/pg.js';
import { logger } from '../services/logger.service.js';
import { emailEngine } from '../services/email-engine.service.js';
import { emailContentGenerator } from '../services/email-content-generator.service.js';

// ============================================================================
// Configuration
// ============================================================================

const DIGEST_INTERVAL_MS = process.env['EMAIL_DIGEST_INTERVAL_MS']
  ? parseInt(process.env['EMAIL_DIGEST_INTERVAL_MS'], 10)
  : 6 * 60 * 60 * 1000; // Default: every 6 hours (checks conditions, only sends when due)

const STARTUP_DELAY_MS = process.env['EMAIL_DIGEST_STARTUP_DELAY_MS']
  ? parseInt(process.env['EMAIL_DIGEST_STARTUP_DELAY_MS'], 10)
  : 60 * 1000; // Default: 1 minute after server start

// ============================================================================
// State
// ============================================================================

let isRunning = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

// ============================================================================
// Weekly Digest
// ============================================================================

async function processWeeklyDigests(): Promise<number> {
  // Only send on Sundays (or any day in dev if forced)
  const today = new Date();
  const isSunday = today.getUTCDay() === 0;
  const isDevForced = process.env['FORCE_DIGEST_IN_DEV'] === 'true';

  if (!isSunday && !isDevForced) {
    return 0;
  }

  // Find users who opted in for weekly digests and haven't received one this week
  const result = await query<{ user_id: string; email: string; first_name: string }>(
    `SELECT u.id as user_id, u.email, u.first_name
     FROM users u
     LEFT JOIN email_preferences ep ON u.id = ep.user_id AND ep.category = 'digest'
     WHERE u.is_active = true
       AND u.is_email_verified = true
       AND (ep.enabled IS NULL OR ep.enabled = true)
       AND NOT EXISTS (
         SELECT 1 FROM email_logs el
         WHERE el.user_id = u.id
           AND el.template = 'digestSummary'
           AND el.status = 'sent'
           AND el.created_at >= NOW() - INTERVAL '6 days'
       )
     LIMIT 50`
  );

  let sentCount = 0;

  for (const user of result.rows) {
    try {
      const content = await emailContentGenerator.generateWeeklyDigest(user.user_id);

      const weekEnd = new Date();
      const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

      await emailEngine.send({
        userId: user.user_id,
        template: 'digestSummary',
        recipient: user.email,
        subject: content.subject,
        data: {
          firstName: user.first_name || 'there',
          weekStart: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          weekEnd: weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          highlights: content.highlights,
          coachMessage: content.coachMessage,
          insights: content.insights,
          nextWeekFocus: content.nextWeekFocus,
          appUrl: process.env['APP_URL'] || 'https://balencia.app',
        },
        category: 'digest',
        priority: 'low',
      });

      sentCount++;
    } catch (error) {
      logger.error('[EmailDigestJob] Failed to send digest to user', {
        userId: user.user_id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return sentCount;
}

// ============================================================================
// Re-Engagement
// ============================================================================

async function processReEngagement(): Promise<number> {
  // Find inactive users (>7 days) who haven't received re-engagement in 30 days
  const result = await query<{ user_id: string; email: string; first_name: string; days_away: number }>(
    `SELECT u.id as user_id, u.email, u.first_name,
            EXTRACT(DAY FROM NOW() - COALESCE(u.last_login_at, u.created_at))::int as days_away
     FROM users u
     LEFT JOIN email_preferences ep ON u.id = ep.user_id AND ep.category = 'engagement'
     WHERE u.is_active = true
       AND u.is_email_verified = true
       AND (ep.enabled IS NULL OR ep.enabled = true)
       AND COALESCE(u.last_login_at, u.created_at) < NOW() - INTERVAL '7 days'
       AND NOT EXISTS (
         SELECT 1 FROM email_logs el
         WHERE el.user_id = u.id
           AND el.template = 'reEngagement'
           AND el.created_at >= NOW() - INTERVAL '30 days'
       )
     ORDER BY u.last_login_at ASC NULLS FIRST
     LIMIT 20`
  );

  let sentCount = 0;

  for (const user of result.rows) {
    try {
      const content = await emailContentGenerator.generateReEngagementContent(
        user.user_id,
        user.days_away,
      );

      await emailEngine.send({
        userId: user.user_id,
        template: 'reEngagement',
        recipient: user.email,
        subject: content.subject,
        data: {
          firstName: user.first_name || 'there',
          daysAway: user.days_away,
          message: content.message,
          incentives: content.incentives,
          appUrl: process.env['APP_URL'] || 'https://balencia.app',
        },
        category: 'engagement',
        priority: 'low',
      });

      sentCount++;
    } catch (error) {
      logger.error('[EmailDigestJob] Failed to send re-engagement email', {
        userId: user.user_id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return sentCount;
}

// ============================================================================
// Main Job Runner
// ============================================================================

async function runDigestJob(): Promise<void> {
  if (isRunning) {
    logger.debug('[EmailDigestJob] Already running, skipping');
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    logger.info('[EmailDigestJob] Starting email digest job');

    const [digestCount, reEngagementCount] = await Promise.all([
      processWeeklyDigests(),
      processReEngagement(),
    ]);

    const duration = Date.now() - startTime;
    logger.info('[EmailDigestJob] Job completed', {
      digestsSent: digestCount,
      reEngagementSent: reEngagementCount,
      durationMs: duration,
    });
  } catch (error) {
    logger.error('[EmailDigestJob] Job failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      durationMs: Date.now() - startTime,
    });
  } finally {
    isRunning = false;
  }
}

// ============================================================================
// Lifecycle
// ============================================================================

export function startEmailDigestJob(): void {
  logger.info('[EmailDigestJob] Scheduling email digest job', {
    intervalMs: DIGEST_INTERVAL_MS,
    startupDelayMs: STARTUP_DELAY_MS,
  });

  // Staggered startup
  setTimeout(() => {
    runDigestJob();
    intervalId = setInterval(runDigestJob, DIGEST_INTERVAL_MS);
  }, STARTUP_DELAY_MS);
}

export function stopEmailDigestJob(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('[EmailDigestJob] Job stopped');
  }
}
