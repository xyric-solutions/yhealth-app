/**
 * Subscription Controller
 * Plans listing, checkout, portal, and admin CRUD
 */

import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import {
  listPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
  createCheckoutSession,
  createPortalSession,
  verifyCheckoutSession,
  syncSubscriptionFromStripeRecovery,
  getSubscriptionAccess,
  getLatestInvoiceUrl,
  adminListPlans,
  adminListSubscriptions,
} from '../services/subscription.service.js';
import type { CreatePlanInput, UpdatePlanInput } from '../validators/subscription.validator.js';
import { getRevenueStats } from '../services/subscription-revenue.service.js';
import { query } from '../database/pg.js';

export const getPlansHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const activeOnly = (req.query.activeOnly as string) !== 'false';
  const plans = await listPlans(activeOnly);
  ApiResponse.success(res, { plans });
});

export const createCheckoutSessionHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized('Authentication required');
  const { planId, successUrl, cancelUrl } = req.body as { planId: string; successUrl: string; cancelUrl: string };
  const { url, mode } = await createCheckoutSession(userId, planId, successUrl, cancelUrl);
  if (!url) throw ApiError.badRequest('Could not create checkout session');
  ApiResponse.success(res, { url, mode });
});

/** POST /subscription/verify-session — Verify payment from Stripe (callback when webhook not available). */
export const verifySessionHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized('Authentication required');
  const { session_id } = req.body as { session_id: string };
  if (!session_id || typeof session_id !== 'string' || !session_id.trim()) {
    throw ApiError.badRequest('Session ID is required. Return to the subscription page and try again.');
  }
  const result = await verifyCheckoutSession(session_id.trim(), userId);
  if (!result.success) {
    const message = result.error ?? 'Verification failed';
    throw ApiError.badRequest(message);
  }
  ApiResponse.success(res, {
    verified: true,
    reason: result.reason,
    subscription: result.subscription ?? undefined,
  });
});

/** POST /subscription/sync-from-stripe — Recovery: find completed Stripe Checkout for this user and create subscription in DB. */
export const syncFromStripeHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized('Authentication required');
  const result = await syncSubscriptionFromStripeRecovery(userId);
  if (!result.synced) {
    throw ApiError.badRequest(result.error ?? 'Could not sync subscription from Stripe.');
  }
  ApiResponse.success(res, {
    synced: true,
    reason: result.reason,
    subscription: result.subscription ?? undefined,
  });
});

export const createPortalSessionHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized('Authentication required');
  const { returnUrl } = req.body as { returnUrl: string };
  const { url } = await createPortalSession(userId, returnUrl);
  ApiResponse.success(res, { url });
});

export const getMySubscriptionHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized('Authentication required');
  const { subscription, plan, access } = await getSubscriptionAccess(userId);
  const invoiceUrl = subscription ? await getLatestInvoiceUrl(userId) : null;
  ApiResponse.success(res, {
    subscription: subscription
      ? {
          id: subscription.id,
          status: subscription.status,
          current_period_start: subscription.current_period_start
            ? new Date(subscription.current_period_start).toISOString()
            : null,
          current_period_end: subscription.current_period_end
            ? new Date(subscription.current_period_end).toISOString()
            : null,
          cancel_at_period_end: subscription.cancel_at_period_end ?? false,
          canceled_at: subscription.canceled_at
            ? new Date(subscription.canceled_at).toISOString()
            : null,
          plan: plan ? { id: plan.id, name: plan.name, slug: plan.slug, amount_cents: plan.amount_cents, interval: plan.interval } : null,
        }
      : null,
    invoiceUrl: invoiceUrl ?? undefined,
    access: {
      allowed: access.allowed,
      reason: access.reason,
      trialEndsAt: access.trialEndsAt,
      daysLeftInTrial: access.daysLeftInTrial,
    },
  });
});

// ========== Admin ==========

export const adminListPlansHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const query = req.query as { page?: string; limit?: string; is_active?: string };
  const page = query.page ? parseInt(query.page, 10) : 1;
  const limit = query.limit ? parseInt(query.limit, 10) : 20;
  const is_active = query.is_active === 'true' ? true : query.is_active === 'false' ? false : undefined;
  const result = await adminListPlans({ page, limit, is_active });
  const totalPages = Math.ceil(result.total / limit);
  ApiResponse.success(res, result, {
    meta: { page, limit, total: result.total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
  });
});

export const adminGetPlanHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const plan = await getPlanById(id);
  if (!plan) throw ApiError.notFound('Plan not found');
  ApiResponse.success(res, { plan });
});

export const adminCreatePlanHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = req.body as CreatePlanInput;
  const plan = await createPlan(body);
  ApiResponse.success(res, { plan }, { statusCode: 201 });
});

