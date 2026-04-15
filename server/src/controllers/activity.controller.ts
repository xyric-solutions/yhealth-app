import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { query } from '../database/pg.js';
// import { logger } from '../services/logger.service.js';

// Types
interface HealthDataRow {
  id: string;
  user_id: string;
  data_type: string;
  recorded_at: Date;
  value: Record<string, unknown>;
  unit: string;
  provider: string;
}

// Type map for health data to display info
const typeMap: Record<string, { title: string; type: string; pillar: string }> = {
  workouts: { title: 'Workout', type: 'workout', pillar: 'fitness' },
  strain: { title: 'Workout', type: 'workout', pillar: 'fitness' }, // WHOOP stores workouts as 'strain'
  nutrition: { title: 'Nutrition Log', type: 'meal', pillar: 'nutrition' },
  sleep: { title: 'Sleep Tracked', type: 'sleep', pillar: 'wellbeing' },
  recovery: { title: 'Recovery Score', type: 'recovery', pillar: 'wellbeing' }, // WHOOP recovery data
  steps: { title: 'Steps', type: 'steps', pillar: 'fitness' },
  heart_rate: { title: 'Heart Rate', type: 'check_in', pillar: 'fitness' },
  calories: { title: 'Calories', type: 'meal', pillar: 'nutrition' },
  hrv: { title: 'HRV', type: 'check_in', pillar: 'wellbeing' },
};

// Helper to build description from health data value
function buildDescription(dataType: string, value: Record<string, unknown>): string {
  // Handle WHOOP strain (workout) data
  if (dataType === 'strain') {
    const parts: string[] = [];
    const activityType = (value.sport_name || value.activity_type || 'Workout') as string;
    parts.push(activityType);
    if (value.strain_score) parts.push(`Strain: ${Math.round(value.strain_score as number)}`);
    if (value.calories_burned) parts.push(`${Math.round(value.calories_burned as number)} kcal`);
    if (value.duration_minutes) parts.push(`${value.duration_minutes} min`);
    return parts.join(' • ') || 'Workout completed';
  }

  // Handle WHOOP recovery data
  if (dataType === 'recovery') {
    const parts: string[] = [];
    if (value.recovery_score) parts.push(`Recovery: ${Math.round(value.recovery_score as number)}%`);
    if (value.hrv_rmssd_ms) parts.push(`HRV: ${Math.round(value.hrv_rmssd_ms as number)}ms`);
    if (value.resting_heart_rate_bpm) parts.push(`RHR: ${Math.round(value.resting_heart_rate_bpm as number)} bpm`);
    return parts.join(' • ') || 'Recovery tracked';
  }

  // Handle nutrition data
  if (dataType === 'nutrition' && value.glasses) {
    return `${value.glasses} glasses of water`;
  } else if (dataType === 'nutrition' && value.calories) {
    const mealType = value.mealType ? `${value.mealType} - ` : '';
    return `${mealType}${value.calories} kcal`;
  } else if (dataType === 'nutrition' && value.meal_type) {
    const parts: string[] = [(value.meal_type as string).charAt(0).toUpperCase() + (value.meal_type as string).slice(1)];
    if (value.calories) parts.push(`${value.calories} kcal`);
    return parts.join(' • ');
  }

  // Handle sleep data
  if (dataType === 'sleep') {
    const parts: string[] = [];
    if (value.duration_minutes) {
      const hours = ((value.duration_minutes as number) / 60).toFixed(1);
      parts.push(`${hours} hours`);
    } else if (value.duration) {
      const hours = ((value.duration as number) / 60).toFixed(1);
      parts.push(`${hours} hours`);
    }
    if (value.sleep_quality_score) parts.push(`Quality: ${Math.round(value.sleep_quality_score as number)}%`);
    return parts.join(' • ') || 'Sleep tracked';
  }

  // Handle workouts data
  if (dataType === 'workouts') {
    const dur = value.duration ? `${value.duration} minutes` : '';
    const type = value.type ? `${value.type}` : 'workout';
    return dur ? `${dur} - ${type}` : type;
  }

  // Handle steps data
  if (dataType === 'steps' && value.count) {
    return `${(value.count as number).toLocaleString()} steps`;
  }

  // Handle HRV data
  if (dataType === 'hrv' && value.value) {
    return `HRV: ${Math.round(value.value as number)}ms`;
  }

  // Fallback
  if (value.notes) {
    return value.notes as string;
  }

  return `Logged ${dataType.replace(/_/g, ' ')}`;
}

