/**
 * @file Motivation Tier Service
 * @description Manages user motivation profiles with declared, computed, and active tiers.
 * Computes engagement scores from behavioral data (14-day rolling window) and
 * blends declared preference with observed behavior for adaptive coaching intensity.
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import type { MotivationTier, UserMotivationProfile } from '../../../shared/types/domain/wellbeing.js';

// ============================================
// HELPERS
// ============================================

interface MotivationProfileRow {
  id: string;
  user_id: string;
  declared_tier: string;
  computed_tier: string;
  active_tier: string;
  engagement_score: string;
  login_frequency_score: string;
  suggestion_accept_rate: string;
  task_completion_rate: string;
  session_depth_score: string;
  streak_consistency_score: string;
  last_computed_at: string;
  tier_history: Array<{ tier: MotivationTier; date: string; reason: string }>;
  created_at: string;
  updated_at: string;
}

function mapRowToProfile(row: MotivationProfileRow): UserMotivationProfile {
  return {
    id: row.id,
    userId: row.user_id,
    declaredTier: row.declared_tier as MotivationTier,
    computedTier: row.computed_tier as MotivationTier,
    activeTier: row.active_tier as MotivationTier,
    engagementScore: parseFloat(row.engagement_score),
    loginFrequencyScore: parseFloat(row.login_frequency_score),
    suggestionAcceptRate: parseFloat(row.suggestion_accept_rate),
    taskCompletionRate: parseFloat(row.task_completion_rate),
    sessionDepthScore: parseFloat(row.session_depth_score),
    streakConsistencyScore: parseFloat(row.streak_consistency_score),
    lastComputedAt: row.last_computed_at,
    tierHistory: row.tier_history ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function tierFromScore(score: number): MotivationTier {
  if (score > 70) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

// ============================================
// ENGAGEMENT SCORE WEIGHTS
// ============================================

const WEIGHTS = {
  loginFrequency: 0.25,
  suggestionAcceptRate: 0.30,
  taskCompletionRate: 0.25,
  sessionDepth: 0.10,
  streakConsistency: 0.10,
} as const;

const ROLLING_WINDOW_DAYS = 14;

// ============================================
// SERVICE
// ============================================

class MotivationTierService {
  /**
   * Get or create a motivation profile for a user.
   * Creates a default profile if none exists.
   */
  async getProfile(userId: string): Promise<UserMotivationProfile> {
    try {
      const result = await query<MotivationProfileRow>(
        `SELECT * FROM user_motivation_profiles WHERE user_id = $1`,
        [userId]
      );

      if (result.rows.length > 0) {
        return mapRowToProfile(result.rows[0]);
      }

      // Create default profile
      const insertResult = await query<MotivationProfileRow>(
        `INSERT INTO user_motivation_profiles (user_id)
         VALUES ($1)
         RETURNING *`,
        [userId]
      );

      return mapRowToProfile(insertResult.rows[0]);
    } catch (error) {
      logger.error('[MotivationTier] Failed to get/create profile', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Set the user's self-declared tier (from onboarding or settings).
   * Also updates the active tier to reflect the new declaration.
   */
  async setDeclaredTier(userId: string, tier: MotivationTier): Promise<UserMotivationProfile> {
    try {
      // Ensure profile exists
      await this.getProfile(userId);

      const result = await query<MotivationProfileRow>(
        `UPDATE user_motivation_profiles
         SET declared_tier = $2,
             active_tier = $2,
             tier_history = tier_history || $3::jsonb,
             updated_at = NOW()
         WHERE user_id = $1
         RETURNING *`,
        [
          userId,
          tier,
          JSON.stringify([{ tier, date: new Date().toISOString(), reason: 'user_declared' }]),
        ]
      );

      return mapRowToProfile(result.rows[0]);
    } catch (error) {
      logger.error('[MotivationTier] Failed to set declared tier', {
        userId,
        tier,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Compute engagement score from behavioral data (rolling 14-day window).
   * Returns the weighted composite score (0-100).
   */
  async computeEngagementScore(userId: string): Promise<number> {
    try {
      // 1. Login frequency (25%): distinct active dates in last 14 days, normalized to 0-100
      const loginResult = await query<{ active_days: string }>(
        `SELECT COUNT(DISTINCT DATE(created_at))::text AS active_days
         FROM activity_logs
         WHERE user_id = $1
           AND created_at >= NOW() - INTERVAL '${ROLLING_WINDOW_DAYS} days'`,
        [userId]
      );
      const activeDays = parseInt(loginResult.rows[0]?.active_days ?? '0', 10);
      const loginFrequencyScore = Math.min(100, (activeDays / ROLLING_WINDOW_DAYS) * 100);

      // 2. Suggestion accept rate (30%): placeholder until goal_action_responses table exists in Phase 2
      const suggestionAcceptRate = 50.0;

      // 3. Task completion rate (25%): completed check-ins + completed activities in 14 days
      const [checkinResult, activityResult] = await Promise.all([
        query<{ total: string; completed: string }>(
          `SELECT COUNT(*)::text AS total,
                  COUNT(*) FILTER (WHERE progress_value IS NOT NULL)::text AS completed
           FROM life_goal_checkins
           WHERE user_id = $1
             AND checkin_date >= CURRENT_DATE - ${ROLLING_WINDOW_DAYS}`,
          [userId]
        ),
        query<{ total: string; completed: string }>(
          `SELECT COUNT(*)::text AS total,
                  COUNT(*) FILTER (WHERE status = 'completed')::text AS completed
           FROM activity_logs
           WHERE user_id = $1
             AND created_at >= NOW() - INTERVAL '${ROLLING_WINDOW_DAYS} days'`,
          [userId]
        ),
      ]);

      const totalTasks =
        parseInt(checkinResult.rows[0]?.total ?? '0', 10) +
        parseInt(activityResult.rows[0]?.total ?? '0', 10);
      const completedTasks =
        parseInt(checkinResult.rows[0]?.completed ?? '0', 10) +
        parseInt(activityResult.rows[0]?.completed ?? '0', 10);
      const taskCompletionRate = totalTasks > 0
        ? Math.min(100, (completedTasks / totalTasks) * 100)
        : 50.0; // Default when no tasks exist

      // 4. Session depth (10%): average number of activity_logs per active day
      const sessionDepthScore = activeDays > 0
        ? Math.min(100, (parseInt(activityResult.rows[0]?.total ?? '0', 10) / activeDays) * 20) // Normalize: 5 activities/day = 100
        : 0;

      // 5. Streak consistency (10%): current_streak / days_since_signup * 100
      const streakResult = await query<{ current_streak: number; created_at: string }>(
        `SELECT current_streak, created_at FROM users WHERE id = $1`,
        [userId]
      );

      let streakConsistencyScore = 0;
      if (streakResult.rows.length > 0) {
        const currentStreak = streakResult.rows[0].current_streak ?? 0;
        const daysSinceSignup = Math.max(
          1,
          Math.floor(
            (Date.now() - new Date(streakResult.rows[0].created_at).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        );
        streakConsistencyScore = Math.min(100, (currentStreak / daysSinceSignup) * 100);
      }

      // Compute weighted engagement score
      const engagementScore =
        loginFrequencyScore * WEIGHTS.loginFrequency +
        suggestionAcceptRate * WEIGHTS.suggestionAcceptRate +
        taskCompletionRate * WEIGHTS.taskCompletionRate +
        sessionDepthScore * WEIGHTS.sessionDepth +
        streakConsistencyScore * WEIGHTS.streakConsistency;

      // Persist individual scores and composite
      await query(
        `UPDATE user_motivation_profiles
         SET engagement_score = $2,
             login_frequency_score = $3,
             suggestion_accept_rate = $4,
             task_completion_rate = $5,
             session_depth_score = $6,
             streak_consistency_score = $7,
             last_computed_at = NOW(),
             updated_at = NOW()
         WHERE user_id = $1`,
        [
          userId,
          Math.round(engagementScore * 100) / 100,
          Math.round(loginFrequencyScore * 100) / 100,
          Math.round(suggestionAcceptRate * 100) / 100,
          Math.round(taskCompletionRate * 100) / 100,
          Math.round(sessionDepthScore * 100) / 100,
          Math.round(streakConsistencyScore * 100) / 100,
        ]
      );

      logger.info('[MotivationTier] Engagement score computed', {
        userId,
        engagementScore: Math.round(engagementScore * 100) / 100,
        loginFrequencyScore: Math.round(loginFrequencyScore * 100) / 100,
        taskCompletionRate: Math.round(taskCompletionRate * 100) / 100,
        sessionDepthScore: Math.round(sessionDepthScore * 100) / 100,
        streakConsistencyScore: Math.round(streakConsistencyScore * 100) / 100,
      });

      return Math.round(engagementScore * 100) / 100;
    } catch (error) {
      logger.error('[MotivationTier] Failed to compute engagement score', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Update computed tier based on engagement score thresholds.
   * >70 = high, 35-70 = medium, <35 = low
   *
   * Tier change policy:
   * - Only DROPS after 2 consecutive weeks below threshold
   * - RISES after 1 week above threshold
   */
  async updateComputedTier(userId: string): Promise<void> {
    try {
      const profile = await this.getProfile(userId);
      const newTierFromScore = tierFromScore(profile.engagementScore);

      // If no change, nothing to do
      if (newTierFromScore === profile.computedTier) {
        return;
      }

      const tierOrder: Record<MotivationTier, number> = { low: 0, medium: 1, high: 2 };
      const isDropping = tierOrder[newTierFromScore] < tierOrder[profile.computedTier];

      if (isDropping) {
        // Only drop after 2 consecutive weeks below threshold
        // Check if the last computed score (from previous week) also suggested a drop
        const history = profile.tierHistory;
        const lastDropSuggestion = history
          .filter(h => h.reason === 'computed_drop_pending')
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

        if (lastDropSuggestion) {
          const daysSinceLastDrop = Math.floor(
            (Date.now() - new Date(lastDropSuggestion.date).getTime()) / (1000 * 60 * 60 * 24)
          );

          if (daysSinceLastDrop >= 7) {
            // Two consecutive weeks below threshold -- apply the drop
            await this.applyTierChange(userId, newTierFromScore, 'computed_drop');
          }
          // Otherwise, still within the first week -- keep the pending marker
        } else {
          // First time scoring below -- record pending, do not drop yet
          await query(
            `UPDATE user_motivation_profiles
             SET tier_history = tier_history || $2::jsonb,
                 updated_at = NOW()
             WHERE user_id = $1`,
            [
              userId,
              JSON.stringify([{
                tier: newTierFromScore,
                date: new Date().toISOString(),
                reason: 'computed_drop_pending',
              }]),
            ]
          );
        }
      } else {
        // Rising -- apply after 1 week (this method runs weekly, so immediate apply)
        await this.applyTierChange(userId, newTierFromScore, 'computed_rise');
      }
    } catch (error) {
      logger.error('[MotivationTier] Failed to update computed tier', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get the active (blended) tier.
   * Starts with declared, drifts toward computed over time.
   */
  async getActiveTier(userId: string): Promise<MotivationTier> {
    try {
      const profile = await this.getProfile(userId);
      return profile.activeTier;
    } catch (error) {
      logger.error('[MotivationTier] Failed to get active tier', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return 'medium'; // Safe default
    }
  }

  /**
   * Per-goal override: returns the goal's motivation_level if set, otherwise the user's active tier.
   */
  async getTierForGoal(userId: string, goalId: string): Promise<MotivationTier> {
    try {
      const result = await query<{ motivation_level: string | null }>(
        `SELECT motivation_level FROM life_goals WHERE id = $1 AND user_id = $2`,
        [goalId, userId]
      );

      if (result.rows.length > 0 && result.rows[0].motivation_level) {
        return result.rows[0].motivation_level as MotivationTier;
      }

      return this.getActiveTier(userId);
    } catch (error) {
      logger.error('[MotivationTier] Failed to get tier for goal', {
        userId,
        goalId,
        error: error instanceof Error ? error.message : String(error),
      });
      return 'medium';
    }
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private async applyTierChange(
    userId: string,
    newTier: MotivationTier,
    reason: string
  ): Promise<void> {
    await query(
      `UPDATE user_motivation_profiles
       SET computed_tier = $2,
           active_tier = $2,
           tier_history = tier_history || $3::jsonb,
           updated_at = NOW()
       WHERE user_id = $1`,
      [
        userId,
        newTier,
        JSON.stringify([{ tier: newTier, date: new Date().toISOString(), reason }]),
      ]
    );

    logger.info('[MotivationTier] Tier changed', { userId, newTier, reason });
  }
}

export const motivationTierService = new MotivationTierService();
