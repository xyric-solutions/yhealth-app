/**
 * @file Plan Activities Controller
 * @description Handles activity logging and retrieval
 */

import type { Response } from 'express';
import { query } from '../../database/pg.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { logger } from '../../services/logger.service.js';
import { notificationService } from '../../services/notification.service.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import type { LogActivityInput } from '../../validators/plan.validator.js';
import {
  type UserPlanRow,
  type ActivityLogRow,
  type IActivity,
  type DayOfWeek,
} from './plan.types.js';

/**
 * Generate AI feedback for completed activities
 */
async function generateActivityFeedback(
  activity: IActivity,
  data: LogActivityInput
): Promise<string> {
  const feedbackOptions = [
    `Great job completing "${activity.title}"! Keep up the momentum.`,
    `Excellent work on "${activity.title}"! You're building strong habits.`,
    `"${activity.title}" completed! Every session counts toward your goal.`,
  ];

  if (data.mood && data.mood >= 4) {
    return feedbackOptions[0] + " I can see you're feeling great about it!";
  }

  return feedbackOptions[Math.floor(Math.random() * feedbackOptions.length)];
}

/**
 * Calculate total scheduled activities for a plan
 * Based on activities' daysOfWeek and plan duration
 */
function calculateTotalScheduledActivities(
  activities: IActivity[],
  startDate: Date,
  endDate: Date
): number {
  let total = 0;
  const dayOfWeekMap: Record<DayOfWeek, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  const currentDate = new Date(startDate);
  currentDate.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  // For each activity, count occurrences based on daysOfWeek
  for (const activity of activities) {
    const checkDate = new Date(currentDate);
    while (checkDate <= end) {
      const dayOfWeek = checkDate.getDay();
      const dayName = Object.keys(dayOfWeekMap).find(
        (key) => dayOfWeekMap[key as DayOfWeek] === dayOfWeek
      ) as DayOfWeek;

      if (dayName && activity.daysOfWeek.includes(dayName)) {
        total++;
      }

      checkDate.setDate(checkDate.getDate() + 1);
    }
  }

  return total;
}

/**
 * Update plan progress after activity logging
 * Calculates progress based on scheduled activities, not just logs
 */
async function updatePlanProgress(planId: string): Promise<void> {
  // Get the plan to access activities and dates
  const planResult = await query<UserPlanRow>(
    'SELECT * FROM user_plans WHERE id = $1',
    [planId]
  );

  if (planResult.rows.length === 0) return;

  const plan = planResult.rows[0];
  const activities = (plan.activities as IActivity[]) || [];

  if (activities.length === 0) return;

  // Calculate total scheduled activities from start to today (or end_date if plan is completed)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = plan.start_date instanceof Date
    ? plan.start_date
    : new Date(plan.start_date);
  const endDate = plan.end_date instanceof Date
    ? plan.end_date
    : new Date(plan.end_date);

  // Use today if plan is still active, otherwise use end_date
  const calculateToDate = today < endDate ? today : endDate;

  const totalScheduled = calculateTotalScheduledActivities(
    activities,
    startDate,
    calculateToDate
  );

  // Get completed logs
  const logsResult = await query<ActivityLogRow>(
    `SELECT * FROM activity_logs 
     WHERE plan_id = $1 
     AND scheduled_date >= $2 
     AND scheduled_date <= $3`,
    [planId, startDate, calculateToDate]
  );

  const completed = logsResult.rows.filter(l => l.status === 'completed').length;
  const overallProgress = totalScheduled > 0
    ? Math.round((completed / totalScheduled) * 100)
    : 0;

  await query(
    'UPDATE user_plans SET overall_progress = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [overallProgress, planId]
  );
}

/**
 * Log Activity Completion
 * POST /api/plans/:planId/activities/:activityId/log
 */
