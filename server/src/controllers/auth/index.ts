/**
 * @file Auth controllers barrel export
 * @description Re-exports all auth-related controller functions from split modules
 */

// Types
export * from './auth.types.js';

// Registration (local and social)
export {
  register,
  verifyRegistration,
  resendRegistrationOTP,
  socialAuth,
  completeSocialProfile,
} from './auth-registration.controller.js';

// Session management
export {
  login,
  logout,
  refreshToken,
  forgotPassword,
  resetPassword,
  verifyEmail,
} from './auth-session.controller.js';

// Onboarding and user management
export {
  submitConsent,
  enrollWhatsApp,
  verifyWhatsApp,
  skipWhatsApp,
  getCurrentUser,
  getOnboardingStatus,
  updateProfile,
} from './auth-onboarding.controller.js';