export const adminUpdatePlanHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const body = req.body as UpdatePlanInput;
  const plan = await updatePlan(id, body);
  if (!plan) throw ApiError.notFound('Plan not found');
  ApiResponse.success(res, { plan });
});

export const adminDeletePlanHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const ok = await deletePlan(id);
  if (!ok) throw ApiError.notFound('Plan not found');
  ApiResponse.success(res, { deleted: true });
});

export const adminListSubscriptionsHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const query = req.query as { page?: string; limit?: string; status?: string; planId?: string; userId?: string };
  const page = query.page ? parseInt(query.page, 10) : 1;
  const limit = query.limit ? parseInt(query.limit, 10) : 20;
  const result = await adminListSubscriptions({
    page,
    limit,
    status: query.status,
    planId: query.planId,
    userId: query.userId,
  });
  const totalPages = Math.ceil(result.total / limit);
  ApiResponse.success(res, result, {
    meta: { page, limit, total: result.total, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
  });
});

export const getRevenueStatsHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const period = (req.query.period as 'week' | 'month' | 'quarter' | 'year' | 'lifetime') || 'month';
  const stats = await getRevenueStats(period);
  ApiResponse.success(res, stats);
});

export const adminUpdateSubscriptionHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { status, current_period_start, current_period_end, cancel_at_period_end } = req.body as {
    status?: string;
    current_period_start?: string;
    current_period_end?: string;
    cancel_at_period_end?: boolean;
  };

  const updates: string[] = [];
  const values: (string | boolean | Date | null)[] = [];
  let idx = 1;

  if (status !== undefined) {
    updates.push(`status = $${idx++}`);
    values.push(status);
  }
  if (current_period_start !== undefined) {
    updates.push(`current_period_start = $${idx++}::timestamptz`);
    values.push(current_period_start ? new Date(current_period_start) : null);
  }
  if (current_period_end !== undefined) {
    updates.push(`current_period_end = $${idx++}::timestamptz`);
    values.push(current_period_end ? new Date(current_period_end) : null);
  }
  if (cancel_at_period_end !== undefined) {
    updates.push(`cancel_at_period_end = $${idx++}`);
    values.push(cancel_at_period_end);
  }

  if (updates.length === 0) {
    throw ApiError.badRequest('No fields to update');
  }

  updates.push(`updated_at = NOW() AT TIME ZONE 'UTC'`);
  values.push(id);

  const result = await query(
    `UPDATE user_subscriptions SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    throw ApiError.notFound('Subscription not found');
  }

  ApiResponse.success(res, { subscription: result.rows[0] });
});

export const adminDeleteSubscriptionHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const result = await query('DELETE FROM user_subscriptions WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) {
    throw ApiError.notFound('Subscription not found');
  }
  ApiResponse.success(res, { deleted: true });
});

export const generateInvoiceHandler = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { subscriptionId } = req.body as { subscriptionId: string };
  if (!subscriptionId) {
    throw ApiError.badRequest('Subscription ID is required');
  }

  const subResult = await query<{
    id: string;
    user_id: string;
    plan_id: string;
    amount_cents: number;
    currency: string;
    plan_name: string;
    user_email: string;
    user_first_name: string | null;
    user_last_name: string | null;
    current_period_start: Date | null;
    current_period_end: Date | null;
  }>(
    `SELECT 
      us.id, us.user_id, us.plan_id, us.current_period_start, us.current_period_end,
      sp.amount_cents, sp.currency, sp.name as plan_name,
      u.email as user_email, u.first_name as user_first_name, u.last_name as user_last_name
    FROM user_subscriptions us
    JOIN subscription_plans sp ON us.plan_id = sp.id
    JOIN users u ON us.user_id = u.id
    WHERE us.id = $1`,
    [subscriptionId]
  );

  if (subResult.rows.length === 0) {
    throw ApiError.notFound('Subscription not found');
  }

  const sub = subResult.rows[0];
  const invoiceData = {
    subscriptionId: sub.id,
    invoiceNumber: `INV-${sub.id.substring(0, 8).toUpperCase()}-${Date.now()}`,
    date: new Date().toISOString(),
    customer: {
      name: [sub.user_first_name, sub.user_last_name].filter(Boolean).join(' ') || 'Customer',
      email: sub.user_email,
    },
    plan: {
      name: sub.plan_name,
      amount: sub.amount_cents / 100,
      currency: sub.currency.toUpperCase(),
    },
    period: {
      start: sub.current_period_start ? new Date(sub.current_period_start).toISOString() : null,
      end: sub.current_period_end ? new Date(sub.current_period_end).toISOString() : null,
    },
    total: sub.amount_cents / 100,
  };

  // Store invoice in database (you can create an invoices table if needed)
  // For now, we'll return the invoice data and generate PDF on frontend
  ApiResponse.success(res, invoiceData);
});
