/**
 * @file Onboarding feature barrel export
 *
 * Usage:
 * import {
 *   OnboardingProvider,
 *   useOnboarding,
 *   useOnboardingApi,
 *   ProgressIndicator,
 *   StepNavigation,
 *   ONBOARDING_STEPS,
 * } from '@/src/features/onboarding';
 */

// Context
export { OnboardingProvider, useOnboarding } from './context/OnboardingContext';

// Hooks
export { useOnboardingApi } from './hooks';

// Components
export { ProgressIndicator, StepNavigation } from './components';

// Steps
export {
  WelcomeStep,
  AssessmentModeStep,
  AssessmentStep,
  DeepAssessmentStep,
  GoalSetupStep,
  IntegrationsStep,
  PreferencesStep,
  PlanGenerationStep,
} from './steps';

// Constants
export { ONBOARDING_STEPS, TOTAL_STEPS } from './constants/steps';

// Types
export type {
  OnboardingState,
  OnboardingActions,
  OnboardingContextValue,
  OnboardingStepConfig,
  GoalCategory,
  AssessmentMode,
  AssessmentResponse,
  BodyStats,
  Goal,
  Integration,
  Preferences,
} from './types';
