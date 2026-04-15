/**
 * @file Plans Tab Type Definitions
 */

// Status types
export type PlanStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';
export type GoalCategory =
  | 'weight_loss'
  | 'muscle_building'
  | 'sleep_improvement'
  | 'stress_wellness'
  | 'energy_productivity'
  | 'event_training'
  | 'health_condition'
  | 'habit_building'
  | 'overall_optimization'
  | 'custom';
export type HealthPillar = 'fitness' | 'nutrition' | 'wellbeing';
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

// Plan interface
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
  activities?: IActivity[];
  activitiesCount?: number;
  completedActivities?: number;
  userRating?: number;
  createdAt: string;
  updatedAt: string;
}

// Activity interface
export interface IActivity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  targetValue?: number;
  targetUnit?: string;
  daysOfWeek: string[];
  preferredTime: string;
  duration?: number;
  isOptional?: boolean;
  instructions?: string[];
  log?: ActivityLog | null;
  status?: ActivityLogStatus;
}

// Activity log interface
export interface ActivityLog {
  id: string;
  status: ActivityLogStatus;
  completedAt?: string;
  actualValue?: number;
  duration?: number;
  notes?: string;
  mood?: number;
  aiFeedback?: string;
}

// API response types
export interface TodayActivitiesResponse {
  planId: string;
  date: string;
  dayOfWeek: string;
  activities: IActivity[];
  completedCount: number;
  totalCount: number;
  isRestDay?: boolean;
}

export interface PlansResponse {
  plans: Plan[];
  total: number;
  stats?: {
    active: number;
    completed: number;
    paused: number;
    archived: number;
    draft: number;
  };
}

// Form types
export interface CreatePlanFormData {
  name: string;
  description: string;
  pillar: HealthPillar;
  goalCategory: GoalCategory;
  durationWeeks: number;
  tasks: TaskInput[];
  useAI: boolean;
  aiGoalDescription?: string;
}

export interface TaskInput {
  id: string;
  title: string;
  description: string;
  type: ActivityType;
  daysOfWeek: string[];
  preferredTime: string;
  duration?: number;
}
