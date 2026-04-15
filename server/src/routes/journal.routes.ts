/**
 * @file Journal Routes
 * @description API routes for the AI Wellness Journaling System
 * New route group: /api/v1/journal/*
 * Extends existing wellbeing journal endpoints with daily check-ins, life goals, and insights
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { dailyCheckinController } from '../controllers/wellbeing/daily-checkin.controller.js';
import { lifeGoalsController } from '../controllers/wellbeing/life-goals.controller.js';
import { lessonsLearnedController } from '../controllers/wellbeing/lessons-learned.controller.js';
import { voiceJournalController } from '../controllers/wellbeing/voice-journal.controller.js';
import { uploadAudio } from '../middlewares/upload.middleware.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// DAILY CHECK-IN (morning/evening)
// ============================================

/**
 * @route   POST /api/v1/journal/checkin
 * @desc    Create or update today's daily check-in (supports checkin_type: morning/evening)
 * @access  Private
 */
router.post('/checkin', dailyCheckinController.createOrUpdate);

/**
 * @route   GET /api/v1/journal/checkin/today
 * @desc    Get today's check-in (optional ?type=morning|evening filter)
 * @access  Private
 */
router.get('/checkin/today', dailyCheckinController.getToday);

/**
 * @route   GET /api/v1/journal/checkin/morning
 * @desc    Get morning check-in (optional ?date=YYYY-MM-DD)
 * @access  Private
 */
router.get('/checkin/morning', dailyCheckinController.getMorning);

/**
 * @route   GET /api/v1/journal/checkin/evening
 * @desc    Get evening review (optional ?date=YYYY-MM-DD)
 * @access  Private
 */
router.get('/checkin/evening', dailyCheckinController.getEvening);

/**
 * @route   GET /api/v1/journal/checkin/comparison
 * @desc    Get predicted vs actual comparison (optional ?date=YYYY-MM-DD)
 * @access  Private
 */
router.get('/checkin/comparison', dailyCheckinController.getComparison);

/**
 * @route   GET /api/v1/journal/checkin/history
 * @desc    Get check-in history (paginated, optional ?type=morning|evening)
 * @access  Private
 */
router.get('/checkin/history', dailyCheckinController.getHistory);

/**
 * @route   GET /api/v1/journal/checkin/streak
 * @desc    Get check-in streak info
 * @access  Private
 */
router.get('/checkin/streak', dailyCheckinController.getStreak);

// ============================================
// LIFE GOALS
// ============================================

/**
 * @route   POST /api/v1/journal/goals
 * @desc    Create a life goal
 * @access  Private
 */
router.post('/goals', lifeGoalsController.createGoal);

/**
 * @route   POST /api/v1/journal/goals/from-assessment
 * @desc    Generate personalized goal suggestions from onboarding assessment answers
 * @access  Private
 */
router.post('/goals/from-assessment', lifeGoalsController.generateGoalsFromAssessment);

/**
 * @route   GET /api/v1/journal/goals
 * @desc    List life goals
 * @access  Private
 */
router.get('/goals', lifeGoalsController.getGoals);

/**
 * @route   GET /api/v1/journal/goals/:id
 * @desc    Get a single life goal
 * @access  Private
 */
router.get('/goals/:id', lifeGoalsController.getGoal);

/**
 * @route   PUT /api/v1/journal/goals/:id
 * @desc    Update a life goal
 * @access  Private
 */
router.put('/goals/:id', lifeGoalsController.updateGoal);

/**
 * @route   DELETE /api/v1/journal/goals/:id
 * @desc    Delete a life goal
 * @access  Private
 */
router.delete('/goals/:id', lifeGoalsController.deleteGoal);

/**
 * @route   GET /api/v1/journal/goals/:id/entries
 * @desc    Get journal entries linked to a goal
 * @access  Private
 */
router.get('/goals/:id/entries', lifeGoalsController.getGoalEntries);

/**
 * @route   GET /api/v1/journal/goals/:id/dashboard
 * @desc    Get goal dashboard (goal + milestones + check-ins + links)
 * @access  Private
 */
router.get('/goals/:id/dashboard', lifeGoalsController.getGoalDashboard);

// ============================================
// GOAL MILESTONES
// ============================================

