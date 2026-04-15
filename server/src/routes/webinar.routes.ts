/**
 * Webinar Routes
 * Public routes for webinar access and registration
 */

import { Router } from 'express';
import { optionalAuth } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { webinarRegistrationSchema } from '../validators/webinar.validator.js';
import {
  getPublicWebinars,
  getPublicWebinar,
  registerForWebinarHandler,
  getWebinarCategoriesHandler,
} from '../controllers/webinar.controller.js';

const router = Router();

// ============================================
// PUBLIC ROUTES
// ============================================

/**
 * Get webinar categories
 * GET /api/webinars/categories
 */
router.get('/categories', getWebinarCategoriesHandler);

/**
 * Get public webinars
 * GET /api/webinars
 */
router.get('/', optionalAuth, getPublicWebinars);

/**
 * Register for a webinar
 * POST /api/webinars/:id/register
 */
router.post('/:id/register', optionalAuth, validate(webinarRegistrationSchema), registerForWebinarHandler);

/**
 * Get webinar by slug
 * GET /api/webinars/:slug
 */
router.get('/:slug', optionalAuth, getPublicWebinar);

export default router;
