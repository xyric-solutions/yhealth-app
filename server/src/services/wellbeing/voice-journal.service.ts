/**
 * @file Voice Journal Service
 * @description Conversational voice journaling: record → transcribe → AI responds → summarize → approve
 */

import { query } from '../../database/pg.js';
import { ApiError } from '../../utils/ApiError.js';
import { logger } from '../logger.service.js';
import { assemblyAIService } from '../assemblyai.service.js';
import { modelFactory } from '../model-factory.service.js';
import type {
  VoiceJournalSession,
  VoiceJournalTranscriptEntry,
  VoiceJournalTurnResponse,
  VoiceJournalSummary,
  VoiceJournalStatus,
} from '@shared/types/domain/wellbeing.js';

// ============================================
// ROW MAPPING
// ============================================

interface SessionRow {
  id: string;
  user_id: string;
  status: VoiceJournalStatus;
  exchange_count: number;
  transcript: VoiceJournalTranscriptEntry[];
  summary_mood: string | null;
  summary_themes: string[] | null;
  summary_lessons: string[] | null;
  summary_action_items: string[] | null;
  summary_text: string | null;
  journal_entry_id: string | null;
  total_duration_seconds: number;
  started_at: Date;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: SessionRow): VoiceJournalSession {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    exchangeCount: row.exchange_count,
    transcript: row.transcript || [],
    summaryMood: row.summary_mood ?? undefined,
    summaryThemes: row.summary_themes ?? undefined,
    summaryLessons: row.summary_lessons ?? undefined,
    summaryActionItems: row.summary_action_items ?? undefined,
    summaryText: row.summary_text ?? undefined,
    journalEntryId: row.journal_entry_id ?? undefined,
    totalDurationSeconds: row.total_duration_seconds,
    startedAt: row.started_at.toISOString(),
    completedAt: row.completed_at?.toISOString(),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

// ============================================
// SERVICE
// ============================================

class VoiceJournalService {
  /**
   * Start a new voice journaling session
   */
  async startSession(userId: string): Promise<VoiceJournalSession> {
    // Abandon any active sessions first
    await query(
      `UPDATE voice_journal_sessions SET status = 'abandoned' WHERE user_id = $1 AND status = 'active'`,
      [userId]
    );

    const result = await query<SessionRow>(
      `INSERT INTO voice_journal_sessions (user_id, status, started_at)
       VALUES ($1, 'active', NOW())
       RETURNING *`,
      [userId]
    );

    return mapRow(result.rows[0]);
  }

  /**
   * Get the user's active session (if any)
   */
  async getActiveSession(userId: string): Promise<VoiceJournalSession | null> {
    const result = await query<SessionRow>(
      `SELECT * FROM voice_journal_sessions WHERE user_id = $1 AND status IN ('active', 'review') ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  /**
   * Get a session by ID (with ownership check)
   */
  async getSession(userId: string, sessionId: string): Promise<VoiceJournalSession> {
    const result = await query<SessionRow>(
      `SELECT * FROM voice_journal_sessions WHERE id = $1 AND user_id = $2`,
      [sessionId, userId]
    );
    if (!result.rows[0]) throw ApiError.notFound('Session not found');
    return mapRow(result.rows[0]);
  }

  /**
   * Process a voice turn: transcribe audio → generate AI response → update session
   */
  async processVoiceTurn(
    userId: string,
    sessionId: string,
    audioBuffer: Buffer
  ): Promise<VoiceJournalTurnResponse> {
    const session = await this.getSession(userId, sessionId);
    if (session.status !== 'active') {
      throw ApiError.badRequest('Session is not active');
    }

    // 1. Transcribe audio via AssemblyAI
    let userTranscript: string;
    try {
      userTranscript = await assemblyAIService.transcribeAudio(audioBuffer, {
        languageCode: 'en',
      });
    } catch (error) {
      logger.error('[VoiceJournal] Transcription failed', { error, sessionId });
      throw ApiError.internal('Failed to transcribe audio. Please try again.');
    }

    if (!userTranscript.trim()) {
      throw ApiError.badRequest("I didn't catch that. Could you try again?");
    }

    // 2. Add user entry to transcript
    const userEntry: VoiceJournalTranscriptEntry = {
      role: 'user',
      text: userTranscript,
      timestamp: new Date().toISOString(),
    };

    const updatedTranscript = [...session.transcript, userEntry];
    const newExchangeCount = session.exchangeCount + 1;

    // 3. Generate AI response
    const { aiResponse, readyToSummarize } = await this.generateAIResponse(
      userId,
      updatedTranscript,
      newExchangeCount
    );

    // 4. Add AI response to transcript
    const aiEntry: VoiceJournalTranscriptEntry = {
      role: 'ai',
      text: aiResponse,
      timestamp: new Date().toISOString(),
    };

    const finalTranscript = [...updatedTranscript, aiEntry];

    // 5. Update session
    await query(
      `UPDATE voice_journal_sessions
       SET transcript = $1, exchange_count = $2, updated_at = NOW()
       WHERE id = $3`,
      [JSON.stringify(finalTranscript), newExchangeCount, sessionId]
    );

    return {
      userTranscript,
      aiResponse,
      exchangeCount: newExchangeCount,
      readyToSummarize,
    };
  }

  /**
   * Process a text turn (fallback when mic unavailable)
   */
  async processTextTurn(
    userId: string,
    sessionId: string,
    text: string
  ): Promise<VoiceJournalTurnResponse> {
    const session = await this.getSession(userId, sessionId);
    if (session.status !== 'active') {
      throw ApiError.badRequest('Session is not active');
    }

    if (!text.trim()) {
      throw ApiError.badRequest('Please provide some text.');
    }

    const userEntry: VoiceJournalTranscriptEntry = {
      role: 'user',
      text: text.trim(),
      timestamp: new Date().toISOString(),
    };

    const updatedTranscript = [...session.transcript, userEntry];
    const newExchangeCount = session.exchangeCount + 1;

    const { aiResponse, readyToSummarize } = await this.generateAIResponse(
      userId,
      updatedTranscript,
      newExchangeCount
    );

    const aiEntry: VoiceJournalTranscriptEntry = {
      role: 'ai',
      text: aiResponse,
      timestamp: new Date().toISOString(),
    };

    const finalTranscript = [...updatedTranscript, aiEntry];

    await query(
      `UPDATE voice_journal_sessions
       SET transcript = $1, exchange_count = $2, updated_at = NOW()
       WHERE id = $3`,
      [JSON.stringify(finalTranscript), newExchangeCount, sessionId]
    );

    return {
      userTranscript: text.trim(),
      aiResponse,
      exchangeCount: newExchangeCount,
      readyToSummarize,
    };
  }

  /**
   * Generate summary from the conversation transcript
   */
  async generateSummary(userId: string, sessionId: string): Promise<VoiceJournalSummary> {
    const session = await this.getSession(userId, sessionId);
    if (session.status !== 'active') {
      throw ApiError.badRequest('Session is not in a summarizable state');
    }

    // Mark as summarizing
    await query(
      `UPDATE voice_journal_sessions SET status = 'summarizing', updated_at = NOW() WHERE id = $1`,
      [sessionId]
    );

    try {
      const summary = await this.callLLMForSummary(session.transcript);

      // Update session with summary and move to review
      await query(
        `UPDATE voice_journal_sessions
         SET status = 'review',
             summary_mood = $1,
             summary_themes = $2,
             summary_lessons = $3,
             summary_action_items = $4,
             summary_text = $5,
             updated_at = NOW()
         WHERE id = $6`,
        [
          summary.mood,
          summary.themes,
          summary.lessons,
          summary.actionItems,
          summary.journalText,
          sessionId,
        ]
      );

      return summary;
    } catch (error) {
      // Revert to active on failure
      await query(
        `UPDATE voice_journal_sessions SET status = 'active', updated_at = NOW() WHERE id = $1`,
        [sessionId]
      );
      logger.error('[VoiceJournal] Summary generation failed', { error, sessionId });
      throw ApiError.internal('Failed to generate summary. Please try again.');
    }
  }

  /**
   * Approve the summary and create a journal entry
   */
  async approveAndSave(
    userId: string,
    sessionId: string,
    editedText?: string
  ): Promise<{ journalEntryId: string }> {
    const session = await this.getSession(userId, sessionId);
    if (session.status !== 'review') {
      throw ApiError.badRequest('Session is not in review state');
    }

    const entryText = editedText?.trim() || session.summaryText;
    if (!entryText) {
      throw ApiError.badRequest('No journal text to save');
    }

    // Create journal entry via direct insert (matching journal.service.ts pattern)
    const entryResult = await query<{ id: string }>(
      `INSERT INTO journal_entries (
        user_id, prompt, prompt_category, entry_text, word_count,
        mode, voice_entry, journaling_mode, logged_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING id`,
      [
        userId,
        'Voice Journal Conversation',
        'reflection',
        entryText,
        entryText.split(/\s+/).length,
        'deep',
        true,
        'voice_conversation',
      ]
    );

    const journalEntryId = entryResult.rows[0].id;

    // Mark session as completed
    await query(
      `UPDATE voice_journal_sessions
       SET status = 'completed',
           journal_entry_id = $1,
           completed_at = NOW(),
           total_duration_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::int,
           updated_at = NOW()
       WHERE id = $2`,
      [journalEntryId, sessionId]
    );

    // Fire-and-forget: extract lessons from the journal entry
    this.triggerLessonExtraction(userId, journalEntryId, entryText).catch(() => {});

    // Fire-and-forget: embed voice journal session in life history timeline
    import('../life-history-embedding.service.js').then(({ lifeHistoryEmbeddingService }) =>
      lifeHistoryEmbeddingService.embedLifeEvent({
        userId,
        eventDate: new Date().toISOString().slice(0, 10),
        entryType: 'voice_session',
        category: 'wellbeing',
        content: entryText,
        sourceIds: [journalEntryId],
      })
    ).catch(() => {});

    return { journalEntryId };
  }

  /**
   * Abandon a session
   */
  async abandonSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.getSession(userId, sessionId);
    if (session.status === 'completed' || session.status === 'abandoned') {
      return; // Already terminal state
    }

    await query(
      `UPDATE voice_journal_sessions
       SET status = 'abandoned', completed_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [sessionId]
    );
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private async generateAIResponse(
    userId: string,
    transcript: VoiceJournalTranscriptEntry[],
    exchangeCount: number
  ): Promise<{ aiResponse: string; readyToSummarize: boolean }> {
    try {
      // Get coaching profile for personalization (optional)
      let coachingContext = '';
      try {
        const { userCoachingProfileService } = await import('../user-coaching-profile.service.js');
        const profile = await userCoachingProfileService.getProfile(userId);
        if (profile) {
          coachingContext = `\nUser coaching context: Name: ${profile.firstName || 'not set'}.`;
        }
      } catch {
        // Non-critical — proceed without profile
      }

      const model = modelFactory.getModel({
        tier: 'light',
        temperature: 0.7,
        maxTokens: 300,
      });

      const conversationHistory = transcript
        .map((t) => `${t.role === 'user' ? 'User' : 'Coach'}: ${t.text}`)
        .join('\n');

      const systemPrompt = `You are a warm, empathetic journaling coach having a reflective conversation.
Your role is to help the user explore their thoughts, feelings, and experiences for the day.
${coachingContext}

Guidelines:
- Be warm and validating, not clinical
- Ask follow-up questions about feelings, triggers, and lessons
- Focus on one thread at a time — don't ask multiple questions
- Keep responses to 2-3 sentences
- After ${exchangeCount >= 4 ? 'this exchange' : '3-5 exchanges'}, you may feel the conversation has enough material

At the end of your response, add a JSON line:
{"readyToSummarize": true/false}
Set true when you feel enough material has been shared (typically 3-5 exchanges).`;

      const response = await model.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Conversation so far:\n${conversationHistory}\n\nRespond as the Coach.` },
      ]);

      let content = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      // Parse readyToSummarize flag from response
      let readyToSummarize = false;
      const jsonMatch = content.match(/\{"readyToSummarize"\s*:\s*(true|false)\}/);
      if (jsonMatch) {
        readyToSummarize = jsonMatch[1] === 'true';
        content = content.replace(jsonMatch[0], '').trim();
      }

      // Force ready after 5 exchanges
      if (exchangeCount >= 5) readyToSummarize = true;

      return { aiResponse: content, readyToSummarize };
    } catch (error) {
      logger.error('[VoiceJournal] AI response generation failed', { error });
      throw ApiError.internal('Failed to generate response');
    }
  }

  private async callLLMForSummary(
    transcript: VoiceJournalTranscriptEntry[]
  ): Promise<VoiceJournalSummary> {
    const model = modelFactory.getModel({
      tier: 'light',
      temperature: 0.3,
      maxTokens: 800,
    });

    const conversationText = transcript
      .map((t) => `${t.role === 'user' ? 'User' : 'Coach'}: ${t.text}`)
      .join('\n');

    const response = await model.invoke([
      {
        role: 'system',
        content: `You are summarizing a voice journaling conversation into a structured journal entry.

Given the conversation transcript, produce a JSON object with:
{
  "mood": "one-word mood label (e.g. 'reflective', 'anxious', 'grateful', 'content')",
  "themes": ["1-5 theme tags from: work_stress, relationship_conflict, health_concern, financial_worry, gratitude, personal_growth, social_connection, family, sleep_issues, exercise_motivation, anxiety, self_doubt, productivity, spiritual, creative_expression"],
  "lessons": ["0-3 key insights or lessons learned"],
  "actionItems": ["0-3 action items or intentions mentioned"],
  "journalText": "A natural, first-person journal entry (150-300 words) written as if the user wrote it. Capture key feelings, events, reflections, and insights from the conversation. Write in their voice."
}

Return ONLY valid JSON, no markdown.`,
      },
      { role: 'user', content: conversationText },
    ]);

    let content = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    // Strip markdown code fences
    content = content.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

    const parsed = JSON.parse(content);

    return {
      mood: parsed.mood || 'neutral',
      themes: Array.isArray(parsed.themes) ? parsed.themes : [],
      lessons: Array.isArray(parsed.lessons) ? parsed.lessons : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
      journalText: parsed.journalText || '',
    };
  }

  private async triggerLessonExtraction(userId: string, journalEntryId: string, entryText: string): Promise<void> {
    try {
      const { lessonsLearnedService } = await import('./lessons-learned.service.js');
      await lessonsLearnedService.extractLessonsFromJournal(userId, journalEntryId, entryText);
    } catch (error) {
      logger.error('[VoiceJournal] Lesson extraction failed', { error, journalEntryId });
    }

    // Fire-and-forget theme extraction
    import('./theme-detection.service.js').then(({ themeDetectionService }) => {
      themeDetectionService.extractThemesFromEntry(userId, journalEntryId, entryText);
    }).catch(() => {});
  }
}

export const voiceJournalService = new VoiceJournalService();
export default voiceJournalService;
