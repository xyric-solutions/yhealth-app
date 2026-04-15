/**
 * @file Wellbeing Domain Types
 * @description Type definitions for Epic 07: Wellbeing Pillar
 */

// ============================================
// MOOD TYPES
// ============================================

export type MoodEmoji = '😊' | '😐' | '😟' | '😡' | '😰' | '😴';

export type EmotionTag =
  | 'grateful'
  | 'frustrated'
  | 'excited'
  | 'anxious'
  | 'content'
  | 'overwhelmed'
  | 'peaceful'
  | 'irritated'
  | 'hopeful'
  | 'lonely'
  | 'confident'
  | 'sad'
  | 'energized'
  | 'calm'
  | 'worried';

export type WellbeingMode = 'light' | 'deep';

export interface MoodLog {
  id: string;
  userId: string;
  moodEmoji?: MoodEmoji;
  descriptor?: string;
  happinessRating?: number; // 1-10
  energyRating?: number; // 1-10
  stressRating?: number; // 1-10
  anxietyRating?: number; // 1-10
  emotionTags: EmotionTag[];
  contextNote?: string;
  mode: WellbeingMode;
  loggedAt: string; // ISO timestamp
  createdAt: string;
  updatedAt: string;
}

// ============================================
// JOURNAL TYPES
// ============================================

export type JournalPromptCategory =
  | 'gratitude'
  | 'reflection'
  | 'emotional_processing'
  | 'stress_management'
  | 'self_compassion'
  | 'future_focus';

export interface JournalEntry {
  id: string;
  userId: string;
  prompt: string;
  promptCategory?: JournalPromptCategory;
  promptId?: string;
  entryText: string;
  wordCount: number;
  mode: WellbeingMode;
  voiceEntry: boolean;
  durationSeconds?: number;
  sentimentScore?: number; // -1.0 to 1.0
  sentimentLabel?: 'positive' | 'negative' | 'neutral';
  streakDay?: number;
  loggedAt: string; // ISO timestamp
  createdAt: string;
  updatedAt: string;
}

// ============================================
// HABIT TYPES
// ============================================

export type HabitTrackingType = 'checkbox' | 'counter' | 'duration' | 'rating';

export type HabitFrequency = 'daily' | 'weekly' | 'custom';

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export interface Habit {
  id: string;
  userId: string;
  habitName: string;
  category?: string;
  trackingType: HabitTrackingType;
  frequency: HabitFrequency;
  specificDays: DayOfWeek[];
  description?: string;
  targetValue?: number;
  unit?: string;
  isActive: boolean;
  isArchived: boolean;
  reminderEnabled: boolean;
  reminderTime?: string; // Time string (HH:mm)
  createdAt: string;
  updatedAt: string;
}

export interface HabitLog {
  id: string;
  userId: string;
  habitId: string;
  completed: boolean;
  value?: number;
  note?: string;
  logDate: string; // ISO date string
  loggedAt: string; // ISO timestamp
  createdAt: string;
  updatedAt: string;
}

// ============================================
// ENERGY TYPES
// ============================================

export type EnergyContextTag =
  | 'post-meal'
  | 'post-workout'
  | 'during-work'
  | 'after-sleep'
  | 'after-caffeine'
  | 'after-social-activity';

export interface EnergyLog {
  id: string;
  userId: string;
  energyRating: number; // 1-10
  contextTag?: EnergyContextTag;
  contextNote?: string;
  loggedAt: string; // ISO timestamp
  createdAt: string;
  updatedAt: string;
}

// ============================================
// ROUTINE TYPES
// ============================================

export type RoutineType = 'morning' | 'evening' | 'custom';

export interface RoutineStep {
  step: string;
  durationMin: number;
  order: number;
  instructions?: string;
}

export interface WellbeingRoutine {
  id: string;
  userId: string;
  routineName: string;
  routineType: RoutineType;
  isTemplate: boolean;
  templateId?: string;
  steps: RoutineStep[];
  frequency: HabitFrequency;
  specificDays: DayOfWeek[];
  triggerTime?: string; // Time string (HH:mm)
  isActive: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CompletedRoutineStep {
  step: string;
  completed: boolean;
  completedAt?: string; // ISO timestamp
}

export interface RoutineCompletion {
  id: string;
  userId: string;
  routineId: string;
  completionDate: string; // ISO date string
  stepsCompleted: CompletedRoutineStep[];
  completionRate: number; // 0-100
  totalSteps: number;
  completedSteps: number;
  startedAt?: string; // ISO timestamp
  completedAt?: string; // ISO timestamp
  durationSeconds?: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// MINDFULNESS TYPES
// ============================================

export type MindfulnessPracticeCategory =
  | 'breathing'
  | 'meditation'
  | 'movement'
  | 'quick_reset'
  | 'evening';

export interface MindfulnessInstruction {
  step: number;
  instruction: string;
}

export interface MindfulnessPractice {
  id: string;
  userId?: string; // NULL for system practices
  practiceName: string;
  practiceCategory: MindfulnessPracticeCategory;
  instructions: MindfulnessInstruction[];
  durationMinutes?: number;
  whenToUse?: string;
  whyItHelps?: string;
  isSystemPractice: boolean;
  // For user practice logs:
  completedAt?: string; // ISO timestamp
  actualDurationMinutes?: number;
  effectivenessRating?: number; // 1-10
  context?: string;
  note?: string;
  recommendedAt?: string; // ISO timestamp
  accepted?: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// BREATHING TEST TYPES
// ============================================

export type BreathingTestType = 'breath_hold' | 'box_breathing' | '4-7-8' | 'relaxation' | 'custom';

export type LungCapacityEstimate = 'poor' | 'fair' | 'good' | 'excellent';

export interface BreathingTest {
  id: string;
  userId: string;
  testType: BreathingTestType;
  patternName?: string;
  breathHoldDurationSeconds?: number;
  totalCyclesCompleted: number;
  totalDurationSeconds: number;
  averageInhaleDuration?: number;
  averageExhaleDuration?: number;
  averageHoldDuration?: number;
  consistencyScore?: number; // 0-100
  difficultyRating?: number; // 1-5
  notes?: string;
  lungCapacityEstimate?: LungCapacityEstimate;
  improvementFromBaseline?: number; // percentage
  startedAt: string; // ISO timestamp
  completedAt: string; // ISO timestamp
  createdAt: string;
  updatedAt: string;
}

export interface BreathingTimelineData {
  id: string;
  timestamp: string;
  breathHoldDurationSeconds?: number;
  totalDurationSeconds: number;
  testType: BreathingTestType;
  consistencyScore?: number;
  lungCapacityEstimate?: LungCapacityEstimate;
}

export interface BreathingStats {
  totalTests: number;
  averageBreathHoldSeconds: number;
  bestBreathHoldSeconds: number;
  averageConsistencyScore: number;
  improvementPercentage: number;
  mostUsedTestType: string;
  testsByType: Array<{ testType: string; count: number }>;
  recentTrend: 'improving' | 'stable' | 'declining';
}

export interface CreateBreathingTestInput {
  testType: BreathingTestType;
  patternName?: string;
  breathHoldDurationSeconds?: number;
  totalCyclesCompleted?: number;
  totalDurationSeconds: number;
  averageInhaleDuration?: number;
  averageExhaleDuration?: number;
  averageHoldDuration?: number;
  consistencyScore?: number;
  difficultyRating?: number;
  notes?: string;
  startedAt: string;
}

