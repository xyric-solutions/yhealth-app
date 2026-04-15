import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { query } from '../database/pg.js';
import { logger } from '../services/logger.service.js';
import cache from '../services/cache.service.js';
import type { UserPlanRow, IActivity, DayOfWeek } from './plan/plan.types.js';

// Types
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
  created_at: Date;
}

interface HealthDataRow {
  id: string;
  user_id: string;
  data_type: string;
  recorded_at: Date;
  value: object;
  unit: string;
}

interface QuickLogInput {
  type: 'workout' | 'meal' | 'sleep' | 'mindfulness' | 'water' | 'weight';
  value?: number;
  unit?: string;
  notes?: string;
  duration?: number;
  details?: Record<string, unknown>;
}

/**
 * Get Dashboard Stats
 * GET /api/stats/dashboard
 * Returns streak, week progress change, and summary stats
 */
export const getDashboardStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate current streak
  const streakData = await calculateStreak(userId);

  // Get this week's completion rate (Monday-based week) using PLANNED activities as denominator
  const startOfWeek = new Date(today);
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  startOfWeek.setDate(today.getDate() + mondayOffset);

  // Get the active plan to count planned activities per day
  const activePlanResult = await query<UserPlanRow>(
    `SELECT * FROM user_plans WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  const planActivities: IActivity[] = activePlanResult.rows.length > 0
    ? (activePlanResult.rows[0].activities as IActivity[]) || []
    : [];

  const dayNames: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  // Count planned activities for each day from Monday through today
  let thisWeekPlannedTotal = 0;
  for (let d = new Date(startOfWeek); d <= today; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay(); // 0=Sun..6=Sat
    const dayName = dayNames[dow === 0 ? 6 : dow - 1]; // Convert JS day to our DayOfWeek
    const scheduled = planActivities.filter(a => a.daysOfWeek.includes(dayName));
    thisWeekPlannedTotal += scheduled.length;
  }

  // Get completed logs for the week
  const thisWeekLogs = await query<ActivityLogRow>(
    `SELECT * FROM activity_logs
     WHERE user_id = $1
     AND scheduled_date >= $2
     AND scheduled_date <= $3`,
    [userId, startOfWeek, today]
  );

  const thisWeekCompleted = thisWeekLogs.rows.filter(l => l.status === 'completed').length;
  const thisWeekTotal = thisWeekPlannedTotal || 1; // Use planned activities as denominator
  const thisWeekRate = Math.round((thisWeekCompleted / thisWeekTotal) * 100);

  // Get last week's completion rate for comparison (also plan-aware)
  const startOfLastWeek = new Date(startOfWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
  const endOfLastWeek = new Date(startOfWeek);
  endOfLastWeek.setDate(endOfLastWeek.getDate() - 1);

  let lastWeekPlannedTotal = 0;
  for (let d = new Date(startOfLastWeek); d <= endOfLastWeek; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    const dayName = dayNames[dow === 0 ? 6 : dow - 1];
    const scheduled = planActivities.filter(a => a.daysOfWeek.includes(dayName));
    lastWeekPlannedTotal += scheduled.length;
  }

  const lastWeekLogs = await query<ActivityLogRow>(
    `SELECT * FROM activity_logs
     WHERE user_id = $1
     AND scheduled_date >= $2
     AND scheduled_date <= $3`,
    [userId, startOfLastWeek, endOfLastWeek]
  );

  const lastWeekCompleted = lastWeekLogs.rows.filter(l => l.status === 'completed').length;
  const lastWeekTotal = lastWeekPlannedTotal || 1;
  const lastWeekRate = Math.round((lastWeekCompleted / lastWeekTotal) * 100);

  const weekChange = thisWeekRate - lastWeekRate;

  // Get total activities completed all time
  const totalCompletedResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM activity_logs WHERE user_id = $1 AND status = 'completed'`,
    [userId]
  );
  const totalCompleted = parseInt(totalCompletedResult.rows[0]?.count || '0');

  // Get active goals count
  const activeGoalsResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM user_goals WHERE user_id = $1 AND status = 'active'`,
    [userId]
  );
  const activeGoals = parseInt(activeGoalsResult.rows[0]?.count || '0');

  // Get longest streak
  const longestStreak = await calculateLongestStreak(userId);

  ApiResponse.success(res, {
    streak: {
      current: streakData.currentStreak,
      longest: longestStreak,
      lastActivityDate: streakData.lastActivityDate,
    },
    weekProgress: {
      rate: thisWeekRate,
      change: weekChange,
      completed: thisWeekCompleted,
      total: thisWeekTotal,
    },
    summary: {
      totalActivitiesCompleted: totalCompleted,
      activeGoals,
    },
  });
});

/**
 * Get Activity Data by Period
 * GET /api/stats/weekly-activity
 * Returns activity completion data aggregated by period
 * Supports: current, last (weekly), month, year, lifetime
 */
export const getWeeklyActivityData = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { week = 'current' } = req.query;
  const period = String(week);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // For week-based periods (current/last), use the original weekly logic
  if (period === 'current' || period === 'last') {
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday

    if (period === 'last') {
      startOfWeek.setDate(startOfWeek.getDate() - 7);
    }

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    // Get user's active plan to determine scheduled activities
    const planResult = await query<UserPlanRow>(
      `SELECT * FROM user_plans WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    let activities: IActivity[] = [];
    if (planResult.rows.length > 0) {
      activities = (planResult.rows[0].activities as IActivity[]) || [];
    }

    const logsResult = await query<ActivityLogRow>(
      `SELECT * FROM activity_logs
       WHERE user_id = $1
       AND scheduled_date >= $2
       AND scheduled_date <= $3
       ORDER BY scheduled_date`,
      [userId, startOfWeek, endOfWeek]
    );

    const dayNameToDayOfWeek: Record<string, DayOfWeek> = {
      'Mon': 'monday', 'Tue': 'tuesday', 'Wed': 'wednesday', 'Thu': 'thursday',
      'Fri': 'friday', 'Sat': 'saturday', 'Sun': 'sunday',
    };

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weeklyData = days.map((day, index) => {
      const dayDate = new Date(startOfWeek);
      dayDate.setDate(startOfWeek.getDate() + index);
      const dayStr = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;
      const dayOfWeek = dayNameToDayOfWeek[day];
      const scheduledActivities = activities.filter(a => a.daysOfWeek.includes(dayOfWeek));
      const total = scheduledActivities.length;
      const dayLogs = logsResult.rows.filter(l => {
        const logDate = typeof l.scheduled_date === 'string'
          ? l.scheduled_date
          : new Date(l.scheduled_date).toISOString().split('T')[0];
        return logDate === dayStr;
      });
      const completed = dayLogs.filter(l => l.status === 'completed').length;
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      return { day, date: dayStr, completed, total, completionRate, isToday: dayStr === todayStr };
    });

    const totalCompleted = weeklyData.reduce((sum, d) => sum + d.completed, 0);
    const totalActivities = weeklyData.reduce((sum, d) => sum + d.total, 0);
    const weekAverage = totalActivities > 0 ? Math.round((totalCompleted / totalActivities) * 100) : 0;

    ApiResponse.success(res, {
      week: period,
      startDate: `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, '0')}-${String(startOfWeek.getDate()).padStart(2, '0')}`,
      endDate: `${endOfWeek.getFullYear()}-${String(endOfWeek.getMonth() + 1).padStart(2, '0')}-${String(endOfWeek.getDate()).padStart(2, '0')}`,
      days: weeklyData,
      summary: { totalCompleted, totalActivities, averageCompletionRate: weekAverage },
    });
    return;
  }

  // For longer periods (month, year, lifetime), aggregate from activity_logs
  let startDate: Date;
  let endDate = new Date(today);
  endDate.setHours(23, 59, 59, 999);

  if (period === 'month') {
    startDate = new Date(today);
    startDate.setDate(today.getDate() - 29); // Last 30 days
  } else if (period === 'year') {
    startDate = new Date(today);
    startDate.setFullYear(today.getFullYear() - 1);
    startDate.setDate(startDate.getDate() + 1); // Last 12 months
  } else {
    // lifetime - get from first activity log
    const firstLog = await query<{ min_date: Date | null }>(
      `SELECT MIN(scheduled_date) as min_date FROM activity_logs WHERE user_id = $1`,
      [userId]
    );
    startDate = firstLog.rows[0]?.min_date ? new Date(firstLog.rows[0].min_date) : new Date(today.getFullYear(), 0, 1);
  }

  startDate.setHours(0, 0, 0, 0);

  // Fetch all logs in the range
  const logsResult = await query<ActivityLogRow>(
    `SELECT * FROM activity_logs
     WHERE user_id = $1
     AND scheduled_date >= $2
     AND scheduled_date <= $3
     ORDER BY scheduled_date`,
    [userId, startDate, endDate]
  );

  // Determine aggregation strategy
  let aggregatedData: Array<{ day: string; date: string; completed: number; total: number; completionRate: number; isToday: boolean }>;

  if (period === 'month') {
    // Aggregate by week (4-5 bars)
    const weeks: Map<string, { completed: number; total: number; startDate: string }> = new Map();

    for (const log of logsResult.rows) {
      const logDate = new Date(log.scheduled_date);
      // Get the Monday of that week
      const monday = new Date(logDate);
      monday.setDate(logDate.getDate() - ((logDate.getDay() + 6) % 7));
      const weekKey = monday.toISOString().split('T')[0];

      if (!weeks.has(weekKey)) {
        weeks.set(weekKey, { completed: 0, total: 0, startDate: weekKey });
      }
      const w = weeks.get(weekKey)!;
      w.total++;
      if (log.status === 'completed') w.completed++;
    }

    aggregatedData = Array.from(weeks.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([weekKey, data]) => {
        const weekDate = new Date(weekKey);
        const weekEnd = new Date(weekDate);
        weekEnd.setDate(weekDate.getDate() + 6);
        const label = `${weekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        return {
          day: label,
          date: data.startDate,
          completed: data.completed,
          total: data.total,
          completionRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
          isToday: false,
        };
      });
  } else {
    // year / lifetime: Aggregate by month
    const months: Map<string, { completed: number; total: number }> = new Map();

    for (const log of logsResult.rows) {
      const logDate = new Date(log.scheduled_date);
      const monthKey = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}`;

      if (!months.has(monthKey)) {
        months.set(monthKey, { completed: 0, total: 0 });
      }
      const m = months.get(monthKey)!;
      m.total++;
      if (log.status === 'completed') m.completed++;
    }

    aggregatedData = Array.from(months.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monthKey, data]) => {
        const [year, month] = monthKey.split('-');
        const monthDate = new Date(parseInt(year), parseInt(month) - 1, 1);
        const label = monthDate.toLocaleDateString('en-US', { month: 'short' });
        const fullLabel = period === 'lifetime' && months.size > 12
          ? `${label} ${year.slice(2)}`
          : label;
        return {
          day: fullLabel,
          date: `${monthKey}-01`,
          completed: data.completed,
          total: data.total,
          completionRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
          isToday: false,
        };
      });
  }

  const totalCompleted = aggregatedData.reduce((sum, d) => sum + d.completed, 0);
  const totalActivities = aggregatedData.reduce((sum, d) => sum + d.total, 0);
  const avgRate = totalActivities > 0 ? Math.round((totalCompleted / totalActivities) * 100) : 0;

  ApiResponse.success(res, {
    week: period,
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    days: aggregatedData,
    summary: { totalCompleted, totalActivities, averageCompletionRate: avgRate },
  });
});

