/**
 * @file Plan domain types
 * @description Single source of truth for plan-related types
 */

import type { HealthPillar, GoalCategory } from './goal';

export type PlanStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';

export type ActivityType =
  | 'workout'
  | 'meal'
  | 'sleep_routine'
  | 'mindfulness'
  | 'habit'
  | 'check_in'
  | 'reflection'
  | 'learning';

export type ActivityLogStatus = 'pending' | 'completed' | 'skipped' | 'partial';

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export interface Activity {
  id: string;
  planId: string;
  type: ActivityType;
  title: string;
  description?: string;
  duration?: number;
  scheduledTime?: string;
  dayOfWeek: DayOfWeek;
  weekNumber: number;
  isOptional?: boolean;
  pillar: HealthPillar;
  metadata?: Record<string, unknown>;
  status?: ActivityLogStatus;
}

export interface WeeklyFocus {
  week: number;
  theme: string;
  focus: string;
  expectedOutcome: string;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  pillar: HealthPillar;
  goalCategory: GoalCategory;
  startDate: string;
  endDate: string;
  durationWeeks: number;
  currentWeek: number;
  status: PlanStatus;
  overallProgress: number;
  activities: Activity[];
  weeklyFocuses: WeeklyFocus[];
  coachMessage?: string;
}

export interface TodayData {
  planId: string;
  date: string;
  dayOfWeek: DayOfWeek;
  activities: Activity[];
  completedCount: number;
  totalCount: number;
  isRestDay?: boolean;
}

export interface WeeklySummary {
  week: number;
  focus?: WeeklyFocus;
  stats: {
    totalActivities: number;
    completed: number;
    skipped: number;
    pending: number;
    completionRate: number;
  };
}

export interface ActivityLog {
  id: string;
  activityId: string;
  userId: string;
  planId: string;
  status: ActivityLogStatus;
  scheduledDate: string;
  completedAt?: string;
  duration?: number;
  notes?: string;
  aiFeedback?: string;
  metadata?: Record<string, unknown>;
}