export const logActivity = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { planId, activityId } = req.params;
  const data = req.body as LogActivityInput;

  if (!planId || !activityId) {
    throw ApiError.badRequest('Plan ID and Activity ID are required');
  }

  const planResult = await query<UserPlanRow>(
    'SELECT * FROM user_plans WHERE id = $1 AND user_id = $2',
    [planId, userId]
  );

  if (planResult.rows.length === 0) throw ApiError.notFound('Plan not found');

  const plan = planResult.rows[0];
  const activities = plan.activities as IActivity[];

  const activity = activities.find(a => a.id === activityId);
  if (!activity) throw ApiError.notFound('Activity not found in plan');

  const scheduledDate = data.scheduledDate ? new Date(data.scheduledDate) : new Date();
  scheduledDate.setHours(0, 0, 0, 0);

  // Upsert activity log
  const existingLogResult = await query<ActivityLogRow>(
    'SELECT * FROM activity_logs WHERE plan_id = $1 AND activity_id = $2 AND scheduled_date = $3',
    [planId, activityId, scheduledDate]
  );

  let activityLog: ActivityLogRow;
  if (existingLogResult.rows.length > 0) {
    const updateResult = await query<ActivityLogRow>(
      `UPDATE activity_logs SET
        status = $1,
        completed_at = $2,
        actual_value = $3,
        duration = $4,
        user_notes = $5,
        mood = $6,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *`,
      [
        data.status,
        data.status === 'completed' ? new Date() : null,
        data.actualValue || null,
        data.duration || null,
        data.notes || null,
        data.mood || null,
        existingLogResult.rows[0].id,
      ]
    );
    activityLog = updateResult.rows[0];
  } else {
    const createResult = await query<ActivityLogRow>(
      `INSERT INTO activity_logs (
        user_id, plan_id, activity_id, scheduled_date,
        status, completed_at, actual_value, target_value, duration, user_notes, mood
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        userId,
        planId,
        activityId,
        scheduledDate,
        data.status,
        data.status === 'completed' ? new Date() : null,
        data.actualValue || null,
        activity.targetValue || null,
        data.duration || null,
        data.notes || null,
        data.mood || null,
      ]
    );
    activityLog = createResult.rows[0];
  }

  // Generate AI feedback for completed activities
  let feedback: string | undefined;
  if (data.status === 'completed') {
    feedback = await generateActivityFeedback(activity, data);

    await query(
      'UPDATE activity_logs SET ai_feedback = $1 WHERE id = $2',
      [feedback, activityLog.id]
    );
  }

  // Update plan progress
  await updatePlanProgress(planId);

  // Send notification for completed activities
  if (data.status === 'completed') {
    await notificationService.activityLogged(userId, activity.type, activity.title);

    // Check for streak milestone
    const streakResult = await query<{ streak_count: string }>(
      `SELECT COUNT(DISTINCT scheduled_date) as streak_count
       FROM activity_logs
       WHERE plan_id = $1 AND status = 'completed'
       AND scheduled_date >= CURRENT_DATE - INTERVAL '7 days'`,
      [planId]
    );
    const streakDays = parseInt(streakResult.rows[0]?.streak_count || '0');
    if ([3, 7, 14, 30].includes(streakDays)) {
      await notificationService.streakMilestone(userId, streakDays, 'activity');
    }
  }

  logger.info('Activity logged', {
    userId,
    planId,
    activityId,
    status: data.status,
  });

  ApiResponse.success(res, {
    log: activityLog,
    feedback,
  }, 'Activity logged successfully');
});

/**
 * Get Activity Logs
 * GET /api/plans/:planId/logs
 */
export const getActivityLogs = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { planId } = req.params;
  const { startDate, endDate, activityId } = req.query;

  if (!planId) throw ApiError.badRequest('Plan ID is required');

  const planResult = await query<UserPlanRow>(
    'SELECT * FROM user_plans WHERE id = $1 AND user_id = $2',
    [planId, userId]
  );

  if (planResult.rows.length === 0) throw ApiError.notFound('Plan not found');

  let queryText = 'SELECT * FROM activity_logs WHERE plan_id = $1';
  const params: (string | Date)[] = [planId];
  let paramIndex = 2;

  if (startDate && typeof startDate === 'string') {
    queryText += ` AND scheduled_date >= $${paramIndex++}`;
    params.push(new Date(startDate));
  }

  if (endDate && typeof endDate === 'string') {
    queryText += ` AND scheduled_date <= $${paramIndex++}`;
    params.push(new Date(endDate));
  }

  if (activityId && typeof activityId === 'string') {
    queryText += ` AND activity_id = $${paramIndex++}`;
    params.push(activityId);
  }

  queryText += ' ORDER BY scheduled_date DESC, created_at DESC';

  const logsResult = await query<ActivityLogRow>(queryText, params);

  ApiResponse.success(res, { logs: logsResult.rows });
});

/**
 * Complete Activity (Simple toggle)
 * POST /api/plans/:planId/activities/:activityId/complete
 */
export const completeActivity = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { planId, activityId } = req.params;
  const { scheduledDate, notes, mood } = req.body;

  if (!planId || !activityId) {
    throw ApiError.badRequest('Plan ID and Activity ID are required');
  }

  const planResult = await query<UserPlanRow>(
    'SELECT * FROM user_plans WHERE id = $1 AND user_id = $2',
    [planId, userId]
  );

  if (planResult.rows.length === 0) throw ApiError.notFound('Plan not found');

  const plan = planResult.rows[0];
  const activities = plan.activities as IActivity[];
  const activity = activities.find(a => a.id === activityId);

  if (!activity) throw ApiError.notFound('Activity not found in plan');

  // Use YYYY-MM-DD string directly for DATE column comparison (avoids timezone shift)
  const targetDateStr = scheduledDate
    ? (typeof scheduledDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)
        ? scheduledDate
        : new Date(scheduledDate).toISOString().split('T')[0])
    : new Date().toISOString().split('T')[0];

  // Upsert activity log as completed
  const existingLogResult = await query<ActivityLogRow>(
    'SELECT * FROM activity_logs WHERE plan_id = $1 AND activity_id = $2 AND scheduled_date = $3::date',
    [planId, activityId, targetDateStr]
  );

  let activityLog: ActivityLogRow;
  const completedAt = new Date();

  if (existingLogResult.rows.length > 0) {
    const updateResult = await query<ActivityLogRow>(
      `UPDATE activity_logs SET
        status = 'completed',
        completed_at = $1,
        user_notes = COALESCE($2, user_notes),
        mood = COALESCE($3, mood),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *`,
      [completedAt, notes || null, mood || null, existingLogResult.rows[0].id]
    );
    activityLog = updateResult.rows[0];
  } else {
    const createResult = await query<ActivityLogRow>(
      `INSERT INTO activity_logs (
        user_id, plan_id, activity_id, scheduled_date,
        status, completed_at, target_value, user_notes, mood
      ) VALUES ($1, $2, $3, $4, 'completed', $5, $6, $7, $8)
      RETURNING *`,
      [
        userId,
        planId,
        activityId,
        targetDateStr,
        completedAt,
        activity.targetValue || null,
        notes || null,
        mood || null,
      ]
    );
    activityLog = createResult.rows[0];
  }

  // Generate AI feedback
  const feedbackOptions = [
    `Great job completing "${activity.title}"! Keep up the momentum.`,
    `Excellent work on "${activity.title}"! You're building strong habits.`,
    `"${activity.title}" completed! Every session counts toward your goal.`,
  ];
  const feedback = feedbackOptions[Math.floor(Math.random() * feedbackOptions.length)];

  await query(
    'UPDATE activity_logs SET ai_feedback = $1 WHERE id = $2',
    [feedback, activityLog.id]
  );

  // Update plan progress
  await updatePlanProgress(planId);

  // Get plan to calculate correct totals
  const planForProgress = await query<UserPlanRow>(
    'SELECT * FROM user_plans WHERE id = $1',
    [planId]
  );
  
  if (planForProgress.rows.length === 0) {
    throw ApiError.notFound('Plan not found');
  }

  const planForCalc = planForProgress.rows[0];
  const activitiesForCalc = (planForCalc.activities as IActivity[]) || [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const planStartDate = planForCalc.start_date instanceof Date
    ? planForCalc.start_date
    : new Date(planForCalc.start_date);
  const planEndDate = planForCalc.end_date instanceof Date
    ? planForCalc.end_date
    : new Date(planForCalc.end_date);
  const calculateToDate = today < planEndDate ? today : planEndDate;

  const totalScheduled = calculateTotalScheduledActivities(
    activitiesForCalc,
    planStartDate,
    calculateToDate
  );

  // Get completed count
  const completedResult = await query<{ completed: string }>(
    `SELECT COUNT(*) FILTER (WHERE status = 'completed') as completed
     FROM activity_logs 
     WHERE plan_id = $1 
     AND scheduled_date >= $2 
     AND scheduled_date <= $3`,
    [planId, planStartDate, calculateToDate]
  );
  const completedCount = parseInt(completedResult.rows[0]?.completed || '0');
  const overallProgress = totalScheduled > 0
    ? Math.round((completedCount / totalScheduled) * 100)
    : 0;

  // Check for streak milestone
  const streakResult = await query<{ streak_count: string }>(
    `SELECT COUNT(DISTINCT scheduled_date) as streak_count
     FROM activity_logs
     WHERE plan_id = $1 AND status = 'completed'
     AND scheduled_date >= CURRENT_DATE - INTERVAL '7 days'`,
    [planId]
  );
  const streakDays = parseInt(streakResult.rows[0]?.streak_count || '0');

  // Check if this is a milestone
  const isMilestone = [3, 7, 14, 30].includes(streakDays);

  if (isMilestone) {
    await notificationService.streakMilestone(userId, streakDays, 'activity');
  }

  await notificationService.activityLogged(userId, activity.type, activity.title);

  logger.info('Activity completed', {
    userId,
    planId,
    activityId,
    streakDays,
    isMilestone,
  });

  ApiResponse.success(res, {
    log: activityLog,
    feedback,
    progress: {
      completed: completedCount,
      total: totalScheduled,
      percentage: overallProgress,
    },
    streak: {
      days: streakDays,
      isMilestone,
    },
  }, 'Activity completed!');
});

