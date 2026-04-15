/**
 * Role Validators
 * Zod schemas for role validation
 */

import { z } from 'zod';

export const createRoleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z.string().max(100).optional(),
  description: z.string().max(500).optional().nullable(),
});

export const updateRoleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).optional(),
  slug: z.string().max(100).optional(),
  description: z.string().max(500).optional().nullable(),
});

export const bulkDeleteRolesSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'At least one role ID is required'),
});

export const updateRolePermissionsSchema = z.object({
  permission_ids: z.array(z.string().uuid()),
});
