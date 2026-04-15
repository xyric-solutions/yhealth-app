/**
 * @file Goal Reconnection Job (DKA Prevention)
 *
 * Runs once a day. Finds active life_goals silent for 21/42/70+ days and
 * inserts a `goal_reconnections` row (UNIQUE per goal+tier) + sends a
 * tier-specific proactive AI Coach message. The ObstacleCard-style
 * dashboard card then surfaces it.
 *
 * Suppression of `life_goal_stalled` for goals with an open reconnection
 * is handled inside `proactive-messaging.service.ts` (not here).
 */

import { logger } from '../services/logger.service.js';
import { goalReconnectionService } from '../services/goal-reconnection.service.js';
import { proactiveMessagingService } from '../services/proactive-messaging.service.js';
import type { ReconnectionTier } from '../../../shared/types/domain/reconnection.js';

const JOB_INTERVAL_MS = process.env.GOAL_RECONNECTION_JOB_INTERVAL_MS
  ? parseInt(process.env.GOAL_RECONNECTION_JOB_INTERVAL_MS, 10)
  : 24 * 60 * 60 * 1000; // daily
const STARTUP_DELAY_MS = process.env.GOAL_RECONNECTION_STARTUP_DELAY_MS
  ? parseInt(process.env.GOAL_RECONNECTION_STARTUP_DELAY_MS, 10)
  : 19 * 60 * 1000; // ~19 min after boot, staggered after obstacle-detector (18 min)

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;
let startupTimeoutId: NodeJS.Timeout | null = null;

function buildTierMessage(goalTitle: string, tier: ReconnectionTier): string {
  switch (tier) {
    case 1:
      return (
        `Hey — you set "${goalTitle}" about 3 weeks ago and I haven't seen you touch it. ` +
        `How's that going? Still something you want to work on, or has life moved?`
      );
    case 2:
      return (
        `It's been roughly 6 weeks since you last engaged with "${goalTitle}". ` +
        `No judgement — is this still important to you, or is it time to let it rest?`
      );
    case 3:
      return (
        `"${goalTitle}" has been quiet for about 10 weeks. ` +
        `Want to recommit, pause it, or archive it? There's no wrong answer — ` +
        `keeping a dead goal on the list just clutters your focus.`
      );
  }
}

async function processOnce(): Promise<void> {
  if (isRunning) return;
  isRunning = true;
  const t0 = Date.now();

  try {
    const candidates = await goalReconnectionService.detectCandidates();
    logger.info('[GoalReconnectionJob] Detected candidates', { count: candidates.length });

    let created = 0;
    let messaged = 0;
    let errors = 0;

    for (const c of candidates) {
      try {
        const reconnection = await goalReconnectionService.createReconnection(c);
        if (!reconnection) {
          // Tier already existed (race or prior partial run) — skip messaging.
          continue;
        }
        created++;

        try {
          await proactiveMessagingService.sendProactiveMessage(
            c.userId,
            buildTierMessage(c.goalTitle, c.tier),
            'goal_reconnection',
          );
          messaged++;
        } catch (msgErr) {
          logger.warn('[GoalReconnectionJob] Failed to send proactive message', {
            userId: c.userId.slice(0, 8),
            reconnectionId: reconnection.id,
            tier: c.tier,
            error: msgErr instanceof Error ? msgErr.message : String(msgErr),
          });
        }
      } catch (err) {
        errors++;
        logger.error('[GoalReconnectionJob] Error processing candidate', {
          userId: c.userId.slice(0, 8),
          lifeGoalId: c.lifeGoalId.slice(0, 8),
          tier: c.tier,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info('[GoalReconnectionJob] Completed', {
      candidates: candidates.length,
      reconnectionsCreated: created,
      messagesSent: messaged,
      errors,
      durationMs: Date.now() - t0,
    });
  } catch (err) {
    logger.error('[GoalReconnectionJob] Fatal error', {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    isRunning = false;
  }
}

export function startGoalReconnectionJob(): void {
  if (intervalId) {
    logger.warn('[GoalReconnectionJob] Already running');
    return;
  }
  logger.info('[GoalReconnectionJob] Starting', {
    intervalMs: JOB_INTERVAL_MS,
    startupDelayMs: STARTUP_DELAY_MS,
  });
  startupTimeoutId = setTimeout(() => {
    startupTimeoutId = null;
    processOnce().catch(() => {});
    intervalId = setInterval(() => {
      processOnce().catch(() => {});
    }, JOB_INTERVAL_MS);
  }, STARTUP_DELAY_MS);
}

export function stopGoalReconnectionJob(): void {
  if (startupTimeoutId) {
    clearTimeout(startupTimeoutId);
    startupTimeoutId = null;
  }
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export const goalReconnectionJob = {
  start: startGoalReconnectionJob,
  stop: stopGoalReconnectionJob,
  runOnce: processOnce,
};
