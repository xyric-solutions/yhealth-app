/**
 * Yoga & Meditation Validators
 * Zod schemas for yoga module validation (F7.9)
 */

import { z } from 'zod';

// ============================================
// SHARED ENUMS
// ============================================

const poseCategorySchema = z.enum([
  'standing', 'seated', 'supine', 'prone', 'inversion',
  'balance', 'twist', 'backbend', 'forward_fold', 'hip_opener', 'restorative',
]);

const poseDifficultySchema = z.enum(['beginner', 'intermediate', 'advanced']);

const sessionTypeSchema = z.enum([
  'recovery_flow', 'morning_flow', 'evening_flow', 'power_yoga',
  'gentle_stretch', 'hip_opener_flow', 'balance_flow', 'sleep_prep',
  'eye_exercise', 'face_yoga', 'desk_stretch', 'breathwork_focus',
  'custom', 'ai_generated',
]);

const meditationModeSchema = z.enum([
  'guided', 'yoga_nidra', 'breathwork_only', 'silent_timer', 'nature_sounds', 'mantra',
]);

const ambientSoundSchema = z.enum(['rain', 'ocean', 'forest', 'fire', 'birds', 'silence']);

const breathingPatternSchema = z.enum([
  'natural', 'ujjayi', '4-7-8', 'box', 'coherent', 'wim_hof', 'alternate_nostril', 'energising',
]);

const sessionGoalSchema = z.enum([
  'relaxation', 'energy', 'flexibility', 'strength',
  'recovery', 'sleep_prep', 'stress_relief', 'focus',
]);

// ============================================
// POSE VALIDATORS
// ============================================

export const listPosesSchema = z.object({
  category: poseCategorySchema.optional(),
  difficulty: poseDifficultySchema.optional(),
  muscleGroup: z.string().max(50).optional(),
  isRecovery: z.enum(['true', 'false']).optional(),
  search: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

// ============================================
// SESSION VALIDATORS
// ============================================

export const getSessionsSchema = z.object({
  sessionType: sessionTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const generateSessionSchema = z.object({
  sessionType: sessionTypeSchema,
  goal: sessionGoalSchema,
  durationMinutes: z.number().int().min(5).max(90),
  difficulty: poseDifficultySchema.optional().default('beginner'),
  mood: z.number().int().min(1).max(10).optional(),
  meditationMode: meditationModeSchema.optional(),
  includeBreathwork: z.boolean().optional().default(true),
  focusMuscleGroups: z.array(z.string().max(50)).max(5).optional(),
});

// ============================================
// SESSION LOG VALIDATORS
// ============================================

export const startSessionSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
  moodBefore: z.number().int().min(1).max(10).optional(),
  preSessionHrv: z.number().min(0).max(300).optional(),
  recoveryScoreAtTime: z.number().min(0).max(100).optional(),
});

export const updateSessionLogSchema = z.object({
  phasesCompleted: z.number().int().min(0).optional(),
  actualDurationSeconds: z.number().int().min(0).optional(),
  voiceGuideUsed: z.boolean().optional(),
  musicPlayed: z.boolean().optional(),
  poseCorrectionUsed: z.boolean().optional(),
});

export const completeSessionSchema = z.object({
  moodAfter: z.number().int().min(1).max(10).optional(),
  difficultyRating: z.number().int().min(1).max(5).optional(),
  effectivenessRating: z.number().int().min(1).max(10).optional(),
  notes: z.string().max(1000).optional(),
  completionRate: z.number().min(0).max(100).optional(),
  phasesCompleted: z.number().int().min(0).optional(),
  actualDurationSeconds: z.number().int().min(0).optional(),
});

// ============================================
// MEDITATION TIMER VALIDATORS
// ============================================

export const startMeditationSchema = z.object({
  mode: z.enum(['silent_timer', 'nature_sounds', 'mantra']),
  durationMinutes: z.number().int().min(1).max(120),
  ambientSound: ambientSoundSchema.optional(),
  intervalBellSeconds: z.number().int().min(0).max(3600).optional().default(0),
});

// ============================================
// HISTORY VALIDATORS
// ============================================

export const historySchema = z.object({
  sessionType: sessionTypeSchema.optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format').optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

// ============================================
// VOICE SCRIPT VALIDATOR
// ============================================

export const generateVoiceScriptSchema = z.object({
  phase: z.object({
    phaseType: z.enum(['warmup', 'flow', 'peak', 'cooldown', 'savasana', 'breathwork', 'meditation', 'transition']),
    name: z.string().min(1).max(200),
    durationSeconds: z.number().int().min(1),
    poses: z.array(z.object({
      poseSlug: z.string().min(1).max(200),
      holdSeconds: z.number().int().min(1),
      repetitions: z.number().int().min(1).optional(),
      side: z.enum(['both', 'left', 'right']),
    })).default([]),
    breathingPattern: breathingPatternSchema,
    narrationScript: z.string().max(5000).optional(),
    musicTag: z.string().max(100).optional(),
  }),
  sessionType: sessionTypeSchema,
  userName: z.string().max(100).optional(),
});
