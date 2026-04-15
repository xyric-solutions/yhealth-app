/**
 * @file Plans API Service
 * @description Centralized API calls for plans-related operations
 */

import { api } from '@/lib/api-client';
import type { Plan, TodayData, WeeklySummary, Activity, ActivityLog } from '@/src/types';

// Response Types
export interface PlanGenerateResponse {
  plan: Plan;
  message: string;
}

export interface ActivePlanResponse {
  plan: Plan;
  todayActivities: Activity[];
  weekCompletionRate: number;
}

export interface ProgressStats {
  completed: number;
  total: number;
  percentage: number;
}

export interface StreakInfo {
  days: number;
  isMilestone: boolean;
}

export interface CompleteActivityResponse {
  log: ActivityLog;
  feedback: string;
  progress: ProgressStats;
  streak: StreakInfo;
}

export interface UncompleteActivityResponse {
  log: ActivityLog;
  progress: ProgressStats;
}

export interface PlanProgressResponse {
  planId: string;
  currentWeek: number;
  durationWeeks: number;
  overall: {
    completed: number;
    skipped: number;
    pending: number;
    total: number;
    percentage: number;
  };
  weekly: Array<{
    week: number;
    completed: number;
    total: number;
    percentage: number;
  }>;
  streak: {
    current: number;
    best: number;
  };
}

/**
 * Plans Service - handles all plans API operations
 */
export const plansService = {
  /**
   * Generate a new plan based on goals
   */
  generate: (goalId?: string, regenerate: boolean = true) =>
    api.post<PlanGenerateResponse>('/plans/generate', { goalId, regenerate }),

  /**
   * Get the active plan
   */
  getActive: () => api.get<ActivePlanResponse>('/plans/active'),

  /**
   * Get today's activities
   */
  getToday: () => api.get<TodayData>('/plans/today'),

  /**
   * Get weekly summary for a plan
   */
  getWeeklySummary: (planId: string) =>
    api.get<WeeklySummary>(`/plans/${planId}/summary/weekly`),

  /**
   * Log activity completion (legacy - use completeActivity instead)
   */
  logActivity: (
    planId: string,
    activityId: string,
    data: {
      status: 'completed' | 'skipped';
      scheduledDate: string;
      notes?: string;
      actualValue?: number;
    }
  ) => api.post<void>(`/plans/${planId}/activities/${activityId}/log`, data),

  /**
   * Complete an activity (simple toggle)
   */
  completeActivity: (
    planId: string,
    activityId: string,
    data?: {
      scheduledDate?: string;
      notes?: string;
      mood?: number;
    }
  ) => api.post<CompleteActivityResponse>(
    `/plans/${planId}/activities/${activityId}/complete`,
    data || {}
  ),

  /**
   * Uncomplete an activity
   */
  uncompleteActivity: (
    planId: string,
    activityId: string,
    data?: {
      scheduledDate?: string;
    }
  ) => api.post<UncompleteActivityResponse>(
    `/plans/${planId}/activities/${activityId}/uncomplete`,
    data || {}
  ),

  /**
   * Get plan progress stats
   */
  getProgress: (planId: string) =>
    api.get<PlanProgressResponse>(`/plans/${planId}/progress`),

  /**
   * Complete onboarding and activate plan
   */
  completeOnboarding: () =>
    api.post<{ message: string; planId: string }>('/plans/complete-onboarding', {}),

  /**
   * Get plan by ID
   */
  getById: (planId: string) => api.get<{ plan: Plan }>(`/plans/${planId}`),

  /**
   * Update plan settings
   */
  update: (planId: string, updates: Partial<Plan>) =>
    api.patch<{ plan: Plan }>(`/plans/${planId}`, updates),

  /**
   * Get all user plans
   */
  getAll: (status?: string) =>
    api.get<{ plans: Plan[]; total: number; stats: Record<string, number> }>(
      '/plans',
      status ? { params: { status } } : undefined
    ),
};
