/**
 * Balencia Email Templates
 * Modern, responsive email templates for the AI Life Coach platform
 */

// Base template components
export {
  baseEmailLayout,
  featureBox,
  statsBox,
  alertBox,
  codeBox,
  BRAND_COLORS,
  type EmailTemplateData,
} from './base.template.js';

// Verification templates
export {
  emailVerificationTemplate,
  resendVerificationTemplate,
  emailVerifiedTemplate,
  type VerificationEmailData,
} from './verification.template.js';

// Password templates
export {
  passwordResetTemplate,
  passwordChangedTemplate,
  passwordResetOTPTemplate,
  securityAlertTemplate,
  type PasswordResetEmailData,
} from './password.template.js';

// Welcome & onboarding templates
export {
  welcomeTemplate,
  assessmentReminderTemplate,
  integrationReminderTemplate,
  goalSetTemplate,
  type WelcomeEmailData,
} from './welcome.template.js';

// Onboarding completion & progress templates
export {
  onboardingCompleteTemplate,
  weeklyProgressTemplate,
  milestoneAchievedTemplate,
  streakMilestoneTemplate,
  reEngagementTemplate,
} from './onboarding.template.js';

/**
 * Email template types for TypeScript
 */
export type EmailTemplateType =
  | 'verification'
  | 'resend-verification'
  | 'email-verified'
  | 'password-reset'
  | 'password-changed'
  | 'password-reset-otp'
  | 'security-alert'
  | 'welcome'
  | 'assessment-reminder'
  | 'integration-reminder'
  | 'goal-set'
  | 'onboarding-complete'
  | 'weekly-progress'
  | 'milestone-achieved'
  | 'streak-milestone'
  | 're-engagement';

/**
 * Email subject lines
 */
export const EMAIL_SUBJECTS: Record<EmailTemplateType, string> = {
  'verification': 'Verify Your Email - Balencia',
  'resend-verification': 'New Verification Link - Balencia',
  'email-verified': 'Email Verified! - Balencia',
  'password-reset': 'Reset Your Password - Balencia',
  'password-changed': 'Password Changed - Balencia',
  'password-reset-otp': 'Your Password Reset Code - Balencia',
  'security-alert': 'Security Alert - Balencia',
  'welcome': 'Welcome to Balencia - Your AI Life Coach!',
  'assessment-reminder': 'Complete Your Assessment - Balencia',
  'integration-reminder': 'Connect Your Devices - Balencia',
  'goal-set': 'Goal Set! - Balencia',
  'onboarding-complete': 'You\'re All Set! - Balencia',
  'weekly-progress': 'Your Weekly Progress - Balencia',
  'milestone-achieved': 'Milestone Achieved! - Balencia',
  'streak-milestone': 'Streak Milestone! - Balencia',
  're-engagement': 'We Miss You! - Balencia',
};

import { BRAND_COLORS as BrandColors } from './base.template.js';

export default {
  BRAND_COLORS: BrandColors,
  EMAIL_SUBJECTS,
};