/**
 * @route   POST /api/v1/journal/goals/:goalId/milestones
 * @desc    Create a milestone for a life goal
 * @access  Private
 */
router.post('/goals/:goalId/milestones', lifeGoalsController.createMilestone);

/**
 * @route   GET /api/v1/journal/goals/:goalId/milestones
 * @desc    Get all milestones for a life goal
 * @access  Private
 */
router.get('/goals/:goalId/milestones', lifeGoalsController.getMilestones);

/**
 * @route   PUT /api/v1/journal/milestones/:milestoneId
 * @desc    Update a milestone
 * @access  Private
 */
router.put('/milestones/:milestoneId', lifeGoalsController.updateMilestone);

/**
 * @route   POST /api/v1/journal/milestones/:milestoneId/complete
 * @desc    Mark a milestone as complete
 * @access  Private
 */
router.post('/milestones/:milestoneId/complete', lifeGoalsController.completeMilestone);

/**
 * @route   DELETE /api/v1/journal/milestones/:milestoneId
 * @desc    Delete a milestone
 * @access  Private
 */
router.delete('/milestones/:milestoneId', lifeGoalsController.deleteMilestone);

// ============================================
// GOAL CHECK-INS
// ============================================

/**
 * @route   POST /api/v1/journal/goals/:goalId/checkins
 * @desc    Log a check-in for a life goal
 * @access  Private
 */
router.post('/goals/:goalId/checkins', lifeGoalsController.createCheckin);

/**
 * @route   GET /api/v1/journal/goals/:goalId/checkins
 * @desc    Get check-in history for a life goal
 * @access  Private
 */
router.get('/goals/:goalId/checkins', lifeGoalsController.getCheckins);

/**
 * @route   GET /api/v1/journal/goals/:goalId/checkins/streak
 * @desc    Get check-in streak for a life goal
 * @access  Private
 */
router.get('/goals/:goalId/checkins/streak', lifeGoalsController.getCheckinStreak);

// ============================================
// GOAL DECOMPOSITION & ACTIONS
// ============================================

/**
 * @route   POST /api/v1/journal/goals/:goalId/decompose
 * @desc    Decompose a life goal into actionable steps via AI
 * @access  Private
 */
router.post('/goals/:goalId/decompose', lifeGoalsController.decomposeGoal);

/**
 * @route   GET /api/v1/journal/goals/:goalId/actions
 * @desc    Get all actions for a goal
 * @access  Private
 */
router.get('/goals/:goalId/actions', lifeGoalsController.getGoalActions);

/**
 * @route   POST /api/v1/journal/goals/:goalId/actions/:actionId/respond
 * @desc    Record accept/edit/skip response to an action
 * @access  Private
 */
router.post('/goals/:goalId/actions/:actionId/respond', lifeGoalsController.respondToAction);

/**
 * @route   POST /api/v1/journal/goals/:goalId/actions/:actionId/complete
 * @desc    Mark an action as completed
 * @access  Private
 */
router.post('/goals/:goalId/actions/:actionId/complete', lifeGoalsController.completeAction);

/**
 * @route   PUT /api/v1/journal/goals/:goalId/actions/:actionId
 * @desc    Update an action's title or description
 * @access  Private
 */
router.put('/goals/:goalId/actions/:actionId', lifeGoalsController.updateAction);

// ============================================
// DAILY INTENTIONS
// ============================================

/**
 * @route   POST /api/v1/journal/intentions
 * @desc    Set a single intention (max 3 per day)
 * @access  Private
 */
router.post('/intentions', lifeGoalsController.setIntention);

/**
 * @route   POST /api/v1/journal/intentions/bulk
 * @desc    Set up to 3 intentions at once (replaces existing for today)
 * @access  Private
 */
router.post('/intentions/bulk', lifeGoalsController.bulkSetIntentions);

/**
 * @route   GET /api/v1/journal/intentions/today
 * @desc    Get all today's intentions (array)
 * @access  Private
 */
router.get('/intentions/today', lifeGoalsController.getTodayIntentions);

/**
 * @route   GET /api/v1/journal/intentions/fulfillment-rate
 * @desc    Get intention fulfillment rate (optional ?days=30)
 * @access  Private
 */
