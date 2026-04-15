/**
 * @file Obstacle Service
 *
 * Obstacle Diagnosis feature: when a user repeatedly misses a goal, the coach
 * proactively asks what's blocking them, classifies the obstacle, and proposes
 * a one-tap adjustment.
 *
 * Responsibilities:
 *  - Detect miss-pattern candidates (≥3 misses in last 7 days) across life_goals,
 *    user_goals (health), and daily_intentions, honouring a 14-day per-goal cooldown.
 *  - Create goal_obstacles rows and dispatch the proactive intro message.
 *  - Run the diagnostic LLM turn given a chat transcript; parse the structured
 *    output block and persist the diagnosis.
 *  - Apply an accepted adjustment to the underlying goal.
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import { aiProviderService } from './ai-provider.service.js';
import type {
  GoalObstacle,
  GoalRefType,
  ObstacleCategory,
  ObstacleDiagnosisBlock,
  ObstacleUserResponse,
  SuggestedAdjustment,
} from '../../../shared/types/domain/obstacle.js';

// ============================================
// Constants
// ============================================

const MISS_THRESHOLD = 3;        // misses required to trigger
const MISS_WINDOW_DAYS = 7;       // rolling window
const COOLDOWN_DAYS = 14;         // per-goal cooldown after any obstacle row

const OBSTACLE_CATEGORIES: ObstacleCategory[] = [
  'time', 'location', 'energy', 'motivation',
  'skill', 'social', 'health', 'environment', 'unclear',
];

// ============================================
// Row → domain mapping
// ============================================

interface ObstacleRow {
  id: string;
  user_id: string;
  goal_ref_type: GoalRefType;
  goal_ref_id: string;
  goal_title: string;
  miss_count_last_7d: number;
  category: ObstacleCategory | null;
  ai_notes: string | null;
  suggested_adjustment: SuggestedAdjustment | null;
  user_response: ObstacleUserResponse | null;
  coach_session_id: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToObstacle(r: ObstacleRow): GoalObstacle {
  return {
    id: r.id,
    userId: r.user_id,
    goalRefType: r.goal_ref_type,
    goalRefId: r.goal_ref_id,
    goalTitle: r.goal_title,
    missCountLast7d: r.miss_count_last_7d,
    category: r.category,
    aiNotes: r.ai_notes,
    suggestedAdjustment: r.suggested_adjustment,
    userResponse: r.user_response,
    coachSessionId: r.coach_session_id,
    resolvedAt: r.resolved_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// ============================================
// Detection
// ============================================

export interface DetectionCandidate {
  userId: string;
  goalRefType: GoalRefType;
  goalRefId: string;
  goalTitle: string;
  missCount: number;
}

class ObstacleService {
  /**
   * Find goals that meet the miss pattern for all active users.
   * Filters out any goal that already has an obstacle row within the cooldown window.
   */
  async detectCandidates(): Promise<DetectionCandidate[]> {
    const candidates: DetectionCandidate[] = [];

    // --- Life goals: count days in last 7 where check-in is missing, progress=0,
    //     or mood_about_goal<=2. Active goals with daily_checkin/hybrid tracking.
    const lifeGoalRows = await query<{
      user_id: string;
      goal_id: string;
      title: string;
      miss_count: string;
    }>(
      `
      WITH active_goals AS (
        SELECT id, user_id, title
        FROM life_goals
        WHERE status = 'active'
          AND tracking_method IN ('daily_checkin', 'hybrid')
      ),
      window_days AS (
        SELECT generate_series(
          (CURRENT_DATE - INTERVAL '${MISS_WINDOW_DAYS - 1} days')::date,
          CURRENT_DATE,
          '1 day'::interval
        )::date AS d
      ),
      per_day AS (
        SELECT g.id AS goal_id, g.user_id, g.title, wd.d,
               c.progress_value, c.mood_about_goal
        FROM active_goals g
        CROSS JOIN window_days wd
        LEFT JOIN life_goal_checkins c
          ON c.life_goal_id = g.id AND c.checkin_date = wd.d
      )
      SELECT goal_id, user_id, title,
             SUM(CASE
               WHEN progress_value IS NULL
                 OR progress_value = 0
                 OR (mood_about_goal IS NOT NULL AND mood_about_goal <= 2)
               THEN 1 ELSE 0 END)::int AS miss_count
      FROM per_day
      GROUP BY goal_id, user_id, title
      HAVING SUM(CASE
               WHEN progress_value IS NULL
                 OR progress_value = 0
                 OR (mood_about_goal IS NOT NULL AND mood_about_goal <= 2)
               THEN 1 ELSE 0 END) >= $1
      `,
      [MISS_THRESHOLD]
    );

    for (const r of lifeGoalRows.rows) {
      candidates.push({
        userId: r.user_id,
        goalRefType: 'life_goal',
        goalRefId: r.goal_id,
        goalTitle: r.title,
        missCount: Number(r.miss_count),
      });
    }

    // --- Health goals (user_goals): count days in last 7 where current_value
    //     did not advance. Approximation: count days where updated_at did NOT
    //     hit that day. Uses progress history snapshot via updated_at rounding.
    const healthGoalRows = await query<{
      user_id: string;
      goal_id: string;
      title: string;
      miss_count: string;
    }>(
      `
      WITH active_goals AS (
        SELECT id, user_id, title, updated_at::date AS last_progress_date
        FROM user_goals
        WHERE status = 'active' AND target_value IS NOT NULL
      ),
      window_days AS (
        SELECT generate_series(
          (CURRENT_DATE - INTERVAL '${MISS_WINDOW_DAYS - 1} days')::date,
          CURRENT_DATE,
          '1 day'::interval
        )::date AS d
      )
      SELECT g.id AS goal_id, g.user_id, g.title,
             ($1::int - CASE
               WHEN g.last_progress_date >= CURRENT_DATE - INTERVAL '${MISS_WINDOW_DAYS - 1} days'
               THEN 1 ELSE 0 END)::int AS miss_count
      FROM active_goals g
      WHERE g.last_progress_date < CURRENT_DATE - INTERVAL '${MISS_THRESHOLD - 1} days'
      `,
      [MISS_WINDOW_DAYS]
    );

    for (const r of healthGoalRows.rows) {
      const missCount = Number(r.miss_count);
      if (missCount >= MISS_THRESHOLD) {
        candidates.push({
          userId: r.user_id,
          goalRefType: 'user_goal',
          goalRefId: r.goal_id,
          goalTitle: r.title,
          missCount,
        });
      }
    }

    // --- Daily intentions: count last 7 days where fulfilled = false (explicit miss)
    const intentionRows = await query<{
      user_id: string;
      miss_count: string;
      sample_id: string;
      sample_text: string;
    }>(
      `
      SELECT user_id,
             COUNT(*)::int AS miss_count,
             (ARRAY_AGG(id ORDER BY intention_date DESC))[1] AS sample_id,
             (ARRAY_AGG(intention_text ORDER BY intention_date DESC))[1] AS sample_text
      FROM daily_intentions
      WHERE intention_date >= CURRENT_DATE - INTERVAL '${MISS_WINDOW_DAYS - 1} days'
        AND fulfilled = false
      GROUP BY user_id
      HAVING COUNT(*) >= $1
      `,
      [MISS_THRESHOLD]
    );

    for (const r of intentionRows.rows) {
      candidates.push({
        userId: r.user_id,
        goalRefType: 'daily_intention',
        goalRefId: r.sample_id,
        goalTitle: r.sample_text?.slice(0, 120) || 'Your daily intention',
        missCount: Number(r.miss_count),
      });
    }

    // --- Cooldown filter: drop any candidate with a recent obstacle row
    if (candidates.length === 0) return [];

    const filtered: DetectionCandidate[] = [];
    for (const c of candidates) {
      const recent = await query<{ id: string }>(
        `SELECT id FROM goal_obstacles
         WHERE user_id = $1 AND goal_ref_type = $2 AND goal_ref_id = $3
           AND created_at > NOW() - INTERVAL '${COOLDOWN_DAYS} days'
         LIMIT 1`,
        [c.userId, c.goalRefType, c.goalRefId]
      );
      if (recent.rows.length === 0) {
        filtered.push(c);
      }
    }

    logger.info('[ObstacleService] Detection complete', {
      totalCandidates: candidates.length,
      afterCooldown: filtered.length,
    });

    return filtered;
  }

  // ============================================
  // CRUD
  // ============================================

  async createObstacle(c: DetectionCandidate): Promise<GoalObstacle> {
    const res = await query<ObstacleRow>(
      `INSERT INTO goal_obstacles
        (user_id, goal_ref_type, goal_ref_id, goal_title, miss_count_last_7d)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [c.userId, c.goalRefType, c.goalRefId, c.goalTitle, c.missCount]
    );
    return rowToObstacle(res.rows[0]);
  }

  async getOpenObstaclesForUser(userId: string): Promise<GoalObstacle[]> {
    const res = await query<ObstacleRow>(
      `SELECT * FROM goal_obstacles
       WHERE user_id = $1 AND resolved_at IS NULL
       ORDER BY created_at DESC`,
      [userId]
    );
    return res.rows.map(rowToObstacle);
  }

  async getObstacleById(id: string, userId: string): Promise<GoalObstacle | null> {
    const res = await query<ObstacleRow>(
      `SELECT * FROM goal_obstacles WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return res.rows.length ? rowToObstacle(res.rows[0]) : null;
  }

  async dismiss(id: string, userId: string): Promise<GoalObstacle | null> {
    const res = await query<ObstacleRow>(
      `UPDATE goal_obstacles
       SET user_response = 'no_response',
           resolved_at = NOW(),
           updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND resolved_at IS NULL
       RETURNING *`,
      [id, userId]
    );
    return res.rows.length ? rowToObstacle(res.rows[0]) : null;
  }

  // ============================================
  // Diagnosis (LLM)
  // ============================================

  /**
   * Run a single diagnostic turn given a transcript. Returns the assistant's
   * next message. If the assistant has produced a structured block, the
   * obstacle row is updated and the block is returned alongside the reply.
   */
  async diagnoseTurn(
    obstacleId: string,
    userId: string,
    transcript: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): Promise<{ reply: string; block: ObstacleDiagnosisBlock | null }> {
    const obstacle = await this.getObstacleById(obstacleId, userId);
    if (!obstacle) throw new Error('Obstacle not found');

    const recentContextRes = await query<{
      avg_mood: number | null;
      avg_energy: number | null;
      avg_stress: number | null;
      avg_sleep: number | null;
    }>(
      `SELECT
         AVG(mood_score)::float AS avg_mood,
         AVG(energy_score)::float AS avg_energy,
         AVG(stress_score)::float AS avg_stress,
         AVG(sleep_quality)::float AS avg_sleep
       FROM daily_checkins
       WHERE user_id = $1 AND checkin_date >= CURRENT_DATE - INTERVAL '7 days'`,
      [userId]
    );
    const ctx = recentContextRes.rows[0] || {};

    const systemPrompt = this.buildDiagnosisSystemPrompt(obstacle, ctx);
    const userPrompt = this.renderTranscriptForLLM(transcript);

    const resp = await aiProviderService.generateCompletion({
      systemPrompt,
      userPrompt,
      maxTokens: 500,
      temperature: 0.7,
    });

    const { conversationText, block } = this.extractDiagnosisBlock(resp.content);

    if (block) {
      await query(
        `UPDATE goal_obstacles
         SET category = $1, ai_notes = $2, suggested_adjustment = $3, updated_at = NOW()
         WHERE id = $4 AND user_id = $5`,
        [block.category, block.aiNotes, JSON.stringify(block.suggestedAdjustment), obstacleId, userId]
      );
    }

    return { reply: conversationText, block };
  }

  private buildDiagnosisSystemPrompt(
    obstacle: GoalObstacle,
    recent: { avg_mood?: number | null; avg_energy?: number | null; avg_stress?: number | null; avg_sleep?: number | null }
  ): string {
    const ctxLine = [
      recent.avg_mood != null ? `mood ${recent.avg_mood.toFixed(1)}/10` : null,
      recent.avg_energy != null ? `energy ${recent.avg_energy.toFixed(1)}/10` : null,
      recent.avg_stress != null ? `stress ${recent.avg_stress.toFixed(1)}/10` : null,
      recent.avg_sleep != null ? `sleep ${recent.avg_sleep.toFixed(1)}/10` : null,
    ].filter(Boolean).join(', ');

    return `You are a warm, pragmatic coach helping the user diagnose WHY they keep missing one specific goal.

GOAL: "${obstacle.goalTitle}"
MISS PATTERN: ${obstacle.missCountLast7d} misses in the last 7 days.
RECENT DAILY AVERAGES: ${ctxLine || 'no recent data'}

YOUR JOB:
1. Open with empathy, reference the specific goal and miss pattern.
2. Ask ONE diagnostic question per turn. Cover (in rough order of likelihood): time of day, location/setup, energy/sleep, motivation/"why", skill/knowledge gap, social support, health, environment. Skip categories the user has already ruled out.
3. After at most 5 user replies, commit to a diagnosis. Do NOT keep asking questions indefinitely.
4. When you have enough signal, produce a short, specific adjustment and end your message with the STRUCTURED BLOCK below.

STRUCTURED BLOCK FORMAT (emit verbatim at end of final message, nothing after):
<<<OBSTACLE_DIAGNOSIS
{
  "category": "<one of: ${OBSTACLE_CATEGORIES.join(' | ')}>",
  "aiNotes": "<1-2 sentences summarizing the real blocker>",
  "suggestedAdjustment": {
    "kind": "<reschedule | reduce_frequency | change_location | add_preparation_intention | no_change>",
    "payload": { /* kind-specific fields */ }
  }
}
OBSTACLE_DIAGNOSIS>>>

kind-specific payload shapes:
  reschedule: { "newTime": "HH:MM", "newDayOfWeek": [0..6], "note": "..." }
  reduce_frequency: { "newTargetValue": number, "newTargetUnit": "string", "note": "..." }
  change_location: { "newLocation": "string", "note": "..." }
  add_preparation_intention: { "intentionText": "string", "triggerTime": "HH:MM" }
  no_change: { "reason": "string" }

Before the structured block, write a one-line confirmation ending with: "Want me to apply this?"

Keep every message under 80 words. Be human, not clinical.`;
  }

  private renderTranscriptForLLM(transcript: Array<{ role: string; content: string }>): string {
    if (transcript.length === 0) {
      return '[This is the first turn. Open the conversation per the instructions.]';
    }
    return transcript.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
  }

  private extractDiagnosisBlock(text: string): { conversationText: string; block: ObstacleDiagnosisBlock | null } {
    const match = text.match(/<<<OBSTACLE_DIAGNOSIS\s*([\s\S]*?)\s*OBSTACLE_DIAGNOSIS>>>/);
    if (!match) return { conversationText: text.trim(), block: null };

    const conversationText = text.slice(0, match.index).trim();
    try {
      const parsed = JSON.parse(match[1]) as ObstacleDiagnosisBlock;
      if (!OBSTACLE_CATEGORIES.includes(parsed.category)) {
        logger.warn('[ObstacleService] Invalid category in diagnosis block', { category: parsed.category });
        return { conversationText, block: null };
      }
      if (!parsed.suggestedAdjustment?.kind) {
        return { conversationText, block: null };
      }
      return { conversationText, block: parsed };
    } catch (err) {
      logger.warn('[ObstacleService] Failed to parse diagnosis block', {
        error: err instanceof Error ? err.message : String(err),
      });
      return { conversationText, block: null };
    }
  }

  // ============================================
  // Apply adjustment
  // ============================================

  async applyAdjustment(
    obstacleId: string,
    userId: string,
    response: ObstacleUserResponse,
    overridePayload?: Record<string, unknown>,
  ): Promise<GoalObstacle> {
    const obstacle = await this.getObstacleById(obstacleId, userId);
    if (!obstacle) throw new Error('Obstacle not found');
    if (obstacle.resolvedAt) throw new Error('Obstacle already resolved');

    if (response === 'accepted' && obstacle.suggestedAdjustment) {
      await this.mutateGoal(obstacle, overridePayload);
    }

    const res = await query<ObstacleRow>(
      `UPDATE goal_obstacles
       SET user_response = $1,
           resolved_at = NOW(),
           updated_at = NOW(),
           suggested_adjustment = COALESCE($2, suggested_adjustment)
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
      [
        response,
        overridePayload ? JSON.stringify({ ...obstacle.suggestedAdjustment, payload: { ...obstacle.suggestedAdjustment?.payload, ...overridePayload } }) : null,
        obstacleId,
        userId,
      ]
    );
    return rowToObstacle(res.rows[0]);
  }

  private async mutateGoal(obstacle: GoalObstacle, overridePayload?: Record<string, unknown>): Promise<void> {
    const adj = obstacle.suggestedAdjustment;
    if (!adj) return;
    const payload = { ...adj.payload, ...(overridePayload || {}) } as Record<string, unknown>;

    switch (adj.kind) {
      case 'reduce_frequency': {
        const newTarget = Number(payload.newTargetValue);
        const newUnit = typeof payload.newTargetUnit === 'string' ? payload.newTargetUnit : undefined;
        if (!Number.isFinite(newTarget)) return;
        if (obstacle.goalRefType === 'life_goal') {
          await query(
            `UPDATE life_goals SET target_value = $1, target_unit = COALESCE($2, target_unit), updated_at = NOW()
             WHERE id = $3 AND user_id = $4`,
            [newTarget, newUnit || null, obstacle.goalRefId, obstacle.userId]
          );
        } else if (obstacle.goalRefType === 'user_goal') {
          await query(
            `UPDATE user_goals SET target_value = $1, target_unit = COALESCE($2, target_unit), updated_at = NOW()
             WHERE id = $3 AND user_id = $4`,
            [newTarget, newUnit || null, obstacle.goalRefId, obstacle.userId]
          );
        }
        break;
      }
      case 'reschedule':
      case 'change_location': {
        // These live outside the goal tables (schedule/location are on plans, not goals).
        // We record them as a coaching note on the goal instead of silently failing.
        const note = `Coach-suggested adjustment (${adj.kind}): ${JSON.stringify(payload)}`;
        if (obstacle.goalRefType === 'life_goal') {
          await query(
            `UPDATE life_goals SET description = COALESCE(description, '') || E'\n\n' || $1, updated_at = NOW()
             WHERE id = $2 AND user_id = $3`,
            [note, obstacle.goalRefId, obstacle.userId]
          );
        }
        break;
      }
      case 'add_preparation_intention': {
        const text = typeof payload.intentionText === 'string' ? payload.intentionText : null;
        if (!text) return;
        // Insert as tomorrow's intention if none exists yet.
        await query(
          `INSERT INTO daily_intentions (user_id, intention_date, intention_text)
           VALUES ($1, CURRENT_DATE + INTERVAL '1 day', $2)
           ON CONFLICT (user_id, intention_date) DO NOTHING`,
          [obstacle.userId, text]
        );
        break;
      }
      case 'no_change':
        // Nothing to mutate.
        break;
      default:
        logger.warn('[ObstacleService] Unknown adjustment kind', { kind: (adj as { kind: string }).kind });
    }
  }
}

export const obstacleService = new ObstacleService();
