/**
 * @file Competition Service
 * @description Manages competitions (admin-created and AI-generated)
 * Handles enrollment, eligibility checks, and competition-specific scoring
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import { ApiError } from '../utils/ApiError.js';

// ============================================
// TYPES
// ============================================

export type CompetitionType = 'ai_generated' | 'admin_created';
export type CompetitionStatus = 'draft' | 'active' | 'ended' | 'cancelled';
export type CompetitionEntryStatus = 'active' | 'disqualified' | 'completed' | 'withdrawn';

export interface CompetitionRules {
  metric: 'workout' | 'nutrition' | 'wellbeing' | 'biometrics' | 'engagement' | 'consistency' | 'participation' | 'total';
  aggregation: 'streak' | 'total' | 'average' | 'max';
  target?: number;
  min_days?: number;
}

export interface CompetitionEligibility {
  regions?: string[];
  subscription_tiers?: string[];
  age_brackets?: string[];
  groups?: string[];
}

export interface Competition {
  id: string;
  name: string;
  type: CompetitionType;
  description: string | null;
  startDate: Date;
  endDate: Date;
  rules: CompetitionRules;
  eligibility: CompetitionEligibility;
  scoringWeights: Record<string, number>;
  antiCheatPolicy: Record<string, unknown>;
  prizeMetadata: Record<string, unknown>;
  status: CompetitionStatus;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompetitionEntry {
  id: string;
  competitionId: string;
  userId: string;
  joinedAt: Date;
  status: CompetitionEntryStatus;
  currentRank: number | null;
  currentScore: number | null;
  metadata: Record<string, unknown>;
}

// ============================================
// SERVICE
// ============================================

class CompetitionService {
  /**
   * Create a new competition
   */
  async createCompetition(
    input: Omit<Competition, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Competition> {
    const result = await query<{
      id: string;
      name: string;
      type: CompetitionType;
      description: string | null;
      start_date: Date;
      end_date: Date;
      rules: CompetitionRules;
      eligibility: CompetitionEligibility;
      scoring_weights: Record<string, number>;
      anti_cheat_policy: Record<string, unknown>;
      prize_metadata: Record<string, unknown>;
      status: CompetitionStatus;
      created_by: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `INSERT INTO competitions 
       (name, type, description, start_date, end_date, rules, eligibility, scoring_weights, anti_cheat_policy, prize_metadata, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        input.name,
        input.type,
        input.description || null,
        input.startDate,
        input.endDate,
        JSON.stringify(input.rules),
        JSON.stringify(input.eligibility),
        JSON.stringify(input.scoringWeights),
        JSON.stringify(input.antiCheatPolicy),
        JSON.stringify(input.prizeMetadata),
        input.status,
        input.createdBy || null,
      ]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      description: row.description,
      startDate: row.start_date,
      endDate: row.end_date,
      rules: row.rules as CompetitionRules,
      eligibility: row.eligibility as CompetitionEligibility,
      scoringWeights: row.scoring_weights,
      antiCheatPolicy: row.anti_cheat_policy,
      prizeMetadata: row.prize_metadata,
      status: row.status,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get competition by ID
   */
  async getCompetition(competitionId: string): Promise<Competition | null> {
    const result = await query<{
      id: string;
      name: string;
      type: CompetitionType;
      description: string | null;
      start_date: Date;
      end_date: Date;
      rules: CompetitionRules;
      eligibility: CompetitionEligibility;
      scoring_weights: Record<string, number>;
      anti_cheat_policy: Record<string, unknown>;
      prize_metadata: Record<string, unknown>;
      status: CompetitionStatus;
      created_by: string | null;
      created_at: Date;
      updated_at: Date;
    }>(`SELECT * FROM competitions WHERE id = $1`, [competitionId]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      description: row.description,
      startDate: row.start_date,
      endDate: row.end_date,
      rules: row.rules as CompetitionRules,
      eligibility: row.eligibility as CompetitionEligibility,
      scoringWeights: row.scoring_weights,
      antiCheatPolicy: row.anti_cheat_policy,
      prizeMetadata: row.prize_metadata,
      status: row.status,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Get active competitions
   */
  async getActiveCompetitions(statusFilter?: string): Promise<(Competition & { participantCount: number })[]> {
    // Build WHERE clause based on status filter
    let whereClause: string;
    if (statusFilter === 'active') {
      whereClause = `WHERE c.status = 'active' AND c.start_date <= CURRENT_TIMESTAMP AND c.end_date >= CURRENT_TIMESTAMP`;
    } else if (statusFilter === 'ended') {
      whereClause = `WHERE c.status = 'ended' OR c.end_date < CURRENT_TIMESTAMP`;
    } else {
      // Default: return all competitions
      whereClause = `WHERE 1=1`;
    }

    const result = await query<{
      id: string;
      name: string;
      type: CompetitionType;
      description: string | null;
      start_date: Date;
      end_date: Date;
      rules: CompetitionRules;
      eligibility: CompetitionEligibility;
      scoring_weights: Record<string, number>;
      anti_cheat_policy: Record<string, unknown>;
      prize_metadata: Record<string, unknown>;
      status: CompetitionStatus;
      created_by: string | null;
      created_at: Date;
      updated_at: Date;
      participant_count: string;
    }>(
      `SELECT
        c.*,
        COALESCE(COUNT(ce.id), 0)::int as participant_count
       FROM competitions c
       LEFT JOIN competition_entries ce ON c.id = ce.competition_id AND ce.status = 'active'
       ${whereClause}
       GROUP BY c.id
       ORDER BY c.start_date DESC`
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      description: row.description,
      startDate: row.start_date,
      endDate: row.end_date,
      rules: row.rules as CompetitionRules,
      eligibility: row.eligibility as CompetitionEligibility,
      scoringWeights: row.scoring_weights,
      antiCheatPolicy: row.anti_cheat_policy,
      prizeMetadata: row.prize_metadata,
      status: row.status,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      participantCount: parseInt(row.participant_count, 10),
    }));
  }

  /**
   * Check if user is eligible for competition
   */
  async checkEligibility(_userId: string, competition: Competition): Promise<boolean> {
    // Check eligibility criteria
    if (competition.eligibility.regions && competition.eligibility.regions.length > 0) {
      // Would need user's region - simplified for MVP
      // return user.region in competition.eligibility.regions;
    }

    if (competition.eligibility.subscription_tiers && competition.eligibility.subscription_tiers.length > 0) {
      // Would need user's subscription tier - simplified for MVP
      // return user.subscription_tier in competition.eligibility.subscription_tiers;
    }

    // Default: eligible
    return true;
  }

  /**
   * Join a competition
   */
  async joinCompetition(userId: string, competitionId: string): Promise<CompetitionEntry> {
    // Get competition
    const competition = await this.getCompetition(competitionId);
    if (!competition) {
      throw new Error('Competition not found');
    }

    if (competition.status !== 'active') {
      throw new Error('Competition is not active');
    }

    // Check eligibility
    const isEligible = await this.checkEligibility(userId, competition);
    if (!isEligible) {
      throw new Error('User is not eligible for this competition');
    }

    // Check if already joined
    const existingResult = await query<{ id: string }>(
      `SELECT id FROM competition_entries 
       WHERE competition_id = $1 AND user_id = $2`,
      [competitionId, userId]
    );

    if (existingResult.rows.length > 0) {
      throw ApiError.conflict('User already joined this competition');
    }

    // Create entry
    const result = await query<{
      id: string;
      competition_id: string;
      user_id: string;
      joined_at: Date;
      status: CompetitionEntryStatus;
      current_rank: number | null;
      current_score: number | null;
      metadata: Record<string, unknown>;
    }>(
      `INSERT INTO competition_entries 
       (competition_id, user_id, status)
       VALUES ($1, $2, 'active')
       RETURNING *`,
      [competitionId, userId]
    );

    const row = result.rows[0];
    logger.info('[Competition] User joined competition', { userId, competitionId });

    return {
      id: row.id,
      competitionId: row.competition_id,
      userId: row.user_id,
      joinedAt: row.joined_at,
      status: row.status,
      currentRank: row.current_rank,
      currentScore: row.current_score ? parseFloat(row.current_score.toString()) : null,
      metadata: row.metadata as Record<string, unknown>,
    };
  }

  /**
   * Get competition leaderboard
   */
  async getCompetitionLeaderboard(
    competitionId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<{ entries: CompetitionEntry[]; total: number }> {
    // Get total count
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM competition_entries 
       WHERE competition_id = $1 AND status IN ('active', 'completed')`,
      [competitionId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get entries enriched with user data
    const result = await query<{
      id: string;
      competition_id: string;
      user_id: string;
      joined_at: Date;
      status: CompetitionEntryStatus;
      current_rank: number | null;
      current_score: number | null;
      metadata: Record<string, unknown>;
      first_name: string | null;
      last_name: string | null;
      avatar: string | null;
    }>(
      `SELECT ce.*, u.first_name, u.last_name, u.avatar
       FROM competition_entries ce
       LEFT JOIN users u ON u.id = ce.user_id
       WHERE ce.competition_id = $1 AND ce.status IN ('active', 'completed')
       ORDER BY ce.current_score DESC NULLS LAST, ce.joined_at ASC
       LIMIT $2 OFFSET $3`,
      [competitionId, limit, offset]
    );

    const entries = result.rows.map((row) => {
      const nameParts = [row.first_name, row.last_name].filter(Boolean);
      const entry: CompetitionEntry & { user?: { name: string; avatar?: string } } = {
        id: row.id,
        competitionId: row.competition_id,
        userId: row.user_id,
        joinedAt: row.joined_at,
        status: row.status,
        currentRank: row.current_rank,
        currentScore: row.current_score ? parseFloat(row.current_score.toString()) : null,
        metadata: row.metadata as Record<string, unknown>,
      };
      if (nameParts.length > 0) {
        entry.user = {
          name: nameParts.join(' '),
          avatar: row.avatar || undefined,
        };
      }
      return entry;
    });

    return { entries, total };
  }

  /**
   * Leave a competition (soft delete - sets status to 'withdrawn')
   */
  async leaveCompetition(userId: string, competitionId: string): Promise<void> {
    // Verify competition exists
    const competition = await this.getCompetition(competitionId);
    if (!competition) {
      throw ApiError.notFound('Competition not found');
    }

    // Verify user is enrolled with active status
    const existingResult = await query<{ id: string; status: string }>(
      `SELECT id, status FROM competition_entries
       WHERE competition_id = $1 AND user_id = $2`,
      [competitionId, userId]
    );

    if (existingResult.rows.length === 0) {
      throw ApiError.notFound('You are not enrolled in this competition');
    }

    if (existingResult.rows[0].status === 'withdrawn') {
      throw ApiError.conflict('You have already left this competition');
    }

    if (existingResult.rows[0].status !== 'active') {
      throw ApiError.conflict(`Cannot leave: entry status is '${existingResult.rows[0].status}'`);
    }

    // Soft delete - set status to withdrawn
    await query(
      `UPDATE competition_entries SET status = 'withdrawn', updated_at = CURRENT_TIMESTAMP
       WHERE competition_id = $1 AND user_id = $2 AND status = 'active'`,
      [competitionId, userId]
    );

    logger.info('[Competition] User left competition', { userId, competitionId });
  }

  /**
   * Update competition entry scores and ranks based on competition rules
   */
  async updateCompetitionScores(competitionId: string): Promise<{ updatedCount: number }> {
    const competition = await this.getCompetition(competitionId);
    if (!competition) {
      logger.warn('[Competition] Cannot update scores: competition not found', { competitionId });
      return { updatedCount: 0 };
    }

    const { metric, aggregation } = competition.rules;

    // Map metric to the JSONB field path in daily_user_scores.component_scores
    const metricColumn = metric === 'total'
      ? 'dus.total_score'
      : `(dus.component_scores->>'${metric}')::numeric`;

    // Map aggregation type to SQL aggregate function
    let aggFunction: string;
    switch (aggregation) {
      case 'total':
        aggFunction = `SUM(${metricColumn})`;
        break;
      case 'average':
        aggFunction = `AVG(${metricColumn})`;
        break;
      case 'max':
        aggFunction = `MAX(${metricColumn})`;
        break;
      case 'streak':
        // Streak = count of distinct days where the user had any activity
        aggFunction = `COUNT(DISTINCT dus.date)`;
        break;
      default:
        aggFunction = `SUM(${metricColumn})`;
    }

    // Single UPDATE ... FROM (CTE) that calculates scores and ranks in one pass
    const result = await query(
      `WITH scored AS (
        SELECT
          ce.id AS entry_id,
          ce.user_id,
          COALESCE(${aggFunction}, 0) AS computed_score
        FROM competition_entries ce
        LEFT JOIN daily_user_scores dus
          ON dus.user_id = ce.user_id
          AND dus.date >= $2::date
          AND dus.date <= $3::date
        WHERE ce.competition_id = $1
          AND ce.status = 'active'
        GROUP BY ce.id, ce.user_id
      ),
      ranked AS (
        SELECT
          entry_id,
          computed_score,
          ROW_NUMBER() OVER (ORDER BY computed_score DESC) AS computed_rank
        FROM scored
      )
      UPDATE competition_entries ce
      SET
        current_score = r.computed_score,
        current_rank = r.computed_rank,
        updated_at = CURRENT_TIMESTAMP
      FROM ranked r
      WHERE ce.id = r.entry_id`,
      [
        competitionId,
        competition.startDate.toISOString().split('T')[0],
        competition.endDate.toISOString().split('T')[0],
      ]
    );

    const updatedCount = result.rowCount ?? 0;
    logger.info('[Competition] Updated competition scores', { competitionId, updatedCount });
    return { updatedCount };
  }

  /**
   * Get user's competition entries (competitions they've joined)
   */
  async getUserCompetitionEntries(userId: string): Promise<string[]> {
    const result = await query<{ competition_id: string }>(
      `SELECT competition_id FROM competition_entries 
       WHERE user_id = $1 AND status IN ('active', 'completed')`,
      [userId]
    );

    return result.rows.map((row) => row.competition_id);
  }
}

// Export singleton instance
export const competitionService = new CompetitionService();
export default competitionService;

