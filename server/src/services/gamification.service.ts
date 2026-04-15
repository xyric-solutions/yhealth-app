/**
 * @file Gamification Service
 * Handles XP, levels, streaks, and achievements
 */

import { pool } from '../database/pg.js';
import { logger } from './logger.service.js';

// ============================================
// TYPES
// ============================================

export type XPSourceType =
  | 'activity'      // Daily activity completion
  | 'workout'       // Workout completion
  | 'meal'          // Meal logging
  | 'water'         // Water goal achieved
  | 'daily_complete' // All daily tasks completed
  | 'weekly_goal'   // Weekly goal achieved
  | 'progress_photo' // Progress photo uploaded
  | 'streak_bonus'  // Streak milestone bonus
  | 'achievement'   // Achievement unlocked
  | 'bonus';        // Special bonus

export interface XPResult {
  xpEarned: number;
  baseXP: number;
  multiplier: number;
  newTotal: number;
  newLevel: number;
  leveledUp: boolean;
  previousLevel: number;
}

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  isNewRecord: boolean;
  bonusXP: number;
}

export interface LevelProgress {
  currentLevel: number;
  currentXP: number;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  progressPercent: number;
}

export interface UserGamificationStats {
  totalXP: number;
  currentLevel: number;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
  levelProgress: LevelProgress;
}

// ============================================
// CONSTANTS
// ============================================

// XP values for different actions
export const XP_VALUES = {
  activity: 10,
  workout: 25,
  meal: 5,
  water: 10,
  daily_complete: 50,
  weekly_goal: 100,
  progress_photo: 15,
  streak_7: 100,
  streak_14: 200,
  streak_30: 500,
  streak_60: 1000,
  streak_90: 2000,
} as const;

// XP required per level (500 XP per level)
const XP_PER_LEVEL = 500;

// Streak multiplier settings
const STREAK_MULTIPLIER_INCREMENT = 0.02;
const MAX_STREAK_FOR_MULTIPLIER = 30;

// ============================================
// SERVICE
// ============================================

class GamificationService {
  /**
   * Calculate level from total XP
   */
  calculateLevel(totalXP: number): number {
    return Math.floor(totalXP / XP_PER_LEVEL) + 1;
  }

  /**
   * Calculate streak multiplier
   * Increases by 2% per day up to 60% at 30 days
   */
  calculateStreakMultiplier(streakDays: number): number {
    const effectiveStreak = Math.min(streakDays, MAX_STREAK_FOR_MULTIPLIER);
    return 1 + effectiveStreak * STREAK_MULTIPLIER_INCREMENT;
  }

  /**
   * Get level progress information
   */
  getLevelProgress(totalXP: number): LevelProgress {
    const currentLevel = this.calculateLevel(totalXP);
    const xpForCurrentLevel = (currentLevel - 1) * XP_PER_LEVEL;
    const xpForNextLevel = currentLevel * XP_PER_LEVEL;
    const xpInCurrentLevel = totalXP - xpForCurrentLevel;
    const xpNeededForLevel = XP_PER_LEVEL;
    const progressPercent = (xpInCurrentLevel / xpNeededForLevel) * 100;

    return {
      currentLevel,
      currentXP: totalXP,
      xpForCurrentLevel,
      xpForNextLevel,
      progressPercent: Math.min(progressPercent, 100),
    };
  }

