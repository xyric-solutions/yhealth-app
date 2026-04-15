/**
 * @file User Coaching Profile Service
 * @description Generates coaching profiles for users by aggregating existing data.
 * The profile shape matches exactly what the LangGraph chatbot's
 * buildCoachingMemorySection() and buildConciseUserContext() methods consume.
 */

import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import { comprehensiveUserContextService } from './comprehensive-user-context.service.js';
import type { ComprehensiveUserContext } from './comprehensive-user-context.service.js';
import { statusPatternAnalyzerService } from './status-pattern-analyzer.service.js';
import { aiScoringService } from './ai-scoring.service.js';
import type { DailyScore } from './ai-scoring.service.js';
import { mentalRecoveryScoreService } from './mental-recovery-score.service.js';
import { gamificationService } from './gamification.service.js';
import { env } from '../config/env.config.js';
import { llmCircuitBreaker } from './llm-circuit-breaker.service.js';
import { modelFactory } from './model-factory.service.js';

// ============================================
// TYPES
// ============================================

export interface FitnessJourney {
  totalWorkouts: number;
  workoutConsistencyRate: number; // 0-100
  streakDays: number;
  longestStreak: number;
  favoriteWorkouts: string[];
  weightChange: number | null; // kg, negative = lost
  recentWorkouts: { name: string; date?: string }[];
}

export interface MemorableMoment {
  description: string;
  date: string;
  type: string; // 'pr' | 'breakthrough' | 'milestone'
}

export interface Correlation {
  observation: string;
}

export interface Patterns {
  skipPatterns: { dayOfWeek: string; percentage?: number }[];
  bestPerformanceDays: string[];
  lowEnergyTriggers: string[];
  strugglingAreas?: string[];
}

export interface GoalsContext {
  primaryGoal: { title: string; progress: number; daysRemaining: number } | null;
  activeGoals: { title: string; progress: number }[];
  activeLifeGoals: Array<{
    category: string;
    title: string;
    progress: number;
    daysSinceLastActivity?: number;
    isStalled: boolean;
  }>;
  lifeGoalCount: number;
  stalledLifeGoalCount: number;
  motivationTier?: string;
  pendingActionsCount?: number;
}

export interface CurrentState {
  energyLevel: number; // 0-10
  moodLevel: number; // 0-10
  stressLevel: number; // 0-10
  readinessForWorkout: string;
  todaysBiometrics: { recoveryScore: number; sleepDuration: number } | null;
  suggestedFocus: string;
}

export interface RecommendedApproach {
  tone: string; // 'supportive' | 'direct' | 'tough_love'
  focus: string;
  openingStyle: string;
  avoidTopics: string[];
}

export interface NutritionJourney {
  dietaryNotes: string[];
}

export interface AdherenceScores {
  workout: number;
  nutrition: number;
  sleep: number;
  recovery: number;
  wellbeing: number;
}

export interface KeyInsight {
  type: 'working' | 'blocking';
  text: string;
}

export interface RiskFlag {
  severity: 'low' | 'medium' | 'high';
  category: string;
  description: string;
}

export interface Prediction {
  timeframe: string;
  metric: string;
  projection: string;
  confidence: number;
}

export interface NextBestAction {
  action: string;
  expectedImpact: string;
  priority: number;
}

export interface GoalAlignment {
  score: number;
  misaligned: { goal: string; reason: string }[];
}

export interface DataGap {
  metric: string;
  description: string;
  howToFix: string;
}

export interface EffectiveIntervention {
  intervention: string;
  outcome: string;
  dateRange: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface BehavioralPattern {
  pattern: string;
  frequency: 'always' | 'often' | 'sometimes';
  firstObserved: string;
  lastConfirmed: string;
}

export interface CoachingStrategy {
  preferredTone: 'supportive' | 'direct' | 'tough_love';
  bestTimeForMessages: string;
  responseToStruggles: string;
  celebrationStyle: string;
}

export interface StableTraits {
  personalityType: string;
  preferredWorkoutTypes: string[];
  motivationDrivers: string[];
  commonBarriers: string[];
  effectiveInterventions: EffectiveIntervention[];
  behavioralPatterns: BehavioralPattern[];
  coachingStrategy: CoachingStrategy;
  updatedAt: string;
}

export interface RecentObservations {
  trendDirection: 'improving' | 'stable' | 'declining';
  dominantMood: string;
  energyPattern: string;
  recentChanges: string[];
  updatedAt: string;
}

export interface LongitudinalAdherence {
  adherence7d: AdherenceScores;
  adherence30d: AdherenceScores;
  trendDirection: 'improving' | 'stable' | 'declining';
  consecutiveLowDays: number;
}

export type AccountabilityLevel = 'supportive' | 'direct' | 'accountability';

export interface CoachingProfile {
  firstName: string;
  daysOnPlatform: number;
  fitnessJourney: FitnessJourney;
  memorableMoments: MemorableMoment[];
  correlations: Correlation[];
  patterns: Patterns;
  goalsContext: GoalsContext;
  currentState: CurrentState;
  recommendedApproach: RecommendedApproach;
  nutritionJourney: NutritionJourney;
  // Extended fields for Coach Pro
  adherenceScores: AdherenceScores;
  keyInsights: KeyInsight[];
  riskFlags: RiskFlag[];
  predictions: Prediction[];
  nextBestActions: NextBestAction[];
  goalAlignment: GoalAlignment;
  dataGaps: DataGap[];
  // Stable traits and recent observations (Phase 2 upgrade)
  stableTraits?: StableTraits;
  recentObservations?: RecentObservations;
  profileVersion?: number;
  longitudinalAdherence?: LongitudinalAdherence;
  accountabilityLevel?: AccountabilityLevel;
  // Personal life context gathered during conversations
  personalContext?: PersonalContext;
}

export interface PersonalContext {
  occupation?: string;
  workSchedule?: string;
  familySituation?: string;
  cookingHabits?: string;
  dietaryCulture?: string;
  stressSources?: string;
  hobbies?: string;
  livingSituation?: string;
  financialContext?: string;
  dailyRoutine?: string;
  otherFacts?: string[];
  lastUpdated?: string;
}

// ============================================
// COACH EMOTIONAL INTELLIGENCE TYPES
// ============================================

export type CoachEmotion =
  | 'proud' | 'worried' | 'frustrated' | 'excited'
  | 'disappointed' | 'hopeful' | 'protective' | 'neutral';

export interface CoachEmotionalState {
  primary: CoachEmotion;
  intensity: number; // 0.0-1.0
  secondary?: CoachEmotion;
  reason: string; // Human-readable reason for the LLM
  sensation: string; // Embodied language hint
  memoryHook?: string; // Reference to a past moment
}

export interface RelationshipDepth {
  phase: 'new' | 'building' | 'established' | 'deep';
  daysOnPlatform: number;
  sharedMilestones: number;
  voiceStyle: string; // Prompt instruction for voice adaptation
}

// Internal types for data aggregation
interface DailyScoreRow {
  date: string;
  total_score: number;
  component_scores: Record<string, number>;
}

interface WorkoutLogRow {
  workout_name: string;
  scheduled_date: string;
  status: string;
  day_of_week: string;
  total_volume: number | null;
  duration_minutes: number | null;
}

interface WeightRecord {
  value: number;
  date: string;
}

interface AIInsightsResult {
  correlations: Correlation[];
  suggestedFocus: string;
  openingStyle: string;
  keyInsights: KeyInsight[];
  nextBestActions: NextBestAction[];
  predictions: Prediction[];
}

// ============================================
// SERVICE CLASS
// ============================================

class UserCoachingProfileService {
  private llm: BaseChatModel;
  private tableEnsured = false;
  private ensureTablePromise: Promise<void> | null = null;

  constructor() {
    this.llm = modelFactory.getModel({
      tier: 'reasoning',
      maxTokens: 1500,
    });
  }

  // ============================================
  // TABLE MANAGEMENT
  // ============================================

  private async ensureTable(): Promise<void> {
    if (this.tableEnsured) return;

    // Promise-based lock: if another concurrent call is already running DDL, wait for it
    if (this.ensureTablePromise) {
      await this.ensureTablePromise;
      return;
    }

    this.ensureTablePromise = this._doEnsureTable();
    try {
      await this.ensureTablePromise;
    } finally {
      this.ensureTablePromise = null;
    }
  }

