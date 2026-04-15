/**
 * Subscription Validators
 * Zod schemas for subscription plan and checkout validation
 */

import { z } from 'zod';

const uuidSchema = z
  .string()
  .uuid('Invalid UUID format')
  .refine((val) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val), {
    message: 'Invalid UUID format',
  });

const slugSchema = z
  .string()
  .min(1, 'Slug is required')
  .max(100, 'Slug must be at most 100 characters')
  .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric and hyphens only');

const featuresSchema = z
  .array(z.string().max(200, 'Feature text must be at most 200 characters'))
  .max(20, 'At most 20 features allowed')
  .default([]);

const currencySchema = z
  .string()
  .length(3, 'Currency must be 3 characters')
  .transform((val) => val.toUpperCase());

const intervalSchema = z.enum(['month', 'year'], {
  errorMap: () => ({ message: 'Interval must be "month" or "year"' }),
});

// Max safe amount_cents to avoid overflow (e.g. 999,999,99 cents)
const amountCentsSchema = z
  .number()
  .int('Amount must be an integer')
  .min(0, 'Amount must be non-negative')
  .max(999_999_99, 'Amount exceeds maximum');

export const createPlanSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(200, 'Name must be at most 200 characters'),
  slug: slugSchema,
  description: z.string().max(2000, 'Description must be at most 2000 characters').optional().nullable(),
  amount_cents: amountCentsSchema,
  currency: currencySchema.default('USD'),
  interval: intervalSchema,
  features: featuresSchema,
  is_active: z.boolean().default(true),
  sort_order: z.number().int().min(0, 'Sort order must be non-negative').default(0),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;

export const updatePlanSchema = z
  .object({
    name: z.string().min(2).max(200).optional(),
    slug: slugSchema.optional(),
    description: z.string().max(2000).optional().nullable(),
    amount_cents: amountCentsSchema.optional(),
    currency: currencySchema.optional(),
    interval: intervalSchema.optional(),
    features: featuresSchema.optional(),
    is_active: z.boolean().optional(),
    sort_order: z.number().int().min(0).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

function getAllowedRedirectHostnames(): string[] {
  const clientUrl = process.env['CLIENT_URL'] || process.env['CORS_ORIGIN'];
  const hostnames = ['localhost', '127.0.0.1'];
  if (clientUrl) {
    try {
      const first = typeof clientUrl === 'string' ? clientUrl.split(',')[0]?.trim() : '';
      if (first) {
        const u = new URL(first);
        if (u.hostname) hostnames.push(u.hostname);
      }
    } catch {
      // ignore
    }
  }
  return hostnames;
}

const urlSameOriginSchema = z
  .string()
  .url('Must be a valid URL')
  .refine(
    (url) => {
      try {
        const u = new URL(url);
        const allowed = getAllowedRedirectHostnames();
        return allowed.includes(u.hostname);
      } catch {
        return false;
      }
    },
    { message: 'Redirect URL must be from an allowed origin' }
  );

export const checkoutSessionSchema = z.object({
  planId: uuidSchema,
  successUrl: urlSameOriginSchema,
  cancelUrl: urlSameOriginSchema,
});

export type CheckoutSessionInput = z.infer<typeof checkoutSessionSchema>;

export const portalSessionSchema = z.object({
  returnUrl: urlSameOriginSchema,
});

export type PortalSessionInput = z.infer<typeof portalSessionSchema>;

/** Verify checkout session (callback when webhook may not have run). */
export const verifySessionSchema = z.object({
  session_id: z.string().min(1, 'Session ID is required').max(500),
});
export type VerifySessionInput = z.infer<typeof verifySessionSchema>;

export const planIdParamSchema = z.object({
  id: uuidSchema,
});

export const adminListPlansQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  is_active: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
});

export const adminListSubscriptionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.string().optional(),
  planId: uuidSchema.optional(),
  userId: uuidSchema.optional(),
});
