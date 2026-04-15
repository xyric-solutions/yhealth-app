/**
 * @file Energy Service
 * @description Handles energy level monitoring and pattern analysis (F7.4)
 */

import { query } from '../../database/pg.js';
import { ApiError } from '../../utils/ApiError.js';
import type { EnergyLog, EnergyContextTag } from '@shared/types/domain/wellbeing.js';
import { detectTimeOfDayPattern } from './utils/pattern-detection.js';

// ============================================
// TYPES
// ============================================

export interface CreateEnergyLogInput {
  energyRating: number; // 1-10
  contextTag?: EnergyContextTag;
  contextNote?: string;
  loggedAt?: string;
}

export interface EnergyTimelineData {
  id: string;
  timestamp: string;
  energyRating: number;
  contextTag?: EnergyContextTag;
}

export interface EnergyPattern {
  timeOfDay: {
    morning: number;
    afternoon: number;
    evening: number;
    night: number;
  };
  averageByContext: Array<{
    context: string;
    averageRating: number;
    count: number;
  }>;
  correlationWithSleep?: number;
  correlationWithStress?: number;
}

interface EnergyLogRow {
  id: string;
  user_id: string;
  energy_rating: number;
  context_tag: string | null;
  context_note: string | null;
  logged_at: Date;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// SERVICE CLASS
// ============================================

class EnergyService {
  /**
   * Create an energy log entry
   */
  async createEnergyLog(userId: string, input: CreateEnergyLogInput): Promise<EnergyLog> {
    if (input.energyRating < 1 || input.energyRating > 10) {
      throw ApiError.badRequest('Energy rating must be between 1 and 10');
    }

    const loggedAt = input.loggedAt
      ? new Date(input.loggedAt).toISOString()
      : new Date().toISOString();

    const result = await query<EnergyLogRow>(
      `INSERT INTO energy_logs (user_id, energy_rating, context_tag, context_note, logged_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, input.energyRating, input.contextTag || null, input.contextNote || null, loggedAt]
    );

    return this.mapRowToEnergyLog(result.rows[0]);
  }

  /**
   * Update an energy log entry
   */
  async updateEnergyLog(
    userId: string,
    logId: string,
    input: Partial<CreateEnergyLogInput>
  ): Promise<EnergyLog> {
    // Verify ownership
    const existing = await query<EnergyLogRow>(
      `SELECT * FROM energy_logs WHERE id = $1 AND user_id = $2`,
      [logId, userId]
    );

    if (existing.rows.length === 0) {
      throw ApiError.notFound('Energy log not found');
    }

    if (input.energyRating !== undefined) {
      if (input.energyRating < 1 || input.energyRating > 10) {
        throw ApiError.badRequest('Energy rating must be between 1 and 10');
      }
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.energyRating !== undefined) {
      updates.push(`energy_rating = $${paramIndex++}`);
      values.push(input.energyRating);
    }
    if (input.contextTag !== undefined) {
      updates.push(`context_tag = $${paramIndex++}`);
      values.push(input.contextTag || null);
    }
    if (input.contextNote !== undefined) {
      updates.push(`context_note = $${paramIndex++}`);
      values.push(input.contextNote || null);
    }

    if (updates.length === 0) {
      return this.mapRowToEnergyLog(existing.rows[0]);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(logId, userId);

    const result = await query<EnergyLogRow>(
      `UPDATE energy_logs
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
       RETURNING *`,
      values
    );

    return this.mapRowToEnergyLog(result.rows[0]);
  }

  /**
   * Delete an energy log entry
   */
  async deleteEnergyLog(userId: string, logId: string): Promise<void> {
    const result = await query(
      `DELETE FROM energy_logs WHERE id = $1 AND user_id = $2 RETURNING id`,
      [logId, userId]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Energy log not found');
    }
  }

  /**
   * Get energy logs for a user
   */
  async getEnergyLogs(
    userId: string,
    options: {
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ logs: EnergyLog[]; total: number; page: number; limit: number }> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 50, 100);
    const offset = (page - 1) * limit;

    let queryText = `SELECT * FROM energy_logs WHERE user_id = $1`;
    const params: (string | number)[] = [userId];

    if (options.startDate) {
      queryText += ` AND DATE(logged_at) >= $${params.length + 1}`;
      params.push(options.startDate);
    }

    if (options.endDate) {
      queryText += ` AND DATE(logged_at) <= $${params.length + 1}`;
      params.push(options.endDate);
    }

    queryText += ` ORDER BY logged_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const logsResult = await query<EnergyLogRow>(queryText, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM energy_logs WHERE user_id = $1`;
    const countParams: (string | number)[] = [userId];

    if (options.startDate) {
      countQuery += ` AND DATE(logged_at) >= $${countParams.length + 1}`;
      countParams.push(options.startDate);
    }

    if (options.endDate) {
      countQuery += ` AND DATE(logged_at) <= $${countParams.length + 1}`;
      countParams.push(options.endDate);
    }

    const countResult = await query<{ total: string }>(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total, 10);

    return {
      logs: logsResult.rows.map((row) => this.mapRowToEnergyLog(row)),
      total,
      page,
      limit,
    };
  }

  /**
   * Get a single energy log by ID
   */
  async getEnergyLogById(userId: string, logId: string): Promise<EnergyLog> {
    const result = await query<EnergyLogRow>(
      `SELECT * FROM energy_logs WHERE id = $1 AND user_id = $2`,
      [logId, userId]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Energy log not found');
    }

    return this.mapRowToEnergyLog(result.rows[0]);
  }

  /**
   * Get energy timeline data for chart visualization
   */
  async getEnergyTimeline(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<EnergyTimelineData[]> {
    const result = await query<EnergyLogRow>(
      `SELECT * FROM energy_logs
       WHERE user_id = $1
       AND DATE(logged_at) >= $2
       AND DATE(logged_at) <= $3
       ORDER BY logged_at ASC`,
      [userId, startDate, endDate]
    );

    return result.rows.map((row) => ({
      id: row.id,
      timestamp: row.logged_at.toISOString(),
      energyRating: row.energy_rating,
      contextTag: (row.context_tag as EnergyContextTag) || undefined,
    }));
  }

  /**
   * Get energy patterns and correlations
   */
  async getEnergyPatterns(userId: string, days: number = 30): Promise<EnergyPattern> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const result = await query<EnergyLogRow>(
      `SELECT * FROM energy_logs
       WHERE user_id = $1
       AND logged_at >= $2
       AND logged_at <= $3
       ORDER BY logged_at ASC`,
      [userId, startDate.toISOString(), endDate.toISOString()]
    );

    // Time of day patterns
    const timestamps = result.rows.map((r) => r.logged_at.toISOString());
    const ratings = result.rows.map((r) => r.energy_rating);

    const timePatterns = detectTimeOfDayPattern(timestamps, ratings);

    // Average by context
    const contextMap = new Map<string, { sum: number; count: number }>();
    for (const row of result.rows) {
      const context = row.context_tag || 'none';
      const current = contextMap.get(context) || { sum: 0, count: 0 };
      current.sum += row.energy_rating;
      current.count += 1;
      contextMap.set(context, current);
    }

    const averageByContext = Array.from(contextMap.entries())
      .map(([context, data]) => ({
        context,
        averageRating: data.sum / data.count,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count);

    // Correlations with sleep and stress (if data available)
    // This would require joining with sleep and stress logs
    // For now, return patterns without correlations
    // TODO: Implement cross-pillar correlation analysis

    return {
      timeOfDay: {
        morning: timePatterns.find((p) => p.period === 'morning')?.averageValue || 0,
        afternoon: timePatterns.find((p) => p.period === 'afternoon')?.averageValue || 0,
        evening: timePatterns.find((p) => p.period === 'evening')?.averageValue || 0,
        night: timePatterns.find((p) => p.period === 'night')?.averageValue || 0,
      },
      averageByContext,
    };
  }

  /**
   * Map database row to EnergyLog interface
   */
  private mapRowToEnergyLog(row: EnergyLogRow): EnergyLog {
    return {
      id: row.id,
      userId: row.user_id,
      energyRating: row.energy_rating,
      contextTag: (row.context_tag as EnergyContextTag) || undefined,
      contextNote: row.context_note || undefined,
      loggedAt: row.logged_at.toISOString(),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}

export const energyService = new EnergyService();
export default energyService;

