import { z } from 'zod';

// ─── Enums ───────────────────────────────────────────────────────────

const conditionTypes = [
  'missed_activity',
  'calorie_exceeded',
  'streak_break',
  'missed_goal',
  'sleep_deficit',
  'custom',
] as const;

const conditionMetrics = [
  'gym_sessions',
  'calories',
  'steps',
  'sleep_hours',
  'water_intake',
  'workout_completion',
] as const;

const operators = ['lt', 'gt', 'eq', 'gte', 'lte', 'missed'] as const;

const penaltyTypes = [
  'donation',
  'xp_loss',
  'social_alert',
  'streak_freeze_loss',
  'custom',
] as const;

const verificationMethods = ['auto', 'ai_verified', 'manual'] as const;

// ─── Create Contract ─────────────────────────────────────────────────

export const createContractSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().max(1000).optional(),

  condition_type: z.enum(conditionTypes),
  condition_metric: z.enum(conditionMetrics).optional(),
  condition_operator: z.enum(operators).optional(),
  condition_value: z.number().optional(),
  condition_window_days: z.number().int().min(1).max(30).default(1),
  condition_details: z.record(z.unknown()).optional(),

  penalty_type: z.enum(penaltyTypes),
  penalty_amount: z.number().min(0).optional(),
  penalty_currency: z.string().max(10).default('PKR'),
  penalty_details: z.record(z.unknown()).optional(),

  start_date: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid start date'),
  end_date: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid end date'),
  auto_renew: z.boolean().default(false),

  verification_method: z.enum(verificationMethods).default('auto'),
  grace_period_hours: z.number().int().min(0).max(48).default(0),
  confidence_threshold: z.number().min(0.5).max(1.0).default(0.8),

  social_enforcer_ids: z.array(z.string().uuid()).max(5).default([]),
}).refine(
  (data) => new Date(data.end_date) > new Date(data.start_date),
  { message: 'End date must be after start date', path: ['end_date'] }
);

// ─── Update Contract (draft/paused only) ─────────────────────────────

export const updateContractSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(1000).optional(),

  condition_type: z.enum(conditionTypes).optional(),
  condition_metric: z.enum(conditionMetrics).optional(),
  condition_operator: z.enum(operators).optional(),
  condition_value: z.number().optional(),
  condition_window_days: z.number().int().min(1).max(30).optional(),
  condition_details: z.record(z.unknown()).optional(),

  penalty_type: z.enum(penaltyTypes).optional(),
  penalty_amount: z.number().min(0).optional(),
  penalty_currency: z.string().max(10).optional(),
  penalty_details: z.record(z.unknown()).optional(),

  start_date: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid start date').optional(),
  end_date: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid end date').optional(),
  auto_renew: z.boolean().optional(),

  verification_method: z.enum(verificationMethods).optional(),
  grace_period_hours: z.number().int().min(0).max(48).optional(),
  confidence_threshold: z.number().min(0.5).max(1.0).optional(),

  social_enforcer_ids: z.array(z.string().uuid()).max(5).optional(),
});

// ─── Sign Contract ───────────────────────────────────────────────────

export const signContractSchema = z.object({
  confirm: z.literal(true, { errorMap: () => ({ message: 'You must confirm to sign the contract' }) }),
});

// ─── Dispute Violation ───────────────────────────────────────────────

export const disputeViolationSchema = z.object({
  reason: z.string().min(10, 'Please provide a detailed reason (min 10 chars)').max(1000),
});

// ─── Cancel Contract ─────────────────────────────────────────────────

export const cancelContractSchema = z.object({
  reason: z.string().max(500).optional(),
});

// ─── Param Schemas ───────────────────────────────────────────────────

export const contractIdParamSchema = z.object({
  id: z.string().uuid('Invalid contract ID'),
});

export const violationIdParamSchema = z.object({
  vid: z.string().uuid('Invalid violation ID'),
});

// ─── Query Schemas ───────────────────────────────────────────────────

export const listContractsQuerySchema = z.object({
  status: z.enum(['draft', 'active', 'at_risk', 'violated', 'completed', 'cancelled', 'paused']).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// ─── Type Exports ────────────────────────────────────────────────────

export type CreateContractInput = z.infer<typeof createContractSchema>;
export type UpdateContractInput = z.infer<typeof updateContractSchema>;
