/**
 * @file Onboarding steps configuration
 */

import type { OnboardingStepConfig } from '../types';

export const ONBOARDING_STEPS: OnboardingStepConfig[] = [
  {
    id: 0,
    label: 'Choose Your Goal',
    shortLabel: 'Goal',
  },
  {
    id: 1,
    label: 'Select Assessment Mode',
    shortLabel: 'Mode',
  },
  {
    id: 2,
    label: 'Complete Assessment',
    shortLabel: 'Assessment',
  },
  {
    id: 3,
    label: 'Upload Body Photos',
    shortLabel: 'Photos',
  },
  {
    id: 4,
    label: 'Set Your Goals',
    shortLabel: 'My Plan',
  },
  {
    id: 5,
    label: 'Life Goals',
    shortLabel: 'Life Coach',
  },
  {
    id: 6,
    label: 'Set Preferences',
    shortLabel: 'Preferences',
  },
  {
    id: 7,
    label: 'Generate Plan',
    shortLabel: 'Plan',
  },
];

export const TOTAL_STEPS = ONBOARDING_STEPS.length;
