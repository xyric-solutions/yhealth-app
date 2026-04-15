'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { DEFAULT_PREFERENCES } from '@/src/types';
import { TOTAL_STEPS } from '../constants/steps';
import type {
  OnboardingState,
  OnboardingContextValue,
  GoalCategory,
  AssessmentMode,
  AssessmentResponse,
  BodyStats,
  Goal,
  Integration,
  Preferences,
  BodyImageType,
  BodyImage,
  BodyImagesState,
  DietPreferences,
} from '../types';

// LocalStorage key for persisting onboarding state
const ONBOARDING_STORAGE_KEY = 'balencia_onboarding_state';

// Default body image state
const createDefaultBodyImage = (type: BodyImageType): BodyImage => ({
  type,
  file: null,
  previewUrl: null,
  uploadKey: null,
  uploadStatus: 'idle',
});

const DEFAULT_BODY_IMAGES: BodyImagesState = {
  face: createDefaultBodyImage('face'),
  front: createDefaultBodyImage('front'),
  side: createDefaultBodyImage('side'),
  back: createDefaultBodyImage('back'),
  privacyConsent: false,
  skipped: false,
};

const DEFAULT_DIET_PREFERENCES: DietPreferences = {
  dietType: 'standard',
  allergies: [],
  excludedFoods: [],
  mealsPerDay: 3,
  mealTimes: {
    breakfast: '08:00',
    lunch: '12:30',
    dinner: '19:00',
  },
};

const initialState: OnboardingState = {
  currentStep: 0,
  totalSteps: TOTAL_STEPS,
  selectedGoal: null,
  customGoalText: '',
  assessmentMode: null,
  assessmentResponses: [],
  bodyStats: {},
  assessmentComplete: false,
  bodyImages: DEFAULT_BODY_IMAGES,
  suggestedGoals: [],
  confirmedGoals: [],
  planDurationWeeks: 4,
  availableIntegrations: [],
  connectedIntegrations: [],
  preferences: DEFAULT_PREFERENCES,
  dietPreferences: DEFAULT_DIET_PREFERENCES,
  generatedPlan: null,
  planAccepted: false,
};

// Helper to serialize state for localStorage (handles Date objects)
function serializeState(state: OnboardingState): string {
  return JSON.stringify(state, (_key, value) => {
    if (value instanceof Date) {
      return { __type: 'Date', value: value.toISOString() };
    }
    return value;
  });
}

// Helper to deserialize state from localStorage (restores Date objects)
function deserializeState(json: string): OnboardingState | null {
  try {
    const parsed = JSON.parse(json, (_key, value) => {
      if (value && typeof value === 'object' && value.__type === 'Date') {
        return new Date(value.value);
      }
      return value;
    });
    // Validate that it has the expected structure
    if (typeof parsed.currentStep === 'number' && typeof parsed.totalSteps === 'number') {
      return parsed as OnboardingState;
    }
    return null;
  } catch {
    return null;
  }
}

// Fix goals with missing IDs from stale localStorage.
// Assigns stable IDs to suggestedGoals, then matches confirmedGoals by title.
function fixGoalIds(suggested: Goal[], confirmed: Goal[]): { suggestedGoals: Goal[]; confirmedGoals: Goal[] } {
  if (!Array.isArray(suggested)) suggested = [];
  if (!Array.isArray(confirmed)) confirmed = [];

  const hasMissingIds = [...suggested, ...confirmed].some((g) => !g.id);
  if (!hasMissingIds) return { suggestedGoals: suggested, confirmedGoals: confirmed };

  // Assign IDs to suggested goals
  const fixedSuggested = suggested.map((g) => (g.id ? g : { ...g, id: crypto.randomUUID() }));

  // Match confirmed goals to suggested goals by title so IDs stay consistent
  const titleToId = new Map(fixedSuggested.map((g) => [g.title, g.id]));
  const fixedConfirmed = confirmed.map((g) => {
    if (g.id) return g;
    const matchedId = titleToId.get(g.title);
    return { ...g, id: matchedId || crypto.randomUUID() };
  });

  return { suggestedGoals: fixedSuggested, confirmedGoals: fixedConfirmed };
}

