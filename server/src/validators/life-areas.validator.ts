import { z } from 'zod';
import { listDomainTypes } from '../config/life-area-domains.js';

const domainTypeEnum = z.enum(listDomainTypes() as [string, ...string[]]);

const slugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9-]+$/, 'slug must be lowercase letters, digits, or hyphens');

const preferencesSchema = z
  .object({
    preferredTimeOfDay: z.enum(['morning', 'afternoon', 'evening', 'night']).optional(),
    blockedDays: z.array(z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])).optional(),
    tone: z.enum(['gentle', 'direct', 'playful', 'neutral']).optional(),
    followUpFrequency: z.enum(['daily', 'every-other-day', 'weekly', 'off']).optional(),
    customNotes: z.array(z.string().max(500)).optional(),
  })
  .passthrough();

export const createLifeAreaSchema = z.object({
  slug: slugSchema,
  display_name: z.string().min(1).max(100),
  domain_type: domainTypeEnum,
  icon: z.string().max(64).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'color must be hex like #3366ff')
    .optional(),
  preferences: preferencesSchema.optional(),
});

export const updateLifeAreaSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  icon: z.string().max(64).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  preferences: preferencesSchema.optional(),
  status: z.enum(['active', 'paused', 'archived']).optional(),
});

export const linkEntitySchema = z.object({
  entity_type: z.enum(['goal', 'schedule', 'contract', 'reminder']),
  entity_id: z.string().uuid(),
});

export const routeIntentSchema = z.object({
  message: z.string().min(1).max(4000),
  coach_reply: z.string().max(8000).optional(),
});

export type CreateLifeAreaInput = z.infer<typeof createLifeAreaSchema>;
export type UpdateLifeAreaInput = z.infer<typeof updateLifeAreaSchema>;
export type LinkEntityInput = z.infer<typeof linkEntitySchema>;
export type RouteIntentInput = z.infer<typeof routeIntentSchema>;
