/**
 * @file Onboarding steps barrel export
 *
 * Note: Steps are kept in the original location and re-exported here
 * to allow gradual migration. The new structure imports from here.
 */

// New location steps
export { WelcomeStep } from './WelcomeStep';

// Legacy location re-exports (for gradual migration)
// These can be gradually moved to this folder
export { AssessmentModeStep } from '@/app/(pages)/onboarding/steps/AssessmentModeStep';
export { AssessmentStep } from '@/app/(pages)/onboarding/steps/AssessmentStep';
export { DeepAssessmentStep } from '@/app/(pages)/onboarding/steps/DeepAssessmentStep';
export { GoalSetupStep } from '@/app/(pages)/onboarding/steps/GoalSetupStep';
export { IntegrationsStep } from '@/app/(pages)/onboarding/steps/IntegrationsStep';
export { PreferencesStep } from '@/app/(pages)/onboarding/steps/PreferencesStep';
export { PlanGenerationStep } from '@/app/(pages)/onboarding/steps/PlanGenerationStep';