  private async _doEnsureTable(): Promise<void> {
    if (this.tableEnsured) return;

    try {
      // Try a lightweight probe first — table + columns are managed by sync-missing-columns.sql at startup
      await query(`SELECT 1 FROM user_coaching_profiles LIMIT 0`);
      this.tableEnsured = true;
    } catch {
      // Table doesn't exist yet — create it (fallback for first-time setup before migration runs)
      try {
        await query(`
          CREATE TABLE IF NOT EXISTS user_coaching_profiles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            profile_data JSONB NOT NULL,
            adherence_scores JSONB,
            key_insights JSONB,
            risk_flags JSONB,
            predictions JSONB,
            next_best_actions JSONB,
            goal_alignment JSONB,
            data_gaps JSONB,
            coaching_tone VARCHAR(20) DEFAULT 'direct',
            generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            generation_model VARCHAR(50),
            generation_tokens INTEGER,
            stable_traits JSONB,
            recent_observations JSONB,
            profile_version INTEGER DEFAULT 1,
            stable_traits_updated_at TIMESTAMPTZ,
            personal_context JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(user_id)
          )
        `);

        await query(`
          CREATE TABLE IF NOT EXISTS user_coaching_profile_history (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            profile_version INTEGER NOT NULL,
            profile_data JSONB NOT NULL,
            stable_traits JSONB,
            recent_observations JSONB,
            generated_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
        await query(`CREATE INDEX IF NOT EXISTS idx_profile_history_user ON user_coaching_profile_history(user_id, profile_version DESC)`);

        this.tableEnsured = true;
      } catch (error) {
        logger.error('[CoachingProfile] Error ensuring table exists', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Get a cached coaching profile.
   * Returns null if missing or stale (>24 hours).
   */
  async getProfile(userId: string): Promise<CoachingProfile | null> {
    try {
      await this.ensureTable();

      const result = await query<{
        profile_data: CoachingProfile;
        generated_at: string;
        stable_traits: any;
        recent_observations: any;
        personal_context: any;
      }>(
        `SELECT profile_data, generated_at, stable_traits, recent_observations, personal_context
         FROM user_coaching_profiles
         WHERE user_id = $1
         LIMIT 1`,
        [userId]
      );

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      const generatedAt = new Date(row.generated_at);
      const ageHours = (Date.now() - generatedAt.getTime()) / (1000 * 60 * 60);

      // Consider stale after 24 hours
      if (ageHours > 24) {
        logger.info('[CoachingProfile] Profile is stale (>24h)', {
          userId,
          ageHours: Math.round(ageHours),
        });
        return null;
      }

      const profile = typeof row.profile_data === 'string'
        ? JSON.parse(row.profile_data)
        : row.profile_data;
      if (row.stable_traits) {
        profile.stableTraits = typeof row.stable_traits === 'string' ? JSON.parse(row.stable_traits) : row.stable_traits;
      }
      if (row.recent_observations) {
        profile.recentObservations = typeof row.recent_observations === 'string' ? JSON.parse(row.recent_observations) : row.recent_observations;
      }
      if (row.personal_context) {
        profile.personalContext = typeof row.personal_context === 'string' ? JSON.parse(row.personal_context) : row.personal_context;
      }
      return profile;
    } catch (error) {
      logger.error('[CoachingProfile] Error fetching profile', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Get an existing profile if fresh (<6h), or generate a new one.
   */
  async getOrGenerateProfile(userId: string, cachedContext?: any): Promise<CoachingProfile> {
    try {
      await this.ensureTable();

      const result = await query<{
        profile_data: CoachingProfile;
        generated_at: string;
        stable_traits: any;
        recent_observations: any;
        personal_context: any;
      }>(
        `SELECT profile_data, generated_at, stable_traits, recent_observations, personal_context
         FROM user_coaching_profiles
         WHERE user_id = $1
         LIMIT 1`,
        [userId]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0];
        const generatedAt = new Date(row.generated_at);
        const ageHours = (Date.now() - generatedAt.getTime()) / (1000 * 60 * 60);

        const profile = typeof row.profile_data === 'string'
          ? JSON.parse(row.profile_data)
          : row.profile_data;
        if (row.stable_traits) {
          profile.stableTraits = typeof row.stable_traits === 'string' ? JSON.parse(row.stable_traits) : row.stable_traits;
        }
        if (row.recent_observations) {
          profile.recentObservations = typeof row.recent_observations === 'string' ? JSON.parse(row.recent_observations) : row.recent_observations;
        }
        if (row.personal_context) {
          profile.personalContext = typeof row.personal_context === 'string' ? JSON.parse(row.personal_context) : row.personal_context;
        }

        // Fresh enough (<6h), return cached
        if (ageHours < 6) {
          logger.debug('[CoachingProfile] Returning cached profile', {
            userId,
            ageHours: Math.round(ageHours * 10) / 10,
          });
          return profile;
        }

        // Stale-while-revalidate: return stale profile NOW, refresh in background
        // This prevents blocking chat messages with 37s profile regeneration
        logger.info('[CoachingProfile] Returning stale profile, refreshing in background', {
          userId,
          ageHours: Math.round(ageHours * 10) / 10,
        });
        this.generateProfile(userId, cachedContext).catch((err) => {
          logger.warn('[CoachingProfile] Background refresh failed', {
            userId,
            error: err instanceof Error ? err.message : 'Unknown',
          });
        });
        return profile;
      }

      // No profile exists at all — must generate (first time only)
      return this.generateProfile(userId, cachedContext);
    } catch (error) {
      logger.error('[CoachingProfile] Error in getOrGenerateProfile', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Fall back to generating a fresh profile
      return this.generateProfile(userId, cachedContext);
    }
  }

  /**
   * Main orchestrator: generate a full coaching profile from all data sources.
   */
  async generateProfile(userId: string, cachedContext?: any): Promise<CoachingProfile> {
    const startTime = Date.now();
    await this.ensureTable();

    logger.info('[CoachingProfile] Generating profile', { userId });

    const todayStr = new Date().toISOString().split('T')[0];

    // ----- Step 1: Gather all data in parallel -----
    const [
      context,
      dailyScore,
      recoveryScore,
      gamificationStats,
      historicalScores,
      workoutLogs,
      weightHistory,
      userBasics,
    ] = await Promise.all([
      cachedContext ? Promise.resolve(cachedContext) : this.safeCall(() => comprehensiveUserContextService.getComprehensiveContext(userId), this.emptyContext()),
      this.safeCall(() => aiScoringService.getDailyScore(userId, todayStr), null),
      this.safeCall(() => mentalRecoveryScoreService.calculateRecoveryScore(userId), null),
      this.safeCall(() => gamificationService.getUserStats(userId), null),
      this.safeCall(() => this.getHistoricalScores(userId, 30), []),
      this.safeCall(() => this.getWorkoutLogs(userId, 30), []),
      this.safeCall(() => this.getWeightHistory(userId, 90), []),
      this.safeCall(() => this.getUserBasics(userId), { firstName: 'User', daysOnPlatform: 0 }),
    ]);

    // ----- Step 2: Compute derived data -----
    const fitnessJourney = this.buildFitnessJourney(context, gamificationStats, weightHistory, workoutLogs);
    const patterns = this.buildPatterns(workoutLogs);
    const memorableMoments = this.buildMemorableMoments(gamificationStats, context.goals, workoutLogs);
    const goalsContext = this.buildGoalsContext(context);

    // Fetch pending goal actions count (non-blocking)
    try {
      const pendingResult = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM goal_actions WHERE user_id = $1 AND is_completed = false`,
        [userId]
      );
      goalsContext.pendingActionsCount = parseInt(pendingResult.rows[0]?.count ?? '0', 10);
    } catch {
      // Non-fatal: pending actions count is informational
    }

    const currentState = this.buildCurrentState(context, recoveryScore, dailyScore);
    const nutritionJourney = this.buildNutritionJourney(context);
    const adherenceScores = this.computeAdherenceScores(historicalScores);
    const longitudinalAdherence = this.computeLongitudinalAdherence(historicalScores);
    const accountabilityLevel = this.determineAccountabilityLevel(longitudinalAdherence);
    const goalAlignment = this.computeGoalAlignment(context.goals, context, adherenceScores);
    const riskFlags = this.detectRisks(context, historicalScores, recoveryScore);
    const dataGaps = this.detectDataGaps(context, dailyScore);

    // Status pattern analysis (day-of-week, post-event patterns)
    const statusPatterns = await this.safeCall(
      () => statusPatternAnalyzerService.analyzePatterns(userId), []
    );
    if (statusPatterns.length > 0) {
      statusPatternAnalyzerService.persistPatterns(userId, statusPatterns).catch((error) => {
        logger.warn('[CoachingProfile] Failed to persist status patterns', { userId, error: error instanceof Error ? error.message : 'unknown' });
      });
    }

    // ----- Step 3: LLM-powered insights -----
    const aiInsights = await this.generateAIInsights(
      context, historicalScores, goalAlignment, riskFlags, fitnessJourney, currentState, patterns
    );

    // Compute predictions (partially LLM, partially deterministic)
    const predictions = this.computePredictions(context, historicalScores, weightHistory, aiInsights.predictions);

    // Build recommended approach
    const recommendedApproach = this.buildRecommendedApproach(
      context, currentState, riskFlags, aiInsights
    );

    // ----- Step 4: Assemble the profile -----
    const profile: CoachingProfile = {
      firstName: userBasics.firstName,
      daysOnPlatform: userBasics.daysOnPlatform,
      fitnessJourney,
      memorableMoments,
      correlations: aiInsights.correlations,
      patterns,
      goalsContext,
      currentState: {
        ...currentState,
        suggestedFocus: aiInsights.suggestedFocus,
      },
      recommendedApproach: {
        ...recommendedApproach,
        openingStyle: aiInsights.openingStyle,
      },
      nutritionJourney,
      adherenceScores,
      keyInsights: aiInsights.keyInsights,
      riskFlags,
      predictions,
      nextBestActions: aiInsights.nextBestActions,
      goalAlignment,
      dataGaps,
      longitudinalAdherence,
      accountabilityLevel,
    };

    // Generate recent observations (lightweight, deterministic)
    const recentObservations = this.generateRecentObservations(context, historicalScores);
    profile.recentObservations = recentObservations;

    // Get current version and increment
    const versionResult = await query<{ profile_version: number }>(
      `SELECT COALESCE(profile_version, 0) as profile_version FROM user_coaching_profiles WHERE user_id = $1`,
      [userId]
    );
    const currentVersion = versionResult.rows[0]?.profile_version ?? 0;
    profile.profileVersion = currentVersion + 1;

    // ----- Step 5: Persist -----
    await this.upsertProfile(userId, profile);

    const elapsed = Date.now() - startTime;
    logger.info('[CoachingProfile] Profile generated', {
      userId,
      elapsed: `${elapsed}ms`,
      riskFlags: riskFlags.length,
      insights: aiInsights.keyInsights.length,
    });

    return profile;
  }

  /**
   * Update the preferred coaching tone for a user.
   */
  async setCoachingTone(
    userId: string,
    tone: 'supportive' | 'direct' | 'tough_love'
  ): Promise<void> {
    await this.ensureTable();

    const validTones = ['supportive', 'direct', 'tough_love'];
    if (!validTones.includes(tone)) {
      throw new Error(`Invalid coaching tone: ${tone}. Must be one of: ${validTones.join(', ')}`);
    }

    await query(
      `UPDATE user_coaching_profiles
       SET coaching_tone = $1, updated_at = NOW()
       WHERE user_id = $2`,
      [tone, userId]
    );

    logger.info('[CoachingProfile] Coaching tone updated', { userId, tone });
  }

  // ============================================
  // DATA FETCHING HELPERS
  // ============================================

  private async getUserBasics(
    userId: string
  ): Promise<{ firstName: string; daysOnPlatform: number }> {
    const result = await query<{
      first_name: string | null;
      email: string | null;
      created_at: string;
    }>(
      `SELECT first_name, email, created_at FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return { firstName: 'User', daysOnPlatform: 0 };
    }

    const row = result.rows[0];
    const firstName =
      row.first_name || row.email?.split('@')[0] || 'User';
    const createdAt = new Date(row.created_at);
    const daysOnPlatform = Math.max(
      1,
      Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
    );

    return { firstName, daysOnPlatform };
  }

  private async getHistoricalScores(
    userId: string,
    days: number
  ): Promise<DailyScoreRow[]> {
    const result = await query<{
      date: string;
      total_score: number;
      component_scores: Record<string, number>;
    }>(
      `SELECT date, total_score, component_scores
       FROM daily_user_scores
       WHERE user_id = $1
         AND date >= CURRENT_DATE - $2::integer * INTERVAL '1 day'
       ORDER BY date ASC`,
      [userId, days]
    );

    return result.rows.map((r) => ({
      date: r.date,
      total_score: parseFloat(r.total_score as unknown as string),
      component_scores:
        typeof r.component_scores === 'string'
          ? JSON.parse(r.component_scores)
          : r.component_scores,
    }));
  }

  private async getWorkoutLogs(
    userId: string,
    days: number
  ): Promise<WorkoutLogRow[]> {
    const result = await query<{
      workout_name: string;
      scheduled_date: string;
      status: string;
      day_of_week: string;
      total_volume: number | null;
      duration_minutes: number | null;
    }>(
      `SELECT
        workout_name,
        scheduled_date::text,
        status,
        TRIM(TO_CHAR(scheduled_date, 'Day')) as day_of_week,
        total_volume,
        duration_minutes
       FROM workout_logs
       WHERE user_id = $1
         AND scheduled_date >= CURRENT_DATE - $2::integer * INTERVAL '1 day'
       ORDER BY scheduled_date DESC`,
      [userId, days]
    );

    return result.rows;
  }

  private async getWeightHistory(
    userId: string,
    days: number
  ): Promise<WeightRecord[]> {
    const result = await query<{
      value: { value?: number; unit?: string };
      record_date: string;
    }>(
      `SELECT value, record_date::text
       FROM progress_records
       WHERE user_id = $1
         AND record_type = 'weight'
         AND record_date >= CURRENT_DATE - $2::integer * INTERVAL '1 day'
       ORDER BY record_date ASC`,
      [userId, days]
    );

    return result.rows
      .map((r) => {
        const val = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
        return {
          value: val?.value || 0,
          date: r.record_date,
        };
      })
      .filter((w) => w.value > 0);
  }

  // ============================================
  // PROFILE BUILDING METHODS
  // ============================================

  private buildFitnessJourney(
    _context: ComprehensiveUserContext,
    gamification: Awaited<ReturnType<typeof gamificationService.getUserStats>> | null,
    weightHistory: WeightRecord[],
    workoutLogs: WorkoutLogRow[]
  ): FitnessJourney {
    const completedWorkouts = workoutLogs.filter((w) => w.status === 'completed');
    const totalWorkouts = completedWorkouts.length;

    // Consistency rate: completed / total scheduled (last 30 days)
    const totalScheduled = workoutLogs.length;
    const workoutConsistencyRate =
      totalScheduled > 0
        ? Math.round((totalWorkouts / totalScheduled) * 100)
        : 0;

    // Streaks from gamification
    const streakDays = gamification?.currentStreak ?? 0;
    const longestStreak = gamification?.longestStreak ?? 0;

    // Favorite workouts: most frequently completed names
    const nameCounts: Record<string, number> = {};
    completedWorkouts.forEach((w) => {
      const name = w.workout_name || 'Unknown';
      nameCounts[name] = (nameCounts[name] || 0) + 1;
    });
    const favoriteWorkouts = Object.entries(nameCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);

    // Weight change from history
    let weightChange: number | null = null;
    if (weightHistory.length >= 2) {
      const first = weightHistory[0].value;
      const last = weightHistory[weightHistory.length - 1].value;
      weightChange = Math.round((last - first) * 10) / 10;
    }

    // Recent workouts (last 5 completed)
    const recentWorkouts = completedWorkouts.slice(0, 5).map((w) => ({
      name: w.workout_name || 'Workout',
      date: w.scheduled_date,
    }));

    return {
      totalWorkouts,
      workoutConsistencyRate,
      streakDays,
      longestStreak,
      favoriteWorkouts,
      weightChange,
      recentWorkouts,
    };
  }

  /**
   * Build skip/performance/energy patterns from workout logs.
   */
  buildPatterns(workoutLogs: WorkoutLogRow[]): Patterns {
    // Skip patterns: days with highest miss rate
    const dayScheduled: Record<string, number> = {};
    const dayMissed: Record<string, number> = {};

    workoutLogs.forEach((w) => {
      const day = w.day_of_week;
      dayScheduled[day] = (dayScheduled[day] || 0) + 1;
      if (w.status === 'missed' || w.status === 'skipped') {
        dayMissed[day] = (dayMissed[day] || 0) + 1;
      }
    });

    const skipPatterns = Object.entries(dayScheduled)
      .map(([day, scheduled]) => {
        const missed = dayMissed[day] || 0;
        const percentage = scheduled > 0 ? Math.round((missed / scheduled) * 100) : 0;
        return { dayOfWeek: day, percentage, missed, scheduled };
      })
      .filter((d) => d.percentage > 30) // Only flag days with >30% skip rate
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 3)
      .map(({ dayOfWeek, percentage }) => ({ dayOfWeek, percentage }));

    // Best performance days: days with highest completion + volume
    const dayCompleted: Record<string, number> = {};
    workoutLogs.forEach((w) => {
      if (w.status === 'completed') {
        const day = w.day_of_week;
        dayCompleted[day] = (dayCompleted[day] || 0) + 1;
      }
    });

    const bestPerformanceDays = Object.entries(dayCompleted)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([day]) => day);

    // Low energy triggers: derive from patterns (simplified -- correlate missed with day patterns)
    const lowEnergyTriggers: string[] = [];
    if (skipPatterns.length > 0) {
      lowEnergyTriggers.push(`Workouts after ${skipPatterns[0].dayOfWeek}`);
    }

    // Struggling areas for Known Blockers in concise context
    const strugglingAreas: string[] = [];
    if (skipPatterns.length > 0) {
      strugglingAreas.push(`High skip rate on ${skipPatterns.map((s) => s.dayOfWeek).join(', ')}`);
    }

    return {
      skipPatterns,
      bestPerformanceDays,
      lowEnergyTriggers,
      strugglingAreas,
    };
  }

  /**
   * Build memorable moments from gamification and goals data.
   */
  buildMemorableMoments(
    gamification: Awaited<ReturnType<typeof gamificationService.getUserStats>> | null,
    goals: ComprehensiveUserContext['goals'],
    workoutLogs: WorkoutLogRow[]
  ): MemorableMoment[] {
    const moments: MemorableMoment[] = [];
    const todayStr = new Date().toISOString().split('T')[0];

    // Streak milestones
    const streakMilestones = [7, 14, 30, 60, 90, 100];
    if (gamification) {
      const currentStreak = gamification.currentStreak;
      const reachedMilestone = streakMilestones
        .filter((m) => currentStreak >= m)
        .pop();
      if (reachedMilestone) {
        moments.push({
          description: `Hit a ${reachedMilestone}-day activity streak`,
          date: gamification.lastActivityDate || todayStr,
          type: 'milestone',
        });
      }

      // Level up milestone
      if (gamification.currentLevel > 1) {
        moments.push({
          description: `Reached Level ${gamification.currentLevel} (${gamification.totalXP.toLocaleString()} XP)`,
          date: gamification.lastActivityDate || todayStr,
          type: 'milestone',
        });
      }
    }

    // Personal records from workout logs
    if (workoutLogs.length > 0) {
      // Highest volume workout
      const completedWithVolume = workoutLogs.filter(
        (w) => w.status === 'completed' && w.total_volume && w.total_volume > 0
      );
      if (completedWithVolume.length > 0) {
        const maxVolumeWorkout = completedWithVolume.reduce((max, w) =>
          (w.total_volume || 0) > (max.total_volume || 0) ? w : max
        );
        moments.push({
          description: `Personal record: ${maxVolumeWorkout.workout_name} with ${maxVolumeWorkout.total_volume} volume`,
          date: maxVolumeWorkout.scheduled_date,
          type: 'pr',
        });
      }

      // Longest workout by duration
      const completedWithDuration = workoutLogs.filter(
        (w) => w.status === 'completed' && w.duration_minutes && w.duration_minutes > 0
      );
      if (completedWithDuration.length > 0) {
        const maxDurationWorkout = completedWithDuration.reduce((max, w) =>
          (w.duration_minutes || 0) > (max.duration_minutes || 0) ? w : max
        );
        if ((maxDurationWorkout.duration_minutes || 0) >= 60) {
          moments.push({
            description: `Longest workout: ${maxDurationWorkout.workout_name} for ${maxDurationWorkout.duration_minutes} minutes`,
            date: maxDurationWorkout.scheduled_date,
            type: 'pr',
          });
        }
      }
    }

    // Goal completions
    if (goals.activeGoals) {
      goals.activeGoals.forEach((g) => {
        if (g.progress >= 100) {
          moments.push({
            description: `Completed goal: "${g.title}"`,
            date: todayStr,
            type: 'breakthrough',
          });
        }
      });
    }

    // Sort by date descending, keep top 6
    return moments
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6);
  }

  /**
   * Build goals context for the profile.
   */
  private buildGoalsContext(context: ComprehensiveUserContext): GoalsContext {
    const activeGoals: { title: string; progress: number }[] = [];
    let primaryGoal: GoalsContext['primaryGoal'] = null;

    if (context.goals.activeGoals && context.goals.activeGoals.length > 0) {
      // First goal is primary (ordered by is_primary DESC, created_at DESC)
      const first = context.goals.activeGoals[0];
      primaryGoal = {
        title: first.title,
        progress: first.progress,
        daysRemaining: first.daysRemaining,
      };

      context.goals.activeGoals.forEach((g) => {
        activeGoals.push({ title: g.title, progress: g.progress });
      });
    }

    // Life goals from comprehensive context
    const activeLifeGoals = (context.goals.activeLifeGoals ?? []).map(g => ({
      category: g.category,
      title: g.title,
      progress: g.progress,
      daysSinceLastActivity: g.daysSinceLastActivity,
      isStalled: (g.daysSinceLastActivity ?? 0) > 7,
    }));

    return {
      primaryGoal,
      activeGoals,
      activeLifeGoals,
      lifeGoalCount: context.goals.lifeGoalCount ?? 0,
      stalledLifeGoalCount: context.goals.stalledLifeGoals ?? 0,
      motivationTier: context.goals.motivationTier as string | undefined,
    };
  }

  /**
   * Build current state snapshot.
   */
  private buildCurrentState(
    context: ComprehensiveUserContext,
    recoveryScore: Awaited<ReturnType<typeof mentalRecoveryScoreService.calculateRecoveryScore>> | null,
    _dailyScore: DailyScore | null
  ): CurrentState {
    // Energy: from mood logs or wellbeing context, fallback 5
    let energyLevel = 5;
    if (context.wellbeing?.recentEnergy?.averageRating !== undefined) {
      energyLevel = Math.round(context.wellbeing.recentEnergy.averageRating);
    }

    // Mood: from emotional check-in or mood logs, fallback 5
    let moodLevel = 5;
    if (context.mentalHealth.latestEmotionalCheckin?.overallMoodScore !== undefined) {
      moodLevel = Math.round(context.mentalHealth.latestEmotionalCheckin.overallMoodScore);
    } else if (context.wellbeing?.recentMood?.averageRating !== undefined) {
      moodLevel = Math.round(context.wellbeing.recentMood.averageRating);
    }

    // Stress: from wellbeing context or recovery service, fallback 5
    let stressLevel = 5;
    if (context.wellbeing?.recentStress?.averageRating !== undefined) {
      stressLevel = Math.round(context.wellbeing.recentStress.averageRating);
    } else if (recoveryScore?.factors?.stressLevel !== undefined) {
      stressLevel = Math.round(recoveryScore.factors.stressLevel / 10); // Convert 0-100 to 0-10
    }

    // Workout readiness
    let readinessForWorkout = 'Ready';
    const recoveryNum = context.whoop.lastRecovery?.score ?? (recoveryScore?.recoveryScore ?? 50);
    if (recoveryNum < 33) {
      readinessForWorkout = 'Low recovery - rest recommended';
    } else if (recoveryNum < 50) {
      readinessForWorkout = 'Moderate - light workout suggested';
    } else if (recoveryNum < 67) {
      readinessForWorkout = 'Ready';
    } else {
      readinessForWorkout = 'Fully recovered - push yourself';
    }

    // Biometrics
    let todaysBiometrics: CurrentState['todaysBiometrics'] = null;
    if (context.whoop.isConnected) {
      todaysBiometrics = {
        recoveryScore: context.whoop.lastRecovery?.score ?? 0,
        sleepDuration: context.whoop.lastSleep?.duration ?? 0,
      };
    }

    return {
      energyLevel,
      moodLevel,
      stressLevel,
      readinessForWorkout,
      todaysBiometrics,
      suggestedFocus: '', // Filled by AI later
    };
  }

  /**
   * Build nutrition journey notes.
   */
  private buildNutritionJourney(context: ComprehensiveUserContext): NutritionJourney {
    const dietaryNotes: string[] = [];

    if (context.nutrition.activeDietPlan) {
      dietaryNotes.push(
        `Active plan: ${context.nutrition.activeDietPlan.name} (${context.nutrition.activeDietPlan.dailyCalories} cal/day)`
      );
    }

    if (context.nutritionAnalysis.weeklyAdherenceRate !== undefined) {
      dietaryNotes.push(`Weekly nutrition adherence: ${context.nutritionAnalysis.weeklyAdherenceRate}%`);
    }

    if (context.waterIntake.todayPercentage !== undefined) {
      dietaryNotes.push(`Water intake today: ${context.waterIntake.todayPercentage}% of target`);
    }

    if (context.nutritionAnalysis.todayDeviationClass) {
      const classLabel =
        context.nutritionAnalysis.todayDeviationClass === 'on_target'
          ? 'on target'
          : context.nutritionAnalysis.todayDeviationClass === 'over'
            ? 'over target'
            : 'under target';
      dietaryNotes.push(`Today's calories: ${classLabel}`);
    }

    return { dietaryNotes };
  }

  // ============================================
  // SCORE COMPUTATION
  // ============================================

  /**
   * Compute adherence scores from 7-day average of daily_user_scores component scores.
   */
  computeAdherenceScores(dailyScores: DailyScoreRow[], windowDays: number = 7): AdherenceScores {
    if (dailyScores.length === 0) {
      return { workout: 0, nutrition: 0, sleep: 0, recovery: 0, wellbeing: 0 };
    }

    const recent = dailyScores.slice(-windowDays);

    const sum = { workout: 0, nutrition: 0, biometricsSleep: 0, biometricsRecovery: 0, wellbeing: 0 };
    let count = 0;

    recent.forEach((s) => {
      const cs = s.component_scores;
      if (!cs) return;
      sum.workout += cs.workout ?? 0;
      sum.nutrition += cs.nutrition ?? 0;
      // biometrics is a combined score; split conceptually for sleep & recovery
      // Since we do not have separate sleep/recovery in daily scores,
      // we approximate: sleep = biometrics * 0.5, recovery = biometrics * 0.5
      sum.biometricsSleep += (cs.biometrics ?? 0);
      sum.biometricsRecovery += (cs.biometrics ?? 0);
      sum.wellbeing += cs.wellbeing ?? 0;
      count++;
    });

    if (count === 0) {
      return { workout: 0, nutrition: 0, sleep: 0, recovery: 0, wellbeing: 0 };
    }

    return {
      workout: Math.round(sum.workout / count),
      nutrition: Math.round(sum.nutrition / count),
      sleep: Math.round(sum.biometricsSleep / count),
      recovery: Math.round(sum.biometricsRecovery / count),
      wellbeing: Math.round(sum.wellbeing / count),
    };
  }

  /**
   * Compute longitudinal adherence: 7d vs 30d with trend and consecutive low days.
   * Used to determine if the user needs escalated accountability coaching.
   */
  computeLongitudinalAdherence(dailyScores: DailyScoreRow[]): LongitudinalAdherence {
    const adherence7d = this.computeAdherenceScores(dailyScores, 7);
    const adherence30d = this.computeAdherenceScores(dailyScores, 30);

    // Average across all pillars
    const avg = (a: AdherenceScores) =>
      (a.workout + a.nutrition + a.sleep + a.recovery + a.wellbeing) / 5;
    const avg7 = avg(adherence7d);
    const avg30 = avg(adherence30d);

    // Trend: compare short-term to long-term
    let trendDirection: 'improving' | 'stable' | 'declining' = 'stable';
    if (avg7 - avg30 > 5) trendDirection = 'improving';
    else if (avg30 - avg7 > 5) trendDirection = 'declining';

    // Count consecutive low days from most recent backward
    let consecutiveLowDays = 0;
    const sorted = [...dailyScores].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    for (const day of sorted) {
      const cs = day.component_scores;
      if (!cs) break;
      const dayAvg =
        ((cs.workout ?? 0) + (cs.nutrition ?? 0) + (cs.biometrics ?? 0) + (cs.wellbeing ?? 0)) / 4;
      if (dayAvg < 40) {
        consecutiveLowDays++;
      } else {
        break;
      }
    }

    return { adherence7d, adherence30d, trendDirection, consecutiveLowDays };
  }

  /**
   * Determine accountability escalation level from longitudinal adherence.
   * - 'accountability': 14+ consecutive low days AND 30d avg < 40 → force tough_love
   * - 'direct': 7d < 40 but 30d > 50 → recently slipping, be direct
   * - 'supportive': default
   */
  determineAccountabilityLevel(longitudinal: LongitudinalAdherence): AccountabilityLevel {
    const avg = (a: AdherenceScores) =>
      (a.workout + a.nutrition + a.sleep + a.recovery + a.wellbeing) / 5;
    const avg30 = avg(longitudinal.adherence30d);
    const avg7 = avg(longitudinal.adherence7d);

    if (longitudinal.consecutiveLowDays >= 14 && avg30 < 40) {
      return 'accountability';
    }
    if (avg7 < 40 && avg30 > 50) {
      return 'direct';
    }
    return 'supportive';
  }

  /**
   * Compute goal alignment: how well behavior matches stated goals.
   */
  computeGoalAlignment(
    goals: ComprehensiveUserContext['goals'],
    context: ComprehensiveUserContext,
    adherence: AdherenceScores
  ): GoalAlignment {
    const misaligned: { goal: string; reason: string }[] = [];
    let alignmentTotal = 0;
    let goalCount = 0;

    if (!goals.activeGoals || goals.activeGoals.length === 0) {
      return { score: 50, misaligned: [] }; // Neutral if no goals
    }

    goals.activeGoals.forEach((goal) => {
      goalCount++;
      const category = (goal.category || '').toLowerCase();
      let goalAlignmentScore = 50; // neutral default

      if (category.includes('weight') || category.includes('fat')) {
        // Weight loss/gain: check calorie adherence + workout frequency + trend
        const nutritionOk = adherence.nutrition >= 50;
        const workoutOk = adherence.workout >= 50;
        const trendOk =
          context.progressTrend.weightTrend === 'losing'
            ? category.includes('loss')
            : context.progressTrend.weightTrend === 'gaining'
              ? category.includes('gain')
              : false;

        let score = 0;
        if (nutritionOk) score += 35;
        if (workoutOk) score += 35;
        if (trendOk) score += 30;
        goalAlignmentScore = score;

        if (!nutritionOk) {
          misaligned.push({
            goal: goal.title,
            reason: `Nutrition adherence (${adherence.nutrition}%) is below target for ${category} goal`,
          });
        }
        if (!workoutOk) {
          misaligned.push({
            goal: goal.title,
            reason: `Workout consistency (${adherence.workout}%) needs improvement`,
          });
        }
      } else if (category.includes('muscle') || category.includes('strength')) {
        // Muscle/strength: protein intake + progressive overload + recovery
        const workoutOk = adherence.workout >= 60;
        const recoveryOk = adherence.recovery >= 50;

        let score = 0;
        if (workoutOk) score += 50;
        if (recoveryOk) score += 30;
        if (adherence.nutrition >= 50) score += 20;
        goalAlignmentScore = score;

        if (!workoutOk) {
          misaligned.push({
            goal: goal.title,
            reason: `Workout consistency needs to be higher for strength goals`,
          });
        }
      } else {
        // General fitness: workout consistency + variety
        const workoutOk = adherence.workout >= 40;
        const wellbeingOk = adherence.wellbeing >= 40;

        let score = 0;
        if (workoutOk) score += 50;
        if (wellbeingOk) score += 30;
        if (adherence.nutrition >= 30) score += 20;
        goalAlignmentScore = score;

        if (!workoutOk) {
          misaligned.push({
            goal: goal.title,
            reason: `More frequent workouts needed to achieve "${goal.title}"`,
          });
        }
      }

      alignmentTotal += goalAlignmentScore;
    });

    const overallScore = goalCount > 0 ? Math.round(alignmentTotal / goalCount) : 50;

    return { score: overallScore, misaligned };
  }

  /**
   * Detect risk signals from user data.
   */
  detectRisks(
    context: ComprehensiveUserContext,
    dailyScores: DailyScoreRow[],
    recoveryScore: Awaited<ReturnType<typeof mentalRecoveryScoreService.calculateRecoveryScore>> | null
  ): RiskFlag[] {
    const risks: RiskFlag[] = [];
    const recent3 = dailyScores.slice(-3);
    const recent7 = dailyScores.slice(-7);

    // 1. Sleep debt: sleep component < threshold for 3+ days
    const sleepDebtDays = recent3.filter(
      (s) => (s.component_scores?.biometrics ?? 50) < 40
    ).length;
    if (sleepDebtDays >= 3) {
      risks.push({
        severity: 'high',
        category: 'sleep',
        description: `Poor biometrics/sleep scores for ${sleepDebtDays} consecutive days. Risk of accumulated sleep debt.`,
      });
    }

    // Also check WHOOP sleep directly
    if (context.whoop.lastSleep && context.whoop.lastSleep.duration < 6) {
      risks.push({
        severity: 'medium',
        category: 'sleep',
        description: `Last sleep was only ${context.whoop.lastSleep.duration.toFixed(1)} hours. Recommend recovery focus.`,
      });
    }

    // 2. Overtraining: high strain + low recovery for 2+ days
    if (
      context.whoop.todayStrain &&
      context.whoop.lastRecovery &&
      context.whoop.todayStrain.score > 16 &&
      context.whoop.lastRecovery.score < 40
    ) {
      risks.push({
        severity: 'high',
        category: 'overtraining',
        description: `High strain (${context.whoop.todayStrain.score.toFixed(1)}) with low recovery (${context.whoop.lastRecovery.score}%). Active recovery recommended.`,
      });
    }

    // 3. Nutritional deficit: nutrition score < 40 for 3+ days
    const nutritionDeficitDays = recent3.filter(
      (s) => (s.component_scores?.nutrition ?? 50) < 40
    ).length;
    if (nutritionDeficitDays >= 3) {
      risks.push({
        severity: 'medium',
        category: 'nutrition',
        description: `Nutrition scores below 40 for ${nutritionDeficitDays} consecutive days. Consider meal planning assistance.`,
      });
    }

    // 4. Mental health: declining recovery + high stress
    if (
      recoveryScore &&
      recoveryScore.trend === 'declining' &&
      (recoveryScore.factors?.stressLevel ?? 0) > 70
    ) {
      risks.push({
        severity: 'high',
        category: 'mental_health',
        description: `Mental recovery score is declining with high stress levels. Prioritize wellbeing activities.`,
      });
    }

    // 5. Streak risk: near milestone with declining engagement
    if (context.gamification.streakAtRisk && context.gamification.currentStreak) {
      const nearMilestone = [7, 14, 30, 60, 90, 100].find(
        (m) => context.gamification.currentStreak! >= m - 2 && context.gamification.currentStreak! < m
      );
      if (nearMilestone) {
        risks.push({
          severity: 'medium',
          category: 'engagement',
          description: `${context.gamification.currentStreak}-day streak at risk. Only ${nearMilestone - context.gamification.currentStreak!} days from ${nearMilestone}-day milestone.`,
        });
      } else {
        risks.push({
          severity: 'low',
          category: 'engagement',
          description: `${context.gamification.currentStreak}-day streak at risk. No activity logged today.`,
        });
      }
    }

    // 6. HRV crash: today's HRV < 70% of 7-day average
    if (context.whoop.lastRecovery?.hrv !== undefined) {
      // We don't have 7-day HRV average directly, but check if recovery is very low
      if (context.whoop.lastRecovery.score < 30) {
        risks.push({
          severity: 'high',
          category: 'recovery',
          description: `Very low recovery score (${context.whoop.lastRecovery.score}%) with HRV of ${context.whoop.lastRecovery.hrv}ms. Consider rest day.`,
        });
      }
    }

    // 7. Overall score decline
    if (recent7.length >= 5) {
      const firstHalf = recent7.slice(0, Math.floor(recent7.length / 2));
      const secondHalf = recent7.slice(Math.floor(recent7.length / 2));
      const firstAvg = firstHalf.reduce((s, r) => s + r.total_score, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((s, r) => s + r.total_score, 0) / secondHalf.length;
      if (firstAvg - secondAvg > 15) {
        risks.push({
          severity: 'medium',
          category: 'overall_decline',
          description: `Health score dropped significantly: from ${Math.round(firstAvg)} to ${Math.round(secondAvg)} over the last week.`,
        });
      }
    }

    return risks;
  }

  /**
   * Detect missing data that would improve coaching quality.
   */
  private detectDataGaps(
    context: ComprehensiveUserContext,
    dailyScore: DailyScore | null
  ): DataGap[] {
    const gaps: DataGap[] = [];

    if (!context.whoop.isConnected) {
      gaps.push({
        metric: 'wearable_data',
        description: 'No wearable device connected for biometric tracking',
        howToFix: 'Connect a WHOOP band or compatible device in Settings > Integrations',
      });
    }

    if (!context.nutrition.activeDietPlan) {
      gaps.push({
        metric: 'diet_plan',
        description: 'No active diet plan configured',
        howToFix: 'Create a diet plan in the Nutrition tab to track calorie and macro goals',
      });
    }

    if (!context.goals.activeGoals || context.goals.activeGoals.length === 0) {
      gaps.push({
        metric: 'goals',
        description: 'No active fitness or health goals set',
        howToFix: 'Set at least one goal in the Goals section to enable progress tracking',
      });
    }

    if (context.mentalHealth.latestRecoveryScore === undefined) {
      gaps.push({
        metric: 'mental_health',
        description: 'No recent mental recovery score available',
        howToFix: 'Complete an emotional check-in or mood log to enable mental health tracking',
      });
    }

    if (
      context.waterIntake.todayMlConsumed === undefined &&
      context.waterIntake.weeklyAverage === undefined
    ) {
      gaps.push({
        metric: 'hydration',
        description: 'No water intake tracked',
        howToFix: 'Log water intake daily using the Water Intake tracker',
      });
    }

    if (dailyScore && dailyScore.componentScores) {
      const cs = dailyScore.componentScores;
      if (cs.engagement === 0) {
        gaps.push({
          metric: 'engagement',
          description: 'No daily tasks, habits, or routines tracked today',
          howToFix: 'Set up daily habits or routines in the Lifestyle section',
        });
      }
    }

    return gaps;
  }

  // ============================================
  // PREDICTION COMPUTATION
  // ============================================

  /**
   * Compute predictions using linear regression and trend analysis.
   */
  computePredictions(
    context: ComprehensiveUserContext,
    dailyScores: DailyScoreRow[],
    weightHistory: WeightRecord[],
    aiPredictions: Prediction[]
  ): Prediction[] {
    const predictions: Prediction[] = [];

    // 1. Weight trajectory: simple linear regression on last 30 days
    if (weightHistory.length >= 3) {
      const n = weightHistory.length;
      const xValues = weightHistory.map((_, i) => i);
      const yValues = weightHistory.map((w) => w.value);
      const xMean = xValues.reduce((s, x) => s + x, 0) / n;
      const yMean = yValues.reduce((s, y) => s + y, 0) / n;

      let numerator = 0;
      let denominator = 0;
      for (let i = 0; i < n; i++) {
        numerator += (xValues[i] - xMean) * (yValues[i] - yMean);
        denominator += (xValues[i] - xMean) * (xValues[i] - xMean);
      }

      if (denominator > 0) {
        const slope = numerator / denominator; // kg per record interval
        // Average interval between records
        const firstDate = new Date(weightHistory[0].date);
        const lastDate = new Date(weightHistory[n - 1].date);
        const totalDays = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
        const daysPerRecord = totalDays / (n - 1);
        const kgPerWeek = (slope / daysPerRecord) * 7;

        const projectedIn30 = yValues[n - 1] + (slope / daysPerRecord) * 30;
        const direction = kgPerWeek < -0.1 ? 'decrease' : kgPerWeek > 0.1 ? 'increase' : 'stable';

        predictions.push({
          timeframe: '30 days',
          metric: 'weight',
          projection: `Weight projected to ${direction} to ${projectedIn30.toFixed(1)} kg (${kgPerWeek > 0 ? '+' : ''}${kgPerWeek.toFixed(2)} kg/week)`,
          confidence: Math.min(0.9, 0.5 + (n / 30) * 0.4), // Higher confidence with more data points
        });
      }
    }

    // 2. Score trend: 7-day avg vs 30-day avg
    if (dailyScores.length >= 7) {
      const last7 = dailyScores.slice(-7);
      const avg7 = last7.reduce((s, r) => s + r.total_score, 0) / last7.length;
      const avg30 = dailyScores.reduce((s, r) => s + r.total_score, 0) / dailyScores.length;

      const diff = avg7 - avg30;
      const direction = diff > 3 ? 'improving' : diff < -3 ? 'declining' : 'stable';

      predictions.push({
        timeframe: '7 days',
        metric: 'health_score',
        projection: `Health score trend is ${direction} (7-day avg: ${Math.round(avg7)}, 30-day avg: ${Math.round(avg30)})`,
        confidence: Math.min(0.85, 0.4 + (dailyScores.length / 30) * 0.45),
      });
    }

    // 3. Goal achievement: days remaining vs progress rate
    if (context.goals.activeGoals) {
      context.goals.activeGoals.forEach((goal) => {
        if (goal.progress > 0 && goal.progress < 100 && goal.daysRemaining > 0) {
          // Days elapsed = total period - remaining
          const daysElapsed = Math.max(1, 90 - goal.daysRemaining); // Assume 90 day default period
          const progressPerDay = goal.progress / daysElapsed;
          const projectedDaysToComplete = progressPerDay > 0
            ? Math.ceil((100 - goal.progress) / progressPerDay)
            : Infinity;

          const onTrack = projectedDaysToComplete <= goal.daysRemaining;

          predictions.push({
            timeframe: `${goal.daysRemaining} days`,
            metric: 'goal_completion',
            projection: onTrack
              ? `"${goal.title}" is on track to complete within ${projectedDaysToComplete} days`
              : `"${goal.title}" needs acceleration - projected ${projectedDaysToComplete} days but only ${goal.daysRemaining} remaining`,
            confidence: 0.6,
          });
        }
      });
    }

    // 4. Merge AI-generated predictions (deduplicate by metric)
    const existingMetrics = new Set(predictions.map((p) => p.metric));
    aiPredictions.forEach((p) => {
      if (!existingMetrics.has(p.metric)) {
        predictions.push(p);
      }
    });

    return predictions;
  }

  // ============================================
  // RECOMMENDED APPROACH
  // ============================================

  private buildRecommendedApproach(
    context: ComprehensiveUserContext,
    currentState: CurrentState,
    riskFlags: RiskFlag[],
    _aiInsights: AIInsightsResult
  ): RecommendedApproach {
    // Determine tone based on current state and risk flags
    let tone: 'supportive' | 'direct' | 'tough_love' = 'direct';
    const avoidTopics: string[] = [];

    // Check user preference first
    if (context.lifestyle.preferences?.coachingStyle) {
      const pref = context.lifestyle.preferences.coachingStyle.toLowerCase();
      if (pref.includes('supportive') || pref.includes('gentle')) tone = 'supportive';
      else if (pref.includes('tough') || pref.includes('hard')) tone = 'tough_love';
    }

    // Override to supportive if user is struggling
    const highRisks = riskFlags.filter((r) => r.severity === 'high');
    if (highRisks.length > 0) {
      tone = 'supportive';
    }

    if (currentState.moodLevel <= 3 || currentState.stressLevel >= 8) {
      tone = 'supportive';
    }

    // Avoid topics based on risks
    if (riskFlags.some((r) => r.category === 'mental_health')) {
      avoidTopics.push('intense workout pressure');
    }
    if (riskFlags.some((r) => r.category === 'overtraining')) {
      avoidTopics.push('increasing workout intensity');
    }

    // Determine focus
    let focus = 'balanced wellness';
    if (highRisks.length > 0) {
      focus = `recovery and ${highRisks[0].category.replace('_', ' ')}`;
    } else if (currentState.energyLevel >= 7 && currentState.moodLevel >= 7) {
      focus = 'pushing performance boundaries';
    } else if (currentState.energyLevel <= 4) {
      focus = 'energy management and gentle activity';
    }

    return {
      tone,
      focus,
      openingStyle: '', // Filled by AI
      avoidTopics,
    };
  }

  // ============================================
  // AI-POWERED INSIGHTS
  // ============================================

  /**
   * Single LLM call to generate correlations, insights, focus, opening style,
   * key insights, and next best actions.
   */
  private async generateAIInsights(
    context: ComprehensiveUserContext,
    dailyScores: DailyScoreRow[],
    goalAlignment: GoalAlignment,
    riskFlags: RiskFlag[],
    fitnessJourney: FitnessJourney,
    currentState: CurrentState,
    patterns: Patterns
  ): Promise<AIInsightsResult> {
    const defaults: AIInsightsResult = {
      correlations: [],
      suggestedFocus: 'Continue building consistent habits across all health pillars.',
      openingStyle: 'Start with a warm, personalized greeting referencing their recent activity.',
      keyInsights: [],
      nextBestActions: [],
      predictions: [],
    };

    try {
      // Build a concise data summary for the LLM
      const dataSummary = this.buildAIDataSummary(
        context, dailyScores, goalAlignment, riskFlags, fitnessJourney, currentState, patterns
      );

      const systemPrompt = `You are a data analyst for a health coaching platform. Given user health/fitness data, generate coaching insights as JSON.

Return ONLY valid JSON with this exact structure:
{
  "correlations": [{"observation": "string"}],
  "suggestedFocus": "string - one sentence coaching focus for today",
  "openingStyle": "string - how to start the conversation (reference specific data)",
  "keyInsights": [{"type": "working|blocking", "text": "string"}],
  "nextBestActions": [{"action": "string", "expectedImpact": "string", "priority": 1}],
  "predictions": [{"timeframe": "string", "metric": "string", "projection": "string", "confidence": 0.7}]
}

Rules:
- correlations: 3-5 cross-domain observations connecting different data points (e.g., sleep affecting workouts)
- keyInsights: 2-4 items, mix of "working" (positive patterns) and "blocking" (negative patterns)
- nextBestActions: top 3, priority 1=highest, be specific and actionable
- predictions: 1-2, only if data supports them
- suggestedFocus: based on current state, risks, and goals
- openingStyle: reference something specific from their recent data`;

      // Check circuit breaker before making LLM call
      if (!llmCircuitBreaker.isCallAllowed()) {
        logger.debug('[CoachingProfile] Circuit breaker OPEN, using default insights');
        return defaults;
      }

      // Attempt LLM call with timeout + single retry on empty response
      let content = '';
      const MAX_ATTEMPTS = 2;
      const LLM_INSIGHT_TIMEOUT_MS = 15000; // 15s per attempt (was unbounded, causing 18-20s waits)

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        try {
          const response = await Promise.race([
            this.llm.invoke([
              new SystemMessage(systemPrompt),
              new HumanMessage(dataSummary),
            ]),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('LLM insights timeout')), LLM_INSIGHT_TIMEOUT_MS)
            ),
          ]);

          llmCircuitBreaker.recordSuccess();

          // Extract text content — handle both string and array formats from LangChain
          if (typeof response.content === 'string') {
            content = response.content;
          } else if (Array.isArray(response.content)) {
            content = response.content
              .map((part: any) => (typeof part === 'string' ? part : part?.text || ''))
              .join('');
          } else {
            content = JSON.stringify(response.content);
          }

          if (content.length > 10) break; // Got a real response
        } catch (_timeoutError) {
          logger.warn('[CoachingProfile] LLM insight attempt timed out', {
            attempt: attempt + 1,
            timeout: LLM_INSIGHT_TIMEOUT_MS,
          });
        }

        logger.warn('[CoachingProfile] LLM returned near-empty response, retrying', {
          attempt: attempt + 1,
          contentLength: content.length,
          rawContent: content.substring(0, 100),
        });

        // Brief delay before retry to avoid hammering provider
        if (attempt < MAX_ATTEMPTS - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Extract JSON from response (handle markdown code blocks)
      // Strip markdown code fences first
      const cleaned = content.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '');
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn('[CoachingProfile] LLM response did not contain valid JSON', {
          contentLength: content.length,
          contentPreview: content.substring(0, 200),
        });
        return defaults;
      }

