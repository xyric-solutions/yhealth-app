/**
 * @file Life Goals Service
 * @description Non-fitness life goals tracked through journaling
 * Separate from user_goals (which is locked to health_pillar enum)
 */

import { query } from '../../database/pg.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../logger.service.js';
import type {
  LifeGoal,
  CreateLifeGoalInput,
  DailyIntention,
  JournalGoalLink,
  LifeGoalCategory,
  LifeGoalMilestone,
  CreateLifeGoalMilestoneInput,
  LifeGoalCheckin,
  CreateLifeGoalCheckinInput,
  LifeGoalDashboard,
} from '@shared/types/domain/wellbeing.js';

// ============================================
// TYPES
// ============================================

interface LifeGoalRow {
  id: string;
  user_id: string;
  category: string;
  title: string;
  description: string | null;
  motivation: string | null;
  tracking_method: string;
  target_value: number | null;
  target_unit: string | null;
  current_value: number;
  status: string;
  progress: number;
  journal_mention_count: number;
  avg_sentiment_when_mentioned: number | null;
  last_mentioned_at: Date | null;
  ai_detected_patterns: unknown[];
  detection_keywords: string[];
  is_primary: boolean;
  created_at: Date;
  updated_at: Date;
}

interface DailyIntentionRow {
  id: string;
  user_id: string;
  intention_date: string;
  intention_text: string;
  checkin_id: string | null;
  fulfilled: boolean | null;
  reflection: string | null;
  sort_order: number | null;
  domain: string | null;
  created_at: Date;
  updated_at: Date;
}

interface JournalGoalLinkRow {
  id: string;
  journal_entry_id: string;
  life_goal_id: string;
  link_type: string;
  confidence: number | null;
  relevant_excerpt: string | null;
  sentiment_score: number | null;
  created_at: Date;
}

interface LifeGoalMilestoneRow {
  id: string;
  life_goal_id: string;
  user_id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  target_value: number | null;
  current_value: number;
  completed: boolean;
  completed_at: Date | null;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

interface LifeGoalCheckinRow {
  id: string;
  life_goal_id: string;
  user_id: string;
  checkin_date: string;
  progress_value: number | null;
  note: string | null;
  mood_about_goal: number | null;
  created_at: Date;
}

const VALID_CATEGORIES: LifeGoalCategory[] = [
  'spiritual', 'social', 'productivity', 'happiness',
  'anxiety_management', 'creative', 'personal_growth',
  'financial', 'faith', 'relationships', 'education',
  'career', 'health_wellness', 'custom',
];

// ============================================
// SERVICE CLASS
// ============================================

class LifeGoalsService {
  // ============================================
  // LIFE GOALS CRUD
  // ============================================

