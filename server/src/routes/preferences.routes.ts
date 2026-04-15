import { Router } from 'express';
import { validate } from '../middlewares/validate.middleware.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import {
  notificationPreferencesSchema,
  coachingPreferencesSchema,
  displayPreferencesSchema,
  privacyPreferencesSchema,
  integrationPreferencesSchema,
  updatePreferencesSchema,
} from '../validators/preferences.validator.js';
import preferencesController from '../controllers/preferences.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// Get All Preferences
// ============================================

// Get user preferences
router.get(
  '/',
  preferencesController.getPreferences
);

// Update all preferences (bulk)
router.put(
  '/',
  validate(updatePreferencesSchema),
  preferencesController.updateAllPreferences
);

// Update preferences (partial - PATCH method)
router.patch(
  '/',
  validate(updatePreferencesSchema),
  preferencesController.updateAllPreferences
);

// ============================================
// S01.5.1: Notification Preferences
// ============================================

// Update notification preferences
router.patch(
  '/notifications',
  validate(notificationPreferencesSchema),
  preferencesController.updateNotificationPreferences
);

// ============================================
// S01.5.2: Coaching Preferences
// ============================================

// Get coaching style options
router.get(
  '/coaching/styles',
  preferencesController.getCoachingStyles
);

// Update coaching preferences
router.patch(
  '/coaching',
  validate(coachingPreferencesSchema),
  preferencesController.updateCoachingPreferences
);

// ============================================
// Display Preferences
// ============================================

// Update display preferences
router.patch(
  '/display',
  validate(displayPreferencesSchema),
  preferencesController.updateDisplayPreferences
);

// ============================================
// Privacy Preferences
// ============================================

// Update privacy preferences
router.patch(
  '/privacy',
  validate(privacyPreferencesSchema),
  preferencesController.updatePrivacyPreferences
);

// ============================================
// Integration Preferences
// ============================================

// Update integration preferences
router.patch(
  '/integrations',
  validate(integrationPreferencesSchema),
  preferencesController.updateIntegrationPreferences
);

// ============================================
// Product Tour Status
// ============================================

// Update product tour completion status
router.patch(
  '/tour-status',
  preferencesController.updateTourStatus
);

// ============================================
// Onboarding & Management
// ============================================

// Complete preferences step in onboarding
router.post(
  '/complete',
  preferencesController.completePreferencesStep
);

// Reset preferences to defaults
router.post(
  '/reset',
  preferencesController.resetPreferences
);

export default router;
