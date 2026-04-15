/**
 * @file Mood Service
 * @description Handles mood check-ins with light/deep modes and pattern analysis
 */

import { query } from '../../database/pg.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../logger.service.js';
import type { MoodLog, WellbeingMode, MoodEmoji, EmotionTag, TriggerCategory } from '@shared/types/domain/wellbeing.js';
import { detectTimeOfDayPattern } from './utils/pattern-detection.js';

// Valid emotion tags matching the database enum
const VALID_EMOTION_TAGS: Set<EmotionTag> = new Set([
  'grateful', 'frustrated', 'excited', 'anxious', 'content', 'overwhelmed',
  'peaceful', 'irritated', 'hopeful', 'lonely', 'confident', 'sad', 'energized', 'calm'
]);

// Mapping for common invalid tags to valid ones
const EMOTION_TAG_MAPPING: Record<string, EmotionTag> = {
  // Happy/positive variants
  'happy': 'content',
  'joyful': 'excited',
  'cheerful': 'content',
  'pleased': 'content',
  'delighted': 'excited',
  'elated': 'excited',
  // Tired/low energy variants
  'tired': 'calm',
  'exhausted': 'overwhelmed',
  'fatigued': 'calm',
  'drained': 'overwhelmed',
  // Stressed/anxious variants
  'stressed': 'anxious',
  'worried': 'anxious',
  'nervous': 'anxious',
  'tense': 'anxious',
  // Energetic variants
  'energetic': 'energized',
  'lively': 'energized',
  'active': 'energized',
  // Angry variants
  'angry': 'frustrated',
  'mad': 'frustrated',
  'annoyed': 'irritated',
  // Sad variants
  'depressed': 'sad',
  'down': 'sad',
  'unhappy': 'sad',
  'blue': 'sad',
  // Calm variants
  'relaxed': 'calm',
  'serene': 'peaceful',
  'tranquil': 'peaceful',
};

/**
 * Validate and map emotion tags to valid enum values
 * @param tags - Array of emotion tags (may include invalid ones)
 * @returns Array of valid emotion tags
 */
function validateEmotionTags(tags: string[] | undefined): EmotionTag[] {
  if (!tags || tags.length === 0) return [];

  const validTags: EmotionTag[] = [];
  const seen = new Set<EmotionTag>();

  for (const tag of tags) {
    const normalizedTag = tag.toLowerCase().trim();

    // Check if it's already a valid tag
    if (VALID_EMOTION_TAGS.has(normalizedTag as EmotionTag)) {
      if (!seen.has(normalizedTag as EmotionTag)) {
        validTags.push(normalizedTag as EmotionTag);
        seen.add(normalizedTag as EmotionTag);
      }
      continue;
    }

    // Try to map to a valid tag
    const mappedTag = EMOTION_TAG_MAPPING[normalizedTag];
    if (mappedTag && !seen.has(mappedTag)) {
      validTags.push(mappedTag);
      seen.add(mappedTag);
    }
    // Skip invalid tags that can't be mapped
  }

  return validTags;
}

// ============================================
// TYPES
// ============================================

export interface CreateMoodLogInput {
  moodEmoji?: MoodEmoji;
  descriptor?: string;
  happinessRating?: number;
  energyRating?: number;
  stressRating?: number;
  anxietyRating?: number;
  emotionTags?: EmotionTag[];
  contextNote?: string;
  mode: WellbeingMode;
  loggedAt?: string;
  // Mood arc / transition tracking
  transitionTrigger?: string;
  triggerCategory?: TriggerCategory;
}

export interface MoodTransition {
  id: string;
  moodEmoji?: MoodEmoji;
  happinessRating?: number;
  transitionTrigger?: string;
  triggerCategory?: TriggerCategory;
  loggedAt: string;
  previousMoodLogId?: string;
}

export interface TransitionPatternResult {
  triggerCategory: TriggerCategory;
  totalOccurrences: number;
  averageMoodAfter: number;
  averageMoodBefore: number;
  moodDelta: number;
}

export interface MoodTimelineData {
  date: string;
  moodEmoji?: MoodEmoji;
  averageRating?: number; // Average of detailed ratings
  emotionTags: EmotionTag[];
}

