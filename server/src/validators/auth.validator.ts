import { z } from 'zod';
import { commonSchemas } from '../middlewares/validate.middleware.js';

// Disposable email domains blocklist (partial list)
const DISPOSABLE_EMAIL_DOMAINS = [
  'tempmail.com', 'throwaway.email', '10minutemail.com', 'guerrillamail.com',
  'mailinator.com', 'temp-mail.org', 'fakeinbox.com', 'trashmail.com',
];

// Custom email validation that blocks disposable emails
const safeEmail = z.string()
  .email('Invalid email format')
  .toLowerCase()
  .trim()
  .refine(email => {
    const domain = email.split('@')[1];
    return !DISPOSABLE_EMAIL_DOMAINS.includes(domain ?? '');
  }, 'Please use a permanent email address (no temporary emails)');

// Gender enum
const genderEnum = z.enum(['male', 'female', 'non_binary', 'prefer_not_to_say']);

// Date of birth validation (must be 18+)
const dateOfBirth = z.string()
  .or(z.date())
  .transform(val => new Date(val))
  .refine(date => {
    const today = new Date();
    const birthDate = new Date(date);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age >= 18;
  }, 'Balencia is for users 18+. Contact support@balencia.com for assistance.');

// S01.1.1: Core Account Registration
export const registerSchema = z.object({
  email: safeEmail,
  password: commonSchemas.password,
  firstName: z.string().trim().min(2, 'First name must be at least 2 characters').max(50),
  lastName: z.string().trim().min(2, 'Last name must be at least 2 characters').max(50),
  dateOfBirth: dateOfBirth,
  gender: genderEnum,
});

// S01.1.2: Social Sign-In (via NextAuth)
// Frontend sends user data from NextAuth session
export const socialAuthSchema = z.object({
  provider: z.enum(['google', 'apple']),
  email: z.string().email('Invalid email format'),
  providerId: z.string().optional(), // Provider user ID (e.g., Google sub)
  idToken: z.string().optional(), // Legacy support
  name: z.string().optional(), // Full name from provider
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  avatar: z.string().url().optional().nullable(),
  accessToken: z.string().optional(),
});

// Social auth completion (for missing fields)
export const completeSocialProfileSchema = z.object({
  dateOfBirth: dateOfBirth,
  gender: genderEnum,
  firstName: z.string().trim().min(2).max(50).optional(),
  lastName: z.string().trim().min(2).max(50).optional(),
});

// S01.1.3: Privacy Consent
export const consentSchema = z.object({
  termsOfService: z.boolean().refine(val => val === true, 'You must accept the Terms of Service'),
  privacyPolicy: z.boolean().refine(val => val === true, 'You must accept the Privacy Policy'),
  emailMarketing: z.boolean().optional().default(false),
  whatsAppCoaching: z.boolean().optional().default(false),
});

// WhatsApp enrollment
export const whatsAppEnrollmentSchema = z.object({
  phoneNumber: z.string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
  countryCode: z.string().min(1, 'Country code is required').max(5),
});

// WhatsApp verification
export const whatsAppVerificationSchema = z.object({
  code: z.string()
    .length(6, 'Verification code must be 6 digits')
    .regex(/^\d{6}$/, 'Verification code must contain only numbers'),
});

// Login schema
export const loginSchema = z.object({
  email: commonSchemas.email,
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false),
});

// Forgot password schema
export const forgotPasswordSchema = z.object({
  email: commonSchemas.email,
});

// Reset password schema
export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: commonSchemas.password,
  confirmPassword: z.string().min(1, 'Confirm password is required'),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

// Change password schema
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: commonSchemas.password,
  confirmPassword: z.string().min(1, 'Confirm password is required'),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
}).refine(data => data.currentPassword !== data.newPassword, {
  message: 'New password must be different from current password',
  path: ['newPassword'],
});

// Verify email schema
export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

// Verify registration OTP schema
export const verifyRegistrationSchema = z.object({
  activationToken: z.string().min(1, 'Activation token is required'),
  activationCode: z.string()
    .length(4, 'Verification code must be 4 digits')
    .regex(/^\d{4}$/, 'Verification code must contain only numbers'),
});

// Resend registration OTP schema
export const resendRegistrationOTPSchema = z.object({
  activationToken: z.string().min(1, 'Activation token is required'),
});

// Refresh token schema
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// Update profile schema
export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(2).max(50).optional(),
  lastName: z.string().trim().min(2).max(50).optional(),
  phone: commonSchemas.phone,
  avatar: z.string().url().optional().nullable(),
  dateOfBirth: z.string().or(z.date()).transform(val => new Date(val)).optional(),
  gender: z.enum(['male', 'female', 'non_binary', 'prefer_not_to_say']).optional(),
});

// Types inferred from schemas
export type RegisterInput = z.infer<typeof registerSchema>;
export type SocialAuthInput = z.infer<typeof socialAuthSchema>;
export type CompleteSocialProfileInput = z.infer<typeof completeSocialProfileSchema>;
export type ConsentInput = z.infer<typeof consentSchema>;
export type WhatsAppEnrollmentInput = z.infer<typeof whatsAppEnrollmentSchema>;
export type WhatsAppVerificationInput = z.infer<typeof whatsAppVerificationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type VerifyRegistrationInput = z.infer<typeof verifyRegistrationSchema>;
export type ResendRegistrationOTPInput = z.infer<typeof resendRegistrationOTPSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
