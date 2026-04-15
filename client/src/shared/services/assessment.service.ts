/**
 * @file Assessment API Service
 * @description Centralized API calls for assessment-related operations
 */

import { api } from '@/lib/api-client';
import type {
  GoalCategory,
  AssessmentMode,
  AssessmentResponse,
  BodyStats,
  AssessmentQuestion,
} from '@/src/types';

// Response Types
export interface AssessmentStartResponse {
  assessmentId: string;
  goalCategory: GoalCategory;
  nextStep: string;
}

export interface AssessmentQuestionsResponse {
  questions: AssessmentQuestion[];
  totalQuestions: number;
  estimatedMinutes: number;
  goalCategory: GoalCategory;
}

export interface AssessmentSubmitResponse {
  assessmentId: string;
  completedAt: string;
  nextStep: string;
}

/**
 * Assessment Service - handles all assessment API operations
 */
export const assessmentService = {
  /**
   * Select a goal category to start the assessment
   */
  selectGoal: (category: GoalCategory, customGoalText?: string) =>
    api.post<AssessmentStartResponse>('/assessment/goal', {
      category,
      customGoalText,
    }),

  /**
   * Select assessment mode (quick or deep)
   */
  selectMode: (mode: AssessmentMode) =>
    api.post<{ mode: AssessmentMode; assessmentId: string }>(
      '/assessment/mode',
      { mode }
    ),

  /**
   * Get assessment questions based on selected goal and mode
   */
  getQuestions: () =>
    api.get<AssessmentQuestionsResponse>('/assessment/questions'),

  /**
   * Submit quick assessment responses
   */
  submitQuickAssessment: (
    responses: AssessmentResponse[],
    bodyStats?: BodyStats
  ) =>
    api.post<AssessmentSubmitResponse>('/assessment/quick/submit', {
      responses,
      bodyStats,
    }),

  /**
   * Submit deep assessment responses
   */
  submitDeepAssessment: (
    responses: AssessmentResponse[],
    bodyStats?: BodyStats
  ) =>
    api.post<AssessmentSubmitResponse>('/assessment/deep/submit', {
      responses,
      bodyStats,
    }),
};
