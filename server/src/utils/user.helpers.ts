/**
 * @file User helper functions
 * @description Reusable utilities for user operations
 */

import type { PoolClient } from 'pg';
import { query } from '../database/pg.js';
import { generateTokens } from '../middlewares/auth.middleware.js';
import { ApiError } from './ApiError.js';
import { r2Service } from '../services/r2.service.js';
import type {
  UserRow,
  ConsentRow,
  MappedUser,
  PublicUserProfile,
} from '../database/schemas/index.js';

export const CONSENT_VERSION = '1.0.0';

/**
 * Convert snake_case database row to camelCase user object
 */
export function mapUserRow(row: UserRow & { role?: string }): MappedUser {
  return {
    id: row.id,
    email: row.email,
    password: row.password,
    firstName: row.first_name,
    lastName: row.last_name,
    dateOfBirth: row.date_of_birth,
    gender: row.gender,
    role: row.role ?? 'user', // slug from roles join, fallback for legacy
    isActive: row.is_active,
    isEmailVerified: row.is_email_verified,
    avatar: row.avatar,
    phone: row.phone,
    authProvider: row.auth_provider,
    providerId: row.provider_id,
    onboardingStatus: row.onboarding_status,
    onboardingCompletedAt: row.onboarding_completed_at,
    lastLogin: row.last_login,
    refreshToken: row.refresh_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Ensure avatar URL is valid and doesn't expire
 * If avatar is a key or presigned URL, generate a fresh public URL or signed URL
 */
function ensureValidAvatarUrl(avatar: string | null | undefined): string | null {
  if (!avatar) {
    return null;
  }

  // If it's already a public URL (starts with http/https and doesn't have query params), return as-is
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
    try {
      // Check if it's a presigned URL (has query parameters like ?X-Amz-Algorithm)
      const url = new URL(avatar);
      const hasPresignedParams = url.searchParams.has('X-Amz-Algorithm') || 
                                 url.searchParams.has('X-Amz-Credential') ||
                                 url.searchParams.has('AWSAccessKeyId') ||
                                 url.searchParams.has('X-Amz-Signature');
      
      if (!hasPresignedParams) {
        // It's a public URL, return as-is
        return avatar;
      }
      
      // It's a presigned URL, extract the key and generate a public URL
      const key = url.pathname.substring(1); // Remove leading slash
      const publicUrl = r2Service.getPublicUrl(key);
      if (publicUrl) {
        return publicUrl;
      }
      
      // No public URL configured, return the original (will expire but better than nothing)
      return avatar;
    } catch {
      // Invalid URL format, return as-is
      return avatar;
    }
  }

  // If it looks like an R2 key (no http/https), try to generate a public URL
  if (avatar.includes('/') || avatar.includes('avatars/')) {
    const publicUrl = r2Service.getPublicUrl(avatar);
    if (publicUrl) {
      return publicUrl;
    }
    
    // If no public URL, return the key - will be handled in async version if needed
    return avatar;
  }

  // Unknown format, return as-is
  return avatar;
}

/**
 * Ensure avatar URL is valid and doesn't expire (async version for signed URLs)
 */
async function ensureValidAvatarUrlAsync(avatar: string | null | undefined): Promise<string | null> {
  if (!avatar) {
    return null;
  }

  // If it's already a public URL (starts with http/https and doesn't have query params), return as-is
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
    // Check if it's a presigned URL (has query parameters like ?X-Amz-Algorithm)
    try {
      const url = new URL(avatar);
      const hasPresignedParams = url.searchParams.has('X-Amz-Algorithm') || 
                                 url.searchParams.has('X-Amz-Credential') ||
                                 url.searchParams.has('AWSAccessKeyId');
      
      if (!hasPresignedParams) {
        // It's a public URL, return as-is
        return avatar;
      }
      
      // It's a presigned URL, extract the key and generate a public URL
      const key = url.pathname.substring(1); // Remove leading slash
      const publicUrl = r2Service.getPublicUrl(key);
      if (publicUrl) {
        return publicUrl;
      }
      
      // No public URL configured, generate a fresh signed URL
      if (r2Service.isR2Configured()) {
        return await r2Service.getSignedUrl(key, 86400 * 7); // 7 days
      }
      
      // R2 not configured, return original (will expire)
      return avatar;
    } catch {
      // Invalid URL format, return as-is
      return avatar;
    }
  }

  // If it looks like an R2 key (no http/https), try to generate a public URL
  if (avatar.includes('/') || avatar.includes('avatars/')) {
    const publicUrl = r2Service.getPublicUrl(avatar);
    if (publicUrl) {
      return publicUrl;
    }
    
    // If no public URL, generate a signed URL
    if (r2Service.isR2Configured()) {
      return await r2Service.getSignedUrl(avatar, 86400 * 7); // 7 days
    }
  }

  // Unknown format, return as-is
  return avatar;
}

