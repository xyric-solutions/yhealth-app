/**
 * @file Assessment domain models
 */

export type AssessmentMode = 'quick' | 'deep';

export type QuestionType =
  | 'single_choice'
  | 'multiple_choice'
  | 'slider'
  | 'text'
  | 'number'
  | 'date';

export interface BodyStats {
  heightCm?: number;
  weightKg?: number;
  targetWeightKg?: number;
  bodyFatPercentage?: number;
  age?: number;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
}

export interface AssessmentResponse {
  questionId: string;
  value: string | number | string[];
  /** Question text for AI context - stored during assessment */
  questionText?: string;
  /** Question category (e.g., 'lifestyle', 'nutrition', 'fitness') */
  category?: string;
  /** Health pillar (e.g., 'fitness', 'nutrition', 'wellbeing') */
  pillar?: string;
}

export interface AssessmentQuestion {
  questionId: string;
  text: string;
  type: QuestionType;
  category: string;
  pillar: string;
  orderNum: number;
  isRequired: boolean;
  options?: { value: string; label: string }[];
  sliderConfig?: { min: number; max: number; step: number };
}

export interface AssessmentResult {
  assessmentId: string;
  completedAt: string;
  mode: AssessmentMode;
  responses: AssessmentResponse[];
  bodyStats?: BodyStats;
}