      // Sanitize common LLM JSON issues
      const sanitized = jsonMatch[0]
        // Remove single-line comments
        .replace(/\/\/[^\n]*/g, '')
        // Remove multi-line comments
        .replace(/\/\*[\s\S]*?\*\//g, '')
        // Fix missing commas between array elements: } { or } "key" or "val" {
        .replace(/\}\s*\{/g, '}, {')
        // Fix missing commas between object properties: "value" "nextKey"  or  "value"\n"nextKey"
        .replace(/"(\s*)\n(\s*)"/g, '",\n$2"')
        // Fix missing comma: ] "key" (array end followed by next property)
        .replace(/\]\s*"/g, '], "')
        // Fix missing comma: true/false/null/number followed by "key" on next line
        .replace(/(true|false|null|\d+\.?\d*)\s*\n(\s*)"/g, '$1,\n$2"')
        // Remove trailing commas before ] or }
        .replace(/,\s*([}\]])/g, '$1')
        // Fix unescaped newlines inside string values
        .replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match) =>
          match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
        );

      let parsed: Partial<AIInsightsResult>;
      try {
        parsed = JSON.parse(sanitized) as Partial<AIInsightsResult>;
      } catch (firstError) {
        // Second attempt: more aggressive cleanup for stubborn LLM output
        try {
          const aggressive = sanitized
            // Remove control characters except \n\r\t
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
            // Fix double commas
            .replace(/,\s*,/g, ',')
            // Re-strip trailing commas (may appear after previous fixes)
            .replace(/,\s*([}\]])/g, '$1');
          parsed = JSON.parse(aggressive) as Partial<AIInsightsResult>;
        } catch {
          // Third attempt: repair truncated JSON by closing unclosed brackets/braces
          try {
            let repaired = sanitized
              .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
              .replace(/,\s*,/g, ',')
              .replace(/,\s*([}\]])/g, '$1');

            // Count unclosed brackets and close them
            let openBraces = 0;
            let openBrackets = 0;
            let inString = false;
            let escaped = false;
            for (const ch of repaired) {
              if (escaped) { escaped = false; continue; }
              if (ch === '\\') { escaped = true; continue; }
              if (ch === '"') { inString = !inString; continue; }
              if (inString) continue;
              if (ch === '{') openBraces++;
              else if (ch === '}') openBraces--;
              else if (ch === '[') openBrackets++;
              else if (ch === ']') openBrackets--;
            }

            // If we're inside a string (odd quotes), close it
            if (inString) repaired += '"';
            // Close unclosed structures
            for (let i = 0; i < openBrackets; i++) repaired += ']';
            for (let i = 0; i < openBraces; i++) repaired += '}';

            // Strip trailing commas one more time after repair
            repaired = repaired.replace(/,\s*([}\]])/g, '$1');

            parsed = JSON.parse(repaired) as Partial<AIInsightsResult>;
            logger.info('[CoachingProfile] Repaired truncated JSON successfully');
          } catch (_repairError) {
            logger.warn('[CoachingProfile] All JSON parse attempts failed, returning defaults', {
              error: (firstError as Error).message,
              contentSnippet: sanitized.substring(0, 200),
            });
            return defaults;
          }
        }
      }

      return {
        correlations: Array.isArray(parsed.correlations) ? parsed.correlations : defaults.correlations,
        suggestedFocus: parsed.suggestedFocus || defaults.suggestedFocus,
        openingStyle: parsed.openingStyle || defaults.openingStyle,
        keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights : defaults.keyInsights,
        nextBestActions: Array.isArray(parsed.nextBestActions)
          ? parsed.nextBestActions
          : defaults.nextBestActions,
        predictions: Array.isArray(parsed.predictions) ? parsed.predictions : defaults.predictions,
      };
    } catch (error) {
      if (modelFactory.isAuthError(error)) {
        // Permanently blacklist provider with invalid API key (24h cooldown)
        modelFactory.markCurrentProviderRateLimited(24 * 60 * 60 * 1000);
        logger.warn('[CoachingProfile] Provider has invalid API key, blacklisted for 24h');
        try {
          this.llm = modelFactory.getModel({ tier: 'reasoning', maxTokens: 1500 });
          logger.info('[CoachingProfile] Switched to next LLM provider after auth failure');
        } catch { /* no providers available */ }
      } else if (llmCircuitBreaker.isRateLimitError(error)) {
        llmCircuitBreaker.recordRateLimitError(error);
        try {
          this.llm = modelFactory.getModel({ tier: 'reasoning', maxTokens: 1500 });
          logger.info('[CoachingProfile] Switched to fallback LLM provider after rate limit');
        } catch { /* no providers available */ }
      }
      logger.error('[CoachingProfile] Error generating AI insights', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return defaults;
    }
  }

  /**
   * Build a concise data summary string for the LLM.
   */
  private buildAIDataSummary(
    context: ComprehensiveUserContext,
    dailyScores: DailyScoreRow[],
    goalAlignment: GoalAlignment,
    riskFlags: RiskFlag[],
    fitnessJourney: FitnessJourney,
    currentState: CurrentState,
    patterns: Patterns
  ): string {
    const parts: string[] = [];

    parts.push('=== USER HEALTH DATA SUMMARY ===');

    // Fitness Journey
    parts.push(`\nFitness: ${fitnessJourney.totalWorkouts} workouts (${fitnessJourney.workoutConsistencyRate}% consistency), ${fitnessJourney.streakDays}-day streak`);
    if (fitnessJourney.favoriteWorkouts.length > 0) {
      parts.push(`Favorites: ${fitnessJourney.favoriteWorkouts.join(', ')}`);
    }
    if (fitnessJourney.weightChange !== null) {
      parts.push(`Weight change: ${fitnessJourney.weightChange > 0 ? '+' : ''}${fitnessJourney.weightChange}kg`);
    }

    // Current State
    parts.push(`\nCurrent State: Energy ${currentState.energyLevel}/10, Mood ${currentState.moodLevel}/10, Stress ${currentState.stressLevel}/10`);
    parts.push(`Workout Readiness: ${currentState.readinessForWorkout}`);
    if (currentState.todaysBiometrics) {
      parts.push(`WHOOP: Recovery ${currentState.todaysBiometrics.recoveryScore}%, Sleep ${currentState.todaysBiometrics.sleepDuration.toFixed(1)}h`);
    }

    // Recent Scores
    if (dailyScores.length > 0) {
      const latest = dailyScores[dailyScores.length - 1];
      parts.push(`\nLatest Health Score: ${Math.round(latest.total_score)}/100`);
      if (latest.component_scores) {
        const cs = latest.component_scores;
        parts.push(`Components: Workout ${cs.workout ?? 0}, Nutrition ${cs.nutrition ?? 0}, Wellbeing ${cs.wellbeing ?? 0}, Biometrics ${cs.biometrics ?? 0}`);
      }
      if (dailyScores.length >= 7) {
        const avg7 = Math.round(dailyScores.slice(-7).reduce((s, r) => s + r.total_score, 0) / 7);
        parts.push(`7-day average: ${avg7}`);
      }
    }

    // Goals
    if (context.goals.activeGoals && context.goals.activeGoals.length > 0) {
      parts.push('\nGoals:');
      context.goals.activeGoals.slice(0, 3).forEach((g) => {
        parts.push(`- ${g.title} (${g.category}): ${g.progress}% done, ${g.daysRemaining} days left`);
      });
      parts.push(`Goal Alignment Score: ${goalAlignment.score}/100`);
      if (goalAlignment.misaligned.length > 0) {
        parts.push(`Misalignments: ${goalAlignment.misaligned.map((m) => m.reason).join('; ')}`);
      }
    }

    // Patterns
    if (patterns.skipPatterns.length > 0) {
      parts.push(`\nSkip days: ${patterns.skipPatterns.map((s) => `${s.dayOfWeek} (${s.percentage}%)`).join(', ')}`);
    }
    if (patterns.bestPerformanceDays.length > 0) {
      parts.push(`Best days: ${patterns.bestPerformanceDays.join(', ')}`);
    }

    // Risks
    if (riskFlags.length > 0) {
      parts.push('\nRisk Flags:');
      riskFlags.forEach((r) => {
        parts.push(`- [${r.severity}] ${r.category}: ${r.description}`);
      });
    }

    // Nutrition
    if (context.nutrition.activeDietPlan) {
      parts.push(`\nDiet: ${context.nutrition.activeDietPlan.name} (${context.nutrition.activeDietPlan.dailyCalories} cal/day)`);
    }
    if (context.nutritionAnalysis.weeklyAdherenceRate !== undefined) {
      parts.push(`Nutrition adherence: ${context.nutritionAnalysis.weeklyAdherenceRate}%`);
    }

    // Mental Health
    if (context.mentalHealth.latestRecoveryScore !== undefined) {
      parts.push(`\nMental Recovery: ${context.mentalHealth.latestRecoveryScore}/100 (${context.mentalHealth.recoveryTrend || 'unknown'})`);
    }

    // Gamification
    if (context.gamification.currentLevel) {
      parts.push(`\nLevel ${context.gamification.currentLevel}, ${(context.gamification.totalXP || 0).toLocaleString()} XP`);
    }

    return parts.join('\n');
  }

  // ============================================
  // STABLE TRAITS & RECENT OBSERVATIONS
  // ============================================

  /**
   * Archive the current profile into history before overwriting.
   * Keeps only the last 3 versions per user.
   */
  async archiveProfile(userId: string): Promise<void> {
    try {
      await this.ensureTable();

      // Get current profile data
      const current = await query<{
        profile_data: any;
        stable_traits: any;
        recent_observations: any;
        profile_version: number;
        generated_at: string;
      }>(
        `SELECT profile_data, stable_traits, recent_observations,
                COALESCE(profile_version, 1) as profile_version, generated_at
         FROM user_coaching_profiles WHERE user_id = $1`,
        [userId]
      );

      if (current.rows.length === 0) return;

      const row = current.rows[0];

      // Insert into history
      await query(
        `INSERT INTO user_coaching_profile_history
          (user_id, profile_version, profile_data, stable_traits, recent_observations, generated_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId,
          row.profile_version,
          typeof row.profile_data === 'string' ? row.profile_data : JSON.stringify(row.profile_data),
          row.stable_traits ? (typeof row.stable_traits === 'string' ? row.stable_traits : JSON.stringify(row.stable_traits)) : null,
          row.recent_observations ? (typeof row.recent_observations === 'string' ? row.recent_observations : JSON.stringify(row.recent_observations)) : null,
          row.generated_at,
        ]
      );

      // Keep only last 3 versions
      await query(
        `DELETE FROM user_coaching_profile_history
         WHERE user_id = $1
           AND id NOT IN (
             SELECT id FROM user_coaching_profile_history
             WHERE user_id = $1
             ORDER BY profile_version DESC
             LIMIT 3
           )`,
        [userId]
      );

      logger.debug('[CoachingProfile] Archived profile', { userId, version: row.profile_version });
    } catch (error) {
      logger.warn('[CoachingProfile] Error archiving profile', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }

  /**
   * Generate recent observations from context and scores (lightweight, deterministic).
   */
  private generateRecentObservations(
    context: ComprehensiveUserContext,
    historicalScores: DailyScoreRow[]
  ): RecentObservations {
    // Determine trend from last 7 days of scores
    const recent7 = historicalScores.slice(-7);
    let trendDirection: 'improving' | 'stable' | 'declining' = 'stable';

    if (recent7.length >= 3) {
      const firstHalf = recent7.slice(0, Math.floor(recent7.length / 2));
      const secondHalf = recent7.slice(Math.floor(recent7.length / 2));
      const firstAvg = firstHalf.reduce((s, r) => s + r.total_score, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((s, r) => s + r.total_score, 0) / secondHalf.length;

      if (secondAvg - firstAvg > 5) trendDirection = 'improving';
      else if (firstAvg - secondAvg > 5) trendDirection = 'declining';
    }

    // Dominant mood
    const moodLevel = context.mentalHealth?.latestRecoveryScore ?? context.wellbeing?.moodAvg ?? 50;
    let dominantMood = 'neutral';
    if (moodLevel > 70) dominantMood = 'positive';
    else if (moodLevel < 40) dominantMood = 'low';

    // Energy pattern
    const energyLevel = context.wellbeing?.energyAvg ?? 5;
    let energyPattern = 'moderate';
    if (typeof energyLevel === 'number') {
      if (energyLevel > 7) energyPattern = 'high energy';
      else if (energyLevel < 4) energyPattern = 'low energy';
    }

    // Recent changes
    const recentChanges: string[] = [];
    if (context.progressTrend?.weightTrend && context.progressTrend.weightTrend !== 'stable') {
      recentChanges.push(`Weight ${context.progressTrend.weightTrend} (${context.progressTrend.weightChangeKg ?? 0}kg)`);
    }
    if (recent7.length >= 2) {
      const latestScore = recent7[recent7.length - 1].total_score;
      const prevScore = recent7[recent7.length - 2].total_score;
      const delta = Math.round(latestScore - prevScore);
      if (Math.abs(delta) > 10) {
        recentChanges.push(`Daily score ${delta > 0 ? 'jumped' : 'dropped'} ${Math.abs(delta)} points`);
      }
    }
    if ((context.gamification?.currentStreak ?? 0) > 0) {
      recentChanges.push(`Active ${context.gamification.currentStreak}-day streak`);
    }

    return {
      trendDirection,
      dominantMood,
      energyPattern,
      recentChanges,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Update stable traits via LLM analysis of 90-day data.
   * Only runs if traits are older than 14 days or never generated.
   */
  async updateStableTraits(userId: string): Promise<StableTraits | null> {
    try {
      await this.ensureTable();

      // Check if update is needed (>14 days since last update or never updated)
      const result = await query<{ stable_traits_updated_at: string | null }>(
        `SELECT stable_traits_updated_at FROM user_coaching_profiles WHERE user_id = $1`,
        [userId]
      );

      if (result.rows.length > 0 && result.rows[0].stable_traits_updated_at) {
        const lastUpdate = new Date(result.rows[0].stable_traits_updated_at);
        const daysSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate < 14) {
          logger.debug('[CoachingProfile] Stable traits still fresh', { userId, daysSinceUpdate: Math.round(daysSinceUpdate) });
          return null;
        }
      }

      logger.info('[CoachingProfile] Updating stable traits', { userId });

      // Fetch 90-day data for long-term analysis
      const [historicalScores, workoutLogs, context] = await Promise.all([
        this.getHistoricalScores(userId, 90),
        this.getWorkoutLogs(userId, 90),
        this.safeCall(() => comprehensiveUserContextService.getComprehensiveContext(userId), this.emptyContext()),
      ]);

      if (historicalScores.length < 7) {
        logger.info('[CoachingProfile] Not enough data for stable traits', { userId, scores: historicalScores.length });
        return null;
      }

      const patterns = this.buildPatterns(workoutLogs);

      // Build data summary for LLM
      const dataSummary = [
        `=== 90-DAY USER BEHAVIOR ANALYSIS ===`,
        `Data points: ${historicalScores.length} daily scores over 90 days`,
        ``,
        `Score trend: ${historicalScores.length >= 14 ? (() => {
          const first14 = historicalScores.slice(0, 14).reduce((s, r) => s + r.total_score, 0) / 14;
          const last14 = historicalScores.slice(-14).reduce((s, r) => s + r.total_score, 0) / Math.min(14, historicalScores.slice(-14).length);
          return `First 2 weeks avg: ${Math.round(first14)}, Last 2 weeks avg: ${Math.round(last14)}`;
        })() : 'insufficient data'}`,
        ``,
        `Workout patterns:`,
        `- Consistency: ${workoutLogs.filter(w => w.status === 'completed').length}/${workoutLogs.length} scheduled (${workoutLogs.length > 0 ? Math.round(workoutLogs.filter(w => w.status === 'completed').length / workoutLogs.length * 100) : 0}%)`,
        `- Skip patterns: ${patterns.skipPatterns.length > 0 ? patterns.skipPatterns.map(s => `${s.dayOfWeek} (${s.percentage}% skip rate)`).join(', ') : 'none detected'}`,
        `- Best days: ${patterns.bestPerformanceDays.join(', ') || 'N/A'}`,
        `- Favorite types: ${(() => {
          const counts: Record<string, number> = {};
          workoutLogs.filter(w => w.status === 'completed').forEach(w => { counts[w.workout_name] = (counts[w.workout_name] || 0) + 1; });
          return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, c]) => `${n} (${c}x)`).join(', ') || 'N/A';
        })()}`,
        ``,
        `Component averages (last 30d):`,
        ...(() => {
          const last30 = historicalScores.slice(-30);
          if (last30.length === 0) return ['No score data'];
          const components = ['workout', 'nutrition', 'wellbeing', 'biometrics', 'engagement', 'consistency'];
          return components.map(c => {
            const avg = last30.reduce((s, r) => s + (r.component_scores[c] ?? 0), 0) / last30.length;
            return `- ${c}: ${Math.round(avg)}/100`;
          });
        })(),
        ``,
        `Goals: ${context.goals?.activeGoals?.map((g: any) => `${g.title} (${g.progress}%)`).join(', ') || 'none active'}`,
        `Current coaching tone preference: ${context.lifestyle?.preferences?.coachingStyle || 'not set'}`,
      ].join('\n');

      const systemPrompt = `You are analyzing 90 days of health/fitness data to extract STABLE, long-term user traits. These are patterns that persist over weeks, not daily fluctuations.

