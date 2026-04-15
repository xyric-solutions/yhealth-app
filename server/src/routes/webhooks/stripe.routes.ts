/**
 * Stripe Webhook Routes
 * Must be mounted with express.raw({ type: 'application/json' }) so signature verification works
 */

import { Router, type Request, type Response } from 'express';
import Stripe from 'stripe';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { env } from '../../config/env.config.js';
import { logger } from '../../services/logger.service.js';
import { handleStripeWebhook } from '../../services/subscription.service.js';

const router = Router();

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;
    if (!signature) {
      throw ApiError.badRequest('Missing stripe-signature header');
    }
    if (!env.stripe.webhookSecret) {
      logger.error('[StripeWebhook] STRIPE_WEBHOOK_SECRET is not set');
      throw ApiError.internal('Webhook not configured');
    }

    // req.body is raw Buffer when mounted with express.raw()
    const body = req.body as Buffer | string;
    if (!body) {
      throw ApiError.badRequest('Missing body');
    }

    let event: Stripe.Event;
    try {
      const stripe = new Stripe(env.stripe.secretKey!, { apiVersion: '2025-12-15.clover' });
      event = stripe.webhooks.constructEvent(body, signature, env.stripe.webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid signature';
      logger.warn('[StripeWebhook] Signature verification failed', { message });
      throw ApiError.badRequest(message);
    }

    try {
      await handleStripeWebhook(event);
    } catch (err) {
      logger.error('[StripeWebhook] Handler error', { type: event.type, error: (err as Error).message });
      throw err;
    }

    res.status(200).send();
  })
);

export default router;
