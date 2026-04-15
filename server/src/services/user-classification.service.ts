/**
 * @file User Classification Service
 * @description Classifies users into 5 behavioral tiers based on consistency,
 * progression, engagement, recovery respect, and goal adherence. Also provides
 * recovery-to-intensity mapping for training prescriptions.
 *
 * Tiers: elite_performer | improving | plateau | declining | at_risk_dropout
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import { cache } from './cache.service.js';
import type { ComprehensiveUserContext } from './comprehensive-user-context.service.js';

// ============================================
// TYPES
// ============================================

export type UserTier = 'elite_performer' | 'improving' | 'plateau' | 'declining' | 'at_risk_dropout';
export type PrescribedIntensity = 'rest' | 'light' | 'moderate' | 'hard' | 'peak';

export interface ClassificationFactors {
  consistency: number;        // 0-100: sessions_completed / sessions_planned (14d)
  progression: number;        // 0-100: score improvement trend
  engagement: number;         // 0-100: app interaction, schedule adherence
  recoveryRespect: number;    // 0-100: % of red recovery days where user rested
  goalAdherence: number;      // 0-100: nutrition/hydration/sleep targets met
}

export interface UserClassification {
  userId: string;
  tier: UserTier;
  score: number;              // 0-100 composite
  factors: ClassificationFactors;
  previousTier: UserTier | null;
  tierChangedAt: string | null;
  computedAt: string;
}

export interface IntensityPrescription {
  userId: string;
  date: string;
  recoveryScore: number | null;
  hrvRmssd: number | null;
  restingHr: number | null;
  sleepHours: number | null;
  prescribedIntensity: PrescribedIntensity;
  maxHrZone: number;          // 1-5
  recommendedDurationMin: number;
  reasoning: string;
}

// ============================================
// CONSTANTS
// ============================================

// Weight distribution for composite score
const WEIGHTS = {
  consistency: 0.30,
  progression: 0.25,
  engagement: 0.20,
  recoveryRespect: 0.15,
  goalAdherence: 0.10,
};

// Recovery-to-intensity mapping table
const INTENSITY_MAP: Array<{
  minRecovery: number;
  maxRecovery: number;
  intensity: PrescribedIntensity;
  maxHrZone: number;
  minDuration: number;
  maxDuration: number;
}> = [
  { minRecovery: 80, maxRecovery: 100, intensity: 'peak', maxHrZone: 5, minDuration: 60, maxDuration: 90 },
  { minRecovery: 67, maxRecovery: 79, intensity: 'hard', maxHrZone: 4, minDuration: 45, maxDuration: 75 },
  { minRecovery: 50, maxRecovery: 66, intensity: 'moderate', maxHrZone: 3, minDuration: 30, maxDuration: 60 },
  { minRecovery: 33, maxRecovery: 49, intensity: 'light', maxHrZone: 2, minDuration: 20, maxDuration: 40 },
  { minRecovery: 0, maxRecovery: 32, intensity: 'rest', maxHrZone: 1, minDuration: 0, maxDuration: 20 },
];

// ============================================
// SERVICE CLASS
// ============================================

class UserClassificationService {
  private tableEnsured = false;

  private async ensureTable(): Promise<void> {
    if (this.tableEnsured) return;
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS user_classifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          tier VARCHAR(30) NOT NULL,
          score NUMERIC(5,2) NOT NULL,
          factors JSONB NOT NULL,
          previous_tier VARCHAR(30),
          tier_changed_at TIMESTAMPTZ,
          computed_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(user_id)
        )
      `);
      await query(`
        CREATE TABLE IF NOT EXISTS intensity_prescriptions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          date DATE NOT NULL DEFAULT CURRENT_DATE,
          recovery_score INTEGER,
          hrv_rmssd NUMERIC(6,2),
          resting_hr INTEGER,
          sleep_hours NUMERIC(4,2),
          prescribed_intensity VARCHAR(20) NOT NULL,
          max_hr_zone INTEGER,
          recommended_duration_min INTEGER,
          reasoning TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(user_id, date)
        )
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_uc_user ON user_classifications(user_id)
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_ip_user_date ON intensity_prescriptions(user_id, date DESC)
      `);
      this.tableEnsured = true;
    } catch (error) {
      logger.error('[UserClassification] Error ensuring tables', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ---- Public API ----

  /**
   * Classify a user into a behavioral tier.
   * Uses 14-day rolling window for all metrics.
   */
  async classifyUser(userId: string, context: ComprehensiveUserContext): Promise<UserClassification> {
    await this.ensureTable();

    const cacheKey = `user_class:${userId}`;
    const CACHE_TTL = 3600; // 1 hour

    const cached = cache.get<UserClassification>(cacheKey);
    if (cached) return cached;

    try {
      const factors = await this.computeFactors(userId, context);
      const score = this.computeCompositeScore(factors);
      const tier = this.determineTier(score, factors);

      // Fetch previous classification
      const prevResult = await query<{ tier: UserTier; tier_changed_at: string | null }>(
        `SELECT tier, tier_changed_at FROM user_classifications WHERE user_id = $1`,
        [userId]
      );
      const previousTier = prevResult.rows[0]?.tier ?? null;
      const tierChanged = previousTier !== null && previousTier !== tier;

      const classification: UserClassification = {
        userId,
        tier,
        score,
        factors,
        previousTier,
        tierChangedAt: tierChanged ? new Date().toISOString() : (prevResult.rows[0]?.tier_changed_at ?? null),
        computedAt: new Date().toISOString(),
      };

      // Upsert classification
      await query(
        `INSERT INTO user_classifications (user_id, tier, score, factors, previous_tier, tier_changed_at, computed_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           tier = $2, score = $3, factors = $4,
           previous_tier = CASE WHEN user_classifications.tier != $2 THEN user_classifications.tier ELSE user_classifications.previous_tier END,
           tier_changed_at = CASE WHEN user_classifications.tier != $2 THEN NOW() ELSE user_classifications.tier_changed_at END,
           computed_at = NOW()`,
        [userId, tier, score, JSON.stringify(factors), previousTier, tierChanged ? new Date().toISOString() : null]
      );

      if (tierChanged) {
        logger.info('[UserClassification] Tier changed', {
          userId,
          from: previousTier,
          to: tier,
          score,
        });
      }

      cache.set(cacheKey, classification, CACHE_TTL);
      return classification;
    } catch (error) {
      logger.error('[UserClassification] Classification error', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        userId,
        tier: 'plateau',
        score: 50,
        factors: { consistency: 50, progression: 50, engagement: 50, recoveryRespect: 50, goalAdherence: 50 },
        previousTier: null,
        tierChangedAt: null,
        computedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Get the latest classification for a user (from cache or DB).
   */
  async getClassification(userId: string): Promise<UserClassification | null> {
    const cacheKey = `user_class:${userId}`;
    const cached = cache.get<UserClassification>(cacheKey);
    if (cached) return cached;

    await this.ensureTable();
    try {
      const result = await query<{
        user_id: string;
        tier: UserTier;
        score: number;
        factors: ClassificationFactors;
        previous_tier: UserTier | null;
        tier_changed_at: string | null;
        computed_at: string;
      }>(
        `SELECT user_id, tier, score, factors, previous_tier, tier_changed_at, computed_at
         FROM user_classifications WHERE user_id = $1`,
        [userId]
      );

      if (result.rows.length === 0) return null;
      const row = result.rows[0];

      const classification: UserClassification = {
        userId: row.user_id,
        tier: row.tier,
        score: Number(row.score),
        factors: row.factors,
        previousTier: row.previous_tier,
        tierChangedAt: row.tier_changed_at,
        computedAt: row.computed_at,
      };

      cache.set(cacheKey, classification, 3600);
      return classification;
    } catch (error) {
      logger.error('[UserClassification] Error fetching classification', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Prescribe training intensity based on WHOOP recovery data.
   */
  async prescribeIntensity(
    userId: string,
    context: ComprehensiveUserContext
  ): Promise<IntensityPrescription> {
    await this.ensureTable();

    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `intensity:${userId}:${today}`;
    const cached = cache.get<IntensityPrescription>(cacheKey);
    if (cached) return cached;

    const recoveryScore = context.whoop?.lastRecovery?.score ?? null;
    const hrvRmssd = context.whoop?.lastRecovery?.hrv ?? null;
    const restingHr = context.whoop?.lastRecovery?.rhr ?? null;
    const sleepHours = context.whoop?.lastSleep?.duration ?? null;

    // Base intensity from recovery score
    let mapping = INTENSITY_MAP[2]; // Default to moderate
    if (recoveryScore !== null) {
      mapping = INTENSITY_MAP.find(
        m => recoveryScore >= m.minRecovery && recoveryScore <= m.maxRecovery
      ) ?? INTENSITY_MAP[2];
    }

    let { intensity, maxHrZone, minDuration, maxDuration } = mapping;
    const reasons: string[] = [];

    if (recoveryScore !== null) {
      reasons.push(`Recovery at ${recoveryScore}%`);
    }

    // Override: 3+ consecutive hard days → force moderate
    const recentWorkouts = context.workouts?.recentWorkouts ?? [];
    const last3Days = recentWorkouts.filter(w => w.hoursAgo <= 72 && w.status === 'completed');
    if (last3Days.length >= 3 && (intensity === 'hard' || intensity === 'peak')) {
      intensity = 'moderate';
      maxHrZone = 3;
      maxDuration = 60;
      reasons.push('3+ consecutive training days — capping at moderate');
    }

    // Override: Sleep debt → cap at light
    if (sleepHours !== null && sleepHours < 5 && (intensity === 'hard' || intensity === 'peak' || intensity === 'moderate')) {
      intensity = 'light';
      maxHrZone = 2;
      maxDuration = 40;
      reasons.push(`Severe sleep deficit (${sleepHours.toFixed(1)}h) — capping at light`);
    }

    // Override: HRV trending down → cap at moderate
    if (hrvRmssd !== null && hrvRmssd < 30 && (intensity === 'hard' || intensity === 'peak')) {
      intensity = 'moderate';
      maxHrZone = 3;
      maxDuration = 60;
      reasons.push(`Low HRV (${hrvRmssd.toFixed(0)}ms) — capping at moderate`);
    }

    const durationMid = Math.round((minDuration + maxDuration) / 2);
    const reasoning = reasons.length > 0 ? reasons.join('. ') + '.' : 'No WHOOP data available — defaulting to moderate.';

    const prescription: IntensityPrescription = {
      userId,
      date: today,
      recoveryScore,
      hrvRmssd,
      restingHr,
      sleepHours,
      prescribedIntensity: intensity,
      maxHrZone,
      recommendedDurationMin: durationMid,
      reasoning,
    };

    // Persist
    try {
      await query(
        `INSERT INTO intensity_prescriptions
         (user_id, date, recovery_score, hrv_rmssd, resting_hr, sleep_hours,
          prescribed_intensity, max_hr_zone, recommended_duration_min, reasoning)
         VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (user_id, date) DO UPDATE SET
           recovery_score = $3, hrv_rmssd = $4, resting_hr = $5, sleep_hours = $6,
           prescribed_intensity = $7, max_hr_zone = $8, recommended_duration_min = $9, reasoning = $10`,
        [userId, today, recoveryScore, hrvRmssd, restingHr, sleepHours,
         intensity, maxHrZone, durationMid, reasoning]
      );
    } catch (error) {
      logger.warn('[UserClassification] Error persisting intensity prescription', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    cache.set(cacheKey, prescription, 3600);
    return prescription;
  }

  /**
   * Get today's intensity prescription for a user.
   */
  async getTodayPrescription(userId: string): Promise<IntensityPrescription | null> {
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `intensity:${userId}:${today}`;
    const cached = cache.get<IntensityPrescription>(cacheKey);
    if (cached) return cached;

    await this.ensureTable();
    try {
      const result = await query<{
        user_id: string;
        date: string;
        recovery_score: number | null;
        hrv_rmssd: number | null;
        resting_hr: number | null;
        sleep_hours: number | null;
        prescribed_intensity: PrescribedIntensity;
        max_hr_zone: number;
        recommended_duration_min: number;
        reasoning: string;
      }>(
        `SELECT * FROM intensity_prescriptions WHERE user_id = $1 AND date = $2::date`,
        [userId, today]
      );
      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      const prescription: IntensityPrescription = {
        userId: row.user_id,
        date: row.date,
        recoveryScore: row.recovery_score,
        hrvRmssd: row.hrv_rmssd ? Number(row.hrv_rmssd) : null,
        restingHr: row.resting_hr,
        sleepHours: row.sleep_hours ? Number(row.sleep_hours) : null,
        prescribedIntensity: row.prescribed_intensity,
        maxHrZone: row.max_hr_zone,
        recommendedDurationMin: row.recommended_duration_min,
        reasoning: row.reasoning,
      };
      cache.set(cacheKey, prescription, 3600);
      return prescription;
    } catch (error) {
      logger.error('[UserClassification] Error fetching today prescription', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  // ---- Factor Computation ----

  private async computeFactors(_userId: string, context: ComprehensiveUserContext): Promise<ClassificationFactors> {
    // 1. Consistency (30%): workout completion rate over 14 days
    const completionRate = context.workouts?.completionRate ?? 50;
    const consistency = Math.min(100, Math.max(0, completionRate));

    // 2. Progression (25%): score trend
    const scoreTrend = context.dailyScore?.scoreTrend;
    const weekDelta = context.dailyScore?.weekOverWeekDelta ?? 0;
    let progression = 50; // neutral
    if (scoreTrend === 'improving') progression = Math.min(100, 60 + Math.abs(weekDelta));
    else if (scoreTrend === 'declining') progression = Math.max(0, 40 - Math.abs(weekDelta));
    else progression = 50; // stable

    // 3. Engagement (20%): habits, streak, activity
    const habitRate = context.habits?.overallCompletionRate7Days ?? 50;
    const streakDays = context.gamification?.currentStreak ?? 0;
    const streakBonus = Math.min(20, streakDays); // up to 20 points for streak
    const engagement = Math.min(100, Math.max(0, habitRate * 0.8 + streakBonus));

    // 4. Recovery Respect (15%): how well user respects low recovery days
    // Proxy: if recovery is low, did they reduce activity?
    const recoveryScore = context.whoop?.lastRecovery?.score ?? null;
    let recoveryRespect = 70; // default decent
    if (recoveryScore !== null && recoveryScore < 40) {
      const recentWorkouts = context.workouts?.recentWorkouts ?? [];
      const todayWorkouts = recentWorkouts.filter(w => w.hoursAgo < 24 && w.status === 'completed');
      recoveryRespect = todayWorkouts.length === 0 ? 100 : 20; // Rested = 100, trained anyway = 20
    }

    // 5. Goal Adherence (10%): nutrition + hydration + sleep targets
    const nutritionAdherence = context.nutritionAnalysis?.weeklyAdherenceRate ?? 50;
    const waterPct = context.waterIntake?.todayPercentage ?? 50;
    const sleepHours = context.whoop?.lastSleep?.duration ?? 7;
    const sleepScore = sleepHours >= 7 ? 100 : sleepHours >= 6 ? 70 : sleepHours >= 5 ? 40 : 20;
    const goalAdherence = Math.min(100, (nutritionAdherence + Math.min(100, waterPct) + sleepScore) / 3);

    return {
      consistency: Math.round(consistency * 10) / 10,
      progression: Math.round(progression * 10) / 10,
      engagement: Math.round(engagement * 10) / 10,
      recoveryRespect: Math.round(recoveryRespect * 10) / 10,
      goalAdherence: Math.round(goalAdherence * 10) / 10,
    };
  }

  private computeCompositeScore(factors: ClassificationFactors): number {
    const score =
      factors.consistency * WEIGHTS.consistency +
      factors.progression * WEIGHTS.progression +
      factors.engagement * WEIGHTS.engagement +
      factors.recoveryRespect * WEIGHTS.recoveryRespect +
      factors.goalAdherence * WEIGHTS.goalAdherence;
    return Math.round(score * 10) / 10;
  }

  private determineTier(score: number, factors: ClassificationFactors): UserTier {
    // at_risk_dropout: score < 35 OR consistency < 20
    if (score < 35 || factors.consistency < 20) return 'at_risk_dropout';

    // elite_performer: score >= 85 AND consistency >= 90
    if (score >= 85 && factors.consistency >= 90) return 'elite_performer';

    // improving: score >= 65 AND positive progression
    if (score >= 65 && factors.progression >= 60) return 'improving';

    // declining: score < 50 OR negative progression trend
    if (score < 50 || factors.progression < 30) return 'declining';

    // plateau: everything else (score 50-84 with stable/mixed signals)
    return 'plateau';
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const userClassificationService = new UserClassificationService();
export default userClassificationService;
