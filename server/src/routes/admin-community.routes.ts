/**
 * Admin Community Routes
 * Admin-only routes for community management
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createAdminCommunityPostSchema,
  updateCommunityPostSchema,
  bulkDeleteCommunitySchema,
  generateCommunityPostSchema,
} from '../validators/community.validator.js';
import {
  getAdminCommunityPosts,
  getAdminCommunityPost,
  createAdminCommunityPostHandler,
  updateCommunityPostHandler,
  deleteCommunityPostHandler,
  deleteReplyHandler,
  bulkDeleteCommunityPostsHandler,
  getCommunityStatsHandler,
  generateCommunityPost,
} from '../controllers/community.controller.js';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin'));

/**
 * Get community stats (admin)
 * GET /api/admin/community/stats
 */
router.get('/stats', getCommunityStatsHandler);

/**
 * Get all community posts (admin)
 * GET /api/admin/community
 */
router.get('/', getAdminCommunityPosts);

/**
 * Create community post (admin)
 * POST /api/admin/community
 */
router.post('/', validate(createAdminCommunityPostSchema), createAdminCommunityPostHandler);

/**
 * Generate community post with AI (admin)
 * POST /api/admin/community/generate
 */
router.post('/generate', validate(generateCommunityPostSchema), generateCommunityPost);

/**
 * Get single community post by ID (admin)
 * GET /api/admin/community/:id
 */
router.get('/:id', getAdminCommunityPost);

/**
 * Update community post (admin)
 * PUT /api/admin/community/:id
 * PATCH /api/admin/community/:id
 */
router.put('/:id', validate(updateCommunityPostSchema), updateCommunityPostHandler);
router.patch('/:id', validate(updateCommunityPostSchema), updateCommunityPostHandler);

/**
 * Delete community post (admin)
 * DELETE /api/admin/community/:id
 */
router.delete('/:id', deleteCommunityPostHandler);

/**
 * Delete a reply (admin)
 * DELETE /api/admin/community/replies/:id
 */
router.delete('/replies/:id', deleteReplyHandler);

/**
 * Bulk delete community posts (admin)
 * POST /api/admin/community/bulk-delete
 */
router.post('/bulk-delete', validate(bulkDeleteCommunitySchema), bulkDeleteCommunityPostsHandler);

export default router;
