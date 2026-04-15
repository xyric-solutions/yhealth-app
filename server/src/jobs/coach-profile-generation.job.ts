/**
 * @file Coach Profile Generation Job
 * @description Timezone-aware job that regenerates coaching profiles for active users.
 * Runs every 6 hours and processes users whose profiles are stale or missing.
 */

import { query } from '../database/pg.js';
import { logger } from '../services/logger.service.js';
import { userCoachingProfileService } from '../services/user-coaching-profile.service.js';
import { llmCircuitBreaker } from '../services/llm-circuit-breaker.service.js';

// ============================================
// CONFIGURATION
// ============================================

const JOB_INTERVAL_MS = 6 * 60 * 60 * 1000; // Run every 6 hours
const PROFILE_STALE_HOURS = 12; // Profiles valid for 12 hours (was 6h — reduced query load)
const BATCH_SIZE = 2; // Keep small to avoid overwhelming DB + OpenAI rate limits
const MAX_USERS_PER_RUN = 10; // Cap users per run to prevent query storms (was 100)
const INTER_BATCH_DELAY_MS = 5000; // 5 seconds between batches to spread DB load
let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

// ============================================
// JOB PROCESSOR
// ============================================

/**
 * Process coaching profile generation for active users with stale/missing profiles.
 */
async function processCoachProfileGeneration(): Promise<void> {
  if (isRunning) {
    return;
  }

  isRunning = true;

  try {
    // Skip entire run if circuit breaker is open (quota exhausted)
    if (!llmCircuitBreaker.isCallAllowed()) {
      const status = llmCircuitBreaker.getStatus();
      logger.info('[CoachProfileJob] Skipping run — LLM circuit breaker OPEN', {
        cooldownRemaining: `${Math.round(status.cooldownRemaining / 60000)}min`,
        consecutiveFailures: status.consecutiveFailures,
      });
      return;
    }

    // Find active users with stale or missing profiles
    const result = await query<{
      id: string;
    }>(
      `SELECT u.id
       FROM users u
       LEFT JOIN user_coaching_profiles p ON p.user_id = u.id
       WHERE u.is_active = true
         AND (
           p.id IS NULL
           OR p.generated_at < NOW() - INTERVAL '${PROFILE_STALE_HOURS} hours'
         )
       ORDER BY p.generated_at ASC NULLS FIRST
       LIMIT ${MAX_USERS_PER_RUN}`,
    );

    if (result.rows.length === 0) {
      logger.debug('[CoachProfileJob] No users need profile updates');
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
            // Archive current profile before overwriting
            await userCoachingProfileService.archiveProfile(user.id);

            // Generate new profile (includes recentObservations and version increment)
            await userCoachingProfileService.generateProfile(user.id);

            // Update stable traits if stale (>14 days) — runs only when needed
            await userCoachingProfileService.updateStableTraits(user.id).catch((err) => {
              logger.warn('[CoachProfileJob] Stable traits update failed (non-fatal)', {
                userId: user.id,
                error: err instanceof Error ? err.message : 'Unknown',
              });
            });

            processed++;

            logger.debug('[CoachProfileJob] Generated profile', {
              userId: user.id,
            });
          } catch (error) {
            errors++;
            logger.error('[CoachProfileJob] Failed to process user', {
              userId: user.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        })
      );

      // Inter-batch delay to spread DB load and prevent query storms
      if (i + BATCH_SIZE < result.rows.length) {
        await new Promise((resolve) => setTimeout(resolve, INTER_BATCH_DELAY_MS));
      }
    }

    if (processed > 0 || errors > 0) {
      logger.info('[CoachProfileJob] Processing complete', {
        processed,
        errors,
        totalEligible: result.rows.length,
      });
    }
  } catch (error) {
    logger.error('[CoachProfileJob] Fatal error', {
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
 * Start the coach profile generation job
 */
export function startCoachProfileGeneration(): void {
  if (intervalId) {
    logger.warn('[CoachProfileJob] Already running');
    return;
  }

  logger.info('[CoachProfileJob] Starting coach profile generation job', {
    intervalMs: JOB_INTERVAL_MS,
    staleHours: PROFILE_STALE_HOURS,
  });

  // Run immediately on start
  processCoachProfileGeneration();

  // Then run on interval
  intervalId = setInterval(processCoachProfileGeneration, JOB_INTERVAL_MS);
}

/**
 * Stop the coach profile generation job
 */
export function stopCoachProfileGeneration(): void {
  if (!intervalId) {
    logger.warn('[CoachProfileJob] Not running');
    return;
  }

  clearInterval(intervalId);
  intervalId = null;

  logger.info('[CoachProfileJob] Stopped coach profile generation job');
}

/**
 * Check if the job is running
 */
export function isCoachProfileGenerationRunning(): boolean {
  return intervalId !== null;
}

// ============================================
// EXPORTS
// ============================================

export const coachProfileGenerationJob = {
  start: startCoachProfileGeneration,
  stop: stopCoachProfileGeneration,
  isRunning: isCoachProfileGenerationRunning,
  processNow: processCoachProfileGeneration,
};

export default coachProfileGenerationJob;
