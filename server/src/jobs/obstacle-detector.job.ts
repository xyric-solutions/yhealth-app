/**
 * @file Obstacle Detector Job
 *
 * Runs once a day. Scans for users whose goals show a repeated-miss pattern
 * (≥3 of last 7 days) and, for each candidate, creates a goal_obstacles row
 * and sends an empathetic opener as a proactive coach message. The user can
 * then tap into the obstacle from their dashboard or reply in chat to start
 * the diagnostic conversation (which runs through /api/obstacles/:id/diagnose).
 *
 * A 14-day per-goal cooldown is enforced inside ObstacleService.detectCandidates.
 */

import { logger } from '../services/logger.service.js';
import { obstacleService } from '../services/obstacle.service.js';
import { proactiveMessagingService } from '../services/proactive-messaging.service.js';

const JOB_INTERVAL_MS = process.env.OBSTACLE_DETECTOR_JOB_INTERVAL_MS
  ? parseInt(process.env.OBSTACLE_DETECTOR_JOB_INTERVAL_MS, 10)
  : 24 * 60 * 60 * 1000; // daily
const STARTUP_DELAY_MS = process.env.OBSTACLE_DETECTOR_STARTUP_DELAY_MS
  ? parseInt(process.env.OBSTACLE_DETECTOR_STARTUP_DELAY_MS, 10)
  : 15 * 60 * 1000; // 15 min after boot

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;
let startupTimeoutId: NodeJS.Timeout | null = null;

function buildIntroMessage(goalTitle: string, missCount: number): string {
  return (
    `Hey — I noticed you've missed "${goalTitle}" ${missCount} times in the last week. ` +
    `I don't want to just nag you. Can we figure out what's really blocking you? ` +
    `Is it the time, the location, your energy, or something else? ` +
    `Reply here and I'll ask a few quick questions.`
  );
}

async function processOnce(): Promise<void> {
  if (isRunning) return;
  isRunning = true;
  const t0 = Date.now();

  try {
    const candidates = await obstacleService.detectCandidates();
    logger.info('[ObstacleDetectorJob] Detected candidates', { count: candidates.length });

    let created = 0;
    let messaged = 0;
    let errors = 0;

    for (const c of candidates) {
      try {
        const obstacle = await obstacleService.createObstacle(c);
        created++;

        try {
          await proactiveMessagingService.sendProactiveMessage(
            c.userId,
            buildIntroMessage(c.goalTitle, c.missCount),
            'obstacle_diagnosis',
          );
          messaged++;
        } catch (msgErr) {
          logger.warn('[ObstacleDetectorJob] Failed to send intro message', {
            userId: c.userId.slice(0, 8),
            obstacleId: obstacle.id,
            error: msgErr instanceof Error ? msgErr.message : String(msgErr),
          });
        }
      } catch (err) {
        errors++;
        logger.error('[ObstacleDetectorJob] Error processing candidate', {
          userId: c.userId.slice(0, 8),
          goalRefType: c.goalRefType,
          goalRefId: c.goalRefId.slice(0, 8),
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info('[ObstacleDetectorJob] Completed', {
      candidates: candidates.length,
      obstaclesCreated: created,
      introMessagesSent: messaged,
      errors,
      durationMs: Date.now() - t0,
    });
  } catch (err) {
    logger.error('[ObstacleDetectorJob] Fatal error', {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    isRunning = false;
  }
}

export function startObstacleDetectorJob(): void {
  if (intervalId) {
    logger.warn('[ObstacleDetectorJob] Already running');
    return;
  }
  logger.info('[ObstacleDetectorJob] Starting', {
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

export function stopObstacleDetectorJob(): void {
  if (startupTimeoutId) {
    clearTimeout(startupTimeoutId);
    startupTimeoutId = null;
  }
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export const obstacleDetectorJob = {
  start: startObstacleDetectorJob,
  stop: stopObstacleDetectorJob,
  runOnce: processOnce,
};
