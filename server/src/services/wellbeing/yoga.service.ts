/**
 * @file Yoga Service
 * @description Core CRUD operations for yoga & meditation module (F7.9)
 */

import { query } from '../../database/pg.js';
import { ApiError } from '../../utils/ApiError.js';
import type {
  YogaPose,
  PoseListFilter,
  YogaSession,
  YogaSessionLog,
  MeditationTimer,
  YogaStreak,
  YogaMilestone,
  YogaMilestoneType,
  YogaStats,
  YogaHistoryFilter,
  StartSessionInput,
  UpdateSessionLogInput,
  CompleteSessionInput,
  StartMeditationInput,
} from '@shared/types/domain/yoga.js';

// ============================================
// ROW TYPES (DB → TS mapping)
// ============================================

interface PoseRow {
  id: string;
  english_name: string;
  sanskrit_name: string | null;
  slug: string;
  category: string;
  difficulty: string;
  description: string | null;
  benefits: string[] | null;
  muscle_groups: string[] | null;
  contraindications: string[] | null;
  cues: any;
  breathing_cue: string | null;
  hold_seconds_default: number;
  svg_key: string | null;
  is_recovery_pose: boolean;
  recovery_targets: string[] | null;
  joint_targets: Record<string, { angle: number; tolerance: number }> | null;
  created_at: Date;
  updated_at: Date;
}

interface SessionRow {
  id: string;
  user_id: string | null;
  title: string;
  description: string | null;
  session_type: string;
  meditation_mode: string | null;
  difficulty: string;
  duration_minutes: number;
  is_template: boolean;
  is_ai_generated: boolean;
  phases: any;
  generation_prompt: string | null;
  whoop_context: any;
  workout_context: any;
  ambient_theme: string;
  background_music_tag: string | null;
  tags: string[] | null;
  created_at: Date;
  updated_at: Date;
}

interface SessionLogRow {
  id: string;
  user_id: string;
  session_id: string | null;
  session_type: string;
  meditation_mode: string | null;
  started_at: Date;
  completed_at: Date | null;
  actual_duration_seconds: number | null;
  completion_rate: number | null;
  phases_completed: number;
  phases_total: number;
  mood_before: number | null;
  mood_after: number | null;
  difficulty_rating: number | null;
  effectiveness_rating: number | null;
  notes: string | null;
  voice_guide_used: boolean;
  music_played: boolean;
  pose_correction_used: boolean;
  pre_session_hrv: number | null;
  recovery_score_at_time: number | null;
  created_at: Date;
  updated_at: Date;
}

interface MeditationTimerRow {
  id: string;
  user_id: string;
  mode: string;
  duration_minutes: number;
  ambient_sound: string | null;
  interval_bell_seconds: number;
  completed: boolean;
  started_at: Date;
  completed_at: Date | null;
  created_at: Date;
}

interface StreakRow {
  id: string;
  user_id: string;
  current_streak: number;
  longest_streak: number;
  total_sessions: number;
  total_minutes: number;
  last_session_date: string | null;
  milestones_achieved: any;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// MILESTONE DEFINITIONS
// ============================================

const MILESTONE_CHECKS: Array<{
  type: YogaMilestoneType;
  check: (streak: YogaStreak) => boolean;
}> = [
  { type: '3_day_streak', check: (s) => s.currentStreak >= 3 },
  { type: '7_day_streak', check: (s) => s.currentStreak >= 7 },
  { type: '14_day_streak', check: (s) => s.currentStreak >= 14 },
  { type: '30_day_streak', check: (s) => s.currentStreak >= 30 },
  { type: '10_sessions', check: (s) => s.totalSessions >= 10 },
  { type: '30_sessions', check: (s) => s.totalSessions >= 30 },
  { type: '50_sessions', check: (s) => s.totalSessions >= 50 },
  { type: '100_sessions', check: (s) => s.totalSessions >= 100 },
  { type: '100_minutes', check: (s) => s.totalMinutes >= 100 },
  { type: '500_minutes', check: (s) => s.totalMinutes >= 500 },
  { type: '1000_minutes', check: (s) => s.totalMinutes >= 1000 },
];

// ============================================
// SERVICE CLASS
// ============================================

class YogaService {
  // ------------------------------------------
  // POSES
  // ------------------------------------------

