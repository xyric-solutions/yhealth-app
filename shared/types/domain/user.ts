/**
 * @file User domain types
 * @description Single source of truth for user-related types
 */

export type UserRole = 'user' | 'admin' | 'moderator' | 'doctor' | 'patient';

export type Gender = 'male' | 'female' | 'non_binary' | 'prefer_not_to_say';

export type AuthProvider = 'local' | 'google' | 'apple';

export type OnboardingStatus =
  | 'registered'
  | 'consent_pending'
  | 'assessment_pending'
  | 'goals_pending'
  | 'integrations_pending'
  | 'preferences_pending'
  | 'plan_pending'
  | 'completed';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  gender?: Gender;
  dateOfBirth?: string;
  avatar?: string;
  phone?: string;
  isEmailVerified: boolean;
  onboardingStatus: OnboardingStatus;
  createdAt: string;
  updatedAt: string;
}
