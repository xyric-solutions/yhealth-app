/**
 * @file Variable Reward Service
 * @description Probabilistic reward drops after activity completion.
 * Uses variable ratio reinforcement (the most addictive reward schedule)
 * to drive engagement and retention.
 *
 * Probability table:
 * - 70% → standard XP
 * - 20% → 2x XP bonus
 * - 7%  → surprise badge
 * - 2%  → streak freeze token
 * - 1%  → rare title/theme
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';

// ============================================
// TYPES
// ============================================

export type RewardType = 'xp_standard' | 'xp_bonus' | 'badge' | 'streak_freeze' | 'rare_title';

export interface RewardDrop {
  type: RewardType;
  value: Record<string, unknown>;
  probability: number;
  displayMessage: string;
}

export interface StoredReward {
  id: string;
  userId: string;
  rewardType: RewardType;
  rewardValue: Record<string, unknown>;
  triggerEvent: string;
  probability: number;
  createdAt: string;
}

// ============================================
// REWARD TABLE
// ============================================

interface RewardTier {
  type: RewardType;
  minRoll: number;
  maxRoll: number;
  probability: number;
  generateValue: (baseXP: number) => Record<string, unknown>;
  generateMessage: (value: Record<string, unknown>) => string;
}

const REWARD_TIERS: RewardTier[] = [
  {
    type: 'rare_title',
    minRoll: 0, maxRoll: 0.01, probability: 0.01,
    generateValue: () => {
      const titles = ['Iron Will', 'Recovery King', 'Consistency Machine', 'Data Warrior', 'Peak Performer'];
      return { title: titles[Math.floor(Math.random() * titles.length)] };
    },
    generateMessage: (v) => `RARE DROP! You earned the "${v.title}" title! Only 1% chance.`,
  },
  {
    type: 'streak_freeze',
    minRoll: 0.01, maxRoll: 0.03, probability: 0.02,
    generateValue: () => ({ freezeCount: 1 }),
    generateMessage: () => `Streak Freeze earned! You now have insurance against missed days.`,
  },
  {
    type: 'badge',
    minRoll: 0.03, maxRoll: 0.10, probability: 0.07,
    generateValue: () => {
      const badges = ['Early Bird', 'Hydration Hero', 'Recovery Respecter', 'Nutrition Ninja', 'Workout Warrior'];
      return { badge: badges[Math.floor(Math.random() * badges.length)], icon: '🏅' };
    },
    generateMessage: (v) => `Surprise badge unlocked: ${v.badge}! ${v.icon}`,
  },
  {
    type: 'xp_bonus',
    minRoll: 0.10, maxRoll: 0.30, probability: 0.20,
    generateValue: (baseXP) => ({ xp: baseXP * 2, multiplier: 2 }),
    generateMessage: (v) => `2x XP Bonus! ${v.xp} XP earned instead of the usual amount.`,
  },
  {
    type: 'xp_standard',
    minRoll: 0.30, maxRoll: 1.0, probability: 0.70,
    generateValue: (baseXP) => ({ xp: baseXP, multiplier: 1 }),
    generateMessage: (v) => `+${v.xp} XP earned.`,
  },
];

// ============================================
// SERVICE CLASS
// ============================================

class VariableRewardService {
  private tableEnsured = false;

  private async ensureTable(): Promise<void> {
    if (this.tableEnsured) return;
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS variable_rewards (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          reward_type VARCHAR(30) NOT NULL,
          reward_value JSONB NOT NULL,
          trigger_event VARCHAR(50) NOT NULL,
          probability NUMERIC(4,3),
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_vr_user_date
          ON variable_rewards(user_id, created_at DESC)
      `);
      this.tableEnsured = true;
    } catch (error) {
      logger.error('[VariableReward] Error ensuring table', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Roll for a reward after an activity completion.
   * Returns the reward drop with display message.
   */
  async rollReward(userId: string, triggerEvent: string, baseXP: number): Promise<RewardDrop> {
    await this.ensureTable();

    const roll = Math.random();
    const tier = REWARD_TIERS.find(t => roll >= t.minRoll && roll < t.maxRoll)
      ?? REWARD_TIERS[REWARD_TIERS.length - 1]; // Fallback to standard XP

    const value = tier.generateValue(baseXP);
    const message = tier.generateMessage(value);

    // Persist
    try {
      await query(
        `INSERT INTO variable_rewards (user_id, reward_type, reward_value, trigger_event, probability)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, tier.type, JSON.stringify(value), triggerEvent, tier.probability]
      );
    } catch (error) {
      logger.warn('[VariableReward] Error persisting reward', {
        userId,
        type: tier.type,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }

    if (tier.type !== 'xp_standard') {
      logger.info('[VariableReward] Special reward dropped', {
        userId,
        type: tier.type,
        roll: roll.toFixed(4),
        probability: tier.probability,
      });
    }

    return {
      type: tier.type,
      value,
      probability: tier.probability,
      displayMessage: message,
    };
  }

  /**
   * Get recent rewards for a user (last 30 days).
   */
  async getRecentRewards(userId: string, limit = 20): Promise<StoredReward[]> {
    await this.ensureTable();
    try {
      const result = await query<{
        id: string;
        user_id: string;
        reward_type: RewardType;
        reward_value: Record<string, unknown>;
        trigger_event: string;
        probability: number;
        created_at: string;
      }>(
        `SELECT * FROM variable_rewards
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit]
      );
      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        rewardType: row.reward_type,
        rewardValue: row.reward_value,
        triggerEvent: row.trigger_event,
        probability: Number(row.probability),
        createdAt: row.created_at,
      }));
    } catch (error) {
      logger.error('[VariableReward] Error fetching rewards', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return [];
    }
  }

  /**
   * Get streak freeze count for a user.
   */
  async getStreakFreezeCount(userId: string): Promise<number> {
    await this.ensureTable();
    try {
      const result = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM variable_rewards
         WHERE user_id = $1 AND reward_type = 'streak_freeze'
         AND created_at >= NOW() - INTERVAL '90 days'`,
        [userId]
      );
      // Subtract used freezes (would need a separate table, simplified here)
      return parseInt(result.rows[0]?.count || '0', 10);
    } catch {
      return 0;
    }
  }
}

export const variableRewardService = new VariableRewardService();
export default variableRewardService;
