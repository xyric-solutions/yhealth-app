import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import achievementsController from '../controllers/achievements.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// Achievements
// ============================================

// Get all achievements with user progress
router.get('/', achievementsController.getAchievements);

// Get achievement summary for dashboard
router.get('/summary', achievementsController.getAchievementSummary);

// Get user achievements (for viewing another user's profile - requires chat relationship)
router.get('/user/:userId', achievementsController.getUserAchievements);

// Get leaderboard
router.get('/leaderboard', achievementsController.getLeaderboard);

// Check for new achievements
router.post('/check', achievementsController.checkNewAchievements);

// ============================================
// Micro-Wins & Dynamic Achievements
// ============================================

// Get recent micro-wins
router.get('/micro-wins', achievementsController.getMicroWins);

// Dismiss a micro-win
router.patch('/micro-wins/:microWinId/dismiss', achievementsController.dismissMicroWin);

// Generate achievements from a goal
router.post('/goal-map', achievementsController.generateGoalAchievements);

export default router;
