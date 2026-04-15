/**
 * @file Call Summary Service
 * @description Generates post-call summaries with action items
 */

import { logger } from './logger.service.js';
import { query } from '../database/pg.js';
import { aiProviderService } from './ai-provider.service.js';
import type { SessionType } from '../types/voice-call.types.js';

// ============================================================================
// Types
// ============================================================================

export interface CallSummary {
  id: string;
  callId: string;
  userId: string;
  sessionType: SessionType;
  depthMode: 'light' | 'deep';
  summary: string;
  keyInsights: string[];
  actionItems: ActionItem[];
  emotionalTrend?: string;
  duration: number;
  generatedAt: Date;
  deliveryStatus: DeliveryStatus;
}

export interface ActionItem {
  id: string;
  summaryId: string;
  content: string;
  category: ActionCategory;
  priority: 'high' | 'medium' | 'low';
  dueDate?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  completedAt?: Date;
  reminderSet?: boolean;
}

export type ActionCategory = 
  | 'fitness'
  | 'nutrition'
  | 'sleep'
  | 'stress'
  | 'wellness'
  | 'goal'
  | 'habit'
  | 'follow_up';

export interface DeliveryStatus {
  app: boolean;
  whatsapp: boolean;
  push: boolean;
  deliveredAt?: Date;
}

export interface SummaryGenerationOptions {
  callId: string;
  userId: string;
  sessionType: SessionType;
  depthMode?: 'light' | 'deep';
  conversationId?: string;
  duration: number;
}

interface CallSummaryRow {
  id: string;
  call_id: string;
  user_id: string;
  session_type: string;
  depth_mode: string;
  summary: string;
  key_insights: string | string[];
  action_items: string | ActionItem[];
  emotional_trend: string | null;
  duration: number;
  generated_at: Date;
  delivery_status: string | DeliveryStatus;
  created_at: Date;
  updated_at: Date;
}

interface ActionItemRow {
  id: string;
  summary_id: string;
  content: string;
  category: string;
  priority: string;
  due_date: Date | null;
  status: string;
  completed_at: Date | null;
  reminder_set: boolean;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// Service
// ============================================================================

class CallSummaryService {
  // Note: GENERATION_TIMEOUT reserved for future timeout implementation
  // private readonly GENERATION_TIMEOUT = 30000; // 30 seconds max

  /**
   * Generate summary for a completed call
   */
  async generateSummary(options: SummaryGenerationOptions): Promise<CallSummary> {
    const startTime = Date.now();
    
    try {
      logger.info('[CallSummary] Starting summary generation', {
        callId: options.callId,
        sessionType: options.sessionType,
        depthMode: options.depthMode || 'light',
      });

      // Determine depth mode based on session type if not specified
      const depthMode = options.depthMode || this.getDefaultDepthMode(options.sessionType);

      // Get conversation transcript
      const transcript = await this.getConversationTranscript(options.callId, options.conversationId);

      // Get emotion data for the call
      const emotionTrend = await this.getEmotionTrend(options.userId, options.callId);

      // Generate summary using AI
      const summaryContent = await this.generateSummaryContent(
        transcript,
        options.sessionType,
        depthMode,
        emotionTrend
      );

      // Extract action items
      const actionItems = await this.extractActionItems(
        transcript,
        summaryContent,
        options.sessionType
      );

      // Save summary to database
      const summary = await this.saveSummary({
        callId: options.callId,
        userId: options.userId,
        sessionType: options.sessionType,
        depthMode,
        summary: summaryContent.summary,
        keyInsights: summaryContent.keyInsights,
        actionItems,
        emotionalTrend: emotionTrend,
        duration: options.duration,
      });

      const generationTime = Date.now() - startTime;
      logger.info('[CallSummary] Summary generated successfully', {
        callId: options.callId,
        summaryId: summary.id,
        generationTimeMs: generationTime,
        actionItemCount: actionItems.length,
      });

      return summary;
    } catch (error) {
      logger.error('[CallSummary] Error generating summary', {
        error: error instanceof Error ? error.message : 'Unknown error',
        callId: options.callId,
      });
      throw error;
    }
  }

  /**
   * Get default depth mode based on session type
   */
  private getDefaultDepthMode(sessionType: SessionType): 'light' | 'deep' {
    const deepModeTypes: SessionType[] = ['coaching_session', 'goal_review', 'emergency_support'];
    return deepModeTypes.includes(sessionType) ? 'deep' : 'light';
  }

