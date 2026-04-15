/**
 * @file Vision Testing Validators
 * @description Zod schemas for vision test and eye exercise endpoints
 */

import { z } from 'zod';

// ============================================
// SHARED ENUMS
// ============================================

const testTypeSchema = z.enum(['color_vision_quick', 'color_vision_advanced', 'eye_exercise']);
const difficultySchema = z.enum(['quick', 'standard', 'advanced']);
const plateTypeSchema = z.enum(['protan', 'deutan', 'tritan', 'control']);
const exerciseTypeSchema = z.enum(['trataka', 'eye_circles', 'focus_shift', 'palming']);

// ============================================
// REQUEST SCHEMAS
// ============================================

export const startVisionTestSchema = z.object({
  testType: testTypeSchema,
  difficulty: difficultySchema.optional().default('standard'),
  moodBefore: z.number().int().min(1).max(10).optional(),
});

const plateResponseSchema = z.object({
  plateIndex: z.number().int().min(0),
  plateType: plateTypeSchema,
  correctAnswer: z.string().min(1).max(10),
  userAnswer: z.string().max(10).optional(),
  isCorrect: z.boolean(),
  responseTimeMs: z.number().int().min(0).optional(),
  timedOut: z.boolean().optional().default(false),
});

export const completeVisionTestSchema = z.object({
  responses: z.array(plateResponseSchema).min(1).max(30),
  totalDurationSeconds: z.number().int().min(0),
  moodAfter: z.number().int().min(1).max(10).optional(),
  notes: z.string().max(1000).optional(),
});

export const startEyeExerciseSchema = z.object({
  exerciseType: exerciseTypeSchema,
  durationSeconds: z.number().int().min(10).max(3600),
  moodBefore: z.number().int().min(1).max(10).optional(),
});

export const completeEyeExerciseSchema = z.object({
  moodAfter: z.number().int().min(1).max(10).optional(),
  notes: z.string().max(1000).optional(),
});

export const visionHistorySchema = z.object({
  testType: testTypeSchema.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type StartVisionTestInput = z.infer<typeof startVisionTestSchema>;
export type CompleteVisionTestInput = z.infer<typeof completeVisionTestSchema>;
export type StartEyeExerciseInput = z.infer<typeof startEyeExerciseSchema>;
export type CompleteEyeExerciseInput = z.infer<typeof completeEyeExerciseSchema>;
export type VisionHistoryInput = z.infer<typeof visionHistorySchema>;
