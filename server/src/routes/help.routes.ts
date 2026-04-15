/**
 * Help Center Routes
 * Public routes for help article access
 */

import { Router } from 'express';
import { optionalAuth } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { helpFeedbackSchema } from '../validators/help.validator.js';
import {
  getPublicHelpArticles,
  getPublicHelpArticle,
  incrementViews,
  submitFeedback,
  getCategories,
} from '../controllers/help.controller.js';

const router = Router();

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

/**
 * Get help categories
 * GET /api/help/categories
 */
router.get('/categories', getCategories);

/**
 * Get published help articles
 * GET /api/help
 */
router.get('/', optionalAuth, getPublicHelpArticles);

/**
 * Increment help article view count
 * POST /api/help/:id/views
 */
router.post('/:id/views', incrementViews);

/**
 * Submit feedback on help article
 * POST /api/help/:id/feedback
 */
router.post('/:id/feedback', validate(helpFeedbackSchema), submitFeedback);

/**
 * Get single help article by slug
 * GET /api/help/:slug
 */
router.get('/:slug', optionalAuth, getPublicHelpArticle);

export default router;