/**
 * Get Current Streak
 * GET /api/stats/streak
 */
export const getCurrentStreak = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const streakData = await calculateStreak(userId);
  const longestStreak = await calculateLongestStreak(userId);

  // Get streak history (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const historyResult = await query<{ date: Date; completed: string; total: string }>(
    `SELECT
       scheduled_date as date,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
       COUNT(*) as total
     FROM activity_logs
     WHERE user_id = $1
     AND scheduled_date >= $2
     GROUP BY scheduled_date
     ORDER BY scheduled_date DESC`,
    [userId, thirtyDaysAgo]
  );

  const streakHistory = historyResult.rows.map(row => ({
    date: typeof row.date === 'string'
      ? row.date
      : new Date(row.date).toISOString().split('T')[0],
    completed: parseInt(row.completed),
    total: parseInt(row.total),
    hasActivity: parseInt(row.completed) > 0,
  }));

  ApiResponse.success(res, {
    currentStreak: streakData.currentStreak,
    longestStreak,
    lastActivityDate: streakData.lastActivityDate,
    streakHistory,
  });
});

/**
 * Get Health Metrics
 * GET /api/stats/health-metrics
 * Returns latest health metrics from integrations and manual logs
 */
export const getHealthMetrics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get latest health data records
  const latestDataResult = await query<HealthDataRow>(
    `SELECT DISTINCT ON (data_type) *
     FROM health_data_records
     WHERE user_id = $1
     AND recorded_at >= $2
     ORDER BY data_type, recorded_at DESC`,
    [userId, new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)] // Last 7 days
  );

  // Build metrics from health data
  const metricsMap: Record<string, { value: unknown; unit: string; recordedAt: string }> = {};

  for (const record of latestDataResult.rows) {
    metricsMap[record.data_type] = {
      value: record.value,
      unit: record.unit,
      recordedAt: record.recorded_at.toISOString(),
    };
  }

  // Get today's activity logs for calories estimation
  const todayLogsResult = await query<ActivityLogRow>(
    `SELECT * FROM activity_logs
     WHERE user_id = $1
     AND scheduled_date = $2
     AND status = 'completed'`,
    [userId, today]
  );

  // Calculate estimated calories burned from workouts
  let estimatedCaloriesBurned = 0;
  for (const log of todayLogsResult.rows) {
    if (log.duration) {
      // Rough estimate: 5-8 calories per minute depending on activity
      estimatedCaloriesBurned += log.duration * 6;
    }
  }

  // Get water intake if tracked (stored under 'nutrition' type with water indicator in value)
  const waterResult = await query<{ total: string }>(
    `SELECT SUM((value->>'glasses')::int) as total
     FROM health_data_records
     WHERE user_id = $1
     AND data_type = 'nutrition'
     AND value->>'glasses' IS NOT NULL
     AND recorded_at >= $2`,
    [userId, today]
  );
  const waterGlasses = parseInt(waterResult.rows[0]?.total || '0');

  // Get latest sleep data
  const sleepResult = await query<HealthDataRow>(
    `SELECT * FROM health_data_records
     WHERE user_id = $1
     AND data_type = 'sleep'
     ORDER BY recorded_at DESC
     LIMIT 1`,
    [userId]
  );
  const sleepData = sleepResult.rows[0]?.value as { duration?: number; quality?: number } | undefined;

  // Get heart rate if available
  const heartRateResult = await query<HealthDataRow>(
    `SELECT * FROM health_data_records
     WHERE user_id = $1
     AND data_type = 'heart_rate'
     ORDER BY recorded_at DESC
     LIMIT 1`,
    [userId]
  );
  const heartRateData = heartRateResult.rows[0]?.value as { bpm?: number; resting?: number } | undefined;

  // Get steps if available
  const stepsResult = await query<HealthDataRow>(
    `SELECT * FROM health_data_records
     WHERE user_id = $1
     AND data_type = 'steps'
     AND recorded_at >= $2
     ORDER BY recorded_at DESC
     LIMIT 1`,
    [userId, today]
  );
  const stepsData = stepsResult.rows[0]?.value as { count?: number } | undefined;

  const metrics = {
    calories: {
      value: estimatedCaloriesBurned || null,
      target: 2200,
      unit: 'kcal',
      source: estimatedCaloriesBurned > 0 ? 'estimated' : null,
    },
    water: {
      value: waterGlasses || null,
      target: 8,
      unit: 'glasses',
      source: waterGlasses > 0 ? 'manual' : null,
    },
    sleep: {
      value: sleepData?.duration ? `${(sleepData.duration / 60).toFixed(1)}h` : null,
      target: '8h',
      quality: sleepData?.quality || null,
      source: sleepData ? 'integration' : null,
    },
    heartRate: {
      value: heartRateData?.bpm || heartRateData?.resting || null,
      unit: 'bpm',
      resting: heartRateData?.resting || null,
      source: heartRateData ? 'integration' : null,
    },
    steps: {
      value: stepsData?.count || null,
      target: 10000,
      unit: 'steps',
      source: stepsData ? 'integration' : null,
    },
  };

  ApiResponse.success(res, { metrics });
});

