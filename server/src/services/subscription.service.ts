/**
 * Subscription Service
 * Stripe subscription plans, checkout, portal, and webhook sync
 */

import Stripe from 'stripe';
import { query, transaction } from '../database/pg.js';
import { env } from '../config/env.config.js';
import { logger } from './logger.service.js';
import { mailHelper } from '../helper/mail.js';
import type { CreatePlanInput, UpdatePlanInput } from '../validators/subscription.validator.js';

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeClient) {
    if (!env.stripe.secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    stripeClient = new Stripe(env.stripe.secretKey, { apiVersion: '2025-12-15.clover' });
  }
  return stripeClient;
}

// ============================================
// TYPES
// ============================================

export interface SubscriptionPlanRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
  amount_cents: number;
  currency: string;
  interval: string;
  features: unknown;
  is_active: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface UserSubscriptionRow {
  id: string;
  user_id: string;
  plan_id: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  status: string;
  current_period_start: Date | null;
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
  canceled_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// PLANS
// ============================================

export async function listPlans(activeOnly = true): Promise<SubscriptionPlanRow[]> {
  const q = activeOnly
    ? `SELECT * FROM subscription_plans WHERE is_active = true ORDER BY sort_order ASC, created_at ASC`
    : `SELECT * FROM subscription_plans ORDER BY sort_order ASC, created_at ASC`;
  const result = await query<SubscriptionPlanRow>(q);
  return result.rows;
}

const DEFAULT_PLANS = [
  {
    name: 'Free',
    slug: 'free',
    description: '1 week free full access, then continue with essential tracking and community.',
    amount_cents: 0,
    currency: 'usd',
    interval: 'month',
    features: [
      '1 week free full access to all features',
      'Basic activity & mood tracking',
      'Daily step counter',
      'Water intake logging',
      '7-day history',
      'Community access',
    ],
    sort_order: 0,
  },
  {
    name: '1 Month',
    slug: 'monthly',
    description: 'Full access, billed monthly. Cancel anytime.',
    amount_cents: 999,
    currency: 'usd',
    interval: 'month',
    features: [
      'Everything in Free',
      'Unlimited AI coaching & insights',
      'Advanced analytics & trends',
      'Nutrition & meal planning',
      'Sleep & recovery analysis',
      'Unlimited history',
      'Priority support',
    ],
    sort_order: 1,
  },
  {
    name: '3 Month',
    slug: '3-month',
    description: 'Full access, billed every 3 months. Best value.',
    amount_cents: 2499,
    currency: 'usd',
    interval: 'month',
    features: [
      'Everything in 1 Month',
      'Billed every 3 months — save vs monthly',
      'Unlimited AI coaching & insights',
      'Nutrition & meal planning',
      'Sleep & recovery analysis',
      'Priority support',
    ],
    sort_order: 2,
  },
];

/** Auto-seed subscription plans if the table is empty. Called on server startup. */
export async function ensureDefaultPlans(): Promise<void> {
  const countResult = await query<{ count: string }>('SELECT COUNT(*)::text AS count FROM subscription_plans');
  const count = parseInt(countResult.rows[0]?.count ?? '0', 10);
  if (count > 0) return;

  logger.info('No subscription plans found — seeding defaults...');
  const now = new Date().toISOString();

  for (const plan of DEFAULT_PLANS) {
    await query(
      `INSERT INTO subscription_plans (
        name, slug, description, stripe_price_id, stripe_product_id,
        amount_cents, currency, interval, features, is_active, sort_order, created_at, updated_at
      ) VALUES ($1, $2, $3, NULL, NULL, $4, $5, $6, $7::jsonb, true, $8, $9::timestamptz, $9::timestamptz)
      ON CONFLICT (slug) DO NOTHING`,
      [
        plan.name,
        plan.slug,
        plan.description,
        plan.amount_cents,
        plan.currency,
        plan.interval,
        JSON.stringify(plan.features),
        plan.sort_order,
        now,
      ]
    );
  }
  logger.info(`Seeded ${DEFAULT_PLANS.length} default subscription plans.`);
}

export async function getPlanById(id: string): Promise<SubscriptionPlanRow | null> {
  const result = await query<SubscriptionPlanRow>(
    'SELECT * FROM subscription_plans WHERE id = $1',
    [id]
  );
  return result.rows[0] ?? null;
}

export async function getPlanByStripePriceId(priceId: string): Promise<SubscriptionPlanRow | null> {
  const result = await query<SubscriptionPlanRow>(
    'SELECT * FROM subscription_plans WHERE stripe_price_id = $1',
    [priceId]
  );
  return result.rows[0] ?? null;
}

export async function createPlan(data: CreatePlanInput): Promise<SubscriptionPlanRow> {
  const stripe = getStripe();
  const currency = (data.currency || 'usd').toLowerCase();

  const product = await stripe.products.create({
    name: data.name,
    description: data.description ?? undefined,
    metadata: { slug: data.slug },
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: data.amount_cents,
    currency,
    recurring: { interval: data.interval },
  });

  const now = new Date().toISOString();
  const featuresJson = JSON.stringify(data.features ?? []);

  const result = await query<SubscriptionPlanRow>(
    `INSERT INTO subscription_plans (
      name, slug, description, stripe_price_id, stripe_product_id,
      amount_cents, currency, interval, features, is_active, sort_order, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12::timestamptz, $12::timestamptz)
    RETURNING *`,
    [
      data.name,
      data.slug,
      data.description ?? null,
      price.id,
      product.id,
      data.amount_cents,
      (data.currency || 'USD').toLowerCase(),
      data.interval,
      featuresJson,
      data.is_active ?? true,
      data.sort_order ?? 0,
      now,
    ]
  );
  return result.rows[0];
}

export async function updatePlan(id: string, data: UpdatePlanInput): Promise<SubscriptionPlanRow | null> {
  const existing = await getPlanById(id);
  if (!existing) return null;

  const stripe = getStripe();
  const updates: string[] = [];
  const values: (string | number | boolean | null)[] = [];
  let idx = 1;

  if (data.name !== undefined) {
    updates.push(`name = $${idx++}`);
    values.push(data.name);
    if (existing.stripe_product_id) {
      await stripe.products.update(existing.stripe_product_id, { name: data.name });
    }
  }
  if (data.slug !== undefined) {
    updates.push(`slug = $${idx++}`);
    values.push(data.slug);
  }
  if (data.description !== undefined) {
    updates.push(`description = $${idx++}`);
    values.push(data.description);
  }
  if (data.amount_cents !== undefined || data.currency !== undefined || data.interval !== undefined) {
    // Stripe doesn't allow editing price; we'd need a new price. For simplicity, only update DB or create new price.
    if (data.amount_cents !== undefined) {
      updates.push(`amount_cents = $${idx++}`);
      values.push(data.amount_cents);
    }
    if (data.currency !== undefined) {
      updates.push(`currency = $${idx++}`);
      values.push(data.currency.toLowerCase());
    }
    if (data.interval !== undefined) {
      updates.push(`interval = $${idx++}`);
      values.push(data.interval);
    }
  }
  if (data.features !== undefined) {
    updates.push(`features = $${idx++}::jsonb`);
    values.push(JSON.stringify(data.features));
  }
  if (data.is_active !== undefined) {
    updates.push(`is_active = $${idx++}`);
    values.push(data.is_active);
  }
  if (data.sort_order !== undefined) {
    updates.push(`sort_order = $${idx++}`);
    values.push(data.sort_order);
  }

  if (updates.length === 0) return existing;

  updates.push(`updated_at = $${idx}::timestamptz`);
  values.push(new Date().toISOString(), id);

  const result = await query<SubscriptionPlanRow>(
    `UPDATE subscription_plans SET ${updates.join(', ')} WHERE id = $${idx + 1} RETURNING *`,
    values
  );
  return result.rows[0] ?? null;
}

export async function deletePlan(id: string): Promise<boolean> {
  const plan = await getPlanById(id);
  if (!plan) return false;
  const stripe = getStripe();
  if (plan.stripe_product_id) {
    try {
      await stripe.products.update(plan.stripe_product_id, { active: false });
    } catch (_e) {
      logger.warn('[Subscription] Could not deactivate Stripe product', { id: plan.stripe_product_id });
    }
  }
  await query('UPDATE subscription_plans SET is_active = false, updated_at = NOW() AT TIME ZONE \'UTC\' WHERE id = $1', [
    id,
  ]);
  return true;
}

// ============================================
// CHECKOUT & PORTAL
// ============================================

async function getOrCreateStripeCustomerId(userId: string, email: string): Promise<string> {
  const row = await query<{ stripe_customer_id: string | null }>(
    'SELECT stripe_customer_id FROM users WHERE id = $1',
    [userId]
  );
  const existing = row.rows[0]?.stripe_customer_id;
  if (existing) return existing;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email,
    metadata: { userId },
  });
  await query('UPDATE users SET stripe_customer_id = $1, updated_at = NOW() AT TIME ZONE \'UTC\' WHERE id = $2', [
    customer.id,
    userId,
  ]);
  return customer.id;
}

