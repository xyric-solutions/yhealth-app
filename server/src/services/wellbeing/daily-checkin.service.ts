/**
 * @file Daily Check-in Service
 * @description Morning/evening structured daily check-in with predictions, review, and comparison
 * Cross-logs to mood_logs, energy_logs, stress_logs for backward compatibility
 */

import { query } from '../../database/pg.js';
import type {
  DailyCheckin,
  CreateDailyCheckinInput,
  CheckinTag,
  CheckinType,
  DayComparison,
} from '@shared/types/domain/wellbeing.js';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// TYPES
// ============================================

interface DailyCheckinRow {
  id: string;
  user_id: string;
  checkin_date: string;
  checkin_type: CheckinType;
  mood_score: number | null;
  energy_score: number | null;
  sleep_quality: number | null;
  stress_score: number | null;
  tags: string[] | null;
  day_summary: string | null;
  // Morning-specific
  predicted_mood: number | null;
  predicted_energy: number | null;
  known_stressors: string[] | null;
  // Evening-specific
  day_rating: number | null;
  went_well: string[] | null;
  didnt_go_well: string[] | null;
  evening_lessons: string[] | null;
  tomorrow_focus: string | null;
  // Screen time
  screen_time_minutes: number | null;
  screen_time_source: string | null;
  // Cross-references
  mood_log_id: string | null;
  energy_log_id: string | null;
  stress_log_id: string | null;
  completed_at: Date | null;
  logged_at: Date;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// SERVICE CLASS
// ============================================

class DailyCheckinService {
  /**
   * Create or update a daily check-in (morning or evening)
   * Unique per (user_id, checkin_date, checkin_type)
   */
  async createOrUpdateCheckin(userId: string, input: CreateDailyCheckinInput): Promise<DailyCheckin> {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();
    const checkinType: CheckinType = input.checkinType || 'morning';

    // Check if a check-in already exists for today + type
    const existing = await query<DailyCheckinRow>(
      `SELECT * FROM daily_checkins WHERE user_id = $1 AND checkin_date = $2 AND checkin_type = $3`,
      [userId, today, checkinType]
    );

    // Cross-log to wellbeing tables for backward compatibility
    let moodLogId: string | null = null;
    let energyLogId: string | null = null;
    let stressLogId: string | null = null;

    if (input.moodScore) {
      moodLogId = await this.createMoodLog(userId, input.moodScore, now);
    }

    if (input.energyScore) {
      energyLogId = await this.createEnergyLog(userId, input.energyScore, now);
    }

    if (input.stressScore) {
      stressLogId = await this.createStressLog(userId, input.stressScore, now);
    }

    let checkin: DailyCheckin;

    if (existing.rows.length > 0) {
      // Update existing check-in
      const result = await query<DailyCheckinRow>(
        `UPDATE daily_checkins SET
          mood_score = COALESCE($4, mood_score),
          energy_score = COALESCE($5, energy_score),
          sleep_quality = COALESCE($6, sleep_quality),
          stress_score = COALESCE($7, stress_score),
          tags = COALESCE($8, tags),
          day_summary = COALESCE($9, day_summary),
          predicted_mood = COALESCE($10, predicted_mood),
          predicted_energy = COALESCE($11, predicted_energy),
          known_stressors = COALESCE($12, known_stressors),
          day_rating = COALESCE($13, day_rating),
          went_well = COALESCE($14, went_well),
          didnt_go_well = COALESCE($15, didnt_go_well),
          evening_lessons = COALESCE($16, evening_lessons),
          tomorrow_focus = COALESCE($17, tomorrow_focus),
          screen_time_minutes = COALESCE($18, screen_time_minutes),
          mood_log_id = COALESCE($19, mood_log_id),
          energy_log_id = COALESCE($20, energy_log_id),
          stress_log_id = COALESCE($21, stress_log_id),
          completed_at = $22,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND checkin_date = $2 AND checkin_type = $3
        RETURNING *`,
        [
          userId, today, checkinType,
          input.moodScore ?? null,
          input.energyScore ?? null,
          input.sleepQuality ?? null,
          input.stressScore ?? null,
          input.tags ?? null,
          input.daySummary ?? null,
          input.predictedMood ?? null,
          input.predictedEnergy ?? null,
          input.knownStressors ?? null,
          input.dayRating ?? null,
          input.wentWell ?? null,
          input.didntGoWell ?? null,
          input.eveningLessons ?? null,
          input.tomorrowFocus ?? null,
          input.screenTimeMinutes ?? null,
          moodLogId,
          energyLogId,
          stressLogId,
          now,
        ]
      );
      checkin = this.mapRowToCheckin(result.rows[0]);
    } else {
      // Create new check-in
      const result = await query<DailyCheckinRow>(
        `INSERT INTO daily_checkins (
          user_id, checkin_date, checkin_type,
          mood_score, energy_score, sleep_quality, stress_score,
          tags, day_summary,
          predicted_mood, predicted_energy, known_stressors,
          day_rating, went_well, didnt_go_well, evening_lessons, tomorrow_focus,
          screen_time_minutes,
          mood_log_id, energy_log_id, stress_log_id,
          completed_at, logged_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
        RETURNING *`,
        [
          userId, today, checkinType,
          input.moodScore ?? null,
          input.energyScore ?? null,
          input.sleepQuality ?? null,
          input.stressScore ?? null,
          input.tags ?? [],
          input.daySummary ?? null,
          input.predictedMood ?? null,
          input.predictedEnergy ?? null,
          input.knownStressors ?? null,
          input.dayRating ?? null,
          input.wentWell ?? null,
          input.didntGoWell ?? null,
          input.eveningLessons ?? null,
          input.tomorrowFocus ?? null,
          input.screenTimeMinutes ?? null,
          moodLogId,
          energyLogId,
          stressLogId,
          now, now,
        ]
      );
      checkin = this.mapRowToCheckin(result.rows[0]);
    }

    // Fire-and-forget: save evening lessons as structured records in lessons_learned table
    if (checkinType === 'evening' && input.eveningLessons && input.eveningLessons.length > 0) {
      this.triggerEveningLessonExtraction(userId, checkin.id, input.eveningLessons).catch(() => {});
    }

    // Fire-and-forget: embed daily check-in in life history timeline
    const checkinContent = `${checkinType} check-in. Mood: ${input.moodScore ?? 'N/A'}/10. Energy: ${input.energyScore ?? 'N/A'}/10.${input.daySummary ? ` Summary: ${input.daySummary}` : ''}`;
    import('../life-history-embedding.service.js').then(({ lifeHistoryEmbeddingService }) =>
      lifeHistoryEmbeddingService.embedLifeEvent({
        userId,
        eventDate: new Date().toISOString().slice(0, 10),
        entryType: 'daily_checkin',
        category: 'all',
        content: checkinContent,
        metadata: { mood: input.moodScore, energy: input.energyScore, stress: input.stressScore },
        sourceIds: [checkin.id],
      })
    ).catch(() => {});

    // Record for unified streak system
    import('../streak.service.js').then(({ streakService }) =>
      streakService.recordActivity(userId, 'daily_checkin', checkin.id)
    ).catch(() => {});

    return checkin;
  }

