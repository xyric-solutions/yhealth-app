import { Router } from 'express';
import { validate } from '../middlewares/validate.middleware.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import {
  goalDiscoverySchema,
  assessmentModeSchema,
  submitQuickAssessmentSchema,
  deepAssessmentMessageSchema,
  goalSetupSchema,
  goalCommitmentSchema,
  acceptSuggestedGoalsSchema,
  updateGoalSchema,
  deleteGoalsSchema,
} from '../validators/assessment.validator.js';
import assessmentController from '../controllers/assessment.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// GOAL DISCOVERY (S01.2.1)
// ============================================

// Select primary goal
router.post(
  '/goal',
  validate(goalDiscoverySchema),
  assessmentController.selectGoal
);

// Select assessment mode (quick vs deep)
router.post(
  '/mode',
  validate(assessmentModeSchema),
  assessmentController.selectMode
);

// Switch assessment mode
router.post(
  '/switch-mode',
  assessmentController.switchMode
);

// ============================================
// QUICK ASSESSMENT (S01.2.2)
// ============================================

// Get assessment questions
router.get(
  '/questions',
  assessmentController.getQuestions
);

// Submit quick assessment
router.post(
  '/quick/submit',
  validate(submitQuickAssessmentSchema),
  assessmentController.submitQuickAssessment
);

// ============================================
// DEEP ASSESSMENT (S01.2.3)
// ============================================

// Send message in deep assessment conversation
router.post(
  '/deep/message',
  validate(deepAssessmentMessageSchema),
  assessmentController.sendDeepMessage
);

// Complete deep assessment
router.post(
  '/deep/complete',
  assessmentController.completeDeepAssessment
);

// ============================================
// GOAL SETUP (S01.3.1)
// ============================================

// Get AI-suggested goals
router.get(
  '/goals/suggested',
  assessmentController.getSuggestedGoals
);

// Accept AI-suggested goals
router.post(
  '/goals/accept-suggested',
  validate(acceptSuggestedGoalsSchema),
  assessmentController.acceptSuggestedGoals
);

// Create custom goal
router.post(
  '/goals',
  validate(goalSetupSchema),
  assessmentController.createGoal
);

// Get user goals
router.get(
  '/goals',
  assessmentController.getGoals
);

// Update goal
router.patch(
  '/goals/:goalId',
  validate(updateGoalSchema),
  assessmentController.updateGoal
);

// Delete single goal
router.delete(
  '/goals/:goalId',
  assessmentController.deleteGoal
);

// Delete multiple goals (bulk)
router.delete(
  '/goals',
  validate(deleteGoalsSchema),
  assessmentController.deleteGoals
);

// ============================================
// GOAL COMMITMENT (S01.3.2)
// ============================================

// Commit to goal
router.post(
  '/goals/:goalId/commit',
  validate(goalCommitmentSchema),
  assessmentController.commitToGoal
);

// ============================================
// GOAL ACTIONS & AUTO-PROGRESS
// ============================================

// Get or create goal actions (AI decomposition)
router.get('/goals/:goalId/actions', assessmentController.getGoalActions);

// Toggle daily action completion
router.post('/goals/:goalId/actions/:actionId/toggle', assessmentController.toggleGoalAction);

// Get auto-calculated progress
router.get('/goals/:goalId/auto-progress', assessmentController.getGoalAutoProgress);

export default router;
