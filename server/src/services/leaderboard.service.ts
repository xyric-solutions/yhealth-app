/**
 * @file Leaderboard Service
 * @description Manages daily leaderboards with precomputed snapshots and Redis caching
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import { redisCacheService } from './redis-cache.service.js';

// ============================================
// TYPES
// ============================================

export type LeaderboardType = 'global' | 'country' | 'friends' | 'competition';

export interface LeaderboardEntry {
  user_id: string;
  rank: number;
  total_score: number;
  component_scores: {
    workout: number;
    nutrition: number;
    wellbeing: number;
    biometrics: number;
    engagement: number;
    consistency: number;
  };
  user?: {
    name: string;
    avatar?: string;
  };
}

export interface LeaderboardResponse {
  date: string;
  type: LeaderboardType;
  segment: string | null;
  ranks: LeaderboardEntry[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

// ============================================
// SERVICE
// ============================================

class LeaderboardService {
  /**
   * Get Redis key for leaderboard
   */
  private getRedisKey(type: LeaderboardType, date: string, segment?: string): string {
    const segmentPart = segment ? `:${segment}` : '';
    return `leaderboard:${type}:${date}${segmentPart}`;
  }

  /**
   * Materialize leaderboard (compute and store top N)
   */
  async materializeLeaderboard(
    type: LeaderboardType,
    date: string,
    topN: number = 100,
    segment?: string
  ): Promise<void> {
    let queryStr = `
      SELECT 
        dus.user_id,
        dus.total_score,
        dus.component_scores,
        u.first_name || ' ' || u.last_name as name,
        u.avatar
      FROM daily_user_scores dus
      JOIN users u ON u.id = dus.user_id
      WHERE dus.date = $1::date
        AND u.onboarding_status = 'completed'
    `;
    const params: (string | number)[] = [date];
    let paramIndex = 2;

    // Apply filters based on type
    if (type === 'country' && segment) {
      // Would need country field in users table - simplified for MVP
      queryStr += ` AND u.id IN (SELECT id FROM users LIMIT 1000)`;
    } else if (type === 'friends') {
      // Would need friends table - simplified for MVP
      queryStr += ` AND u.id IN (SELECT id FROM users LIMIT 100)`;
    } else if (type === 'competition' && segment) {
      queryStr += ` AND dus.user_id IN (
        SELECT user_id FROM competition_entries 
        WHERE competition_id = $${paramIndex++} AND status = 'active'
      )`;
      params.push(segment);
    }

    // Filter out users who opted out of global leaderboards
    if (type === 'global') {
      queryStr += ` AND (u.privacy_flags->>'hide_from_global')::boolean IS NOT TRUE`;
    }

    queryStr += ` ORDER BY dus.total_score DESC LIMIT $${paramIndex++}`;
    params.push(topN);

    const result = await query<{
      user_id: string;
      total_score: number;
      component_scores: Record<string, number>;
      name: string;
      avatar: string | null;
    }>(queryStr, params);

    const ranks: LeaderboardEntry[] = result.rows.map((row, index) => ({
      user_id: row.user_id,
      rank: index + 1,
      total_score: parseFloat(row.total_score.toString()),
      component_scores: row.component_scores as LeaderboardEntry['component_scores'],
      user: {
        name: row.name,
        avatar: row.avatar || undefined,
      },
    }));

    // Ensure unique constraint exists before upsert (self-healing)
    await query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'leaderboard_snapshots_date_board_type_segment_key_key'
        ) THEN
          ALTER TABLE leaderboard_snapshots ADD CONSTRAINT leaderboard_snapshots_date_board_type_segment_key_key
            UNIQUE (date, board_type, segment_key);
        END IF;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `).catch(() => { /* constraint may already exist */ });

    // Store in database snapshot
    await query(
      `INSERT INTO leaderboard_snapshots (date, board_type, segment_key, ranks, metadata)
       VALUES ($1::date, $2, $3, $4, $5)
       ON CONFLICT (date, board_type, segment_key)
       DO UPDATE SET
         ranks = EXCLUDED.ranks,
         metadata = EXCLUDED.metadata,
         updated_at = CURRENT_TIMESTAMP`,
      [
        date,
        type,
        segment || null,
        JSON.stringify(ranks),
        JSON.stringify({
          total_users: ranks.length,
          last_updated: new Date().toISOString(),
          top_n_count: topN,
        }),
      ]
    );

    // Update Redis sorted set
    const redisKey = this.getRedisKey(type, date, segment);
    const members = ranks.map((entry) => ({
      score: entry.total_score,
      member: entry.user_id,
    }));
    await redisCacheService.zDelete(redisKey);
    
    // Only add to Redis if there are members to add
    if (members.length > 0) {
      await redisCacheService.zAddMultiple(redisKey, members);
      await redisCacheService.expire(redisKey, 86400 * 7); // 7 days
    } else {
      logger.warn('[Leaderboard] No members to cache for leaderboard', { type, date, segment });
    }

    logger.info('[Leaderboard] Materialized leaderboard', { type, date, segment, count: ranks.length });
  }

  /**
   * Get leaderboard from cache or database
   */
  async getLeaderboard(
    type: LeaderboardType,
    date: string,
    options: {
      segment?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<LeaderboardResponse> {
    const limit = options.limit || 100;
    const offset = options.offset || 0;

    // Try Redis first
    const redisKey = this.getRedisKey(type, date, options.segment);
    const cachedRanks = await redisCacheService.zRevRange(redisKey, offset, offset + limit - 1, true);

    let ranks: LeaderboardEntry[] = [];

    if (cachedRanks.length > 0) {
      // Parse Redis results
      for (let i = 0; i < cachedRanks.length; i += 2) {
        const userId = cachedRanks[i];
        const score = parseFloat(cachedRanks[i + 1] || '0');
        const rank = offset + Math.floor(i / 2) + 1;

        // Get user details
        const userResult = await query<{
          first_name: string;
          last_name: string;
          avatar: string | null;
        }>(
          `SELECT first_name, last_name, avatar FROM users WHERE id = $1`,
          [userId]
        );

        if (userResult.rows.length > 0) {
          const user = userResult.rows[0];
          // Get component scores
          const scoreResult = await query<{ component_scores: Record<string, number> }>(
            `SELECT component_scores FROM daily_user_scores WHERE user_id = $1 AND date = $2::date`,
            [userId, date]
          );

          // Normalize old 4-key scores to 6-key format
          const rawScores = scoreResult.rows[0]?.component_scores as Record<string, number> | undefined;
          const normalizedScores: LeaderboardEntry['component_scores'] = rawScores ? {
            workout: rawScores.workout ?? 0,
            nutrition: rawScores.nutrition ?? 0,
            wellbeing: rawScores.wellbeing ?? 0,
            biometrics: rawScores.biometrics ?? 0,
            engagement: rawScores.engagement ?? rawScores.participation ?? 0,
            consistency: rawScores.consistency ?? 0,
          } : { workout: 0, nutrition: 0, wellbeing: 0, biometrics: 0, engagement: 0, consistency: 0 };

          ranks.push({
            user_id: userId,
            rank,
            total_score: score,
            component_scores: normalizedScores,
            user: {
              name: `${user.first_name} ${user.last_name}`,
              avatar: user.avatar || undefined,
            },
          });
        }
      }
    } else {
      // Fallback to database snapshot
      const snapshotResult = await query<{
        ranks: LeaderboardEntry[];
        metadata: Record<string, unknown>;
      }>(
        `SELECT ranks, metadata FROM leaderboard_snapshots 
         WHERE date = $1::date AND board_type = $2 AND (segment_key = $3 OR ($3 IS NULL AND segment_key IS NULL))`,
        [date, type, options.segment || null]
      );

      if (snapshotResult.rows.length > 0) {
        const allRanks = snapshotResult.rows[0].ranks as LeaderboardEntry[];
        ranks = allRanks.slice(offset, offset + limit);
      }
    }

    // Get total count (only onboarded users)
    const totalResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM daily_user_scores dus
       JOIN users u ON u.id = dus.user_id
       WHERE dus.date = $1::date AND u.onboarding_status = 'completed'`,
      [date]
    );
    const total = parseInt(totalResult.rows[0].count, 10);

    return {
      date,
      type,
      segment: options.segment || null,
      ranks,
      pagination: {
        total,
        limit,
        offset,
      },
    };
  }

  /**
   * Get "around me" leaderboard (ranks around user)
   */
  async getAroundMe(
    userId: string,
    date: string,
    range: number = 50
  ): Promise<LeaderboardResponse> {
    // Get user's rank
    const userRankResult = await query<{ rank_global: number | null }>(
      `SELECT rank_global FROM daily_user_scores WHERE user_id = $1 AND date = $2::date`,
      [userId, date]
    );

    const userRank = userRankResult.rows[0]?.rank_global;
    if (userRank == null) {
      return {
        date,
        type: 'global',
        segment: null,
        ranks: [],
        pagination: { total: 0, limit: range * 2 + 1, offset: 0 },
      };
    }

    const startRank = Math.max(1, userRank - range);
    const endRank = userRank + range;

    // Get ranks around user
    const result = await query<{
      user_id: string;
      total_score: number;
      component_scores: Record<string, number>;
      rank_global: number;
      first_name: string;
      last_name: string;
      avatar: string | null;
    }>(
      `SELECT 
        dus.user_id,
        dus.total_score,
        dus.component_scores,
        dus.rank_global,
        u.first_name,
        u.last_name,
        u.avatar
      FROM daily_user_scores dus
      JOIN users u ON u.id = dus.user_id
      WHERE dus.date = $1::date
        AND dus.rank_global >= $2
        AND dus.rank_global <= $3
        AND u.onboarding_status = 'completed'
        AND (u.privacy_flags->>'hide_from_global')::boolean IS NOT TRUE
      ORDER BY dus.rank_global ASC`,
      [date, startRank, endRank]
    );

    const ranks: LeaderboardEntry[] = result.rows.map((row) => ({
      user_id: row.user_id,
      rank: row.rank_global,
      total_score: parseFloat(row.total_score.toString()),
      component_scores: row.component_scores as LeaderboardEntry['component_scores'],
      user: {
        name: `${row.first_name} ${row.last_name}`,
        avatar: row.avatar || undefined,
      },
    }));

    return {
      date,
      type: 'global',
      segment: null,
      ranks,
      pagination: {
        total: ranks.length,
        limit: range * 2 + 1,
        offset: 0,
      },
    };
  }

  /**
   * Get user's current rank
   */
  async getUserRank(
    userId: string,
    date: string,
    type: LeaderboardType = 'global'
  ): Promise<number | null> {
    const rankColumn = type === 'global' ? 'rank_global' : type === 'country' ? 'rank_country' : 'rank_friends';

    const result = await query<{ rank: number | null }>(
      `SELECT ${rankColumn} as rank 
       FROM daily_user_scores 
       WHERE user_id = $1 AND date = $2::date`,
      [userId, date]
    );

    return result.rows[0]?.rank ?? null;
  }

  /**
   * Update ranks in daily_user_scores after materialization
   */
  async updateRanks(date: string): Promise<void> {
    // Update global ranks
    await query(
      `UPDATE daily_user_scores dus
       SET rank_global = sub.rank
       FROM (
         SELECT dus2.user_id, ROW_NUMBER() OVER (ORDER BY dus2.total_score DESC) as rank
         FROM daily_user_scores dus2
         JOIN users u ON u.id = dus2.user_id
         WHERE dus2.date = $1::date AND u.onboarding_status = 'completed'
       ) sub
       WHERE dus.user_id = sub.user_id AND dus.date = $1::date`,
      [date]
    );

    logger.info('[Leaderboard] Updated ranks', { date });
  }
}

// Export singleton instance
export const leaderboardService = new LeaderboardService();
export default leaderboardService;