/**
 * Uncomplete Activity
 * POST /api/plans/:planId/activities/:activityId/uncomplete
 */
export const uncompleteActivity = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { planId, activityId } = req.params;
  const { scheduledDate } = req.body;

  if (!planId || !activityId) {
    throw ApiError.badRequest('Plan ID and Activity ID are required');
  }

  const planResult = await query<UserPlanRow>(
    'SELECT * FROM user_plans WHERE id = $1 AND user_id = $2',
    [planId, userId]
  );

  if (planResult.rows.length === 0) throw ApiError.notFound('Plan not found');

  const plan = planResult.rows[0];
  // Use YYYY-MM-DD string directly for DATE column comparison (avoids timezone shift)
  const targetDateStr = scheduledDate
    ? (typeof scheduledDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)
        ? scheduledDate
        : new Date(scheduledDate).toISOString().split('T')[0])
    : new Date().toISOString().split('T')[0];

  // Update activity log to pending
  const updateResult = await query<ActivityLogRow>(
    `UPDATE activity_logs SET
      status = 'pending',
      completed_at = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE plan_id = $1 AND activity_id = $2 AND scheduled_date = $3::date
    RETURNING *`,
    [planId, activityId, targetDateStr]
  );

  if (updateResult.rows.length === 0) {
    throw ApiError.notFound('Activity log not found for this date');
  }

  // Update plan progress
  await updatePlanProgress(planId);

  // Use existing plan data to calculate correct totals
  const activities = (plan.activities as IActivity[]) || [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const planStartDate = plan.start_date instanceof Date
    ? plan.start_date
    : new Date(plan.start_date);
  const planEndDate = plan.end_date instanceof Date
    ? plan.end_date
    : new Date(plan.end_date);
  const calculateToDate = today < planEndDate ? today : planEndDate;

  const totalScheduled = calculateTotalScheduledActivities(
    activities,
    planStartDate,
    calculateToDate
  );

  // Get completed count
  const completedResult = await query<{ completed: string }>(
    `SELECT COUNT(*) FILTER (WHERE status = 'completed') as completed
     FROM activity_logs 
     WHERE plan_id = $1 
     AND scheduled_date >= $2 
     AND scheduled_date <= $3`,
    [planId, planStartDate, calculateToDate]
  );
  const completedCount = parseInt(completedResult.rows[0]?.completed || '0');
  const overallProgress = totalScheduled > 0
    ? Math.round((completedCount / totalScheduled) * 100)
    : 0;

  logger.info('Activity uncompleted', {
    userId,
    planId,
    activityId,
  });

  ApiResponse.success(res, {
    log: updateResult.rows[0],
    progress: {
      completed: completedCount,
      total: totalScheduled,
      percentage: overallProgress,
    },
  }, 'Activity marked as incomplete');
});

