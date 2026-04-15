'use client';

import { useCallback } from 'react';
import { useAsyncState } from '@/src/shared/hooks';
import {
  assessmentService,
  goalsService,
  integrationsService,
  preferencesService,
  plansService,
} from '@/src/shared/services';
import { ApiError } from '@/lib/api-client';
import type {
  GoalCategory,
  AssessmentMode,
  AssessmentResponse,
  BodyStats,
  Goal,
  Preferences,
} from '@/src/types';

/**
 * Hook for all onboarding API operations
 * Uses centralized services for API calls
 */
export function useOnboardingApi() {
  const { isLoading, error, setError, execute } = useAsyncState();

  const clearError = useCallback(() => setError(null), [setError]);

  // Step 0: Select Goal
  const selectGoal = useCallback(
    async (category: GoalCategory, customGoalText?: string) => {
      return execute(async () => {
        const response = await assessmentService.selectGoal(category, customGoalText);
        if (response.success && response.data) {
          return response.data;
        }
        throw new ApiError('Failed to select goal', 400, 'SELECT_GOAL_ERROR');
      });
    },
    [execute]
  );

  // Step 1: Select Assessment Mode
  const selectMode = useCallback(
    async (mode: AssessmentMode) => {
      return execute(async () => {
        const response = await assessmentService.selectMode(mode);
        if (response.success && response.data) {
          return response.data;
        }
        throw new ApiError('Failed to select mode', 400, 'SELECT_MODE_ERROR');
      });
    },
    [execute]
  );

  // Get Assessment Questions
  const getQuestions = useCallback(async () => {
    return execute(async () => {
      const response = await assessmentService.getQuestions();
      if (response.success && response.data) {
        return response.data;
      }
      throw new ApiError('Failed to get questions', 400, 'GET_QUESTIONS_ERROR');
    });
  }, [execute]);

  // Submit Quick Assessment
  const submitQuickAssessment = useCallback(
    async (responses: AssessmentResponse[], bodyStats?: BodyStats) => {
      return execute(async () => {
        const response = await assessmentService.submitQuickAssessment(
          responses,
          bodyStats
        );
        if (response.success && response.data) {
          return response.data;
        }
        throw new ApiError('Failed to submit assessment', 400, 'SUBMIT_ASSESSMENT_ERROR');
      });
    },
    [execute]
  );

  // Get Suggested Goals
  const getSuggestedGoals = useCallback(async () => {
    return execute(async () => {
      const response = await goalsService.getSuggestedGoals();
      if (response.success && response.data) {
        return response.data;
      }
      throw new ApiError('Failed to get suggested goals', 400, 'GET_GOALS_ERROR');
    });
  }, [execute]);

  // Accept Suggested Goals
  const acceptSuggestedGoals = useCallback(
    async (goals: Goal[]) => {
      return execute(async () => {
        const response = await goalsService.acceptSuggestedGoals(goals);
        if (response.success && response.data) {
          return response.data;
        }
        throw new ApiError('Failed to accept goals', 400, 'ACCEPT_GOALS_ERROR');
      });
    },
    [execute]
  );

  // Get Available Integrations
  const getIntegrations = useCallback(async () => {
    return execute(async () => {
      const response = await integrationsService.getAvailable();
      if (response.success && response.data) {
        return response.data;
      }
      throw new ApiError('Failed to get integrations', 400, 'GET_INTEGRATIONS_ERROR');
    });
  }, [execute]);

  // Connect Integration
  const connectIntegration = useCallback(
    async (integrationId: string) => {
      return execute(async () => {
        const response = await integrationsService.connect(integrationId);
        if (response.success && response.data) {
          return response.data;
        }
        throw new ApiError('Failed to connect integration', 400, 'CONNECT_INTEGRATION_ERROR');
      });
    },
    [execute]
  );

  // Complete Integrations Step
  const completeIntegrationsStep = useCallback(async () => {
    return execute(async () => {
      const response = await integrationsService.completeStep();
      if (response.success && response.data) {
        return response.data;
      }
      throw new ApiError('Failed to complete integrations step', 400, 'COMPLETE_INTEGRATIONS_ERROR');
    });
  }, [execute]);

  // Get Coaching Styles
  const getCoachingStyles = useCallback(async () => {
    return execute(async () => {
      const response = await preferencesService.getCoachingStyles();
      if (response.success && response.data) {
        return response.data;
      }
      throw new ApiError('Failed to get coaching styles', 400, 'GET_STYLES_ERROR');
    });
  }, [execute]);

  // Update Preferences
  const updatePreferences = useCallback(
    async (preferences: Partial<Preferences>) => {
      return execute(async () => {
        const response = await preferencesService.update(preferences);
        if (response.success && response.data) {
          return response.data;
        }
        throw new ApiError('Failed to update preferences', 400, 'UPDATE_PREFERENCES_ERROR');
      });
    },
    [execute]
  );

  // Complete Preferences Step
  const completePreferencesStep = useCallback(async () => {
    return execute(async () => {
      const response = await preferencesService.completeStep();
      if (response.success && response.data) {
        return response.data;
      }
      throw new ApiError('Failed to complete preferences step', 400, 'COMPLETE_PREFERENCES_ERROR');
    });
  }, [execute]);

  // Generate Plan
  const generatePlan = useCallback(
    async (goalId?: string, regenerate: boolean = true) => {
      return execute(async () => {
        const response = await plansService.generate(goalId, regenerate);
        if (response.success && response.data) {
          return response.data;
        }
        throw new ApiError('Failed to generate plan', 400, 'GENERATE_PLAN_ERROR');
      });
    },
    [execute]
  );

  // Complete Onboarding
  const completeOnboarding = useCallback(async () => {
    return execute(async () => {
      const response = await plansService.completeOnboarding();
      if (response.success && response.data) {
        return response.data;
      }
      throw new ApiError('Failed to complete onboarding', 400, 'COMPLETE_ONBOARDING_ERROR');
    });
  }, [execute]);

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
    completeOnboarding,
  };
}