/**
 * Get Activity List
 * GET /api/activity/logs
 * Returns paginated activity logs for a date range
 */
export const getActivityLogs = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const {
    startDate,
    endDate,
    type,
    page = '1',
    limit = '20',
  } = req.query;

  const pageNum = Math.max(1, parseInt(page as string));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));
  const offset = (pageNum - 1) * limitNum;

  // Default to last 30 days if no date range specified
  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setDate(defaultStart.getDate() - 30);

  const start = startDate ? new Date(startDate as string) : defaultStart;
  const end = endDate ? new Date(endDate as string) : today;

  // Use health_data_records as the primary source
  let queryStr = `
    SELECT
      id,
      data_type,
      recorded_at,
      value,
      unit,
      provider
    FROM health_data_records
    WHERE user_id = $1
    AND recorded_at >= $2
    AND recorded_at <= $3
  `;

  const params: (string | Date)[] = [userId, start, end];
  let paramIndex = 4;

  if (type) {
    queryStr += ` AND data_type = $${paramIndex}`;
    params.push(type as string);
    paramIndex++;
  }

  // Get total count
  const countQuery = queryStr.replace(
    /SELECT[\s\S]*?FROM/,
    'SELECT COUNT(*) as count FROM'
  ).replace(/ORDER BY[\s\S]*$/, '');

  const countResult = await query<{ count: string }>(countQuery, params);
  const total = parseInt(countResult.rows[0]?.count || '0');

  // Add ordering and pagination
  queryStr += ` ORDER BY recorded_at DESC`;
  queryStr += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limitNum.toString(), offset.toString());

  const logsResult = await query<HealthDataRow>(queryStr, params);

  const activities = logsResult.rows.map(row => {
    const info = typeMap[row.data_type] || { title: row.data_type, type: 'habit', pillar: 'fitness' };
    const value = row.value || {};

    return {
      id: row.id,
      title: info.title,
      description: buildDescription(row.data_type, value),
      type: info.type,
      pillar: info.pillar,
      completedAt: row.recorded_at,
      duration: (value.duration as number) || null,
      status: 'completed',
      source: 'health_data',
    };
  });

  ApiResponse.paginated(res, activities, {
    page: pageNum,
    limit: limitNum,
    total,
  });
});

/**
 * Get Activity Stats
 * GET /api/activity/stats
 * Returns activity statistics for a time period
 */