  /**
   * Award XP to a user
   */
  async awardXP(
    userId: string,
    sourceType: XPSourceType,
    baseXP: number,
    sourceId?: string,
    description?: string
  ): Promise<XPResult> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get current user stats
      const userResult = await client.query(
        'SELECT total_xp, current_level, current_streak FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult.rows[0];
      const previousXP = user.total_xp || 0;
      const previousLevel = user.current_level || 1;
      const currentStreak = user.current_streak || 0;

      // Calculate multiplier based on streak
      const multiplier = this.calculateStreakMultiplier(currentStreak);

      // Apply multiplier only for eligible actions
      const eligibleForMultiplier = ['activity', 'workout', 'meal', 'water', 'daily_complete'].includes(sourceType);
      const finalMultiplier = eligibleForMultiplier ? multiplier : 1.0;
      const xpEarned = Math.round(baseXP * finalMultiplier);

      // Update user's total XP
      const newTotal = previousXP + xpEarned;
      const newLevel = this.calculateLevel(newTotal);

      await client.query(
        `UPDATE users
         SET total_xp = $1, current_level = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [newTotal, newLevel, userId]
      );

      // Record XP transaction
      await client.query(
        `INSERT INTO user_xp_transactions (
          user_id, xp_amount, source_type, source_id, streak_day,
          multiplier, base_xp, description, total_after, level_after
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          userId,
          xpEarned,
          sourceType,
          sourceId || null,
          currentStreak,
          finalMultiplier,
          baseXP,
          description || `${sourceType} completion`,
          newTotal,
          newLevel,
        ]
      );

      await client.query('COMMIT');

      const result: XPResult = {
        xpEarned,
        baseXP,
        multiplier: finalMultiplier,
        newTotal,
        newLevel,
        leveledUp: newLevel > previousLevel,
        previousLevel,
      };

      if (result.leveledUp) {
        logger.info(`User ${userId} leveled up from ${previousLevel} to ${newLevel}`);
      }

      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to award XP', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update user's streak based on activity
   */
  async updateStreak(userId: string): Promise<StreakResult> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get current user streak info
      const userResult = await client.query(
        `SELECT current_streak, longest_streak, last_activity_date
         FROM users WHERE id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult.rows[0];
      const lastActivity = user.last_activity_date
        ? new Date(user.last_activity_date)
        : null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let currentStreak = user.current_streak || 0;
      let longestStreak = user.longest_streak || 0;
      let bonusXP = 0;

      if (lastActivity) {
        const lastActivityDate = new Date(lastActivity);
        lastActivityDate.setHours(0, 0, 0, 0);

        const daysDiff = Math.floor(
          (today.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysDiff === 0) {
          // Same day, streak already counted
          // Return current values without changes
          await client.query('COMMIT');
          return {
            currentStreak,
            longestStreak,
            isNewRecord: false,
            bonusXP: 0,
          };
        } else if (daysDiff === 1) {
          // Consecutive day, increment streak
          currentStreak += 1;
        } else {
          // Streak broken, reset to 1
          currentStreak = 1;
        }
      } else {
        // First activity ever
        currentStreak = 1;
      }

      // Check for streak milestones and award bonus XP
      const streakMilestones = [7, 14, 30, 60, 90];
      if (streakMilestones.includes(currentStreak)) {
        const milestoneKey = `streak_${currentStreak}` as keyof typeof XP_VALUES;
        if (XP_VALUES[milestoneKey]) {
          bonusXP = XP_VALUES[milestoneKey];
        }
      }

      // Check if new record
      const isNewRecord = currentStreak > longestStreak;
      if (isNewRecord) {
        longestStreak = currentStreak;
      }

      // Update user streak info
      await client.query(
        `UPDATE users
         SET current_streak = $1, longest_streak = $2, last_activity_date = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [currentStreak, longestStreak, userId]
      );

      await client.query('COMMIT');

      // Award streak bonus XP if applicable (outside transaction)
      if (bonusXP > 0) {
        await this.awardXP(
          userId,
          'streak_bonus',
          bonusXP,
          undefined,
          `${currentStreak}-day streak milestone!`
        );
      }

      const result: StreakResult = {
        currentStreak,
        longestStreak,
        isNewRecord,
        bonusXP,
      };

      if (isNewRecord) {
        logger.info(`User ${userId} set new streak record: ${longestStreak} days`);
      }

      // Sync with unified streak system (fire-and-forget)
      import('./streak.service.js').then(({ streakService }) =>
        streakService.recordActivity(userId, 'activity')
      ).catch(() => {});

      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to update streak', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get user's gamification stats
   */
  async getUserStats(userId: string): Promise<UserGamificationStats> {
    const result = await pool.query(
      `SELECT total_xp, current_level, current_streak, longest_streak, last_activity_date
       FROM users WHERE id = $1`,
      [userId]
    );

    // Return default stats if user not found (likely database reset needed)
    if (result.rows.length === 0) {
      logger.warn('[Gamification] User not found, returning default stats', { userId });
      return {
        totalXP: 0,
        currentLevel: 1,
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: null,
        levelProgress: this.getLevelProgress(0),
      };
    }

    const user = result.rows[0];
    const totalXP = user.total_xp || 0;
    const levelProgress = this.getLevelProgress(totalXP);

    return {
      totalXP,
      currentLevel: user.current_level || 1,
      currentStreak: user.current_streak || 0,
      longestStreak: user.longest_streak || 0,
      lastActivityDate: user.last_activity_date
        ? new Date(user.last_activity_date).toISOString()
        : null,
      levelProgress,
    };
  }

  /**
   * Get XP transaction history for a user
   */
  async getXPHistory(
    userId: string,
    limit = 20,
    offset = 0
  ): Promise<{
    transactions: Array<{
      id: string;
      xpAmount: number;
      sourceType: string;
      description: string;
      multiplier: number;
      totalAfter: number;
      createdAt: string;
    }>;
    total: number;
  }> {
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM user_xp_transactions WHERE user_id = $1',
      [userId]
    );

    const result = await pool.query(
      `SELECT id, xp_amount, source_type, description, multiplier, total_after, created_at
       FROM user_xp_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return {
      transactions: result.rows.map((row) => ({
        id: row.id,
        xpAmount: row.xp_amount,
        sourceType: row.source_type,
        description: row.description,
        multiplier: row.multiplier,
        totalAfter: row.total_after,
        createdAt: row.created_at.toISOString(),
      })),
      total: parseInt(countResult.rows[0].count, 10),
    };
  }

  /**
   * Award XP for completing a workout
   */
  async awardWorkoutXP(
    userId: string,
    workoutLogId: string,
    completionRate: number = 1.0
  ): Promise<XPResult> {
    // Base XP adjusted by completion rate
    const baseXP = Math.round(XP_VALUES.workout * completionRate);
    return this.awardXP(
      userId,
      'workout',
      baseXP,
      workoutLogId,
      'Workout completed'
    );
  }

  /**
   * Award XP for logging a meal
   */
  async awardMealXP(userId: string, mealLogId: string): Promise<XPResult> {
    return this.awardXP(
      userId,
      'meal',
      XP_VALUES.meal,
      mealLogId,
      'Meal logged'
    );
  }

  /**
   * Award XP for hitting water goal
   */
  async awardWaterGoalXP(userId: string, waterLogId: string): Promise<XPResult> {
    return this.awardXP(
      userId,
      'water',
      XP_VALUES.water,
      waterLogId,
      'Daily water goal achieved'
    );
  }

  /**
   * Award XP for uploading progress photo
   */
  async awardProgressPhotoXP(
    userId: string,
    photoId: string
  ): Promise<XPResult> {
    return this.awardXP(
      userId,
      'progress_photo',
      XP_VALUES.progress_photo,
      photoId,
      'Progress photo uploaded'
    );
  }

  /**
   * Award XP for completing all daily activities
   */
  async awardDailyCompleteXP(userId: string): Promise<XPResult> {
    return this.awardXP(
      userId,
      'daily_complete',
      XP_VALUES.daily_complete,
      undefined,
      'All daily activities completed'
    );
  }

  /**
   * Check and award daily completion bonus
   * Call this after each activity completion to check if all daily tasks are done
   */
  async checkDailyCompletion(userId: string): Promise<{
    allComplete: boolean;
    bonusAwarded: boolean;
    workoutsDone: number;
    workoutsTotal: number;
    waterGoalAchieved: boolean;
  }> {
    const today = new Date().toISOString().split('T')[0];

    const result = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM workout_logs WHERE user_id = $1 AND scheduled_date = $2 AND status = 'completed') as workouts_done,
        (SELECT COUNT(*) FROM workout_logs WHERE user_id = $1 AND scheduled_date = $2) as workouts_total,
        (SELECT COALESCE(goal_achieved, false) FROM water_intake_logs WHERE user_id = $1 AND log_date = $2) as water_done
      `,
      [userId, today]
    );

    const row = result.rows[0];
    const workoutsDone = parseInt(row?.workouts_done || '0', 10);
    const workoutsTotal = parseInt(row?.workouts_total || '0', 10);
    const waterGoalAchieved = row?.water_done || false;

    // For MVP, consider daily complete if: all scheduled workouts done AND water goal hit
    const allComplete =
      workoutsTotal > 0 && workoutsDone >= workoutsTotal && waterGoalAchieved;

    let bonusAwarded = false;

    if (allComplete) {
      // Check if bonus already awarded today
      const bonusCheck = await pool.query(
        `SELECT id FROM user_xp_transactions
         WHERE user_id = $1 AND source_type = 'daily_complete'
         AND DATE(created_at) = $2`,
        [userId, today]
      );

      if (bonusCheck.rows.length === 0) {
        await this.awardDailyCompleteXP(userId);
        bonusAwarded = true;
      }
    }

    return {
      allComplete,
      bonusAwarded,
      workoutsDone,
      workoutsTotal,
      waterGoalAchieved,
    };
  }

