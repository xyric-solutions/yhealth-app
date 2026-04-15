/**
 * User Delta Service
 *
 * Tracks user engagement sessions and computes what changed between visits.
 * When a user opens the app after being away, this service tells the AI Coach
 * exactly what's new: workouts logged, meals tracked, score changes, etc.
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';

// ============================================
// INTERFACES
// ============================================

export interface ContextSnapshot {
  score: number | null;
  workoutCount: number;
  mealCount: number;
  streakDays: number;
  goalProgresses: Record<string, number>; // goalId -> progress %
  habitStreaks: Record<string, number>;   // habitId -> streak days
}

export interface DeltaSummary {
  lastVisit: Date;
  hoursSinceLastVisit: number;
  newWorkouts: { count: number; names: string[] };
  newMeals: number;
  scoreDelta: number | null;
  scoreNow: number | null;
  scoreAtLastVisit: number | null;
  goalsProgressChanges: { title: string; prev: number; now: number }[];
  habitsCompletedSince: number;
  unreadProactiveMessages: number;
  topHighlight: string;
  significance: 'major' | 'moderate' | 'minor';
}

// ============================================
// SERVICE CLASS
// ============================================

class UserDeltaService {
  private tableEnsured = false;

  // ============================================
  // TABLE SETUP
  // ============================================

  private async ensureTable(): Promise<void> {
    if (this.tableEnsured) return;

    try {
      await query(`
        CREATE TABLE IF NOT EXISTS user_engagement_sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          session_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          session_type VARCHAR(30) DEFAULT 'app_open',
          context_snapshot JSONB,
          delta_summary JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await query(`
        CREATE INDEX IF NOT EXISTS idx_engagement_sessions_user
          ON user_engagement_sessions(user_id, session_start DESC)
      `);

      this.tableEnsured = true;
    } catch (error) {
      logger.error('[UserDelta] Error ensuring table exists', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Record a new session start and compute what changed since the last visit.
   * Returns the delta summary (null if this is the user's first session).
   */
  async recordSessionStart(userId: string, sessionType: string = 'app_open'): Promise<DeltaSummary | null> {
    await this.ensureTable();

    try {
      // Get the previous session
      const prevResult = await query<{
        session_start: Date;
        context_snapshot: ContextSnapshot | null;
      }>(
        `SELECT session_start, context_snapshot
         FROM user_engagement_sessions
         WHERE user_id = $1
         ORDER BY session_start DESC
         LIMIT 1`,
        [userId]
      );

      const prevSession = prevResult.rows[0] || null;
      const sinceTimestamp = prevSession?.session_start || null;

      // Build current snapshot
      const currentSnapshot = await this.buildCurrentSnapshot(userId);

      // Compute delta if we have a previous session
      let delta: DeltaSummary | null = null;
      if (sinceTimestamp) {
        const hoursSince = (Date.now() - new Date(sinceTimestamp).getTime()) / (1000 * 60 * 60);

        // Skip delta if user was away less than 2 hours
        if (hoursSince >= 2) {
          delta = await this.computeDelta(
            userId,
            sinceTimestamp,
            prevSession?.context_snapshot || null,
            currentSnapshot
          );
        }
      }

      // Store new session with snapshot
      await query(
        `INSERT INTO user_engagement_sessions (user_id, session_type, context_snapshot, delta_summary)
         VALUES ($1, $2, $3, $4)`,
        [userId, sessionType, JSON.stringify(currentSnapshot), delta ? JSON.stringify(delta) : null]
      );

      return delta;
    } catch (error) {
      logger.error('[UserDelta] Error recording session start', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Get the latest computed delta for a user (without recording a new session).
   * Useful for system prompt injection when delta was already recorded at session start.
   */
  async getLatestDelta(userId: string): Promise<DeltaSummary | null> {
    await this.ensureTable();

    try {
      const result = await query<{ delta_summary: DeltaSummary | null }>(
        `SELECT delta_summary
         FROM user_engagement_sessions
         WHERE user_id = $1 AND delta_summary IS NOT NULL
         ORDER BY session_start DESC
         LIMIT 1`,
        [userId]
      );

      if (result.rows.length === 0) return null;

      const delta = result.rows[0].delta_summary;
      if (!delta) return null;

      // Only return if the delta is still fresh (from within the last 4 hours)
      const lastVisit = new Date(delta.lastVisit);
      const hoursSinceComputed = (Date.now() - lastVisit.getTime()) / (1000 * 60 * 60);
      if (hoursSinceComputed > 24) return null; // stale

      return delta;
    } catch (error) {
      logger.error('[UserDelta] Error getting latest delta', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  // ============================================
  // DELTA COMPUTATION
  // ============================================

  private async computeDelta(
    userId: string,
    sinceTimestamp: Date,
    prevSnapshot: ContextSnapshot | null,
    currentSnapshot: ContextSnapshot
  ): Promise<DeltaSummary> {
    const since = new Date(sinceTimestamp);
    const hoursSince = (Date.now() - since.getTime()) / (1000 * 60 * 60);

    // Run targeted queries in parallel
    const [workouts, meals, habits, proactiveMessages] = await Promise.all([
      // 1. New workouts since last visit
      query<{ workout_name: string }>(
        `SELECT workout_name FROM workout_logs
         WHERE user_id = $1 AND scheduled_date >= $2::date AND status = 'completed'
         ORDER BY scheduled_date DESC LIMIT 10`,
        [userId, since]
      ),

      // 2. New meals since last visit
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM meal_logs
         WHERE user_id = $1 AND eaten_at >= $2`,
        [userId, since]
      ),

      // 3. Habits completed since last visit
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM habit_logs
         WHERE habit_id IN (SELECT id FROM habits WHERE user_id = $1 AND is_active = true)
           AND completed = true
           AND log_date >= $2::date`,
        [userId, since]
      ).catch(() => ({ rows: [{ count: '0' }] })),

      // 4. Proactive messages sent while user was away
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM proactive_messages
         WHERE user_id = $1 AND created_at >= $2`,
        [userId, since]
      ).catch(() => ({ rows: [{ count: '0' }] })),
    ]);

    // Compute goal progress changes from snapshots
    const goalsProgressChanges: DeltaSummary['goalsProgressChanges'] = [];
    if (prevSnapshot?.goalProgresses && currentSnapshot.goalProgresses) {
      // We need goal titles — fetch them
      const goalIds = Object.keys(currentSnapshot.goalProgresses);
      if (goalIds.length > 0) {
        const goalsResult = await query<{ id: string; title: string }>(
          `SELECT id, title FROM user_goals WHERE id = ANY($1::uuid[])`,
          [goalIds]
        ).catch(() => ({ rows: [] as { id: string; title: string }[] }));

        for (const goal of goalsResult.rows) {
          const prev = prevSnapshot.goalProgresses[goal.id] ?? 0;
          const now = currentSnapshot.goalProgresses[goal.id] ?? 0;
          if (now !== prev) {
            goalsProgressChanges.push({ title: goal.title, prev, now });
          }
        }
      }
    }

    // Build workout data
    const newWorkoutNames = workouts.rows.map(r => r.workout_name);
    const newWorkoutCount = newWorkoutNames.length;
    const newMealCount = parseInt(meals.rows[0]?.count || '0', 10);
    const habitsCompleted = parseInt(habits.rows[0]?.count || '0', 10);
    const unreadMessages = parseInt(proactiveMessages.rows[0]?.count || '0', 10);

    // Score delta from snapshots
    const scoreAtLastVisit = prevSnapshot?.score ?? null;
    const scoreNow = currentSnapshot.score;
    const scoreDelta = (scoreNow != null && scoreAtLastVisit != null) ? scoreNow - scoreAtLastVisit : null;

    // Determine top highlight and significance
    const { topHighlight, significance } = this.pickTopHighlight({
      newWorkoutCount,
      newMealCount,
      scoreDelta,
      scoreNow,
      scoreAtLastVisit,
      goalsProgressChanges,
      habitsCompleted,
      hoursSince,
    });

    return {
      lastVisit: since,
      hoursSinceLastVisit: Math.round(hoursSince * 10) / 10,
      newWorkouts: { count: newWorkoutCount, names: newWorkoutNames.slice(0, 5) },
      newMeals: newMealCount,
      scoreDelta,
      scoreNow,
      scoreAtLastVisit,
      goalsProgressChanges,
      habitsCompletedSince: habitsCompleted,
      unreadProactiveMessages: unreadMessages,
      topHighlight,
      significance,
    };
  }

  // ============================================
  // SNAPSHOT BUILDING
  // ============================================

  private async buildCurrentSnapshot(userId: string): Promise<ContextSnapshot> {
    const [scoreResult, workoutCount, mealCount, streakResult, goalsResult, habitsResult] = await Promise.all([
      // Latest daily score
      query<{ total_score: string }>(
        `SELECT total_score FROM daily_user_scores
         WHERE user_id = $1 ORDER BY date DESC LIMIT 1`,
        [userId]
      ).catch(() => ({ rows: [] as { total_score: string }[] })),

      // Total completed workouts (last 30 days for snapshot)
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM workout_logs
         WHERE user_id = $1 AND status = 'completed'
           AND scheduled_date >= CURRENT_DATE - INTERVAL '30 days'`,
        [userId]
      ),

      // Total meals (last 30 days)
      query<{ count: string }>(
        `SELECT COUNT(*) as count FROM meal_logs
         WHERE user_id = $1
           AND eaten_at >= CURRENT_DATE - INTERVAL '30 days'`,
        [userId]
      ),

      // Current streak (stored on users table)
      query<{ current_streak: number }>(
        `SELECT COALESCE(current_streak, 0) as current_streak FROM users WHERE id = $1`,
        [userId]
      ).catch(() => ({ rows: [{ current_streak: 0 }] })),

      // Goal progresses
      query<{ id: string; progress: number }>(
        `SELECT id, COALESCE(progress, 0) as progress FROM user_goals
         WHERE user_id = $1 AND status = 'active'`,
        [userId]
      ).catch(() => ({ rows: [] as { id: string; progress: number }[] })),

      // Habit streaks — count recent consecutive completed days per habit
      query<{ id: string; current_streak: number }>(
        `SELECT h.id,
                COALESCE((
                  SELECT COUNT(*)::int FROM habit_logs hl
                  WHERE hl.habit_id = h.id AND hl.completed = true
                    AND hl.log_date > CURRENT_DATE - INTERVAL '30 days'
                    AND hl.log_date <= CURRENT_DATE
                ), 0) as current_streak
         FROM habits h
         WHERE h.user_id = $1 AND h.is_active = true`,
        [userId]
      ).catch(() => ({ rows: [] as { id: string; current_streak: number }[] })),
    ]);

    const goalProgresses: Record<string, number> = {};
    for (const g of goalsResult.rows) {
      goalProgresses[g.id] = g.progress;
    }

    const habitStreaks: Record<string, number> = {};
    for (const h of habitsResult.rows) {
      habitStreaks[h.id] = h.current_streak;
    }

    return {
      score: scoreResult.rows.length > 0 ? Math.round(parseFloat(scoreResult.rows[0].total_score)) : null,
      workoutCount: parseInt(workoutCount.rows[0]?.count || '0', 10),
      mealCount: parseInt(mealCount.rows[0]?.count || '0', 10),
      streakDays: streakResult.rows[0]?.current_streak || 0,
      goalProgresses,
      habitStreaks,
    };
  }

  // ============================================
  // HIGHLIGHT PICKING
  // ============================================

  private pickTopHighlight(data: {
    newWorkoutCount: number;
    newMealCount: number;
    scoreDelta: number | null;
    scoreNow: number | null;
    scoreAtLastVisit: number | null;
    goalsProgressChanges: DeltaSummary['goalsProgressChanges'];
    habitsCompleted: number;
    hoursSince: number;
  }): { topHighlight: string; significance: 'major' | 'moderate' | 'minor' } {
    const highlights: { text: string; weight: number }[] = [];

    // Score change (highest priority)
    if (data.scoreDelta !== null && data.scoreNow !== null) {
      const abs = Math.abs(data.scoreDelta);
      if (abs >= 15) {
        highlights.push({
          text: data.scoreDelta > 0
            ? `Score jumped ${data.scoreDelta} points to ${data.scoreNow}/100`
            : `Score dropped ${abs} points to ${data.scoreNow}/100`,
          weight: 90 + abs,
        });
      } else if (abs >= 5) {
        highlights.push({
          text: data.scoreDelta > 0
            ? `Score up ${data.scoreDelta} to ${data.scoreNow}/100`
            : `Score down ${abs} to ${data.scoreNow}/100`,
          weight: 70 + abs,
        });
      }
    }

    // Workouts logged
    if (data.newWorkoutCount >= 3) {
      highlights.push({ text: `${data.newWorkoutCount} workouts completed`, weight: 80 });
    } else if (data.newWorkoutCount > 0) {
      highlights.push({ text: `${data.newWorkoutCount} workout${data.newWorkoutCount > 1 ? 's' : ''} completed`, weight: 50 });
    }

    // Goal progress
    for (const goal of data.goalsProgressChanges) {
      const delta = goal.now - goal.prev;
      if (delta >= 10) {
        highlights.push({ text: `"${goal.title}" progress: ${goal.prev}% → ${goal.now}%`, weight: 75 });
      }
    }

    // Inactivity (away for a long time with nothing logged)
    if (data.hoursSince > 48 && data.newWorkoutCount === 0 && data.newMealCount === 0) {
      highlights.push({ text: `Away for ${Math.round(data.hoursSince / 24)} days with no activity logged`, weight: 85 });
    }

    // Habits
    if (data.habitsCompleted >= 5) {
      highlights.push({ text: `${data.habitsCompleted} habits completed`, weight: 55 });
    }

    // Sort by weight and pick the best
    highlights.sort((a, b) => b.weight - a.weight);
    const top = highlights[0];

    if (!top) {
      return { topHighlight: 'No major changes since last visit', significance: 'minor' };
    }

    const significance: 'major' | 'moderate' | 'minor' =
      top.weight >= 80 ? 'major' : top.weight >= 50 ? 'moderate' : 'minor';

    return { topHighlight: top.text, significance };
  }

  // ============================================
  // FORMATTING
  // ============================================

  /**
   * Format delta for greeting context (short, 2-3 bullet points)
   */
  formatDeltaForGreeting(delta: DeltaSummary): string {
    const parts: string[] = [];

    // Time away
    const timeAway = delta.hoursSinceLastVisit >= 24
      ? `${Math.round(delta.hoursSinceLastVisit / 24)} day${Math.round(delta.hoursSinceLastVisit / 24) !== 1 ? 's' : ''}`
      : `${Math.round(delta.hoursSinceLastVisit)} hours`;

    parts.push(`Last seen: ${timeAway} ago`);

    // Top highlight
    parts.push(`Key change: ${delta.topHighlight}`);

    // Score delta
    if (delta.scoreDelta !== null && delta.scoreAtLastVisit !== null && delta.scoreNow !== null) {
      const dir = delta.scoreDelta > 0 ? '+' : '';
      parts.push(`Score: ${delta.scoreAtLastVisit} → ${delta.scoreNow} (${dir}${delta.scoreDelta})`);
    }

    // Activity summary
    const activities: string[] = [];
    if (delta.newWorkouts.count > 0) activities.push(`${delta.newWorkouts.count} workout${delta.newWorkouts.count > 1 ? 's' : ''}`);
    if (delta.newMeals > 0) activities.push(`${delta.newMeals} meal${delta.newMeals > 1 ? 's' : ''}`);
    if (delta.habitsCompletedSince > 0) activities.push(`${delta.habitsCompletedSince} habit${delta.habitsCompletedSince > 1 ? 's' : ''}`);
    if (activities.length > 0) {
      parts.push(`Logged since: ${activities.join(', ')}`);
    }

    return parts.join('\n');
  }

  /**
   * Format delta for system prompt injection (richer, with all details)
   */
  formatDeltaForPrompt(delta: DeltaSummary): string {
    const parts: string[] = [];

    const timeAway = delta.hoursSinceLastVisit >= 24
      ? `${Math.round(delta.hoursSinceLastVisit / 24)} days`
      : `${Math.round(delta.hoursSinceLastVisit)} hours`;

    parts.push(`User was last active ${timeAway} ago. Significance: ${delta.significance}.`);
    parts.push(`Top highlight: ${delta.topHighlight}`);

    // Score
    if (delta.scoreDelta !== null && delta.scoreAtLastVisit !== null && delta.scoreNow !== null) {
      parts.push(`Daily score: ${delta.scoreAtLastVisit} → ${delta.scoreNow} (${delta.scoreDelta > 0 ? '+' : ''}${delta.scoreDelta})`);
    }

    // Workouts
    if (delta.newWorkouts.count > 0) {
      parts.push(`New workouts: ${delta.newWorkouts.count} (${delta.newWorkouts.names.join(', ')})`);
    } else if (delta.hoursSinceLastVisit > 24) {
      parts.push(`No workouts logged since last visit.`);
    }

    // Meals
    if (delta.newMeals > 0) {
      parts.push(`Meals logged: ${delta.newMeals}`);
    } else if (delta.hoursSinceLastVisit > 24) {
      parts.push(`No meals logged since last visit.`);
    }

    // Habits
    if (delta.habitsCompletedSince > 0) {
      parts.push(`Habits completed: ${delta.habitsCompletedSince}`);
    }

    // Goal progress changes
    if (delta.goalsProgressChanges.length > 0) {
      for (const g of delta.goalsProgressChanges) {
        parts.push(`Goal "${g.title}": ${g.prev}% → ${g.now}%`);
      }
    }

    // Unread proactive messages
    if (delta.unreadProactiveMessages > 0) {
      parts.push(`Coach sent ${delta.unreadProactiveMessages} proactive message${delta.unreadProactiveMessages > 1 ? 's' : ''} while user was away.`);
    }

    return parts.join('\n');
  }
}

export const userDeltaService = new UserDeltaService();
