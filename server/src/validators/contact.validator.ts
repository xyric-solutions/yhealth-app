/**
 * Contact Validators
 * Zod schemas for contact submission validation
 */

import { z } from 'zod';

// Contact status enum
const contactStatusSchema = z.enum(['new', 'read', 'in_progress', 'resolved', 'archived']);

// Contact priority enum
const contactPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);

// Create contact submission (public form)
export const createContactSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(255, 'Name must be less than 255 characters'),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email address')
    .max(255, 'Email must be less than 255 characters'),
  phone: z
    .string()
    .max(50, 'Phone must be less than 50 characters')
    .optional()
    .nullable(),
  subject: z
    .string()
    .min(1, 'Subject is required')
    .max(255, 'Subject must be less than 255 characters'),
  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(5000, 'Message must be less than 5000 characters'),
});

// Update contact submission (admin)
export const updateContactSchema = z.object({
  status: contactStatusSchema.optional(),
  priority: contactPrioritySchema.optional(),
  assigned_to: z.string().uuid('Invalid user ID').optional().nullable(),
  admin_notes: z.string().max(5000, 'Admin notes must be less than 5000 characters').optional().nullable(),
});

// Bulk delete schema
export const bulkDeleteContactsSchema = z.object({
  ids: z
    .array(z.string().uuid('Invalid contact ID'))
    .min(1, 'At least one contact ID is required')
    .max(100, 'Cannot delete more than 100 contacts at once'),
});

// Bulk update status schema
export const bulkUpdateContactStatusSchema = z.object({
  ids: z
    .array(z.string().uuid('Invalid contact ID'))
    .min(1, 'At least one contact ID is required')
    .max(100, 'Cannot update more than 100 contacts at once'),
  status: contactStatusSchema,
});

// Export types
export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;
export type BulkDeleteContactsInput = z.infer<typeof bulkDeleteContactsSchema>;
export type BulkUpdateContactStatusInput = z.infer<typeof bulkUpdateContactStatusSchema>;