Return ONLY valid JSON:
{
  "personalityType": "string - one of: morning_person, evening_warrior, weekend_warrior, steady_performer, inconsistent_burster, data_driven, intuitive_mover",
  "preferredWorkoutTypes": ["string - top 3 workout types by frequency"],
  "motivationDrivers": ["string - 2-3 things that keep them going, inferred from patterns"],
  "commonBarriers": ["string - 2-3 recurring blockers, inferred from skip patterns and score dips"],
  "effectiveInterventions": [{"intervention": "string", "outcome": "string", "dateRange": "string", "confidence": "high|medium|low"}],
  "behavioralPatterns": [{"pattern": "string", "frequency": "always|often|sometimes", "firstObserved": "date", "lastConfirmed": "date"}],
  "coachingStrategy": {
    "preferredTone": "supportive|direct|tough_love",
    "bestTimeForMessages": "string - time range like 7-9 AM",
    "responseToStruggles": "string - how to approach when they're failing",
    "celebrationStyle": "string - how they respond to praise"
  }
}

Rules:
- Only include patterns with STRONG evidence (repeated across multiple weeks)
- effectiveInterventions: things that ACTUALLY improved their scores (look for score jumps)
- behavioralPatterns: recurring behaviors (e.g., "skips workouts on Mondays", "scores drop after weekends")
- Be specific and data-grounded, not generic`;

      // Check circuit breaker before making LLM call
      if (!llmCircuitBreaker.isCallAllowed()) {
        logger.debug('[CoachingProfile] Circuit breaker OPEN, skipping stable traits update', { userId });
        return null;
      }

      const llmPro = modelFactory.getModel({
        tier: 'reasoning',
        maxTokens: 1200,
      });

      const response = await llmPro.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(dataSummary),
      ]);

      llmCircuitBreaker.recordSuccess();

      const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        logger.warn('[CoachingProfile] Stable traits LLM response did not contain valid JSON');
        return null;
      }

      let parsed: any;
      try {
        const sanitized = jsonMatch[0]
          .replace(/\/\/[^\n]*/g, '')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\}\s*\{/g, '}, {')
          .replace(/"(\s*)\n(\s*)"/g, '",\n$2"')
          .replace(/\]\s*"/g, '], "')
          .replace(/(true|false|null|\d+\.?\d*)\s*\n(\s*)"/g, '$1,\n$2"')
          .replace(/,\s*([}\]])/g, '$1')
          .replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match) =>
            match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
          );
        parsed = JSON.parse(sanitized);
      } catch {
        try {
          const aggressive = jsonMatch[0]
            .replace(/\/\/[^\n]*/g, '')
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
            .replace(/,\s*,/g, ',')
            .replace(/,\s*([}\]])/g, '$1');
          parsed = JSON.parse(aggressive);
        } catch {
          logger.warn('[CoachingProfile] Stable traits JSON parse failed, returning null');
          return null;
        }
      }

      const stableTraits: StableTraits = {
        personalityType: parsed.personalityType || 'steady_performer',
        preferredWorkoutTypes: Array.isArray(parsed.preferredWorkoutTypes) ? parsed.preferredWorkoutTypes : [],
        motivationDrivers: Array.isArray(parsed.motivationDrivers) ? parsed.motivationDrivers : [],
        commonBarriers: Array.isArray(parsed.commonBarriers) ? parsed.commonBarriers : [],
        effectiveInterventions: Array.isArray(parsed.effectiveInterventions) ? parsed.effectiveInterventions : [],
        behavioralPatterns: Array.isArray(parsed.behavioralPatterns) ? parsed.behavioralPatterns : [],
        coachingStrategy: parsed.coachingStrategy || {
          preferredTone: 'direct',
          bestTimeForMessages: '7-9 AM',
          responseToStruggles: 'Acknowledge difficulty, then redirect to smallest possible action',
          celebrationStyle: 'Data-driven praise with specific numbers',
        },
        updatedAt: new Date().toISOString(),
      };

      // Persist
      await query(
        `UPDATE user_coaching_profiles
         SET stable_traits = $1, stable_traits_updated_at = NOW(), updated_at = NOW()
         WHERE user_id = $2`,
        [JSON.stringify(stableTraits), userId]
      );

      logger.info('[CoachingProfile] Stable traits updated', { userId, personalityType: stableTraits.personalityType });
      return stableTraits;
    } catch (error) {
      if (modelFactory.isAuthError(error)) {
        modelFactory.markCurrentProviderRateLimited(24 * 60 * 60 * 1000);
        logger.warn('[CoachingProfile] Provider has invalid API key, blacklisted for 24h');
        try {
          this.llm = modelFactory.getModel({ tier: 'reasoning', maxTokens: 1500 });
        } catch { /* no providers available */ }
      } else if (llmCircuitBreaker.isRateLimitError(error)) {
        llmCircuitBreaker.recordRateLimitError(error);
        try {
          this.llm = modelFactory.getModel({ tier: 'reasoning', maxTokens: 1500 });
          logger.info('[CoachingProfile] Switched to fallback LLM provider after rate limit');
        } catch { /* no providers available */ }
      }
      logger.error('[CoachingProfile] Error updating stable traits', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return null;
    }
  }

  // ============================================
  // PERSISTENCE
  // ============================================

  /**
   * Upsert the coaching profile into the database.
   */
  private async upsertProfile(
    userId: string,
    profile: CoachingProfile
  ): Promise<void> {
    try {
      // Verify user exists before upserting to avoid FK violation
      const userExists = await query('SELECT 1 FROM users WHERE id = $1', [userId]);
      if (userExists.rows.length === 0) {
        logger.warn('[CoachingProfile] Skipping upsert — user not found', { userId });
        return;
      }

      await query(
        `INSERT INTO user_coaching_profiles (
          user_id, profile_data, adherence_scores, key_insights, risk_flags,
          predictions, next_best_actions, goal_alignment, data_gaps,
          coaching_tone, generated_at, generation_model,
          recent_observations, profile_version,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11, $12, $13, NOW(), NOW()
        )
        ON CONFLICT (user_id) DO UPDATE SET
          profile_data = EXCLUDED.profile_data,
          adherence_scores = EXCLUDED.adherence_scores,
          key_insights = EXCLUDED.key_insights,
          risk_flags = EXCLUDED.risk_flags,
          predictions = EXCLUDED.predictions,
          next_best_actions = EXCLUDED.next_best_actions,
          goal_alignment = EXCLUDED.goal_alignment,
          data_gaps = EXCLUDED.data_gaps,
          coaching_tone = EXCLUDED.coaching_tone,
          recent_observations = EXCLUDED.recent_observations,
          profile_version = EXCLUDED.profile_version,
          generated_at = NOW(),
          generation_model = EXCLUDED.generation_model,
          updated_at = NOW()`,
        [
          userId,
          JSON.stringify(profile),
          JSON.stringify(profile.adherenceScores),
          JSON.stringify(profile.keyInsights),
          JSON.stringify(profile.riskFlags),
          JSON.stringify(profile.predictions),
          JSON.stringify(profile.nextBestActions),
          JSON.stringify(profile.goalAlignment),
          JSON.stringify(profile.dataGaps),
          profile.recommendedApproach.tone,
          env.openai.model || 'gpt-4o-mini',
          JSON.stringify(profile.recentObservations || null),
          profile.profileVersion || 1,
        ]
      );
    } catch (error) {
      logger.error('[CoachingProfile] Error upserting profile', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Do not throw -- profile generation should still return data even if persistence fails
    }
  }

  // ============================================
  // UTILITY HELPERS
  // ============================================

  /**
   * Safely call an async function, returning a fallback on error.
   */
  private async safeCall<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      logger.warn('[CoachingProfile] Safe call fallback used', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return fallback;
    }
  }

  /**
   * Return an empty ComprehensiveUserContext for fallback.
   */
  private emptyContext(): ComprehensiveUserContext {
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

  // ============================================
  // COACH EMOTIONAL INTELLIGENCE
  // ============================================

  /**
   * Compute the coach's emotional state based on user data.
   * Pure deterministic logic — no LLM calls.
   * This drives embodied language in both chat and proactive messages.
   */
  computeCoachEmotionalState(profile: CoachingProfile): CoachEmotionalState {
    const { adherenceScores, riskFlags, currentState, fitnessJourney, memorableMoments } = profile;
    const longitudinal = profile.longitudinalAdherence;
    const recentObs = profile.recentObservations;

    // --- PROUD: User is crushing it ---
    const avgAdherence = (adherenceScores.workout + adherenceScores.nutrition + adherenceScores.sleep) / 3;
    if (avgAdherence >= 80 && fitnessJourney.streakDays >= 7) {
      return {
        primary: 'proud',
        intensity: Math.min(0.5 + (fitnessJourney.streakDays / 30) * 0.5, 1.0),
        reason: `${profile.firstName} has been incredibly consistent — ${fitnessJourney.streakDays}-day streak with ${Math.round(avgAdherence)}% adherence`,
        sensation: `It genuinely makes me feel good seeing ${profile.firstName} show up day after day`,
        memoryHook: memorableMoments.length > 0 ? memorableMoments[0].description : undefined,
      };
    }

    // --- WORRIED: Health declining, multiple risk flags ---
    const highRisks = riskFlags.filter(r => r.severity === 'high');
    if (highRisks.length >= 2 || (currentState.moodLevel <= 3 && currentState.stressLevel >= 7)) {
      return {
        primary: 'worried',
        intensity: Math.min(0.5 + highRisks.length * 0.15, 1.0),
        secondary: 'protective',
        reason: `Multiple warning signs — ${highRisks.map(r => r.description).join(', ')}`,
        sensation: `Something feels off and I can't ignore it. ${profile.firstName}'s numbers are telling me to pay close attention right now`,
      };
    }

    // --- FRUSTRATED: Repeated pattern of declining adherence while mood is fine ---
    if (longitudinal && longitudinal.consecutiveLowDays >= 5 &&
        longitudinal.trendDirection === 'declining' && currentState.moodLevel >= 5) {
      return {
        primary: 'frustrated',
        intensity: Math.min(0.5 + (longitudinal.consecutiveLowDays / 14) * 0.5, 1.0),
        secondary: 'disappointed',
        reason: `${longitudinal.consecutiveLowDays} consecutive low-adherence days while mood is fine — this isn't burnout, it's avoidance`,
        sensation: `I'm not going to pretend this is okay. Watching someone with real potential coast like this genuinely bothers me`,
      };
    }

    // --- EXCITED: Close to goal / approaching milestone ---
    const primaryGoal = profile.goalsContext?.primaryGoal;
    if (primaryGoal && primaryGoal.progress >= 75 && primaryGoal.daysRemaining > 0) {
      return {
        primary: 'excited',
        intensity: Math.min(0.5 + (primaryGoal.progress / 100) * 0.5, 1.0),
        reason: `${primaryGoal.progress}% toward "${primaryGoal.title}" with ${primaryGoal.daysRemaining} days left`,
        sensation: `I can almost see the finish line. ${profile.firstName} is so close and I don't think they realize how far they've come`,
      };
    }

    // --- DISAPPOINTED: Was doing well, now sliding ---
    if (recentObs?.trendDirection === 'declining' && longitudinal &&
        longitudinal.adherence30d.workout > 60) {
      return {
        primary: 'disappointed',
        intensity: 0.6,
        secondary: 'hopeful',
        reason: `Had strong 30-day numbers but recent trend is declining — the foundation is there but something changed`,
        sensation: `I know what ${profile.firstName} is capable of because I've seen it. This recent slide doesn't match who they've been`,
      };
    }

    // --- HOPEFUL: New user or showing improvement ---
    if (recentObs?.trendDirection === 'improving' || profile.daysOnPlatform <= 14) {
      return {
        primary: 'hopeful',
        intensity: 0.5,
        reason: profile.daysOnPlatform <= 14
          ? `Early days — building the foundation together`
          : `Trend is improving — momentum is building`,
        sensation: `There's something building here. I can feel the momentum shifting in the right direction`,
      };
    }

    // --- NEUTRAL: Steady state ---
    return {
      primary: 'neutral',
      intensity: 0.3,
      reason: 'Steady state — maintaining current level',
      sensation: `Things are stable. Let's look at where we can push the needle`,
    };
  }

  /**
   * Compute the relationship depth based on time on platform and shared milestones.
   * Affects how familiar/casual the coach's voice becomes.
   */
  computeRelationshipDepth(profile: CoachingProfile): RelationshipDepth {
    const days = profile.daysOnPlatform;
    const milestones = profile.memorableMoments?.length || 0;

    if (days <= 7) {
      return {
        phase: 'new',
        daysOnPlatform: days,
        sharedMilestones: milestones,
        voiceStyle: 'Professional but warm. Getting to know them. Ask more questions. Use their name frequently. Reference their goals to show you paid attention.',
      };
    }
    if (days <= 30) {
      return {
        phase: 'building',
        daysOnPlatform: days,
        sharedMilestones: milestones,
        voiceStyle: 'More casual and direct. Starting to reference shared history. Use inside references to past conversations. Show you remember details they shared.',
      };
    }
    if (days <= 90) {
      return {
        phase: 'established',
        daysOnPlatform: days,
        sharedMilestones: milestones,
        voiceStyle: 'Speak like a trusted friend-coach. Reference journey together ("we\'ve been at this for X weeks"). Be blunter — they can handle it. Use shorthand. Skip pleasantries and get to the point.',
      };
    }
    return {
      phase: 'deep',
      daysOnPlatform: days,
      sharedMilestones: milestones,
      voiceStyle: 'This is a veteran relationship. Speak with deep familiarity. Reference specific past moments by name. Challenge hard — they know you care. Use "we" language. Be the coach who knows them better than they know themselves.',
    };
  }
}

// Export singleton instance
export const userCoachingProfileService = new UserCoachingProfileService();
export default userCoachingProfileService;
