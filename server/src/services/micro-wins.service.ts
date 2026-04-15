/**
 * @file Micro-Wins Detection Service
 * @description Compares current user behavior vs past behavior to detect
 * small meaningful improvements: comebacks, streak recoveries, consistency
 * gains, volume increases, personal bests, and pillar balance.
 *
 * Rule-based (no LLM). Each detection rule queries the last 7-14 days
 * and compares against the prior period.
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';

// ============================================
// TYPES
// ============================================

export interface MicroWin {
  id: string;
  type: MicroWinType;
  title: string;
  description: string;
  detectedAt: string;
  metric: string;
  currentValue: number;
  previousValue: number;
  rarity: 'common' | 'rare' | 'epic';
  xpReward: number;
}

export type MicroWinType =
  | 'comeback'
  | 'streak_recovery'
  | 'consistency_up'
  | 'volume_up'
  | 'personal_best'
  | 'pillar_balance'
  | 'time_improvement';

// ============================================
// TABLE SETUP
// ============================================

let tableEnsured = false;

async function ensureTable(): Promise<void> {
  if (tableEnsured) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS micro_wins (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(30) NOT NULL,
        title VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        metric VARCHAR(50),
        current_value NUMERIC,
        previous_value NUMERIC,
        rarity VARCHAR(20) DEFAULT 'common',
        xp_reward INTEGER DEFAULT 25,
        detected_at TIMESTAMPTZ DEFAULT NOW(),
        dismissed BOOLEAN DEFAULT FALSE,
        UNIQUE(user_id, type, metric, (detected_at::date))
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_micro_wins_user ON micro_wins(user_id, detected_at DESC)`);
    tableEnsured = true;
  } catch (error) {
    logger.error('[MicroWins] Error ensuring table', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================
// DETECTION RULES
// ============================================

interface DetectionContext {
  userId: string;
}

type DetectionRule = (ctx: DetectionContext) => Promise<Omit<MicroWin, 'id' | 'detectedAt'> | null>;

/**
 * Comeback: User was inactive for 3+ days, then did an activity today/yesterday.
 */
const detectComeback: DetectionRule = async ({ userId }) => {
  const result = await query<{ inactive_days: string; recent_activity: string }>(
    `WITH recent AS (
      SELECT MAX(scheduled_date) as last_active
      FROM activity_logs
      WHERE user_id = $1 AND status = 'completed' AND scheduled_date < CURRENT_DATE
    ),
    today AS (
      SELECT COUNT(*) as cnt
      FROM activity_logs
      WHERE user_id = $1 AND status = 'completed'
        AND scheduled_date >= CURRENT_DATE - 1
    )
    SELECT
      COALESCE(CURRENT_DATE - r.last_active, 999) as inactive_days,
      t.cnt as recent_activity
    FROM recent r, today t`,
    [userId]
  );

  const row = result.rows[0];
  if (!row) return null;

  const inactiveDays = parseInt(row.inactive_days || '0');
  const recentActivity = parseInt(row.recent_activity || '0');

  if (inactiveDays >= 3 && recentActivity > 0) {
    const rarity = inactiveDays >= 14 ? 'epic' as const : inactiveDays >= 7 ? 'rare' as const : 'common' as const;
    const xp = rarity === 'epic' ? 100 : rarity === 'rare' ? 50 : 25;
    return {
      type: 'comeback' as const,
      title: 'The Comeback',
      description: `Back after ${inactiveDays} days — welcome back!`,
      metric: 'inactive_days',
      currentValue: 1,
      previousValue: inactiveDays,
      rarity,
      xpReward: xp,
    };
  }
  return null;
};

/**
 * Streak Recovery: User broke a streak but started a new one (3+ days).
 */
