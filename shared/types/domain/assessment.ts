/**
 * @file Assessment domain types
 * @description Single source of truth for assessment-related types
 */

export type AssessmentType = 'quick' | 'deep';

export type QuestionType =
  | 'single_select'
  | 'multi_select'
  | 'slider'
  | 'emoji_scale'
  | 'number_input'
  | 'date_picker'
  | 'text_input';

export interface AssessmentQuestion {
  id: string;
  text: string;
  type: QuestionType;
  options?: AssessmentOption[];
  min?: number;
  max?: number;
  required?: boolean;
}

export interface AssessmentOption {
  value: string;
  label: string;
  icon?: string;
}

export interface AssessmentResponse {
  questionId: string;
  value: string | number | string[];
  answeredAt: string;
}

export interface AssessmentResult {
  id: string;
  userId: string;
  type: AssessmentType;
  responses: AssessmentResponse[];
  insights?: AssessmentInsight[];
  completedAt: string;
}

export interface AssessmentInsight {
  category: string;
  summary: string;
  recommendations: string[];
  confidenceScore: number;
}
