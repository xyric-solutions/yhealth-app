/**
 * Blog Routes
 * Public and admin routes for blog management
 */

import { Router } from 'express';
import { authenticate, optionalAuth } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  blogReactionSchema,
} from '../validators/blog.validator.js';
import {
  getPublicBlogs,
  getPublicBlogBySlug,
  incrementViews,
  toggleReaction,
  getReactions,
} from '../controllers/blog.controller.js';

const router = Router();

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

/**
 * Get published blogs
 * GET /api/blogs
 */
router.get('/', optionalAuth, getPublicBlogs);

/**
 * Increment blog view count (must come before :slug route)
 * POST /api/blogs/:id/views
 */
router.post('/:id/views', incrementViews);

/**
 * Toggle blog reaction (like/dislike) - requires authentication
 * POST /api/blogs/:id/reactions
 */
router.post('/:id/reactions', authenticate, validate(blogReactionSchema), toggleReaction);

/**
 * Get blog reactions - optional authentication
 * GET /api/blogs/:id/reactions
 */
router.get('/:id/reactions', optionalAuth, getReactions);

/**
 * Get single blog by slug
 * GET /api/blogs/:slug
 */
router.get('/:slug', optionalAuth, getPublicBlogBySlug);

export default router;