export interface MoodPattern {
  timeOfDay: {
    morning: number;
    afternoon: number;
    evening: number;
    night: number;
  };
  dominantEmotions: Array<{ tag: EmotionTag; frequency: number }>;
  averageRatings: {
    happiness?: number;
    energy?: number;
    stress?: number;
    anxiety?: number;
  };
}

interface MoodLogRow {
  id: string;
  user_id: string;
  mood_emoji: MoodEmoji | null;
  descriptor: string | null;
  happiness_rating: number | null;
  energy_rating: number | null;
  stress_rating: number | null;
  anxiety_rating: number | null;
  emotion_tags: EmotionTag[];
  context_note: string | null;
  mode: WellbeingMode;
  transition_trigger: string | null;
  trigger_category: TriggerCategory | null;
  previous_mood_log_id: string | null;
  logged_at: Date;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// SERVICE CLASS
// ============================================

class MoodService {
  /**
   * Create a mood check-in log
   */
  async createMoodLog(userId: string, input: CreateMoodLogInput): Promise<MoodLog> {
    // Validate mode requirements
    if (input.mode === 'light' && !input.moodEmoji) {
      throw ApiError.badRequest('Mood emoji is required for light mode');
    }

    if (
      input.mode === 'deep' &&
      !input.happinessRating &&
      !input.energyRating &&
      !input.stressRating &&
      !input.anxietyRating
    ) {
      throw ApiError.badRequest('At least one rating is required for deep mode');
    }

    // Validate ratings are in range 1-10
    const ratings = [
      input.happinessRating,
      input.energyRating,
      input.stressRating,
      input.anxietyRating,
    ].filter((r) => r !== undefined) as number[];

    for (const rating of ratings) {
      if (rating < 1 || rating > 10) {
        throw ApiError.badRequest('Ratings must be between 1 and 10');
      }
    }

    const loggedAt = input.loggedAt
      ? new Date(input.loggedAt).toISOString()
      : new Date().toISOString();

    // Validate and map emotion tags to ensure they match database enum
    // Ensure tags are always an array and properly validated
    let emotionTagsInput: string[] = [];
    if (input.emotionTags) {
      if (Array.isArray(input.emotionTags)) {
        emotionTagsInput = input.emotionTags;
      } else {
        emotionTagsInput = [input.emotionTags];
      }
    }
    
    const validEmotionTags = validateEmotionTags(emotionTagsInput);
    
    // Log if tags were filtered/mapped for debugging
    if (emotionTagsInput.length > 0 && validEmotionTags.length !== emotionTagsInput.length) {
      logger.debug('[MoodService] Emotion tags were filtered/mapped', {
        original: emotionTagsInput,
        validated: validEmotionTags,
        userId,
      });
    }

    // Auto-detect previous mood log for transition tracking
    let previousMoodLogId: string | null = null;
    if (input.transitionTrigger || input.triggerCategory) {
      const todayStart = loggedAt.split('T')[0];
      const prevResult = await query<{ id: string }>(
        `SELECT id FROM mood_logs
         WHERE user_id = $1 AND DATE(logged_at) = $2
         ORDER BY logged_at DESC LIMIT 1`,
        [userId, todayStart]
      );
      if (prevResult.rows.length > 0) {
        previousMoodLogId = prevResult.rows[0].id;
      }
    }

    const result = await query<MoodLogRow>(
      `INSERT INTO mood_logs (
        user_id, mood_emoji, descriptor,
        happiness_rating, energy_rating, stress_rating, anxiety_rating,
        emotion_tags, context_note, mode, logged_at,
        transition_trigger, trigger_category, previous_mood_log_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        userId,
        input.moodEmoji || null,
        input.descriptor || null,
        input.happinessRating || null,
        input.energyRating || null,
        input.stressRating || null,
        input.anxietyRating || null,
        validEmotionTags.length > 0 ? validEmotionTags : [],
        input.contextNote || null,
        input.mode,
        loggedAt,
        input.transitionTrigger || null,
        input.triggerCategory || null,
        previousMoodLogId,
      ]
    );

    const moodLog = this.mapRowToMoodLog(result.rows[0]);

    // Fire-and-forget: embed mood check-in in life history timeline
    const moodContent = `Mood: ${input.moodEmoji || ''} ${input.descriptor || ''}. Happiness: ${input.happinessRating ?? 'N/A'}/10. Energy: ${input.energyRating ?? 'N/A'}/10.${input.contextNote ? ` Note: ${input.contextNote}` : ''}${input.emotionTags?.length ? ` Emotions: ${input.emotionTags.join(', ')}` : ''}`;
    import('../life-history-embedding.service.js').then(({ lifeHistoryEmbeddingService }) =>
      lifeHistoryEmbeddingService.embedLifeEvent({
        userId,
        eventDate: new Date().toISOString().slice(0, 10),
        entryType: 'emotional_checkin',
        category: 'wellbeing',
        content: moodContent,
        metadata: { mood: input.happinessRating, energy: input.energyRating, stress: input.stressRating, anxiety: input.anxietyRating },
        sourceIds: [moodLog.id],
      })
    ).catch(() => {});

    // Record for unified streak system
    import('./../../services/streak.service.js').then(({ streakService }) =>
      streakService.recordActivity(userId, 'mood_checkin', moodLog.id)
    ).catch(() => {});

    return moodLog;
  }

  /**
   * Get mood logs for a user
   */
  async getMoodLogs(
    userId: string,
    options: {
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    } = {}
  ): Promise<{ logs: MoodLog[]; total: number; page: number; limit: number }> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 50, 100);
    const offset = (page - 1) * limit;

    let queryText = `SELECT * FROM mood_logs WHERE user_id = $1`;
    const params: (string | number)[] = [userId];

    if (options.startDate) {
      queryText += ` AND DATE(logged_at) >= $${params.length + 1}`;
      params.push(options.startDate);
    }

    if (options.endDate) {
      queryText += ` AND DATE(logged_at) <= $${params.length + 1}`;
      params.push(options.endDate);
    }

    queryText += ` ORDER BY logged_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const logsResult = await query<MoodLogRow>(queryText, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM mood_logs WHERE user_id = $1`;
    const countParams: (string | number)[] = [userId];

    if (options.startDate) {
      countQuery += ` AND DATE(logged_at) >= $${countParams.length + 1}`;
      countParams.push(options.startDate);
    }

    if (options.endDate) {
      countQuery += ` AND DATE(logged_at) <= $${countParams.length + 1}`;
      countParams.push(options.endDate);
    }

    const countResult = await query<{ total: string }>(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total, 10);

    return {
      logs: logsResult.rows.map((row) => this.mapRowToMoodLog(row)),
      total,
      page,
      limit,
    };
  }

  /**
   * Convert mood emoji to numeric rating (for light mode)
   */
  private emojiToRating(emoji: MoodEmoji | null): number | null {
    if (!emoji) return null;
    const emojiMap: Record<string, number> = {
      // Legacy emojis
      '😊': 9,  // Great
      '😐': 6,  // Okay
      '😟': 4,  // Low
      '😡': 3,  // Angry
      '😰': 3,  // Anxious
      '😴': 5,  // Tired
      // Expanded 9-state model
      '😌': 8,  // Calm
      '😎': 9,  // Confident
      '🎯': 8,  // Focused
      '🤩': 9,  // Euphoric
      '🤔': 5,  // Distracted
      '😨': 2,  // Fearful
      '😤': 3,  // Frustrated
    };
    return emojiMap[emoji] ?? null;
  }

  /**
   * Get mood timeline data for visualization
   */
  async getMoodTimeline(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<MoodTimelineData[]> {
    const result = await query<MoodLogRow>(
      `SELECT * FROM mood_logs
       WHERE user_id = $1
       AND DATE(logged_at) >= $2
       AND DATE(logged_at) <= $3
       ORDER BY logged_at ASC`,
      [userId, startDate, endDate]
    );

    // Group by date and aggregate
    const dateMap = new Map<string, { ratings: number[]; moodEmoji?: MoodEmoji; emotionTags: EmotionTag[] }>();

    for (const row of result.rows) {
      const date = new Date(row.logged_at).toISOString().split('T')[0];

      if (!dateMap.has(date)) {
        dateMap.set(date, {
          ratings: [],
          emotionTags: [],
        });
      }

      const dayData = dateMap.get(date)!;

      // Collect ratings for this entry
      // For deep mode: use all available ratings
      if (row.mode === 'deep') {
        if (row.happiness_rating) dayData.ratings.push(row.happiness_rating);
        if (row.energy_rating) dayData.ratings.push(row.energy_rating);
        // Note: stress and anxiety are inverted (higher = worse), so we convert them
        if (row.stress_rating) dayData.ratings.push(11 - row.stress_rating); // Invert: 10 stress = 1 mood, 1 stress = 10 mood
        if (row.anxiety_rating) dayData.ratings.push(11 - row.anxiety_rating); // Invert: 10 anxiety = 1 mood, 1 anxiety = 10 mood
      } else {
        // For light mode: convert emoji to rating
        const emojiRating = this.emojiToRating(row.mood_emoji);
        if (emojiRating !== null) {
          dayData.ratings.push(emojiRating);
        }
      }

      // Use the most recent emoji for the day
      if (row.mood_emoji) {
        dayData.moodEmoji = row.mood_emoji;
      }

      // Aggregate emotion tags
      dayData.emotionTags = [...new Set([...dayData.emotionTags, ...row.emotion_tags])];
    }

    // Convert to timeline format with calculated averages
    const timeline: MoodTimelineData[] = [];
    for (const [date, data] of dateMap.entries()) {
      timeline.push({
        date,
        moodEmoji: data.moodEmoji,
        emotionTags: data.emotionTags,
        averageRating: data.ratings.length > 0
          ? data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length
          : undefined,
      });
    }

    return timeline.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get mood patterns and insights
   */
  async getMoodPatterns(userId: string, days: number = 30): Promise<MoodPattern> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const result = await query<MoodLogRow>(
      `SELECT * FROM mood_logs
       WHERE user_id = $1
       AND logged_at >= $2
       AND logged_at <= $3
       ORDER BY logged_at ASC`,
      [userId, startDate.toISOString(), endDate.toISOString()]
    );

    // Time of day patterns
    const timestamps = result.rows.map((r) => r.logged_at.toISOString());
    const ratings = result.rows.map((r) => {
      // Use happiness rating or convert emoji to number
      if (r.happiness_rating) return r.happiness_rating;
      return r.mood_emoji ? (this.emojiToRating(r.mood_emoji) ?? 6) : 6;
    });

    const timePatterns = detectTimeOfDayPattern(timestamps, ratings);

    // Dominant emotions
    const emotionFrequency = new Map<EmotionTag, number>();
    for (const row of result.rows) {
      for (const tag of row.emotion_tags) {
        emotionFrequency.set(tag, (emotionFrequency.get(tag) || 0) + 1);
      }
    }

    const dominantEmotions = Array.from(emotionFrequency.entries())
      .map(([tag, frequency]) => ({ tag, frequency }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5);

    // Average ratings (for deep mode entries)
    const deepModeRows = result.rows.filter((r) => r.mode === 'deep');
    const avgRatings: MoodPattern['averageRatings'] = {};

    if (deepModeRows.length > 0) {
      const happinessRatings = deepModeRows
        .map((r) => r.happiness_rating)
        .filter((r) => r !== null) as number[];
      const energyRatings = deepModeRows
        .map((r) => r.energy_rating)
        .filter((r) => r !== null) as number[];
      const stressRatings = deepModeRows
        .map((r) => r.stress_rating)
        .filter((r) => r !== null) as number[];
      const anxietyRatings = deepModeRows
        .map((r) => r.anxiety_rating)
        .filter((r) => r !== null) as number[];

      if (happinessRatings.length > 0) {
        avgRatings.happiness =
          happinessRatings.reduce((a, b) => a + b, 0) / happinessRatings.length;
      }
      if (energyRatings.length > 0) {
        avgRatings.energy = energyRatings.reduce((a, b) => a + b, 0) / energyRatings.length;
      }
      if (stressRatings.length > 0) {
        avgRatings.stress = stressRatings.reduce((a, b) => a + b, 0) / stressRatings.length;
      }
      if (anxietyRatings.length > 0) {
        avgRatings.anxiety = anxietyRatings.reduce((a, b) => a + b, 0) / anxietyRatings.length;
      }
    }

    return {
      timeOfDay: {
        morning: timePatterns.find((p) => p.period === 'morning')?.averageValue || 0,
        afternoon: timePatterns.find((p) => p.period === 'afternoon')?.averageValue || 0,
        evening: timePatterns.find((p) => p.period === 'evening')?.averageValue || 0,
        night: timePatterns.find((p) => p.period === 'night')?.averageValue || 0,
      },
      dominantEmotions,
      averageRatings: avgRatings,
    };
  }

  /**
   * Map database row to MoodLog interface
   */
  // ============================================
  // MOOD ARC / TRANSITION METHODS
  // ============================================

  /**
   * Get mood transitions for a specific day (mood arc)
   */
  async getMoodTransitions(userId: string, date: string): Promise<MoodTransition[]> {
    const result = await query<MoodLogRow>(
      `SELECT * FROM mood_logs
       WHERE user_id = $1 AND DATE(logged_at) = $2
       ORDER BY logged_at ASC`,
      [userId, date]
    );

    return result.rows.map((row) => ({
      id: row.id,
      moodEmoji: row.mood_emoji || undefined,
      happinessRating: row.happiness_rating || undefined,
      transitionTrigger: row.transition_trigger || undefined,
      triggerCategory: row.trigger_category || undefined,
      loggedAt: row.logged_at.toISOString(),
      previousMoodLogId: row.previous_mood_log_id || undefined,
    }));
  }

  /**
   * Analyze trigger → mood correlations over a time window
   */
  async getTransitionPatterns(userId: string, days: number = 30): Promise<TransitionPatternResult[]> {
    const result = await query<{
      trigger_category: TriggerCategory;
      total: string;
      avg_mood_after: string;
      avg_mood_before: string;
    }>(
      `WITH triggered_logs AS (
        SELECT
          ml.trigger_category,
          ml.mood_emoji,
          ml.happiness_rating,
          prev.mood_emoji AS prev_emoji,
          prev.happiness_rating AS prev_happiness
        FROM mood_logs ml
        LEFT JOIN mood_logs prev ON ml.previous_mood_log_id = prev.id
        WHERE ml.user_id = $1
          AND ml.trigger_category IS NOT NULL
          AND ml.logged_at >= NOW() - INTERVAL '1 day' * $2
      )
      SELECT
        trigger_category,
        COUNT(*) AS total,
        AVG(COALESCE(happiness_rating, 6)) AS avg_mood_after,
        AVG(COALESCE(prev_happiness, 6)) AS avg_mood_before
      FROM triggered_logs
      GROUP BY trigger_category
      HAVING COUNT(*) >= 2
      ORDER BY COUNT(*) DESC`,
      [userId, days]
    );

    return result.rows.map((row) => ({
      triggerCategory: row.trigger_category,
      totalOccurrences: parseInt(row.total, 10),
      averageMoodAfter: parseFloat(row.avg_mood_after),
      averageMoodBefore: parseFloat(row.avg_mood_before),
      moodDelta: parseFloat(row.avg_mood_after) - parseFloat(row.avg_mood_before),
    }));
  }

  // ============================================
  // MAPPING
  // ============================================

  private mapRowToMoodLog(row: MoodLogRow): MoodLog {
    return {
      id: row.id,
      userId: row.user_id,
      moodEmoji: row.mood_emoji || undefined,
      descriptor: row.descriptor || undefined,
      happinessRating: row.happiness_rating || undefined,
      energyRating: row.energy_rating || undefined,
      stressRating: row.stress_rating || undefined,
      anxietyRating: row.anxiety_rating || undefined,
      emotionTags: row.emotion_tags || [],
      contextNote: row.context_note || undefined,
      mode: row.mode,
      transitionTrigger: row.transition_trigger || undefined,
      triggerCategory: row.trigger_category || undefined,
      previousMoodLogId: row.previous_mood_log_id || undefined,
      loggedAt: row.logged_at.toISOString(),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}

export const moodService = new MoodService();
export default moodService;