  async listPoses(filter: PoseListFilter): Promise<{ poses: YogaPose[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filter.category) {
      conditions.push(`category = $${paramIndex++}`);
      params.push(filter.category);
    }
    if (filter.difficulty) {
      conditions.push(`difficulty = $${paramIndex++}`);
      params.push(filter.difficulty);
    }
    if (filter.muscleGroup) {
      conditions.push(`$${paramIndex++} = ANY(muscle_groups)`);
      params.push(filter.muscleGroup);
    }
    if (filter.isRecovery !== undefined) {
      conditions.push(`is_recovery_pose = $${paramIndex++}`);
      params.push(filter.isRecovery);
    }
    if (filter.search) {
      conditions.push(`(english_name ILIKE $${paramIndex} OR sanskrit_name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      params.push(`%${filter.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM yoga_poses ${whereClause}`,
      params
    );

    const limit = filter.limit || 50;
    const offset = filter.offset || 0;

    const result = await query<PoseRow>(
      `SELECT * FROM yoga_poses ${whereClause} ORDER BY category, difficulty, english_name LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    return {
      poses: result.rows.map((r) => this.mapPoseRow(r)),
      total: parseInt(countResult.rows[0].count),
    };
  }

  async getPoseBySlug(slug: string): Promise<YogaPose> {
    const result = await query<PoseRow>(
      `SELECT * FROM yoga_poses WHERE slug = $1`,
      [slug]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Pose not found');
    }

    return this.mapPoseRow(result.rows[0]);
  }

  // ------------------------------------------
  // SESSIONS (Templates + User)
  // ------------------------------------------

  async getTemplates(): Promise<YogaSession[]> {
    const result = await query<SessionRow>(
      `SELECT * FROM yoga_sessions WHERE is_template = true ORDER BY session_type, difficulty, duration_minutes`
    );
    return result.rows.map((r) => this.mapSessionRow(r));
  }

  async getUserSessions(userId: string, filter?: { sessionType?: string; limit?: number; offset?: number }): Promise<YogaSession[]> {
    const conditions = ['user_id = $1', 'is_template = false'];
    const params: any[] = [userId];
    let paramIndex = 2;

    if (filter?.sessionType) {
      conditions.push(`session_type = $${paramIndex++}`);
      params.push(filter.sessionType);
    }

    const limit = filter?.limit || 20;
    const offset = filter?.offset || 0;

    const result = await query<SessionRow>(
      `SELECT * FROM yoga_sessions WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    return result.rows.map((r) => this.mapSessionRow(r));
  }

  async getSessionById(sessionId: string, userId?: string): Promise<YogaSession> {
    const result = await query<SessionRow>(
      `SELECT * FROM yoga_sessions WHERE id = $1 AND (is_template = true OR user_id = $2)`,
      [sessionId, userId || null]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Session not found');
    }

    return this.mapSessionRow(result.rows[0]);
  }

  async deleteSession(sessionId: string, userId: string): Promise<void> {
    const result = await query(
      `DELETE FROM yoga_sessions WHERE id = $1 AND user_id = $2 AND is_template = false RETURNING id`,
      [sessionId, userId]
    );

    if (result.rowCount === 0) {
      throw ApiError.notFound('Session not found or cannot be deleted');
    }
  }

  // ------------------------------------------
  // SESSION LOGS
  // ------------------------------------------

  /**
   * Start an AI Coach pose practice session (no yoga_sessions template required).
   */
  async startAICoachSession(userId: string, poseSlug: string, poseName: string): Promise<YogaSessionLog> {
    const result = await query<SessionLogRow>(
      `INSERT INTO yoga_session_logs (
        user_id, session_id, session_type,
        started_at, phases_total, pose_correction_used, notes
      ) VALUES ($1, NULL, 'ai_generated', CURRENT_TIMESTAMP, 1, true, $2)
      RETURNING *`,
      [userId, `AI Coach: ${poseName} (${poseSlug})`]
    );

    return this.mapSessionLogRow(result.rows[0]);
  }

  /**
   * Complete an AI Coach session with final score and duration.
   */
  async completeAICoachSession(
    logId: string,
    userId: string,
    input: { durationSeconds: number; averageScore: number; poseName: string },
  ): Promise<YogaSessionLog> {
    const completionRate = Math.min(100, Math.max(0, input.averageScore));

    const result = await query<SessionLogRow>(
      `UPDATE yoga_session_logs SET
        completed_at = CURRENT_TIMESTAMP,
        actual_duration_seconds = $1,
        completion_rate = $2,
        phases_completed = 1,
        pose_correction_used = true,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND user_id = $4
      RETURNING *`,
      [input.durationSeconds, completionRate, logId, userId]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Session log not found');
    }

    // Update streak
    const durationMinutes = Math.round(input.durationSeconds / 60);
    await this.updateStreak(userId, durationMinutes);

    return this.mapSessionLogRow(result.rows[0]);
  }

  async startSession(userId: string, input: StartSessionInput): Promise<YogaSessionLog> {
    // Verify session exists
    const session = await query<SessionRow>(
      `SELECT * FROM yoga_sessions WHERE id = $1`,
      [input.sessionId]
    );

    if (session.rows.length === 0) {
      throw ApiError.notFound('Session not found');
    }

    const s = session.rows[0];

    const result = await query<SessionLogRow>(
      `INSERT INTO yoga_session_logs (
        user_id, session_id, session_type, meditation_mode,
        started_at, phases_total, mood_before,
        pre_session_hrv, recovery_score_at_time
      ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6, $7, $8)
      RETURNING *`,
      [
        userId,
        input.sessionId,
        s.session_type,
        s.meditation_mode,
        Array.isArray(s.phases) ? s.phases.length : 0,
        input.moodBefore || null,
        input.preSessionHrv || null,
        input.recoveryScoreAtTime || null,
      ]
    );

    return this.mapSessionLogRow(result.rows[0]);
  }

  async updateSessionLog(logId: string, userId: string, input: UpdateSessionLogInput): Promise<YogaSessionLog> {
    const sets: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.phasesCompleted !== undefined) {
      sets.push(`phases_completed = $${paramIndex++}`);
      params.push(input.phasesCompleted);
    }
    if (input.actualDurationSeconds !== undefined) {
      sets.push(`actual_duration_seconds = $${paramIndex++}`);
      params.push(input.actualDurationSeconds);
    }
    if (input.voiceGuideUsed !== undefined) {
      sets.push(`voice_guide_used = $${paramIndex++}`);
      params.push(input.voiceGuideUsed);
    }
    if (input.musicPlayed !== undefined) {
      sets.push(`music_played = $${paramIndex++}`);
      params.push(input.musicPlayed);
    }
    if (input.poseCorrectionUsed !== undefined) {
      sets.push(`pose_correction_used = $${paramIndex++}`);
      params.push(input.poseCorrectionUsed);
    }

    sets.push(`updated_at = CURRENT_TIMESTAMP`);

    const result = await query<SessionLogRow>(
      `UPDATE yoga_session_logs SET ${sets.join(', ')} WHERE id = $${paramIndex++} AND user_id = $${paramIndex++} RETURNING *`,
      [...params, logId, userId]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Session log not found');
    }

    return this.mapSessionLogRow(result.rows[0]);
  }

  async completeSession(logId: string, userId: string, input: CompleteSessionInput): Promise<YogaSessionLog> {
    const result = await query<SessionLogRow>(
      `UPDATE yoga_session_logs SET
        completed_at = CURRENT_TIMESTAMP,
        mood_after = $1,
        difficulty_rating = $2,
        effectiveness_rating = $3,
        notes = $4,
        completion_rate = $5,
        phases_completed = COALESCE($6, phases_completed),
        actual_duration_seconds = COALESCE($7, actual_duration_seconds),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8 AND user_id = $9
      RETURNING *`,
      [
        input.moodAfter || null,
        input.difficultyRating || null,
        input.effectivenessRating || null,
        input.notes || null,
        input.completionRate || null,
        input.phasesCompleted ?? null,
        input.actualDurationSeconds || null,
        logId,
        userId,
      ]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Session log not found');
    }

    // Update streak after completion
    const log = result.rows[0];
    const durationMinutes = Math.ceil((log.actual_duration_seconds || 0) / 60);
    await this.updateStreak(userId, durationMinutes);

    // Record for unified streak system
    import('../streak.service.js').then(({ streakService }) =>
      streakService.recordActivity(userId, 'yoga', logId)
    ).catch(() => {});

    return this.mapSessionLogRow(log);
  }

  // ------------------------------------------
  // MEDITATION TIMERS
  // ------------------------------------------

  async startMeditation(userId: string, input: StartMeditationInput): Promise<MeditationTimer> {
    const result = await query<MeditationTimerRow>(
      `INSERT INTO meditation_timers (user_id, mode, duration_minutes, ambient_sound, interval_bell_seconds, started_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       RETURNING *`,
      [userId, input.mode, input.durationMinutes, input.ambientSound || null, input.intervalBellSeconds || 0]
    );

    return this.mapMeditationTimerRow(result.rows[0]);
  }

  async completeMeditation(timerId: string, userId: string): Promise<MeditationTimer> {
    const result = await query<MeditationTimerRow>(
      `UPDATE meditation_timers SET completed = true, completed_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [timerId, userId]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Meditation timer not found');
    }

    // Update streak
    const timer = result.rows[0];
    await this.updateStreak(userId, timer.duration_minutes);

    return this.mapMeditationTimerRow(timer);
  }

  // ------------------------------------------
  // STREAKS & PROGRESS
  // ------------------------------------------

  async getStreak(userId: string): Promise<YogaStreak> {
    const result = await query<StreakRow>(
      `SELECT * FROM yoga_streaks WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // Create initial streak record
      const created = await query<StreakRow>(
        `INSERT INTO yoga_streaks (user_id) VALUES ($1) RETURNING *`,
        [userId]
      );
      return this.mapStreakRow(created.rows[0]);
    }

    return this.mapStreakRow(result.rows[0]);
  }

  async updateStreak(userId: string, sessionDurationMinutes: number): Promise<YogaStreak> {
    const today = new Date().toISOString().split('T')[0];

    // Get or create streak
    let streak = await this.getStreak(userId);

    const lastDate = streak.lastSessionDate;
    let newCurrent = streak.currentStreak;

    if (!lastDate) {
      // First session ever
      newCurrent = 1;
    } else if (lastDate === today) {
      // Already logged today, no streak change
    } else {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (lastDate === yesterdayStr) {
        newCurrent = streak.currentStreak + 1;
      } else {
        // Streak broken
        newCurrent = 1;
      }
    }

    const newLongest = Math.max(streak.longestStreak, newCurrent);
    const newTotalSessions = streak.totalSessions + 1;
    const newTotalMinutes = streak.totalMinutes + sessionDurationMinutes;

    const result = await query<StreakRow>(
      `UPDATE yoga_streaks SET
        current_streak = $1,
        longest_streak = $2,
        total_sessions = $3,
        total_minutes = $4,
        last_session_date = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $6
      RETURNING *`,
      [newCurrent, newLongest, newTotalSessions, newTotalMinutes, today, userId]
    );

    const updatedStreak = this.mapStreakRow(result.rows[0]);

    // Check milestones
    await this.checkAndAwardMilestones(userId, updatedStreak);

    return updatedStreak;
  }

  private async checkAndAwardMilestones(userId: string, streak: YogaStreak): Promise<void> {
    const existingMilestones = new Set(streak.milestonesAchieved.map((m) => m.milestone));
    const newMilestones: YogaMilestone[] = [];

    for (const check of MILESTONE_CHECKS) {
      if (!existingMilestones.has(check.type) && check.check(streak)) {
        newMilestones.push({
          milestone: check.type,
          achievedAt: new Date().toISOString(),
        });
      }
    }

    if (newMilestones.length > 0) {
      const allMilestones = [...streak.milestonesAchieved, ...newMilestones];
      await query(
        `UPDATE yoga_streaks SET milestones_achieved = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
        [JSON.stringify(allMilestones), userId]
      );
    }
  }

  // ------------------------------------------
  // HISTORY & STATS
  // ------------------------------------------

  async getHistory(userId: string, filter: YogaHistoryFilter): Promise<{ logs: YogaSessionLog[]; total: number }> {
    const conditions = ['user_id = $1'];
    const params: any[] = [userId];
    let paramIndex = 2;

    if (filter.sessionType) {
      conditions.push(`session_type = $${paramIndex++}`);
      params.push(filter.sessionType);
    }
    if (filter.startDate) {
      conditions.push(`started_at >= $${paramIndex++}`);
      params.push(filter.startDate);
    }
    if (filter.endDate) {
      conditions.push(`started_at <= $${paramIndex++}`);
      params.push(filter.endDate + 'T23:59:59Z');
    }

    const whereClause = conditions.join(' AND ');
    const limit = filter.limit || 20;
    const offset = filter.offset || 0;

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM yoga_session_logs WHERE ${whereClause}`,
      params
    );

    const result = await query<SessionLogRow>(
      `SELECT * FROM yoga_session_logs WHERE ${whereClause} ORDER BY started_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...params, limit, offset]
    );

    return {
      logs: result.rows.map((r) => this.mapSessionLogRow(r)),
      total: parseInt(countResult.rows[0].count),
    };
  }

  async getStats(userId: string): Promise<YogaStats> {
    const streak = await this.getStreak(userId);

    // Session count by type
    const byTypeResult = await query<{ session_type: string; count: string }>(
      `SELECT session_type, COUNT(*) as count FROM yoga_session_logs WHERE user_id = $1 AND completed_at IS NOT NULL GROUP BY session_type`,
      [userId]
    );

    // Average duration
    const avgResult = await query<{ avg_duration: string | null; avg_mood_delta: string | null }>(
      `SELECT
        AVG(actual_duration_seconds / 60.0) as avg_duration,
        AVG(mood_after - mood_before) as avg_mood_delta
       FROM yoga_session_logs
       WHERE user_id = $1 AND completed_at IS NOT NULL AND actual_duration_seconds > 0`,
      [userId]
    );

    // Heatmap data (last 90 days)
    const heatmapResult = await query<{ date: string; count: string }>(
      `SELECT DATE(started_at) as date, COUNT(*) as count
       FROM yoga_session_logs
       WHERE user_id = $1 AND started_at >= CURRENT_DATE - INTERVAL '90 days'
       GROUP BY DATE(started_at) ORDER BY date`,
      [userId]
    );

    // Recent trend (last 7 days vs previous 7 days)
    const trendResult = await query<{ period: string; count: string }>(
      `SELECT
        CASE WHEN started_at >= CURRENT_DATE - INTERVAL '7 days' THEN 'recent' ELSE 'previous' END as period,
        COUNT(*) as count
       FROM yoga_session_logs
       WHERE user_id = $1 AND started_at >= CURRENT_DATE - INTERVAL '14 days' AND completed_at IS NOT NULL
       GROUP BY period`,
      [userId]
    );

    const recent = parseInt(trendResult.rows.find((r) => r.period === 'recent')?.count || '0');
    const previous = parseInt(trendResult.rows.find((r) => r.period === 'previous')?.count || '0');

    let recentTrend: 'improving' | 'stable' | 'declining' = 'stable';
    if (recent > previous) recentTrend = 'improving';
    else if (recent < previous) recentTrend = 'declining';

    return {
      streak,
      totalSessions: streak.totalSessions,
      totalMinutes: streak.totalMinutes,
      averageDurationMinutes: parseFloat(avgResult.rows[0]?.avg_duration || '0'),
      averageMoodDelta: parseFloat(avgResult.rows[0]?.avg_mood_delta || '0'),
      sessionsByType: byTypeResult.rows.map((r) => ({
        sessionType: r.session_type,
        count: parseInt(r.count),
      })),
      heatmapData: heatmapResult.rows.map((r) => ({
        date: r.date,
        count: parseInt(r.count),
      })),
      recentTrend,
    };
  }

  // ------------------------------------------
  // ROW MAPPERS
  // ------------------------------------------

  private mapPoseRow(row: PoseRow): YogaPose {
    return {
      id: row.id,
      englishName: row.english_name,
      sanskritName: row.sanskrit_name || undefined,
      slug: row.slug,
      category: row.category as any,
      difficulty: row.difficulty as any,
      description: row.description || undefined,
      benefits: row.benefits || [],
      muscleGroups: row.muscle_groups || [],
      contraindications: row.contraindications || [],
      cues: Array.isArray(row.cues) ? row.cues : [],
      breathingCue: row.breathing_cue || undefined,
      holdSecondsDefault: row.hold_seconds_default,
      svgKey: row.svg_key || undefined,
      isRecoveryPose: row.is_recovery_pose,
      recoveryTargets: row.recovery_targets || [],
      jointTargets: row.joint_targets || undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private mapSessionRow(row: SessionRow): YogaSession {
    return {
      id: row.id,
      userId: row.user_id || undefined,
      title: row.title,
      description: row.description || undefined,
      sessionType: row.session_type as any,
      meditationMode: row.meditation_mode as any || undefined,
      difficulty: row.difficulty as any,
      durationMinutes: row.duration_minutes,
      isTemplate: row.is_template,
      isAiGenerated: row.is_ai_generated,
      phases: Array.isArray(row.phases) ? row.phases : [],
      generationPrompt: row.generation_prompt || undefined,
      whoopContext: row.whoop_context || undefined,
      workoutContext: row.workout_context || undefined,
      ambientTheme: row.ambient_theme as any,
      backgroundMusicTag: row.background_music_tag || undefined,
      tags: row.tags || [],
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private mapSessionLogRow(row: SessionLogRow): YogaSessionLog {
    return {
      id: row.id,
      userId: row.user_id,
      sessionId: row.session_id || undefined,
      sessionType: row.session_type as any,
      meditationMode: row.meditation_mode as any || undefined,
      startedAt: row.started_at.toISOString(),
      completedAt: row.completed_at?.toISOString() || undefined,
      actualDurationSeconds: row.actual_duration_seconds || undefined,
      completionRate: row.completion_rate ? parseFloat(String(row.completion_rate)) : undefined,
      phasesCompleted: row.phases_completed,
      phasesTotal: row.phases_total,
      moodBefore: row.mood_before || undefined,
      moodAfter: row.mood_after || undefined,
      difficultyRating: row.difficulty_rating || undefined,
      effectivenessRating: row.effectiveness_rating || undefined,
      notes: row.notes || undefined,
      voiceGuideUsed: row.voice_guide_used,
      musicPlayed: row.music_played,
      poseCorrectionUsed: row.pose_correction_used,
      preSessionHrv: row.pre_session_hrv ? parseFloat(String(row.pre_session_hrv)) : undefined,
      recoveryScoreAtTime: row.recovery_score_at_time ? parseFloat(String(row.recovery_score_at_time)) : undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at?.toISOString(),
    };
  }

  private mapMeditationTimerRow(row: MeditationTimerRow): MeditationTimer {
    return {
      id: row.id,
      userId: row.user_id,
      mode: row.mode as any,
      durationMinutes: row.duration_minutes,
      ambientSound: row.ambient_sound as any || undefined,
      intervalBellSeconds: row.interval_bell_seconds,
      completed: row.completed,
      startedAt: row.started_at.toISOString(),
      completedAt: row.completed_at?.toISOString() || undefined,
      createdAt: row.created_at.toISOString(),
    };
  }

  private mapStreakRow(row: StreakRow): YogaStreak {
    return {
      id: row.id,
      userId: row.user_id,
      currentStreak: row.current_streak,
      longestStreak: row.longest_streak,
      totalSessions: row.total_sessions,
      totalMinutes: row.total_minutes,
      lastSessionDate: row.last_session_date || undefined,
      milestonesAchieved: Array.isArray(row.milestones_achieved) ? row.milestones_achieved : [],
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}

export const yogaService = new YogaService();
