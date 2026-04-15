/**
 * @file Activity Events Validator
 * @description Zod schemas for activity event validation
 */

import { z } from 'zod';

export const activityEventSchema = z.object({
  type: z.enum(['workout', 'nutrition', 'wellbeing', 'participation']),
  source: z.enum(['manual', 'whoop', 'apple_health', 'fitbit', 'garmin', 'oura', 'camera_session', 'integration']),
  timestamp: z.string().datetime(),
  payload: z.record(z.unknown()),
  idempotencyKey: z.string().optional(),
});

export const submitActivityEventsSchema = z.object({
  events: z.array(activityEventSchema).min(1).max(100),
});

export const getUserActivityEventsQuerySchema = z.object({
  type: z.enum(['workout', 'nutrition', 'wellbeing', 'participation']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  offset: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0)).optional(),
});

