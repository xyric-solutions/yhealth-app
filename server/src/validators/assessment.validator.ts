import { z } from 'zod';
import { commonSchemas } from '../middlewares/validate.middleware.js';

// Goal categories
const goalCategoryEnum = z.enum([
  'weight_loss',
  'muscle_building',
  'sleep_improvement',
  'stress_wellness',
  'energy_productivity',
  'event_training',
  'health_condition',
  'habit_building',
  'overall_optimization',
  'custom',
]);

// Health pillars
const healthPillarEnum = z.enum(['fitness', 'nutrition', 'wellbeing']);

// Assessment types
const assessmentTypeEnum = z.enum(['quick', 'deep']);

// S01.2.1: Goal Discovery
export const goalDiscoverySchema = z.object({
  category: goalCategoryEnum,
  customGoalText: z.string().min(5, 'Please provide more detail about your goal').max(500).optional(),
}).refine(data => {
  if (data.category === 'custom' && !data.customGoalText) {
    return false;
  }
  return true;
}, {
  message: 'Custom goal text is required when selecting "Other"',
  path: ['customGoalText'],
});

// Assessment mode selection
export const assessmentModeSchema = z.object({
  mode: assessmentTypeEnum,
});

// S01.2.2: Quick Assessment Response
export const quickAssessmentResponseSchema = z.object({
  questionId: z.string().min(1),
  value: z.union([
    z.string(),
    z.array(z.string()),
    z.number(),
  ]),
});

export const submitQuickAssessmentSchema = z.object({
  responses: z.array(quickAssessmentResponseSchema).min(6, 'Please answer at least 6 questions'),
  bodyStats: z.object({
    heightCm: z.number().min(50).max(300).optional(),
    weightKg: z.number().min(20).max(500).optional(),
    targetWeightKg: z.number().min(20).max(500).optional(),
    bodyFatPercentage: z.number().min(1).max(70).optional(),
  }).optional(),
});

// S01.2.3: Deep Assessment Message
export const deepAssessmentMessageSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(2000),
});

// S01.3.1: AI-Guided Goal Setup
export const goalSetupSchema = z.object({
  category: goalCategoryEnum,
  pillar: healthPillarEnum,
  isPrimary: z.boolean().default(false),
  title: z.string().min(5, 'Goal title must be at least 5 characters').max(200),
  description: z.string().min(10, 'Please provide more detail about your goal').max(1000),
  targetValue: z.number().positive('Target must be a positive number'),
  targetUnit: z.string().min(1, 'Unit is required').max(50),
  currentValue: z.number().optional(),
  timeline: z.object({
    startDate: z.string().or(z.date()).transform(val => new Date(val)),
    targetDate: z.string().or(z.date()).transform(val => new Date(val)),
    durationWeeks: z.number().int().min(1).max(52),
  }),
  motivation: z.string().min(10, 'Please share why this goal matters to you').max(500),
}).refine(data => {
  return data.timeline.targetDate > data.timeline.startDate;
}, {
  message: 'Target date must be after start date',
  path: ['timeline', 'targetDate'],
});

// S01.3.2: Goal Validation & Commitment
export const goalCommitmentSchema = z.object({
  goalId: commonSchemas.objectId,
  confidenceLevel: z.number().int().min(1).max(10),
  acknowledgedSafetyWarnings: z.boolean().optional().default(false),
});

// Accept AI-suggested goals
export const acceptSuggestedGoalsSchema = z.object({
  goals: z.array(z.object({
    category: goalCategoryEnum,
    pillar: healthPillarEnum,
    isPrimary: z.boolean(),
    title: z.string(),
    description: z.string(),
    targetValue: z.number(),
    targetUnit: z.string(),
    timeline: z.object({
      startDate: z.string().or(z.date()),
      targetDate: z.string().or(z.date()),
      durationWeeks: z.number(),
    }),
    motivation: z.string(),
    confidenceLevel: z.number().int().min(1).max(10),
  })).min(1, 'At least one goal is required').max(3, 'Maximum 3 goals allowed'),
});

// Update goal schema
export const updateGoalSchema = z.object({
  title: z.string().min(5).max(200).optional(),
  description: z.string().min(10).max(1000).optional(),
  targetValue: z.number().positive().optional(),
  currentValue: z.number().optional(),
  targetDate: z.string().or(z.date()).optional(),
  motivation: z.string().min(10).max(500).optional(),
  status: z.enum(['active', 'in_progress', 'paused', 'completed', 'abandoned']).optional(),
});

// Delete goals schema (bulk delete)
export const deleteGoalsSchema = z.object({
  goalIds: z.array(z.string().uuid()).min(1, 'At least one goal ID is required'),
});

// Types
export type GoalDiscoveryInput = z.infer<typeof goalDiscoverySchema>;
export type DeleteGoalsInput = z.infer<typeof deleteGoalsSchema>;
export type AssessmentModeInput = z.infer<typeof assessmentModeSchema>;
export type QuickAssessmentResponseInput = z.infer<typeof quickAssessmentResponseSchema>;
export type SubmitQuickAssessmentInput = z.infer<typeof submitQuickAssessmentSchema>;
export type DeepAssessmentMessageInput = z.infer<typeof deepAssessmentMessageSchema>;
export type GoalSetupInput = z.infer<typeof goalSetupSchema>;
export type GoalCommitmentInput = z.infer<typeof goalCommitmentSchema>;
export type AcceptSuggestedGoalsInput = z.infer<typeof acceptSuggestedGoalsSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
