/**
 * @file Deep Assessment Types
 * @description Type definitions for the deep assessment chat component
 */

import type { ReactNode } from 'react';
import type { AICoachGoalCategory, ConversationPhase, ExtractedInsight as APIExtractedInsight } from '@/src/shared/services';

// Web Speech API types
export interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

export interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

export interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

export interface CustomSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((this: CustomSpeechRecognition, event: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: CustomSpeechRecognition, event: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: CustomSpeechRecognition) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export interface SpeechRecognitionConstructor {
  new (): CustomSpeechRecognition;
}

// Assessment mode types
export type AssessmentInteractionMode = 'qa' | 'mcq';

// MCQ Question types
export interface MCQOption {
  id: string;
  text: string;
  description?: string;
  insightValue?: string;
}

export interface MCQQuestion {
  id: string;
  question: string;
  options: MCQOption[];
  category: 'lifestyle' | 'fitness' | 'nutrition' | 'sleep' | 'stress' | 'goals';
  allowMultiple?: boolean;
}

// Image analysis feedback
export interface ImageFeedback {
  category: 'body' | 'food' | 'progress' | 'medical';
  currentState: string;
  improvements: string[];
  actionItems: string[];
  encouragement: string;
}

// Goal-based improvement feedback
export interface ImprovementFeedback {
  goalArea: string;
  currentLevel: 'beginner' | 'intermediate' | 'advanced';
  strengths: string[];
  areasToImprove: string[];
  quickWins: string[];
  longTermGoals: string[];
  weeklyFocus: string;
}

// Chat types
export interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: Date;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'error';
  imageUrl?: string;
  imageName?: string;
  mcqQuestion?: MCQQuestion;
  selectedOptions?: string[];
  imageFeedback?: ImageFeedback;
}

export interface DisplayInsight {
  id: string;
  category: 'motivation' | 'barrier' | 'preference' | 'lifestyle' | 'goal' | 'health_status';
  text: string;
  confidence: number;
  icon: ReactNode;
}

// Re-export for convenience
export type { AICoachGoalCategory, ConversationPhase, APIExtractedInsight };
export type ExtractedInsight = APIExtractedInsight;
