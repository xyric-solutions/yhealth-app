/**
 * @file Insights Computation Job
 * @description Background job that runs health correlation detection and theme analysis
 * Runs every 6 hours, processes 5 users per batch
 */

import { query } from '../database/pg.js';
import { logger } from '../services/logger.service.js';
import { healthCorrelationService } from '../services/wellbeing/health-correlation.service.js';
import { themeDetectionService } from '../services/wellbeing/theme-detection.service.js';

// ============================================
// CONFIGURATION
// ============================================

const JOB_INTERVAL_MS = 6 * 60 * 60 * 1000; // Every 6 hours
const STARTUP_DELAY_MS = 120 * 1000; // 120s stagger
const BATCH_SIZE = 5;
let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

// ============================================
// JOB PROCESSOR
// ============================================

async function processInsights(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  try {
    // Find active users who haven't had insights computed recently
    const result = await query<{ id: string }>(
      `SELECT u.id
       FROM users u
       WHERE u.is_active = true
         AND NOT EXISTS (
           SELECT 1 FROM journal_patterns jp
           WHERE jp.user_id = u.id
             AND jp.category = 'correlation'
             AND jp.computed_at > NOW() - INTERVAL '24 hours'
         )
       ORDER BY RANDOM()
       LIMIT $1`,
      [BATCH_SIZE]
    );

    if (result.rows.length === 0) {
      return;
    }

    logger.info(`[InsightsJob] Processing ${result.rows.length} users`);

    for (const user of result.rows) {
      try {
        const correlations = await healthCorrelationService.detectAllCorrelations(user.id, 30);
        if (correlations.length > 0) {
          logger.info(`[InsightsJob] Found ${correlations.length} correlations for user ${user.id}`);
        }

        // Also compute aggregate themes
        await themeDetectionService.computeAggregateThemes(user.id, 30);
      } catch (error) {
        logger.error(`[InsightsJob] Failed for user ${user.id}`, { error });
      }
    }
  } catch (error) {
    logger.error('[InsightsJob] Job failed', { error });
  } finally {
    isRunning = false;
  }
}

// ============================================
// JOB LIFECYCLE
// ============================================

function start(): void {
  if (intervalId) return;

  setTimeout(() => {
    processInsights();
    intervalId = setInterval(processInsights, JOB_INTERVAL_MS);
  }, STARTUP_DELAY_MS);
}

function stop(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export const insightsComputationJob = { start, stop };