/** Create Stripe Checkout: subscription if plan has stripe_price_id, otherwise one-time payment (product). */
export async function createCheckoutSession(
  userId: string,
  planId: string,
  successUrl: string,
  cancelUrl: string
): Promise<{ url: string | null; mode: 'subscription' | 'payment' }> {
  const plan = await getPlanById(planId);
  if (!plan) throw new Error('Plan not found');

  const userRow = await query<{ email: string }>('SELECT email FROM users WHERE id = $1', [userId]);
  const email = userRow.rows[0]?.email;
  if (!email) throw new Error('User not found');

  const customerId = await getOrCreateStripeCustomerId(userId, email);
  const stripe = getStripe();
  const metadata = { userId, planId };

  if (plan.stripe_price_id) {
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      subscription_data: { metadata },
    });
    return { url: session.url ?? null, mode: 'subscription' };
  }

  // No Stripe Price ID: one-time product charge
  const currency = (plan.currency || 'usd').toLowerCase();
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency,
          unit_amount: plan.amount_cents,
          product_data: {
            name: plan.name,
            description: plan.description ?? undefined,
            metadata: { planId, userId },
          },
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
  });
  return { url: session.url ?? null, mode: 'payment' };
}

export async function createPortalSession(userId: string, returnUrl: string): Promise<{ url: string }> {
  const row = await query<{ stripe_customer_id: string | null }>(
    'SELECT stripe_customer_id FROM users WHERE id = $1',
    [userId]
  );
  const customerId = row.rows[0]?.stripe_customer_id;
  if (!customerId) throw new Error('No billing customer found. Subscribe to a plan first.');

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return { url: session.url };
}

