/**
 * @file Workout Utilities
 * Helper functions for workout components
 */

// Helper to validate UUID format
export const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

// Format time from seconds to MM:SS or HH:MM:SS
export const formatTime = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Get random motivational quote
export const getRandomQuote = (quotes: string[]): string => {
  return quotes[Math.floor(Math.random() * quotes.length)];
};

// Calculate estimated workout duration from exercises
export const calculateWorkoutDuration = (exerciseCount: number, avgMinutesPerExercise = 8): number => {
  return exerciseCount * avgMinutesPerExercise;
};

// Calculate estimated calories from workout
export const calculateEstimatedCalories = (exerciseCount: number, avgCaloriesPerExercise = 25): number => {
  return exerciseCount * avgCaloriesPerExercise;
};

// --- Plan Completion Utilities ---

import type { WorkoutPlan, DayWorkout, PlanCompletionCheck, PlanCompletionStats } from './types';
import { workoutsService, type WorkoutLog } from '@/src/shared/services';

const DAYS_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Check if a multi-week plan has been fully completed.
 * Uses the dailyProgress map with week-specific keys (week_1_monday, etc.).
 */
export function checkPlanCompletion(
  plan: WorkoutPlan,
  dailyProgress: Record<string, number>
): PlanCompletionCheck {
  const durationWeeks = plan.durationWeeks || 1;
  if (durationWeeks <= 1 && !plan.weeks && !plan.weeklySchedule) {
    return { isComplete: false, overallCompletionRate: 0, weekCompletionRates: [], totalWorkoutDaysLogged: 0, totalWorkoutDaysPlanned: 0 };
  }

  // Build per-week day map: if `weeks` exists use it, otherwise replicate `weeklySchedule` for all weeks
  const getWeekDays = (w: number): Record<string, DayWorkout | null> => {
    if (plan.weeks?.[`week_${w}`]?.days) {
      return plan.weeks[`week_${w}`].days;
    }
    // Fallback: use weeklySchedule for every week
    return (plan.weeklySchedule || {}) as Record<string, DayWorkout | null>;
  };

  const weekRates: number[] = [];
  let totalLogged = 0;
  let totalPlanned = 0;

  for (let w = 1; w <= durationWeeks; w++) {
    const weekDays = getWeekDays(w);

    let weekTotal = 0;
    let weekDayCount = 0;

    for (const day of DAYS_ORDER) {
      const dayWorkout = weekDays[day];
      if (!dayWorkout || (dayWorkout as DayWorkout).isRestDay) continue;

      totalPlanned++;
      weekDayCount++;

      const weekKey = `week_${w}_${day}`;
      const progress = dailyProgress[weekKey] ?? 0;
      weekTotal += progress;

      if (progress > 0) totalLogged++;
    }

    weekRates.push(weekDayCount > 0 ? weekTotal / weekDayCount : 0);
  }

  const overall = weekRates.length > 0
    ? weekRates.reduce((a, b) => a + b, 0) / weekRates.length
    : 0;

  const isComplete = totalPlanned > 0 && totalLogged >= totalPlanned;

  return {
    isComplete,
    overallCompletionRate: Math.round(overall),
    weekCompletionRates: weekRates.map(r => Math.round(r)),
    totalWorkoutDaysLogged: totalLogged,
    totalWorkoutDaysPlanned: totalPlanned,
  };
}

/**
 * Fetch workout logs for ALL dates in the plan range and build a full progress map.
 * Returns Record<string, number> with keys like "week_1_monday" → 0-100.
 */
export async function buildFullPlanProgress(
  plan: WorkoutPlan
): Promise<Record<string, number>> {
  const progress: Record<string, number> = {};
  if (!plan.weeks || !plan.durationWeeks || !plan.startDate) return progress;

  const startDate = new Date(plan.startDate);
  startDate.setHours(0, 0, 0, 0);

  // Normalize to the Monday on or before plan start
  const startDay = startDate.getDay();
  const normalizedStart = new Date(startDate);
  normalizedStart.setDate(startDate.getDate() - (startDay === 0 ? 6 : startDay - 1));

  for (let w = 1; w <= plan.durationWeeks; w++) {
    const weekPlan = plan.weeks[`week_${w}`];
    if (!weekPlan) continue;

    const weekStart = new Date(normalizedStart);
    weekStart.setDate(normalizedStart.getDate() + (w - 1) * 7);

    // Fetch logs for all 7 days of this week in parallel
    const datePromises = DAYS_ORDER.map(async (day, i) => {
      const dayDate = new Date(weekStart);
      dayDate.setDate(weekStart.getDate() + i);
      const dateStr = formatLocalDate(dayDate);

      const dayWorkout = weekPlan.days?.[day];
      if (!dayWorkout || dayWorkout.isRestDay) return;

      try {
        const resp = await workoutsService.getLogsForDate(dateStr);
        const logs = resp.data?.logs || [];
        const planLogs = plan.id
          ? logs.filter((l: WorkoutLog) => l.workoutPlanId === plan.id)
          : logs;

        if (planLogs.length > 0) {
          const completedLog = planLogs.find(
            (l: WorkoutLog) => l.status === 'completed' || l.status === 'partial'
          );
          progress[`week_${w}_${day}`] = completedLog ? 100 : 0;
        } else {
          progress[`week_${w}_${day}`] = 0;
        }
      } catch {
        progress[`week_${w}_${day}`] = 0;
      }
    });

    await Promise.all(datePromises);
  }

  return progress;
}

