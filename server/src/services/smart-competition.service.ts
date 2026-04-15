/**
 * @file Smart Competition Service
 * @description Replaces random template selection with goal-weighted intelligence.
 * Analyzes active user goal distribution and picks templates that match
 * the dominant interests of the user base.
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';

// ─── Types ───────────────────────────────────────────────────────────

export interface GoalDistribution {
  pillar: string;
  count: number;
  percentage: number;
}

export interface TemplateRecommendation {
  templateIndex: number;
  reason: string;
  confidence: number;
}

// ─── Pillar → Template Index Mapping ─────────────────────────────────
// Maps dominant pillars to the best-fit template indices in the TEMPLATES array
// Template indices reference competition-auto-create.job.ts TEMPLATES array:
// 0: Daily Workout Blitz, 1: Workout Streak, 2: Nutrition Mastery,
// 3: Clean Eating Sprint, 4: Wellness Focus, 5: Recovery Champion,
// 6: Total Health, 7: Engagement Marathon

const PILLAR_TEMPLATE_MAP: Record<string, number[]> = {
  fitness: [0, 1],       // Workout Blitz, Streak Challenge
  nutrition: [2, 3],     // Nutrition Mastery, Clean Eating
  wellbeing: [4, 5],     // Wellness Focus, Recovery Champion
  mixed: [6, 7],         // Total Health, Engagement Marathon
};

// Additional smart templates for specific goal patterns
export const SMART_TEMPLATES = [
  {
    name: 'No Sugar Sprint',
    description: 'Challenge yourself: no added sugar for the duration. Log your meals to prove it!',
    rules: { metric: 'nutrition' as const, aggregation: 'total' as const, min_days: 1 },
    scoringWeights: { workout: 5, nutrition: 50, wellbeing: 10, biometrics: 10, engagement: 15, consistency: 10 },
    badges: ['Sugar-Free Champion'],
    trigger: 'nutrition_dominant',
  },
  {
    name: 'Sleep Before 11PM',
    description: 'Consistent sleep = better recovery. Log sleep before 11PM every night.',
    rules: { metric: 'wellbeing' as const, aggregation: 'streak' as const, min_days: 1 },
    scoringWeights: { workout: 5, nutrition: 5, wellbeing: 45, biometrics: 20, engagement: 10, consistency: 15 },
    badges: ['Sleep Discipline Master'],
    trigger: 'sleep_goals',
  },
  {
    name: 'Daily 8K Steps',
    description: 'Hit 8,000 steps every day. Walking is the foundation of fitness.',
    rules: { metric: 'workout' as const, aggregation: 'total' as const, min_days: 1 },
    scoringWeights: { workout: 40, nutrition: 5, wellbeing: 10, biometrics: 15, engagement: 15, consistency: 15 },
    badges: ['Step Champion'],
    trigger: 'fitness_walking',
  },
  {
    name: 'Hydration Hero',
    description: 'Drink your daily water target consistently. Hydration fuels everything.',
    rules: { metric: 'nutrition' as const, aggregation: 'streak' as const, min_days: 1 },
    scoringWeights: { workout: 5, nutrition: 35, wellbeing: 20, biometrics: 15, engagement: 10, consistency: 15 },
    badges: ['Hydration Hero'],
    trigger: 'water_goals',
  },
  {
    name: 'Mindfulness Minutes',
    description: 'Meditate, journal, or practice mindfulness daily. Inner peace = outer strength.',
    rules: { metric: 'wellbeing' as const, aggregation: 'total' as const, min_days: 1 },
    scoringWeights: { workout: 5, nutrition: 5, wellbeing: 50, biometrics: 10, engagement: 15, consistency: 15 },
    badges: ['Zen Master'],
    trigger: 'wellbeing_dominant',
  },
];

// ─── Service ─────────────────────────────────────────────────────────

class SmartCompetitionService {

  /**
   * Analyze what goals the active user base has right now.
   */
  async getGoalDistribution(): Promise<GoalDistribution[]> {
    try {
      const result = await query<{ pillar: string; count: string }>(
        `SELECT pillar, COUNT(*)::int as count
         FROM user_goals
         WHERE status = 'active'
           AND user_id IN (SELECT id FROM users WHERE is_active = true AND last_login_at >= NOW() - INTERVAL '14 days')
         GROUP BY pillar
         ORDER BY count DESC`
      );

      const total = result.rows.reduce((sum, r) => sum + Number(r.count), 0) || 1;
      return result.rows.map(r => ({
        pillar: r.pillar,
        count: Number(r.count),
        percentage: Math.round((Number(r.count) / total) * 100),
      }));
    } catch (error) {
      logger.error('[SmartCompetition] Goal distribution query failed', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return [];
    }
  }

  /**
   * Select the best template index for a given cadence.
   * Returns the index into the TEMPLATES array in competition-auto-create.job.ts,
   * or a smart template object if a special pattern is detected.
   *
   * @param cadence 'daily' | 'weekly' | 'monthly'
   * @param recentTemplateNames Names of recently used templates to avoid
   */
  async selectBestTemplateIndex(
    _cadence: string,
    recentTemplateNames: string[] = []
  ): Promise<{ index: number; smartTemplate?: (typeof SMART_TEMPLATES)[number]; reason: string }> {
    const distribution = await this.getGoalDistribution();

    if (distribution.length === 0) {
      // No goal data — fall back to total health
      return { index: 6, reason: 'No goal data — using Total Health' };
    }

    const dominant = distribution[0];
    const recentSet = new Set(recentTemplateNames.map(n => n.toLowerCase()));

    // Check if a smart template matches and hasn't been used recently
    for (const st of SMART_TEMPLATES) {
      if (recentSet.has(st.name.toLowerCase())) continue;

      if (st.trigger === 'nutrition_dominant' && dominant.pillar === 'nutrition' && dominant.percentage >= 30) {
        return { index: -1, smartTemplate: st, reason: `Nutrition goals dominant (${dominant.percentage}%)` };
      }
      if (st.trigger === 'wellbeing_dominant' && dominant.pillar === 'wellbeing' && dominant.percentage >= 30) {
        return { index: -1, smartTemplate: st, reason: `Wellbeing goals dominant (${dominant.percentage}%)` };
      }
    }

    // Map dominant pillar to standard template indices
    const pillarKey = dominant.percentage >= 50 ? dominant.pillar : 'mixed';
    const candidateIndices = PILLAR_TEMPLATE_MAP[pillarKey] || PILLAR_TEMPLATE_MAP.mixed;

    // Pick one that hasn't been used recently
    for (const idx of candidateIndices) {
      // We don't have template names at this point, but the caller will check
      return { index: idx, reason: `${dominant.pillar} goals are dominant (${dominant.percentage}%)` };
    }

    return { index: candidateIndices[0], reason: `Defaulting to ${pillarKey} template` };
  }

  /**
   * Check if a competition of a given cadence is currently active.
   */
  async hasActiveCompetition(cadence: 'daily' | 'weekly' | 'monthly'): Promise<boolean> {
    const durationRange = cadence === 'daily' ? [0, 1] : cadence === 'weekly' ? [2, 10] : [11, 45];

    const result = await query<{ count: string }>(
      `SELECT COUNT(*)::int as count FROM competitions
       WHERE type = 'ai_generated'
         AND status = 'active'
         AND end_date > NOW()
         AND (end_date::date - start_date::date) >= $1
         AND (end_date::date - start_date::date) <= $2`,
      [durationRange[0], durationRange[1]]
    );

    return Number(result.rows[0]?.count || 0) > 0;
  }

  /**
   * Get recently used template names (last 5 competitions) to avoid repetition.
   */
  async getRecentTemplateNames(limit = 5): Promise<string[]> {
    const result = await query<{ name: string }>(
      `SELECT name FROM competitions
       WHERE type = 'ai_generated'
       ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows.map(r => r.name);
  }
}

export const smartCompetitionService = new SmartCompetitionService();
export default smartCompetitionService;
