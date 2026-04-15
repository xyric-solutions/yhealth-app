/**
 * @file Theme Detection Service
 * @description Two-stage theme detection:
 *   Stage A: Per-entry theme extraction (LLM, real-time after journal creation)
 *   Stage B: Aggregate theme analysis (SQL, background job)
 */

import { query } from '../../database/pg.js';
import { logger } from '../logger.service.js';
import { modelFactory } from '../model-factory.service.js';
import type { ThemeTag, ThemeInsight } from '@shared/types/domain/wellbeing.js';

// ============================================
// VALID THEME TAXONOMY
// ============================================

const VALID_THEMES = new Set<ThemeTag>([
  'work_stress', 'relationship_conflict', 'health_concern', 'financial_worry',
  'gratitude', 'personal_growth', 'social_connection', 'family',
  'sleep_issues', 'exercise_motivation', 'anxiety', 'self_doubt',
  'productivity', 'spiritual', 'creative_expression',
]);

// ============================================
// SERVICE
// ============================================

class ThemeDetectionService {
  /**
   * Stage A: Extract themes from a journal entry using LLM
   * Called after journal entry creation (fire-and-forget)
   */
  async extractThemesFromEntry(userId: string, journalEntryId: string, entryText: string): Promise<void> {
    try {
      const themes = await this.callLLMForThemes(entryText);
      if (themes.length === 0) return;

      // Upsert themes into journal_insights (table has no updated_at column — use analyzed_at)
      await query(
        `INSERT INTO journal_insights (journal_entry_id, user_id, themes, analyzed_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (journal_entry_id) DO UPDATE SET themes = $3, analyzed_at = NOW()`,
        [journalEntryId, userId, themes]
      );
    } catch (error) {
      logger.error('[ThemeDetection] Theme extraction failed', { error, journalEntryId });
    }
  }

  /**
   * Stage B: Compute aggregate theme insights over a time window
   * Called from background job
   */
  async computeAggregateThemes(userId: string, windowDays: number = 30): Promise<ThemeInsight[]> {
    try {
      // Get theme frequency from journal_insights
      const result = await query<{
        theme: string;
        frequency: number;
        total_entries: number;
        recent_count: number;
        older_count: number;
      }>(`
        WITH theme_data AS (
          SELECT
            unnest(ji.themes) AS theme,
            ji.created_at,
            CASE WHEN ji.created_at >= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END AS is_recent,
            CASE WHEN ji.created_at < NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END AS is_older
          FROM journal_insights ji
          WHERE ji.user_id = $1
            AND ji.created_at >= NOW() - ($2::int || ' days')::interval
            AND ji.themes IS NOT NULL
            AND array_length(ji.themes, 1) > 0
        ),
        total AS (
          SELECT COUNT(DISTINCT ji.id)::int AS total_entries
          FROM journal_insights ji
          WHERE ji.user_id = $1
            AND ji.created_at >= NOW() - ($2::int || ' days')::interval
        )
        SELECT
          td.theme,
          COUNT(*)::int AS frequency,
          t.total_entries,
          SUM(td.is_recent)::int AS recent_count,
          SUM(td.is_older)::int AS older_count
        FROM theme_data td, total t
        GROUP BY td.theme, t.total_entries
        ORDER BY frequency DESC
      `, [userId, windowDays]);

      if (result.rows.length === 0) return [];

      const insights: ThemeInsight[] = result.rows
        .filter((row) => VALID_THEMES.has(row.theme as ThemeTag))
        .map((row) => {
          const percentage = row.total_entries > 0
            ? Math.round((row.frequency / row.total_entries) * 100)
            : 0;

          // Determine trend
          let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
          if (row.recent_count > row.older_count * 1.5) trend = 'increasing';
          else if (row.recent_count < row.older_count * 0.5) trend = 'decreasing';

          return {
            theme: row.theme as ThemeTag,
            frequency: row.frequency,
            percentage,
            trend,
          };
        });

      // Detect co-occurrences
      const coOccurrenceResult = await query<{
        theme_a: string;
        theme_b: string;
        co_count: number;
      }>(`
        WITH entry_themes AS (
          SELECT ji.id, unnest(ji.themes) AS theme
          FROM journal_insights ji
          WHERE ji.user_id = $1
            AND ji.created_at >= NOW() - ($2::int || ' days')::interval
            AND ji.themes IS NOT NULL
        )
        SELECT
          a.theme AS theme_a,
          b.theme AS theme_b,
          COUNT(*)::int AS co_count
        FROM entry_themes a
        JOIN entry_themes b ON a.id = b.id AND a.theme < b.theme
        GROUP BY a.theme, b.theme
        HAVING COUNT(*) >= 3
        ORDER BY co_count DESC
        LIMIT 20
      `, [userId, windowDays]);

      // Attach co-occurrences to insights
      for (const insight of insights) {
        const coOccurrences = coOccurrenceResult.rows
          .filter((r) => r.theme_a === insight.theme || r.theme_b === insight.theme)
          .map((r) => (r.theme_a === insight.theme ? r.theme_b : r.theme_a) as ThemeTag);
        if (coOccurrences.length > 0) insight.coOccurrences = coOccurrences;
      }

      // Store aggregate results in journal_patterns
      if (insights.length > 0) {
        await this.upsertThemePattern(userId, insights, windowDays);
      }

      return insights;
    } catch (error) {
      logger.error('[ThemeDetection] Aggregate computation failed', { error, userId });
      return [];
    }
  }

