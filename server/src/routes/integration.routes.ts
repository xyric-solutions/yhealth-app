import { Router } from 'express';
import { validate } from '../middlewares/validate.middleware.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { apiLimiter, createRateLimiter } from '../middlewares/rateLimiter.middleware.js';
import {
  selectIntegrationsSchema,
  initiateOAuthSchema,
  completeOAuthSchema,
  triggerSyncSchema,
  updateIntegrationSchema,
  manageWhoopTokensSchema,
  storeWhoopCredentialsSchema,
} from '../validators/integration.validator.js';
import integrationController from '../controllers/integration.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// S01.4.1: Integration Discovery & Selection
// ============================================

// Get available integrations with connection status
router.get(
  '/',
  integrationController.getIntegrations
);

// Select integrations for onboarding
router.post(
  '/select',
  validate(selectIntegrationsSchema),
  integrationController.selectIntegrations
);

// ============================================
// S01.4.2: OAuth Flow Management
// ============================================

// Initiate OAuth flow
router.post(
  '/oauth/initiate',
  apiLimiter,
  validate(initiateOAuthSchema),
  integrationController.initiateOAuth
);

// Complete OAuth flow (callback handler)
// Use stricter rate limiting for OAuth completion (sensitive operation)
router.post(
  '/oauth/complete',
  createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // Only 5 attempts per minute per user (prevents spam)
    keyGenerator: 'user',
  }),
  validate(completeOAuthSchema),
  integrationController.completeOAuth
);

// ============================================
// S01.4.3: Sync Management
// ============================================

// Get sync dashboard
router.get(
  '/sync/status',
  integrationController.getSyncDashboard
);

// Get golden source configuration
router.get(
  '/golden-source',
  integrationController.getGoldenSourceConfig
);

// ============================================
// WHOOP-Specific Routes (must be before /:provider routes)
// ============================================

// Get WHOOP connection status - specific route before :provider to avoid wrong handler
router.get(
  '/whoop/status',
  createRateLimiter({
    windowMs: 60 * 1000,
    max: 30,
    keyGenerator: 'user',
  }),
  integrationController.getWhoopStatus
);

// ============================================
// Provider-Specific Routes
// ============================================

// Get integration status
router.get(
  '/:provider/status',
  integrationController.getIntegrationStatus
);

// Trigger manual sync
router.post(
  '/:provider/sync',
  apiLimiter,
  validate(triggerSyncSchema),
  integrationController.triggerSync
);

// Update integration settings
router.patch(
  '/:provider',
  validate(updateIntegrationSchema),
  integrationController.updateIntegration
);

// Disconnect integration
router.delete(
  '/:provider',
  integrationController.disconnectIntegration
);

// ============================================
// Complete Integration Step
// ============================================

// Complete integrations step in onboarding
router.post(
  '/complete',
  integrationController.completeIntegrationsStep
);

// ============================================
// WHOOP-Specific Routes (continued)
// ============================================

// Register WHOOP webhook URL
router.post(
  '/whoop/webhook/register',
  apiLimiter,
  integrationController.registerWhoopWebhook
);

// Store WHOOP credentials
router.post(
  '/whoop/credentials',
  apiLimiter,
  validate(storeWhoopCredentialsSchema),
  integrationController.storeWhoopCredentials
);

// Delete/Disconnect WHOOP credentials
router.delete(
  '/whoop/credentials',
  apiLimiter,
  integrationController.deleteWhoopCredentials
);

// WHOOP Token Management
router.post(
  '/whoop/tokens',
  apiLimiter,
  validate(manageWhoopTokensSchema),
  integrationController.manageWhoopTokens
);

router.get(
  '/whoop/tokens',
  integrationController.getWhoopTokens
);

router.delete(
  '/whoop/tokens',
  apiLimiter,
  integrationController.deleteWhoopTokens
);

router.patch(
  '/whoop/tokens/disable',
  apiLimiter,
  integrationController.toggleWhoopTokens
);

export default router;
