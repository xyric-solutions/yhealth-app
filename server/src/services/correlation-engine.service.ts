/**
 * @file Cross-Domain Correlation Engine
 * @description Produces a unified UserContextState by correlating signals across
 * all 17 context blocks (WHOOP, schedule, workouts, nutrition, wellbeing, goals, etc.)
 *
 * Pure computation — no DB queries, no AI calls. Runs on the already-assembled
 * ComprehensiveUserContext object.
 */

import { logger } from './logger.service.js';

// ============================================
// TYPES
// ============================================

export interface UserContextState {
  // Unified scores (0–100)
  stressScore: number;
  energyScore: number;
  availabilityScore: number;
  moodScore: number;

  // Categorical levels
  stressLevel: 'low' | 'medium' | 'high' | 'critical';
  energyLevel: 'low' | 'medium' | 'high';
  availability: 'free' | 'limited' | 'busy';
  mood: 'positive' | 'neutral' | 'negative';

  // AI behavior recommendation
  recommendedMode: 'short' | 'normal' | 'deep';
  toneAdjustment: 'supportive' | 'motivational' | 'direct' | 'celebratory';

  // Cross-domain correlations detected
  correlations: string[];

  computedAt: string;
}

// ============================================
// HELPERS
// ============================================

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(v)));
}

