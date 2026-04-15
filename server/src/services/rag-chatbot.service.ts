import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  BaseMessage,
} from '@langchain/core/messages';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';

import { modelFactory } from './model-factory.service.js';
import { logger } from './logger.service.js';
import { vectorEmbeddingService } from './vector-embedding.service.js';
import { embeddingQueueService } from './embedding-queue.service.js';
import { query } from '../database/pg.js';
import { langGraphChatbotService } from './langgraph-chatbot.service.js';

// Types
interface RAGChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

interface RAGContext {
  conversationHistory: RAGChatMessage[];
  relevantKnowledge: Array<{ content: string; category: string; similarity: number }>;
  userProfile: Array<{ section: string; content: string; similarity: number }>;
  previousConversations: Array<{ content: string; similarity: number }>;
}

interface ChatRequest {
  userId: string;
  message: string;
  conversationId?: string;
}

interface ChatResponse {
  conversationId: string;
  response: string;
  context?: {
    knowledgeUsed: number;
    profileUsed: number;
    historyUsed: number;
  };
}

// Health Coach System Prompt (base template - will be customized with user's assigned name)
const HEALTH_COACH_SYSTEM_PROMPT_TEMPLATE = (assistantName: string) => `You are **${assistantName}**, an advanced AI coach specializing in fitness, nutrition, and overall wellbeing. You are a long-term coaching partner, not a generic assistant. Your name is ${assistantName}. Always refer to yourself as ${assistantName} when introducing yourself or when the user asks your name, REGARDLESS of the language being used. Never use "Aurea" or any other name - you are ${assistantName}.

**MULTILINGUAL SUPPORT: You can communicate in ANY language. Detect the user's language from their messages and respond naturally in the same language. Support English, Urdu, Spanish, French, Arabic, Hindi, Chinese, Japanese, German, Italian, Portuguese, and ALL other languages. When introducing yourself in ANY language, always use your name ${assistantName}. Examples:
- English: "Hi! I'm ${assistantName}..."
- Urdu: "السلام علیکم! میں ${assistantName} ہوں..."
- Spanish: "¡Hola! Soy ${assistantName}..."
- French: "Bonjour! Je suis ${assistantName}..."
- Arabic: "مرحبا! أنا ${assistantName}..."
- Any language: Always use ${assistantName} as your name.**

You have full access to the user's health data including:
- Workout plans and exercise logs
- Diet plans and meal logs
- Tasks and reminders
- Progress records and goals
- Health metrics and preferences
- Nutrition and dietary planning
- Exercise science and workout programming
- Sleep optimization and recovery
- Mental wellness and stress management
- Habit formation and behavior change

You can query this information using the available tools. Always use tools to get the most current data when answering questions about the user's workouts, meals, plans, or progress.

Guidelines:
1. When user asks about their data, use tools to retrieve it
2. Reference specific details from their data (dates, amounts, names)
3. Provide actionable advice based on their actual data
4. Be encouraging and supportive
5. Always prioritize user safety - recommend consulting healthcare professionals for medical concerns
6. Provide actionable, specific advice tailored to the user's goals and constraints
7. Be encouraging but realistic about expectations and timelines
8. Consider the user's full context: goals, preferences, limitations, and history
9. Use motivational interviewing techniques to support behavior change
10. Cite scientific evidence when relevant, but keep explanations accessible

When given context about the user's profile and previous conversations, use this information to personalize your responses. Reference specific details they've shared to show you remember and understand their journey.

Format responses clearly with:
- Concise, direct answers to questions
- Not use Bullet points for lists and recommendations
- Clear action items when providing advice

GIF REACTIONS: When you want to include an expressive GIF reaction (for celebrations, encouragement, humor, or empathy), append [GIF:search_term] at the very end of your message. Use this sparingly — only when it adds genuine emotional value. Examples:
- After a user hits a milestone: "Amazing work! You've completed your first week!" [GIF:celebration dance]
- Encouragement: "You've got this!" [GIF:you got this motivation]
- Humor: "Rest day means REST" [GIF:relaxing couch]
Do NOT use GIFs in every message. Reserve them for high-emotion moments.`;