const detectStreakRecovery: DetectionRule = async ({ userId }) => {
  const result = await query<{ current_streak: string; had_break: string }>(
    `WITH daily AS (
      SELECT scheduled_date,
        CASE WHEN COUNT(*) FILTER (WHERE status = 'completed') > 0 THEN 1 ELSE 0 END as active
      FROM activity_logs
      WHERE user_id = $1 AND scheduled_date >= CURRENT_DATE - 30
      GROUP BY scheduled_date
      ORDER BY scheduled_date DESC
    ),
    streak AS (
      SELECT COUNT(*) as current_streak
      FROM (
        SELECT *, ROW_NUMBER() OVER (ORDER BY scheduled_date DESC) as rn
        FROM daily WHERE active = 1
      ) sub
      WHERE scheduled_date >= CURRENT_DATE - sub.rn
    ),
    breaks AS (
      SELECT COUNT(*) as had_break
      FROM daily
      WHERE active = 0 AND scheduled_date >= CURRENT_DATE - 14
    )
    SELECT s.current_streak, b.had_break
    FROM streak s, breaks b`,
    [userId]
  );

  const row = result.rows[0];
  if (!row) return null;

  const currentStreak = parseInt(row.current_streak || '0');
  const hadBreak = parseInt(row.had_break || '0');

  if (currentStreak >= 3 && hadBreak > 0) {
    return {
      type: 'streak_recovery' as const,
      title: 'Streak Rebuilt',
      description: `New ${currentStreak}-day streak after a break — that's resilience!`,
      metric: 'streak_after_break',
      currentValue: currentStreak,
      previousValue: 0,
      rarity: currentStreak >= 7 ? 'rare' as const : 'common' as const,
      xpReward: currentStreak >= 7 ? 75 : 35,
    };
  }
  return null;
};

/**
 * Consistency Improvement: More active days this week vs last week.
 */
const detectConsistencyUp: DetectionRule = async ({ userId }) => {
  const result = await query<{ this_week: string; last_week: string }>(
    `SELECT
      COUNT(DISTINCT scheduled_date) FILTER (
        WHERE status = 'completed' AND scheduled_date >= CURRENT_DATE - 6
      ) as this_week,
      COUNT(DISTINCT scheduled_date) FILTER (
        WHERE status = 'completed'
          AND scheduled_date >= CURRENT_DATE - 13
          AND scheduled_date < CURRENT_DATE - 6
      ) as last_week
    FROM activity_logs
    WHERE user_id = $1
      AND scheduled_date >= CURRENT_DATE - 13`,
    [userId]
  );

  const row = result.rows[0];
  if (!row) return null;

  const thisWeek = parseInt(row.this_week || '0');
  const lastWeek = parseInt(row.last_week || '0');

  if (thisWeek > lastWeek && thisWeek >= 3 && lastWeek > 0) {
    const improvement = thisWeek - lastWeek;
    return {
      type: 'consistency_up' as const,
      title: 'Consistency Rising',
      description: `${thisWeek} active days this week vs ${lastWeek} last week — ${improvement} more!`,
      metric: 'weekly_active_days',
      currentValue: thisWeek,
      previousValue: lastWeek,
      rarity: improvement >= 3 ? 'rare' as const : 'common' as const,
      xpReward: improvement >= 3 ? 50 : 25,
    };
  }
  return null;
};

/**
 * Volume Increase: More completed activities this week vs last week.
 */
const detectVolumeUp: DetectionRule = async ({ userId }) => {
  const result = await query<{ this_week: string; last_week: string }>(
    `SELECT
      COUNT(*) FILTER (
        WHERE status = 'completed' AND scheduled_date >= CURRENT_DATE - 6
      ) as this_week,
      COUNT(*) FILTER (
        WHERE status = 'completed'
          AND scheduled_date >= CURRENT_DATE - 13
          AND scheduled_date < CURRENT_DATE - 6
      ) as last_week
    FROM activity_logs
    WHERE user_id = $1
      AND scheduled_date >= CURRENT_DATE - 13`,
    [userId]
  );

  const row = result.rows[0];
  if (!row) return null;

  const thisWeek = parseInt(row.this_week || '0');
  const lastWeek = parseInt(row.last_week || '0');

  if (thisWeek > lastWeek && thisWeek >= 4 && lastWeek > 0) {
    return {
      type: 'volume_up' as const,
      title: 'Volume Up',
      description: `${thisWeek} activities this week — up from ${lastWeek} last week!`,
      metric: 'weekly_activities',
      currentValue: thisWeek,
      previousValue: lastWeek,
      rarity: thisWeek >= lastWeek * 2 ? 'rare' as const : 'common' as const,
      xpReward: thisWeek >= lastWeek * 2 ? 50 : 25,
    };
  }
  return null;
};

