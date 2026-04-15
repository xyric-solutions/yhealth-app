/**
 * User Validators
 * Zod schemas for user validation
 */

import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  role_id: z.string().uuid().optional(),
  is_active: z.boolean().optional(),
  phone: z.string().max(20).optional().nullable(),
  date_of_birth: z.string().date().optional().nullable(),
  gender: z.enum(['male', 'female', 'other']).optional().nullable(),
});

export const updateUserSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  first_name: z.string().min(1, 'First name is required').max(100).optional(),
  last_name: z.string().min(1, 'Last name is required').max(100).optional(),
  role_id: z.string().uuid().optional(),
  is_active: z.boolean().optional(),
  is_email_verified: z.boolean().optional(),
  phone: z.string().max(20).optional().nullable(),
  date_of_birth: z.string().date().optional().nullable(),
  gender: z.enum(['male', 'female', 'other']).optional().nullable(),
  avatar: z.string().url().optional().nullable(),
});

export const bulkDeleteUsersSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'At least one user ID is required'),
});

export const bulkUpdateUserStatusSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'At least one user ID is required'),
  is_active: z.boolean(),
});
