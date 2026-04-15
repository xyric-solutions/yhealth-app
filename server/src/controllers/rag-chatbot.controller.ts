import { Response } from 'express';
import OpenAI from 'openai';
import { ragChatbotService } from '../services/rag-chatbot.service.js';
import { langGraphChatbotService } from '../services/langgraph-chatbot.service.js';
import { vectorEmbeddingService } from '../services/vector-embedding.service.js';
import { emotionDetectionService, type EmotionDetection } from '../services/emotion-detection.service.js';
import { crisisDetectionService } from '../services/crisis-detection.service.js';
import { wellbeingQuestionEngineService } from '../services/wellbeing-question-engine.service.js';
import { routeCoachIntent } from '../services/life-area-intent-router.service.js';
import { env } from '../config/env.config.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../services/logger.service.js';
import { query } from '../database/pg.js';
import type { AuthenticatedRequest } from '../types/index.js';

/**
 * Thin classifier-mode LLM helper for the life-area intent router.
 * Mirrors the pattern used in ai-coach.controller.ts (Task 9).
 * Returns '' on any failure so routeCoachIntent resolves to null safely.
 */
const routerLlmClient: OpenAI | null = env.openai.apiKey
  ? new OpenAI({ apiKey: env.openai.apiKey })
  : null;

async function routerLlm(prompt: string): Promise<string> {
  if (!routerLlmClient) return '';
  try {
    const model = env.openai.model || 'gpt-4o-mini';
    const res = await routerLlmClient.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: 'Respond with strict JSON only, no prose.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0,
      max_tokens: 200,
    });
    return res.choices[0]?.message?.content ?? '';
  } catch {
    return '';
  }
}

/**
 * Skip emotion detection for short action commands that don't carry emotional content.
 * This saves 2-5s and avoids unnecessary OpenAI/Gemini/TensorFlow API calls.
 */
const ACTION_PATTERNS = /^(play|stop|pause|skip|next|log|add|create|show|open|go to|navigate|set|toggle|refresh|sync|search)\b/i;

function shouldSkipEmotionDetection(message: string): boolean {
  // Very short messages are usually commands, not emotional expressions
  if (message.length < 20) return true;
  // Action-oriented messages
  if (ACTION_PATTERNS.test(message)) return true;
  return false;
}

class RAGChatbotController {
  chat = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');

