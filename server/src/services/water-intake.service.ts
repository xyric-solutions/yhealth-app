/**
 * @file Water Intake Service
 * Handles daily water consumption tracking
 */

import { pool } from '../database/pg.js';
import { logger } from './logger.service.js';
import { gamificationService } from './gamification.service.js';

// ============================================
// TYPES
// ============================================

export interface WaterEntry {
  time: string;
  amountMl: number;
  type: 'water' | 'tea' | 'coffee' | 'juice' | 'other';
}

export interface WaterIntakeLog {
  id: string;
  userId: string;
  logDate: string;
  glassesConsumed: number;
  targetGlasses: number;
  mlConsumed: number;
  targetMl: number;
  entries: WaterEntry[];
  goalAchieved: boolean;
  achievedAt?: string;
  xpEarned: number;
  createdAt: string;
  updatedAt: string;
}

export interface WaterIntakeStats {
  today: WaterIntakeLog | null;
  weeklyAverage: number;
  weeklyTotal: number;
  streak: number;
  lastSevenDays: Array<{
    date: string;
    mlConsumed: number;
    goalAchieved: boolean;
  }>;
}

// ============================================
// CONSTANTS
// ============================================

const ML_PER_GLASS = 250;
const DEFAULT_TARGET_GLASSES = 8;
const DEFAULT_TARGET_ML = DEFAULT_TARGET_GLASSES * ML_PER_GLASS;

// ============================================
// SERVICE
// ============================================

class WaterIntakeService {
  /**
   * Get or create today's water log for a user
   */
  async getTodayLog(userId: string): Promise<WaterIntakeLog> {
    const today = new Date().toISOString().split('T')[0];
    return this.getOrCreateLog(userId, today);
  }

  /**
   * Get or create a water log for a specific date
   */
  async getOrCreateLog(userId: string, date: string): Promise<WaterIntakeLog> {
    // Use upsert to avoid race condition with unique_water_log constraint
    const result = await pool.query(
      `INSERT INTO water_intake_logs (user_id, log_date, target_glasses, target_ml)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, log_date) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, date, DEFAULT_TARGET_GLASSES, DEFAULT_TARGET_ML]
    );

    return this.mapLogRow(result.rows[0]);
  }

  /**
   * Add water intake
   */
  async addWater(
    userId: string,
    amountMl: number,
    type: WaterEntry['type'] = 'water'
  ): Promise<WaterIntakeLog> {
    const today = new Date().toISOString().split('T')[0];
    const log = await this.getOrCreateLog(userId, today);

    // Create entry
    const entry: WaterEntry = {
      time: new Date().toISOString(),
      amountMl,
      type,
    };

    // Update totals
    const newMlConsumed = log.mlConsumed + amountMl;
    const newGlassesConsumed = Math.floor(newMlConsumed / ML_PER_GLASS);
    const wasGoalAchieved = log.goalAchieved;
    const isGoalAchieved = newMlConsumed >= log.targetMl;

    // Add entry to existing entries
    const entries = [...log.entries, entry];

    // Update database
    const result = await pool.query(
      `UPDATE water_intake_logs
       SET ml_consumed = $1,
           glasses_consumed = $2,
           entries = $3,
           goal_achieved = $4,
           achieved_at = CASE WHEN $4 = true AND goal_achieved = false THEN CURRENT_TIMESTAMP ELSE achieved_at END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [newMlConsumed, newGlassesConsumed, JSON.stringify(entries), isGoalAchieved, log.id]
    );

    const updatedLog = this.mapLogRow(result.rows[0]);

    // Award XP if goal just achieved
    if (isGoalAchieved && !wasGoalAchieved) {
      const xpResult = await gamificationService.awardWaterGoalXP(userId, log.id);
      updatedLog.xpEarned = xpResult.xpEarned;

      // Update streak
      await gamificationService.updateStreak(userId);

      // Record for unified streak system
      try {
        const { streakService } = await import('./streak.service.js');
        await streakService.recordActivity(userId, 'water', log.id);
      } catch { /* streak recording is non-blocking */ }

      logger.info(`User ${userId} achieved water goal: ${newMlConsumed}ml`);
    }

    return updatedLog;
  }

