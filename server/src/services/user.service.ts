/**
 * User Service
 * Handles user CRUD operations, filtering, and admin management
 */

import { query } from '../database/pg.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from './logger.service.js';
import type { UserRow } from '../database/schemas/user.schemas.js';

// ============================================
// TYPES
// ============================================

export interface UserWithStats extends UserRow {
  blog_count?: number;
  last_activity?: Date | null;
}

export interface UserListFilters {
  role?: string;
  is_active?: boolean;
  is_email_verified?: boolean;
  search?: string;
  created_after?: Date;
  created_before?: Date;
  last_login_after?: Date;
  last_login_before?: Date;
}

export interface UserListOptions {
  page?: number;
  limit?: number;
  sort_by?: 'created_at' | 'updated_at' | 'last_login' | 'email' | 'first_name' | 'last_name' | 'role';
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedUsers {
  users: UserWithStats[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface CreateUserInput {
  email: string;
  password?: string;
  first_name: string;
  last_name: string;
  role_id?: string;
  is_active?: boolean;
  phone?: string;
  date_of_birth?: Date | null;
  gender?: string | null;
}

export interface UpdateUserInput {
  email?: string;
  first_name?: string;
  last_name?: string;
  role_id?: string;
  is_active?: boolean;
  is_email_verified?: boolean;
  phone?: string;
  date_of_birth?: Date | null;
  gender?: string | null;
  avatar?: string | null;
}

// ============================================
// CRUD OPERATIONS
// ============================================

/**
 * List users with filters and pagination
 */
export async function listUsers(
  filters: UserListFilters = {},
  options: UserListOptions = {}
): Promise<PaginatedUsers> {
  const {
    role,
    is_active,
    is_email_verified,
    search,
    created_after,
    created_before,
    last_login_after,
    last_login_before,
  } = filters;

  const {
    page = 1,
    limit = 20,
    sort_by = 'created_at',
    sort_order = 'desc',
  } = options;

  const offset = (page - 1) * limit;

  // Build WHERE clause
  const conditions: string[] = [];
  const params: (string | number | Date | boolean)[] = [];
  let paramIndex = 1;

  if (role) {
    conditions.push(`r.slug = $${paramIndex}`);
    params.push(role);
    paramIndex++;
  }

  if (is_active !== undefined) {
    conditions.push(`u.is_active = $${paramIndex}`);
    params.push(is_active);
    paramIndex++;
  }

  if (is_email_verified !== undefined) {
    conditions.push(`u.is_email_verified = $${paramIndex}`);
    params.push(is_email_verified);
    paramIndex++;
  }

  if (created_after) {
    conditions.push(`u.created_at >= $${paramIndex}`);
    params.push(created_after);
    paramIndex++;
  }

  if (created_before) {
    conditions.push(`u.created_at <= $${paramIndex}`);
    params.push(created_before);
    paramIndex++;
  }

  if (last_login_after) {
    conditions.push(`u.last_login >= $${paramIndex}`);
    params.push(last_login_after);
    paramIndex++;
  }

  if (last_login_before) {
    conditions.push(`u.last_login <= $${paramIndex}`);
    params.push(last_login_before);
    paramIndex++;
  }

  if (search) {
    conditions.push(
      `(
        u.email ILIKE $${paramIndex} OR
        u.first_name ILIKE $${paramIndex} OR
        u.last_name ILIKE $${paramIndex} OR
        CONCAT(u.first_name, ' ', u.last_name) ILIKE $${paramIndex} OR
        u.phone ILIKE $${paramIndex}
      )`
    );
    params.push(`%${search}%`);
    paramIndex++;
  }

  const roleJoin = role ? 'INNER JOIN roles r ON u.role_id = r.id' : 'LEFT JOIN roles r ON u.role_id = r.id';
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Validate sort_by
  const validSortColumns = ['created_at', 'updated_at', 'last_login', 'email', 'first_name', 'last_name', 'role'];
  const finalSortBy = validSortColumns.includes(sort_by) ? sort_by : 'created_at';
  const finalSortOrder = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const sortColumn = finalSortBy === 'role' ? 'r.slug' : `u.${finalSortBy}`;

  // Get total count
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM users u ${roleJoin} ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Get users with blog count and role
  const usersResult = await query<UserWithStats>(
    `SELECT
      u.*,
      r.slug as role,
      COUNT(DISTINCT b.id) as blog_count
    FROM users u
    ${roleJoin}
    LEFT JOIN blogs b ON u.id = b.author_id
    ${whereClause}
    GROUP BY u.id, r.slug
    ORDER BY ${sortColumn} ${finalSortOrder}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...params, limit, offset]
  );

  // Parse blog_count as number
  const users = usersResult.rows.map((user) => ({
    ...user,
    blog_count: user.blog_count ? parseInt(String(user.blog_count), 10) : 0,
  }));

  return {
    users,
    total,
    page,
    limit,
    total_pages: Math.ceil(total / limit),
  };
}

/**
 * Get user by ID
 */
export async function getUserById(id: string): Promise<UserWithStats | null> {
  const result = await query<UserWithStats>(
    `SELECT
      u.*,
      r.slug as role,
      COUNT(DISTINCT b.id) as blog_count
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN blogs b ON u.id = b.author_id
    WHERE u.id = $1
    GROUP BY u.id, r.slug`,
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const user = result.rows[0];
  return {
    ...user,
    blog_count: user.blog_count ? parseInt(String(user.blog_count), 10) : 0,
  };
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const result = await query<UserRow>(
    'SELECT * FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  return result.rows.length > 0 ? result.rows[0] : null;
}

const DEFAULT_USER_ROLE_ID = '11111111-1111-1111-1111-111111111101';

/**
 * Create a new user
 */
export async function createUser(input: CreateUserInput): Promise<UserRow> {
  const {
    email,
    password,
    first_name,
    last_name,
    role_id = DEFAULT_USER_ROLE_ID,
    is_active = true,
    phone,
    date_of_birth,
    gender,
  } = input;

  // Check if email already exists
  const existingUser = await getUserByEmail(email);
  if (existingUser) {
    throw ApiError.conflict('User with this email already exists');
  }

  // Hash password if provided
  let hashedPassword: string | null = null;
  if (password) {
    const { hashPassword } = await import('../helper/encryption.js');
    hashedPassword = await hashPassword(password);
  }

  const result = await query<UserRow>(
    `INSERT INTO users (
      email, password, first_name, last_name, role_id, is_active,
      phone, date_of_birth, gender
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *`,
    [email.toLowerCase(), hashedPassword, first_name, last_name, role_id, is_active, phone || null, date_of_birth || null, gender || null]
  );

  logger.info('User created', { userId: result.rows[0].id, email });
  return result.rows[0];
}

/**
 * Update user
 */
export async function updateUser(id: string, input: UpdateUserInput): Promise<UserRow> {
  const existingUser = await getUserById(id);
  if (!existingUser) {
    throw ApiError.notFound('User not found');
  }

  const {
    email,
    first_name,
    last_name,
    role_id,
    is_active,
    is_email_verified,
    phone,
    date_of_birth,
    gender,
    avatar,
  } = input;

  // Check email uniqueness if email is being updated
  if (email && email.toLowerCase() !== existingUser.email.toLowerCase()) {
    const emailUser = await getUserByEmail(email);
    if (emailUser && emailUser.id !== id) {
      throw ApiError.conflict('User with this email already exists');
    }
  }

  // Build update query dynamically
  const updates: string[] = [];
  const params: (string | number | Date | boolean | null)[] = [];
  let paramIndex = 1;

  if (email !== undefined) {
    updates.push(`email = $${paramIndex}`);
    params.push(email.toLowerCase());
    paramIndex++;
  }

  if (first_name !== undefined) {
    updates.push(`first_name = $${paramIndex}`);
    params.push(first_name);
    paramIndex++;
  }

  if (last_name !== undefined) {
    updates.push(`last_name = $${paramIndex}`);
    params.push(last_name);
    paramIndex++;
  }

  if (role_id !== undefined) {
    updates.push(`role_id = $${paramIndex}`);
    params.push(role_id);
    paramIndex++;
  }

  if (is_active !== undefined) {
    updates.push(`is_active = $${paramIndex}`);
    params.push(is_active);
    paramIndex++;
  }

  if (is_email_verified !== undefined) {
    updates.push(`is_email_verified = $${paramIndex}`);
    params.push(is_email_verified);
    paramIndex++;
  }

  if (phone !== undefined) {
    updates.push(`phone = $${paramIndex}`);
    params.push(phone || null);
    paramIndex++;
  }

  if (date_of_birth !== undefined) {
    updates.push(`date_of_birth = $${paramIndex}`);
    params.push(date_of_birth || null);
    paramIndex++;
  }

  if (gender !== undefined) {
    updates.push(`gender = $${paramIndex}`);
    params.push(gender || null);
    paramIndex++;
  }

  if (avatar !== undefined) {
    updates.push(`avatar = $${paramIndex}`);
    params.push(avatar || null);
    paramIndex++;
  }

  if (updates.length === 0) {
    return existingUser;
  }

  updates.push(`updated_at = CURRENT_TIMESTAMP`);
  params.push(id);

  const result = await query<UserRow>(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    params
  );

  logger.info('User updated', { userId: id });
  return result.rows[0];
}

/**
 * Delete user
 */
export async function deleteUser(id: string): Promise<void> {
  const user = await getUserById(id);
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  await query('DELETE FROM users WHERE id = $1', [id]);
  logger.info('User deleted', { userId: id });
}

/**
 * Bulk delete users
 */
export async function bulkDeleteUsers(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  await query('DELETE FROM users WHERE id = ANY($1)', [ids]);
  logger.info('Users bulk deleted', { count: ids.length });
}

/**
 * Bulk update user status
 */
export async function bulkUpdateUserStatus(ids: string[], is_active: boolean): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  await query('UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($2)', [
    is_active,
    ids,
  ]);
  logger.info('Users bulk status updated', { count: ids.length, is_active });
}

/**
 * Toggle user active status
 */
export async function toggleUserStatus(id: string): Promise<UserRow> {
  const user = await getUserById(id);
  if (!user) {
    throw ApiError.notFound('User not found');
  }

  const result = await query<UserRow>(
    'UPDATE users SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
    [id]
  );

  logger.info('User status toggled', { userId: id, is_active: result.rows[0].is_active });
  return result.rows[0];
}

/**
 * Get user statistics
 */
export async function getUserStats(): Promise<{
  total: number;
  active: number;
  inactive: number;
  verified: number;
  unverified: number;
  by_role: Record<string, number>;
}> {
  const [totalResult, activeResult, verifiedResult, roleResult] = await Promise.all([
    query<{ count: string }>('SELECT COUNT(*) as count FROM users'),
    query<{ count: string }>('SELECT COUNT(*) as count FROM users WHERE is_active = true'),
    query<{ count: string }>('SELECT COUNT(*) as count FROM users WHERE is_email_verified = true'),
    query<{ slug: string; count: string }>(
      'SELECT r.slug, COUNT(u.id)::text as count FROM users u JOIN roles r ON u.role_id = r.id GROUP BY r.slug'
    ),
  ]);

  const by_role: Record<string, number> = {};
  roleResult.rows.forEach((row) => {
    by_role[row.slug] = parseInt(row.count, 10);
  });

  return {
    total: parseInt(totalResult.rows[0].count, 10),
    active: parseInt(activeResult.rows[0].count, 10),
    inactive: parseInt(totalResult.rows[0].count, 10) - parseInt(activeResult.rows[0].count, 10),
    verified: parseInt(verifiedResult.rows[0].count, 10),
    unverified: parseInt(totalResult.rows[0].count, 10) - parseInt(verifiedResult.rows[0].count, 10),
    by_role,
  };
}