export const getActivityStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { period = 'week' } = req.query;

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  let startDate: Date;
  let prevStartDate: Date;
  let prevEndDate: Date;

  switch (period) {
    case 'day':
      startDate = new Date(today);
      startDate.setHours(0, 0, 0, 0);
      prevStartDate = new Date(startDate);
      prevStartDate.setDate(prevStartDate.getDate() - 1);
      prevEndDate = new Date(startDate);
      prevEndDate.setMilliseconds(-1);
      break;
    case 'month':
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      prevStartDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      prevEndDate = new Date(startDate);
      prevEndDate.setMilliseconds(-1);
      break;
    case 'week':
    default:
      startDate = new Date(today);
      startDate.setDate(today.getDate() - today.getDay()); // Sunday
      startDate.setHours(0, 0, 0, 0);
      prevStartDate = new Date(startDate);
      prevStartDate.setDate(prevStartDate.getDate() - 7);
      prevEndDate = new Date(startDate);
      prevEndDate.setMilliseconds(-1);
      break;
  }

  // Get current period stats from health_data_records
  const healthDataStats = await query<{
    total: string;
    total_duration: string;
    total_calories: string;
  }>(
    `SELECT
      COUNT(*) as total,
      COALESCE(SUM(CASE
        WHEN value->>'duration' IS NOT NULL THEN (value->>'duration')::int
        WHEN value->>'duration_minutes' IS NOT NULL THEN (value->>'duration_minutes')::int
        ELSE 0
      END), 0) as total_duration,
      COALESCE(SUM(CASE
        WHEN data_type = 'strain' AND value->>'calories_burned' IS NOT NULL
        THEN (value->>'calories_burned')::numeric
        WHEN data_type = 'strain' AND value->>'calories_kcal' IS NOT NULL
        THEN (value->>'calories_kcal')::numeric
        WHEN data_type = 'workouts' AND value->>'duration' IS NOT NULL
        THEN (value->>'duration')::int * 6
        WHEN value->>'caloriesBurned' IS NOT NULL
        THEN (value->>'caloriesBurned')::numeric
        WHEN value->>'calories' IS NOT NULL
        THEN (value->>'calories')::numeric
        ELSE 0
      END), 0) as total_calories
     FROM health_data_records
     WHERE user_id = $1
     AND recorded_at >= $2
     AND recorded_at <= $3`,
    [userId, startDate, today]
  );

  // Get current period stats from activity_logs (completed plan activities)
  const activityLogsStats = await query<{
    total: string;
    total_duration: string;
  }>(
    `SELECT
      COUNT(*) as total,
      COALESCE(SUM(duration), 0) as total_duration
     FROM activity_logs
     WHERE user_id = $1
     AND status = 'completed'
     AND (completed_at >= $2 OR scheduled_date >= $2::date)
     AND (completed_at <= $3 OR scheduled_date <= $3::date)`,
    [userId, startDate, today]
  );

  // Combine stats
  const currentStats = {
    rows: [{
      total: String(parseInt(healthDataStats.rows[0]?.total || '0') + parseInt(activityLogsStats.rows[0]?.total || '0')),
      total_duration: String(parseInt(healthDataStats.rows[0]?.total_duration || '0') + parseInt(activityLogsStats.rows[0]?.total_duration || '0')),
      total_calories: healthDataStats.rows[0]?.total_calories || '0',
    }]
  };

  // Get previous period stats for comparison
  const prevHealthStats = await query<{
    total: string;
    total_duration: string;
  }>(
    `SELECT
      COUNT(*) as total,
      COALESCE(SUM(CASE
        WHEN value->>'duration' IS NOT NULL THEN (value->>'duration')::int
        ELSE 0
      END), 0) as total_duration
     FROM health_data_records
     WHERE user_id = $1
     AND recorded_at >= $2
     AND recorded_at <= $3`,
    [userId, prevStartDate, prevEndDate]
  );

  const prevActivityStats = await query<{
    total: string;
    total_duration: string;
  }>(
    `SELECT
      COUNT(*) as total,
      COALESCE(SUM(duration), 0) as total_duration
     FROM activity_logs
     WHERE user_id = $1
     AND status = 'completed'
     AND (completed_at >= $2 OR scheduled_date >= $2::date)
     AND (completed_at <= $3 OR scheduled_date <= $3::date)`,
    [userId, prevStartDate, prevEndDate]
  );

  const prevStats = {
    rows: [{
      total: String(parseInt(prevHealthStats.rows[0]?.total || '0') + parseInt(prevActivityStats.rows[0]?.total || '0')),
      total_duration: String(parseInt(prevHealthStats.rows[0]?.total_duration || '0') + parseInt(prevActivityStats.rows[0]?.total_duration || '0')),
    }]
  };

  const currentTotal = parseInt(currentStats.rows[0]?.total || '0');
  const currentDuration = parseInt(currentStats.rows[0]?.total_duration || '0');
  const currentCalories = parseInt(currentStats.rows[0]?.total_calories || '0');

  const prevTotal = parseInt(prevStats.rows[0]?.total || '0') || 1;
  const prevDuration = parseInt(prevStats.rows[0]?.total_duration || '0') || 1;

  // Calculate completion rate based on expected activities per period
  const daysInPeriod = period === 'day' ? 1 : period === 'week' ? 7 : 30;
  const expectedActivities = daysInPeriod * 3; // Assume 3 activities per day target
  const currentRate = Math.min(100, Math.round((currentTotal / expectedActivities) * 100));
  const prevRate = Math.min(100, Math.round((prevTotal / expectedActivities) * 100));

  const stats = {
    activitiesThisPeriod: currentTotal,
    activitiesChange: currentTotal - prevTotal,
    caloriesBurned: currentCalories,
    caloriesChange: prevTotal > 0 ? Math.round(((currentCalories - (prevTotal * 180)) / Math.max(prevTotal * 180, 1)) * 100) : 0,
    activeTime: currentDuration,
    activeTimeChange: prevDuration > 0 ? Math.round(((currentDuration - prevDuration) / prevDuration) * 100) : 0,
    completionRate: currentRate,
    completionRateChange: currentRate - prevRate,
    period,
    startDate: startDate.toISOString().split('T')[0],
    endDate: today.toISOString().split('T')[0],
  };

  ApiResponse.success(res, { stats });
});