// Load state from localStorage
function loadPersistedState(): OnboardingState {
  if (typeof window === 'undefined') return initialState;

  try {
    const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (stored) {
      const parsed = deserializeState(stored);
      if (parsed) {
        // Fix goals with missing IDs before merging
        const { suggestedGoals, confirmedGoals } = fixGoalIds(
          parsed.suggestedGoals || [],
          parsed.confirmedGoals || [],
        );

        // Merge with defaults in case new fields were added
        // Always use current TOTAL_STEPS to handle step configuration changes
        const mergedState = {
          ...initialState,
          ...parsed,
          totalSteps: TOTAL_STEPS, // Always sync with current step count
          preferences: { ...DEFAULT_PREFERENCES, ...parsed.preferences },
          dietPreferences: { ...DEFAULT_DIET_PREFERENCES, ...parsed.dietPreferences },
          bodyImages: { ...DEFAULT_BODY_IMAGES, ...parsed.bodyImages },
          suggestedGoals,
          confirmedGoals,
        };
        // Ensure currentStep doesn't exceed new totalSteps
        if (mergedState.currentStep >= TOTAL_STEPS) {
          mergedState.currentStep = TOTAL_STEPS - 1;
        }
        return mergedState;
      }
    }
  } catch (error) {
    console.error('Failed to load onboarding state:', error);
  }
  return initialState;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(
  undefined
);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  // Use lazy initialization to load persisted state on mount
  const [state, setState] = useState<OnboardingState>(() => loadPersistedState());
  const isHydratedRef = useRef(false);

  // Save state to localStorage whenever it changes (skip first render and when plan is accepted)
  useEffect(() => {
    if (!isHydratedRef.current) {
      // Skip the first render (initial hydration)
      isHydratedRef.current = true;
      return;
    }
    // Don't save to localStorage if plan is accepted (onboarding complete)
    if (state.planAccepted) {
      return;
    }
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, serializeState(state));
    } catch (error) {
      console.error('Failed to save onboarding state:', error);
    }
  }, [state]);

  // Navigation
  const nextStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.min(prev.currentStep + 1, prev.totalSteps - 1),
    }));
  }, []);

  const prevStep = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.max(prev.currentStep - 1, 0),
    }));
  }, []);

  const goToStep = useCallback((step: number) => {
    setState((prev) => ({
      ...prev,
      currentStep: Math.max(0, Math.min(step, prev.totalSteps - 1)),
    }));
  }, []);

  const getStepProgress = useCallback(() => {
    return ((state.currentStep + 1) / state.totalSteps) * 100;
  }, [state.currentStep, state.totalSteps]);

  // Step 0: Goal
  const setSelectedGoal = useCallback((goal: GoalCategory) => {
    setState((prev) => ({ ...prev, selectedGoal: goal }));
  }, []);

  const setCustomGoalText = useCallback((text: string) => {
    setState((prev) => ({ ...prev, customGoalText: text }));
  }, []);

  // Step 1: Assessment Mode
  const setAssessmentMode = useCallback((mode: AssessmentMode) => {
    setState((prev) => ({ ...prev, assessmentMode: mode }));
  }, []);

  // Step 2: Assessment
  const addAssessmentResponse = useCallback((response: AssessmentResponse) => {
    setState((prev) => {
      const existingIndex = prev.assessmentResponses.findIndex(
        (r) => r.questionId === response.questionId
      );
      if (existingIndex >= 0) {
        const updated = [...prev.assessmentResponses];
        updated[existingIndex] = response;
        return { ...prev, assessmentResponses: updated };
      }
      return {
        ...prev,
        assessmentResponses: [...prev.assessmentResponses, response],
      };
    });
  }, []);

  const setBodyStats = useCallback((stats: Partial<BodyStats>) => {
    setState((prev) => ({
      ...prev,
      bodyStats: { ...prev.bodyStats, ...stats },
    }));
  }, []);

  const completeAssessment = useCallback(() => {
    setState((prev) => ({ ...prev, assessmentComplete: true }));
  }, []);

  // Step 3: Body Images
  const updateBodyImage = useCallback(
    (type: BodyImageType, image: Partial<BodyImage>) => {
      setState((prev) => ({
        ...prev,
        bodyImages: {
          ...prev.bodyImages,
          [type]: { ...prev.bodyImages[type], ...image },
        },
      }));
    },
    []
  );

  const setBodyImagesConsent = useCallback((consent: boolean) => {
    setState((prev) => ({
      ...prev,
      bodyImages: { ...prev.bodyImages, privacyConsent: consent },
    }));
  }, []);

  const skipBodyImages = useCallback(() => {
    setState((prev) => ({
      ...prev,
      bodyImages: { ...prev.bodyImages, skipped: true },
    }));
  }, []);

  // Step 4: Goals
  const setSuggestedGoals = useCallback((goals: Goal[]) => {
    setState((prev) => ({ ...prev, suggestedGoals: goals }));
  }, []);

  const confirmGoal = useCallback((goal: Goal) => {
    if (!goal.id) {
      console.error('Cannot confirm goal without ID:', goal);
      return;
    }
    setState((prev) => {
      const exists = prev.confirmedGoals.some((g) => g.id && goal.id && g.id === goal.id);
      if (exists) return prev;
      return { ...prev, confirmedGoals: [...prev.confirmedGoals, goal] };
    });
  }, []);

  const removeGoal = useCallback((goalId: string) => {
    if (!goalId) {
      console.error('Cannot remove goal without ID');
      return;
    }
    setState((prev) => ({
      ...prev,
      confirmedGoals: prev.confirmedGoals.filter((g) => g.id && g.id !== goalId),
    }));
  }, []);

  const updateGoalConfidence = useCallback(
    (goalId: string, confidence: number) => {
      setState((prev) => ({
        ...prev,
        confirmedGoals: prev.confirmedGoals.map((g) =>
          g.id === goalId ? { ...g, confidenceLevel: confidence } : g
        ),
      }));
    },
    []
  );

  const setPlanDuration = useCallback((weeks: number) => {
    setState((prev) => ({
      ...prev,
      planDurationWeeks: Math.max(1, Math.min(12, weeks)),
    }));
  }, []);

  // Step 5: Integrations
  const setAvailableIntegrations = useCallback(
    (integrations: Integration[]) => {
      setState((prev) => ({ ...prev, availableIntegrations: integrations }));
    },
    []
  );

  const toggleIntegration = useCallback((integrationId: string) => {
    setState((prev) => {
      const isConnected = prev.connectedIntegrations.includes(integrationId);
      return {
        ...prev,
        connectedIntegrations: isConnected
          ? prev.connectedIntegrations.filter((id) => id !== integrationId)
          : [...prev.connectedIntegrations, integrationId],
      };
    });
  }, []);

  // Step 6: Preferences
  const updatePreferences = useCallback((prefs: Partial<Preferences>) => {
    setState((prev) => ({
      ...prev,
      preferences: { ...prev.preferences, ...prefs },
    }));
  }, []);

  const updateDietPreferences = useCallback(
    (prefs: Partial<DietPreferences>) => {
      setState((prev) => ({
        ...prev,
        dietPreferences: { ...prev.dietPreferences, ...prefs },
      }));
    },
    []
  );

  // Step 7: Plan
  const setGeneratedPlan = useCallback((plan: unknown) => {
    setState((prev) => ({ ...prev, generatedPlan: plan }));
  }, []);

  const acceptPlan = useCallback(() => {
    setState((prev) => ({ ...prev, planAccepted: true }));
    // Clear localStorage after onboarding completion
    try {
      localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear onboarding state:', error);
    }
  }, []);

  // Reset
  const resetOnboarding = useCallback(() => {
    setState(initialState);
    // Clear persisted state
    try {
      localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear onboarding state:', error);
    }
  }, []);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      ...state,
      nextStep,
      prevStep,
      goToStep,
      getStepProgress,
      setSelectedGoal,
      setCustomGoalText,
      setAssessmentMode,
      addAssessmentResponse,
      setBodyStats,
      completeAssessment,
      updateBodyImage,
      setBodyImagesConsent,
      skipBodyImages,
      setSuggestedGoals,
      confirmGoal,
      removeGoal,
      updateGoalConfidence,
      setPlanDuration,
      setAvailableIntegrations,
      toggleIntegration,
      updatePreferences,
      updateDietPreferences,
      setGeneratedPlan,
      acceptPlan,
      resetOnboarding,
    }),
    [
      state,
      nextStep,
      prevStep,
      goToStep,
      getStepProgress,
      setSelectedGoal,
      setCustomGoalText,
      setAssessmentMode,
      addAssessmentResponse,
      setBodyStats,
      completeAssessment,
      updateBodyImage,
      setBodyImagesConsent,
      skipBodyImages,
      setSuggestedGoals,
      confirmGoal,
      removeGoal,
      updateGoalConfidence,
      setPlanDuration,
      setAvailableIntegrations,
      toggleIntegration,
      updatePreferences,
      updateDietPreferences,
      setGeneratedPlan,
      acceptPlan,
      resetOnboarding,
    ]
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
}
