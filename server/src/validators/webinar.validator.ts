/**
 * Webinar Validators
 * Zod schemas for webinar validation
 */

import { z } from 'zod';

const webinarStatusSchema = z.enum(['draft', 'published', 'cancelled', 'completed', 'archived']);

const slugSchema = z
  .string()
  .min(1, 'Slug is required')
  .max(255, 'Slug must be less than 255 characters')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Slug must be lowercase, alphanumeric, and can contain hyphens'
  );

export const createWebinarSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(255, 'Title must be less than 255 characters'),
  slug: slugSchema.optional(),
  description: z
    .string()
    .max(50000, 'Description is too long')
    .optional()
    .nullable(),
  content: z
    .string()
    .max(100000, 'Content is too long')
    .optional()
    .nullable(),
  host_name: z.string().max(255).optional().nullable(),
  host_title: z.string().max(255).optional().nullable(),
  host_avatar: z.string().max(500).optional().nullable(),
  featured_image: z.string().max(500).optional().nullable(),
  category: z.string().max(100).optional().default('general'),
  status: webinarStatusSchema.optional().default('draft'),
  duration_minutes: z.number().int().positive().optional().nullable(),
  scheduled_at: z.string().optional().nullable(),
  max_attendees: z.number().int().positive().optional().nullable(),
  meeting_url: z.string().max(500).optional().nullable(),
  recording_url: z.string().max(500).optional().nullable(),
  is_featured: z.boolean().optional().default(false),
});

export const updateWebinarSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  slug: slugSchema.optional(),
  description: z.string().max(50000).optional().nullable(),
  content: z.string().max(100000).optional().nullable(),
  host_name: z.string().max(255).optional().nullable(),
  host_title: z.string().max(255).optional().nullable(),
  host_avatar: z.string().max(500).optional().nullable(),
  featured_image: z.string().max(500).optional().nullable(),
  category: z.string().max(100).optional(),
  status: webinarStatusSchema.optional(),
  duration_minutes: z.number().int().positive().optional().nullable(),
  scheduled_at: z.string().optional().nullable(),
  max_attendees: z.number().int().positive().optional().nullable(),
  meeting_url: z.string().max(500).optional().nullable(),
  recording_url: z.string().max(500).optional().nullable(),
  is_featured: z.boolean().optional(),
});

export const webinarRegistrationSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(255, 'Name must be less than 255 characters'),
  email: z
    .string()
    .email('Invalid email address')
    .max(255, 'Email must be less than 255 characters'),
});

export const bulkDeleteWebinarsSchema = z.object({
  ids: z.array(z.string().uuid('Invalid webinar ID')).min(1, 'At least one ID is required'),
});

// Generate webinar content with AI schema
export const generateWebinarSchema = z.object({
  topic: z.string().min(1, 'Topic is required').max(200, 'Topic is too long'),
  requirements: z.string().max(1000, 'Requirements are too long').optional(),
  tone: z.enum(['professional', 'casual', 'friendly', 'technical', 'conversational']).optional(),
  targetAudience: z.string().max(200, 'Target audience description is too long').optional(),
  length: z.enum(['short', 'medium', 'long']).optional(),
  includeSEO: z.boolean().optional(),
});
