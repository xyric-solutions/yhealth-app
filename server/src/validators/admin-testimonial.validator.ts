/**
 * Admin Testimonial Validators
 * Zod schemas for admin testimonial CRUD operations
 */

import { z } from 'zod';

// --- List testimonials (admin — includes inactive) ---
export const adminListTestimonialsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  pillar: z.enum(['fitness', 'nutrition', 'wellbeing']).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  is_active: z.enum(['true', 'false']).optional(),
  is_featured: z.enum(['true', 'false']).optional(),
  sort_by: z.enum(['name', 'rating', 'pillar', 'display_order', 'created_at', 'updated_at']).default('display_order'),
  sort_order: z.enum(['asc', 'desc']).default('asc'),
});

// --- Create testimonial ---
export const createTestimonialSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  role: z.string().min(1, 'Role is required').max(100),
  avatar_url: z.string().url().max(2000).optional().nullable(),
  rating: z.number().int().min(1).max(5),
  content: z.string().min(10, 'Content must be at least 10 characters').max(2000),
  verified: z.boolean().optional().default(false),
  pillar: z.enum(['fitness', 'nutrition', 'wellbeing']).optional().nullable(),
  is_active: z.boolean().optional().default(true),
  is_featured: z.boolean().optional().default(false),
  display_order: z.number().int().min(0).optional().default(0),
});

// --- Update testimonial (all fields optional) ---
export const updateTestimonialSchema = createTestimonialSchema.partial();

// --- Bulk delete ---
export const bulkDeleteTestimonialsSchema = z.object({
  ids: z.array(z.string().uuid('Invalid testimonial ID')).min(1, 'At least one ID required').max(100),
});

// --- Bulk toggle active status ---
export const bulkToggleActiveTestimonialsSchema = z.object({
  ids: z.array(z.string().uuid('Invalid testimonial ID')).min(1, 'At least one ID required').max(100),
  is_active: z.boolean(),
});

// Export types
export type AdminListTestimonialsQuery = z.infer<typeof adminListTestimonialsQuerySchema>;
export type CreateTestimonialInput = z.infer<typeof createTestimonialSchema>;
export type UpdateTestimonialInput = z.infer<typeof updateTestimonialSchema>;
export type BulkDeleteTestimonialsInput = z.infer<typeof bulkDeleteTestimonialsSchema>;
export type BulkToggleActiveTestimonialsInput = z.infer<typeof bulkToggleActiveTestimonialsSchema>;