// ============================================
// PAYMENT VALIDATION & CALLBACK VERIFY (when webhook not available)
// ============================================

export interface VerifySessionResult {
  success: boolean;
  reason?: 'paid' | 'already_synced' | 'invalid_session' | 'invalid_payment' | 'invalid_metadata' | 'forbidden';
  subscription?: UserSubscriptionRow;
  error?: string;
}

/** High-level payment validation: session exists, paid, metadata matches, amount/plan consistent. */
function validateCheckoutSession(
  session: Stripe.Checkout.Session,
  expectedUserId: string,
  plan: SubscriptionPlanRow | null
): { valid: boolean; reason?: VerifySessionResult['reason']; error?: string } {
  if (!session || !session.id) {
    return { valid: false, reason: 'invalid_session', error: 'Invalid or missing checkout session' };
  }
  const metadata = (session.metadata as Record<string, string> | null) ?? {};
  const userId = metadata.userId ?? (session.metadata as Record<string, unknown> | null)?.userId as string | undefined;
  const planId = metadata.planId ?? (session.metadata as Record<string, unknown> | null)?.planId as string | undefined;
  if (!userId || userId !== expectedUserId) {
    return { valid: false, reason: 'forbidden', error: 'Session does not belong to this user' };
  }
  if (!planId) {
    return { valid: false, reason: 'invalid_metadata', error: 'Missing plan in session. Please try subscribing again from the plans page.' };
  }
  if (!plan) {
    return { valid: false, reason: 'invalid_metadata', error: 'Plan no longer exists. Please choose a current plan.' };
  }
  if (session.payment_status !== 'paid') {
    return { valid: false, reason: 'invalid_payment', error: `Payment not completed (status: ${session.payment_status ?? 'unknown'}). Please complete payment or try again.` };
  }
  // Stripe amount_total is in smallest currency unit (cents for USD)
  if (session.mode === 'payment' && session.amount_total != null && plan.amount_cents !== session.amount_total) {
    logger.warn('[Subscription] Amount mismatch', {
      planId,
      planCents: plan.amount_cents,
      sessionTotal: session.amount_total,
    });
    return { valid: false, reason: 'invalid_payment', error: 'Payment amount does not match plan. Please try again from the plans page.' };
  }
  return { valid: true };
}

/** Compute period end for one-time purchase (e.g. 1 month, 3 months, 1 year from now). */
function getPeriodEndForPlan(plan: SubscriptionPlanRow): { start: string; end: string } {
  const now = new Date();
  const start = now.toISOString();
  const end = new Date(now);
  if (plan.interval === 'year') {
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  } else if (plan.slug === '3-month' || plan.interval === 'month') {
    end.setUTCMonth(end.getUTCMonth() + (plan.slug === '3-month' ? 3 : 1));
  } else {
    end.setUTCMonth(end.getUTCMonth() + 1);
  }
  return { start, end: end.toISOString() };
}

/** Sync subscription from Stripe subscription object into user_subscriptions (same as webhook). */
async function syncSubscriptionFromStripe(sub: Stripe.Subscription): Promise<void> {
  const userId = (sub.metadata?.userId as string) || (await findUserIdByStripeCustomer(sub.customer as string));
  if (!userId) {
    logger.warn('[Subscription] Verify: no userId for subscription', { subscriptionId: sub.id });
    return;
  }
  const plan = await getPlanByStripePriceId((sub.items.data[0]?.price?.id) ?? '');
  if (!plan) {
    logger.warn('[Subscription] Verify: plan not found for price', { priceId: sub.items.data[0]?.price?.id });
    return;
  }
  const status = mapStripeStatus(sub.status);
  const firstItem = sub.items?.data?.[0];
  const periodStart = firstItem?.current_period_start
    ? new Date(firstItem.current_period_start * 1000).toISOString()
    : null;
  const periodEnd = firstItem?.current_period_end
    ? new Date(firstItem.current_period_end * 1000).toISOString()
    : null;
  const now = new Date().toISOString();
  await transaction(async (client) => {
    await client.query(
      `INSERT INTO user_subscriptions (
        user_id, plan_id, stripe_subscription_id, stripe_customer_id, status,
        current_period_start, current_period_end, cancel_at_period_end, canceled_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, $8, $9::timestamptz, $10::timestamptz, $10::timestamptz)
      ON CONFLICT (stripe_subscription_id) DO UPDATE SET
        status = EXCLUDED.status,
        current_period_start = EXCLUDED.current_period_start,
        current_period_end = EXCLUDED.current_period_end,
        cancel_at_period_end = EXCLUDED.cancel_at_period_end,
        canceled_at = CASE WHEN EXCLUDED.status = 'canceled' THEN NOW() AT TIME ZONE 'UTC' ELSE user_subscriptions.canceled_at END,
        updated_at = EXCLUDED.updated_at`,
      [
        userId,
        plan.id,
        sub.id,
        typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null,
        status,
        periodStart,
        periodEnd,
        sub.cancel_at_period_end ?? false,
        sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
        now,
      ]
    );
  });
  logger.info('[Subscription] Verified/synced subscription', { subscriptionId: sub.id, userId, status });
}