  /**
   * Get stored theme insights for a user
   */
  async getThemeInsights(userId: string): Promise<ThemeInsight[]> {
    const result = await query<{ evidence: { themes: ThemeInsight[] } }>(
      `SELECT evidence FROM journal_patterns
       WHERE user_id = $1 AND pattern_type = 'theme_aggregate' AND is_active = true
       ORDER BY computed_at DESC LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) return [];
    return result.rows[0].evidence?.themes || [];
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private async callLLMForThemes(text: string): Promise<string[]> {
    try {
      const model = modelFactory.getModel({
        tier: 'light',
        temperature: 0.2,
        maxTokens: 200,
      });

      const response = await model.invoke([
        {
          role: 'system',
          content: `Extract 1-5 theme tags from this journal entry. Use ONLY tags from this list:
work_stress, relationship_conflict, health_concern, financial_worry, gratitude, personal_growth, social_connection, family, sleep_issues, exercise_motivation, anxiety, self_doubt, productivity, spiritual, creative_expression

Return ONLY a JSON array of strings. Example: ["gratitude", "personal_growth"]
If no clear themes, return [].`,
        },
        { role: 'user', content: text },
      ]);

      let content = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      // Strip markdown fences
      content = content.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

      const parsed = JSON.parse(content);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter((t: unknown) => typeof t === 'string' && VALID_THEMES.has(t as ThemeTag))
        .slice(0, 5);
    } catch (error) {
      logger.error('[ThemeDetection] LLM theme extraction failed', { error });
      return [];
    }
  }

  private async upsertThemePattern(userId: string, themes: ThemeInsight[], windowDays: number): Promise<void> {
    const topThemes = themes.slice(0, 5).map((t) => t.theme).join(', ');
    const description = `Top themes: ${topThemes}`;

    await query(`
      INSERT INTO journal_patterns (
        user_id, pattern_type, pattern_description,
        evidence, window_days, computed_at, is_active, category
      ) VALUES ($1, 'theme_aggregate', $2, $3, $4, NOW(), true, 'theme')
      ON CONFLICT (user_id, pattern_type)
      DO UPDATE SET
        pattern_description = EXCLUDED.pattern_description,
        evidence = EXCLUDED.evidence,
        window_days = EXCLUDED.window_days,
        computed_at = NOW(),
        is_active = true,
        category = 'theme',
        updated_at = NOW()
    `, [
      userId,
      description,
      JSON.stringify({ themes }),
      windowDays,
    ]);
  }
}

export const themeDetectionService = new ThemeDetectionService();
export default themeDetectionService;
