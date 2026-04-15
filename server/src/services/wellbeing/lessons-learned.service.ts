/**
 * @file Lessons Learned Service
 * @description AI-extracted and user-entered structured insights from journals and evening reviews
 */

import { query } from '../../database/pg.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../logger.service.js';
import { modelFactory } from '../model-factory.service.js';
import type { LessonLearned, LessonDomain, LessonSource } from '@shared/types/domain/wellbeing.js';

// ============================================
// TYPES
// ============================================

interface LessonRow {
  id: string;
  user_id: string;
  journal_entry_id: string | null;
  checkin_id: string | null;
  lesson_text: string;
  domain: LessonDomain;
  source: LessonSource;
  is_confirmed: boolean;
  is_dismissed: boolean;
  mention_count: number;
  last_reminded_at: Date | null;
  tags: string[];
  created_at: Date;
  updated_at: Date;
}

interface ExtractedLesson {
  lesson_text: string;
  domain: LessonDomain;
}

const VALID_DOMAINS: Set<string> = new Set([
  'health', 'work', 'relationships', 'personal', 'spiritual', 'productivity', 'other',
]);

// ============================================
// SERVICE CLASS
// ============================================

class LessonsLearnedService {
  /**
   * Extract lessons from a journal entry using LLM
   * Fire-and-forget: called after journal entry creation
   */
  async extractLessonsFromJournal(userId: string, journalEntryId: string, entryText: string): Promise<void> {
    try {
      if (!entryText || entryText.trim().length < 20) return; // Skip very short entries

      const lessons = await this.callLLMForExtraction(entryText);

      for (const lesson of lessons) {
        await this.createLesson(userId, {
          lessonText: lesson.lesson_text,
          domain: lesson.domain,
          source: 'ai_extracted',
          journalEntryId,
        });
      }

      logger.debug('[LessonsLearned] Extracted lessons from journal', {
        userId,
        journalEntryId,
        count: lessons.length,
      });
    } catch (error) {
      logger.error('[LessonsLearned] Extraction failed', { userId, journalEntryId, error });
    }
  }

  /**
   * Save user-entered lessons from evening review
   */
  async extractLessonsFromEveningReview(userId: string, checkinId: string, lessonsText: string[]): Promise<LessonLearned[]> {
    const results: LessonLearned[] = [];

    for (const text of lessonsText) {
      if (!text || text.trim().length === 0) continue;

      const lesson = await this.createLesson(userId, {
        lessonText: text.trim(),
        domain: 'personal', // Default domain for user-entered
        source: 'evening_review',
        checkinId,
        isConfirmed: true, // User-entered lessons are auto-confirmed
      });
      results.push(lesson);
    }

    return results;
  }

