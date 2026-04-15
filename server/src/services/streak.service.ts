/**
 * @file Streak Service
 * @description Core streak engine — single master streak fed by any qualifying activity.
 * Handles streak state, freeze economy, midnight validation, calendar heatmap,
 * leaderboard, and real-time updates via Socket.IO.
 *
 * Architecture: Event-driven (BullMQ + Redis + Socket.IO).
 * See: docs/superpowers/specs/2026-04-07-streak-system-design.md
 */

import { pool } from '../database/pg.js';
import type { PoolClient } from 'pg';
import { logger } from './logger.service.js';
import { gamificationService } from './gamification.service.js';
import { redisCacheService } from './redis-cache.service.js';
import { socketService } from './socket.service.js';

// ============================================
// TYPES
// ============================================

export interface StreakStatus {
  currentStreak: number;
  longestStreak: number;
  freezesAvailable: number;
  lastActivityDate: string | null;
  streakStartedAt: string | null;
  totalActiveDays: number;
  tier: { name: string; days: number; badgeIcon: string } | null;
  nextTier: { name: string; days: number } | null;
  tierProgress: number;
  atRisk: boolean;
  todayActivities: string[];
  timezone: string;
}

export interface StreakUpdateResult {
  streak: StreakStatus;
  isFirstActivityToday: boolean;
  streakIncremented: boolean;
  milestone: {
    days: number;
    tierName: string;
    xpBonus: number;
    freezesEarned: number;
    titleUnlocked: string | null;
    badgeIcon: string;
  } | null;
  xpEarned: number;
}

export interface CalendarDay {
  date: string;
  status: 'active' | 'frozen' | 'broken' | 'none';
  activities: string[];
  streakDay: number;
  freezeSource?: string;
}

export interface CalendarMonth {
  month: string;
  days: CalendarDay[];
  summary: {
    activeDays: number;
    frozenDays: number;
    brokenDays: number;
    currentStreak: number;
  };
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  currentStreak: number;
  longestStreak: number;
  tier: string | null;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  total: number;
}

export interface CompareResult {
  you: {
    currentStreak: number;
    longestStreak: number;
    totalActiveDays: number;
    tier: string | null;
  };
  friend: {
    currentStreak: number;
    longestStreak: number;
    totalActiveDays: number;
    tier: string | null;
    displayName: string;
  };
  delta: {
    streakDiff: number;
    suggestion: string;
  };
}

export interface StreakStats {
  totalActiveDays: number;
  averageStreak: number;
  bestMonth: { month: string; activeDays: number };
  activityBreakdown: Record<string, number>;
}

// ============================================
// CONSTANTS
// ============================================

const REDIS_STREAK_PREFIX = 'streak:';
const REDIS_STREAK_TTL = 86400; // 24 hours
const FREEZE_XP_COST = 200;
const MAX_FREEZES = 3;

// ============================================
// SERVICE
// ============================================

class StreakService {
  // ------------------------------------------
  // Core Operations
  // ------------------------------------------

  /**
   * Record a qualifying activity and update streak state.
   *
   * Flow:
   * 1. Get/init user streak row (timezone-aware)
   * 2. Calculate user's local date
   * 3. INSERT activity log (UNIQUE constraint catches duplicates)
   * 4. If first activity today → increment/reset streak
   * 5. Check milestone → award XP + freezes
   * 6. Update Redis, sync users table, emit socket events
   */
  async recordActivity(
    userId: string,
    activityType: string,
    sourceId?: string
  ): Promise<StreakUpdateResult> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Get or initialize streak row (with row-level lock)
      let streakRow = await client.query(
        `SELECT * FROM user_streaks WHERE user_id = $1 FOR UPDATE`,
        [userId]
      );

      if (streakRow.rows.length === 0) {
        // Auto-initialize
        await this.initializeUserStreakWithClient(client, userId);
        streakRow = await client.query(
          `SELECT * FROM user_streaks WHERE user_id = $1 FOR UPDATE`,
          [userId]
        );
      }

      const streak = streakRow.rows[0];
      const timezone = streak.timezone || 'UTC';

      // 2. Calculate user's local date
      const todayLocal = new Date().toLocaleDateString('en-CA', { timeZone: timezone });

