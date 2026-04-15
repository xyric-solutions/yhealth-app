/**
 * @file Status Pattern Analysis Job
 * Daily background job that analyzes each active user's status history
 * to detect recurring patterns (day-of-week, post-event recovery, streak disruption).
 * Detected patterns are persisted to user_coaching_profiles for use by the AI coach.
 */

import { query } from '../database/pg.js';
import { logger } from '../services/logger.service.js';
import { statusPatternAnalyzerService } from '../services/status-pattern-analyzer.service.js';

// ============================================
// CONFIGURATION
// ============================================

const JOB_INTERVAL_MS = process.env.STATUS_PATTERN_ANALYSIS_INTERVAL_MS
  ? parseInt(process.env.STATUS_PATTERN_ANALYSIS_INTERVAL_MS, 10)
  : 24 * 60 * 60 * 1000; // Default: 24 hours
const STARTUP_DELAY_MS = process.env.STATUS_PATTERN_ANALYSIS_STARTUP_DELAY_MS
  ? parseInt(process.env.STATUS_PATTERN_ANALYSIS_STARTUP_DELAY_MS, 10)
  : 720_000; // Default: 12 minutes
const BATCH_SIZE = 5;
const INTER_BATCH_DELAY_MS = 2000;
let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;
let startupTimeoutId: NodeJS.Timeout | null = null;

// ============================================
// JOB PROCESSOR
// ============================================

async function processPatternAnalysis(): Promise<void> {
  if (isRunning) {
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    // Get all active users
    const usersResult = await query<{ id: string }>(
      `SELECT id FROM users WHERE is_active = true`
    );

    const users = usersResult.rows;

    logger.info('[StatusPatternAnalysisJob] Starting pattern analysis', {
      userCount: users.length,
    });

    let analyzed = 0;
    let patternsFound = 0;
    let errors = 0;

    // Process in batches
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (user) => {
          try {
            const patterns = await statusPatternAnalyzerService.analyzePatterns(user.id);
            await statusPatternAnalyzerService.persistPatterns(user.id, patterns);

            analyzed++;
            patternsFound += patterns.length;

            if (patterns.length > 0) {
              logger.debug('[StatusPatternAnalysisJob] Patterns detected for user', {
                userId: user.id.slice(0, 8),
                patternCount: patterns.length,
                types: patterns.map((p) => p.type),
              });
            }
          } catch (error) {
            errors++;
            logger.error('[StatusPatternAnalysisJob] Error analyzing user', {
              userId: user.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        })
      );

      // Delay between batches
      if (i + BATCH_SIZE < users.length) {
        await new Promise((resolve) => setTimeout(resolve, INTER_BATCH_DELAY_MS));
      }
    }

    const duration = Date.now() - startTime;
    logger.info('[StatusPatternAnalysisJob] Completed pattern analysis', {
      userCount: users.length,
      analyzed,
      patternsFound,
      errors,
      durationMs: duration,
    });
  } catch (error) {
    logger.error('[StatusPatternAnalysisJob] Error in pattern analysis job', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
  } finally {
    isRunning = false;
  }
}

// ============================================
// JOB CONTROL
// ============================================

export function startStatusPatternAnalysisJob(): void {
  if (intervalId !== null) {
    logger.warn('[StatusPatternAnalysisJob] Job is already running');
    return;
  }

  logger.info('[StatusPatternAnalysisJob] Starting pattern analysis job', {
    intervalMs: JOB_INTERVAL_MS,
    startupDelayMs: STARTUP_DELAY_MS,
    batchSize: BATCH_SIZE,
  });

  startupTimeoutId = setTimeout(() => {
    startupTimeoutId = null;
    processPatternAnalysis().catch((error) => {
      logger.error('[StatusPatternAnalysisJob] Error in initial run', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });

    intervalId = setInterval(() => {
      processPatternAnalysis().catch((error) => {
        logger.error('[StatusPatternAnalysisJob] Error in scheduled run', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });
    }, JOB_INTERVAL_MS);
  }, STARTUP_DELAY_MS);
}

export function stopStatusPatternAnalysisJob(): void {
  logger.info('[StatusPatternAnalysisJob] Stopping pattern analysis job');

  if (startupTimeoutId) {
    clearTimeout(startupTimeoutId);
    startupTimeoutId = null;
  }

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  const timeout = 30000;
  const startTime = Date.now();
  while (isRunning && Date.now() - startTime < timeout) {
    // Wait for current run to finish
  }

  if (isRunning) {
    logger.warn('[StatusPatternAnalysisJob] Job did not finish within timeout');
  }
}

// ============================================
// EXPORTS
// ============================================

export const statusPatternAnalysisJob = {
  start: startStatusPatternAnalysisJob,
  stop: stopStatusPatternAnalysisJob,
};
