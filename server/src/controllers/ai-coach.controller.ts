import crypto from 'crypto';
import type { Response } from 'express';
import OpenAI from 'openai';
import { BaseController } from './base.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import {
  aiCoachService,
  type GoalCategory,
  type ChatMessage,
  type ConversationContext,
  type ExtractedInsight,
  type DietPlanRequest,
  type SupportedLanguage,
  type AssessmentResponseInput,
  type BodyStatsInput,
  type MCQOption,
  type ConversationPhase,
} from '../services/index.js';
import { userCoachingProfileService } from '../services/user-coaching-profile.service.js';
import { routeCoachIntent } from '../services/life-area-intent-router.service.js';
import { env } from '../config/env.config.js';
import type { AuthenticatedRequest } from '../types/index.js';
import type { FileRequest } from '../middlewares/upload.middleware.js';

/**
 * Thin classifier-mode LLM helper for the life-area intent router.
 * Reuses the same OpenAI SDK + env config pattern as aiCoachService.
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
 * AI Coach Controller
 * Handles deep assessment conversations with OpenAI
 */
class AICoachController extends BaseController {
  constructor() {
    super('AICoachController');
  }

  /**
   * Check if AI Coach is available
   * GET /api/ai-coach/status
   */
  getStatus = asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const isAvailable = aiCoachService.isAvailable();