/**
 * RAG-based AI Health Coach Chatbot Service
 *
 * Provides intelligent health and fitness coaching using:
 * - Vector similarity search for relevant context retrieval
 * - Conversation history management
 * - Knowledge base integration
 * - Personalized responses based on user profile
 */
class RAGChatbotService {
  private llm: BaseChatModel;

  constructor() {
    this.llm = modelFactory.getModel({
      tier: 'default',
      temperature: 0.7,
      maxTokens: 2048,
    });
  }

  /**
   * Retrieve relevant context for the user's query
   */
  private async retrieveContext(
    userId: string,
    queryText: string
  ): Promise<RAGContext> {
    try {
      // Parallel retrieval of all context types
      const [
        relevantKnowledge,
        userProfile,
        previousConversations,
        userDataEmbeddings,
      ] = await Promise.all([
        vectorEmbeddingService.searchKnowledge({
          queryText,
          limit: 5,
        }),
        vectorEmbeddingService.searchUserProfile({
          userId,
          queryText,
          limit: 3,
        }),
        vectorEmbeddingService.searchConversationHistory({
          userId,
          queryText,
          limit: 5,
        }),
        // Search user data embeddings (plans, workouts, meals, tasks, logs)
        // Lower threshold and higher limit for better recall
        vectorEmbeddingService.searchSimilar({
          queryText,
          userId,
          limit: 15,
          minSimilarity: 0.5, // Lowered from 0.6 for better recall
        }),
      ]);

      return {
        conversationHistory: [],
        relevantKnowledge: relevantKnowledge.map((k) => ({
          content: k.content,
          category: k.category || 'general',
          similarity: k.similarity,
        })),
        userProfile: [
          ...userProfile.map((p) => ({
            section: p.section || 'general',
            content: p.content,
            similarity: p.similarity,
          })),
          // Include relevant user data (plans, workouts, meals, tasks) in profile context
          ...userDataEmbeddings
            .filter((e) => ['user_plan', 'diet_plan', 'workout_plan', 'user_task', 'meal_log', 'workout_log'].includes(e.sourceType))
            .map((e) => ({
              section: e.sourceType,
              content: e.content,
              similarity: e.similarity,
            })),
        ],
        previousConversations: previousConversations.map((c) => ({
          content: c.content,
          similarity: c.similarity,
        })),
      };
    } catch (error) {
      logger.error('Error retrieving RAG context', { error, userId });
      return {
        conversationHistory: [],
        relevantKnowledge: [],
        userProfile: [],
        previousConversations: [],
      };
    }
  }

  /**
   * Build context string from retrieved information
   */
  private buildContextString(context: RAGContext): string {
    const sections: string[] = [];

    // Add user profile context
    if (context.userProfile.length > 0) {
      sections.push('USER PROFILE:');
      context.userProfile.forEach((p) => {
        sections.push(`[${p.section}] ${p.content}`);
      });
    }

    // Add relevant knowledge
    if (context.relevantKnowledge.length > 0) {
      sections.push('\nRELEVANT KNOWLEDGE:');
      context.relevantKnowledge.forEach((k) => {
        sections.push(`[${k.category}] ${k.content}`);
      });
    }

    // Add previous conversation snippets
    if (context.previousConversations.length > 0) {
      sections.push('\nPREVIOUS CONVERSATIONS:');
      context.previousConversations.forEach((c) => {
        sections.push(c.content);
      });
    }

    return sections.join('\n');
  }

  /**
   * Main chat method - process user message and generate response
   * Now uses LangGraph with tools for database access
   */
  async chat(params: ChatRequest): Promise<ChatResponse> {
    const { userId, message, conversationId } = params;

    try {
      // Use LangGraph chatbot service which has tool access
      return await langGraphChatbotService.chat({
        userId,
        message,
        conversationId,
      });
    } catch (error) {
      logger.error('Error in RAG chat', { error, userId });
      throw error;
    }
  }

