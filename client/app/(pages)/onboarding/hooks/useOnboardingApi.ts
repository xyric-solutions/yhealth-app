"use client";

import { useState, useCallback } from "react";
import { api, ApiError } from "@/lib/api-client";
import type {
  GoalCategory,
  AssessmentMode,
  AssessmentResponse,
  BodyStats,
  Goal,
  Preferences,
} from "@/src/types";

// API Response Types
interface AssessmentResponseData {
  assessmentId: string;
  goalCategory: GoalCategory;
  nextStep: string;
}

interface QuestionData {
  questionId: string;
  text: string;
  type: string;
  category: string;
  pillar: string;
  orderNum: number;
  isRequired: boolean;
  options?: { value: string; label: string }[];
  sliderConfig?: { min: number; max: number; step: number };
}

interface SuggestedGoalData {
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

interface PlanData {
  id: string;
  name: string;
  description: string;
  activities: unknown[];
  weeklyFocuses: unknown[];
  coachMessage?: string;
}

// Comprehensive onboarding plans data
interface OnboardingPlansData {
  dietPlan: {
    id: string;
    name: string;
    description: string;
    goalCategory: string;
    dailyCalories: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
    fiberGrams: number;
    mealsPerDay: number;
    snacksPerDay: number;
    mealTimes: Record<string, string>;
    weeklyMeals: Record<string, Record<string, string>>;
    tips: string[];
    aiRationale: string;
  };
  workoutPlan: {
    id: string;
    name: string;
    description: string;
    goalCategory: string;
    durationWeeks: number;
    workoutsPerWeek: number;
    workoutLocation: string;
    fitnessLevel: string;
    weeklySchedule: Record<string, unknown>;
    tips: string[];
    aiRationale: string;
  };
  overallAnalysis: {
    healthScore: number;
    riskFactors: string[];
    recommendations: string[];
    motivationalMessage: string;
  };
  provider: string;
}

// Input data for generating onboarding plans
interface OnboardingDataInput {
  selectedGoal: string;
  customGoalText?: string;
  confirmedGoals: Array<{
    id: string;
    category: string;
    pillar: string;
    title: string;
    description: string;
    targetValue?: number;
    targetUnit?: string;
    motivation?: string;
    confidenceLevel?: number;
  }>;
  planDurationWeeks: number;
  bodyStats: Record<string, number>;
  assessmentResponses: Array<{
    questionId: string;
    questionText: string;
    answer: string | string[] | number;
    category?: string;
  }>;
  bodyImagesAnalysis?: {
    hasImages: boolean;
    imageTypes: string[];
    aiAnalysis?: Record<string, object>;
  };
  preferences: {
    coachingStyle?: string;
    notificationFrequency?: string;
    preferredWorkoutTime?: string;
    preferredCheckInTime?: string;
  };
  dietPreferences: {
    dietType: string;
    allergies: string[];
    excludedFoods: string[];
    mealsPerDay: number;
    mealTimes: Record<string, string>;
  };
  userProfile?: {
    gender?: string;
    dateOfBirth?: string;
    age?: number;
  };
}

export function useOnboardingApi() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear error
  const clearError = useCallback(() => setError(null), []);

