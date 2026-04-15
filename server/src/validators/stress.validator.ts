import { z } from 'zod';

// Stress trigger enum
const stressTriggerEnum = z.enum([
  'Work',
  'Relationships',
  'Finances',
  'Health',
  'Family',
  'Uncertainty',
  'Time pressure',
  'Conflict',
  'Other',
]);

// Check-in type enum
const checkInTypeEnum = z.enum(['daily', 'on_demand']);

/**
 * Schema for creating a stress log
 * POST /api/v1/wellbeing/stress/logs
 */
export const createStressLogSchema = z.object({
  stress_rating: z
    .number()
    .int()
    .min(1, 'Stress rating must be between 1 and 10')
    .max(10, 'Stress rating must be between 1 and 10'),
  triggers: z
    .array(stressTriggerEnum)
    .optional()
    .default([]),
  other_trigger: z
    .string()
    .trim()
    .max(100, 'Other trigger must be 100 characters or less')
    .optional(),
  note: z
    .string()
    .trim()
    .max(500, 'Note must be 500 characters or less')
    .optional(),
  check_in_type: checkInTypeEnum.default('on_demand'),
  client_request_id: z
    .string()
    .trim()
    .min(1, 'Client request ID is required')
    .max(255, 'Client request ID must be 255 characters or less'),
  logged_at: z
    .string()
    .datetime('Invalid ISO datetime format')
    .optional(),
});

/**
 * Schema for query parameters when getting stress logs
 * GET /api/v1/wellbeing/stress/logs
 */
export const getLogsQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional(),
});

/**
 * Schema for query parameters when getting stress summary
 * GET /api/v1/wellbeing/stress/summary
 */
export const getSummaryQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .min(1, 'From date is required'),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .min(1, 'To date is required'),
});