  /**
   * Get paginated lessons for a user
   */
  async getLessons(
    userId: string,
    options: { domain?: LessonDomain; confirmed?: boolean; page?: number; limit?: number } = {}
  ): Promise<{ lessons: LessonLearned[]; total: number; page: number; limit: number }> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100);
    const offset = (page - 1) * limit;

    let queryText = `SELECT * FROM lessons_learned WHERE user_id = $1 AND is_dismissed = false`;
    const params: (string | number | boolean)[] = [userId];

    if (options.domain) {
      queryText += ` AND domain = $${params.length + 1}`;
      params.push(options.domain);
    }

    if (options.confirmed !== undefined) {
      queryText += ` AND is_confirmed = $${params.length + 1}`;
      params.push(options.confirmed);
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query<LessonRow>(queryText, params);

    // Count
    let countQuery = `SELECT COUNT(*) as total FROM lessons_learned WHERE user_id = $1 AND is_dismissed = false`;
    const countParams: (string | number | boolean)[] = [userId];

    if (options.domain) {
      countQuery += ` AND domain = $${countParams.length + 1}`;
      countParams.push(options.domain);
    }
    if (options.confirmed !== undefined) {
      countQuery += ` AND is_confirmed = $${countParams.length + 1}`;
      countParams.push(options.confirmed);
    }

    const countResult = await query<{ total: string }>(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total, 10);

    return {
      lessons: result.rows.map((row) => this.mapRow(row)),
      total,
      page,
      limit,
    };
  }

  /**
   * Confirm an AI-extracted lesson
   */
  async confirmLesson(userId: string, lessonId: string): Promise<LessonLearned> {
    const result = await query<LessonRow>(
      `UPDATE lessons_learned SET is_confirmed = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [lessonId, userId]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Lesson not found');
    }

    return this.mapRow(result.rows[0]);
  }

  /**
   * Dismiss a lesson
   */
  async dismissLesson(userId: string, lessonId: string): Promise<void> {
    await query(
      `UPDATE lessons_learned SET is_dismissed = true, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2`,
      [lessonId, userId]
    );
  }

  /**
   * Get confirmed lessons that are due for a reminder (>2 weeks old, not reminded recently)
   */
  async getLessonsForReminder(userId: string): Promise<LessonLearned[]> {
    const result = await query<LessonRow>(
      `SELECT * FROM lessons_learned
       WHERE user_id = $1
         AND is_confirmed = true
         AND is_dismissed = false
         AND created_at < NOW() - INTERVAL '14 days'
         AND (last_reminded_at IS NULL OR last_reminded_at < NOW() - INTERVAL '7 days')
       ORDER BY RANDOM()
       LIMIT 3`,
      [userId]
    );

    return result.rows.map((row) => this.mapRow(row));
  }

  /**
   * Mark a lesson as reminded
   */
  async markReminded(userId: string, lessonId: string): Promise<void> {
    await query(
      `UPDATE lessons_learned SET last_reminded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2`,
      [lessonId, userId]
    );
  }

  /**
   * Search lessons by text
   */
  async searchLessons(userId: string, searchQuery: string): Promise<LessonLearned[]> {
    const result = await query<LessonRow>(
      `SELECT * FROM lessons_learned
       WHERE user_id = $1 AND is_dismissed = false AND lesson_text ILIKE $2
       ORDER BY created_at DESC LIMIT 20`,
      [userId, `%${searchQuery}%`]
    );

    return result.rows.map((row) => this.mapRow(row));
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private async createLesson(
    userId: string,
    data: {
      lessonText: string;
      domain: LessonDomain;
      source: LessonSource;
      journalEntryId?: string;
      checkinId?: string;
      isConfirmed?: boolean;
    }
  ): Promise<LessonLearned> {
    const domain = VALID_DOMAINS.has(data.domain) ? data.domain : 'other';

    const result = await query<LessonRow>(
      `INSERT INTO lessons_learned (
        user_id, journal_entry_id, checkin_id, lesson_text, domain, source, is_confirmed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        userId,
        data.journalEntryId ?? null,
        data.checkinId ?? null,
        data.lessonText,
        domain,
        data.source,
        data.isConfirmed ?? false,
      ]
    );

    const lesson = this.mapRow(result.rows[0]);

    // Fire-and-forget: embed lesson in life history timeline
    import('../life-history-embedding.service.js').then(({ lifeHistoryEmbeddingService }) =>
      lifeHistoryEmbeddingService.embedLifeEvent({
        userId,
        eventDate: new Date().toISOString().slice(0, 10),
        entryType: 'lesson',
        category: 'wellbeing',
        content: `Lesson learned: ${data.lessonText}. Domain: ${domain}. Source: ${data.source}.`,
        sourceIds: [lesson.id],
      })
    ).catch(() => {});

    return lesson;
  }

  /**
   * Call LLM to extract lessons from journal text
   * Uses dynamic import to avoid circular dependencies with LangChain services
   */
  private async callLLMForExtraction(text: string): Promise<ExtractedLesson[]> {
    try {
      const model = modelFactory.getModel({
        tier: 'light',
        temperature: 0.3,
        maxTokens: 500,
      });

      const response = await model.invoke([
        {
          role: 'system',
          content: `You analyze journal entries and extract discrete lessons or realizations the writer had.
For each lesson, return a JSON array of objects with:
- "lesson_text": A concise, reusable statement (e.g., "Taking a walk before meetings reduces my anxiety")
- "domain": One of: health, work, relationships, personal, spiritual, productivity, other

Return 0-3 lessons. Only extract genuine insights or realizations, not factual statements.
Return ONLY valid JSON array, no markdown.
If no lessons found, return [].`,
        },
        {
          role: 'user',
          content: text,
        },
      ]);

      let content = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      // Strip markdown code fences if present (e.g. ```json ... ```)
      content = content.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

      const parsed = JSON.parse(content);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter((item: unknown) => {
          if (typeof item !== 'object' || item === null) return false;
          const obj = item as Record<string, unknown>;
          return typeof obj.lesson_text === 'string' && typeof obj.domain === 'string';
        })
        .slice(0, 3)
        .map((item: Record<string, unknown>) => ({
          lesson_text: item.lesson_text as string,
          domain: (VALID_DOMAINS.has(item.domain as string) ? item.domain : 'other') as LessonDomain,
        }));
    } catch (error) {
      logger.error('[LessonsLearned] LLM extraction failed', { error });
      return [];
    }
  }

  // ============================================
  // MAPPING
  // ============================================

  private mapRow(row: LessonRow): LessonLearned {
    return {
      id: row.id,
      userId: row.user_id,
      journalEntryId: row.journal_entry_id ?? undefined,
      checkinId: row.checkin_id ?? undefined,
      lessonText: row.lesson_text,
      domain: row.domain,
      source: row.source,
      isConfirmed: row.is_confirmed,
      isDismissed: row.is_dismissed,
      mentionCount: row.mention_count,
      lastRemindedAt: row.last_reminded_at?.toISOString(),
      tags: row.tags ?? [],
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}

export const lessonsLearnedService = new LessonsLearnedService();
export default lessonsLearnedService;