  async createGoal(userId: string, input: CreateLifeGoalInput): Promise<LifeGoal> {
    if (!input.title || input.title.trim().length === 0) {
      throw ApiError.badRequest('Goal title is required');
    }

    if (!VALID_CATEGORIES.includes(input.category)) {
      throw ApiError.badRequest(`Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`);
    }

    const result = await query<LifeGoalRow>(
      `INSERT INTO life_goals (
        user_id, category, title, description, motivation,
        tracking_method, target_value, target_unit,
        detection_keywords, is_primary
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        userId,
        input.category,
        input.title.trim(),
        input.description ?? null,
        input.motivation ?? null,
        input.trackingMethod ?? 'journal_mentions',
        input.targetValue ?? null,
        input.targetUnit ?? null,
        input.detectionKeywords ?? [],
        input.isPrimary ?? false,
      ]
    );

    const goal = this.mapRowToGoal(result.rows[0]);

    // Auto-decompose goal asynchronously (don't block response)
    import('../goal-decomposition.service.js')
      .then(({ goalDecompositionService }) =>
        goalDecompositionService.decomposeGoal(userId, goal.id)
      )
      .catch((err) => {
        logger.warn('Auto-decompose failed for goal', { goalId: goal.id, error: (err as Error).message });
      });

    return goal;
  }

  async getGoals(
    userId: string,
    options: { status?: string; category?: LifeGoalCategory } = {}
  ): Promise<LifeGoal[]> {
    let queryText = `SELECT * FROM life_goals WHERE user_id = $1`;
    const params: (string)[] = [userId];

    if (options.status) {
      queryText += ` AND status = $${params.length + 1}`;
      params.push(options.status);
    }

    if (options.category) {
      queryText += ` AND category = $${params.length + 1}`;
      params.push(options.category);
    }

    queryText += ` ORDER BY is_primary DESC, created_at DESC`;

    const result = await query<LifeGoalRow>(queryText, params);
    return result.rows.map((row) => this.mapRowToGoal(row));
  }

  async getGoalById(userId: string, goalId: string): Promise<LifeGoal> {
    const result = await query<LifeGoalRow>(
      `SELECT * FROM life_goals WHERE id = $1 AND user_id = $2`,
      [goalId, userId]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Life goal not found');
    }

    return this.mapRowToGoal(result.rows[0]);
  }

  async updateGoal(
    userId: string,
    goalId: string,
    updates: Partial<CreateLifeGoalInput> & { status?: string; currentValue?: number; progress?: number }
  ): Promise<LifeGoal> {
    const existing = await query<LifeGoalRow>(
      `SELECT * FROM life_goals WHERE id = $1 AND user_id = $2`,
      [goalId, userId]
    );

    if (existing.rows.length === 0) {
      throw ApiError.notFound('Life goal not found');
    }

    const setClauses: string[] = [];
    const values: (string | number | boolean | object | Date | null)[] = [];
    let paramIndex = 1;

    const fields: Record<string, unknown> = {
      category: updates.category,
      title: updates.title?.trim(),
      description: updates.description,
      motivation: updates.motivation,
      tracking_method: updates.trackingMethod,
      target_value: updates.targetValue,
      target_unit: updates.targetUnit,
      detection_keywords: updates.detectionKeywords,
      is_primary: updates.isPrimary,
      status: updates.status,
      current_value: updates.currentValue,
      progress: updates.progress,
    };

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        setClauses.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    }

    if (setClauses.length === 0) {
      return this.mapRowToGoal(existing.rows[0]);
    }

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    values.push(goalId, userId);

    const result = await query<LifeGoalRow>(
      `UPDATE life_goals SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
       RETURNING *`,
      values
    );

    return this.mapRowToGoal(result.rows[0]);
  }

  async deleteGoal(userId: string, goalId: string): Promise<void> {
    const result = await query(
      `DELETE FROM life_goals WHERE id = $1 AND user_id = $2 RETURNING id`,
      [goalId, userId]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Life goal not found');
    }
  }

  /**
   * Get journal entries linked to a specific goal
   */
  async getGoalEntries(
    userId: string,
    goalId: string,
    options: { page?: number; limit?: number } = {}
  ): Promise<{ entries: JournalGoalLink[]; total: number }> {
    // Verify goal ownership
    await this.getGoalById(userId, goalId);

    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100);
    const offset = (page - 1) * limit;

    const result = await query<JournalGoalLinkRow>(
      `SELECT jgl.* FROM journal_goal_links jgl
       JOIN journal_entries je ON je.id = jgl.journal_entry_id
       WHERE jgl.life_goal_id = $1 AND je.user_id = $2
       ORDER BY jgl.created_at DESC
       LIMIT $3 OFFSET $4`,
      [goalId, userId, limit, offset]
    );

    const countResult = await query<{ total: string }>(
      `SELECT COUNT(*) as total FROM journal_goal_links jgl
       JOIN journal_entries je ON je.id = jgl.journal_entry_id
       WHERE jgl.life_goal_id = $1 AND je.user_id = $2`,
      [goalId, userId]
    );

    return {
      entries: result.rows.map((row) => this.mapRowToLink(row)),
      total: parseInt(countResult.rows[0].total, 10),
    };
  }

  // ============================================
  // DAILY INTENTIONS
  // ============================================

  /**
   * Set a single intention (adds to today's list, max 3)
   */
  async setIntention(userId: string, intentionText: string, checkinId?: string, domain?: string): Promise<DailyIntention> {
    if (!intentionText || intentionText.trim().length === 0) {
      throw ApiError.badRequest('Intention text is required');
    }

    const today = new Date().toISOString().split('T')[0];

    // Check count of existing intentions for today
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM daily_intentions WHERE user_id = $1 AND intention_date = $2`,
      [userId, today]
    );
    const existingCount = parseInt(countResult.rows[0].count, 10);
    if (existingCount >= 3) {
      throw ApiError.badRequest('Maximum 3 intentions per day');
    }

    const result = await query<DailyIntentionRow>(
      `INSERT INTO daily_intentions (user_id, intention_date, intention_text, checkin_id, sort_order, domain)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, today, intentionText.trim(), checkinId ?? null, existingCount, domain ?? null]
    );

    return this.mapRowToIntention(result.rows[0]);
  }

  /**
   * Bulk set intentions (replaces all for today, max 3)
   */
  async bulkSetIntentions(
    userId: string,
    intentions: Array<{ text: string; domain?: string }>,
    checkinId?: string
  ): Promise<DailyIntention[]> {
    if (intentions.length > 3) {
      throw ApiError.badRequest('Maximum 3 intentions per day');
    }

    const today = new Date().toISOString().split('T')[0];

    // Clear existing intentions for today
    await query(
      `DELETE FROM daily_intentions WHERE user_id = $1 AND intention_date = $2`,
      [userId, today]
    );

    // Insert new intentions
    const results: DailyIntention[] = [];
    for (let i = 0; i < intentions.length; i++) {
      const intention = intentions[i];
      if (!intention.text || intention.text.trim().length === 0) continue;

      const result = await query<DailyIntentionRow>(
        `INSERT INTO daily_intentions (user_id, intention_date, intention_text, checkin_id, sort_order, domain)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [userId, today, intention.text.trim(), checkinId ?? null, i, intention.domain ?? null]
      );
      results.push(this.mapRowToIntention(result.rows[0]));
    }

