/**
 * @file Buddy Suggestion Service
 * @description AI-driven buddy matching based on goal similarity, activity level,
 * streak compatibility, and competition overlap. Rule-based v1 (no embeddings).
 *
 * Weights: Goals 40%, Activity 25%, Streak 15%, Competitions 10%, Freshness 10%
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';

// ─── Types ───────────────────────────────────────────────────────────

export interface BuddySuggestion {
  userId: string;
  firstName: string;
  lastName: string | null;
  avatar: string | null;
  matchScore: number;
  matchReason: string;
  primaryGoal: string | null;
  primaryPillar: string | null;
  activityLevel: string;
  currentStreak: number;
  goalOverlap: Record<string, unknown>;
}

// ─── Service ─────────────────────────────────────────────────────────

class BuddySuggestionService {

  /**
   * Get buddy suggestions for a user. Reads from cache first,
   * falls back to real-time computation.
   */
  async getSuggestions(userId: string, limit = 10): Promise<BuddySuggestion[]> {
    try {
      // Try cache first
      const cached = await query<{
        suggested_user_id: string;
        match_score: string;
        match_reason: string;
        goal_overlap: Record<string, unknown>;
        first_name: string;
        last_name: string | null;
        avatar: string | null;
      }>(
        `SELECT bsc.suggested_user_id, bsc.match_score, bsc.match_reason, bsc.goal_overlap,
                u.first_name, u.last_name, u.avatar
         FROM buddy_suggestions_cache bsc
         JOIN users u ON u.id = bsc.suggested_user_id AND u.is_active = true
         WHERE bsc.user_id = $1 AND bsc.dismissed = false
           AND bsc.computed_at > NOW() - INTERVAL '7 days'
         ORDER BY bsc.match_score DESC
         LIMIT $2`,
        [userId, limit]
      );

      if (cached.rows.length >= 3) {
        return cached.rows.map((r) => ({
          userId: r.suggested_user_id,
          firstName: r.first_name,
          lastName: r.last_name,
          avatar: r.avatar,
          matchScore: Number(r.match_score),
          matchReason: r.match_reason,
          primaryGoal: null,
          primaryPillar: null,
          activityLevel: 'active',
          currentStreak: 0,
          goalOverlap: r.goal_overlap || {},
        }));
      }

      // Compute real-time
      return this.computeSuggestions(userId, limit);
    } catch (error) {
      logger.error('[BuddySuggestion] Error getting suggestions', {
        userId, error: error instanceof Error ? error.message : 'Unknown',
      });
      return [];
    }
  }

  /**
   * Compute suggestions in real-time using multi-factor scoring.
   */
  async computeSuggestions(userId: string, limit = 10): Promise<BuddySuggestion[]> {
    try {
      // 1. Get user's goals
      const userGoals = await query<{ pillar: string; category: string; target_value: string }>(
        `SELECT pillar, category, target_value FROM user_goals
         WHERE user_id = $1 AND status = 'active'`,
        [userId]
      );
      const userPillars = new Set(userGoals.rows.map(g => g.pillar));
      const userCategories = new Set(userGoals.rows.map(g => g.category));

      // 2. Get user's activity level
      const userActivity = await query<{ avg_score: string }>(
        `SELECT AVG(total_score)::numeric as avg_score FROM daily_user_scores
         WHERE user_id = $1 AND date >= CURRENT_DATE - 14`,
        [userId]
      );
      const userAvgScore = Number(userActivity.rows[0]?.avg_score || 0);

      // 3. Get user's streak
      const userStreak = await query<{ current_streak: string }>(
        `SELECT current_streak FROM user_streaks WHERE user_id = $1`,
        [userId]
      );
      const userStreakDays = Number(userStreak.rows[0]?.current_streak || 0);

      // 4. Get excluded user IDs (already followed, blocked, self)
      const excluded = await query<{ id: string }>(
        `SELECT recipient_id as id FROM user_follows WHERE requester_id = $1
         UNION SELECT requester_id as id FROM user_follows WHERE recipient_id = $1
         UNION SELECT $1 as id`,
        [userId]
      );
      const excludeIds = excluded.rows.map(r => r.id);

      // 5. Get candidate users with consent + goals + activity
      const candidates = await query<{
        id: string;
        first_name: string;
        last_name: string | null;
        avatar: string | null;
        pillar: string | null;
        category: string | null;
        goal_title: string | null;
        avg_score: string | null;
        current_streak: string | null;
      }>(
        `SELECT DISTINCT ON (u.id)
          u.id, u.first_name, u.last_name, u.avatar,
          g.pillar, g.category, g.title as goal_title,
          ds.avg_score, us.current_streak
        FROM users u
        LEFT JOIN buddy_discovery_consent bdc ON bdc.user_id = u.id
        LEFT JOIN LATERAL (
          SELECT pillar, category, title FROM user_goals
          WHERE user_id = u.id AND status = 'active'
          ORDER BY is_primary DESC, created_at DESC LIMIT 1
        ) g ON true
        LEFT JOIN LATERAL (
          SELECT AVG(total_score)::numeric as avg_score FROM daily_user_scores
          WHERE user_id = u.id AND date >= CURRENT_DATE - 14
        ) ds ON true
        LEFT JOIN user_streaks us ON us.user_id = u.id
        WHERE u.is_active = true
          AND u.id != ALL($1::uuid[])
          AND (bdc.allow_suggestions = true OR bdc.user_id IS NULL)
        LIMIT 100`,
        [excludeIds]
      );

      // 6. Score each candidate
      const scored: (BuddySuggestion & { _score: number })[] = [];

      for (const c of candidates.rows) {
        let score = 0;
        const reasons: string[] = [];

        // Goal similarity (40%)
        const pillarMatch = c.pillar && userPillars.has(c.pillar);
        const categoryMatch = c.category && userCategories.has(c.category);
        if (categoryMatch) {
          score += 0.4;
          reasons.push(`Both working on ${c.category} goals`);
        } else if (pillarMatch) {
          score += 0.28;
          reasons.push(`Both focused on ${c.pillar}`);
        } else if (c.pillar) {
          // Complementary check
          const complementary = this.areComplementary(
            Array.from(userPillars),
            [c.pillar]
          );
          if (complementary) {
            score += 0.2;
            reasons.push(`Complementary goals: ${Array.from(userPillars).join(' + ')} ↔ ${c.pillar}`);
          }
        }

        // Activity level proximity (25%)
        const candidateAvg = Number(c.avg_score || 0);
        const activityDiff = Math.abs(userAvgScore - candidateAvg);
        const maxDiff = Math.max(userAvgScore, candidateAvg, 1);
        const activitySimilarity = 1 - (activityDiff / maxDiff);
        score += activitySimilarity * 0.25;
        if (activitySimilarity > 0.7) {
          const level = candidateAvg > 70 ? 'high' : candidateAvg > 40 ? 'moderate' : 'building';
          reasons.push(`Similar ${level} activity levels`);
        }

        // Streak compatibility (15%)
        const candidateStreak = Number(c.current_streak || 0);
        const streakDiff = Math.abs(userStreakDays - candidateStreak);
        const streakSim = streakDiff <= 5 ? 1 : streakDiff <= 15 ? 0.6 : 0.2;
        score += streakSim * 0.15;
        if (streakSim > 0.7 && candidateStreak > 3) {
          reasons.push(`Both on active streaks`);
        }

        // Freshness bonus (10%) — newer users get slight boost
        score += 0.1;

        if (score < 0.2 || reasons.length === 0) continue;

        const actLevel = candidateAvg > 70 ? 'Very Active' : candidateAvg > 40 ? 'Active' : candidateAvg > 10 ? 'Getting Started' : 'New';

        scored.push({
          userId: c.id,
          firstName: c.first_name,
          lastName: c.last_name,
          avatar: c.avatar,
          matchScore: Math.round(score * 100) / 100,
          matchReason: reasons[0] || 'Potential accountability partner',
          primaryGoal: c.goal_title,
          primaryPillar: c.pillar,
          activityLevel: actLevel,
          currentStreak: candidateStreak,
          goalOverlap: {
            pillarMatch: !!pillarMatch,
            categoryMatch: !!categoryMatch,
            pillars: c.pillar ? [c.pillar] : [],
          },
          _score: score,
        });
      }

      // Sort by score, take top N
      scored.sort((a, b) => b._score - a._score);
      const top = scored.slice(0, limit);

      // Cache results (fire-and-forget)
      this.cacheResults(userId, top).catch(() => {});

      return top.map(({ _score, ...s }) => s);
    } catch (error) {
      logger.error('[BuddySuggestion] Computation error', {
        userId, error: error instanceof Error ? error.message : 'Unknown',
      });
      return [];
    }
  }

  private areComplementary(pillarsA: string[], pillarsB: string[]): boolean {
    const complementPairs = [
      ['fitness', 'nutrition'], ['fitness', 'wellbeing'], ['nutrition', 'wellbeing'],
    ];
    for (const [p1, p2] of complementPairs) {
      if ((pillarsA.includes(p1) && pillarsB.includes(p2)) ||
          (pillarsA.includes(p2) && pillarsB.includes(p1))) {
        return true;
      }
    }
    return false;
  }

  private async cacheResults(userId: string, suggestions: BuddySuggestion[]): Promise<void> {
    if (suggestions.length === 0) return;

    // Clear old cache
    await query('DELETE FROM buddy_suggestions_cache WHERE user_id = $1', [userId]);

    // Batch insert all suggestions in one query (avoids N+1)
    const values: (string | number)[] = [];
    const placeholders: string[] = [];
    let idx = 1;

    for (const s of suggestions) {
      placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
      values.push(userId, s.userId, s.matchScore, s.matchReason, JSON.stringify(s.goalOverlap));
    }

    await query(
      `INSERT INTO buddy_suggestions_cache (user_id, suggested_user_id, match_score, match_reason, goal_overlap)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (user_id, suggested_user_id) DO UPDATE SET
         match_score = EXCLUDED.match_score, match_reason = EXCLUDED.match_reason,
         goal_overlap = EXCLUDED.goal_overlap, computed_at = NOW(), dismissed = false`,
      values
    );
  }

  async dismissSuggestion(userId: string, suggestedUserId: string): Promise<void> {
    await query(
      `UPDATE buddy_suggestions_cache SET dismissed = true WHERE user_id = $1 AND suggested_user_id = $2`,
      [userId, suggestedUserId]
    );
  }

  /**
   * Batch refresh for all active users. Called by weekly job.
   */
  async refreshAllSuggestions(): Promise<{ processed: number }> {
    const users = await query<{ id: string }>(
      `SELECT id FROM users WHERE is_active = true AND last_login_at >= NOW() - INTERVAL '14 days' LIMIT 500`
    );

    let processed = 0;
    for (const user of users.rows) {
      try {
        await this.computeSuggestions(user.id, 20);
        processed++;
      } catch {
        // skip individual failures
      }
      // Rate limit: 100ms between users
      await new Promise(r => setTimeout(r, 100));
    }
    return { processed };
  }
}

export const buddySuggestionService = new BuddySuggestionService();
export default buddySuggestionService;