function categorizeStress(score: number): UserContextState['stressLevel'] {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

function categorizeEnergy(score: number): UserContextState['energyLevel'] {
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

function categorizeAvailability(score: number): UserContextState['availability'] {
  if (score >= 65) return 'free';
  if (score >= 35) return 'limited';
  return 'busy';
}

function categorizeMood(score: number): UserContextState['mood'] {
  if (score >= 60) return 'positive';
  if (score >= 35) return 'neutral';
  return 'negative';
}

// ============================================
// ENGINE
// ============================================

class CorrelationEngine {
  /**
   * Compute the unified UserContextState from all context blocks.
   * @param ctx The assembled ComprehensiveUserContext (any-typed to avoid circular import)
   */
  computeState(ctx: Record<string, any>): UserContextState {
    try {
      const stressScore = this.computeStress(ctx);
      const energyScore = this.computeEnergy(ctx);
      const availabilityScore = this.computeAvailability(ctx);
      const moodScore = this.computeMood(ctx);
      const correlations = this.detectCorrelations(ctx, stressScore, energyScore, availabilityScore, moodScore);

      const stressLevel = categorizeStress(stressScore);
      const energyLevel = categorizeEnergy(energyScore);
      const availability = categorizeAvailability(availabilityScore);
      const mood = categorizeMood(moodScore);

      // Determine recommended interaction mode
      let recommendedMode: UserContextState['recommendedMode'] = 'normal';
      if (stressScore > 70 || energyScore < 30) recommendedMode = 'short';
      else if (stressScore < 30 && energyScore > 60 && availabilityScore > 60) recommendedMode = 'deep';

      // Determine tone
      let toneAdjustment: UserContextState['toneAdjustment'] = 'motivational';
      if (stressScore > 70) toneAdjustment = 'supportive';
      else if (moodScore > 70 && energyScore > 60) toneAdjustment = 'celebratory';
      else if (stressScore < 30 && energyScore > 50) toneAdjustment = 'direct';

      return {
        stressScore,
        energyScore,
        availabilityScore,
        moodScore,
        stressLevel,
        energyLevel,
        availability,
        mood,
        recommendedMode,
        toneAdjustment,
        correlations,
        computedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.warn('[CorrelationEngine] Failed to compute state, returning defaults', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return this.defaultState();
    }
  }

  // ── STRESS SCORE ──────────────────────────────────────────

  private computeStress(ctx: Record<string, any>): number {
    const weights = { schedule: 0.4, recovery: 0.3, adherence: 0.2, gaps: 0.1 };
    let scheduleStress = 20; // default low
    let recoveryStress = 30;
    let adherenceStress = 20;
    let gapStress = 10;

    // Schedule stress
    const schedCtx = ctx.lifestyle?.scheduleContext;
    if (schedCtx) {
      const map: Record<string, number> = { low: 10, medium: 40, high: 70, critical: 90 };
      scheduleStress = map[schedCtx.stressLevel] ?? 20;
      if (schedCtx.backToBackCount > 3) scheduleStress = Math.min(scheduleStress + 15, 100);
    }

    // Recovery stress (inverted — low recovery = high stress)
    const recovery = ctx.whoop?.lastRecovery?.score;
    if (recovery != null) {
      recoveryStress = clamp(100 - recovery);
    }

    // Adherence stress (missed workouts = stress)
    const completionRate = ctx.workouts?.completionRate;
    if (completionRate != null) {
      adherenceStress = clamp(100 - completionRate);
    }

    // Gaps (missed meals, water)
    const waterPct = ctx.waterIntake?.todayPercentage;
    const mealCount = ctx.nutrition?.todayMealCount ?? 0;
    if (waterPct != null && waterPct < 50) gapStress += 15;
    if (mealCount === 0) gapStress += 20;
    gapStress = clamp(gapStress);

    // Activity status modifier
    const status = ctx.activityStatus?.current;
    if (status === 'sick' || status === 'injury') scheduleStress = Math.max(scheduleStress, 60);

    return clamp(
      scheduleStress * weights.schedule +
      recoveryStress * weights.recovery +
      adherenceStress * weights.adherence +
      gapStress * weights.gaps,
    );
  }

  // ── ENERGY SCORE ──────────────────────────────────────────

  private computeEnergy(ctx: Record<string, any>): number {
    let score = 50; // baseline
    let signals = 0;
    let total = 0;

    // WHOOP recovery (direct energy indicator)
    const recovery = ctx.whoop?.lastRecovery?.score;
    if (recovery != null) {
      total += recovery;
      signals++;
    }

    // Sleep hours
    const sleepHours = ctx.whoop?.lastSleep?.duration;
    if (sleepHours != null) {
      total += clamp((sleepHours / 8) * 100);
      signals++;
    }

    // Daily score
    const dailyScore = ctx.dailyScore?.totalScore;
    if (dailyScore != null) {
      total += dailyScore;
      signals++;
    }

    // Streak bonus
    const streak = ctx.gamification?.currentStreak ?? 0;
    const streakBonus = Math.min(streak * 5, 20);

    if (signals > 0) {
      score = clamp((total / signals) + streakBonus);
    } else {
      score = 50 + streakBonus;
    }

    // Activity status modifier
    const status = ctx.activityStatus?.current;
    if (status === 'sick') score = Math.min(score, 25);
    if (status === 'injury') score = Math.min(score, 35);

    return clamp(score);
  }

  // ── AVAILABILITY SCORE ────────────────────────────────────

  private computeAvailability(ctx: Record<string, any>): number {
    const schedCtx = ctx.lifestyle?.scheduleContext;
    if (!schedCtx) return 80; // no schedule = assume free

    const freeHoursPct = clamp((schedCtx.freeHours / 17) * 100);
    const windowBonus = Math.min((schedCtx.freeWindows?.length || 0) * 10, 40);

    return clamp(freeHoursPct * 0.6 + windowBonus * 0.4);
  }

  // ── MOOD SCORE ────────────────────────────────────────────

  private computeMood(ctx: Record<string, any>): number {
    let score = 50;
    let signals = 0;
    let total = 0;

    // Wellbeing mood
    const moodLevel = ctx.wellbeing?.moodLevel;
    if (moodLevel != null) {
      total += (moodLevel / 10) * 100; // mood is 1-10
      signals++;
    }

    // Mental recovery score
    const mentalScore = ctx.mentalHealth?.recoveryScore;
    if (mentalScore != null) {
      total += mentalScore;
      signals++;
    }

    // Daily score (overall health = mood proxy)
    const dailyScore = ctx.dailyScore?.totalScore;
    if (dailyScore != null) {
      total += dailyScore;
      signals++;
    }

    if (signals > 0) {
      score = total / signals;
    }

    // Modifiers
    const streakAtRisk = ctx.gamification?.streakAtRisk;
    if (streakAtRisk) score -= 10;

    const status = ctx.activityStatus?.current;
    if (status === 'sick' || status === 'injury') score -= 20;
    if (status === 'stress') score -= 15;

    return clamp(score);
  }

  // ── CROSS-DOMAIN CORRELATIONS ─────────────────────────────

  private detectCorrelations(
    ctx: Record<string, any>,
    stress: number,
    energy: number,
    availability: number,
    mood: number,
  ): string[] {
    const correlations: string[] = [];

    // Burnout risk
    if (stress > 65 && energy < 40) {
      correlations.push('Burnout risk: heavy schedule with depleted recovery. Suggest rest and recovery activities.');
    }

    // Peak performance window
    if (stress < 30 && energy > 70 && availability > 60) {
      correlations.push('Peak performance window: low stress, high energy, free schedule. Great time for challenging goals.');
    }

    // Overtraining signal
    const streak = ctx.gamification?.currentStreak ?? 0;
    const scoreTrend = ctx.dailyScore?.scoreTrend;
    if (streak > 7 && scoreTrend === 'declining') {
      correlations.push('Overtraining signal: consistency high but scores declining. Consider a recovery day.');
    }

    // Missed opportunity
    if (availability > 70 && (ctx.workouts?.todayCompletedCount ?? 0) === 0 && stress < 40) {
      correlations.push('Free day with no workout logged yet. Good opportunity for a training session.');
    }

    // Low mood + nutrition gaps
    if (mood < 35 && (ctx.nutrition?.todayMealCount ?? 0) === 0) {
      correlations.push('Low mood with no meals logged. Nutrition may be impacting wellbeing.');
    }

    // High stress + poor sleep
    const sleepHours = ctx.whoop?.lastSleep?.duration;
    if (stress > 60 && sleepHours != null && sleepHours < 6) {
      correlations.push('High stress combined with insufficient sleep. Prioritize rest tonight.');
    }

    // Good recovery + high availability = workout day
    const recovery = ctx.whoop?.lastRecovery?.score;
    if (recovery != null && recovery > 70 && availability > 50 && (ctx.workouts?.todayCompletedCount ?? 0) === 0) {
      correlations.push('Strong recovery and available schedule. Ideal conditions for a workout.');
    }

    // Special day awareness
    const specialDays = (ctx.lifestyle as Record<string, any>)?.specialDays;
    if (specialDays && Array.isArray(specialDays) && specialDays.length > 0) {
      const dayNames = specialDays.map((d: { name: string }) => d.name).join(', ');
      correlations.push(`Special day: ${dayNames}. Adjust expectations and be flexible.`);
    }

    return correlations;
  }

  // ── DEFAULT STATE ─────────────────────────────────────────

  private defaultState(): UserContextState {
    return {
      stressScore: 30,
      energyScore: 50,
      availabilityScore: 80,
      moodScore: 50,
      stressLevel: 'low',
      energyLevel: 'medium',
      availability: 'free',
      mood: 'neutral',
      recommendedMode: 'normal',
      toneAdjustment: 'motivational',
      correlations: [],
      computedAt: new Date().toISOString(),
    };
  }

  /**
   * Format UserContextState for AI prompt injection
   */
  formatForPrompt(state: UserContextState): string {
    const lines = [
      'UNIFIED LIFE STATE:',
      `- Stress: ${state.stressLevel.toUpperCase()} (${state.stressScore}/100)`,
      `- Energy: ${state.energyLevel.toUpperCase()} (${state.energyScore}/100)`,
      `- Availability: ${state.availability.toUpperCase()} (${state.availabilityScore}/100)`,
      `- Mood: ${state.mood.toUpperCase()} (${state.moodScore}/100)`,
      `- Recommended Interaction: ${state.recommendedMode.toUpperCase()} — ${
        state.recommendedMode === 'short' ? 'keep responses concise and supportive' :
        state.recommendedMode === 'deep' ? 'engage in deeper coaching and goal exploration' :
        'normal conversational coaching'
      }`,
      `- Tone: ${state.toneAdjustment}`,
    ];

    if (state.correlations.length > 0) {
      lines.push('- Key Insights:');
      for (const c of state.correlations.slice(0, 3)) {
        lines.push(`  • ${c}`);
      }
    }

    return lines.join('\n');
  }
}

export const correlationEngine = new CorrelationEngine();
