/**
 * Admin Blog Routes
 * Admin-only routes for blog management
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createBlogSchema,
  updateBlogSchema,
  bulkDeleteBlogsSchema,
  bulkUpdateStatusSchema,
  generateBlogSchema,
} from '../validators/blog.validator.js';
import {
  getAdminBlogs,
  getAdminBlogById,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  bulkDeleteBlogPosts,
  bulkUpdateBlogStatusPost,
  togglePublish,
  generateBlog,
} from '../controllers/blog.controller.js';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin'));

/**
 * Get all blogs (admin)
 * GET /api/admin/blogs
 */
router.get('/', getAdminBlogs);

/**
 * Get single blog by ID (admin)
 * GET /api/admin/blogs/:id
 */
router.get('/:id', getAdminBlogById);

/**
 * Generate blog with AI (admin)
 * POST /api/admin/blogs/generate
 */
router.post('/generate', validate(generateBlogSchema), generateBlog);

/**
 * Create blog (admin)
 * POST /api/admin/blogs
 */
router.post('/', validate(createBlogSchema), createBlogPost);

/**
 * Update blog (admin)
 * PUT /api/admin/blogs/:id
 * PATCH /api/admin/blogs/:id
 */
router.put('/:id', validate(updateBlogSchema), updateBlogPost);
router.patch('/:id', validate(updateBlogSchema), updateBlogPost);

/**
 * Delete blog (admin)
 * DELETE /api/admin/blogs/:id
 */
router.delete('/:id', deleteBlogPost);

/**
 * Bulk delete blogs (admin)
 * POST /api/admin/blogs/bulk-delete
 */
router.post('/bulk-delete', validate(bulkDeleteBlogsSchema), bulkDeleteBlogPosts);

/**
 * Bulk update blog status (admin)
 * POST /api/admin/blogs/bulk-publish
 */
router.post('/bulk-publish', validate(bulkUpdateStatusSchema), bulkUpdateBlogStatusPost);

/**
 * Toggle publish/unpublish status (admin)
 * POST /api/admin/blogs/:id/publish
 */
router.post('/:id/publish', togglePublish);

export default router;

