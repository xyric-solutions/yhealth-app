import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { apiLimiter } from '../middlewares/rateLimiter.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  generatePlanSchema,
  updatePlanSchema,
  logActivitySchema,
} from '../validators/plan.validator.js';
import {
  // Generation
  generatePlan,
  getSafetyPreview,
  createManualPlan,
  generateAITasks,
  completeOnboarding,
  generateOnboardingPlans,
  // CRUD
  getPlans,
  getActivePlan,
  getPlanById,
  updatePlan,
  deletePlan,
  // Activities
  logActivity,
  getActivityLogs,
  getTodayActivities,
  completeActivity,
  uncompleteActivity,
  getPlanProgress,
  regenerateActivities,
  // Summary
  getWeeklySummary,
} from '../controllers/plan/index.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// S01.6.1: Plan Generation
// ============================================

// Generate personalized plan preview
router.post(
  '/generate',
  apiLimiter,
  validate(generatePlanSchema),
  generatePlan
);

// Safety preview - check health risks before plan generation
router.post(
  '/safety-preview',
  getSafetyPreview
);

// ============================================
// S01.6.2: Plan Creation & Activation
// ============================================

// Get all user plans
router.get(
  '/',
  getPlans
);

// Get active plan
router.get(
  '/active',
  getActivePlan
);

// Get today's activities (global - uses active plan)
router.get(
  '/today',
  getTodayActivities
);

// Create a new plan
router.post(
  '/',
  validate(generatePlanSchema),
  generatePlan
);

// Create a manual plan with custom tasks
router.post(
  '/create-manual',
  createManualPlan
);

// Generate AI-powered tasks based on goal description
router.post(
  '/generate-tasks',
  apiLimiter,
  generateAITasks
);

// Complete onboarding
router.post(
  '/complete-onboarding',
  completeOnboarding
);

// Generate comprehensive AI plans from onboarding data
// Analyzes goals, MCQs, body stats, images, and preferences
router.post(
  '/generate-onboarding-plans',
  apiLimiter,
  generateOnboardingPlans
);

// ============================================
// Individual Plan Operations
// ============================================

// Get specific plan
router.get(
  '/:planId',
  getPlanById
);

// Get plan's weekly summary
router.get(
  '/:planId/summary/weekly',
  getWeeklySummary
);

// Get today's activities for specific plan
router.get(
  '/:planId/today',
  getTodayActivities
);

// Get activity logs
router.get(
  '/:planId/logs',
  getActivityLogs
);

// Update plan
router.patch(
  '/:planId',
  validate(updatePlanSchema),
  updatePlan
);

// Delete plan
router.delete(
  '/:planId',
  deletePlan
);

// Activate plan (same as update - changes status to active)
router.post(
  '/:planId/activate',
  validate(updatePlanSchema),
  updatePlan
);

// ============================================
// Activity Operations
// ============================================

// Update activity in plan (uses updatePlan to modify activities array)
router.patch(
  '/:planId/activities/:activityId',
  validate(updatePlanSchema),
  updatePlan
);

// Log activity completion
router.post(
  '/:planId/activities/:activityId/log',
  validate(logActivitySchema),
  logActivity
);

// Complete activity (simple toggle)
router.post(
  '/:planId/activities/:activityId/complete',
  completeActivity
);

// Uncomplete activity
router.post(
  '/:planId/activities/:activityId/uncomplete',
  uncompleteActivity
);

// Get plan progress stats
router.get(
  '/:planId/progress',
  getPlanProgress
);

// Regenerate activities from linked workout/diet plans
router.post(
  '/:planId/regenerate-activities',
  regenerateActivities
);

export default router;