router.get('/intentions/fulfillment-rate', lifeGoalsController.getFulfillmentRate);

/**
 * @route   PUT /api/v1/journal/intentions/:id
 * @desc    Update intention (mark fulfilled, add reflection)
 * @access  Private
 */
router.put('/intentions/:id', lifeGoalsController.updateIntention);

// ============================================
// MOTIVATION PROFILE
// ============================================

/**
 * @route   GET /api/v1/journal/motivation-profile
 * @desc    Get or create the user's motivation profile
 * @access  Private
 */
router.get('/motivation-profile', lifeGoalsController.getMotivationProfile);

/**
 * @route   POST /api/v1/journal/motivation-profile
 * @desc    Create or update the user's declared motivation tier
 * @access  Private
 */
router.post('/motivation-profile', lifeGoalsController.setMotivationProfile);

/**
 * @route   PUT /api/v1/journal/motivation-profile/tier
 * @desc    Update the user's declared motivation tier only
 * @access  Private
 */
router.put('/motivation-profile/tier', lifeGoalsController.updateMotivationTier);

// ============================================
// LESSONS LEARNED
// ============================================

/**
 * @route   GET /api/v1/journal/lessons
 * @desc    Get paginated lessons (?domain=, ?confirmed=true|false, ?page=, ?limit=)
 * @access  Private
 */
router.get('/lessons', lessonsLearnedController.getLessons);

/**
 * @route   GET /api/v1/journal/lessons/reminders
 * @desc    Get lessons due for reminder (confirmed, >2 weeks old)
 * @access  Private
 */
router.get('/lessons/reminders', lessonsLearnedController.getReminders);

/**
 * @route   GET /api/v1/journal/lessons/search
 * @desc    Search lessons by text (?q=query)
 * @access  Private
 */
router.get('/lessons/search', lessonsLearnedController.searchLessons);

/**
 * @route   POST /api/v1/journal/lessons/:id/confirm
 * @desc    Confirm an AI-extracted lesson
 * @access  Private
 */
router.post('/lessons/:id/confirm', lessonsLearnedController.confirmLesson);

/**
 * @route   POST /api/v1/journal/lessons/:id/dismiss
 * @desc    Dismiss a lesson
 * @access  Private
 */
router.post('/lessons/:id/dismiss', lessonsLearnedController.dismissLesson);

/**
 * @route   POST /api/v1/journal/lessons/:id/reminded
 * @desc    Mark a lesson as reminded (still relevant)
 * @access  Private
 */
router.post('/lessons/:id/reminded', lessonsLearnedController.markReminded);

// ============================================
// VOICE JOURNALING
// ============================================

/**
 * @route   POST /api/v1/journal/voice/start
 * @desc    Start a new voice journaling session
 * @access  Private
 */
router.post('/voice/start', voiceJournalController.startSession);

/**
 * @route   GET /api/v1/journal/voice/active
 * @desc    Get active voice journal session
 * @access  Private
 */
router.get('/voice/active', voiceJournalController.getActiveSession);

/**
 * @route   POST /api/v1/journal/voice/:sessionId/turn
 * @desc    Submit a voice turn (multipart audio upload)
 * @access  Private
 */
router.post('/voice/:sessionId/turn', uploadAudio, voiceJournalController.submitVoiceTurn);

/**
 * @route   POST /api/v1/journal/voice/:sessionId/text-turn
 * @desc    Submit a text turn (fallback for no mic)
 * @access  Private
 */
router.post('/voice/:sessionId/text-turn', voiceJournalController.submitTextTurn);

/**
 * @route   POST /api/v1/journal/voice/:sessionId/summarize
 * @desc    Generate summary from conversation
 * @access  Private
 */
router.post('/voice/:sessionId/summarize', voiceJournalController.generateSummary);

/**
 * @route   POST /api/v1/journal/voice/:sessionId/approve
 * @desc    Approve summary and create journal entry
 * @access  Private
 */
router.post('/voice/:sessionId/approve', voiceJournalController.approveAndSave);

/**
 * @route   POST /api/v1/journal/voice/:sessionId/abandon
 * @desc    Abandon a voice journal session
 * @access  Private
 */
router.post('/voice/:sessionId/abandon', voiceJournalController.abandonSession);

export default router;
