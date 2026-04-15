/**
 * @file Nutrition Analysis Job
 * Background job that runs daily nutrition analysis at user's configured time (default 9 PM local)
 *
 * This job:
 * 1. Identifies users due for analysis based on their local time
 * 2. Analyzes the previous day's nutrition intake
 * 3. Generates adjustment proposals if deviation detected
 * 4. Sends notifications with coaching messages
 * 5. Updates adherence patterns for learning
 */

import { query } from '../database/pg.js';
import { logger } from '../services/logger.service.js';
import { notificationService } from '../services/notification.service.js';
import { nutritionAnalysisService, DeviationClassification } from '../services/nutrition-analysis.service.js';
import { adaptiveCalorieService } from '../services/adaptive-calorie.service.js';
import { nutritionLearningService } from '../services/nutrition-learning.service.js';

// ============================================
// CONFIGURATION
// ============================================

const JOB_INTERVAL_MS = 60 * 1000; // Check every minute
const DEFAULT_ANALYSIS_HOUR = 21; // 9 PM default
const DEFAULT_ANALYSIS_MINUTE = 0;

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

// ============================================
// JOB PROCESSOR
// ============================================

/**
 * Process nutrition analysis for users at their configured time
 */
async function processNutritionAnalysis(): Promise<void> {
  if (isRunning) {
    return;
  }

  isRunning = true;

  try {
    const now = new Date();

    // Check if nutrition_user_preferences table exists
    let tableExists = false;
    try {
      const tableCheck = await query<{ exists: boolean }>(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'nutrition_user_preferences'
        ) as exists`,
        []
      );
      tableExists = tableCheck.rows[0]?.exists ?? false;
    } catch (err) {
      logger.warn('[NutritionAnalysisJob] Could not check for nutrition_user_preferences table', { error: err });
      tableExists = false;
    }

    // Get all users with active diet plans and their preferences
    // Use conditional query based on table existence
    const usersResult = await query<{
      id: string;
      email: string;
      first_name: string;
      timezone: string;
      analysis_time: string | null;
      analysis_enabled: boolean | null;
      auto_adjust_enabled: boolean | null;
      notify_on_deviation: boolean | null;
      deviation_threshold_percent: number | null;
    }>(
      tableExists
        ? `SELECT
            u.id,
            u.email,
            u.first_name,
            COALESCE(up.timezone, 'UTC') as timezone,
            nup.analysis_time,
            nup.analysis_enabled,
            nup.auto_adjust_enabled,
            nup.notify_on_deviation,
            nup.deviation_threshold_percent
          FROM users u
          LEFT JOIN user_preferences up ON up.user_id = u.id
          LEFT JOIN nutrition_user_preferences nup ON nup.user_id = u.id
          WHERE EXISTS (
            SELECT 1 FROM diet_plans dp
            WHERE dp.user_id = u.id AND dp.status = 'active'
          )`
        : `SELECT
            u.id,
            u.email,
            u.first_name,
            COALESCE(up.timezone, 'UTC') as timezone,
            NULL::VARCHAR(5) as analysis_time,
            NULL::BOOLEAN as analysis_enabled,
            NULL::BOOLEAN as auto_adjust_enabled,
            NULL::BOOLEAN as notify_on_deviation,
            NULL::DECIMAL(5,2) as deviation_threshold_percent
          FROM users u
          LEFT JOIN user_preferences up ON up.user_id = u.id
          WHERE EXISTS (
            SELECT 1 FROM diet_plans dp
            WHERE dp.user_id = u.id AND dp.status = 'active'
          )`,
      []
    );

    let processed = 0;
    let skipped = 0;

    for (const user of usersResult.rows) {
      try {
        // Check if analysis is enabled (default true)
        if (user.analysis_enabled === false) {
          continue;
        }

        // Get user's local time
        const userTimezone = user.timezone || 'UTC';
        let userLocalTime: Date;

        try {
          userLocalTime = new Date(now.toLocaleString('en-US', { timeZone: userTimezone }));
        } catch {
          // Invalid timezone, skip user
          logger.warn('[NutritionAnalysisJob] Invalid timezone for user', {
            userId: user.id,
            timezone: userTimezone,
          });
          continue;
        }

        // Parse analysis time (default 21:00)
        const analysisTime = user.analysis_time || `${DEFAULT_ANALYSIS_HOUR}:${DEFAULT_ANALYSIS_MINUTE.toString().padStart(2, '0')}`;
        const [analysisHour, analysisMinute] = analysisTime.split(':').map(Number);

        // Check if it's time for this user's analysis (within 1 minute window)
        if (
          userLocalTime.getHours() !== analysisHour ||
          userLocalTime.getMinutes() !== analysisMinute
        ) {
          continue;
        }

        // Check if already analyzed today
        const yesterday = new Date(userLocalTime);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const alreadyAnalyzed = await hasAnalyzedToday(user.id, yesterdayStr);
        if (alreadyAnalyzed) {
          skipped++;
          continue;
        }

        logger.info('[NutritionAnalysisJob] Starting analysis for user', {
          userId: user.id,
          timezone: userTimezone,
          analysisDate: yesterdayStr,
        });

        // Run analysis for yesterday
        const analysis = await nutritionAnalysisService.analyzeDailyNutrition({
          userId: user.id,
          date: yesterday,
          forceReanalyze: false,
        });

        if (!analysis) {
          logger.debug('[NutritionAnalysisJob] No analysis generated (no active plan)', {
            userId: user.id,
          });
          continue;
        }

        // Update learning patterns
        await nutritionLearningService.updatePatternsFromAnalysis({
          userId: user.id,
          date: yesterday,
          deviationPercent: analysis.deviation.deviationPercent,
          classification: analysis.deviation.classification,
          whoopWorkoutCalories: analysis.whoopContext.workoutCalories,
        });

        // Generate adjustment proposal if needed and auto-adjust is enabled
        let adjustmentId: string | null = null;
        let coachingMessage = analysis.aiAnalysis || '';

        if (
          user.auto_adjust_enabled !== false &&
          shouldCreateAdjustment(analysis.deviation.classification, analysis.deviation.deviationPercent, user.deviation_threshold_percent)
        ) {
          const userPrefs = await adaptiveCalorieService.getUserPreferences(user.id);
          const adjustment = await adaptiveCalorieService.generateAdjustmentPlan(
            analysis,
            userPrefs
          );

          // Store adjustment proposal
          adjustmentId = await adaptiveCalorieService.storeAdjustmentPlan(
            user.id,
            analysis.id,
            analysis.targets.dietPlanId,
            adjustment
          );

          coachingMessage = adjustment.coachingMessage;
        }

        // Send notification if enabled and deviation exceeds threshold
        const shouldNotify =
          user.notify_on_deviation !== false &&
          analysis.deviation.classification !== 'on_target' &&
          Math.abs(analysis.deviation.deviationPercent) >= (user.deviation_threshold_percent || 15);

        if (shouldNotify) {
          await sendAnalysisNotification(user, analysis, adjustmentId, coachingMessage);
        }

        // Mark analysis as notification sent
        if (shouldNotify) {
          await query(
            `UPDATE nutrition_daily_analysis
             SET notification_sent = true, notification_sent_at = CURRENT_TIMESTAMP
             WHERE id = $1`,
            [analysis.id]
          );
        }

        processed++;

        logger.info('[NutritionAnalysisJob] Analysis completed', {
          userId: user.id,
          date: yesterdayStr,
          classification: analysis.deviation.classification,
          deviationPercent: analysis.deviation.deviationPercent,
          adjustmentCreated: !!adjustmentId,
          notificationSent: shouldNotify,
        });
      } catch (userError) {
        logger.error('[NutritionAnalysisJob] Failed to process user', {
          userId: user.id,
          error: userError instanceof Error ? userError.message : 'Unknown error',
        });
        // Continue processing other users
      }
    }

    if (processed > 0 || skipped > 0) {
      logger.info('[NutritionAnalysisJob] Batch completed', {
        processed,
        skipped,
        totalUsers: usersResult.rows.length,
      });
    }
  } catch (error) {
    logger.error('[NutritionAnalysisJob] Failed to process nutrition analysis', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    isRunning = false;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if analysis was already run for this date
 */
async function hasAnalyzedToday(userId: string, dateStr: string): Promise<boolean> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM nutrition_daily_analysis
     WHERE user_id = $1 AND analysis_date = $2::date`,
    [userId, dateStr]
  );

  return parseInt(result.rows[0].count, 10) > 0;
}

/**
 * Determine if an adjustment should be created
 */
function shouldCreateAdjustment(
  classification: DeviationClassification,
  deviationPercent: number,
  thresholdPercent: number | null
): boolean {
  // Don't create adjustments for on-target or over-consumption
  if (classification === 'on_target') return false;
  if (classification.includes('over')) return false;

  // Check against threshold
  const threshold = thresholdPercent || 15;
  return Math.abs(deviationPercent) >= threshold;
}

/**
 * Send analysis notification
 */
async function sendAnalysisNotification(
  user: { id: string; first_name: string; email: string },
  analysis: { id: string; deviation: { classification: DeviationClassification; deviationPercent: number } },
  adjustmentId: string | null,
  coachingMessage: string
): Promise<void> {
  const isUnder = analysis.deviation.deviationPercent < 0;
  const absPercent = Math.abs(analysis.deviation.deviationPercent).toFixed(0);

  // Determine notification title and icon
  let title: string;
  let icon: string;

  if (analysis.deviation.classification === 'missed_day') {
    title = 'Missed logging yesterday';
    icon = '📝';
  } else if (isUnder) {
    title = `${absPercent}% under target yesterday`;
    icon = '🥗';
  } else {
    title = `${absPercent}% over target yesterday`;
    icon = '🍽️';
  }

  // Truncate coaching message for notification
  const shortMessage =
    coachingMessage.length > 150 ? coachingMessage.slice(0, 147) + '...' : coachingMessage;

  await notificationService.create({
    userId: user.id,
    type: 'coaching',
    title,
    message: shortMessage,
    icon,
    actionUrl: '/dashboard?tab=nutrition&view=insights',
    actionLabel: adjustmentId ? 'View Options' : 'View Details',
    category: 'nutrition',
    priority: analysis.deviation.classification.includes('severe') ? 'high' : 'normal',
    metadata: {
      analysisId: analysis.id,
      adjustmentId,
      deviationPercent: analysis.deviation.deviationPercent,
      classification: analysis.deviation.classification,
    },
  });
}

// ============================================
// JOB CONTROL
// ============================================

/**
 * Start the nutrition analysis job
 */
export function startNutritionAnalysisJob(): void {
  if (intervalId) {
    logger.warn('[NutritionAnalysisJob] Job is already running');
    return;
  }

  logger.info('[NutritionAnalysisJob] Starting nutrition analysis job');

  // Run immediately on start (for testing/catching up)
  processNutritionAnalysis().catch((error) => {
    logger.error('[NutritionAnalysisJob] Error in initial run', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  });

  // Then run every minute
  intervalId = setInterval(() => {
    processNutritionAnalysis().catch((error) => {
      logger.error('[NutritionAnalysisJob] Error in scheduled run', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });
  }, JOB_INTERVAL_MS);
}

/**
 * Stop the nutrition analysis job
 */
export function stopNutritionAnalysisJob(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('[NutritionAnalysisJob] Nutrition analysis job stopped');
  }
}

/**
 * Manually trigger analysis for a specific user (for testing)
 */
export async function triggerAnalysisForUser(userId: string, date?: Date): Promise<void> {
  const analysisDate = date || new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday by default

  logger.info('[NutritionAnalysisJob] Manual trigger for user', {
    userId,
    date: analysisDate.toISOString().split('T')[0],
  });

  const analysis = await nutritionAnalysisService.analyzeDailyNutrition({
    userId,
    date: analysisDate,
    forceReanalyze: true,
  });

  if (analysis) {
    await nutritionLearningService.updatePatternsFromAnalysis({
      userId,
      date: analysisDate,
      deviationPercent: analysis.deviation.deviationPercent,
      classification: analysis.deviation.classification,
      whoopWorkoutCalories: analysis.whoopContext.workoutCalories,
    });

    logger.info('[NutritionAnalysisJob] Manual analysis completed', {
      userId,
      classification: analysis.deviation.classification,
    });
  }
}

// Export job object for consistency with other jobs
export const nutritionAnalysisJob = {
  start: startNutritionAnalysisJob,
  stop: stopNutritionAnalysisJob,
  triggerForUser: triggerAnalysisForUser,
};
