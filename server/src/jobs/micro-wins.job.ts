/**
 * @file Micro-Wins Detection Job
 * @description Runs every 6 hours. For each recently active user:
 * 1. Detects micro-wins (behavioral improvements)
 * 2. Generates dynamic achievements from detected wins
 * 3. Awards XP for new micro-wins
 * 4. Emits Socket.IO notifications
 */

import { query } from '../database/pg.js';
import { logger } from '../services/logger.service.js';
import { microWinsService } from '../services/micro-wins.service.js';
import { dynamicAchievementsService } from '../services/dynamic-achievements.service.js';
import { gamificationService } from '../services/gamification.service.js';
import { socketService } from '../services/socket.service.js';

const JOB_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const STARTUP_DELAY_MS = 660_000; // 11 minutes — after other heavy jobs

let intervalId: ReturnType<typeof setInterval> | null = null;
let running = false;

async function runMicroWinsJob(): Promise<void> {
  if (running) {
    logger.info('[MicroWinsJob] Previous run still in progress, skipping');
    return;
  }

  running = true;
  const startTime = Date.now();

  try {
    logger.info('[MicroWinsJob] Starting micro-wins detection run');

    // Get recently active users (logged in within last 7 days)
    const usersResult = await query<{ id: string }>(
      `SELECT id FROM users
       WHERE last_login_at >= NOW() - INTERVAL '7 days'
         AND is_active = TRUE
       ORDER BY last_login_at DESC
       LIMIT 500`
    );

    const users = usersResult.rows;
    let totalWins = 0;
    let totalAchievements = 0;

    for (const user of users) {
      try {
        // 1. Detect micro-wins
        const wins = await microWinsService.detectMicroWins(user.id);
        totalWins += wins.length;

        if (wins.length === 0) continue;

        // 2. Generate dynamic achievements from wins
        const achievements = await dynamicAchievementsService.generateFromMicroWins(user.id, wins);
        totalAchievements += achievements.length;

        // 3. Award XP for each micro-win
        for (const win of wins) {
          await gamificationService.awardXP(
            user.id,
            'bonus',
            win.xpReward,
            win.id,
            `Micro-win: ${win.title}`
          ).catch((err: unknown) => {
            logger.warn('[MicroWinsJob] XP award failed', { userId: user.id, winId: win.id, error: err instanceof Error ? err.message : 'Unknown' });
          });
        }

        // 4. Emit Socket.IO notifications
        for (const win of wins) {
          socketService.emitToUser(user.id, 'micro-win:detected', {
            microWin: win,
            timestamp: new Date().toISOString(),
          });
        }

        for (const ach of achievements) {
          socketService.emitToUser(user.id, 'achievement:unlocked', {
            achievement: {
              id: ach.id,
              title: ach.title,
              description: ach.description,
              icon: ach.icon,
              rarity: ach.rarity,
              xpReward: ach.xpReward,
              type: ach.type,
              emotionalContext: ach.emotionalContext,
            },
            timestamp: new Date().toISOString(),
          });
        }

        // Also check goal progress while we're at it
        const goalUnlocks = await dynamicAchievementsService.checkGoalProgress(user.id);
        for (const unlock of goalUnlocks) {
          await gamificationService.awardXP(
            user.id,
            'achievement',
            unlock.xpReward,
            unlock.id,
            `Achievement: ${unlock.title}`
          ).catch(() => {});

          socketService.emitToUser(user.id, 'achievement:unlocked', {
            achievement: {
              id: unlock.id,
              title: unlock.title,
              description: unlock.emotionalContext || unlock.description,
              icon: unlock.icon,
              rarity: unlock.rarity,
              xpReward: unlock.xpReward,
              type: unlock.type,
              emotionalContext: unlock.emotionalContext,
            },
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        logger.error('[MicroWinsJob] Error processing user', {
          userId: user.id,
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }

    const elapsedMs = Date.now() - startTime;
    logger.info('[MicroWinsJob] Run complete', {
      usersProcessed: users.length,
      totalWins,
      totalAchievements,
      elapsedMs,
    });
  } catch (error) {
    logger.error('[MicroWinsJob] Fatal error in run', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
  } finally {
    running = false;
  }
}

export function startMicroWinsJob(): void {
  logger.info('[MicroWinsJob] Scheduling micro-wins detection job', {
    intervalMs: JOB_INTERVAL_MS,
    startupDelayMs: STARTUP_DELAY_MS,
  });

  setTimeout(() => {
    runMicroWinsJob();
    intervalId = setInterval(runMicroWinsJob, JOB_INTERVAL_MS);
  }, STARTUP_DELAY_MS);
}

export function stopMicroWinsJob(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('[MicroWinsJob] Job stopped');
  }
}
