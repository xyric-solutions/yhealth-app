/**
 * @file WHOOP Webhook Routes
 * @description Webhook endpoints for receiving real-time WHOOP data updates.
 * Includes HMAC-SHA256 signature verification and idempotency checks.
 */

import crypto from 'crypto';
import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../../services/logger.service.js';
import { whoopDataService } from '../../services/whoop-data.service.js';
import { query } from '../../database/pg.js';
import type { Request, Response } from 'express';

const router = Router();

const WHOOP_WEBHOOK_SECRET = process.env.WHOOP_WEBHOOK_SECRET;

/**
 * Verify WHOOP webhook signature using HMAC-SHA256
 */
function verifyWhoopSignature(signature: string, rawBody: Buffer, secret: string): boolean {
  try {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    // Handle both raw hex and prefixed formats
    const signatureHex = signature.startsWith('sha256=') ? signature.slice(7) : signature;
    if (signatureHex.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(signatureHex, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

/**
 * @route   POST /api/webhooks/whoop
 * @desc    Webhook endpoint for WHOOP data events
 * @access  Public (verified via webhook signature)
 */
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const payload = req.body;

    logger.info('[WHOOPWebhook] Received webhook', {
      eventType: payload.event_type || payload.type,
      hasData: !!payload.data,
    });

    // Verify webhook signature if secret is configured
    if (WHOOP_WEBHOOK_SECRET) {
      const signature = req.headers['x-whoop-signature'] as string;
      const rawBody = (req as any).rawBody as Buffer | undefined;

      if (!signature || !rawBody) {
        logger.warn('[WHOOPWebhook] Missing signature or raw body');
        throw ApiError.unauthorized('Missing webhook signature');
      }

      if (!verifyWhoopSignature(signature, rawBody, WHOOP_WEBHOOK_SECRET)) {
        logger.warn('[WHOOPWebhook] Invalid webhook signature');
        throw ApiError.unauthorized('Invalid webhook signature');
      }
    }

    // Idempotency check: skip if we already have this record
    const rawDataId = payload.data?.id || payload.data?.cycle_id;
    if (rawDataId) {
      const existing = await query(
        `SELECT id FROM health_data_records WHERE raw_data_id = $1 AND provider = 'whoop' LIMIT 1`,
        [String(rawDataId)]
      );
      if (existing.rows.length > 0) {
        logger.debug('[WHOOPWebhook] Duplicate event skipped', { rawDataId });
        ApiResponse.success(res, { processed: true, deduplicated: true }, 'Webhook already processed');
        return;
      }
    }

    // Process webhook event
    const eventType = payload.event_type || payload.type || 'unknown';

    try {
      switch (eventType) {
        case 'recovery.created':
        case 'recovery.updated':
          await whoopDataService.processRecoveryWebhook(payload);
          break;

        case 'sleep.created':
        case 'sleep.updated':
          await whoopDataService.processSleepWebhook(payload);
          break;

        case 'workout.created':
        case 'workout.updated':
          await whoopDataService.processWorkoutWebhook(payload);
          break;

        case 'cycle.created':
        case 'cycle.updated':
          await whoopDataService.processCycleWebhook(payload);
          break;

        default:
          logger.warn('[WHOOPWebhook] Unknown event type', { eventType });
      }

      ApiResponse.success(res, { processed: true }, 'Webhook processed successfully');
    } catch (error) {
      logger.error('[WHOOPWebhook] Error processing webhook', {
        eventType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Return 200 to prevent WHOOP from retrying (we log for manual investigation)
      ApiResponse.success(res, { processed: false, error: 'Processing failed' }, 'Webhook received but processing failed');
    }
  })
);

/**
 * @route   GET /api/webhooks/whoop/verify
 * @desc    Webhook verification endpoint (for WHOOP webhook setup)
 * @access  Public
 */
router.get('/verify', (req: Request, res: Response) => {
  const challenge = req.query.challenge as string;
  const verifyToken = req.query.verify_token as string;

  const expectedToken = process.env['WHOOP_WEBHOOK_VERIFY_TOKEN'] || 'balencia_verify_token';

  if (verifyToken === expectedToken && challenge) {
    logger.info('[WHOOPWebhook] Verification successful');
    res.status(200).send(challenge);
  } else {
    logger.warn('[WHOOPWebhook] Verification failed', { verifyToken, hasChallenge: !!challenge });
    res.sendStatus(403);
  }
});

export default router;