/** Ensure user has stripe_customer_id set when we have it from session (idempotent). */
async function ensureUserStripeCustomerId(userId: string, stripeCustomerId: string | null): Promise<void> {
  if (!stripeCustomerId) return;
  const row = await query<{ stripe_customer_id: string | null }>(
    'SELECT stripe_customer_id FROM users WHERE id = $1',
    [userId]
  );
  if (row.rows[0]?.stripe_customer_id) return;
  await query(
    "UPDATE users SET stripe_customer_id = $1, updated_at = NOW() AT TIME ZONE 'UTC' WHERE id = $2",
    [stripeCustomerId, userId]
  );
  logger.info('[Subscription] Linked Stripe customer to user', { userId, stripeCustomerId });
}

/** Verify checkout session from Stripe and sync to DB (callback when webhook not run). High-level payment validation included. */
export async function verifyCheckoutSession(
  sessionId: string,
  userId: string
): Promise<VerifySessionResult> {
  const stripe = getStripe();
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'subscription.latest_invoice', 'payment_intent'],
    });
  } catch (e) {
    const msg = (e as Error).message;
    logger.warn('[Subscription] Verify: failed to retrieve session', { sessionId, userId, error: msg });
    return { success: false, reason: 'invalid_session', error: msg || 'Could not load checkout session. Please try again in a moment.' };
  }

  const metadata = (session.metadata as Record<string, string> | null) ?? {};
  const planId = metadata.planId ?? (session.metadata as Record<string, unknown> | null)?.planId as string | undefined;
  const plan = planId ? await getPlanById(planId) : null;
  const validation = validateCheckoutSession(session, userId, plan);
  if (!validation.valid) {
    logger.warn('[Subscription] Verify: validation failed', { sessionId, userId, reason: validation.reason, error: validation.error });
    return { success: false, reason: validation.reason, error: validation.error };
  }

  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
  await ensureUserStripeCustomerId(userId, customerId);

  if (session.mode === 'subscription' && session.subscription) {
    const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    if (subId) {
      const existing = await getSubscriptionByStripeSubscriptionId(subId);
      if (existing) {
        return { success: true, reason: 'already_synced', subscription: existing };
      }
      const sub = await stripe.subscriptions.retrieve(subId);
      await syncSubscriptionFromStripe(sub);
      const updated = await getSubscriptionByStripeSubscriptionId(subId);
      return { success: true, reason: 'paid', subscription: updated ?? undefined };
    }
  }

  if (session.mode === 'payment' && session.payment_status === 'paid' && plan) {
    const existing = await getSubscriptionByUserId(userId);
    if (existing?.plan_id === plan.id && existing.status === 'active') {
      const periodEnd = existing.current_period_end?.getTime();
      if (periodEnd && periodEnd > Date.now()) {
        return { success: true, reason: 'already_synced', subscription: existing };
      }
    }
    const { start, end } = getPeriodEndForPlan(plan);
    try {
      await transaction(async (client) => {
        await client.query(
          `UPDATE user_subscriptions SET status = 'canceled', updated_at = NOW() AT TIME ZONE 'UTC'
           WHERE user_id = $1 AND status = 'active'`,
          [userId]
        );
        await client.query(
          `INSERT INTO user_subscriptions (
            user_id, plan_id, stripe_subscription_id, stripe_customer_id, status,
            current_period_start, current_period_end, cancel_at_period_end, canceled_at, created_at, updated_at
          ) VALUES ($1, $2, NULL, $3, 'active', $4::timestamptz, $5::timestamptz, false, NULL, $6::timestamptz, $6::timestamptz)`,
          [userId, plan.id, customerId, start, end, new Date().toISOString()]
        );
      });
    } catch (txErr) {
      logger.error('[Subscription] Verify: failed to save subscription', { userId, planId: plan.id, error: (txErr as Error).message });
      return { success: false, reason: 'invalid_payment', error: 'Failed to activate subscription. Please contact support with your receipt.' };
    }
    const sub = await getSubscriptionByUserId(userId);
    logger.info('[Subscription] Verified one-time payment and granted access', { userId, planId: plan.id, subscriptionId: sub?.id });
    return { success: true, reason: 'paid', subscription: sub ?? undefined };
  }

  logger.warn('[Subscription] Verify: could not sync payment', { sessionId, mode: session.mode, payment_status: session.payment_status });
  return { success: false, reason: 'invalid_payment', error: 'Could not sync payment. Please contact support with your receipt.' };
}

