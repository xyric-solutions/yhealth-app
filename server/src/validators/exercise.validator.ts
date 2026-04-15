/**
 * @file Exercise Validators
 * Zod schemas for exercise API endpoint validation.
 */

import { z } from 'zod';

// ============================================
// SHARED SCHEMAS
// ============================================

const pageSchema = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().min(1))
  .optional()
  .default('1');

const limitSchema = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().min(1).max(100))
  .optional()
  .default('20');

const categorySchema = z
  .enum(['strength', 'cardio', 'flexibility', 'balance', 'plyometric'])
  .optional();

const difficultySchema = z
  .enum(['beginner', 'intermediate', 'advanced'])
  .optional();

const sortSchema = z
  .enum(['name', 'category', 'difficulty', 'created_at'])
  .optional()
  .default('name');

const orderSchema = z
  .enum(['asc', 'desc'])
  .optional()
  .default('asc');

// ============================================
// LIST EXERCISES (offset-based)
// ============================================

export const listExercisesQuerySchema = z.object({
  page: pageSchema,
  limit: limitSchema,
  category: categorySchema,
  muscle: z.string().min(1).max(50).optional(),
  equipment: z.string().min(1).max(50).optional(),
  difficulty: difficultySchema,
  bodyPart: z.string().min(1).max(50).optional(),
  source: z.enum(['manual', 'exercisedb', 'rapidapi']).optional(),
  sort: sortSchema,
  order: orderSchema,
  // Cursor-based pagination (alternative)
  cursor: z.string().min(1).max(500).optional(),
});

// ============================================
// SEARCH EXERCISES
// ============================================

export const searchExercisesQuerySchema = z.object({
  q: z.string().min(1).max(200),
  page: pageSchema,
  limit: limitSchema,
  category: categorySchema,
  muscle: z.string().min(1).max(50).optional(),
  difficulty: difficultySchema,
});

// ============================================
// EXERCISE BY ID
// ============================================

export const exerciseIdParamsSchema = z.object({
  id: z.string().uuid(),
});

// ============================================
// EXERCISE BY SLUG
// ============================================

export const exerciseSlugParamsSchema = z.object({
  slug: z.string().min(1).max(300),
});
