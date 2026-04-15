/**
 * Role Service
 * Handles role CRUD operations and permission management
 */

import { query } from '../database/pg.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from './logger.service.js';

// ============================================
// TYPES
// ============================================

export interface RoleRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  is_archived: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface RoleWithUserCount extends RoleRow {
  user_count: number;
}

export interface PermissionRow {
  id: string;
  slug: string;
  name: string;
  resource: string;
  action: string;
  description: string | null;
}

export interface RoleListFilters {
  search?: string;
  is_system?: boolean;
  is_active?: boolean;
  is_archived?: boolean;
}

export interface RoleListOptions {
  page?: number;
  limit?: number;
  sort_by?: 'name' | 'slug' | 'created_at' | 'user_count';
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedRoles {
  roles: RoleWithUserCount[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface CreateRoleInput {
  name: string;
  slug?: string;
  description?: string;
}

export interface UpdateRoleInput {
  name?: string;
  slug?: string;
  description?: string;
}

// ============================================
// ROLE CRUD
// ============================================

export async function listRoles(
  filters: RoleListFilters = {},
  options: RoleListOptions = {}
): Promise<PaginatedRoles> {
  const { search, is_system, is_active, is_archived } = filters;
  const {
    page = 1,
    limit = 20,
    sort_by = 'created_at',
    sort_order = 'desc',
  } = options;

  const offset = (page - 1) * limit;
  const conditions: string[] = [];
  const params: (string | number | boolean)[] = [];
  let paramIndex = 1;

  if (search) {
    conditions.push(`(r.name ILIKE $${paramIndex} OR r.slug ILIKE $${paramIndex})`);
    params.push(`%${search}%`);
    paramIndex++;
  }

  if (is_system !== undefined) {
    conditions.push(`r.is_system = $${paramIndex}`);
    params.push(is_system);
    paramIndex++;
  }

  if (is_active !== undefined) {
    // Only filter by is_active if explicitly requested
    // Note: This will fail if column doesn't exist, but that's expected
    // The migration should be run first
    conditions.push(`r.is_active = $${paramIndex}`);
    params.push(is_active);
    paramIndex++;
  }

  if (is_archived !== undefined) {
    // Only filter by is_archived if explicitly requested
    // Note: This will fail if column doesn't exist, but that's expected
    // The migration should be run first
    conditions.push(`r.is_archived = $${paramIndex}`);
    params.push(is_archived);
    paramIndex++;
  }
  // Don't add default is_archived filter - let it work without the column

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  const validSortColumns = ['name', 'slug', 'created_at', 'user_count'];
  const finalSortBy = validSortColumns.includes(sort_by) ? sort_by : 'created_at';
  const finalSortOrder = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const sortColumn = finalSortBy === 'user_count' ? 'user_count' : `r.${finalSortBy}`;

  // Query without is_active/is_archived first (columns may not exist yet)
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM roles r ${whereClause}`,
    params
  );
  
  let rolesResult;
  try {
    // Try to query with is_active/is_archived columns
    rolesResult = await query<RoleWithUserCount>(
      `SELECT r.id, r.name, r.slug, r.description, r.is_system, r.created_at, r.updated_at,
       r.is_active, r.is_archived,
       COUNT(u.id)::int as user_count
       FROM roles r
       LEFT JOIN users u ON u.role_id = r.id
       ${whereClause}
       GROUP BY r.id, r.name, r.slug, r.description, r.is_system, r.created_at, r.updated_at, r.is_active, r.is_archived
       ORDER BY ${sortColumn} ${finalSortOrder}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );
  } catch (error: any) {
    // If columns don't exist, query without them
    if (error?.message?.includes('does not exist') || error?.code === '42703') {
      rolesResult = await query<RoleWithUserCount>(
        `SELECT r.id, r.name, r.slug, r.description, r.is_system, r.created_at, r.updated_at,
         COUNT(u.id)::int as user_count
         FROM roles r
         LEFT JOIN users u ON u.role_id = r.id
         ${whereClause}
         GROUP BY r.id, r.name, r.slug, r.description, r.is_system, r.created_at, r.updated_at
         ORDER BY ${sortColumn} ${finalSortOrder}
         LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset]
      );
    } else {
      throw error;
    }
  }
  
  const total = parseInt(countResult.rows[0].count, 10);

  // Ensure is_active and is_archived exist (for backward compatibility before migration)
  const roles = rolesResult.rows.map(role => ({
    ...role,
    is_active: role.is_active ?? true,
    is_archived: role.is_archived ?? false,
  }));

  return {
    roles,
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
  };
}

export async function getRoleById(id: string): Promise<RoleWithUserCount | null> {
  // Query without is_active/is_archived first (columns may not exist yet)
  let result;
  try {
    // Try to query with is_active/is_archived columns
    result = await query<RoleWithUserCount>(
      `SELECT r.id, r.name, r.slug, r.description, r.is_system, r.created_at, r.updated_at,
       r.is_active, r.is_archived,
       COUNT(u.id)::int as user_count
       FROM roles r
       LEFT JOIN users u ON u.role_id = r.id
       WHERE r.id = $1
       GROUP BY r.id, r.name, r.slug, r.description, r.is_system, r.created_at, r.updated_at, r.is_active, r.is_archived`,
      [id]
    );
  } catch (error: any) {
    // If columns don't exist, query without them
    if (error?.message?.includes('does not exist') || error?.code === '42703') {
      result = await query<RoleWithUserCount>(
        `SELECT r.id, r.name, r.slug, r.description, r.is_system, r.created_at, r.updated_at,
         COUNT(u.id)::int as user_count
         FROM roles r
         LEFT JOIN users u ON u.role_id = r.id
         WHERE r.id = $1
         GROUP BY r.id, r.name, r.slug, r.description, r.is_system, r.created_at, r.updated_at`,
        [id]
      );
    } else {
      throw error;
    }
  }

  const role = result.rows[0];
  if (!role) return null;

  // Ensure is_active and is_archived exist (for backward compatibility before migration)
  return {
    ...role,
    is_active: role.is_active ?? true,
    is_archived: role.is_archived ?? false,
  };
}

export async function getRoleBySlug(slug: string): Promise<RoleRow | null> {
  const result = await query<RoleRow>(
    'SELECT * FROM roles WHERE slug = $1',
    [slug]
  );

  return result.rows[0] || null;
}

export async function createRole(input: CreateRoleInput): Promise<RoleRow> {
  const slug = input.slug || input.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const existing = await getRoleBySlug(slug);
  if (existing) {
    throw ApiError.conflict('Role with this slug already exists');
  }

  const result = await query<RoleRow>(
    `INSERT INTO roles (name, slug, description) VALUES ($1, $2, $3)
     RETURNING *`,
    [input.name, slug, input.description || null]
  );

  logger.info('Role created', { roleId: result.rows[0].id, slug });
  return result.rows[0];
}

export async function updateRole(id: string, input: UpdateRoleInput): Promise<RoleRow> {
  const existing = await getRoleById(id);
  if (!existing) {
    throw ApiError.notFound('Role not found');
  }

  // Allow updates to system roles (admin can modify everything)
  // Only prevent changing slug for system roles to maintain consistency
  if (existing.is_system && input.slug && input.slug !== existing.slug) {
    throw ApiError.forbidden('Cannot change slug of system roles');
  }

  if (input.slug && input.slug !== existing.slug) {
    const duplicate = await getRoleBySlug(input.slug);
    if (duplicate) {
      throw ApiError.conflict('Role with this slug already exists');
    }
  }

  const updates: string[] = [];
  const params: (string | null)[] = [];
  let paramIndex = 1;

  if (input.name !== undefined) {
    updates.push(`name = $${paramIndex}`);
    params.push(input.name);
    paramIndex++;
  }
  if (input.slug !== undefined) {
    updates.push(`slug = $${paramIndex}`);
    params.push(input.slug);
    paramIndex++;
  }
  if (input.description !== undefined) {
    updates.push(`description = $${paramIndex}`);
    params.push(input.description || null);
    paramIndex++;
  }

  if (updates.length === 0) {
    return existing;
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);

  const result = await query<RoleRow>(
    `UPDATE roles SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    params
  );

  logger.info('Role updated', { roleId: id });
  return result.rows[0];
}

export async function deleteRole(id: string): Promise<void> {
  const role = await getRoleById(id);
  if (!role) {
    throw ApiError.notFound('Role not found');
  }

  // Allow deleting system roles only if they have no users
  // Prevent deleting admin role if it has users (critical system protection)
  if (role.is_system && role.slug === 'admin' && role.user_count > 0) {
    throw ApiError.forbidden('Cannot delete admin role while users are assigned to it');
  }

  if (role.user_count > 0) {
    throw ApiError.conflict(`Cannot delete role with ${role.user_count} assigned user(s)`);
  }

  await query('DELETE FROM roles WHERE id = $1', [id]);
  logger.info('Role deleted', { roleId: id });
}

export async function bulkDeleteRoles(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const result = await query<{ id: string; slug: string; is_system: boolean; user_count: string }>(
    `SELECT r.id, r.slug, r.is_system, COUNT(u.id)::text as user_count
     FROM roles r
     LEFT JOIN users u ON u.role_id = r.id
     WHERE r.id = ANY($1)
     GROUP BY r.id, r.slug`,
    [ids]
  );

  const adminRolesWithUsers = result.rows.filter((r) => r.is_system && r.slug === 'admin' && parseInt(r.user_count, 10) > 0);
  const withUsers = result.rows.filter((r) => parseInt(r.user_count, 10) > 0);

  if (adminRolesWithUsers.length > 0) {
    throw ApiError.forbidden('Cannot delete admin role while users are assigned to it');
  }
  if (withUsers.length > 0) {
    throw ApiError.conflict('Cannot delete roles with assigned users');
  }

  await query('DELETE FROM roles WHERE id = ANY($1)', [ids]);
  logger.info('Roles bulk deleted', { count: ids.length });
}

// ============================================
// ROLE STATUS MANAGEMENT
// ============================================

export async function toggleRoleStatus(id: string): Promise<RoleRow> {
  const role = await getRoleById(id);
  if (!role) {
    throw ApiError.notFound('Role not found');
  }

  // Prevent deactivating admin role (system protection)
  if (role.is_system && role.slug === 'admin' && role.is_active) {
    throw ApiError.forbidden('Cannot deactivate admin role');
  }

  // If role doesn't have is_active field yet, default to true
  const currentStatus = role.is_active ?? true;

  // Try to update is_active column
  let result;
  try {
    result = await query<RoleRow>(
      'UPDATE roles SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [!currentStatus, id]
    );
    
    // Ensure is_active and is_archived are in the result
    if (result.rows[0]) {
      result.rows[0] = {
        ...result.rows[0],
        is_active: result.rows[0].is_active ?? !currentStatus,
        is_archived: result.rows[0].is_archived ?? false,
      };
    }
  } catch (error: any) {
    // If column doesn't exist, we need to run the migration first
    if (error?.message?.includes('column "is_active" does not exist') || error?.code === '42703') {
      throw ApiError.badRequest('Database migration required. Please run the migration to add is_active and is_archived columns to the roles table.');
    }
    throw error;
  }

  logger.info('Role status toggled', { roleId: id, is_active: result.rows[0].is_active });
  return result.rows[0];
}

export async function archiveRole(id: string): Promise<RoleRow> {
  const role = await getRoleById(id);
  if (!role) {
    throw ApiError.notFound('Role not found');
  }

  // Allow archiving system roles only if they have no users
  // Prevent archiving admin role if it has users (critical system protection)
  if (role.is_system && role.slug === 'admin' && role.user_count > 0) {
    throw ApiError.forbidden('Cannot archive admin role while users are assigned to it');
  }

  if (role.user_count > 0) {
    throw ApiError.conflict(`Cannot archive role with ${role.user_count} assigned user(s)`);
  }

  let result;
  try {
    result = await query<RoleRow>(
      'UPDATE roles SET is_archived = true, is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    
    // Ensure is_active and is_archived are in the result
    if (result.rows[0]) {
      result.rows[0] = {
        ...result.rows[0],
        is_active: result.rows[0].is_active ?? false,
        is_archived: result.rows[0].is_archived ?? true,
      };
    }
  } catch (error: any) {
    if (error?.message?.includes('column "is_archived" does not exist') || error?.code === '42703') {
      throw ApiError.badRequest('Database migration required. Please run the migration to add is_active and is_archived columns to the roles table.');
    }
    throw error;
  }

  logger.info('Role archived', { roleId: id });
  return result.rows[0];
}

export async function unarchiveRole(id: string): Promise<RoleRow> {
  const role = await getRoleById(id);
  if (!role) {
    throw ApiError.notFound('Role not found');
  }

  let result;
  try {
    result = await query<RoleRow>(
      'UPDATE roles SET is_archived = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );
    
    // Ensure is_active and is_archived are in the result
    if (result.rows[0]) {
      result.rows[0] = {
        ...result.rows[0],
        is_active: result.rows[0].is_active ?? true,
        is_archived: result.rows[0].is_archived ?? false,
      };
    }
  } catch (error: any) {
    if (error?.message?.includes('column "is_archived" does not exist') || error?.code === '42703') {
      throw ApiError.badRequest('Database migration required. Please run the migration to add is_active and is_archived columns to the roles table.');
    }
    throw error;
  }

  logger.info('Role unarchived', { roleId: id });
  return result.rows[0];
}

export async function bulkArchiveRoles(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const result = await query<{ id: string; slug: string; is_system: boolean; user_count: string }>(
    `SELECT r.id, r.slug, r.is_system, COUNT(u.id)::text as user_count
     FROM roles r
     LEFT JOIN users u ON u.role_id = r.id
     WHERE r.id = ANY($1)
     GROUP BY r.id, r.slug`,
    [ids]
  );

  const adminRolesWithUsers = result.rows.filter((r) => r.is_system && r.slug === 'admin' && parseInt(r.user_count, 10) > 0);
  const withUsers = result.rows.filter((r) => parseInt(r.user_count, 10) > 0);

  if (adminRolesWithUsers.length > 0) {
    throw ApiError.forbidden('Cannot archive admin role while users are assigned to it');
  }
  if (withUsers.length > 0) {
    throw ApiError.conflict('Cannot archive roles with assigned users');
  }

  try {
    await query(
      'UPDATE roles SET is_archived = true, is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($1)',
      [ids]
    );
  } catch (error: any) {
    if (error?.message?.includes('column "is_archived" does not exist')) {
      throw ApiError.badRequest('Database migration required. Please run the migration to add is_active and is_archived columns to the roles table.');
    }
    throw error;
  }
  logger.info('Roles bulk archived', { count: ids.length });
}

// ============================================
// PERMISSIONS
// ============================================

export async function getRolePermissions(roleId: string): Promise<PermissionRow[]> {
  const result = await query<PermissionRow>(
    `SELECT p.* FROM permissions p
     INNER JOIN role_permissions rp ON rp.permission_id = p.id
     WHERE rp.role_id = $1
     ORDER BY p.resource, p.action`,
    [roleId]
  );

  return result.rows;
}

export async function updateRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
  const role = await getRoleById(roleId);
  if (!role) {
    throw ApiError.notFound('Role not found');
  }

  if (role.is_system && role.slug === 'admin') {
    throw ApiError.forbidden('Cannot modify admin role permissions');
  }

  await query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

  if (permissionIds.length > 0) {
    const values = permissionIds.map((_, i) => `($1, $${i + 2})`).join(', ');
    const params = [roleId, ...permissionIds];
    await query(
      `INSERT INTO role_permissions (role_id, permission_id) VALUES ${values}`,
      params
    );
  }

  logger.info('Role permissions updated', { roleId });
}

export async function getRoleStats(): Promise<{ total: number; by_role: Record<string, number> }> {
  const result = await query<{ slug: string; count: string }>(
    `SELECT r.slug, COUNT(u.id)::text as count
     FROM roles r
     LEFT JOIN users u ON u.role_id = r.id
     GROUP BY r.id, r.slug`
  );

  const by_role: Record<string, number> = {};
  let total = 0;
  result.rows.forEach((row) => {
    const count = parseInt(row.count, 10);
    by_role[row.slug] = count;
    total += count;
  });

  return { total, by_role };
}
