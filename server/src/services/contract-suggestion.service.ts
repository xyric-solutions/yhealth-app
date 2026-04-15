/**
 * @file Contract Suggestion Service
 * @description Rule-based AI contract suggestions based on user behavioral patterns.
 * Analyzes activity logs, goals, streaks, and health data to recommend
 * personalized accountability contracts.
 *
 * No LLM needed for v1 — pure SQL analytics with template mapping.
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';

// ─── Types ───────────────────────────────────────────────────────────

export interface ContractSuggestion {
  id: string;
  title: string;
  description: string;
  reason: string;
  conditionType: string;
  conditionMetric: string | null;
  conditionOperator: string | null;
  conditionValue: number | null;
  conditionWindowDays: number;
  penaltyType: string;
  penaltyAmount: number;
  penaltyCurrency: string;
  confidence: number; // 0-1, how relevant this suggestion is
}

// ─── Suggestion rules ────────────────────────────────────────────────

type SuggestionRule = (userId: string) => Promise<ContractSuggestion | null>;

/**
 * Rule 1: Consistency gaps — detect which days the user skips most.
 */
const suggestConsistencyContract: SuggestionRule = async (userId) => {
  const result = await query<{ dow: string; miss_rate: string }>(
    `WITH expected AS (
      SELECT generate_series(CURRENT_DATE - 28, CURRENT_DATE - 1, '1 day'::interval)::date AS d
    ),
    actual AS (
      SELECT DISTINCT scheduled_date AS d
      FROM activity_logs
      WHERE user_id = $1 AND status = 'completed'
        AND scheduled_date >= CURRENT_DATE - 28
    ),
    daily AS (
      SELECT e.d, EXTRACT(DOW FROM e.d)::int AS dow,
        CASE WHEN a.d IS NULL THEN 1 ELSE 0 END AS missed
      FROM expected e LEFT JOIN actual a ON a.d = e.d
    )
    SELECT dow, ROUND(AVG(missed) * 100)::int AS miss_rate
    FROM daily GROUP BY dow
    HAVING AVG(missed) > 0.5
    ORDER BY miss_rate DESC LIMIT 1`,
    [userId]
  );

  if (result.rows.length === 0) return null;

  const { dow, miss_rate } = result.rows[0];
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][Number(dow)];
  const missRate = Number(miss_rate);

  if (missRate < 50) return null;

  return {
    id: `suggest_consistency_${dow}`,
    title: `${dayName} Workout Commitment`,
    description: `Commit to working out every ${dayName} for the next 4 weeks`,
    reason: `You skip ${dayName}s ${missRate}% of the time — a contract could help build consistency`,
    conditionType: 'missed_activity',
    conditionMetric: 'gym_sessions',
    conditionOperator: 'lt',
    conditionValue: 1,
    conditionWindowDays: 1,
    penaltyType: 'xp_loss',
    penaltyAmount: 25,
    penaltyCurrency: 'PKR',
    confidence: Math.min(missRate / 100, 0.95),
  };
};

/**
 * Rule 2: Streak protection — suggest contract when user has an active streak.
 */
const suggestStreakProtection: SuggestionRule = async (userId) => {
  const result = await query<{ current_streak: string }>(
    `SELECT current_streak FROM user_streaks
     WHERE user_id = $1 AND current_streak >= 5
     ORDER BY updated_at DESC LIMIT 1`,
    [userId]
  );

  if (result.rows.length === 0) return null;
  const streak = Number(result.rows[0].current_streak);

  return {
    id: `suggest_streak_protection_${streak}`,
    title: 'Streak Protection Contract',
    description: `Protect your ${streak}-day streak with a commitment contract`,
    reason: `Your ${streak}-day streak is valuable — a contract adds extra motivation to keep it going`,
    conditionType: 'streak_break',
    conditionMetric: null,
    conditionOperator: 'lt',
    conditionValue: streak,
    conditionWindowDays: 1,
    penaltyType: 'donation',
    penaltyAmount: streak >= 30 ? 1000 : streak >= 14 ? 500 : 200,
    penaltyCurrency: 'PKR',
    confidence: Math.min(0.5 + streak * 0.01, 0.9),
  };
};

/**
 * Rule 3: Goal alignment — suggest when user is behind on a goal.
 */