      // 3. Try INSERT into streak_activity_log (UNIQUE constraint: user + date + type)
      let currentStreakDay = streak.current_streak || 0;
      try {
        await client.query(
          `INSERT INTO streak_activity_log (user_id, activity_date, activity_type, source_id, streak_day)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, todayLocal, activityType, sourceId || null, currentStreakDay]
        );
      } catch (insertError: unknown) {
        // Duplicate activity for this user + date + type — return current state
        if (
          insertError &&
          typeof insertError === 'object' &&
          'code' in insertError &&
          (insertError as { code: string }).code === '23505'
        ) {
          await client.query('COMMIT');
          const status = await this.buildStreakStatus(streak, timezone, userId, client);
          return {
            streak: status,
            isFirstActivityToday: false,
            streakIncremented: false,
            milestone: null,
            xpEarned: 0,
          };
        }
        throw insertError;
      }

      // 4. Check if this is the FIRST activity today
      const countResult = await client.query(
        `SELECT COUNT(*) FROM streak_activity_log WHERE user_id = $1 AND activity_date = $2`,
        [userId, todayLocal]
      );
      const activityCountToday = parseInt(countResult.rows[0].count, 10);
      const isFirstActivityToday = activityCountToday === 1;

      let streakIncremented = false;
      let newCurrentStreak = streak.current_streak || 0;
      let newLongestStreak = streak.longest_streak || 0;
      let newTotalActiveDays = streak.total_active_days || 0;
      let newStreakStartedAt = streak.streak_started_at;
      const lastActivityDate = streak.last_activity_date
        ? new Date(streak.last_activity_date).toLocaleDateString('en-CA', { timeZone: 'UTC' })
        : null;

      if (isFirstActivityToday) {
        // Calculate yesterday's date in user's timezone
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayLocal = yesterdayDate.toLocaleDateString('en-CA', { timeZone: timezone });

        if (lastActivityDate === yesterdayLocal) {
          // Consecutive day — increment streak
          newCurrentStreak += 1;
          streakIncremented = true;
        } else if (lastActivityDate === todayLocal) {
          // Same day — no-op (safety guard, shouldn't happen due to UNIQUE)
        } else {
          // Streak broken or first ever — reset to 1
          newCurrentStreak = 1;
          newStreakStartedAt = todayLocal;
          streakIncremented = true;
        }

        // Update longest if current exceeds it
        if (newCurrentStreak > newLongestStreak) {
          newLongestStreak = newCurrentStreak;
        }

        // Increment total active days
        newTotalActiveDays += 1;

        // Update user_streaks
        await client.query(
          `UPDATE user_streaks
           SET current_streak = $1,
               longest_streak = $2,
               last_activity_date = $3,
               streak_started_at = $4,
               total_active_days = $5,
               updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $6`,
          [newCurrentStreak, newLongestStreak, todayLocal, newStreakStartedAt, newTotalActiveDays, userId]
        );

        // Update the streak_day on the activity log entry we just inserted
        await client.query(
          `UPDATE streak_activity_log
           SET streak_day = $1
           WHERE user_id = $2 AND activity_date = $3 AND activity_type = $4`,
          [newCurrentStreak, userId, todayLocal, activityType]
        );
      }

      // 5. Check for milestone
      let milestone: StreakUpdateResult['milestone'] = null;
      let xpEarned = 0;

      if (streakIncremented) {
        const milestoneResult = await client.query(
          `SELECT * FROM streak_rewards WHERE milestone_days = $1`,
          [newCurrentStreak]
        );

        if (milestoneResult.rows.length > 0) {
          const reward = milestoneResult.rows[0];
          milestone = {
            days: reward.milestone_days,
            tierName: reward.tier_name,
            xpBonus: reward.xp_bonus,
            freezesEarned: reward.freezes_earned,
            titleUnlocked: reward.title_unlocked || null,
            badgeIcon: reward.badge_icon,
          };

          xpEarned = reward.xp_bonus;

          // Award freezes if milestone grants them
          if (reward.freezes_earned > 0) {
            const newFreezes = Math.min(
              (streak.freezes_available || 0) + reward.freezes_earned,
              MAX_FREEZES
            );
            await client.query(
              `UPDATE user_streaks SET freezes_available = $1 WHERE user_id = $2`,
              [newFreezes, userId]
            );
          }
        }
      }

      // 6. Sync denormalized columns on users table
      if (isFirstActivityToday) {
        await client.query(
          `UPDATE users
           SET current_streak = $1,
               longest_streak = $2,
               last_activity_date = $3,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $4`,
          [newCurrentStreak, newLongestStreak, todayLocal, userId]
        );
      }

      await client.query('COMMIT');

      // Award XP outside of transaction (gamificationService has its own transaction)
      if (xpEarned > 0 && milestone) {
        try {
          await gamificationService.awardXP(
            userId,
            'streak_bonus',
            xpEarned,
            undefined,
            `${newCurrentStreak}-day streak milestone: ${milestone.tierName}!`
          );
        } catch (xpError) {
          logger.error('[Streak] Failed to award milestone XP', {
            userId,
            milestone: milestone.days,
            error: xpError instanceof Error ? xpError.message : String(xpError),
          });
        }
      }

      // Build updated status for response and cache
      const updatedStreakRow = {
        ...streak,
        current_streak: newCurrentStreak,
        longest_streak: newLongestStreak,
        last_activity_date: todayLocal,
        streak_started_at: newStreakStartedAt,
        total_active_days: newTotalActiveDays,
      };
      const status = await this.buildStreakStatus(updatedStreakRow, timezone, userId);

      // Update Redis cache
      await redisCacheService.set(
        REDIS_STREAK_PREFIX + userId,
        status,
        REDIS_STREAK_TTL
      );

      // Emit Socket.IO events
      socketService.emitToUser(userId, 'streak:updated', {
        currentStreak: status.currentStreak,
        longestStreak: status.longestStreak,
        freezesAvailable: status.freezesAvailable,
        isNewRecord: newCurrentStreak === newLongestStreak && streakIncremented,
        xpEarned,
        milestone,
        todayActivities: status.todayActivities,
      });

      if (milestone) {
        socketService.emitToUser(userId, 'streak:milestone', milestone);
      }

      return {
        streak: status,
        isFirstActivityToday,
        streakIncremented,
        milestone,
        xpEarned,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('[Streak] Failed to record activity', {
        userId,
        activityType,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get current streak status for a user.
   * Redis-first with DB fallback. Auto-initializes if no row exists.
   */
  async getStreakStatus(userId: string): Promise<StreakStatus> {
    // Try Redis first
    const cached = await redisCacheService.get<StreakStatus>(REDIS_STREAK_PREFIX + userId);
    if (cached) {
      // Recompute atRisk since it depends on current time
      cached.atRisk = this.computeAtRisk(cached);
      return cached;
    }

    // Fallback: query DB
    const result = await pool.query(
      `SELECT * FROM user_streaks WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // Auto-init
      await this.initializeUserStreak(userId);
      const initResult = await pool.query(
        `SELECT * FROM user_streaks WHERE user_id = $1`,
        [userId]
      );
      const row = initResult.rows[0];
      const status = await this.buildStreakStatus(row, row.timezone, userId);
      await redisCacheService.set(REDIS_STREAK_PREFIX + userId, status, REDIS_STREAK_TTL);
      return status;
    }

    const row = result.rows[0];
    const status = await this.buildStreakStatus(row, row.timezone, userId);

    // Cache result
    await redisCacheService.set(REDIS_STREAK_PREFIX + userId, status, REDIS_STREAK_TTL);

    return status;
  }

