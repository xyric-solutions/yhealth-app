/**
 * @file Daily Pledge Service
 * @description Micro-commitment system that generates personalized daily pledges
 * based on the user's weakest health area. Morning message includes 1 pledge;
 * evening check-in verifies completion. 5-day pledge streak = bonus reward.
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import { cache } from './cache.service.js';

// ============================================
// TYPES
// ============================================

export interface DailyPledge {
  id: string;
  userId: string;
  date: string;
  pledgeText: string;
  category: string;
  targetValue: number | null;
  actualValue: number | null;
  completed: boolean;
  createdAt: string;
}

export interface PledgeSuggestion {
  pledgeText: string;
  category: string;
  targetValue: number | null;
}

// ============================================
// PLEDGE TEMPLATES BY CATEGORY
// ============================================

const PLEDGE_TEMPLATES: Record<string, Array<{ text: string; target: number | null }>> = {
  hydration: [
    { text: 'I will drink at least 2L of water today', target: 2000 },
    { text: 'I will drink a glass of water within 30 minutes of waking', target: null },
    { text: 'I will reach 80% of my water target by 3pm', target: 80 },
  ],
  nutrition: [
    { text: 'I will log all my meals today', target: 3 },
    { text: 'I will eat a protein-rich breakfast within 1 hour of waking', target: null },
    { text: 'I will stay within my calorie target today', target: null },
  ],
  exercise: [
    { text: 'I will complete my planned workout today', target: 1 },
    { text: 'I will do at least 20 minutes of movement today', target: 20 },
    { text: 'I will stretch for 10 minutes after my workout', target: 10 },
  ],
  sleep: [
    { text: 'I will be in bed by 10:30pm tonight', target: null },
    { text: 'I will avoid screens 30 minutes before bed', target: null },
    { text: 'I will aim for 7+ hours of sleep tonight', target: 7 },
  ],
  recovery: [
    { text: 'I will take a proper rest day and keep strain low', target: null },
    { text: 'I will do 10 minutes of deep breathing today', target: 10 },
    { text: 'I will not train above moderate intensity today', target: null },
  ],
  consistency: [
    { text: 'I will complete at least 3 scheduled activities today', target: 3 },
    { text: 'I will check in with my health score tonight', target: null },
    { text: 'I will maintain my streak by doing at least one health activity', target: 1 },
  ],
};

// ============================================
// SERVICE CLASS
// ============================================

class DailyPledgeService {
  private tableEnsured = false;

  private async ensureTable(): Promise<void> {
    if (this.tableEnsured) return;
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS daily_pledges (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          date DATE NOT NULL DEFAULT CURRENT_DATE,
          pledge_text TEXT NOT NULL,
          category VARCHAR(30) NOT NULL,
          target_value NUMERIC(10,2),
          actual_value NUMERIC(10,2),
          completed BOOLEAN DEFAULT false,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(user_id, date, category)
        )
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_dp_user_date
          ON daily_pledges(user_id, date DESC)
      `);
      this.tableEnsured = true;
    } catch (error) {
      logger.error('[DailyPledge] Error ensuring table', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Generate a personalized pledge suggestion based on the user's weakest area.
   */
  async suggestPledge(userId: string, weakestCategory?: string): Promise<PledgeSuggestion> {
    const category = weakestCategory || await this.detectWeakestCategory(userId);
    const templates = PLEDGE_TEMPLATES[category] ?? PLEDGE_TEMPLATES.consistency;
    const template = templates[Math.floor(Math.random() * templates.length)];

    return {
      pledgeText: template.text,
      category,
      targetValue: template.target,
    };
  }

  /**
   * Create today's pledge for a user.
   */
  async createPledge(userId: string, pledgeText: string, category: string, targetValue?: number): Promise<DailyPledge | null> {
    await this.ensureTable();
    const today = new Date().toISOString().split('T')[0];

    try {
      const result = await query<{
        id: string;
        user_id: string;
        date: string;
        pledge_text: string;
        category: string;
        target_value: number | null;
        actual_value: number | null;
        completed: boolean;
        created_at: string;
      }>(
        `INSERT INTO daily_pledges (user_id, date, pledge_text, category, target_value)
         VALUES ($1, $2::date, $3, $4, $5)
         ON CONFLICT (user_id, date, category) DO UPDATE SET
           pledge_text = $3, target_value = $5
         RETURNING *`,
        [userId, today, pledgeText, category, targetValue ?? null]
      );

      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return {
        id: row.id,
        userId: row.user_id,
        date: row.date,
        pledgeText: row.pledge_text,
        category: row.category,
        targetValue: row.target_value,
        actualValue: row.actual_value,
        completed: row.completed,
        createdAt: row.created_at,
      };
    } catch (error) {
      logger.error('[DailyPledge] Error creating pledge', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return null;
    }
  }

  /**
   * Get today's pledges for a user.
   */
  async getTodayPledges(userId: string): Promise<DailyPledge[]> {
    await this.ensureTable();
    const today = new Date().toISOString().split('T')[0];

    try {
      const result = await query<{
        id: string;
        user_id: string;
        date: string;
        pledge_text: string;
        category: string;
        target_value: number | null;
        actual_value: number | null;
        completed: boolean;
        created_at: string;
      }>(
        `SELECT * FROM daily_pledges WHERE user_id = $1 AND date = $2::date`,
        [userId, today]
      );
      return result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        date: row.date,
        pledgeText: row.pledge_text,
        category: row.category,
        targetValue: row.target_value,
        actualValue: row.actual_value,
        completed: row.completed,
        createdAt: row.created_at,
      }));
    } catch (error) {
      logger.error('[DailyPledge] Error fetching pledges', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return [];
    }
  }

  /**
   * Complete a pledge (evening check-in).
   */
  async completePledge(pledgeId: string, actualValue?: number): Promise<boolean> {
    await this.ensureTable();
    try {
      await query(
        `UPDATE daily_pledges SET completed = true, actual_value = $2
         WHERE id = $1`,
        [pledgeId, actualValue ?? null]
      );
      return true;
    } catch (error) {
      logger.error('[DailyPledge] Error completing pledge', {
        pledgeId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return false;
    }
  }

  /**
   * Get the user's pledge streak (consecutive days with completed pledges).
   */
  async getPledgeStreak(userId: string): Promise<number> {
    await this.ensureTable();
    try {
      const result = await query<{ streak: string }>(
        `WITH daily_completion AS (
           SELECT date, bool_and(completed) as all_completed
           FROM daily_pledges
           WHERE user_id = $1
           GROUP BY date
           ORDER BY date DESC
         )
         SELECT COUNT(*) as streak
         FROM (
           SELECT date, all_completed,
                  ROW_NUMBER() OVER (ORDER BY date DESC) as rn,
                  date - (ROW_NUMBER() OVER (ORDER BY date DESC) * INTERVAL '1 day')::date as grp
           FROM daily_completion
           WHERE all_completed = true
         ) sub
         WHERE grp = (
           SELECT date - (ROW_NUMBER() OVER (ORDER BY date DESC) * INTERVAL '1 day')::date
           FROM daily_completion
           WHERE all_completed = true
           ORDER BY date DESC
           LIMIT 1
         )`,
        [userId]
      );
      return parseInt(result.rows[0]?.streak || '0', 10);
    } catch {
      return 0;
    }
  }

  // ---- Private helpers ----

  private async detectWeakestCategory(userId: string): Promise<string> {
    const cacheKey = `pledge_weak:${userId}`;
    const cached = cache.get<string>(cacheKey);
    if (cached) return cached;

    try {
      // Use daily score components to find weakest area
      const result = await query<{ component_scores: Record<string, number> }>(
        `SELECT component_scores FROM daily_user_scores
         WHERE user_id = $1 ORDER BY date DESC LIMIT 1`,
        [userId]
      );

      if (result.rows.length === 0) return 'consistency';

      const scores = result.rows[0].component_scores;
      const categoryMap: Record<string, string> = {
        workout: 'exercise',
        nutrition: 'nutrition',
        wellbeing: 'recovery',
        biometrics: 'sleep',
        engagement: 'consistency',
        consistency: 'consistency',
      };

      let weakest = 'consistency';
      let minScore = Infinity;
      for (const [key, score] of Object.entries(scores)) {
        if (score < minScore) {
          minScore = score;
          weakest = categoryMap[key] ?? 'consistency';
        }
      }

      cache.set(cacheKey, weakest, 3600);
      return weakest;
    } catch {
      return 'consistency';
    }
  }
}

export const dailyPledgeService = new DailyPledgeService();
export default dailyPledgeService;