/**
 * Get Plan Progress
 * GET /api/plans/:planId/progress
 */
export const getPlanProgress = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { planId } = req.params;

  if (!planId) throw ApiError.badRequest('Plan ID is required');

  const planResult = await query<UserPlanRow>(
    'SELECT * FROM user_plans WHERE id = $1 AND user_id = $2',
    [planId, userId]
  );

  if (planResult.rows.length === 0) throw ApiError.notFound('Plan not found');

  const plan = planResult.rows[0];

  // Ensure start_date is properly formatted for PostgreSQL date operations
  // PostgreSQL pg driver may return dates as strings or Date objects
  const rawStartDate = plan.start_date;
  const startDateStr = rawStartDate instanceof Date
    ? rawStartDate.toISOString().split('T')[0]
    : String(rawStartDate).split('T')[0];

  // Calculate total scheduled activities from plan definition
  const activities = (plan.activities as IActivity[]) || [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const planStartDate = plan.start_date instanceof Date
    ? plan.start_date
    : new Date(plan.start_date);
  const planEndDate = plan.end_date instanceof Date
    ? plan.end_date
    : new Date(plan.end_date);

  // Use today if plan is still active, otherwise use end_date
  const calculateToDate = today < planEndDate ? today : planEndDate;

  const totalScheduled = calculateTotalScheduledActivities(
    activities,
    planStartDate,
    calculateToDate
  );

  // Get overall stats from logs (only for dates within plan period)
  const overallResult = await query<{ completed: string; skipped: string; pending: string }>(
    `SELECT
      COUNT(*) FILTER (WHERE status = 'completed') as completed,
      COUNT(*) FILTER (WHERE status = 'skipped') as skipped,
      COUNT(*) FILTER (WHERE status = 'pending') as pending
    FROM activity_logs 
    WHERE plan_id = $1 
    AND scheduled_date >= $2 
    AND scheduled_date <= $3`,
    [planId, planStartDate, calculateToDate]
  );

  // Get weekly breakdown
  // Calculate week number based on days difference from start date
  // For weekly totals, we need to calculate scheduled activities per week
  const weeklyResult = await query<{ week_num: string; completed: string }>(
    `SELECT
      CEIL((scheduled_date::date - $2::date + 1)::numeric / 7) as week_num,
      COUNT(*) FILTER (WHERE status = 'completed') as completed
    FROM activity_logs
    WHERE plan_id = $1 
    AND scheduled_date IS NOT NULL
    AND scheduled_date >= $2
    AND scheduled_date <= $3
    GROUP BY week_num
    ORDER BY week_num`,
    [planId, startDateStr, calculateToDate]
  );

  // Calculate total scheduled per week based on plan activities
  const weeklyCompletion = [];
  const totalWeeks = plan.duration_weeks;
  for (let week = 1; week <= totalWeeks; week++) {
    const weekStart = new Date(planStartDate);
    weekStart.setDate(weekStart.getDate() + (week - 1) * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    // Use calculateToDate if week extends beyond it
    const weekEndDate = weekEnd > calculateToDate ? calculateToDate : weekEnd;
    
    const weekTotal = calculateTotalScheduledActivities(
      activities,
      weekStart,
      weekEndDate
    );
    
    const weekData = weeklyResult.rows.find(r => parseInt(r.week_num) === week);
    const weekCompleted = weekData ? parseInt(weekData.completed) : 0;
    
    weeklyCompletion.push({
      week,
      completed: weekCompleted,
      total: weekTotal,
      percentage: weekTotal > 0
        ? Math.round((weekCompleted / weekTotal) * 100)
        : 0,
    });
  }

  // Streak calculation - count consecutive days from today backwards
  const simpleStreakResult = await query<{ streak: string }>(
    `WITH dates AS (
      SELECT DISTINCT scheduled_date::date as d
      FROM activity_logs
      WHERE plan_id = $1 AND status = 'completed'
      ORDER BY d DESC
    ),
    numbered AS (
      SELECT d, ROW_NUMBER() OVER (ORDER BY d DESC) as rn
      FROM dates
    )
    SELECT COUNT(*) as streak
    FROM numbered
    WHERE d = CURRENT_DATE - (rn - 1) * INTERVAL '1 day'`,
    [planId]
  );

  const overall = overallResult.rows[0];
  const completed = parseInt(overall?.completed || '0');
  const skipped = parseInt(overall?.skipped || '0');
  const pending = parseInt(overall?.pending || '0');
  const overallProgress = totalScheduled > 0
    ? Math.round((completed / totalScheduled) * 100)
    : 0;


  const currentStreak = parseInt(simpleStreakResult.rows[0]?.streak || '0');

  ApiResponse.success(res, {
    planId,
    currentWeek: plan.current_week,
    durationWeeks: plan.duration_weeks,
    overall: {
      completed,
      skipped,
      pending,
      total: totalScheduled,
      percentage: overallProgress,
    },
    weekly: weeklyCompletion,
    streak: {
      current: currentStreak,
      best: currentStreak, // Could track this separately
    },
  });
});