  /**
   * Get conversation transcript for the call
   */
  private async getConversationTranscript(
    callId: string,
    conversationId?: string
  ): Promise<string> {
    try {
      // Try to get from RAG conversations
      if (conversationId) {
        const result = await query<{ messages: string | object[] }>(
          `SELECT messages FROM rag_conversations WHERE id = $1`,
          [conversationId]
        );

        if (result.rows.length > 0) {
          const messages = typeof result.rows[0].messages === 'string'
            ? JSON.parse(result.rows[0].messages)
            : result.rows[0].messages;
          
          return messages.map((m: { role: string; content: string }) => 
            `${m.role}: ${m.content}`
          ).join('\n');
        }
      }

      // Fallback: Get from voice call events
      const eventsResult = await query<{ event_data: string | object }>(
        `SELECT event_data FROM voice_call_events 
         WHERE call_id = $1 AND event_type IN ('user_spoke', 'ai_response_completed')
         ORDER BY timestamp ASC`,
        [callId]
      );

      if (eventsResult.rows.length > 0) {
        return eventsResult.rows.map(row => {
          const data = typeof row.event_data === 'string'
            ? JSON.parse(row.event_data)
            : row.event_data;
          return data.transcript || data.response || '';
        }).filter(Boolean).join('\n');
      }

      return '';
    } catch (error) {
      logger.error('[CallSummary] Error getting transcript', {
        error: error instanceof Error ? error.message : 'Unknown error',
        callId,
      });
      return '';
    }
  }

  /**
   * Get emotion trend for the call
   */
  private async getEmotionTrend(userId: string, callId: string): Promise<string | undefined> {
    try {
      const result = await query<{ emotion_category: string; count: string }>(
        `SELECT emotion_category, COUNT(*) as count 
         FROM emotion_logs 
         WHERE user_id = $1 AND call_id = $2
         GROUP BY emotion_category
         ORDER BY count DESC
         LIMIT 1`,
        [userId, callId]
      );

      if (result.rows.length > 0) {
        return result.rows[0].emotion_category;
      }

      return undefined;
    } catch (error) {
      logger.error('[CallSummary] Error getting emotion trend', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        callId,
      });
      return undefined;
    }
  }

  /**
   * Generate summary content using AI
   */
  private async generateSummaryContent(
    transcript: string,
    sessionType: SessionType,
    depthMode: 'light' | 'deep',
    emotionTrend?: string
  ): Promise<{ summary: string; keyInsights: string[] }> {
    const sessionTypeLabels: Record<SessionType, string> = {
      quick_checkin: 'Quick Check-In',
      coaching_session: 'Coaching Session',
      emergency_support: 'Emergency Support Session',
      goal_review: 'Goal Review Session',
      health_coach: 'Health Coaching',
      nutrition: 'Nutrition Consultation',
      fitness: 'Fitness Session',
      wellness: 'Wellness Check',
    };

    const prompt = depthMode === 'deep'
      ? `Analyze this ${sessionTypeLabels[sessionType]} conversation and provide:
1. A comprehensive summary (3-4 paragraphs) covering key discussion points
2. 5-7 key insights discovered during the session
3. Emotional context: ${emotionTrend || 'Not detected'}

Conversation:
${transcript || 'No transcript available'}

Format your response as JSON:
{
  "summary": "...",
  "keyInsights": ["insight1", "insight2", ...]
}`
      : `Summarize this ${sessionTypeLabels[sessionType]} conversation briefly:
1. A concise summary (1-2 paragraphs)
2. 2-3 key takeaways

Conversation:
${transcript || 'No transcript available'}

Format your response as JSON:
{
  "summary": "...",
  "keyInsights": ["insight1", "insight2", ...]
}`;

    try {
      // Use AI provider for generation
      const result = await aiProviderService.generateCompletion({
        systemPrompt: 'You are a health coaching assistant generating session summaries. Always respond with valid JSON.',
        userPrompt: prompt,
        maxTokens: 1000,
        temperature: 0.7,
      });

      // Parse JSON response
      const response = result.content || '';
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || 'Session completed successfully.',
          keyInsights: Array.isArray(parsed.keyInsights) ? parsed.keyInsights : [],
        };
      }