  /**
   * Extract evening review lessons into structured lessons_learned records
   */
  private async triggerEveningLessonExtraction(userId: string, checkinId: string, lessons: string[]): Promise<void> {
    const { lessonsLearnedService } = await import('./lessons-learned.service.js');
    await lessonsLearnedService.extractLessonsFromEveningReview(userId, checkinId, lessons);
  }

  /**
   * Get today's check-in(s) for a user
   */
  async getTodayCheckin(userId: string, checkinType?: CheckinType): Promise<DailyCheckin | null> {
    const today = new Date().toISOString().split('T')[0];

    let queryText = `SELECT * FROM daily_checkins WHERE user_id = $1 AND checkin_date = $2`;
    const params: string[] = [userId, today];

    if (checkinType) {
      queryText += ` AND checkin_type = $3`;
      params.push(checkinType);
    }

    queryText += ` ORDER BY checkin_type ASC LIMIT 1`;

    const result = await query<DailyCheckinRow>(queryText, params);
    if (result.rows.length === 0) return null;
    return this.mapRowToCheckin(result.rows[0]);
  }

  /**
   * Get morning check-in for a specific date
   */
  async getMorningCheckin(userId: string, date?: string): Promise<DailyCheckin | null> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const result = await query<DailyCheckinRow>(
      `SELECT * FROM daily_checkins WHERE user_id = $1 AND checkin_date = $2 AND checkin_type = 'morning'`,
      [userId, targetDate]
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToCheckin(result.rows[0]);
  }

