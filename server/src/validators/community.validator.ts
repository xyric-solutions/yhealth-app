/**
 * Community Validators
 * Zod schemas for community post validation
 */

import { z } from 'zod';

const communityStatusSchema = z.enum(['draft', 'published', 'archived', 'flagged']);
const communityPostTypeSchema = z.enum(['discussion', 'question', 'tip', 'success_story', 'challenge', 'announcement']);

const slugSchema = z
  .string()
  .min(1, 'Slug is required')
  .max(255, 'Slug must be less than 255 characters')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Slug must be lowercase, alphanumeric, and can contain hyphens'
  );

export const createCommunityPostSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(255, 'Title must be less than 255 characters'),
  slug: slugSchema.optional(),
  content: z
    .string()
    .min(1, 'Content is required')
    .max(50000, 'Content is too long'),
  category: z
    .string()
    .max(100, 'Category must be less than 100 characters')
    .optional()
    .default('general'),
  post_type: communityPostTypeSchema.optional().default('discussion'),
});

export const createAdminCommunityPostSchema = createCommunityPostSchema.extend({
  status: communityStatusSchema.optional().default('published'),
});

export const updateCommunityPostSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  slug: slugSchema.optional(),
  content: z.string().min(1).max(50000).optional(),
  category: z.string().max(100).optional(),
  status: communityStatusSchema.optional(),
  post_type: communityPostTypeSchema.optional(),
  is_pinned: z.boolean().optional(),
  is_featured: z.boolean().optional(),
});

export const communityReplySchema = z.object({
  content: z
    .string()
    .min(2, 'Reply must be at least 2 characters')
    .max(10000, 'Reply is too long'),
});

export const bulkDeleteCommunitySchema = z.object({
  ids: z.array(z.string().uuid('Invalid post ID')).min(1, 'At least one ID is required'),
});

// Generate community post with AI schema
export const generateCommunityPostSchema = z.object({
  topic: z.string().min(1, 'Topic is required').max(200, 'Topic is too long'),
  post_type: z.enum(['discussion', 'question', 'tip', 'success_story', 'challenge', 'announcement']).optional(),
  requirements: z.string().max(1000, 'Requirements are too long').optional(),
  tone: z.enum(['professional', 'casual', 'friendly', 'technical', 'conversational']).optional(),
  targetAudience: z.string().max(200, 'Target audience description is too long').optional(),
  length: z.enum(['short', 'medium', 'long']).optional(),
  includeSEO: z.boolean().optional(),
});