  // ------------------------------------------
  // Freeze Operations
  // ------------------------------------------

  /**
   * Purchase a streak freeze using XP.
   * Cost: 200 XP. Max 3 freezes stored.
   */
  async purchaseFreeze(
    userId: string
  ): Promise<{ success: boolean; freezesAvailable: number; xpDeducted: number }> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get current user XP and freezes
      const userResult = await client.query(
        `SELECT total_xp FROM users WHERE id = $1 FOR UPDATE`,
        [userId]
      );
      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const totalXp = userResult.rows[0].total_xp || 0;
      if (totalXp < FREEZE_XP_COST) {
        await client.query('ROLLBACK');
        return { success: false, freezesAvailable: 0, xpDeducted: 0 };
      }

      const streakResult = await client.query(
        `SELECT freezes_available FROM user_streaks WHERE user_id = $1 FOR UPDATE`,
        [userId]
      );
      if (streakResult.rows.length === 0) {
        await this.initializeUserStreakWithClient(client, userId);
      }
      const freezesAvailable = streakResult.rows[0]?.freezes_available ?? 0;

      if (freezesAvailable >= MAX_FREEZES) {
        await client.query('ROLLBACK');
        return { success: false, freezesAvailable, xpDeducted: 0 };
      }

      // Deduct XP
      const newTotalXp = totalXp - FREEZE_XP_COST;
      const newLevel = gamificationService.calculateLevel(newTotalXp);
      await client.query(
        `UPDATE users SET total_xp = $1, current_level = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
        [newTotalXp, newLevel, userId]
      );

      // Increment freezes
      const newFreezes = freezesAvailable + 1;
      await client.query(
        `UPDATE user_streaks SET freezes_available = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
        [newFreezes, userId]
      );

      // Log freeze acquisition
      const todayLocal = new Date().toISOString().split('T')[0];
      await client.query(
        `INSERT INTO streak_freeze_log (user_id, freeze_date, source, xp_cost)
         VALUES ($1, $2, 'xp_purchase', $3)`,
        [userId, todayLocal, FREEZE_XP_COST]
      );

      // Log negative XP transaction
      await client.query(
        `INSERT INTO user_xp_transactions (
          user_id, xp_amount, source_type, description, total_after, level_after, streak_day, multiplier, base_xp
        ) VALUES ($1, $2, 'streak_bonus', $3, $4, $5, 0, 1.0, $6)`,
        [userId, -FREEZE_XP_COST, 'Streak freeze purchased', newTotalXp, newLevel, FREEZE_XP_COST]
      );

      await client.query('COMMIT');

      // Update Redis cache
      await redisCacheService.delete(REDIS_STREAK_PREFIX + userId);

      // Emit socket event
      socketService.emitToUser(userId, 'streak:updated', {
        freezesAvailable: newFreezes,
        xpDeducted: FREEZE_XP_COST,
        event: 'freeze_purchased',
      });

      return { success: true, freezesAvailable: newFreezes, xpDeducted: FREEZE_XP_COST };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('[Streak] Failed to purchase freeze', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Apply a streak freeze to restore a broken streak.
   * Default date: yesterday (user's local date).
   */
  async applyFreeze(
    userId: string,
    date?: string
  ): Promise<{ success: boolean; freezesRemaining: number }> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get streak row with lock
      const streakResult = await client.query(
        `SELECT * FROM user_streaks WHERE user_id = $1 FOR UPDATE`,
        [userId]
      );
      if (streakResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, freezesRemaining: 0 };
      }

      const streak = streakResult.rows[0];
      const timezone = streak.timezone || 'UTC';

      // Default freeze date = yesterday in user's timezone
      let freezeDate = date;
      if (!freezeDate) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        freezeDate = yesterday.toLocaleDateString('en-CA', { timeZone: timezone });
      }

