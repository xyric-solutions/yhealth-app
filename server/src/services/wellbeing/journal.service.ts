/**
 * @file Journal Service
 * @description Handles daily journaling with AI-personalized prompts (F7.2)
 */

import { query } from '../../database/pg.js';
import { ApiError } from '../../utils/ApiError.js';
import type { JournalEntry, WellbeingMode, JournalPromptCategory, JournalingMode } from '@shared/types/domain/wellbeing.js';
import { calculateStreak } from './utils/pattern-detection.js';

// ============================================
// TYPES
// ============================================

export interface JournalPrompt {
  id: string;
  text: string;
  category: JournalPromptCategory;
  description?: string;
}

export interface CreateJournalEntryInput {
  prompt: string;
  promptCategory?: JournalPromptCategory;
  promptId?: string;
  entryText: string;
  mode: WellbeingMode;
  voiceEntry?: boolean;
  durationSeconds?: number;
  loggedAt?: string;
  // Enhanced journaling fields
  checkinId?: string;
  journalingMode?: JournalingMode;
  aiGeneratedPrompt?: boolean;
}

export interface UpdateJournalEntryInput {
  entryText?: string;
  prompt?: string;
  promptCategory?: JournalPromptCategory;
}

export interface JournalStreak {
  currentStreak: number;
  longestStreak: number;
  streakStartDate?: string;
}