/**
 * Get public profile from user (safe to return to client)
 */
export function getPublicProfile(user: MappedUser): PublicUserProfile {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    dateOfBirth: user.dateOfBirth,
    gender: user.gender,
    phone: user.phone,
    role: user.role,
    avatarUrl: ensureValidAvatarUrl(user.avatar),
    isEmailVerified: user.isEmailVerified,
    onboardingStatus: user.onboardingStatus,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Get public profile from user with async avatar URL resolution (for signed URLs)
 */
export async function getPublicProfileAsync(user: MappedUser): Promise<PublicUserProfile> {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    dateOfBirth: user.dateOfBirth,
    gender: user.gender,
    phone: user.phone,
    role: user.role,
    avatarUrl: await ensureValidAvatarUrlAsync(user.avatar),
    isEmailVerified: user.isEmailVerified,
    onboardingStatus: user.onboardingStatus,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/**
 * Fetch user by ID and return mapped object
 * @throws ApiError.notFound if user doesn't exist
 */
export async function getUserById(userId: string): Promise<MappedUser> {
  const result = await query<UserRow & { role?: string }>(
    `SELECT u.*, r.slug as role FROM users u
     LEFT JOIN roles r ON u.role_id = r.id
     WHERE u.id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw ApiError.notFound('User not found');
  }

  return mapUserRow(result.rows[0]);
}

/**
 * Fetch user by email and return mapped object
 * @returns null if user doesn't exist
 */
export async function getUserByEmail(email: string): Promise<MappedUser | null> {
  const result = await query<UserRow & { role?: string }>(
    `SELECT u.*, r.slug as role FROM users u
     LEFT JOIN roles r ON u.role_id = r.id
     WHERE u.email = $1`,
    [email.toLowerCase()]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapUserRow(result.rows[0]);
}

/**
 * Generate tokens and store refresh token in database
 */
export async function createAndStoreTokens(
  user: MappedUser
): Promise<{ accessToken: string; refreshToken: string }> {
  const tokens = generateTokens({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  await query('UPDATE users SET refresh_token = $1 WHERE id = $2', [
    tokens.refreshToken,
    user.id,
  ]);

  return tokens;
}

/**
 * Upsert consent record (insert or update if exists)
 * @param client - Database client for transaction
 */
export async function upsertConsent(
  client: PoolClient,
  userId: string,
  type: string,
  now: Date,
  ip: string
): Promise<void> {
  await client.query(
    `INSERT INTO consent_records (user_id, type, version, consented_at, ip)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, type) DO UPDATE SET
       version = EXCLUDED.version,
       consented_at = EXCLUDED.consented_at,
       ip = EXCLUDED.ip`,
    [userId, type, CONSENT_VERSION, now, ip]
  );
}

/**
 * Check if user has a specific consent type
 */
export function hasConsent(consents: ConsentRow[], type: string): boolean {
  return consents.some((c) => c.type === type);
}

/**
 * Fetch all consents for a user
 */
export async function getUserConsents(userId: string): Promise<ConsentRow[]> {
  const result = await query<ConsentRow>(
    'SELECT * FROM consent_records WHERE user_id = $1',
    [userId]
  );
  return result.rows;
}

/**
 * Update user's last login timestamp
 */
export async function updateLastLogin(userId: string): Promise<void> {
  await query(
    'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
    [userId]
  );
}

/**
 * Update user's online status
 * Note: This uses last_login as a proxy for online status.
 * For true online/offline tracking, consider adding an is_online BOOLEAN column.
 */
export async function updateUserOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
  // For now, update last_login when user comes online
  // In the future, you may want to add: ALTER TABLE users ADD COLUMN is_online BOOLEAN DEFAULT false;
  if (isOnline) {
    await query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [userId]
    );
  }
  // When user goes offline, we don't update last_login to preserve the last active time
}

/**
 * Check if email already exists in database
 */
export async function emailExists(email: string): Promise<boolean> {
  const result = await query<{ id: string }>(
    'SELECT id FROM users WHERE email = $1',
    [email.toLowerCase()]
  );
  return result.rows.length > 0;
}
