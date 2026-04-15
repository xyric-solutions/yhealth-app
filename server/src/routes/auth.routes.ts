import { Router } from 'express';
import { validate } from '../middlewares/validate.middleware.js';
import { authenticate, verifyRefreshToken } from '../middlewares/auth.middleware.js';
import { authLimiter, strictLimiter, createRateLimiter } from '../middlewares/rateLimiter.middleware.js';
import {
  registerSchema,
  verifyRegistrationSchema,
  resendRegistrationOTPSchema,
  socialAuthSchema,
  completeSocialProfileSchema,
  consentSchema,
  whatsAppEnrollmentSchema,
  whatsAppVerificationSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  updateProfileSchema,
} from '../validators/auth.validator.js';
import {
  // Registration
  register,
  verifyRegistration,
  resendRegistrationOTP,
  socialAuth,
  completeSocialProfile,
  // Session
  login,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  verifyEmail,
  // Onboarding
  submitConsent,
  enrollWhatsApp,
  verifyWhatsApp,
  skipWhatsApp,
  getCurrentUser,
  getOnboardingStatus,
  updateProfile,
} from '../controllers/auth/index.js';

const router = Router();

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

// S01.1.1: Core Account Registration - Step 1: Send OTP
router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  register
);

// S01.1.1: Core Account Registration - Step 2: Verify OTP and Create Account
router.post(
  '/verify-registration',
  authLimiter,
  validate(verifyRegistrationSchema),
  verifyRegistration
);

// Resend Registration OTP
router.post(
  '/resend-registration-otp',
  strictLimiter,
  validate(resendRegistrationOTPSchema),
  resendRegistrationOTP
);

// S01.1.2: Social Sign-In (Google/Apple)
router.post(
  '/social',
  authLimiter,
  validate(socialAuthSchema),
  socialAuth
);

// Login
router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  login
);

// Refresh Token
router.post(
  '/refresh',
  authLimiter,
  verifyRefreshToken,
  refreshToken
);

// Forgot Password
router.post(
  '/forgot-password',
  strictLimiter,
  validate(forgotPasswordSchema),
  forgotPassword
);

// Reset Password
router.post(
  '/reset-password',
  strictLimiter,
  validate(resetPasswordSchema),
  resetPassword
);

// Verify Email
router.post(
  '/verify-email',
  validate(verifyEmailSchema),
  verifyEmail
);

// ============================================
// PROTECTED ROUTES (Authentication required)
// ============================================

// Complete Social Profile (DOB, Gender)
router.post(
  '/complete-profile',
  authenticate,
  validate(completeSocialProfileSchema),
  completeSocialProfile
);

// S01.1.3: Privacy Consent
router.post(
  '/consent',
  authenticate,
  validate(consentSchema),
  submitConsent
);

// WhatsApp Enrollment
router.post(
  '/whatsapp/enroll',
  authenticate,
  strictLimiter,
  validate(whatsAppEnrollmentSchema),
  enrollWhatsApp
);

// WhatsApp Verification
router.post(
  '/whatsapp/verify',
  authenticate,
  validate(whatsAppVerificationSchema),
  verifyWhatsApp
);

// Skip WhatsApp Enrollment
router.post(
  '/whatsapp/skip',
  authenticate,
  skipWhatsApp
);

// Logout
router.post(
  '/logout',
  authenticate,
  logout
);

// Get Current User (frequently polled - add lenient rate limiter and caching)
router.get(
  '/me',
  authenticate,
  createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute per user
    keyGenerator: 'user',
  }),
  getCurrentUser
);

// Get Onboarding Status
router.get(
  '/onboarding-status',
  authenticate,
  getOnboardingStatus
);

// Update Profile
router.patch(
  '/profile',
  authenticate,
  validate(updateProfileSchema),
  updateProfile
);

export default router;
