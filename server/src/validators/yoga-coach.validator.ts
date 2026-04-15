/**
 * @file Yoga Coach Validators
 * @description Zod schemas for AI yoga pose coaching (F7.9)
 */

import { z } from 'zod';

// ============================================
// REQUEST VALIDATION
// ============================================

export const analyseCoachSchema = z.object({
  poseSlug: z.string().min(1).max(200),
  frameBase64: z.string().min(100).max(500000), // ~375KB max for 320x240 JPEG
  currentAngles: z.record(z.string(), z.number().min(0).max(360)),
  elapsedSeconds: z.number().int().min(0).max(7200),
});

// ============================================
// RESPONSE VALIDATION
// ============================================

const bodyPartStatusSchema = z.object({
  part: z.string().max(50),
  status: z.enum(['correct', 'needs_adjustment', 'incorrect']),
  feedback: z.string().max(150),
});

export const coachResponseSchema = z.object({
  overallScore: z.number().min(0).max(100),
  overallFeedback: z.string().max(300),
  primaryCorrection: z.string().max(200),
  bodyParts: z.array(bodyPartStatusSchema).min(1).max(8),
  breathingCue: z.string().max(100).optional().default('Breathe deeply and steadily'),
  encouragement: z.string().max(100).optional().default('Keep going, you are doing great!'),
  holdRecommendation: z.string().max(100).optional(),
  coachEmotion: z.enum(['proud', 'encouraging', 'calm', 'strict', 'concerned', 'celebratory', 'playful', 'intense']),
});

export type AnalyseCoachInput = z.infer<typeof analyseCoachSchema>;
