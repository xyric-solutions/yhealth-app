/**
 * @file Proactive Messaging Job
 * Background job that sends proactive messages based on user data.
 *
 * Uses score-and-rank approach: all 18 message types are scored per user,
 * sorted by impact, and only the top 2-3 are sent per cycle.
 * This ensures high-priority messages (streak_risk, goal_deadline)
 * always take precedence over low-value ones (water_intake, whoop_sync).
 */

import { query } from '../database/pg.js';
import { logger } from '../services/logger.service.js';
import { proactiveMessagingService } from '../services/proactive-messaging.service.js';
import { comprehensiveUserContextService } from '../services/comprehensive-user-context.service.js';
import { llmCircuitBreaker } from '../services/llm-circuit-breaker.service.js';

// ============================================
// CONFIGURATION
// ============================================

const JOB_INTERVAL_MS = process.env.PROACTIVE_JOB_INTERVAL_MS
  ? parseInt(process.env.PROACTIVE_JOB_INTERVAL_MS, 10)
  : 3 * 60 * 60 * 1000; // Default: 3 hours (8x per day) — staggered from daily analysis (2h)
const STARTUP_DELAY_MS = process.env.PROACTIVE_STARTUP_DELAY_MS
  ? parseInt(process.env.PROACTIVE_STARTUP_DELAY_MS, 10)
  : 30 * 1000; // Default: 30-second delay before first run
const BATCH_SIZE = 3; // Users processed in parallel per batch
const INTER_BATCH_DELAY_MS = 2000; // 2 seconds between batches
let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;
let startupTimeoutId: NodeJS.Timeout | null = null;

// ============================================
// HELPERS
// ============================================

/**
 * Check if user's local hour falls within ANY message time window.
 * Returns false if no messages can possibly be sent at this hour,
 * allowing us to skip expensive context fetching entirely.
 */
function hasApplicableTimeWindow(hour: number, _isSunday: boolean): boolean {
  // Message windows span 6-22 in user's local time, plus "any time" messages
  return hour >= 6 && hour < 22;
}

/**
 * Get UTC offset in minutes for an IANA timezone string.
 * Used to convert UTC time to user's local time.
 */
function getUtcOffsetMinutes(timezone: string): number {
  const now = new Date();
  const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
  const localDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  return (localDate.getTime() - utcDate.getTime()) / (1000 * 60);
}

/**
 * Convert current UTC time to user's local time using their IANA timezone.
 * Returns a Date adjusted so getHours()/getDay() return user-local values.
 * Falls back to UTC if timezone is invalid.
 */
function getUserLocalTime(timezone: string): Date {
  try {
    const now = new Date();
    const utcOffset = getUtcOffsetMinutes(timezone);
    const result = new Date(now.getTime() + utcOffset * 60 * 1000);
    return result;
  } catch {
    return new Date(); // Fallback to server time (UTC)
  }
}

// ============================================
// JOB PROCESSOR
// ============================================

/**
 * Process proactive messages for all active users
 */
