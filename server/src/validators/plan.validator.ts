import { z } from 'zod';

// Plan status
const planStatusEnum = z.enum(['draft', 'active', 'paused', 'completed', 'archived']);

// Activity log status
const activityLogStatusEnum = z.enum(['pending', 'completed', 'skipped', 'partial']);

// S01.6.1: Generate Plan
export const generatePlanSchema = z.object({
  // goalId can be a UUID (from database) or a temporary ID like "goal_1" (from AI generation)
  goalId: z.string().optional(),
  regenerate: z.boolean().optional().default(false),
  preferences: z.object({
    preferredDays: z.array(z.string()).optional(),
    preferredTimes: z.record(z.string()).optional(),
    excludeActivities: z.array(z.string()).optional(),
  }).optional(),
  // Safety acknowledgment
  acknowledgedWarnings: z.boolean().optional().default(false),
  // Custom weight change rate (kg per week, negative for loss)
  weeklyWeightChangeKg: z.number().min(-2).max(1).optional(),
});

// S01.6.2: Update Plan
export const updatePlanSchema = z.object({
  status: planStatusEnum.optional(),
  activities: z.array(z.object({
    id: z.string(),
    type: z.string(),
    title: z.string(),
    description: z.string().optional(),
    targetValue: z.number().optional(),
    targetUnit: z.string().optional(),
    daysOfWeek: z.array(z.string()),
    preferredTime: z.string().optional(),
    duration: z.number().optional(),
    isOptional: z.boolean().optional(),
  })).optional(),
  userRating: z.number().int().min(1).max(5).optional(),
  userFeedback: z.string().max(1000).optional(),
});

// Log Activity
export const logActivitySchema = z.object({
  status: activityLogStatusEnum,
  scheduledDate: z.string().optional(),
  actualValue: z.number().optional(),
  duration: z.number().int().positive().optional(),
  notes: z.string().max(500).optional(),
  mood: z.number().int().min(1).max(5).optional(),
});

// Types
export type GeneratePlanInput = z.infer<typeof generatePlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type LogActivityInput = z.infer<typeof logActivitySchema>;