/**
 * Get Activity Breakdown by Type
 * GET /api/activity/breakdown
 * Returns activity breakdown by type for the given period
 */
export const getActivityBreakdown = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { period = 'week' } = req.query;

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  let startDate: Date;
  let daysInPeriod: number;

  switch (period) {
    case 'day':
      startDate = new Date(today);
      startDate.setHours(0, 0, 0, 0);
      daysInPeriod = 1;
      break;
    case 'month':
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      daysInPeriod = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      break;
    case 'week':
    default:
      startDate = new Date(today);
      startDate.setDate(today.getDate() - today.getDay());
      startDate.setHours(0, 0, 0, 0);
      daysInPeriod = 7;
      break;
  }

  // Get breakdown by data_type from health_data_records
  const healthBreakdownResult = await query<{
    data_type: string;
    total: string;
    total_duration: string;
  }>(
    `SELECT
      data_type,
      COUNT(*) as total,
      COALESCE(SUM(CASE
        WHEN value->>'duration' IS NOT NULL THEN (value->>'duration')::int
        WHEN value->>'duration_minutes' IS NOT NULL THEN (value->>'duration_minutes')::int
        ELSE 0
      END), 0) as total_duration
     FROM health_data_records
     WHERE user_id = $1
     AND recorded_at >= $2
     AND recorded_at <= $3
     GROUP BY data_type
     ORDER BY total DESC`,
    [userId, startDate, today]
  );

  // Get breakdown from activity_logs (plan-based activities)
  const activityLogsBreakdown = await query<{
    activity_type: string;
    pillar: string;
    total: string;
    total_duration: string;
  }>(
    `SELECT
      CASE
        WHEN al.activity_id LIKE 'meal%' OR al.activity_id LIKE 'healthy-breakfast%' THEN 'meal'
        WHEN al.activity_id LIKE 'hydration%' THEN 'water'
        WHEN al.activity_id LIKE 'meditation%' OR al.activity_id LIKE 'journaling%' OR al.activity_id LIKE 'breathing%' OR al.activity_id LIKE 'gratitude%' THEN 'mindfulness'
        WHEN al.activity_id LIKE 'sleep%' THEN 'sleep'
        WHEN up.pillar = 'fitness' THEN 'workout'
        ELSE 'habit'
      END as activity_type,
      up.pillar,
      COUNT(*) as total,
      COALESCE(SUM(al.duration), 0) as total_duration
     FROM activity_logs al
     JOIN user_plans up ON al.plan_id = up.id
     WHERE al.user_id = $1
     AND al.status = 'completed'
     AND al.completed_at >= $2
     AND al.completed_at <= $3
     GROUP BY activity_type, up.pillar
     ORDER BY total DESC`,
    [userId, startDate, today]
  );

  // Map data types to display info
  const breakdownTypeMap: Record<string, { label: string; type: string; pillar: string }> = {
    workouts: { label: 'Workouts', type: 'workout', pillar: 'fitness' },
    strain: { label: 'Workouts', type: 'workout', pillar: 'fitness' }, // WHOOP strain = workout
    nutrition: { label: 'Meals & Nutrition', type: 'meal', pillar: 'nutrition' },
    meal: { label: 'Meals', type: 'meal', pillar: 'nutrition' },
    water: { label: 'Hydration', type: 'water', pillar: 'nutrition' },
    sleep: { label: 'Sleep', type: 'sleep', pillar: 'wellbeing' },
    recovery: { label: 'Recovery', type: 'recovery', pillar: 'wellbeing' },
    mindfulness: { label: 'Mindfulness', type: 'mindfulness', pillar: 'wellbeing' },
    steps: { label: 'Steps', type: 'steps', pillar: 'fitness' },
    heart_rate: { label: 'Heart Rate', type: 'check_in', pillar: 'fitness' },
    calories: { label: 'Calories', type: 'meal', pillar: 'nutrition' },
    hrv: { label: 'HRV', type: 'check_in', pillar: 'wellbeing' },
    workout: { label: 'Workouts', type: 'workout', pillar: 'fitness' },
    habit: { label: 'Habits', type: 'habit', pillar: 'wellbeing' },
  };

  // Merge health data and activity logs breakdowns
  const breakdownMap = new Map<string, { count: number; duration: number; pillar: string }>();

  // Add health data records
  for (const row of healthBreakdownResult.rows) {
    const info = breakdownTypeMap[row.data_type];
    const type = info?.type || row.data_type;
    const existing = breakdownMap.get(type) || { count: 0, duration: 0, pillar: info?.pillar || 'fitness' };
    existing.count += parseInt(row.total);
    existing.duration += parseInt(row.total_duration);
    breakdownMap.set(type, existing);
  }

  // Add activity logs
  for (const row of activityLogsBreakdown.rows) {
    const type = row.activity_type;
    const existing = breakdownMap.get(type) || { count: 0, duration: 0, pillar: row.pillar };
    existing.count += parseInt(row.total);
    existing.duration += parseInt(row.total_duration);
    breakdownMap.set(type, existing);
  }

  // Convert map to array
  const breakdown = Array.from(breakdownMap.entries())
    .map(([type, data]) => {
      const info = breakdownTypeMap[type] || { label: type.charAt(0).toUpperCase() + type.slice(1), type, pillar: data.pillar };

      return {
        type: info.type,
        activityType: type,
        label: info.label,
        pillar: data.pillar,
        count: data.count,
        total: data.count,
        completionRate: 100,
        duration: data.duration,
        expected: Math.ceil(daysInPeriod * 0.7), // 70% of days expected
      };
    })
    .sort((a, b) => b.count - a.count);

  ApiResponse.success(res, {
    breakdown,
    period,
    startDate: startDate.toISOString().split('T')[0],
    endDate: today.toISOString().split('T')[0],
  });
});

