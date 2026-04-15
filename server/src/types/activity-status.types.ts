// Activity Status Types

export type ActivityStatus = 'working' | 'sick' | 'injury' | 'rest' | 'vacation' | 'travel' | 'stress' | 'excellent' | 'good' | 'fair' | 'poor';

export interface ActivityStatusHistory {
  id: string;
  user_id: string;
  status_date: Date;
  activity_status: ActivityStatus;
  mood?: number;
  notes?: string;
  source: string;
  created_at: Date;
  updated_at: Date;
}

export interface ActivityStatusConfig {
  status: ActivityStatus;
  color: string;
  icon: string;
  mood: number; // Default mood for this status
  description: string;
}

export interface CurrentStatusResponse {
  status: ActivityStatus;
  updatedAt?: Date;
}

export interface SetStatusRequest {
  date: string; // ISO date string
  status: ActivityStatus;
  mood?: number;
  notes?: string;
}

export interface CalendarDayStatus {
  date: string; // ISO date string
  status?: ActivityStatus;
  mood?: number;
  notes?: string;
}

export interface CalendarMonthResponse {
  year: number;
  month: number;
  days: CalendarDayStatus[];
}

export interface StatusHistoryResponse {
  statuses: ActivityStatusHistory[];
  total: number;
}

export interface StatusStats {
  totalDays: number;
  statusDistribution: Record<ActivityStatus, number>;
  averageMood?: number;
  mostCommonStatus: ActivityStatus;
  streakDays: number;
}

// ─── Status Intent Classification ───────────────────────────────────────────

export interface StatusDetection {
  detected: boolean;
  status?: ActivityStatus;
  confidence: number;
  duration?: {
    days?: number;
    endDate?: string;
  };
  reason?: string;
  layer: 'explicit' | 'inferred';
}

// ─── Plan Status Overrides ──────────────────────────────────────────────────

export type WorkoutOverride = 'skip_all' | 'skip_affected' | 'suggest_alternatives' | 'optional_only' | 'none';
export type NutritionOverride = 'comfort_foods' | 'flexible' | 'anti_inflammatory' | 'none';
export type GoalOverride = 'pause_fitness' | 'extend_deadlines' | 'reduce_intensity' | 'none';

export interface PlanStatusOverride {
  status: ActivityStatus;
  appliedAt: string;
  expiresAt?: string;
  workoutOverride: WorkoutOverride;
  nutritionOverride: NutritionOverride;
  goalOverride: GoalOverride;
  adjustmentDetails?: string;
  userConfirmed: boolean;
  alternativeWorkouts?: AlternativeWorkout[];
  mealSuggestions?: MealSuggestion[];
  recoveryPlan?: RecoveryPlan[];
}

// ─── Status Patterns ────────────────────────────────────────────────────────

export type StatusPatternType = 'day_of_week' | 'post_event' | 'streak_disruption';

export interface StatusPattern {
  type: StatusPatternType;
  pattern: string;
  confidence: number;
  frequency: number;
  firstObserved: string;
  lastConfirmed: string;
  suggestion: string;
}

// ─── Alternative Plan Content ──────────────────────────────────────────────

export interface AlternativeWorkout {
  name: string;
  duration: number;
  intensity: 'very_low' | 'low' | 'moderate';
  exercises: Array<{
    name: string;
    sets?: number;
    reps?: string;
    duration?: string;
    notes?: string;
  }>;
  equipmentNeeded: string[];
  suitableFor: ActivityStatus[];
}

export interface MealSuggestion {
  name: string;
  category: 'comfort' | 'anti_inflammatory' | 'light' | 'hydrating' | 'energy';
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  description: string;
  approximateCalories: number;
  benefits: string[];
}

export interface RecoveryPlan {
  day: number;
  intensityPercent: number;
  workoutModification: string;
  nutritionNote: string;
  wellbeingTip: string;
}

// ─── Activity Status Context (for ComprehensiveUserContext) ─────────────────

export interface ActivityStatusContext {
  current: ActivityStatus;
  since: string;
  source: string;
  expectedEndDate?: string;
  recentHistory: Array<{
    date: string;
    status: ActivityStatus;
    mood?: number;
  }>;
  patterns: StatusPattern[];
  activeOverrides: boolean;
  daysSinceLastWorkingStatus: number;
}

