/**
 * @file Engagement Scoring Job
 * @description Background job that computes engagement scores and updates computed motivation tiers.
 * Runs weekly, processes active users in batches of 10.
 */

import { query } from '../database/pg.js';
import { logger } from '../services/logger.service.js';
import { motivationTierService } from '../services/motivation-tier.service.js';

// ============================================
// CONFIGURATION
// ============================================

const JOB_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // Every 7 days
const STARTUP_DELAY_MS = 10 * 60 * 1000; // 10 minutes after start
const BATCH_SIZE = 10;
let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

// ============================================
// JOB PROCESSOR
// ============================================

async function processEngagementScores(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  try {
    // Find active users (users with activity in last 30 days)
    const result = await query<{ id: string }>(
      `SELECT DISTINCT u.id
       FROM users u
       INNER JOIN activity_logs al ON al.user_id = u.id
       WHERE u.is_active = true
         AND al.created_at >= NOW() - INTERVAL '30 days'
       ORDER BY u.id
       LIMIT $1`,
      [BATCH_SIZE]
    );

    if (result.rows.length === 0) {
      logger.info('[EngagementScoringJob] No active users to process');
      return;
    }

    logger.info(`[EngagementScoringJob] Processing ${result.rows.length} users`);

    for (const user of result.rows) {
      try {
        // Ensure profile exists
        await motivationTierService.getProfile(user.id);

        // Compute engagement score from behavioral data
        const score = await motivationTierService.computeEngagementScore(user.id);

        // Update computed tier based on thresholds and change policy
        await motivationTierService.updateComputedTier(user.id);

        logger.info(`[EngagementScoringJob] Processed user ${user.id}`, { score });
      } catch (error) {
        logger.error(`[EngagementScoringJob] Failed for user ${user.id}`, { error });
      }
    }

    logger.info('[EngagementScoringJob] Batch complete');
  } catch (error) {
    logger.error('[EngagementScoringJob] Job failed', { error });
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
    processEngagementScores();
    intervalId = setInterval(processEngagementScores, JOB_INTERVAL_MS);
  }, STARTUP_DELAY_MS);
}

function stop(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export const engagementScoringJob = { start, stop };
