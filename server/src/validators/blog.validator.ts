/**
 * Blog Validators
 * Zod schemas for blog validation
 */

import { z } from 'zod';

// Blog status enum
const blogStatusSchema = z.enum(['draft', 'published', 'archived']);

// Slug validation (URL-safe, lowercase, alphanumeric with hyphens)
const slugSchema = z
  .string()
  .min(1, 'Slug is required')
  .max(255, 'Slug must be less than 255 characters')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Slug must be lowercase, alphanumeric, and can contain hyphens'
  );

// Create blog schema
export const createBlogSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(255, 'Title must be less than 255 characters'),
  slug: slugSchema.optional(),
  excerpt: z
    .string()
    .max(500, 'Excerpt must be less than 500 characters')
    .optional()
    .nullable(),
  content: z
    .string()
    .min(1, 'Content is required')
    .max(100000, 'Content is too long'),
  markdown_content: z
    .string()
    .max(100000, 'Markdown content is too long')
    .optional()
    .nullable(),
  featured_image: z
    .string()
    .url('Featured image must be a valid URL')
    .max(2000, 'Featured image URL is too long')
    .optional()
    .nullable(),
  status: blogStatusSchema.optional().default('draft'),
  published_at: z
    .string()
    .datetime('Published at must be a valid ISO datetime')
    .optional()
    .nullable(),
  meta_title: z
    .string()
    .max(255, 'Meta title must be less than 255 characters')
    .optional()
    .nullable(),
  meta_description: z
    .string()
    .max(500, 'Meta description must be less than 500 characters')
    .optional()
    .nullable(),
  meta_keywords: z
    .string()
    .max(500, 'Meta keywords must be less than 500 characters')
    .optional()
    .nullable(),
});

// Update blog schema (all fields optional)
export const updateBlogSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(255, 'Title must be less than 255 characters')
    .optional(),
  slug: slugSchema.optional(),
  excerpt: z
    .string()
    .max(500, 'Excerpt must be less than 500 characters')
    .optional()
    .nullable(),
  content: z
    .string()
    .min(1, 'Content is required')
    .max(100000, 'Content is too long')
    .optional(),
  markdown_content: z
    .string()
    .max(100000, 'Markdown content is too long')
    .optional()
    .nullable(),
  featured_image: z
    .string()
    .url('Featured image must be a valid URL')
    .max(2000, 'Featured image URL is too long')
    .optional()
    .nullable(),
  status: blogStatusSchema.optional(),
  published_at: z
    .string()
    .datetime('Published at must be a valid ISO datetime')
    .optional()
    .nullable(),
  meta_title: z
    .string()
    .max(255, 'Meta title must be less than 255 characters')
    .optional()
    .nullable(),
  meta_description: z
    .string()
    .max(500, 'Meta description must be less than 500 characters')
    .optional()
    .nullable(),
  meta_keywords: z
    .string()
    .max(500, 'Meta keywords must be less than 500 characters')
    .optional()
    .nullable(),
});

// Bulk delete schema
export const bulkDeleteBlogsSchema = z.object({
  ids: z
    .array(z.string().uuid('Invalid blog ID'))
    .min(1, 'At least one blog ID is required')
    .max(100, 'Cannot delete more than 100 blogs at once'),
});

// Bulk update status schema
export const bulkUpdateStatusSchema = z.object({
  ids: z
    .array(z.string().uuid('Invalid blog ID'))
    .min(1, 'At least one blog ID is required')
    .max(100, 'Cannot update more than 100 blogs at once'),
  status: blogStatusSchema,
});

// Query parameters schema for listing blogs
export const listBlogsQuerySchema = z.object({
  page: z
    .string()
    .regex(/^\d+$/, 'Page must be a number')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1))
    .optional()
    .default('1'),
  limit: z
    .string()
    .regex(/^\d+$/, 'Limit must be a number')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(500))
    .optional()
    .default('10'),
  status: blogStatusSchema.optional(),
  author_id: z.string().uuid('Invalid author ID').optional(),
  search: z.string().max(255, 'Search query is too long').optional(),
  published_after: z
    .string()
    .datetime('Published after must be a valid ISO datetime')
    .optional(),
  published_before: z
    .string()
    .datetime('Published before must be a valid ISO datetime')
    .optional(),
  sort_by: z
    .enum(['created_at', 'updated_at', 'published_at', 'title', 'views'])
    .optional()
    .default('created_at'),
  sort_order: z.enum(['asc', 'desc']).optional().default('desc'),
});

// Export types
// Generate blog with AI schema
export const generateBlogSchema = z.object({
  topic: z.string().min(1, 'Topic is required').max(200, 'Topic is too long'),
  requirements: z.string().max(1000, 'Requirements are too long').optional(),
  tone: z.enum(['professional', 'casual', 'friendly', 'technical', 'conversational']).optional(),
  targetAudience: z.string().max(200, 'Target audience description is too long').optional(),
  length: z.enum(['short', 'medium', 'long']).optional(),
  includeSEO: z.boolean().optional(),
});

// Blog reaction schema
export const blogReactionSchema = z.object({
  type: z.enum(['like', 'dislike'], {
    required_error: 'Reaction type is required',
    invalid_type_error: 'Reaction type must be "like" or "dislike"',
  }),
});

export type CreateBlogInput = z.infer<typeof createBlogSchema>;
export type UpdateBlogInput = z.infer<typeof updateBlogSchema>;
export type BulkDeleteBlogsInput = z.infer<typeof bulkDeleteBlogsSchema>;
export type BulkUpdateStatusInput = z.infer<typeof bulkUpdateStatusSchema>;
export type GenerateBlogInput = z.infer<typeof generateBlogSchema>;
export type ListBlogsQuery = z.infer<typeof listBlogsQuerySchema>;
export type BlogReactionInput = z.infer<typeof blogReactionSchema>;

