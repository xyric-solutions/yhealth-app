/**
 * @file Behavioral Pattern Service
 * @description Detects mood behavioral patterns using SQL-based analysis (no LLM)
 * Patterns: negativity bias, trigger identification, euphoria-regret cycle, escalation flags
 */

import { query } from '../../database/pg.js';
import { logger } from '../logger.service.js';
import type { BehavioralPattern, PatternSeverity } from '@shared/types/domain/wellbeing.js';

// ============================================
// TYPES
// ============================================

interface BehavioralPatternRow {
  id: string;
  user_id: string;
  pattern_key: string;
  pattern_description: string;
  detection_data: Record<string, unknown>;
  severity: PatternSeverity;
  first_detected_at: Date;
  last_detected_at: Date;
  is_active: boolean;
  acknowledged_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// Emoji sets used in SQL queries (documented here for reference)
// Negative: '😰', '😤', '😨', '😟', '😡'
// Euphoric: '🤩'
// Positive: '😌', '😎', '🎯', '😊', '🤩'

// ============================================
// SERVICE CLASS
// ============================================

class BehavioralPatternService {
  /**
   * Run all pattern detection algorithms for a user
   */
  async detectPatterns(userId: string): Promise<void> {
    try {
      await Promise.all([
        this.detectNegativityBias(userId),
        this.detectTriggerIdentification(userId),
        this.detectEuphoriaRegretCycle(userId),
        this.detectEscalationFlag(userId),
      ]);
    } catch (error) {
      logger.error('[BehavioralPattern] Detection failed', { userId, error });
    }
  }

  /**
   * Get active patterns for a user
   */
  async getActivePatterns(userId: string): Promise<BehavioralPattern[]> {
    const result = await query<BehavioralPatternRow>(
      `SELECT * FROM mood_behavioral_patterns
       WHERE user_id = $1 AND is_active = true
       ORDER BY severity DESC, last_detected_at DESC`,
      [userId]
    );

    return result.rows.map((row) => this.mapRow(row));
  }

  /**
   * Acknowledge a pattern (user has seen it)
   */
  async acknowledgePattern(userId: string, patternId: string): Promise<void> {
    await query(
      `UPDATE mood_behavioral_patterns
       SET acknowledged_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2`,
      [patternId, userId]
    );
  }

  /**
   * Dismiss a pattern (deactivate)
   */
  async dismissPattern(userId: string, patternId: string): Promise<void> {
    await query(
      `UPDATE mood_behavioral_patterns
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2`,
      [patternId, userId]
    );
  }

  // ============================================
  // DETECTION ALGORITHMS
  // ============================================

  /**
   * Negativity bias: >70% of mood logs in last 14 days are negative
   */
  private async detectNegativityBias(userId: string): Promise<void> {
    const result = await query<{ total: string; negative: string }>(
      `SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE mood_emoji IN ('😰', '😤', '😨', '😟', '😡')) AS negative
       FROM mood_logs
       WHERE user_id = $1 AND logged_at >= NOW() - INTERVAL '14 days'`,
      [userId]
    );

    const total = parseInt(result.rows[0].total, 10);
    const negative = parseInt(result.rows[0].negative, 10);

    if (total < 5) return; // Not enough data

    const ratio = negative / total;
    if (ratio > 0.7) {
      await this.upsertPattern(userId, {
        patternKey: 'negativity_bias',
        patternDescription: `${Math.round(ratio * 100)}% of your mood logs in the last 2 weeks reflect negative emotions. Consider logging when you feel neutral or positive too — it helps build a balanced picture.`,
        severity: 'warning',
        detectionData: { total, negative, ratio: Math.round(ratio * 100) },
      });
    } else {
      // Deactivate if no longer true
      await this.deactivatePattern(userId, 'negativity_bias');
    }
  }

  /**
   * Trigger identification: GROUP BY trigger_category, find categories with consistently low happiness
   */
  private async detectTriggerIdentification(userId: string): Promise<void> {
    const result = await query<{ trigger_category: string; avg_happiness: string; count: string }>(
      `SELECT
        trigger_category,
        AVG(happiness_rating) AS avg_happiness,
        COUNT(*) AS count
       FROM mood_logs
       WHERE user_id = $1
         AND trigger_category IS NOT NULL
         AND logged_at >= NOW() - INTERVAL '30 days'
       GROUP BY trigger_category
       HAVING COUNT(*) >= 3`,
      [userId]
    );

    const negativeCategories = result.rows.filter(
      (row) => parseFloat(row.avg_happiness) < 4
    );

    // Upsert a pattern for each negative trigger category
    for (const cat of negativeCategories) {
      const avg = parseFloat(cat.avg_happiness).toFixed(1);
      await this.upsertPattern(userId, {
        patternKey: `trigger_negative_${cat.trigger_category}`,
        patternDescription: `Your mood tends to drop after "${cat.trigger_category}" events (avg ${avg}/10 across ${cat.count} logs). Consider preparing coping strategies before these situations.`,
        severity: 'warning',
        detectionData: {
          triggerCategory: cat.trigger_category,
          avgHappiness: parseFloat(avg),
          count: parseInt(cat.count, 10),
          windowDays: 30,
        },
      });
    }

    // Deactivate trigger patterns for categories that are no longer negative
    const activeNegativeKeys = negativeCategories.map(
      (c) => `trigger_negative_${c.trigger_category}`
    );
    const existingPatterns = await query<{ pattern_key: string }>(
      `SELECT pattern_key FROM mood_behavioral_patterns
       WHERE user_id = $1 AND is_active = true AND pattern_key LIKE 'trigger_negative_%'`,
      [userId]
    );
    for (const row of existingPatterns.rows) {
      if (!activeNegativeKeys.includes(row.pattern_key)) {
        await this.deactivatePattern(userId, row.pattern_key);
      }
    }
  }