/**
 * Get Enhanced Health Metrics
 * GET /api/stats/enhanced-health-metrics
 * Returns comprehensive health metrics with analytics, trends, and detailed breakdowns
 */
export const getEnhancedHealthMetrics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  // Accept user timezone for accurate local-date meal filtering (same as GET /diet-plans/meals)
  const userTz = (req.query.tz as string) || 'UTC';
  const safeTz = /^[A-Za-z_/+-]+$/.test(userTz) ? userTz : 'UTC';

  // Use user's local date (timezone-aware) to match meal_logs dates correctly
  // This fixes the issue where UTC date differs from user's local date (e.g., PKT is UTC+5)
  const now = new Date();
  const userDate = new Date(now.toLocaleString('en-US', { timeZone: safeTz }));
  const todayStr = `${userDate.getFullYear()}-${String(userDate.getMonth() + 1).padStart(2, '0')}-${String(userDate.getDate()).padStart(2, '0')}`;

  // Cache for 60 seconds per user per day per timezone
  const cacheKey = `enhanced-health-metrics:${userId}:${todayStr}:${safeTz}`;
  const enhancedMetrics = await cache.getOrSet(cacheKey, async () => {

  const today = new Date(todayStr);
  today.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Get steps data
  const stepsResult = await query<HealthDataRow>(
    `SELECT * FROM health_data_records
     WHERE user_id = $1
     AND data_type = 'steps'
     AND recorded_at >= $2
     ORDER BY recorded_at DESC
     LIMIT 1`,
    [userId, today]
  );
  const stepsData = stepsResult.rows[0]?.value as { count?: number } | undefined;
  const stepsValue = stepsData?.count || null;
  const stepsTarget = 10000;

  // Get water intake - prioritize water_intake_logs table (most accurate)
  // Fallback to health_data_records for backward compatibility
  // IMPORTANT: Return in milliliters (ml) as the client expects ml, not glasses
  
  // Try to get from water_intake_logs first (primary source)
  const waterLogResult = await query<{ glasses_consumed: number; ml_consumed: number }>(
    `SELECT glasses_consumed, ml_consumed
     FROM water_intake_logs
     WHERE user_id = $1
     AND log_date = $2::date
     LIMIT 1`,
    [userId, todayStr]
  );
  
  let waterConsumed = 0; // in milliliters
  if (waterLogResult.rows.length > 0) {
    // Use water_intake_logs (primary source) - return ml_consumed (not glasses)
    waterConsumed = waterLogResult.rows[0].ml_consumed || 0;
    logger.info('[EnhancedHealthMetrics] Water from water_intake_logs', {
      userId,
      date: todayStr,
      glasses: waterLogResult.rows[0].glasses_consumed,
      ml: waterConsumed,
    });
  } else {
    // Fallback to health_data_records (for legacy data)
    // Convert glasses to ml (1 glass = 250ml)
    const waterResult = await query<{ total: string }>(
      `SELECT SUM((value->>'glasses')::int) as total
       FROM health_data_records
       WHERE user_id = $1
       AND data_type = 'nutrition'
       AND value->>'glasses' IS NOT NULL
       AND recorded_at >= $2`,
      [userId, today]
    );
    const glasses = parseInt(waterResult.rows[0]?.total || '0');
    waterConsumed = glasses * 250; // Convert glasses to ml
    logger.info('[EnhancedHealthMetrics] Water from health_data_records (fallback)', {
      userId,
      date: todayStr,
      glasses,
      ml: waterConsumed,
      foundInWaterLogs: false,
    });
  }
  
  const waterTarget = 8 * 250; // 8 glasses = 2000ml per day
  
  logger.info('[EnhancedHealthMetrics] Final water data', {
    userId,
    date: todayStr,
    consumed: waterConsumed,
    consumedGlasses: Math.round(waterConsumed / 250),
    target: waterTarget,
    targetGlasses: 8,
  });

  // Get calories consumed from meal_logs (primary source)
  // Use timezone-aware date filtering to match user's local "today"
  // Falls back to summing from foods JSONB when row-level calories is NULL
  const caloriesConsumedResult = await query<{ total: string }>(
    `SELECT COALESCE(SUM(
       CASE
         WHEN calories IS NOT NULL AND calories > 0 THEN calories
         ELSE (SELECT COALESCE(SUM((f->>'calories')::numeric), 0) FROM jsonb_array_elements(COALESCE(foods, '[]'::jsonb)) AS f WHERE f->>'calories' IS NOT NULL)
       END
     ), 0) as total
     FROM meal_logs
     WHERE user_id = $1
     AND eaten_at::date = $2::date`,
    [userId, todayStr]
  );
  let caloriesConsumed = parseFloat(caloriesConsumedResult.rows[0]?.total || '0');
  
  // Fallback to health_data_records if no meal_logs data
  if (caloriesConsumed === 0) {
    const fallbackResult = await query<{ total: string }>(
      `SELECT SUM((value->>'calories')::numeric) as total
       FROM health_data_records
       WHERE user_id = $1
       AND data_type = 'nutrition'
       AND value->>'calories' IS NOT NULL
       AND recorded_at >= $2`,
      [userId, today]
    );
    caloriesConsumed = parseFloat(fallbackResult.rows[0]?.total || '0');
  }
  
  logger.info('[EnhancedHealthMetrics] Calories consumed', {
    userId,
    date: todayStr,
    fromMealLogs: caloriesConsumed > 0,
    calories: caloriesConsumed,
  });

  // Calculate calories burned from workouts
  const caloriesBurnedResult = await query<{ total: string }>(
    `SELECT SUM((value->>'caloriesBurned')::numeric) as total
     FROM health_data_records
     WHERE user_id = $1
     AND data_type = 'workouts'
     AND value->>'caloriesBurned' IS NOT NULL
     AND recorded_at >= $2`,
    [userId, today]
  );
  let caloriesBurned = parseFloat(caloriesBurnedResult.rows[0]?.total || '0');

  // Fallback: estimate from activity logs if no workout data
  if (caloriesBurned === 0) {
    const todayLogsResult = await query<ActivityLogRow>(
      `SELECT * FROM activity_logs
       WHERE user_id = $1
       AND scheduled_date = $2
       AND status = 'completed'
       AND duration IS NOT NULL`,
      [userId, today]
    );
    for (const log of todayLogsResult.rows) {
      if (log.duration) {
        caloriesBurned += log.duration * 6; // Rough estimate: 6 calories per minute
      }
    }
  }

  const caloriesTarget = 2200;

  // Get nutrition macros from meal_logs (primary source)
  // Use same timezone-aware date filtering + JSONB foods fallback as calories query
  const nutritionResult = await query<{
    total_protein: string;
    total_carbs: string;
    total_fats: string;
  }>(
    `SELECT 
       COALESCE(SUM(
         CASE WHEN protein_grams IS NOT NULL AND protein_grams > 0 THEN protein_grams
              ELSE (SELECT COALESCE(SUM((f->>'protein')::numeric), 0) FROM jsonb_array_elements(COALESCE(foods, '[]'::jsonb)) AS f WHERE f->>'protein' IS NOT NULL)
         END
       ), 0) as total_protein,
       COALESCE(SUM(
         CASE WHEN carbs_grams IS NOT NULL AND carbs_grams > 0 THEN carbs_grams
              ELSE (SELECT COALESCE(SUM((f->>'carbs')::numeric), 0) FROM jsonb_array_elements(COALESCE(foods, '[]'::jsonb)) AS f WHERE f->>'carbs' IS NOT NULL)
         END
       ), 0) as total_carbs,
       COALESCE(SUM(
         CASE WHEN fat_grams IS NOT NULL AND fat_grams > 0 THEN fat_grams
              ELSE (SELECT COALESCE(SUM((f->>'fat')::numeric), 0) FROM jsonb_array_elements(COALESCE(foods, '[]'::jsonb)) AS f WHERE f->>'fat' IS NOT NULL)
         END
       ), 0) as total_fats
     FROM meal_logs
     WHERE user_id = $1
     AND eaten_at::date = $2::date`,
    [userId, todayStr]
  );
  
  let macros = {
    protein: parseFloat(nutritionResult.rows[0]?.total_protein || '0'),
    carbs: parseFloat(nutritionResult.rows[0]?.total_carbs || '0'),
    fats: parseFloat(nutritionResult.rows[0]?.total_fats || '0'),
  };
  
  // Fallback to health_data_records if no meal_logs data
  if (macros.protein === 0 && macros.carbs === 0 && macros.fats === 0) {
    const fallbackResult = await query<HealthDataRow>(
      `SELECT * FROM health_data_records
       WHERE user_id = $1
       AND data_type = 'nutrition'
       AND recorded_at >= $2
       ORDER BY recorded_at DESC
       LIMIT 1`,
      [userId, today]
    );
    const nutritionData = fallbackResult.rows[0]?.value as {
      protein?: number;
      carbs?: number;
      fats?: number;
      calories?: number;
    } | undefined;
    
    macros = {
      protein: nutritionData?.protein || 0,
      carbs: nutritionData?.carbs || 0,
      fats: nutritionData?.fats || 0,
    };
  }
  
  logger.info('[EnhancedHealthMetrics] Nutrition macros', {
    userId,
    date: todayStr,
    macros,
    fromMealLogs: macros.protein > 0 || macros.carbs > 0 || macros.fats > 0,
  });

  // Default macro targets (can be customized based on user profile)
  const macroTargets = {
    protein: 150, // grams
    carbs: 200,   // grams
    fats: 65,     // grams
  };

  // Get heart rate data with history
  // First try to get from health_data_records
  const heartRateResult = await query<HealthDataRow>(
    `SELECT * FROM health_data_records
     WHERE user_id = $1
     AND data_type = 'heart_rate'
     AND recorded_at >= $2
     ORDER BY recorded_at DESC
     LIMIT 24`,
    [userId, sevenDaysAgo]
  );

  let heartRateData = heartRateResult.rows[0]?.value as { bpm?: number; resting?: number } | undefined;
  let currentHeartRate = heartRateData?.bpm || null;
  let restingHeartRate = heartRateData?.resting || null;
  
  // Fallback: Try to get from recovery data (WHOOP integration)
  if (!currentHeartRate && !restingHeartRate) {
    const recoveryResult = await query<HealthDataRow>(
      `SELECT * FROM health_data_records
       WHERE user_id = $1
       AND data_type = 'recovery'
       AND recorded_at >= $2
       ORDER BY recorded_at DESC
       LIMIT 1`,
      [userId, sevenDaysAgo]
    );
    
    const recoveryData = recoveryResult.rows[0]?.value as {
      resting_heart_rate_bpm?: number;
      avg_heart_rate_bpm?: number;
      max_heart_rate_bpm?: number;
    } | undefined;
    
    if (recoveryData) {
      currentHeartRate = recoveryData.avg_heart_rate_bpm || recoveryData.max_heart_rate_bpm || null;
      restingHeartRate = recoveryData.resting_heart_rate_bpm || null;
    }
  }
  
  logger.info('[EnhancedHealthMetrics] Heart rate', {
    userId,
    date: todayStr,
    current: currentHeartRate,
    resting: restingHeartRate,
    fromRecovery: !heartRateResult.rows[0] && (currentHeartRate || restingHeartRate),
  });

  // Build heart rate history (last 7 days, hourly averages)
  const heartRateHistory: Array<{ time: string; bpm: number }> = [];
  if (heartRateResult.rows.length > 0) {
    // Group by hour and calculate average
    const hourlyMap = new Map<number, number[]>();
    for (const row of heartRateResult.rows) {
      const hour = new Date(row.recorded_at).getHours();
      const bpm = (row.value as { bpm?: number })?.bpm;
      if (bpm) {
        if (!hourlyMap.has(hour)) {
          hourlyMap.set(hour, []);
        }
        hourlyMap.get(hour)!.push(bpm);
      }
    }
    hourlyMap.forEach((bpms, hour) => {
      const avg = Math.round(bpms.reduce((sum, b) => sum + b, 0) / bpms.length);
      heartRateHistory.push({
        time: `${hour.toString().padStart(2, '0')}:00`,
        bpm: avg,
      });
    });
    heartRateHistory.sort((a, b) => a.time.localeCompare(b.time));
  }

  // Get sleep data
  const sleepResult = await query<HealthDataRow>(
    `SELECT * FROM health_data_records
     WHERE user_id = $1
     AND data_type = 'sleep'
     AND recorded_at >= $2
     ORDER BY recorded_at DESC
     LIMIT 1`,
    [userId, today]
  );
  const sleepData = sleepResult.rows[0]?.value as { duration?: number; quality?: number } | undefined;
  const sleepHours = sleepData?.duration ? sleepData.duration / 60 : null;
  const sleepQuality = sleepData?.quality || null;

  // Calculate analytics
  // Get weekly average steps
  const weeklyStepsResult = await query<{ avg: string }>(
    `SELECT AVG((value->>'count')::numeric) as avg
     FROM health_data_records
     WHERE user_id = $1
     AND data_type = 'steps'
     AND recorded_at >= $2`,
    [userId, sevenDaysAgo]
  );
  const weeklyAvg = parseFloat(weeklyStepsResult.rows[0]?.avg || '0');

  // Calculate consistency score (based on data availability over last 7 days)
  const consistencyResult = await query<{ count: string }>(
    `SELECT COUNT(DISTINCT DATE(recorded_at)) as count
     FROM health_data_records
     WHERE user_id = $1
     AND recorded_at >= $2
     AND data_type IN ('steps', 'heart_rate', 'sleep', 'workouts')`,
    [userId, sevenDaysAgo]
  );
  const dataPoints = parseInt(consistencyResult.rows[0]?.count || '0');
  const consistencyScore = Math.round((dataPoints / 7) * 100);

  // Calculate trend (compare last 7 days vs previous 7 days)
  const previousWeekStart = new Date(sevenDaysAgo.getTime() - 7 * 24 * 60 * 60 * 1000);
  const previousWeekStepsResult = await query<{ avg: string }>(
    `SELECT AVG((value->>'count')::numeric) as avg
     FROM health_data_records
     WHERE user_id = $1
     AND data_type = 'steps'
     AND recorded_at >= $2
     AND recorded_at < $3`,
    [userId, previousWeekStart, sevenDaysAgo]
  );
  const previousWeekAvg = parseFloat(previousWeekStepsResult.rows[0]?.avg || '0');
  
  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (previousWeekAvg > 0) {
    const change = ((weeklyAvg - previousWeekAvg) / previousWeekAvg) * 100;
    if (change > 5) trend = 'up';
    else if (change < -5) trend = 'down';
  }

  // Get Whoop Age (if available from recovery data)
  const recoveryResult = await query<HealthDataRow>(
    `SELECT * FROM health_data_records
     WHERE user_id = $1
     AND data_type = 'recovery'
     ORDER BY recorded_at DESC
     LIMIT 1`,
    [userId]
  );
  const recoveryData = recoveryResult.rows[0]?.value as { whoopAge?: number } | undefined;
  const whoopAge = recoveryData?.whoopAge || null;

  // Get chronological age from user profile (if available)
  const userResult = await query<{ date_of_birth: Date | null }>(
    `SELECT date_of_birth FROM users WHERE id = $1`,
    [userId]
  );
  let chronologicalAge: number | null = null;
  if (userResult.rows[0]?.date_of_birth) {
    const birthDate = new Date(userResult.rows[0].date_of_birth);
    const ageDiff = today.getTime() - birthDate.getTime();
    chronologicalAge = Math.floor(ageDiff / (1000 * 60 * 60 * 24 * 365.25));
  }

  return {
    steps: {
      value: stepsValue,
      target: stepsTarget,
    },
    whoopAge: {
      value: whoopAge,
      chronologicalAge,
    },
    water: {
      consumed: waterConsumed,
      target: waterTarget,
    },
    calories: {
      consumed: Math.round(caloriesConsumed),
      burned: Math.round(caloriesBurned),
      target: caloriesTarget,
    },
    nutrition: {
      macros,
      targets: macroTargets,
      calories: Math.round(caloriesConsumed) > 0 ? Math.round(caloriesConsumed) : undefined,
    },
    heartRate: {
      current: currentHeartRate,
      resting: restingHeartRate,
      history: heartRateHistory,
    },
    analytics: {
      weeklyAvg: Math.round(weeklyAvg),
      consistencyScore,
      dataPoints,
      trend,
    },
    sleep: sleepHours !== null || sleepQuality !== null ? {
      hours: sleepHours,
      quality: sleepQuality,
    } : undefined,
  };

  }, 60); // 60 second TTL

  res.set('Cache-Control', 'private, max-age=60');
  ApiResponse.success(res, enhancedMetrics);
});