  /**
   * Streaming chat method - process user message and stream response
   */
  async chatStream(params: ChatRequest & {
    onToken: (token: string) => void;
    onConversationId: (id: string) => void;
  }): Promise<ChatResponse> {
    const { userId, message, conversationId, onToken, onConversationId } = params;

    try {
      // Get or create conversation
      let activeConversationId = conversationId;
      if (!activeConversationId) {
        activeConversationId = await vectorEmbeddingService.createConversation({
          userId,
          sessionType: 'health_coach',
        });
        onConversationId(activeConversationId);
      }

      // Retrieve relevant context
      const context = await this.retrieveContext(userId, message);

      // Get user's assigned assistant name
      const assistantName = await this.getAssistantName(userId);

      // Get recent conversation history
      const conversationData = await vectorEmbeddingService.getConversation(
        activeConversationId,
        10
      );

      // Build messages array
      const messages: BaseMessage[] = [];

      // System message with context (using user's assigned assistant name)
      const systemPrompt = HEALTH_COACH_SYSTEM_PROMPT_TEMPLATE(assistantName);
      const contextString = this.buildContextString(context);
      const systemContent = contextString
        ? `${systemPrompt}\n\n---\nCONTEXT:\n${contextString}`
        : systemPrompt;

      messages.push(new SystemMessage(systemContent));

      // Add conversation history
      if (conversationData?.messages) {
        for (const msg of conversationData.messages) {
          if (msg.role === 'user') {
            messages.push(new HumanMessage(msg.content));
          } else if (msg.role === 'assistant') {
            messages.push(new AIMessage(msg.content));
          }
        }
      }

      // Add current user message
      messages.push(new HumanMessage(message));

      // Stream response
      let fullResponse = '';
      const stream = await this.llm.stream(messages);

      for await (const chunk of stream) {
        const token = typeof chunk.content === 'string' ? chunk.content : '';
        if (token) {
          fullResponse += token;
          onToken(token);
        }
      }

      // Get current message count for sequence numbers
      const currentMessageCount = conversationData?.conversation?.messageCount ?? 0;

      // Store messages (embedding deferred to async worker)
      const userMsgId = await vectorEmbeddingService.storeMessage({
        conversationId: activeConversationId,
        userId,
        role: 'user',
        content: message,
        sequenceNumber: currentMessageCount + 1,
      });
      const assistantMsgId = await vectorEmbeddingService.storeMessage({
        conversationId: activeConversationId,
        userId,
        role: 'assistant',
        content: fullResponse,
        sequenceNumber: currentMessageCount + 2,
      });

      // Queue async embedding backfill (non-blocking)
      const queueEmbedding = (msgId: string, content: string) => {
        if (embeddingQueueService.isAvailable()) {
          embeddingQueueService.enqueueEmbedding({
            userId,
            sourceType: 'rag_message',
            sourceId: msgId,
            operation: 'create',
          }).catch(() => {});
        } else {
          vectorEmbeddingService.updateMessageEmbedding(msgId, content).catch(() => {});
        }
      };
      queueEmbedding(userMsgId, message);
      queueEmbedding(assistantMsgId, fullResponse);

      return {
        conversationId: activeConversationId,
        response: fullResponse,
        context: {
          knowledgeUsed: context.relevantKnowledge.length,
          profileUsed: context.userProfile.length,
          historyUsed: context.previousConversations.length,
        },
      };
    } catch (error) {
      logger.error('Error in RAG chat stream', { error, userId });
      throw error;
    }
  }

  /**
   * Get conversation with messages
   */
  async getConversation(conversationId: string, limit: number = 50) {
    return vectorEmbeddingService.getConversation(conversationId, limit);
  }

  /**
   * Get user's conversations
   */
  async getUserConversations(params: {
    userId: string;
    status?: string;
    limit?: number;
  }) {
    return vectorEmbeddingService.getUserConversations(params);
  }

