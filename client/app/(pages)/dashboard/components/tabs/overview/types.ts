/**
 * @file Overview Tab Type Definitions
 */

export interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  targetValue?: number;
  targetUnit?: string;
  preferredTime: string;
  duration?: number;
  status: 'pending' | 'completed' | 'skipped';
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
  status: string;
  overallProgress: number;
  activities: ActivityItem[];
}

export interface TodayData {
  planId: string;
  date: string;
  dayOfWeek: string;
  activities: ActivityItem[];
  completedCount: number;
  totalCount: number;
  isRestDay?: boolean;
}

export interface WeeklySummary {
  week: number;
  focus?: {
    theme: string;
    focus: string;
    expectedOutcome: string;
  };
  stats: {
    totalActivities: number;
    completed: number;
    skipped: number;
    pending: number;
    completionRate: number;
  };
}

export interface DashboardStats {
  streak: {
    current: number;
    longest: number;
    lastActivityDate: string | null;
  };
  weekProgress: {
    rate: number;
    change: number;
    completed: number;
    total: number;
  };
  summary: {
    totalActivitiesCompleted: number;
    activeGoals: number;
  };
}

export interface WeeklyActivityData {
  week: string;
  startDate: string;
  endDate: string;
  days: Array<{
    day: string;
    date: string;
    completed: number;
    total: number;
    completionRate: number;
    isToday: boolean;
  }>;
  summary: {
    totalCompleted: number;
    totalActivities: number;
    averageCompletionRate: number;
  };
}

export interface HealthMetrics {
  calories: { value: number | null; target: number; unit: string; source: string | null };
  water: { value: number | null; target: number; unit: string; source: string | null };
  sleep: { value: string | null; target: string; quality: number | null; source: string | null };
  heartRate: { value: number | null; unit: string; resting: number | null; source: string | null };
  steps: { value: number | null; target: number; unit: string; source: string | null };
}

export interface QuickLogModalState {
  isOpen: boolean;
  type: 'workout' | 'meal' | 'mindfulness' | 'sleep' | 'water' | 'weight' | null;
}

export interface LogActivityData {
  status?: 'pending' | 'completed' | 'skipped' | 'partial';
  actualValue?: number;
  duration?: number;
  notes?: string;
  mood?: number;
}
