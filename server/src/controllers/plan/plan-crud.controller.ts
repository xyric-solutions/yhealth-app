/**
 * @file Plan CRUD Controller
 * @description Handles plan read/update operations
 */

import type { Response } from 'express';
import { query } from '../../database/pg.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { logger } from '../../services/logger.service.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import type { UpdatePlanInput } from '../../validators/plan.validator.js';
import { embeddingQueueService } from '../../services/embedding-queue.service.js';
import { JobPriorities } from '../../config/queue.config.js';
import {
  type UserPlanRow,
  type ActivityLogRow,
  type PlanStatus,
  mapPlanRow,
} from './plan.types.js';

/**
 * Get User Plans
 * GET /api/plans
 */
export const getPlans = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { status } = req.query;

  let queryText = 'SELECT * FROM user_plans WHERE user_id = $1';
  const params: (string | PlanStatus)[] = [userId];

  if (status && typeof status === 'string') {
    queryText += ' AND status = $2';
    params.push(status as PlanStatus);
  }

  queryText += ' ORDER BY created_at DESC';

  const plansResult = await query<UserPlanRow>(queryText, params);

  // Get stats for all plans
  const statsResult = await query<{
    status: PlanStatus;
    count: string;
  }>(
    `SELECT status, COUNT(*) as count FROM user_plans WHERE user_id = $1 GROUP BY status`,
    [userId]
  );

  const stats = {
    active: 0,
    paused: 0,
    completed: 0,
    archived: 0,
    draft: 0,
  };

  for (const row of statsResult.rows) {
    if (row.status in stats) {
      stats[row.status as keyof typeof stats] = parseInt(row.count, 10);
    }
  }

  ApiResponse.success(res, {
    plans: plansResult.rows.map(mapPlanRow),
    total: plansResult.rows.length,
    stats,
  });
});

/**
 * Get Active Plan
 * GET /api/plans/active
 */
export const getActivePlan = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const planResult = await query<UserPlanRow>(
    `SELECT * FROM user_plans WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );

  if (planResult.rows.length === 0) {
    throw ApiError.notFound('No active plan found');
  }

  const plan = planResult.rows[0];

  // Get today's activities
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayLogsResult = await query<ActivityLogRow>(
    `SELECT * FROM activity_logs WHERE plan_id = $1 AND scheduled_date = $2`,
    [plan.id, today]
  );

  // Get week completion rate
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1);

  const weekLogsResult = await query<ActivityLogRow>(
    `SELECT * FROM activity_logs WHERE plan_id = $1 AND scheduled_date >= $2`,
    [plan.id, startOfWeek]
  );

  const completed = weekLogsResult.rows.filter(l => l.status === 'completed').length;
  const total = weekLogsResult.rows.length || 1;
  const weekCompletionRate = Math.round((completed / total) * 100);

  ApiResponse.success(res, {
    plan: mapPlanRow(plan),
    todayActivities: todayLogsResult.rows,
    weekCompletionRate,
  });
});

/**
 * Get Plan by ID
 * GET /api/plans/:planId
 */
export const getPlanById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { planId } = req.params;
  if (!planId) throw ApiError.badRequest('Plan ID is required');

  const planResult = await query<UserPlanRow>(
    'SELECT * FROM user_plans WHERE id = $1 AND user_id = $2',
    [planId, userId]
  );

  if (planResult.rows.length === 0) {
    throw ApiError.notFound('Plan not found');
  }

  ApiResponse.success(res, { plan: mapPlanRow(planResult.rows[0]) });
});

/**
 * Update Plan
 * PATCH /api/plans/:planId
 */
export const updatePlan = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { planId } = req.params;
  const data = req.body as UpdatePlanInput;

  if (!planId) throw ApiError.badRequest('Plan ID is required');

  const planResult = await query<UserPlanRow>(
    'SELECT * FROM user_plans WHERE id = $1 AND user_id = $2',
    [planId, userId]
  );

  if (planResult.rows.length === 0) throw ApiError.notFound('Plan not found');

  const plan = planResult.rows[0];

  const updates: string[] = [];
  const values: (string | number | Date | object | null)[] = [];
  let paramIndex = 1;

  if (data.status) {
    updates.push(`status = $${paramIndex++}`);
    values.push(data.status);

    if (data.status === 'paused') {
      updates.push(`paused_at = $${paramIndex++}`);
      values.push(new Date());
    } else if (data.status === 'active' && plan.status === 'paused') {
      updates.push(`resumed_at = $${paramIndex++}`);
      values.push(new Date());
    } else if (data.status === 'completed') {
      updates.push(`completed_at = $${paramIndex++}`);
      values.push(new Date());
    }
  }

  if (data.activities) {
    updates.push(`activities = $${paramIndex++}`);
    values.push(JSON.stringify(data.activities));

    // Track adjustment
    const currentAdjustments = (plan.user_adjustments as Array<{ type: string; timestamp: Date }>) || [];
    currentAdjustments.push({ type: 'activities_modified', timestamp: new Date() });
    updates.push(`user_adjustments = $${paramIndex++}`);
    values.push(JSON.stringify(currentAdjustments));
  }

  if (data.userRating !== undefined) {
    updates.push(`user_rating = $${paramIndex++}`);
    values.push(data.userRating);
  }

  if (data.userFeedback !== undefined) {
    updates.push(`user_feedback = $${paramIndex++}`);
    values.push(data.userFeedback);
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(planId);

  const updateResult = await query<UserPlanRow>(
    `UPDATE user_plans SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  logger.info('Plan updated', { userId, planId, changes: Object.keys(data) });

  // Enqueue embedding update for plan (async, non-blocking)
  await embeddingQueueService.enqueueEmbedding({
    userId,
    sourceType: 'user_plan',
    sourceId: planId,
    operation: 'update',
    priority: JobPriorities.CRITICAL,
  });

  ApiResponse.success(res, { plan: mapPlanRow(updateResult.rows[0]) }, 'Plan updated');
});

/**
 * Delete Plan
 * DELETE /api/plans/:planId
 */
export const deletePlan = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { planId } = req.params;
  if (!planId) throw ApiError.badRequest('Plan ID is required');

  // Verify the plan belongs to the user
  const planResult = await query<UserPlanRow>(
    'SELECT * FROM user_plans WHERE id = $1 AND user_id = $2',
    [planId, userId]
  );

  if (planResult.rows.length === 0) {
    throw ApiError.notFound('Plan not found');
  }

  // Enqueue embedding deletion BEFORE actual delete (to preserve ID)
  await embeddingQueueService.enqueueEmbedding({
    userId,
    sourceType: 'user_plan',
    sourceId: planId,
    operation: 'delete',
    priority: JobPriorities.MEDIUM,
  });

  // Delete activity logs for this plan first (foreign key constraint)
  await query('DELETE FROM activity_logs WHERE plan_id = $1', [planId]);

  // Delete the plan
  await query('DELETE FROM user_plans WHERE id = $1', [planId]);

  logger.info('Plan deleted', { userId, planId, planName: planResult.rows[0].name });

  ApiResponse.success(res, { deleted: true }, 'Plan deleted successfully');
});