async function processProactiveMessages(): Promise<void> {
  if (isRunning) {
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    // Log circuit breaker status at the start of every run
    const cbStatus = llmCircuitBreaker.getStatus();
    logger.info('[ProactiveMessagingJob] Starting proactive message check', {
      circuitBreaker: cbStatus.state,
      consecutiveFailures: cbStatus.consecutiveFailures,
      cooldownRemainingMs: cbStatus.cooldownRemaining,
    });

    // Auto-reset: if circuit breaker has been OPEN for > 2 hours, force reset
    // This prevents a single 429 from killing proactive messaging for days
    if (cbStatus.state === 'OPEN' && cbStatus.cooldownRemaining <= 0) {
      logger.warn('[ProactiveMessagingJob] Circuit breaker stuck OPEN past cooldown — forcing probe');
    }

    // Get all active users with their timezone for per-user local time checks
    const usersResult = await query<{ id: string; timezone: string }>(
      `SELECT id, COALESCE(timezone, 'UTC') as timezone FROM users WHERE is_active = true`
    );

    const users = usersResult.rows;

    logger.info('[ProactiveMessagingJob] Processing proactive messages', {
      userCount: users.length,
    });

    const counters: Record<string, number> = {
      sleep: 0, whoop_sync: 0, workout: 0, nutrition: 0, wellbeing: 0,
      morning_briefing: 0, streak_risk: 0, streak_celebration: 0, recovery_advice: 0,
      goal_deadline: 0, goal_stalled: 0, water_intake: 0, habit_missed: 0,
      achievement_unlock: 0, weekly_digest: 0, competition_update: 0,
      app_inactive: 0, coach_pro_analysis: 0,
      meal_alignment: 0, daily_progress_review: 0,
      score_declining: 0, plan_non_adherence: 0,
      overtraining_risk: 0, commitment_followup: 0,
      recovery_trend_alert: 0, positive_momentum: 0,
      life_goal_checkin: 0, life_goal_stalled: 0, life_goal_milestone: 0, life_goal_encouragement: 0,
      intention_reminder: 0, intention_reflection: 0,
    };
    let errors = 0;
    let skippedCapped = 0;
    let skippedTimeWindow = 0;

    // Process users in small batches to avoid overwhelming the database
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (user) => {
          try {
            // Compute user's local time from their timezone
            const userLocalTime = getUserLocalTime(user.timezone);
            const userHour = userLocalTime.getUTCHours();
            const userIsSunday = userLocalTime.getUTCDay() === 0;

            // Per-user time window gate (replaces the old global UTC gate)
            if (!hasApplicableTimeWindow(userHour, userIsSunday)) {
              skippedTimeWindow++;
              return;
            }

            // Pre-fetch cooldown state ONCE per user
            const cooldown = await proactiveMessagingService.getMessageCooldownState(user.id);

            // Skip if daily cap reached (4 messages/day)
            if (cooldown.dailyCount >= 4) {
              skippedCapped++;
              return;
            }

            // Fetch comprehensive context ONCE per user
            const context = await comprehensiveUserContextService.getComprehensiveContext(user.id);

            // Score all message types and pick the highest-impact ones
            const candidates = await proactiveMessagingService.scoreMessageCandidates(user.id, context, cooldown, userHour, userIsSunday);
            const maxToSend = Math.min(3, 4 - cooldown.dailyCount);
            const topCandidates = candidates
              .filter(c => c.eligible && c.timeWindowValid)
              .slice(0, maxToSend);

            if (topCandidates.length > 0) {
              logger.debug('[ProactiveMessagingJob] Sending top candidates', {
                userId: user.id.slice(0, 8),
                userHour,
                timezone: user.timezone,
                sending: topCandidates.map(c => `${c.type}(${c.score})`),
              });
            } else {
              // Diagnostic: log WHY no candidates were eligible
              const allScored = candidates.length;
              const eligible = candidates.filter(c => c.eligible).length;
              const timeValid = candidates.filter(c => c.eligible && c.timeWindowValid).length;
              logger.info('[ProactiveMessagingJob] No eligible candidates for user', {
                userId: user.id.slice(0, 8),
                userHour,
                timezone: user.timezone,
                totalScored: allScored,
                eligible,
                eligibleAndTimeValid: timeValid,
                maxToSend,
                topIneligible: candidates
                  .filter(c => !c.eligible || !c.timeWindowValid)
                  .slice(0, 5)
                  .map(c => `${c.type}(elig=${c.eligible},tw=${c.timeWindowValid},s=${c.score})`),
              });
            }

            // Dispatch to existing checkAndSend* methods (they handle enrichment + generation + sending)
            for (const candidate of topCandidates) {
              let sent = false;
              switch (candidate.type) {
                case 'sleep': sent = await proactiveMessagingService.checkAndSendSleepMessage(user.id, context, cooldown); break;
                case 'whoop_sync': sent = await proactiveMessagingService.checkAndSendWhoopSyncMessage(user.id, context, cooldown); break;
                case 'workout': sent = await proactiveMessagingService.checkAndSendWorkoutReminder(user.id, context, cooldown); break;
                case 'nutrition': sent = await proactiveMessagingService.checkAndSendNutritionReminder(user.id, context, cooldown); break;
                case 'wellbeing': sent = await proactiveMessagingService.checkAndSendWellbeingReminder(user.id, context, cooldown); break;
                case 'goal_deadline': sent = await proactiveMessagingService.checkAndSendGoalDeadlineMessage(user.id, context, cooldown); break;
                case 'goal_stalled': sent = await proactiveMessagingService.checkAndSendGoalStalledMessage(user.id, context, cooldown); break;
                case 'streak_risk': sent = await proactiveMessagingService.checkAndSendStreakRiskMessage(user.id, context, cooldown); break;
                case 'streak_celebration': sent = await proactiveMessagingService.checkAndSendStreakCelebrationMessage(user.id, context, cooldown); break;
                case 'habit_missed': sent = await proactiveMessagingService.checkAndSendHabitMissedMessage(user.id, context, cooldown); break;
                case 'water_intake': sent = await proactiveMessagingService.checkAndSendWaterIntakeMessage(user.id, context, cooldown); break;
                case 'morning_briefing': sent = await proactiveMessagingService.checkAndSendMorningBriefingMessage(user.id, context, cooldown); break;
                case 'weekly_digest': sent = await proactiveMessagingService.checkAndSendWeeklyDigestMessage(user.id, context, cooldown); break;
                case 'achievement_unlock': sent = await proactiveMessagingService.checkAndSendAchievementMessage(user.id, context, cooldown); break;
                case 'recovery_advice': sent = await proactiveMessagingService.checkAndSendRecoveryAdviceMessage(user.id, context, cooldown); break;
                case 'competition_update': sent = await proactiveMessagingService.checkAndSendCompetitionUpdateMessage(user.id, context, cooldown); break;
                case 'app_inactive': sent = await proactiveMessagingService.checkAndSendAppInactiveMessage(user.id, context, cooldown); break;
                case 'coach_pro_analysis': sent = await proactiveMessagingService.checkAndSendCoachProMessage(user.id, context, cooldown); break;
                case 'meal_alignment': sent = await proactiveMessagingService.checkAndSendMealAlignmentFeedback(user.id, undefined, context, cooldown); break;
                case 'daily_progress_review': sent = await proactiveMessagingService.checkAndSendDailyProgressReview(user.id, context, cooldown); break;
                case 'score_declining': sent = await proactiveMessagingService.checkAndSendScoreDecliningMessage(user.id, context, cooldown); break;
                case 'plan_non_adherence': sent = await proactiveMessagingService.checkAndSendPlanNonAdherenceMessage(user.id, context, cooldown); break;
                case 'overtraining_risk': sent = await proactiveMessagingService.checkAndSendOvertrainingRiskMessage(user.id, context, cooldown); break;
                case 'commitment_followup': sent = await proactiveMessagingService.checkAndSendCommitmentFollowup(user.id, context, cooldown); break;
                case 'recovery_trend_alert': sent = await proactiveMessagingService.checkAndSendRecoveryTrendAlert(user.id, context, cooldown); break;
                case 'positive_momentum': sent = await proactiveMessagingService.checkAndSendPositiveMomentum(user.id, context, cooldown); break;
                // Life goal & intention handlers
                case 'life_goal_checkin': sent = await proactiveMessagingService.checkAndSendLifeGoalCheckin(user.id, context, cooldown); break;
                case 'life_goal_stalled': sent = await proactiveMessagingService.checkAndSendLifeGoalStalled(user.id, context, cooldown); break;
                case 'life_goal_milestone': sent = await proactiveMessagingService.checkAndSendLifeGoalMilestone(user.id, context, cooldown); break;
                case 'life_goal_encouragement': sent = await proactiveMessagingService.checkAndSendLifeGoalEncouragement(user.id, context, cooldown); break;
                case 'intention_reminder': sent = await proactiveMessagingService.checkAndSendIntentionReminder(user.id, context, cooldown); break;
                case 'intention_reflection': sent = await proactiveMessagingService.checkAndSendIntentionReflection(user.id, context, cooldown); break;
                // Data-gap collection messages
                case 'data_gap_dinner': sent = await proactiveMessagingService.checkAndSendDataGapMessage(user.id, 'data_gap_dinner', context, cooldown); break;
                case 'data_gap_mood': sent = await proactiveMessagingService.checkAndSendDataGapMessage(user.id, 'data_gap_mood', context, cooldown); break;
                case 'data_gap_workout_feedback': sent = await proactiveMessagingService.checkAndSendDataGapMessage(user.id, 'data_gap_workout_feedback', context, cooldown); break;
              }
              if (sent) {
                counters[candidate.type]++;
              } else {
                logger.debug('[ProactiveMessagingJob] Candidate handler returned false', {
                  userId: user.id.slice(0, 8),
                  type: candidate.type,
                  score: candidate.score,
                });
              }
            }

          } catch (error) {
            errors++;
            logger.error('[ProactiveMessagingJob] Error processing user', {
              userId: user.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        })
      );

      // Delay between batches to avoid overwhelming the database
      if (i + BATCH_SIZE < users.length) {
        await new Promise((resolve) => setTimeout(resolve, INTER_BATCH_DELAY_MS));
      }
    }

    const totalSent = Object.values(counters).reduce((sum, c) => sum + c, 0);
    const duration = Date.now() - startTime;
    const cbStatusEnd = llmCircuitBreaker.getStatus();
    logger.info('[ProactiveMessagingJob] Completed proactive message check', {
      userCount: users.length,
      skippedCapped,
      skippedTimeWindow,
      totalMessagesSent: totalSent,
      ...counters,
      errors,
      durationMs: duration,
      circuitBreakerEnd: cbStatusEnd.state,
      circuitBreakerFailures: cbStatusEnd.consecutiveFailures,
    });

    // Alert if no messages were sent to any user (pipeline may be broken)
    if (totalSent === 0 && users.length > 0 && skippedTimeWindow < users.length) {
      logger.warn('[ProactiveMessagingJob] ALERT: Zero messages sent this cycle despite eligible users', {
        userCount: users.length,
        skippedCapped,
        skippedTimeWindow,
        errors,
        circuitBreaker: cbStatusEnd.state,
      });
    }
  } catch (error) {
    logger.error('[ProactiveMessagingJob] Error processing proactive messages', {
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

/**
 * Start the proactive messaging job
 */
export function startProactiveMessagingJob(): void {
  if (intervalId !== null) {
    logger.warn('[ProactiveMessagingJob] Job is already running');
    return;
  }

  logger.info('[ProactiveMessagingJob] Starting proactive messaging job', {
    intervalMs: JOB_INTERVAL_MS,
    startupDelayMs: STARTUP_DELAY_MS,
    batchSize: BATCH_SIZE,
  });

  // Delay first run to let the server fully warm up and avoid query storm on startup
  startupTimeoutId = setTimeout(() => {
    startupTimeoutId = null;
    processProactiveMessages().catch((error) => {
      logger.error('[ProactiveMessagingJob] Error in initial run', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });

    // Then run on interval
    intervalId = setInterval(() => {
      processProactiveMessages().catch((error) => {
        logger.error('[ProactiveMessagingJob] Error in scheduled run', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });
    }, JOB_INTERVAL_MS);
  }, STARTUP_DELAY_MS);
}

/**
 * Stop the proactive messaging job
 */
export function stopProactiveMessagingJob(): void {
  logger.info('[ProactiveMessagingJob] Stopping proactive messaging job');

  if (startupTimeoutId) {
    clearTimeout(startupTimeoutId);
    startupTimeoutId = null;
  }

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  // Wait for current run to finish (with timeout)
  const timeout = 30000; // 30 seconds
  const startTime = Date.now();
  while (isRunning && Date.now() - startTime < timeout) {
    // Wait
  }

  if (isRunning) {
    logger.warn('[ProactiveMessagingJob] Job did not finish within timeout');
  }
}

// ============================================
// EXPORTS
// ============================================

export const proactiveMessagingJob = {
  start: startProactiveMessagingJob,
  stop: stopProactiveMessagingJob,
};