/**
 * Log Quick Action
 * POST /api/stats/quick-log
 * Quick log for workouts, meals, sleep, mindfulness, water, weight
 */
export const logQuickAction = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const data = req.body as QuickLogInput;

  if (!data.type) {
    throw ApiError.badRequest('Type is required');
  }

  const validTypes = ['workout', 'meal', 'sleep', 'mindfulness', 'water', 'weight'];
  if (!validTypes.includes(data.type)) {
    throw ApiError.badRequest(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
  }

  // Map quick log type to data_type (must match database enum)
  // Valid enum values: 'heart_rate', 'hrv', 'sleep', 'steps', 'workouts', 'calories', 'nutrition', 'strain', 'recovery', 'body_temp', 'vo2_max', 'training_load', 'gps_activities'
  const dataTypeMap: Record<string, string> = {
    workout: 'workouts',
    meal: 'nutrition',
    sleep: 'sleep',
    mindfulness: 'recovery',
    water: 'nutrition',  // Map water/hydration to nutrition since 'hydration' isn't in enum
    weight: 'calories',  // Map weight/body_composition to calories since 'body_composition' isn't in enum
  };

  const dataType = dataTypeMap[data.type];

  // Build value based on type
  let value: Record<string, unknown> = {};
  let unit = '';

  switch (data.type) {
    case 'workout':
      value = {
        type: data.details?.workoutType || 'general',
        duration: data.duration || 30,
        intensity: data.details?.intensity || 'moderate',
        caloriesBurned: data.value || (data.duration || 30) * 6,
      };
      unit = 'session';
      break;

    case 'meal':
      value = {
        mealType: data.details?.mealType || 'meal',
        calories: data.value,
        notes: data.notes,
      };
      unit = 'kcal';
      break;

    case 'sleep':
      value = {
        duration: data.value || data.duration,
        quality: data.details?.quality || 7,
        notes: data.notes,
      };
      unit = 'minutes';
      break;

    case 'mindfulness':
      value = {
        type: data.details?.mindfulnessType || 'meditation',
        duration: data.duration || 10,
        mood_before: data.details?.moodBefore,
        mood_after: data.details?.moodAfter,
      };
      unit = 'minutes';
      break;

    case 'water':
      value = {
        glasses: data.value || 1,
        ml: (data.value || 1) * 250,
      };
      unit = 'glasses';
      break;

    case 'weight':
      value = {
        weight: data.value,
        unit: data.unit || 'kg',
      };
      unit = data.unit || 'kg';
      break;
  }

  // Check if user has an integration for this data type
  // For now, we'll create a "manual" integration placeholder
  let integrationId: string | null = null;

  const integrationResult = await query<{ id: string }>(
    `SELECT id FROM user_integrations
     WHERE user_id = $1
     AND status = 'active'
     ORDER BY created_at
     LIMIT 1`,
    [userId]
  );

  if (integrationResult.rows.length > 0) {
    integrationId = integrationResult.rows[0].id;
  } else {
    // Create a placeholder integration for manual entries if none exists
    // This is a workaround - in production you'd have a proper "manual" provider
    const createIntegration = await query<{ id: string }>(
      `INSERT INTO user_integrations (user_id, provider, access_token, status)
       VALUES ($1, 'apple_health', 'manual_entry', 'active')
       ON CONFLICT (user_id, provider) DO UPDATE SET status = 'active'
       RETURNING id`,
      [userId]
    );
    integrationId = createIntegration.rows[0].id;
  }

  // Insert health data record
  const recordResult = await query<{ id: string }>(
    `INSERT INTO health_data_records (user_id, integration_id, provider, data_type, recorded_at, value, unit)
     VALUES ($1, $2, 'apple_health', $3, CURRENT_TIMESTAMP, $4, $5)
     RETURNING id`,
    [userId, integrationId, dataType, JSON.stringify(value), unit]
  );

  logger.info('Quick action logged', {
    userId,
    type: data.type,
    recordId: recordResult.rows[0].id,
  });

  ApiResponse.created(res, {
    id: recordResult.rows[0].id,
    type: data.type,
    value,
    unit,
    recordedAt: new Date().toISOString(),
  }, `${data.type} logged successfully`);
});

