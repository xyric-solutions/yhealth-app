/**
 * @file User database row types
 * @description Database schema types for user-related tables
 */

/**
 * Raw PostgreSQL result for users table
 */
export interface UserRow {
  id: string;
  email: string;
  password: string | null;
  first_name: string;
  last_name: string;
  date_of_birth: Date | null;
  gender: string | null;
  role_id: string;
  role?: string; // slug from JOIN, for API responses
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

/**
 * Raw PostgreSQL result for consent_records table
 */
export interface ConsentRow {
  id: string;
  user_id: string;
  type: string;
  version: string;
  consented_at: Date;
  ip: string | null;
}

/**
 * Raw PostgreSQL result for whatsapp_enrollments table
 */
export interface WhatsAppRow {
  id: string;
  user_id: string;
  phone_number: string;
  country_code: string;
  is_verified: boolean;
  verified_at: Date | null;
  consented_at: Date | null;
}

/**
 * Raw PostgreSQL result for user_preferences table
 */
export interface UserPreferencesRow {
  id: string;
  user_id: string;
  notification_channels: string[];
  coaching_style: string;
  coaching_intensity: string;
  preferred_language: string;
  timezone: string;
  measurement_unit: string;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  voice_assistant_avatar_url: string | null;
  voice_assistant_name: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Mapped user object (camelCase)
 */
export interface MappedUser {
  id: string;
  email: string;
  password: string | null;
  firstName: string;
  lastName: string;
  dateOfBirth: Date | null;
  gender: string | null;
  role: string;
  isActive: boolean;
  isEmailVerified: boolean;
  avatar: string | null;
  phone: string | null;
  authProvider: string;
  providerId: string | null;
  onboardingStatus: string;
  onboardingCompletedAt: Date | null;
  lastLogin: Date | null;
  refreshToken: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Public user profile (safe to return to client)
 */
export interface PublicUserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date | null;
  gender: string | null;
  phone: string | null;
  role: string;
  avatarUrl: string | null;
  isEmailVerified: boolean;
  onboardingStatus: string;
  createdAt: Date;
  updatedAt: Date;
}
