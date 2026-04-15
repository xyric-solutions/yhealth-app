/**
 * @file Onboarding feature types
 */

import type {
  GoalCategory,
  AssessmentMode,
  AssessmentResponse,
  BodyStats,
  Goal,
  Integration,
  Preferences,
} from '@/src/types';

// Re-export domain types for convenience
export type {
  GoalCategory,
  AssessmentMode,
  AssessmentResponse,
  BodyStats,
  Goal,
  Integration,
  Preferences,
};

/**
 * Body image types for upload
 */
export type BodyImageType = 'face' | 'front' | 'side' | 'back';

/**
 * Individual body image upload state
 */
export interface BodyImage {
  type: BodyImageType;
  file: File | null;
  previewUrl: string | null;
  uploadKey: string | null;
  uploadStatus: 'idle' | 'uploading' | 'completed' | 'failed';
  analysisStatus?: 'pending' | 'processing' | 'completed' | 'failed';
}

/**
 * Body images collection state
 */
export interface BodyImagesState {
  face: BodyImage;
  front: BodyImage;
  side: BodyImage;
  back: BodyImage;
  privacyConsent: boolean;
  skipped: boolean;
}

/**
 * Diet preference types
 */
export type DietType =
  | 'standard'
  | 'vegetarian'
  | 'vegan'
  | 'keto'
  | 'low_carb'
  | 'mediterranean'
  | 'paleo'
  | 'halal'
  | 'kosher';

/**
 * Food allergy types
 */
export type FoodAllergy =
  | 'nuts'
  | 'dairy'
  | 'gluten'
  | 'shellfish'
  | 'eggs'
  | 'soy'
  | 'fish'
  | 'wheat';

/**
 * Diet preferences state
 */
export interface DietPreferences {
  dietType: DietType;
  allergies: FoodAllergy[];
  excludedFoods: string[];
  mealsPerDay: number;
  mealTimes: {
    breakfast?: string;
    lunch?: string;
    dinner?: string;
    snack1?: string;
    snack2?: string;
  };
}

/**
 * Onboarding step configuration
 */
export interface OnboardingStepConfig {
  id: number;
  label: string;
  shortLabel: string;
}

/**
 * Onboarding state
 */
export interface OnboardingState {
  // Current step (0-indexed)
  currentStep: number;
  totalSteps: number;

  // Step 0: Goal Selection
  selectedGoal: GoalCategory | null;
  customGoalText: string;

  // Step 1: Assessment Mode
  assessmentMode: AssessmentMode | null;

  // Step 2: Assessment
  assessmentResponses: AssessmentResponse[];
  bodyStats: BodyStats;
  assessmentComplete: boolean;

  // Step 3: Body Images (NEW)
  bodyImages: BodyImagesState;

  // Step 4: Goals
  suggestedGoals: Goal[];
  confirmedGoals: Goal[];
  planDurationWeeks: number; // 1-12 weeks

  // Step 5: Integrations
  availableIntegrations: Integration[];
  connectedIntegrations: string[];

  // Step 6: Preferences
  preferences: Preferences;
  dietPreferences: DietPreferences;

  // Step 7: Plan
  generatedPlan: unknown;
  planAccepted: boolean;
}

/**
 * Onboarding context actions
 */
export interface OnboardingActions {
  // Navigation
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  getStepProgress: () => number;

  // Step 0: Goal
  setSelectedGoal: (goal: GoalCategory) => void;
  setCustomGoalText: (text: string) => void;

  // Step 1: Assessment Mode
  setAssessmentMode: (mode: AssessmentMode) => void;

  // Step 2: Assessment
  addAssessmentResponse: (response: AssessmentResponse) => void;
  setBodyStats: (stats: Partial<BodyStats>) => void;
  completeAssessment: () => void;

  // Step 3: Body Images
  updateBodyImage: (type: BodyImageType, image: Partial<BodyImage>) => void;
  setBodyImagesConsent: (consent: boolean) => void;
  skipBodyImages: () => void;

  // Step 4: Goals
  setSuggestedGoals: (goals: Goal[]) => void;
  confirmGoal: (goal: Goal) => void;
  removeGoal: (goalId: string) => void;
  updateGoalConfidence: (goalId: string, confidence: number) => void;
  setPlanDuration: (weeks: number) => void;

  // Step 5: Integrations
  setAvailableIntegrations: (integrations: Integration[]) => void;
  toggleIntegration: (integrationId: string) => void;

  // Step 6: Preferences
  updatePreferences: (prefs: Partial<Preferences>) => void;
  updateDietPreferences: (prefs: Partial<DietPreferences>) => void;

  // Step 7: Plan
  setGeneratedPlan: (plan: unknown) => void;
  acceptPlan: () => void;

  // Reset
  resetOnboarding: () => void;
}

/**
 * Combined context value
 */
export interface OnboardingContextValue extends OnboardingState, OnboardingActions {}