// Helper: Calculate current streak
async function calculateStreak(userId: string): Promise<{ currentStreak: number; lastActivityDate: string | null }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get daily activity completion for last 365 days
  const logsResult = await query<{ date: Date; completed: string }>(
    `SELECT scheduled_date as date,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
     FROM activity_logs
     WHERE user_id = $1
     AND scheduled_date <= $2
     GROUP BY scheduled_date
     ORDER BY scheduled_date DESC
     LIMIT 365`,
    [userId, today]
  );

  if (logsResult.rows.length === 0) {
    return { currentStreak: 0, lastActivityDate: null };
  }

  let streak = 0;
  let lastActivityDate: string | null = null;
  let checkDate = new Date(today);

  for (const row of logsResult.rows) {
    const rowDate = new Date(row.date);
    rowDate.setHours(0, 0, 0, 0);
    const completed = parseInt(row.completed);

    // Check if this is a consecutive day
    const diffDays = Math.floor((checkDate.getTime() - rowDate.getTime()) / (1000 * 60 * 60 * 24));

    if (completed > 0) {
      if (diffDays <= 1) {
        streak++;
        if (!lastActivityDate) {
          lastActivityDate = typeof row.date === 'string'
            ? row.date
            : rowDate.toISOString().split('T')[0];
        }
        checkDate = new Date(rowDate);
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        // Gap in streak
        break;
      }
    } else if (diffDays === 0) {
      // Today has no completed activities, check if streak continues from yesterday
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // If the last completed activity was more than 1 day ago, the streak is broken
  if (lastActivityDate) {
    const lastDate = new Date(lastActivityDate);
    lastDate.setHours(0, 0, 0, 0);
    const diffFromToday = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffFromToday > 1) {
      streak = 0;
    }
  }

  return { currentStreak: streak, lastActivityDate };
}

