/**
 * Plan Generation Components
 *
 * Extracted components for the PlanGenerationStep onboarding flow.
 */

// Components
export { GeneratingView } from './GeneratingView';
export { PlanReadyView } from './PlanReadyView';
export { ActivityCard } from './ActivityCard';
export { PrimaryGoalCard } from './PrimaryGoalCard';
export { MilestoneCard } from './MilestoneCard';
export { StartPlanButton } from './StartPlanButton';

// Constants
export { GENERATION_PHASES, MOCK_PLAN, COACH_MESSAGES } from './constants';

// Types
export type {
  GenerationPhase,
  PlanActivity,
  WeeklyFocus,
  PlanMilestone,
  GeneratedPlan,
  GeneratingViewProps,
  PlanReadyViewProps,
  ActivityCardProps,
  PrimaryGoalCardProps,
  MilestoneCardProps,
  StartPlanButtonProps,
} from './types';
