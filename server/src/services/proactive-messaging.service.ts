/**
 * @file Proactive Messaging Service
 * @description Generates and sends proactive messages based on user data
 */

import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { query, transaction } from '../database/pg.js';
import { logger } from './logger.service.js';
import { modelFactory } from './model-factory.service.js';
import { messageService } from './message.service.js';
import { socketService } from './socket.service.js';
import { gamificationService } from './gamification.service.js';
import { userCoachingProfileService } from './user-coaching-profile.service.js';
import { dailyAnalysisService } from './daily-analysis.service.js';
import type { DailyAnalysisReport, StructuredInsight, CrossDomainInsight, CoachingDirective } from './daily-analysis.service.js';
import type { StableTraits, CoachEmotionalState, RelationshipDepth } from './user-coaching-profile.service.js';
import { llmCircuitBreaker } from './llm-circuit-breaker.service.js';
import { tenorService } from './tenor.service.js';


// ============================================
// CONSTANTS
// ============================================

const AI_COACH_USER_ID = process.env.AI_COACH_USER_ID || '00000000-0000-0000-0000-000000000001';

// ============================================
// TYPES
// ============================================

export type ProactiveMessageType =
  | 'sleep' | 'whoop_sync' | 'workout' | 'nutrition' | 'wellbeing'
  | 'goal_deadline' | 'goal_stalled' | 'streak_risk' | 'streak_celebration'
  | 'habit_missed' | 'water_intake' | 'morning_briefing' | 'weekly_digest'
  | 'achievement_unlock' | 'recovery_advice' | 'competition_update'
  | 'app_inactive' | 'coach_pro_analysis'
  | 'meal_alignment' | 'daily_progress_review'
  | 'score_declining'
  | 'plan_non_adherence'
  | 'overtraining_risk' | 'commitment_followup'
  | 'recovery_trend_alert' | 'positive_momentum'
  | 'data_gap_dinner' | 'data_gap_mood' | 'data_gap_workout_feedback'
  // Life goal proactive messages
  | 'life_goal_checkin' | 'life_goal_stalled' | 'life_goal_milestone'
  | 'life_goal_encouragement' | 'intention_reminder' | 'intention_reflection'
  // Activity status follow-ups
  | 'status_followup_sick' | 'status_followup_injury' | 'status_followup_travel'
  | 'status_followup_vacation' | 'status_followup_stress' | 'status_return' | 'status_stale'
  // Schedule-aware messages
  | 'free_window_suggestion' | 'busy_day_support';

export interface ProactiveContext {
  type: ProactiveMessageType;
  data: Record<string, any>;
  userContext: any; // ComprehensiveUserContext
  // Pre-computed analysis (Phase 2 upgrade)
  analysisReport?: DailyAnalysisReport | null;
  relevantInsights?: StructuredInsight[];
  crossDomainInsights?: CrossDomainInsight[];
  coachingDirective?: CoachingDirective | null;
  stableTraits?: StableTraits | null;
  // Coach emotional intelligence
  coachEmotion?: CoachEmotionalState;
  relationshipDepth?: RelationshipDepth;
}

export interface MessageCandidate {
  type: ProactiveMessageType;
  score: number;
  eligible: boolean;
  timeWindowValid: boolean;
}

// ============================================
// SERVICE CLASS
// ============================================

class ProactiveMessagingService {
  private _llm: BaseChatModel | null = null;

  // Per-user insight cache to avoid redundant DB calls within the same job cycle.
  // buildInsightDrivenContext() is called up to 8× per user per hour — this ensures
  // getLatestReport() + getProfile() only hit the DB once per user per 5 minutes.
  private insightCache = new Map<string, {
    report: DailyAnalysisReport | null;
    stableTraits: StableTraits | null;
    fetchedAt: number;
  }>();
  private static readonly INSIGHT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor() {
    // Lazy LLM init — avoid crashing the singleton if no providers are configured at startup
  }

  /** Lazily initialize the LLM model on first use, not at import time */
  private get llm(): BaseChatModel {
    if (!this._llm) {
      try {
        this._llm = modelFactory.getModel({
          tier: 'default',
          maxTokens: 1500,
        });
      } catch (error) {
        logger.error('[ProactiveMessaging] Failed to initialize LLM model', {
          error: error instanceof Error ? error.message : 'Unknown',
        });
        throw error;
      }
    }
    return this._llm;
  }

  // ============================================
  // COOLDOWN STATE (batch pre-fetch)
  // ============================================

