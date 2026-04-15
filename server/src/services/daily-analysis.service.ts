/**
 * @file Daily Analysis Service
 * @description Cross-domain daily analysis engine that pre-computes insights
 * for each user by combining data from fitness, nutrition, wellbeing, and WHOOP.
 * Uses a deterministic rule engine for cross-domain pattern detection and a single
 * LLM call to enrich insights into structured, actionable coaching directives.
 */

import crypto from 'crypto';
import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import { env } from '../config/env.config.js';
import { modelFactory } from './model-factory.service.js';
import { comprehensiveUserContextService } from './comprehensive-user-context.service.js';
import type { ComprehensiveUserContext } from './comprehensive-user-context.service.js';
import { aiScoringService } from './ai-scoring.service.js';
import type { DailyScore } from './ai-scoring.service.js';
import { mentalRecoveryScoreService } from './mental-recovery-score.service.js';
import { userCoachingProfileService } from './user-coaching-profile.service.js';
import type { RiskFlag, Prediction, NextBestAction, CoachingProfile, CoachEmotionalState, RelationshipDepth } from './user-coaching-profile.service.js';
import { crossPillarIntelligenceService } from './cross-pillar-intelligence.service.js';
import { llmCircuitBreaker } from './llm-circuit-breaker.service.js';

// ============================================
// TYPES
// ============================================

export interface StructuredInsight {
  id: string;
  claim: string;
  evidence: string[];
  impact: string;
  action: string;
  confidence: 'high' | 'medium' | 'low';
  pillars_connected: string[];
  severity: 'positive' | 'neutral' | 'warning' | 'critical';
  /** Optional trade-offs or pros/cons for the recommendation */
  tradeOffs?: string;
  /** Optional safety note (e.g. "see a clinician if symptoms persist") for critical insights */
  safetyNote?: string;
}

export interface CrossDomainInsight {
  domains: string[];
  relationship: string;
  strength: 'strong' | 'moderate' | 'weak';
  direction: 'positive' | 'negative';
  evidence_window_days: number;
}

export interface DailySnapshot {
  date: string;
  totalScore: number;
  componentScores: Record<string, number>;
  scoreDelta: number;
  weekOverWeekDelta: number;
  recoveryScore: number | null;
  sleepHours: number | null;
  strainScore: number | null;
  moodLevel: number;
  stressLevel: number;
  energyLevel: number;
  workoutsCompleted: number;
  workoutsScheduled: number;
  mealsLogged: number;
  calorieAdherence: number | null;
  waterIntakePercentage: number | null;
  habitsCompleted: number;
  habitsTotal: number;
  streakDays: number;
}

export interface CoachingDirective {
  headline: string;
  toneRecommendation: 'supportive' | 'direct' | 'tough_love';
  focusAreas: string[];
  avoidTopics: string[];
  coachEmotion?: CoachEmotionalState;
  relationshipDepth?: RelationshipDepth;
}

export interface DailyAnalysisReport {
  userId: string;
  reportDate: string;
  snapshot: DailySnapshot;
  insights: StructuredInsight[];
  crossDomainInsights: CrossDomainInsight[];
  predictions: Prediction[];
  risks: RiskFlag[];
  actions: NextBestAction[];
  coachingDirective: CoachingDirective;
  generatedAt: string;
  generationModel: string;
}

// Internal type for historical score rows
interface HistoricalScoreRow {
  date: string;
  total_score: number;
  component_scores: Record<string, number>;
}

// ============================================
// SERVICE CLASS
// ============================================

class DailyAnalysisService {
  private llm: BaseChatModel;
  private tableEnsured = false;

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