/**
 * Personal Best: New longest streak achieved.
 */
const detectPersonalBest: DetectionRule = async ({ userId }) => {
  const result = await query<{ current_streak: string; longest_streak: string }>(
    `WITH daily AS (
      SELECT scheduled_date,
        CASE WHEN COUNT(*) FILTER (WHERE status = 'completed') > 0 THEN 1 ELSE 0 END as active
      FROM activity_logs
      WHERE user_id = $1
      GROUP BY scheduled_date
    ),
    streak_groups AS (
      SELECT scheduled_date, active,
        scheduled_date - (ROW_NUMBER() OVER (ORDER BY scheduled_date))::int AS grp
      FROM daily WHERE active = 1
    ),
    streaks AS (
      SELECT grp, COUNT(*) as streak_len, MAX(scheduled_date) as end_date
      FROM streak_groups GROUP BY grp
    )
    SELECT
      (SELECT streak_len FROM streaks WHERE end_date = (SELECT MAX(end_date) FROM streaks)) as current_streak,
      (SELECT MAX(streak_len) FROM streaks) as longest_streak`,
    [userId]
  );

  const row = result.rows[0];
  if (!row) return null;

  const current = parseInt(row.current_streak || '0');
  const longest = parseInt(row.longest_streak || '0');

  // Current streak IS the longest (and meaningful)
  if (current >= 5 && current >= longest) {
    const rarity = current >= 30 ? 'epic' as const : current >= 14 ? 'rare' as const : 'common' as const;
    return {
      type: 'personal_best' as const,
      title: 'New Personal Best!',
      description: `${current}-day streak — your longest ever!`,
      metric: 'longest_streak',
      currentValue: current,
      previousValue: longest > current ? longest : current - 1,
      rarity,
      xpReward: rarity === 'epic' ? 100 : rarity === 'rare' ? 50 : 30,
    };
  }
  return null;
};

/**
 * Pillar Balance: Activity in all 3 pillars this week.
 */
const detectPillarBalance: DetectionRule = async ({ userId }) => {
  const result = await query<{ pillar_count: string }>(
    `SELECT COUNT(DISTINCT up.pillar) as pillar_count
    FROM activity_logs al
    JOIN user_plans up ON up.id = al.plan_id
    WHERE al.user_id = $1
      AND al.status = 'completed'
      AND al.scheduled_date >= CURRENT_DATE - 6
      AND up.pillar IN ('fitness', 'nutrition', 'wellbeing')`,
    [userId]
  );

  const pillarCount = parseInt(result.rows[0]?.pillar_count || '0');

  if (pillarCount >= 3) {
    return {
      type: 'pillar_balance' as const,
      title: 'Balanced Life',
      description: 'Active in all 3 pillars this week — fitness, nutrition & wellbeing!',
      metric: 'pillars_active',
      currentValue: 3,
      previousValue: 0,
      rarity: 'rare' as const,
      xpReward: 60,
    };
  }
  return null;
};

/**
 * Time Improvement: Morning workouts (before 8 AM) 3+ days this week.
 */
