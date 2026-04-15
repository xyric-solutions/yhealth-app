/**
 * Admin Exercise Validators
 * Zod schemas for admin exercise CRUD operations
 */

import { z } from 'zod';

// --- List exercises (admin — includes inactive) ---
export const adminListExercisesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  category: z.enum(['strength', 'cardio', 'flexibility', 'balance', 'plyometric']).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  source: z.enum(['manual', 'exercisedb', 'rapidapi', 'musclewiki']).optional(),
  is_active: z.enum(['true', 'false']).optional(),
  sort_by: z.enum(['name', 'category', 'difficulty_level', 'source', 'created_at', 'updated_at']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

// --- Create exercise ---
export const createExerciseSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  slug: z.string().min(1).max(300).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase with hyphens').optional(),
  description: z.string().max(2000).optional().nullable(),
  category: z.enum(['strength', 'cardio', 'flexibility', 'balance', 'plyometric']),
  primary_muscle_group: z.string().min(1).max(100).optional().nullable(),
  secondary_muscle_groups: z.array(z.string().max(100)).max(20).optional().default([]),
  equipment_required: z.array(z.string().max(100)).max(20).optional().default([]),
  difficulty_level: z.enum(['beginner', 'intermediate', 'advanced']),
  instructions: z.array(z.string().max(1000)).max(50).optional().default([]),
  tips: z.array(z.string().max(500)).max(20).optional().default([]),
  common_mistakes: z.array(z.string().max(500)).max(20).optional().default([]),
  video_url: z.string().url().max(2000).optional().nullable(),
  thumbnail_url: z.string().url().max(2000).optional().nullable(),
  animation_url: z.string().url().max(2000).optional().nullable(),
  default_sets: z.number().int().min(0).max(100).optional().default(3),
  default_reps: z.number().int().min(0).max(1000).optional().default(10),
  default_duration_seconds: z.number().int().min(0).max(7200).optional().nullable(),
  default_rest_seconds: z.number().int().min(0).max(600).optional().default(60),
  is_active: z.boolean().optional().default(true),
  calories_per_minute: z.number().min(0).max(100).optional().nullable(),
  met_value: z.number().min(0).max(50).optional().nullable(),
  tags: z.array(z.string().max(50)).max(30).optional().default([]),
  body_part: z.string().max(100).optional().nullable(),
  target_muscles: z.array(z.string().max(100)).max(20).optional().default([]),
});

// --- Update exercise (all fields optional) ---
export const updateExerciseSchema = createExerciseSchema.partial();

// --- Bulk delete ---
export const bulkDeleteExercisesSchema = z.object({
  ids: z.array(z.string().uuid('Invalid exercise ID')).min(1, 'At least one ID required').max(100),
});

// --- Bulk toggle active status ---
export const bulkToggleActiveSchema = z.object({
  ids: z.array(z.string().uuid('Invalid exercise ID')).min(1, 'At least one ID required').max(100),
  is_active: z.boolean(),
});

// --- Sync trigger ---
export const syncExercisesSchema = z.object({
  source: z.enum(['exercisedb', 'musclewiki']),
  dryRun: z.boolean().optional().default(false),
  limit: z.number().int().min(1).max(5000).optional(),
});

// Export types
export type AdminListExercisesQuery = z.infer<typeof adminListExercisesQuerySchema>;
export type CreateExerciseInput = z.infer<typeof createExerciseSchema>;
export type UpdateExerciseInput = z.infer<typeof updateExerciseSchema>;
export type BulkDeleteExercisesInput = z.infer<typeof bulkDeleteExercisesSchema>;
export type BulkToggleActiveInput = z.infer<typeof bulkToggleActiveSchema>;
export type SyncExercisesInput = z.infer<typeof syncExercisesSchema>;
