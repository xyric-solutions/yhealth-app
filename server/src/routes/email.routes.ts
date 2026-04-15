/**
 * Email Routes
 * Email preferences, unsubscribe, analytics, and admin tools.
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import {
  getPreferences,
  updatePreference,
  unsubscribe,
  getAnalytics,
  getLogs,
  sendTestEmail,
} from '../controllers/email.controller.js';

const router = Router();

// ============================================================================
// Public (no auth)
// ============================================================================

// One-click unsubscribe via email link
router.get('/unsubscribe/:token', unsubscribe);

// ============================================================================
// Authenticated User
// ============================================================================

router.get('/preferences', authenticate, getPreferences);
router.put('/preferences/:category', authenticate, updatePreference);

// ============================================================================
// Admin
// ============================================================================

router.get('/analytics', authenticate, authorize('admin'), getAnalytics);
router.get('/logs', authenticate, authorize('admin'), getLogs);
router.post('/test', authenticate, authorize('admin'), sendTestEmail);

export default router;
