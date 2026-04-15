/**
 * @file Goals API Service
 * @description Centralized API calls for goals-related operations
 */

import { api } from '@/lib/api-client';
import type { Goal, SuggestedGoal, GoalCategory, HealthPillar } from '@/src/types';

// Response Types
export interface SuggestedGoalsResponse {
  goals: SuggestedGoal[];
  assessmentId: string;
}

export interface AcceptGoalsResponse {
  goals: Goal[];
  nextStep: string;
}

// Request Types
export interface AcceptGoalsRequest {
  goals: Array<{
    category: GoalCategory;
    pillar: HealthPillar | string;
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
    confidenceLevel: number;
  }>;
}

/**
 * Goals Service - handles all goals API operations
 */
export const goalsService = {
  /**
   * Get AI-suggested goals based on assessment
   */
  getSuggestedGoals: () =>
    api.get<SuggestedGoalsResponse>('/assessment/goals/suggested'),

  /**
   * Accept suggested goals and proceed
   */
  acceptSuggestedGoals: (goals: Goal[]) => {
    const formattedGoals = goals.map((g) => ({
      category: g.category,
      pillar: g.pillar,
      isPrimary: g.isPrimary,
      title: g.title,
      description: g.description,
      targetValue: g.targetValue,
      targetUnit: g.targetUnit,
      timeline: {
        startDate: g.timeline.startDate.toISOString(),
        targetDate: g.timeline.targetDate.toISOString(),
        durationWeeks: g.timeline.durationWeeks,
      },
      motivation: g.motivation,
      confidenceLevel: g.confidenceLevel ?? 7,
    }));

    return api.post<AcceptGoalsResponse>('/assessment/goals/accept-suggested', {
      goals: formattedGoals,
    });
  },

  /**
   * Get all user goals
   */
  getUserGoals: () => api.get<{ goals: Goal[] }>('/goals'),

  /**
   * Update a specific goal
   */
  updateGoal: (goalId: string, updates: Partial<Goal>) =>
    api.patch<{ goal: Goal }>(`/goals/${goalId}`, updates),

  /**
   * Delete a goal
   */
  deleteGoal: (goalId: string) => api.delete<void>(`/goals/${goalId}`),
};