      // Validate: user has freezes
      if ((streak.freezes_available || 0) <= 0) {
        await client.query('ROLLBACK');
        return { success: false, freezesRemaining: 0 };
      }

      // Validate: streak was actually broken (last_activity_date < freeze_date)
      const lastActivity = streak.last_activity_date
        ? new Date(streak.last_activity_date).toLocaleDateString('en-CA', { timeZone: 'UTC' })
        : null;

      if (lastActivity && lastActivity >= freezeDate) {
        // Streak wasn't broken on this date
        await client.query('ROLLBACK');
        return { success: false, freezesRemaining: streak.freezes_available };
      }

      // Check for duplicate freeze on same date
      const existingFreeze = await client.query(
        `SELECT id FROM streak_freeze_log WHERE user_id = $1 AND freeze_date = $2`,
        [userId, freezeDate]
      );
      if (existingFreeze.rows.length > 0) {
        await client.query('ROLLBACK');
        return { success: false, freezesRemaining: streak.freezes_available };
      }

      // Restore streak: the streak continues as if activity happened on freeze date
      // If current_streak was reset to 0, restore the previous streak value + 1
      // We calculate the pre-break streak from the activity log
      let restoredStreak = streak.current_streak || 0;
      if (restoredStreak === 0 && lastActivity) {
        // Find what the streak was before it broke
        const lastStreakResult = await client.query(
          `SELECT streak_day FROM streak_activity_log
           WHERE user_id = $1 AND activity_date = $2
           ORDER BY created_at DESC LIMIT 1`,
          [userId, lastActivity]
        );
        restoredStreak = lastStreakResult.rows[0]?.streak_day || 0;
      }
      // Add 1 for the frozen day
      restoredStreak += 1;

      const newFreezes = (streak.freezes_available || 0) - 1;
      const newFreezesUsed = (streak.freezes_used_total || 0) + 1;
      const newLongest = Math.max(streak.longest_streak || 0, restoredStreak);

      // Update streak state
      await client.query(
        `UPDATE user_streaks
         SET current_streak = $1,
             longest_streak = $2,
             last_activity_date = $3,
             freezes_available = $4,
             freezes_used_total = $5,
             last_freeze_date = $6,
             updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $7`,
        [restoredStreak, newLongest, freezeDate, newFreezes, newFreezesUsed, freezeDate, userId]
      );

      // Log freeze usage
      await client.query(
        `INSERT INTO streak_freeze_log (user_id, freeze_date, source, xp_cost)
         VALUES ($1, $2, 'manual', 0)`,
        [userId, freezeDate]
      );