      // Fallback if JSON parsing fails
      return {
        summary: response || 'Session completed successfully.',
        keyInsights: [],
      };
    } catch (error) {
      logger.error('[CallSummary] Error generating summary content', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      // Return default summary on error
      return {
        summary: `Your ${sessionTypeLabels[sessionType]} has been completed. Thank you for taking the time to focus on your health and wellbeing.`,
        keyInsights: ['Session completed', 'Continue your health journey'],
      };
    }
  }

  /**
   * Extract action items from conversation
   */
  private async extractActionItems(
    transcript: string,
    summaryContent: { summary: string; keyInsights: string[] },
    _sessionType: SessionType // Reserved for future session-type-specific extraction
  ): Promise<Omit<ActionItem, 'id' | 'summaryId'>[]> {
    const prompt = `Based on this health coaching session, extract specific action items for the user.

Session Summary:
${summaryContent.summary}

Key Insights:
${summaryContent.keyInsights.join('\n')}

Conversation:
${transcript || 'No transcript available'}

Extract 2-5 actionable items. Format as JSON array:
[
  {
    "content": "Action description",
    "category": "fitness|nutrition|sleep|stress|wellness|goal|habit|follow_up",
    "priority": "high|medium|low",
    "dueInDays": 1-7 (optional)
  }
]`;

    try {
      const result = await aiProviderService.generateCompletion({
        systemPrompt: 'You are extracting action items from health coaching sessions. Always respond with valid JSON array.',
        userPrompt: prompt,
        maxTokens: 1000,
        temperature: 0.7,
      });

      // Parse JSON response
      const response = result.content || '';
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.map((item: {
          content: string;
          category?: string;
          priority?: string;
          dueInDays?: number;
        }) => ({
          content: item.content,
          category: (item.category || 'follow_up') as ActionCategory,
          priority: (item.priority || 'medium') as 'high' | 'medium' | 'low',
          dueDate: item.dueInDays
            ? new Date(Date.now() + item.dueInDays * 24 * 60 * 60 * 1000)
            : undefined,
          status: 'pending' as const,
          reminderSet: false,
        }));
      }

      return [];
    } catch (error) {
      logger.error('[CallSummary] Error extracting action items', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Save summary to database
   */
  private async saveSummary(data: {
    callId: string;
    userId: string;
    sessionType: SessionType;
    depthMode: 'light' | 'deep';
    summary: string;
    keyInsights: string[];
    actionItems: Omit<ActionItem, 'id' | 'summaryId'>[];
    emotionalTrend?: string;
    duration: number;
  }): Promise<CallSummary> {
    // Insert summary
    const summaryResult = await query<{ id: string }>(
      `INSERT INTO call_summaries (
        call_id, user_id, session_type, depth_mode, summary, key_insights,
        emotional_trend, duration, delivery_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id`,
      [
        data.callId,
        data.userId,
        data.sessionType,
        data.depthMode,
        data.summary,
        JSON.stringify(data.keyInsights),
        data.emotionalTrend || null,
        data.duration,
        JSON.stringify({ app: false, whatsapp: false, push: false }),
      ]
    );

    const summaryId = summaryResult.rows[0].id;

    // Insert action items
    const savedActionItems: ActionItem[] = [];
    for (const item of data.actionItems) {
      const itemResult = await query<{ id: string }>(
        `INSERT INTO action_items (
          summary_id, content, category, priority, due_date, status, reminder_set
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id`,
        [
          summaryId,
          item.content,
          item.category,
          item.priority,
          item.dueDate || null,
          item.status,
          item.reminderSet || false,
        ]
      );

      savedActionItems.push({
        id: itemResult.rows[0].id,
        summaryId,
        ...item,
      });
    }

    return {
      id: summaryId,
      callId: data.callId,
      userId: data.userId,
      sessionType: data.sessionType,
      depthMode: data.depthMode,
      summary: data.summary,
      keyInsights: data.keyInsights,
      actionItems: savedActionItems,
      emotionalTrend: data.emotionalTrend,
      duration: data.duration,
      generatedAt: new Date(),
      deliveryStatus: { app: false, whatsapp: false, push: false },
    };
  }

  /**
   * Get summary by call ID
   */
  async getSummaryByCallId(callId: string): Promise<CallSummary | null> {
    try {
      const result = await query<CallSummaryRow>(
        `SELECT * FROM call_summaries WHERE call_id = $1`,
        [callId]
      );

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      const actionItems = await this.getActionItemsBySummaryId(row.id);

      return this.mapRowToSummary(row, actionItems);
    } catch (error) {
      logger.error('[CallSummary] Error getting summary by call ID', {
        error: error instanceof Error ? error.message : 'Unknown error',
        callId,
      });
      return null;
    }
  }

  /**
   * Get summaries for user
   */
  async getSummariesForUser(
    userId: string,
    options?: { page?: number; limit?: number }
  ): Promise<{ summaries: CallSummary[]; total: number }> {
    const page = options?.page || 1;
    const limit = Math.min(options?.limit || 20, 50);
    const offset = (page - 1) * limit;

    try {
      const countResult = await query<{ count: string }>(
        `SELECT COUNT(*) as count FROM call_summaries WHERE user_id = $1`,
        [userId]
      );
      const total = parseInt(countResult.rows[0].count, 10);

      const result = await query<CallSummaryRow>(
        `SELECT * FROM call_summaries 
         WHERE user_id = $1 
         ORDER BY generated_at DESC 
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      );

      const summaries = await Promise.all(
        result.rows.map(async (row) => {
          const actionItems = await this.getActionItemsBySummaryId(row.id);
          return this.mapRowToSummary(row, actionItems);
        })
      );

      return { summaries, total };
    } catch (error) {
      logger.error('[CallSummary] Error getting summaries for user', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return { summaries: [], total: 0 };
    }
  }

  /**
   * Get action items by summary ID
   */
  private async getActionItemsBySummaryId(summaryId: string): Promise<ActionItem[]> {
    const result = await query<ActionItemRow>(
      `SELECT * FROM action_items WHERE summary_id = $1 ORDER BY priority ASC, created_at ASC`,
      [summaryId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      summaryId: row.summary_id,
      content: row.content,
      category: row.category as ActionCategory,
      priority: row.priority as 'high' | 'medium' | 'low',
      dueDate: row.due_date || undefined,
      status: row.status as ActionItem['status'],
      completedAt: row.completed_at || undefined,
      reminderSet: row.reminder_set,
    }));
  }

  /**
   * Update action item status
   */
  async updateActionItemStatus(
    actionItemId: string,
    userId: string,
    status: ActionItem['status']
  ): Promise<ActionItem | null> {
    try {
      // Verify ownership
      const verifyResult = await query<{ id: string }>(
        `SELECT ai.id FROM action_items ai
         JOIN call_summaries cs ON ai.summary_id = cs.id
         WHERE ai.id = $1 AND cs.user_id = $2`,
        [actionItemId, userId]
      );

      if (verifyResult.rows.length === 0) {
        return null;
      }

      const completedAt = status === 'completed' ? new Date() : null;

      const result = await query<ActionItemRow>(
        `UPDATE action_items 
         SET status = $1, completed_at = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [status, completedAt, actionItemId]
      );

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        id: row.id,
        summaryId: row.summary_id,
        content: row.content,
        category: row.category as ActionCategory,
        priority: row.priority as 'high' | 'medium' | 'low',
        dueDate: row.due_date || undefined,
        status: row.status as ActionItem['status'],
        completedAt: row.completed_at || undefined,
        reminderSet: row.reminder_set,
      };
    } catch (error) {
      logger.error('[CallSummary] Error updating action item status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        actionItemId,
      });
      return null;
    }
  }

  /**
   * Map database row to CallSummary
   */
  private mapRowToSummary(row: CallSummaryRow, actionItems: ActionItem[]): CallSummary {
    return {
      id: row.id,
      callId: row.call_id,
      userId: row.user_id,
      sessionType: row.session_type as SessionType,
      depthMode: row.depth_mode as 'light' | 'deep',
      summary: row.summary,
      keyInsights: typeof row.key_insights === 'string'
        ? JSON.parse(row.key_insights)
        : row.key_insights,
      actionItems,
      emotionalTrend: row.emotional_trend || undefined,
      duration: row.duration,
      generatedAt: row.generated_at,
      deliveryStatus: typeof row.delivery_status === 'string'
        ? JSON.parse(row.delivery_status)
        : row.delivery_status,
    };
  }
}

export const callSummaryService = new CallSummaryService();