/** Recovery: find user's completed Stripe Checkout (one-time payment) and create subscription in DB. Use when success redirect or webhook missed. */
export async function syncSubscriptionFromStripeRecovery(userId: string): Promise<{
  synced: boolean;
  subscription?: UserSubscriptionRow;
  reason?: string;
  error?: string;
}> {
  const userRow = await query<{ stripe_customer_id: string | null; email: string }>(
    'SELECT stripe_customer_id, email FROM users WHERE id = $1',
    [userId]
  );
  const user = userRow.rows[0];
  if (!user?.email) {
    return { synced: false, reason: 'user_not_found', error: 'User not found.' };
  }

  let customerId = user.stripe_customer_id;
  const stripe = getStripe();

  if (!customerId) {
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customer = customers.data[0];
    if (!customer) {
      return { synced: false, reason: 'no_stripe_customer', error: 'No Stripe payment found for this account. Subscribe from the plans below.' };
    }
    customerId = customer.id;
    await query(
      "UPDATE users SET stripe_customer_id = $1, updated_at = NOW() AT TIME ZONE 'UTC' WHERE id = $2",
      [customerId, userId]
    );
    logger.info('[Subscription] Recovery: linked Stripe customer by email', { userId, customerId });
  }

  const sessions = await stripe.checkout.sessions.list({
    customer: customerId,
    status: 'complete',
    limit: 20,
  });

  for (const session of sessions.data) {
    if (session.mode !== 'payment' || session.payment_status !== 'paid') continue;
    const metadata = (session.metadata as Record<string, string> | null) ?? {};
    const sessionUserId = metadata.userId ?? (session.metadata as Record<string, unknown> | null)?.userId as string | undefined;
    const planId = metadata.planId ?? (session.metadata as Record<string, unknown> | null)?.planId as string | undefined;
    if (sessionUserId !== userId || !planId) continue;

    const plan = await getPlanById(planId);
    if (!plan) continue;

    const { start, end } = getPeriodEndForPlan(plan);
    const sessionCustomerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
    try {
      await transaction(async (client) => {
        await client.query(
          `UPDATE user_subscriptions SET status = 'canceled', updated_at = NOW() AT TIME ZONE 'UTC'
           WHERE user_id = $1 AND status = 'active'`,
          [userId]
        );
        await client.query(
          `INSERT INTO user_subscriptions (
            user_id, plan_id, stripe_subscription_id, stripe_customer_id, status,
            current_period_start, current_period_end, cancel_at_period_end, canceled_at, created_at, updated_at
          ) VALUES ($1, $2, NULL, $3, 'active', $4::timestamptz, $5::timestamptz, false, NULL, $6::timestamptz, $6::timestamptz)`,
          [userId, plan.id, sessionCustomerId, start, end, new Date().toISOString()]
        );
      });
      const sub = await getSubscriptionByUserId(userId);
      logger.info('[Subscription] Recovery: synced from Stripe checkout session', { userId, planId: plan.id, sessionId: session.id });
      return { synced: true, subscription: sub ?? undefined, reason: 'synced_from_stripe' };
    } catch (err) {
      logger.error('[Subscription] Recovery: failed to save subscription', { userId, error: (err as Error).message });
      return { synced: false, reason: 'save_failed', error: 'Could not activate subscription. Please contact support.' };
    }
  }

  return { synced: false, reason: 'no_completed_payment', error: 'No completed payment found for this account. Complete a purchase from the plans below, then use this button again.' };
}

// ============================================
// USER SUBSCRIPTION
// ============================================

export async function getSubscriptionByUserId(userId: string): Promise<UserSubscriptionRow | null> {
  const result = await query<UserSubscriptionRow>(
    `SELECT * FROM user_subscriptions 
     WHERE user_id = $1 AND status = 'active' 
     ORDER BY COALESCE(current_period_end, created_at) DESC LIMIT 1`,
    [userId]
  );
  return result.rows[0] ?? null;
}

const TRIAL_DAYS = 7;

export interface SubscriptionAccessInfo {
  allowed: boolean;
  reason: 'subscribed' | 'trial' | 'expired' | 'none';
  trialEndsAt?: string;
  daysLeftInTrial?: number;
}