/**
 * Calculate aggregated stats for a completed plan by fetching all workout logs.
 */
export async function calculatePlanStats(
  plan: WorkoutPlan,
  completionCheck: PlanCompletionCheck
): Promise<PlanCompletionStats> {
  const durationWeeks = plan.durationWeeks || 1;
  const startDate = new Date(plan.startDate || new Date().toISOString().split('T')[0]);
  startDate.setHours(0, 0, 0, 0);

  const startDay = startDate.getDay();
  const normalizedStart = new Date(startDate);
  normalizedStart.setDate(startDate.getDate() - (startDay === 0 ? 6 : startDay - 1));

  // Fetch logs for ALL dates in the plan range
  const totalDays = durationWeeks * 7;
  const allLogs: WorkoutLog[] = [];

  // Batch in weeks (7 days at a time)
  for (let batch = 0; batch < totalDays; batch += 7) {
    const batchPromises: Promise<void>[] = [];
    for (let i = batch; i < Math.min(batch + 7, totalDays); i++) {
      const d = new Date(normalizedStart);
      d.setDate(normalizedStart.getDate() + i);
      const dateStr = formatLocalDate(d);

      batchPromises.push(
        workoutsService.getLogsForDate(dateStr)
          .then(resp => {
            const logs = resp.data?.logs || [];
            const planLogs = plan.id
              ? logs.filter((l: WorkoutLog) => l.workoutPlanId === plan.id)
              : logs;
            allLogs.push(...planLogs);
          })
          .catch(() => {})
      );
    }
    await Promise.all(batchPromises);
  }

  // Aggregate stats
  let totalMinutes = 0;
  let totalExercises = 0;
  let totalXp = 0;
  const completedDates = new Set<string>();

  for (const log of allLogs) {
    if (log.status === 'completed' || log.status === 'partial') {
      completedDates.add(log.scheduledDate);
      totalMinutes += log.durationMinutes || 0;
      totalExercises += log.exercisesCompleted?.length || 0;
      totalXp += log.xpEarned || 0;
    }
  }

  // Calculate longest streak
  let longestStreak = 0;
  let currentStreak = 0;
  const sortedDates = Array.from(completedDates).sort();
  for (let i = 0; i < sortedDates.length; i++) {
    if (i === 0) {
      currentStreak = 1;
    } else {
      const prev = new Date(sortedDates[i - 1]);
      const curr = new Date(sortedDates[i]);
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
      currentStreak = diffDays <= 2 ? currentStreak + 1 : 1;
    }
    longestStreak = Math.max(longestStreak, currentStreak);
  }

  // Estimate calories from plan structure (weeks or weeklySchedule fallback)
  let totalCalories = 0;
  if (plan.weeks) {
    for (let w = 1; w <= durationWeeks; w++) {
      const weekPlan = plan.weeks[`week_${w}`];
      if (!weekPlan?.days) continue;
      for (const day of Object.values(weekPlan.days)) {
        if (day) totalCalories += day.estimatedCalories || 0;
      }
    }
    totalCalories = Math.round(totalCalories * (completionCheck.overallCompletionRate / 100));
  } else if (plan.weeklySchedule) {
    // Fallback: use weeklySchedule * durationWeeks
    let weeklyCalories = 0;
    for (const day of Object.values(plan.weeklySchedule)) {
      if (day) weeklyCalories += (day as DayWorkout).estimatedCalories || 0;
    }
    totalCalories = Math.round(weeklyCalories * durationWeeks * (completionCheck.overallCompletionRate / 100));
  }

  // Bonus XP for completing the plan
  const bonusXp = completionCheck.overallCompletionRate >= 80 ? 500 : 250;

  const endDate = new Date(normalizedStart);
  endDate.setDate(normalizedStart.getDate() + totalDays - 1);

  return {
    planName: plan.name,
    durationWeeks,
    difficulty: plan.difficulty,
    totalWorkoutsCompleted: completedDates.size,
    totalWorkoutsPlanned: completionCheck.totalWorkoutDaysPlanned,
    totalMinutes,
    totalCalories,
    totalExercisesCompleted: totalExercises,
    longestStreak,
    overallCompletionRate: completionCheck.overallCompletionRate,
    weeklyCompletionRates: completionCheck.weekCompletionRates,
    startDate: plan.startDate || formatLocalDate(normalizedStart),
    endDate: plan.endDate || formatLocalDate(endDate),
    totalXpEarned: totalXp + bonusXp,
  };
}
