/**
 * @file Auth controller shared types
 * @description Type definitions and helpers shared across auth controller modules
 */

import jwt from 'jsonwebtoken';
import type { RegisterInput } from '../../validators/auth.validator.js';
import { env } from '../../config/env.config.js';
import { getPublicProfile as getPublicProfileHelper } from '../../utils/user.helpers.js';
import type { MappedUser } from '../../database/schemas/index.js';

// Activation token payload type
export interface ActivationTokenPayload {
  user: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
  };
  activationCode: string;
}

// Type definitions for raw PostgreSQL results
export interface UserRow {
  id: string;
  email: string;
  password: string | null;
  first_name: string;
  last_name: string;
  date_of_birth: Date | null;
  gender: string | null;
  role_id: string;
  role?: string; // slug from roles join
  is_active: boolean;
  is_email_verified: boolean;
  avatar: string | null;
  phone: string | null;
  auth_provider: string;
  provider_id: string | null;
  onboarding_status: string;
  onboarding_completed_at: Date | null;
  last_login: Date | null;
  refresh_token: string | null;
  password_reset_token: string | null;
  password_reset_expires: Date | null;
  email_verification_token: string | null;
  email_verification_expires: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ConsentRow {
  id: string;
  user_id: string;
  type: string;
  version: string;
  consented_at: Date;
  ip: string | null;
}

export interface WhatsAppRow {
  id: string;
  user_id: string;
  phone_number: string;
  country_code: string;
  is_verified: boolean;
  verified_at: Date | null;
  consented_at: Date | null;
}

export const CONSENT_VERSION = '1.0.0';

/**
 * Generate activation token with 4-digit OTP code
 */
export function createActivationToken(user: RegisterInput): {
  token: string;
  activationCode: string;
} {
  const activationCode = Math.floor(1000 + Math.random() * 9000).toString();
  const token = jwt.sign(
    {
      user: {
        email: user.email,
        password: user.password, // Already hashed
        firstName: user.firstName,
        lastName: user.lastName,
        dateOfBirth: user.dateOfBirth.toISOString(),
        gender: user.gender,
      },
      activationCode,
    } as ActivationTokenPayload,
    env.jwt.secret,
    { expiresIn: '10m' }
  );
  return { token, activationCode };
}

/**
 * Map database row to camelCase user object
 */
export function mapUserRow(row: UserRow): MappedUser {
  return {
    id: row.id,
    email: row.email,
    password: row.password,
    firstName: row.first_name,
    lastName: row.last_name,
    dateOfBirth: row.date_of_birth,
    gender: row.gender,
    role: row.role ?? 'user',
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
 * Get public profile (safe to send to client)
 * Uses helper from user.helpers.ts to ensure avatar URLs don't expire
 */
export function getPublicProfile(user: MappedUser) {
  return getPublicProfileHelper(user);
}

/**
 * Check if user has a specific consent
 */
export function hasConsent(consents: ConsentRow[], type: string): boolean {
  return consents.some((c) => c.type === type);
}