const suggestGoalContract: SuggestionRule = async (userId) => {
  const result = await query<{
    id: string;
    title: string;
    target_value: string;
    current_value: string;
    target_unit: string;
    duration_weeks: string;
  }>(
    `SELECT id, title, target_value, current_value, target_unit, duration_weeks
     FROM user_goals
     WHERE user_id = $1 AND status = 'active'
       AND current_value < target_value * 0.5
       AND created_at < NOW() - INTERVAL '7 days'
     ORDER BY created_at ASC LIMIT 1`,
    [userId]
  );

  if (result.rows.length === 0) return null;

  const goal = result.rows[0];
  const progress = Math.round(
    (Number(goal.current_value) / Number(goal.target_value)) * 100
  );

  return {
    id: `suggest_goal_${goal.id}`,
    title: `Goal Commitment: ${goal.title}`,
    description: `Create a contract to stay on track with "${goal.title}"`,
    reason: `You're at ${progress}% on "${goal.title}" — a contract can help accelerate progress`,
    conditionType: 'missed_goal',
    conditionMetric: null,
    conditionOperator: null,
    conditionValue: null,
    conditionWindowDays: 7,
    penaltyType: 'xp_loss',
    penaltyAmount: 50,
    penaltyCurrency: 'PKR',
    confidence: Math.min(0.6 + (100 - progress) * 0.003, 0.9),
  };
};

/**
 * Rule 4: Calorie control — suggest when user frequently exceeds targets.
 */
const suggestCalorieContract: SuggestionRule = async (userId) => {
  const result = await query<{ exceed_days: string; total_days: string }>(
    `WITH daily_cals AS (
      SELECT eaten_at::date AS d, SUM(calories) AS total_cal
      FROM meal_logs
      WHERE user_id = $1 AND eaten_at >= CURRENT_DATE - 14
      GROUP BY d
    ),
    targets AS (
      SELECT COALESCE(
        (SELECT (condition_details->>'calorie_target')::numeric
         FROM accountability_contracts WHERE user_id = $1 LIMIT 1),
        2500
      ) AS target
    )
    SELECT
      COUNT(*) FILTER (WHERE dc.total_cal > t.target) AS exceed_days,
      COUNT(*) AS total_days
    FROM daily_cals dc, targets t`,
    [userId]
  );

  if (result.rows.length === 0) return null;

  const exceedDays = Number(result.rows[0]?.exceed_days || 0);
  const totalDays = Number(result.rows[0]?.total_days || 0);

  if (totalDays < 5 || exceedDays < 3) return null;

  const exceedRate = Math.round((exceedDays / totalDays) * 100);

  return {
    id: 'suggest_calorie_control',
    title: 'Calorie Control Contract',
    description: 'Commit to staying within your daily calorie target',
    reason: `You exceeded your calorie target ${exceedDays} out of ${totalDays} days (${exceedRate}%)`,
    conditionType: 'calorie_exceeded',
    conditionMetric: 'calories',
    conditionOperator: 'gt',
    conditionValue: 2500,
    conditionWindowDays: 1,
    penaltyType: 'donation',
    penaltyAmount: 500,
    penaltyCurrency: 'PKR',
    confidence: Math.min(exceedRate / 100, 0.85),
  };
};

/**
 * Rule 5: Sleep consistency — suggest when sleep is frequently low.
 */
const suggestSleepContract: SuggestionRule = async (userId) => {
  const result = await query<{ low_sleep_days: string; total_days: string }>(
    `WITH sleep_data AS (
      SELECT recorded_at::date AS d,
        COALESCE(
          (data->>'duration_hours')::numeric,
          (data->>'sleep_hours')::numeric,
          0
        ) AS hours
      FROM health_data_records
      WHERE user_id = $1 AND data_type = 'sleep'
        AND recorded_at >= CURRENT_DATE - 14
    )
    SELECT
      COUNT(*) FILTER (WHERE hours < 6) AS low_sleep_days,
      COUNT(*) AS total_days
    FROM sleep_data`,
    [userId]
  );

  const lowDays = Number(result.rows[0]?.low_sleep_days || 0);
  const totalDays = Number(result.rows[0]?.total_days || 0);

  if (totalDays < 5 || lowDays < 2) return null;

  return {
    id: 'suggest_sleep_consistency',
    title: 'Sleep Commitment Contract',
    description: 'Commit to getting at least 7 hours of sleep each night',
    reason: `You slept less than 6 hours ${lowDays} times in the last 2 weeks`,
    conditionType: 'sleep_deficit',
    conditionMetric: 'sleep_hours',
    conditionOperator: 'lt',
    conditionValue: 7,
    conditionWindowDays: 1,
    penaltyType: 'xp_loss',
    penaltyAmount: 15,
    penaltyCurrency: 'PKR',
    confidence: Math.min(lowDays / totalDays + 0.3, 0.85),
  };
};