    const { message, conversationId, callId } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      throw new ApiError(400, 'Message is required');
    }

    const trimmedMessage = message.trim();

    // Detect emotion from user message — skip for short action commands
    let emotionDetected: EmotionDetection | null = null;
    const skipEmotion = shouldSkipEmotionDetection(trimmedMessage);
    if (!skipEmotion) {
    try {
      // Get conversation context if available
      let conversationContext = undefined;
      if (conversationId) {
        const conv = await vectorEmbeddingService.getConversation(conversationId, 5);
        if (conv?.messages && conv.messages.length > 0) {
          const recentMessages = conv.messages.slice(-3);
          const previousEmotions = recentMessages
            .filter((m: any) => m.metadata?.emotion)
            .map((m: any) => m.metadata?.emotion);
          conversationContext = {
            previousEmotions: previousEmotions as any,
            sessionType: conv.conversation.sessionType,
          };
        }
      }

      emotionDetected = await emotionDetectionService.detectEmotionFromText(
        trimmedMessage,
        conversationContext
      );

      // Log emotion if enabled
      if (conversationId || callId) {
        await emotionDetectionService.logEmotion(userId, emotionDetected, {
          callId,
          conversationId,
          source: 'text',
        });
      }
    } catch (error) {
      logger.warn('[RAGChatbotController] Error detecting emotion', { error });
      // Continue without emotion detection
    }
    } // end if (!skipEmotion)

    // Detect crisis keywords
    let crisisDetected = false;
    try {
      const crisisDetection = await crisisDetectionService.detectCrisisKeywords(trimmedMessage);
      if (crisisDetection.isCrisis && crisisDetection.severity !== 'low') {
        crisisDetected = true;
        // If crisis detected and we have a callId, trigger emergency protocol
        if (callId) {
          await crisisDetectionService.triggerEmergencyProtocol(callId, userId);

          // Get crisis resources
          const resources = await crisisDetectionService.getCrisisResources();
          
          // Schedule follow-up
          await crisisDetectionService.scheduleFollowUpCheckIn(userId, callId);

          // Return early with emergency resources
          ApiResponse.success(
            res,
            {
              message: 'I\'m here for you. Emergency support has been activated.',
              conversationId: conversationId || null,
              messageId: `msg-${Date.now()}`,
              emergency: true,
              resources,
              actions: [{ type: 'open_modal', target: 'emergency_resources', params: { resources } }],
            },
            'Emergency support activated'
          );
          return;
        }
      }
    } catch (error) {
      logger.warn('[RAGChatbotController] Error detecting crisis', { error });
      // Continue with normal chat
    }

    const result = await ragChatbotService.chat({
      userId,
      message: trimmedMessage,
      conversationId,
    });

    const routingChip = await routeCoachIntent({
      userId,
      userMessage: trimmedMessage,
      llm: routerLlm,
    });

    // Map response to client-expected format
    const resultAny = result as any;
    ApiResponse.success(res, {
      message: result.response,
      conversationId: result.conversationId,
      messageId: `msg-${Date.now()}`, // Generate message ID
      actions: resultAny.actions, // Include actions if any
      toolCalls: resultAny.toolCalls, // Include tool calls if any
      emotion: emotionDetected ? {
        category: emotionDetected.category,
        confidence: emotionDetected.confidence,
      } : undefined,
      crisis: crisisDetected,
      context: result.context ? {
        retrievedDocs: (result.context.knowledgeUsed || 0) + (result.context.profileUsed || 0),
        historyUsed: result.context.historyUsed || 0,
      } : undefined,
      routingChip,
    }, 'Message sent successfully');
  });

  // Streaming chat endpoint - now uses LangGraph with tool support
  chatStream = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');

    const { message, conversationId, callId, callPurpose, imageBase64 } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      throw new ApiError(400, 'Message is required');
    }

    const trimmedMessage = message.trim();

    // Extract callPurpose from callId if not provided directly
    let effectiveCallPurpose = callPurpose;
    if (!effectiveCallPurpose && callId) {
      try {
        const callResult = await query<{ call_purpose?: string }>(
          'SELECT call_purpose FROM voice_calls WHERE id = $1',
          [callId]
        );
        if (callResult.rows.length > 0 && callResult.rows[0].call_purpose) {
          effectiveCallPurpose = callResult.rows[0].call_purpose;
        }
      } catch (error) {
        logger.warn('[RAGChatbotController] Error fetching call purpose', { error, callId });
      }
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    try {
      // Detect emotion from user message (async, non-blocking) — skip for short action commands
      let emotionDetected: EmotionDetection | null = null;
      const skipEmotion = shouldSkipEmotionDetection(trimmedMessage);
      const detectEmotionPromise = skipEmotion ? Promise.resolve() : (async () => {
        try {
          let conversationContext = undefined;
          if (conversationId) {
            const conv = await vectorEmbeddingService.getConversation(conversationId, 5);
            if (conv?.messages && conv.messages.length > 0) {
              conversationContext = {
                sessionType: conv.conversation.sessionType,
              };
            }
          }

          emotionDetected = await emotionDetectionService.detectEmotionFromText(
            trimmedMessage,
            conversationContext
          );

          // Log emotion if enabled
          if (conversationId || callId) {
            await emotionDetectionService.logEmotion(userId, emotionDetected, {
              callId,
              conversationId,
              source: 'text',
            });
          }

          // Send emotion detection event
          res.write(`data: ${JSON.stringify({ emotion: { category: emotionDetected.category, confidence: emotionDetected.confidence } })}\n\n`);
        } catch (error: any) {
          logger.warn('[RAGChatbotController] Error detecting emotion', {
            error: error?.message || 'Unknown error',
            errorCode: error?.code,
            userId,
          });
        }
      })();

      // Detect crisis keywords (async, non-blocking but higher priority)
      let crisisDetected = false;
      let emergencyTriggered = false;
      const detectCrisisPromise = (async () => {
        try {
          const crisisDetection = await crisisDetectionService.detectCrisisKeywords(trimmedMessage);
          if (crisisDetection.isCrisis && crisisDetection.severity !== 'low') {
            crisisDetected = true;
            if (callId) {
              await crisisDetectionService.triggerEmergencyProtocol(callId, userId);
              emergencyTriggered = true;

              const resources = await crisisDetectionService.getCrisisResources();
              await crisisDetectionService.scheduleFollowUpCheckIn(userId, callId);

              // Send emergency event immediately
              res.write(`data: ${JSON.stringify({ emergency: true, resources, message: "Emergency support activated. I'm here for you." })}\n\n`);
            }
          }
        } catch (error: any) {
          logger.warn('[RAGChatbotController] Error detecting crisis', {
            error: error?.message || 'Unknown error',
            errorCode: error?.code,
            userId,
          });
        }
      })();

      // Wait for crisis detection (higher priority)
      await detectCrisisPromise;

      // If emergency triggered, end stream early
      if (emergencyTriggered) {
        await detectEmotionPromise;
        res.write(`data: ${JSON.stringify({ done: true, emergency: true })}\n\n`);
        res.end();
        return;
      }

      const result = await langGraphChatbotService.chatStream({
        userId,
        message: trimmedMessage,
        conversationId,
        callId,
        callPurpose: effectiveCallPurpose,
        imageBase64,
        onToken: (token: string) => {
          try {
            res.write(`data: ${JSON.stringify({ token })}\n\n`);
            // Flush to ensure immediate delivery
            if (typeof (res as any).flush === 'function') {
              (res as any).flush();
            }
          } catch (error: any) {
            logger.error('[RAGChatbotController] Error writing token to stream', {
              error: error?.message || 'Unknown error',
              errorCode: error?.code,
            });
          }
        },
        onConversationId: (id: string) => {
          try {
            res.write(`data: ${JSON.stringify({ conversationId: id })}\n\n`);
            if (typeof (res as any).flush === 'function') {
              (res as any).flush();
            }
          } catch (error: any) {
            logger.error('[RAGChatbotController] Error writing conversationId to stream', {
              error: error?.message || 'Unknown error',
              errorCode: error?.code,
            });
          }
        },
      });

      // Wait for emotion detection to complete
      await detectEmotionPromise;

      const resultAny = result as any;
      const finalMessage = result.response || '';

      const routingChip = await routeCoachIntent({
        userId,
        userMessage: trimmedMessage,
        llm: routerLlm,
      });

      // Send completion with tool calls and actions if any
      const doneEvent: any = {
        done: true,
        message: finalMessage,
        conversationId: result.conversationId,
        actions: resultAny.actions,
        toolCalls: resultAny.toolCalls,
        context: result.context,
        emotion: emotionDetected ? {
          category: (emotionDetected as EmotionDetection).category,
          confidence: (emotionDetected as EmotionDetection).confidence,
        } : undefined,
        crisis: crisisDetected,
        routingChip,
      };
      
      
      res.write(`data: ${JSON.stringify(doneEvent)}\n\n`);
      res.end();
    } catch (error: any) {
      logger.error('[RAGChatbotController] Error in chat stream', {
        error: error?.message || 'Unknown error',
        errorCode: error?.code,
        errorStack: error?.stack,
        userId,
      });
      try {
        res.write(`data: ${JSON.stringify({ error: 'Failed to generate response', errorMessage: error?.message || 'Unknown error' })}\n\n`);
        res.end();
      } catch (writeError: any) {
        // Stream may already be closed
        logger.error('[RAGChatbotController] Error writing error to stream', {
          writeError: writeError?.message || 'Unknown error',
          originalError: error?.message,
        });
      }
    }
  });

  createConversation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');

    const { title, sessionType, goalId, userRequest } = req.body;

    // If sessionType not provided, use session orchestration to determine
    let finalSessionType = sessionType || 'quick_checkin';
    if (!sessionType && userRequest) {
      try {
        const { sessionOrchestrationService } = await import('../services/session-orchestration.service.js');
        const suggestion = await sessionOrchestrationService.suggestSessionType(userId, userRequest);
        finalSessionType = suggestion.sessionType;
      } catch (error) {
        logger.warn('[RAGChatbotController] Error determining session type', { error });
        // Use default
      }
    }

    const conversationId = await vectorEmbeddingService.createConversation({
      userId,
      title,
      sessionType: finalSessionType,
    });

    // If goalId provided, link it to conversation
    if (goalId) {
      await query(
        `UPDATE rag_conversations SET goal_id = $1 WHERE id = $2`,
        [goalId, conversationId]
      );
    }

    ApiResponse.created(res, { conversationId, sessionType: finalSessionType }, 'Conversation created successfully');
  });

  getConversation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');

    const { conversationId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const conversation = await ragChatbotService.getConversation(conversationId, limit);

    if (!conversation) throw new ApiError(404, 'Conversation not found');
    if (conversation.conversation.userId !== userId) throw new ApiError(403, 'Access denied');

    ApiResponse.success(res, conversation, 'Conversation retrieved successfully');
  });

  getUserConversations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');

    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string | undefined;
    const conversations = await vectorEmbeddingService.getUserConversations({ userId, status, limit });

    ApiResponse.success(res, { conversations }, 'Conversations retrieved successfully');
  });

  searchHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');

    const { q: query } = req.query;
    const limit = parseInt(req.query.limit as string) || 10;
    if (!query || typeof query !== 'string') throw new ApiError(400, 'Search query is required');

    const results = await ragChatbotService.searchHistory(userId, query, limit);
    ApiResponse.success(res, { results }, 'Search completed successfully');
  });

  deleteConversation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');

    const { conversationId } = req.params;
    const deleted = await ragChatbotService.deleteConversation(conversationId, userId);
    if (!deleted) throw new ApiError(404, 'Conversation not found or already deleted');

    ApiResponse.success(res, { deleted: true }, 'Conversation deleted successfully');
  });

  archiveConversation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');

    const { conversationId } = req.params;
    const archived = await ragChatbotService.archiveConversation(conversationId, userId);
    if (!archived) throw new ApiError(404, 'Conversation not found');

    ApiResponse.success(res, null, 'Conversation archived successfully');
  });

  generateTitle = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');

    const { conversationId } = req.params;
    const conv = await ragChatbotService.getConversation(conversationId, 1);
    if (!conv) throw new ApiError(404, 'Conversation not found');
    if (conv.conversation.userId !== userId) throw new ApiError(403, 'Access denied');

    const title = await ragChatbotService.generateConversationTitle(conversationId);
    ApiResponse.success(res, { title }, 'Title generated successfully');
  });

  generateSummary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');

    const { conversationId } = req.params;
    const conv = await ragChatbotService.getConversation(conversationId, 1);
    if (!conv) throw new ApiError(404, 'Conversation not found');
    if (conv.conversation.userId !== userId) throw new ApiError(403, 'Access denied');

    const summary = await ragChatbotService.summarizeConversation(conversationId);
    ApiResponse.success(res, { summary }, 'Summary generated successfully');
  });

  updateHealthProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');

    const { section, content, metadata } = req.body;
    if (!section || !content) throw new ApiError(400, 'Section and content are required');

    const validSections = ['goals', 'conditions', 'preferences', 'history', 'metrics'];
    if (!validSections.includes(section)) {
      throw new ApiError(400, `Invalid section. Must be one of: ${validSections.join(', ')}`);
    }

    const id = await vectorEmbeddingService.storeUserHealthProfile({ userId, section, content, metadata });
    ApiResponse.success(res, { id }, 'Health profile updated successfully');
  });

  addKnowledge = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');

    const { category, subcategory, title, content, source, sourceUrl, tags, trustScore } = req.body;
    if (!category || !title || !content) {
      throw new ApiError(400, 'Category, title, and content are required');
    }

    const validCategories = ['nutrition', 'exercise', 'sleep', 'mental_health', 'medical', 'general'];
    if (!validCategories.includes(category)) {
      throw new ApiError(400, `Invalid category. Must be one of: ${validCategories.join(', ')}`);
    }

    const id = await vectorEmbeddingService.storeKnowledge({
      category, subcategory, title, content, source, sourceUrl, tags, trustScore,
    });
    ApiResponse.created(res, { id }, 'Knowledge added successfully');
  });

  searchKnowledge = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');

    const { q: query, category } = req.query;
    const limit = parseInt(req.query.limit as string) || 5;
    if (!query || typeof query !== 'string') throw new ApiError(400, 'Search query is required');

    const results = await vectorEmbeddingService.searchKnowledge({
      queryText: query,
      category: category as string | undefined,
      limit,
    });
    ApiResponse.success(res, { results }, 'Search completed successfully');
  });

  getGreeting = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');

    const callPurpose = req.query.callPurpose as string | undefined;
    const language = req.query.language as string | undefined;
    const sessionType = req.query.sessionType as string | undefined;

    // Accept any language code (extract base language if needed, e.g., "ur-PK" -> "ur")
    const selectedLanguage = language ? language.toLowerCase().split('-')[0] : undefined;

    try {
      const greeting = await langGraphChatbotService.generateGreeting(userId, callPurpose, selectedLanguage, sessionType);
      ApiResponse.success(res, { greeting }, {
        message: 'Greeting generated successfully',
      }, undefined, req);
    } catch (error) {
      logger.error('[RAGChatbotController] Error generating greeting', { error, userId, callPurpose });
      // Fallback to simple greeting on error - support multilingual
      const userName = req.user?.firstName;
      let fallbackGreeting = userName ? `Hey ${userName}! How can I help you today?` : "Hey! How can I help you today?";
      
      // Multilingual fallback greetings
      if (selectedLanguage === 'ur') {
        fallbackGreeting = userName ? `السلام علیکم ${userName}! آپ کیسے ہیں؟` : 'السلام علیکم! آپ کیسے ہیں؟';
      } else if (selectedLanguage === 'es') {
        fallbackGreeting = userName ? `¡Hola ${userName}! ¿Cómo puedo ayudarte hoy?` : "¡Hola! ¿Cómo puedo ayudarte hoy?";
      } else if (selectedLanguage === 'fr') {
        fallbackGreeting = userName ? `Bonjour ${userName}! Comment puis-je vous aider aujourd'hui?` : "Bonjour! Comment puis-je vous aider aujourd'hui?";
      } else if (selectedLanguage === 'ar') {
        fallbackGreeting = userName ? `مرحبا ${userName}! كيف يمكنني مساعدتك اليوم؟` : "مرحبا! كيف يمكنني مساعدتك اليوم؟";
      }
      
      ApiResponse.success(res, { greeting: fallbackGreeting }, {
        message: 'Greeting retrieved successfully',
      }, undefined, req);
    }
  });

  /**
   * Get opening question to start conversation when user hasn't talked
   * GET /api/chat/opening-question
   */
  getOpeningQuestion = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw new ApiError(401, 'Authentication required');

    try {
      const openingQuestion = await wellbeingQuestionEngineService.generateOpeningQuestion(userId);
      
      if (openingQuestion) {
        ApiResponse.success(res, { 
          question: openingQuestion.question,
          type: openingQuestion.type,
          priority: openingQuestion.priority,
        }, {
          message: 'Opening question generated successfully',
        }, undefined, req);
      } else {
        ApiResponse.success(res, { question: null }, {
          message: 'User has been active recently, no opening question needed',
        }, undefined, req);
      }
    } catch (error) {
      logger.error('[RAGChatbotController] Error generating opening question', { error, userId });
      ApiResponse.success(res, { question: null }, {
        message: 'Could not generate opening question',
      }, undefined, req);
    }
  });
}

export const ragChatbotController = new RAGChatbotController();
export default ragChatbotController;
