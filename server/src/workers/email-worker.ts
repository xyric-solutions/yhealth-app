/**
 * Email Worker
 * BullMQ worker that processes email delivery jobs from the EMAIL queue.
 * Follows the same pattern as embedding-worker.ts.
 */

import { Worker, Job } from 'bullmq';
import { redisConnection, QueueNames } from '../config/queue.config.js';
import { query } from '../database/pg.js';
import { logger } from '../services/logger.service.js';
import { mailHelper } from '../helper/mail.js';
import type { EmailJobData } from '../services/email-queue.service.js';

// ============================================================================
// Job Processor
// ============================================================================

async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { logId, userId, template, recipient, subject, data, category, unsubscribeToken } = job.data;

  logger.debug('[EmailWorker] Processing email job', {
    jobId: job.id,
    logId,
    template,
    recipient,
    category,
  });

  // Check email preferences (skip for transactional emails)
  if (userId && category !== 'transactional') {
    const prefResult = await query<{ enabled: boolean }>(
      `SELECT enabled FROM email_preferences
       WHERE user_id = $1 AND category = $2`,
      [userId, category]
    );

    // If preference exists and is disabled, skip sending
    if (prefResult.rows.length > 0 && !prefResult.rows[0].enabled) {
      logger.info('[EmailWorker] Email skipped — user opted out', {
        logId,
        userId,
        category,
        template,
      });

      await query(
        `UPDATE email_logs SET status = 'failed', last_error = 'User opted out of category: ' || $1, updated_at = NOW()
         WHERE id = $2`,
        [category, logId]
      );
      return;
    }
  }

  // Build unsubscribe headers for non-transactional emails
  const appUrl = process.env['APP_URL'] || 'http://localhost:3000';
  const extraHeaders: Record<string, string> = {};
  if (category !== 'transactional' && unsubscribeToken) {
    extraHeaders['List-Unsubscribe'] = `<${appUrl}/api/email/unsubscribe/${unsubscribeToken}>`;
    extraHeaders['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  // Update attempt count
  const attemptNumber = (job.attemptsMade || 0) + 1;
  await query(
    `UPDATE email_logs SET attempts = $1, status = 'sending', updated_at = NOW() WHERE id = $2`,
    [attemptNumber, logId]
  );

  try {
    // Send via MailHelper
    const result = await mailHelper.send({
      email: recipient,
      subject,
      template,
      data: { ...data, unsubscribeUrl: unsubscribeToken ? `${appUrl}/api/email/unsubscribe/${unsubscribeToken}` : undefined },
    });

    if (result) {
      // Success — update log
      await query(
        `UPDATE email_logs SET status = 'sent', sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [logId]
      );

      logger.info('[EmailWorker] Email sent successfully', {
        logId,
        template,
        recipient,
        category,
      });
    } else {
      throw new Error('MailHelper.send() returned false');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Update log with error
    await query(
      `UPDATE email_logs SET status = 'failed', last_error = $1, updated_at = NOW() WHERE id = $2`,
      [errorMessage.substring(0, 2000), logId]
    );

    logger.error('[EmailWorker] Email delivery failed', {
      logId,
      template,
      recipient,
      error: errorMessage,
      attempt: attemptNumber,
    });

    // Re-throw so BullMQ can retry
    throw error;
  }
}

// ============================================================================
// Worker Instance + Startup
// ============================================================================

let emailWorker: Worker | null = null;

export function startEmailWorker(): Worker {
  if (emailWorker) return emailWorker;

  emailWorker = new Worker(QueueNames.EMAIL, processEmailJob, {
    connection: redisConnection,
    concurrency: 3, // 3 concurrent email sends
    limiter: {
      max: 10, // Max 10 emails
      duration: 1000, // per second
    },
  });

  emailWorker.on('completed', (job) => {
    logger.info('[EmailWorker] Job completed', { jobId: job.id, name: job.name });
  });

  emailWorker.on('failed', (job, err) => {
    logger.error('[EmailWorker] Job failed', {
      jobId: job?.id,
      name: job?.name,
      error: err.message,
    });
  });

  emailWorker.on('error', (err) => {
    logger.error('[EmailWorker] Worker error', {
      error: err.message,
    });
  });

  emailWorker.on('ready', () => {
    logger.info('[EmailWorker] Worker ready and waiting for email jobs');
  });

  logger.info('[EmailWorker] Email worker started', {
    queueName: QueueNames.EMAIL,
    concurrency: 3,
    rateLimit: '10 emails/second',
  });

  return emailWorker;
}
