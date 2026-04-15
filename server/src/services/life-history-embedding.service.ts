/**
 * @file Life History Embedding Service
 * @description Manages the user_life_history table — daily digests, event embeddings,
 *              and semantic search using Gemini text-embedding-004 (768 dimensions).
 *              Provides the AI coach with complete searchable user history across all pillars.
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import { vectorEmbeddingService } from './vector-embedding.service.js';

// ============================================
// TYPES
// ============================================

export type LifeHistoryEntryType =
  | 'daily_digest'
  | 'journal'
  | 'voice_session'
  | 'emotional_checkin'
  | 'coaching_conversation'
  | 'lesson'
  | 'goal_milestone'
  | 'health_alert'
  | 'daily_checkin';

export type LifeHistoryCategory =
  | 'all'
  | 'fitness'
  | 'nutrition'
  | 'sleep'
  | 'wellbeing'
  | 'habits'
  | 'goals'
  | 'coaching';

export interface LifeHistorySearchParams {
  userId: string;
  queryText: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  category?: LifeHistoryCategory;
  entryType?: LifeHistoryEntryType;
  limit?: number;
  minSimilarity?: number;
}

export interface LifeHistorySearchResult {
  id: string;
  eventDate: string;
  entryType: LifeHistoryEntryType;
  category: LifeHistoryCategory;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
  createdAt: Date;
}

export interface EmbedLifeEventParams {
  userId: string;
  eventDate: string; // YYYY-MM-DD
  entryType: LifeHistoryEntryType;
  category: LifeHistoryCategory;
  content: string;
  metadata?: Record<string, unknown>;
  sourceIds?: string[];
}

interface DailyDigestMetadata {
  daily_score?: number;
  mood?: number;
  energy?: number;
  stress?: number;
  recovery?: number;
  sleep_hours?: number;
  strain?: number;
  calories?: number;
  workouts_completed?: number;
  habits_completed?: number;
  habits_total?: number;
  water_ml?: number;
  streak?: number;
  weight_kg?: number;
}

// ============================================
// SERVICE
// ============================================

class LifeHistoryEmbeddingService {
  private tableAvailable: boolean | null = null; // null = not checked yet

  /**
   * Check if user_life_history table exists (cached after first check)
   */
  private async isTableAvailable(): Promise<boolean> {
    if (this.tableAvailable !== null) return this.tableAvailable;
    try {
      const result = await query<{ exists: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_life_history') as exists`
      );
      this.tableAvailable = result.rows[0]?.exists ?? false;
      if (!this.tableAvailable) {
        logger.warn('[LifeHistory] user_life_history table not found (pgvector may not be installed). Life history features disabled.');
      }
      return this.tableAvailable;
    } catch {
      this.tableAvailable = false;
      return false;
    }
  }

  // ============================================
  // DAILY DIGEST GENERATION
  // ============================================

  /**
   * Generate a comprehensive daily digest for a user on a given date.
   * Gathers data from all tables, creates a structured text summary,
   * embeds with Gemini 768-dim, and upserts into user_life_history.
   */
  async generateDailyDigest(userId: string, date: string): Promise<void> {
    if (!await this.isTableAvailable()) return;
    const tag = '[LifeHistory]';
    try {
      // Gather all data for the date in parallel waves
      const [
        scoreData,
        workoutData,
        nutritionData,
        healthData,
        wellbeingData,
        journalData,
        habitData,
        waterData,
        goalData,
        coachingData,
        checkinData,
        yogaData,
        lessonsData,
      ] = await Promise.all([
        this.getDailyScore(userId, date),
        this.getWorkouts(userId, date),
        this.getNutrition(userId, date),
        this.getHealthMetrics(userId, date),
        this.getWellbeingLogs(userId, date),
        this.getJournalEntries(userId, date),
        this.getHabitLogs(userId, date),
        this.getWaterIntake(userId, date),
        this.getGoalSnapshots(userId, date),
        this.getCoachingMessages(userId, date),
        this.getDailyCheckin(userId, date),
        this.getYogaSessions(userId, date),
        this.getLessons(userId, date),
      ]);

      // Check if there's any meaningful data for this day
      const hasData = scoreData || workoutData.length > 0 || nutritionData.length > 0 ||
        healthData || wellbeingData.mood !== null || journalData.length > 0 ||
        habitData.completed > 0 || checkinData;

      if (!hasData) {
        logger.debug(`${tag} No data for ${date}, skipping digest`, { userId: userId.slice(0, 8) });
        return;
      }

      // Build digest text
      const dayName = new Date(date + 'T00:00:00Z').toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
      const streakDisplay = scoreData?.streak ? ` | Streak: ${scoreData.streak} days` : '';
      const scoreDelta = scoreData?.delta ? ` (${scoreData.delta > 0 ? '+' : ''}${scoreData.delta})` : '';

      const sections: string[] = [];

      // Header
      sections.push(`[${date} ${dayName}] Daily Score: ${scoreData?.score ?? 'N/A'}/100${scoreDelta}${streakDisplay}`);

      // FITNESS
      if (workoutData.length > 0 || healthData) {
        const parts: string[] = [];
        for (const w of workoutData) {
          parts.push(`${w.name} (${w.duration}min, ${w.status})`);
        }
        if (healthData?.recovery) parts.push(`Recovery: ${healthData.recovery}%`);
        if (healthData?.strain) parts.push(`Strain: ${healthData.strain}/21`);
        if (yogaData.length > 0) {
          parts.push(`Yoga: ${yogaData.length} session${yogaData.length > 1 ? 's' : ''}`);
        }
        if (parts.length > 0) sections.push(`FITNESS: ${parts.join('. ')}.`);
      }

      // NUTRITION
      if (nutritionData.length > 0) {
        const totalCals = nutritionData.reduce((s, m) => s + (m.calories || 0), 0);
        const totalProtein = nutritionData.reduce((s, m) => s + (m.protein || 0), 0);
        sections.push(`NUTRITION: ${nutritionData.length} meals, ${totalCals} cal. Protein: ${totalProtein}g.`);
      }

      // SLEEP
      if (healthData?.sleepHours) {
        const parts = [`${healthData.sleepHours}h`];
        if (healthData.sleepQuality) parts.push(`${healthData.sleepQuality}% quality`);
        if (healthData.rhr) parts.push(`RHR: ${healthData.rhr}`);
        if (healthData.hrv) parts.push(`HRV: ${healthData.hrv}ms`);
        sections.push(`SLEEP: ${parts.join(', ')}.`);
      }

      // WELLBEING
      {
        const parts: string[] = [];
        if (wellbeingData.mood !== null) parts.push(`Mood ${wellbeingData.mood}/10`);
        if (wellbeingData.energy !== null) parts.push(`Energy ${wellbeingData.energy}/10`);
        if (wellbeingData.stress !== null) parts.push(`Stress ${wellbeingData.stress}/10`);
        if (parts.length > 0) sections.push(`WELLBEING: ${parts.join('. ')}.`);
      }

      // JOURNAL
      if (journalData.length > 0) {
        const snippet = journalData[0].content.slice(0, 200);
        sections.push(`Journal: "${snippet}${journalData[0].content.length > 200 ? '...' : ''}"`);
      }

      // HABITS
      if (habitData.total > 0) {
        const missed = habitData.missed.length > 0 ? ` (missed ${habitData.missed.join(', ')})` : '';
        sections.push(`HABITS: ${habitData.completed}/${habitData.total} done${missed}. Water: ${waterData}ml.`);
      }

      // GOALS
      if (goalData.length > 0) {
        const goalParts = goalData.map(g => `"${g.name}" at ${g.progress}%`);
        sections.push(`GOALS: ${goalParts.join('. ')}.`);
      }

      // COACHING
      if (coachingData > 0) {
        sections.push(`COACHING: ${coachingData} message${coachingData > 1 ? 's' : ''} sent.`);
      }

      // CHECKIN
      if (checkinData) {
        sections.push(`CHECKIN: ${checkinData.slice(0, 150)}`);
      }

      // LESSONS
      if (lessonsData.length > 0) {
        sections.push(`LESSONS: ${lessonsData.map(l => l.slice(0, 100)).join('; ')}`);
      }

      const digestText = sections.join('\n');

      // Build metadata
      const metadata: DailyDigestMetadata = {};
      if (scoreData?.score) metadata.daily_score = scoreData.score;
      if (scoreData?.streak) metadata.streak = scoreData.streak;
      if (wellbeingData.mood !== null) metadata.mood = wellbeingData.mood;
      if (wellbeingData.energy !== null) metadata.energy = wellbeingData.energy;
      if (wellbeingData.stress !== null) metadata.stress = wellbeingData.stress;
      if (healthData?.recovery) metadata.recovery = healthData.recovery;
      if (healthData?.sleepHours) metadata.sleep_hours = healthData.sleepHours;
      if (healthData?.strain) metadata.strain = healthData.strain;
      if (nutritionData.length > 0) {
        metadata.calories = nutritionData.reduce((s, m) => s + (m.calories || 0), 0);
      }
      if (workoutData.length > 0) metadata.workouts_completed = workoutData.length;
      if (habitData.total > 0) {
        metadata.habits_completed = habitData.completed;
        metadata.habits_total = habitData.total;
      }

      // Generate Gemini 768-dim embedding
      const embedding = await vectorEmbeddingService.embedWithGemini(digestText, 'RETRIEVAL_DOCUMENT');
      const embeddingStr = `[${embedding.join(',')}]`;

      // Upsert (safe due to unique index on daily_digest per user per day)
      await query(
        `INSERT INTO user_life_history (user_id, event_date, entry_type, category, content, embedding, metadata)
         VALUES ($1, $2, 'daily_digest', 'all', $3, $4, $5)
         ON CONFLICT (user_id, event_date) WHERE entry_type = 'daily_digest'
         DO UPDATE SET content = EXCLUDED.content, embedding = EXCLUDED.embedding,
                       metadata = EXCLUDED.metadata, updated_at = NOW()`,
        [userId, date, digestText, embeddingStr, JSON.stringify(metadata)],
      );

      logger.debug(`${tag} Generated daily digest`, { userId: userId.slice(0, 8), date, textLen: digestText.length });
    } catch (error: any) {
      // Gracefully handle missing table (pgvector not installed or table not migrated)
      if (error?.code === '42P01') {
        logger.warn(`${tag} user_life_history table not found — skipping digest`);
        return;
      }
      logger.error(`${tag} Failed to generate daily digest`, {
        userId: userId.slice(0, 8),
        date,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      throw error;
    }
  }

  // ============================================
  // REAL-TIME EVENT EMBEDDING
  // ============================================

  /**
   * Embed a significant life event in real-time.
   * Called from wellbeing services after journal entries, check-ins, etc.
   */
  async embedLifeEvent(params: EmbedLifeEventParams): Promise<string> {
    if (!await this.isTableAvailable()) return '';
    const { userId, eventDate, entryType, category, content, metadata = {}, sourceIds = [] } = params;

    try {
      const embedding = await vectorEmbeddingService.embedWithGemini(content, 'RETRIEVAL_DOCUMENT');
      const embeddingStr = `[${embedding.join(',')}]`;

      const result = await query<{ id: string }>(
        `INSERT INTO user_life_history (user_id, event_date, entry_type, category, content, embedding, metadata, source_ids)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [userId, eventDate, entryType, category, content, embeddingStr, JSON.stringify(metadata), sourceIds],
      );

      logger.debug('[LifeHistory] Embedded life event', {
        userId: userId.slice(0, 8),
        entryType,
        category,
        id: result.rows[0].id,
      });

      return result.rows[0].id;
    } catch (error: any) {
      // Gracefully handle missing table (pgvector not installed or table not migrated)
      if (error?.code === '42P01') {
        logger.warn('[LifeHistory] user_life_history table not found — skipping embed', { entryType });
        return '';
      }
      throw error;
    }
  }

  // ============================================
  // SEMANTIC SEARCH
  // ============================================

  /**
   * Search user's life history by semantic similarity with optional date/category/type filters.
   */
  async searchHistory(params: LifeHistorySearchParams): Promise<LifeHistorySearchResult[]> {
    if (!await this.isTableAvailable()) return [];
    const { userId, queryText, startDate, endDate, category, entryType, limit = 10, minSimilarity = 0.5 } = params;

    const queryEmbedding = await vectorEmbeddingService.embedWithGemini(queryText, 'RETRIEVAL_QUERY');
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    let sql = `
      SELECT
        id, event_date, entry_type, category, content, metadata, created_at,
        1 - (embedding <=> $1::vector) as similarity
      FROM user_life_history
      WHERE user_id = $2
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> $1::vector) >= $3
    `;

    const queryParams: (string | number)[] = [embeddingStr, userId, minSimilarity];
    let paramIndex = 4;

    if (startDate) {
      sql += ` AND event_date >= $${paramIndex}`;
      queryParams.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      sql += ` AND event_date <= $${paramIndex}`;
      queryParams.push(endDate);
      paramIndex++;
    }

    if (category && category !== 'all') {
      sql += ` AND category = $${paramIndex}`;
      queryParams.push(category);
      paramIndex++;
    }

    if (entryType) {
      sql += ` AND entry_type = $${paramIndex}`;
      queryParams.push(entryType);
      paramIndex++;
    }

    sql += ` ORDER BY similarity DESC, event_date DESC LIMIT $${paramIndex}`;
    queryParams.push(limit);

    try {
      const result = await query(sql, queryParams);

      return result.rows.map((row) => ({
        id: row.id,
        eventDate: row.event_date,
        entryType: row.entry_type,
        category: row.category,
        content: row.content,
        metadata: row.metadata,
        similarity: parseFloat(row.similarity),
        createdAt: row.created_at,
      }));
    } catch (error: any) {
      if (error?.code === '42P01') {
        logger.warn('[LifeHistory] user_life_history table not found — returning empty results');
        return [];
      }
      throw error;
    }
  }

  /**
   * Get daily digests within a date range, ordered by date.
   * Convenience method for timeline views.
   */
  async getProgressTimeline(
    userId: string,
    queryText: string,
    startDate: string,
    endDate: string,
    limit: number = 30,
  ): Promise<LifeHistorySearchResult[]> {
    return this.searchHistory({
      userId,
      queryText,
      startDate,
      endDate,
      entryType: 'daily_digest',
      limit,
      minSimilarity: 0.3, // Lower threshold for timeline browsing
    });
  }

  /**
   * Backfill daily digests for past N days for a user.
   */
  async backfillUser(userId: string, days: number = 30): Promise<number> {
    let generated = 0;
    const today = new Date();

    for (let i = 1; i <= days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);

      try {
        // Check if digest already exists
        const existing = await query(
          `SELECT id FROM user_life_history WHERE user_id = $1 AND event_date = $2 AND entry_type = 'daily_digest'`,
          [userId, dateStr],
        );
        if (existing.rows.length > 0) continue;

        await this.generateDailyDigest(userId, dateStr);
        generated++;
      } catch (err) {
        logger.warn('[LifeHistory] Backfill failed for date', {
          userId: userId.slice(0, 8),
          date: dateStr,
          error: err instanceof Error ? err.message : 'Unknown',
        });
      }
    }

    logger.info('[LifeHistory] Backfill complete', { userId: userId.slice(0, 8), generated, days });
    return generated;
  }

  // ============================================
  // DATA GATHERING HELPERS (private)
  // ============================================

  private async getDailyScore(userId: string, date: string) {
    const result = await query(
      `SELECT score, explanation, streak_days
       FROM daily_user_scores WHERE user_id = $1 AND date = $2 LIMIT 1`,
      [userId, date],
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];

    // Get previous day score for delta
    const prevResult = await query(
      `SELECT score FROM daily_user_scores WHERE user_id = $1 AND date = $2::date - 1 LIMIT 1`,
      [userId, date],
    );
    const prevScore = prevResult.rows[0]?.score;
    const delta = prevScore ? row.score - prevScore : null;

    return { score: row.score, streak: row.streak_days, delta };
  }

  private async getWorkouts(userId: string, date: string) {
    const result = await query(
      `SELECT wp.name, wl.duration_minutes, wl.status
       FROM workout_logs wl
       LEFT JOIN workout_plans wp ON wl.plan_id = wp.id
       WHERE wl.user_id = $1 AND wl.date = $2`,
      [userId, date],
    );
    return result.rows.map(r => ({
      name: r.name || 'Workout',
      duration: r.duration_minutes || 0,
      status: r.status || 'completed',
    }));
  }

  private async getNutrition(userId: string, date: string) {
    const result = await query(
      `SELECT name, calories, protein_g FROM meal_logs WHERE user_id = $1 AND date = $2`,
      [userId, date],
    );
    return result.rows.map(r => ({
      name: r.name,
      calories: r.calories || 0,
      protein: r.protein_g || 0,
    }));
  }

  private async getHealthMetrics(userId: string, date: string) {
    const result = await query(
      `SELECT recovery_score, strain_score, sleep_duration_hours, sleep_quality_score,
              hrv_rmssd, resting_heart_rate
       FROM daily_health_metrics WHERE user_id = $1 AND metric_date = $2 LIMIT 1`,
      [userId, date],
    );
    if (result.rows.length === 0) return null;
    const r = result.rows[0];
    return {
      recovery: r.recovery_score,
      strain: r.strain_score,
      sleepHours: r.sleep_duration_hours ? parseFloat(r.sleep_duration_hours) : null,
      sleepQuality: r.sleep_quality_score,
      hrv: r.hrv_rmssd,
      rhr: r.resting_heart_rate,
    };
  }

  private async getWellbeingLogs(userId: string, date: string) {
    // Get latest mood, energy, stress for the day
    const moodResult = await query(
      `SELECT rating FROM mood_logs WHERE user_id = $1 AND DATE(created_at) = $2 ORDER BY created_at DESC LIMIT 1`,
      [userId, date],
    );
    const energyResult = await query(
      `SELECT rating FROM energy_logs WHERE user_id = $1 AND DATE(created_at) = $2 ORDER BY created_at DESC LIMIT 1`,
      [userId, date],
    );
    const stressResult = await query(
      `SELECT rating FROM stress_logs WHERE user_id = $1 AND DATE(created_at) = $2 ORDER BY created_at DESC LIMIT 1`,
      [userId, date],
    );
    return {
      mood: moodResult.rows[0]?.rating ?? null,
      energy: energyResult.rows[0]?.rating ?? null,
      stress: stressResult.rows[0]?.rating ?? null,
    };
  }

  private async getJournalEntries(userId: string, date: string) {
    const result = await query(
      `SELECT content FROM journal_entries WHERE user_id = $1 AND DATE(created_at) = $2 ORDER BY created_at DESC LIMIT 3`,
      [userId, date],
    );
    return result.rows.map(r => ({ content: r.content || '' }));
  }

  private async getHabitLogs(userId: string, date: string) {
    const result = await query(
      `SELECT h.name, hl.completed
       FROM habit_logs hl
       JOIN habits h ON hl.habit_id = h.id
       WHERE hl.user_id = $1 AND hl.date = $2`,
      [userId, date],
    );
    const completed = result.rows.filter(r => r.completed).length;
    const missed = result.rows.filter(r => !r.completed).map(r => r.name);
    return { completed, total: result.rows.length, missed };
  }

  private async getWaterIntake(userId: string, date: string): Promise<number> {
    const result = await query(
      `SELECT COALESCE(SUM(amount_ml), 0) as total FROM water_intake WHERE user_id = $1 AND date = $2`,
      [userId, date],
    );
    return parseInt(result.rows[0]?.total || '0', 10);
  }

  private async getGoalSnapshots(userId: string, _date: string) {
    // Current active goals with progress
    const result = await query(
      `SELECT name, progress_percentage FROM user_goals WHERE user_id = $1 AND status = 'active' LIMIT 5`,
      [userId],
    );
    return result.rows.map(r => ({ name: r.name, progress: r.progress_percentage || 0 }));
  }

  private async getCoachingMessages(userId: string, date: string): Promise<number> {
    const result = await query(
      `SELECT COUNT(*) as count FROM proactive_messages WHERE user_id = $1 AND DATE(created_at) = $2`,
      [userId, date],
    );
    return parseInt(result.rows[0]?.count || '0', 10);
  }

  private async getDailyCheckin(userId: string, date: string): Promise<string | null> {
    const result = await query(
      `SELECT summary FROM daily_checkins WHERE user_id = $1 AND DATE(created_at) = $2 ORDER BY created_at DESC LIMIT 1`,
      [userId, date],
    );
    return result.rows[0]?.summary || null;
  }

  private async getYogaSessions(userId: string, date: string) {
    const result = await query(
      `SELECT notes FROM yoga_session_logs WHERE user_id = $1 AND DATE(created_at) = $2`,
      [userId, date],
    );
    return result.rows;
  }

  private async getLessons(userId: string, date: string): Promise<string[]> {
    const result = await query(
      `SELECT lesson_text FROM lessons_learned WHERE user_id = $1 AND DATE(created_at) = $2`,
      [userId, date],
    );
    return result.rows.map(r => r.lesson_text || '');
  }
}

// Export singleton
export const lifeHistoryEmbeddingService = new LifeHistoryEmbeddingService();
export default lifeHistoryEmbeddingService;