  /**
   * Add a glass of water (convenience method)
   */
  async addGlass(userId: string): Promise<WaterIntakeLog> {
    return this.addWater(userId, ML_PER_GLASS, 'water');
  }

  /**
   * Remove water intake (in case of mistakes)
   */
  async removeWater(userId: string, amountMl: number): Promise<WaterIntakeLog> {
    const today = new Date().toISOString().split('T')[0];
    const log = await this.getOrCreateLog(userId, today);

    const newMlConsumed = Math.max(0, log.mlConsumed - amountMl);
    const newGlassesConsumed = Math.floor(newMlConsumed / ML_PER_GLASS);
    const isGoalAchieved = newMlConsumed >= log.targetMl;

    const result = await pool.query(
      `UPDATE water_intake_logs
       SET ml_consumed = $1,
           glasses_consumed = $2,
           goal_achieved = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [newMlConsumed, newGlassesConsumed, isGoalAchieved, log.id]
    );

    return this.mapLogRow(result.rows[0]);
  }

  /**
   * Set custom target for user
   */
  async setTarget(
    userId: string,
    targetMl: number
  ): Promise<WaterIntakeLog> {
    const today = new Date().toISOString().split('T')[0];
    const log = await this.getOrCreateLog(userId, today);

    const targetGlasses = Math.ceil(targetMl / ML_PER_GLASS);
    const isGoalAchieved = log.mlConsumed >= targetMl;

    const result = await pool.query(
      `UPDATE water_intake_logs
       SET target_ml = $1,
           target_glasses = $2,
           goal_achieved = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [targetMl, targetGlasses, isGoalAchieved, log.id]
    );

    return this.mapLogRow(result.rows[0]);
  }

  /**
   * Get water intake history
   */
  async getHistory(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<WaterIntakeLog[]> {
    const result = await pool.query(
      `SELECT * FROM water_intake_logs
       WHERE user_id = $1 AND log_date BETWEEN $2 AND $3
       ORDER BY log_date DESC`,
      [userId, startDate, endDate]
    );

    return result.rows.map(this.mapLogRow);
  }

  /**
   * Get water intake stats
   */
  async getStats(userId: string): Promise<WaterIntakeStats> {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get today's log
    const todayLog = await this.getTodayLog(userId);

    // Get last 7 days
    const history = await this.getHistory(
      userId,
      sevenDaysAgo.toISOString().split('T')[0],
      today.toISOString().split('T')[0]
    );

    // Calculate weekly stats
    const weeklyTotal = history.reduce((sum, log) => sum + log.mlConsumed, 0);
    const weeklyAverage = history.length > 0 ? Math.round(weeklyTotal / history.length) : 0;

    // Calculate streak (consecutive days of goal achievement)
    let streak = 0;
    const sortedHistory = [...history].sort(
      (a, b) => new Date(b.logDate).getTime() - new Date(a.logDate).getTime()
    );

    for (const log of sortedHistory) {
      if (log.goalAchieved) {
        streak++;
      } else {
        break;
      }
    }

    // Format last seven days
    const lastSevenDays = history.map((log) => ({
      date: log.logDate,
      mlConsumed: log.mlConsumed,
      goalAchieved: log.goalAchieved,
    }));

    return {
      today: todayLog,
      weeklyAverage,
      weeklyTotal,
      streak,
      lastSevenDays,
    };
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private mapLogRow(row: Record<string, unknown>): WaterIntakeLog {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      logDate: typeof row.log_date === 'string' ? row.log_date : (row.log_date as Date).toISOString().split('T')[0],
      glassesConsumed: row.glasses_consumed as number,
      targetGlasses: row.target_glasses as number,
      mlConsumed: row.ml_consumed as number,
      targetMl: row.target_ml as number,
      entries: (row.entries as WaterEntry[]) || [],
      goalAchieved: row.goal_achieved as boolean,
      achievedAt: row.achieved_at
        ? (row.achieved_at as Date).toISOString()
        : undefined,
      xpEarned: row.xp_earned as number || 0,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
    };
  }
}

// Export singleton instance
export const waterIntakeService = new WaterIntakeService();
