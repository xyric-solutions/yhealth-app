/**
 * @file Wellbeing Domain Types
 * @description Type definitions for Epic 07: Wellbeing Pillar
 */
export type MoodEmoji = '😊' | '😐' | '😟' | '😡' | '😰' | '😴';
export type EmotionTag = 'grateful' | 'frustrated' | 'excited' | 'anxious' | 'content' | 'overwhelmed' | 'peaceful' | 'irritated' | 'hopeful' | 'lonely' | 'confident' | 'sad' | 'energized' | 'calm' | 'worried';
export type WellbeingMode = 'light' | 'deep';
export interface MoodLog {
    id: string;
    userId: string;
    moodEmoji?: MoodEmoji;
    descriptor?: string;
    happinessRating?: number;
    energyRating?: number;
    stressRating?: number;
    anxietyRating?: number;
    emotionTags: EmotionTag[];
    contextNote?: string;
    mode: WellbeingMode;
    loggedAt: string;
    createdAt: string;
    updatedAt: string;
}
export type JournalPromptCategory = 'gratitude' | 'reflection' | 'emotional_processing' | 'stress_management' | 'self_compassion' | 'future_focus';
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
    sentimentScore?: number;
    sentimentLabel?: 'positive' | 'negative' | 'neutral';
    streakDay?: number;
    loggedAt: string;
    createdAt: string;
    updatedAt: string;
}
export type HabitTrackingType = 'checkbox' | 'counter' | 'duration' | 'rating';
export type HabitFrequency = 'daily' | 'weekly' | 'custom';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
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
    reminderTime?: string;
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
    logDate: string;
    loggedAt: string;
    createdAt: string;
    updatedAt: string;
}
export type EnergyContextTag = 'post-meal' | 'post-workout' | 'during-work' | 'after-sleep' | 'after-caffeine' | 'after-social-activity';
export interface EnergyLog {
    id: string;
    userId: string;
    energyRating: number;
    contextTag?: EnergyContextTag;
    contextNote?: string;
    loggedAt: string;
    createdAt: string;
    updatedAt: string;
}
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
    triggerTime?: string;
    isActive: boolean;
    isArchived: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface CompletedRoutineStep {
    step: string;
    completed: boolean;
    completedAt?: string;
}
export interface RoutineCompletion {
    id: string;
    userId: string;
    routineId: string;
    completionDate: string;
    stepsCompleted: CompletedRoutineStep[];
    completionRate: number;
    totalSteps: number;
    completedSteps: number;
    startedAt?: string;
    completedAt?: string;
    durationSeconds?: number;
    createdAt: string;
    updatedAt: string;
}
export type MindfulnessPracticeCategory = 'breathing' | 'meditation' | 'movement' | 'quick_reset' | 'evening';
export interface MindfulnessInstruction {
    step: number;
    instruction: string;
}
export interface MindfulnessPractice {
    id: string;
    userId?: string;
    practiceName: string;
    practiceCategory: MindfulnessPracticeCategory;
    instructions: MindfulnessInstruction[];
    durationMinutes?: number;
    whenToUse?: string;
    whyItHelps?: string;
    isSystemPractice: boolean;
    completedAt?: string;
    actualDurationMinutes?: number;
    effectivenessRating?: number;
    context?: string;
    note?: string;
    recommendedAt?: string;
    accepted?: boolean;
    createdAt: string;
    updatedAt: string;
}
//# sourceMappingURL=wellbeing.d.ts.map