  /**
   * Get leaderboard (top users by XP)
   */
  async getLeaderboard(limit = 10): Promise<
    Array<{
      userId: string;
      displayName: string;
      totalXP: number;
      currentLevel: number;
      currentStreak: number;
      rank: number;
    }>
  > {
    const result = await pool.query(
      `SELECT
         id, name, email, total_xp, current_level, current_streak,
         ROW_NUMBER() OVER (ORDER BY total_xp DESC) as rank
       FROM users
       WHERE total_xp > 0
       ORDER BY total_xp DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map((row) => ({
      userId: row.id,
      displayName: row.name || row.email?.split('@')[0] || 'Anonymous',
      totalXP: row.total_xp || 0,
      currentLevel: row.current_level || 1,
      currentStreak: row.current_streak || 0,
      rank: parseInt(row.rank, 10),
    }));
  }

  /**
   * Get user's rank in the leaderboard
   */
  async getUserRank(userId: string): Promise<number> {
    const result = await pool.query(
      `SELECT rank FROM (
         SELECT id, ROW_NUMBER() OVER (ORDER BY total_xp DESC) as rank
         FROM users
         WHERE total_xp > 0
       ) ranked
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // User has no XP yet, calculate based on total users
      const countResult = await pool.query(
        'SELECT COUNT(*) + 1 as rank FROM users WHERE total_xp > 0'
      );
      return parseInt(countResult.rows[0].rank, 10);
    }

    return parseInt(result.rows[0].rank, 10);
  }
}

// Export singleton instance
export const gamificationService = new GamificationService();
