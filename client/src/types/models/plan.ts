/**
 * @file Plan domain models
 */

import type { Activity } from './activity';

export type PlanStatus = 'draft' | 'active' | 'completed' | 'paused';

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
  pillar: string;
  goalCategory: string;
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
  dayOfWeek: string;
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
