/**
 * Role Controller
 * Handles HTTP requests for role management
 */

import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import {
  listRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  bulkDeleteRoles,
  getRolePermissions,
  updateRolePermissions,
  getRoleStats,
  toggleRoleStatus,
  archiveRole,
  unarchiveRole,
  bulkArchiveRoles,
} from '../services/role.service.js';
import { listPermissionsGroupedByResource } from '../services/permission.service.js';

/**
 * Get all roles (admin)
 * GET /api/admin/roles
 */
export const getRoles = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const {
      page = '1',
      limit = '20',
      sort_by = 'created_at',
      sort_order = 'desc',
      search,
      is_system,
    } = req.query;

    const filters = {
      ...(search && { search: search as string }),
      ...(is_system !== undefined && { is_system: is_system === 'true' }),
    };

    const options = {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
      sort_by: (sort_by as 'name' | 'slug' | 'created_at' | 'user_count') || 'created_at',
      sort_order: (sort_order as 'asc' | 'desc') || 'desc',
    };

    const result = await listRoles(filters, options);

    ApiResponse.paginated(
      res,
      result.roles,
      {
        page: result.page,
        limit: result.limit,
        total: result.total,
      },
      'Roles fetched successfully'
    );
  }
);

/**
 * Get all permissions (admin)
 * GET /api/admin/roles/permissions
 */
export const getAllPermissions = asyncHandler(
  async (_req: AuthenticatedRequest, res: Response) => {
    const permissions = await listPermissionsGroupedByResource();
    ApiResponse.success(res, permissions, 'Permissions fetched successfully');
  }
);

/**
 * Get role statistics (admin)
 * GET /api/admin/roles/stats
 */
export const getRoleStatistics = asyncHandler(
  async (_req: AuthenticatedRequest, res: Response) => {
    const stats = await getRoleStats();
    ApiResponse.success(res, stats, 'Role statistics fetched successfully');
  }
);

/**
 * Get single role by ID (admin)
 * GET /api/admin/roles/:id
 */
export const getRoleByIdHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const role = await getRoleById(id);

    if (!role) {
      throw ApiError.notFound('Role not found');
    }

    ApiResponse.success(res, role, 'Role fetched successfully');
  }
);

/**
 * Get role permissions (admin)
 * GET /api/admin/roles/:id/permissions
 */
export const getRolePermissionsHandler = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const role = await getRoleById(id);

    if (!role) {
      throw ApiError.notFound('Role not found');
    }

    const permissions = await getRolePermissions(id);
    ApiResponse.success(res, permissions, 'Role permissions fetched successfully');
  }
);

/**
 * Create role (admin)
 * POST /api/admin/roles
 */
export const createRolePost = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const role = await createRole(req.body);
    ApiResponse.created(res, role, 'Role created successfully');
  }
);

/**
 * Update role (admin)
 * PUT /api/admin/roles/:id
 */
export const updateRolePut = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const role = await updateRole(id, req.body);
    ApiResponse.success(res, role, 'Role updated successfully');
  }
);

/**
 * Update role permissions (admin)
 * PUT /api/admin/roles/:id/permissions
 */
export const updateRolePermissionsPut = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { permission_ids } = req.body;
    await updateRolePermissions(id, permission_ids || []);
    ApiResponse.success(res, null, 'Role permissions updated successfully');
  }
);

/**
 * Delete role (admin)
 * DELETE /api/admin/roles/:id
 */
export const deleteRoleDelete = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    await deleteRole(id);
    ApiResponse.success(res, null, 'Role deleted successfully');
  }
);

/**
 * Bulk delete roles (admin)
 * POST /api/admin/roles/bulk-delete
 */
export const bulkDeleteRolesPost = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { ids } = req.body;
    await bulkDeleteRoles(ids);
    ApiResponse.success(res, null, `${ids.length} role(s) deleted successfully`);
  }
);

/**
 * Toggle role active status (admin)
 * POST /api/admin/roles/:id/toggle-status
 */
export const toggleRoleStatusPost = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const role = await toggleRoleStatus(id);
    ApiResponse.success(
      res,
      role,
      `Role ${role.is_active ? 'activated' : 'deactivated'} successfully`
    );
  }
);

/**
 * Archive role (admin)
 * POST /api/admin/roles/:id/archive
 */
export const archiveRolePost = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const role = await archiveRole(id);
    ApiResponse.success(res, role, 'Role archived successfully');
  }
);

/**
 * Unarchive role (admin)
 * POST /api/admin/roles/:id/unarchive
 */
export const unarchiveRolePost = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const role = await unarchiveRole(id);
    ApiResponse.success(res, role, 'Role unarchived successfully');
  }
);

/**
 * Bulk archive roles (admin)
 * POST /api/admin/roles/bulk-archive
 */
export const bulkArchiveRolesPost = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { ids } = req.body;
    await bulkArchiveRoles(ids);
    ApiResponse.success(res, null, `${ids.length} role(s) archived successfully`);
  }
);