  /**
   * Get evening review for a specific date
   */
  async getEveningReview(userId: string, date?: string): Promise<DailyCheckin | null> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const result = await query<DailyCheckinRow>(
      `SELECT * FROM daily_checkins WHERE user_id = $1 AND checkin_date = $2 AND checkin_type = 'evening'`,
      [userId, targetDate]
    );
    if (result.rows.length === 0) return null;
    return this.mapRowToCheckin(result.rows[0]);
  }

  /**
   * Compare predicted (morning) vs actual (evening) for a day
   */
  async getDayComparison(userId: string, date?: string): Promise<DayComparison> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const result = await query<DailyCheckinRow>(
      `SELECT * FROM daily_checkins WHERE user_id = $1 AND checkin_date = $2 ORDER BY checkin_type ASC`,
      [userId, targetDate]
    );

    const morning = result.rows.find((r) => r.checkin_type === 'morning');
    const evening = result.rows.find((r) => r.checkin_type === 'evening');

    // Get intention fulfillment
    const intentionResult = await query<{ total: string; fulfilled: string }>(
      `SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE fulfilled = true) AS fulfilled
       FROM daily_intentions
       WHERE user_id = $1 AND intention_date = $2`,
      [userId, targetDate]
    );

    const moodDelta = (morning && evening && morning.predicted_mood && evening.mood_score)
      ? evening.mood_score - morning.predicted_mood
      : undefined;

    const energyDelta = (morning && evening && morning.predicted_energy && evening.energy_score)
      ? evening.energy_score - morning.predicted_energy
      : undefined;

