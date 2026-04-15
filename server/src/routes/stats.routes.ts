import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import statsController from '../controllers/stats.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// Dashboard Stats
// ============================================

// Get dashboard overview stats (streak, week change, etc.)
router.get(
  '/dashboard',
  statsController.getDashboardStats
);

// Get weekly activity data for chart
router.get(
  '/weekly-activity',
  statsController.getWeeklyActivityData
);

// Get current streak
router.get(
  '/streak',
  statsController.getCurrentStreak
);

// Get health metrics summary
router.get(
  '/health-metrics',
  statsController.getHealthMetrics
);

// Get enhanced health metrics with analytics
router.get(
  '/enhanced-health-metrics',
  statsController.getEnhancedHealthMetrics
);

// Log quick action (workout, meal, sleep, mindfulness)
router.post(
  '/quick-log',
  statsController.logQuickAction
);

// ============================================
// Analytics & Reporting
// ============================================

// Get comprehensive analytics
router.get(
  '/analytics',
  statsController.getAnalytics
);

// Get comprehensive report
router.get(
  '/report',
  statsController.getReport
);

export default router;
