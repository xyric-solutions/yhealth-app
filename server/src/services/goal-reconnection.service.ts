/**
 * @file Goal Reconnection Service (DKA Prevention)
 *
 * Finds life_goals that have gone silent — no check-in, no journal mention,
 * no manual edit — for 21 / 42 / 70 days, and asks the user whether the
 * goal is still theirs. Each tier fires once per goal. Responses:
 *  - committed  → resets silence via a new life_goal_checkin
 *  - paused     → life_goals.status='paused'
 *  - archived   → life_goals.status='abandoned'
 *  - snoozed    → suppresses future prompts until snoozed_until
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import type {
  GoalReconnection,
  ReconnectionResponse,
  ReconnectionTier,
} from '../../../shared/types/domain/reconnection.js';

// ============================================
// Config
// ============================================

const TIER_DAYS: Record<ReconnectionTier, number> = { 1: 21, 2: 42, 3: 70 };

// ============================================
// Row mapping
// ============================================

interface ReconnectionRow {
  id: string;
  user_id: string;
  life_goal_id: string;
  goal_title: string;
  days_silent: number;
  tier: ReconnectionTier;
  user_response: ReconnectionResponse | null;
  snoozed_until: string | null;
  checkin_note: string | null;
  mood_about_goal: number | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToReconnection(r: ReconnectionRow): GoalReconnection {
  return {
    id: r.id,
    userId: r.user_id,
    lifeGoalId: r.life_goal_id,
    goalTitle: r.goal_title,
    daysSilent: Number(r.days_silent),
    tier: r.tier,
    userResponse: r.user_response,
    snoozedUntil: r.snoozed_until,
    checkinNote: r.checkin_note,
    moodAboutGoal: r.mood_about_goal,
    resolvedAt: r.resolved_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ============================================
// Detection
// ============================================

export interface ReconnectionCandidate {
  userId: string;
  lifeGoalId: string;
  goalTitle: string;
  daysSilent: number;
  tier: ReconnectionTier;
}

class GoalReconnectionService {
  /**
   * Find active life_goals silent for ≥21 days and compute the highest tier
   * each one has crossed. Skips goals that either (a) have an active snooze on
   * any prior row or (b) already have a row at the computed tier.
   *
   * Single SQL — no N+1. Tier math + filters all resolved in one CTE chain.
   */
  async detectCandidates(): Promise<ReconnectionCandidate[]> {
    const rows = await query<{
      user_id: string;
      life_goal_id: string;
      title: string;
      days_silent: string;
      tier: string;
    }>(
      `
      WITH last_engagement AS (
        SELECT
          g.id           AS life_goal_id,
          g.user_id,
          g.title,
          GREATEST(
            g.created_at,
            COALESCE(g.last_mentioned_at, g.created_at),
            COALESCE(g.updated_at, g.created_at),
            COALESCE(
              (SELECT MAX(c.checkin_date)::timestamptz
                 FROM life_goal_checkins c
                 WHERE c.life_goal_id = g.id),
              g.created_at
            )
          ) AS last_active
        FROM life_goals g
        WHERE g.status = 'active'
      ),
      scored AS (
        SELECT
          user_id,
          life_goal_id,
          title,
          EXTRACT(DAY FROM NOW() - last_active)::int AS days_silent,
          CASE
            WHEN EXTRACT(DAY FROM NOW() - last_active) >= $3 THEN 3
            WHEN EXTRACT(DAY FROM NOW() - last_active) >= $2 THEN 2
            WHEN EXTRACT(DAY FROM NOW() - last_active) >= $1 THEN 1
            ELSE 0
          END AS tier
        FROM last_engagement
      )
      SELECT s.user_id, s.life_goal_id, s.title, s.days_silent, s.tier
      FROM scored s
      WHERE s.tier > 0
        -- No active snooze on any prior reconnection for this goal
        AND NOT EXISTS (
          SELECT 1 FROM goal_reconnections snz
          WHERE snz.life_goal_id = s.life_goal_id
            AND snz.snoozed_until IS NOT NULL
            AND snz.snoozed_until >= CURRENT_DATE
        )
        -- A row at this tier doesn't already exist
        AND NOT EXISTS (
          SELECT 1 FROM goal_reconnections t
          WHERE t.life_goal_id = s.life_goal_id
            AND t.tier = s.tier
        )
      `,
      [TIER_DAYS[1], TIER_DAYS[2], TIER_DAYS[3]]
    );

    const candidates: ReconnectionCandidate[] = rows.rows.map((r) => ({
      userId: r.user_id,
      lifeGoalId: r.life_goal_id,
      goalTitle: r.title,
      daysSilent: Number(r.days_silent),
      tier: Number(r.tier) as ReconnectionTier,
    }));

    logger.info('[GoalReconnectionService] Detection complete', {
      candidates: candidates.length,
    });
    return candidates;
  }

  // ============================================
  // CRUD
  // ============================================

  async createReconnection(c: ReconnectionCandidate): Promise<GoalReconnection | null> {
    // ON CONFLICT guards against a race with the unique index (life_goal_id, tier)
    const res = await query<ReconnectionRow>(
      `INSERT INTO goal_reconnections
        (user_id, life_goal_id, goal_title, days_silent, tier)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (life_goal_id, tier) DO NOTHING
       RETURNING *`,
      [c.userId, c.lifeGoalId, c.goalTitle, c.daysSilent, c.tier]
    );
    return res.rows.length ? rowToReconnection(res.rows[0]) : null;
  }

  async getOpenForUser(userId: string): Promise<GoalReconnection[]> {
    const res = await query<ReconnectionRow>(
      `SELECT * FROM goal_reconnections
       WHERE user_id = $1
         AND resolved_at IS NULL
         AND (snoozed_until IS NULL OR snoozed_until < CURRENT_DATE)
       ORDER BY tier DESC, created_at DESC`,
      [userId]
    );
    return res.rows.map(rowToReconnection);
  }

  async getById(id: string, userId: string): Promise<GoalReconnection | null> {
    const res = await query<ReconnectionRow>(
      `SELECT * FROM goal_reconnections WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return res.rows.length ? rowToReconnection(res.rows[0]) : null;
  }

  /** Returns true if the user has any open (unsnoozed, unresolved) reconnection for this goal. */
  async hasOpenReconnection(userId: string, lifeGoalId: string): Promise<boolean> {
    const res = await query<{ id: string }>(
      `SELECT id FROM goal_reconnections
       WHERE user_id = $1 AND life_goal_id = $2
         AND resolved_at IS NULL
         AND (snoozed_until IS NULL OR snoozed_until < CURRENT_DATE)
       LIMIT 1`,
      [userId, lifeGoalId]
    );
    return res.rows.length > 0;
  }

  async dismiss(id: string, userId: string): Promise<GoalReconnection | null> {
    const res = await query<ReconnectionRow>(
      `UPDATE goal_reconnections
       SET user_response = 'no_response',
           resolved_at = NOW(),
           updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND resolved_at IS NULL
       RETURNING *`,
      [id, userId]
    );
    return res.rows.length ? rowToReconnection(res.rows[0]) : null;
  }

  // ============================================
  // Respond
  // ============================================

  async respond(
    id: string,
    userId: string,
    response: ReconnectionResponse,
    opts: { snoozeDays?: number; checkinNote?: string; moodAboutGoal?: number } = {},
  ): Promise<GoalReconnection> {
    const existing = await this.getById(id, userId);
    if (!existing) throw new Error('Reconnection not found');
    if (existing.resolvedAt) throw new Error('Reconnection already resolved');

    switch (response) {
      case 'committed': {
        const mood = opts.moodAboutGoal && opts.moodAboutGoal >= 1 && opts.moodAboutGoal <= 5
          ? opts.moodAboutGoal
          : null;
        const note = typeof opts.checkinNote === 'string' ? opts.checkinNote.slice(0, 2000) : null;

        // Insert a check-in for today (ON CONFLICT because unique per (goal, date))
        await query(
          `INSERT INTO life_goal_checkins (life_goal_id, user_id, checkin_date, note, mood_about_goal)
           VALUES ($1, $2, CURRENT_DATE, $3, $4)
           ON CONFLICT (life_goal_id, checkin_date) DO UPDATE
             SET note = COALESCE(EXCLUDED.note, life_goal_checkins.note),
                 mood_about_goal = COALESCE(EXCLUDED.mood_about_goal, life_goal_checkins.mood_about_goal)`,
          [existing.lifeGoalId, userId, note, mood]
        );

        // Touch the goal so `updated_at` and `last_mentioned_at` reflect engagement
        await query(
          `UPDATE life_goals
             SET last_mentioned_at = NOW(), updated_at = NOW()
           WHERE id = $1 AND user_id = $2`,
          [existing.lifeGoalId, userId]
        );

        const updated = await query<ReconnectionRow>(
          `UPDATE goal_reconnections
             SET user_response = 'committed',
                 checkin_note = $1,
                 mood_about_goal = $2,
                 resolved_at = NOW(),
                 updated_at = NOW()
           WHERE id = $3 AND user_id = $4
           RETURNING *`,
          [note, mood, id, userId]
        );
        return rowToReconnection(updated.rows[0]);
      }

      case 'paused':
      case 'archived': {
        const newStatus = response === 'paused' ? 'paused' : 'abandoned';
        await query(
          `UPDATE life_goals SET status = $1, updated_at = NOW()
           WHERE id = $2 AND user_id = $3`,
          [newStatus, existing.lifeGoalId, userId]
        );
        const updated = await query<ReconnectionRow>(
          `UPDATE goal_reconnections
             SET user_response = $1,
                 resolved_at = NOW(),
                 updated_at = NOW()
           WHERE id = $2 AND user_id = $3
           RETURNING *`,
          [response, id, userId]
        );
        return rowToReconnection(updated.rows[0]);
      }

      case 'snoozed': {
        const days = Number.isFinite(opts.snoozeDays) && opts.snoozeDays! > 0 ? Math.min(opts.snoozeDays!, 60) : 7;
        const updated = await query<ReconnectionRow>(
          `UPDATE goal_reconnections
             SET user_response = 'snoozed',
                 snoozed_until = CURRENT_DATE + ($1::int),
                 updated_at = NOW()
           WHERE id = $2 AND user_id = $3
           RETURNING *`,
          [days, id, userId]
        );
        return rowToReconnection(updated.rows[0]);
      }

      case 'no_response': {
        const updated = await query<ReconnectionRow>(
          `UPDATE goal_reconnections
             SET user_response = 'no_response',
                 resolved_at = NOW(),
                 updated_at = NOW()
           WHERE id = $1 AND user_id = $2
           RETURNING *`,
          [id, userId]
        );
        return rowToReconnection(updated.rows[0]);
      }

      default:
        throw new Error(`Unknown response: ${response as string}`);
    }
  }
}

export const goalReconnectionService = new GoalReconnectionService();
