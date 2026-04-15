/**
 * @file Plan controllers barrel export
 * @description Re-exports all plan-related controller functions from split modules
 */

// Types
export * from './plan.types.js';

// CRUD operations
export { getPlans, getActivePlan, getPlanById, updatePlan, deletePlan } from './plan-crud.controller.js';

// Activity logging and tracking
export {
  logActivity,
  getActivityLogs,
  getTodayActivities,
  completeActivity,
  uncompleteActivity,
  getPlanProgress,
  regenerateActivities,
} from './plan-activities.controller.js';

// Summary and reporting
export { getWeeklySummary } from './plan-summary.controller.js';

// Plan generation and onboarding
export {
  generatePlan,
  completeOnboarding,
  getSafetyPreview,
  createManualPlan,
  generateAITasks,
  generateOnboardingPlans,
} from './plan-generation.controller.js';
