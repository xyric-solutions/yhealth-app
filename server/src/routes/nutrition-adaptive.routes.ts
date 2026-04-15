/**
 * @file Nutrition Adaptive Routes
 * API endpoints for adaptive nutrition coaching features
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { logger } from '../services/logger.service.js';
import { nutritionAnalysisService } from '../services/nutrition-analysis.service.js';
import { adaptiveCalorieService } from '../services/adaptive-calorie.service.js';
import { nutritionLearningService } from '../services/nutrition-learning.service.js';
import { triggerAnalysisForUser } from '../jobs/nutrition-analysis.job.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// DAILY ANALYSIS ENDPOINTS
// ============================================

/**
 * GET /api/nutrition/daily-analysis/:date
 * Get analysis for a specific date
 */
router.get('/daily-analysis/:date', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { date } = req.params;

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    const analysis = await nutritionAnalysisService.getExistingAnalysis(userId, date);

    if (!analysis) {
      return res.status(404).json({ error: 'No analysis found for this date.' });
    }

    return res.json({ analysis });
  } catch (error) {
    logger.error('[NutritionAdaptiveRoutes] Error getting daily analysis', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return res.status(500).json({ error: 'Failed to get daily analysis' });
  }
});

/**
 * GET /api/nutrition/analysis-history
 * Get analysis history for date range
 */
router.get('/analysis-history', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { startDate, endDate, limit } = req.query;

    const analyses = await nutritionAnalysisService.getAnalysisHistory(userId, {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: limit ? parseInt(limit as string, 10) : 30,
    });

    return res.json({ analyses });
  } catch (error) {
    logger.error('[NutritionAdaptiveRoutes] Error getting analysis history', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return res.status(500).json({ error: 'Failed to get analysis history' });
  }
});

/**
 * PATCH /api/nutrition/daily-analysis/:id/feedback
 * Update deviation reason for an analysis
 */
router.patch('/daily-analysis/:id/feedback', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { reason, notes } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Reason is required' });
    }

    const validReasons = [
      'intentional', 'unintentional', 'sick', 'social_event',
      'forgot', 'busy', 'travel', 'stress'
    ];

    if (!validReasons.includes(reason)) {
      return res.status(400).json({
        error: 'Invalid reason',
        validReasons,
      });
    }

    await nutritionAnalysisService.updateDeviationFeedback(id, userId, { reason, notes });

    return res.json({ success: true });
  } catch (error) {
    logger.error('[NutritionAdaptiveRoutes] Error updating feedback', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return res.status(500).json({ error: 'Failed to update feedback' });
  }
});

/**
 * POST /api/nutrition/trigger-analysis
 * Manually trigger analysis for testing (dev only)
 */
router.post('/trigger-analysis', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { date } = req.body;

    const analysisDate = date ? new Date(date) : new Date(Date.now() - 24 * 60 * 60 * 1000);

    await triggerAnalysisForUser(userId, analysisDate);

    const analysis = await nutritionAnalysisService.getExistingAnalysis(
      userId,
      analysisDate.toISOString().split('T')[0]
    );

    return res.json({ success: true, analysis });
  } catch (error) {
    logger.error('[NutritionAdaptiveRoutes] Error triggering analysis', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return res.status(500).json({ error: 'Failed to trigger analysis' });
  }
});

// ============================================
// ADAPTIVE PLAN ENDPOINTS
// ============================================

/**
 * GET /api/nutrition/adaptive-plan
 * Get current adjusted targets for today
 */
router.get('/adaptive-plan', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const adjustedTargets = await adaptiveCalorieService.getTodayAdjustedTarget(userId);

    if (!adjustedTargets) {
      return res.status(404).json({
        error: 'No active diet plan found',
        message: 'Create a diet plan to get adaptive targets.',
      });
    }

    return res.json(adjustedTargets);
  } catch (error) {
    logger.error('[NutritionAdaptiveRoutes] Error getting adaptive plan', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return res.status(500).json({ error: 'Failed to get adaptive plan' });
  }
});

/**
 * GET /api/nutrition/pending-adjustments
 * Get pending adjustment proposals
 */
router.get('/pending-adjustments', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const adjustments = await adaptiveCalorieService.getPendingAdjustments(userId);

    return res.json({ adjustments });
  } catch (error) {
    logger.error('[NutritionAdaptiveRoutes] Error getting pending adjustments', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return res.status(500).json({ error: 'Failed to get pending adjustments' });
  }
});

/**
 * POST /api/nutrition/adjustment-response
 * Submit user choice for an adjustment proposal
 */