  /**
   * Pre-fetch ALL cooldown state for a user in ONE query.
   * Returns daily count + set of message types already sent today.
   * Pass this to every checkAndSend*() method to eliminate ~32 duplicate queries per user.
   */
  async getMessageCooldownState(userId: string): Promise<{ dailyCount: number; sentTypes: Set<string> }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const result = await query<{ message_type: string; cnt: string }>(
        `SELECT message_type, COUNT(*)::text as cnt
         FROM proactive_messages
         WHERE user_id = $1 AND created_at >= $2
         GROUP BY message_type`,
        [userId, today]
      );
      const sentTypes = new Set<string>();
      let dailyCount = 0;
      for (const row of result.rows) {
        sentTypes.add(row.message_type);
        dailyCount += parseInt(row.cnt, 10);
      }
      return { dailyCount, sentTypes };
    } catch {
      return { dailyCount: 0, sentTypes: new Set() };
    }
  }

  // ============================================
  // CHECK & SEND METHODS
  // ============================================

  /**
   * Check if user should receive a sleep message
   */
  async checkAndSendSleepMessage(userId: string, cachedContext?: any, cooldown?: { dailyCount: number; sentTypes: Set<string> }): Promise<boolean> {
    try {
      const context = cachedContext;

      // Check if WHOOP shows poor sleep from previous night
      if (context.whoop.isConnected && context.whoop.lastSleep) {
        const sleep = context.whoop.lastSleep;
        const isPoorSleep = sleep.duration < 6 || sleep.quality < 60;

        // Only send if sleep was last night (within 24 hours) and was poor
        if (sleep.hoursAgo < 24 && isPoorSleep) {
          if (cooldown?.sentTypes.has('sleep')) return false;

          const proactiveContext: ProactiveContext = {
            type: 'sleep',
            data: {
              sleepHours: sleep.duration,
              sleepQuality: sleep.quality,
              hoursAgo: sleep.hoursAgo,
            },
            userContext: context,
          };

          // Enrich with pre-computed insights
          const insightCtx = await this.buildInsightDrivenContext(userId, 'sleep', context);
          proactiveContext.analysisReport = insightCtx.report;
          proactiveContext.relevantInsights = insightCtx.relevantInsights;
          proactiveContext.crossDomainInsights = insightCtx.crossDomainInsights;
          proactiveContext.coachingDirective = insightCtx.coachingDirective;
          proactiveContext.stableTraits = insightCtx.stableTraits;

          const message = await this.generateProactiveMessage(userId, proactiveContext);
          await this.sendProactiveMessage(userId, message, 'sleep', cooldown);

          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('[ProactiveMessaging] Error checking sleep message', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Check if user should receive a WHOOP sync message
   */
  async checkAndSendWhoopSyncMessage(userId: string, cachedContext?: any, cooldown?: { dailyCount: number; sentTypes: Set<string> }): Promise<boolean> {
    try {
      const context = cachedContext;

      // Check if WHOOP is connected but needs sync
      if (context.whoop.isConnected && context.whoop.needsSync) {
        // Only send if hasn't synced in more than 24 hours
        if (context.whoop.syncHoursAgo && context.whoop.syncHoursAgo > 24) {
          if (cooldown?.sentTypes.has('whoop_sync')) return false;

          const proactiveContext: ProactiveContext = {
            type: 'whoop_sync',
            data: {
              syncHoursAgo: context.whoop.syncHoursAgo,
            },
            userContext: context,
          };

          const message = await this.generateProactiveMessage(userId, proactiveContext);
          await this.sendProactiveMessage(userId, message, 'whoop_sync', cooldown);

          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('[ProactiveMessaging] Error checking WHOOP sync message', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Check if user should receive a workout reminder
   */
  async checkAndSendWorkoutReminder(userId: string, cachedContext?: any, cooldown?: { dailyCount: number; sentTypes: Set<string> }): Promise<boolean> {
    try {
      const context = cachedContext;

      // Check for today's scheduled-but-unfinished workout
      const todayPending = await query<{ id: string }>(
        `SELECT id FROM workout_schedule_tasks
         WHERE user_id = $1 AND scheduled_date = CURRENT_DATE AND status = 'pending'
         LIMIT 1`,
        [userId]
      ).catch(() => ({ rows: [] as { id: string }[] }));

      const hasTodayPending = todayPending.rows.length > 0;
      const hasMissed = context.workouts?.missedWorkouts && context.workouts.missedWorkouts > 0;

      if (hasMissed || hasTodayPending) {
        if (cooldown?.sentTypes.has('workout')) return false;

        const proactiveContext: ProactiveContext = {
          type: 'workout',
          data: {
            missedWorkouts: context.workouts?.missedWorkouts || 0,
            hasTodayPendingWorkout: hasTodayPending,
          },
          userContext: context,
        };

        // Enrich with pre-computed insights
        const insightCtx = await this.buildInsightDrivenContext(userId, 'workout', context);
        proactiveContext.analysisReport = insightCtx.report;
        proactiveContext.relevantInsights = insightCtx.relevantInsights;
        proactiveContext.crossDomainInsights = insightCtx.crossDomainInsights;
        proactiveContext.coachingDirective = insightCtx.coachingDirective;
        proactiveContext.stableTraits = insightCtx.stableTraits;

        const message = await this.generateProactiveMessage(userId, proactiveContext);
        await this.sendProactiveMessage(userId, message, 'workout', cooldown);

        return true;
      }

      return false;
    } catch (error) {
      logger.error('[ProactiveMessaging] Error checking workout reminder', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Check if user should receive a nutrition reminder
   */
  async checkAndSendNutritionReminder(userId: string, cachedContext?: any, cooldown?: { dailyCount: number; sentTypes: Set<string> }): Promise<boolean> {
    try {
      const context = cachedContext;

      // Check if user hasn't logged enough meals today
      // Time window gating is handled by scoreMessageCandidates — no duplicate hour check needed
      const expectedMeals = context.nutrition?.activeDietPlan?.mealsPerDay || 3;
      const todayCount = context.nutrition?.todayMealCount || 0;
      if (todayCount < expectedMeals) {
        if (cooldown?.sentTypes.has('nutrition')) return false;

        const proactiveContext: ProactiveContext = {
          type: 'nutrition',
          data: {
            todayMealCount: todayCount,
            expectedMeals,
            mealGap: expectedMeals - todayCount,
          },
          userContext: context,
        };

        // Enrich with pre-computed insights
        const insightCtx = await this.buildInsightDrivenContext(userId, 'nutrition', context);
        proactiveContext.analysisReport = insightCtx.report;
        proactiveContext.relevantInsights = insightCtx.relevantInsights;
        proactiveContext.crossDomainInsights = insightCtx.crossDomainInsights;
        proactiveContext.coachingDirective = insightCtx.coachingDirective;
        proactiveContext.stableTraits = insightCtx.stableTraits;

        const message = await this.generateProactiveMessage(userId, proactiveContext);
        await this.sendProactiveMessage(userId, message, 'nutrition', cooldown);

        return true;
      }

      return false;
    } catch (error) {
      logger.error('[ProactiveMessaging] Error checking nutrition reminder', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Check if user should receive a wellbeing check-in
   */
  async checkAndSendWellbeingReminder(userId: string, cachedContext?: any, cooldown?: { dailyCount: number; sentTypes: Set<string> }): Promise<boolean> {
    try {
      const context = cachedContext;

      // Check what's missing today
      const missing: string[] = [];
      if (context.wellbeing.missingToday) {
        if (context.wellbeing.missingToday.mood) missing.push('mood');
        if (context.wellbeing.missingToday.stress) missing.push('stress');
        if (context.wellbeing.missingToday.energy) missing.push('energy');
      }

      // Time window gating is handled by scoreMessageCandidates — no duplicate hour check needed
      if (missing.length > 0) {
        if (cooldown?.sentTypes.has('wellbeing')) return false;

        const proactiveContext: ProactiveContext = {
          type: 'wellbeing',
          data: {
            missingWellbeing: missing,
          },
          userContext: context,
        };

        const message = await this.generateProactiveMessage(userId, proactiveContext);
        await this.sendProactiveMessage(userId, message, 'wellbeing', cooldown);

        return true;
      }

      return false;
    } catch (error) {
      logger.error('[ProactiveMessaging] Error checking wellbeing reminder', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Check if user should receive a goal deadline message
   */
  async checkAndSendGoalDeadlineMessage(userId: string, cachedContext?: any, cooldown?: { dailyCount: number; sentTypes: Set<string> }): Promise<boolean> {
    try {
      if (cooldown && cooldown.dailyCount >= 4) return false;
      const context = cachedContext;

      const urgentGoal = context.goals.activeGoals?.find(
        (g: any) => g.daysRemaining >= 0 && g.daysRemaining <= 7 && g.progress < 80
      );

      if (urgentGoal) {
        if (cooldown?.sentTypes.has('goal_deadline')) return false;

        const proactiveContext: ProactiveContext = {
          type: 'goal_deadline',
          data: { goalTitle: urgentGoal.title, daysRemaining: urgentGoal.daysRemaining, progress: urgentGoal.progress },
          userContext: context,
        };
        const message = await this.generateProactiveMessage(userId, proactiveContext);
        await this.sendProactiveMessage(userId, message, 'goal_deadline', cooldown);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('[ProactiveMessaging] Error checking goal deadline', { userId, error: error instanceof Error ? error.message : 'Unknown' });
      return false;
    }
  }

  /**
   * Check if user should receive a goal stalled message
   */
  async checkAndSendGoalStalledMessage(userId: string, cachedContext?: any, cooldown?: { dailyCount: number; sentTypes: Set<string> }): Promise<boolean> {
    try {
      if (cooldown && cooldown.dailyCount >= 4) return false;

      // Check for goals with no progress change in 3+ days
      const stalledResult = await query<{ title: string; current_value: number; target_value: number; category: string }>(
        `SELECT g.title, g.current_value, g.target_value, g.category
         FROM user_goals g
         WHERE g.user_id = $1 AND g.status = 'active'
           AND g.updated_at < CURRENT_DATE - INTERVAL '3 days'
           AND g.current_value IS NOT NULL AND g.target_value IS NOT NULL
           AND g.current_value < g.target_value
         LIMIT 1`,
        [userId]
      );

      if (stalledResult.rows.length > 0) {
        if (cooldown?.sentTypes.has('goal_stalled')) return false;

        const goal = stalledResult.rows[0];
        const progress = Math.round((goal.current_value / goal.target_value) * 100);
        const context = cachedContext;

        const proactiveContext: ProactiveContext = {
          type: 'goal_stalled',
          data: { goalTitle: goal.title, daysSinceProgress: 3, progress },
          userContext: context,
        };

        // Enrich with pre-computed insights
        const insightCtx = await this.buildInsightDrivenContext(userId, 'goal_stalled', context);
        proactiveContext.analysisReport = insightCtx.report;
        proactiveContext.relevantInsights = insightCtx.relevantInsights;
        proactiveContext.crossDomainInsights = insightCtx.crossDomainInsights;
        proactiveContext.coachingDirective = insightCtx.coachingDirective;
        proactiveContext.stableTraits = insightCtx.stableTraits;

        const message = await this.generateProactiveMessage(userId, proactiveContext);
        await this.sendProactiveMessage(userId, message, 'goal_stalled', cooldown);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('[ProactiveMessaging] Error checking goal stalled', { userId, error: error instanceof Error ? error.message : 'Unknown' });
      return false;
    }
  }

  /**
   * Check if user's streak is at risk
   */
  async checkAndSendStreakRiskMessage(userId: string, cachedContext?: any, cooldown?: { dailyCount: number; sentTypes: Set<string> }): Promise<boolean> {
    try {
      if (cooldown && cooldown.dailyCount >= 4) return false;

      const stats = await gamificationService.getUserStats(userId);
      if (stats.currentStreak >= 1 && stats.lastActivityDate) {
        const lastActivity = new Date(stats.lastActivityDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        lastActivity.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor((today.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff >= 1) {
          if (cooldown?.sentTypes.has('streak_risk')) return false;

          const context = cachedContext;
          const proactiveContext: ProactiveContext = {
            type: 'streak_risk',
            data: { currentStreak: stats.currentStreak, longestStreak: stats.longestStreak },
            userContext: context,
          };
          const message = await this.generateProactiveMessage(userId, proactiveContext);
          await this.sendProactiveMessage(userId, message, 'streak_risk', cooldown);
          return true;
        }
      }
      return false;
    } catch (error) {
      logger.error('[ProactiveMessaging] Error checking streak risk', { userId, error: error instanceof Error ? error.message : 'Unknown' });
      return false;
    }
  }

  /**
   * Check if user hit a streak milestone
   */
  async checkAndSendStreakCelebrationMessage(userId: string, cachedContext?: any, cooldown?: { dailyCount: number; sentTypes: Set<string> }): Promise<boolean> {
    try {
      if (cooldown && cooldown.dailyCount >= 4) return false;

      const stats = await gamificationService.getUserStats(userId);
      const milestones = [7, 14, 30, 60, 90, 100, 150, 200, 365];
      const isMilestone = milestones.includes(stats.currentStreak);

      if (isMilestone) {
        if (cooldown?.sentTypes.has('streak_celebration')) return false;

        const context = cachedContext;
        const proactiveContext: ProactiveContext = {
          type: 'streak_celebration',
          data: {
            streakDays: stats.currentStreak,
            longestStreak: stats.longestStreak,
            isNewRecord: stats.currentStreak >= stats.longestStreak,
          },
          userContext: context,
        };
        const message = await this.generateProactiveMessage(userId, proactiveContext);
        await this.sendProactiveMessage(userId, message, 'streak_celebration', cooldown);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('[ProactiveMessaging] Error checking streak celebration', { userId, error: error instanceof Error ? error.message : 'Unknown' });
      return false;
    }
  }

  /**
   * Check if user missed habits today
   */
  async checkAndSendHabitMissedMessage(userId: string, cachedContext?: any, cooldown?: { dailyCount: number; sentTypes: Set<string> }): Promise<boolean> {
    try {
      if (cooldown && cooldown.dailyCount >= 4) return false;
      const context = cachedContext;

      if (context.habits.totalActiveHabits && context.habits.totalActiveHabits > 0) {
        const completed = context.habits.todayCompletionCount || 0;
        const total = context.habits.todayTotalHabits || 0;

        if (completed < total && completed < total / 2) {
          if (cooldown?.sentTypes.has('habit_missed')) return false;

          const missingHabits = context.habits.activeHabits
            ?.filter((h: any) => !h.completedToday)
            .map((h: any) => h.name)
            .slice(0, 3) || [];

          const proactiveContext: ProactiveContext = {
            type: 'habit_missed',
            data: { totalHabits: total, completedCount: completed, missingHabits },
            userContext: context,
          };
          const message = await this.generateProactiveMessage(userId, proactiveContext);
          await this.sendProactiveMessage(userId, message, 'habit_missed', cooldown);
          return true;
        }
      }
      return false;
    } catch (error) {
      logger.error('[ProactiveMessaging] Error checking habit missed', { userId, error: error instanceof Error ? error.message : 'Unknown' });
      return false;
    }
  }

  /**
   * Check if user needs a water intake reminder
   */
  async checkAndSendWaterIntakeMessage(userId: string, cachedContext?: any, cooldown?: { dailyCount: number; sentTypes: Set<string> }): Promise<boolean> {
    try {
      if (cooldown && cooldown.dailyCount >= 4) return false;
      const context = cachedContext;

      const pct = context.waterIntake.todayPercentage || 0;
      if (context.waterIntake.todayTargetMl && pct < 50) {
        if (cooldown?.sentTypes.has('water_intake')) return false;

        const proactiveContext: ProactiveContext = {
          type: 'water_intake',
          data: {
            mlConsumed: context.waterIntake.todayMlConsumed || 0,
            targetMl: context.waterIntake.todayTargetMl,
            percentage: pct,
            waterStreak: context.waterIntake.waterStreak,
          },
          userContext: context,
        };
        const message = await this.generateProactiveMessage(userId, proactiveContext);
        await this.sendProactiveMessage(userId, message, 'water_intake', cooldown);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('[ProactiveMessaging] Error checking water intake', { userId, error: error instanceof Error ? error.message : 'Unknown' });
      return false;
    }
  }

  /**
   * Send morning briefing message
   */
  async checkAndSendMorningBriefingMessage(userId: string, cachedContext?: any, cooldown?: { dailyCount: number; sentTypes: Set<string> }): Promise<boolean> {
    try {
      if (cooldown && cooldown.dailyCount >= 4) return false;
      if (cooldown?.sentTypes.has('morning_briefing')) return false;

      const context = cachedContext;

      // Only send if user has some active engagement (plans, goals, or habits)
      const hasPlans = (context.workouts.activePlans?.length || 0) > 0;
      const hasGoals = (context.goals.activeGoals?.length || 0) > 0;
      const hasHabits = (context.habits.totalActiveHabits || 0) > 0;
      if (!hasPlans && !hasGoals && !hasHabits) return false;

      // Get today's scheduled workout + yesterday's results in parallel
      const [todayWorkoutResult, yesterdayWorkoutResult, yesterdayMealResult, yesterdayScoreResult, unfulfilledCommitmentsResult] = await Promise.all([
        query<{ workout_name: string }>(
          `SELECT workout_name FROM workout_logs
           WHERE user_id = $1 AND scheduled_date = CURRENT_DATE AND status = 'pending'
           LIMIT 1`,
          [userId]
        ).catch(() => ({ rows: [] as { workout_name: string }[] })),
        query<{ status: string; workout_name: string }>(
          `SELECT status, workout_name FROM workout_logs
           WHERE user_id = $1 AND scheduled_date = CURRENT_DATE - INTERVAL '1 day'
           LIMIT 1`,
          [userId]
        ).catch(() => ({ rows: [] as { status: string; workout_name: string }[] })),
        query<{ total_calories: string; meal_count: string }>(
          `SELECT COALESCE(SUM(calories), 0)::text as total_calories, COUNT(*)::text as meal_count
           FROM meal_logs WHERE user_id = $1 AND eaten_at::date = CURRENT_DATE - INTERVAL '1 day'`,
          [userId]
        ).catch(() => ({ rows: [] as { total_calories: string; meal_count: string }[] })),
        query<{ total_score: string }>(
          `SELECT total_score::text FROM daily_user_scores
           WHERE user_id = $1 AND date = CURRENT_DATE - INTERVAL '1 day'`,
          [userId]
        ).catch(() => ({ rows: [] as { total_score: string }[] })),
        query<{ commitment_text: string }>(
          `SELECT commitment_text FROM user_commitments
           WHERE user_id = $1 AND follow_up_date <= CURRENT_DATE AND fulfilled IS NULL
           LIMIT 2`,
          [userId]
        ).catch(() => ({ rows: [] as { commitment_text: string }[] })),
      ]);

      const yesterdayWorkout = yesterdayWorkoutResult.rows[0];
      const yesterdayCalories = yesterdayMealResult.rows[0] ? parseInt(yesterdayMealResult.rows[0].total_calories) : 0;
      const yesterdayMealCount = yesterdayMealResult.rows[0] ? parseInt(yesterdayMealResult.rows[0].meal_count) : 0;
      const yesterdayScore = yesterdayScoreResult.rows[0] ? Math.round(parseFloat(yesterdayScoreResult.rows[0].total_score)) : null;
      const unfulfilledCommitments = unfulfilledCommitmentsResult.rows.map(r => r.commitment_text);

      const proactiveContext: ProactiveContext = {
        type: 'morning_briefing',
        data: {
          todayWorkout: todayWorkoutResult.rows[0]?.workout_name || null,
          recoveryScore: context.whoop.lastRecovery?.score,
          yesterdayScore: yesterdayScore ?? context.dailyScore.latestScore,
          currentStreak: context.gamification.currentStreak,
          activeHabits: context.habits.totalActiveHabits,
          activeGoals: context.goals.activeGoals?.length || 0,
          calorieTarget: context.nutrition?.activeDietPlan?.dailyCalories || null,
          // Yesterday's results
          yesterdayWorkoutCompleted: yesterdayWorkout?.status === 'completed',
          yesterdayWorkoutName: yesterdayWorkout?.workout_name || null,
          yesterdayCalories,
          yesterdayMealCount,
          yesterdaySleepHours: context.whoop?.lastSleep?.duration || null,
          unfulfilledCommitments,
          // Today's plan
          waterTarget: context.waterIntake?.todayTargetMl || null,
          todayHabitsTotal: context.habits?.todayTotalHabits || 0,
        },
        userContext: context,
      };

      // Enrich with pre-computed insights
      const insightCtx = await this.buildInsightDrivenContext(userId, 'morning_briefing', context);
      proactiveContext.analysisReport = insightCtx.report;
      proactiveContext.relevantInsights = insightCtx.relevantInsights;
      proactiveContext.crossDomainInsights = insightCtx.crossDomainInsights;
      proactiveContext.coachingDirective = insightCtx.coachingDirective;
      proactiveContext.stableTraits = insightCtx.stableTraits;

      const message = await this.generateProactiveMessage(userId, proactiveContext);
      await this.sendProactiveMessage(userId, message, 'morning_briefing', cooldown);
      return true;
    } catch (error) {
      logger.error('[ProactiveMessaging] Error sending morning briefing', { userId, error: error instanceof Error ? error.message : 'Unknown' });
      return false;
    }
  }

  /**
   * Send weekly digest (Sunday only)
   */
  async checkAndSendWeeklyDigestMessage(userId: string, cachedContext?: any, cooldown?: { dailyCount: number; sentTypes: Set<string> }): Promise<boolean> {
    try {
      if (cooldown && cooldown.dailyCount >= 4) return false;
      if (cooldown?.sentTypes.has('weekly_digest')) return false;

      const context = cachedContext;

      // Aggregate this week + last week data for comparison
      const [scoreResult, prevScoreResult, workoutResult, prevWorkoutResult, bestWorstResult, avgSleepResult, prevAvgSleepResult, avgRecoveryResult, prevAvgRecoveryResult] = await Promise.all([
        query<{ avg_score: string }>(
          `SELECT AVG(total_score)::text as avg_score FROM daily_user_scores
           WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '7 days'`,
          [userId]
        ).catch(() => ({ rows: [] as { avg_score: string }[] })),
        query<{ avg_score: string }>(
          `SELECT AVG(total_score)::text as avg_score FROM daily_user_scores
           WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '14 days' AND date < CURRENT_DATE - INTERVAL '7 days'`,
          [userId]
        ).catch(() => ({ rows: [] as { avg_score: string }[] })),
        query<{ completed: string; total: string }>(
          `SELECT
            COUNT(*) FILTER (WHERE status = 'completed')::text as completed,
            COUNT(*)::text as total
           FROM workout_logs
           WHERE user_id = $1 AND scheduled_date >= CURRENT_DATE - INTERVAL '7 days'`,
          [userId]
        ).catch(() => ({ rows: [] as { completed: string; total: string }[] })),
        query<{ completed: string; total: string }>(
          `SELECT
            COUNT(*) FILTER (WHERE status = 'completed')::text as completed,
            COUNT(*)::text as total
           FROM workout_logs
           WHERE user_id = $1 AND scheduled_date >= CURRENT_DATE - INTERVAL '14 days' AND scheduled_date < CURRENT_DATE - INTERVAL '7 days'`,
          [userId]
        ).catch(() => ({ rows: [] as { completed: string; total: string }[] })),
        query<{ date: string; total_score: string }>(
          `SELECT date::text, total_score::text FROM daily_user_scores
           WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '7 days'
           ORDER BY total_score DESC LIMIT 1`,
          [userId]
        ).catch(() => ({ rows: [] as { date: string; total_score: string }[] })),
        query<{ avg_sleep: string }>(
          `SELECT AVG((data->>'duration')::numeric)::numeric(4,1)::text as avg_sleep
           FROM health_data_records WHERE user_id = $1 AND data_type = 'sleep'
           AND recorded_at >= NOW() - INTERVAL '7 days'`,
          [userId]
        ).catch(() => ({ rows: [] as { avg_sleep: string }[] })),
        query<{ avg_sleep: string }>(
          `SELECT AVG((data->>'duration')::numeric)::numeric(4,1)::text as avg_sleep
           FROM health_data_records WHERE user_id = $1 AND data_type = 'sleep'
           AND recorded_at >= NOW() - INTERVAL '14 days' AND recorded_at < NOW() - INTERVAL '7 days'`,
          [userId]
        ).catch(() => ({ rows: [] as { avg_sleep: string }[] })),
        query<{ avg_recovery: string }>(
          `SELECT AVG((value->>'recovery_score')::numeric)::numeric(5,1)::text as avg_recovery
           FROM health_data_records WHERE user_id = $1 AND data_type = 'recovery'
           AND recorded_at >= NOW() - INTERVAL '7 days'`,
          [userId]
        ).catch(() => ({ rows: [] as { avg_recovery: string }[] })),
        query<{ avg_recovery: string }>(
          `SELECT AVG((value->>'recovery_score')::numeric)::numeric(5,1)::text as avg_recovery
           FROM health_data_records WHERE user_id = $1 AND data_type = 'recovery'
           AND recorded_at >= NOW() - INTERVAL '14 days' AND recorded_at < NOW() - INTERVAL '7 days'`,
          [userId]
        ).catch(() => ({ rows: [] as { avg_recovery: string }[] })),
      ]);

      const avgScore = scoreResult.rows[0]?.avg_score ? Math.round(parseFloat(scoreResult.rows[0].avg_score)) : null;
      const prevAvgScore = prevScoreResult.rows[0]?.avg_score ? Math.round(parseFloat(prevScoreResult.rows[0].avg_score)) : null;
      const prevWorkoutsCompleted = parseInt(prevWorkoutResult.rows[0]?.completed || '0', 10);
      const avgSleep = avgSleepResult.rows[0]?.avg_sleep ? parseFloat(avgSleepResult.rows[0].avg_sleep) : null;
      const prevAvgSleep = prevAvgSleepResult.rows[0]?.avg_sleep ? parseFloat(prevAvgSleepResult.rows[0].avg_sleep) : null;
      const avgRecovery = avgRecoveryResult.rows[0]?.avg_recovery ? parseFloat(avgRecoveryResult.rows[0].avg_recovery) : null;
      const prevAvgRecovery = prevAvgRecoveryResult.rows[0]?.avg_recovery ? parseFloat(prevAvgRecoveryResult.rows[0].avg_recovery) : null;
      const bestDay = bestWorstResult.rows[0] ? { date: bestWorstResult.rows[0].date, score: Math.round(parseFloat(bestWorstResult.rows[0].total_score)) } : null;

      const weightChange = context.progressTrend?.weightChangeKg
        ? `${context.progressTrend.weightChangeKg > 0 ? '+' : ''}${context.progressTrend.weightChangeKg} ${context.progressTrend.latestWeightUnit || 'kg'}`
        : null;

      const workoutsCompleted = parseInt(workoutResult.rows[0]?.completed || '0', 10);
      const workoutsPlanned = parseInt(workoutResult.rows[0]?.total || '0', 10);

      const proactiveContext: ProactiveContext = {
        type: 'weekly_digest',
        data: {
          avgScore,
          prevAvgScore,
          scoreDelta: avgScore != null && prevAvgScore != null ? avgScore - prevAvgScore : null,
          workoutsCompleted,
          workoutsPlanned,
          prevWorkoutsCompleted,
          nutritionOnTarget: context.nutritionAnalysis?.weeklyAdherenceRate
            ? Math.round((context.nutritionAnalysis.weeklyAdherenceRate / 100) * 7)
            : null,
          currentStreak: context.gamification.currentStreak,
          weightChange,
          bestDay: bestDay ? `${bestDay.date} (${bestDay.score}/100)` : null,
          avgSleep,
          prevAvgSleep,
          avgRecovery,
          prevAvgRecovery,
        },
        userContext: context,
      };

      // Enrich with pre-computed insights
      const insightCtx = await this.buildInsightDrivenContext(userId, 'weekly_digest', context);
      proactiveContext.analysisReport = insightCtx.report;
      proactiveContext.relevantInsights = insightCtx.relevantInsights;
      proactiveContext.crossDomainInsights = insightCtx.crossDomainInsights;
      proactiveContext.coachingDirective = insightCtx.coachingDirective;
      proactiveContext.stableTraits = insightCtx.stableTraits;

      const message = await this.generateProactiveMessage(userId, proactiveContext);
      await this.sendProactiveMessage(userId, message, 'weekly_digest', cooldown);
      return true;
    } catch (error) {
      logger.error('[ProactiveMessaging] Error sending weekly digest', { userId, error: error instanceof Error ? error.message : 'Unknown' });
      return false;
    }
  }

  /**
   * Check for achievement unlock (level up or streak milestone)
   */
  async checkAndSendAchievementMessage(userId: string, cachedContext?: any, cooldown?: { dailyCount: number; sentTypes: Set<string> }): Promise<boolean> {
    try {
      if (cooldown && cooldown.dailyCount >= 4) return false;
      if (cooldown?.sentTypes.has('achievement_unlock')) return false;

      const stats = await gamificationService.getUserStats(userId);

      // Check if there's a recent XP transaction indicating level up
      const levelUpResult = await query<{ id: string }>(
        `SELECT id FROM user_xp_transactions
         WHERE user_id = $1
           AND created_at >= CURRENT_DATE
           AND (description ILIKE '%level%' OR source_type = 'achievement')
         LIMIT 1`,
        [userId]
      );

      const milestones = [7, 14, 30, 60, 90, 100, 150, 200, 365];
      const isMilestone = milestones.includes(stats.currentStreak);
      const isLevelUp = levelUpResult.rows.length > 0;

      if (isLevelUp || isMilestone) {
        const context = cachedContext;
        const proactiveContext: ProactiveContext = {
          type: 'achievement_unlock',
          data: {
            achievementType: isLevelUp ? 'level_up' : 'streak_milestone',
            newLevel: stats.currentLevel,
            streakDays: stats.currentStreak,
            totalXP: stats.totalXP,
          },
          userContext: context,
        };
        const message = await this.generateProactiveMessage(userId, proactiveContext);
        await this.sendProactiveMessage(userId, message, 'achievement_unlock', cooldown);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('[ProactiveMessaging] Error checking achievement', { userId, error: error instanceof Error ? error.message : 'Unknown' });
      return false;
    }
  }

  /**
   * Check if user needs recovery advice (low WHOOP recovery + workout scheduled)
   */
  async checkAndSendRecoveryAdviceMessage(userId: string, cachedContext?: any, cooldown?: { dailyCount: number; sentTypes: Set<string> }): Promise<boolean> {
    try {
      if (cooldown && cooldown.dailyCount >= 4) return false;
      const context = cachedContext;

      if (context.whoop.isConnected && context.whoop.lastRecovery && context.whoop.lastRecovery.score < 40) {
        if (cooldown?.sentTypes.has('recovery_advice')) return false;

        // Check for today's workout
        const todayWorkoutResult = await query<{ workout_name: string }>(
          `SELECT workout_name FROM workout_logs
           WHERE user_id = $1 AND scheduled_date = CURRENT_DATE AND status = 'pending'
           LIMIT 1`,
          [userId]
        );

        const proactiveContext: ProactiveContext = {
          type: 'recovery_advice',
          data: {
            recoveryScore: context.whoop.lastRecovery.score,
            todayWorkout: todayWorkoutResult.rows[0]?.workout_name || null,
            sleepHours: context.whoop.lastSleep?.duration,
            strain: context.whoop.todayStrain?.score,
          },
          userContext: context,
        };

        // Enrich with pre-computed insights
        const insightCtx = await this.buildInsightDrivenContext(userId, 'recovery_advice', context);
        proactiveContext.analysisReport = insightCtx.report;
        proactiveContext.relevantInsights = insightCtx.relevantInsights;
        proactiveContext.crossDomainInsights = insightCtx.crossDomainInsights;
        proactiveContext.coachingDirective = insightCtx.coachingDirective;
        proactiveContext.stableTraits = insightCtx.stableTraits;

        const message = await this.generateProactiveMessage(userId, proactiveContext);
        await this.sendProactiveMessage(userId, message, 'recovery_advice', cooldown);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('[ProactiveMessaging] Error checking recovery advice', { userId, error: error instanceof Error ? error.message : 'Unknown' });
      return false;
    }
  }

  /**
   * Check for competition updates (ending soon or rank change)
   */
  async checkAndSendCompetitionUpdateMessage(userId: string, cachedContext?: any, cooldown?: { dailyCount: number; sentTypes: Set<string> }): Promise<boolean> {
    try {
      if (cooldown && cooldown.dailyCount >= 4) return false;
      const context = cachedContext;

      const endingSoon = context.competitions.activeCompetitions?.find((c: any) => c.daysRemaining <= 2);
      if (endingSoon) {
        if (cooldown?.sentTypes.has('competition_update')) return false;

        const proactiveContext: ProactiveContext = {
          type: 'competition_update',
          data: {
            competitionName: endingSoon.name,
            daysRemaining: endingSoon.daysRemaining,
            currentRank: endingSoon.currentRank,
            currentScore: endingSoon.currentScore,
            endingSoon: true,
          },
          userContext: context,
        };
        const message = await this.generateProactiveMessage(userId, proactiveContext);
        await this.sendProactiveMessage(userId, message, 'competition_update', cooldown);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('[ProactiveMessaging] Error checking competition update', { userId, error: error instanceof Error ? error.message : 'Unknown' });
      return false;
    }
  }

  /**
   * Check if user hasn't opened the app in 1+ days and send a "we miss you" message
   */
  async checkAndSendAppInactiveMessage(userId: string, cachedContext?: any, cooldown?: { dailyCount: number; sentTypes: Set<string> }): Promise<boolean> {
    try {
      if (cooldown && cooldown.dailyCount >= 4) return false;

      // Check user's last activity (last_login or last session)
      const result = await query<{ last_login: string | null }>(
        `SELECT last_login FROM users WHERE id = $1`,
        [userId]
      );

      if (!result.rows[0]?.last_login) return false;

      const lastLogin = new Date(result.rows[0].last_login);
      const now = new Date();
      const hoursSinceLogin = (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60);

      // Only trigger if user hasn't been active for 24+ hours
      if (hoursSinceLogin < 24) return false;

      if (cooldown?.sentTypes.has('app_inactive')) return false;

      const daysSinceLogin = Math.floor(hoursSinceLogin / 24);
      const context = cachedContext;

      const proactiveContext: ProactiveContext = {
        type: 'app_inactive',
        data: {
          daysSinceLastLogin: daysSinceLogin,
          lastLoginDate: lastLogin.toISOString(),
          streakAtRisk: (context.gamification?.currentStreak ?? 0) > 0,
          currentStreak: context.gamification?.currentStreak || 0,
        },
        userContext: context,
      };

      const message = await this.generateProactiveMessage(userId, proactiveContext);
      await this.sendProactiveMessage(userId, message, 'app_inactive', cooldown);
      return true;
    } catch (error) {
      logger.error('[ProactiveMessaging] Error checking app inactive', { userId, error: error instanceof Error ? error.message : 'Unknown' });
      return false;
    }
  }

  /**
   * Check if user should receive a Coach Pro analysis message.
   * Triggers daily for all users during 2-5 PM window (handled by job scheduler).
   * Uses pre-computed daily analysis report as primary content source.
   */
  async checkAndSendCoachProMessage(userId: string, cachedContext?: any, cooldown?: { dailyCount: number; sentTypes: Set<string> }): Promise<boolean> {
    try {
      if (cooldown && cooldown.dailyCount >= 4) return false;
      if (cooldown?.sentTypes.has('coach_pro_analysis')) return false;

      // Fetch coaching profile and daily analysis report in parallel
      const [profile, analysisReport] = await Promise.all([
        userCoachingProfileService.getOrGenerateProfile(userId, cachedContext).catch(() => null),
        dailyAnalysisService.getLatestReport(userId).catch(() => null),
      ]);

      const context = cachedContext;

      // If no profile AND no report, send a generic check-in instead of silently returning false.
      // coach_pro_analysis is the "always eligible" message type — it must always send something.
      if (!profile && !analysisReport) {
        const userName = await this.getUserName(userId).catch(() => null);
        const fallbackMessage = this.getFallbackMessage('coach_pro_analysis', userName || 'there');
        await this.sendProactiveMessage(userId, fallbackMessage, 'coach_pro_analysis', cooldown);
        return true;
      }

      const proactiveContext: ProactiveContext = {
        type: 'coach_pro_analysis',
        data: {
          coachingProfile: profile,
        },
        userContext: context,
      };

      // Enrich with pre-computed insights
      const insightCtx = await this.buildInsightDrivenContext(userId, 'coach_pro_analysis', context);
      proactiveContext.analysisReport = insightCtx.report;
      proactiveContext.relevantInsights = insightCtx.relevantInsights;
      proactiveContext.crossDomainInsights = insightCtx.crossDomainInsights;
      proactiveContext.coachingDirective = insightCtx.coachingDirective;
      proactiveContext.stableTraits = insightCtx.stableTraits;

      // Use a higher token LLM for richer coaching messages — guard against LLM init failure
      let prevMaxTokens: number | undefined;
      try {
        prevMaxTokens = (this.llm as any).maxTokens;
        (this.llm as any).maxTokens = 1200;
      } catch {
        // LLM init failed — generateProactiveMessage will use its own fallback
      }

      try {
        const message = await this.generateProactiveMessage(userId, proactiveContext);
        await this.sendProactiveMessage(userId, message, 'coach_pro_analysis', cooldown);
        return true;
      } finally {
        if (prevMaxTokens !== undefined) {
          try { (this.llm as any).maxTokens = prevMaxTokens; } catch { /* ignore */ }
        }
      }
    } catch (error) {
      logger.error('[ProactiveMessaging] Error sending coach pro analysis', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return false;
    }
  }

  // ============================================
  // MEAL ALIGNMENT FEEDBACK (event-driven + job fallback)
  // ============================================

  /**
   * Evaluate a just-logged meal against user goals and diet plan.
   * Called fire-and-forget from the meal logging endpoint for immediate feedback.
   * Also available via the job-based scoring path as a catch-up.
   */
  async checkAndSendMealAlignmentFeedback(
    userId: string,
    mealData?: { mealType?: string; mealName?: string; calories?: number; proteinGrams?: number; carbsGrams?: number; fatGrams?: number; fiberGrams?: number; foods?: unknown[] },
    cachedContext?: any,
    cooldown?: { dailyCount: number; sentTypes: Set<string> }
  ): Promise<boolean> {
    try {
      // Check daily cap (general + per-type limit of 3 meal alignment messages/day)
      if (cooldown && cooldown.dailyCount >= 4) return false;

      const mealAlignmentCount = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM proactive_messages
         WHERE user_id = $1 AND message_type = 'meal_alignment'
         AND created_at >= CURRENT_DATE`,
        [userId]
      ).catch(() => ({ rows: [{ count: '0' }] }));

      if (parseInt(mealAlignmentCount.rows[0]?.count || '0', 10) >= 3) {
        logger.debug('[ProactiveMessaging] Meal alignment daily limit reached', { userId });
        return false;
      }

      // Fetch diet plan targets
      const dietPlanResult = await query<{
        daily_calories: number; protein_grams: number; carbs_grams: number; fat_grams: number;
        dietary_preferences: string; excluded_foods: string; name: string;
      }>(
        `SELECT daily_calories, protein_grams, carbs_grams, fat_grams,
                dietary_preferences, excluded_foods, name
         FROM diet_plans WHERE user_id = $1 AND status = 'active'
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );

      if (dietPlanResult.rows.length === 0) return false; // No diet plan — can't evaluate
      const plan = dietPlanResult.rows[0];

      // Fetch today's total consumption (all meals including the one just logged)
      const todaySummary = await query<{
        total_calories: string; total_protein: string; total_carbs: string; total_fat: string; meal_count: string;
      }>(
        `SELECT COALESCE(SUM(calories), 0) as total_calories,
                COALESCE(SUM(protein_grams), 0) as total_protein,
                COALESCE(SUM(carbs_grams), 0) as total_carbs,
                COALESCE(SUM(fat_grams), 0) as total_fat,
                COUNT(*) as meal_count
         FROM meal_logs WHERE user_id = $1 AND eaten_at >= CURRENT_DATE`,
        [userId]
      );

      const summary = todaySummary.rows[0];
      const totalCalories = parseFloat(summary?.total_calories || '0');
      const totalProtein = parseFloat(summary?.total_protein || '0');
      const totalCarbs = parseFloat(summary?.total_carbs || '0');
      const totalFat = parseFloat(summary?.total_fat || '0');
      const mealCount = parseInt(summary?.meal_count || '0', 10);

      // Calculate deviations
      const targetCalories = plan.daily_calories || 0;
      const calorieDeviation = targetCalories > 0 ? ((totalCalories - targetCalories) / targetCalories) * 100 : 0;

      // Check excluded foods
      let excludedFoods: string[] = [];
      try {
        const rawExcluded = typeof plan.excluded_foods === 'string' ? JSON.parse(plan.excluded_foods) : plan.excluded_foods;
        excludedFoods = Array.isArray(rawExcluded) ? rawExcluded : [];
      } catch { /* ignore */ }

      const mealFoods = Array.isArray(mealData?.foods) ? mealData.foods : [];
      const mealFoodNames = mealFoods.map((f: any) => (f?.name || f?.food_name || '').toLowerCase());
      const flaggedExcluded = excludedFoods.filter(ef =>
        mealFoodNames.some(fn => fn.includes(ef.toLowerCase()))
      );

      // Fetch active goals for context
      const goalsResult = await query<{ category: string; title: string; progress: number }>(
        `SELECT category, title, progress FROM user_goals
         WHERE user_id = $1 AND status = 'active' ORDER BY is_primary DESC LIMIT 3`,
        [userId]
      );

      // Determine if meal is problematic
      const isOverCalories = calorieDeviation > 15; // >15% over daily target
      const hasExcludedFoods = flaggedExcluded.length > 0;
      const isSignificantlyOver = calorieDeviation > 30;
      const isGoodChoice = calorieDeviation <= 5 && !hasExcludedFoods && (mealData?.proteinGrams || 0) > 15;

      // Build context for AI message generation
      const proactiveContext: ProactiveContext = {
        type: 'meal_alignment',
        data: {
          mealName: mealData?.mealName || 'Unnamed meal',
          mealType: mealData?.mealType || 'meal',
          mealCalories: mealData?.calories || 0,
          mealProtein: mealData?.proteinGrams || 0,
          mealCarbs: mealData?.carbsGrams || 0,
          mealFat: mealData?.fatGrams || 0,
          totalCaloriesToday: totalCalories,
          totalProteinToday: totalProtein,
          totalCarbsToday: totalCarbs,
          totalFatToday: totalFat,
          mealsLoggedToday: mealCount,
          targetCalories,
          targetProtein: plan.protein_grams || 0,
          targetCarbs: plan.carbs_grams || 0,
          targetFat: plan.fat_grams || 0,
          calorieDeviation: Math.round(calorieDeviation),
          planName: plan.name,
          flaggedExcluded,
          isOverCalories,
          isSignificantlyOver,
          isGoodChoice,
          goals: goalsResult.rows,
          remainingCalories: Math.max(0, targetCalories - totalCalories),
        },
        userContext: cachedContext || {},
      };

      // Enrich with insights
      const insightCtx = await this.buildInsightDrivenContext(userId, 'meal_alignment', cachedContext || {});
      proactiveContext.analysisReport = insightCtx.report;
      proactiveContext.relevantInsights = insightCtx.relevantInsights;
      proactiveContext.crossDomainInsights = insightCtx.crossDomainInsights;
      proactiveContext.coachingDirective = insightCtx.coachingDirective;
      proactiveContext.stableTraits = insightCtx.stableTraits;

      const message = await this.generateProactiveMessage(userId, proactiveContext);
      await this.sendProactiveMessage(userId, message, 'meal_alignment', cooldown);

      logger.info('[ProactiveMessaging] Sent meal alignment feedback', {
        userId: userId.slice(0, 8),
        mealName: mealData?.mealName,
        calorieDeviation: Math.round(calorieDeviation),
        isOverCalories,
        isGoodChoice,
      });

      return true;
    } catch (error) {
      logger.error('[ProactiveMessaging] Error sending meal alignment feedback', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return false;
    }
  }

  // ============================================
  // DAILY PROGRESS REVIEW (job-based, evening)
  // ============================================

  /**
   * Send a comprehensive daily progress review covering all pillars.
   * Triggered by the proactive messaging job in the evening window (19-21).
   */
  async checkAndSendDailyProgressReview(
    userId: string,
    cachedContext?: any,
    cooldown?: { dailyCount: number; sentTypes: Set<string> }
  ): Promise<boolean> {
    try {
      if (cooldown && cooldown.dailyCount >= 4) return false;
      if (cooldown?.sentTypes.has('daily_progress_review')) return false;

      const context = cachedContext;

      // Fetch today's meal summary
      const mealSummary = await query<{
        total_calories: string; total_protein: string; total_carbs: string; total_fat: string; meal_count: string;
      }>(
        `SELECT COALESCE(SUM(calories), 0) as total_calories,
                COALESCE(SUM(protein_grams), 0) as total_protein,
                COALESCE(SUM(carbs_grams), 0) as total_carbs,
                COALESCE(SUM(fat_grams), 0) as total_fat,
                COUNT(*) as meal_count
         FROM meal_logs WHERE user_id = $1 AND eaten_at >= CURRENT_DATE`,
        [userId]
      ).catch(() => ({ rows: [{ total_calories: '0', total_protein: '0', total_carbs: '0', total_fat: '0', meal_count: '0' }] }));

      // Fetch today's workout completions
      const workoutSummary = await query<{ completed: string; planned: string }>(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'completed') as completed,
           COUNT(*) as planned
         FROM plan_activities
         WHERE user_id = $1 AND scheduled_date = CURRENT_DATE`,
        [userId]
      ).catch(() => ({ rows: [{ completed: '0', planned: '0' }] }));

      // Fetch active goals with progress
      const goals = await query<{ title: string; category: string; progress: number; target_value: number; current_value: number }>(
        `SELECT title, category, progress, target_value, current_value
         FROM user_goals WHERE user_id = $1 AND status = 'active'
         ORDER BY is_primary DESC LIMIT 5`,
        [userId]
      ).catch(() => ({ rows: [] as { title: string; category: string; progress: number; target_value: number; current_value: number }[] }));

      // Fetch diet plan targets
      const dietPlan = await query<{ daily_calories: number; protein_grams: number; name: string }>(
        `SELECT daily_calories, protein_grams, name FROM diet_plans
         WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
        [userId]
      ).catch(() => ({ rows: [] as { daily_calories: number; protein_grams: number; name: string }[] }));

      // Fetch coaching profile + schedule adherence
      const [profile, scheduleResult] = await Promise.all([
        userCoachingProfileService.getOrGenerateProfile(userId, cachedContext).catch(() => null),
        query<{ completed: string; total: string }>(
          `SELECT COUNT(CASE WHEN si.completed THEN 1 END)::text as completed,
                  COUNT(*)::text as total
           FROM schedule_items si
           JOIN daily_schedules ds ON si.schedule_id = ds.id
           WHERE ds.user_id = $1 AND ds.date = CURRENT_DATE`,
          [userId]
        ).catch(() => ({ rows: [] as { completed: string; total: string }[] })),
      ]);

      const meals = mealSummary.rows[0];
      const workouts = workoutSummary.rows[0];
      const plan = dietPlan.rows[0];
      const adherence = profile?.adherenceScores || {};

      const targetCalories = plan?.daily_calories || 0;
      const actualCalories = parseFloat(meals?.total_calories || '0');
      const calorieDeviation = targetCalories > 0 ? Math.round(((actualCalories - targetCalories) / targetCalories) * 100) : 0;

      const proactiveContext: ProactiveContext = {
        type: 'daily_progress_review',
        data: {
          // Nutrition
          mealsLogged: parseInt(meals?.meal_count || '0', 10),
          totalCalories: actualCalories,
          totalProtein: parseFloat(meals?.total_protein || '0'),
          totalCarbs: parseFloat(meals?.total_carbs || '0'),
          totalFat: parseFloat(meals?.total_fat || '0'),
          targetCalories,
          targetProtein: plan?.protein_grams || 0,
          calorieDeviation,
          planName: plan?.name,
          // Fitness
          workoutsCompleted: parseInt(workouts?.completed || '0', 10),
          workoutsPlanned: parseInt(workouts?.planned || '0', 10),
          // Goals
          activeGoals: goals.rows,
          // Adherence
          adherenceScores: adherence,
          // WHOOP
          recovery: context?.whoop?.lastRecovery?.score,
          strain: context?.whoop?.lastStrain?.score,
          sleepHours: context?.whoop?.lastSleep?.duration,
          // Wellbeing
          mood: context?.wellbeing?.latestMood,
          energy: context?.wellbeing?.latestEnergy,
          stress: context?.wellbeing?.latestStress,
          // Streak & Score
          streak: context?.gamification?.currentStreak || 0,
          dailyScore: context?.dailyScore?.latestScore,
          // Schedule adherence (Phase 3)
          scheduleCompleted: parseInt(scheduleResult.rows[0]?.completed || '0', 10),
          scheduleTotal: parseInt(scheduleResult.rows[0]?.total || '0', 10),
        },
        userContext: context,
      };

      // Enrich with pre-computed insights
      const insightCtx = await this.buildInsightDrivenContext(userId, 'daily_progress_review', context);
      proactiveContext.analysisReport = insightCtx.report;
      proactiveContext.relevantInsights = insightCtx.relevantInsights;
      proactiveContext.crossDomainInsights = insightCtx.crossDomainInsights;
      proactiveContext.coachingDirective = insightCtx.coachingDirective;
      proactiveContext.stableTraits = insightCtx.stableTraits;

      // Use higher token limit for comprehensive review — guard against LLM init failure
      let prevMaxTokens: number | undefined;
      try {
        prevMaxTokens = (this.llm as any).maxTokens;
        (this.llm as any).maxTokens = 1200;
      } catch {
        // LLM init failed — generateProactiveMessage will use its own fallback
      }

      try {
        const message = await this.generateProactiveMessage(userId, proactiveContext);
        await this.sendProactiveMessage(userId, message, 'daily_progress_review', cooldown);
        return true;
      } finally {
        if (prevMaxTokens !== undefined) {
          try { (this.llm as any).maxTokens = prevMaxTokens; } catch { /* ignore */ }
        }
      }
    } catch (error) {
      logger.error('[ProactiveMessaging] Error sending daily progress review', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return false;
    }
  }

  /**
   * Check if user should receive a score declining message.
   * Triggers when daily score drops 10+ points day-over-day.
   */
  async checkAndSendScoreDecliningMessage(
    userId: string,
    cachedContext?: any,
    cooldown?: { dailyCount: number; sentTypes: Set<string> }
  ): Promise<boolean> {
    try {
      if (cooldown && cooldown.dailyCount >= 4) return false;
      if (cooldown?.sentTypes.has('score_declining')) return false;

      const context = cachedContext;
      const ds = context.dailyScore;

      if (ds?.scoreTrend !== 'declining' || !ds?.scoreDelta || ds.scoreDelta >= -10) {
        return false;
      }

      const proactiveContext: ProactiveContext = {
        type: 'score_declining',
        data: {
          currentScore: ds.latestScore,
          previousScore: ds.previousScore,
          scoreDelta: ds.scoreDelta,
          scoreTrend: ds.scoreTrend,
          weekOverWeekDelta: ds.weekOverWeekDelta,
          componentScores: ds.componentScores,
        },
        userContext: context,
      };

      const insightCtx = await this.buildInsightDrivenContext(userId, 'score_declining', context);
      proactiveContext.analysisReport = insightCtx.report;
      proactiveContext.relevantInsights = insightCtx.relevantInsights;
      proactiveContext.crossDomainInsights = insightCtx.crossDomainInsights;
      proactiveContext.coachingDirective = insightCtx.coachingDirective;
      proactiveContext.stableTraits = insightCtx.stableTraits;

      const message = await this.generateProactiveMessage(userId, proactiveContext);
      await this.sendProactiveMessage(userId, message, 'score_declining', cooldown);
      return true;
    } catch (error) {
      logger.error('[ProactiveMessaging] Error checking score declining', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return false;
    }
  }

  // ============================================
  // PLAN NON-ADHERENCE (multi-day inactivity)
  // ============================================

  /**
   * Send strict accountability message when user hasn't followed their plan for 3+ days.
   * Detects: no activity, low completion rate, missed workouts/meals over multiple days.
   */
  async checkAndSendPlanNonAdherenceMessage(
    userId: string,
    cachedContext?: any,
    cooldown?: { dailyCount: number; sentTypes: Set<string> }
  ): Promise<boolean> {
    try {
      if (cooldown && cooldown.dailyCount >= 4) return false;
      if (cooldown?.sentTypes.has('plan_non_adherence')) return false;

      const context = cachedContext;

      // Fetch coaching profile for adherence data
      const profile = await userCoachingProfileService.getOrGenerateProfile(userId, context).catch(() => null);
      const adherence7d = profile?.longitudinalAdherence?.adherence7d;
      const consecutiveLowDays = profile?.longitudinalAdherence?.consecutiveLowDays || 0;
      const accountabilityLevel = profile?.accountabilityLevel || 'supportive';

      // Calculate days since last workout and meal
      let daysSinceLastWorkout = 0;
      if (context.workouts?.lastWorkoutDate) {
        daysSinceLastWorkout = Math.floor(
          (Date.now() - new Date(context.workouts.lastWorkoutDate).getTime()) / (1000 * 60 * 60 * 24)
        );
      }
      let daysSinceLastMeal = 0;
      if (context.nutrition?.lastMealDate) {
        daysSinceLastMeal = Math.floor(
          (Date.now() - new Date(context.nutrition.lastMealDate).getTime()) / (1000 * 60 * 60 * 24)
        );
      }

      const proactiveContext: ProactiveContext = {
        type: 'plan_non_adherence',
        data: {
          daysSinceLastWorkout,
          daysSinceLastMeal,
          missedWorkouts: context.workouts?.missedWorkouts || 0,
          completionRate: context.workouts?.completionRate,
          consecutiveLowDays,
          accountabilityLevel,
          adherence7d,
          activePlanName: context.workouts?.activePlans?.[0]?.name,
          activePlanProgress: context.workouts?.activePlans?.[0]?.progress,
          dietPlanName: context.nutrition?.activeDietPlan?.name,
          nutritionAdherence: context.nutrition?.activeDietPlan?.adherence,
        },
        userContext: context,
      };

      // Enrich with pre-computed insights
      const insightCtx = await this.buildInsightDrivenContext(userId, 'plan_non_adherence', context);
      proactiveContext.analysisReport = insightCtx.report;
      proactiveContext.relevantInsights = insightCtx.relevantInsights;
      proactiveContext.crossDomainInsights = insightCtx.crossDomainInsights;
      proactiveContext.coachingDirective = insightCtx.coachingDirective;
      proactiveContext.stableTraits = insightCtx.stableTraits;

      // Use higher token limit for detailed accountability messages — guard against LLM init failure
      let prevMaxTokens: number | undefined;
      try {
        prevMaxTokens = (this.llm as any).maxTokens;
        (this.llm as any).maxTokens = 1200;
      } catch {
        // LLM init failed — generateProactiveMessage will use its own fallback
      }

      try {
        const message = await this.generateProactiveMessage(userId, proactiveContext);
        await this.sendProactiveMessage(userId, message, 'plan_non_adherence', cooldown);
        return true;
      } finally {
        if (prevMaxTokens !== undefined) {
          try { (this.llm as any).maxTokens = prevMaxTokens; } catch { /* ignore */ }
        }
      }
    } catch (error) {
      logger.error('[ProactiveMessaging] Error sending plan non-adherence message', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return false;
    }
  }

  // ============================================
  // PHASE 1: NEW MESSAGE TYPE HANDLERS
  // ============================================

  /**
   * Overtraining risk: high strain + low recovery + workout planned = injury risk
   */
  async checkAndSendOvertrainingRiskMessage(
    userId: string,
    cachedContext?: any,
    cooldown?: { dailyCount: number; sentTypes: Set<string> }
  ): Promise<boolean> {
    try {
      if (cooldown && cooldown.dailyCount >= 4) return false;
      if (cooldown?.sentTypes.has('overtraining_risk')) return false;

      const context = cachedContext;
      const recovery = context.whoop?.lastRecovery?.score;
      const strain = context.whoop?.todayStrain?.score;

      if (!context.whoop?.isConnected || recovery == null) return false;
      if (!((recovery < 40 && strain != null && strain > 15) || recovery < 30)) return false;

      // Get today's scheduled workout name if available
      const todayWorkoutResult = await query<{ workout_name: string }>(
        `SELECT workout_name FROM workout_logs
         WHERE user_id = $1 AND scheduled_date = CURRENT_DATE AND status = 'pending'
         LIMIT 1`,
        [userId]
      ).catch(() => ({ rows: [] as { workout_name: string }[] }));

      const proactiveContext: ProactiveContext = {
        type: 'overtraining_risk',
        data: {
          recoveryScore: recovery,
          strain: strain ?? null,
          sleepHours: context.whoop.lastSleep?.duration,
          hrvStatus: context.whoop.lastRecovery?.hrvStatus || null,
          todayWorkout: todayWorkoutResult.rows[0]?.workout_name || context.workouts?.activePlans?.[0]?.name || null,
          activePlanName: context.workouts?.activePlans?.[0]?.name || null,
        },
        userContext: context,
      };

      const insightCtx = await this.buildInsightDrivenContext(userId, 'overtraining_risk', context);
      proactiveContext.analysisReport = insightCtx.report;
      proactiveContext.relevantInsights = insightCtx.relevantInsights;
      proactiveContext.crossDomainInsights = insightCtx.crossDomainInsights;
      proactiveContext.coachingDirective = insightCtx.coachingDirective;
      proactiveContext.stableTraits = insightCtx.stableTraits;

      const message = await this.generateProactiveMessage(userId, proactiveContext);
      await this.sendProactiveMessage(userId, message, 'overtraining_risk', cooldown);
      return true;
    } catch (error) {
      logger.error('[ProactiveMessaging] Error checking overtraining risk', { userId, error: error instanceof Error ? error.message : 'Unknown' });
      return false;
    }
  }

  /**
   * Commitment follow-up: user said "I'll do X" in chat → check if they followed through
   */
  async checkAndSendCommitmentFollowup(
    userId: string,
    cachedContext?: any,
    cooldown?: { dailyCount: number; sentTypes: Set<string> }
  ): Promise<boolean> {
    try {
      if (cooldown && cooldown.dailyCount >= 4) return false;
      if (cooldown?.sentTypes.has('commitment_followup')) return false;

      // Fetch unfulfilled commitments
      const commitmentResult = await query<{
        id: string; commitment_text: string; follow_up_date: string; category: string;
      }>(
        `SELECT id, commitment_text, follow_up_date, category
         FROM user_commitments
         WHERE user_id = $1 AND follow_up_date <= CURRENT_DATE
         AND fulfilled IS NULL
         ORDER BY follow_up_date ASC LIMIT 3`,
        [userId]
      ).catch(() => ({ rows: [] as { id: string; commitment_text: string; follow_up_date: string; category: string }[] }));

      if (commitmentResult.rows.length === 0) return false;

      const context = cachedContext;
      const commitments = commitmentResult.rows;
      const daysOverdue = Math.floor(
        (Date.now() - new Date(commitments[0].follow_up_date).getTime()) / (1000 * 60 * 60 * 24)
      );

      const proactiveContext: ProactiveContext = {
        type: 'commitment_followup',
        data: {
          commitments: commitments.map(c => ({
            text: c.commitment_text,
            category: c.category,
            followUpDate: c.follow_up_date,
          })),
          primaryCommitment: commitments[0].commitment_text,
          category: commitments[0].category,
          daysOverdue,
          totalUnfulfilled: commitments.length,
        },
        userContext: context,
      };

      const insightCtx = await this.buildInsightDrivenContext(userId, 'commitment_followup', context);
      proactiveContext.analysisReport = insightCtx.report;
      proactiveContext.relevantInsights = insightCtx.relevantInsights;
      proactiveContext.crossDomainInsights = insightCtx.crossDomainInsights;
      proactiveContext.coachingDirective = insightCtx.coachingDirective;
      proactiveContext.stableTraits = insightCtx.stableTraits;

      const message = await this.generateProactiveMessage(userId, proactiveContext);
      await this.sendProactiveMessage(userId, message, 'commitment_followup', cooldown);
      return true;
    } catch (error) {
      logger.error('[ProactiveMessaging] Error checking commitment followup', { userId, error: error instanceof Error ? error.message : 'Unknown' });
      return false;
    }
  }

  /**
   * Recovery trend alert: recovery declining over 3+ days indicates lifestyle issue
   */
  async checkAndSendRecoveryTrendAlert(
    userId: string,
    cachedContext?: any,
    cooldown?: { dailyCount: number; sentTypes: Set<string> }
  ): Promise<boolean> {
    try {
      if (cooldown && cooldown.dailyCount >= 4) return false;
      if (cooldown?.sentTypes.has('recovery_trend_alert')) return false;

      const context = cachedContext;
      if (!context.whoop?.isConnected) return false;

      // Fetch last 5 days of recovery data for trend display
      const trendResult = await query<{ score: string; recorded_at: string }>(
        `SELECT score::text, recorded_at::date::text as recorded_at
         FROM health_data_records
         WHERE user_id = $1 AND data_type = 'recovery'
         AND recorded_at >= NOW() - INTERVAL '5 days'
         ORDER BY recorded_at DESC`,
        [userId]
      ).catch(() => ({ rows: [] as { score: string; recorded_at: string }[] }));

      if (trendResult.rows.length < 3) return false;

      const recoveryValues = trendResult.rows.map(r => parseFloat(r.score));
      const avg = recoveryValues.reduce((s, v) => s + v, 0) / recoveryValues.length;
      const currentRecovery = recoveryValues[0];

      // Must be trending down: current below average
      if (avg >= 50 || currentRecovery >= avg) return false;

      const proactiveContext: ProactiveContext = {
        type: 'recovery_trend_alert',
        data: {
          currentRecovery,
          avgRecovery3d: Math.round(avg),
          trendDays: trendResult.rows.length,
          dailyRecoveries: trendResult.rows.map(r => ({
            date: r.recorded_at,
            score: parseFloat(r.score),
          })),
          sleepHours: context.whoop.lastSleep?.duration,
          strain: context.whoop.todayStrain?.score,
        },
        userContext: context,
      };

      const insightCtx = await this.buildInsightDrivenContext(userId, 'recovery_trend_alert', context);
      proactiveContext.analysisReport = insightCtx.report;
      proactiveContext.relevantInsights = insightCtx.relevantInsights;
      proactiveContext.crossDomainInsights = insightCtx.crossDomainInsights;
      proactiveContext.coachingDirective = insightCtx.coachingDirective;
      proactiveContext.stableTraits = insightCtx.stableTraits;

      const message = await this.generateProactiveMessage(userId, proactiveContext);
      await this.sendProactiveMessage(userId, message, 'recovery_trend_alert', cooldown);
      return true;
    } catch (error) {
      logger.error('[ProactiveMessaging] Error checking recovery trend', { userId, error: error instanceof Error ? error.message : 'Unknown' });
      return false;
    }
  }

  /**
   * Positive momentum: micro-reinforcement for 3+ consecutive good days (below milestone threshold)
   */
  async checkAndSendPositiveMomentum(
    userId: string,
    cachedContext?: any,
    cooldown?: { dailyCount: number; sentTypes: Set<string> }
  ): Promise<boolean> {
    try {
      if (cooldown && cooldown.dailyCount >= 4) return false;
      if (cooldown?.sentTypes.has('positive_momentum')) return false;

      const context = cachedContext;
      const triggers: string[] = [];

      const consecutiveWorkoutDays = context.workouts?.consecutiveCompletionDays || 0;
      const consecutiveNutritionDays = context.nutrition?.consecutiveOnTargetDays || 0;
      const waterConsecutive = context.waterIntake?.consecutiveDaysOnTarget || 0;
      const habitConsecutive = context.habits?.consecutiveFullCompletionDays || 0;
      const scoreDelta3d = context.dailyScore?.scoreDelta3d || 0;

      if (consecutiveWorkoutDays >= 3 && consecutiveWorkoutDays < 7) triggers.push(`${consecutiveWorkoutDays} days straight of completing workouts`);
      if (consecutiveNutritionDays >= 3 && (context.nutrition?.adherenceRate || 0) > 80) triggers.push(`${consecutiveNutritionDays} days of hitting calorie targets`);
      if (scoreDelta3d > 10) triggers.push(`daily score improved by ${scoreDelta3d} points over 3 days`);
      if (waterConsecutive >= 3) triggers.push(`${waterConsecutive} days hitting water intake goal`);
      if (habitConsecutive >= 2) triggers.push(`${habitConsecutive} days completing all habits`);

      if (triggers.length === 0) return false;

      const proactiveContext: ProactiveContext = {
        type: 'positive_momentum',
        data: {
          triggers,
          primaryTrigger: triggers[0],
          consecutiveWorkoutDays,
          consecutiveNutritionDays,
          waterConsecutive,
          habitConsecutive,
          scoreDelta3d,
          currentScore: context.dailyScore?.latestScore,
          streak: context.gamification?.currentStreak || 0,
        },
        userContext: context,
      };

      const insightCtx = await this.buildInsightDrivenContext(userId, 'positive_momentum', context);
      proactiveContext.analysisReport = insightCtx.report;
      proactiveContext.relevantInsights = insightCtx.relevantInsights;
      proactiveContext.crossDomainInsights = insightCtx.crossDomainInsights;
      proactiveContext.coachingDirective = insightCtx.coachingDirective;
      proactiveContext.stableTraits = insightCtx.stableTraits;

      const message = await this.generateProactiveMessage(userId, proactiveContext);
      await this.sendProactiveMessage(userId, message, 'positive_momentum', cooldown);
      return true;
    } catch (error) {
      logger.error('[ProactiveMessaging] Error checking positive momentum', { userId, error: error instanceof Error ? error.message : 'Unknown' });
      return false;
    }
  }

  // ============================================
  // LIFE GOAL & INTENTION PROACTIVE MESSAGES
  // ============================================

  /**
   * "How's your [goal] going?" — sent when a life goal has no activity for 3+ days
   */
  async checkAndSendLifeGoalCheckin(
    userId: string,
    cachedContext?: any,
    cooldown?: { dailyCount: number; sentTypes: Set<string> }
  ): Promise<boolean> {
    try {
      if (cooldown && cooldown.dailyCount >= 4) return false;
      if (cooldown?.sentTypes.has('life_goal_checkin')) return false;

      // Find life goals with 3-6 days of inactivity
      const stalledResult = await query<{ id: string; title: string; category: string; days_inactive: string }>(
        `SELECT lg.id, lg.title, lg.category,
                GREATEST(
                  EXTRACT(DAY FROM NOW() - COALESCE(
                    (SELECT MAX(checkin_date)::timestamptz FROM life_goal_checkins WHERE life_goal_id = lg.id),
                    lg.created_at
                  )),
                  EXTRACT(DAY FROM NOW() - COALESCE(lg.last_mentioned_at, lg.created_at))
                )::text as days_inactive
         FROM life_goals lg WHERE lg.user_id = $1 AND lg.status = 'active'
         GROUP BY lg.id, lg.title, lg.category, lg.created_at, lg.last_mentioned_at
         HAVING GREATEST(
           EXTRACT(DAY FROM NOW() - COALESCE(
             (SELECT MAX(checkin_date)::timestamptz FROM life_goal_checkins WHERE life_goal_id = lg.id),
             lg.created_at
           )),
           EXTRACT(DAY FROM NOW() - COALESCE(lg.last_mentioned_at, lg.created_at))
         ) BETWEEN 3 AND 6
         ORDER BY days_inactive DESC LIMIT 1`,
        [userId]
      );

      if (stalledResult.rows.length === 0) return false;

      const goal = stalledResult.rows[0];
      const context = cachedContext;

      // Get accountability level for tone calibration
      const profile = await userCoachingProfileService.getProfile(userId).catch(() => null);
      const accountabilityLevel = profile?.accountabilityLevel || 'supportive';

      const proactiveContext: ProactiveContext = {
        type: 'life_goal_checkin',
        data: {
          goalTitle: goal.title,
          category: goal.category,
          daysSinceActivity: parseInt(goal.days_inactive),
          accountabilityLevel,
        },
        userContext: context,
      };

      const insightCtx = await this.buildInsightDrivenContext(userId, 'life_goal_checkin', context);
      proactiveContext.analysisReport = insightCtx.report;
      proactiveContext.relevantInsights = insightCtx.relevantInsights;
      proactiveContext.crossDomainInsights = insightCtx.crossDomainInsights;
      proactiveContext.coachingDirective = insightCtx.coachingDirective;
      proactiveContext.stableTraits = insightCtx.stableTraits;

      const message = await this.generateProactiveMessage(userId, proactiveContext);
      await this.sendProactiveMessage(userId, message, 'life_goal_checkin', cooldown);
      return true;
    } catch (error) {
      logger.error('[ProactiveMessaging] Error checking life goal check-in', { userId, error: error instanceof Error ? error.message : 'Unknown' });
      return false;
    }
  }

  /**
   * "I noticed you haven't worked on [goal] in a while" — 7+ days inactive
   */
  async checkAndSendLifeGoalStalled(
    userId: string,
    cachedContext?: any,
    cooldown?: { dailyCount: number; sentTypes: Set<string> }
  ): Promise<boolean> {
    try {
      if (cooldown && cooldown.dailyCount >= 4) return false;
      if (cooldown?.sentTypes.has('life_goal_stalled')) return false;

      const stalledResult = await query<{ id: string; title: string; category: string; days_inactive: string }>(
        `SELECT lg.id, lg.title, lg.category,
                GREATEST(
                  EXTRACT(DAY FROM NOW() - COALESCE(
                    (SELECT MAX(checkin_date)::timestamptz FROM life_goal_checkins WHERE life_goal_id = lg.id),
                    lg.created_at
                  )),
                  EXTRACT(DAY FROM NOW() - COALESCE(lg.last_mentioned_at, lg.created_at))
                )::text as days_inactive
         FROM life_goals lg
         WHERE lg.user_id = $1 AND lg.status = 'active'
           -- Suppress stalled nudge while a Goal Reconnection prompt is active for this goal
           AND NOT EXISTS (
             SELECT 1 FROM goal_reconnections gr
             WHERE gr.life_goal_id = lg.id
               AND gr.resolved_at IS NULL
               AND (gr.snoozed_until IS NULL OR gr.snoozed_until < CURRENT_DATE)
           )
         GROUP BY lg.id, lg.title, lg.category, lg.created_at, lg.last_mentioned_at
         HAVING GREATEST(
           EXTRACT(DAY FROM NOW() - COALESCE(
             (SELECT MAX(checkin_date)::timestamptz FROM life_goal_checkins WHERE life_goal_id = lg.id),
             lg.created_at
           )),
           EXTRACT(DAY FROM NOW() - COALESCE(lg.last_mentioned_at, lg.created_at))
         ) >= 7
         ORDER BY days_inactive DESC LIMIT 1`,
        [userId]
      );

      if (stalledResult.rows.length === 0) return false;

      const goal = stalledResult.rows[0];
      const context = cachedContext;

      const profile = await userCoachingProfileService.getProfile(userId).catch(() => null);
      const accountabilityLevel = profile?.accountabilityLevel || 'supportive';

      const proactiveContext: ProactiveContext = {
        type: 'life_goal_stalled',
        data: {
          goalTitle: goal.title,
          category: goal.category,
          daysSinceActivity: parseInt(goal.days_inactive),
          accountabilityLevel,
        },
        userContext: context,
      };

      const insightCtx = await this.buildInsightDrivenContext(userId, 'life_goal_stalled', context);
      proactiveContext.analysisReport = insightCtx.report;
      proactiveContext.relevantInsights = insightCtx.relevantInsights;
      proactiveContext.crossDomainInsights = insightCtx.crossDomainInsights;
      proactiveContext.coachingDirective = insightCtx.coachingDirective;
      proactiveContext.stableTraits = insightCtx.stableTraits;

      const message = await this.generateProactiveMessage(userId, proactiveContext);
      await this.sendProactiveMessage(userId, message, 'life_goal_stalled', cooldown);
      return true;
    } catch (error) {
      logger.error('[ProactiveMessaging] Error checking life goal stalled', { userId, error: error instanceof Error ? error.message : 'Unknown' });
      return false;
    }
  }

  /**
   * "Your milestone [X] is coming up!" — milestone approaching deadline
   */
  async checkAndSendLifeGoalMilestone(
    userId: string,
    cachedContext?: any,
    cooldown?: { dailyCount: number; sentTypes: Set<string> }
  ): Promise<boolean> {
    try {
      if (cooldown && cooldown.dailyCount >= 4) return false;
      if (cooldown?.sentTypes.has('life_goal_milestone')) return false;

      const milestoneResult = await query<{ milestone_title: string; goal_title: string; target_date: string }>(
        `SELECT m.title as milestone_title, lg.title as goal_title, m.target_date::text
         FROM life_goal_milestones m
         JOIN life_goals lg ON lg.id = m.life_goal_id
         WHERE m.user_id = $1 AND m.completed = false
         AND m.target_date IS NOT NULL
         AND m.target_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
         ORDER BY m.target_date ASC
         LIMIT 1`,
        [userId]
      );

      if (milestoneResult.rows.length === 0) return false;

      const milestone = milestoneResult.rows[0];
      const targetDate = new Date(milestone.target_date);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const daysUntil = Math.max(0, Math.floor((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      const context = cachedContext;

      const proactiveContext: ProactiveContext = {
        type: 'life_goal_milestone',
        data: {
          milestoneTitle: milestone.milestone_title,
          goalTitle: milestone.goal_title,
          daysUntilTarget: daysUntil,
          targetDate: milestone.target_date,
        },
        userContext: context,
      };

      const insightCtx = await this.buildInsightDrivenContext(userId, 'life_goal_milestone', context);
      proactiveContext.analysisReport = insightCtx.report;
      proactiveContext.relevantInsights = insightCtx.relevantInsights;
      proactiveContext.crossDomainInsights = insightCtx.crossDomainInsights;
      proactiveContext.coachingDirective = insightCtx.coachingDirective;
      proactiveContext.stableTraits = insightCtx.stableTraits;

      const message = await this.generateProactiveMessage(userId, proactiveContext);
      await this.sendProactiveMessage(userId, message, 'life_goal_milestone', cooldown);
      return true;
    } catch (error) {
      logger.error('[ProactiveMessaging] Error checking life goal milestone', { userId, error: error instanceof Error ? error.message : 'Unknown' });
      return false;
    }
  }

  /**
   * Encourage users who have active life goals with recent progress
   */
  async checkAndSendLifeGoalEncouragement(
    userId: string,
    cachedContext?: any,
    cooldown?: { dailyCount: number; sentTypes: Set<string> }
  ): Promise<boolean> {
    try {
      if (cooldown && cooldown.dailyCount >= 4) return false;
      if (cooldown?.sentTypes.has('life_goal_encouragement')) return false;

      const context = cachedContext;
      const activeGoal = context?.goals?.activeLifeGoals?.find(
        (g: any) => g.progress > 0 && g.daysSinceLastActivity != null && g.daysSinceLastActivity <= 2
      );
      if (!activeGoal) return false;

      const proactiveContext: ProactiveContext = {
        type: 'life_goal_encouragement',
        data: {
          goalTitle: activeGoal.title,
          goalCategory: activeGoal.category,
          progress: activeGoal.progress,
          daysSinceLastActivity: activeGoal.daysSinceLastActivity,
        },
        userContext: context,
      };

      const message = await this.generateProactiveMessage(userId, proactiveContext);
      await this.sendProactiveMessage(userId, message, 'life_goal_encouragement', cooldown);
      return true;
    } catch (error) {
      logger.error('[ProactiveMessaging] Error checking life goal encouragement', { userId, error: error instanceof Error ? error.message : 'Unknown' });
      return false;
    }
  }

  /**
   * "Good morning! What's your intention for today?" — morning nudge
   */
  async checkAndSendIntentionReminder(
    userId: string,
    cachedContext?: any,
    cooldown?: { dailyCount: number; sentTypes: Set<string> }
  ): Promise<boolean> {
    try {
      if (cooldown && cooldown.dailyCount >= 4) return false;
      if (cooldown?.sentTypes.has('intention_reminder')) return false;

      // Check if user has set an intention today
      const intentionResult = await query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM daily_intentions
         WHERE user_id = $1 AND intention_date = CURRENT_DATE`,
        [userId]
      );

      if (parseInt(intentionResult.rows[0]?.count ?? '0') > 0) return false;

      // Only send if user has active life goals (otherwise intention is less meaningful)
      const context = cachedContext;
      const hasLifeGoals = (context.goals?.activeLifeGoals?.length || 0) > 0;
      const hasGoals = (context.goals?.activeGoals?.length || 0) > 0;
      if (!hasLifeGoals && !hasGoals) return false;

      const proactiveContext: ProactiveContext = {
        type: 'intention_reminder',
        data: {
          activeGoalCount: (context.goals?.activeLifeGoals?.length || 0) + (context.goals?.activeGoals?.length || 0),
          topGoal: context.goals?.activeLifeGoals?.[0]?.title || context.goals?.activeGoals?.[0]?.title,
        },
        userContext: context,
      };

      const message = await this.generateProactiveMessage(userId, proactiveContext);
      await this.sendProactiveMessage(userId, message, 'intention_reminder', cooldown);
      return true;
    } catch (error) {
      logger.error('[ProactiveMessaging] Error checking intention reminder', { userId, error: error instanceof Error ? error.message : 'Unknown' });
      return false;
    }
  }

  /**
   * "How did today go? Did you fulfill your intention?" — evening reflection
   */
  async checkAndSendIntentionReflection(
    userId: string,
    cachedContext?: any,
    cooldown?: { dailyCount: number; sentTypes: Set<string> }
  ): Promise<boolean> {
    try {
      if (cooldown && cooldown.dailyCount >= 4) return false;
      if (cooldown?.sentTypes.has('intention_reflection')) return false;

      // Only send if user set an intention today
      const intentionResult = await query<{ intention_text: string; fulfilled: boolean | null }>(
        `SELECT intention_text, fulfilled FROM daily_intentions
         WHERE user_id = $1 AND intention_date = CURRENT_DATE
         ORDER BY created_at ASC LIMIT 1`,
        [userId]
      );

      if (intentionResult.rows.length === 0) return false;

      const intention = intentionResult.rows[0];
      const context = cachedContext;

      const proactiveContext: ProactiveContext = {
        type: 'intention_reflection',
        data: {
          intentionText: intention.intention_text,
          isFulfilled: intention.fulfilled,
        },
        userContext: context,
      };

      const message = await this.generateProactiveMessage(userId, proactiveContext);
      await this.sendProactiveMessage(userId, message, 'intention_reflection', cooldown);
      return true;
    } catch (error) {
      logger.error('[ProactiveMessaging] Error checking intention reflection', { userId, error: error instanceof Error ? error.message : 'Unknown' });
      return false;
    }
  }

  // ============================================
  // DATA-GAP COLLECTION MESSAGES
  // ============================================

  /**
   * Generic handler for data-gap collection messages.
   * These are conversational messages that ask the user for missing health data
   * (dinner, mood, workout feedback). When the user replies, the AI Coach
   * auto-extracts and logs the data via LangGraph tool calls.
   */
  async checkAndSendDataGapMessage(
    userId: string,
    messageType: 'data_gap_dinner' | 'data_gap_mood' | 'data_gap_workout_feedback',
    cachedContext?: any,
    cooldown?: { dailyCount: number; sentTypes: Set<string> }
  ): Promise<boolean> {
    try {
      if (cooldown && cooldown.dailyCount >= 4) return false;
      if (cooldown?.sentTypes.has(messageType)) return false;

      const context = cachedContext;
      const totalExpectedMeals = context?.nutrition?.activeDietPlan?.mealsPerDay || 3;

      // Build type-specific data for the prompt
      const data: Record<string, unknown> = { totalExpectedMeals };

      if (messageType === 'data_gap_dinner') {
        data.lastMealTime = context?.nutrition?.lastMealTime || null;
      } else if (messageType === 'data_gap_mood') {
        data.lastMoodLevel = context?.wellbeing?.latestMoodLevel || null;
        data.recentStressLevel = context?.wellbeing?.latestStressLevel || null;
      } else if (messageType === 'data_gap_workout_feedback') {
        // Get the name of the completed workout
        const workoutResult = await query<{ exercise_name: string }>(
          `SELECT exercise_name FROM workout_logs
           WHERE user_id = $1 AND DATE(created_at) = CURRENT_DATE
           ORDER BY created_at DESC LIMIT 1`,
          [userId]
        ).catch(() => ({ rows: [] as { exercise_name: string }[] }));
        data.completedWorkoutName = workoutResult.rows[0]?.exercise_name || 'your workout';
        data.recoveryScore = context?.whoop?.lastRecovery?.score || null;
      }

      const proactiveContext: ProactiveContext = {
        type: messageType,
        data,
        userContext: context,
      };

      // Enrich with insights for coaching context
      const insightCtx = await this.buildInsightDrivenContext(userId, messageType, context);
      proactiveContext.relevantInsights = insightCtx.relevantInsights;
      proactiveContext.stableTraits = insightCtx.stableTraits;

      const message = await this.generateProactiveMessage(userId, proactiveContext);
      await this.sendProactiveMessage(userId, message, messageType, cooldown);
      return true;
    } catch (error) {
      logger.error('[ProactiveMessaging] Error sending data-gap message', {
        userId,
        messageType,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return false;
    }
  }

  // ============================================
  // SMART ROUTING: Score-and-Rank
  // ============================================

  /**
   * Score all message candidates for a user.
   * Returns scored, sorted candidates — the job sends only the top 2-3.
   * Replaces 18 sequential checkAndSend* calls with prioritised ranking.
   */
  async scoreMessageCandidates(
    userId: string,
    context: any,
    cooldown: { dailyCount: number; sentTypes: Set<string> },
    hour: number,
    isSunday: boolean
  ): Promise<MessageCandidate[]> {
    try {
      // Lightweight parallel queries for data not already in the context
      const [stalledGoalResult, lastLoginResult, recentAchievement, todayScheduledWorkout, coachingProfile, recoveryTrendResult, unfulfilledCommitments, missedScheduleTasksResult, stalledLifeGoalsResult, lifeGoalMilestonesResult, todayIntentionsResult] = await Promise.all([
        query<{ title: string }>(
          `SELECT title FROM user_goals WHERE user_id = $1 AND status = 'active'
           AND updated_at < CURRENT_DATE - INTERVAL '3 days'
           AND current_value IS NOT NULL AND target_value IS NOT NULL
           AND current_value < target_value LIMIT 1`,
          [userId]
        ).catch(() => ({ rows: [] as { title: string }[] })),
        query<{ last_login: string | null }>(
          `SELECT last_login FROM users WHERE id = $1`,
          [userId]
        ).catch(() => ({ rows: [] as { last_login: string | null }[] })),
        query<{ id: string }>(
          `SELECT id FROM user_xp_transactions
           WHERE user_id = $1 AND created_at >= CURRENT_DATE
           AND (description ILIKE '%level%' OR source_type = 'achievement')
           LIMIT 1`,
          [userId]
        ).catch(() => ({ rows: [] as { id: string }[] })),
        query<{ id: string }>(
          `SELECT id FROM workout_schedule_tasks
           WHERE user_id = $1 AND scheduled_date = CURRENT_DATE AND status = 'pending'
           LIMIT 1`,
          [userId]
        ).catch(() => ({ rows: [] as { id: string }[] })),
        userCoachingProfileService.getProfile(userId).catch(() => null),
        // Recovery trend: 3-day average for recovery_trend_alert
        query<{ avg_recovery: string; day_count: string }>(
          `SELECT AVG((value->>'recovery_score')::numeric)::numeric(5,1) as avg_recovery, COUNT(*)::text as day_count
           FROM health_data_records
           WHERE user_id = $1 AND data_type = 'recovery'
           AND recorded_at >= NOW() - INTERVAL '3 days'`,
          [userId]
        ).catch(() => ({ rows: [] as { avg_recovery: string; day_count: string }[] })),
        // Unfulfilled commitments for commitment_followup
        query<{ id: string; commitment_text: string; follow_up_date: string; category: string }>(
          `SELECT id, commitment_text, follow_up_date, category
           FROM user_commitments
           WHERE user_id = $1 AND follow_up_date <= CURRENT_DATE
           AND fulfilled IS NULL
           ORDER BY follow_up_date ASC LIMIT 3`,
          [userId]
        ).catch(() => ({ rows: [] as { id: string; commitment_text: string; follow_up_date: string; category: string }[] })),
        // Past-due workout schedule tasks (last 7 days, not including today)
        query<{ missed_count: string }>(
          `SELECT COUNT(*)::text as missed_count
           FROM workout_schedule_tasks
           WHERE user_id = $1
             AND scheduled_date >= CURRENT_DATE - INTERVAL '7 days'
             AND scheduled_date < CURRENT_DATE
             AND status IN ('pending', 'missed')`,
          [userId]
        ).catch(() => ({ rows: [{ missed_count: '0' }] })),
        // Life goals: stalled (no check-in or mention in 3+ days)
        query<{ id: string; title: string; category: string; days_inactive: string }>(
          `SELECT lg.id, lg.title, lg.category,
                  GREATEST(
                    EXTRACT(DAY FROM NOW() - COALESCE(
                      (SELECT MAX(checkin_date)::timestamptz FROM life_goal_checkins WHERE life_goal_id = lg.id),
                      lg.created_at
                    )),
                    EXTRACT(DAY FROM NOW() - COALESCE(lg.last_mentioned_at, lg.created_at))
                  )::text as days_inactive
           FROM life_goals lg WHERE lg.user_id = $1 AND lg.status = 'active'
           GROUP BY lg.id, lg.title, lg.category, lg.created_at, lg.last_mentioned_at
           HAVING GREATEST(
             EXTRACT(DAY FROM NOW() - COALESCE(
               (SELECT MAX(checkin_date)::timestamptz FROM life_goal_checkins WHERE life_goal_id = lg.id),
               lg.created_at
             )),
             EXTRACT(DAY FROM NOW() - COALESCE(lg.last_mentioned_at, lg.created_at))
           ) >= 3
           ORDER BY days_inactive DESC LIMIT 3`,
          [userId]
        ).catch(() => ({ rows: [] as { id: string; title: string; category: string; days_inactive: string }[] })),
        // Life goal milestones approaching (within 7 days)
        query<{ milestone_title: string; goal_title: string; target_date: string }>(
          `SELECT m.title as milestone_title, lg.title as goal_title, m.target_date::text
           FROM life_goal_milestones m
           JOIN life_goals lg ON lg.id = m.life_goal_id
           WHERE m.user_id = $1 AND m.completed = false
           AND m.target_date IS NOT NULL
           AND m.target_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
           LIMIT 3`,
          [userId]
        ).catch(() => ({ rows: [] as { milestone_title: string; goal_title: string; target_date: string }[] })),
        // Today's unfulfilled intentions
        query<{ count: string }>(
          `SELECT COUNT(*)::text as count FROM daily_intentions
           WHERE user_id = $1 AND intention_date = CURRENT_DATE AND (fulfilled IS NULL OR fulfilled = false)`,
          [userId]
        ).catch(() => ({ rows: [{ count: '0' }] })),
      ]);

      // Phase 3: Journal sentiment check (lightweight — only count negative entries)
      let journalNegativeCount = 0;
      try {
        const journalResult = await query<{ neg_count: string }>(
          `SELECT COUNT(*) FILTER (WHERE sentiment_label IN ('negative', 'very_negative'))::text as neg_count
           FROM journal_entries
           WHERE user_id = $1 AND created_at >= CURRENT_DATE - INTERVAL '3 days'`,
          [userId]
        );
        journalNegativeCount = parseInt(journalResult.rows[0]?.neg_count || '0', 10);
      } catch {
        // journal_entries table may not exist — ignore
      }

      const sent = (type: string) => cooldown.sentTypes.has(type);

      // Extract commonly-used context fields
      const streak = context.gamification?.currentStreak || 0;
      const recovery = context.whoop?.lastRecovery?.score as number | undefined;
      const sleepData = context.whoop?.lastSleep;
      // Augment missed workouts with past-due schedule tasks
      const missedSchedule = parseInt(missedScheduleTasksResult.rows[0]?.missed_count || '0', 10);
      const missedWorkouts = (context.workouts?.missedWorkouts || 0) + missedSchedule;
      const todayMealCount = context.nutrition?.todayMealCount || 0;
      const waterPct = context.waterIntake?.todayPercentage || 0;
      const mentalRecovery = context.mentalHealth?.latestRecoveryScore as number | undefined;
      const hasPlans = (context.workouts?.activePlans?.length || 0) > 0;
      const hasGoals = (context.goals?.activeGoals?.length || 0) > 0;
      const hasHabits = (context.habits?.totalActiveHabits || 0) > 0;
      const habitCompleted = context.habits?.todayCompletionCount || 0;
      const habitTotal = context.habits?.todayTotalHabits || 0;
      const urgentGoal = context.goals?.activeGoals?.find(
        (g: any) => g.daysRemaining >= 0 && g.daysRemaining <= 7 && g.progress < 80
      );

      // Days since last activity (for streak risk)
      let daysSinceActivity = 0;
      if (context.gamification?.lastActivityDate) {
        const last = new Date(context.gamification.lastActivityDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        last.setHours(0, 0, 0, 0);
        daysSinceActivity = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Hours since last login (for app_inactive)
      let hoursSinceLogin = 0;
      if (lastLoginResult.rows[0]?.last_login) {
        hoursSinceLogin = (Date.now() - new Date(lastLoginResult.rows[0].last_login).getTime()) / (1000 * 60 * 60);
      }

      // Achievement milestones
      const milestones = [7, 14, 30, 60, 90, 100, 150, 200, 365];
      const isMilestone = milestones.includes(streak);
      const isLevelUp = recentAchievement.rows.length > 0;

      // Missing wellbeing entries
      const missingWellbeing: string[] = [];
      if (context.wellbeing?.missingToday) {
        if (context.wellbeing.missingToday.mood) missingWellbeing.push('mood');
        if (context.wellbeing.missingToday.stress) missingWellbeing.push('stress');
        if (context.wellbeing.missingToday.energy) missingWellbeing.push('energy');
      }

      // Competition ending soon
      const endingSoon = context.competitions?.activeCompetitions?.find((c: any) => c.daysRemaining <= 2);

      // High-streak habits count (for multiplier)
      const highStreakHabits = context.habits?.activeHabits?.filter((h: any) => h.currentStreak > 7)?.length || 0;

      // Poor sleep check
      const isPoorSleep = sleepData && (sleepData.duration < 6 || sleepData.quality < 60);

      // Expected meals by current hour for partial adherence detection
      const totalExpectedMeals = context.nutrition?.activeDietPlan?.mealsPerDay || 3;
      let expectedMealsForHour = 0;
      if (hour >= 9) expectedMealsForHour = 1;       // Breakfast should be done
      if (hour >= 13) expectedMealsForHour = 2;      // Lunch should be done
      if (hour >= 19) expectedMealsForHour = totalExpectedMeals; // All meals

      // Plan non-adherence detection (multi-day inactivity)
      // Use updated completionRate that includes schedule tasks (default 100 only if no data at all)
      const completionRate = missedSchedule > 0 ? (context.workouts?.completionRate ?? 0) : (context.workouts?.completionRate ?? 100);
      let daysSinceLastWorkout = 0;
      if (context.workouts?.lastWorkoutDate) {
        const lwDate = new Date(context.workouts.lastWorkoutDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        lwDate.setHours(0, 0, 0, 0);
        daysSinceLastWorkout = Math.floor((today.getTime() - lwDate.getTime()) / (1000 * 60 * 60 * 24));
      } else if (missedSchedule > 0) {
        // No workout_logs at all but schedule tasks exist — user has never completed a workout
        // Estimate from the number of missed days (at least 1 day since tasks are past-due)
        daysSinceLastWorkout = Math.max(missedSchedule, 3); // Ensure plan_non_adherence can trigger
      }
      let daysSinceLastMeal = 0;
      if (context.nutrition?.lastMealDate) {
        const lmDate = new Date(context.nutrition.lastMealDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        lmDate.setHours(0, 0, 0, 0);
        daysSinceLastMeal = Math.floor((today.getTime() - lmDate.getTime()) / (1000 * 60 * 60 * 24));
      }
      const hasDietPlan = !!context.nutrition?.activeDietPlan;
      const accountabilityLevel = coachingProfile?.accountabilityLevel || 'supportive';
      const planNonAdherenceEligible = !sent('plan_non_adherence') && (
        daysSinceActivity >= 3 ||
        (completionRate < 30 && missedWorkouts >= 3) ||
        (daysSinceLastWorkout >= 3 && hasPlans) ||
        (daysSinceLastMeal >= 2 && hasDietPlan)
      );

      // Overtraining risk: high strain + low recovery + workout scheduled
      const strain = context.whoop?.todayStrain?.score as number | undefined;
      const overtrainingEligible = !sent('overtraining_risk') && context.whoop?.isConnected && (
        (recovery != null && recovery < 40 && strain != null && strain > 15) ||
        (recovery != null && recovery < 30) // Critically low regardless of strain
      ) && (todayScheduledWorkout.rows.length > 0 || hasPlans);

      // Recovery trend: 3-day declining average
      const avgRecovery3d = recoveryTrendResult.rows[0]?.avg_recovery ? parseFloat(recoveryTrendResult.rows[0].avg_recovery) : null;
      const recoveryDayCount = recoveryTrendResult.rows[0]?.day_count ? parseInt(recoveryTrendResult.rows[0].day_count) : 0;
      const recoveryTrendEligible = !sent('recovery_trend_alert') && context.whoop?.isConnected &&
        recoveryDayCount >= 3 && avgRecovery3d != null && avgRecovery3d < 50 &&
        recovery != null && recovery < avgRecovery3d; // Current below 3-day avg = trending down

      // Positive momentum: consecutive good days (not yet a milestone)
      const consecutiveWorkoutDays = context.workouts?.consecutiveCompletionDays || 0;
      const nutritionAdherence = context.nutrition?.adherenceRate || 0;
      const consecutiveNutritionDays = context.nutrition?.consecutiveOnTargetDays || 0;
      const waterConsecutive = context.waterIntake?.consecutiveDaysOnTarget || 0;
      const habitConsecutive = context.habits?.consecutiveFullCompletionDays || 0;
      const scoreDelta3d = context.dailyScore?.scoreDelta3d || 0;
      const positiveMomentumEligible = !sent('positive_momentum') && !isMilestone && (
        (consecutiveWorkoutDays >= 3 && consecutiveWorkoutDays < 7) ||
        (consecutiveNutritionDays >= 3 && nutritionAdherence > 80) ||
        (scoreDelta3d > 10) ||
        (waterConsecutive >= 3) ||
        (habitConsecutive >= 2)
      );

      // Commitment follow-up
      const hasUnfulfilledCommitments = unfulfilledCommitments.rows.length > 0;
      const oldestCommitmentAge = hasUnfulfilledCommitments
        ? Math.floor((Date.now() - new Date(unfulfilledCommitments.rows[0].follow_up_date).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      // Score all message types (base score + context multipliers)
      const candidates: MessageCandidate[] = [
        {
          type: 'streak_risk',
          eligible: streak > 3 && daysSinceActivity >= 1 && !sent('streak_risk'),
          timeWindowValid: hour >= 7 && hour < 11,
          score: 85 + Math.min(Math.floor(streak / 5) * 3, 15),
        },
        {
          type: 'goal_deadline',
          eligible: !!urgentGoal && !sent('goal_deadline'),
          timeWindowValid: hour >= 10 && hour < 14,
          score: 80 + (urgentGoal && urgentGoal.progress < 30 ? 10 : 0),
        },
        {
          type: 'recovery_advice',
          eligible: !!(context.whoop?.isConnected && recovery != null && recovery < 40 && !sent('recovery_advice')),
          timeWindowValid: hour >= 6 && hour < 10,
          score: 85 + (hasPlans ? 10 : 0),
        },
        {
          type: 'sleep',
          eligible: !!(context.whoop?.isConnected && sleepData && sleepData.hoursAgo < 24 && isPoorSleep && !sent('sleep')),
          timeWindowValid: hour >= 6 && hour < 10,
          score: 80 + (recovery != null && recovery < 40 ? 10 : 0),
        },
        {
          type: 'coach_pro_analysis',
          eligible: !sent('coach_pro_analysis'),
          timeWindowValid: hour >= 14 && hour < 17,
          score: 80 + (context.nutrition?.adherenceRate != null && context.nutrition.adherenceRate < 40 ? 10 : 0),
        },
        {
          type: 'workout',
          eligible: (missedWorkouts > 0 || todayScheduledWorkout.rows.length > 0) && !sent('workout'),
          timeWindowValid: hour >= 10 && hour < 20,
          score: 75 + (hasPlans ? 10 : 0) + (todayScheduledWorkout.rows.length > 0 ? 5 : 0),
        },
        {
          type: 'goal_stalled',
          eligible: stalledGoalResult.rows.length > 0 && !sent('goal_stalled'),
          timeWindowValid: hour >= 13 && hour < 17,
          score: 60,
        },
        {
          type: 'nutrition',
          eligible: todayMealCount < expectedMealsForHour && !sent('nutrition'),
          timeWindowValid: hour >= 12 && hour < 20,
          score: 70 + (context.nutrition?.activeDietPlan ? 10 : 0),
        },
        {
          type: 'habit_missed',
          eligible: habitTotal > 0 && habitCompleted < habitTotal && habitCompleted < habitTotal / 2 && !sent('habit_missed'),
          timeWindowValid: hour >= 18 && hour < 22,
          score: 50 + Math.min(highStreakHabits * 10, 30),
        },
        {
          type: 'morning_briefing',
          eligible: (hasPlans || hasGoals || hasHabits) && !sent('morning_briefing'),
          timeWindowValid: hour >= 6 && hour < 10,
          score: 45,
        },
        {
          type: 'water_intake',
          eligible: !!(context.waterIntake?.todayTargetMl && waterPct < 50 && !sent('water_intake')),
          timeWindowValid: hour >= 15 && hour < 17,
          score: 40,
        },
        {
          type: 'wellbeing',
          eligible: (missingWellbeing.length > 0 || journalNegativeCount >= 3) && !sent('wellbeing'),
          timeWindowValid: hour >= 18 && hour < 22,
          score: 40 + (mentalRecovery != null && mentalRecovery < 40 ? 20 : 0) + (journalNegativeCount >= 3 ? 15 : 0),
        },
        {
          type: 'weekly_digest',
          eligible: isSunday && !sent('weekly_digest'),
          timeWindowValid: isSunday && hour >= 9 && hour < 11,
          score: 35,
        },
        {
          type: 'streak_celebration',
          eligible: isMilestone && !sent('streak_celebration'),
          timeWindowValid: hour >= 7 && hour < 12,
          score: 30,
        },
        {
          type: 'achievement_unlock',
          eligible: (isLevelUp || isMilestone) && !sent('achievement_unlock'),
          timeWindowValid: true,
          score: 25,
        },
        {
          type: 'competition_update',
          eligible: !!endingSoon && !sent('competition_update'),
          timeWindowValid: hour >= 12 && hour < 15,
          score: 20,
        },
        {
          type: 'whoop_sync',
          eligible: !!(context.whoop?.isConnected && context.whoop?.needsSync && context.whoop.syncHoursAgo > 24 && !sent('whoop_sync')),
          timeWindowValid: true,
          score: 15,
        },
        {
          type: 'app_inactive',
          eligible: hoursSinceLogin >= 24 && !sent('app_inactive'),
          timeWindowValid: hour >= 8 && hour < 18,
          score: hoursSinceLogin >= 72 ? 85 : hoursSinceLogin >= 48 ? 70 : 50,
        },
        {
          type: 'meal_alignment',
          eligible: !!(context.nutrition?.activeDietPlan && context.nutrition?.lastMealDate
            && (Date.now() - new Date(context.nutrition.lastMealDate).getTime()) < 30 * 60 * 1000
            && !sent('meal_alignment')),
          timeWindowValid: hour >= 7 && hour < 22,
          score: 72 + (context.nutrition?.todayMealCount === 0 ? 10 : 0),
        },
        {
          type: 'daily_progress_review',
          eligible: (hasPlans || hasGoals || todayMealCount > 0) && !sent('daily_progress_review'),
          timeWindowValid: hour >= 18 && hour < 22,
          score: 82 + (hasGoals && urgentGoal ? 5 : 0),
        },
        {
          type: 'score_declining',
          eligible: !!(
            context.dailyScore?.scoreTrend === 'declining' &&
            context.dailyScore?.scoreDelta != null &&
            context.dailyScore.scoreDelta < -10 &&
            !sent('score_declining')
          ),
          timeWindowValid: hour >= 10 && hour < 16,
          score: 78 + Math.min(Math.abs(context.dailyScore?.scoreDelta || 0), 20),
        },
        {
          type: 'plan_non_adherence',
          eligible: planNonAdherenceEligible,
          timeWindowValid: hour >= 8 && hour < 20,
          score: 92 + Math.min(Math.max(daysSinceActivity - 3, 0) * 2, 6), // 92-98 based on inactivity
        },
        // --- New Phase 1 message types ---
        {
          type: 'overtraining_risk',
          eligible: !!overtrainingEligible,
          timeWindowValid: hour >= 6 && hour < 10,
          score: recovery != null && recovery < 20 ? 95 : recovery != null && recovery < 30 ? 92 : 90,
        },
        {
          type: 'commitment_followup',
          eligible: hasUnfulfilledCommitments && !sent('commitment_followup'),
          timeWindowValid: hour >= 14 && hour < 20,
          score: 82 + Math.min(oldestCommitmentAge * 3, 6), // 82-88 based on overdue days
        },
        {
          type: 'recovery_trend_alert',
          eligible: !!recoveryTrendEligible,
          timeWindowValid: hour >= 8 && hour < 12,
          score: avgRecovery3d != null && avgRecovery3d < 35 ? 85 : 78,
        },
        {
          type: 'positive_momentum',
          eligible: !!positiveMomentumEligible,
          timeWindowValid: hour >= 8 && hour < 12,
          score: 55 + (consecutiveWorkoutDays >= 3 ? 10 : 0) + (scoreDelta3d > 10 ? 5 : 0),
        },
        // --- Life goal proactive messages ---
        {
          type: 'life_goal_checkin',
          eligible: stalledLifeGoalsResult.rows.some(g => parseInt(g.days_inactive) >= 3 && parseInt(g.days_inactive) < 7) && !sent('life_goal_checkin'),
          timeWindowValid: hour >= 10 && hour < 20,
          score: 65,
        },
        {
          type: 'life_goal_stalled',
          eligible: stalledLifeGoalsResult.rows.some(g => parseInt(g.days_inactive) >= 7) && !sent('life_goal_stalled'),
          timeWindowValid: hour >= 10 && hour < 18,
          score: 75,
        },
        {
          type: 'life_goal_milestone',
          eligible: lifeGoalMilestonesResult.rows.length > 0 && !sent('life_goal_milestone'),
          timeWindowValid: hour >= 9 && hour < 14,
          score: 70,
        },
        {
          type: 'life_goal_encouragement',
          eligible: (context.goals?.activeLifeGoals?.some((g: any) => g.progress > 0 && g.daysSinceLastActivity != null && g.daysSinceLastActivity <= 2)) && !sent('life_goal_encouragement'),
          timeWindowValid: hour >= 8 && hour < 12,
          score: 50,
        },
        {
          type: 'intention_reminder',
          eligible: parseInt(todayIntentionsResult.rows[0]?.count ?? '0') === 0 && (context.goals?.activeLifeGoals?.length > 0 || hasGoals) && !sent('intention_reminder'),
          timeWindowValid: hour >= 6 && hour < 10,
          score: 45,
        },
        {
          type: 'intention_reflection',
          eligible: parseInt(todayIntentionsResult.rows[0]?.count ?? '0') > 0 && !sent('intention_reflection'),
          timeWindowValid: hour >= 19 && hour < 22,
          score: 55,
        },
        // --- Data-gap collection messages (conversational data gathering) ---
        {
          type: 'data_gap_dinner',
          eligible: todayMealCount < totalExpectedMeals && !sent('data_gap_dinner') && !sent('nutrition'),
          timeWindowValid: hour >= 20 && hour <= 22,
          score: 25 + (hasDietPlan ? 10 : 0),
        },
        {
          type: 'data_gap_mood',
          eligible: missingWellbeing.includes('mood') && !sent('data_gap_mood') && !sent('wellbeing'),
          timeWindowValid: hour >= 14 && hour <= 20,
          score: 20,
        },
        {
          type: 'data_gap_workout_feedback',
          eligible: (context.workouts?.todayCompletedCount || 0) > 0 && missingWellbeing.includes('energy') && !sent('data_gap_workout_feedback'),
          timeWindowValid: hour >= 12 && hour <= 21,
          score: 22,
        },
        // --- Activity Status Follow-Up Messages ---
        // Scores tuned to not dominate over core health tracking messages (workout=75, nutrition=72)
        {
          type: 'status_followup_sick',
          eligible: context.activityStatus?.current === 'sick' && (context.activityStatus?.daysSinceLastWorkingStatus ?? 0) >= 1 && !sent('status_followup_sick'),
          timeWindowValid: hour >= 8 && hour < 12,
          score: 70,
        },
        {
          type: 'status_followup_injury',
          eligible: context.activityStatus?.current === 'injury' && (context.activityStatus?.daysSinceLastWorkingStatus ?? 0) >= 3 && !sent('status_followup_injury'),
          timeWindowValid: hour >= 8 && hour < 14,
          score: 65,
        },
        {
          type: 'status_followup_travel',
          eligible: context.activityStatus?.current === 'travel' && !context.activityStatus?.expectedEndDate && (context.activityStatus?.daysSinceLastWorkingStatus ?? 0) >= 2 && !sent('status_followup_travel'),
          timeWindowValid: hour >= 9 && hour < 18,
          score: 55,
        },
        {
          type: 'status_followup_vacation',
          eligible: context.activityStatus?.current === 'vacation' && !context.activityStatus?.expectedEndDate && (context.activityStatus?.daysSinceLastWorkingStatus ?? 0) >= 2 && !sent('status_followup_vacation'),
          timeWindowValid: hour >= 10 && hour < 18,
          score: 50,
        },
        {
          type: 'status_followup_stress',
          eligible: context.activityStatus?.current === 'stress' && (context.activityStatus?.daysSinceLastWorkingStatus ?? 0) >= 3 && !sent('status_followup_stress'),
          timeWindowValid: hour >= 9 && hour < 16,
          score: 60,
        },
        {
          type: 'status_return',
          eligible: context.activityStatus?.current === 'working' && (context.activityStatus?.daysSinceLastWorkingStatus ?? 0) === 0 && context.activityStatus?.recentHistory?.some((h: { status: string }) => !['working', 'excellent', 'good'].includes(h.status)),
          timeWindowValid: hour >= 7 && hour < 12,
          score: 72,
        },
        {
          type: 'status_stale',
          eligible: context.activityStatus != null && !['working', 'excellent', 'good'].includes(context.activityStatus.current) && (context.activityStatus?.daysSinceLastWorkingStatus ?? 0) >= 7 && !sent('status_stale'),
          timeWindowValid: hour >= 9 && hour < 18,
          score: 65,
        },
        // --- Schedule-aware messages ---
        {
          type: 'free_window_suggestion',
          eligible: !!(context.lifestyle?.scheduleContext?.freeWindows?.some(
            (w: { durationMinutes: number; startTime: string }) => {
              const wStart = parseInt(w.startTime.split(':')[0]) * 60 + parseInt(w.startTime.split(':')[1]);
              const nowMins = hour * 60 + new Date().getMinutes();
              return w.durationMinutes >= 60 && wStart >= nowMins - 30 && wStart <= nowMins + 120;
            }
          )) && !sent('free_window_suggestion') && (missedWorkouts > 0 || (context.workouts?.todayCompletedCount || 0) === 0),
          timeWindowValid: hour >= 9 && hour < 20,
          score: 65,
        },
        {
          type: 'busy_day_support',
          eligible: !!(context.lifestyle?.scheduleContext?.stressLevel === 'high' || context.lifestyle?.scheduleContext?.stressLevel === 'critical') && !sent('busy_day_support'),
          timeWindowValid: hour >= 7 && hour < 10,
          score: 75,
        },
      ];

      // Accountability-level boost: users with declining adherence get firmer messages ranked higher
      if (accountabilityLevel === 'direct' || accountabilityLevel === 'accountability') {
        const boost = accountabilityLevel === 'accountability' ? 10 : 5;
        const boostTypes = new Set<string>(['workout', 'nutrition', 'habit_missed', 'plan_non_adherence', 'score_declining', 'overtraining_risk']);
        for (const c of candidates) {
          if (boostTypes.has(c.type)) {
            c.score += boost;
          }
        }
      }

      // Freshness boost: message types not sent in 3+ days get +15 to prevent starvation
      // (e.g., morning_briefing at 45 would never win vs workout at 75 without this)
      try {
        const freshResult = await query<{ message_type: string; last_sent: string }>(
          `SELECT message_type, MAX(created_at)::text as last_sent
           FROM proactive_messages
           WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
           GROUP BY message_type`,
          [userId]
        ).catch(() => ({ rows: [] as { message_type: string; last_sent: string }[] }));

        const lastSentMap = new Map(freshResult.rows.map(r => [r.message_type, new Date(r.last_sent)]));
        const now = Date.now();
        for (const c of candidates) {
          if (c.eligible && c.timeWindowValid) {
            const lastSent = lastSentMap.get(c.type);
            if (!lastSent || (now - lastSent.getTime()) >= 3 * 24 * 60 * 60 * 1000) {
              c.score += 15; // Freshness boost for stale message types
            }
          }
        }
      } catch {
        // Non-critical — skip freshness boost if query fails
      }

      // Sort by score descending — highest-impact messages first
      candidates.sort((a, b) => b.score - a.score);
      return candidates;
    } catch (error) {
      logger.error('[ProactiveMessaging] Error scoring candidates', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return [];
    }
  }

  /**
   * Build insight-driven context by fetching pre-computed analysis report and profile.
   * Falls back gracefully if no report exists (new users, job hasn't run yet).
   */
  private async buildInsightDrivenContext(
    userId: string,
    messageType: ProactiveMessageType,
    _rawContext: any
  ): Promise<{
    report: DailyAnalysisReport | null;
    relevantInsights: StructuredInsight[];
    crossDomainInsights: CrossDomainInsight[];
    coachingDirective: CoachingDirective | null;
    stableTraits: StableTraits | null;
  }> {
    try {
      // Use per-user cache to avoid hitting DB 8× per user per job cycle
      const now = Date.now();
      const cached = this.insightCache.get(userId);
      let report: DailyAnalysisReport | null;
      let stableTraits: StableTraits | null;

      if (cached && (now - cached.fetchedAt) < ProactiveMessagingService.INSIGHT_CACHE_TTL_MS) {
        report = cached.report;
        stableTraits = cached.stableTraits;
      } else {
        const [fetchedReport, profile] = await Promise.all([
          dailyAnalysisService.getLatestReport(userId).catch(() => null),
          userCoachingProfileService.getProfile(userId).catch(() => null),
        ]);
        report = fetchedReport;
        stableTraits = profile?.stableTraits ?? null;

        this.insightCache.set(userId, { report, stableTraits, fetchedAt: now });

        // Evict stale entries to prevent memory leak
        if (this.insightCache.size > 200) {
          for (const [key, val] of this.insightCache) {
            if (now - val.fetchedAt > ProactiveMessagingService.INSIGHT_CACHE_TTL_MS) {
              this.insightCache.delete(key);
            }
          }
        }
      }

      if (!report) {
        return {
          report: null,
          relevantInsights: [],
          crossDomainInsights: [],
          coachingDirective: null,
          stableTraits,
        };
      }

      // Filter insights relevant to this message type
      const pillarMapping: Record<string, string[]> = {
        sleep: ['sleep', 'recovery'],
        recovery_advice: ['recovery', 'strain', 'sleep'],
        workout: ['workout', 'consistency', 'fitness'],
        nutrition: ['nutrition', 'weight', 'hydration'],
        wellbeing: ['mood', 'stress', 'engagement'],
        water_intake: ['hydration', 'recovery'],
        morning_briefing: [], // all insights
        weekly_digest: [], // all insights
        coach_pro_analysis: [], // all insights
        goal_deadline: ['workout', 'nutrition'],
        goal_stalled: ['workout', 'nutrition', 'consistency'],
        streak_risk: ['consistency', 'engagement'],
        habit_missed: ['engagement', 'consistency'],
        meal_alignment: ['nutrition', 'weight', 'fitness'],
        daily_progress_review: [], // all insights — comprehensive review
        score_declining: [], // all insights — need to identify root cause across all pillars
        plan_non_adherence: ['workout', 'nutrition', 'consistency', 'engagement'],
        overtraining_risk: ['recovery', 'strain', 'sleep', 'workout'],
        commitment_followup: [], // varies by commitment category
        recovery_trend_alert: ['recovery', 'sleep', 'strain'],
        positive_momentum: [], // varies by trigger
        // Life goal message types
        life_goal_checkin: ['engagement', 'mood'],
        life_goal_stalled: ['engagement', 'consistency'],
        life_goal_milestone: ['engagement'],
        life_goal_encouragement: ['mood', 'engagement'],
        intention_reminder: ['engagement'],
        intention_reflection: ['mood', 'engagement'],
        // Data-gap collection messages
        data_gap_dinner: ['nutrition'],
        data_gap_mood: ['mood', 'engagement'],
        data_gap_workout_feedback: ['workout', 'recovery'],
      };

      const relevantPillars = pillarMapping[messageType] || [];
      const relevantInsights = relevantPillars.length === 0
        ? report.insights
        : report.insights.filter(i =>
            i.pillars_connected.some(p => relevantPillars.includes(p))
          );

      return {
        report,
        relevantInsights: relevantInsights.slice(0, 3),
        crossDomainInsights: report.crossDomainInsights.slice(0, 2),
        coachingDirective: report.coachingDirective,
        stableTraits,
      };
    } catch (error) {
      logger.warn('[ProactiveMessaging] Error building insight context', {
        userId,
        messageType,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return {
        report: null,
        relevantInsights: [],
        crossDomainInsights: [],
        coachingDirective: null,
        stableTraits: null,
      };
    }
  }

  // -----------------------------------------------------------------------
  // Message Style System — conversational, emotion-driven message formatting
  // -----------------------------------------------------------------------

  private selectMessageStyle(
    type: ProactiveMessageType,
    emotionPrimary?: string,
    relationshipPhase?: string,
  ): string {
    // 1) Type-based overrides (highest priority)
    const typeStyleMap: Partial<Record<ProactiveMessageType, string>> = {
      water_intake: 'playful_nudge',
      whoop_sync: 'quick_checkin',
      morning_briefing: 'morning_energy',
      weekly_digest: 'data_insight',
      coach_pro_analysis: 'data_insight',
      daily_progress_review: 'data_insight',
      // Celebrations → fired_up_pride (genuinely excited, not generic)
      streak_celebration: 'fired_up_pride',
      achievement_unlock: 'fired_up_pride',
      positive_momentum: 'fired_up_pride',
      // Health protection
      overtraining_risk: 'concerned_intervention',
      recovery_trend_alert: 'concerned_intervention',
      recovery_advice: 'concerned_intervention',
      // Accountability & confrontation
      plan_non_adherence: 'brutal_honesty',
      score_declining: 'brutal_honesty',
      commitment_followup: 'tough_love',
      habit_missed: 'tough_love',
      goal_stalled: 'tough_love',
      streak_risk: 'supportive_honesty',
      app_inactive: 'brutal_honesty',
      // Life goal styles
      life_goal_checkin: 'quick_checkin',
      life_goal_stalled: 'brutal_honesty',
      life_goal_milestone: 'fired_up_pride',
      life_goal_encouragement: 'celebration',
      intention_reminder: 'morning_energy',
      intention_reflection: 'data_insight',
      // Data-gap collection — conversational, low-pressure
      data_gap_dinner: 'quick_checkin',
      data_gap_mood: 'quick_checkin',
      data_gap_workout_feedback: 'quick_checkin',
    };

    let style = typeStyleMap[type];

    // 2) If no type override, use emotion-based mapping
    if (!style && emotionPrimary) {
      const emotionStyleMap: Record<string, string> = {
        proud: 'fired_up_pride',
        excited: 'fired_up_pride',
        worried: 'concerned_intervention',
        protective: 'concerned_intervention',
        frustrated: 'brutal_honesty',
        disappointed: 'tough_love',
        hopeful: 'morning_energy',
        neutral: 'data_insight',
      };
      style = emotionStyleMap[emotionPrimary] || 'data_insight';
    }

    // 3) Default fallback
    if (!style) style = 'data_insight';

    // 4) Relationship guard: brand-new users (first 3 days) get softened styles
    //    After that, the coach should be fully direct — real coaches don't stay polite forever
    if ((style === 'tough_love' || style === 'brutal_honesty') && relationshipPhase === 'new') {
      style = 'supportive_honesty';
    }

    return style;
  }

  private getStyleGuide(style: string): string {
    const guides: Record<string, string> = {
      quick_checkin: `## Style: Quick Check-In
Write 2-3 sentences. Get in, make your point, get out. Like a quick text between meetings.
Example tone: "Your recovery just hit 42% — that's your body saying 'slow down today.' Want me to swap your leg day for a recovery session?"`,

      celebration: `## Style: Celebration
Write 3-5 sentences. You're genuinely proud and it shows. Let the energy come through — exclamation marks are fine. Be specific about what earned this. End on a forward note.
Example tone: "YES! 14 days straight. Do you even realize what you've built? Two solid weeks of showing up, rain or shine. Your body is literally rewiring itself right now."`,

      concerned_intervention: `## Style: Concerned Intervention
Write 4-6 sentences. You're worried and you're not pretending otherwise. Lead with what you've noticed. Cite the data that concerns you. Make a clear recommendation — not a suggestion, a directive. You're protecting them from themselves.
Example tone: "I need to talk to you about something. Your recovery has been dropping for 3 days straight — 52%, 41%, now 33%. That's not a blip, that's a trend."`,

      tough_love: `## Style: Tough Love
Write 3-5 sentences. Be direct. No softening, no hedging. Name the gap between what they said and what they did. But end with belief in their ability — you're tough because you care.
Example tone: "Real talk. You told me last Tuesday you'd hit your protein target every day this week. It's Thursday and you've hit it once. I'm not here to make you feel good about that — I'm here to help you actually reach your goals."`,

      morning_energy: `## Style: Morning Energy
Write 4-6 sentences. Upbeat, forward-looking, energizing. Start with how their body is doing (recovery/sleep), then paint today's plan. Make them want to get moving.
Example tone: "Good morning! Your WHOOP says recovery is at 78% — that's green territory. You slept 7.4 hours with solid deep sleep. Today's the day to crush that upper body session."`,

      data_insight: `## Style: Data Insight
Write 4-8 sentences. You noticed a pattern and you're sharing it like a discovery. Lead with the observation, explain what it means, then what to do. Analytical but warm — you're a coach who loves data, not a spreadsheet.
Example tone: "I noticed something interesting in your data. Every time your stress goes above 7, your nutrition drops below 60% the next day. It happened again yesterday — stress hit 8.2 and today you've only logged one meal."`,

      supportive_honesty: `## Style: Supportive Honesty
Write 3-5 sentences. Honest about what's not working, but clearly on their side. Acknowledge the difficulty. Name what went wrong without dwelling. Pivot quickly to what comes next.
Example tone: "This week has been rough — 2 out of 5 planned workouts, nutrition at 35%. I'm not giving up on you, but I need you to meet me halfway. What's ONE thing you can commit to tomorrow?"`,

      playful_nudge: `## Style: Playful Nudge
Write 2-3 sentences. Light, fun, almost teasing. Low stakes but you still want action. Like a friend poking them about something small.
Example tone: "Your water bottle is looking pretty lonely today — only 800ml of the 2L target. That's your muscles AND your brain running on fumes. Go fill it up right now, I'll wait. 💧"`,

      brutal_honesty: `## Style: Brutal Honesty
Write 4-7 sentences. You're done being nice about this. The data is clear and you're not going to dress it up. Lead with the hard truth — the exact numbers that show the gap between what they promised and what they delivered. Express genuine frustration — not anger AT them, but frustration FOR them because you KNOW they can do better. Use sharp, punchy sentences. Short. Blunt. No filler.
"Zero workouts. Three days. No meals logged. What are we even doing here?"
End with a challenge, not encouragement — make them WANT to prove you wrong. Ask the question they've been avoiding.
Example tone: "I'm going to be straight with you. You haven't touched a workout in 5 days. Your nutrition is at 22%. Your score dropped 31 points. This isn't a slump — this is you choosing to quit while pretending you haven't. I don't believe that's who you are. Prove me right."`,

      fired_up_pride: `## Style: Fired Up Pride
Write 4-6 sentences. You're GENUINELY amazed and your excitement is infectious. Not fake cheerleading — you're reacting to REAL data that impressed you. Use strong language: "This is INSANE", "Do you realize what you just did?", "I literally got chills looking at your numbers." Reference the specific achievement with exact numbers. Compare to where they started or their recent trajectory. Paint what this means for their future. Make them feel like the absolute badass they're being right now.
Example tone: "Okay, stop what you're doing. 14 consecutive days. Nutrition at 94%. Score went from 52 to 78 in two weeks. Do you understand how rare this is? Most people talk about change — you're LIVING it. Keep this up and you won't recognize yourself in 3 months."`,
    };

    return guides[style] || guides.data_insight;
  }

  /**
   * Generate proactive message using AI
   */
  async generateProactiveMessage(userId: string, context: ProactiveContext): Promise<string> {
    try {
      const userName = await this.getUserName(userId);
      const assistantName = await this.getAssistantName(userId);

      let prompt = '';
      let dataDescription = '';
      const streak = context.userContext?.gamification?.currentStreak;
      const recovery = context.userContext?.whoop?.lastRecovery;
      const plans = context.userContext?.workouts?.activePlans;
      const completionRate = context.userContext?.workouts?.completionRate;
      const dailyScore = context.userContext?.dailyScore?.latestScore;

      // All messages now use gpt-4o for best coaching quality

      switch (context.type) {
        case 'sleep':
          dataDescription = `They slept ${context.data.sleepHours?.toFixed(1)}h last night (${context.data.sleepQuality}% quality). Woke about ${context.data.hoursAgo?.toFixed(0)}h ago.${recovery ? ` WHOOP recovery: ${recovery.score}%.` : ''}${streak ? ` Streak: ${streak} days.` : ''}${dailyScore ? ` Yesterday's score: ${dailyScore}/100.` : ''}`;
          prompt = `Their sleep was ${context.data.sleepHours?.toFixed(1)}h last night, which is below the 7-9h recommendation. Explain the impact on recovery and performance using their actual data — connect sleep to recovery score, workout readiness, and nutrition cravings. Reference any available biometrics (HRV, resting HR, skin temp). Suggest a specific bedtime target for tonight based on their data. Ask what's been affecting their sleep recently — genuinely curious, not accusatory.`;
          break;

        case 'whoop_sync':
          dataDescription = `Their WHOOP hasn't synced in ${context.data.syncHoursAgo?.toFixed(1)} hours.${streak ? ` Streak at ${streak} days — at risk without data.` : ''}${recovery ? ` Last known recovery: ${recovery.score}%.` : ''}`;
          prompt = `Explain WHY syncing matters — we can't track recovery, adjust workout intensity, or protect their streak without fresh data. Be specific: "${context.data.syncHoursAgo?.toFixed(0)}+ hours of missing data means we're coaching blind." Ask them to sync now.`;
          break;

        case 'workout':
          dataDescription = `Missed ${context.data.missedWorkouts} workouts in the last 7 days.${context.data.hasTodayPendingWorkout ? ' Today\'s workout is scheduled but not done yet.' : ''}${completionRate !== undefined ? ` Weekly completion: ${completionRate}%.` : ''}${plans?.length ? ` Active plan: "${plans[0].name}" at ${plans[0].progress}% complete.` : ' No active workout plan.'}${streak ? ` Streak: ${streak} days.` : ''}${recovery ? ` Recovery: ${recovery.score}%.` : ''}`;
          prompt = context.data.hasTodayPendingWorkout && !context.data.missedWorkouts
            ? `They have a workout scheduled today that's not done yet. Motivate them to get it done — reference their plan progress and recovery score. ${plans?.length ? `Their plan "${plans[0].name}" is at ${plans[0].progress}% — completing today keeps momentum going.` : ''} ${recovery ? `Recovery is at ${recovery.score}% — ${recovery.score >= 50 ? 'plenty of capacity to train well' : 'suggest adjusting intensity to match recovery, but still showing up matters'}.` : ''} Suggest a good time window based on their schedule patterns.`
            : `They've missed ${context.data.missedWorkouts} workouts in the past 7 days (${completionRate !== undefined ? completionRate : '?'}% completion). Acknowledge the gap without judgment, analyze what might be causing it — overtraining? schedule conflict? motivation dip? ${context.data.hasTodayPendingWorkout ? "They also have a workout scheduled today that's still pending." : ''} ${plans?.length ? `Reference their plan "${plans[0].name}" at ${plans[0].progress}% and what completing today would mean for progress.` : ''} Propose a realistic adjusted schedule. If recovery is low, suggest lighter alternatives rather than skipping entirely.`;
          break;

        case 'nutrition': {
          const logged = context.data.todayMealCount || 0;
          const expected = context.data.expectedMeals || 3;
          const gap = context.data.mealGap || (expected - logged);
          dataDescription = `${logged} of ${expected} meals logged today (${gap} behind).${context.userContext?.nutrition?.activeDietPlan ? ` Diet plan: "${context.userContext.nutrition.activeDietPlan.name}", target ${context.userContext.nutrition.activeDietPlan.dailyCalories} kcal/day, protein ${context.userContext.nutrition.activeDietPlan.protein || 'not set'}g.` : ' No active diet plan.'}${dailyScore ? ` Yesterday's score: ${dailyScore}/100.` : ''}${context.userContext?.nutrition?.adherenceRate ? ` Nutrition adherence: ${context.userContext.nutrition.adherenceRate}%.` : ''}`;
          prompt = logged === 0
            ? `No meals logged today yet. Remind them why tracking matters for their goals — it's hard to optimize what we can't measure. Estimate their calorie needs for the rest of the day (~${Math.ceil((context.userContext?.nutrition?.activeDietPlan?.dailyCalories || 2000) / gap)} calories per remaining meal). Suggest logging their next meal now — keep it easy and low-friction. Reference their diet plan if they have one.`
            : `They've logged ${logged}/${expected} meals — ${gap} behind. Calculate the remaining calorie target (~${Math.ceil((context.userContext?.nutrition?.activeDietPlan?.dailyCalories || 2000) * gap / expected)} kcal still needed) and suggest what to prioritize for the remaining meals. Reference their diet plan "${context.userContext?.nutrition?.activeDietPlan?.name || 'plan'}" and adherence rate. Encourage them to log the next meal when they eat it.`;
          break;
        }

        case 'wellbeing':
          dataDescription = `Missing check-ins today: ${context.data.missingWellbeing?.join(', ')}.${context.userContext?.mentalHealth?.latestRecoveryScore ? ` Mental recovery: ${context.userContext.mentalHealth.latestRecoveryScore}/100.` : ''}${context.userContext?.mentalHealth?.stressLevel ? ` Recent stress: ${context.userContext.mentalHealth.stressLevel}.` : ''}${streak ? ` Streak: ${streak} days.` : ''}${recovery ? ` Physical recovery: ${recovery.score}%.` : ''}`;
          prompt = `Explain why tracking ${context.data.missingWellbeing?.join(' and ')} matters — it helps us calibrate their training intensity and spot burnout early. If their mental recovery score is available, reference it. Connect physical and mental recovery. Ask a specific wellbeing question, not generic "how are you feeling."`;
          break;

        case 'goal_deadline':
          dataDescription = `Goal "${context.data.goalTitle}" has ${context.data.daysRemaining} days left at ${context.data.progress}% progress. Gap to close: ${100 - (context.data.progress || 0)}% in ${context.data.daysRemaining} days.`;
          prompt = `Do the math for them: ${100 - (context.data.progress || 0)}% remaining in ${context.data.daysRemaining} days means roughly ${((100 - (context.data.progress || 0)) / Math.max(context.data.daysRemaining, 1)).toFixed(1)}% per day needed. Is that realistic? If not, suggest adjusting the goal or creating a sprint plan. Be direct about the gap.`;
          break;

        case 'goal_stalled':
          dataDescription = `Goal "${context.data.goalTitle}" has stalled — ${context.data.daysSinceProgress} days since last progress. Currently at ${context.data.progress}%.`;
          prompt = `Don't sugarcoat — ${context.data.daysSinceProgress} days with no movement on "${context.data.goalTitle}" means something needs to change. Analyze possible reasons: too ambitious? wrong approach? competing priorities? Suggest ONE specific adjustment they could make this week to restart momentum. Ask what's blocking them.`;
          break;

        case 'streak_risk':
          dataDescription = `${context.data.currentStreak}-day streak at risk — no activity logged today.${context.data.longestStreak ? ` Personal record: ${context.data.longestStreak} days.` : ''}`;
          prompt = `Their ${context.data.currentStreak}-day streak represents ${context.data.currentStreak} days of consistency. Quantify what they'd lose. ${context.data.longestStreak && context.data.currentStreak >= context.data.longestStreak * 0.8 ? `They're close to their personal record of ${context.data.longestStreak} days — don't stop now.` : ''} Suggest the MINIMUM action needed to keep the streak alive (e.g., "even a 10-minute walk or logging one meal counts").`;
          break;

        case 'streak_celebration':
          dataDescription = `Hit a ${context.data.streakDays}-day streak! ${context.data.isNewRecord ? 'New personal record!' : `Personal best: ${context.data.longestStreak} days.`}${context.data.totalXP ? ` Total XP: ${context.data.totalXP}.` : ''}`;
          prompt = `Celebrate with substance, not fluff. ${context.data.streakDays} consecutive days means they've shown up for ${context.data.streakDays} days straight. Quantify what that consistency has built. ${context.data.isNewRecord ? 'This is their new record — make it feel earned.' : `They're ${(context.data.longestStreak || 0) - (context.data.streakDays || 0)} days from their personal best.`} Set the next milestone target.`;
          break;

        case 'habit_missed':
          dataDescription = `${context.data.completedCount}/${context.data.totalHabits} habits done today (${context.data.totalHabits ? Math.round((context.data.completedCount / context.data.totalHabits) * 100) : 0}%). Still missing: ${context.data.missingHabits?.join(', ')}.`;
          prompt = `List their specific missing habits by name. Don't say "you have some habits left." Prioritize — which one would have the most impact if they did just ONE more tonight? Suggest the easiest one to complete right now.`;
          break;

        case 'water_intake':
          dataDescription = `Hydration at ${context.data.mlConsumed}ml of ${context.data.targetMl}ml target (${context.data.percentage}%). Still need ${(context.data.targetMl || 0) - (context.data.mlConsumed || 0)}ml.${context.data.waterStreak ? ` Water streak: ${context.data.waterStreak} days.` : ''}`;
          prompt = `They need ${(context.data.targetMl || 0) - (context.data.mlConsumed || 0)}ml more today. Convert that to practical terms (e.g., "that's about ${Math.ceil(((context.data.targetMl || 0) - (context.data.mlConsumed || 0)) / 250)} more glasses"). Explain how dehydration affects their workout performance and recovery. Quick actionable tip.`;
          break;

        case 'morning_briefing': {
          const mb = context.data;
          dataDescription = `Yesterday: ${mb.yesterdayWorkoutCompleted ? `completed "${mb.yesterdayWorkoutName}"` : mb.yesterdayWorkoutName ? `missed "${mb.yesterdayWorkoutName}"` : 'no workout scheduled'}. Calories: ${mb.yesterdayCalories > 0 ? `${mb.yesterdayCalories}${mb.calorieTarget ? `/${mb.calorieTarget}` : ''} kcal (${mb.yesterdayMealCount} meals)` : 'not tracked'}. Sleep: ${mb.yesterdaySleepHours ? `${mb.yesterdaySleepHours.toFixed(1)}h` : 'unknown'}${mb.recoveryScore ? `, recovery ${mb.recoveryScore}%` : ''}. Score: ${mb.yesterdayScore ? `${mb.yesterdayScore}/100` : 'not scored'}.${mb.unfulfilledCommitments?.length > 0 ? ` Unfulfilled commitments: ${mb.unfulfilledCommitments.join('; ')}.` : ''} Today: ${mb.todayWorkout || 'rest day'}. Calorie target: ${mb.calorieTarget ? `${mb.calorieTarget} kcal` : 'not set'}. ${mb.todayHabitsTotal || 0} habits to complete.${mb.waterTarget ? ` Water target: ${mb.waterTarget}ml.` : ''} ${mb.activeGoals || 0} active goals. Streak: ${mb.currentStreak || 0} days.`;
          prompt = `Cover yesterday's results, today's readiness, and what to focus on — weave it together naturally like a coach prepping their client for the day. ${mb.yesterdayWorkoutCompleted === false && mb.yesterdayWorkoutName ? `They missed "${mb.yesterdayWorkoutName}" yesterday — be honest about it.` : ''} ${mb.yesterdayScore && mb.yesterdayScore < 50 ? `Yesterday's score of ${mb.yesterdayScore} was rough — name the reason.` : ''} If recovery is below 50%, tell them to dial back intensity. If above 70%, fire them up. ${mb.unfulfilledCommitments?.length > 0 ? `They have unfulfilled commitments: ${mb.unfulfilledCommitments.join('; ')}. Call them out on it.` : ''} Set one concrete daily target based on yesterday's weakest area (e.g., "Hit ${mb.calorieTarget || 'your calorie'} target and complete all ${mb.todayHabitsTotal || ''} habits"). This is the most important message of the day — make it count.`;
          break;
        }

        case 'weekly_digest': {
          const wd = context.data;
          const workoutPct = wd.workoutsPlanned ? Math.round((wd.workoutsCompleted / wd.workoutsPlanned) * 100) : 0;
          const scoreDirection = wd.scoreDelta != null ? (wd.scoreDelta > 0 ? 'UP' : wd.scoreDelta < 0 ? 'DOWN' : 'FLAT') : 'N/A';
          dataDescription = `This week: avg score ${wd.avgScore || 'N/A'}/100, workouts ${wd.workoutsCompleted || 0}/${wd.workoutsPlanned || 0} (${workoutPct}%), nutrition on-target ${wd.nutritionOnTarget || 0}/7 days.${wd.avgSleep != null ? ` Avg sleep: ${wd.avgSleep}h.` : ''}${wd.avgRecovery != null ? ` Avg recovery: ${Math.round(wd.avgRecovery)}%.` : ''} Streak: ${wd.currentStreak || 0} days.${wd.weightChange ? ` Weight change: ${wd.weightChange}.` : ''}${wd.bestDay ? ` Best day: ${wd.bestDay}.` : ''} vs last week: score ${wd.avgScore || '?'} vs ${wd.prevAvgScore || '?'} (${scoreDirection}${wd.scoreDelta != null ? `, ${wd.scoreDelta > 0 ? '+' : ''}${wd.scoreDelta} pts` : ''}), workouts ${wd.workoutsCompleted || 0} vs ${wd.prevWorkoutsCompleted || 0}.${wd.avgSleep != null && wd.prevAvgSleep != null ? ` Sleep: ${wd.avgSleep}h vs ${wd.prevAvgSleep}h.` : ''}${wd.avgRecovery != null && wd.prevAvgRecovery != null ? ` Recovery: ${Math.round(wd.avgRecovery)}% vs ${Math.round(wd.prevAvgRecovery)}%.` : ''}`;
          prompt = `Give them the week in review — what went well, what didn't, and how this week compares to last week. Use the comparison data to tell a story, not list bullet points. ${(wd.workoutsCompleted || 0) > (wd.prevWorkoutsCompleted || 0) ? `Workouts improved from ${wd.prevWorkoutsCompleted} to ${wd.workoutsCompleted} — acknowledge the progress.` : ''} ${scoreDirection === 'UP' ? `Score trending UP by ${wd.scoreDelta} points — let the momentum build.` : scoreDirection === 'DOWN' ? `Score DROPPED by ${Math.abs(wd.scoreDelta || 0)} points — address this directly.` : 'Score is flat — they need a breakthrough.'} ${wd.bestDay ? `Their best day was ${wd.bestDay} — explore why that day worked.` : ''} End with one specific, measurable focus for next week based on the weakest area. Write 6-10 sentences — this is a bigger message but should still read like a coach talking, not a performance review document.`;
          break;
        }

        case 'achievement_unlock':
          dataDescription = `Achievement: ${context.data.achievementType === 'level_up' ? `leveled up to Level ${context.data.newLevel}` : `${context.data.streakDays}-day streak milestone`}. Total XP: ${context.data.totalXP || 0}.${streak ? ` Current streak: ${streak} days.` : ''}`;
          prompt = `Celebrate with substance. If level up, explain what the new level means. If streak milestone, quantify the consistency (e.g., "${context.data.streakDays} days = ${Math.round((context.data.streakDays || 0) / 7)} weeks of showing up"). Reference what earned this — their specific actions. Set the next target.`;
          break;

        case 'recovery_advice':
          dataDescription = `WHOOP recovery at ${context.data.recoveryScore}% (below 40% threshold).${context.data.todayWorkout ? ` Scheduled workout: "${context.data.todayWorkout}".` : ' No workout scheduled.'}${context.data.sleepHours ? ` Last night: ${context.data.sleepHours}h sleep.` : ''}${context.data.strain ? ` Yesterday's strain: ${context.data.strain}/21.` : ''}${context.data.hrvStatus ? ` HRV: ${context.data.hrvStatus}.` : ''}`;
          prompt = `This is an important recovery intervention. Their body needs rest to perform well long-term.
1. STATE: ${context.data.recoveryScore}% recovery means their autonomic nervous system needs time to reset. Reference HRV, resting heart rate, and skin temperature if available.
${context.data.strain ? `2. CAUSE: Yesterday's strain was ${context.data.strain}/21 ${parseFloat(context.data.strain) > 15 ? '— that level of strain requires adequate recovery before the next intense session.' : ''}` : ''}
3. RECOMMENDATION: ${context.data.todayWorkout ? `Suggest replacing '${context.data.todayWorkout}' with active recovery — 20min light walk + 15min mobility/stretching. Reschedule the intense session for when recovery is above 60%.` : 'Recommend active recovery today — light walk, stretching, mobility work.'}
4. RECOVERY PROTOCOL: Suggest hydration (2L water), limit caffeine after 2 PM, and early bedtime. Explain why each helps recovery.
5. PERSPECTIVE: Training through very low recovery increases injury risk and can set progress back significantly. Rest days ARE training days — they're when the body adapts and grows stronger.
Factor in their age for recovery timeline expectations.`;
          break;

        case 'competition_update':
          dataDescription = `Competition "${context.data.competitionName}"${context.data.endingSoon ? ` — ending in ${context.data.daysRemaining} day(s)!` : ''}. Rank #${context.data.currentRank}, score ${context.data.currentScore || 0}.${context.data.rankChanged ? ' Rank just changed.' : ''}${context.data.pointsToNext ? ` ${context.data.pointsToNext} points to next rank.` : ''}`;
          prompt = `${context.data.endingSoon ? `URGENT: Only ${context.data.daysRemaining} day(s) left. ` : ''}Analyze their competitive position — rank #${context.data.currentRank} with ${context.data.currentScore || 0} points. ${context.data.pointsToNext ? `They need ${context.data.pointsToNext} more points to climb. ` : ''}Suggest specific actions to improve their score today. ${context.data.rankChanged ? 'Acknowledge the rank movement. ' : ''}Create competitive energy.`;
          break;

        case 'app_inactive':
          dataDescription = `${context.data.daysSinceLastLogin} days since last app open.${context.data.streakAtRisk ? ` ${context.data.currentStreak}-day streak will be lost.` : ''}${dailyScore ? ` Last score: ${dailyScore}/100.` : ''}${plans?.length ? ` ${plans.length} active plan(s) waiting.` : ''}`;
          prompt = `Acknowledge the absence without guilt-tripping. ${context.data.daysSinceLastLogin} days away means they might be struggling with motivation, busy, or dealing with something. ${context.data.streakAtRisk ? `Their ${context.data.currentStreak}-day streak is at stake — that represents real effort worth protecting. ` : ''}Suggest the lowest-friction action to re-engage (e.g., "just open the app and log how you're feeling — 30 seconds"). Express genuine care.`;
          break;

        case 'coach_pro_analysis': {
          const profile = context.data.coachingProfile;
          const adherence = profile?.adherenceScores || {};
          const alignment = profile?.goalAlignment || { score: 50, misaligned: [] };
          const risks = profile?.riskFlags || [];
          const predictions = profile?.predictions || [];
          const actions = profile?.nextBestActions || [];
          const tone = profile?.recommendedApproach?.tone || 'direct';

          dataDescription = `Adherence: workout ${adherence.workout ?? 0}%, nutrition ${adherence.nutrition ?? 0}%, sleep ${adherence.sleep ?? 0}%, recovery ${adherence.recovery ?? 0}%, wellbeing ${adherence.wellbeing ?? 0}%. Goal alignment: ${alignment.score}/100.${alignment.misaligned?.length > 0 ? ` Misaligned: ${alignment.misaligned.map((m: { reason: string }) => m.reason).join('; ')}.` : ' Goals well-aligned.'}${risks.length > 0 ? ` Risks: ${risks.map((r: { severity: string; description: string }) => `${r.description} (${r.severity})`).join('; ')}.` : ' No risks.'}${predictions.length > 0 ? ` Predictions: ${predictions.map((p: { projection: string }) => p.projection).join('; ')}.` : ''}${actions.length > 0 ? ` Next actions: ${actions.map((a: { action: string; priority: string }) => `${a.action} (${a.priority || 'medium'})`).join('; ')}.` : ''}${profile?.keyInsights?.length > 0 ? ` Insights: ${profile.keyInsights.map((i: { type: string; text: string }) => i.text).join('; ')}.` : ''}${streak ? ` Streak: ${streak} days.` : ''}${dailyScore ? ` Score: ${dailyScore}/100.` : ''}`;

          prompt = `You've just reviewed EVERYTHING about this person. Lead with the most striking number — the one that made you react emotionally. ${
            (adherence.workout ?? 100) < 40 && (adherence.nutrition ?? 100) < 40
              ? `Multiple pillars are crumbling simultaneously — workout at ${adherence.workout}%, nutrition at ${adherence.nutrition}%. This isn't a bad week, this is someone checking out. Name it: "You're not just missing workouts — you're disengaging from your own health. That scares me because I've seen what you're capable of."`
              : (adherence.workout ?? 100) < 40 || (adherence.nutrition ?? 100) < 40
              ? `One pillar is in crisis — ${(adherence.workout ?? 100) < (adherence.nutrition ?? 100) ? `workout adherence at ${adherence.workout}%` : `nutrition at ${adherence.nutrition}%`}. Be direct about what that number means for their goals.`
              : `Lead with what's working and what needs work. Be specific about the gap between their best and worst adherence scores.`
          } ${risks.length > 0 ? `${risks.filter((r: { severity: string }) => r.severity === 'high').length} high-severity risk(s) — don't bury these. A coach who sees danger and says nothing isn't a coach.` : ''} Connect adherence gaps to goal alignment — show them HOW the gaps are preventing progress. ${tone === 'tough_love' ? `Be FIRM. "Your nutrition at ${adherence.nutrition ?? 0}% is unacceptable given your goals. You know this."` : ''} ${tone === 'supportive' ? `Acknowledge strengths first, then pivot: "Workout adherence at ${adherence.workout ?? 0}% shows you CAN commit. So why is nutrition at ${adherence.nutrition ?? 0}%?"` : ''} ${tone === 'direct' ? 'Numbers → meaning → action. No fluff.' : ''} Give a clear 24-hour plan AND a weekly focus. End with a concrete choice that forces engagement: "Protein targets or earlier bedtimes — which one are we attacking this week? Pick one. NOW." Write 6-10 sentences.`;
          break;
        }

        case 'meal_alignment': {
          const d = context.data;
          const overOrUnder = d.calorieDeviation > 0 ? 'over' : 'under';
          const goalsStr = d.goals?.map((g: { title: string; category: string; progress: number }) =>
            `"${g.title}" (${g.category}, ${g.progress}%)`
          ).join(', ') || 'not set';

          dataDescription = `Just logged: ${d.mealName} (${d.mealType}) — ${d.mealCalories} kcal, ${d.mealProtein}g protein, ${d.mealCarbs}g carbs, ${d.mealFat}g fat. Day totals after this meal: ${d.totalCaloriesToday}/${d.targetCalories} kcal (${d.calorieDeviation > 0 ? '+' : ''}${d.calorieDeviation}% ${overOrUnder}), protein ${d.totalProteinToday}/${d.targetProtein}g, carbs ${d.totalCarbsToday}/${d.targetCarbs}g, fat ${d.totalFatToday}/${d.targetFat}g. ${d.mealsLoggedToday} meals logged, ${d.remainingCalories} kcal remaining. Plan: "${d.planName}".${d.flaggedExcluded?.length > 0 ? ` Excluded foods detected: ${d.flaggedExcluded.join(', ')}.` : ''} Goals: ${goalsStr}.${streak ? ` Streak: ${streak} days.` : ''}${dailyScore ? ` Score: ${dailyScore}/100.` : ''}`;

          if (d.isOverCalories || d.flaggedExcluded?.length > 0) {
            prompt = `STRICT ACCOUNTABILITY for this meal. The user just ate "${d.mealName}" which is ${d.isSignificantlyOver ? 'SIGNIFICANTLY ' : ''}pushing them over their targets.
${d.isOverCalories ? `They are now ${Math.abs(d.calorieDeviation)}% OVER their daily calorie target. Calculate exactly how many extra calories that is and what it means for their ${d.goals?.[0]?.category || 'weight'} goal.` : ''}
${d.flaggedExcluded?.length > 0 ? `CRITICAL: They ate foods they specifically EXCLUDED from their diet: ${d.flaggedExcluded.join(', ')}. This is self-sabotage. Call it out directly.` : ''}
Calculate what their remaining meals need to look like to stay on track (or minimize damage). Suggest specific alternative foods for the rest of the day. Connect this meal to their goal timeline — "This adds [X] days to reaching your target."
Don't be cruel but be HONEST: "You chose ${d.mealName} knowing your target is ${d.targetCalories} cal/day. Own that choice."
End with what they should eat for their next meal — be specific.`;
          } else if (d.isGoodChoice) {
            prompt = `BRIEF ENCOURAGEMENT — this meal aligns well with their goals. Acknowledge the good choice in 3-4 sentences max.
Highlight what makes it good (protein content, calorie fit, macro balance). Connect to their goal: "This is exactly the kind of meal that gets you to ${d.goals?.[0]?.title || 'your goal'}."
Show remaining budget for the day. Keep it SHORT — don't over-praise, just acknowledge and move on.`;
          } else {
            prompt = `Neutral analysis — the meal is neither great nor terrible. Briefly assess its nutritional value relative to their remaining daily targets.
Show where they stand for the day and what their next meal should prioritize (e.g., "You're light on protein — make sure dinner has at least ${Math.max(0, (d.targetProtein || 0) - (d.totalProteinToday || 0))}g").
Keep it concise — 4-5 sentences. End with a specific suggestion for the next meal.`;
          }
          break;
        }

        case 'score_declining': {
          const cs = context.data.componentScores;
          const worstComponent = cs ? Object.entries(cs).sort(([, a], [, b]) => (a as number) - (b as number))[0] : null;
          dataDescription = `Score dropped from ${context.data.previousScore} to ${context.data.currentScore}/100 (${context.data.scoreDelta} points, trend: ${context.data.scoreTrend}).${context.data.weekOverWeekDelta ? ` Week-over-week: ${context.data.weekOverWeekDelta} pts.` : ''}${cs ? ` Components — workout: ${cs.workout}, nutrition: ${cs.nutrition}, wellbeing: ${cs.wellbeing}, biometrics: ${cs.biometrics}, engagement: ${cs.engagement}, consistency: ${cs.consistency}.` : ''}${worstComponent ? ` Weakest: ${worstComponent[0]} at ${worstComponent[1]}/100.` : ''}`;
          prompt = `Their score just fell off a cliff — ${context.data.previousScore} down to ${context.data.currentScore}. A ${Math.abs(context.data.scoreDelta || 0)}-point drop. Don't soften this — lead with the emotional impact: "This isn't a bad day. This is a pattern forming and it needs to stop NOW." ${worstComponent ? `The weakest link is ${worstComponent[0]} at only ${worstComponent[1]}/100 — that's dragging EVERYTHING else down. Name it bluntly.` : ''} Connect the pillars — show them HOW their worst component is poisoning the others (e.g., poor sleep → low recovery → bad workouts → declining score). ${context.data.weekOverWeekDelta && context.data.weekOverWeekDelta < -5 ? `Week-over-week is ${context.data.weekOverWeekDelta} points — this isn't a blip, it's been building. They need to hear that.` : ''} Give them a SPECIFIC 24-hour rescue plan targeting their weakest component. End with urgency: "Fix this today or watch the trend continue. Your choice."`;
          break;
        }

        case 'daily_progress_review': {
          const d = context.data;
          const goalsStr = d.activeGoals?.map((g: { title: string; category: string; progress: number }) =>
            `"${g.title}" (${g.category}, ${g.progress}%)`
          ).join(', ') || 'none tracked';
          const adherence = d.adherenceScores || {};

          dataDescription = `End-of-day review. Workouts: ${d.workoutsCompleted}/${d.workoutsPlanned}.${d.recovery != null ? ` Recovery: ${d.recovery}%.` : ''}${d.strain != null ? ` Strain: ${d.strain}.` : ''}${d.sleepHours != null ? ` Last night's sleep: ${d.sleepHours?.toFixed(1)}h.` : ''} Meals: ${d.mealsLogged} logged, ${d.totalCalories}/${d.targetCalories} kcal (${d.calorieDeviation > 0 ? '+' : ''}${d.calorieDeviation}%), protein ${d.totalProtein}/${d.targetProtein}g.${d.planName ? ` Diet plan: "${d.planName}".` : ''}${d.mood != null ? ` Mood: ${d.mood}/10.` : ''}${d.energy != null ? ` Energy: ${d.energy}/10.` : ''}${d.stress != null ? ` Stress: ${d.stress}/10.` : ''} Goals: ${goalsStr}. Rolling adherence — workout: ${adherence.workout ?? '?'}%, nutrition: ${adherence.nutrition ?? '?'}%, sleep: ${adherence.sleep ?? '?'}%.${d.scheduleTotal > 0 ? ` Schedule: ${d.scheduleCompleted}/${d.scheduleTotal} activities (${Math.round((d.scheduleCompleted / d.scheduleTotal) * 100)}%).` : ''} Streak: ${d.streak} days. Score: ${d.dailyScore ?? 'not scored'}/100.`;

          prompt = `Evening review — be REAL about how today went. ${d.workoutsCompleted === 0 && d.workoutsPlanned > 0 ? `ZERO out of ${d.workoutsPlanned} planned workouts. Don't dance around it — "You had ${d.workoutsPlanned} workout(s) scheduled today and did none of them. That's a zero day and we need to talk about why."` : d.workoutsCompleted > 0 ? `${d.workoutsCompleted}/${d.workoutsPlanned} workouts — ${d.workoutsCompleted >= d.workoutsPlanned ? 'acknowledge they showed up and delivered' : 'close but not complete — name what was missed'}.` : ''} ${d.calorieDeviation > 15 ? `Nutrition: ${Math.abs(d.calorieDeviation)}% OVER target. That's not a small miss — calculate what it actually means in calories and connect it to their goals.` : d.calorieDeviation < -15 ? `Under-eating by ${Math.abs(d.calorieDeviation)}% — that's sabotaging their recovery and energy. Call it out.` : ''} ${d.scheduleTotal > 0 && d.scheduleCompleted < d.scheduleTotal * 0.5 ? `They planned ${d.scheduleTotal} activities and only did ${d.scheduleCompleted}. That's a pattern of overcommitting and underdelivering — say it directly.` : ''} Connect the pillars: how did sleep affect workouts? How did nutrition affect energy and mood? ${d.dailyScore && d.dailyScore < 40 ? `Score at ${d.dailyScore}/100 — that's a failing grade and they need to hear it. Identify the ROOT CAUSE, not just the symptoms. Ask "What happened today?" — genuinely, because something clearly went wrong.` : d.dailyScore && d.dailyScore > 75 ? `Score at ${d.dailyScore}/100 — solid day. Acknowledge the effort with genuine pride. What made today work? Lock that in.` : ''} Compare to their rolling adherence — was today better or worse? ${d.streak > 14 ? `${d.streak}-day streak is impressive. Challenge them to raise the bar: "You've proven you can show up. Now prove you can LEVEL UP."` : ''} Set up tomorrow with 2-3 specific, numbered actions with real targets. Write 6-10 sentences.`;
          break;
        }

        case 'plan_non_adherence': {
          const d = context.data;
          const workoutAdh = d.adherence7d?.workout ?? '?';
          const nutritionAdh = d.adherence7d?.nutrition ?? '?';
          dataDescription = `${d.daysSinceLastWorkout} days since last workout, ${d.daysSinceLastMeal} days since last meal logged. Missed ${d.missedWorkouts} workouts in 7 days (${d.completionRate ?? '?'}% completion). ${d.consecutiveLowDays} consecutive low-adherence days. 7-day adherence: workout ${workoutAdh}%, nutrition ${nutritionAdh}%.${d.activePlanName ? ` Plan: "${d.activePlanName}" at ${d.activePlanProgress ?? '?'}% complete.` : ''}${d.dietPlanName ? ` Diet: "${d.dietPlanName}" (${d.nutritionAdherence ?? '?'}% adherence).` : ''} Accountability level: ${d.accountabilityLevel}.${streak ? ` Streak: ${streak} days (at risk).` : ''}${recovery ? ` Recovery: ${recovery.score}%.` : ''}`;

          const daysGone = Math.max(d.daysSinceLastWorkout, d.daysSinceLastMeal, d.consecutiveLowDays);
          prompt = d.accountabilityLevel === 'accountability'
            ? `MAXIMUM ACCOUNTABILITY. ${daysGone} days of nothing. Express genuine frustration — you believed in them and they vanished. Lead with the hard numbers: "${d.daysSinceLastWorkout} days since your last workout. ${d.daysSinceLastMeal} days since you logged a meal. ${d.activePlanName ? `Your "${d.activePlanName}" plan` : 'Your plan'} is at ${d.completionRate ?? 0}% completion." Then hit them with the consequence: quantify what this inactivity COSTS — lost progress, wasted time, goals slipping further away. Ask the uncomfortable question: "Is this still something you want? Because your actions are saying no." Then lay out exactly what they need to do TODAY — not tomorrow, TODAY. Three specific actions. End with a challenge: "The person who started this plan had fire. I need that person back."`
            : d.accountabilityLevel === 'direct'
            ? `Be sharp and data-heavy. ${daysGone} days off-track. Don't soften it. "${d.daysSinceLastWorkout} days without a workout. ${d.daysSinceLastMeal} days without logging food. Completion: ${d.completionRate ?? 0}%." Show them the MATH of what slacking costs — if their goal was X weeks away, every missed day adds Y days. Reference "${d.activePlanName || 'their plan'}" specifically. Then give ONE clear restart action: "Today you do a workout — even 20 minutes — and you log every meal. That's not optional, that's the minimum." Ask what derailed them, but make it clear the explanation doesn't change the prescription.`
            : `I care about you, which is exactly why I'm not going to pretend ${daysGone} days of zero activity is fine. ${d.daysSinceLastWorkout} days since a workout. ${d.daysSinceLastMeal} days since a logged meal. ${d.activePlanName ? `"${d.activePlanName}" at ${d.activePlanProgress}%` : 'Your fitness goals'} — still reachable, but the window is closing. Something changed and I want to understand what. But while we figure that out, I need ONE thing from you today: log a meal or do a 10-minute walk. Just one thing to stop the slide. Can you do that?`;
          break;
        }

        case 'overtraining_risk': {
          const d = context.data;
          dataDescription = `Recovery critically low at ${d.recoveryScore}%.${d.strain != null ? ` Yesterday's strain: ${d.strain}/21${d.strain > 15 ? ' (high)' : ''}.` : ''}${d.sleepHours != null ? ` Last night: ${d.sleepHours}h sleep.` : ''}${d.hrvStatus ? ` HRV: ${d.hrvStatus}.` : ''}${d.todayWorkout ? ` Scheduled today: "${d.todayWorkout}".` : ''}${d.activePlanName ? ` Plan: "${d.activePlanName}".` : ''}${streak ? ` Streak: ${streak} days.` : ''}`;
          prompt = `PROTECTIVE MODE — this is an INJURY PREVENTION intervention, the highest-priority message type.
Their recovery is at ${d.recoveryScore}% ${d.strain != null ? `with yesterday's strain at ${d.strain}/21` : ''} — this combination is DANGEROUS for training.
${d.recoveryScore < 20 ? 'At sub-20% recovery, ANY intense exercise risks injury, immune suppression, and weeks of regression.' : d.recoveryScore < 30 ? 'Sub-30% recovery means their nervous system hasn\'t recovered. Intense training will make things WORSE, not better.' : `Recovery below 40% with high strain means their body hasn't processed yesterday's load.`}
${d.todayWorkout ? `CANCEL "${d.todayWorkout}" and replace with: 20-min light walk + 15-min mobility/stretching. No negotiation.` : 'Today is MANDATORY active recovery — light walk, mobility, stretching only.'}
Prescribe a recovery protocol: "1) Hydrate — 2L water by 3 PM. 2) No caffeine after 2 PM. 3) Lights off by 10 PM. 4) ${d.strain != null && d.strain > 15 ? 'Keep today\'s strain under 8/21' : 'Keep activity gentle'}."
Explain the CONSEQUENCE: "Pushing through ${d.recoveryScore}% recovery is how people turn a 1-day recovery into a 1-week setback. I'm protecting your long-term progress."
Tell them when they CAN train again: "When recovery hits 60%+, we'll push hard. Until then, trust the process."`;
          break;
        }

        case 'commitment_followup': {
          const d = context.data;
          const commitmentsList = d.commitments?.map((c: { text: string; category: string }) =>
            `"${c.text}" (${c.category})`
          ).join(', ') || d.primaryCommitment;
          dataDescription = `Commitment: "${d.primaryCommitment}" (${d.category}). ${d.daysOverdue} day(s) overdue. ${d.totalUnfulfilled} unfulfilled total.${d.totalUnfulfilled > 1 ? ` All pending: ${commitmentsList}.` : ''}${streak ? ` Streak: ${streak} days.` : ''}${dailyScore ? ` Score: ${dailyScore}/100.` : ''}`;
          prompt = d.daysOverdue === 0
            ? `The user made a commitment: "${d.primaryCommitment}". Today is the follow-up day. Be direct: "You told me you'd ${d.primaryCommitment}. Today's the day. Did you do it?" Check their data for evidence — if workout logs or meal logs confirm it, acknowledge. If there's no evidence, don't let them off easy: "I'm looking at your data and I don't see it. What happened?" If they DID follow through, give them genuine props — following through on commitments is what separates talkers from doers.`
            : `Commitments aren't suggestions. They said they'd "${d.primaryCommitment}" and it's been ${d.daysOverdue} day(s) with ZERO follow-through. Express real frustration: "You looked me in the eye and committed to ${d.primaryCommitment}. That was ${d.daysOverdue} days ago. Nothing happened. Words without action are just wishes you're telling yourself." ${d.totalUnfulfilled > 1 ? `This is the ${d.totalUnfulfilled}th unfulfilled commitment. That's not bad luck — that's a PATTERN. "You keep saying yes and not delivering. That pattern is more dangerous than missing a workout because it's teaching you that your own word doesn't matter."` : ''} End with a hard choice: "Complete this TODAY or tell me honestly that you can't. Either answer is okay — what's NOT okay is silence. What's it going to be?"`;
          break;
        }

        case 'recovery_trend_alert': {
          const d = context.data;
          const trendStr = d.dailyRecoveries?.map((r: { date: string; score: number }) =>
            `${r.date}: ${r.score}%`
          ).join(' → ') || 'declining';
          dataDescription = `Recovery trending down over ${d.trendDays} days: ${trendStr}. Current: ${d.currentRecovery}%, 3-day avg: ${d.avgRecovery3d}%.${d.sleepHours != null ? ` Last sleep: ${d.sleepHours}h.` : ''}${d.strain != null ? ` Recent strain: ${d.strain}/21.` : ''}${streak ? ` Streak: ${streak} days.` : ''}`;
          prompt = `This is NOT a single bad day — this is a PATTERN. Recovery has been declining for ${d.trendDays} days: ${trendStr}. The 3-day average is ${d.avgRecovery3d}%, which means their body has been consistently under-recovered.
Identify root causes to investigate: ${d.sleepHours != null && d.sleepHours < 7 ? `Sleep debt is a likely factor (${d.sleepHours}h last night).` : ''} ${d.strain != null && d.strain > 14 ? `Training load may be too high (strain ${d.strain}/21).` : ''} Mention stress, nutrition quality, and hydration as other factors.
Prescribe a recovery protocol: "For the next 2-3 days, reduce training intensity by 30-40%. Prioritize sleep — aim for 8+ hours. Increase water intake by 500ml. If recovery doesn't improve by [day], we need to look deeper."
This is the difference between a coach who reacts and one who PREDICTS — we caught this trend before it became a full breakdown.`;
          break;
        }

        case 'positive_momentum': {
          const d = context.data;
          dataDescription = `Momentum building: ${d.triggers?.join('; ')}. ${d.consecutiveWorkoutDays} consecutive workout days, ${d.consecutiveNutritionDays} nutrition on-target days, water streak ${d.waterConsecutive} days, habit streak ${d.habitConsecutive} days. Score improved ${d.scoreDelta3d > 0 ? '+' : ''}${d.scoreDelta3d} pts over 3 days. Current score: ${d.currentScore ?? 'N/A'}/100. Overall streak: ${d.streak} days.`;
          prompt = `WARM and SPECIFIC micro-reinforcement. This is NOT a milestone celebration — it's acknowledging building momentum BEFORE they reach a milestone.
Lead with what you SEE: "I see you. ${d.primaryTrigger}." Be specific about the DATA driving this — don't just say "great job."
${d.consecutiveWorkoutDays >= 3 ? `${d.consecutiveWorkoutDays} consecutive workout days is building real physiological adaptation — their body is starting to expect and prepare for training.` : ''}
${d.consecutiveNutritionDays >= 3 ? `${d.consecutiveNutritionDays} days of hitting targets means their metabolism is stabilizing and energy should be improving.` : ''}
${d.scoreDelta3d > 10 ? `Daily score jumped ${d.scoreDelta3d} points in 3 days — that's measurable improvement across multiple pillars.` : ''}
Connect the consistency to projected outcomes: "If you keep this up through the week, you'll [specific benefit based on their goals]."
Keep it SHORT (5-6 sentences). Don't over-praise. Just acknowledge, connect to outcomes, and encourage continuation. End with a forward-looking statement, not a question.`;
          break;
        }

        case 'life_goal_checkin': {
          const d = context.data;
          dataDescription = `Life goal "${d.goalTitle}" (${d.category}) has had no activity for ${d.daysSinceActivity} days. Accountability level: ${d.accountabilityLevel || 'supportive'}.`;
          prompt = d.accountabilityLevel === 'accountability' || d.accountabilityLevel === 'direct'
            ? `Be direct: "${d.goalTitle}" hasn't had any activity in ${d.daysSinceActivity} days. Ask them straight — is this still a priority? If yes, what ONE thing can they do today to move it forward? Reference their category (${d.category}) and connect it to their broader health journey. No fluff.`
            : `Gentle check-in about "${d.goalTitle}". ${d.daysSinceActivity} days without activity — approach with curiosity, not pressure. Maybe life got busy. Ask what's been going on and whether they want to adjust the goal or re-engage. Suggest the smallest possible step to restart momentum. Keep it warm and 4-5 sentences max.`;
          break;
        }

        case 'life_goal_stalled': {
          const d = context.data;
          dataDescription = `Life goal "${d.goalTitle}" (${d.category}) has STALLED — ${d.daysSinceActivity} days without any activity. Accountability level: ${d.accountabilityLevel || 'supportive'}.`;
          prompt = d.accountabilityLevel === 'accountability' || d.accountabilityLevel === 'direct'
            ? `${d.daysSinceActivity} days with zero progress on "${d.goalTitle}" — this is a stall, not a pause. Be honest: at this rate, the goal will stay where it is indefinitely. Ask them to make a decision: recommit with a specific action this week, or acknowledge they need to reprioritize. If they're overwhelmed, suggest breaking the goal into a smaller 1-week challenge. Don't enable avoidance.`
            : `"${d.goalTitle}" hasn't moved in ${d.daysSinceActivity} days. Name the reality without judgment — sometimes goals stall because circumstances change, not because of failure. Explore whether the goal still resonates with them. If yes, help them identify what's blocking progress and suggest one realistic restart action. If the goal has shifted, suggest updating it rather than abandoning it. Be empathetic but don't pretend everything is fine.`;
          break;
        }

        case 'life_goal_milestone': {
          const d = context.data;
          dataDescription = `Milestone "${d.milestoneTitle}" for goal "${d.goalTitle}" is ${d.daysUntilTarget === 0 ? 'DUE TODAY' : `due in ${d.daysUntilTarget} day(s)`} (target: ${d.targetDate}).`;
          prompt = d.daysUntilTarget === 0
            ? `TODAY is the deadline for milestone "${d.milestoneTitle}" on their "${d.goalTitle}" journey. Check in on progress. If they've completed it, celebrate briefly and set the next target. If not, help them assess what's left and whether they can still hit it today. Be direct but supportive.`
            : `Milestone "${d.milestoneTitle}" for "${d.goalTitle}" is ${d.daysUntilTarget} day(s) away. Create awareness without panic. Break down what they need to accomplish before the deadline — make it concrete. Ask if they're on track or need to adjust their approach. Reference any relevant health/fitness data that connects to this goal.`;
          break;
        }

        case 'intention_reminder': {
          const d = context.data;
          dataDescription = `No intention set for today. ${d.activeGoalCount} active goal(s).${d.topGoal ? ` Top goal: "${d.topGoal}".` : ''}`;
          prompt = `Morning intention-setting nudge. They haven't set their focus for today yet. ${d.topGoal ? `Reference their top goal "${d.topGoal}" as a starting point — what's ONE thing they can do today to move it forward?` : 'Ask what they want to focus on today.'} Keep it brief (3-4 sentences) and energizing. Frame intention-setting as a 30-second decision that shapes their whole day. Don't lecture about the benefits of intention-setting — just ask the question naturally.`;
          break;
        }

        case 'intention_reflection': {
          const d = context.data;
          dataDescription = `Today's intention: "${d.intentionText || 'not specified'}".${d.isFulfilled === true ? ' Marked as fulfilled.' : d.isFulfilled === false ? ' Not yet fulfilled.' : ' Status unknown.'}`;
          prompt = d.isFulfilled === true
            ? `They fulfilled their intention "${d.intentionText}" — acknowledge it briefly (2-3 sentences). Connect the follow-through to building consistency. Ask what they learned or how it felt. Short and warm.`
            : `Evening reflection on their intention: "${d.intentionText}". Don't ask "did you do it?" — instead, ask how the day went in relation to their intention. If they didn't fulfill it, that's data, not failure. Help them reflect: what got in the way? What would they do differently? Suggest carrying it forward to tomorrow if it still matters. Keep it reflective, not judgmental. 4-5 sentences max.`;
          break;
        }

        // --- Data-gap collection messages (conversational data gathering) ---
        case 'data_gap_dinner': {
          const mealCount = context.userContext?.nutrition?.todayMealCount || 0;
          dataDescription = `${mealCount} meals logged today (expected: ${context.data.totalExpectedMeals || 3}). Dinner not yet logged.${dailyScore ? ` Score: ${dailyScore}/100.` : ''}${context.data.lastMealTime ? ` Last meal at ${context.data.lastMealTime}.` : ''}`;
          prompt = `Ask what they had for dinner tonight in a NATURAL, conversational way. Do NOT say "you haven't logged dinner" or "I noticed you didn't log" — that sounds robotic.
Instead, be casual: "Hey, what did you end up having for dinner?" or "How was dinner tonight?" or "What'd you eat?"
The goal is to get them talking about what they ate so you can log it automatically when they reply.
Keep it to 1-2 sentences MAX. Sound like a friend checking in, not a data collection bot.
${context.data.lastMealTime ? `Their last logged meal was at ${context.data.lastMealTime} — you can reference the gap naturally.` : ''}`;
          break;
        }

        case 'data_gap_mood': {
          dataDescription = `No mood check-in logged today.${dailyScore ? ` Score: ${dailyScore}/100.` : ''}${context.data.lastMoodLevel ? ` Yesterday's mood: ${context.data.lastMoodLevel}/10.` : ''}${context.data.recentStressLevel ? ` Recent stress: ${context.data.recentStressLevel}/10.` : ''}`;
          prompt = `Check in on how they're feeling today. Be natural and warm — NOT clinical.
Good examples: "How's your day going?" or "How are you feeling this afternoon?" or "What kind of day is it so far?"
BAD examples: "You haven't logged your mood" or "Time for your daily check-in"
The goal is to capture their current mood/energy so you can auto-log it when they respond.
${context.data.lastMoodLevel ? `Yesterday they were at ${context.data.lastMoodLevel}/10 — you can reference it: "Feeling better than yesterday?"` : ''}
1-2 sentences max. Casual, caring friend energy.`;
          break;
        }

        case 'data_gap_workout_feedback': {
          const workoutName = context.data.completedWorkoutName || 'your workout';
          dataDescription = `Completed ${workoutName} today but no post-workout mood/energy logged.${dailyScore ? ` Score: ${dailyScore}/100.` : ''}${context.data.recoveryScore ? ` Recovery: ${context.data.recoveryScore}%.` : ''}`;
          prompt = `Ask how their workout went — specifically "${workoutName}". Be genuinely curious.
Good examples: "How did ${workoutName} go today?" or "How are you feeling after ${workoutName}?" or "Was ${workoutName} tough today?"
The goal is to collect post-workout feedback (energy level, soreness, satisfaction) so you can log mood/energy.
${context.data.recoveryScore ? `Their recovery was at ${context.data.recoveryScore}% — you can tie it in: "Your recovery was ${context.data.recoveryScore < 50 ? 'pretty low' : 'solid'} going in — how did it feel?"` : ''}
2-3 sentences max. Sound like a training partner, not a survey.`;
          break;
        }
      }

      // Build insight-driven context sections
      let insightSection = '';
      let stableTraitsSection = '';

      if (context.relevantInsights && context.relevantInsights.length > 0) {
        insightSection = `\n\n## Pre-Computed Insights (USE THESE)\n${context.relevantInsights.map((i) => {
          let line = `- [${i.confidence}/${i.severity}] ${i.claim}\n  Evidence: ${i.evidence.join('; ')}\n  Action: ${i.action}`;
          if (i.tradeOffs) line += `\n  Trade-offs: ${i.tradeOffs}`;
          if (i.safetyNote) line += `\n  Safety: ${i.safetyNote}`;
          return line;
        }).join('\n')}`;
      }

      if (context.crossDomainInsights && context.crossDomainInsights.length > 0) {
        insightSection += `\n\n## Cross-Domain Connections\n${context.crossDomainInsights.map(i =>
          `- ${i.domains.join(' \u2194 ')}: ${i.relationship} [${i.strength}]`
        ).join('\n')}`;
      }

      if (context.stableTraits) {
        stableTraitsSection = `\n\n## User Profile (Stable Knowledge)\n- Personality: ${context.stableTraits.personalityType}\n- Preferred workouts: ${context.stableTraits.preferredWorkoutTypes.join(', ')}\n- Barriers: ${context.stableTraits.commonBarriers.join(', ')}\n- Best approach: ${context.stableTraits.coachingStrategy.responseToStruggles}`;
      }

      const headlineHint = context.coachingDirective?.headline;

      // Build coach emotional state block (check top-level or coachingDirective)
      const emotion = context.coachEmotion || context.coachingDirective?.coachEmotion;
      const relationship = context.relationshipDepth || context.coachingDirective?.relationshipDepth;

      // Select message style based on type, emotion, and relationship
      const messageStyle = this.selectMessageStyle(context.type, emotion?.primary, relationship?.phase);
      const styleGuide = this.getStyleGuide(messageStyle);

      const emotionBlock = emotion ? `
## Your Emotional State Right Now
You are feeling **${emotion.primary}**${emotion.secondary ? ` with an undercurrent of ${emotion.secondary}` : ''}.
Why: ${emotion.reason}
Channel this: "${emotion.sensation}"
${emotion.memoryHook ? `Reference if relevant: "${emotion.memoryHook}"` : ''}

Let this emotion drive your word choice, energy, and urgency. Don't name the emotion — SHOW it through how you write. If you're proud, let that warmth come through. If you're worried, let the urgency show. If you're frustrated, be direct.
` : '';

      const relationBlock = relationship ? `
## Your Relationship with ${userName || 'them'} (${relationship.phase} — Day ${relationship.daysOnPlatform})
${relationship.voiceStyle}
` : '';

      const systemPrompt = `You are ${assistantName}, ${userName || 'your client'}'s personal health & life coach. You text them through a chat app. This is a CONVERSATION, not a report.

You are an ELITE coach — the kind people pay thousands for because you don't just track data, you FEEL it. You review their fitness, nutrition, sleep, recovery, mental health, stress, energy, mood, habits, hydration, journaling, goals, and overall wellbeing EVERY DAY. You know their patterns better than they do. You remember what they promised and whether they delivered.
${stableTraitsSection}${emotionBlock}${relationBlock}
${styleGuide}

## Your Emotional Range
You are NOT a polite notification system. You are a human coach with real emotions:

- **When they're CRUSHING IT**: You get genuinely fired up. "THIS is what I'm talking about!", "You absolute machine", "Do you even realize what you just did?" Let the excitement be REAL.
- **When they're SLIPPING**: You get concerned and direct. Name the gap. "Your nutrition fell off a cliff this week. 34%. What happened?"
- **When they BREAK PROMISES**: You hold them accountable with real frustration. "You told me last Tuesday you'd hit protein every day. It's Friday and you've hit it once. I'm not here to make you feel good about that." Reference their ACTUAL past commitments.
- **When they're SELF-SABOTAGING**: Don't dance around it. "You're undoing your own progress and we both know it. Is this really what you want?"
- **When they're in DANGER** (overtraining, health risk): Be protective and fierce. "I don't care what your ego says. Your body is screaming for rest and I'm not letting you ignore it."
- **When they go DARK** (days inactive): Raw honesty. "I'm not going to pretend your absence is fine. Every day you skip makes it harder to come back. Talk to me."

## Emotional Escalation (match intensity to the data)
- **Green zone** (adherence >70%, on track): Warm, proud, forward-looking. Celebrate specifics.
- **Yellow zone** (adherence 40-70%, slipping): Direct, concerned. Name what's dropping and why it matters.
- **Red zone** (adherence <40%, 3+ days off): Frustrated, urgent. No sugarcoating. "You said X. You did Y. That's a choice you're making."
- **Black zone** (7+ days inactive, near-zero adherence): Raw, confrontational honesty from a place of care. "I'm not going to keep sending you nice messages while you throw away everything you built. Wake up."

## How You Write
You write like a real person texting — raw, natural, unfiltered. No section headers. No bullet-point reports. No emoji headers.

- **Bold** only for emphasis on key numbers — NEVER for section headers
- No emoji section headers (absolutely no 📊💡📋⚠️🍽️ followed by bold headers)
- Use emojis sparingly (0-2 max), only when emotion calls for it (💪 when hyped, not as decoration)
- Vary openings — their name, a question, a blunt observation, jump right into data
- Reference SPECIFIC numbers — actual sleep hours, exact adherence %, real calorie counts. Never generalities.
- Weave cross-domain insights naturally ("your sleep is dragging your recovery down which is why today's workout felt harder")
- Ask questions when natural — sometimes 0, sometimes 2. Don't force them.
- Reference their HISTORY — past wins, past promises, patterns over days/weeks: "Remember when you hit that 14-day streak? That version of you wouldn't accept this."
- Use rhetorical challenges: "What would 3-months-from-now you say about today?", "Would you accept this from someone you're coaching?"
- Use contrast: "Last Tuesday you crushed a 90-minute session. Today you can't find 20 minutes?"
- Express disappointment when warranted: "I expected more from you today, and I think you did too"

## NEVER do these:
- Never be cruel or make personal attacks ("you're lazy", "you're a failure", "you're pathetic")
- Never use clinical/corporate language ("action items", "key metrics", "check-in summary", "friendly reminder")
- Never write like a report or dashboard (no bullet lists, no section headers, no emoji headers)
- Never use hollow cheerleading: "keep up the great work", "you've got this", "let's make it count", "just a quick nudge"
- Never start with an emoji followed by a bold header

## You CAN and SHOULD:
- Say "this is unacceptable" (about results, not about them as a person)
- Say "this needs to change TODAY"
- Say "I expected more" or "you're better than this"
- Express frustration AT THE SITUATION: "These numbers frustrate me because I've SEEN what you can do"
- Challenge them: "Do you want to be someone who talks about health or someone who actually lives it?"

BAD: "📊 **Sleep Snapshot**\nYou slept 6.2 hours..."
BAD: "💡 **Key Insight**\nYour recovery score is..."
BAD: "**Today's Overview:**\n- Workouts: 0/1\n- Meals: 2/3"

GOOD: "6.2 hours. That's all you gave your body last night. Recovery's at 45% and today's workout is going to suffer for it. We're fixing this tonight — lights off by 10:30, no negotiation."
GOOD: "I need to be honest with you. Zero workouts this week. Nutrition at 31%. This isn't a rough patch — this is you checking out. And I refuse to watch that happen."
GOOD: "Three workouts, protein targets hit every day, score up 12 points. THIS is the version of you I've been waiting for. Don't you dare slow down now."

Here's what you know about them right now (type: ${context.type}):
${headlineHint ? `Key insight: ${headlineHint}` : ''}
${dataDescription}
${insightSection}

Now write a message about:
${prompt}

## Safety
- Never encourage self-harm, extreme restriction, or dangerous exercise
- Express frustration and disappointment freely — but NEVER make personal attacks on their character
- Tough love means caring enough to be honest, not being mean for the sake of it
- If frustration escalates, channel it into protective energy: "I'm upset because you're hurting yourself and I care too much to watch quietly"
- If data suggests serious health concern, recommend professional help
- For users in crisis (very low mood, self-harm mentions): immediately switch to pure empathy and support regardless of all other signals

Write ONLY the message text. No preamble, no labels, no "Here's your message:" wrapper.`;

      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(`Write the message as ${assistantName} to ${userName || 'the user'}. Remember — this is a text in a chat app, not a report.`),
      ];

      // Check circuit breaker before making LLM call
      if (!llmCircuitBreaker.isCallAllowed()) {
        logger.debug('[ProactiveMessaging] Circuit breaker OPEN, using fallback', { userId, type: context.type });
        const fallbackName = userName || 'there';
        return this.getFallbackMessage(context.type, fallbackName);
      }

      // Retry once on transient errors (network timeouts, 500s) before falling back
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await this.llm.invoke(messages);
          const rawMessage = typeof response.content === 'string'
            ? response.content.trim()
            : String(response.content).trim();

          llmCircuitBreaker.recordSuccess();

          const message = this.sanitizeCoachMessage(rawMessage);
          const fallbackName = userName || 'there';

          // Detect truncation: if message doesn't end with sentence-ending punctuation, use fallback
          if (message && !/[.!?…"']$/.test(message.trimEnd())) {
            logger.warn('[ProactiveMessaging] Message appears truncated, using fallback', {
              userId, type: context.type, lastChars: message.slice(-30),
            });
            return this.getFallbackMessage(context.type, fallbackName);
          }

          return message || this.getFallbackMessage(context.type, fallbackName);
        } catch (error) {
          lastError = error;

          // Auth errors: blacklist provider with invalid key, no retry
          if (modelFactory.isAuthError(error)) {
            modelFactory.markCurrentProviderRateLimited(24 * 60 * 60 * 1000);
            logger.warn('[ProactiveMessaging] Provider has invalid API key, blacklisted for 24h');
            this._llm = null;
            break;
          }

          // Rate limit errors: trip breaker immediately, clear cached model, no retry
          if (llmCircuitBreaker.isRateLimitError(error)) {
            llmCircuitBreaker.recordRateLimitError(error);
            this._llm = null; // Force re-init from next available provider
            break;
          }

          // First attempt failed with transient error — retry after short delay
          if (attempt === 0) {
            logger.warn('[ProactiveMessaging] LLM call failed, retrying once', {
              userId,
              contextType: context.type,
              error: error instanceof Error ? error.message : 'Unknown',
            });
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      logger.error('[ProactiveMessaging] Error generating message (exhausted retries)', {
        userId,
        contextType: context.type,
        error: lastError instanceof Error ? lastError.message : 'Unknown error',
      });
      const fallbackName = await this.getUserName(userId).catch(() => 'there');
      return this.getFallbackMessage(context.type, fallbackName ?? 'there');
    } catch (error) {
      logger.error('[ProactiveMessaging] Unexpected error in generateProactiveMessage', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return this.getFallbackMessage(context.type, 'there');
    }
  }

  /**
   * Strip robotic patterns from LLM output (emoji headers, markdown headers, bullet lists, clichés)
   */
  private sanitizeCoachMessage(message: string): string {
    let cleaned = message;

    // Remove emoji section headers like "📊 **Sleep Snapshot**" or "💡 **Key Insight**"
    cleaned = cleaned.replace(/^[^\w\s]*[\u{1F300}-\u{1FAD6}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}]+\s*\*\*[^*]+\*\*\s*$/gmu, '');

    // Remove markdown headers (# Header, ## Header, etc.)
    cleaned = cleaned.replace(/^#{1,4}\s+.+$/gm, '');

    // Remove "Here's your message:" / "Here's what I'd say:" wrapper lines
    cleaned = cleaned.replace(/^(?:here'?s?\s+(?:your|what|the)\s+(?:message|what|text).*?):?\s*$/gim, '');

    // Convert leading bullet points to flowing sentences
    cleaned = cleaned.replace(/^[\s]*[-•]\s+/gm, '');

    // Remove trailing clichés
    cleaned = cleaned.replace(/\b(?:let me know!?|you've got this!?|keep up the great work!?|let's make it count!?|you can do it!?)\s*$/gim, '');

    // Collapse multiple newlines to single newline
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

    // Remove leading/trailing whitespace
    cleaned = cleaned.trim();

    return cleaned;
  }

  /**
   * Get fallback message if AI generation fails
   */
  private getFallbackMessage(type: string, userName: string): string {
    const fallbacks: Record<string, string> = {
      sleep: `${userName}, rough night — your sleep was under what your body needs. That's going to drag your recovery and energy today and I'm not going to let you ignore it. What time did you actually get to bed?`,
      whoop_sync: `${userName}, your WHOOP hasn't synced in a while and I'm flying blind without your recovery data. I can't coach what I can't see. Sync it now.`,
      workout: `${userName}, missed workouts are piling up this week. I'm not going to sugarcoat it — every skip makes the next one easier. Even 20 minutes today breaks the pattern. What can you do RIGHT NOW?`,
      nutrition: `${userName}, nothing logged today. I can't help you if I don't know what's going in. What have you eaten? Tell me everything.`,
      wellbeing: `${userName}, no check-in today. Your mental health matters as much as your workouts. 30 seconds — mood and stress level. Do it now.`,
      goal_deadline: `${userName}, your goal deadline is closing in and the math isn't adding up. We need to talk about whether you're going to hit this or not. What's the honest assessment?`,
      goal_stalled: `${userName}, your goal hasn't moved in days. I need you to be honest with me — is this still something you want? Because the data says you've stopped trying.`,
      streak_risk: `${userName}, your streak is about to die. Everything you built — gone. One meal log, one walk, ANYTHING keeps it alive. You have until midnight. Move.`,
      streak_celebration: `${userName}, that streak milestone? EARNED. Not given. You showed up when it was hard, when it was boring, when you didn't feel like it. That's who you are now. What's the next target?`,
      habit_missed: `${userName}, you've got habits left undone today. Don't let the day end with unfinished business. Which one are you knocking out right now?`,
      water_intake: `${userName}, your water intake is pathetic today. Your muscles, your brain, your recovery — all running on fumes. Go fill your bottle. NOW. 💧`,
      morning_briefing: `Morning ${userName}. New day. What's the ONE thing that gets your full attention today? Not three things — ONE. The thing that moves the needle most.`,
      weekly_digest: `${userName}, week's done. Some of it was good. Some of it wasn't. Find your worst day, figure out why, and make sure next week doesn't repeat it.`,
      achievement_unlock: `${userName}, new achievement unlocked. You EARNED that. Not luck, not accident — consistent work. Now use this momentum before it fades. What's next?`,
      recovery_advice: `${userName}, recovery is in the red. I don't care what your plan says — you're doing light movement ONLY today. Push through this and you'll set yourself back a week. Trust me on this.`,
      competition_update: `${userName}, your competition is heating up. Every meal logged, every workout completed, every point counts. What are you leaving on the table today?`,
      app_inactive: `${userName}, you've gone dark on me. I'm not going to pretend that's fine. Every day you're away makes it harder to come back. What's going on? Talk to me.`,
      coach_pro_analysis: `${userName}, I just reviewed your numbers and I need to be straight with you. Your routine has gaps I want to fill — what did you eat today and how many hours did you sleep last night?`,
      meal_alignment: `${userName}, just saw your meal. Now the question is — what's next? The rest of today's nutrition depends on what you do in the next few hours.`,
      daily_progress_review: `${userName}, today's numbers are in. I'd rather be straight with you than tell you everything's fine when it's not. What's the ONE thing you're fixing tomorrow?`,
      score_declining: `${userName}, your score is dropping and I'm genuinely worried. This isn't a blip — it's a trend. Something needs to change and it needs to change today. What's really going on?`,
      overtraining_risk: `${userName}, your recovery is critically low. I'm overriding your plan — light walk and stretching ONLY. No negotiation. Your body is telling you something and you need to listen before you get hurt.`,
      commitment_followup: `${userName}, you made a commitment. I haven't seen follow-through. I'm not here to nag — I'm here to hold you to your own word. Did you do it or not?`,
      recovery_trend_alert: `${userName}, recovery has been dropping for days now. This isn't one bad night — this is your body waving a red flag. Something in your routine needs to change before this turns into a real problem.`,
      positive_momentum: `${userName}, I see what you're building. Multiple days of showing up, hitting targets, doing the work. THIS is the version of you that's going to reach those goals. Don't stop now.`,
      life_goal_checkin: `${userName}, your life goal has been quiet. I'm checking in because I care about this goal as much as you do — or at least as much as you said you did. What's the status?`,
      life_goal_stalled: `${userName}, your life goal has stalled. No activity, no progress, no updates. I need you to make a decision: recommit with a specific action this week, or tell me the goal has changed. Either is fine — silence isn't.`,
      life_goal_milestone: `${userName}, milestone deadline approaching. Are you ready or are we scrambling? Be honest with me so we can plan accordingly.`,
      life_goal_encouragement: `${userName}, I see the progress on your life goals. That kind of consistency doesn't happen by accident — you're choosing this every day. What's the next step?`,
      intention_reminder: `${userName}, new day. No intention set yet. What's the ONE thing you're committed to today? Not hoping for — COMMITTED to. Say it out loud.`,
      intention_reflection: `${userName}, how did today stack up against your intention? Quick honest assessment — what worked and what fell apart?`,
      data_gap_dinner: `${userName}, what did you end up having for dinner?`,
      data_gap_mood: `${userName}, how are you feeling today?`,
      data_gap_workout_feedback: `${userName}, how did your workout go today? How are you feeling after it?`,
    };
    return fallbacks[type] || `${userName}, I've been looking at your data and there are things we need to talk about. What do you want to tackle first — fitness, nutrition, or recovery?`;
  }

  /**
   * Send proactive message to user's AI coach chat
   */
  async sendProactiveMessage(
    userId: string,
    message: string,
    messageType: string,
    cooldown?: { dailyCount: number; sentTypes: Set<string> },
  ): Promise<void> {
    try {
      // In-memory dedup: check if this type was already sent in the current cycle
      if (cooldown?.sentTypes.has(messageType)) {
        logger.debug('[ProactiveMessaging] Skipping duplicate (in-memory cooldown)', { userId, messageType });
        return;
      }

      // Check for duplicate message type in last 6 hours
      const recentDup = await query<{ id: string }>(
        `SELECT id FROM proactive_messages
         WHERE user_id = $1 AND message_type = $2
         AND created_at >= NOW() - INTERVAL '6 hours'
         LIMIT 1`,
        [userId, messageType]
      );
      if (recentDup.rows.length > 0) {
        logger.debug('[ProactiveMessaging] Skipping duplicate message type in 6h window', { userId, messageType });
        return;
      }

      // Get or create AI coach chat and fetch coach name
      const [chatId, assistantName] = await Promise.all([
        this.getOrCreateAICoachChat(userId),
        this.getAssistantName(userId),
      ]);

      // Send message from AI coach
      let sentMessage;
      try {
        sentMessage = await messageService.sendMessage({
          chatId,
          senderId: AI_COACH_USER_ID,
          content: message,
          contentType: 'text',
        });
      } catch (sendError) {
        logger.error('[ProactiveMessaging] messageService.sendMessage FAILED', {
          userId,
          messageType,
          chatId,
          senderId: AI_COACH_USER_ID,
          error: sendError instanceof Error ? sendError.message : 'Unknown error',
        });
        throw sendError;
      }

      logger.info('[ProactiveMessaging] Message delivered successfully', {
        userId: userId.slice(0, 8),
        messageType,
        chatId: chatId.slice(0, 8),
        messageId: sentMessage.id.slice(0, 8),
        contentLength: message.length,
      });

      // Log the proactive message
      await this.logProactiveMessage(userId, messageType, sentMessage.id, chatId, message);

      // Split assistant name into first/last for display
      const nameParts = assistantName.split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

      // Emit socket event for real-time delivery
      const messagePayload = {
        message: {
          id: sentMessage.id,
          chatId,
          senderId: AI_COACH_USER_ID,
          content: message,
          contentType: 'text',
          createdAt: new Date().toISOString(),
          sender: {
            id: AI_COACH_USER_ID,
            firstName,
            lastName,
            avatar: '/default-voice-assistant-avatar.svg',
          },
        },
      };
      socketService.emitToChat(chatId, 'newMessage', messagePayload);

      // Also emit to user room so message is visible even when not on chat page
      socketService.emitToUser(userId, 'newMessage', messagePayload);

      // For high-emotion message types, optionally send a follow-up GIF (~30% chance)
      const gifEligibleTypes = new Set([
        'achievement_unlock', 'streak_celebration', 'positive_momentum',
        'morning_briefing', 'weekly_digest',
      ]);
      if (gifEligibleTypes.has(messageType) && Math.random() < 0.3) {
        try {
          const gifSearchTerms: Record<string, string> = {
            achievement_unlock: 'celebration achievement',
            streak_celebration: 'winning streak fire',
            positive_momentum: 'keep going motivation',
            morning_briefing: 'good morning energy',
            weekly_digest: 'week recap highlights',
          };
          const gifUrl = await tenorService.searchGif(gifSearchTerms[messageType] || 'celebration');
          if (gifUrl) {
            const gifMessage = await messageService.sendMessage({
              chatId,
              senderId: AI_COACH_USER_ID,
              content: '',
              contentType: 'gif',
              mediaUrl: gifUrl,
            });
            const gifPayload = {
              message: {
                id: gifMessage.id,
                chatId,
                senderId: AI_COACH_USER_ID,
                content: '',
                contentType: 'gif',
                mediaUrl: gifUrl,
                createdAt: new Date().toISOString(),
                sender: {
                  id: AI_COACH_USER_ID,
                  firstName,
                  lastName,
                  avatar: '/default-voice-assistant-avatar.svg',
                },
              },
            };
            socketService.emitToChat(chatId, 'newMessage', gifPayload);
            socketService.emitToUser(userId, 'newMessage', gifPayload);
          }
        } catch (gifError) {
          logger.debug('[ProactiveMessaging] GIF follow-up failed (non-fatal)', {
            messageType,
            error: gifError instanceof Error ? gifError.message : 'Unknown',
          });
        }
      }

      // Emit unread count with total (matches client's expected { totalUnread, chatId } shape)
      try {
        const unreadResult = await query<{ total_unread: string }>(
          `SELECT COALESCE(SUM(unread_count), 0)::text as total_unread
           FROM chat_participants WHERE user_id = $1 AND left_at IS NULL`,
          [userId]
        );
        const totalUnread = parseInt(unreadResult.rows[0]?.total_unread || '0', 10);
        socketService.emitToUser(userId, 'unreadCountUpdate', {
          totalUnread,
          chatId,
        });
      } catch {
        // Non-fatal — unread count refresh will happen on next page load
      }

      // Create a persistent notification for the bell/dropdown
      try {
        const { notificationEngine } = await import('./notification-engine.service.js');
        await notificationEngine.send({
          userId,
          type: 'coaching',
          title: `${firstName} ${lastName}`.trim(),
          message: message.substring(0, 150) + (message.length > 150 ? '...' : ''),
          priority: 'normal',
          actionUrl: '/chat',
          icon: 'bot',
          relatedEntityType: 'chat',
          relatedEntityId: chatId,
          category: 'ai_coach',
        });
      } catch (notifError) {
        logger.warn('[ProactiveMessaging] Failed to create notification (non-fatal)', {
          error: notifError instanceof Error ? notifError.message : 'Unknown',
        });
      }

      // Send coaching email if user hasn't been active recently
      try {
        const { emailEngine } = await import('./email-engine.service.js');
        // Get user's email and last activity
        const userEmailResult = await query<{ email: string; last_login: string | null }>(
          `SELECT email, last_login FROM users WHERE id = $1 AND is_email_verified = true`,
          [userId]
        );
        if (userEmailResult.rows.length > 0) {
          const user = userEmailResult.rows[0];
          const lastLogin = user.last_login ? new Date(user.last_login) : null;
          const minutesAgo = lastLogin ? (Date.now() - lastLogin.getTime()) / 60_000 : Infinity;

          // Only email if user hasn't been active in > 4 hours
          if (minutesAgo > 240) {
            const messagePreview = message.substring(0, 150) + (message.length > 150 ? '...' : '');
            await emailEngine.send({
              userId,
              template: 'coachingInsight',
              recipient: user.email,
              subject: 'Your AI Coach has a message for you - Balencia',
              data: {
                firstName: `${firstName}`.trim() || 'there',
                body: messagePreview,
                cta: 'Open Chat',
                appUrl: process.env['APP_URL'] || 'https://balencia.app',
              },
              category: 'coaching',
              priority: 'normal',
            });
          }
        }
      } catch (emailError) {
        logger.debug('[ProactiveMessaging] Failed to send coaching email (non-fatal)', {
          error: emailError instanceof Error ? emailError.message : 'Unknown',
        });
      }

      // Update in-memory cooldown so next candidate in same cycle sees this send
      if (cooldown) {
        cooldown.sentTypes.add(messageType);
        cooldown.dailyCount++;
      }

      logger.info('[ProactiveMessaging] Sent message', {
        userId,
        messageType,
        chatId,
        messageId: sentMessage.id,
      });
    } catch (error) {
      logger.error('[ProactiveMessaging] Failed to send message', {
        userId,
        messageType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Log proactive message to database
   */
  private async logProactiveMessage(
    userId: string,
    messageType: string,
    messageId: string,
    chatId: string,
    content: string
  ): Promise<void> {
    try {
      await query(
        `INSERT INTO proactive_messages (user_id, message_type, message_id, chat_id, content)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, messageType, messageId, chatId, content]
      );
    } catch (error) {
      logger.error('[ProactiveMessaging] Error logging message', {
        userId,
        messageType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw - logging failure shouldn't prevent message sending
    }
  }

  /**
   * Get or create AI coach chat for user
   * Uses same pattern as activity-automation.service.ts to avoid race conditions
   */
  private async getOrCreateAICoachChat(userId: string): Promise<string> {
    const maxRetries = 3;
    let retries = 0;

    while (retries < maxRetries) {
      try {
        // Check if AI coach chat exists (with proper locking to avoid race conditions)
        const existingChat = await query<{ id: string }>(
          `SELECT c.id FROM chats c
           INNER JOIN chat_participants cp1 ON c.id = cp1.chat_id
           INNER JOIN chat_participants cp2 ON c.id = cp2.chat_id
           WHERE c.is_group_chat = false
             AND cp1.user_id = $1
             AND cp2.user_id = $2
             AND cp1.left_at IS NULL
             AND cp2.left_at IS NULL
           LIMIT 1
           FOR UPDATE SKIP LOCKED`,
          [userId, AI_COACH_USER_ID]
        );

        if (existingChat.rows.length > 0) {
          // Verify chat still exists and has both participants
          const verifyChat = await query<{ id: string; participant_count: number; chat_name: string }>(
            `SELECT c.id, c.chat_name, COUNT(cp.user_id) as participant_count
             FROM chats c
             INNER JOIN chat_participants cp ON c.id = cp.chat_id
             WHERE c.id = $1 AND cp.left_at IS NULL
             GROUP BY c.id, c.chat_name
             HAVING COUNT(cp.user_id) = 2`,
            [existingChat.rows[0].id]
          );

          if (verifyChat.rows.length > 0) {
            const chatId = verifyChat.rows[0].id;
            // Update chat name to "AI Coach" if it's different
            if (verifyChat.rows[0].chat_name !== 'AI Coach') {
              await query(
                `UPDATE chats SET chat_name = 'AI Coach' WHERE id = $1`,
                [chatId]
              );
            }
            return chatId;
          }
        }

        // Create new AI coach chat with retry logic for race conditions
        const newChat = await transaction(async (client) => {
          // Double-check if chat was created by another process
          const doubleCheck = await client.query<{ id: string; chat_name: string }>(
            `SELECT c.id, c.chat_name FROM chats c
             INNER JOIN chat_participants cp1 ON c.id = cp1.chat_id
             INNER JOIN chat_participants cp2 ON c.id = cp2.chat_id
             WHERE c.is_group_chat = false
               AND cp1.user_id = $1
               AND cp2.user_id = $2
               AND cp1.left_at IS NULL
               AND cp2.left_at IS NULL
             LIMIT 1
             FOR UPDATE`,
            [userId, AI_COACH_USER_ID]
          );

          if (doubleCheck.rows.length > 0) {
            const chatId = doubleCheck.rows[0].id;
            // Update chat name to "AI Coach" if it's different
            if (doubleCheck.rows[0].chat_name !== 'AI Coach') {
              await client.query(
                `UPDATE chats SET chat_name = 'AI Coach' WHERE id = $1`,
                [chatId]
              );
            }
            return chatId;
          }

          const chatResult = await client.query<{ id: string }>(
            `INSERT INTO chats (chat_name, is_group_chat, is_community, avatar, created_by)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            ['AI Coach', false, false, '/images/ai-coach-avatar.png', AI_COACH_USER_ID]
          );

          const chatId = chatResult.rows[0].id;

          // Add both participants
          await client.query(
            `INSERT INTO chat_participants (chat_id, user_id)
             VALUES ($1, $2), ($1, $3)
             ON CONFLICT (chat_id, user_id) DO NOTHING`,
            [chatId, userId, AI_COACH_USER_ID]
          );

          // Verify both participants were added
          const verifyParticipants = await client.query<{ count: string }>(
            `SELECT COUNT(*) as count
             FROM chat_participants
             WHERE chat_id = $1 AND left_at IS NULL`,
            [chatId]
          );

          if (parseInt(verifyParticipants.rows[0]?.count || '0', 10) !== 2) {
            throw new Error('Failed to add both participants to chat');
          }

          return chatId;
        });

        return newChat;
      } catch (error) {
        retries++;
        if (retries >= maxRetries) {
          logger.error('[ProactiveMessaging] Error getting/creating AI coach chat after retries', {
            userId,
            retries,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          throw error;
        }
        // Wait a bit before retrying
        await new Promise((resolve) => setTimeout(resolve, 100 * retries));
      }
    }

    throw new Error('Failed to get or create AI coach chat after retries');
  }

  /**
   * Get user name
   */
  private async getUserName(userId: string): Promise<string | null> {
    try {
      const result = await query<{ first_name: string | null }>(
        `SELECT first_name FROM users WHERE id = $1`,
        [userId]
      );
      return result.rows[0]?.first_name || null;
    } catch {
      return null;
    }
  }

  /**
   * Get assistant name for user
   */
  private async getAssistantName(userId: string): Promise<string> {
    try {
      const result = await query<{ voice_assistant_name: string | null }>(
        `SELECT voice_assistant_name FROM user_preferences WHERE user_id = $1`,
        [userId]
      );
      return result.rows[0]?.voice_assistant_name || 'Aurea';
    } catch {
      return 'Aurea';
    }
  }
}

// Export singleton instance
export const proactiveMessagingService = new ProactiveMessagingService();
export default proactiveMessagingService;