/**
 * Get Calendar Data
 * GET /api/activity/calendar
 * Returns daily activity summary for calendar view
 */
export const getCalendarData = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { year, month, week } = req.query;

  const today = new Date();
  let startDate: Date;
  let endDate: Date;

  if (week) {
    // Week view
    const weekDate = new Date(week as string);
    startDate = new Date(weekDate);
    startDate.setDate(weekDate.getDate() - weekDate.getDay()); // Sunday
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);
  } else if (year && month) {
    // Month view
    const y = parseInt(year as string);
    const m = parseInt(month as string) - 1;
    startDate = new Date(y, m, 1);
    endDate = new Date(y, m + 1, 0, 23, 59, 59, 999);
  } else {
    // Default: current week
    startDate = new Date(today);
    startDate.setDate(today.getDate() - today.getDay());
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);
  }

  // Get daily summaries from health_data_records
  const healthDailyResult = await query<{
    date: string;
    count: string;
    total_duration: string;
  }>(
    `SELECT
      DATE(recorded_at) as date,
      COUNT(*) as count,
      COALESCE(SUM(CASE
        WHEN value->>'duration' IS NOT NULL THEN (value->>'duration')::int
        ELSE 0
      END), 0) as total_duration
     FROM health_data_records
     WHERE user_id = $1
     AND recorded_at >= $2
     AND recorded_at <= $3
     GROUP BY DATE(recorded_at)
     ORDER BY date`,
    [userId, startDate, endDate]
  );

  // Get daily summaries from activity_logs (plan activities)
  const activityDailyResult = await query<{
    date: string;
    total: string;
    completed: string;
    total_duration: string;
  }>(
    `SELECT
      scheduled_date::text as date,
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'completed') as completed,
      COALESCE(SUM(duration) FILTER (WHERE status = 'completed'), 0) as total_duration
     FROM activity_logs
     WHERE user_id = $1
     AND scheduled_date >= $2::date
     AND scheduled_date <= $3::date
     GROUP BY scheduled_date
     ORDER BY scheduled_date`,
    [userId, startDate, endDate]
  );

  // Create a map of data by date (combining both sources)
  const dataMap = new Map<string, { healthCount: number; activityTotal: number; activityCompleted: number; duration: number }>();

  for (const row of healthDailyResult.rows) {
    const existing = dataMap.get(row.date) || { healthCount: 0, activityTotal: 0, activityCompleted: 0, duration: 0 };
    existing.healthCount = parseInt(row.count);
    existing.duration += parseInt(row.total_duration);
    dataMap.set(row.date, existing);
  }

  for (const row of activityDailyResult.rows) {
    const existing = dataMap.get(row.date) || { healthCount: 0, activityTotal: 0, activityCompleted: 0, duration: 0 };
    existing.activityTotal = parseInt(row.total);
    existing.activityCompleted = parseInt(row.completed);
    existing.duration += parseInt(row.total_duration);
    dataMap.set(row.date, existing);
  }

  // Build calendar data
  const days: Array<{
    date: string;
    dayOfWeek: string;
    dayNumber: number;
    isToday: boolean;
    activities: {
      total: number;
      completed: number;
      completionRate: number;
    };
    healthLogs: number;
    duration: number;
    hasActivity: boolean;
  }> = [];

  const currentDate = new Date(startDate);
  const todayStr = today.toISOString().split('T')[0];

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const dayData = dataMap.get(dateStr);

    const healthCount = dayData?.healthCount || 0;
    const activityTotal = dayData?.activityTotal || 0;
    const activityCompleted = dayData?.activityCompleted || 0;
    const totalCompleted = healthCount + activityCompleted;
    const completionRate = activityTotal > 0
      ? Math.round((activityCompleted / activityTotal) * 100)
      : (healthCount > 0 ? 100 : 0);

    days.push({
      date: dateStr,
      dayOfWeek: currentDate.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNumber: currentDate.getDate(),
      isToday: dateStr === todayStr,
      activities: {
        total: activityTotal,
        completed: activityCompleted,
        completionRate,
      },
      healthLogs: healthCount,
      duration: dayData?.duration || 0,
      hasActivity: totalCompleted > 0 || activityTotal > 0,
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  ApiResponse.success(res, {
    days,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  });
});