router.post('/adjustment-response', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { adjustmentId, choice, modifications } = req.body;

    if (!adjustmentId || !choice) {
      return res.status(400).json({ error: 'adjustmentId and choice are required' });
    }

    const validChoices = ['accept', 'modify', 'skip'];
    if (!validChoices.includes(choice)) {
      return res.status(400).json({
        error: 'Invalid choice',
        validChoices,
      });
    }

    if (choice === 'modify' && !modifications) {
      return res.status(400).json({
        error: 'modifications required when choice is "modify"',
      });
    }

    await adaptiveCalorieService.applyUserChoice(adjustmentId, userId, choice, modifications);

    return res.json({
      success: true,
      message: choice === 'accept'
        ? 'Adjustment accepted and will be applied to your targets.'
        : choice === 'modify'
          ? 'Your modified adjustment has been saved.'
          : 'Adjustment skipped.',
    });
  } catch (error) {
    logger.error('[NutritionAdaptiveRoutes] Error applying adjustment response', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return res.status(500).json({ error: 'Failed to apply adjustment response' });
  }
});

// ============================================
// INSIGHTS ENDPOINTS
// ============================================

/**
 * GET /api/nutrition/insights
 * Get behavioral patterns and recommendations
 */
router.get('/insights', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { days } = req.query;

    const analysis = await nutritionLearningService.analyzePatterns(
      userId,
      days ? parseInt(days as string, 10) : 30
    );

    return res.json(analysis);
  } catch (error) {
    logger.error('[NutritionAdaptiveRoutes] Error getting insights', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return res.status(500).json({ error: 'Failed to get insights' });
  }
});

/**
 * GET /api/nutrition/day-patterns
 * Get day-of-week adherence patterns
 */
router.get('/day-patterns', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const patterns = await nutritionLearningService.detectDayOfWeekPatterns(userId);

    return res.json({ patterns });
  } catch (error) {
    logger.error('[NutritionAdaptiveRoutes] Error getting day patterns', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return res.status(500).json({ error: 'Failed to get day patterns' });
  }
});

// ============================================
// PREFERENCES ENDPOINTS
// ============================================

/**
 * GET /api/nutrition/preferences
 * Get user's nutrition coaching preferences
 */
router.get('/preferences', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    const preferences = await adaptiveCalorieService.getUserPreferences(userId);

    return res.json(preferences);
  } catch (error) {
    logger.error('[NutritionAdaptiveRoutes] Error getting preferences', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return res.status(500).json({ error: 'Failed to get preferences' });
  }
});

/**
 * PATCH /api/nutrition/preferences
 * Update user's nutrition coaching preferences
 */
router.patch('/preferences', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const preferences = req.body;

    // Validate preferences
    const allowedFields = [
      'analysisTime', 'analysisEnabled', 'autoAdjustEnabled',
      'maxDailyAdjustmentCalories', 'maxRedistributionDays',
      'preferNextDayAdjustment', 'adjustmentStrategy',
      'notifyOnDeviation', 'deviationThresholdPercent',
      'factorWorkoutCalories', 'workoutCalorieAddbackPercent',
      'skipIfRecoveryBelow', 'increaseCarbsOnHighStrain',
    ];

    const invalidFields = Object.keys(preferences).filter(
      (key) => !allowedFields.includes(key)
    );

    if (invalidFields.length > 0) {
      return res.status(400).json({
        error: 'Invalid fields',
        invalidFields,
        allowedFields,
      });
    }

    // Validate specific fields
    if (preferences.analysisTime && !/^\d{2}:\d{2}$/.test(preferences.analysisTime)) {
      return res.status(400).json({ error: 'analysisTime must be in HH:MM format' });
    }

    if (preferences.maxDailyAdjustmentCalories &&
        (preferences.maxDailyAdjustmentCalories < 50 || preferences.maxDailyAdjustmentCalories > 500)) {
      return res.status(400).json({
        error: 'maxDailyAdjustmentCalories must be between 50 and 500',
      });
    }

    if (preferences.workoutCalorieAddbackPercent &&
        (preferences.workoutCalorieAddbackPercent < 30 || preferences.workoutCalorieAddbackPercent > 100)) {
      return res.status(400).json({
        error: 'workoutCalorieAddbackPercent must be between 30 and 100',
      });
    }

    await adaptiveCalorieService.saveUserPreferences(userId, preferences);

    const updated = await adaptiveCalorieService.getUserPreferences(userId);

    return res.json({
      success: true,
      preferences: updated,
    });
  } catch (error) {
    logger.error('[NutritionAdaptiveRoutes] Error updating preferences', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return res.status(500).json({ error: 'Failed to update preferences' });
  }
});

export default router;
