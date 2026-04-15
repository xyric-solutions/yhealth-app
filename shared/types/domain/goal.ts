/**
 * @file Goal domain types
 * @description Single source of truth for goal-related types
 */

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

// Unified GoalStatus - includes all states from both server and client
export type GoalStatus = 'draft' | 'active' | 'paused' | 'completed' | 'abandoned' | 'cancelled';

export interface GoalTimeline {
  startDate: Date | string;
  targetDate: Date | string;
  durationWeeks: number;
}

export interface Goal {
  id?: string;
  category: GoalCategory;
  customGoalText?: string;
  pillar: HealthPillar;
  isPrimary: boolean;
  title: string;
  description: string;
  targetValue: number;
  targetUnit: string;
  currentValue?: number;
  timeline: GoalTimeline;
  motivation: string;
  confidenceLevel?: number;
  aiSuggested?: boolean;
  status?: GoalStatus;
  progress?: number;
}

export interface SuggestedGoal {
  category: GoalCategory;
  pillar: HealthPillar;
  isPrimary: boolean;
  title: string;
  description: string;
  targetValue: number;
  targetUnit: string;
  timeline: {
    startDate: string;
    targetDate: string;
    durationWeeks: number;
  };
  motivation: string;
  confidenceScore?: number;
}