const detectTimeImprovement: DetectionRule = async ({ userId }) => {
  const result = await query<{ morning_count: string }>(
    `SELECT COUNT(*) as morning_count
    FROM health_data_records
    WHERE user_id = $1
      AND data_type = 'workouts'
      AND recorded_at >= CURRENT_DATE - 6
      AND EXTRACT(HOUR FROM recorded_at) < 8`,
    [userId]
  );

  const morningCount = parseInt(result.rows[0]?.morning_count || '0');

  if (morningCount >= 3) {
    return {
      type: 'time_improvement' as const,
      title: 'Early Riser',
      description: `${morningCount} morning workouts this week — discipline unlocked!`,
      metric: 'morning_workouts_week',
      currentValue: morningCount,
      previousValue: 0,
      rarity: morningCount >= 5 ? 'rare' as const : 'common' as const,
      xpReward: morningCount >= 5 ? 50 : 30,
    };
  }
  return null;
};

const DETECTION_RULES: DetectionRule[] = [
  detectComeback,
  detectStreakRecovery,
  detectConsistencyUp,
  detectVolumeUp,
  detectPersonalBest,
  detectPillarBalance,
  detectTimeImprovement,
];

// ============================================
// SERVICE
// ============================================

class MicroWinsService {
  /**
   * Run all detection rules for a user. Returns newly detected micro-wins.
   * Deduplicates by (user_id, type, metric, date) constraint.
   */
  async detectMicroWins(userId: string): Promise<MicroWin[]> {
    await ensureTable();
    const detected: MicroWin[] = [];
    const ctx: DetectionContext = { userId };

    for (const rule of DETECTION_RULES) {
      try {
        const win = await rule(ctx);
        if (!win) continue;

        // Insert (skips if duplicate for today)
        const insertResult = await query<{ id: string; detected_at: string }>(
          `INSERT INTO micro_wins (user_id, type, title, description, metric, current_value, previous_value, rarity, xp_reward)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (user_id, type, metric, (detected_at::date)) DO NOTHING
           RETURNING id, detected_at`,
          [userId, win.type, win.title, win.description, win.metric, win.currentValue, win.previousValue, win.rarity, win.xpReward]
        );

        if (insertResult.rows.length > 0) {
          const row = insertResult.rows[0];
          detected.push({
            ...win,
            id: row.id,
            detectedAt: row.detected_at,
          });
          logger.info('[MicroWins] Detected micro-win', {
            userId,
            type: win.type,
            title: win.title,
          });
        }
      } catch (error) {
        logger.error('[MicroWins] Rule detection error', {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return detected;
  }

  /**
   * Get recent micro-wins for a user (not dismissed).
   */
  async getRecentMicroWins(userId: string, limit = 20): Promise<MicroWin[]> {
    await ensureTable();
    try {
      const result = await query<{
        id: string;
        type: MicroWinType;
        title: string;
        description: string;
        metric: string;
        current_value: string;
        previous_value: string;
        rarity: string;
        xp_reward: string;
        detected_at: string;
      }>(
        `SELECT id, type, title, description, metric, current_value, previous_value, rarity, xp_reward, detected_at
         FROM micro_wins
         WHERE user_id = $1 AND dismissed = FALSE
         ORDER BY detected_at DESC
         LIMIT $2`,
        [userId, limit]
      );

      return result.rows.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        description: r.description,
        detectedAt: r.detected_at,
        metric: r.metric,
        currentValue: parseFloat(r.current_value || '0'),
        previousValue: parseFloat(r.previous_value || '0'),
        rarity: r.rarity as MicroWin['rarity'],
        xpReward: parseInt(r.xp_reward || '0'),
      }));
    } catch (error) {
      logger.error('[MicroWins] Error fetching recent', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return [];
    }
  }

  /**
   * Dismiss a micro-win (user doesn't want to see it).
   */
  async dismissMicroWin(userId: string, microWinId: string): Promise<void> {
    await ensureTable();
    await query(
      `UPDATE micro_wins SET dismissed = TRUE WHERE id = $1 AND user_id = $2`,
      [microWinId, userId]
    );
  }
}

export const microWinsService = new MicroWinsService();
export default microWinsService;