  // Step 1: Select Goal
  const selectGoal = useCallback(
    async (category: GoalCategory, customGoalText?: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await api.post<AssessmentResponseData>(
          "/assessment/goal",
          {
            category,
            customGoalText,
          }
        );

        if (response.success && response.data) {
          return response.data;
        }
        throw new Error("Failed to select goal");
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to select goal";
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Step 2: Select Assessment Mode
  const selectMode = useCallback(async (mode: AssessmentMode) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<{ mode: AssessmentMode; assessmentId: string }>(
        "/assessment/mode",
        { mode }
      );

      if (response.success && response.data) {
        return response.data;
      }
      throw new Error("Failed to select mode");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to select mode";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get Assessment Questions
  const getQuestions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<{
        questions: QuestionData[];
        totalQuestions: number;
        estimatedMinutes: number;
        goalCategory: GoalCategory;
      }>("/assessment/questions");

      if (response.success && response.data) {
        return response.data;
      }
      throw new Error("Failed to get questions");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to get questions";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Submit Quick Assessment
  const submitQuickAssessment = useCallback(
    async (responses: AssessmentResponse[], bodyStats?: BodyStats) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await api.post<{
          assessmentId: string;
          completedAt: string;
          nextStep: string;
        }>("/assessment/quick/submit", {
          responses,
          bodyStats,
        });

        if (response.success && response.data) {
          return response.data;
        }
        throw new Error("Failed to submit assessment");
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to submit assessment";
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Get Suggested Goals
  const getSuggestedGoals = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<{
        goals: SuggestedGoalData[];
        assessmentId: string;
      }>("/assessment/goals/suggested");

      if (response.success && response.data) {
        return response.data;
      }
      throw new Error("Failed to get suggested goals");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to get suggested goals";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Accept Suggested Goals
  const acceptSuggestedGoals = useCallback(async (goals: Goal[]) => {
    setIsLoading(true);
    setError(null);

    try {
      const formattedGoals = goals.map((g) => {
        // Handle both Date objects and ISO strings for startDate/targetDate
        const startDate = g.timeline.startDate instanceof Date
          ? g.timeline.startDate.toISOString()
          : g.timeline.startDate;
        const targetDate = g.timeline.targetDate instanceof Date
          ? g.timeline.targetDate.toISOString()
          : g.timeline.targetDate;

        return {
          category: g.category,
          pillar: g.pillar,
          isPrimary: g.isPrimary,
          title: g.title,
          description: g.description,
          targetValue: g.targetValue,
          targetUnit: g.targetUnit,
          timeline: {
            startDate,
            targetDate,
            durationWeeks: g.timeline.durationWeeks,
          },
          motivation: g.motivation,
          // Ensure confidenceLevel is always set (default to 7 if not provided)
          confidenceLevel: g.confidenceLevel ?? 7,
        };
      });

      const response = await api.post<{
        goals: unknown[];
        nextStep: string;
      }>("/assessment/goals/accept-suggested", { goals: formattedGoals });

      if (response.success && response.data) {
        return response.data;
      }
      throw new Error("Failed to accept goals");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to accept goals";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get Available Integrations
  const getIntegrations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<{
        integrations: {
          id: string;
          name: string;
          type: string;
          connected: boolean;
          dataTypes: string[];
        }[];
      }>("/integrations");

      if (response.success && response.data) {
        return response.data;
      }
      throw new Error("Failed to get integrations");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to get integrations";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Connect Integration
  const connectIntegration = useCallback(async (integrationId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<{
        authUrl?: string;
        connected: boolean;
      }>(`/integrations/${integrationId}/connect`, {});

      if (response.success && response.data) {
        return response.data;
      }
      throw new Error("Failed to connect integration");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to connect integration";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Complete Integrations Step
  const completeIntegrationsStep = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<{ nextStep: string }>(
        "/integrations/complete",
        {}
      );

      if (response.success && response.data) {
        return response.data;
      }
      throw new Error("Failed to complete integrations step");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to complete integrations step";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get Coaching Styles
  const getCoachingStyles = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get<{
        styles: { id: string; name: string; description: string; icon: string }[];
        intensities: {
          id: string;
          name: string;
          description: string;
          checkInsPerWeek: number;
        }[];
        channels: { id: string; name: string; icon: string }[];
      }>("/preferences/coaching/styles");

      if (response.success && response.data) {
        return response.data;
      }
      throw new Error("Failed to get coaching styles");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to get coaching styles";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update Preferences
  const updatePreferences = useCallback(async (preferences: Partial<Preferences>) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.patch<{ preferences: unknown }>(
        "/preferences",
        {
          coaching: {
            style: preferences.coachingStyle,
            intensity: preferences.coachingIntensity,
            preferredChannel: preferences.preferredChannel,
            checkInFrequency: preferences.checkInFrequency,
            preferredCheckInTime: preferences.preferredCheckInTime,
            timezone: preferences.timezone,
            aiPersonality: preferences.aiPersonality,
          },
          notifications: {
            quietHours: preferences.quietHours,
          },
        }
      );

      if (response.success && response.data) {
        return response.data;
      }
      throw new Error("Failed to update preferences");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to update preferences";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Complete Preferences Step
  const completePreferencesStep = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<{ nextStep: string }>(
        "/preferences/complete",
        {}
      );

      if (response.success && response.data) {
        return response.data;
      }
      throw new Error("Failed to complete preferences step");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to complete preferences step";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Generate Plan
  const generatePlan = useCallback(async (goalId?: string, regenerate: boolean = true) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<{ plan: PlanData; message: string }>(
        "/plans/generate",
        { goalId, regenerate }
      );

      if (response.success && response.data) {
        return response.data;
      }
      throw new Error("Failed to generate plan");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to generate plan";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Complete Onboarding
  const completeOnboarding = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<{ message: string; planId: string }>(
        "/plans/complete-onboarding",
        {}
      );

      if (response.success && response.data) {
        return response.data;
      }
      throw new Error("Failed to complete onboarding");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to complete onboarding";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Generate comprehensive AI plans from onboarding data
   * Analyzes goals, MCQs, body stats, images, and preferences
   * Returns personalized diet plan AND workout plan
   */
  const generateOnboardingPlans = useCallback(async (onboardingData?: OnboardingDataInput) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<OnboardingPlansData>(
        "/plans/generate-onboarding-plans",
        { onboardingData }
      );

      if (response.success && response.data) {
        return response.data;
      }
      throw new Error("Failed to generate personalized plans");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Failed to generate personalized plans";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Upload body image during onboarding
   */
  const uploadBodyImage = useCallback(async (
    file: File,
    imageType: 'face' | 'front' | 'side' | 'back',
    captureContext: string = 'onboarding'
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('imageType', imageType);
      formData.append('captureContext', captureContext);

      const response = await api.post<{
        id: string;
        imageType: string;
        imageKey: string;
        imageUrl: string;
        captureContext: string;
        analysisStatus: string;
        createdAt: Date;
      }>(
        "/onboarding/body-images/upload",
        formData
      );

      if (response.success && response.data) {
        return response.data;
      }
      throw new Error("Failed to upload body image");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to upload body image";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Analyze body image with AI
   */
  const analyzeBodyImage = useCallback(async (imageId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<{
        imageId: string;
        imageType: string;
        analysis: unknown;
        status: string;
      }>(
        `/onboarding/body-images/${imageId}/analyze`,
        {}
      );

      if (response.success && response.data) {
        return response.data;
      }
      throw new Error("Failed to analyze body image");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to analyze body image";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Batch analyze all pending body images
   */
  const analyzeAllBodyImages = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<{
        analyzed: number;
        failed: number;
        total: number;
        results: Array<{ imageId: string; status: string }>;
      }>(
        "/onboarding/body-images/analyze-all",
        {}
      );

      if (response.success && response.data) {
        return response.data;
      }
      throw new Error("Failed to analyze body images");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to analyze body images";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    clearError,
    // Goal
    selectGoal,
    // Assessment
    selectMode,
    getQuestions,
    submitQuickAssessment,
    // Goals
    getSuggestedGoals,
    acceptSuggestedGoals,
    // Integrations
    getIntegrations,
    connectIntegration,
    completeIntegrationsStep,
    // Preferences
    getCoachingStyles,
    updatePreferences,
    completePreferencesStep,
    // Plan
    generatePlan,
    generateOnboardingPlans,
    completeOnboarding,
    // Body Images
    uploadBodyImage,
    analyzeBodyImage,
    analyzeAllBodyImages,
  };
}
