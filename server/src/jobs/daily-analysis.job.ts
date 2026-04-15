/**
 * @file Daily Analysis Job
 * @description Scheduled job that generates daily analysis reports for users who have
 * daily scores but no corresponding analysis report yet. Runs every 2 hours to catch
 * timezone rollovers and ensure timely report generation.
 */

import { query } from '../database/pg.js';
import { logger } from '../services/logger.service.js';
import { dailyAnalysisService } from '../services/daily-analysis.service.js';
import { userCoachingProfileService } from '../services/user-coaching-profile.service.js';
import { predictionAccuracyService } from '../services/prediction-accuracy.service.js';
import { weeklyReportService } from '../services/weekly-report.service.js';

// ============================================
// CONFIGURATION
// ============================================

const JOB_INTERVAL_MS = 2 * 60 * 60 * 1000; // Run every 2 hours (catches timezone rollovers)
const STARTUP_DELAY_MS = 90 * 1000; // 90-second delay — staggered from proactive messaging (30s) to prevent query overlap
const BATCH_SIZE = 5; // Fewer parallel since LLM-heavy
const INTER_BATCH_DELAY_MS = 3000; // 3 seconds between batches
let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

// ============================================
// JOB PROCESSOR
// ============================================

/**
 * Process daily analysis report generation for active users with scores but no report.
 */
async function processDailyAnalysis(): Promise<void> {
  if (isRunning) {
    return;
  }

  isRunning = true;

  try {
    // Find active users with daily scores for today but no analysis report
    const result = await query<{ id: string; score_date: string }>(
      `SELECT DISTINCT u.id, ds.date as score_date
       FROM users u
       INNER JOIN daily_user_scores ds ON ds.user_id = u.id
       LEFT JOIN daily_analysis_reports dar ON dar.user_id = u.id AND dar.report_date = ds.date
       WHERE u.is_active = true
         AND ds.date >= CURRENT_DATE - INTERVAL '1 day'
         AND dar.id IS NULL
       ORDER BY ds.date DESC
       LIMIT 50`,
    );

    if (result.rows.length === 0) {
      logger.debug('[DailyAnalysisJob] No users need analysis reports');
      return;
    }

    let processed = 0;
    let errors = 0;

    // Process in batches
    for (let i = 0; i < result.rows.length; i += BATCH_SIZE) {
      const batch = result.rows.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async (user) => {
          try {
            // Only regenerate profile if stale (>2h) — avoids redundant queries when coach profile job already ran
            const existingProfile = await userCoachingProfileService.getProfile(user.id);
            if (!existingProfile) {
              await userCoachingProfileService.generateProfile(user.id).catch((err) => {
                logger.warn('[DailyAnalysisJob] Profile generation failed (non-fatal, continuing with report)', {
                  userId: user.id,
                  error: err instanceof Error ? err.message : 'Unknown',
                });
              });
            } else {
              logger.debug('[DailyAnalysisJob] Profile fresh, skipping regeneration', { userId: user.id.slice(0, 8) });
            }

            await dailyAnalysisService.generateDailyReport(user.id, user.score_date);
            processed++;

            // Track yesterday's prediction accuracy (non-fatal)
            await predictionAccuracyService.trackPredictionAccuracy(user.id, user.score_date).catch((err) => {
              logger.warn('[DailyAnalysisJob] Prediction tracking failed (non-fatal)', {
                userId: user.id.slice(0, 8),
                error: err instanceof Error ? err.message : 'Unknown',
              });
            });

            logger.debug('[DailyAnalysisJob] Generated report', {
              userId: user.id,
              date: user.score_date,
            });
          } catch (error) {
            errors++;
            logger.error('[DailyAnalysisJob] Failed to process user', {
              userId: user.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        })
      );

      // Inter-batch delay to avoid overwhelming the LLM
      if (i + BATCH_SIZE < result.rows.length) {
        await new Promise((resolve) => setTimeout(resolve, INTER_BATCH_DELAY_MS));
      }
    }

    if (processed > 0 || errors > 0) {
      logger.info('[DailyAnalysisJob] Processing complete', {
        processed,
        errors,
        totalEligible: result.rows.length,
      });
    }

    // On Sundays, generate weekly reports for users who had daily reports this week
    const today = new Date();
    if (today.getUTCDay() === 0 && processed > 0) {
      const processedUserIds = [...new Set(result.rows.map((r) => r.id))];
      let weeklyGenerated = 0;
      for (const uid of processedUserIds) {
        try {
          const report = await weeklyReportService.generateWeeklyReport(uid);
          if (report) weeklyGenerated++;
        } catch (err) {
          logger.warn('[DailyAnalysisJob] Weekly report generation failed (non-fatal)', {
            userId: uid.slice(0, 8),
            error: err instanceof Error ? err.message : 'Unknown',
          });
        }
      }
      if (weeklyGenerated > 0) {
        logger.info('[DailyAnalysisJob] Weekly reports generated', { count: weeklyGenerated });
      }
    }
  } catch (error) {
    logger.error('[DailyAnalysisJob] Fatal error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    isRunning = false;
  }
}

// ============================================
// JOB LIFECYCLE
// ============================================

/**
 * Start the daily analysis job
 */
export function startDailyAnalysis(): void {
  if (intervalId) {
    logger.warn('[DailyAnalysisJob] Already running');
    return;
  }

  logger.info('[DailyAnalysisJob] Starting daily analysis job', {
    intervalMs: JOB_INTERVAL_MS,
    startupDelayMs: STARTUP_DELAY_MS,
    batchSize: BATCH_SIZE,
  });

  // Delay first run to stagger from other background jobs (proactive messaging starts at 30s)
  setTimeout(() => {
    processDailyAnalysis();
    // Then run on interval
    intervalId = setInterval(processDailyAnalysis, JOB_INTERVAL_MS);
  }, STARTUP_DELAY_MS);
}

/**
 * Stop the daily analysis job
 */
export function stopDailyAnalysis(): void {
  if (!intervalId) {
    logger.warn('[DailyAnalysisJob] Not running');
    return;
  }

  clearInterval(intervalId);
  intervalId = null;

  logger.info('[DailyAnalysisJob] Stopped daily analysis job');
}

/**
 * Check if the job is running
 */
export function isDailyAnalysisRunning(): boolean {
  return intervalId !== null;
}

// ============================================
// EXPORTS
// ============================================

export const dailyAnalysisJob = {
  start: startDailyAnalysis,
  stop: stopDailyAnalysis,
  isRunning: isDailyAnalysisRunning,
  processNow: processDailyAnalysis,
};

export default dailyAnalysisJob;
