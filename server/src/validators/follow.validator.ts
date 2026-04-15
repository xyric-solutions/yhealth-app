import { z } from 'zod';

export const followRequestSchema = z.object({
  message: z.string().max(300).optional(),
});

export const userIdParamSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
});

export const followIdParamSchema = z.object({
  followId: z.string().uuid('Invalid follow ID'),
});

export const consentUpdateSchema = z.object({
  allow_suggestions: z.boolean().optional(),
  allow_goal_sharing: z.boolean().optional(),
  allow_activity_sharing: z.boolean().optional(),
});
