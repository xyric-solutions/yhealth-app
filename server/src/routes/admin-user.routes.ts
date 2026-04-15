/**
 * Admin User Routes
 * Admin-only routes for user management
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createUserSchema,
  updateUserSchema,
  bulkDeleteUsersSchema,
  bulkUpdateUserStatusSchema,
} from '../validators/user.validator.js';
import {
  getAdminUsers,
  getAdminUserById,
  getUserStatistics,
  createUserPost,
  updateUserPut,
  deleteUserDelete,
  bulkDeleteUsersPost,
  bulkUpdateUserStatusPost,
  toggleUserStatusPost,
} from '../controllers/user.controller.js';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin'));

/**
 * Get user statistics (admin)
 * GET /api/admin/users/stats
 */
router.get('/stats', getUserStatistics);

/**
 * Get all users (admin)
 * GET /api/admin/users
 */
router.get('/', getAdminUsers);

/**
 * Get single user by ID (admin)
 * GET /api/admin/users/:id
 */
router.get('/:id', getAdminUserById);

/**
 * Create user (admin)
 * POST /api/admin/users
 */
router.post('/', validate(createUserSchema), createUserPost);

/**
 * Update user (admin)
 * PUT /api/admin/users/:id
 * PATCH /api/admin/users/:id
 */
router.put('/:id', validate(updateUserSchema), updateUserPut);
router.patch('/:id', validate(updateUserSchema), updateUserPut);

/**
 * Delete user (admin)
 * DELETE /api/admin/users/:id
 */
router.delete('/:id', deleteUserDelete);

/**
 * Bulk delete users (admin)
 * POST /api/admin/users/bulk-delete
 */
router.post('/bulk-delete', validate(bulkDeleteUsersSchema), bulkDeleteUsersPost);

/**
 * Bulk update user status (admin)
 * POST /api/admin/users/bulk-status
 */
router.post('/bulk-status', validate(bulkUpdateUserStatusSchema), bulkUpdateUserStatusPost);

/**
 * Toggle user active status (admin)
 * POST /api/admin/users/:id/toggle-status
 */
router.post('/:id/toggle-status', toggleUserStatusPost);

export default router;