interface JournalEntryRow {
  id: string;
  user_id: string;
  prompt: string;
  prompt_category: JournalPromptCategory | null;
  prompt_id: string | null;
  entry_text: string;
  word_count: number;
  mode: WellbeingMode;
  voice_entry: boolean;
  duration_seconds: number | null;
  sentiment_score: number | null;
  sentiment_label: string | null;
  streak_day: number | null;
  // Enhanced journaling fields
  checkin_id: string | null;
  journaling_mode: string | null;
  ai_generated_prompt: boolean | null;
  coach_reflection: string | null;
  coach_reflection_at: Date | null;
  voice_audio_url: string | null;
  voice_duration_ms: number | null;
  voice_emotion_analysis: unknown | null;
  transcription_status: string | null;
  logged_at: Date;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// PROMPT LIBRARY (Research-based)
// ============================================

const PROMPT_LIBRARY: JournalPrompt[] = [
  // ============================================
  // GRATITUDE (8 prompts)
  // ============================================
  { id: 'gratitude-1', text: 'What are you grateful for today?', category: 'gratitude' },
  { id: 'gratitude-2', text: 'List three things you\'re grateful for today and why they matter.', category: 'gratitude' },
  { id: 'gratitude-3', text: 'Who made a positive impact on you today? How did they help?', category: 'gratitude' },
  { id: 'gratitude-4', text: 'What\'s a simple pleasure you enjoyed today?', category: 'gratitude' },
  { id: 'gratitude-5', text: 'What part of your body are you thankful for today?', category: 'gratitude' },
  { id: 'gratitude-6', text: 'What challenge from the past are you grateful you overcame?', category: 'gratitude' },
  { id: 'gratitude-7', text: 'What about your daily routine brings you comfort?', category: 'gratitude' },
  { id: 'gratitude-8', text: 'What skill or ability are you thankful to have?', category: 'gratitude' },

  // ============================================
  // REFLECTION (8 prompts)
  // ============================================
  { id: 'reflection-1', text: 'What\'s one thing that went well today? What made it successful?', category: 'reflection' },
  { id: 'reflection-2', text: 'What challenge did you face? What did you learn from it?', category: 'reflection' },
  { id: 'reflection-3', text: 'How did you show up as your best self today?', category: 'reflection' },
  { id: 'reflection-4', text: 'What\'s one thing that went well today? One thing to improve?', category: 'reflection' },
  { id: 'reflection-5', text: 'What surprised you about today?', category: 'reflection' },
  { id: 'reflection-6', text: 'What decision did you make today that you\'re proud of?', category: 'reflection' },
  { id: 'reflection-7', text: 'How did today compare to what you expected?', category: 'reflection' },
  { id: 'reflection-8', text: 'What moment today would you want to relive?', category: 'reflection' },

  // ============================================
  // EMOTIONAL PROCESSING (8 prompts)
  // ============================================
  { id: 'emotional-1', text: 'What emotion are you feeling right now? What triggered it?', category: 'emotional_processing' },
  { id: 'emotional-2', text: 'What\'s weighing on your mind? Why does it matter to you?', category: 'emotional_processing' },
  { id: 'emotional-3', text: 'If this emotion had a message for you, what would it be?', category: 'emotional_processing' },
  { id: 'emotional-4', text: 'How are you feeling? What\'s behind that emotion?', category: 'emotional_processing' },
  { id: 'emotional-5', text: 'Where do you feel this emotion in your body?', category: 'emotional_processing' },
  { id: 'emotional-6', text: 'What would it look like to fully accept how you feel right now?', category: 'emotional_processing' },
  { id: 'emotional-7', text: 'What emotion have you been avoiding? Why?', category: 'emotional_processing' },
  { id: 'emotional-8', text: 'Rate your emotional energy from 1-10. What\'s driving that number?', category: 'emotional_processing' },

  // ============================================
  // STRESS MANAGEMENT (8 prompts)
  // ============================================
  { id: 'stress-1', text: 'What\'s causing stress right now? What parts are within your control?', category: 'stress_management' },
  { id: 'stress-2', text: 'What\'s one action you can take to ease this stress?', category: 'stress_management' },
  { id: 'stress-3', text: 'What would help you feel calmer right now?', category: 'stress_management' },
  { id: 'stress-4', text: 'What boundary could you set to protect your peace?', category: 'stress_management' },
  { id: 'stress-5', text: 'What are you overthinking? Can you let it go for now?', category: 'stress_management' },
  { id: 'stress-6', text: 'What\'s the worst that could happen? How likely is it?', category: 'stress_management' },
  { id: 'stress-7', text: 'Name three things you can control right now.', category: 'stress_management' },
  { id: 'stress-8', text: 'What activity helps you decompress? When did you last do it?', category: 'stress_management' },

  // ============================================
  // SELF-COMPASSION (6 prompts)
  // ============================================
  { id: 'compassion-1', text: 'What would you say to a friend going through what you\'re experiencing?', category: 'self_compassion' },
  { id: 'compassion-2', text: 'What do you need to forgive yourself for today?', category: 'self_compassion' },
  { id: 'compassion-3', text: 'How can you be kinder to yourself tomorrow?', category: 'self_compassion' },
  { id: 'compassion-4', text: 'What unrealistic expectation are you holding yourself to?', category: 'self_compassion' },
  { id: 'compassion-5', text: 'What\'s something you\'re doing well that you rarely acknowledge?', category: 'self_compassion' },
  { id: 'compassion-6', text: 'Write yourself a permission slip: "I give myself permission to..."', category: 'self_compassion' },

  // ============================================
  // FUTURE FOCUS (8 prompts)
  // ============================================
  { id: 'future-1', text: 'What\'s one intention you have for tomorrow?', category: 'future_focus' },
  { id: 'future-2', text: 'What are you looking forward to this week?', category: 'future_focus' },
  { id: 'future-3', text: 'What would make tomorrow feel successful?', category: 'future_focus' },
  { id: 'future-4', text: 'What\'s one goal you have for tomorrow?', category: 'future_focus' },
  { id: 'future-5', text: 'What do you want to be different about next week?', category: 'future_focus' },
  { id: 'future-6', text: 'Where do you see yourself in 6 months if you stay on this path?', category: 'future_focus' },
  { id: 'future-7', text: 'What\'s one small step you can take tomorrow toward your biggest goal?', category: 'future_focus' },
  { id: 'future-8', text: 'What would your ideal morning look like tomorrow?', category: 'future_focus' },

  // ============================================
  // IDENTITY (8 prompts) -- NEW
  // ============================================
  { id: 'identity-1', text: 'What version of yourself are you becoming?', category: 'identity' },
  { id: 'identity-2', text: 'What values did you live by today?', category: 'identity' },
  { id: 'identity-3', text: 'What would the person you want to become do differently tomorrow?', category: 'identity' },
  { id: 'identity-4', text: 'What kind of life are you building?', category: 'identity' },
  { id: 'identity-5', text: 'What does your best self look like in 1 year?', category: 'identity' },
  { id: 'identity-6', text: 'What belief about yourself is holding you back?', category: 'identity' },
  { id: 'identity-7', text: 'What story are you telling yourself that isn\'t true?', category: 'identity' },
  { id: 'identity-8', text: 'If money and time were no object, who would you be?', category: 'identity' },

  // ============================================
  // PRODUCTIVITY (8 prompts) -- NEW
  // ============================================
  { id: 'productivity-1', text: 'What meaningful work did you do today?', category: 'productivity' },
  { id: 'productivity-2', text: 'Where did you waste time today? What triggered it?', category: 'productivity' },
  { id: 'productivity-3', text: 'What\'s the one thing that would make tomorrow most productive?', category: 'productivity' },
  { id: 'productivity-4', text: 'What did you procrastinate on today? What was the resistance?', category: 'productivity' },
  { id: 'productivity-5', text: 'What task gave you the most energy today?', category: 'productivity' },
  { id: 'productivity-6', text: 'What\'s your biggest time-waster this week? How can you reduce it?', category: 'productivity' },
  { id: 'productivity-7', text: 'What\'s the most impactful thing you could do tomorrow?', category: 'productivity' },
  { id: 'productivity-8', text: 'When were you in flow today? What enabled it?', category: 'productivity' },

  // ============================================
  // RELATIONSHIPS (8 prompts) -- NEW
  // ============================================
  { id: 'relationships-1', text: 'Who energized you today? What made that interaction special?', category: 'relationships' },
  { id: 'relationships-2', text: 'What conversation impacted you today?', category: 'relationships' },
  { id: 'relationships-3', text: 'Who do you need to reconnect with? What\'s stopping you?', category: 'relationships' },
  { id: 'relationships-4', text: 'What relationship in your life needs more attention?', category: 'relationships' },
  { id: 'relationships-5', text: 'How did you show up for someone else today?', category: 'relationships' },
  { id: 'relationships-6', text: 'What boundary do you need to set with someone?', category: 'relationships' },
  { id: 'relationships-7', text: 'Who do you admire and why? What can you learn from them?', category: 'relationships' },
  { id: 'relationships-8', text: 'What would your closest friend say about how you\'re doing?', category: 'relationships' },

  // ============================================
  // SPIRITUALITY (8 prompts) -- NEW
  // ============================================
  { id: 'spirituality-1', text: 'How did you connect with your faith today?', category: 'spirituality' },
  { id: 'spirituality-2', text: 'What gave you a sense of purpose today?', category: 'spirituality' },
  { id: 'spirituality-3', text: 'What are you surrendering control of today?', category: 'spirituality' },
  { id: 'spirituality-4', text: 'What moment today felt meaningful beyond the surface level?', category: 'spirituality' },
  { id: 'spirituality-5', text: 'How did you practice patience or trust today?', category: 'spirituality' },
  { id: 'spirituality-6', text: 'What prayer or intention are you carrying with you?', category: 'spirituality' },
  { id: 'spirituality-7', text: 'Where did you see beauty or grace today?', category: 'spirituality' },
  { id: 'spirituality-8', text: 'What lesson is life trying to teach you right now?', category: 'spirituality' },

  // ============================================
  // ANXIETY (8 prompts) -- NEW
  // ============================================
  { id: 'anxiety-1', text: 'What\'s making you anxious? Write it all out.', category: 'anxiety' },
  { id: 'anxiety-2', text: 'What\'s the most likely outcome of what you\'re worried about?', category: 'anxiety' },
  { id: 'anxiety-3', text: 'What physical sensations are you noticing right now?', category: 'anxiety' },
  { id: 'anxiety-4', text: 'What would you tell a child who felt the way you feel right now?', category: 'anxiety' },
  { id: 'anxiety-5', text: 'Name 5 things you can see, 4 you can touch, 3 you can hear.', category: 'anxiety' },
  { id: 'anxiety-6', text: 'What safety do you have right now that your anxiety is ignoring?', category: 'anxiety' },
  { id: 'anxiety-7', text: 'What has worked before when you felt this way?', category: 'anxiety' },
  { id: 'anxiety-8', text: 'What\'s the difference between preparing and worrying right now?', category: 'anxiety' },

  // ============================================
  // CREATIVITY (6 prompts) -- NEW
  // ============================================
  { id: 'creativity-1', text: 'What inspired you today? Why did it stand out?', category: 'creativity' },
  { id: 'creativity-2', text: 'If you could create anything right now with no limits, what would it be?', category: 'creativity' },
  { id: 'creativity-3', text: 'What new idea has been floating around in your mind?', category: 'creativity' },
  { id: 'creativity-4', text: 'When did you last feel truly creative? What sparked it?', category: 'creativity' },
  { id: 'creativity-5', text: 'What would you try if you knew you couldn\'t fail?', category: 'creativity' },
  { id: 'creativity-6', text: 'Describe your perfect day in vivid detail.', category: 'creativity' },

  // ============================================
  // CBT REFLECTION (8 prompts) -- NEW
  // ============================================
  { id: 'cbt-1', text: 'What evidence supports this thought? What evidence contradicts it?', category: 'cbt_reflection' },
  { id: 'cbt-2', text: 'If a friend told you this, what would you say to them?', category: 'cbt_reflection' },
  { id: 'cbt-3', text: 'On a scale of 1-10, how much will this matter in a year?', category: 'cbt_reflection' },
  { id: 'cbt-4', text: 'What is one alternative explanation for what happened?', category: 'cbt_reflection' },
  { id: 'cbt-5', text: 'What thought pattern are you caught in? (catastrophizing, mind-reading, all-or-nothing?)', category: 'cbt_reflection' },
  { id: 'cbt-6', text: 'What\'s the most balanced way to look at this situation?', category: 'cbt_reflection' },
  { id: 'cbt-7', text: 'What would you think about this situation if you were in a great mood?', category: 'cbt_reflection' },
  { id: 'cbt-8', text: 'Separate the facts from your interpretation. What actually happened vs. what you assumed?', category: 'cbt_reflection' },

  // ============================================
  // CROSS-PILLAR (8 prompts) -- NEW
  // ============================================
  { id: 'cross-1', text: 'How did your workout affect your mood today?', category: 'cross_pillar' },
  { id: 'cross-2', text: 'Did what you ate today impact your energy levels?', category: 'cross_pillar' },
  { id: 'cross-3', text: 'How did your sleep quality affect your motivation today?', category: 'cross_pillar' },
  { id: 'cross-4', text: 'What connection do you notice between your stress and your eating habits?', category: 'cross_pillar' },
  { id: 'cross-5', text: 'When you skipped your workout today, what mental effect did that have?', category: 'cross_pillar' },
  { id: 'cross-6', text: 'How does your social life affect your fitness consistency?', category: 'cross_pillar' },
  { id: 'cross-7', text: 'What mindset helped you perform well in your workout today?', category: 'cross_pillar' },
  { id: 'cross-8', text: 'How did your overall wellbeing affect your food choices today?', category: 'cross_pillar' },
];

// ============================================
// SERVICE CLASS
// ============================================

class JournalService {
  /**
   * Get recommended prompts based on user context
   */
  async getRecommendedPrompts(
    _userId: string,
    limit: number = 3
  ): Promise<JournalPrompt[]> {
    // TODO: Implement AI personalization based on:
    // - Recent mood patterns
    // - Stress levels
    // - Sleep quality
    // - Workout consistency
    // - Recent journal themes

    // For now, return random prompts from different categories
    const categories = new Set<JournalPromptCategory>();
    const selected: JournalPrompt[] = [];
    const shuffled = [...PROMPT_LIBRARY].sort(() => Math.random() - 0.5);

    for (const prompt of shuffled) {
      if (!categories.has(prompt.category)) {
        selected.push(prompt);
        categories.add(prompt.category);
        if (selected.length >= limit) break;
      }
    }

    // Fill remaining slots if needed
    while (selected.length < limit && selected.length < PROMPT_LIBRARY.length) {
      const remaining = PROMPT_LIBRARY.filter((p) => !selected.includes(p));
      if (remaining.length === 0) break;
      selected.push(remaining[Math.floor(Math.random() * remaining.length)]);
    }

    return selected.slice(0, limit);
  }