interface ActivityLogRow {
  id: string;
  user_id: string;
  plan_id: string;
  activity_id: string;
  scheduled_date: Date;
  completed_at: Date | null;
  status: 'pending' | 'completed' | 'skipped' | 'partial';
  actual_value: number | null;
  target_value: number | null;
  duration: number | null;
  user_notes: string | null;
  mood: number | null;
  ai_feedback: string | null;
}

/**
 * Log Activity Completion
 * POST /api/activity/logs/:logId/complete
 * Mark an activity log as completed
 */
export const completeActivity = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { logId } = req.params;
  const { actualValue, duration, notes, mood } = req.body;

  if (!logId) throw ApiError.badRequest('Log ID is required');

  // Check if this is an existing activity log
  const existingLog = await query<ActivityLogRow>(
    'SELECT * FROM activity_logs WHERE id = $1 AND user_id = $2',
    [logId, userId]
  );

  if (existingLog.rows.length === 0) {
    throw ApiError.notFound('Activity log not found');
  }

  // Update the log to completed
  const result = await query<ActivityLogRow>(
    `UPDATE activity_logs SET
      status = 'completed',
      completed_at = CURRENT_TIMESTAMP,
      actual_value = COALESCE($1, actual_value),
      duration = COALESCE($2, duration),
      user_notes = COALESCE($3, user_notes),
      mood = COALESCE($4, mood),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $5 AND user_id = $6
    RETURNING *`,
    [actualValue, duration, notes, mood, logId, userId]
  );

  const log = result.rows[0];

  // Generate feedback message
  const feedbackMessages = [
    'Great job! Keep up the momentum!',
    "You're building strong habits!",
    'Every step counts toward your goal!',
    'Excellent progress today!',
  ];
  const feedback = feedbackMessages[Math.floor(Math.random() * feedbackMessages.length)];

  // Update the feedback in the log
  await query(
    'UPDATE activity_logs SET ai_feedback = $1 WHERE id = $2',
    [feedback, logId]
  );

  ApiResponse.success(res, {
    log: {
      ...log,
      ai_feedback: feedback,
    },
    feedback,
  }, 'Activity completed successfully');
});

/**
 * Skip Activity
 * POST /api/activity/logs/:logId/skip
 */
