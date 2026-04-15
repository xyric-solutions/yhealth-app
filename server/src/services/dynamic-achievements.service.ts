/**
 * @file Dynamic Achievements Service
 * @description Generates achievements dynamically from user goals and
 * detected micro-wins. Rule-based (no LLM) for performance.
 *
 * Achievement types:
 * - goal: Auto-generated milestones from user goals
 * - comeback: Generated when micro-wins detects a comeback
 * - progression: Generated for sustained improvement trends
 * - micro-win: Wraps micro-win detections as achievements
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import type { MicroWin } from './micro-wins.service.js';

// ============================================
// TYPES
// ============================================

export interface DynamicAchievement {
  id: string;
  userId: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  type: 'goal' | 'comeback' | 'progression' | 'micro-win';
  xpReward: number;
  maxProgress: number;
  currentProgress: number;
  unlocked: boolean;
  unlockedAt: string | null;
  emotionalContext: string | null;
  sourceGoalId: string | null;
  aiGenerated: boolean;
}

interface UserGoal {
  id: string;
  title: string;
  description?: string;
  category?: string;
  target_value?: number;
  target_unit?: string;
  frequency?: string;
  status: string;
}

// ============================================
// TABLE SETUP
// ============================================

let tableEnsured = false;

async function ensureTable(): Promise<void> {
  if (tableEnsured) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS dynamic_achievements (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        icon VARCHAR(50) DEFAULT '🎯',
        category VARCHAR(30) DEFAULT 'milestone',
        rarity VARCHAR(20) DEFAULT 'common',
        type VARCHAR(30) DEFAULT 'goal',
        xp_reward INTEGER DEFAULT 50,
        source_goal_id UUID,
        max_progress INTEGER NOT NULL DEFAULT 1,
        current_progress INTEGER DEFAULT 0,
        unlocked BOOLEAN DEFAULT FALSE,
        unlocked_at TIMESTAMPTZ,
        emotional_context TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_dynamic_ach_user ON dynamic_achievements(user_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_dynamic_ach_goal ON dynamic_achievements(source_goal_id) WHERE source_goal_id IS NOT NULL`);
    tableEnsured = true;
  } catch (error) {
    logger.error('[DynamicAchievements] Error ensuring table', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

// ============================================
// GOAL → ACHIEVEMENT MAPPING
// ============================================

interface GoalMilestone {
  title: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  threshold: number;
  emotionalContext: string;
}

function generateGoalMilestones(goal: UserGoal): GoalMilestone[] {
  const targetValue = goal.target_value || 4;
  const unit = goal.target_unit || 'times';

  // Generate 5 progressive milestones
  const milestones: GoalMilestone[] = [
    {
      title: 'First Step',
      description: `First ${unit} toward "${goal.title}"`,
      icon: '👣',
      rarity: 'common',
      threshold: 1,
      emotionalContext: 'Every journey starts with a single step',
    },
  ];

  if (targetValue >= 3) {
    milestones.push({
      title: 'Halfway There',
      description: `${Math.ceil(targetValue / 2)} ${unit} — halfway to your goal!`,
      icon: '⭐',
      rarity: 'common',
      threshold: Math.ceil(targetValue / 2),
      emotionalContext: `You're making real progress on "${goal.title}"`,
    });
  }

  if (targetValue >= 4) {
    milestones.push({
      title: 'Almost!',
      description: `${targetValue - 1} ${unit} — one more to go!`,
      icon: '🔥',
      rarity: 'rare',
      threshold: targetValue - 1,
      emotionalContext: 'So close you can taste it — finish strong!',
    });
  }

  milestones.push({
    title: 'Goal Achieved!',
    description: `${targetValue} ${unit} — "${goal.title}" complete!`,
    icon: '🏆',
    rarity: 'epic',
    threshold: targetValue,
    emotionalContext: `You did it! "${goal.title}" is conquered.`,
  });

  // Overachiever bonus
  milestones.push({
    title: 'Overachiever',
    description: `${targetValue + Math.ceil(targetValue * 0.25)} ${unit} — you exceeded your goal!`,
    icon: '👑',
    rarity: 'legendary',
    threshold: targetValue + Math.ceil(targetValue * 0.25),
    emotionalContext: 'You went above and beyond — legendary effort!',
  });

  return milestones;
}

// Comeback & progression templates are used by generateFromMicroWins()
// to map micro-win types to achievement categories and icons.

// ============================================
// SERVICE
// ============================================

class DynamicAchievementsService {
  /**
   * Generate achievements for a user goal. Called when a goal is created.
   */
  async generateGoalAchievements(userId: string, goal: UserGoal): Promise<DynamicAchievement[]> {
    await ensureTable();
    const milestones = generateGoalMilestones(goal);
    const created: DynamicAchievement[] = [];

    for (const milestone of milestones) {
      try {
        const result = await query<{ id: string; created_at: string }>(
          `INSERT INTO dynamic_achievements
            (user_id, title, description, icon, category, rarity, type, xp_reward, source_goal_id, max_progress, emotional_context)
           VALUES ($1, $2, $3, $4, 'milestone', $5, 'goal', $6, $7, $8, $9)
           ON CONFLICT DO NOTHING
           RETURNING id, created_at`,
          [
            userId,
            milestone.title,
            milestone.description,
            milestone.icon,
            milestone.rarity,
            milestone.rarity === 'legendary' ? 200 : milestone.rarity === 'epic' ? 100 : milestone.rarity === 'rare' ? 50 : 25,
            goal.id,
            milestone.threshold,
            milestone.emotionalContext,
          ]
        );

        if (result.rows.length > 0) {
          created.push({
            id: result.rows[0].id,
            userId,
            title: milestone.title,
            description: milestone.description,
            icon: milestone.icon,
            category: 'milestone',
            rarity: milestone.rarity,
            type: 'goal',
            xpReward: milestone.rarity === 'legendary' ? 200 : milestone.rarity === 'epic' ? 100 : milestone.rarity === 'rare' ? 50 : 25,
            maxProgress: milestone.threshold,
            currentProgress: 0,
            unlocked: false,
            unlockedAt: null,
            emotionalContext: milestone.emotionalContext,
            sourceGoalId: goal.id,
            aiGenerated: true,
          });
        }
      } catch (error) {
        logger.error('[DynamicAchievements] Error creating goal achievement', {
          userId,
          goalId: goal.id,
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }

    if (created.length > 0) {
      logger.info('[DynamicAchievements] Created goal achievements', {
        userId,
        goalId: goal.id,
        count: created.length,
      });
    }

    return created;
  }

  /**
   * Convert micro-wins into dynamic achievements.
   */
  async generateFromMicroWins(userId: string, microWins: MicroWin[]): Promise<DynamicAchievement[]> {
    await ensureTable();
    const created: DynamicAchievement[] = [];

    for (const win of microWins) {
      // Map micro-win types to achievement templates
      let template: { icon: string; category: string; type: 'comeback' | 'progression' | 'micro-win' };

      switch (win.type) {
        case 'comeback':
          template = { icon: '🔄', category: 'comeback', type: 'comeback' };
          break;
        case 'streak_recovery':
          template = { icon: '🔥', category: 'comeback', type: 'comeback' };
          break;
        case 'personal_best':
          template = { icon: '🏅', category: 'milestone', type: 'progression' };
          break;
        default:
          template = { icon: '✨', category: 'micro-win', type: 'micro-win' };
      }

      try {
        const result = await query<{ id: string }>(
          `INSERT INTO dynamic_achievements
            (user_id, title, description, icon, category, rarity, type, xp_reward, max_progress, current_progress, unlocked, unlocked_at, emotional_context)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, 1, TRUE, NOW(), $9)
           RETURNING id`,
          [
            userId,
            win.title,
            win.description,
            template.icon,
            template.category,
            win.rarity,
            template.type,
            win.xpReward,
            win.description,
          ]
        );

        if (result.rows.length > 0) {
          created.push({
            id: result.rows[0].id,
            userId,
            title: win.title,
            description: win.description,
            icon: template.icon,
            category: template.category,
            rarity: win.rarity,
            type: template.type,
            xpReward: win.xpReward,
            maxProgress: 1,
            currentProgress: 1,
            unlocked: true,
            unlockedAt: new Date().toISOString(),
            emotionalContext: win.description,
            sourceGoalId: null,
            aiGenerated: true,
          });
        }
      } catch (error) {
        // Ignore duplicate entries
        if (!(error instanceof Error && error.message.includes('duplicate'))) {
          logger.error('[DynamicAchievements] Error creating from micro-win', {
            userId,
            winType: win.type,
            error: error instanceof Error ? error.message : 'Unknown',
          });
        }
      }
    }

    return created;
  }

  /**
   * Get all dynamic achievements for a user.
   */
  async getDynamicAchievements(userId: string): Promise<DynamicAchievement[]> {
    await ensureTable();
    try {
      const result = await query<{
        id: string;
        user_id: string;
        title: string;
        description: string;
        icon: string;
        category: string;
        rarity: string;
        type: string;
        xp_reward: string;
        source_goal_id: string | null;
        max_progress: string;
        current_progress: string;
        unlocked: boolean;
        unlocked_at: string | null;
        emotional_context: string | null;
      }>(
        `SELECT * FROM dynamic_achievements WHERE user_id = $1 ORDER BY created_at DESC`,
        [userId]
      );

      return result.rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        title: r.title,
        description: r.description,
        icon: r.icon,
        category: r.category,
        rarity: r.rarity as DynamicAchievement['rarity'],
        type: r.type as DynamicAchievement['type'],
        xpReward: parseInt(r.xp_reward),
        maxProgress: parseInt(r.max_progress),
        currentProgress: parseInt(r.current_progress),
        unlocked: r.unlocked,
        unlockedAt: r.unlocked_at,
        emotionalContext: r.emotional_context,
        sourceGoalId: r.source_goal_id,
        aiGenerated: true,
      }));
    } catch (error) {
      logger.error('[DynamicAchievements] Error fetching', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return [];
    }
  }

  /**
   * Check and update progress on goal-linked dynamic achievements.
   * Returns any newly unlocked achievements.
   */
  async checkGoalProgress(userId: string): Promise<DynamicAchievement[]> {
    await ensureTable();
    const unlocked: DynamicAchievement[] = [];

    try {
      // Get active goal-linked achievements that aren't yet unlocked
      const pending = await query<{
        id: string;
        source_goal_id: string;
        max_progress: string;
        title: string;
        icon: string;
        rarity: string;
        xp_reward: string;
        emotional_context: string | null;
      }>(
        `SELECT id, source_goal_id, max_progress, title, icon, rarity, xp_reward, emotional_context
         FROM dynamic_achievements
         WHERE user_id = $1 AND type = 'goal' AND unlocked = FALSE AND source_goal_id IS NOT NULL`,
        [userId]
      );

      if (pending.rows.length === 0) return unlocked;

      // Batch: get progress for ALL pending achievements in one query (avoids N+1)
      const goalIds = [...new Set(pending.rows.map(a => a.source_goal_id))];
      const progressResult = await query<{ goal_id: string; progress: string }>(
        `SELECT up.goal_id, COUNT(al.id)::int as progress
         FROM user_plans up
         LEFT JOIN activity_logs al ON al.plan_id = up.id AND al.user_id = $1 AND al.status = 'completed'
         WHERE up.user_id = $1 AND up.goal_id = ANY($2::uuid[])
         GROUP BY up.goal_id`,
        [userId, goalIds]
      );
      const progressMap = new Map(progressResult.rows.map(r => [r.goal_id, parseInt(r.progress || '0')]));

      for (const ach of pending.rows) {
        const progress = progressMap.get(ach.source_goal_id) || 0;
        const maxProgress = parseInt(ach.max_progress);

        if (progress >= maxProgress) {
          await query(
            `UPDATE dynamic_achievements SET current_progress = $1, unlocked = TRUE, unlocked_at = NOW()
             WHERE id = $2`,
            [progress, ach.id]
          );

          unlocked.push({
            id: ach.id,
            userId,
            title: ach.title,
            description: '',
            icon: ach.icon,
            category: 'milestone',
            rarity: ach.rarity as DynamicAchievement['rarity'],
            type: 'goal',
            xpReward: parseInt(ach.xp_reward),
            maxProgress,
            currentProgress: progress,
            unlocked: true,
            unlockedAt: new Date().toISOString(),
            emotionalContext: ach.emotional_context,
            sourceGoalId: ach.source_goal_id,
            aiGenerated: true,
          });
        } else {
          // Update progress
          await query(
            `UPDATE dynamic_achievements SET current_progress = $1 WHERE id = $2`,
            [progress, ach.id]
          );
        }
      }
    } catch (error) {
      logger.error('[DynamicAchievements] Error checking goal progress', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }

    return unlocked;
  }
}

export const dynamicAchievementsService = new DynamicAchievementsService();
export default dynamicAchievementsService;