    return {
      date: targetDate,
      morning: morning ? this.mapRowToCheckin(morning) : undefined,
      evening: evening ? this.mapRowToCheckin(evening) : undefined,
      moodDelta,
      energyDelta,
      intentionsFulfilled: parseInt(intentionResult.rows[0].fulfilled, 10),
      intentionsTotal: parseInt(intentionResult.rows[0].total, 10),
    };
  }

  /**
   * Get yesterday's tomorrow_focus to pre-populate morning check-in
   */
  async getTomorrowFocus(userId: string): Promise<string | null> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const result = await query<{ tomorrow_focus: string | null }>(
      `SELECT tomorrow_focus FROM daily_checkins
       WHERE user_id = $1 AND checkin_date = $2 AND checkin_type = 'evening'`,
      [userId, yesterdayStr]
    );

    return result.rows[0]?.tomorrow_focus ?? null;
  }

  /**
   * Get check-in history (paginated)
   */
  async getCheckinHistory(
    userId: string,
    options: { page?: number; limit?: number; startDate?: string; endDate?: string; checkinType?: CheckinType } = {}
  ): Promise<{ checkins: DailyCheckin[]; total: number; page: number; limit: number }> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 30, 100);
    const offset = (page - 1) * limit;

    let queryText = `SELECT * FROM daily_checkins WHERE user_id = $1`;
    const params: (string | number)[] = [userId];

    if (options.checkinType) {
      queryText += ` AND checkin_type = $${params.length + 1}`;
      params.push(options.checkinType);
    }

    if (options.startDate) {
      queryText += ` AND checkin_date >= $${params.length + 1}`;
      params.push(options.startDate);
    }

    if (options.endDate) {
      queryText += ` AND checkin_date <= $${params.length + 1}`;
      params.push(options.endDate);
    }

    queryText += ` ORDER BY checkin_date DESC, checkin_type ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query<DailyCheckinRow>(queryText, params);

    // Total count (reuse same filters)
    let countQuery = `SELECT COUNT(*) as total FROM daily_checkins WHERE user_id = $1`;
    const countParams: (string | number)[] = [userId];

    if (options.checkinType) {
      countQuery += ` AND checkin_type = $${countParams.length + 1}`;
      countParams.push(options.checkinType);
    }
    if (options.startDate) {
      countQuery += ` AND checkin_date >= $${countParams.length + 1}`;
      countParams.push(options.startDate);
    }
    if (options.endDate) {
      countQuery += ` AND checkin_date <= $${countParams.length + 1}`;
      countParams.push(options.endDate);
    }

    const countResult = await query<{ total: string }>(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total, 10);

    return {
      checkins: result.rows.map((row) => this.mapRowToCheckin(row)),
      total,
      page,
      limit,
    };
  }

  /**
   * Get check-in streak information
   */
  async getCheckinStreak(userId: string): Promise<{ currentStreak: number; longestStreak: number }> {
    // Count distinct dates with completed check-ins (morning or evening)
    const result = await query<{ checkin_date: string }>(
      `SELECT DISTINCT checkin_date FROM daily_checkins
       WHERE user_id = $1 AND completed_at IS NOT NULL
       ORDER BY checkin_date DESC LIMIT 90`,
      [userId]
    );

    if (result.rows.length === 0) {
      return { currentStreak: 0, longestStreak: 0 };
    }

    const dates = result.rows.map((r) => r.checkin_date);
    const today = new Date().toISOString().split('T')[0];

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let expectedDate = new Date(today);

    for (const dateStr of dates) {
      const date = new Date(dateStr);
      const expected = expectedDate.toISOString().split('T')[0];

      if (dateStr === expected) {
        tempStreak++;
        expectedDate.setDate(expectedDate.getDate() - 1);
      } else {
        if (currentStreak === 0) currentStreak = tempStreak;
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
        expectedDate = new Date(date);
        expectedDate.setDate(expectedDate.getDate() - 1);
      }
    }

    if (currentStreak === 0) currentStreak = tempStreak;
    longestStreak = Math.max(longestStreak, tempStreak);

    return { currentStreak, longestStreak };
  }

  // ============================================
  // CROSS-LOGGING HELPERS
  // ============================================

  private async createMoodLog(userId: string, moodScore: number, loggedAt: string): Promise<string> {
    const result = await query<{ id: string }>(
      `INSERT INTO mood_logs (user_id, happiness_rating, mode, logged_at)
       VALUES ($1, $2, 'deep', $3)
       RETURNING id`,
      [userId, moodScore, loggedAt]
    );
    return result.rows[0].id;
  }

  private async createEnergyLog(userId: string, energyScore: number, loggedAt: string): Promise<string> {
    const result = await query<{ id: string }>(
      `INSERT INTO energy_logs (user_id, energy_rating, context_tag, logged_at)
       VALUES ($1, $2, 'after-sleep', $3)
       RETURNING id`,
      [userId, energyScore, loggedAt]
    );
    return result.rows[0].id;
  }

  private async createStressLog(userId: string, stressScore: number, loggedAt: string): Promise<string> {
    const clientRequestId = `checkin-${userId}-${new Date().toISOString().split('T')[0]}-${uuidv4().slice(0, 8)}`;
    const result = await query<{ id: string }>(
      `INSERT INTO stress_logs (user_id, stress_rating, check_in_type, client_request_id, logged_at)
       VALUES ($1, $2, 'daily', $3, $4)
       RETURNING id`,
      [userId, stressScore, clientRequestId, loggedAt]
    );
    return result.rows[0].id;
  }

  // ============================================
  // MAPPING
  // ============================================

  private mapRowToCheckin(row: DailyCheckinRow): DailyCheckin {
    return {
      id: row.id,
      userId: row.user_id,
      checkinDate: row.checkin_date,
      checkinType: row.checkin_type,
      moodScore: row.mood_score ?? undefined,
      energyScore: row.energy_score ?? undefined,
      sleepQuality: row.sleep_quality ?? undefined,
      stressScore: row.stress_score ?? undefined,
      tags: (row.tags ?? []) as CheckinTag[],
      daySummary: row.day_summary ?? undefined,
      predictedMood: row.predicted_mood ?? undefined,
      predictedEnergy: row.predicted_energy ?? undefined,
      knownStressors: row.known_stressors ?? undefined,
      dayRating: row.day_rating ?? undefined,
      wentWell: row.went_well ?? undefined,
      didntGoWell: row.didnt_go_well ?? undefined,
      eveningLessons: row.evening_lessons ?? undefined,
      tomorrowFocus: row.tomorrow_focus ?? undefined,
      screenTimeMinutes: row.screen_time_minutes ?? undefined,
      screenTimeSource: (row.screen_time_source as 'manual' | 'device') ?? undefined,
      moodLogId: row.mood_log_id ?? undefined,
      energyLogId: row.energy_log_id ?? undefined,
      stressLogId: row.stress_log_id ?? undefined,
      completedAt: row.completed_at?.toISOString(),
      loggedAt: row.logged_at.toISOString(),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}

export const dailyCheckinService = new DailyCheckinService();
export default dailyCheckinService;
