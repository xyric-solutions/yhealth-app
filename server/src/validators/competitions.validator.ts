/**
 * @file Competitions Validator
 * @description Zod schemas for competition validation
 */

import { z } from 'zod';

export const competitionRulesSchema = z.object({
  metric: z.enum(['workout', 'nutrition', 'wellbeing', 'biometrics', 'engagement', 'consistency', 'participation', 'total']),
  aggregation: z.enum(['streak', 'total', 'average', 'max']),
  target: z.number().optional(),
  min_days: z.number().int().positive().optional(),
});

export const competitionEligibilitySchema = z.object({
  regions: z.array(z.string()).optional(),
  subscription_tiers: z.array(z.string()).optional(),
  age_brackets: z.array(z.string()).optional(),
  groups: z.array(z.string()).optional(),
});

export const competitionIdParamSchema = z.object({
  id: z.string().uuid('Invalid competition ID format'),
});

export const createCompetitionSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['ai_generated', 'admin_created']),
  description: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  rules: competitionRulesSchema,
  eligibility: competitionEligibilitySchema.optional(),
  scoringWeights: z.record(z.number()).optional(),
  antiCheatPolicy: z.record(z.unknown()).optional(),
  prizeMetadata: z.record(z.unknown()).optional(),
});