  /**
   * Create a journal entry
   */
  async createJournalEntry(userId: string, input: CreateJournalEntryInput): Promise<JournalEntry> {
    if (!input.entryText || input.entryText.trim().length === 0) {
      throw ApiError.badRequest('Entry text is required');
    }

    const wordCount = input.entryText.trim().split(/\s+/).filter((w) => w.length > 0).length;

    // Calculate sentiment score (simple implementation)
    // TODO: Integrate with proper sentiment analysis service
    const sentimentLabel = this.calculateSentiment(input.entryText);
    const sentimentScore = this.calculateSentimentScore(input.entryText);

    // Calculate streak
    const streak = await this.calculateJournalStreak(userId);

    const loggedAt = input.loggedAt
      ? new Date(input.loggedAt).toISOString()
      : new Date().toISOString();

    const result = await query<JournalEntryRow>(
      `INSERT INTO journal_entries (
        user_id, prompt, prompt_category, prompt_id,
        entry_text, word_count, mode, voice_entry,
        duration_seconds, sentiment_score, sentiment_label, streak_day, logged_at,
        checkin_id, journaling_mode, ai_generated_prompt
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        userId,
        input.prompt,
        input.promptCategory || null,
        input.promptId || null,
        input.entryText,
        wordCount,
        input.mode,
        input.voiceEntry || false,
        input.durationSeconds || null,
        sentimentScore,
        sentimentLabel,
        streak.currentStreak > 0 ? streak.currentStreak + 1 : 1,
        loggedAt,
        input.checkinId || null,
        input.journalingMode || null,
        input.aiGeneratedPrompt || false,
      ]
    );

    const entry = this.mapRowToJournalEntry(result.rows[0]);

    // Fire-and-forget: extract lessons from journal entry (non-blocking)
    this.triggerLessonExtraction(userId, entry.id, input.entryText).catch(() => {});

    // Fire-and-forget: embed journal entry in life history timeline
    import('../life-history-embedding.service.js').then(({ lifeHistoryEmbeddingService }) =>
      lifeHistoryEmbeddingService.embedLifeEvent({
        userId,
        eventDate: new Date().toISOString().slice(0, 10),
        entryType: 'journal',
        category: 'wellbeing',
        content: input.entryText,
        sourceIds: [entry.id],
      })
    ).catch(() => {});

    // Record for unified streak system
    import('../streak.service.js').then(({ streakService }) =>
      streakService.recordActivity(userId, 'journal', entry.id)
    ).catch(() => {});

    return entry;
  }

  /**
   * Trigger async lesson extraction from journal entry text
   * Uses dynamic import to avoid circular dependencies
   */
  private async triggerLessonExtraction(userId: string, entryId: string, entryText: string): Promise<void> {
    const { lessonsLearnedService } = await import('./lessons-learned.service.js');
    await lessonsLearnedService.extractLessonsFromJournal(userId, entryId, entryText);

    // Fire-and-forget theme extraction
    import('./theme-detection.service.js').then(({ themeDetectionService }) => {
      themeDetectionService.extractThemesFromEntry(userId, entryId, entryText);
    }).catch(() => {});
  }

  /**
   * Get journal entries for a user
   */
  async getJournalEntries(
    userId: string,
    options: {
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
      category?: JournalPromptCategory;
    } = {}
  ): Promise<{ entries: JournalEntry[]; total: number; page: number; limit: number }> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 50, 100);
    const offset = (page - 1) * limit;

    let queryText = `SELECT * FROM journal_entries WHERE user_id = $1`;
    const params: (string | number)[] = [userId];

    if (options.startDate) {
      queryText += ` AND DATE(logged_at) >= $${params.length + 1}`;
      params.push(options.startDate);
    }

    if (options.endDate) {
      queryText += ` AND DATE(logged_at) <= $${params.length + 1}`;
      params.push(options.endDate);
    }

    if (options.category) {
      queryText += ` AND prompt_category = $${params.length + 1}`;
      params.push(options.category);
    }

    queryText += ` ORDER BY logged_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const entriesResult = await query<JournalEntryRow>(queryText, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM journal_entries WHERE user_id = $1`;
    const countParams: (string | number)[] = [userId];

    if (options.startDate) {
      countQuery += ` AND DATE(logged_at) >= $${countParams.length + 1}`;
      countParams.push(options.startDate);
    }

    if (options.endDate) {
      countQuery += ` AND DATE(logged_at) <= $${countParams.length + 1}`;
      countParams.push(options.endDate);
    }

    if (options.category) {
      countQuery += ` AND prompt_category = $${countParams.length + 1}`;
      countParams.push(options.category);
    }

    const countResult = await query<{ total: string }>(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total, 10);

    return {
      entries: entriesResult.rows.map((row) => this.mapRowToJournalEntry(row)),
      total,
      page,
      limit,
    };
  }

  /**
   * Get a single journal entry by ID
   */
  async getJournalEntryById(userId: string, entryId: string): Promise<JournalEntry> {
    const result = await query<JournalEntryRow>(
      `SELECT * FROM journal_entries WHERE id = $1 AND user_id = $2`,
      [entryId, userId]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Journal entry not found');
    }

    return this.mapRowToJournalEntry(result.rows[0]);
  }

  /**
   * Update a journal entry
   */
  async updateJournalEntry(
    userId: string,
    entryId: string,
    input: UpdateJournalEntryInput
  ): Promise<JournalEntry> {
    // Verify ownership
    const existing = await query<JournalEntryRow>(
      `SELECT * FROM journal_entries WHERE id = $1 AND user_id = $2`,
      [entryId, userId]
    );

    if (existing.rows.length === 0) {
      throw ApiError.notFound('Journal entry not found');
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (input.entryText !== undefined) {
      if (input.entryText.trim().length === 0) {
        throw ApiError.badRequest('Entry text cannot be empty');
      }
      const wordCount = input.entryText.trim().split(/\s+/).filter((w) => w.length > 0).length;
      updates.push(`entry_text = $${paramIndex++}`);
      updates.push(`word_count = $${paramIndex++}`);
      values.push(input.entryText.trim(), wordCount);
    }

    if (input.prompt !== undefined) {
      updates.push(`prompt = $${paramIndex++}`);
      values.push(input.prompt);
    }

    if (input.promptCategory !== undefined) {
      updates.push(`prompt_category = $${paramIndex++}`);
      values.push(input.promptCategory);
    }

    if (updates.length === 0) {
      return this.mapRowToJournalEntry(existing.rows[0]);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(entryId, userId);

    const result = await query<JournalEntryRow>(
      `UPDATE journal_entries
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
       RETURNING *`,
      values
    );

    return this.mapRowToJournalEntry(result.rows[0]);
  }

  /**
   * Delete a journal entry
   */
  async deleteJournalEntry(userId: string, entryId: string): Promise<void> {
    const result = await query(
      `DELETE FROM journal_entries WHERE id = $1 AND user_id = $2 RETURNING id`,
      [entryId, userId]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Journal entry not found');
    }
  }

  /**
   * Get journal streak information
   */
  async getJournalStreak(userId: string): Promise<JournalStreak> {
    const result = await query<{ logged_at: Date }>(
      `SELECT DATE(logged_at) as logged_at
       FROM journal_entries
       WHERE user_id = $1
       ORDER BY logged_at DESC
       LIMIT 90`,
      [userId]
    );

    if (result.rows.length === 0) {
      return { currentStreak: 0, longestStreak: 0 };
    }

    const dates = result.rows.map((r) => new Date(r.logged_at).toISOString().split('T')[0]);
    const completed = dates.map(() => true);

    return calculateStreak(dates, completed);
  }

  /**
   * Calculate journal streak (internal)
   */
  private async calculateJournalStreak(userId: string): Promise<JournalStreak> {
    return this.getJournalStreak(userId);
  }

  /**
   * Simple sentiment calculation (basic implementation)
   * TODO: Replace with proper sentiment analysis service
   */
  private calculateSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const lowerText = text.toLowerCase();

    const positiveWords = ['happy', 'grateful', 'thankful', 'excited', 'joy', 'love', 'good', 'great', 'wonderful', 'amazing', 'fantastic'];
    const negativeWords = ['sad', 'angry', 'frustrated', 'stressed', 'worried', 'anxious', 'bad', 'terrible', 'awful', 'hate', 'disappointed'];

    const positiveCount = positiveWords.filter((w) => lowerText.includes(w)).length;
    const negativeCount = negativeWords.filter((w) => lowerText.includes(w)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  /**
   * Calculate sentiment score (-1 to 1)
   */
  private calculateSentimentScore(text: string): number {
    const lowerText = text.toLowerCase();

    const positiveWords = ['happy', 'grateful', 'thankful', 'excited', 'joy', 'love', 'good', 'great', 'wonderful', 'amazing', 'fantastic'];
    const negativeWords = ['sad', 'angry', 'frustrated', 'stressed', 'worried', 'anxious', 'bad', 'terrible', 'awful', 'hate', 'disappointed'];

    const positiveCount = positiveWords.filter((w) => lowerText.includes(w)).length;
    const negativeCount = negativeWords.filter((w) => lowerText.includes(w)).length;

    const total = positiveCount + negativeCount;
    if (total === 0) return 0;

    return (positiveCount - negativeCount) / Math.max(total, 1);
  }

  /**
   * Map database row to JournalEntry interface
   */
  private mapRowToJournalEntry(row: JournalEntryRow): JournalEntry {
    return {
      id: row.id,
      userId: row.user_id,
      prompt: row.prompt,
      promptCategory: row.prompt_category || undefined,
      promptId: row.prompt_id || undefined,
      entryText: row.entry_text,
      wordCount: row.word_count,
      mode: row.mode,
      voiceEntry: row.voice_entry,
      durationSeconds: row.duration_seconds || undefined,
      sentimentScore: row.sentiment_score || undefined,
      sentimentLabel: (row.sentiment_label as 'positive' | 'negative' | 'neutral') || undefined,
      streakDay: row.streak_day || undefined,
      // Enhanced journaling fields
      checkinId: row.checkin_id || undefined,
      journalingMode: (row.journaling_mode as JournalingMode) || undefined,
      aiGeneratedPrompt: row.ai_generated_prompt || undefined,
      coachReflection: row.coach_reflection || undefined,
      coachReflectionAt: row.coach_reflection_at?.toISOString(),
      voiceAudioUrl: row.voice_audio_url || undefined,
      voiceDurationMs: row.voice_duration_ms || undefined,
      voiceEmotionAnalysis: row.voice_emotion_analysis as JournalEntry['voiceEmotionAnalysis'],
      transcriptionStatus: (row.transcription_status as JournalEntry['transcriptionStatus']) || undefined,
      loggedAt: row.logged_at.toISOString(),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}

export const journalService = new JournalService();
export default journalService;