  /**
   * Euphoria-regret cycle: Euphoric log followed by negative log within 48h
   */
  private async detectEuphoriaRegretCycle(userId: string): Promise<void> {
    const result = await query<{ cycles: string }>(
      `WITH euphoric AS (
        SELECT id, logged_at
        FROM mood_logs
        WHERE user_id = $1
          AND mood_emoji = '🤩'
          AND logged_at >= NOW() - INTERVAL '30 days'
      )
      SELECT COUNT(*) AS cycles
      FROM euphoric e
      WHERE EXISTS (
        SELECT 1 FROM mood_logs ml
        WHERE ml.user_id = $1
          AND ml.mood_emoji IN ('😰', '😤', '😨', '😟', '😡')
          AND ml.logged_at > e.logged_at
          AND ml.logged_at < e.logged_at + INTERVAL '48 hours'
      )`,
      [userId]
    );

    const cycles = parseInt(result.rows[0].cycles, 10);
    if (cycles >= 2) {
      await this.upsertPattern(userId, {
        patternKey: 'euphoria_regret_cycle',
        patternDescription: `We noticed ${cycles} instances where a high-energy euphoric mood was followed by a negative mood within 48 hours. This pattern can signal impulsive decisions during peak excitement.`,
        severity: 'info',
        detectionData: { cycles, windowDays: 30 },
      });
    } else {
      await this.deactivatePattern(userId, 'euphoria_regret_cycle');
    }
  }

  /**
   * Escalation flag: 3+ anxiety logs in 48h without a positive log between
   */
  private async detectEscalationFlag(userId: string): Promise<void> {
    const result = await query<{ anxiety_count: string; has_positive_between: boolean }>(
      `WITH recent_anxiety AS (
        SELECT logged_at
        FROM mood_logs
        WHERE user_id = $1
          AND mood_emoji IN ('😰', '😨')
          AND logged_at >= NOW() - INTERVAL '48 hours'
        ORDER BY logged_at ASC
      )
      SELECT
        COUNT(*) AS anxiety_count,
        EXISTS (
          SELECT 1 FROM mood_logs
          WHERE user_id = $1
            AND mood_emoji IN ('😌', '😎', '🎯', '😊', '🤩')
            AND logged_at >= NOW() - INTERVAL '48 hours'
        ) AS has_positive_between
      FROM recent_anxiety`,
      [userId]
    );

    const anxietyCount = parseInt(result.rows[0].anxiety_count, 10);
    const hasPositive = result.rows[0].has_positive_between;

    if (anxietyCount >= 3 && !hasPositive) {
      await this.upsertPattern(userId, {
        patternKey: 'escalation_flag',
        patternDescription: `You've logged anxiety ${anxietyCount} times in the last 48 hours without a positive mood entry between. Consider taking a break, trying a breathing exercise, or reaching out to someone you trust.`,
        severity: 'alert',
        detectionData: { anxietyCount, hoursWindow: 48 },
      });
    } else {
      await this.deactivatePattern(userId, 'escalation_flag');
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  private async upsertPattern(
    userId: string,
    data: {
      patternKey: string;
      patternDescription: string;
      severity: PatternSeverity;
      detectionData: Record<string, unknown>;
    }
  ): Promise<void> {
    await query(
      `INSERT INTO mood_behavioral_patterns (
        user_id, pattern_key, pattern_description, severity, detection_data,
        first_detected_at, last_detected_at, is_active
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, true)
      ON CONFLICT (user_id, pattern_key)
      DO UPDATE SET
        pattern_description = EXCLUDED.pattern_description,
        severity = EXCLUDED.severity,
        detection_data = EXCLUDED.detection_data,
        last_detected_at = CURRENT_TIMESTAMP,
        is_active = true,
        updated_at = CURRENT_TIMESTAMP`,
      [userId, data.patternKey, data.patternDescription, data.severity, JSON.stringify(data.detectionData)]
    );
  }

  private async deactivatePattern(userId: string, patternKey: string): Promise<void> {
    await query(
      `UPDATE mood_behavioral_patterns
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND pattern_key = $2 AND is_active = true`,
      [userId, patternKey]
    );
  }

  private mapRow(row: BehavioralPatternRow): BehavioralPattern {
    return {
      id: row.id,
      userId: row.user_id,
      patternKey: row.pattern_key,
      patternDescription: row.pattern_description,
      detectionData: row.detection_data,
      severity: row.severity,
      firstDetectedAt: row.first_detected_at.toISOString(),
      lastDetectedAt: row.last_detected_at.toISOString(),
      isActive: row.is_active,
      acknowledgedAt: row.acknowledged_at?.toISOString(),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}

export const behavioralPatternService = new BehavioralPatternService();
export default behavioralPatternService;
