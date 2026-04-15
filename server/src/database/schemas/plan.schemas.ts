/**
 * @file Plan database row types
 * @description Database schema types for plan-related tables
 */

// Shared types
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
export type PlanStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';
export type ActivityLogStatus = 'pending' | 'completed' | 'skipped' | 'partial';
export type ActivityType =
  | 'workout'
  | 'meal'
  | 'sleep_routine'
  | 'mindfulness'
  | 'habit'
  | 'check_in'
  | 'reflection'
  | 'learning';
export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

/**
 * Raw PostgreSQL result for user_goals table
 */
export interface UserGoalRow {
  id: string;
  user_id: string;
  category: GoalCategory;
  pillar: HealthPillar;
  title: string;
  description: string;
  target_value: number;
  target_unit: string;
  duration_weeks: number;
  status: string;
  is_primary?: boolean;
}

/**
 * Raw PostgreSQL result for user_plans table
 */
export interface UserPlanRow {
  id: string;
  user_id: string;
  goal_id: string;
  name: string;
  description: string;
  pillar: HealthPillar;
  goal_category: GoalCategory;
  start_date: Date;
  end_date: Date;
  duration_weeks: number;
  current_week: number;
  status: PlanStatus;
  paused_at: Date | null;
  resumed_at: Date | null;
  completed_at: Date | null;
  activities: object;
  weekly_focuses: object;
  ai_generated: boolean;
  ai_model: string | null;
  generation_params: object | null;
  user_adjustments: object;
  overall_progress: number;
  weekly_completion_rates: object;
  user_rating: number | null;
  user_feedback: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Raw PostgreSQL result for activity_logs table
 */
export interface ActivityLogRow {
  id: string;
  user_id: string;
  plan_id: string;
  activity_id: string;
  scheduled_date: Date;
  completed_at: Date | null;
  status: ActivityLogStatus;
  actual_value: number | null;
  target_value: number | null;
  duration: number | null;
  user_notes: string | null;
  mood: number | null;
  ai_feedback: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Raw PostgreSQL result for assessment_responses table
 */
export interface AssessmentResponseRow {
  id: string;
  user_id: string;
  body_stats: BodyStats | null;
  baseline_data: BaselineData | null;
}

export interface BodyStats {
  heightCm: number;
  weightKg: number;
  targetWeightKg?: number;
  bodyFatPercentage?: number;
}

export interface BaselineData {
  activityDaysPerWeek?: number;
  sleepHoursPerNight?: number;
  stressLevel?: number;
  energyLevel?: number;
}

/**
 * Activity interface for the plan
 */
export interface IActivity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  targetValue?: number;
  targetUnit?: string;
  daysOfWeek: DayOfWeek[];
  preferredTime: string;
  duration?: number;
  isOptional?: boolean;
  instructions?: string[];
  resources?: Array<{ title: string; url?: string; type: string }>;
}

/**
 * Weekly focus interface
 */
export interface IWeeklyFocus {
  week: number;
  theme: string;
  focus: string;
  expectedOutcome: string;
}

/**
 * Mapped plan row to domain object
 */
export function mapPlanRow(row: UserPlanRow) {
  return {
    id: row.id,
    userId: row.user_id,
    goalId: row.goal_id,
    name: row.name,
    description: row.description,
    pillar: row.pillar,
    goalCategory: row.goal_category,
    startDate: row.start_date,
    endDate: row.end_date,
    durationWeeks: row.duration_weeks,
    currentWeek: row.current_week,
    status: row.status,
    pausedAt: row.paused_at,
    resumedAt: row.resumed_at,
    completedAt: row.completed_at,
    activities: row.activities as IActivity[],
    weeklyFocuses: row.weekly_focuses as IWeeklyFocus[],
    aiGenerated: row.ai_generated,
    aiModel: row.ai_model,
    generationParams: row.generation_params,
    userAdjustments: row.user_adjustments,
    overallProgress: row.overall_progress,
    weeklyCompletionRates: row.weekly_completion_rates,
    userRating: row.user_rating,
    userFeedback: row.user_feedback,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Map activity log row to domain object
 */
export function mapActivityLogRow(row: ActivityLogRow) {
  return {
    id: row.id,
    userId: row.user_id,
    planId: row.plan_id,
    activityId: row.activity_id,
    scheduledDate: row.scheduled_date,
    completedAt: row.completed_at,
    status: row.status,
    actualValue: row.actual_value,
    targetValue: row.target_value,
    duration: row.duration,
    userNotes: row.user_notes,
    mood: row.mood,
    aiFeedback: row.ai_feedback,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
