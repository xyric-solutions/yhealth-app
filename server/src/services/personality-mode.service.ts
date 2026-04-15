/**
 * @file Personality Mode Service
 * @description 5 dynamic AI personality modes that adapt in real-time based on
 * user tier, recovery state, engagement, mood, and context.
 *
 * Modes: supportive_coach | competitive_challenger | tough_love | calm_recovery | performance_strategist
 *
 * Safety rails prevent harmful mode selections (e.g., no tough_love on low recovery).
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import { cache } from './cache.service.js';
import type { UserTier } from './user-classification.service.js';

// ============================================
// TYPES
// ============================================

export type PersonalityMode =
  | 'supportive_coach'
  | 'competitive_challenger'
  | 'tough_love'
  | 'calm_recovery'
  | 'performance_strategist';

export interface PersonalityModeResult {
  mode: PersonalityMode;
  scores: Record<PersonalityMode, number>;
  triggerReason: string;
  systemPromptPrefix: string;
}

export interface PersonalityContext {
  tier: UserTier;
  recoveryScore: number | null;
  engagement: number;       // 0-100
  moodLevel: number;        // 0-10
  stressLevel: number;      // 0-10
  streakDays: number;
  isCompetitionWeek?: boolean;
  isDeloadWeek?: boolean;
}

// ============================================
// MODE DEFINITIONS
// ============================================

const MODE_PROMPTS: Record<PersonalityMode, string> = {
  supportive_coach: `You are a warm, empathetic health coach. Your tone is encouraging, never pressuring.
Celebrate small wins. Normalize struggles. Use phrases like "it's okay", "progress not perfection", "listen to your body."
Never guilt-trip about missed sessions. Frame rest as productive. Ask open-ended questions about how they're feeling.
Goal: make the user feel supported and reduce dropout risk.`,

  competitive_challenger: `You are a direct, data-driven performance coach. Challenge the user with specific metrics.
Use comparative data ("top 8% of users at your level"). Set clear numerical targets.
Be confident and slightly provocative ("your HRV says you can handle more — prove it").
Reference PRs, trends, and statistics. Push boundaries while respecting data.
Goal: channel the user's competitive drive into measurable progress.`,

  tough_love: `You are a blunt accountability coach. No sugar-coating, no excuses.
Call out patterns directly ("3 missed sessions this week — that's a choice, not bad luck").
Use numbers to make the gap between intention and action concrete.
Be respectful but unflinching. One-line challenges work best.
Always end with a specific action: "Tomorrow, 6am, [specific exercise]. Non-negotiable."
Goal: break through complacency and hold the user accountable.`,

  calm_recovery: `You are a gentle, science-backed recovery specialist. Your tone is calming and reassuring.
Explain the physiology behind recovery ("your HRV indicates parasympathetic stress — rest is the prescription").
Advocate strongly for rest. Frame rest as the workout. Suggest light activities: walks, stretching, breathing.
Never push intensity. If user wants to train hard, redirect with data ("your injury risk is 2.4x higher today").
Goal: protect the user from overtraining and promote sustainable health.`,

  performance_strategist: `You are an analytical periodization coach. Think like a sports scientist.
Use precise terminology: mesocycles, progressive overload, RPE, 1RM percentages.
Structure recommendations around training phases. Reference weekly/monthly periodization.
Be data-centric: "Week 3 peak volume, then deload. Hit 85% 1RM for 3x3."
Goal: optimize training programming for peak performance.`,
};

// ============================================
// SERVICE CLASS
// ============================================

class PersonalityModeService {
  private tableEnsured = false;

  private async ensureTable(): Promise<void> {
    if (this.tableEnsured) return;
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS personality_mode_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          mode VARCHAR(40) NOT NULL,
          trigger_reason TEXT NOT NULL,
          score NUMERIC(5,2),
          context JSONB,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_pme_user_date
          ON personality_mode_events(user_id, created_at DESC)
      `);
      this.tableEnsured = true;
    } catch (error) {
      logger.error('[PersonalityMode] Error ensuring table', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ---- Public API ----

  /**
   * Select the optimal personality mode for the current user state.
   * Returns the mode, scores, trigger reason, and the system prompt prefix.
   */
  async selectMode(userId: string, ctx: PersonalityContext): Promise<PersonalityModeResult> {
    const scores = this.computeScores(ctx);
    let mode = this.getTopMode(scores);

    // Apply safety rails
    const safetyResult = this.applySafetyRails(mode, ctx, scores);
    mode = safetyResult.mode;
    const triggerReason = safetyResult.reason;

    const result: PersonalityModeResult = {
      mode,
      scores,
      triggerReason,
      systemPromptPrefix: MODE_PROMPTS[mode],
    };

    // Log mode selection (non-blocking)
    this.logModeEvent(userId, mode, triggerReason, scores[mode], ctx).catch(() => {});

    return result;
  }

  /**
   * Get the system prompt prefix for a given mode.
   */
  getPromptForMode(mode: PersonalityMode): string {
    return MODE_PROMPTS[mode];
  }

  /**
   * Get the most recent mode used for a user (for continuity).
   */
  async getRecentMode(userId: string): Promise<PersonalityMode | null> {
    const cacheKey = `pmode:${userId}`;
    const cached = cache.get<PersonalityMode>(cacheKey);
    if (cached) return cached;

    await this.ensureTable();
    try {
      const result = await query<{ mode: PersonalityMode }>(
        `SELECT mode FROM personality_mode_events
         WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );
      if (result.rows.length === 0) return null;
      const mode = result.rows[0].mode as PersonalityMode;
      cache.set(cacheKey, mode, 1800); // 30 min cache
      return mode;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get mode usage stats for a user (last 7 days).
   */
  async getModeStats(userId: string): Promise<Record<PersonalityMode, number>> {
    await this.ensureTable();
    const stats: Record<PersonalityMode, number> = {
      supportive_coach: 0,
      competitive_challenger: 0,
      tough_love: 0,
      calm_recovery: 0,
      performance_strategist: 0,
    };
    try {
      const result = await query<{ mode: PersonalityMode; count: string }>(
        `SELECT mode, COUNT(*) as count FROM personality_mode_events
         WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '7 days'
         GROUP BY mode`,
        [userId]
      );
      for (const row of result.rows) {
        if (row.mode in stats) {
          stats[row.mode as PersonalityMode] = parseInt(row.count, 10);
        }
      }
    } catch (error) {
      // Silent fallback
    }
    return stats;
  }

  // ---- Scoring Algorithm ----

  private computeScores(ctx: PersonalityContext): Record<PersonalityMode, number> {
    const scores: Record<PersonalityMode, number> = {
      supportive_coach: 0,
      competitive_challenger: 0,
      tough_love: 0,
      calm_recovery: 0,
      performance_strategist: 0,
    };

    // ---- Tier-based scoring (40% weight) ----
    switch (ctx.tier) {
      case 'at_risk_dropout':
        scores.supportive_coach += 40;
        break;
      case 'elite_performer':
        scores.competitive_challenger += 30;
        scores.performance_strategist += 15;
        break;
      case 'improving':
        scores.competitive_challenger += 20;
        scores.supportive_coach += 10;
        break;
      case 'plateau':
        scores.tough_love += 25;
        scores.performance_strategist += 10;
        break;
      case 'declining':
        if (ctx.engagement > 60) {
          scores.tough_love += 30;
        } else {
          scores.supportive_coach += 35;
        }
        break;
    }

    // ---- Recovery-based scoring (30% weight) ----
    if (ctx.recoveryScore !== null) {
      if (ctx.recoveryScore < 33) {
        scores.calm_recovery += 35;
      } else if (ctx.recoveryScore < 50) {
        scores.calm_recovery += 20;
        scores.supportive_coach += 10;
      } else if (ctx.recoveryScore >= 75) {
        scores.competitive_challenger += 20;
      }
    }

    // ---- Engagement + mood (20% weight) ----
    if (ctx.moodLevel < 4) {
      scores.supportive_coach += 20;
    } else if (ctx.moodLevel >= 7 && ctx.engagement > 70) {
      scores.competitive_challenger += 10;
    }

    if (ctx.stressLevel > 7) {
      scores.calm_recovery += 15;
      scores.supportive_coach += 5;
    }

    // ---- Context-based (10% weight) ----
    if (ctx.isCompetitionWeek) {
      scores.performance_strategist += 25;
    }
    if (ctx.isDeloadWeek) {
      scores.calm_recovery += 15;
    }

    // Streak bonus for competitive mode
    if (ctx.streakDays > 14) {
      scores.competitive_challenger += 5;
    }

    return scores;
  }

  private getTopMode(scores: Record<PersonalityMode, number>): PersonalityMode {
    return Object.entries(scores)
      .sort((a, b) => b[1] - a[1])[0][0] as PersonalityMode;
  }

  // ---- Safety Rails ----

  private applySafetyRails(
    mode: PersonalityMode,
    ctx: PersonalityContext,
    scores: Record<PersonalityMode, number>
  ): { mode: PersonalityMode; reason: string } {
    let reason = `Top score for ${mode} (${scores[mode]})`;

    // Rule 1: Never use tough_love when recovery < 40%
    if (mode === 'tough_love' && ctx.recoveryScore !== null && ctx.recoveryScore < 40) {
      mode = 'calm_recovery';
      reason = `Safety override: tough_love blocked (recovery ${ctx.recoveryScore}% < 40%), switched to calm_recovery`;
    }

    // Rule 2: Never use competitive_challenger on at_risk_dropout
    if (mode === 'competitive_challenger' && ctx.tier === 'at_risk_dropout') {
      mode = 'supportive_coach';
      reason = `Safety override: competitive_challenger blocked (at_risk_dropout tier), switched to supportive_coach`;
    }

    // Rule 3: Never use tough_love on at_risk_dropout
    if (mode === 'tough_love' && ctx.tier === 'at_risk_dropout') {
      mode = 'supportive_coach';
      reason = `Safety override: tough_love blocked (at_risk_dropout tier), switched to supportive_coach`;
    }

    // Rule 4: If mood is very low (< 3), always supportive
    if (ctx.moodLevel < 3 && mode !== 'supportive_coach' && mode !== 'calm_recovery') {
      mode = 'supportive_coach';
      reason = `Safety override: mood critically low (${ctx.moodLevel}/10), switched to supportive_coach`;
    }

    return { mode, reason };
  }

  // ---- Tough Love Cap (async check) ----

  /**
   * Check if tough_love should be capped (max 2 consecutive messages).
   * Call this AFTER selectMode() for additional rate limiting.
   */
  async shouldCapToughLove(userId: string): Promise<boolean> {
    await this.ensureTable();
    try {
      const result = await query<{ mode: PersonalityMode }>(
        `SELECT mode FROM personality_mode_events
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 2`,
        [userId]
      );
      // If last 2 were both tough_love, cap it
      return result.rows.length >= 2 &&
        result.rows.every(r => r.mode === 'tough_love');
    } catch {
      return false;
    }
  }

  // ---- Logging ----

  private async logModeEvent(
    userId: string,
    mode: PersonalityMode,
    reason: string,
    score: number,
    ctx: PersonalityContext
  ): Promise<void> {
    await this.ensureTable();
    try {
      await query(
        `INSERT INTO personality_mode_events (user_id, mode, trigger_reason, score, context)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, mode, reason, score, JSON.stringify(ctx)]
      );
      // Update cache
      cache.set(`pmode:${userId}`, mode, 1800);
    } catch (error) {
      logger.warn('[PersonalityMode] Error logging mode event', {
        userId,
        mode,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const personalityModeService = new PersonalityModeService();
export default personalityModeService;
