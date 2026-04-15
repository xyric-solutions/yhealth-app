/**
 * Admin Webinar Routes
 * Admin-only routes for webinar management
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createWebinarSchema,
  updateWebinarSchema,
  bulkDeleteWebinarsSchema,
  generateWebinarSchema,
} from '../validators/webinar.validator.js';
import {
  getAdminWebinars,
  getAdminWebinar,
  createWebinarHandler,
  updateWebinarHandler,
  deleteWebinarHandler,
  getWebinarRegistrationsHandler,
  bulkDeleteWebinarsHandler,
  getWebinarStatsHandler,
  generateWebinar,
} from '../controllers/webinar.controller.js';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin'));

/**
 * Get webinar stats (admin)
 * GET /api/admin/webinars/stats
 */
router.get('/stats', getWebinarStatsHandler);

/**
 * Get all webinars (admin)
 * GET /api/admin/webinars
 */
router.get('/', getAdminWebinars);

/**
 * Generate webinar content with AI (admin)
 * POST /api/admin/webinars/generate
 */
router.post('/generate', validate(generateWebinarSchema), generateWebinar);

/**
 * Get single webinar by ID (admin)
 * GET /api/admin/webinars/:id
 */
router.get('/:id', getAdminWebinar);

/**
 * Get webinar registrations (admin)
 * GET /api/admin/webinars/:id/registrations
 */
router.get('/:id/registrations', getWebinarRegistrationsHandler);

/**
 * Create webinar (admin)
 * POST /api/admin/webinars
 */
router.post('/', validate(createWebinarSchema), createWebinarHandler);

/**
 * Update webinar (admin)
 * PUT /api/admin/webinars/:id
 * PATCH /api/admin/webinars/:id
 */
router.put('/:id', validate(updateWebinarSchema), updateWebinarHandler);
router.patch('/:id', validate(updateWebinarSchema), updateWebinarHandler);

/**
 * Delete webinar (admin)
 * DELETE /api/admin/webinars/:id
 */
router.delete('/:id', deleteWebinarHandler);

/**
 * Bulk delete webinars (admin)
 * POST /api/admin/webinars/bulk-delete
 */
router.post('/bulk-delete', validate(bulkDeleteWebinarsSchema), bulkDeleteWebinarsHandler);

export default router;
