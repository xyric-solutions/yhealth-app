/**
 * User Controller
 * Handles HTTP requests for user operations
 */

import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  bulkDeleteUsers,
  bulkUpdateUserStatus,
  toggleUserStatus,
  getUserStats,
  type CreateUserInput,
  type UpdateUserInput,
} from '../services/user.service.js';

/**
 * Get all users (admin)
 * GET /api/admin/users
 */
export const getAdminUsers = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const {
      page = '1',
      limit = '20',
      sort_by = 'created_at',
      sort_order = 'desc',
      role,
      is_active,
      is_email_verified,
      search,
      created_after,
      created_before,
      last_login_after,
      last_login_before,
    } = req.query;

    const filters = {
      ...(role && { role: role as string }),
      ...(is_active !== undefined && { is_active: is_active === 'true' }),
      ...(is_email_verified !== undefined && { is_email_verified: is_email_verified === 'true' }),
      ...(search && { search: search as string }),
      ...(created_after && { created_after: new Date(created_after as string) }),
      ...(created_before && { created_before: new Date(created_before as string) }),
      ...(last_login_after && { last_login_after: new Date(last_login_after as string) }),
      ...(last_login_before && { last_login_before: new Date(last_login_before as string) }),
    };

    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
      sort_by: sort_by as any,
      sort_order: sort_order as 'asc' | 'desc',
    };

    const result = await listUsers(filters, options);

    ApiResponse.paginated(
      res,
      result.users,
      {
        page: result.page,
        limit: result.limit,
        total: result.total,
      },
      'Users fetched successfully'
    );
  }
);

/**
 * Get user statistics (admin)
 * GET /api/admin/users/stats
 */
export const getUserStatistics = asyncHandler(
  async (_req: AuthenticatedRequest, res: Response) => {
    const stats = await getUserStats();
    ApiResponse.success(res, stats, 'User statistics fetched successfully');
  }
);

/**
 * Get single user by ID (admin)
 * GET /api/admin/users/:id
 */
export const getAdminUserById = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const user = await getUserById(id);

    if (!user) {
      throw ApiError.notFound('User not found');
    }

    ApiResponse.success(res, user, 'User fetched successfully');
  }
);

/**
 * Create user (admin)
 * POST /api/admin/users
 */
export const createUserPost = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const input: CreateUserInput = {
      ...req.body,
      date_of_birth: req.body.date_of_birth ? new Date(req.body.date_of_birth) : null,
    };

    const user = await createUser(input);
    const fullUser = await getUserById(user.id);
    ApiResponse.created(res, fullUser ?? user, 'User created successfully');
  }
);

/**
 * Update user (admin)
 * PUT /api/admin/users/:id
 * PATCH /api/admin/users/:id
 */
export const updateUserPut = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const input: UpdateUserInput = {
      ...req.body,
      date_of_birth: req.body.date_of_birth ? new Date(req.body.date_of_birth) : null,
    };

    await updateUser(id, input);
    const fullUser = await getUserById(id);
    ApiResponse.success(res, fullUser, 'User updated successfully');
  }
);

/**
 * Delete user (admin)
 * DELETE /api/admin/users/:id
 */
export const deleteUserDelete = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    await deleteUser(id);
    ApiResponse.success(res, null, 'User deleted successfully');
  }
);

/**
 * Bulk delete users (admin)
 * POST /api/admin/users/bulk-delete
 */
export const bulkDeleteUsersPost = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { ids } = req.body;
    await bulkDeleteUsers(ids);
    ApiResponse.success(res, null, `${ids.length} user(s) deleted successfully`);
  }
);

/**
 * Bulk update user status (admin)
 * POST /api/admin/users/bulk-status
 */
export const bulkUpdateUserStatusPost = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { ids, is_active } = req.body;
    await bulkUpdateUserStatus(ids, is_active);
    ApiResponse.success(
      res,
      null,
      `${ids.length} user(s) ${is_active ? 'activated' : 'deactivated'} successfully`
    );
  }
);

/**
 * Toggle user active status (admin)
 * POST /api/admin/users/:id/toggle-status
 */
export const toggleUserStatusPost = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const user = await toggleUserStatus(id);
    ApiResponse.success(
      res,
      user,
      `User ${user.is_active ? 'activated' : 'deactivated'} successfully`
    );
  }
);
