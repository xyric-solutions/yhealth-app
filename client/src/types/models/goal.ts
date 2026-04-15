/**
 * @file Goal domain models
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
  | 'nutrition'
  | 'fitness'
  | 'custom';

export type HealthPillar = 'fitness' | 'nutrition' | 'wellbeing';

export type GoalStatus = 'active' | 'completed' | 'paused' | 'cancelled';

export interface GoalTimeline {
  startDate: Date;
  targetDate: Date;
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
  pillar: string;
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