    return results;
  }

  /**
   * Get today's intentions (returns array, not single)
   */
  async getTodayIntention(userId: string): Promise<DailyIntention | null> {
    const intentions = await this.getTodayIntentions(userId);
    return intentions.length > 0 ? intentions[0] : null;
  }

  /**
   * Get all of today's intentions
   */
  async getTodayIntentions(userId: string): Promise<DailyIntention[]> {
    const today = new Date().toISOString().split('T')[0];
    const result = await query<DailyIntentionRow>(
      `SELECT * FROM daily_intentions WHERE user_id = $1 AND intention_date = $2 ORDER BY sort_order ASC`,
      [userId, today]
    );

    return result.rows.map((row) => this.mapRowToIntention(row));
  }

  /**
   * Get intention fulfillment rate over a time window
   */
  async getIntentionFulfillmentRate(userId: string, days: number = 30): Promise<{ rate: number; total: number; fulfilled: number }> {
    const result = await query<{ total: string; fulfilled: string }>(
      `SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE fulfilled = true) AS fulfilled
       FROM daily_intentions
       WHERE user_id = $1 AND intention_date >= CURRENT_DATE - $2::INTEGER`,
      [userId, days]
    );

    const total = parseInt(result.rows[0].total, 10);
    const fulfilled = parseInt(result.rows[0].fulfilled, 10);

    return {
      rate: total > 0 ? Math.round((fulfilled / total) * 100) : 0,
      total,
      fulfilled,
    };
  }