// ─── All rules ───────────────────────────────────────────────────────

const SUGGESTION_RULES: SuggestionRule[] = [
  suggestConsistencyContract,
  suggestStreakProtection,
  suggestGoalContract,
  suggestCalorieContract,
  suggestSleepContract,
];

// ─── Service ─────────────────────────────────────────────────────────

class ContractSuggestionService {
  /**
   * Get personalized contract suggestions for a user.
   * Runs all rules in parallel, filters nulls, sorts by confidence.
   */
  async getSuggestions(userId: string, limit = 5): Promise<ContractSuggestion[]> {
    try {
      // Ensure contracts table exists (safe no-op if already created)
      await query(`CREATE TABLE IF NOT EXISTS accountability_contracts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL, description TEXT,
        condition_type VARCHAR(30) NOT NULL, condition_metric VARCHAR(50),
        condition_operator VARCHAR(10), condition_value NUMERIC,
        condition_window_days INTEGER DEFAULT 1, condition_details JSONB DEFAULT '{}',
        penalty_type VARCHAR(30) NOT NULL, penalty_amount NUMERIC,
        penalty_currency VARCHAR(10) DEFAULT 'PKR', penalty_details JSONB DEFAULT '{}',
        status VARCHAR(20) NOT NULL DEFAULT 'draft', signed_at TIMESTAMPTZ,
        start_date DATE NOT NULL, end_date DATE NOT NULL,
        auto_renew BOOLEAN DEFAULT false, pause_count INTEGER DEFAULT 0, paused_at TIMESTAMPTZ,
        verification_method VARCHAR(20) DEFAULT 'auto', grace_period_hours INTEGER DEFAULT 0,
        confidence_threshold NUMERIC(3,2) DEFAULT 0.80, ai_suggested BOOLEAN DEFAULT false,
        ai_suggestion_reason TEXT, social_enforcer_ids UUID[] DEFAULT '{}',
        violation_count INTEGER DEFAULT 0, success_count INTEGER DEFAULT 0, total_checks INTEGER DEFAULT 0,
        last_checked_at TIMESTAMPTZ, last_violation_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
        cancelled_at TIMESTAMPTZ, cancel_reason TEXT
      )`).catch(() => {}); // silent — table may already exist

      // Check if user already has many active contracts
      const activeCheck = await query<{ count: string }>(
        `SELECT COUNT(*)::int as count FROM accountability_contracts
         WHERE user_id = $1 AND status IN ('active', 'at_risk')`,
        [userId]
      );

      // Don't overwhelm — max 5 active contracts
      if (Number(activeCheck.rows[0]?.count || 0) >= 5) {
        return [];
      }

      // Run all rules in parallel
      const results = await Promise.allSettled(
        SUGGESTION_RULES.map((rule) => rule(userId))
      );

      const suggestions: ContractSuggestion[] = [];
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          suggestions.push(result.value);
        }
      }

      // Filter out suggestions that match existing active contracts
      const existingTypes = await query<{ condition_type: string }>(
        `SELECT DISTINCT condition_type FROM accountability_contracts
         WHERE user_id = $1 AND status IN ('active', 'at_risk', 'draft')`,
        [userId]
      );
      const activeTypes = new Set(existingTypes.rows.map((r) => r.condition_type));

      const filtered = suggestions.filter((s) => !activeTypes.has(s.conditionType));

      // Sort by confidence descending
      filtered.sort((a, b) => b.confidence - a.confidence);

      return filtered.slice(0, limit);
    } catch (error) {
      logger.error('[ContractSuggestions] Error generating suggestions', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return [];
    }
  }
}

export const contractSuggestionService = new ContractSuggestionService();
export default contractSuggestionService;
