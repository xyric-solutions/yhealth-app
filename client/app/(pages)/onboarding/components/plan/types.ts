/**
 * Plan Generation Component Types
 */

import type { Goal } from '@/src/types';
import type { PlanSource } from '../../hooks/usePlanGeneration';

export interface GenerationPhase {
  id: string;
  label: string;
  icon: React.ReactNode;
  duration: number;
}

export interface PlanActivity {
  id: string;
  type: string;
  title: string;
  description: string;
  days: string[];
  time: string;
  icon: React.ReactNode;
}

export interface WeeklyFocus {
  week: number;
  theme: string;
  focus: string;
}

export interface PlanMilestone {
  day: number;
  title: string;
  description: string;
}

export interface GeneratedPlan {
  name: string;
  description: string;
  activities: PlanActivity[];
  weeklyFocuses: WeeklyFocus[];
  milestones: PlanMilestone[];
}

export interface GeneratingViewProps {
  phases: GenerationPhase[];
  currentPhaseIndex: number;
}

export interface PlanReadyViewProps {
  plan: GeneratedPlan;
  goals: Goal[];
  coachMessage: string;
  onStartPlan: () => void;
  isStarting: boolean;
  error: string | null;
  /** Source of the plan: 'ai' (OpenAI generated), 'fallback' (basic API), or 'mock' (default template) */
  planSource?: PlanSource;
}

export interface ActivityCardProps {
  activity: PlanActivity;
  index: number;
}

export interface PrimaryGoalCardProps {
  goal: Goal | undefined;
}

export interface MilestoneCardProps {
  milestone: PlanMilestone;
}

export interface StartPlanButtonProps {
  onClick: () => void;
  isStarting: boolean;
}