export async function getSubscriptionAccess(userId: string): Promise<{
  subscription: UserSubscriptionRow | null;
  plan: SubscriptionPlanRow | null;
  access: SubscriptionAccessInfo;
}> {
  const subscription = await getSubscriptionByUserId(userId);
  if (subscription && subscription.status === 'active') {
    const plan = await getPlanById(subscription.plan_id);
    return {
      subscription,
      plan: plan ?? null,
      access: { allowed: true, reason: 'subscribed' },
    };
  }

  const userRow = await query<{ created_at: Date }>('SELECT created_at FROM users WHERE id = $1', [userId]);
  const createdAt = userRow.rows[0]?.created_at;
  if (!createdAt) {
    return {
      subscription: null,
      plan: null,
      access: { allowed: false, reason: 'none' },
    };
  }

  const trialEnd = new Date(createdAt);
  trialEnd.setUTCDate(trialEnd.getUTCDate() + TRIAL_DAYS);
  const now = new Date();
  const allowed = now < trialEnd;
  const daysLeft = allowed
    ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
    : 0;

  return {
    subscription: null,
    plan: null,
    access: {
      allowed,
      reason: allowed ? 'trial' : 'expired',
      trialEndsAt: trialEnd.toISOString(),
      daysLeftInTrial: daysLeft,
    },
  };
}

export async function getSubscriptionByStripeSubscriptionId(stripeSubscriptionId: string): Promise<UserSubscriptionRow | null> {
  const result = await query<UserSubscriptionRow>(
    'SELECT * FROM user_subscriptions WHERE stripe_subscription_id = $1',
    [stripeSubscriptionId]
  );
  return result.rows[0] ?? null;
}

/** Get the latest invoice URL for the user's active subscription (for download/view). */
export async function getLatestInvoiceUrl(userId: string): Promise<string | null> {
  const subscription = await getSubscriptionByUserId(userId);
  if (!subscription?.stripe_subscription_id) return null;
  try {
    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id, {
      expand: ['latest_invoice'],
    });
    const latestInvoiceId = sub.latest_invoice;
    if (typeof latestInvoiceId !== 'string') return null;
    const invoice = await stripe.invoices.retrieve(latestInvoiceId);
    return invoice.hosted_invoice_url ?? null;
  } catch (e) {
    logger.warn('[Subscription] Could not fetch latest invoice URL', { userId, error: (e as Error).message });
    return null;
  }
}

function mapStripeStatus(stripeStatus: string): string {
  const map: Record<string, string> = {
    active: 'active',
    canceled: 'canceled',
    past_due: 'past_due',
    trialing: 'trialing',
    incomplete: 'incomplete',
    incomplete_expired: 'incomplete_expired',
    unpaid: 'past_due',
  };
  return map[stripeStatus] ?? stripeStatus;
}

