/**
 * @file Comprehensive User Context Service
 * @description Gathers complete user data for AI assistant context
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import { getUserHealthProfile, getRecoveryTrends, getSleepTrends, getStrainTrends } from './whoop-analytics.service.js';
import { wellbeingContextService } from './wellbeing-context.service.js';
import { gamificationService } from './gamification.service.js';
import { waterIntakeService } from './water-intake.service.js';
import { aiScoringService } from './ai-scoring.service.js';
import { cache } from './cache.service.js';
import { dailyAnalysisService } from './daily-analysis.service.js';
import { motivationTierService } from './motivation-tier.service.js';
import type { MotivationTier } from '../../../shared/types/domain/wellbeing.js';
import type { ActivityStatusContext, StatusPattern } from '../types/activity-status.types.js';

// ============================================
// TYPES
// ============================================

export interface WhoopContext {
  isConnected: boolean;
  lastSyncAt: Date | null;
  lastSleep?: {
    duration: number; // hours
    quality: number; // percentage
    efficiency: number; // percentage
    hoursAgo: number;
    timestamp: string;
  };
  lastRecovery?: {
    score: number; // percentage
    hrv: number; // ms
    rhr: number; // bpm
    hoursAgo: number;
    timestamp: string;
  };
  todayStrain?: {
    score: number;
    normalized: number;
    calories?: number;
    timestamp: string;
  };
  needsSync?: boolean; // true if connected but no recent data
  syncHoursAgo?: number;

  // 7-day averages
  avg7d?: {
    recovery: number | null;
    hrv: number | null;
    rhr: number | null;
    sleepHours: number | null;
    sleepQuality: number | null;
    strain: number | null;
  };
  // 30-day baselines (personal averages for comparison)
  baseline30d?: {
    recovery: number | null;
    hrv: number | null;
    rhr: number | null;
    sleepHours: number | null;
    sleepQuality: number | null;
    strain: number | null;
  };
  // Trend directions (last 3d vs prior 4d in 7d window)
  trends?: {
    recovery: 'improving' | 'stable' | 'declining' | null;
    hrv: 'improving' | 'stable' | 'declining' | null;
    rhr: 'improving' | 'stable' | 'declining' | null;
    sleep: 'improving' | 'stable' | 'declining' | null;
    strain: 'improving' | 'stable' | 'declining' | null;
  };
  // Sleep stage breakdown (last sleep)
  sleepStages?: {
    remPercent: number;
    deepPercent: number;
    lightPercent: number;
  };
  // Extra biometrics from recovery
  spo2?: number;
  skinTempCelsius?: number;
  // Recovery/strain sustainability ratio (> 1 = sustainable, < 1 = overreaching)
  recoveryStrainRatio?: number;
}

export interface LifestyleContext {
  dailySchedules?: Array<{
    date: string;
    itemCount: number;
    categories: string[];
  }>;
  scheduleContext?: {
    stressLevel: string;
    totalItems: number;
    busyHours: number;
    freeHours: number;
    freeWindows: Array<{ startTime: string; endTime: string; durationMinutes: number }>;
    hasEarlyMorning: boolean;
    hasLateNight: boolean;
    longestFreeWindowMinutes: number | null;
    backToBackCount: number;
  };
  activeHabits?: number;
  routines?: Array<{
    name: string;
    frequency: string;
  }>;
  preferences?: {
    preferredWorkoutTime?: string;
    preferredCheckInTime?: string;
    coachingStyle?: string;
    coachingIntensity?: string;
    useEmojis?: boolean;
    formalityLevel?: string;
    encouragementLevel?: string;
    focusAreas?: string[];
    messageStyle?: string;
  };
}

export interface WorkoutContext {
  recentWorkouts?: Array<{
    name: string;
    date: Date;
    status: string;
    hoursAgo: number;
  }>;
  activePlans?: Array<{
    name: string;
    type: string;
    progress: number;
  }>;
  completionRate?: number; // percentage over last 7 days
  missedWorkouts?: number; // count of missed workouts in last 7 days
  lastWorkoutDate?: Date;
}

export interface NutritionContext {
  recentMeals?: Array<{
    name: string;
    eatenAt: Date;
    hoursAgo: number;
  }>;
  activeDietPlan?: {
    name: string;
    dailyCalories: number;
    mealsPerDay?: number;
    adherence?: number; // percentage
  };
  todayMealCount?: number;
  lastMealDate?: Date;
}

export interface ChatHistoryContext {
  recentConversations?: Array<{
    title: string;
    lastMessage: string;
    date: Date;
    messageCount: number;
  }>;
  topics?: string[];
  lastConversationDate?: Date;
}

export interface GoalsContext {
  activeGoals?: Array<{
    title: string;
    category: string;
    progress: number; // percentage
    targetDate: Date;
    daysRemaining: number;
  }>;
  approachingDeadlines?: number; // goals with deadlines in next 7 days
  // Life goals (non-health: financial, faith, relationships, career, etc.)
  activeLifeGoals?: Array<{
    id: string;
    category: string;
    title: string;
    progress: number;
    trackingMethod: string;
    lastCheckinDate?: string;
    lastMentionedAt?: string;
    journalMentionCount: number;
    avgSentiment?: number;
    daysSinceLastActivity?: number;
    milestoneCount?: number;
    milestonesCompleted?: number;
  }>;
  lifeGoalCount?: number;
  stalledLifeGoals?: number; // no activity in 7+ days
  todayIntentions?: Array<{ text: string; fulfilled?: boolean; domain?: string }>;
  intentionFulfillmentRate?: number;
  motivationTier?: MotivationTier;
}

export interface BodyStatsContext {
  latestWeight?: {
    value: number;
    unit: string;
    date: Date;
    daysAgo: number;
  };
  measurements?: {
    height?: number;
    bodyFat?: number;
    waist?: number;
    hip?: number;
    chest?: number;
  };
}

export interface GamificationContext {
  totalXP?: number;
  currentLevel?: number;
  currentStreak?: number;
  longestStreak?: number;
  lastActivityDate?: string | null;
  streakAtRisk?: boolean;
  streakMilestoneReached?: number | null;
}

export interface HabitContext {
  activeHabits?: Array<{
    name: string;
    frequency: string;
    completionRate7Days: number;
    completedToday: boolean;
    currentStreak: number;
  }>;
  totalActiveHabits?: number;
  todayCompletionCount?: number;
  todayTotalHabits?: number;
  overallCompletionRate7Days?: number;
}

export interface MentalHealthContext {
  latestRecoveryScore?: number;
  recoveryTrend?: 'improving' | 'stable' | 'declining';
  latestEmotionalCheckin?: {
    overallMoodScore?: number;
    anxietyScore?: number;
    riskLevel?: string;
    hoursAgo: number;
  };
  journalSentimentTrend?: 'positive' | 'neutral' | 'negative';
  recentJournalCount?: number;
}

export interface WaterIntakeContext {
  todayMlConsumed?: number;
  todayTargetMl?: number;
  todayPercentage?: number;
  goalAchievedToday?: boolean;
  weeklyAverage?: number;
  waterStreak?: number;
}

export interface DailyScoreContext {
  latestScore?: number;
  latestDate?: string;
  componentScores?: {
    workout: number;
    nutrition: number;
    wellbeing: number;
    biometrics: number;
    engagement: number;
    consistency: number;
  };
  scoreTrend?: 'improving' | 'stable' | 'declining';
  previousScore?: number;
  scoreDelta?: number;
  weekOverWeekDelta?: number;
}

export interface NutritionAnalysisContext {
  todayCalorieDeviation?: number;
  todayDeviationClass?: string;
  weeklyAdherenceRate?: number;
  latestAnalysisDate?: string;
}

export interface CompetitionContext {
  activeCompetitions?: Array<{
    name: string;
    currentRank?: number;
    currentScore?: number;
    daysRemaining: number;
    metric: string;
  }>;
  competitionCount?: number;
}

export interface ProgressTrendContext {
  weightTrend?: 'losing' | 'gaining' | 'stable' | 'no_data';
  weightChangeKg?: number;
  latestWeight?: number;
  latestWeightUnit?: string;
}

export interface ComprehensiveUserContext {
  whoop: WhoopContext;
  lifestyle: LifestyleContext;
  workouts: WorkoutContext;
  nutrition: NutritionContext;
  wellbeing: any; // WellbeingContext from wellbeing-context.service.ts
  chatHistory: ChatHistoryContext;
  goals: GoalsContext;
  bodyStats: BodyStatsContext;
  gamification: GamificationContext;
  habits: HabitContext;
  mentalHealth: MentalHealthContext;
  waterIntake: WaterIntakeContext;
  dailyScore: DailyScoreContext;
  nutritionAnalysis: NutritionAnalysisContext;
  competitions: CompetitionContext;
  progressTrend: ProgressTrendContext;
  activityStatus: ActivityStatusContext;
  contextState?: import('./correlation-engine.service.js').UserContextState;
}

// ============================================
// COMPACT CONTEXT (lightweight, 2h-cached, for high-frequency jobs)
// ============================================

export interface CompactMessageContext {
  recoveryScore: number | null;
  sleepHours: number | null;
  streakDays: number;
  dailyScore: number | null;
  waterPct: number | null;
  nutritionAdherence: number | null;
  topInsight: string | null;
  coachingTone: string;
  primaryFocusArea: string | null;
  userName: string;
  assistantName: string;
}

// ============================================
// SERVICE CLASS
// ============================================

class ComprehensiveUserContextService {
  // In-memory cache: userId -> { data, expiresAt }
  private contextCache = new Map<string, { data: ComprehensiveUserContext; expiresAt: number }>();
  private static CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours (reduced query load; invalidateCache() busts on new data)

  /**
   * Get comprehensive user context for AI assistant.
   * Results are cached for 4 hours to reduce database load from
   * background jobs that process all users in batches.
   * Call invalidateCache(userId) when new data is logged.
   */
  async getComprehensiveContext(userId: string): Promise<ComprehensiveUserContext> {
    // Check cache first
    const cached = this.contextCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      logger.debug('[ComprehensiveUserContext] Cache hit — skipping 16 queries', { userId: userId.slice(0, 8) });
      return cached.data;
    }

    try {
      // Fetch in 4 waves (4-5 queries each) to avoid exhausting the DB connection pool.
      // 16 parallel queries would require 16+ connections simultaneously — with a pool of 20
      // and other concurrent requests, this causes "timeout exceeded" errors.

      // Wave 1: Core health data (5 queries)
      const [whoop, lifestyle, workouts, nutrition, activityStatus] = await Promise.all([
        this.getWhoopContext(userId),
        this.getLifestyleContext(userId),
        this.getWorkoutContext(userId),
        this.getNutritionContext(userId),
        this.getActivityStatusContext(userId),
      ]);

      // Wave 2: Wellbeing + social (4 queries)
      const [wellbeing, chatHistory, goals, bodyStats] = await Promise.all([
        wellbeingContextService.getWellbeingContext(userId),
        this.getChatHistoryContext(userId),
        this.getGoalsContext(userId),
        this.getBodyStatsContext(userId),
      ]);

      // Wave 3: Engagement data (4 queries)
      const [gamification, habits, mentalHealth, waterIntake] = await Promise.all([
        this.getGamificationContext(userId),
        this.getHabitContext(userId),
        this.getMentalHealthContext(userId),
        this.getWaterIntakeContext(userId),
      ]);

      // Wave 4: Analytics + competitions (4 queries)
      const [dailyScore, nutritionAnalysis, competitions, progressTrend] = await Promise.all([
        this.getDailyScoreContext(userId),
        this.getNutritionAnalysisContext(userId),
        this.getCompetitionContext(userId),
        this.getProgressTrendContext(userId),
      ]);

      const result: ComprehensiveUserContext = {
        whoop, lifestyle, workouts, nutrition, wellbeing, chatHistory, goals, bodyStats,
        gamification, habits, mentalHealth, waterIntake, dailyScore, nutritionAnalysis,
        competitions, progressTrend, activityStatus,
      };

      // Compute unified life state via correlation engine
      try {
        const { correlationEngine } = await import('./correlation-engine.service.js');
        result.contextState = correlationEngine.computeState(result);
      } catch {
        // Correlation engine is non-critical
      }

      // Cache the result
      this.contextCache.set(userId, {
        data: result,
        expiresAt: Date.now() + ComprehensiveUserContextService.CACHE_TTL_MS,
      });

      // Prune expired entries periodically (every 100 calls)
      if (this.contextCache.size > 100) {
        const now = Date.now();
        for (const [key, entry] of this.contextCache) {
          if (entry.expiresAt <= now) this.contextCache.delete(key);
        }
      }

      return result;
    } catch (error) {
      logger.error('[ComprehensiveUserContext] Error building context', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        whoop: { isConnected: false, lastSyncAt: null },
        lifestyle: {},
        workouts: {},
        nutrition: {},
        wellbeing: {},
        chatHistory: {},
        goals: {},
        bodyStats: {},
        gamification: {},
        habits: {},
        mentalHealth: {},
        waterIntake: {},
        dailyScore: {},
        nutritionAnalysis: {},
        competitions: {},
        progressTrend: {},
        activityStatus: { current: 'working', since: new Date().toISOString(), source: 'manual', recentHistory: [], patterns: [], activeOverrides: false, daysSinceLastWorkingStatus: 0 },
      };
    }
  }

  /**
   * Invalidate cached context for a user (call when new data is logged).
   */
  invalidateCache(userId: string): void {
    this.contextCache.delete(userId);
    // Also bust the compact context cache
    const today = new Date().toISOString().slice(0, 10);
    cache.delete(`compact_ctx:${userId}:${today}`);
  }

  /**
   * Lightweight context for high-frequency jobs (schedule/activity automation).
   * Uses NodeCache with 2h TTL — avoids the 16-query getComprehensiveContext().
   * Returns targeted fields: WHOOP recovery/sleep, streak, score, hydration,
   * nutrition adherence, top insight, coaching tone, and user/assistant names.
   */
  async getCompactMessageContext(userId: string): Promise<CompactMessageContext> {
    const today = new Date().toISOString().slice(0, 10);
    const cacheKey = `compact_ctx:${userId}:${today}`;
    const COMPACT_TTL = 7200; // 2 hours

    return cache.getOrSet<CompactMessageContext>(cacheKey, async () => {
      try {
        // Check which optional tables exist to avoid "relation does not exist" parse errors
        const tableCheck = await query<{ tablename: string }>(
          `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1)`,
          [['whoop_data', 'gamification_profiles', 'daily_user_scores', 'water_targets', 'water_intake', 'nutrition_analysis']]
        );
        const existingTables = new Set(tableCheck.rows.map(r => r.tablename));

        // Build CTEs conditionally — missing tables get NULL/empty stubs
        const whoopCte = existingTables.has('whoop_data')
          ? `whoop_latest AS (
              SELECT
                (recovery_data->'Score'->>'recovery_score')::numeric AS recovery_score,
                CASE
                  WHEN sleep_data->'Sleep'->>'total_in_bed_time_milli' IS NOT NULL
                  THEN (sleep_data->'Sleep'->>'total_in_bed_time_milli')::numeric / 3600000
                  ELSE NULL
                END AS sleep_hours
              FROM whoop_data
              WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '48 hours'
              ORDER BY created_at DESC
              LIMIT 1
            )`
          : `whoop_latest AS (SELECT NULL::numeric AS recovery_score, NULL::numeric AS sleep_hours WHERE false)`;

        const streakCte = existingTables.has('gamification_profiles')
          ? `streak AS (
              SELECT COALESCE(current_streak, 0) AS streak_days
              FROM gamification_profiles WHERE user_id = $1
            )`
          : `streak AS (SELECT 0 AS streak_days WHERE false)`;

        const scoreCte = existingTables.has('daily_user_scores')
          ? `score AS (
              SELECT total_score AS daily_score FROM daily_user_scores
              WHERE user_id = $1 ORDER BY date DESC LIMIT 1
            )`
          : `score AS (SELECT NULL::numeric AS daily_score WHERE false)`;

        const waterCte = existingTables.has('water_targets') && existingTables.has('water_intake')
          ? `water AS (
              SELECT
                CASE WHEN wt.daily_target_ml > 0
                  THEN ROUND((COALESCE(SUM(wi.amount_ml), 0) / wt.daily_target_ml * 100)::numeric)
                  ELSE NULL
                END AS water_pct
              FROM water_targets wt
              LEFT JOIN water_intake wi ON wi.user_id = wt.user_id AND wi.consumed_at::date = CURRENT_DATE
              WHERE wt.user_id = $1
              GROUP BY wt.daily_target_ml
            )`
          : `water AS (SELECT NULL::numeric AS water_pct WHERE false)`;

        const nutritionCte = existingTables.has('nutrition_analysis')
          ? `nutrition AS (
              SELECT weekly_adherence_rate AS nutrition_adherence FROM nutrition_analysis
              WHERE user_id = $1 ORDER BY analysis_date DESC LIMIT 1
            )`
          : `nutrition AS (SELECT NULL::numeric AS nutrition_adherence WHERE false)`;

        // Single query: recovery, sleep, streak, daily score, water%, nutrition adherence, user name, assistant name
        const result = await query<{
          recovery_score: number | null;
          sleep_hours: number | null;
          streak_days: string;
          daily_score: number | null;
          water_pct: number | null;
          nutrition_adherence: number | null;
          user_name: string;
          assistant_name: string;
        }>(`
          WITH ${whoopCte},
          ${streakCte},
          ${scoreCte},
          ${waterCte},
          ${nutritionCte},
          user_info AS (
            SELECT
              (u.first_name || ' ' || u.last_name) AS user_name,
              COALESCE(up.voice_assistant_name, 'Coach') AS assistant_name
            FROM users u
            LEFT JOIN user_preferences up ON up.user_id = u.id
            WHERE u.id = $1
          )
          SELECT
            wl.recovery_score,
            wl.sleep_hours,
            COALESCE(s.streak_days, 0) AS streak_days,
            sc.daily_score,
            w.water_pct,
            n.nutrition_adherence,
            ui.user_name,
            ui.assistant_name
          FROM user_info ui
          LEFT JOIN whoop_latest wl ON true
          LEFT JOIN streak s ON true
          LEFT JOIN score sc ON true
          LEFT JOIN water w ON true
          LEFT JOIN nutrition n ON true
        `, [userId]);

        const row = result.rows[0];

        // Fetch daily analysis report for coaching directive + top insight
        let topInsight: string | null = null;
        let coachingTone = 'supportive';
        let primaryFocusArea: string | null = null;

        try {
          const report = await dailyAnalysisService.getLatestReport(userId);
          if (report) {
            if (report.insights?.length > 0) {
              topInsight = report.insights[0].claim;
            }
            if (report.coachingDirective) {
              coachingTone = report.coachingDirective.toneRecommendation || 'supportive';
              primaryFocusArea = report.coachingDirective.focusAreas?.[0] ?? null;
            }
          }
        } catch (err) {
          logger.warn('[CompactMessageContext] Could not fetch daily analysis', {
            userId,
            error: err instanceof Error ? err.message : 'Unknown',
          });
        }

        return {
          recoveryScore: row?.recovery_score != null ? Number(row.recovery_score) : null,
          sleepHours: row?.sleep_hours != null ? Math.round(Number(row.sleep_hours) * 10) / 10 : null,
          streakDays: parseInt(row?.streak_days as unknown as string, 10) || 0,
          dailyScore: row?.daily_score != null ? Number(row.daily_score) : null,
          waterPct: row?.water_pct != null ? Number(row.water_pct) : null,
          nutritionAdherence: row?.nutrition_adherence != null ? Number(row.nutrition_adherence) : null,
          topInsight,
          coachingTone,
          primaryFocusArea,
          userName: row?.user_name || 'there',
          assistantName: row?.assistant_name || 'Coach',
        };
      } catch (error) {
        logger.error('[CompactMessageContext] Error building compact context', {
          userId,
          error: error instanceof Error ? error.message : 'Unknown',
        });
        // Return safe defaults — callers can still generate messages
        return {
          recoveryScore: null,
          sleepHours: null,
          streakDays: 0,
          dailyScore: null,
          waterPct: null,
          nutritionAdherence: null,
          topInsight: null,
          coachingTone: 'supportive',
          primaryFocusArea: null,
          userName: 'there',
          assistantName: 'Coach',
        };
      }
    }, COMPACT_TTL);
  }

  /**
   * Get WHOOP context
   */
  async getWhoopContext(userId: string): Promise<WhoopContext> {
    try {
      const now = new Date();
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date(now);

      const whoopData = await getUserHealthProfile(userId, startDate, endDate);

      const context: WhoopContext = {
        isConnected: whoopData._meta?.hasIntegration ?? false,
        lastSyncAt: whoopData._meta?.lastSyncAt ?? null,
      };

      // Check if needs sync (connected but no recent data)
      if (context.isConnected && whoopData._meta?.lastSyncAt) {
        const syncHoursAgo = (now.getTime() - new Date(whoopData._meta.lastSyncAt).getTime()) / (1000 * 60 * 60);
        context.syncHoursAgo = syncHoursAgo;
        context.needsSync = syncHoursAgo > 24; // No data in last 24 hours
      } else if (context.isConnected && !whoopData._meta?.hasAnyData) {
        context.needsSync = true;
      }

      // Last sleep data
      if (whoopData.currentSleep) {
        const sleepDate = new Date(whoopData.currentSleep.timestamp);
        const hoursAgo = (now.getTime() - sleepDate.getTime()) / (1000 * 60 * 60);
        context.lastSleep = {
          duration: whoopData.currentSleep.duration,
          quality: whoopData.currentSleep.quality,
          efficiency: whoopData.currentSleep.efficiency,
          hoursAgo: Math.round(hoursAgo * 10) / 10,
          timestamp: whoopData.currentSleep.timestamp,
        };
      }

      // Last recovery data
      if (whoopData.currentRecovery) {
        const recoveryDate = new Date(whoopData.currentRecovery.timestamp);
        const hoursAgo = (now.getTime() - recoveryDate.getTime()) / (1000 * 60 * 60);
        context.lastRecovery = {
          score: whoopData.currentRecovery.score,
          hrv: whoopData.currentRecovery.hrv,
          rhr: whoopData.currentRecovery.rhr,
          hoursAgo: Math.round(hoursAgo * 10) / 10,
          timestamp: whoopData.currentRecovery.timestamp,
        };
      }

      // Today's strain
      if (whoopData.todayStrain) {
        context.todayStrain = {
          score: whoopData.todayStrain.score,
          normalized: whoopData.todayStrain.normalized,
          calories: whoopData.todayStrain.calories,
          timestamp: whoopData.todayStrain.timestamp,
        };
      }

      // Extract SPO2 and skin temp from recovery (already in whoopData)
      if (whoopData.currentRecovery?.spo2) {
        context.spo2 = whoopData.currentRecovery.spo2;
      }
      if (whoopData.currentRecovery?.skinTemp) {
        context.skinTempCelsius = whoopData.currentRecovery.skinTemp;
      }

      // Fetch 30-day trends for baselines + compute 7d averages (only if connected and has data)
      if (context.isConnected && !context.needsSync) {
        try {
          const [recovery30d, sleep30d, strain30d] = await Promise.all([
            getRecoveryTrends(userId, 30),
            getSleepTrends(userId, 30),
            getStrainTrends(userId, 30),
          ]);

          const avgField = <T>(arr: T[], getter: (item: T) => number): number | null => {
            const vals = arr.map(getter).filter(v => v > 0);
            return vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
          };

          // 30-day baselines
          context.baseline30d = {
            recovery: avgField(recovery30d, r => r.recovery_score),
            hrv: avgField(recovery30d, r => r.hrv_rmssd_ms),
            rhr: avgField(recovery30d, r => r.resting_heart_rate_bpm),
            sleepHours: avgField(sleep30d, s => s.duration_minutes / 60),
            sleepQuality: avgField(sleep30d, s => s.sleep_quality_score),
            strain: avgField(strain30d, s => s.strain_score),
          };

          // 7d averages from last 7 entries of 30d data
          const last7Recovery = recovery30d.slice(-7);
          const last7Sleep = sleep30d.slice(-7);
          const last7Strain = strain30d.slice(-7);
          context.avg7d = {
            recovery: avgField(last7Recovery, r => r.recovery_score),
            hrv: avgField(last7Recovery, r => r.hrv_rmssd_ms),
            rhr: avgField(last7Recovery, r => r.resting_heart_rate_bpm),
            sleepHours: avgField(last7Sleep, s => s.duration_minutes / 60),
            sleepQuality: avgField(last7Sleep, s => s.sleep_quality_score),
            strain: avgField(last7Strain, s => s.strain_score),
          };

          // Trend direction: compare last 3d avg vs prior 4d avg in 7d window
          const computeTrend = (
            recent: number[],
            older: number[],
            lowerIsBetter = false,
          ): 'improving' | 'stable' | 'declining' | null => {
            const validRecent = recent.filter(v => v > 0);
            const validOlder = older.filter(v => v > 0);
            if (validRecent.length === 0 || validOlder.length === 0) return null;
            const recentAvg = validRecent.reduce((a, b) => a + b, 0) / validRecent.length;
            const olderAvg = validOlder.reduce((a, b) => a + b, 0) / validOlder.length;
            const delta = ((recentAvg - olderAvg) / olderAvg) * 100;
            if (Math.abs(delta) < 5) return 'stable';
            const improving = lowerIsBetter ? delta < 0 : delta > 0;
            return improving ? 'improving' : 'declining';
          };

          const recentR = last7Recovery.slice(-3);
          const olderR = last7Recovery.slice(0, -3);
          const recentS = last7Sleep.slice(-3);
          const olderS = last7Sleep.slice(0, -3);
          const recentSt = last7Strain.slice(-3);
          const olderSt = last7Strain.slice(0, -3);

          context.trends = {
            recovery: computeTrend(recentR.map(r => r.recovery_score), olderR.map(r => r.recovery_score)),
            hrv: computeTrend(recentR.map(r => r.hrv_rmssd_ms), olderR.map(r => r.hrv_rmssd_ms)),
            rhr: computeTrend(recentR.map(r => r.resting_heart_rate_bpm), olderR.map(r => r.resting_heart_rate_bpm), true),
            sleep: computeTrend(recentS.map(s => s.sleep_quality_score), olderS.map(s => s.sleep_quality_score)),
            strain: computeTrend(recentSt.map(s => s.strain_score), olderSt.map(s => s.strain_score)),
          };

          // Sleep stage breakdown from last sleep entry
          if (sleep30d.length > 0) {
            const lastSleepEntry = sleep30d[sleep30d.length - 1];
            const totalMin = lastSleepEntry.duration_minutes || 1;
            const remMin = lastSleepEntry.rem_minutes || 0;
            const deepMin = lastSleepEntry.deep_minutes || 0;
            if (totalMin > 0 && (remMin > 0 || deepMin > 0)) {
              const remPct = Math.round((remMin / totalMin) * 100);
              const deepPct = Math.round((deepMin / totalMin) * 100);
              context.sleepStages = {
                remPercent: remPct,
                deepPercent: deepPct,
                lightPercent: Math.max(0, 100 - remPct - deepPct),
              };
            }
          }

          // Recovery-to-strain ratio: recovery% / strain normalized to 100-scale
          if (context.avg7d?.recovery && context.avg7d?.strain && context.avg7d.strain > 0) {
            const strainNormalized = (context.avg7d.strain / 21) * 100;
            context.recoveryStrainRatio = Math.round((context.avg7d.recovery / strainNormalized) * 100) / 100;
          }
        } catch (err) {
          logger.warn('[ComprehensiveUserContext] Error fetching 30d WHOOP trends (non-fatal)', {
            userId,
            error: err instanceof Error ? err.message : 'Unknown',
          });
        }
      }

      return context;
    } catch (error) {
      logger.error('[ComprehensiveUserContext] Error getting WHOOP context', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { isConnected: false, lastSyncAt: null };
    }
  }

  /**
   * Get lifestyle context
   */
  async getLifestyleContext(userId: string): Promise<LifestyleContext> {
    try {
      const context: LifestyleContext = {};

      // Get recent daily schedules (last 7 days)
      const schedulesResult = await query<{
        schedule_date: Date;
        item_count: number;
        categories: string[];
      }>(
        `SELECT 
          ds.schedule_date,
          COUNT(si.id) as item_count,
          ARRAY_AGG(DISTINCT si.category) FILTER (WHERE si.category IS NOT NULL) as categories
        FROM daily_schedules ds
        LEFT JOIN schedule_items si ON ds.id = si.schedule_id
        WHERE ds.user_id = $1
          AND ds.schedule_date >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY ds.schedule_date
        ORDER BY ds.schedule_date DESC
        LIMIT 7`,
        [userId]
      );

      if (schedulesResult.rows.length > 0) {
        context.dailySchedules = schedulesResult.rows.map((row) => ({
          date: typeof row.schedule_date === 'string' ? row.schedule_date : row.schedule_date.toISOString().split('T')[0],
          itemCount: parseInt(row.item_count as unknown as string, 10),
          categories: (row.categories as string[]) || [],
        }));
      }

      // Get today's schedule context (stress, free windows, busy hours)
      try {
        const { scheduleContextService } = await import('./schedule-context.service.js');
        const dayCtx = await scheduleContextService.getDayContext(userId);
        context.scheduleContext = {
          stressLevel: dayCtx.stressLevel,
          totalItems: dayCtx.totalItems,
          busyHours: dayCtx.busyHours,
          freeHours: dayCtx.freeHours,
          freeWindows: dayCtx.freeWindows,
          hasEarlyMorning: dayCtx.hasEarlyMorning,
          hasLateNight: dayCtx.hasLateNight,
          longestFreeWindowMinutes: dayCtx.longestFreeWindow?.durationMinutes ?? null,
          backToBackCount: dayCtx.backToBackCount,
        };
      } catch {
        // Schedule context is non-critical — don't block lifestyle context
      }

      // Get special days (Ramadan, holidays, etc.)
      try {
        const { specialDaysService } = await import('./special-days.service.js');
        const specialDays = await specialDaysService.getSpecialDays(userId);
        if (specialDays.length > 0) {
          (context as Record<string, unknown>).specialDays = specialDays;
        }
      } catch {
        // Special days is non-critical
      }

      // Get active habits count
      const habitsResult = await query<{ count: string }>(
        `SELECT COUNT(*) as count
         FROM habits
         WHERE user_id = $1 AND is_active = true AND is_archived = false`,
        [userId]
      );
      context.activeHabits = parseInt(habitsResult.rows[0]?.count || '0', 10);

      // Get user preferences (including AI personality settings)
      const prefsResult = await query<{
        preferred_check_in_time: string | null;
        coaching_style: string | null;
        coaching_intensity: string | null;
        ai_use_emojis: boolean | null;
        ai_formality_level: string | null;
        ai_encouragement_level: string | null;
        focus_areas: string[] | null;
        ai_message_style: string | null;
      }>(
        `SELECT preferred_check_in_time, coaching_style, coaching_intensity,
                ai_use_emojis, ai_formality_level, ai_encouragement_level,
                focus_areas, ai_message_style
         FROM user_preferences
         WHERE user_id = $1
         LIMIT 1`,
        [userId]
      );

      if (prefsResult.rows.length > 0) {
        const prefs = prefsResult.rows[0];
        context.preferences = {
          preferredCheckInTime: prefs.preferred_check_in_time || undefined,
          coachingStyle: prefs.coaching_style || undefined,
          coachingIntensity: prefs.coaching_intensity || undefined,
          useEmojis: prefs.ai_use_emojis ?? undefined,
          formalityLevel: prefs.ai_formality_level || undefined,
          encouragementLevel: prefs.ai_encouragement_level || undefined,
          focusAreas: prefs.focus_areas || undefined,
          messageStyle: prefs.ai_message_style || undefined,
        };
      }

      return context;
    } catch (error) {
      logger.error('[ComprehensiveUserContext] Error getting lifestyle context', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {};
    }
  }

  /**
   * Get workout context
   */
  async getWorkoutContext(userId: string): Promise<WorkoutContext> {
    try {
      const context: WorkoutContext = {};

      // Get recent workouts (last 7 days)
      const workoutsResult = await query<{
        workout_name: string;
        scheduled_date: Date;
        status: string;
      }>(
        `SELECT workout_name, scheduled_date, status
         FROM workout_logs
         WHERE user_id = $1
           AND scheduled_date >= CURRENT_DATE - INTERVAL '7 days'
         ORDER BY scheduled_date DESC
         LIMIT 10`,
        [userId]
      );

      const now = Date.now();
      if (workoutsResult.rows.length > 0) {
        context.recentWorkouts = workoutsResult.rows.map((row) => {
          const workoutDate = new Date(row.scheduled_date);
          const hoursAgo = (now - workoutDate.getTime()) / (1000 * 60 * 60);
          return {
            name: row.workout_name,
            date: workoutDate,
            status: row.status,
            hoursAgo: Math.round(hoursAgo * 10) / 10,
          };
        });

        // Get last workout date
        const lastWorkout = context.recentWorkouts[0];
        if (lastWorkout) {
          context.lastWorkoutDate = lastWorkout.date;
        }

        // Calculate completion rate
        const completed = context.recentWorkouts.filter((w) => w.status === 'completed').length;
        context.completionRate = Math.round((completed / context.recentWorkouts.length) * 100);

        // Count missed workouts from workout_logs
        context.missedWorkouts = context.recentWorkouts.filter((w) => w.status === 'missed').length;
      }

      // Also count past-due scheduled workouts that were never completed
      // These live in workout_schedule_tasks (the calendar) and may still be 'pending'
      const missedScheduleResult = await query<{ missed_count: string }>(
        `SELECT COUNT(*)::text as missed_count
         FROM workout_schedule_tasks
         WHERE user_id = $1
           AND scheduled_date >= CURRENT_DATE - INTERVAL '7 days'
           AND scheduled_date < CURRENT_DATE
           AND status IN ('pending', 'missed')`,
        [userId]
      ).catch(() => ({ rows: [{ missed_count: '0' }] }));
      const missedScheduleCount = parseInt(missedScheduleResult.rows[0]?.missed_count || '0', 10);

      // Merge: total missed = workout_logs missed + past-due schedule tasks
      context.missedWorkouts = (context.missedWorkouts || 0) + missedScheduleCount;

      // Recalculate completion rate factoring in schedule tasks
      if (missedScheduleCount > 0 || (context.recentWorkouts?.length || 0) > 0) {
        const totalTasks = (context.recentWorkouts?.length || 0) + missedScheduleCount;
        const completedTasks = context.recentWorkouts?.filter((w) => w.status === 'completed').length || 0;
        context.completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      }

      // If no workout_logs exist, estimate lastWorkoutDate from completed schedule tasks
      if (!context.lastWorkoutDate) {
        const lastCompletedSchedule = await query<{ last_date: Date }>(
          `SELECT MAX(completed_at)::date as last_date
           FROM workout_schedule_tasks
           WHERE user_id = $1 AND status = 'completed'
           AND scheduled_date >= CURRENT_DATE - INTERVAL '30 days'`,
          [userId]
        ).catch(() => ({ rows: [] as { last_date: Date }[] }));
        if (lastCompletedSchedule.rows[0]?.last_date) {
          context.lastWorkoutDate = new Date(lastCompletedSchedule.rows[0].last_date);
        }
      }

      // Get active workout plans
      const plansResult = await query<{
        plan_name: string;
        goal_category: string;
        progress: number;
      }>(
        `SELECT 
          wp.name as plan_name,
          wp.goal_category,
          COALESCE(
            (SELECT COUNT(*) FROM activity_logs al 
             WHERE al.plan_id = wp.id AND al.status = 'completed')::float /
            NULLIF((SELECT COUNT(*) FROM activity_logs al WHERE al.plan_id = wp.id), 0) * 100,
            0
          ) as progress
         FROM workout_plans wp
         WHERE wp.user_id = $1 AND wp.status = 'active'
         ORDER BY wp.created_at DESC
         LIMIT 5`,
        [userId]
      );

      if (plansResult.rows.length > 0) {
        context.activePlans = plansResult.rows.map((row) => ({
          name: row.plan_name,
          type: row.goal_category,
          progress: Math.round(parseFloat(row.progress as unknown as string)),
        }));
      }

      return context;
    } catch (error) {
      logger.error('[ComprehensiveUserContext] Error getting workout context', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {};
    }
  }

  /**
   * Get nutrition context
   */
  async getNutritionContext(userId: string): Promise<NutritionContext> {
    try {
      const context: NutritionContext = {};

      // Get recent meals (last 7 days)
      const mealsResult = await query<{
        meal_name: string;
        eaten_at: Date;
      }>(
        `SELECT meal_name, eaten_at
         FROM meal_logs
         WHERE user_id = $1
           AND eaten_at >= CURRENT_DATE - INTERVAL '7 days'
         ORDER BY eaten_at DESC
         LIMIT 20`,
        [userId]
      );

      const now = Date.now();
      if (mealsResult.rows.length > 0) {
        context.recentMeals = mealsResult.rows.map((row) => {
          const mealDate = new Date(row.eaten_at);
          const hoursAgo = (now - mealDate.getTime()) / (1000 * 60 * 60);
          return {
            name: row.meal_name,
            eatenAt: mealDate,
            hoursAgo: Math.round(hoursAgo * 10) / 10,
          };
        });

        // Get last meal date
        const lastMeal = context.recentMeals[0];
        if (lastMeal) {
          context.lastMealDate = lastMeal.eatenAt;
        }

        // Count today's meals
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        context.todayMealCount = context.recentMeals.filter(
          (m) => new Date(m.eatenAt) >= today
        ).length;
      }

      // Get active diet plan
      const dietPlanResult = await query<{
        plan_name: string;
        daily_calories: number;
        meals_per_day: number;
      }>(
        `SELECT name as plan_name, daily_calories, COALESCE(meals_per_day, 3) as meals_per_day
         FROM diet_plans
         WHERE user_id = $1 AND status = 'active'
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId]
      );

      if (dietPlanResult.rows.length > 0) {
        const plan = dietPlanResult.rows[0];
        context.activeDietPlan = {
          name: plan.plan_name,
          dailyCalories: parseInt(plan.daily_calories as unknown as string, 10),
          mealsPerDay: parseInt(plan.meals_per_day as unknown as string, 10) || 3,
        };
      }

      return context;
    } catch (error) {
      logger.error('[ComprehensiveUserContext] Error getting nutrition context', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {};
    }
  }

  /**
   * Get chat history context
   */
  async getChatHistoryContext(userId: string): Promise<ChatHistoryContext> {
    try {
      const context: ChatHistoryContext = {};

      // Get recent conversations (last 10)
      const conversationsResult = await query<{
        id: string;
        chat_name: string;
        created_at: Date;
        message_count: number;
        last_message_content: string | null;
        last_message_date: Date | null;
      }>(
        `SELECT 
          c.id,
          c.chat_name,
          c.created_at,
          COUNT(m.id) as message_count,
          (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_content,
          (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_date
         FROM chats c
         INNER JOIN chat_participants cp ON c.id = cp.chat_id
         LEFT JOIN messages m ON c.id = m.chat_id
         WHERE cp.user_id = $1 AND cp.left_at IS NULL
         GROUP BY c.id, c.chat_name, c.created_at
         ORDER BY COALESCE(
           (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1),
           c.created_at
         ) DESC
         LIMIT 10`,
        [userId]
      );

      if (conversationsResult.rows.length > 0) {
        context.recentConversations = conversationsResult.rows.map((row) => ({
          title: row.chat_name || 'Untitled Conversation',
          lastMessage: row.last_message_content || 'No messages yet',
          date: row.last_message_date || row.created_at,
          messageCount: parseInt(row.message_count as unknown as string, 10),
        }));

        // Get last conversation date
        const lastConv = context.recentConversations[0];
        if (lastConv) {
          context.lastConversationDate = lastConv.date;
        }

        // Extract topics from conversation titles (simple keyword extraction)
        const topics = new Set<string>();
        context.recentConversations.forEach((conv) => {
          const title = conv.title.toLowerCase();
          if (title.includes('workout') || title.includes('exercise')) topics.add('workouts');
          if (title.includes('nutrition') || title.includes('meal') || title.includes('diet')) topics.add('nutrition');
          if (title.includes('sleep') || title.includes('recovery')) topics.add('sleep');
          if (title.includes('stress') || title.includes('mood') || title.includes('wellbeing')) topics.add('wellbeing');
          if (title.includes('goal') || title.includes('progress')) topics.add('goals');
        });
        context.topics = Array.from(topics);
      }

      return context;
    } catch (error) {
      logger.error('[ComprehensiveUserContext] Error getting chat history context', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {};
    }
  }

  /**
   * Get goals context
   */
  async getGoalsContext(userId: string): Promise<GoalsContext> {
    try {
      const context: GoalsContext = {};

      const now = new Date();
      const sevenDaysFromNow = new Date(now);
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      // Get active goals
      const goalsResult = await query<{
        title: string;
        category: string;
        current_value: number | null;
        target_value: number | null;
        target_date: Date;
      }>(
        `SELECT title, category, current_value, target_value, target_date
         FROM user_goals
         WHERE user_id = $1 AND status = 'active'
         ORDER BY is_primary DESC, created_at DESC
         LIMIT 10`,
        [userId]
      );

      if (goalsResult.rows.length > 0) {
        context.activeGoals = goalsResult.rows.map((row) => {
          const progress =
            row.current_value && row.target_value
              ? Math.round((row.current_value / row.target_value) * 100)
              : 0;
          const targetDate = new Date(row.target_date);
          const daysRemaining = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          return {
            title: row.title,
            category: row.category,
            progress,
            targetDate,
            daysRemaining,
          };
        });

        // Count goals with approaching deadlines
        context.approachingDeadlines = context.activeGoals.filter(
          (goal) => goal.daysRemaining >= 0 && goal.daysRemaining <= 7
        ).length;
      }

      // Fetch life goals (non-health: financial, faith, relationships, etc.)
      const [lifeGoalsResult, lastCheckins, intentionsResult, fulfillmentResult] = await Promise.all([
        query<{
          id: string; category: string; title: string; progress: number;
          tracking_method: string; journal_mention_count: number;
          avg_sentiment_when_mentioned: number | null; last_mentioned_at: Date | null;
        }>(
          `SELECT id, category, title, progress, tracking_method, journal_mention_count,
                  avg_sentiment_when_mentioned, last_mentioned_at
           FROM life_goals WHERE user_id = $1 AND status = 'active'
           ORDER BY is_primary DESC, created_at DESC LIMIT 15`,
          [userId]
        ),
        query<{ life_goal_id: string; max_date: string; milestone_count: string; milestones_completed: string }>(
          `SELECT lg.id AS life_goal_id,
                  MAX(c.checkin_date)::text AS max_date,
                  COUNT(DISTINCT m.id)::text AS milestone_count,
                  COUNT(DISTINCT m.id) FILTER (WHERE m.completed)::text AS milestones_completed
           FROM life_goals lg
           LEFT JOIN life_goal_checkins c ON c.life_goal_id = lg.id
           LEFT JOIN life_goal_milestones m ON m.life_goal_id = lg.id
           WHERE lg.user_id = $1 AND lg.status = 'active'
           GROUP BY lg.id`,
          [userId]
        ),
        query<{ intention_text: string; fulfilled: boolean | null; domain: string | null }>(
          `SELECT intention_text, fulfilled, domain FROM daily_intentions
           WHERE user_id = $1 AND intention_date = CURRENT_DATE ORDER BY sort_order ASC`,
          [userId]
        ),
        query<{ total: string; fulfilled: string }>(
          `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE fulfilled = true) AS fulfilled
           FROM daily_intentions WHERE user_id = $1 AND intention_date >= CURRENT_DATE - 30`,
          [userId]
        ),
      ]);

      if (lifeGoalsResult.rows.length > 0) {
        const checkinMap = new Map(lastCheckins.rows.map(r => [r.life_goal_id, r]));

        context.activeLifeGoals = lifeGoalsResult.rows.map(row => {
          const checkinData = checkinMap.get(row.id);
          const lastCheckinDate = checkinData?.max_date || undefined;
          const lastMentioned = row.last_mentioned_at ? row.last_mentioned_at.toISOString() : undefined;
          const lastActivity = lastCheckinDate || lastMentioned;
          const daysSinceLastActivity = lastActivity
            ? Math.floor((now.getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
            : undefined;

          return {
            id: row.id,
            category: row.category,
            title: row.title,
            progress: row.progress,
            trackingMethod: row.tracking_method,
            lastCheckinDate,
            lastMentionedAt: lastMentioned,
            journalMentionCount: row.journal_mention_count,
            avgSentiment: row.avg_sentiment_when_mentioned ?? undefined,
            daysSinceLastActivity,
            milestoneCount: parseInt(checkinData?.milestone_count ?? '0', 10),
            milestonesCompleted: parseInt(checkinData?.milestones_completed ?? '0', 10),
          };
        });

        context.lifeGoalCount = lifeGoalsResult.rows.length;
        context.stalledLifeGoals = context.activeLifeGoals.filter(
          g => g.daysSinceLastActivity !== undefined && g.daysSinceLastActivity > 7
        ).length;
      }

      if (intentionsResult.rows.length > 0) {
        context.todayIntentions = intentionsResult.rows.map(r => ({
          text: r.intention_text,
          fulfilled: r.fulfilled ?? undefined,
          domain: r.domain ?? undefined,
        }));
      }

      const totalIntentions = parseInt(fulfillmentResult.rows[0]?.total ?? '0', 10);
      if (totalIntentions > 0) {
        const fulfilledIntentions = parseInt(fulfillmentResult.rows[0]?.fulfilled ?? '0', 10);
        context.intentionFulfillmentRate = Math.round((fulfilledIntentions / totalIntentions) * 100);
      }

      // Fetch motivation tier (non-blocking -- defaults to 'medium' on error)
      try {
        context.motivationTier = await motivationTierService.getActiveTier(userId);
      } catch {
        // Non-fatal: motivation tier is informational for AI context
      }

      return context;
    } catch (error) {
      logger.error('[ComprehensiveUserContext] Error getting goals context', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {};
    }
  }

  /**
   * Get body stats context
   */
  async getBodyStatsContext(userId: string): Promise<BodyStatsContext> {
    try {
      const context: BodyStatsContext = {};

      // Get latest weight
      const weightResult = await query<{
        value: any;
        record_date: Date;
      }>(
        `SELECT value, record_date
         FROM progress_records
         WHERE user_id = $1 AND record_type = 'weight'
         ORDER BY record_date DESC
         LIMIT 1`,
        [userId]
      );

      if (weightResult.rows.length > 0) {
        const weight = weightResult.rows[0];
        const weightValue = weight.value as { value?: number; unit?: string };
        const weightDate = new Date(weight.record_date);
        const daysAgo = Math.ceil((Date.now() - weightDate.getTime()) / (1000 * 60 * 60 * 24));
        context.latestWeight = {
          value: weightValue.value || 0,
          unit: weightValue.unit || 'kg',
          date: weightDate,
          daysAgo,
        };
      }

      // Get latest measurements
      const measurementsResult = await query<{
        record_type: string;
        value: any;
      }>(
        `SELECT record_type, value
         FROM progress_records
         WHERE user_id = $1
           AND record_type = 'measurement'
         ORDER BY record_date DESC
         LIMIT 1`,
        [userId]
      );

      if (measurementsResult.rows.length > 0) {
        const measurement = measurementsResult.rows[0];
        const measurementValue = measurement.value as {
          height?: number;
          body_fat?: number;
          waist?: number;
          hip?: number;
          chest?: number;
        };
        context.measurements = {};
        if (measurementValue.height) context.measurements.height = measurementValue.height;
        if (measurementValue.body_fat) context.measurements.bodyFat = measurementValue.body_fat;
        if (measurementValue.waist) context.measurements.waist = measurementValue.waist;
        if (measurementValue.hip) context.measurements.hip = measurementValue.hip;
        if (measurementValue.chest) context.measurements.chest = measurementValue.chest;
      }

      return context;
    } catch (error) {
      logger.error('[ComprehensiveUserContext] Error getting body stats context', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {};
    }
  }

  /**
   * Get gamification context (streaks, XP, levels)
   */
  async getGamificationContext(userId: string): Promise<GamificationContext> {
    try {
      const stats = await gamificationService.getUserStats(userId);
      const context: GamificationContext = {
        totalXP: stats.totalXP,
        currentLevel: stats.currentLevel,
        currentStreak: stats.currentStreak,
        longestStreak: stats.longestStreak,
        lastActivityDate: stats.lastActivityDate,
      };

      // Determine if streak is at risk (last activity was yesterday or earlier, and streak > 0)
      if (stats.lastActivityDate && stats.currentStreak > 0) {
        const lastActivity = new Date(stats.lastActivityDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const lastActivityDay = new Date(lastActivity);
        lastActivityDay.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor((today.getTime() - lastActivityDay.getTime()) / (1000 * 60 * 60 * 24));
        context.streakAtRisk = daysDiff >= 1; // No activity today yet
      }

      // Check if a streak milestone was just reached
      const milestones = [7, 14, 30, 60, 90, 100, 150, 200, 365];
      const matchedMilestone = milestones.find(m => stats.currentStreak === m);
      context.streakMilestoneReached = matchedMilestone || null;

      // Enrich with unified streak data (freezes, tier, quick-save actions)
      try {
        const { streakService } = await import('./streak.service.js');
        const streakStatus = await streakService.getStreakStatus(userId);
        context.currentStreak = streakStatus.currentStreak;
        context.longestStreak = streakStatus.longestStreak;
        context.streakAtRisk = streakStatus.atRisk;
        // Add extended streak context for AI coach
        (context as Record<string, unknown>).freezesAvailable = streakStatus.freezesAvailable;
        (context as Record<string, unknown>).streakTier = streakStatus.tier?.name || null;
        (context as Record<string, unknown>).quickSaveActions = streakStatus.atRisk
          ? ['Log your mood (30 seconds)', 'Do a breathing exercise (2 minutes)', 'Log your water intake']
          : [];
      } catch {
        // Unified streak not available yet — use basic data above
      }

      return context;
    } catch (error) {
      logger.error('[ComprehensiveUserContext] Error getting gamification context', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {};
    }
  }

  /**
   * Get habit tracking context
   */
  async getHabitContext(userId: string): Promise<HabitContext> {
    try {
      const context: HabitContext = {};

      // Get active habits with completion rates
      const habitsResult = await query<{
        id: string;
        name: string;
        frequency: string;
        total_logs_7d: string;
        completed_today: string;
        current_streak: string;
      }>(
        `SELECT
          h.id, h.habit_name as name, h.frequency,
          COALESCE((
            SELECT COUNT(*) FROM habit_logs hl
            WHERE hl.habit_id = h.id
              AND hl.log_date >= CURRENT_DATE - INTERVAL '7 days'
              AND hl.completed = true
          ), 0)::text as total_logs_7d,
          COALESCE((
            SELECT COUNT(*) FROM habit_logs hl
            WHERE hl.habit_id = h.id
              AND hl.log_date = CURRENT_DATE
              AND hl.completed = true
          ), 0)::text as completed_today,
          COALESCE((
            SELECT COUNT(*) FROM (
              SELECT log_date FROM habit_logs hl2
              WHERE hl2.habit_id = h.id AND hl2.completed = true
                AND hl2.log_date <= CURRENT_DATE
              ORDER BY hl2.log_date DESC
            ) sub
            WHERE log_date >= CURRENT_DATE - (
              SELECT COUNT(DISTINCT log_date) FROM habit_logs hl3
              WHERE hl3.habit_id = h.id AND hl3.completed = true
                AND hl3.log_date <= CURRENT_DATE
                AND hl3.log_date >= CURRENT_DATE - INTERVAL '30 days'
            ) * INTERVAL '1 day'
          ), 0)::text as current_streak
        FROM habits h
        WHERE h.user_id = $1 AND h.is_active = true AND h.is_archived = false
        ORDER BY h.created_at
        LIMIT 10`,
        [userId]
      );

      if (habitsResult.rows.length > 0) {
        context.totalActiveHabits = habitsResult.rows.length;
        context.todayCompletionCount = 0;
        context.todayTotalHabits = habitsResult.rows.length;

        context.activeHabits = habitsResult.rows.map(row => {
          const completedToday = parseInt(row.completed_today, 10) > 0;
          if (completedToday) context.todayCompletionCount!++;
          const logsIn7Days = parseInt(row.total_logs_7d, 10);
          return {
            name: row.name,
            frequency: row.frequency,
            completionRate7Days: Math.round((logsIn7Days / 7) * 100),
            completedToday,
            currentStreak: parseInt(row.current_streak, 10),
          };
        });

        // Overall completion rate
        const totalCompletions = context.activeHabits.reduce((sum, h) => sum + h.completionRate7Days, 0);
        context.overallCompletionRate7Days = Math.round(totalCompletions / context.activeHabits.length);
      }

      return context;
    } catch (error) {
      logger.error('[ComprehensiveUserContext] Error getting habit context', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {};
    }
  }

  /**
   * Get mental health context (recovery scores, emotional check-ins, journal sentiment)
   */
  async getMentalHealthContext(userId: string): Promise<MentalHealthContext> {
    try {
      const context: MentalHealthContext = {};

      // Get latest mental recovery score and trend
      const recoveryResult = await query<{
        recovery_score: number;
        trend: string;
        created_at: Date;
      }>(
        `SELECT recovery_score, trend, created_at
         FROM mental_recovery_scores
         WHERE user_id = $1
         ORDER BY score_date DESC
         LIMIT 1`,
        [userId]
      );

      if (recoveryResult.rows.length > 0) {
        const row = recoveryResult.rows[0];
        context.latestRecoveryScore = Math.round(parseFloat(row.recovery_score as unknown as string));
        if (row.trend === 'improving' || row.trend === 'stable' || row.trend === 'declining') {
          context.recoveryTrend = row.trend;
        }
      }

      // Get latest emotional check-in
      const checkinResult = await query<{
        overall_mood_score: number | null;
        overall_anxiety_score: number | null;
        risk_level: string | null;
        created_at: Date;
      }>(
        `SELECT overall_mood_score, overall_anxiety_score, risk_level, created_at
         FROM emotional_checkin_sessions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId]
      );

      if (checkinResult.rows.length > 0) {
        const row = checkinResult.rows[0];
        const hoursAgo = (Date.now() - new Date(row.created_at).getTime()) / (1000 * 60 * 60);
        context.latestEmotionalCheckin = {
          overallMoodScore: row.overall_mood_score ? parseFloat(row.overall_mood_score as unknown as string) : undefined,
          anxietyScore: row.overall_anxiety_score ? parseFloat(row.overall_anxiety_score as unknown as string) : undefined,
          riskLevel: row.risk_level || undefined,
          hoursAgo: Math.round(hoursAgo * 10) / 10,
        };
      }

      // Get journal sentiment trend (last 7 entries)
      const journalResult = await query<{
        sentiment_score: number | null;
        cnt: string;
      }>(
        `SELECT AVG(sentiment_score) as sentiment_score, COUNT(*)::text as cnt
         FROM journal_entries
         WHERE user_id = $1
           AND created_at >= CURRENT_DATE - INTERVAL '14 days'
           AND sentiment_score IS NOT NULL`,
        [userId]
      );

      if (journalResult.rows.length > 0 && parseInt(journalResult.rows[0].cnt, 10) > 0) {
        const avgSentiment = parseFloat(journalResult.rows[0].sentiment_score as unknown as string);
        context.journalSentimentTrend = avgSentiment > 0.2 ? 'positive' : avgSentiment < -0.2 ? 'negative' : 'neutral';
        context.recentJournalCount = parseInt(journalResult.rows[0].cnt, 10);
      }

      return context;
    } catch (error) {
      logger.error('[ComprehensiveUserContext] Error getting mental health context', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {};
    }
  }

  /**
   * Get water intake context
   */
  async getWaterIntakeContext(userId: string): Promise<WaterIntakeContext> {
    try {
      const stats = await waterIntakeService.getStats(userId);
      const context: WaterIntakeContext = {
        weeklyAverage: stats.weeklyAverage,
        waterStreak: stats.streak,
      };

      if (stats.today) {
        context.todayMlConsumed = stats.today.mlConsumed;
        context.todayTargetMl = stats.today.targetMl;
        context.todayPercentage = stats.today.targetMl > 0
          ? Math.round((stats.today.mlConsumed / stats.today.targetMl) * 100)
          : 0;
        context.goalAchievedToday = stats.today.goalAchieved;
      }

      return context;
    } catch (error) {
      logger.error('[ComprehensiveUserContext] Error getting water intake context', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {};
    }
  }

  /**
   * Get daily health score context
   */
  async getDailyScoreContext(userId: string): Promise<DailyScoreContext> {
    try {
      const context: DailyScoreContext = {};
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      // Get latest score (try yesterday first, then today)
      let score = await aiScoringService.getDailyScore(userId, yesterdayStr);
      if (!score) {
        const todayStr = new Date().toISOString().split('T')[0];
        score = await aiScoringService.getDailyScore(userId, todayStr);
      }

      if (score) {
        context.latestScore = Math.round(score.totalScore);
        context.latestDate = score.date;
        context.componentScores = {
          workout: Math.round(score.componentScores.workout),
          nutrition: Math.round(score.componentScores.nutrition),
          wellbeing: Math.round(score.componentScores.wellbeing),
          biometrics: Math.round(score.componentScores.biometrics),
          engagement: Math.round(score.componentScores.engagement),
          consistency: Math.round(score.componentScores.consistency),
        };
      }

      // Get 7-day trend
      const trendResult = await query<{ total_score: number; date: string }>(
        `SELECT total_score, date
         FROM daily_user_scores
         WHERE user_id = $1
           AND date >= CURRENT_DATE - INTERVAL '7 days'
         ORDER BY date ASC`,
        [userId]
      );

      if (trendResult.rows.length >= 3) {
        const scores = trendResult.rows.map(r => parseFloat(r.total_score as unknown as string));
        const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
        const secondHalf = scores.slice(Math.floor(scores.length / 2));
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        const diff = secondAvg - firstAvg;
        context.scoreTrend = diff > 3 ? 'improving' : diff < -3 ? 'declining' : 'stable';
      }

      // Calculate day-over-day delta from trend data
      if (trendResult.rows.length >= 2) {
        const previous = trendResult.rows[trendResult.rows.length - 2];
        context.previousScore = Math.round(parseFloat(previous.total_score as unknown as string));
        context.scoreDelta = (context.latestScore ?? 0) - context.previousScore;
      }

      // Week-over-week delta
      if (trendResult.rows.length >= 7) {
        const weekAgo = trendResult.rows[0];
        context.weekOverWeekDelta = (context.latestScore ?? 0) - Math.round(parseFloat(weekAgo.total_score as unknown as string));
      }

      return context;
    } catch (error) {
      logger.error('[ComprehensiveUserContext] Error getting daily score context', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {};
    }
  }

  /**
   * Get nutrition analysis context
   */
  async getNutritionAnalysisContext(userId: string): Promise<NutritionAnalysisContext> {
    try {
      const context: NutritionAnalysisContext = {};
      const todayStr = new Date().toISOString().split('T')[0];

      // Use meal_logs to derive nutrition analysis (nutrition_daily_analysis table not yet migrated)
      const todayResult = await query<{
        total_calories: string;
        meal_count: string;
        log_date: string;
      }>(
        `SELECT
          COALESCE(SUM(calories), 0)::text as total_calories,
          COUNT(*)::text as meal_count,
          eaten_at::date::text as log_date
         FROM meal_logs
         WHERE user_id = $1 AND eaten_at::date = $2::date
         GROUP BY eaten_at::date
         LIMIT 1`,
        [userId, todayStr]
      );

      if (todayResult.rows.length > 0) {
        const totalCal = parseInt(todayResult.rows[0].total_calories, 10);
        // Simple heuristic: 2000 cal target, classify deviation
        const deviation = totalCal - 2000;
        context.todayCalorieDeviation = deviation;
        context.todayDeviationClass = Math.abs(deviation) <= 200 ? 'on_target'
          : deviation > 200 ? 'over' : 'under';
        context.latestAnalysisDate = todayResult.rows[0].log_date;
      }

      // Weekly adherence: count days with meals logged in last 7 days
      const weeklyResult = await query<{ days_logged: string }>(
        `SELECT COUNT(DISTINCT eaten_at::date)::text as days_logged
         FROM meal_logs
         WHERE user_id = $1
           AND eaten_at >= CURRENT_DATE - INTERVAL '7 days'`,
        [userId]
      );

      if (weeklyResult.rows.length > 0) {
        const daysLogged = parseInt(weeklyResult.rows[0].days_logged, 10);
        context.weeklyAdherenceRate = Math.round((daysLogged / 7) * 100);
      }

      return context;
    } catch (error) {
      logger.error('[ComprehensiveUserContext] Error getting nutrition analysis context', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {};
    }
  }

  /**
   * Get competition context
   */
  async getCompetitionContext(userId: string): Promise<CompetitionContext> {
    try {
      const context: CompetitionContext = {};

      const result = await query<{
        competition_name: string;
        current_rank: number | null;
        current_score: number | null;
        end_date: Date;
        metric: string | null;
      }>(
        `SELECT
          c.name as competition_name,
          ce.current_rank,
          ce.current_score,
          c.end_date,
          c.rules->>'metric' as metric
         FROM competition_entries ce
         JOIN competitions c ON ce.competition_id = c.id
         WHERE ce.user_id = $1
           AND c.status = 'active'
           AND c.end_date >= CURRENT_DATE
         ORDER BY c.end_date ASC
         LIMIT 5`,
        [userId]
      );

      if (result.rows.length > 0) {
        const now = new Date();
        context.activeCompetitions = result.rows.map(row => ({
          name: row.competition_name,
          currentRank: row.current_rank ? parseInt(row.current_rank as unknown as string, 10) : undefined,
          currentScore: row.current_score ? parseFloat(row.current_score as unknown as string) : undefined,
          daysRemaining: Math.ceil((new Date(row.end_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
          metric: row.metric || 'participation',
        }));
        context.competitionCount = result.rows.length;
      }

      return context;
    } catch (error) {
      logger.error('[ComprehensiveUserContext] Error getting competition context', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {};
    }
  }

  /**
   * Get progress/weight trend context
   */
  async getProgressTrendContext(userId: string): Promise<ProgressTrendContext> {
    try {
      const context: ProgressTrendContext = {};

      // Get weight records over last 30 days
      const weightResult = await query<{
        value: any;
        record_date: Date;
      }>(
        `SELECT value, record_date
         FROM progress_records
         WHERE user_id = $1 AND record_type = 'weight'
           AND record_date >= CURRENT_DATE - INTERVAL '30 days'
         ORDER BY record_date ASC`,
        [userId]
      );

      if (weightResult.rows.length >= 2) {
        const weights = weightResult.rows.map(r => {
          const val = r.value as { value?: number; unit?: string };
          return { value: val.value || 0, unit: val.unit || 'kg', date: new Date(r.record_date) };
        }).filter(w => w.value > 0);

        if (weights.length >= 2) {
          const firstWeight = weights[0].value;
          const lastWeight = weights[weights.length - 1].value;
          const change = lastWeight - firstWeight;
          context.latestWeight = lastWeight;
          context.latestWeightUnit = weights[weights.length - 1].unit;
          context.weightChangeKg = Math.round(change * 10) / 10;
          context.weightTrend = change < -0.5 ? 'losing' : change > 0.5 ? 'gaining' : 'stable';
        }
      } else if (weightResult.rows.length === 1) {
        const val = weightResult.rows[0].value as { value?: number; unit?: string };
        context.latestWeight = val.value || 0;
        context.latestWeightUnit = val.unit || 'kg';
        context.weightTrend = 'no_data';
      }

      return context;
    } catch (error) {
      logger.error('[ComprehensiveUserContext] Error getting progress trend context', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {};
    }
  }

  async getActivityStatusContext(userId: string): Promise<ActivityStatusContext> {
    try {
      const [currentResult, historyResult, daysResult, overridesResult, patternsResult] = await Promise.all([
        query<{ current_activity_status: string; activity_status_updated_at: string }>(
          `SELECT current_activity_status, activity_status_updated_at FROM users WHERE id = $1`,
          [userId]
        ),
        query<{ status_date: string; activity_status: string; mood: number | null }>(
          `SELECT status_date::text, activity_status, mood
           FROM activity_status_history
           WHERE user_id = $1 AND status_date >= CURRENT_DATE - INTERVAL '7 days'
           ORDER BY status_date DESC
           LIMIT 7`,
          [userId]
        ),
        query<{ days: string }>(
          `SELECT COALESCE(CURRENT_DATE - MAX(status_date), 0)::text AS days
           FROM activity_status_history
           WHERE user_id = $1 AND activity_status IN ('working', 'excellent', 'good')`,
          [userId]
        ),
        query<{ status_overrides: unknown }>(
          `SELECT status_overrides FROM user_plans WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
          [userId]
        ),
        query<{ status_patterns: StatusPattern[] }>(
          `SELECT status_patterns FROM user_coaching_profiles WHERE user_id = $1`,
          [userId]
        ),
      ]);

      const user = currentResult.rows[0];

      return {
        current: (user?.current_activity_status ?? 'working') as ActivityStatusContext['current'],
        since: user?.activity_status_updated_at ?? new Date().toISOString(),
        source: 'manual',
        recentHistory: historyResult.rows.map(r => ({
          date: r.status_date,
          status: r.activity_status as ActivityStatusContext['current'],
          mood: r.mood ?? undefined,
        })),
        patterns: patternsResult.rows[0]?.status_patterns ?? [],
        activeOverrides: overridesResult.rows[0]?.status_overrides != null,
        daysSinceLastWorkingStatus: parseInt(daysResult.rows[0]?.days ?? '0', 10),
      };
    } catch (error) {
      logger.error('[ComprehensiveContext] Failed to fetch activity status context', { userId, error });
      return {
        current: 'working',
        since: new Date().toISOString(),
        source: 'manual',
        recentHistory: [],
        patterns: [],
        activeOverrides: false,
        daysSinceLastWorkingStatus: 0,
      };
    }
  }

  /**
   * Format comprehensive context for system prompt
   */
  formatContextForPrompt(context: ComprehensiveUserContext): string {
    const sections: string[] = [];

    // Unified Life State (inline format — no dynamic import needed)
    if (context.contextState) {
      const s = context.contextState;
      const modeDesc = s.recommendedMode === 'short' ? 'keep responses concise and supportive' :
        s.recommendedMode === 'deep' ? 'engage in deeper coaching and goal exploration' : 'normal conversational coaching';
      sections.push('UNIFIED LIFE STATE:');
      sections.push(`- Stress: ${s.stressLevel.toUpperCase()} (${s.stressScore}/100)`);
      sections.push(`- Energy: ${s.energyLevel.toUpperCase()} (${s.energyScore}/100)`);
      sections.push(`- Availability: ${s.availability.toUpperCase()} (${s.availabilityScore}/100)`);
      sections.push(`- Mood: ${s.mood.toUpperCase()} (${s.moodScore}/100)`);
      sections.push(`- Recommended Interaction: ${s.recommendedMode.toUpperCase()} — ${modeDesc}`);
      sections.push(`- Tone: ${s.toneAdjustment}`);
      if (s.correlations.length > 0) {
        sections.push('- Key Insights:');
        for (const c of s.correlations.slice(0, 3)) {
          sections.push(`  • ${c}`);
        }
      }
      sections.push('');
    }

    // WHOOP Data (enriched with trends, baselines, sleep stages)
    if (context.whoop.isConnected) {
      sections.push('WHOOP Data:');
      if (context.whoop.lastSleep) {
        const s = context.whoop.lastSleep;
        let sleepLine = `- Last Sleep: ${s.duration.toFixed(1)}h (quality: ${s.quality}%, efficiency: ${s.efficiency}%) - ${s.hoursAgo.toFixed(1)}h ago`;
        if (context.whoop.sleepStages) {
          sleepLine += ` | Stages: REM ${context.whoop.sleepStages.remPercent}%, Deep ${context.whoop.sleepStages.deepPercent}%, Light ${context.whoop.sleepStages.lightPercent}%`;
        }
        sections.push(sleepLine);
      }
      if (context.whoop.lastRecovery) {
        const r = context.whoop.lastRecovery;
        let recLine = `- Recovery: ${r.score}% (HRV: ${r.hrv}ms, RHR: ${r.rhr}bpm) - ${r.hoursAgo.toFixed(1)}h ago`;
        if (context.whoop.spo2) recLine += ` | SPO2: ${context.whoop.spo2}%`;
        if (context.whoop.skinTempCelsius) recLine += ` | Skin: ${context.whoop.skinTempCelsius}°C`;
        sections.push(recLine);
      }
      if (context.whoop.todayStrain) {
        const st = context.whoop.todayStrain;
        sections.push(`- Today's Strain: ${st.score.toFixed(1)}/21${st.calories ? ` (${st.calories} cal)` : ''}`);
      }
      // 7d averages + trends
      if (context.whoop.avg7d) {
        const a = context.whoop.avg7d;
        const t = context.whoop.trends;
        const arrow = (dir: string | null | undefined) => dir === 'improving' ? '↑' : dir === 'declining' ? '↓' : '→';
        sections.push(`- 7d Avg → Recovery: ${a.recovery?.toFixed(0) ?? '?'}% ${arrow(t?.recovery)} | HRV: ${a.hrv?.toFixed(0) ?? '?'}ms ${arrow(t?.hrv)} | RHR: ${a.rhr?.toFixed(0) ?? '?'}bpm ${arrow(t?.rhr)} | Sleep: ${a.sleepHours?.toFixed(1) ?? '?'}h ${arrow(t?.sleep)} | Strain: ${a.strain?.toFixed(1) ?? '?'} ${arrow(t?.strain)}`);
      }
      // 30d baselines
      if (context.whoop.baseline30d) {
        const b = context.whoop.baseline30d;
        sections.push(`- 30d Baseline → Recovery: ${b.recovery?.toFixed(0) ?? '?'}% | HRV: ${b.hrv?.toFixed(0) ?? '?'}ms | RHR: ${b.rhr?.toFixed(0) ?? '?'}bpm | Sleep: ${b.sleepHours?.toFixed(1) ?? '?'}h | Strain: ${b.strain?.toFixed(1) ?? '?'}`);
      }
      if (context.whoop.recoveryStrainRatio) {
        sections.push(`- Recovery/Strain Ratio: ${context.whoop.recoveryStrainRatio} (${context.whoop.recoveryStrainRatio >= 1 ? 'sustainable' : 'overreaching'})`);
      }
      if (context.whoop.needsSync) {
        sections.push(`- Status: Needs sync (last sync: ${context.whoop.syncHoursAgo?.toFixed(1)}h ago)`);
      }
      sections.push('');
    }

    // Workouts
    if (context.workouts.recentWorkouts && context.workouts.recentWorkouts.length > 0) {
      sections.push('Recent Workouts:');
      const recent = context.workouts.recentWorkouts.slice(0, 5); // Show more workouts
      recent.forEach((w) => {
        sections.push(`- ${w.name} (${w.status}) - ${w.hoursAgo.toFixed(1)} hours ago`);
      });
      if (context.workouts.completionRate !== undefined) {
        sections.push(`- Completion Rate: ${context.workouts.completionRate}% (last 7 days)`);
      }
      if (context.workouts.missedWorkouts && context.workouts.missedWorkouts > 0) {
        sections.push(`- Missed Workouts: ${context.workouts.missedWorkouts} in last 7 days`);
      }
      if (context.workouts.activePlans && context.workouts.activePlans.length > 0) {
        sections.push('Active Workout Plans:');
        context.workouts.activePlans.forEach((plan) => {
          sections.push(`- ${plan.name} (${plan.type}) - ${plan.progress}% complete`);
        });
      }
      if (context.workouts.lastWorkoutDate) {
        const daysSinceLastWorkout = Math.floor((Date.now() - new Date(context.workouts.lastWorkoutDate).getTime()) / (1000 * 60 * 60 * 24));
        sections.push(`- Last workout: ${daysSinceLastWorkout} day(s) ago`);
      }
      sections.push('');
    } else {
      sections.push('Recent Workouts: No workouts logged in last 7 days');
      sections.push('');
    }

    // Nutrition
    if (context.nutrition.recentMeals && context.nutrition.recentMeals.length > 0) {
      sections.push('Recent Meals:');
      const recent = context.nutrition.recentMeals.slice(0, 5); // Show more meals
      recent.forEach((m) => {
        sections.push(`- ${m.name} - ${m.hoursAgo.toFixed(1)} hours ago`);
      });
      if (context.nutrition.todayMealCount !== undefined) {
        sections.push(`- Today's Meals: ${context.nutrition.todayMealCount}`);
      }
      if (context.nutrition.activeDietPlan) {
        sections.push(`- Active Diet Plan: ${context.nutrition.activeDietPlan.name} (${context.nutrition.activeDietPlan.dailyCalories} cal/day)`);
        if (context.nutrition.activeDietPlan.adherence !== undefined) {
          sections.push(`- Plan Adherence: ${context.nutrition.activeDietPlan.adherence}%`);
        }
      }
      if (context.nutrition.lastMealDate) {
        const hoursSinceLastMeal = Math.round((Date.now() - new Date(context.nutrition.lastMealDate).getTime()) / (1000 * 60 * 60));
        sections.push(`- Last meal: ${hoursSinceLastMeal} hour(s) ago`);
      }
      sections.push('');
    } else {
      sections.push('Recent Meals: No meals logged in last 7 days');
      sections.push('');
    }

    // Goals
    if (context.goals.activeGoals && context.goals.activeGoals.length > 0) {
      sections.push('Active Goals:');
      context.goals.activeGoals.forEach((g) => {
        const status = g.daysRemaining < 0 ? 'OVERDUE' : g.daysRemaining <= 7 ? 'APPROACHING DEADLINE' : 'ON TRACK';
        sections.push(`- ${g.title} (${g.category}): ${g.progress}% progress, ${g.daysRemaining} days remaining - ${status}`);
      });
      if (context.goals.approachingDeadlines && context.goals.approachingDeadlines > 0) {
        sections.push(`- ⚠️ ${context.goals.approachingDeadlines} goal(s) with deadlines approaching (next 7 days) - proactively ask about progress`);
      }
      sections.push('');
    } else {
      sections.push('Active Goals: No active goals');
      sections.push('');
    }

    // Lifestyle & Schedule Context
    const sCtx = context.lifestyle.scheduleContext;
    if (sCtx && sCtx.totalItems > 0) {
      sections.push(`Today's Schedule Context:`);
      sections.push(`- Stress Level: ${sCtx.stressLevel.toUpperCase()} (${sCtx.totalItems} items, ${sCtx.backToBackCount} back-to-back)`);
      sections.push(`- Busy: ${sCtx.busyHours}h | Free: ${sCtx.freeHours}h`);
      if (sCtx.freeWindows.length > 0) {
        const windowStrs = sCtx.freeWindows.slice(0, 4).map(w => `${w.startTime}-${w.endTime} (${Math.round(w.durationMinutes / 60 * 10) / 10}h)`);
        sections.push(`- Free windows: ${windowStrs.join(', ')}`);
      } else {
        sections.push(`- Free windows: NONE — fully booked`);
      }
      if (sCtx.hasEarlyMorning) sections.push(`- ⚠️ Early morning item (before 6 AM)`);
      if (sCtx.hasLateNight) sections.push(`- ⚠️ Late night item (after 10 PM)`);
      sections.push('');
    } else if (context.lifestyle.dailySchedules && context.lifestyle.dailySchedules.length > 0) {
      sections.push('Schedule: ' + context.lifestyle.dailySchedules.length + ' day(s) with activities in last 7 days');
      sections.push('');
    }

    // Special days (Ramadan, holidays, etc.)
    const specialDays = (context.lifestyle as Record<string, unknown>).specialDays as Array<{ type: string; name: string; adjustments: { customMessage?: string; reduceWorkoutIntensity?: boolean; adjustMealTiming?: boolean } }> | undefined;
    if (specialDays && specialDays.length > 0) {
      sections.push('Special Day Context:');
      for (const day of specialDays) {
        sections.push(`- ${day.name} (${day.type})`);
        if (day.adjustments.customMessage) sections.push(`  ${day.adjustments.customMessage}`);
        if (day.adjustments.reduceWorkoutIntensity) sections.push('  → Reduce workout intensity');
        if (day.adjustments.adjustMealTiming) sections.push('  → Adjust meal timing');
      }
      sections.push('');
    }

    if (context.lifestyle.activeHabits) {
      sections.push(`Active Habits: ${context.lifestyle.activeHabits}`);
    }
    if (context.lifestyle.preferences) {
      if (context.lifestyle.preferences.preferredWorkoutTime) {
        sections.push(`Preferred Workout Time: ${context.lifestyle.preferences.preferredWorkoutTime}`);
      }
      if (context.lifestyle.preferences.coachingStyle) {
        sections.push(`Coaching Style: ${context.lifestyle.preferences.coachingStyle}`);
      }
    }
    sections.push('');
    
    // Body Stats
    if (context.bodyStats.latestWeight) {
      sections.push('Body Stats:');
      sections.push(`- Latest Weight: ${context.bodyStats.latestWeight.value} ${context.bodyStats.latestWeight.unit} (${context.bodyStats.latestWeight.daysAgo} days ago)`);
      if (context.bodyStats.measurements) {
        const measurements: string[] = [];
        if (context.bodyStats.measurements.height) measurements.push(`Height: ${context.bodyStats.measurements.height}cm`);
        if (context.bodyStats.measurements.bodyFat) measurements.push(`Body Fat: ${context.bodyStats.measurements.bodyFat}%`);
        if (context.bodyStats.measurements.waist) measurements.push(`Waist: ${context.bodyStats.measurements.waist}cm`);
        if (measurements.length > 0) {
          sections.push(`- ${measurements.join(', ')}`);
        }
      }
      sections.push('');
    }

    // Chat History
    if (context.chatHistory.recentConversations && context.chatHistory.recentConversations.length > 0) {
      sections.push('Recent Chat Topics:');
      if (context.chatHistory.topics && context.chatHistory.topics.length > 0) {
        sections.push(`- Topics: ${context.chatHistory.topics.join(', ')}`);
      }
      sections.push(`- Last conversation: ${context.chatHistory.lastConversationDate ? new Date(context.chatHistory.lastConversationDate).toLocaleDateString() : 'N/A'}`);
      sections.push('');
    }

    // Gamification & Streaks
    if (context.gamification.currentLevel || context.gamification.currentStreak) {
      sections.push('Gamification:');
      const parts: string[] = [];
      if (context.gamification.currentLevel) parts.push(`Level ${context.gamification.currentLevel}`);
      if (context.gamification.totalXP) parts.push(`${context.gamification.totalXP.toLocaleString()} XP`);
      if (context.gamification.currentStreak !== undefined) {
        parts.push(`${context.gamification.currentStreak}-day streak`);
        if (context.gamification.longestStreak) {
          parts.push(`(longest: ${context.gamification.longestStreak})`);
        }
      }
      sections.push(`- ${parts.join(' | ')}`);
      if (context.gamification.streakAtRisk) {
        sections.push(`- STREAK AT RISK - no activity logged today yet! Encourage user to do something to keep the streak alive.`);
      }
      if (context.gamification.streakMilestoneReached) {
        sections.push(`- STREAK MILESTONE: Just hit ${context.gamification.streakMilestoneReached} days! Celebrate this achievement!`);
      }
      sections.push('');
    }

    // Habits
    if (context.habits.totalActiveHabits && context.habits.totalActiveHabits > 0) {
      sections.push('Habit Tracking:');
      sections.push(`- ${context.habits.todayCompletionCount || 0}/${context.habits.todayTotalHabits || 0} habits completed today`);
      if (context.habits.overallCompletionRate7Days !== undefined) {
        sections.push(`- Overall 7-day completion rate: ${context.habits.overallCompletionRate7Days}%`);
      }
      if (context.habits.activeHabits) {
        context.habits.activeHabits.slice(0, 5).forEach(h => {
          const status = h.completedToday ? 'done' : 'pending';
          sections.push(`- ${h.name}: ${h.completionRate7Days}% (7d) | Today: ${status} | Streak: ${h.currentStreak} days`);
        });
      }
      sections.push('');
    }

    // Mental Health
    if (context.mentalHealth.latestRecoveryScore !== undefined || context.mentalHealth.latestEmotionalCheckin) {
      sections.push('Mental Health:');
      if (context.mentalHealth.latestRecoveryScore !== undefined) {
        const trend = context.mentalHealth.recoveryTrend ? ` (${context.mentalHealth.recoveryTrend})` : '';
        sections.push(`- Mental Recovery Score: ${context.mentalHealth.latestRecoveryScore}/100${trend}`);
      }
      if (context.mentalHealth.latestEmotionalCheckin) {
        const ec = context.mentalHealth.latestEmotionalCheckin;
        const parts: string[] = [];
        if (ec.overallMoodScore !== undefined) parts.push(`mood: ${ec.overallMoodScore}/10`);
        if (ec.anxietyScore !== undefined) parts.push(`anxiety: ${ec.anxietyScore}/10`);
        if (ec.riskLevel) parts.push(`risk: ${ec.riskLevel}`);
        sections.push(`- Last Emotional Check-in (${ec.hoursAgo.toFixed(1)}h ago): ${parts.join(', ')}`);
      }
      if (context.mentalHealth.journalSentimentTrend) {
        sections.push(`- Journal Sentiment (2 weeks): ${context.mentalHealth.journalSentimentTrend} (${context.mentalHealth.recentJournalCount || 0} entries)`);
      }
      sections.push('');
    }

    // Water Intake
    if (context.waterIntake.todayMlConsumed !== undefined || context.waterIntake.waterStreak) {
      sections.push('Water Intake:');
      if (context.waterIntake.todayMlConsumed !== undefined && context.waterIntake.todayTargetMl) {
        const pct = context.waterIntake.todayPercentage || 0;
        const status = context.waterIntake.goalAchievedToday ? 'GOAL REACHED' : pct < 50 ? 'LOW - needs attention' : 'in progress';
        sections.push(`- Today: ${context.waterIntake.todayMlConsumed}/${context.waterIntake.todayTargetMl} ml (${pct}%) - ${status}`);
      }
      if (context.waterIntake.weeklyAverage) {
        sections.push(`- Weekly Average: ${context.waterIntake.weeklyAverage} ml/day`);
      }
      if (context.waterIntake.waterStreak) {
        sections.push(`- Hydration Streak: ${context.waterIntake.waterStreak} days`);
      }
      sections.push('');
    }

    // Daily Health Score
    if (context.dailyScore.latestScore !== undefined) {
      sections.push('Daily Health Score:');
      const trend = context.dailyScore.scoreTrend ? ` (trend: ${context.dailyScore.scoreTrend})` : '';
      sections.push(`- Score: ${context.dailyScore.latestScore}/100${trend} (${context.dailyScore.latestDate || 'latest'})`);
      if (context.dailyScore.componentScores) {
        const cs = context.dailyScore.componentScores;
        sections.push(`- Components: Workout: ${cs.workout}, Nutrition: ${cs.nutrition}, Wellbeing: ${cs.wellbeing}, Biometrics: ${cs.biometrics}, Engagement: ${cs.engagement}, Consistency: ${cs.consistency}`);
      }
      sections.push('');
    }

    // Nutrition Analysis
    if (context.nutritionAnalysis.todayCalorieDeviation !== undefined || context.nutritionAnalysis.weeklyAdherenceRate !== undefined) {
      sections.push('Nutrition Analysis:');
      if (context.nutritionAnalysis.todayCalorieDeviation !== undefined) {
        const sign = context.nutritionAnalysis.todayCalorieDeviation >= 0 ? '+' : '';
        sections.push(`- Today's Calorie Deviation: ${sign}${Math.round(context.nutritionAnalysis.todayCalorieDeviation)} cal (${context.nutritionAnalysis.todayDeviationClass || 'unknown'})`);
      }
      if (context.nutritionAnalysis.weeklyAdherenceRate !== undefined) {
        sections.push(`- Weekly Adherence: ${context.nutritionAnalysis.weeklyAdherenceRate}% of days on target`);
      }
      sections.push('');
    }

    // Competitions
    if (context.competitions.activeCompetitions && context.competitions.activeCompetitions.length > 0) {
      sections.push('Active Competitions:');
      context.competitions.activeCompetitions.forEach(c => {
        const rankStr = c.currentRank ? `Rank #${c.currentRank}` : 'Unranked';
        const scoreStr = c.currentScore !== undefined ? `Score: ${Math.round(c.currentScore)}` : '';
        sections.push(`- ${c.name}: ${rankStr} ${scoreStr ? `(${scoreStr})` : ''} - ${c.daysRemaining} day(s) left`);
      });
      sections.push('');
    }

    // Progress Trend
    if (context.progressTrend.weightTrend && context.progressTrend.weightTrend !== 'no_data') {
      sections.push('Progress Trend:');
      const direction = context.progressTrend.weightTrend === 'losing' ? 'losing' : context.progressTrend.weightTrend === 'gaining' ? 'gaining' : 'stable';
      const changeStr = context.progressTrend.weightChangeKg
        ? ` (${context.progressTrend.weightChangeKg > 0 ? '+' : ''}${context.progressTrend.weightChangeKg} ${context.progressTrend.latestWeightUnit || 'kg'} over 30 days)`
        : '';
      sections.push(`- Weight: ${direction}${changeStr}`);
      if (context.progressTrend.latestWeight) {
        sections.push(`- Current: ${context.progressTrend.latestWeight} ${context.progressTrend.latestWeightUnit || 'kg'}`);
      }
      sections.push('');
    }

    return sections.join('\n');
  }
}

// Export singleton instance
export const comprehensiveUserContextService = new ComprehensiveUserContextService();
export default comprehensiveUserContextService;