// Helper: Calculate longest streak
async function calculateLongestStreak(userId: string): Promise<number> {
  const logsResult = await query<{ date: Date; completed: string }>(
    `SELECT scheduled_date as date,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
     FROM activity_logs
     WHERE user_id = $1
     GROUP BY scheduled_date
     ORDER BY scheduled_date`,
    [userId]
  );

  if (logsResult.rows.length === 0) {
    return 0;
  }

  let longestStreak = 0;
  let currentStreak = 0;
  let prevDate: Date | null = null;

  for (const row of logsResult.rows) {
    const rowDate = new Date(row.date);
    rowDate.setHours(0, 0, 0, 0);
    const completed = parseInt(row.completed);

    if (completed > 0) {
      if (prevDate) {
        const diffDays = Math.floor((rowDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          currentStreak++;
        } else {
          currentStreak = 1;
        }
      } else {
        currentStreak = 1;
      }

      if (currentStreak > longestStreak) {
        longestStreak = currentStreak;
      }
      prevDate = rowDate;
    }
  }

  return longestStreak;
}

/**
 * Get Analytics Data
 * GET /api/stats/analytics
 * Returns comprehensive analytics with trends, breakdowns, and performance metrics
 */
export const getAnalytics = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const range = (req.query.range as string) || '30d';
  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  // Get activity trends
  const trendsResult = await query<{ date: Date; completed: string; total: string }>(
    `SELECT
       scheduled_date as date,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
       COUNT(*) as total
     FROM activity_logs
     WHERE user_id = $1
     AND scheduled_date >= $2
     GROUP BY scheduled_date
     ORDER BY scheduled_date ASC`,
    [userId, startDate]
  );

  // Format dates properly and ensure chronological order
  const activityTrends = trendsResult.rows
    .map(row => ({
      date: typeof row.date === 'string'
        ? row.date
        : new Date(row.date).toISOString().split('T')[0],
      completed: parseInt(row.completed),
      total: parseInt(row.total),
      completionRate: parseInt(row.total) > 0 ? Math.round((parseInt(row.completed) / parseInt(row.total)) * 100) : 0,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Get all logs with their plan activities for categorization
  const logsWithPlans = await query<{
    scheduled_date: Date;
    plan_id: string;
    activity_id: string;
  }>(
    `SELECT scheduled_date, plan_id, activity_id
     FROM activity_logs
     WHERE user_id = $1
     AND scheduled_date >= $2
     ORDER BY scheduled_date`,
    [userId, startDate]
  );

  // Get all plans with their activities
  const plansResult = await query<UserPlanRow>(
    `SELECT id, activities FROM user_plans WHERE user_id = $1`,
    [userId]
  );

  const plansMap = new Map<string, IActivity[]>();
  plansResult.rows.forEach(plan => {
    plansMap.set(plan.id, (plan.activities as IActivity[]) || []);
  });

  // Build weekly breakdown by processing logs
  const breakdownMap = new Map<string, { activities: number; workouts: number; meals: number }>();
  
  logsWithPlans.rows.forEach(log => {
    const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
      new Date(log.scheduled_date).getDay()
    ];
    
    if (!breakdownMap.has(dayOfWeek)) {
      breakdownMap.set(dayOfWeek, { activities: 0, workouts: 0, meals: 0 });
    }
    
    const dayData = breakdownMap.get(dayOfWeek)!;
    dayData.activities++;
    
    // Find activity type from plan
    const planActivities = plansMap.get(log.plan_id) || [];
    const activity = planActivities.find(a => a.id === log.activity_id);
    
    if (activity) {
      if (activity.type === 'workout') {
        dayData.workouts++;
      } else if (activity.type === 'meal') {
        dayData.meals++;
      }
    }
  });

  // Ensure all 7 days are represented (even with 0 values for days with no data)
  const dayOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const weeklyBreakdown = dayOrder.map(day => {
    const data = breakdownMap.get(day) || { activities: 0, workouts: 0, meals: 0 };
    return {
      day,
      activities: data.activities,
      workouts: data.workouts,
      meals: data.meals,
    };
  });

  // Build category distribution from logs and plans
  const categoryCounts = new Map<string, number>();
  
  logsWithPlans.rows.forEach(log => {
    const planActivities = plansMap.get(log.plan_id) || [];
    const activity = planActivities.find(a => a.id === log.activity_id);
    const activityType = activity?.type || 'other';
    categoryCounts.set(activityType, (categoryCounts.get(activityType) || 0) + 1);
  });

  const totalCategory = Array.from(categoryCounts.values()).reduce((sum, count) => sum + count, 0);
  
  // Map activity types to display names
  const categoryMap: Record<string, string> = {
    workout: 'Workout',
    meal: 'Meal',
    sleep_routine: 'Sleep',
    mindfulness: 'Mindfulness',
    habit: 'Habit',
    check_in: 'Check-in',
    reflection: 'Reflection',
    learning: 'Learning',
    other: 'Other',
  };

  const categoryDistribution = Array.from(categoryCounts.entries())
    .map(([type, count]) => ({
      category: categoryMap[type] || type,
      count,
      percentage: totalCategory > 0 ? Math.round((count / totalCategory) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Get time distribution (hour of day) - use completed_at or scheduled_date as fallback
  const timeResult = await query<{ hour: number; activities: string }>(
    `SELECT
       EXTRACT(HOUR FROM COALESCE(completed_at, scheduled_date))::int as hour,
       COUNT(*) as activities
     FROM activity_logs
     WHERE user_id = $1
     AND scheduled_date >= $2
     GROUP BY hour
     ORDER BY hour`,
    [userId, startDate]
  );

  // Ensure all 24 hours are represented
  const timeDistribution = Array.from({ length: 24 }, (_, i) => {
    const hourData = timeResult.rows.find(r => Math.floor(r.hour) === i);
    return {
      hour: i,
      activities: hourData ? parseInt(hourData.activities) : 0,
    };
  });

  // Get monthly progress
  const monthlyResult = await query<{ month: string; completed: string; total: string }>(
    `SELECT
       TO_CHAR(scheduled_date, 'YYYY-MM') as month,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
       COUNT(*) as total
     FROM activity_logs
     WHERE user_id = $1
     AND scheduled_date >= $2
     GROUP BY month
     ORDER BY month ASC`,
    [userId, startDate]
  );

  const monthlyProgress = monthlyResult.rows.map(row => ({
    month: row.month,
    completed: parseInt(row.completed),
    target: parseInt(row.total),
  }));

  // Calculate performance metrics
  const allCompleted = activityTrends.reduce((sum, t) => sum + t.completed, 0);
  const allTotal = activityTrends.reduce((sum, t) => sum + t.total, 0);
  const averageCompletionRate = allTotal > 0 ? Math.round((allCompleted / allTotal) * 100) : 0;

  const bestDay = activityTrends.reduce((best, current) => 
    current.completionRate > best.completionRate ? current : best,
    activityTrends[0] || { date: '', completionRate: 0 }
  );

  const worstDay = activityTrends.reduce((worst, current) => 
    current.completionRate < worst.completionRate ? current : worst,
    activityTrends[0] || { date: '', completionRate: 100 }
  );

  const firstHalf = activityTrends.slice(0, Math.floor(activityTrends.length / 2));
  const secondHalf = activityTrends.slice(Math.floor(activityTrends.length / 2));
  const firstHalfAvg = firstHalf.length > 0 
    ? firstHalf.reduce((sum, t) => sum + t.completionRate, 0) / firstHalf.length 
    : 0;
  const secondHalfAvg = secondHalf.length > 0
    ? secondHalf.reduce((sum, t) => sum + t.completionRate, 0) / secondHalf.length
    : 0;
  const improvementRate = firstHalfAvg > 0 ? Math.round(((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100) : 0;

  ApiResponse.success(res, {
    activityTrends,
    weeklyBreakdown,
    categoryDistribution,
    timeDistribution,
    monthlyProgress,
    performanceMetrics: {
      averageCompletionRate,
      bestDay: bestDay.date,
      worstDay: worstDay.date,
      totalActivities: allTotal,
      improvementRate,
    },
  });
});

/**
 * Get Report Data
 * GET /api/stats/report
 * Returns comprehensive report with summary, trends, and recommendations
 */
export const getReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const period = (req.query.period as string) || 'month';
  const days = period === 'week' ? 7 : period === 'month' ? 30 : period === 'quarter' ? 90 : 365;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  // Get summary
  const summaryResult = await query<{ completed: string; total: string; avg_score: string }>(
    `SELECT
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
       COUNT(*) as total,
       AVG(CASE WHEN status = 'completed' THEN 100 ELSE 0 END) as avg_score
     FROM activity_logs
     WHERE user_id = $1
     AND scheduled_date >= $2`,
    [userId, startDate]
  );

  const summaryRow = summaryResult.rows[0];
  const totalActivities = parseInt(summaryRow?.total || '0');
  const completedActivities = parseInt(summaryRow?.completed || '0');
  const completionRate = totalActivities > 0 ? Math.round((completedActivities / totalActivities) * 100) : 0;
  const averageScore = parseFloat(summaryRow?.avg_score || '0');

  // Get weekly report
  const weeklyReportResult = await query<{ week: string; completed: string; total: string; score: string }>(
    `SELECT
       TO_CHAR(scheduled_date, 'YYYY-WW') as week,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
       COUNT(*) as total,
       AVG(CASE WHEN status = 'completed' THEN 100 ELSE 0 END) as score
     FROM activity_logs
     WHERE user_id = $1
     AND scheduled_date >= $2
     GROUP BY week
     ORDER BY week ASC`,
    [userId, startDate]
  );

  const weeklyReport = weeklyReportResult.rows.map(row => ({
    week: row.week,
    completed: parseInt(row.completed),
    total: parseInt(row.total),
    score: Math.round(parseFloat(row.score)),
  }));

  // Get category performance - categorize by activity_id patterns
  const categoryPerfResult = await query<{ category: string; completed: string; total: string; avg_score: string }>(
    `SELECT
       CASE 
         WHEN activity_id ILIKE '%workout%' OR activity_id ILIKE '%exercise%' OR activity_id ILIKE '%fitness%' THEN 'workout'
         WHEN activity_id ILIKE '%meal%' OR activity_id ILIKE '%food%' OR activity_id ILIKE '%nutrition%' THEN 'meal'
         WHEN activity_id ILIKE '%sleep%' THEN 'sleep_routine'
         WHEN activity_id ILIKE '%mindfulness%' OR activity_id ILIKE '%meditation%' THEN 'mindfulness'
         WHEN activity_id ILIKE '%habit%' THEN 'habit'
         WHEN activity_id ILIKE '%check%' OR activity_id ILIKE '%checkin%' THEN 'check_in'
         WHEN activity_id ILIKE '%reflection%' THEN 'reflection'
         WHEN activity_id ILIKE '%learning%' OR activity_id ILIKE '%learn%' THEN 'learning'
         ELSE 'other'
       END as category,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
       COUNT(*) as total,
       AVG(CASE WHEN status = 'completed' THEN 100 ELSE 0 END) as avg_score
     FROM activity_logs
     WHERE user_id = $1
     AND scheduled_date >= $2
     GROUP BY category`,
    [userId, startDate]
  );

  const categoryPerformance = categoryPerfResult.rows.map(row => ({
    category: row.category,
    completed: parseInt(row.completed),
    total: parseInt(row.total),
    averageScore: Math.round(parseFloat(row.avg_score)),
  }));

  // Get goal progress (from user_goals)
  const goalsResult = await query<{ goal: string; progress: string; target: string; status: string }>(
    `SELECT
       title as goal,
       progress,
       target_value as target,
       status
     FROM user_goals
     WHERE user_id = $1
     AND status IN ('active', 'draft')
     LIMIT 5`,
    [userId]
  );

  const goalProgress = goalsResult.rows.map(row => {
    const progress = parseFloat(row.progress || '0');
    const target = parseFloat(row.target || '1');
    const percentage = target > 0 ? (progress / target) * 100 : 0;
    let status: 'on-track' | 'behind' | 'ahead' = 'on-track';
    if (percentage >= 100) status = 'ahead';
    else if (percentage < 70) status = 'behind';

    return {
      goal: row.goal,
      progress,
      target,
      status,
    };
  });

  // Generate recommendations
  const recommendations = [];
  if (completionRate < 70) {
    recommendations.push({
      priority: 'high' as const,
      category: 'Activity Completion',
      recommendation: 'Your completion rate is below optimal. Focus on consistency.',
      action: 'Set daily reminders and break activities into smaller tasks.',
    });
  }
  if (categoryPerformance.some(c => c.averageScore < 60)) {
    const lowCategory = categoryPerformance.find(c => c.averageScore < 60);
    if (lowCategory) {
      recommendations.push({
        priority: 'medium' as const,
        category: lowCategory.category,
        recommendation: `${lowCategory.category} performance needs improvement.`,
        action: `Focus on completing ${lowCategory.category} activities more consistently.`,
      });
    }
  }

  // Get health trends (from health_data_records)
  const healthTrendsResult = await query<{ metric: string; current: string; previous: string }>(
    `SELECT
       data_type as metric,
       (SELECT value::numeric FROM health_data_records 
        WHERE user_id = $1 AND data_type = hdr.data_type 
        ORDER BY recorded_at DESC LIMIT 1) as current,
       (SELECT value::numeric FROM health_data_records 
        WHERE user_id = $1 AND data_type = hdr.data_type 
        ORDER BY recorded_at DESC LIMIT 1 OFFSET 1) as previous
     FROM (SELECT DISTINCT data_type FROM health_data_records WHERE user_id = $1) hdr
     LIMIT 5`,
    [userId]
  );

  const healthTrends = healthTrendsResult.rows.map(row => {
    const current = parseFloat(row.current || '0');
    const previous = parseFloat(row.previous || '0');
    const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (change > 5) trend = 'up';
    else if (change < -5) trend = 'down';

    return {
      metric: row.metric,
      current,
      previous,
      change: Math.round(change * 10) / 10,
      trend,
    };
  });

  // Get achievements (from achievements)
  const achievementsResult = await query<{ title: string }>(
    `SELECT title FROM achievements 
     WHERE user_id = $1 
     AND earned_at >= $2
     ORDER BY earned_at DESC
     LIMIT 10`,
    [userId, startDate]
  );

  const achievements = achievementsResult.rows.map(row => row.title);

  // Improvement areas
  const improvementAreas = categoryPerformance
    .filter(c => c.averageScore < 70)
    .map(c => c.category);

  ApiResponse.success(res, {
    summary: {
      period,
      totalActivities,
      completedActivities,
      completionRate,
      averageScore: Math.round(averageScore),
      improvementAreas,
      achievements,
    },
    weeklyReport,
    categoryPerformance,
    goalProgress,
    recommendations,
    healthTrends,
  });
});

export default {
  getDashboardStats,
  getWeeklyActivityData,
  getCurrentStreak,
  getHealthMetrics,
  getEnhancedHealthMetrics,
  logQuickAction,
  getAnalytics,
  getReport,
};