  /**
   * Get user's assigned assistant/coach name from preferences
   */
  private async getAssistantName(userId: string): Promise<string> {
    try {
      const result = await query<{ voice_assistant_name: string | null }>(
        `SELECT voice_assistant_name FROM user_preferences WHERE user_id = $1`,
        [userId]
      );

      const assistantName = result.rows.length > 0 && result.rows[0].voice_assistant_name 
        ? result.rows[0].voice_assistant_name.trim()
        : null;

      // Return user-assigned name or default to "Aurea"
      return assistantName || 'Aurea';
    } catch (error) {
      logger.error('[RAGChatbot] Error getting assistant name', { userId, error });
      return 'Aurea'; // Default fallback
    }
  }

  /**
   * Search conversation history
   */
  async searchHistory(userId: string, queryText: string, limit: number = 10) {
    return vectorEmbeddingService.searchConversationHistory({
      userId,
      queryText,
      limit,
    });
  }

  /**
   * Generate a title for a conversation based on its content
   */
  async generateConversationTitle(conversationId: string): Promise<string> {
    try {
      const conversation = await this.getConversation(conversationId, 5);
      if (!conversation?.messages?.length) {
        return 'New Conversation';
      }

      const messageContent = conversation.messages
        .slice(0, 5)
        .map((m) => `${m.role}: ${m.content}`)
        .join('\n');

      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          'Generate a short, descriptive title (max 5 words) for this health coaching conversation. Return only the title, nothing else.',
        ],
        ['user', messageContent],
      ]);

      const chain = prompt.pipe(this.llm).pipe(new StringOutputParser());
      const title = await chain.invoke({});

      // Update conversation title
      await query(
        'UPDATE rag_conversations SET title = $1, updated_at = NOW() WHERE id = $2',
        [title.trim(), conversationId]
      );

      return title.trim();
    } catch (error) {
      logger.error('Error generating conversation title', {
        error,
        conversationId,
      });
      return 'Health Coaching Session';
    }
  }

  /**
   * Summarize a conversation
   */
  async summarizeConversation(conversationId: string): Promise<string> {
    try {
      const conversation = await this.getConversation(conversationId, 50);
      if (!conversation?.messages?.length) {
        return 'No messages to summarize.';
      }

      const messageContent = conversation.messages
        .map((m) => `${m.role}: ${m.content}`)
        .join('\n');

      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `Summarize this health coaching conversation in 2-3 paragraphs. Include:
1. Main topics discussed
2. Key recommendations given
3. Action items or next steps mentioned
4. Any important health/fitness goals identified`,
        ],
        ['user', messageContent],
      ]);

      const chain = prompt.pipe(this.llm).pipe(new StringOutputParser());
      const summary = await chain.invoke({});

      // Update conversation summary with embedding
      await vectorEmbeddingService.updateConversationSummary({
        conversationId,
        summary: summary.trim(),
      });

      return summary.trim();
    } catch (error) {
      logger.error('Error summarizing conversation', { error, conversationId });
      throw error;
    }
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(
    conversationId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const result = await query(
        `UPDATE rag_conversations
         SET status = 'deleted', updated_at = NOW()
         WHERE id = $1 AND user_id = $2 AND status != 'deleted'
         RETURNING id`,
        [conversationId, userId]
      );
      return (result.rows?.length ?? 0) > 0;
    } catch (error) {
      logger.error('Error deleting conversation', { error, conversationId });
      throw error;
    }
  }

  /**
   * Archive a conversation
   */
  async archiveConversation(
    conversationId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const result = await query(
        `UPDATE rag_conversations
         SET status = 'archived', updated_at = NOW()
         WHERE id = $1 AND user_id = $2 AND status = 'active'
         RETURNING id`,
        [conversationId, userId]
      );
      return (result.rows?.length ?? 0) > 0;
    } catch (error) {
      logger.error('Error archiving conversation', { error, conversationId });
      throw error;
    }
  }
}

export const ragChatbotService = new RAGChatbotService();
export default ragChatbotService;