      // Sync users table
      await client.query(
        `UPDATE users
         SET current_streak = $1,
             longest_streak = $2,
             last_activity_date = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [restoredStreak, newLongest, freezeDate, userId]
      );

      await client.query('COMMIT');

      // Update Redis cache
      await redisCacheService.delete(REDIS_STREAK_PREFIX + userId);

      // Emit socket event
      socketService.emitToUser(userId, 'streak:freeze_applied', {
        freezesRemaining: newFreezes,
        date: freezeDate,
        source: 'manual',
      });

      return { success: true, freezesRemaining: newFreezes };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('[Streak] Failed to apply freeze', {
        userId,
        date,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      client.release();
    }
  }

  // ------------------------------------------
  // Cron Operations
  // ------------------------------------------

  /**
   * Midnight validation for a specific timezone bucket.
   * Called hourly by streak-validation.job.ts.
   *
   * Finds users with active streaks whose last activity was before yesterday
   * in their local timezone. Auto-applies freezes or breaks streaks.
   */
  async runMidnightValidation(
    timezone: string
  ): Promise<{ usersProcessed: number; streaksBroken: number; freezesApplied: number }> {
    let usersProcessed = 0;
    let streaksBroken = 0;
    let freezesApplied = 0;

    try {
      // Find users in this timezone with active streaks whose last activity
      // was before yesterday in their local time
      const result = await pool.query(
        `SELECT * FROM user_streaks
         WHERE timezone = $1
           AND current_streak > 0
           AND last_activity_date < (CURRENT_DATE AT TIME ZONE $1 - INTERVAL '1 day')::DATE`,
        [timezone]
      );

      usersProcessed = result.rows.length;

      for (const row of result.rows) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          // Re-fetch with lock to prevent race conditions
          const lockedRow = await client.query(
            `SELECT * FROM user_streaks WHERE id = $1 FOR UPDATE`,
            [row.id]
          );
          const streak = lockedRow.rows[0];
          if (!streak || streak.current_streak === 0) {
            await client.query('COMMIT');
            continue;
          }

          // Calculate yesterday in user's timezone
          const yesterdayDate = new Date();
          yesterdayDate.setDate(yesterdayDate.getDate() - 1);
          const yesterdayLocal = yesterdayDate.toLocaleDateString('en-CA', { timeZone: timezone });

          if (streak.freezes_available > 0) {
            // Auto-apply freeze
            const newFreezes = streak.freezes_available - 1;
            const newFreezesUsed = (streak.freezes_used_total || 0) + 1;
            const newStreak = (streak.current_streak || 0) + 1;
            const newLongest = Math.max(streak.longest_streak || 0, newStreak);

            await client.query(
              `UPDATE user_streaks
               SET current_streak = $1,
                   longest_streak = $2,
                   last_activity_date = $3,
                   freezes_available = $4,
                   freezes_used_total = $5,
                   last_freeze_date = $6,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = $7`,
              [newStreak, newLongest, yesterdayLocal, newFreezes, newFreezesUsed, yesterdayLocal, streak.id]
            );

            // Log freeze
            await client.query(
              `INSERT INTO streak_freeze_log (user_id, freeze_date, source, xp_cost)
               VALUES ($1, $2, 'auto_applied', 0)
               ON CONFLICT (user_id, freeze_date) DO NOTHING`,
              [streak.user_id, yesterdayLocal]
            );

            // Sync users table
            await client.query(
              `UPDATE users
               SET current_streak = $1,
                   longest_streak = $2,
                   last_activity_date = $3,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = $4`,
              [newStreak, newLongest, yesterdayLocal, streak.user_id]
            );

            await client.query('COMMIT');

            freezesApplied += 1;

            // Emit socket event
            socketService.emitToUser(streak.user_id, 'streak:freeze_applied', {
              freezesRemaining: newFreezes,
              date: yesterdayLocal,
              source: 'auto_applied',
            });
          } else {
            // Break streak
            const previousStreak = streak.current_streak;

            await client.query(
              `UPDATE user_streaks
               SET current_streak = 0,
                   streak_started_at = NULL,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = $1`,
              [streak.id]
            );

            // Sync users table
            await client.query(
              `UPDATE users
               SET current_streak = 0,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = $1`,
              [streak.user_id]
            );

            await client.query('COMMIT');

            streaksBroken += 1;

            // Emit socket event
            socketService.emitToUser(streak.user_id, 'streak:broken', {
              previousStreak,
              longestStreak: streak.longest_streak,
            });
          }

          // Update Redis cache
          await redisCacheService.delete(REDIS_STREAK_PREFIX + streak.user_id);
        } catch (rowError) {
          await client.query('ROLLBACK');
          logger.error('[Streak] Midnight validation failed for user', {
            userId: row.user_id,
            timezone,
            error: rowError instanceof Error ? rowError.message : String(rowError),
          });
        } finally {
          client.release();
        }
      }

      logger.info('[Streak] Midnight validation completed', {
        timezone,
        usersProcessed,
        streaksBroken,
        freezesApplied,
      });
    } catch (error) {
      logger.error('[Streak] Midnight validation query failed', {
        timezone,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return { usersProcessed, streaksBroken, freezesApplied };
  }

  // ------------------------------------------
  // Initialization
  // ------------------------------------------

  /**
   * Initialize a user_streaks row for a user.
   * ON CONFLICT DO NOTHING makes this idempotent.
   * Backfills from users table if existing streak data exists.
   */
  async initializeUserStreak(userId: string, timezone?: string): Promise<void> {
    const tz = timezone || 'UTC';

    await pool.query(
      `INSERT INTO user_streaks (user_id, timezone)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, tz]
    );

    // Backfill from users table if existing streak data exists
    const userResult = await pool.query(
      `SELECT current_streak, longest_streak, last_activity_date FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      if ((user.current_streak || 0) > 0) {
        await pool.query(
          `UPDATE user_streaks
           SET current_streak = GREATEST(current_streak, $1),
               longest_streak = GREATEST(longest_streak, $2),
               last_activity_date = COALESCE(last_activity_date, $3)
           WHERE user_id = $4`,
          [user.current_streak, user.longest_streak, user.last_activity_date, userId]
        );
      }
    }
  }

  /**
   * Initialize user streak within an existing transaction (uses client, not pool).
   */
  private async initializeUserStreakWithClient(
    client: PoolClient,
    userId: string,
    timezone?: string
  ): Promise<void> {
    const tz = timezone || 'UTC';

    await client.query(
      `INSERT INTO user_streaks (user_id, timezone)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, tz]
    );

    // Backfill from users table
    const userResult = await client.query(
      `SELECT current_streak, longest_streak, last_activity_date FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      if ((user.current_streak || 0) > 0) {
        await client.query(
          `UPDATE user_streaks
           SET current_streak = GREATEST(current_streak, $1),
               longest_streak = GREATEST(longest_streak, $2),
               last_activity_date = COALESCE(last_activity_date, $3)
           WHERE user_id = $4`,
          [user.current_streak, user.longest_streak, user.last_activity_date, userId]
        );
      }
    }
  }

  // ------------------------------------------
  // Query Operations
  // ------------------------------------------

  /**
   * Get calendar heatmap for a given month.
   * Returns day-by-day array with status: active, frozen, broken, or none.
   */
  async getCalendar(userId: string, month: string): Promise<CalendarMonth> {
    // Parse YYYY-MM
    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);

    // Compute start and end dates for the month
    const startDate = `${month}-01`;
    const endDate = new Date(year, monthNum, 0).toLocaleDateString('en-CA'); // last day of month

    // Query activities for the month
    const activitiesResult = await pool.query(
      `SELECT activity_date, activity_type, streak_day
       FROM streak_activity_log
       WHERE user_id = $1 AND activity_date >= $2 AND activity_date <= $3
       ORDER BY activity_date, created_at`,
      [userId, startDate, endDate]
    );

    // Query freezes for the month
    const freezesResult = await pool.query(
      `SELECT freeze_date, source
       FROM streak_freeze_log
       WHERE user_id = $1 AND freeze_date >= $2 AND freeze_date <= $3
       ORDER BY freeze_date`,
      [userId, startDate, endDate]
    );

    // Build lookup maps
    const activityMap = new Map<string, { activities: string[]; streakDay: number }>();
    for (const row of activitiesResult.rows) {
      const dateStr = new Date(row.activity_date).toLocaleDateString('en-CA');
      const existing = activityMap.get(dateStr);
      if (existing) {
        existing.activities.push(row.activity_type);
        existing.streakDay = Math.max(existing.streakDay, row.streak_day);
      } else {
        activityMap.set(dateStr, {
          activities: [row.activity_type],
          streakDay: row.streak_day,
        });
      }
    }

    const freezeMap = new Map<string, string>();
    for (const row of freezesResult.rows) {
      const dateStr = new Date(row.freeze_date).toLocaleDateString('en-CA');
      freezeMap.set(dateStr, row.source);
    }

    // Build day-by-day array
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const days: CalendarDay[] = [];
    let activeDays = 0;
    let frozenDays = 0;
    let brokenDays = 0;
    const today = new Date().toLocaleDateString('en-CA');

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${month}-${String(d).padStart(2, '0')}`;
      const activity = activityMap.get(dateStr);
      const freeze = freezeMap.get(dateStr);

      let status: CalendarDay['status'] = 'none';
      if (activity) {
        status = 'active';
        activeDays += 1;
      } else if (freeze) {
        status = 'frozen';
        frozenDays += 1;
      } else if (dateStr < today) {
        // Past day with no activity and no freeze — potentially broken
        // Only mark as broken if user had an active streak around this date
        // For simplicity, leave as 'none' unless we have evidence of a break
        status = 'none';
      }

      days.push({
        date: dateStr,
        status,
        activities: activity?.activities || [],
        streakDay: activity?.streakDay || 0,
        freezeSource: freeze || undefined,
      });
    }

    // Get current streak for summary
    const streakResult = await pool.query(
      `SELECT current_streak FROM user_streaks WHERE user_id = $1`,
      [userId]
    );
    const currentStreak = streakResult.rows[0]?.current_streak || 0;

    return {
      month,
      days,
      summary: {
        activeDays,
        frozenDays,
        brokenDays,
        currentStreak,
      },
    };
  }

  /**
   * Get streak leaderboard — top users by current_streak.
   */
  async getStreakLeaderboard(
    limit: number = 20,
    offset: number = 0,
    _segment?: string
  ): Promise<LeaderboardResponse> {
    // Count total
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM user_streaks WHERE current_streak > 0`
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Query leaderboard with user info
    const result = await pool.query(
      `SELECT
         us.user_id,
         us.current_streak,
         us.longest_streak,
         u.name,
         u.email,
         u.avatar_url,
         ROW_NUMBER() OVER (ORDER BY us.current_streak DESC, us.longest_streak DESC) as rank
       FROM user_streaks us
       JOIN users u ON u.id = us.user_id
       WHERE us.current_streak > 0
       ORDER BY us.current_streak DESC, us.longest_streak DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const entries: LeaderboardEntry[] = result.rows.map((row) => ({
      rank: parseInt(row.rank, 10) + offset, // Adjust rank for offset
      userId: row.user_id,
      displayName: row.name || row.email?.split('@')[0] || 'Anonymous',
      avatarUrl: row.avatar_url || null,
      currentStreak: row.current_streak,
      longestStreak: row.longest_streak,
      tier: this.getTierName(row.current_streak),
    }));

    return { entries, total };
  }

  /**
   * Get leaderboard entries around the user's position (+-10 ranks).
   */
  async getAroundMe(userId: string): Promise<LeaderboardEntry[]> {
    // Get user's rank
    const rankResult = await pool.query(
      `SELECT rank FROM (
         SELECT user_id, ROW_NUMBER() OVER (ORDER BY current_streak DESC, longest_streak DESC) as rank
         FROM user_streaks
         WHERE current_streak > 0
       ) ranked
       WHERE user_id = $1`,
      [userId]
    );

    if (rankResult.rows.length === 0) {
      return [];
    }

    const userRank = parseInt(rankResult.rows[0].rank, 10);
    const startRank = Math.max(1, userRank - 10);
    const offset = startRank - 1;
    const limit = 21; // 10 above + user + 10 below

    const result = await pool.query(
      `SELECT
         us.user_id,
         us.current_streak,
         us.longest_streak,
         u.name,
         u.email,
         u.avatar_url,
         ROW_NUMBER() OVER (ORDER BY us.current_streak DESC, us.longest_streak DESC) as rank
       FROM user_streaks us
       JOIN users u ON u.id = us.user_id
       WHERE us.current_streak > 0
       ORDER BY us.current_streak DESC, us.longest_streak DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return result.rows.map((row) => ({
      rank: parseInt(row.rank, 10) + offset,
      userId: row.user_id,
      displayName: row.name || row.email?.split('@')[0] || 'Anonymous',
      avatarUrl: row.avatar_url || null,
      currentStreak: row.current_streak,
      longestStreak: row.longest_streak,
      tier: this.getTierName(row.current_streak),
    }));
  }

  /**
   * Compare streak stats with a friend.
   */
  async compareWithFriend(userId: string, friendId: string): Promise<CompareResult> {
    const result = await pool.query(
      `SELECT
         us.user_id,
         us.current_streak,
         us.longest_streak,
         us.total_active_days,
         u.name,
         u.email
       FROM user_streaks us
       JOIN users u ON u.id = us.user_id
       WHERE us.user_id IN ($1, $2)`,
      [userId, friendId]
    );

    const userRow = result.rows.find((r) => r.user_id === userId);
    const friendRow = result.rows.find((r) => r.user_id === friendId);

    const you = {
      currentStreak: userRow?.current_streak || 0,
      longestStreak: userRow?.longest_streak || 0,
      totalActiveDays: userRow?.total_active_days || 0,
      tier: this.getTierName(userRow?.current_streak || 0),
    };

    const friend = {
      currentStreak: friendRow?.current_streak || 0,
      longestStreak: friendRow?.longest_streak || 0,
      totalActiveDays: friendRow?.total_active_days || 0,
      tier: this.getTierName(friendRow?.current_streak || 0),
      displayName: friendRow?.name || friendRow?.email?.split('@')[0] || 'Friend',
    };

    const streakDiff = you.currentStreak - friend.currentStreak;
    let suggestion = '';
    if (streakDiff > 0) {
      suggestion = `You're ahead by ${streakDiff} days! Keep it up.`;
    } else if (streakDiff < 0) {
      suggestion = `Your friend is ahead by ${Math.abs(streakDiff)} days. Time to catch up!`;
    } else {
      suggestion = `You're neck and neck! Stay consistent to pull ahead.`;
    }

    return { you, friend, delta: { streakDiff, suggestion } };
  }

  /**
   * Get aggregate streak statistics for a user.
   */
  async getStats(userId: string): Promise<StreakStats> {
    // Total active days from user_streaks
    const streakResult = await pool.query(
      `SELECT total_active_days FROM user_streaks WHERE user_id = $1`,
      [userId]
    );
    const totalActiveDays = streakResult.rows[0]?.total_active_days || 0;

    // Activity breakdown
    const breakdownResult = await pool.query(
      `SELECT activity_type, COUNT(*) as count
       FROM streak_activity_log
       WHERE user_id = $1
       GROUP BY activity_type
       ORDER BY count DESC`,
      [userId]
    );
    const activityBreakdown: Record<string, number> = {};
    for (const row of breakdownResult.rows) {
      activityBreakdown[row.activity_type] = parseInt(row.count, 10);
    }

    // Best month
    const bestMonthResult = await pool.query(
      `SELECT TO_CHAR(activity_date, 'YYYY-MM') as month, COUNT(DISTINCT activity_date) as active_days
       FROM streak_activity_log
       WHERE user_id = $1
       GROUP BY TO_CHAR(activity_date, 'YYYY-MM')
       ORDER BY active_days DESC
       LIMIT 1`,
      [userId]
    );
    const bestMonth = bestMonthResult.rows[0]
      ? { month: bestMonthResult.rows[0].month, activeDays: parseInt(bestMonthResult.rows[0].active_days, 10) }
      : { month: '', activeDays: 0 };

    // Average streak: total_active_days / number of distinct streak periods
    // Approximate by counting how many times streak was reset (streak_day = 1 occurrences)
    const resetCountResult = await pool.query(
      `SELECT COUNT(DISTINCT activity_date) as resets
       FROM streak_activity_log
       WHERE user_id = $1 AND streak_day = 1`,
      [userId]
    );
    const streakPeriods = Math.max(parseInt(resetCountResult.rows[0]?.resets || '1', 10), 1);
    const averageStreak = Math.round(totalActiveDays / streakPeriods);

    return {
      totalActiveDays,
      averageStreak,
      bestMonth,
      activityBreakdown,
    };
  }

  // ------------------------------------------
  // Private Helpers
  // ------------------------------------------

  /**
   * Build a StreakStatus object from a user_streaks DB row.
   * Computes tier, next tier, progress, atRisk, and today's activities.
   */
  private async buildStreakStatus(
    row: Record<string, unknown>,
    timezone: string,
    userId: string,
    client?: PoolClient
  ): Promise<StreakStatus> {
    const currentStreak = (row.current_streak as number) || 0;
    const longestStreak = (row.longest_streak as number) || 0;
    const freezesAvailable = (row.freezes_available as number) || 0;
    const totalActiveDays = (row.total_active_days as number) || 0;

    const lastActivityDate = row.last_activity_date
      ? new Date(row.last_activity_date as string).toLocaleDateString('en-CA')
      : null;
    const streakStartedAt = row.streak_started_at
      ? new Date(row.streak_started_at as string).toLocaleDateString('en-CA')
      : null;

    // Compute tier and next tier
    const { tier, nextTier, tierProgress } = await this.computeTierInfo(currentStreak, client);

    // Compute today's activities
    const todayLocal = new Date().toLocaleDateString('en-CA', { timeZone: timezone });
    const queryRunner = client || pool;
    const todayResult = await queryRunner.query(
      `SELECT DISTINCT activity_type FROM streak_activity_log WHERE user_id = $1 AND activity_date = $2`,
      [userId, todayLocal]
    );
    const todayActivities = todayResult.rows.map((r) => r.activity_type as string);

    // Compute atRisk
    const hasActivityToday = todayActivities.length > 0;
    const nowInTimezone = new Date().toLocaleString('en-US', { timeZone: timezone, hour12: false });
    const currentHour = parseInt(nowInTimezone.split(' ')[1]?.split(':')[0] || '0', 10);
    const atRisk = !hasActivityToday && currentHour >= 18 && currentStreak > 0;

    return {
      currentStreak,
      longestStreak,
      freezesAvailable,
      lastActivityDate,
      streakStartedAt,
      totalActiveDays,
      tier,
      nextTier,
      tierProgress,
      atRisk,
      todayActivities,
      timezone,
    };
  }

  /**
   * Compute tier information based on current streak days.
   * Queries streak_rewards table for tier boundaries.
   */
  private async computeTierInfo(
    currentStreak: number,
    client?: PoolClient
  ): Promise<{
    tier: StreakStatus['tier'];
    nextTier: StreakStatus['nextTier'];
    tierProgress: number;
  }> {
    const queryRunner = client || pool;

    const tiersResult = await queryRunner.query(
      `SELECT milestone_days, tier_name, badge_icon
       FROM streak_rewards
       ORDER BY milestone_days ASC`
    );

    const tiers = tiersResult.rows;

    let currentTier: StreakStatus['tier'] = null;
    let nextTier: StreakStatus['nextTier'] = null;
    let tierProgress = 0;

    // Find current and next tier
    for (let i = 0; i < tiers.length; i++) {
      const milestoneDays = tiers[i].milestone_days as number;
      if (currentStreak >= milestoneDays) {
        currentTier = {
          name: tiers[i].tier_name as string,
          days: milestoneDays,
          badgeIcon: tiers[i].badge_icon as string,
        };
      } else {
        nextTier = {
          name: tiers[i].tier_name as string,
          days: milestoneDays,
        };
        break;
      }
    }

    // Compute progress to next tier
    if (currentTier && nextTier) {
      const rangeDays = nextTier.days - currentTier.days;
      const progressDays = currentStreak - currentTier.days;
      tierProgress = rangeDays > 0 ? Math.round((progressDays / rangeDays) * 100) : 0;
    } else if (!currentTier && tiers.length > 0) {
      // No tier yet — progress toward first tier
      const firstTierDays = tiers[0].milestone_days as number;
      nextTier = {
        name: tiers[0].tier_name as string,
        days: firstTierDays,
      };
      tierProgress = firstTierDays > 0 ? Math.round((currentStreak / firstTierDays) * 100) : 0;
    } else if (currentTier && !nextTier) {
      // At max tier
      tierProgress = 100;
    }

    return { tier: currentTier, nextTier, tierProgress };
  }

  /**
   * Compute atRisk flag from a StreakStatus object (used when serving from cache).
   */
  private computeAtRisk(status: StreakStatus): boolean {
    if (status.currentStreak === 0) return false;
    if (status.todayActivities.length > 0) return false;

    try {
      const nowInTimezone = new Date().toLocaleString('en-US', {
        timeZone: status.timezone,
        hour12: false,
      });
      const currentHour = parseInt(nowInTimezone.split(' ')[1]?.split(':')[0] || '0', 10);
      return currentHour >= 18;
    } catch {
      return false;
    }
  }

  /**
   * Get tier name for a streak count (lightweight lookup without DB query).
   */
  private getTierName(streakDays: number): string | null {
    // Static mapping matching seed data in streak_rewards
    const tiers = [
      { days: 365, name: 'Eternal Flame' },
      { days: 180, name: 'Phoenix' },
      { days: 90, name: 'Supernova' },
      { days: 60, name: 'Wildfire' },
      { days: 30, name: 'Inferno' },
      { days: 14, name: 'Blaze' },
      { days: 7, name: 'Flame' },
      { days: 3, name: 'Spark' },
    ];

    for (const tier of tiers) {
      if (streakDays >= tier.days) {
        return tier.name;
      }
    }

    return null;
  }
}

// Export singleton instance
export const streakService = new StreakService();
