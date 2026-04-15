/**
 * @file Dashboard feature types
 */

import type { Activity, Plan, TodayData, WeeklySummary } from '@/src/types';

// Re-export domain types for convenience
export type { Activity, Plan, TodayData, WeeklySummary };

/**
 * Dashboard Tab ID
 */
export type TabId =
  | 'overview'
  | 'goals'
  | 'activity'
  | 'achievements'
  | 'notifications'
  | 'preferences'
  | 'settings'
  | 'profile';

/**
 * Tab configuration
 */
export interface TabConfig {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  color: string;
}

/**
 * Dashboard state
 */
export interface DashboardState {
  activeTab: TabId;
  plan: Plan | null;
  todayData: TodayData | null;
  weeklySummary: WeeklySummary | null;
  weekCompletionRate: number;
  isLoading: boolean;
  error: string | null;
}

/**
 * Overview tab props
 */
export interface OverviewTabProps {
  plan: Plan | null;
  todayData: TodayData | null;
  weeklySummary: WeeklySummary | null;
  weekCompletionRate: number;
  onActivityComplete: (activityId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
}
