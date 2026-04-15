/**
 * Help Center Validators
 * Zod schemas for help article validation
 */

import { z } from 'zod';

const helpStatusSchema = z.enum(['draft', 'published', 'archived']);

const slugSchema = z
  .string()
  .min(1, 'Slug is required')
  .max(255, 'Slug must be less than 255 characters')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Slug must be lowercase, alphanumeric, and can contain hyphens'
  );

export const createHelpArticleSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(255, 'Title must be less than 255 characters'),
  slug: slugSchema.optional(),
  content: z
    .string()
    .min(1, 'Content is required')
    .max(100000, 'Content is too long'),
  excerpt: z
    .string()
    .max(500, 'Excerpt must be less than 500 characters')
    .optional()
    .nullable(),
  category: z
    .string()
    .max(100, 'Category must be less than 100 characters')
    .optional()
    .default('general'),
  status: helpStatusSchema.optional().default('draft'),
  sort_order: z.number().int().optional().default(0),
  meta_title: z.string().max(255).optional().nullable(),
  meta_description: z.string().max(500).optional().nullable(),
});

export const updateHelpArticleSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  slug: slugSchema.optional(),
  content: z.string().min(1).max(100000).optional(),
  excerpt: z.string().max(500).optional().nullable(),
  category: z.string().max(100).optional(),
  status: helpStatusSchema.optional(),
  sort_order: z.number().int().optional(),
  meta_title: z.string().max(255).optional().nullable(),
  meta_description: z.string().max(500).optional().nullable(),
});

export const bulkDeleteHelpSchema = z.object({
  ids: z.array(z.string().uuid('Invalid article ID')).min(1, 'At least one ID is required'),
});

export const helpFeedbackSchema = z.object({
  helpful: z.boolean(),
});

// Generate help article with AI schema
export const generateHelpArticleSchema = z.object({
  topic: z.string().min(1, 'Topic is required').max(200, 'Topic is too long'),
  requirements: z.string().max(1000, 'Requirements are too long').optional(),
  tone: z.enum(['professional', 'casual', 'friendly', 'technical', 'conversational']).optional(),
  targetAudience: z.string().max(200, 'Target audience description is too long').optional(),
  length: z.enum(['short', 'medium', 'long']).optional(),
  includeSEO: z.boolean().optional(),
});
