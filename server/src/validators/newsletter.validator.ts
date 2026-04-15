/**
 * Newsletter Validators
 * Zod schemas for newsletter subscription (public + admin)
 */

import { z } from 'zod';

const interestSchema = z.enum(['fitness', 'nutrition', 'wellbeing']);

export const subscribeNewsletterSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email').max(255),
  interests: z.array(interestSchema).optional().default([]),
  source: z.string().max(50).optional().default('footer'),
});

export const bulkDeleteNewsletterSchema = z.object({
  ids: z
    .array(z.string().uuid('Invalid subscription ID'))
    .min(1, 'At least one ID is required')
    .max(100, 'Cannot delete more than 100 at once'),
});