  async updateIntention(
    userId: string,
    intentionId: string,
    updates: { fulfilled?: boolean; reflection?: string }
  ): Promise<DailyIntention> {
    const setClauses: string[] = [];
    const values: (string | number | boolean | object | Date | null)[] = [];
    let paramIndex = 1;

    if (updates.fulfilled !== undefined) {
      setClauses.push(`fulfilled = $${paramIndex++}`);
      values.push(updates.fulfilled);
    }

    if (updates.reflection !== undefined) {
      setClauses.push(`reflection = $${paramIndex++}`);
      values.push(updates.reflection);
    }

    if (setClauses.length === 0) {
      throw ApiError.badRequest('No updates provided');
    }

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    values.push(intentionId, userId);

    const result = await query<DailyIntentionRow>(
      `UPDATE daily_intentions SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Intention not found');
    }

    return this.mapRowToIntention(result.rows[0]);
  }

  // ============================================
  // JOURNAL-GOAL LINKING
  // ============================================

  /**
   * Create a link between a journal entry and a life goal
   */
  async linkEntryToGoal(
    journalEntryId: string,
    lifeGoalId: string,
    linkType: 'ai_detected' | 'user_confirmed' | 'user_tagged',
    confidence?: number,
    relevantExcerpt?: string,
    sentimentScore?: number
  ): Promise<JournalGoalLink> {
    const result = await query<JournalGoalLinkRow>(
      `INSERT INTO journal_goal_links (
        journal_entry_id, life_goal_id, link_type, confidence, relevant_excerpt, sentiment_score
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (journal_entry_id, life_goal_id) DO UPDATE SET
        link_type = CASE
          WHEN $3 = 'user_confirmed' THEN 'user_confirmed'::VARCHAR
          WHEN $3 = 'user_tagged' THEN 'user_tagged'::VARCHAR
          ELSE journal_goal_links.link_type
        END,
        confidence = COALESCE($4, journal_goal_links.confidence)
      RETURNING *`,
      [journalEntryId, lifeGoalId, linkType, confidence ?? null, relevantExcerpt ?? null, sentimentScore ?? null]
    );

    // Update mention count on the goal
    await query(
      `UPDATE life_goals SET
        journal_mention_count = (
          SELECT COUNT(*) FROM journal_goal_links WHERE life_goal_id = $1
        ),
        last_mentioned_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1`,
      [lifeGoalId]
    );

    const link = this.mapRowToLink(result.rows[0]);

    // Fire-and-forget: embed goal milestone in life history timeline
    if (relevantExcerpt) {
      query<{ user_id: string }>(`SELECT user_id FROM life_goals WHERE id = $1`, [lifeGoalId])
        .then(res => {
          const uid = res.rows[0]?.user_id;
          if (!uid) return;
          return import('../life-history-embedding.service.js').then(({ lifeHistoryEmbeddingService }) =>
            lifeHistoryEmbeddingService.embedLifeEvent({
              userId: uid,
              eventDate: new Date().toISOString().slice(0, 10),
              entryType: 'goal_milestone',
              category: 'goals',
              content: `Goal linked: ${linkType}. Excerpt: ${relevantExcerpt}`,
              sourceIds: [journalEntryId, lifeGoalId],
            })
          );
        })
        .catch(() => {});
    }

    return link;
  }

  // ============================================
  // MILESTONES
  // ============================================

  async createMilestone(userId: string, goalId: string, input: CreateLifeGoalMilestoneInput): Promise<LifeGoalMilestone> {
    await this.getGoalById(userId, goalId);

    if (!input.title || input.title.trim().length === 0) {
      throw ApiError.badRequest('Milestone title is required');
    }

    const result = await query<LifeGoalMilestoneRow>(
      `INSERT INTO life_goal_milestones (life_goal_id, user_id, title, description, target_date, target_value, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM life_goal_milestones WHERE life_goal_id = $1)))
       RETURNING *`,
      [goalId, userId, input.title.trim(), input.description ?? null, input.targetDate ?? null, input.targetValue ?? null, input.sortOrder ?? null]
    );

    return this.mapRowToMilestone(result.rows[0]);
  }

  async getMilestones(userId: string, goalId: string): Promise<LifeGoalMilestone[]> {
    await this.getGoalById(userId, goalId);

    const result = await query<LifeGoalMilestoneRow>(
      `SELECT * FROM life_goal_milestones WHERE life_goal_id = $1 AND user_id = $2 ORDER BY sort_order ASC`,
      [goalId, userId]
    );

    return result.rows.map((row) => this.mapRowToMilestone(row));
  }

  async updateMilestone(
    userId: string,
    milestoneId: string,
    updates: Partial<CreateLifeGoalMilestoneInput> & { currentValue?: number; completed?: boolean }
  ): Promise<LifeGoalMilestone> {
    const setClauses: string[] = [];
    const values: (string | number | boolean | null)[] = [];
    let paramIndex = 1;

    const fields: Record<string, unknown> = {
      title: updates.title?.trim(),
      description: updates.description,
      target_date: updates.targetDate,
      target_value: updates.targetValue,
      current_value: updates.currentValue,
      sort_order: updates.sortOrder,
    };

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        setClauses.push(`${key} = $${paramIndex++}`);
        values.push(value as string | number | null);
      }
    }

    if (updates.completed !== undefined) {
      setClauses.push(`completed = $${paramIndex++}`);
      values.push(updates.completed);
      setClauses.push(`completed_at = $${paramIndex++}`);
      values.push(updates.completed ? new Date().toISOString() : null);
    }

    if (setClauses.length === 0) {
      throw ApiError.badRequest('No updates provided');
    }

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    values.push(milestoneId, userId);

    const result = await query<LifeGoalMilestoneRow>(
      `UPDATE life_goal_milestones SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Milestone not found');
    }