    this.success(res, {
      available: isAvailable,
      message: isAvailable
        ? 'AI Coach is ready'
        : 'AI Coach is not configured. Please set OPENAI_API_KEY.',
    });
  });

  /**
   * Start a new conversation
   * POST /api/ai-coach/start
   */
  startConversation = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = this.getUserId(req);
    const { goal, userName: providedUserName, language, isOnboarding } = req.body as {
      goal: GoalCategory;
      userName?: string;
      language?: SupportedLanguage;
      isOnboarding?: boolean;
    };

    if (!goal) {
      throw ApiError.badRequest('Goal is required');
    }

    const validGoals: GoalCategory[] = [
      'weight_loss',
      'muscle_building',
      'sleep_improvement',
      'stress_wellness',
      'energy_productivity',
      'event_training',
      'health_condition',
      'habit_building',
      'overall_optimization',
      'nutrition',
      'fitness',
      'custom',
    ];

    if (!validGoals.includes(goal)) {
      throw ApiError.badRequest(`Invalid goal. Must be one of: ${validGoals.join(', ')}`);
    }

    // Validate language if provided
    const validLanguages: SupportedLanguage[] = ['en', 'ur'];
    const selectedLanguage: SupportedLanguage = language && validLanguages.includes(language) ? language : 'en';

    // Fetch user's name from database if not provided
    const userName = providedUserName || await aiCoachService.getUserName(userId);

    this.log('info', `Starting AI Coach conversation`, { 
      userId, 
      goal, 
      userName, 
      language: selectedLanguage,
      isOnboarding: isOnboarding || false,
    });

    const response = await aiCoachService.generateOpeningMessage(
      goal, 
      userName || undefined, 
      selectedLanguage, 
      userId,
      isOnboarding || false
    );

    this.success(res, {
      message: response.message,
      phase: response.phase,
      conversationId: `conv_${userId}_${Date.now()}`,
      insights: response.insights,
      isComplete: response.isComplete,
    });
  });

  /**
   * Send a message and get AI response
   * POST /api/ai-coach/message
   */
  sendMessage = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = this.getUserId(req);
    const {
      message,
      goal,
      conversationHistory,
      messageCount,
      extractedInsights,
      language,
    } = req.body as {
      message: string;
      goal: GoalCategory;
      conversationHistory: ChatMessage[];
      messageCount: number;
      extractedInsights?: ExtractedInsight[];
      language?: SupportedLanguage;
    };

    // Validation
    if (!message || typeof message !== 'string') {
      throw ApiError.badRequest('Message is required');
    }

    if (message.trim().length === 0) {
      throw ApiError.badRequest('Message cannot be empty');
    }

    if (message.length > 2000) {
      throw ApiError.badRequest('Message is too long (max 2000 characters)');
    }

    if (!goal) {
      throw ApiError.badRequest('Goal is required');
    }

    if (!Array.isArray(conversationHistory)) {
      throw ApiError.badRequest('Conversation history must be an array');
    }

    // Validate language if provided
    const validLanguages: SupportedLanguage[] = ['en', 'ur'];
    const selectedLanguage: SupportedLanguage = language && validLanguages.includes(language) ? language : 'en';

    // Build context
    const context: ConversationContext = {
      userId,
      goal,
      phase: 'opening', // Will be determined by service
      messageCount: messageCount || conversationHistory.filter(m => m.role === 'user').length,
      extractedInsights: extractedInsights || [],
      language: selectedLanguage,
    };

    this.log('info', `Processing AI Coach message`, {
      userId,
      goal,
      messageCount: context.messageCount,
      language: selectedLanguage,
    });

    const response = await aiCoachService.generateResponse(
      context,
      conversationHistory,
      message.trim()
    );

    const routingChip = await routeCoachIntent({
      userId,
      userMessage: message.trim(),
      llm: routerLlm,
    });

    this.success(res, {
      message: response.message,
      phase: response.phase,
      insights: response.insights,
      isComplete: response.isComplete,
      suggestedActions: response.suggestedActions,
      routingChip,
    });
  });

  /**
   * Complete the assessment and get summary
   * POST /api/ai-coach/complete
   */
  completeAssessment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = this.getUserId(req);
    const {
      goal,
      conversationHistory,
      extractedInsights,
    } = req.body as {
      goal: GoalCategory;
      conversationHistory: ChatMessage[];
      extractedInsights: ExtractedInsight[];
    };

    if (!goal || !conversationHistory || !extractedInsights) {
      throw ApiError.badRequest('Missing required fields: goal, conversationHistory, extractedInsights');
    }

    this.log('info', `Completing AI Coach assessment`, {
      userId,
      goal,
      totalMessages: conversationHistory.length,
      totalInsights: extractedInsights.length,
    });

    // Generate summary and recommendations
    const summary = {
      userId,
      goal,
      completedAt: new Date().toISOString(),
      conversationSummary: {
        totalMessages: conversationHistory.length,
        userMessages: conversationHistory.filter(m => m.role === 'user').length,
        aiMessages: conversationHistory.filter(m => m.role === 'assistant').length,
      },
      insights: {
        motivations: extractedInsights.filter(i => i.category === 'motivation'),
        barriers: extractedInsights.filter(i => i.category === 'barrier'),
        preferences: extractedInsights.filter(i => i.category === 'preference'),
        lifestyle: extractedInsights.filter(i => i.category === 'lifestyle'),
        healthStatus: extractedInsights.filter(i => i.category === 'health_status'),
        goals: extractedInsights.filter(i => i.category === 'goal'),
      },
      readyForPlanGeneration: true,
    };

    this.success(res, summary, 'Assessment completed successfully');
  });

  // ============================================================================
  // Session Management (Chat History)
  // ============================================================================

  /**
   * Get or create a session for chat
   * POST /api/ai-coach/session
   */
  getOrCreateSession = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = this.getUserId(req);
    const { goal, sessionType } = req.body as {
      goal: GoalCategory;
      sessionType?: string;
    };

    if (!goal) {
      throw ApiError.badRequest('Goal is required');
    }

    // Check for existing active session matching the requested session type
    const type = sessionType || 'assessment';
    let session = await aiCoachService.getActiveSession(userId, goal, type);

    if (!session) {
      session = await aiCoachService.createSession(userId, goal, type);
    }

    this.log('info', `Session retrieved/created`, { userId, sessionId: session.id, goal });

    this.success(res, {
      session: {
        id: session.id,
        goalCategory: session.goalCategory,
        messages: session.messages,
        extractedInsights: session.extractedInsights,
        conversationPhase: session.conversationPhase,
        messageCount: session.messageCount,
        isComplete: session.isComplete,
      },
    });
  });

  /**
   * Get chat history (previous sessions)
   * GET /api/ai-coach/history
   */
  getChatHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = this.getUserId(req);
    const { limit } = req.query;

    const sessions = await aiCoachService.getPreviousSessions(
      userId,
      limit ? parseInt(limit as string, 10) : 20
    );

    // Also get active session to include in history
    const activeSession = await aiCoachService.getActiveSession(userId);

    // Combine active session with previous sessions, avoiding duplicates
    const allSessions = activeSession
      ? [activeSession, ...sessions.filter(s => s.id !== activeSession.id)]
      : sessions;

    this.success(res, {
      sessions: allSessions.map(s => ({
        id: s.id,
        goalCategory: s.goalCategory,
        sessionType: s.sessionType,
        messages: s.messages,
        extractedInsights: s.extractedInsights,
        conversationPhase: s.conversationPhase,
        messageCount: s.messageCount,
        isComplete: s.isComplete,
        sessionSummary: s.sessionSummary,
        keyTakeaways: s.keyTakeaways,
        completedAt: s.completedAt,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
      total: allSessions.length,
    });
  });

  /**
   * Get a specific session with full messages
   * GET /api/ai-coach/session/:sessionId
   */
  getSession = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = this.getUserId(req);
    const { sessionId } = req.params;

    if (!sessionId) {
      throw ApiError.badRequest('Session ID is required');
    }

    // Get all sessions and find the one matching
    const sessions = await aiCoachService.getPreviousSessions(userId, 100);
    const session = sessions.find(s => s.id === sessionId);

    // Also check active session
    const activeSession = await aiCoachService.getActiveSession(userId);

    const targetSession = session || (activeSession?.id === sessionId ? activeSession : null);

    if (!targetSession) {
      throw ApiError.notFound('Session not found');
    }

    this.success(res, { session: targetSession });
  });

  /**
   * Download session as PDF
   * GET /api/ai-coach/session/:sessionId/pdf
   */
  downloadSessionPDF = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = this.getUserId(req);
    const { sessionId } = req.params;

    if (!sessionId) {
      throw ApiError.badRequest('Session ID is required');
    }

    // Get the session
    const sessions = await aiCoachService.getPreviousSessions(userId, 100);
    const session = sessions.find(s => s.id === sessionId);
    const activeSession = await aiCoachService.getActiveSession(userId);
    const targetSession = session || (activeSession?.id === sessionId ? activeSession : null);

    if (!targetSession) {
      throw ApiError.notFound('Session not found');
    }

    // Generate PDF content as HTML (simple approach without external dependencies)
    const goalTitle = targetSession.goalCategory.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const date = new Date(targetSession.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    let htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>AI Coach Session - ${goalTitle}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; line-height: 1.6; color: #333; }
    h1 { color: #6366f1; border-bottom: 2px solid #6366f1; padding-bottom: 10px; }
    h2 { color: #8b5cf6; margin-top: 30px; }
    .meta { color: #666; font-size: 14px; margin-bottom: 30px; }
    .message { margin: 15px 0; padding: 15px; border-radius: 12px; }
    .ai { background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%); border-left: 4px solid #8b5cf6; }
    .user { background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-left: 4px solid #10b981; }
    .role { font-weight: bold; margin-bottom: 5px; font-size: 12px; text-transform: uppercase; }
    .ai .role { color: #7c3aed; }
    .user .role { color: #059669; }
    .insights { background: #fef3c7; padding: 20px; border-radius: 12px; margin-top: 30px; }
    .insights h2 { color: #d97706; margin-top: 0; }
    .insight-item { background: white; padding: 10px 15px; margin: 8px 0; border-radius: 8px; border-left: 3px solid #f59e0b; }
    .insight-category { font-weight: bold; color: #92400e; text-transform: capitalize; }
    .summary { background: #dbeafe; padding: 20px; border-radius: 12px; margin-top: 30px; }
    .summary h2 { color: #1d4ed8; margin-top: 0; }
    .footer { margin-top: 40px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 20px; }
  </style>
</head>
<body>
  <h1>🧠 AI Coach Session</h1>
  <div class="meta">
    <strong>Goal:</strong> ${goalTitle}<br>
    <strong>Date:</strong> ${date}<br>
    <strong>Messages:</strong> ${targetSession.messageCount}<br>
    <strong>Status:</strong> ${targetSession.isComplete ? '✅ Completed' : '🔄 In Progress'}
  </div>

  <h2>💬 Conversation</h2>
`;

    // Add messages
    for (const msg of targetSession.messages) {
      const isAI = msg.role === 'assistant';
      htmlContent += `
  <div class="message ${isAI ? 'ai' : 'user'}">
    <div class="role">${isAI ? '🤖 AI Coach' : '👤 You'}</div>
    <div class="content">${msg.content.replace(/\n/g, '<br>')}</div>
  </div>`;
    }

    // Add insights if any
    if (targetSession.extractedInsights && targetSession.extractedInsights.length > 0) {
      htmlContent += `
  <div class="insights">
    <h2>💡 Key Insights</h2>`;
      for (const insight of targetSession.extractedInsights) {
        htmlContent += `
    <div class="insight-item">
      <span class="insight-category">${insight.category.replace(/_/g, ' ')}:</span> ${insight.text}
    </div>`;
      }
      htmlContent += `
  </div>`;
    }

    // Add summary if available
    if (targetSession.sessionSummary) {
      htmlContent += `
  <div class="summary">
    <h2>📋 Summary</h2>
    <p>${targetSession.sessionSummary}</p>
  </div>`;
    }

    // Add takeaways if available
    if (targetSession.keyTakeaways && targetSession.keyTakeaways.length > 0) {
      htmlContent += `
  <div class="summary">
    <h2>🎯 Key Takeaways</h2>
    <ul>`;
      for (const takeaway of targetSession.keyTakeaways) {
        htmlContent += `<li>${takeaway}</li>`;
      }
      htmlContent += `
    </ul>
  </div>`;
    }

    htmlContent += `
  <div class="footer">
    Generated by Balencia AI Coach • ${new Date().toLocaleString()}
  </div>
</body>
</html>`;

    // Set response headers for HTML download (will be converted to PDF by browser print)
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ai-coach-session-${sessionId.slice(0, 8)}.html"`);

    this.log('info', 'Session PDF downloaded', { userId, sessionId });
    res.send(htmlContent);
  });

  /**
   * Delete a chat session
   * DELETE /api/ai-coach/session/:sessionId
   */
  deleteSession = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = this.getUserId(req);
    const { sessionId } = req.params;

    if (!sessionId) {
      throw ApiError.badRequest('Session ID is required');
    }

    await aiCoachService.deleteSession(userId, sessionId);

    this.log('info', 'Session deleted', { userId, sessionId });
    this.success(res, { message: 'Session deleted successfully' });
  });

  // ============================================================================
  // Diet Plan Generation
  // ============================================================================

  /**
   * Generate a diet plan based on assessment
   * POST /api/ai-coach/diet-plan/generate
   */
  generateDietPlan = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = this.getUserId(req);
    const {
      goal,
      extractedInsights,
      preferences,
    } = req.body as {
      goal: GoalCategory;
      extractedInsights: ExtractedInsight[];
      preferences?: DietPlanRequest['preferences'];
    };

    if (!goal) {
      throw ApiError.badRequest('Goal is required');
    }

    this.log('info', `Generating diet plan`, { userId, goal });

    const dietPlan = await aiCoachService.generateDietPlan({
      userId,
      goalCategory: goal,
      insights: extractedInsights || [],
      preferences,
    });

    // Save the plan
    const planId = await aiCoachService.saveDietPlan(userId, dietPlan, goal);

    this.success(res, {
      planId,
      dietPlan,
    }, 'Diet plan generated successfully');
  });

  /**
   * Get active diet plan
   * GET /api/ai-coach/diet-plan
   */
  getDietPlan = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = this.getUserId(req);

    const dietPlan = await aiCoachService.getActiveDietPlan(userId);

    if (!dietPlan) {
      throw ApiError.notFound('No active diet plan found');
    }

    this.success(res, { dietPlan });
  });

  /**
   * Send message with session persistence
   * POST /api/ai-coach/chat
   */
  chat = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = this.getUserId(req);
    const {
      sessionId,
      message,
      goal,
      isOnboarding,
    } = req.body as {
      sessionId?: string;
      message: string;
      goal: GoalCategory;
      isOnboarding?: boolean;
    };

    if (!message || typeof message !== 'string') {
      throw ApiError.badRequest('Message is required');
    }

    if (!goal) {
      throw ApiError.badRequest('Goal is required');
    }

    // Get or create session
    let session = sessionId
      ? await aiCoachService.getActiveSession(userId, goal)
      : null;

    if (!session) {
      session = await aiCoachService.createSession(userId, goal, 'assessment');
    }

    // Build historical context from previous sessions
    const historicalContext = await aiCoachService.buildHistoricalContext(userId);

    // Fetch user's name from database
    const userName = await aiCoachService.getUserName(userId);

    // Build context for response generation
    const context: ConversationContext = {
      userId,
      goal,
      phase: session.conversationPhase,
      messageCount: session.messageCount,
      extractedInsights: session.extractedInsights,
      userProfile: userName ? { name: userName } : undefined,
      isOnboarding: isOnboarding || false,
    };

    // Add user message to session
    const userChatMessage: ChatMessage = { role: 'user', content: message.trim() };
    await aiCoachService.addMessageToSession(
      session.id,
      userChatMessage,
      session.extractedInsights,
      session.conversationPhase,
      false
    );

    // Generate AI response
    const response = await aiCoachService.generateResponse(
      context,
      [...session.messages, userChatMessage],
      message.trim()
    );

    // Add AI response to session
    const aiChatMessage: ChatMessage = { role: 'assistant', content: response.message };
    await aiCoachService.addMessageToSession(
      session.id,
      aiChatMessage,
      response.insights,
      response.phase,
      response.isComplete
    );

    this.log('info', `Chat message processed`, {
      userId,
      sessionId: session.id,
      phase: response.phase,
      isComplete: response.isComplete,
    });

    const routingChip = await routeCoachIntent({
      userId,
      userMessage: message.trim(),
      llm: routerLlm,
    });

    this.success(res, {
      sessionId: session.id,
      message: response.message,
      phase: response.phase,
      insights: response.insights,
      isComplete: response.isComplete,
      suggestedActions: response.suggestedActions,
      historicalContextUsed: historicalContext.length > 0,
      routingChip,
    });
  });

  // ============================================================================
  // Image Analysis
  // ============================================================================

  /**
   * Upload and analyze a health image
   * POST /api/ai-coach/image/analyze
   */
  analyzeImage = asyncHandler(async (req: FileRequest & AuthenticatedRequest, res: Response) => {
    const userId = this.getUserId(req as AuthenticatedRequest);
    const file = req.file;

    if (!file) {
      throw ApiError.badRequest('No image file provided');
    }

    const { question, goal } = req.body as {
      question?: string;
      goal?: GoalCategory;
    };

    this.log('info', `Analyzing health image`, {
      userId,
      filename: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    });

    const result = await aiCoachService.processImageMessage(
      userId,
      file.buffer,
      file.mimetype,
      file.originalname,
      question,
      goal
    );

    this.success(res, {
      imageKey: result.image.key,
      imageUrl: result.image.url,
      imageType: result.image.imageType,
      analysis: result.analysis,
      response: result.response,
    }, 'Image analyzed successfully');
  });

  /**
   * Validate an image before uploading (lighter endpoint)
   * POST /api/ai-coach/image/validate
   */
  validateImage = asyncHandler(async (req: FileRequest & AuthenticatedRequest, res: Response) => {
    const file = req.file;

    if (!file) {
      throw ApiError.badRequest('No image file provided');
    }

    const validation = await aiCoachService.validateHealthImage(
      file.buffer,
      file.mimetype,
      file.originalname
    );

    this.success(res, {
      isValid: validation.isValid,
      imageType: validation.imageType,
      confidence: validation.confidence,
      reason: validation.reason,
    });
  });

  /**
   * Send chat message with image attachment
   * POST /api/ai-coach/chat-with-image
   */
  chatWithImage = asyncHandler(async (req: FileRequest & AuthenticatedRequest, res: Response) => {
    const userId = this.getUserId(req as AuthenticatedRequest);
    const file = req.file;
    const {
      sessionId,
      message,
      goal,
    } = req.body as {
      sessionId?: string;
      message?: string;
      goal: GoalCategory;
    };

    if (!file) {
      throw ApiError.badRequest('No image file provided');
    }

    if (!goal) {
      throw ApiError.badRequest('Goal is required');
    }

    // Get or create session
    let session = sessionId
      ? await aiCoachService.getActiveSession(userId, goal)
      : null;

    if (!session) {
      session = await aiCoachService.createSession(userId, goal, 'assessment');
    }

    this.log('info', `Processing chat with image`, {
      userId,
      sessionId: session.id,
      filename: file.originalname,
      hasMessage: !!message,
    });

    // Process the image
    const imageResult = await aiCoachService.processImageMessage(
      userId,
      file.buffer,
      file.mimetype,
      file.originalname,
      message,
      goal
    );

    // Add user message (with image reference) to session
    const userContent = message
      ? `[Image: ${imageResult.image.imageType}] ${message}`
      : `[Image: ${imageResult.image.imageType}]`;
    const userChatMessage: ChatMessage = { role: 'user', content: userContent };
    await aiCoachService.addMessageToSession(
      session.id,
      userChatMessage,
      session.extractedInsights,
      session.conversationPhase,
      false
    );

    // Add AI response to session
    const aiChatMessage: ChatMessage = { role: 'assistant', content: imageResult.response };
    const allInsights = [...session.extractedInsights, ...imageResult.analysis.insights];
    await aiCoachService.addMessageToSession(
      session.id,
      aiChatMessage,
      allInsights,
      session.conversationPhase,
      false
    );

    this.success(res, {
      sessionId: session.id,
      message: imageResult.response,
      imageAnalysis: imageResult.analysis,
      imageUrl: imageResult.image.url,
      imageType: imageResult.image.imageType,
      insights: allInsights,
    });
  });

  // ============================================================================
  // Goal Generation
  // ============================================================================

  /**
   * Generate personalized SMART goals based on assessment
   * POST /api/ai-coach/generate-goals
   */
  generateGoals = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = this.getUserId(req);
    const {
      goalCategory,
      assessmentResponses,
      bodyStats,
      customGoalText,
    } = req.body as {
      goalCategory: GoalCategory;
      assessmentResponses: AssessmentResponseInput[];
      bodyStats: BodyStatsInput;
      customGoalText?: string;
    };

    // Validation
    if (!goalCategory) {
      throw ApiError.badRequest('Goal category is required');
    }

    const validGoals: GoalCategory[] = [
      'weight_loss',
      'muscle_building',
      'sleep_improvement',
      'stress_wellness',
      'energy_productivity',
      'event_training',
      'health_condition',
      'habit_building',
      'overall_optimization',
      'nutrition',
      'fitness',
      'custom',
    ];

    if (!validGoals.includes(goalCategory)) {
      throw ApiError.badRequest(`Invalid goal category. Must be one of: ${validGoals.join(', ')}`);
    }

    if (!Array.isArray(assessmentResponses)) {
      throw ApiError.badRequest('Assessment responses must be an array');
    }

    this.log('info', `Generating goals`, {
      userId,
      goalCategory,
      responsesCount: assessmentResponses.length,
    });

    const result = await aiCoachService.generateGoals({
      userId,
      goalCategory,
      assessmentResponses: assessmentResponses || [],
      bodyStats: bodyStats || {},
      customGoalText,
    });

    // Enrich goals with unique IDs and metadata the client expects
    const enrichedGoals = result.goals.map((goal, index) => {
      const now = new Date();
      const durationWeeks = goal.timeline?.durationWeeks || 8;
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + durationWeeks * 7);

      return {
        ...goal,
        id: goal.id || crypto.randomUUID(),
        category: goal.category || goalCategory,
        pillar: goal.pillar || 'wellbeing',
        isPrimary: goal.isPrimary ?? index === 0,
        currentValue: goal.currentValue ?? 0,
        confidenceScore: goal.confidenceScore ?? 0.7,
        aiSuggested: goal.aiSuggested ?? true,
        timeline: {
          startDate: goal.timeline?.startDate || now.toISOString(),
          targetDate: goal.timeline?.targetDate || targetDate.toISOString(),
          durationWeeks,
        },
      };
    });

    this.success(res, {
      goals: enrichedGoals,
      reasoning: result.reasoning,
    }, 'Goals generated successfully');
  });

  // ============================================================================
  // MCQ Dynamic Question Generation
  // ============================================================================

  /**
   * Generate next MCQ question
   * POST /api/ai-coach/mcq/question
   */
  generateMCQQuestion = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { goal, phase, previousAnswers, extractedInsights, language } = req.body as {
      goal: GoalCategory;
      phase?: ConversationPhase;
      previousAnswers?: { questionId: string; questionText?: string; selectedOptions: string[] }[];
      extractedInsights?: ExtractedInsight[];
      language?: SupportedLanguage;
    };

    if (!goal) {
      throw ApiError.badRequest('Goal is required');
    }

    const validGoals: GoalCategory[] = [
      'weight_loss', 'muscle_building', 'sleep_improvement', 'stress_wellness',
      'energy_productivity', 'event_training', 'health_condition', 'habit_building',
      'overall_optimization', 'custom',
    ];

    if (!validGoals.includes(goal)) {
      throw ApiError.badRequest(`Invalid goal. Must be one of: ${validGoals.join(', ')}`);
    }

    this.log('info', `Generating MCQ question`, {
      goal,
      previousAnswersCount: previousAnswers?.length || 0,
    });

    const result = await aiCoachService.generateMCQQuestion({
      goal,
      phase: phase || 'opening',
      previousAnswers,
      extractedInsights,
      language,
    });

    this.success(res, result);
  });

  /**
   * Process MCQ answer and extract insights
   * POST /api/ai-coach/mcq/answer
   */
  processMCQAnswer = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { questionId, selectedOptions, goal } = req.body as {
      questionId: string;
      selectedOptions: MCQOption[];
      goal: GoalCategory;
    };

    if (!questionId || !selectedOptions || !goal) {
      throw ApiError.badRequest('questionId, selectedOptions, and goal are required');
    }

    if (!Array.isArray(selectedOptions)) {
      throw ApiError.badRequest('selectedOptions must be an array');
    }

    this.log('info', `Processing MCQ answer`, {
      questionId,
      selectedCount: selectedOptions.length,
    });

    const insights = await aiCoachService.processMCQAnswer(questionId, selectedOptions, goal);

    this.success(res, { insights });
  });

  // ============================================================================
  // Coaching Profile
  // ============================================================================

  /**
   * Get user's coaching profile
   * GET /api/ai-coach/profile
   */
  getCoachingProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId ?? '';

    const profile = await userCoachingProfileService.getOrGenerateProfile(userId);

    this.success(res, { profile });
  });

  /**
   * Force refresh user's coaching profile
   * POST /api/ai-coach/profile/refresh
   */
  refreshCoachingProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId ?? '';

    const profile = await userCoachingProfileService.generateProfile(userId);

    this.success(res, { profile });
  });

  /**
   * Update coaching tone preference
   * PATCH /api/ai-coach/profile/tone
   */
  updateCoachingTone = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId ?? '';
    const { tone } = req.body;

    if (!tone || !['supportive', 'direct', 'tough_love'].includes(tone)) {
      throw new ApiError(400, 'Invalid tone. Must be one of: supportive, direct, tough_love');
    }

    await userCoachingProfileService.setCoachingTone(userId, tone);

    this.success(res, { message: 'Coaching tone updated', tone });
  });
}

export const aiCoachController = new AICoachController();