    try {
      await query(`
        CREATE TABLE IF NOT EXISTS daily_analysis_reports (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          report_date DATE NOT NULL,
          snapshot JSONB NOT NULL,
          insights JSONB NOT NULL,
          cross_domain_insights JSONB NOT NULL,
          predictions JSONB,
          risks JSONB,
          actions JSONB,
          coaching_directive JSONB,
          generation_model VARCHAR(50),
          generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(user_id, report_date)
        )
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS idx_daily_analysis_user_date
          ON daily_analysis_reports(user_id, report_date DESC)
      `);

      this.tableEnsured = true;
    } catch (error) {
      logger.error('[DailyAnalysis] Error ensuring table exists', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Generate a full daily analysis report for a user.
   * Main orchestrator: fetches data in parallel, builds deterministic snapshot,
   * runs cross-domain rule engine, enriches with LLM, and persists.
   */
  async generateDailyReport(
    userId: string,
    date?: string
  ): Promise<DailyAnalysisReport | null> {
    const startTime = Date.now();
    await this.ensureTable();

    const dateStr = date || new Date().toISOString().split('T')[0];
    const modelName = env.openai.model || 'gpt-4o-mini';

    logger.info('[DailyAnalysis] Generating daily report', { userId, date: dateStr });

    try {
      // ----- Step 1: Fetch all data in parallel -----
      const [context, dailyScore, recoveryScore, historicalScores, profile] =
        await Promise.all([
          this.safeCall(
            () => comprehensiveUserContextService.getComprehensiveContext(userId),
            null
          ),
          this.safeCall(
            () => aiScoringService.getDailyScore(userId, dateStr),
            null
          ),
          this.safeCall(
            () => mentalRecoveryScoreService.calculateRecoveryScore(userId),
            null
          ),
          this.safeCall(() => this.getHistoricalScores(userId, 30), []),
          this.safeCall(
            () => userCoachingProfileService.getProfile(userId),
            null
          ),
        ]);

      if (!context) {
        logger.warn('[DailyAnalysis] No user context available, skipping report', { userId });
        return null;
      }

      // ----- Step 2: Build deterministic snapshot -----
      const snapshot = this.buildSnapshot(
        dateStr,
        context,
        dailyScore,
        recoveryScore,
        historicalScores
      );

      // ----- Step 3: Deterministic cross-domain rule engine -----
      const crossDomainInsights = this.detectCrossDomainInsights(
        snapshot,
        historicalScores,
        context
      );

      // ----- Step 4: LLM-enriched structured insights -----
      const insights = await this.generateStructuredInsights(
        snapshot,
        crossDomainInsights,
        context,
        historicalScores,
        profile
      );

      // ----- Step 5: Extract predictions, risks, actions from profile -----
      const predictions = profile?.predictions ?? [];
      const risks = profile?.riskFlags ?? [];
      const actions = profile?.nextBestActions ?? [];

      // ----- Step 6: Build deterministic coaching directive -----
      const coachingDirective = this.buildCoachingDirective(
        snapshot,
        crossDomainInsights,
        risks,
        actions,
        profile
      );

      // ----- Step 6b: Cross-pillar contradiction analysis -----
      // Runs 22 deterministic rules, deduplicates, and generates AI corrections
      // for high/critical severity. Now awaited to ensure contradictions are persisted before report.
      try {
        await crossPillarIntelligenceService.analyzeUser(userId, snapshot, context);
      } catch (err) {
        logger.warn('[DailyAnalysis] Cross-pillar analysis failed (non-blocking)', {
          userId,
          error: err instanceof Error ? err.message : 'Unknown',
        });
      }

      // ----- Step 7: Assemble the report -----
      const report: DailyAnalysisReport = {
        userId,
        reportDate: dateStr,
        snapshot,
        insights,
        crossDomainInsights,
        predictions,
        risks,
        actions,
        coachingDirective,
        generatedAt: new Date().toISOString(),
        generationModel: modelName,
      };

      // ----- Step 8: Persist -----
      await this.upsertReport(report);

      const elapsed = Date.now() - startTime;
      logger.info('[DailyAnalysis] Report generated', {
        userId,
        date: dateStr,
        elapsed: `${elapsed}ms`,
        insightsCount: insights.length,
        crossDomainCount: crossDomainInsights.length,
        risksCount: risks.length,
      });

      return report;
    } catch (error) {
      logger.error('[DailyAnalysis] Error generating daily report', {
        userId,
        date: dateStr,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Get the latest report for a user.
   * Returns null if no report exists or if the most recent report is stale (>36h old).
   */
  async getLatestReport(userId: string): Promise<DailyAnalysisReport | null> {
    try {
      await this.ensureTable();

      const result = await query<{
        user_id: string;
        report_date: string;
        snapshot: DailySnapshot;
        insights: StructuredInsight[];
        cross_domain_insights: CrossDomainInsight[];
        predictions: Prediction[] | null;
        risks: RiskFlag[] | null;
        actions: NextBestAction[] | null;
        coaching_directive: CoachingDirective | null;
        generation_model: string | null;
        generated_at: string;
      }>(
        `SELECT user_id, report_date, snapshot, insights, cross_domain_insights,
                predictions, risks, actions, coaching_directive,
                generation_model, generated_at
         FROM daily_analysis_reports
         WHERE user_id = $1
         ORDER BY report_date DESC
         LIMIT 1`,
        [userId]
      );

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      const generatedAt = new Date(row.generated_at);
      const ageHours = (Date.now() - generatedAt.getTime()) / (1000 * 60 * 60);

      // Consider stale after 36 hours
      if (ageHours > 36) {
        logger.info('[DailyAnalysis] Latest report is stale (>36h)', {
          userId,
          ageHours: Math.round(ageHours),
        });
        return null;
      }

      return this.rowToReport(row);
    } catch (error) {
      logger.error('[DailyAnalysis] Error fetching latest report', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Get a report for a specific date.
   */
  async getReport(userId: string, date: string): Promise<DailyAnalysisReport | null> {
    try {
      await this.ensureTable();

      const result = await query<{
        user_id: string;
        report_date: string;
        snapshot: DailySnapshot;
        insights: StructuredInsight[];
        cross_domain_insights: CrossDomainInsight[];
        predictions: Prediction[] | null;
        risks: RiskFlag[] | null;
        actions: NextBestAction[] | null;
        coaching_directive: CoachingDirective | null;
        generation_model: string | null;
        generated_at: string;
      }>(
        `SELECT user_id, report_date, snapshot, insights, cross_domain_insights,
                predictions, risks, actions, coaching_directive,
                generation_model, generated_at
         FROM daily_analysis_reports
         WHERE user_id = $1 AND report_date = $2::date
         LIMIT 1`,
        [userId, date]
      );

      if (result.rows.length === 0) return null;

      return this.rowToReport(result.rows[0]);
    } catch (error) {
      logger.error('[DailyAnalysis] Error fetching report by date', {
        userId,
        date,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  // ============================================
  // SNAPSHOT BUILDER (Deterministic)
  // ============================================

  /**
   * Build a DailySnapshot from existing data sources.
   * Purely deterministic — no LLM calls.
   */
  private buildSnapshot(
    date: string,
    context: ComprehensiveUserContext,
    dailyScore: DailyScore | null,
    _recoveryScore: { recoveryScore: number } | null,
    historicalScores: HistoricalScoreRow[]
  ): DailySnapshot {
    const todayScore = dailyScore?.totalScore ?? 0;
    const componentScores: Record<string, number> = dailyScore?.componentScores
      ? { ...dailyScore.componentScores }
      : {};

    // Calculate score deltas from historical data
    const scoreDelta = this.calculateScoreDelta(todayScore, historicalScores, 1);
    const weekOverWeekDelta = this.calculateScoreDelta(todayScore, historicalScores, 7);

    // WHOOP data (may not be connected)
    const whoopRecovery = context.whoop?.lastRecovery?.score ?? null;
    const sleepHours = context.whoop?.lastSleep?.duration ?? null;
    const strainScore = context.whoop?.todayStrain?.score ?? null;

    // Wellbeing / mental health metrics
    const moodLevel = this.extractMoodLevel(context);
    const stressLevel = this.extractStressLevel(context);
    const energyLevel = this.extractEnergyLevel(context);

    // Workout metrics
    const recentWorkouts = context.workouts?.recentWorkouts ?? [];
    const todayDateStr = date;
    const workoutsCompleted = recentWorkouts.filter(
      (w) =>
        w.status === 'completed' &&
        w.date &&
        new Date(w.date).toISOString().split('T')[0] === todayDateStr
    ).length;
    const workoutsScheduled = recentWorkouts.filter(
      (w) =>
        w.date &&
        new Date(w.date).toISOString().split('T')[0] === todayDateStr
    ).length;

    // Nutrition metrics
    const mealsLogged = context.nutrition?.todayMealCount ?? 0;
    const calorieAdherence = context.nutritionAnalysis?.weeklyAdherenceRate ?? null;

    // Water intake
    const waterIntakePercentage = context.waterIntake?.todayPercentage ?? null;

    // Habits
    const habitsCompleted = context.habits?.todayCompletionCount ?? 0;
    const habitsTotal = context.habits?.todayTotalHabits ?? 0;

    // Streak
    const streakDays = context.gamification?.currentStreak ?? 0;

    return {
      date,
      totalScore: todayScore,
      componentScores,
      scoreDelta,
      weekOverWeekDelta,
      recoveryScore: whoopRecovery,
      sleepHours,
      strainScore,
      moodLevel,
      stressLevel,
      energyLevel,
      workoutsCompleted,
      workoutsScheduled,
      mealsLogged,
      calorieAdherence,
      waterIntakePercentage,
      habitsCompleted,
      habitsTotal,
      streakDays,
    };
  }

  // ============================================
  // CROSS-DOMAIN RULE ENGINE (Deterministic)
  // ============================================

  /**
   * Detect cross-domain insights using a deterministic rule engine.
   * No LLM calls — pattern matching on data thresholds.
   * Returns max 4 insights, prioritizing negative (actionable) then positive.
   */
  private detectCrossDomainInsights(
    snapshot: DailySnapshot,
    historicalScores: HistoricalScoreRow[],
    _context: ComprehensiveUserContext
  ): CrossDomainInsight[] {
    const negativeInsights: CrossDomainInsight[] = [];
    const positiveInsights: CrossDomainInsight[] = [];

    // 1. Sleep <-> Workout: Poor sleep reducing workout performance
    if (snapshot.sleepHours !== null && snapshot.sleepHours < 6) {
      const workoutAvg7d = this.getComponentAverage(historicalScores, 'workout', 7);
      const workoutToday = snapshot.componentScores.workout ?? 0;
      const workoutDrop = workoutAvg7d > 0 && (workoutAvg7d - workoutToday) > 15;

      if (workoutDrop) {
        negativeInsights.push({
          domains: ['sleep', 'workout'],
          relationship: `Poor sleep (${snapshot.sleepHours.toFixed(1)}h) correlating with workout score decline`,
          strength: snapshot.sleepHours < 5 ? 'strong' : 'moderate',
          direction: 'negative',
          evidence_window_days: 7,
        });
      }
    }

    // 2. Stress <-> Nutrition: High stress driving poor nutrition
    if (
      snapshot.stressLevel > 7 &&
      snapshot.calorieAdherence !== null &&
      snapshot.calorieAdherence < 50
    ) {
      negativeInsights.push({
        domains: ['stress', 'nutrition'],
        relationship: `High stress (${snapshot.stressLevel}/10) correlating with low nutrition adherence (${snapshot.calorieAdherence}%)`,
        strength: 'moderate',
        direction: 'negative',
        evidence_window_days: 7,
      });
    }

    // 3. Recovery <-> Strain: Overtraining risk
    if (
      snapshot.recoveryScore !== null &&
      snapshot.recoveryScore < 40 &&
      snapshot.strainScore !== null &&
      snapshot.strainScore > 16
    ) {
      negativeInsights.push({
        domains: ['recovery', 'strain'],
        relationship: `Low recovery (${snapshot.recoveryScore}%) after high strain (${snapshot.strainScore}/21) — overtraining risk`,
        strength: 'strong',
        direction: 'negative',
        evidence_window_days: 2,
      });
    }

    // 4. Mood <-> Engagement: Mental health affecting engagement
    if (
      snapshot.moodLevel < 4 &&
      (snapshot.componentScores.engagement ?? 100) < 40
    ) {
      negativeInsights.push({
        domains: ['mood', 'engagement'],
        relationship: `Low mood (${snapshot.moodLevel}/10) correlating with declining engagement`,
        strength: 'moderate',
        direction: 'negative',
        evidence_window_days: 7,
      });
    }

    // 5. Hydration <-> Recovery: Dehydration affecting recovery
    if (
      snapshot.waterIntakePercentage !== null &&
      snapshot.waterIntakePercentage < 50 &&
      snapshot.recoveryScore !== null &&
      snapshot.recoveryScore < 50
    ) {
      negativeInsights.push({
        domains: ['hydration', 'recovery'],
        relationship: `Low hydration (${snapshot.waterIntakePercentage}% of target) may be impairing recovery (${snapshot.recoveryScore}%)`,
        strength: 'moderate',
        direction: 'negative',
        evidence_window_days: 3,
      });
    }

    // 6. Sleep <-> Nutrition <-> Weight: Sleep deprivation + nutrition patterns
    if (
      snapshot.sleepHours !== null &&
      snapshot.sleepHours < 6 &&
      snapshot.calorieAdherence !== null &&
      snapshot.calorieAdherence < 70
    ) {
      negativeInsights.push({
        domains: ['sleep', 'nutrition', 'weight'],
        relationship: `Poor sleep (${snapshot.sleepHours.toFixed(1)}h) increasing cravings — nutrition adherence at ${snapshot.calorieAdherence}%`,
        strength: 'moderate',
        direction: 'negative',
        evidence_window_days: 7,
      });
    }

    // 7. Workout + Streak: High consistency driving results
    if (
      snapshot.streakDays > 7 &&
      (snapshot.componentScores.workout ?? 0) > 70
    ) {
      positiveInsights.push({
        domains: ['consistency', 'workout'],
        relationship: `${snapshot.streakDays}-day streak driving strong workout performance (${snapshot.componentScores.workout}/100)`,
        strength: 'strong',
        direction: 'positive',
        evidence_window_days: snapshot.streakDays,
      });
    }

    // 8. Recovery <-> Sleep quality: Good recovery from good sleep
    if (
      snapshot.recoveryScore !== null &&
      snapshot.recoveryScore > 70 &&
      snapshot.sleepHours !== null &&
      snapshot.sleepHours >= 7
    ) {
      positiveInsights.push({
        domains: ['sleep', 'recovery'],
        relationship: `Quality sleep (${snapshot.sleepHours.toFixed(1)}h) supporting strong recovery (${snapshot.recoveryScore}%)`,
        strength: 'strong',
        direction: 'positive',
        evidence_window_days: 1,
      });
    }

    // Prioritize negative (actionable) first, then positive; max 4
    const combined = [...negativeInsights, ...positiveInsights];
    return combined.slice(0, 4);
  }

  // ============================================
  // LLM-ENRICHED INSIGHTS
  // ============================================

  /**
   * Generate structured insights via a single LLM call.
   * Enriches the deterministic cross-domain insights into full StructuredInsight objects.
   */
  private async generateStructuredInsights(
    snapshot: DailySnapshot,
    crossDomainInsights: CrossDomainInsight[],
    context: ComprehensiveUserContext,
    historicalScores: HistoricalScoreRow[],
    profile: CoachingProfile | null
  ): Promise<StructuredInsight[]> {
    const defaults: StructuredInsight[] = [];

    try {
      const systemPrompt = `You are a health data analyst. Given the user's daily snapshot, cross-domain connections detected, and historical data, generate 3-5 structured insights.

Each insight MUST have:
- claim: One clear sentence describing what's happening
- evidence: 2-4 specific data points with numbers
- impact: What this means for the user's goals
- action: One specific, actionable step for today
- confidence: high (multiple data points confirm), medium (pattern detected but limited data), low (single observation)
- pillars_connected: Which health pillars are involved (sleep, workout, nutrition, recovery, stress, mood, hydration, consistency)
- severity: positive (something is working), neutral (observation), warning (needs attention), critical (immediate action needed)
- tradeOffs (optional): One short line on pros/cons or trade-offs of the recommendation
- safetyNote (optional): For critical or warning severity, add a safety line (e.g. "If symptoms persist or worsen, see a clinician") when relevant (extreme HRV drop, very high stress, injury risk)

RULES:
- Ground every insight in the provided data — never fabricate numbers
- Prioritize cross-domain insights (connecting 2+ pillars)
- Include at least 1 positive insight if any positive cross-domain connection exists
- Actions must be specific to today (not general advice)
- Keep claims under 15 words
- Keep evidence as specific numbers, not vague descriptions

Return ONLY valid JSON array of insights.`;

      const humanMessage = this.buildInsightDataSummary(
        snapshot,
        crossDomainInsights,
        context,
        historicalScores,
        profile
      );

      // Circuit breaker: skip LLM if quota is exhausted
      if (!llmCircuitBreaker.isCallAllowed()) {
        logger.debug('[DailyAnalysis] Circuit breaker OPEN, using default insights');
        return defaults;
      }

      const response = await this.llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(humanMessage),
      ]);

      llmCircuitBreaker.recordSuccess();

      const content =
        typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);

      // Extract JSON array from response (handle markdown code blocks)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        logger.warn('[DailyAnalysis] LLM response did not contain valid JSON array', {
          contentLength: content.length,
        });
        return defaults;
      }

      const parsed = JSON.parse(jsonMatch[0]) as Partial<StructuredInsight>[];

      if (!Array.isArray(parsed)) {
        logger.warn('[DailyAnalysis] Parsed LLM response is not an array');
        return defaults;
      }

      // Validate and assign UUIDs
      return parsed
        .filter(
          (item) =>
            item.claim &&
            item.evidence &&
            item.impact &&
            item.action &&
            item.confidence &&
            item.pillars_connected &&
            item.severity
        )
        .map((item) => ({
          id: crypto.randomUUID(),
          claim: item.claim!,
          evidence: Array.isArray(item.evidence) ? item.evidence : [],
          impact: item.impact!,
          action: item.action!,
          confidence: item.confidence!,
          pillars_connected: Array.isArray(item.pillars_connected)
            ? item.pillars_connected
            : [],
          severity: item.severity!,
          ...(item.tradeOffs != null && item.tradeOffs !== '' && { tradeOffs: item.tradeOffs }),
          ...(item.safetyNote != null && item.safetyNote !== '' && { safetyNote: item.safetyNote }),
        }))
        .slice(0, 5);
    } catch (error) {
      if (modelFactory.isAuthError(error)) {
        modelFactory.markCurrentProviderRateLimited(24 * 60 * 60 * 1000);
        logger.warn('[DailyAnalysis] Provider has invalid API key, blacklisted for 24h');
        try {
          this.llm = modelFactory.getModel({ tier: 'reasoning', maxTokens: 1500 });
          logger.info('[DailyAnalysis] Switched to next LLM provider after auth failure');
        } catch { /* no providers available */ }
      } else if (llmCircuitBreaker.isRateLimitError(error)) {
        llmCircuitBreaker.recordRateLimitError(error);
        try {
          this.llm = modelFactory.getModel({ tier: 'reasoning', maxTokens: 1500 });
          logger.info('[DailyAnalysis] Switched to fallback LLM provider after rate limit');
        } catch { /* no providers available */ }
      }
      logger.error('[DailyAnalysis] Error generating structured insights', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return defaults;
    }
  }

  // ============================================
  // COACHING DIRECTIVE (Deterministic)
  // ============================================

  /**
   * Build a coaching directive based on the snapshot and detected patterns.
   * Purely deterministic — no LLM calls.
   */
  private buildCoachingDirective(
    snapshot: DailySnapshot,
    crossDomainInsights: CrossDomainInsight[],
    risks: RiskFlag[],
    _actions: NextBestAction[],
    profile?: any
  ): CoachingDirective {
    // --- Headline ---
    const headline = this.generateHeadline(snapshot, crossDomainInsights, risks);

    // --- Tone recommendation ---
    let toneRecommendation = this.determineTone(snapshot);

    // Override tone if accountability level requires tough_love
    if (profile?.accountabilityLevel === 'accountability') {
      toneRecommendation = 'tough_love';
    }

    // --- Focus areas: top 1 weakest component (less aggressive — only highlight the most critical) ---
    const focusAreas = this.getWeakestComponents(snapshot.componentScores, 1);

    // --- Avoid topics (expanded to prevent repetitive nagging) ---
    const avoidTopics: string[] = [];
    if (snapshot.moodLevel < 3) {
      avoidTopics.push('missed targets', 'declining metrics', 'data gaps');
    }
    if (snapshot.stressLevel > 8) {
      avoidTopics.push('additional commitments', 'ambitious new goals', 'calorie tracking');
    }
    // Always avoid topics that feel like nagging
    if (snapshot.moodLevel < 5 || snapshot.stressLevel > 6) {
      avoidTopics.push('WHOOP sync reminders', 'logging reminders');
    }

    // --- Coach emotional state (deterministic) ---
    let coachEmotion: CoachEmotionalState | undefined;
    let relationshipDepth: RelationshipDepth | undefined;
    if (profile) {
      coachEmotion = userCoachingProfileService.computeCoachEmotionalState(profile);
      relationshipDepth = userCoachingProfileService.computeRelationshipDepth(profile);
    }

    return {
      headline,
      toneRecommendation,
      focusAreas,
      avoidTopics,
      coachEmotion,
      relationshipDepth,
    };
  }

  // ============================================
  // DATA ACCESS
  // ============================================

  /**
   * Fetch historical daily scores for a user.
   */
  private async getHistoricalScores(
    userId: string,
    days: number
  ): Promise<HistoricalScoreRow[]> {
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

  /**
   * Upsert a daily analysis report.
   */
  private async upsertReport(report: DailyAnalysisReport): Promise<void> {
    try {
      await query(
        `INSERT INTO daily_analysis_reports (
          user_id, report_date, snapshot, insights, cross_domain_insights,
          predictions, risks, actions, coaching_directive,
          generation_model, generated_at, created_at, updated_at
        ) VALUES (
          $1, $2::date, $3, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz, NOW(), NOW()
        )
        ON CONFLICT (user_id, report_date) DO UPDATE SET
          snapshot = EXCLUDED.snapshot,
          insights = EXCLUDED.insights,
          cross_domain_insights = EXCLUDED.cross_domain_insights,
          predictions = EXCLUDED.predictions,
          risks = EXCLUDED.risks,
          actions = EXCLUDED.actions,
          coaching_directive = EXCLUDED.coaching_directive,
          generation_model = EXCLUDED.generation_model,
          generated_at = EXCLUDED.generated_at,
          updated_at = NOW()`,
        [
          report.userId,
          report.reportDate,
          JSON.stringify(report.snapshot),
          JSON.stringify(report.insights),
          JSON.stringify(report.crossDomainInsights),
          JSON.stringify(report.predictions),
          JSON.stringify(report.risks),
          JSON.stringify(report.actions),
          JSON.stringify(report.coachingDirective),
          report.generationModel,
          report.generatedAt,
        ]
      );
    } catch (error) {
      logger.error('[DailyAnalysis] Error upserting report', {
        userId: report.userId,
        date: report.reportDate,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  /**
   * Safe wrapper for parallel data fetching.
   * Catches errors and returns the fallback value.
   */
  private async safeCall<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      logger.warn('[DailyAnalysis] Safe call fallback', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return fallback;
    }
  }

  /**
   * Convert a DB row to a DailyAnalysisReport.
   */
  private rowToReport(row: {
    user_id: string;
    report_date: string;
    snapshot: DailySnapshot;
    insights: StructuredInsight[];
    cross_domain_insights: CrossDomainInsight[];
    predictions: Prediction[] | null;
    risks: RiskFlag[] | null;
    actions: NextBestAction[] | null;
    coaching_directive: CoachingDirective | null;
    generation_model: string | null;
    generated_at: string;
  }): DailyAnalysisReport {
    const parseJsonField = <T>(field: T | string): T => {
      if (typeof field === 'string') {
        return JSON.parse(field) as T;
      }
      return field;
    };

    return {
      userId: row.user_id,
      reportDate:
        typeof row.report_date === 'string'
          ? row.report_date
          : new Date(row.report_date as unknown as string).toISOString().split('T')[0],
      snapshot: parseJsonField(row.snapshot),
      insights: parseJsonField(row.insights),
      crossDomainInsights: parseJsonField(row.cross_domain_insights),
      predictions: parseJsonField(row.predictions ?? []),
      risks: parseJsonField(row.risks ?? []),
      actions: parseJsonField(row.actions ?? []),
      coachingDirective: parseJsonField(
        row.coaching_directive ?? {
          headline: 'Keep building consistent habits today.',
          toneRecommendation: 'direct' as const,
          focusAreas: [],
          avoidTopics: [],
        }
      ),
      generatedAt: row.generated_at,
      generationModel: row.generation_model ?? 'unknown',
    };
  }

  /**
   * Calculate score delta (today vs N days ago).
   */
  private calculateScoreDelta(
    todayScore: number,
    historicalScores: HistoricalScoreRow[],
    daysAgo: number
  ): number {
    if (historicalScores.length === 0) return 0;

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - daysAgo);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    // Find closest score to the target date
    let closest: HistoricalScoreRow | null = null;
    let closestDiff = Infinity;

    for (const score of historicalScores) {
      const scoreDateStr =
        typeof score.date === 'string'
          ? score.date
          : new Date(score.date as unknown as string).toISOString().split('T')[0];
      const diff = Math.abs(
        new Date(scoreDateStr).getTime() - new Date(targetDateStr).getTime()
      );
      if (diff < closestDiff) {
        closestDiff = diff;
        closest = score;
      }
    }

    if (!closest) return 0;

    // Only use if within 2 days of target
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
    if (closestDiff > twoDaysMs) return 0;

    return Math.round((todayScore - closest.total_score) * 10) / 10;
  }

  /**
   * Get average of a component score over the last N days.
   */
  private getComponentAverage(
    historicalScores: HistoricalScoreRow[],
    component: string,
    days: number
  ): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const relevant = historicalScores.filter((s) => {
      const d = new Date(s.date);
      return d >= cutoff;
    });

    if (relevant.length === 0) return 0;

    const sum = relevant.reduce(
      (acc, s) => acc + (s.component_scores[component] ?? 0),
      0
    );
    return sum / relevant.length;
  }

  /**
   * Extract mood level from comprehensive context.
   * Returns 0-10 scale, defaults to 5 if unavailable.
   */
  private extractMoodLevel(context: ComprehensiveUserContext): number {
    // Try mental health context first
    if (context.mentalHealth?.latestEmotionalCheckin?.overallMoodScore != null) {
      return Math.min(10, Math.max(0, context.mentalHealth.latestEmotionalCheckin.overallMoodScore));
    }
    // Try wellbeing context
    if (context.wellbeing?.moodScore != null) {
      return Math.min(10, Math.max(0, context.wellbeing.moodScore));
    }
    return 5; // default
  }

  /**
   * Extract stress level from comprehensive context.
   * Returns 0-10 scale, defaults to 5 if unavailable.
   */
  private extractStressLevel(context: ComprehensiveUserContext): number {
    if (context.mentalHealth?.latestEmotionalCheckin?.anxietyScore != null) {
      return Math.min(10, Math.max(0, context.mentalHealth.latestEmotionalCheckin.anxietyScore));
    }
    if (context.wellbeing?.stressLevel != null) {
      return Math.min(10, Math.max(0, context.wellbeing.stressLevel));
    }
    return 5; // default
  }

  /**
   * Extract energy level from comprehensive context.
   * Returns 0-10 scale, defaults to 5 if unavailable.
   */
  private extractEnergyLevel(context: ComprehensiveUserContext): number {
    if (context.wellbeing?.energyLevel != null) {
      return Math.min(10, Math.max(0, context.wellbeing.energyLevel));
    }
    return 5; // default
  }

  /**
   * Generate a coaching headline based on the day's data.
   */
  private generateHeadline(
    snapshot: DailySnapshot,
    crossDomainInsights: CrossDomainInsight[],
    risks: RiskFlag[]
  ): string {
    // Check for critical conditions first
    const hasHighRisk = risks.some((r) => r.severity === 'high');
    if (hasHighRisk) {
      return 'Priority alert — let\'s address what needs attention first.';
    }

    // Check recovery state
    if (snapshot.recoveryScore !== null && snapshot.recoveryScore < 40) {
      return 'Recovery day — protect your gains and let your body rebuild.';
    }

    // Check for overtraining signal
    const overtrainingInsight = crossDomainInsights.find(
      (i) =>
        i.domains.includes('recovery') &&
        i.domains.includes('strain') &&
        i.direction === 'negative'
    );
    if (overtrainingInsight) {
      return 'Your body is signaling rest — let\'s scale back intensity today.';
    }

    // Check mood / stress
    if (snapshot.moodLevel < 4 && snapshot.stressLevel > 7) {
      return 'Tough day — focus on small wins and self-care today.';
    }

    // Check for strong performance
    if (snapshot.recoveryScore !== null && snapshot.recoveryScore > 70 && snapshot.totalScore > 70) {
      return 'Strong recovery — push performance today.';
    }

    // Check streak momentum
    if (snapshot.streakDays > 7 && snapshot.totalScore > 60) {
      return `${snapshot.streakDays}-day streak going strong — keep the momentum.`;
    }

    // Positive delta
    if (snapshot.scoreDelta > 5) {
      return 'Great progress — your scores are trending up.';
    }

    // Default
    return 'Stay consistent — every healthy choice compounds.';
  }

  /**
   * Determine coaching tone based on user state.
   */
  private determineTone(
    snapshot: DailySnapshot
  ): 'supportive' | 'direct' | 'tough_love' {
    // Supportive: mood low or stress high — be gentle
    if (snapshot.moodLevel < 4 || snapshot.stressLevel > 7) {
      return 'supportive';
    }

    // Tough love: adherence consistently low but mood/stress are fine
    const adherenceRate =
      snapshot.habitsTotal > 0
        ? (snapshot.habitsCompleted / snapshot.habitsTotal) * 100
        : null;

    if (
      adherenceRate !== null &&
      adherenceRate < 30 &&
      snapshot.moodLevel >= 5 &&
      snapshot.stressLevel <= 5
    ) {
      return 'tough_love';
    }

    // Default: direct
    return 'direct';
  }

  /**
   * Get the N weakest component scores as focus areas.
   */
  private getWeakestComponents(
    componentScores: Record<string, number>,
    count: number
  ): string[] {
    const entries = Object.entries(componentScores);
    if (entries.length === 0) return [];

    return entries
      .sort((a, b) => a[1] - b[1])
      .slice(0, count)
      .map(([key]) => key);
  }

  /**
   * Build the data summary string sent to the LLM for insight generation.
   */
  private buildInsightDataSummary(
    snapshot: DailySnapshot,
    crossDomainInsights: CrossDomainInsight[],
    context: ComprehensiveUserContext,
    historicalScores: HistoricalScoreRow[],
    profile: CoachingProfile | null
  ): string {
    const parts: string[] = [];

    parts.push('=== DAILY SNAPSHOT ===');
    parts.push(`Date: ${snapshot.date}`);
    parts.push(`Total Score: ${snapshot.totalScore}/100 (delta: ${snapshot.scoreDelta > 0 ? '+' : ''}${snapshot.scoreDelta}, week-over-week: ${snapshot.weekOverWeekDelta > 0 ? '+' : ''}${snapshot.weekOverWeekDelta})`);

    if (Object.keys(snapshot.componentScores).length > 0) {
      const scoreEntries = Object.entries(snapshot.componentScores)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      parts.push(`Component Scores: ${scoreEntries}`);
    }

    if (snapshot.recoveryScore !== null) {
      parts.push(`Recovery: ${snapshot.recoveryScore}%`);
    }
    if (snapshot.sleepHours !== null) {
      parts.push(`Sleep: ${snapshot.sleepHours.toFixed(1)}h`);
    }
    if (snapshot.strainScore !== null) {
      parts.push(`Strain: ${snapshot.strainScore}/21`);
    }

    parts.push(`Mood: ${snapshot.moodLevel}/10, Stress: ${snapshot.stressLevel}/10, Energy: ${snapshot.energyLevel}/10`);
    parts.push(`Workouts: ${snapshot.workoutsCompleted}/${snapshot.workoutsScheduled} completed`);
    parts.push(`Meals logged: ${snapshot.mealsLogged}`);

    if (snapshot.calorieAdherence !== null) {
      parts.push(`Calorie adherence: ${snapshot.calorieAdherence}%`);
    }
    if (snapshot.waterIntakePercentage !== null) {
      parts.push(`Water intake: ${snapshot.waterIntakePercentage}% of target`);
    }

    parts.push(`Habits: ${snapshot.habitsCompleted}/${snapshot.habitsTotal}`);
    parts.push(`Streak: ${snapshot.streakDays} days`);

    // Cross-domain patterns detected
    if (crossDomainInsights.length > 0) {
      parts.push('\n=== CROSS-DOMAIN PATTERNS DETECTED ===');
      for (const insight of crossDomainInsights) {
        parts.push(`- [${insight.direction.toUpperCase()}] ${insight.relationship} (strength: ${insight.strength})`);
      }
    }

    // Historical trend
    if (historicalScores.length > 0) {
      const recent7 = historicalScores.slice(-7);
      const scores = recent7.map((s) => s.total_score);
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      parts.push(`\n=== 7-DAY TREND ===`);
      parts.push(`Average score: ${avg.toFixed(1)}/100`);
      parts.push(`Scores: ${scores.map((s) => Math.round(s)).join(', ')}`);
    }

    // Goals context
    if (context.goals?.activeGoals && context.goals.activeGoals.length > 0) {
      parts.push('\n=== ACTIVE GOALS ===');
      for (const goal of context.goals.activeGoals.slice(0, 3)) {
        parts.push(`- ${goal.title}: ${goal.progress}% complete (${goal.daysRemaining} days remaining)`);
      }
    }

    // Profile risk flags
    if (profile?.riskFlags && profile.riskFlags.length > 0) {
      parts.push('\n=== RISK FLAGS ===');
      for (const risk of profile.riskFlags) {
        parts.push(`- [${risk.severity}] ${risk.category}: ${risk.description}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Get paginated report history (summary only: date, score, insight/risk counts).
   */
  async getReportHistory(
    userId: string,
    limit: number,
    offset: number
  ): Promise<Array<{ date: string; totalScore: number; insightsCount: number; riskCount: number }>> {
    await this.ensureTable();
    const result = await query<{
      report_date: string;
      total_score: number;
      insights_count: number;
      risk_count: number;
    }>(
      `SELECT
         report_date,
         (snapshot->>'totalScore')::numeric AS total_score,
         jsonb_array_length(COALESCE(insights, '[]'::jsonb)) AS insights_count,
         jsonb_array_length(COALESCE(risks, '[]'::jsonb)) AS risk_count
       FROM daily_analysis_reports
       WHERE user_id = $1
       ORDER BY report_date DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows.map((r) => ({
      date: r.report_date,
      totalScore: parseFloat(r.total_score as unknown as string) || 0,
      insightsCount: parseInt(r.insights_count as unknown as string, 10) || 0,
      riskCount: parseInt(r.risk_count as unknown as string, 10) || 0,
    }));
  }

}

// ============================================
// EXPORTS
// ============================================

export const dailyAnalysisService = new DailyAnalysisService();
export default dailyAnalysisService;
