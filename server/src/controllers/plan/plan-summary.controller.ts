/**
 * @file Plan Summary Controller
 * @description Handles plan summary and progress reporting
 */

import type { Response } from 'express';
import { query } from '../../database/pg.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import {
  type UserPlanRow,
  type ActivityLogRow,
  type IActivity,
  type IWeeklyFocus,
  type ActivityType,
} from './plan.types.js';

/**
 * Get Weekly Summary
 * GET /api/plans/:planId/summary/weekly
 */
export const getWeeklySummary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { planId } = req.params;
  const { week } = req.query;

  if (!planId) throw ApiError.badRequest('Plan ID is required');

  const planResult = await query<UserPlanRow>(
    'SELECT * FROM user_plans WHERE id = $1 AND user_id = $2',
    [planId, userId]
  );

  if (planResult.rows.length === 0) throw ApiError.notFound('Plan not found');

  const plan = planResult.rows[0];
  const targetWeek = week ? parseInt(week as string, 10) : plan.current_week;

  // Calculate week start date
  const planStartDate = new Date(plan.start_date);
  const weekStartDate = new Date(planStartDate.getTime() + (targetWeek - 1) * 7 * 24 * 60 * 60 * 1000);
  const weekEndDate = new Date(weekStartDate.getTime() + 6 * 24 * 60 * 60 * 1000);

  const logsResult = await query<ActivityLogRow>(
    `SELECT * FROM activity_logs WHERE plan_id = $1 AND scheduled_date >= $2 AND scheduled_date <= $3`,
    [planId, weekStartDate, weekEndDate]
  );

  const logs = logsResult.rows;

  // Calculate stats
  const totalActivities = logs.length;
  const completedCount = logs.filter(l => l.status === 'completed').length;
  const skippedCount = logs.filter(l => l.status === 'skipped').length;
  const completionRate = totalActivities > 0
    ? Math.round((completedCount / totalActivities) * 100)
    : 0;

  // Get weekly focus
  const weeklyFocuses = plan.weekly_focuses as IWeeklyFocus[];
  const weekFocus = weeklyFocuses.find(f => f.week === targetWeek);

  // Activity breakdown by type - use Map for O(1) lookup instead of O(n) find in loop
  const activityBreakdown: Record<ActivityType, { completed: number; total: number }> = {
    workout: { completed: 0, total: 0 },
    meal: { completed: 0, total: 0 },
    sleep_routine: { completed: 0, total: 0 },
    mindfulness: { completed: 0, total: 0 },
    habit: { completed: 0, total: 0 },
    check_in: { completed: 0, total: 0 },
    reflection: { completed: 0, total: 0 },
    learning: { completed: 0, total: 0 },
  };

  const activities = plan.activities as IActivity[];
  // Create Map for O(1) lookup - fixes N+1 pattern
  const activityMap = new Map(activities.map(a => [a.id, a]));

  for (const log of logs) {
    const activity = activityMap.get(log.activity_id);
    if (activity) {
      activityBreakdown[activity.type].total++;
      if (log.status === 'completed') {
        activityBreakdown[activity.type].completed++;
      }
    }
  }

  ApiResponse.success(res, {
    week: targetWeek,
    weekStartDate,
    weekEndDate,
    focus: weekFocus,
    stats: {
      totalActivities,
      completed: completedCount,
      skipped: skippedCount,
      pending: totalActivities - completedCount - skippedCount,
      completionRate,
    },
    activityBreakdown,
  });
});