export const skipActivity = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { logId } = req.params;
  const { reason } = req.body;

  if (!logId) throw ApiError.badRequest('Log ID is required');

  // Check if this is an existing activity log
  const existingLog = await query<ActivityLogRow>(
    'SELECT * FROM activity_logs WHERE id = $1 AND user_id = $2',
    [logId, userId]
  );

  if (existingLog.rows.length === 0) {
    throw ApiError.notFound('Activity log not found');
  }

  // Update the log to skipped
  const result = await query<ActivityLogRow>(
    `UPDATE activity_logs SET
      status = 'skipped',
      user_notes = COALESCE($1, user_notes),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND user_id = $3
    RETURNING *`,
    [reason, logId, userId]
  );

  ApiResponse.success(res, {
    log: result.rows[0],
  }, 'Activity skipped');
});

/**
 * Get Recent Activities (for dashboard feed)
 * GET /api/activity/recent
 * Returns completed activities from both activity_logs (plan activities) and health_data_records
 */
export const getRecentActivities = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { limit = '10', type: filterType, pillar: filterPillar } = req.query;
  const limitNum = Math.min(50, Math.max(1, parseInt(limit as string)));

  // Map frontend type filter to data_type values
  const typeToDataTypes: Record<string, string[]> = {
    workout: ['strain', 'workouts'],
    meal: ['nutrition', 'calories'],
    sleep: ['sleep'],
    mindfulness: ['recovery'],
    water: ['nutrition'], // hydration is stored as nutrition
    steps: ['steps'],
    check_in: ['heart_rate', 'hrv'],
    recovery: ['recovery'],
  };

  const activities: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    completedAt: string;
    duration: number | null;
    pillar: string;
    source: 'activity' | 'health_data';
    metrics?: Record<string, unknown>;
  }> = [];

  // 1. Get completed activities from activity_logs (plan activities)
  let activityLogsQuery = `
    SELECT
      al.id,
      al.activity_id,
      al.scheduled_date,
      al.completed_at,
      al.status,
      al.duration,
      al.user_notes,
      up.name as plan_name,
      up.pillar
     FROM activity_logs al
     JOIN user_plans up ON al.plan_id = up.id
     WHERE al.user_id = $1
     AND al.status = 'completed'
     AND al.completed_at IS NOT NULL`;

  const activityLogsParams: (string | number)[] = [userId];
  let paramIndex = 2;

  // Apply pillar filter
  if (filterPillar && filterPillar !== 'all') {
    activityLogsQuery += ` AND up.pillar = $${paramIndex}`;
    activityLogsParams.push(filterPillar as string);
    paramIndex++;
  }

  activityLogsQuery += ` ORDER BY al.completed_at DESC LIMIT $${paramIndex}`;
  activityLogsParams.push(limitNum);

  const activityLogsResult = await query<{
    id: string;
    activity_id: string;
    scheduled_date: Date;
    completed_at: Date;
    status: string;
    duration: number | null;
    user_notes: string | null;
    plan_name: string;
    pillar: string;
  }>(activityLogsQuery, activityLogsParams);

  // Map activity_id to display info
  const activityTypeMap: Record<string, { title: string; type: string }> = {
    // Fitness activities
    'morning-walk': { title: 'Morning Walk', type: 'workout' },
    'strength-training': { title: 'Strength Training', type: 'workout' },
    'cardio': { title: 'Cardio Exercise', type: 'workout' },
    'yoga': { title: 'Yoga Session', type: 'workout' },
    'stretching': { title: 'Stretching', type: 'workout' },
    'hiit': { title: 'HIIT Workout', type: 'workout' },
    'cycling': { title: 'Cycling', type: 'workout' },
    'swimming': { title: 'Swimming', type: 'workout' },
    'running': { title: 'Running', type: 'workout' },
    'workout': { title: 'Workout', type: 'workout' },
    // Nutrition activities
    'meal-prep': { title: 'Meal Prep', type: 'meal' },
    'healthy-breakfast': { title: 'Healthy Breakfast', type: 'meal' },
    'hydration': { title: 'Hydration', type: 'water' },
    'track-meals': { title: 'Track Meals', type: 'meal' },
    'meal-breakfast': { title: 'Breakfast', type: 'meal' },
    'meal-lunch': { title: 'Lunch', type: 'meal' },
    'meal-dinner': { title: 'Dinner', type: 'meal' },
    'meal-snacks': { title: 'Snacks', type: 'meal' },
    'meal-snack': { title: 'Snack', type: 'meal' },
    'breakfast': { title: 'Breakfast', type: 'meal' },
    'lunch': { title: 'Lunch', type: 'meal' },
    'dinner': { title: 'Dinner', type: 'meal' },
    'snacks': { title: 'Snacks', type: 'meal' },
    // Wellbeing activities
    'meditation': { title: 'Meditation', type: 'mindfulness' },
    'sleep-routine': { title: 'Sleep Routine', type: 'sleep' },
    'journaling': { title: 'Journaling', type: 'mindfulness' },
    'breathing': { title: 'Breathing Exercise', type: 'mindfulness' },
    'gratitude': { title: 'Gratitude Practice', type: 'mindfulness' },
    'sleep': { title: 'Sleep Tracking', type: 'sleep' },
    'rest': { title: 'Rest & Recovery', type: 'mindfulness' },
  };

  for (const log of activityLogsResult.rows) {
    // Strip numeric suffixes (e.g., "meal-snacks-1768970576089" -> "meal-snacks")
    const cleanActivityId = log.activity_id.replace(/-\d{10,}$/, '');

    const activityInfo = activityTypeMap[cleanActivityId] || {
      // Convert kebab-case to Title Case for unknown activity types
      title: cleanActivityId
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
      type: 'habit'
    };

    activities.push({
      id: log.id,
      type: activityInfo.type,
      title: activityInfo.title,
      description: log.user_notes || `Completed from ${log.plan_name}`,
      completedAt: log.completed_at.toISOString(),
      duration: log.duration,
      pillar: log.pillar,
      source: 'activity',
    });
  }

  // 2. Get recent health data logs
  let healthDataQuery = `SELECT * FROM health_data_records WHERE user_id = $1`;
  const healthDataParams: (string | number | string[])[] = [userId];
  let healthParamIndex = 2;

  // Apply type filter
  if (filterType && filterType !== 'all') {
    const dataTypes = typeToDataTypes[filterType as string];
    if (dataTypes && dataTypes.length > 0) {
      healthDataQuery += ` AND data_type = ANY($${healthParamIndex}::text[])`;
      healthDataParams.push(dataTypes);
      healthParamIndex++;
    }
  }

  healthDataQuery += ` ORDER BY recorded_at DESC LIMIT $${healthParamIndex}`;
  healthDataParams.push(limitNum);

  const healthDataResult = await query<HealthDataRow>(healthDataQuery, healthDataParams);

  for (const record of healthDataResult.rows) {
    const info = typeMap[record.data_type] || { title: record.data_type, type: 'check_in', pillar: 'fitness' };
    const value = record.value || {};

    activities.push({
      id: record.id,
      type: info.type,
      title: info.title,
      description: buildDescription(record.data_type, value),
      completedAt: record.recorded_at.toISOString(),
      duration: (value.duration as number) || null,
      pillar: info.pillar,
      source: 'health_data',
      metrics: value,
    });
  }

  // Sort all activities by completedAt descending
  activities.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

  // Apply type filter to combined results
  let filteredActivities = activities;
  if (filterType && filterType !== 'all') {
    const allowedTypes = filterType === 'water' ? ['water', 'meal'] : [filterType as string];
    filteredActivities = activities.filter(a => {
      // For water filter, only include activities with 'water' type or nutrition activities that look like hydration
      if (filterType === 'water') {
        return a.type === 'water' || (a.type === 'meal' && (a.title.toLowerCase().includes('hydration') || a.description.toLowerCase().includes('water')));
      }
      return allowedTypes.includes(a.type);
    });
  }

  // Apply pillar filter
  if (filterPillar && filterPillar !== 'all') {
    filteredActivities = filteredActivities.filter(a => a.pillar === filterPillar);
  }

  const limitedActivities = filteredActivities.slice(0, limitNum);

  ApiResponse.success(res, { activities: limitedActivities });
});

export default {
  getActivityLogs,
  getActivityStats,
  getActivityBreakdown,
  getCalendarData,
  completeActivity,
  skipActivity,
  getRecentActivities,
};
