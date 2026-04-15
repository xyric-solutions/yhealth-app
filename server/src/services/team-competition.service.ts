/**
 * @file Team Competition Service
 * @description Social accountability through teams and competitions.
 * Teams of up to 5 members compete on XP, streak, or custom metrics.
 * Social pressure + collaboration drive engagement.
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';

// ============================================
// TYPES
// ============================================

export type TeamType = 'accountability' | 'competition';

export interface Team {
  id: string;
  name: string;
  type: TeamType;
  maxMembers: number;
  createdBy: string;
  memberCount: number;
  createdAt: string;
}

export interface TeamMember {
  teamId: string;
  userId: string;
  role: 'captain' | 'member';
  joinedAt: string;
  userName?: string;
  totalXP?: number;
  currentStreak?: number;
}

export interface TeamStanding {
  teamId: string;
  teamName: string;
  totalXP: number;
  averageStreak: number;
  memberCount: number;
  rank: number;
}

// ============================================
// SERVICE CLASS
// ============================================

class TeamCompetitionService {
  private tableEnsured = false;

  private async ensureTable(): Promise<void> {
    if (this.tableEnsured) return;
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS teams (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(100) NOT NULL,
          type VARCHAR(20) NOT NULL DEFAULT 'accountability',
          max_members INTEGER DEFAULT 5,
          created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await query(`
        CREATE TABLE IF NOT EXISTS team_members (
          team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role VARCHAR(20) DEFAULT 'member',
          joined_at TIMESTAMPTZ DEFAULT NOW(),
          PRIMARY KEY (team_id, user_id)
        )
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_tm_user ON team_members(user_id)
      `);
      this.tableEnsured = true;
    } catch (error) {
      logger.error('[TeamCompetition] Error ensuring tables', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ---- Team CRUD ----

  async createTeam(name: string, type: TeamType, createdBy: string): Promise<Team | null> {
    await this.ensureTable();
    try {
      const result = await query<{
        id: string; name: string; type: TeamType; max_members: number;
        created_by: string; created_at: string;
      }>(
        `INSERT INTO teams (name, type, created_by)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [name, type, createdBy]
      );
      if (result.rows.length === 0) return null;
      const row = result.rows[0];

      // Auto-add creator as captain
      await query(
        `INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'captain')`,
        [row.id, createdBy]
      );

      return {
        id: row.id,
        name: row.name,
        type: row.type,
        maxMembers: row.max_members,
        createdBy: row.created_by,
        memberCount: 1,
        createdAt: row.created_at,
      };
    } catch (error) {
      logger.error('[TeamCompetition] Error creating team', {
        name,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return null;
    }
  }

  async joinTeam(teamId: string, userId: string): Promise<boolean> {
    await this.ensureTable();
    try {
      // Check team capacity
      const team = await query<{ max_members: number; member_count: string }>(
        `SELECT t.max_members, COUNT(tm.user_id) as member_count
         FROM teams t LEFT JOIN team_members tm ON tm.team_id = t.id
         WHERE t.id = $1 GROUP BY t.max_members`,
        [teamId]
      );
      if (team.rows.length === 0) return false;
      if (parseInt(team.rows[0].member_count, 10) >= team.rows[0].max_members) return false;

      await query(
        `INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'member')
         ON CONFLICT (team_id, user_id) DO NOTHING`,
        [teamId, userId]
      );
      return true;
    } catch (error) {
      logger.error('[TeamCompetition] Error joining team', {
        teamId, userId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return false;
    }
  }

  async leaveTeam(teamId: string, userId: string): Promise<boolean> {
    await this.ensureTable();
    try {
      await query(
        `DELETE FROM team_members WHERE team_id = $1 AND user_id = $2`,
        [teamId, userId]
      );
      return true;
    } catch (error) {
      logger.error('[TeamCompetition] Error leaving team', {
        teamId, userId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return false;
    }
  }

  // ---- Team Data ----

  async getUserTeams(userId: string): Promise<Team[]> {
    await this.ensureTable();
    try {
      const result = await query<{
        id: string; name: string; type: TeamType; max_members: number;
        created_by: string; created_at: string; member_count: string;
      }>(
        `SELECT t.*, COUNT(tm2.user_id) as member_count
         FROM teams t
         INNER JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = $1
         LEFT JOIN team_members tm2 ON tm2.team_id = t.id
         GROUP BY t.id`,
        [userId]
      );
      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        type: row.type,
        maxMembers: row.max_members,
        createdBy: row.created_by,
        memberCount: parseInt(row.member_count, 10),
        createdAt: row.created_at,
      }));
    } catch (error) {
      logger.error('[TeamCompetition] Error fetching user teams', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return [];
    }
  }

  async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    await this.ensureTable();
    try {
      const result = await query<{
        team_id: string; user_id: string; role: string; joined_at: string;
        name: string; total_xp: string; current_streak: string;
      }>(
        `SELECT tm.team_id, tm.user_id, tm.role, tm.joined_at,
                u.name, COALESCE(gp.total_xp, 0) as total_xp,
                COALESCE(gp.current_streak, 0) as current_streak
         FROM team_members tm
         INNER JOIN users u ON u.id = tm.user_id
         LEFT JOIN gamification_profiles gp ON gp.user_id = tm.user_id
         WHERE tm.team_id = $1
         ORDER BY total_xp DESC`,
        [teamId]
      );
      return result.rows.map(row => ({
        teamId: row.team_id,
        userId: row.user_id,
        role: row.role as 'captain' | 'member',
        joinedAt: row.joined_at,
        userName: row.name,
        totalXP: parseInt(row.total_xp, 10),
        currentStreak: parseInt(row.current_streak, 10),
      }));
    } catch (error) {
      logger.error('[TeamCompetition] Error fetching team members', {
        teamId,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return [];
    }
  }

  /**
   * Get team standings (ranked by total XP).
   */
  async getTeamStandings(limit = 20): Promise<TeamStanding[]> {
    await this.ensureTable();
    try {
      const result = await query<{
        team_id: string; team_name: string; total_xp: string;
        avg_streak: string; member_count: string;
      }>(
        `SELECT t.id as team_id, t.name as team_name,
                COALESCE(SUM(gp.total_xp), 0) as total_xp,
                COALESCE(AVG(gp.current_streak), 0) as avg_streak,
                COUNT(tm.user_id) as member_count
         FROM teams t
         INNER JOIN team_members tm ON tm.team_id = t.id
         LEFT JOIN gamification_profiles gp ON gp.user_id = tm.user_id
         GROUP BY t.id, t.name
         ORDER BY total_xp DESC
         LIMIT $1`,
        [limit]
      );
      return result.rows.map((row, i) => ({
        teamId: row.team_id,
        teamName: row.team_name,
        totalXP: parseInt(row.total_xp, 10),
        averageStreak: Math.round(parseFloat(row.avg_streak)),
        memberCount: parseInt(row.member_count, 10),
        rank: i + 1,
      }));
    } catch (error) {
      logger.error('[TeamCompetition] Error fetching standings', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return [];
    }
  }
}

export const teamCompetitionService = new TeamCompetitionService();
export default teamCompetitionService;
