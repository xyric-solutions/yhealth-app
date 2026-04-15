/**
 * Community Routes
 * Public and authenticated routes for community features
 */

import { Router } from 'express';
import { authenticate, optionalAuth } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createCommunityPostSchema,
  communityReplySchema,
} from '../validators/community.validator.js';
import {
  getPublicCommunityPosts,
  getPublicCommunityPost,
  incrementCommunityViews,
  likePost,
  getPostReplies,
  createPostReply,
  createCommunityPostHandler,
  getCommunityPostCategories,
} from '../controllers/community.controller.js';

const router = Router();

// ============================================
// PUBLIC ROUTES
// ============================================

/**
 * Get community categories
 * GET /api/community/categories
 */
router.get('/categories', getCommunityPostCategories);

/**
 * Get published community posts
 * GET /api/community
 */
router.get('/', optionalAuth, getPublicCommunityPosts);

/**
 * Increment post view count
 * POST /api/community/:id/views
 */
router.post('/:id/views', incrementCommunityViews);

/**
 * Get replies for a post
 * GET /api/community/:id/replies
 */
router.get('/:id/replies', optionalAuth, getPostReplies);

// ============================================
// AUTHENTICATED ROUTES
// ============================================

/**
 * Create a community post (authenticated)
 * POST /api/community
 */
router.post('/', authenticate, validate(createCommunityPostSchema), createCommunityPostHandler);

/**
 * Like a post (authenticated)
 * POST /api/community/:id/like
 */
router.post('/:id/like', authenticate, likePost);

/**
 * Create a reply (authenticated)
 * POST /api/community/:id/replies
 */
router.post('/:id/replies', authenticate, validate(communityReplySchema), createPostReply);

/**
 * Get community post by slug
 * GET /api/community/:slug
 */
router.get('/:slug', optionalAuth, getPublicCommunityPost);

export default router;
