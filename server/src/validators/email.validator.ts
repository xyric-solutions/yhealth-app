/**
 * Email Validators
 * Zod schemas for email preference and analytics validation
 */

import { z } from 'zod';

export const emailCategorySchema = z.enum([
  'transactional',
  'engagement',
  'digest',
  'coaching',
  'marketing',
]);

export const updatePreferenceSchema = z.object({
  enabled: z.boolean(),
  frequency: z.enum(['immediate', 'daily', 'weekly', 'never']).optional(),
});

export const emailAnalyticsQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  template: z.string().max(100).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export const emailLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['queued', 'sending', 'sent', 'delivered', 'bounced', 'failed']).optional(),
  category: emailCategorySchema.optional(),
  template: z.string().max(100).optional(),
});

export const sendTestEmailSchema = z.object({
  template: z.string().min(1).max(100),
  recipient: z.string().email(),
  data: z.record(z.unknown()).optional(),
});
