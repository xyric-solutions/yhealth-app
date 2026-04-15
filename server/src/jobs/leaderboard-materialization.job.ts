/**
 * @file Leaderboard Materialization Job
 * @description Precomputes leaderboard snapshots and updates Redis cache
 * Runs after daily scoring completes
 */

import { logger } from '../services/logger.service.js';
import { leaderboardService } from '../services/leaderboard.service.js';
import { competitionService } from '../services/competition.service.js';
import { aiScoringService } from '../services/ai-scoring.service.js';
import { socketService } from '../services/socket.service.js';
import { query } from '../database/pg.js';

// ============================================
// CONFIGURATION
// ============================================

const JOB_INTERVAL_MS = 5 * 60 * 1000; // Run every 5 minutes
let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

// ============================================
// JOB PROCESSOR
// ============================================

/**
 * Materialize leaderboards for today and yesterday
 */
async function materializeLeaderboards(): Promise<void> {
  if (isRunning) {
    return;
  }

  isRunning = true;

  try {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dates = [
      today.toISOString().split('T')[0],
      yesterday.toISOString().split('T')[0],
    ];

    for (const date of dates) {
      try {
        // Lazy-compute scores if none exist for this date
        const hasScores = await aiScoringService.hasScoresForDate(date);
        if (!hasScores) {
          const computed = await aiScoringService.computeScoresForAllUsers(new Date(date));
          logger.info('[LeaderboardMaterialization] Lazy-computed scores', { date, computed });
        }

        // Materialize global leaderboard
        await leaderboardService.materializeLeaderboard('global', date, 100);

        // Update rank columns in daily_user_scores
        await leaderboardService.updateRanks(date);

        logger.debug('[LeaderboardMaterialization] Materialized global leaderboard', { date });

        // Materialize country leaderboards (simplified - would need country data)
        // await leaderboardService.materializeLeaderboard('country', date, 100, 'US');

        // Materialize friends leaderboards (simplified - would need friends data)
        // await leaderboardService.materializeLeaderboard('friends', date, 100);
      } catch (error) {
        logger.error('[LeaderboardMaterialization] Failed to materialize leaderboard', {
          date,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Materialize competition leaderboards
    try {
      const activeCompetitions = await competitionService.getActiveCompetitions();
      const todayDate = dates[0];

      for (const competition of activeCompetitions) {
        try {
          // Update scores and ranks for this competition
          await competitionService.updateCompetitionScores(competition.id);

          // Materialize competition leaderboard snapshot
          await leaderboardService.materializeLeaderboard('competition', todayDate, 100, competition.id);

          // Emit rank update events to all active participants
          const participantResult = await query<{ user_id: string; current_rank: number; current_score: number }>(
            `SELECT user_id, current_rank, current_score FROM competition_entries
             WHERE competition_id = $1 AND status = 'active' AND current_rank IS NOT NULL`,
            [competition.id]
          );

          for (const participant of participantResult.rows) {
            socketService.emitToUser(participant.user_id, 'competition:rank-update', {
              competition_id: competition.id,
              competition_name: competition.name,
              user_id: participant.user_id,
              rank: participant.current_rank,
              current_score: participant.current_score,
            });
          }

          logger.debug('[LeaderboardMaterialization] Materialized competition leaderboard', {
            competitionId: competition.id,
            participantCount: participantResult.rows.length,
          });
        } catch (error) {
          logger.error('[LeaderboardMaterialization] Failed to materialize competition', {
            competitionId: competition.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      if (activeCompetitions.length > 0) {
        logger.info('[LeaderboardMaterialization] Completed competition materialization', {
          competitionCount: activeCompetitions.length,
        });
      }
    } catch (error) {
      logger.error('[LeaderboardMaterialization] Failed to materialize competitions', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    logger.info('[LeaderboardMaterialization] Completed materialization', { dates });
  } catch (error) {
    logger.error('[LeaderboardMaterialization] Fatal error', {
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
 * Start the leaderboard materialization job
 */
export function startLeaderboardMaterialization(): void {
  if (intervalId) {
    logger.warn('[LeaderboardMaterialization] Already running');
    return;
  }

  logger.info('[LeaderboardMaterialization] Starting leaderboard materialization job', {
    intervalMs: JOB_INTERVAL_MS,
  });

  // Run immediately on start
  materializeLeaderboards();

  // Then run on interval
  intervalId = setInterval(materializeLeaderboards, JOB_INTERVAL_MS);
}

/**
 * Stop the leaderboard materialization job
 */
export function stopLeaderboardMaterialization(): void {
  if (!intervalId) {
    logger.warn('[LeaderboardMaterialization] Not running');
    return;
  }

  clearInterval(intervalId);
  intervalId = null;

  logger.info('[LeaderboardMaterialization] Stopped leaderboard materialization job');
}

/**
 * Check if the job is running
 */
export function isLeaderboardMaterializationRunning(): boolean {
  return intervalId !== null;
}

// ============================================
// EXPORTS
// ============================================

export const leaderboardMaterializationJob = {
  start: startLeaderboardMaterialization,
  stop: stopLeaderboardMaterialization,
  isRunning: isLeaderboardMaterializationRunning,
  processNow: materializeLeaderboards,
};

export default leaderboardMaterializationJob;