/**
 * Get Today's Activities
 * GET /api/plans/today or GET /api/plans/:planId/today
 */
export const getTodayActivities = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { planId } = req.params;
  let plan: UserPlanRow;

  if (planId) {
    const planResult = await query<UserPlanRow>(
      'SELECT * FROM user_plans WHERE id = $1 AND user_id = $2',
      [planId, userId]
    );
    if (planResult.rows.length === 0) throw ApiError.notFound('Plan not found');
    plan = planResult.rows[0];
  } else {
    const planResult = await query<UserPlanRow>(
      `SELECT * FROM user_plans WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    if (planResult.rows.length === 0) throw ApiError.notFound('No active plan found');
    plan = planResult.rows[0];
  }

  const today = new Date();
  const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][today.getDay()] as DayOfWeek;

  const activities = plan.activities as IActivity[];
  const todayActivities = activities.filter(a => a.daysOfWeek.includes(dayOfWeek));

  // Get existing logs for today
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);

  const logsResult = await query<ActivityLogRow>(
    'SELECT * FROM activity_logs WHERE plan_id = $1 AND scheduled_date = $2',
    [plan.id, todayStart]
  );

  // Use Map for O(1) lookup instead of O(n) find in loop
  const logsMap = new Map(logsResult.rows.map(l => [l.activity_id, l]));

  const formattedActivities = todayActivities.map(activity => ({
    ...activity,
    log: logsMap.get(activity.id) || null,
    status: logsMap.get(activity.id)?.status || 'pending',
  }));

  formattedActivities.sort((a, b) => {
    const timeA = a.preferredTime || '23:59';
    const timeB = b.preferredTime || '23:59';
    return timeA.localeCompare(timeB);
  });

  ApiResponse.success(res, {
    planId: plan.id,
    date: today,
    dayOfWeek,
    activities: formattedActivities,
    completedCount: logsResult.rows.filter(l => l.status === 'completed').length,
    totalCount: todayActivities.length,
  });
});

/**
 * Regenerate Activities for Plan
 * POST /api/plans/:planId/regenerate-activities
 * Regenerates activities from linked workout_plans and diet_plans
 */
export const regenerateActivities = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { planId } = req.params;
  if (!planId) throw ApiError.badRequest('Plan ID is required');

  // Get the user_plan
  const planResult = await query<UserPlanRow>(
    'SELECT * FROM user_plans WHERE id = $1 AND user_id = $2',
    [planId, userId]
  );

  if (planResult.rows.length === 0) throw ApiError.notFound('Plan not found');

  // Get linked workout_plan
  const workoutResult = await query<{
    weekly_schedule: Record<string, {
      workoutName: string;
      focusArea: string;
      exercises: Array<{ name: string; sets: number; reps: number; restSeconds: number; instructions?: string[] }>;
      estimatedDuration: number;
    }>;
  }>(
    'SELECT weekly_schedule FROM workout_plans WHERE plan_id = $1 AND user_id = $2 AND status = $3 LIMIT 1',
    [planId, userId, 'active']
  );

  // Get linked diet_plan
  const dietResult = await query<{
    daily_calories: number;
    meal_times: Record<string, string>;
    snacks_per_day: number;
  }>(
    'SELECT daily_calories, meal_times, snacks_per_day FROM diet_plans WHERE plan_id = $1 AND user_id = $2 AND status = $3 LIMIT 1',
    [planId, userId, 'active']
  );

  const activities: IActivity[] = [];
  const mealDays: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  // Generate workout activities
  if (workoutResult.rows.length > 0 && workoutResult.rows[0].weekly_schedule) {
    const weeklySchedule = workoutResult.rows[0].weekly_schedule;
    Object.entries(weeklySchedule).forEach(([day, workout]) => {
      if (workout && workout.workoutName) {
        const exerciseList = workout.exercises
          .map((e: { name: string; sets: number; reps: number }) => `${e.name}: ${e.sets}x${e.reps}`)
          .slice(0, 3)
          .join(', ');

        activities.push({
          id: `workout-${day}-${Date.now()}`,
          type: 'workout',
          title: workout.workoutName,
          description: `${workout.focusArea} - ${exerciseList}${workout.exercises.length > 3 ? '...' : ''}`,
          daysOfWeek: [day as DayOfWeek],
          preferredTime: '07:00',
          duration: workout.estimatedDuration,
          isOptional: false,
          instructions: workout.exercises.map((e: { name: string; sets: number; reps: number; restSeconds: number; instructions?: string[] }) =>
            e.instructions ? e.instructions.join('. ') : `${e.name}: ${e.sets} sets x ${e.reps} reps, ${e.restSeconds}s rest`
          ),
        });
      }
    });
  }

  // Generate meal activities
  if (dietResult.rows.length > 0) {
    const diet = dietResult.rows[0];
    const mealTimes = diet.meal_times || {};
    const dailyCal = diet.daily_calories || 2000;

    activities.push({
      id: `meal-breakfast-${Date.now()}`,
      type: 'meal',
      title: 'Breakfast',
      description: `Track your breakfast (target: ~${Math.round(dailyCal * 0.25)} cal)`,
      daysOfWeek: mealDays,
      preferredTime: mealTimes.breakfast || '08:00',
      isOptional: false,
    });

    activities.push({
      id: `meal-lunch-${Date.now() + 1}`,
      type: 'meal',
      title: 'Lunch',
      description: `Track your lunch (target: ~${Math.round(dailyCal * 0.35)} cal)`,
      daysOfWeek: mealDays,
      preferredTime: mealTimes.lunch || '12:30',
      isOptional: false,
    });

    activities.push({
      id: `meal-dinner-${Date.now() + 2}`,
      type: 'meal',
      title: 'Dinner',
      description: `Track your dinner (target: ~${Math.round(dailyCal * 0.30)} cal)`,
      daysOfWeek: mealDays,
      preferredTime: mealTimes.dinner || '19:00',
      isOptional: false,
    });

    if (diet.snacks_per_day > 0) {
      activities.push({
        id: `meal-snacks-${Date.now() + 3}`,
        type: 'meal',
        title: 'Snacks',
        description: `Track your ${diet.snacks_per_day} snack(s) (target: ~${Math.round(dailyCal * 0.10)} cal)`,
        daysOfWeek: mealDays,
        preferredTime: mealTimes.snack || '15:00',
        isOptional: true,
      });
    }
  }

  // Add water intake
  activities.push({
    id: `hydration-${Date.now() + 4}`,
    type: 'habit',
    title: 'Water Intake',
    description: 'Track your daily water intake (8 glasses recommended)',
    daysOfWeek: mealDays,
    preferredTime: '09:00',
    isOptional: false,
  });

  // Update the plan with new activities
  await query(
    'UPDATE user_plans SET activities = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [JSON.stringify(activities), planId]
  );

  ApiResponse.success(res, {
    planId,
    activitiesCount: activities.length,
    activities,
    message: 'Activities regenerated successfully',
  });
});
