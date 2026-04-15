/**
 * Subscription Routes
 * Public/authenticated: list plans, checkout session, portal session, my subscription
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  getPlansHandler,
  createCheckoutSessionHandler,
  createPortalSessionHandler,
  verifySessionHandler,
  syncFromStripeHandler,
  getMySubscriptionHandler,
} from '../controllers/subscription.controller.js';
import {
  checkoutSessionSchema,
  portalSessionSchema,
  verifySessionSchema,
} from '../validators/subscription.validator.js';

const router = Router();

/** GET /api/subscription/plans - List plans (public, optional auth) */
router.get('/plans', getPlansHandler);

/** POST /api/subscription/checkout-session - Create Stripe Checkout session (auth required) */
router.post('/checkout-session', authenticate, validate(checkoutSessionSchema, 'body'), createCheckoutSessionHandler);

/** POST /api/subscription/portal-session - Create Stripe Customer Portal session (auth required) */
router.post('/portal-session', authenticate, validate(portalSessionSchema, 'body'), createPortalSessionHandler);

/** POST /api/subscription/verify-session - Verify checkout session with Stripe (callback when webhook not run) */
router.post('/verify-session', authenticate, validate(verifySessionSchema, 'body'), verifySessionHandler);

/** POST /api/subscription/sync-from-stripe - Recovery: sync subscription from Stripe if user paid but DB was not updated */
router.post('/sync-from-stripe', authenticate, syncFromStripeHandler);

/** GET /api/subscription/me - Get current user subscription (auth required) */
router.get('/me', authenticate, getMySubscriptionHandler);

export default router;