    return this.mapRowToMilestone(result.rows[0]);
  }

  async completeMilestone(userId: string, milestoneId: string): Promise<LifeGoalMilestone> {
    return this.updateMilestone(userId, milestoneId, { completed: true });
  }

  async deleteMilestone(userId: string, milestoneId: string): Promise<void> {
    const result = await query(
      `DELETE FROM life_goal_milestones WHERE id = $1 AND user_id = $2 RETURNING id`,
      [milestoneId, userId]
    );
    if (result.rows.length === 0) {
      throw ApiError.notFound('Milestone not found');
    }
  }

  // ============================================
  // CHECK-INS
  // ============================================

  async createCheckin(userId: string, goalId: string, input: CreateLifeGoalCheckinInput): Promise<LifeGoalCheckin> {
    await this.getGoalById(userId, goalId);

    const today = new Date().toISOString().split('T')[0];

    const result = await query<LifeGoalCheckinRow>(
      `INSERT INTO life_goal_checkins (life_goal_id, user_id, checkin_date, progress_value, note, mood_about_goal)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (life_goal_id, checkin_date) DO UPDATE SET
         progress_value = COALESCE($4, life_goal_checkins.progress_value),
         note = COALESCE($5, life_goal_checkins.note),
         mood_about_goal = COALESCE($6, life_goal_checkins.mood_about_goal)
       RETURNING *`,
      [goalId, userId, today, input.progressValue ?? null, input.note ?? null, input.moodAboutGoal ?? null]
    );

    // Update the goal's current_value and progress if numeric tracking
    if (input.progressValue !== undefined) {
      await query(
        `UPDATE life_goals SET
          current_value = $1,
          progress = CASE WHEN target_value > 0 THEN LEAST(($1::float / target_value) * 100, 100) ELSE progress END,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND user_id = $3`,
        [input.progressValue, goalId, userId]
      );
    }

    return this.mapRowToCheckin(result.rows[0]);
  }

  async getCheckins(userId: string, goalId: string, limit: number = 30): Promise<LifeGoalCheckin[]> {
    await this.getGoalById(userId, goalId);

    const result = await query<LifeGoalCheckinRow>(
      `SELECT * FROM life_goal_checkins WHERE life_goal_id = $1 AND user_id = $2
       ORDER BY checkin_date DESC LIMIT $3`,
      [goalId, userId, limit]
    );

    return result.rows.map((row) => this.mapRowToCheckin(row));
  }

  async getCheckinStreak(userId: string, goalId: string): Promise<number> {
    const result = await query<{ streak: string }>(
      `WITH dates AS (
        SELECT checkin_date,
               checkin_date - (ROW_NUMBER() OVER (ORDER BY checkin_date DESC))::integer AS grp
        FROM life_goal_checkins
        WHERE life_goal_id = $1 AND user_id = $2
       )
       SELECT COUNT(*) as streak FROM dates
       WHERE grp = (SELECT grp FROM dates ORDER BY checkin_date DESC LIMIT 1)`,
      [goalId, userId]
    );

    return parseInt(result.rows[0]?.streak ?? '0', 10);
  }

  // ============================================
  // DASHBOARD AGGREGATE
  // ============================================

  async getLifeGoalDashboard(userId: string, goalId: string): Promise<LifeGoalDashboard> {
    const [goal, milestones, recentCheckins, checkinStreak, entries] = await Promise.all([
      this.getGoalById(userId, goalId),
      this.getMilestones(userId, goalId),
      this.getCheckins(userId, goalId, 14),
      this.getCheckinStreak(userId, goalId),
      this.getGoalEntries(userId, goalId, { limit: 10 }),
    ]);

    return {
      goal,
      milestones,
      recentCheckins,
      checkinStreak,
      lastCheckinDate: recentCheckins[0]?.checkinDate,
      journalLinks: entries.entries,
    };
  }

  // ============================================
  // MAPPING HELPERS
  // ============================================

  private mapRowToGoal(row: LifeGoalRow): LifeGoal {
    return {
      id: row.id,
      userId: row.user_id,
      category: row.category as LifeGoalCategory,
      title: row.title,
      description: row.description ?? undefined,
      motivation: row.motivation ?? undefined,
      trackingMethod: row.tracking_method as LifeGoal['trackingMethod'],
      targetValue: row.target_value ?? undefined,
      targetUnit: row.target_unit ?? undefined,
      currentValue: row.current_value,
      status: row.status,
      progress: row.progress,
      journalMentionCount: row.journal_mention_count,
      avgSentimentWhenMentioned: row.avg_sentiment_when_mentioned ?? undefined,
      lastMentionedAt: row.last_mentioned_at?.toISOString(),
      aiDetectedPatterns: row.ai_detected_patterns ?? [],
      detectionKeywords: row.detection_keywords ?? [],
      isPrimary: row.is_primary,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private mapRowToIntention(row: DailyIntentionRow): DailyIntention {
    return {
      id: row.id,
      userId: row.user_id,
      intentionDate: row.intention_date,
      intentionText: row.intention_text,
      checkinId: row.checkin_id ?? undefined,
      fulfilled: row.fulfilled ?? undefined,
      reflection: row.reflection ?? undefined,
      sortOrder: row.sort_order ?? 0,
      domain: row.domain ?? undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private mapRowToLink(row: JournalGoalLinkRow): JournalGoalLink {
    return {
      id: row.id,
      journalEntryId: row.journal_entry_id,
      lifeGoalId: row.life_goal_id,
      linkType: row.link_type as JournalGoalLink['linkType'],
      confidence: row.confidence ?? undefined,
      relevantExcerpt: row.relevant_excerpt ?? undefined,
      sentimentScore: row.sentiment_score ?? undefined,
      createdAt: row.created_at.toISOString(),
    };
  }

  private mapRowToMilestone(row: LifeGoalMilestoneRow): LifeGoalMilestone {
    return {
      id: row.id,
      lifeGoalId: row.life_goal_id,
      userId: row.user_id,
      title: row.title,
      description: row.description ?? undefined,
      targetDate: row.target_date ?? undefined,
      targetValue: row.target_value ?? undefined,
      currentValue: row.current_value,
      completed: row.completed,
      completedAt: row.completed_at?.toISOString(),
      sortOrder: row.sort_order,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private mapRowToCheckin(row: LifeGoalCheckinRow): LifeGoalCheckin {
    return {
      id: row.id,
      lifeGoalId: row.life_goal_id,
      userId: row.user_id,
      checkinDate: row.checkin_date,
      progressValue: row.progress_value ?? undefined,
      note: row.note ?? undefined,
      moodAboutGoal: row.mood_about_goal ?? undefined,
      createdAt: row.created_at.toISOString(),
    };
  }
}

export const lifeGoalsService = new LifeGoalsService();
export default lifeGoalsService;