export async function handleStripeWebhook(event: Stripe.Event): Promise<void> {
  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Stripe.Subscription;
    const userId = (sub.metadata?.userId as string) || (await findUserIdByStripeCustomer(sub.customer as string));
    if (!userId) {
      logger.warn('[Subscription] Webhook: no userId for subscription', { subscriptionId: sub.id });
      return;
    }

    const plan = await getPlanByStripePriceId((sub.items.data[0]?.price?.id) ?? '');
    if (!plan) {
      logger.warn('[Subscription] Webhook: plan not found for price', { priceId: sub.items.data[0]?.price?.id });
      return;
    }

    const status = mapStripeStatus(sub.status);
    const firstItem = sub.items?.data?.[0];
    const periodStart = firstItem?.current_period_start
      ? new Date(firstItem.current_period_start * 1000).toISOString()
      : null;
    const periodEnd = firstItem?.current_period_end
      ? new Date(firstItem.current_period_end * 1000).toISOString()
      : null;
    const now = new Date().toISOString();

    await transaction(async (client) => {
      await client.query(
        `INSERT INTO user_subscriptions (
          user_id, plan_id, stripe_subscription_id, stripe_customer_id, status,
          current_period_start, current_period_end, cancel_at_period_end, canceled_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, $8, $9::timestamptz, $10::timestamptz, $10::timestamptz)
        ON CONFLICT (stripe_subscription_id) DO UPDATE SET
          status = EXCLUDED.status,
          current_period_start = EXCLUDED.current_period_start,
          current_period_end = EXCLUDED.current_period_end,
          cancel_at_period_end = EXCLUDED.cancel_at_period_end,
          canceled_at = CASE WHEN EXCLUDED.status = 'canceled' THEN NOW() AT TIME ZONE 'UTC' ELSE user_subscriptions.canceled_at END,
          updated_at = EXCLUDED.updated_at`,
        [
          userId,
          plan.id,
          sub.id,
          typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null,
          status,
          periodStart,
          periodEnd,
          sub.cancel_at_period_end ?? false,
          sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
          now,
        ]
      );
    });
    logger.info('[Subscription] Synced subscription', { subscriptionId: sub.id, userId, status });

    // Send subscription confirmation email when active
    if (status === 'active' && mailHelper.isMailConfigured()) {
      try {
        const userRow = await query<{ email: string; first_name: string | null }>(
          'SELECT email, first_name FROM users WHERE id = $1',
          [userId]
        );
        const user = userRow.rows[0];
        if (user?.email) {
          const periodEndFormatted = periodEnd
            ? new Date(periodEnd).toLocaleDateString('en-US', { dateStyle: 'long' })
            : '—';
          const amountFormatted = `${(plan.amount_cents / 100).toFixed(2)} ${(plan.currency || 'USD').toUpperCase()}`;
          const manageSubscriptionUrl = `${env.client?.url || 'http://localhost:3000'}/dashboard`;
          let invoiceUrl: string | undefined;
          const latestInvoiceId = sub.latest_invoice;
          if (typeof latestInvoiceId === 'string') {
            try {
              const stripe = getStripe();
              const invoice = await stripe.invoices.retrieve(latestInvoiceId);
              invoiceUrl = invoice.hosted_invoice_url ?? undefined;
            } catch (_e) {
              logger.warn('[Subscription] Could not fetch invoice for confirmation email', { latestInvoiceId });
            }
          }
          await mailHelper.sendSubscriptionConfirmationEmail(user.email, user.first_name || 'there', {
            planName: plan.name,
            amountFormatted,
            interval: plan.interval,
            periodEnd: periodEndFormatted,
            manageSubscriptionUrl,
            invoiceUrl,
          });
          logger.info('[Subscription] Confirmation email sent', { userId, email: user.email });
        }
      } catch (err) {
        logger.error('[Subscription] Failed to send confirmation email', { userId, error: (err as Error).message });
      }
    }
  } else if (event.type === 'invoice.paid') {
    const invoice = event.data.object as Stripe.Invoice;
    const customerEmail = invoice.customer_email;
    if (!customerEmail) return;
    const hostedUrl = invoice.hosted_invoice_url;
    if (!hostedUrl) return;
    const amountPaid = invoice.amount_paid != null ? invoice.amount_paid / 100 : 0;
    const currency = (invoice.currency || 'usd').toUpperCase();
    const amountFormatted = `${amountPaid.toFixed(2)} ${currency}`;
    const invoiceNumber = invoice.number ?? undefined;
    const date = invoice.created ? new Date(invoice.created * 1000).toLocaleDateString('en-US', { dateStyle: 'medium' }) : undefined;
    let firstName = 'there';
    if (typeof invoice.customer === 'string') {
      const userRow = await query<{ first_name: string | null }>(
        'SELECT first_name FROM users WHERE stripe_customer_id = $1',
        [invoice.customer]
      );
      if (userRow.rows[0]?.first_name) firstName = userRow.rows[0].first_name;
    }
    if (mailHelper.isMailConfigured()) {
      try {
        await mailHelper.sendSubscriptionInvoiceEmail(customerEmail, firstName, {
          amountFormatted,
          invoiceUrl: hostedUrl,
          invoiceNumber,
          date,
        });
        logger.info('[Subscription] Invoice email sent', { email: customerEmail });
      } catch (err) {
        logger.error('[Subscription] Failed to send invoice email', { email: customerEmail, error: (err as Error).message });
      }
    }
  } else if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription;
    await query(
      `UPDATE user_subscriptions SET status = 'canceled', canceled_at = NOW() AT TIME ZONE 'UTC', updated_at = NOW() AT TIME ZONE 'UTC'
       WHERE stripe_subscription_id = $1`,
      [sub.id]
    );
    logger.info('[Subscription] Marked subscription canceled', { subscriptionId: sub.id });
  } else if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = (session.metadata as Record<string, string> | null) ?? {};
    const userId = metadata.userId ?? (session.metadata as Record<string, unknown> | null)?.userId as string | undefined;
    const planId = metadata.planId ?? (session.metadata as Record<string, unknown> | null)?.planId as string | undefined;
    if (!userId || !planId) {
      logger.warn('[Subscription] Webhook checkout.session.completed: missing metadata', { sessionId: session.id, hasUserId: !!userId, hasPlanId: !!planId });
      return;
    }
    if (session.payment_status !== 'paid') {
      logger.warn('[Subscription] Webhook checkout.session.completed: not paid', {
        sessionId: session.id,
        payment_status: session.payment_status,
      });
      return;
    }
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null;
    await ensureUserStripeCustomerId(userId, customerId);

    const plan = await getPlanById(planId);
    if (!plan) {
      logger.warn('[Subscription] Webhook checkout.session.completed: plan not found', { planId, sessionId: session.id });
      return;
    }
    if (session.mode === 'subscription' && session.subscription) {
      const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
      if (subId) {
        try {
          const stripe = getStripe();
          const sub = await stripe.subscriptions.retrieve(subId);
          await syncSubscriptionFromStripe(sub);
          logger.info('[Subscription] Webhook: subscription synced', { subscriptionId: subId, userId });
        } catch (err) {
          logger.error('[Subscription] Webhook: failed to sync subscription', { subId, userId, error: (err as Error).message });
          throw err;
        }
      }
    } else if (session.mode === 'payment') {
      const { start, end } = getPeriodEndForPlan(plan);
      try {
        await transaction(async (client) => {
          await client.query(
            `UPDATE user_subscriptions SET status = 'canceled', updated_at = NOW() AT TIME ZONE 'UTC'
             WHERE user_id = $1 AND status = 'active'`,
            [userId]
          );
          await client.query(
            `INSERT INTO user_subscriptions (
              user_id, plan_id, stripe_subscription_id, stripe_customer_id, status,
              current_period_start, current_period_end, cancel_at_period_end, canceled_at, created_at, updated_at
            ) VALUES ($1, $2, NULL, $3, 'active', $4::timestamptz, $5::timestamptz, false, NULL, $6::timestamptz, $6::timestamptz)`,
            [userId, plan.id, customerId, start, end, new Date().toISOString()]
          );
        });
        logger.info('[Subscription] Webhook: one-time payment synced', { userId, planId: plan.id });
      } catch (err) {
        logger.error('[Subscription] Webhook: failed to save one-time subscription', { userId, planId: plan.id, error: (err as Error).message });
        throw err;
      }
    }
  }
}

