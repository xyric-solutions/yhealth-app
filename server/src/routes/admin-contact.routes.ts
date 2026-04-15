/**
 * Admin Contact Routes
 * Admin-only routes for contact submission management
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  updateContactSchema,
  bulkDeleteContactsSchema,
  bulkUpdateContactStatusSchema,
} from '../validators/contact.validator.js';
import {
  getAdminContacts,
  getAdminContactById,
  getContactStatistics,
  updateContactSubmission,
  deleteContactSubmission,
  bulkDeleteContactsPost,
  bulkUpdateContactStatusPost,
  sendContactReply,
} from '../controllers/contact.controller.js';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin'));

/**
 * Get contact statistics (admin)
 * GET /api/admin/contacts/stats
 */
router.get('/stats', getContactStatistics);

/**
 * Get all contact submissions (admin)
 * GET /api/admin/contacts
 */
router.get('/', getAdminContacts);

/**
 * Get single contact by ID (admin)
 * GET /api/admin/contacts/:id
 */
router.get('/:id', getAdminContactById);

/**
 * Update contact submission (admin)
 * PATCH /api/admin/contacts/:id
 */
router.patch('/:id', validate(updateContactSchema), updateContactSubmission);

/**
 * Delete contact submission (admin)
 * DELETE /api/admin/contacts/:id
 */
router.delete('/:id', deleteContactSubmission);

/**
 * Bulk delete contacts (admin)
 * POST /api/admin/contacts/bulk-delete
 */
router.post('/bulk-delete', validate(bulkDeleteContactsSchema), bulkDeleteContactsPost);

/**
 * Bulk update contact status (admin)
 * POST /api/admin/contacts/bulk-status
 */
router.post('/bulk-status', validate(bulkUpdateContactStatusSchema), bulkUpdateContactStatusPost);

/**
 * Send reply email to contact (admin)
 * POST /api/admin/contacts/:id/reply
 */
router.post('/:id/reply', sendContactReply);

export default router;
