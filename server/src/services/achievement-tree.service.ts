/**
 * @file Achievement Tree Service
 * @description 5 achievement trees x 5 tiers = 25 unlockable achievements.
 * Each tier has prerequisites (previous tier must be unlocked first).
 * Progress is tracked incrementally and checked on relevant events.
 *
 * Trees: consistency | strength | nutrition | recovery | social
 * Tiers: 1 (Bronze) → 2 (Silver) → 3 (Gold) → 4 (Platinum) → 5 (Diamond)
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';


// ============================================
// TYPES
// ============================================

export type AchievementTree = 'consistency' | 'strength' | 'nutrition' | 'recovery' | 'social';

export interface AchievementDefinition {
  id: string;
  tree: AchievementTree;
  tier: number;
  title: string;
  description: string;
  requirement: { metric: string; threshold: number; durationDays?: number };
  xpReward: number;
  badgeIcon: string;
  prerequisiteId: string | null;
}

export interface UserAchievement {
  achievementId: string;
  definition: AchievementDefinition;
  progress: number;          // 0-100%
  unlockedAt: string | null;
  isUnlocked: boolean;
}

export interface AchievementUnlock {
  achievementId: string;
  title: string;
  tree: AchievementTree;
  tier: number;
  xpReward: number;
  badgeIcon: string;
}

// ============================================
// ACHIEVEMENT DEFINITIONS (5 trees x 5 tiers = 25)
// ============================================

const ACHIEVEMENTS: AchievementDefinition[] = [
  // ---- Consistency Tree ----
  { id: 'consistency_1', tree: 'consistency', tier: 1, title: 'Getting Started', description: 'Maintain a 3-day activity streak', requirement: { metric: 'streak_days', threshold: 3 }, xpReward: 50, badgeIcon: '🔥', prerequisiteId: null },
  { id: 'consistency_2', tree: 'consistency', tier: 2, title: 'Building Momentum', description: 'Maintain a 7-day activity streak', requirement: { metric: 'streak_days', threshold: 7 }, xpReward: 100, badgeIcon: '💪', prerequisiteId: 'consistency_1' },
  { id: 'consistency_3', tree: 'consistency', tier: 3, title: 'Habit Forged', description: 'Maintain a 30-day activity streak', requirement: { metric: 'streak_days', threshold: 30 }, xpReward: 500, badgeIcon: '⚡', prerequisiteId: 'consistency_2' },
  { id: 'consistency_4', tree: 'consistency', tier: 4, title: 'Iron Discipline', description: 'Maintain a 90-day activity streak', requirement: { metric: 'streak_days', threshold: 90 }, xpReward: 2000, badgeIcon: '🏆', prerequisiteId: 'consistency_3' },
  { id: 'consistency_5', tree: 'consistency', tier: 5, title: 'Legendary Streak', description: 'Maintain a 365-day activity streak', requirement: { metric: 'streak_days', threshold: 365 }, xpReward: 10000, badgeIcon: '👑', prerequisiteId: 'consistency_4' },

  // ---- Strength Tree ----
  { id: 'strength_1', tree: 'strength', tier: 1, title: 'First Rep', description: 'Complete your first workout', requirement: { metric: 'total_workouts', threshold: 1 }, xpReward: 25, badgeIcon: '🏋️', prerequisiteId: null },
  { id: 'strength_2', tree: 'strength', tier: 2, title: 'Regular Lifter', description: 'Complete 10 workouts', requirement: { metric: 'total_workouts', threshold: 10 }, xpReward: 100, badgeIcon: '💪', prerequisiteId: 'strength_1' },
  { id: 'strength_3', tree: 'strength', tier: 3, title: 'PR Breaker', description: 'Complete 25 workouts', requirement: { metric: 'total_workouts', threshold: 25 }, xpReward: 250, badgeIcon: '🎯', prerequisiteId: 'strength_2' },
  { id: 'strength_4', tree: 'strength', tier: 4, title: 'Workout Warrior', description: 'Complete 50 workouts', requirement: { metric: 'total_workouts', threshold: 50 }, xpReward: 500, badgeIcon: '⚔️', prerequisiteId: 'strength_3' },
  { id: 'strength_5', tree: 'strength', tier: 5, title: 'Elite Athlete', description: 'Complete 100 workouts', requirement: { metric: 'total_workouts', threshold: 100 }, xpReward: 2000, badgeIcon: '🏅', prerequisiteId: 'strength_4' },

  // ---- Nutrition Tree ----
  { id: 'nutrition_1', tree: 'nutrition', tier: 1, title: 'First Log', description: 'Log your first meal', requirement: { metric: 'meals_logged', threshold: 1 }, xpReward: 25, badgeIcon: '🍎', prerequisiteId: null },
  { id: 'nutrition_2', tree: 'nutrition', tier: 2, title: 'Week Tracker', description: 'Log meals for 7 consecutive days', requirement: { metric: 'meal_logging_streak', threshold: 7 }, xpReward: 100, badgeIcon: '🥗', prerequisiteId: 'nutrition_1' },
  { id: 'nutrition_3', tree: 'nutrition', tier: 3, title: 'Nutrition Aware', description: '30 days of meal logging', requirement: { metric: 'meal_logging_streak', threshold: 30 }, xpReward: 500, badgeIcon: '🥑', prerequisiteId: 'nutrition_2' },
  { id: 'nutrition_4', tree: 'nutrition', tier: 4, title: 'Diet Adherent', description: '80%+ nutrition adherence for 14 days', requirement: { metric: 'nutrition_adherence_80pct_days', threshold: 14 }, xpReward: 1000, badgeIcon: '🌟', prerequisiteId: 'nutrition_3' },
  { id: 'nutrition_5', tree: 'nutrition', tier: 5, title: 'Nutrition Master', description: '90%+ nutrition adherence for 30 days', requirement: { metric: 'nutrition_adherence_90pct_days', threshold: 30 }, xpReward: 3000, badgeIcon: '👨‍🍳', prerequisiteId: 'nutrition_4' },

  // ---- Recovery Tree ----
  { id: 'recovery_1', tree: 'recovery', tier: 1, title: 'Rest Day Respect', description: 'Take your first intentional rest day', requirement: { metric: 'rest_days_taken', threshold: 1 }, xpReward: 25, badgeIcon: '😴', prerequisiteId: null },
  { id: 'recovery_2', tree: 'recovery', tier: 2, title: 'Recovery Listener', description: 'Rest on 5 low-recovery days', requirement: { metric: 'recovery_respected_days', threshold: 5 }, xpReward: 150, badgeIcon: '🧘', prerequisiteId: 'recovery_1' },
  { id: 'recovery_3', tree: 'recovery', tier: 3, title: 'HRV Rising', description: '30 days with improving HRV trend', requirement: { metric: 'hrv_improving_days', threshold: 30 }, xpReward: 500, badgeIcon: '📈', prerequisiteId: 'recovery_2' },
  { id: 'recovery_4', tree: 'recovery', tier: 4, title: 'Sleep Optimized', description: '7+ hours sleep for 21 consecutive days', requirement: { metric: 'good_sleep_streak', threshold: 21 }, xpReward: 1500, badgeIcon: '🌙', prerequisiteId: 'recovery_3' },
  { id: 'recovery_5', tree: 'recovery', tier: 5, title: 'Recovery Champion', description: '80%+ recovery score average for 30 days', requirement: { metric: 'high_recovery_days', threshold: 30 }, xpReward: 3000, badgeIcon: '💎', prerequisiteId: 'recovery_4' },

  // ---- Social Tree ----
  { id: 'social_1', tree: 'social', tier: 1, title: 'Team Player', description: 'Join a team', requirement: { metric: 'teams_joined', threshold: 1 }, xpReward: 50, badgeIcon: '🤝', prerequisiteId: null },
  { id: 'social_2', tree: 'social', tier: 2, title: 'Competitor', description: 'Participate in a team competition', requirement: { metric: 'competitions_joined', threshold: 1 }, xpReward: 100, badgeIcon: '🏁', prerequisiteId: 'social_1' },
  { id: 'social_3', tree: 'social', tier: 3, title: 'Winner', description: 'Win a team competition', requirement: { metric: 'competitions_won', threshold: 1 }, xpReward: 500, badgeIcon: '🏆', prerequisiteId: 'social_2' },
  { id: 'social_4', tree: 'social', tier: 4, title: 'Team Captain', description: 'Lead a team as captain', requirement: { metric: 'teams_captained', threshold: 1 }, xpReward: 250, badgeIcon: '⭐', prerequisiteId: 'social_3' },
  { id: 'social_5', tree: 'social', tier: 5, title: 'Community Legend', description: 'Reach top 10 in global leaderboard', requirement: { metric: 'global_leaderboard_top_10', threshold: 1 }, xpReward: 5000, badgeIcon: '🌍', prerequisiteId: 'social_4' },
];

// ============================================
// SERVICE CLASS
// ============================================

class AchievementTreeService {
  private tableEnsured = false;

  private async ensureTable(): Promise<void> {
    if (this.tableEnsured) return;
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS achievement_definitions (
          id VARCHAR(50) PRIMARY KEY,
          tree VARCHAR(30) NOT NULL,
          tier INTEGER NOT NULL,
          title VARCHAR(100) NOT NULL,
          description TEXT NOT NULL,
          requirement JSONB NOT NULL,
          xp_reward INTEGER NOT NULL,
          badge_icon VARCHAR(50),
          prerequisite_id VARCHAR(50) REFERENCES achievement_definitions(id)
        )
      `);
      await query(`
        CREATE TABLE IF NOT EXISTS user_achievements (
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          achievement_id VARCHAR(50) NOT NULL REFERENCES achievement_definitions(id),
          progress NUMERIC(5,2) DEFAULT 0,
          unlocked_at TIMESTAMPTZ,
          PRIMARY KEY (user_id, achievement_id)
        )
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_ua_user ON user_achievements(user_id)
      `);

      // Seed achievement definitions
      for (const ach of ACHIEVEMENTS) {
        await query(
          `INSERT INTO achievement_definitions (id, tree, tier, title, description, requirement, xp_reward, badge_icon, prerequisite_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO UPDATE SET
             title = $4, description = $5, requirement = $6, xp_reward = $7, badge_icon = $8`,
          [ach.id, ach.tree, ach.tier, ach.title, ach.description,
           JSON.stringify(ach.requirement), ach.xpReward, ach.badgeIcon, ach.prerequisiteId]
        );
      }

      this.tableEnsured = true;
    } catch (error) {
      logger.error('[AchievementTree] Error ensuring tables', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Check and update achievement progress for a user.
   * Returns any newly unlocked achievements.
   */
  async checkProgress(userId: string, metrics: Record<string, number>): Promise<AchievementUnlock[]> {
    await this.ensureTable();
    const unlocked: AchievementUnlock[] = [];

    try {
      // Get current user achievements
      const existing = await query<{
        achievement_id: string;
        progress: number;
        unlocked_at: string | null;
      }>(
        `SELECT achievement_id, progress, unlocked_at FROM user_achievements WHERE user_id = $1`,
        [userId]
      );

      const userProgress = new Map(
        existing.rows.map(r => [r.achievement_id, { progress: Number(r.progress), unlocked: r.unlocked_at !== null }])
      );

      for (const achievement of ACHIEVEMENTS) {
        const current = userProgress.get(achievement.id);
        if (current?.unlocked) continue; // Already unlocked

        // Check prerequisite
        if (achievement.prerequisiteId) {
          const prereq = userProgress.get(achievement.prerequisiteId);
          if (!prereq?.unlocked) continue; // Prerequisite not met
        }

        // Check progress
        const metricValue = metrics[achievement.requirement.metric] ?? 0;
        const progress = Math.min(100, (metricValue / achievement.requirement.threshold) * 100);

        if (progress >= 100) {
          // Unlock!
          await query(
            `INSERT INTO user_achievements (user_id, achievement_id, progress, unlocked_at)
             VALUES ($1, $2, 100, NOW())
             ON CONFLICT (user_id, achievement_id) DO UPDATE SET
               progress = 100, unlocked_at = NOW()`,
            [userId, achievement.id]
          );

          unlocked.push({
            achievementId: achievement.id,
            title: achievement.title,
            tree: achievement.tree,
            tier: achievement.tier,
            xpReward: achievement.xpReward,
            badgeIcon: achievement.badgeIcon,
          });

          logger.info('[AchievementTree] Achievement unlocked!', {
            userId,
            achievementId: achievement.id,
            title: achievement.title,
            tier: achievement.tier,
          });
        } else if (progress !== (current?.progress ?? 0)) {
          // Update progress
          await query(
            `INSERT INTO user_achievements (user_id, achievement_id, progress)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, achievement_id) DO UPDATE SET progress = $3`,
            [userId, achievement.id, Math.round(progress * 10) / 10]
          );
        }
      }
    } catch (error) {
      logger.error('[AchievementTree] Error checking progress', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return unlocked;
  }

  /**
   * Get all achievements for a user with progress.
   */
  async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    await this.ensureTable();
    try {
      const result = await query<{
        achievement_id: string;
        progress: number;
        unlocked_at: string | null;
      }>(
        `SELECT achievement_id, progress, unlocked_at FROM user_achievements WHERE user_id = $1`,
        [userId]
      );

      const userMap = new Map(
        result.rows.map(r => [r.achievement_id, { progress: Number(r.progress), unlockedAt: r.unlocked_at }])
      );

      return ACHIEVEMENTS.map(def => {
        const user = userMap.get(def.id);
        return {
          achievementId: def.id,
          definition: def,
          progress: user?.progress ?? 0,
          unlockedAt: user?.unlockedAt ?? null,
          isUnlocked: user?.unlockedAt !== null,
        };
      });
    } catch (error) {
      logger.error('[AchievementTree] Error fetching user achievements', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return [];
    }
  }

  /**
   * Get achievements for a specific tree.
   */
  async getTreeAchievements(userId: string, tree: AchievementTree): Promise<UserAchievement[]> {
    const all = await this.getUserAchievements(userId);
    return all.filter(a => a.definition.tree === tree);
  }

  /**
   * Get total unlocked count and XP earned from achievements.
   */
  async getAchievementStats(userId: string): Promise<{ unlockedCount: number; totalXPEarned: number }> {
    await this.ensureTable();
    try {
      const result = await query<{ count: string; total_xp: string }>(
        `SELECT COUNT(*) as count,
                COALESCE(SUM(ad.xp_reward), 0) as total_xp
         FROM user_achievements ua
         INNER JOIN achievement_definitions ad ON ad.id = ua.achievement_id
         WHERE ua.user_id = $1 AND ua.unlocked_at IS NOT NULL`,
        [userId]
      );
      return {
        unlockedCount: parseInt(result.rows[0]?.count || '0', 10),
        totalXPEarned: parseInt(result.rows[0]?.total_xp || '0', 10),
      };
    } catch {
      return { unlockedCount: 0, totalXPEarned: 0 };
    }
  }
}

export const achievementTreeService = new AchievementTreeService();
export default achievementTreeService;