async function findUserIdByStripeCustomer(stripeCustomerId: string): Promise<string | null> {
  const result = await query<{ id: string }>('SELECT id FROM users WHERE stripe_customer_id = $1', [
    stripeCustomerId,
  ]);
  return result.rows[0]?.id ?? null;
}

// ============================================
// ADMIN: LIST SUBSCRIPTIONS (with filters & pagination)
// ============================================

export interface AdminListPlansOptions {
  page?: number;
  limit?: number;
  is_active?: boolean;
}

export async function adminListPlans(options: AdminListPlansOptions = {}): Promise<{
  plans: SubscriptionPlanRow[];
  total: number;
}> {
  const { page = 1, limit = 20, is_active } = options;
  const offset = (page - 1) * limit;
  const conditions = is_active !== undefined ? 'WHERE is_active = $3' : '';
  const params = is_active !== undefined ? [limit, offset, is_active] : [limit, offset];

  const countResult = await query<{ count: string }>(
    is_active !== undefined
      ? 'SELECT COUNT(*)::text as count FROM subscription_plans WHERE is_active = $1'
      : 'SELECT COUNT(*)::text as count FROM subscription_plans',
    is_active !== undefined ? [is_active] : []
  );
  const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

  const result = await query<SubscriptionPlanRow>(
    `SELECT * FROM subscription_plans ${conditions} ORDER BY sort_order ASC, created_at ASC LIMIT $1 OFFSET $2`,
    params
  );
  return { plans: result.rows, total };
}

export interface AdminListSubscriptionsOptions {
  page?: number;
  limit?: number;
  status?: string;
  planId?: string;
  userId?: string;
}

export interface UserSubscriptionWithDetails extends UserSubscriptionRow {
  plan_name?: string;
  plan_slug?: string;
  plan_amount_cents?: number;
  plan_currency?: string;
  user_email?: string;
  user_first_name?: string;
  user_last_name?: string;
  invoice_url?: string | null;
}

export async function adminListSubscriptions(options: AdminListSubscriptionsOptions = {}): Promise<{
  subscriptions: UserSubscriptionWithDetails[];
  total: number;
}> {
  const { page = 1, limit = 20, status, planId, userId } = options;
  const offset = (page - 1) * limit;
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let idx = 1;
  if (status) {
    conditions.push(`us.status = $${idx++}`);
    params.push(status);
  }
  if (planId) {
    conditions.push(`us.plan_id = $${idx++}`);
    params.push(planId);
  }
  if (userId) {
    conditions.push(`us.user_id = $${idx++}`);
    params.push(userId);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text as count FROM user_subscriptions us ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0]?.count ?? '0', 10);

  params.push(limit, offset);
  const result = await query<UserSubscriptionWithDetails & { plan_amount_cents: number; plan_currency: string }>(
    `SELECT us.*, p.name as plan_name, p.slug as plan_slug, p.amount_cents as plan_amount_cents, p.currency as plan_currency,
      u.email as user_email, u.first_name as user_first_name, u.last_name as user_last_name
     FROM user_subscriptions us
     JOIN subscription_plans p ON p.id = us.plan_id
     JOIN users u ON u.id = us.user_id
     ${where}
     ORDER BY us.created_at DESC
     LIMIT $${idx++} OFFSET $${idx}`,
    params
  );
  const rows = result.rows as UserSubscriptionWithDetails[];
  // Fetch invoice URLs in parallel for subscriptions that have Stripe subscription ID
  const withInvoiceUrls = await Promise.all(
    rows.map(async (row) => {
      if (!row.stripe_subscription_id) return { ...row, invoice_url: null as string | null };
      try {
        const stripe = getStripe();
        const sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id, { expand: ['latest_invoice'] });
        const latestInvoiceId = sub.latest_invoice;
        if (typeof latestInvoiceId !== 'string') return { ...row, invoice_url: null as string | null };
        const invoice = await stripe.invoices.retrieve(latestInvoiceId);
        return { ...row, invoice_url: invoice.hosted_invoice_url ?? null };
      } catch {
        return { ...row, invoice_url: null as string | null };
      }
    })
  );
  return { subscriptions: withInvoiceUrls, total };
}
