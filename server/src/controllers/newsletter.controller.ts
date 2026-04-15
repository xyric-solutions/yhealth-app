/**
 * Newsletter Controller
 * Public: subscribe, count. Admin: list, getById, delete, bulkDelete
 */

import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import {
  createSubscription,
  getSubscriptionCount,
  listSubscriptions,
  getSubscriptionById,
  deleteSubscription,
  bulkDeleteSubscriptions,
  type CreateNewsletterInput,
} from '../services/newsletter.service.js';

// ============================================
// PUBLIC
// ============================================

export const subscribe = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { email, interests, source } = req.body as CreateNewsletterInput;
  const subscription = await createSubscription({ email, interests, source });
  ApiResponse.success(
    res,
    { id: subscription.id, email: subscription.email },
    "You're subscribed! Welcome aboard.",
    201
  );
});

export const getCount = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  const count = await getSubscriptionCount();
  ApiResponse.success(res, { count }, 'Count fetched');
});

// ============================================
// ADMIN
// ============================================

export const getAdminList = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { page, limit, sort_by, sort_order, search, source, created_after, created_before } = req.query;
  const filters = {
    ...(search && { search: search as string }),
    ...(source && { source: source as string }),
    ...(created_after && { created_after: new Date(created_after as string) }),
    ...(created_before && { created_before: new Date(created_before as string) }),
  };
  const options = {
    page: parseInt((page as string) || '1', 10),
    limit: Math.min(parseInt((limit as string) || '20', 10), 100),
    sort_by: (sort_by as 'created_at' | 'email') || 'created_at',
    sort_order: (sort_order as 'asc' | 'desc') || 'desc',
  };
  const result = await listSubscriptions(filters, options);
  ApiResponse.paginated(
    res,
    result.subscriptions,
    { page: result.page, limit: result.limit, total: result.total },
    'Subscriptions fetched'
  );
});

export const getAdminById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const sub = await getSubscriptionById(id);
  if (!sub) throw new ApiError(404, 'Subscription not found');
  ApiResponse.success(res, sub, 'Subscription fetched');
});

export const deleteOne = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const deleted = await deleteSubscription(id);
  if (!deleted) throw new ApiError(404, 'Subscription not found');
  ApiResponse.success(res, { id }, 'Subscription deleted');
});

export const bulkDelete = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { ids } = req.body as { ids: string[] };
  const deleted = await bulkDeleteSubscriptions(ids);
  ApiResponse.success(res, { deleted }, `${deleted} subscription(s) deleted`);
});
