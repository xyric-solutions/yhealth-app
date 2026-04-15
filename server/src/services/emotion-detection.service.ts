/**
 * @file Emotion Detection Service
 * @description Detects emotions from voice/text using Gemini (primary) with DeepSeek/OpenAI fallbacks
 */

import OpenAI from 'openai';
import { env } from '../config/env.config.js';
import { logger } from './logger.service.js';
import { query } from '../database/pg.js';
import { parseLlmJson } from '../helper/llm-json-parser.js';

// ============================================
// TYPES
// ============================================

export type EmotionCategory = 
  | 'happy' 
  | 'sad' 
  | 'angry' 
  | 'anxious' 
  | 'calm' 
  | 'stressed' 
  | 'excited' 
  | 'tired' 
  | 'neutral' 
  | 'distressed';

export interface EmotionDetection {
  category: EmotionCategory;
  confidence: number; // 0-100
  reasoning?: string;
  rawData?: Record<string, unknown>;
  timestamp: Date;
}

export interface ConversationContext {
  previousEmotions?: EmotionDetection[];
  conversationPhase?: string;
  sessionType?: string;
  topic?: string;
}

/**
 * Determine if model requires max_completion_tokens instead of max_tokens
 */
function requiresMaxCompletionTokens(model: string): boolean {
  const modelLower = model.toLowerCase();
  return modelLower.startsWith('o1') || modelLower.startsWith('o3') || modelLower.startsWith('gpt-5');
}

/**
 * Check if model is a reasoning model that uses internal reasoning tokens
 */
function isReasoningModel(model: string): boolean {
  const modelLower = model.toLowerCase();
  return modelLower.startsWith('o1') || modelLower.startsWith('o3') || modelLower === 'gpt-5';
}

/**
 * Get the correct token parameter for the model.
 * Reasoning models consume tokens for internal thinking, so we multiply the budget.
 */
function getTokenParameter(model: string, maxTokens: number): { max_tokens?: number; max_completion_tokens?: number } {
  const adjustedTokens = isReasoningModel(model) ? maxTokens * 4 : maxTokens;
  if (requiresMaxCompletionTokens(model)) {
    return { max_completion_tokens: adjustedTokens };
  }
  return { max_tokens: adjustedTokens };
}

export interface EmotionTrend {
  userId: string;
  period: {
    start: Date;
    end: Date;
    days: number;
  };
  dominantEmotion: EmotionCategory;
  averageConfidence: number;
  emotionDistribution: Record<EmotionCategory, number>;
  trend: 'improving' | 'stable' | 'declining';
  recentEmotions: EmotionDetection[];
}

interface EmotionLogRow {
  id: string;
  user_id: string;
  call_id: string | null;
  conversation_id: string | null;
  timestamp: Date;
  emotion_category: EmotionCategory;
  confidence_score: number;
  source: string;
  raw_data: Record<string, unknown>;
}

// ============================================
// SERVICE CLASS
// ============================================

class EmotionDetectionService {
  private deepseekClient: OpenAI | null = null;
  private openaiClient: OpenAI | null = null;
  private geminiApiKey: string | null = null;
  private apiLimitLogged = false; // Track if we've already logged API limit warnings
  /** Cache user logging permission to avoid repeated DB lookups (5-min TTL) */
  private userLoggingCache: Map<string, { enabled: boolean; expiresAt: number }> = new Map();

  constructor() {
    this.initializeClients();
  }

  private initializeClients(): void {
    // Initialize Gemini as primary fallback
    if (env.gemini.apiKey) {
      this.geminiApiKey = env.gemini.apiKey;
      logger.info('[EmotionDetection] Gemini available (primary fallback)');
    }

    // Initialize DeepSeek for emotion classification
    if (env.deepseek.apiKey) {
      try {
        this.deepseekClient = new OpenAI({
          apiKey: env.deepseek.apiKey,
          baseURL: `${env.deepseek.baseUrl}/v1`,
          timeout: 30000,
          maxRetries: 1,
        });
        logger.info('[EmotionDetection] DeepSeek client initialized');
      } catch (error) {
        logger.warn('[EmotionDetection] Failed to initialize DeepSeek client', { error });
      }
    }

    // Initialize OpenAI as last fallback
    if (env.openai.apiKey) {
      try {
        this.openaiClient = new OpenAI({
          apiKey: env.openai.apiKey,
          timeout: 30000,
          maxRetries: 1,
        });
        logger.info('[EmotionDetection] OpenAI client initialized (fallback)');
      } catch (error) {
        logger.warn('[EmotionDetection] Failed to initialize OpenAI client', { error });
      }
    }
  }

  /**
   * Call Gemini for text completion
   */
  private async callGemini(
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number,
    temperature = 0.3,
    jsonMode = false,
  ): Promise<string> {
    if (!this.geminiApiKey) throw new Error('Gemini not available');
    const model = env.gemini.lightModel || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.geminiApiKey}`;

    // Gemini 2.5+ thinking models consume tokens for internal reasoning,
    // so we need a higher budget to avoid truncated output
    const isThinkingModel = model.includes('2.5') || model.includes('thinking');
    const effectiveMaxTokens = isThinkingModel ? Math.max(maxTokens, 500) : maxTokens;

    const generationConfig: Record<string, unknown> = {
      maxOutputTokens: effectiveMaxTokens,
      temperature,
    };
    // JSON mode prevents markdown wrapping and ensures valid JSON output
    if (jsonMode) {
      generationConfig.responseMimeType = 'application/json';
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig,
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Gemini error (${resp.status}): ${errText}`);
    }
    const data = await resp.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  /**
   * Detect emotion from text (primary method)
   */
  async detectEmotionFromText(
    text: string,
    context?: ConversationContext
  ): Promise<EmotionDetection> {
    // If we've already hit API limits, skip the API call and use fallback directly
    if (this.apiLimitLogged) {
      return this.fallbackEmotionDetection(text);
    }

    try {
      if (!this.geminiApiKey && !this.deepseekClient) {
        logger.warn('[EmotionDetection] No AI providers available, using fallback');
        return this.fallbackEmotionDetection(text);
      }

      // Build context string
      let contextStr = '';
      if (context?.previousEmotions && context.previousEmotions.length > 0) {
        const recentEmotions = context.previousEmotions
          .slice(-3)
          .map(e => e.category)
          .join(', ');
        contextStr = `Previous emotions in conversation: ${recentEmotions}. `;
      }
      if (context?.sessionType) {
        contextStr += `Session type: ${context.sessionType}. `;
      }
      if (context?.topic) {
        contextStr += `Topic: ${context.topic}. `;
      }

      // Use DeepSeek for classification
      const classificationPrompt = `Analyze the emotional tone of the following text and classify it into one of these categories: happy, sad, angry, anxious, calm, stressed, excited, tired, neutral, distressed.

${contextStr}Text: "${text}"

Respond with ONLY a JSON object in this exact format:
{
  "category": "one of the emotion categories",
  "confidence": 0-100,
  "reasoning": "brief explanation of why this emotion was detected"
}`;

      let content = '';
      const classSystemPrompt = 'You are an emotion detection expert. Analyze text and classify emotions accurately.';

      // Try Gemini first (primary provider, JSON mode to prevent markdown wrapping)
      if (this.geminiApiKey) {
        try {
          content = await this.callGemini(classSystemPrompt, classificationPrompt, 200, 0.3, true);
        } catch (geminiError: any) {
          logger.warn('[EmotionDetection] Gemini classification failed', { error: geminiError?.message });
        }
      }

      // Fallback to DeepSeek
      if (!content && this.deepseekClient) {
        try {
          const model = env.deepseek.model || 'deepseek-chat';
          const classificationResponse = await this.deepseekClient.chat.completions.create({
            model,
            messages: [
              { role: 'system', content: classSystemPrompt },
              { role: 'user', content: classificationPrompt },
            ],
            temperature: 0.3,
            ...getTokenParameter(model, 200),
            response_format: { type: 'json_object' },
          });
          content = classificationResponse.choices[0]?.message?.content || '';
        } catch (deepseekError: any) {
          logger.warn('[EmotionDetection] DeepSeek classification also failed', { error: deepseekError?.message });
          if (deepseekError?.status === 402 || deepseekError?.message?.includes('402') || deepseekError?.message?.includes('Insufficient Balance')) {
            logger.warn('[EmotionDetection] DeepSeek billing exhausted, disabling for this session');
            this.deepseekClient = null;
          }
        }
      }

      if (!content) {
        throw new Error('All classification providers failed');
      }

      let classificationResult: {
        category: string;
        confidence: number;
        reasoning?: string;
      } | null;

      classificationResult = parseLlmJson(content);
      if (!classificationResult) {
        logger.warn('[EmotionDetection] Failed to parse response, using fallback', { contentPreview: content.substring(0, 200) });
        return this.fallbackEmotionDetection(text);
      }

      // Validate category
      const validCategories: EmotionCategory[] = [
        'happy',
        'sad',
        'angry',
        'anxious',
        'calm',
        'stressed',
        'excited',
        'tired',
        'neutral',
        'distressed',
      ];

      if (!validCategories.includes(classificationResult.category as EmotionCategory)) {
        logger.warn(
          '[EmotionDetection] Invalid emotion category received, defaulting to neutral',
          { category: classificationResult.category }
        );
        classificationResult.category = 'neutral';
      }

      // Enhance with emotional reasoning (Gemini primary, OpenAI fallback)
      let reasoning = classificationResult.reasoning || '';
      if (context) {
        try {
          const reasoningPrompt = `Provide emotional reasoning for this emotion detection:
Text: "${text}"
Detected Emotion: ${classificationResult.category}
Confidence: ${classificationResult.confidence}%

Provide a brief, empathetic explanation of why this emotion might be present.`;
          const reasoningSystem = 'You are an empathetic emotional reasoning expert. Provide thoughtful, brief explanations.';

          let reasoningContent = '';

          // Try Gemini first
          if (this.geminiApiKey) {
            try {
              reasoningContent = await this.callGemini(reasoningSystem, reasoningPrompt, 150, 0.7);
            } catch { /* fall through */ }
          }

          // Fallback to OpenAI
          if (!reasoningContent && this.openaiClient) {
            const model = env.openai.model || 'gpt-4o-mini';
            const supportsTemp = !isReasoningModel(model);
            const reasoningResponse = await this.openaiClient.chat.completions.create({
              model,
              messages: [
                { role: 'system', content: reasoningSystem },
                { role: 'user', content: reasoningPrompt },
              ],
              ...(supportsTemp ? { temperature: 0.7 } : {}),
              ...getTokenParameter(model, 150),
            });
            reasoningContent = reasoningResponse.choices[0]?.message?.content || '';
          }

          if (reasoningContent) {
            reasoning = reasoningContent;
          }
        } catch (reasoningError) {
          logger.warn('[EmotionDetection] Failed to get emotional reasoning', { error: reasoningError });
          // Continue with classification reasoning only
        }
      }

      const detection: EmotionDetection = {
        category: classificationResult.category as EmotionCategory,
        confidence: Math.max(0, Math.min(100, Math.round(Number(classificationResult.confidence) || 50))),
        reasoning: reasoning || undefined,
        rawData: {
          deepseekModel: env.deepseek.model,
          classificationResult,
        },
        timestamp: new Date(),
      };

      logger.info('[EmotionDetection] Emotion detected from text', {
        category: detection.category,
        confidence: detection.confidence,
        textLength: text.length,
      });

      return detection;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Handle expected errors (API balance, rate limits) with warn instead of error
      const isExpectedError = 
        errorMessage.includes('402') || 
        errorMessage.includes('Insufficient Balance') ||
        errorMessage.includes('rate limit') ||
        errorMessage.includes('429') ||
        errorMessage.includes('quota');
      
      if (isExpectedError) {
        // Only log warning once to avoid log spam, then use debug level
        if (!this.apiLimitLogged) {
          logger.warn('[EmotionDetection] API limit reached, using fallback for all subsequent requests', {
            error: errorMessage,
          });
          this.apiLimitLogged = true;
        } else {
          logger.debug('[EmotionDetection] API limit reached, using fallback', {
            error: errorMessage,
            textLength: text.length,
          });
        }
      } else {
        logger.error('[EmotionDetection] Error detecting emotion from text', {
          error: errorMessage,
          textLength: text.length,
        });
      }
      
      // Fallback to keyword-based emotion detection
      return this.fallbackEmotionDetection(text);
    }
  }

  /**
   * Detect emotion from voice audio (placeholder - requires audio processing)
   * For now, this would require transcription first or audio analysis
   */
  async detectEmotionFromVoice(_audioData: Buffer): Promise<EmotionDetection> {
    // TODO: Implement audio emotion detection
    // This would require:
    // 1. Audio feature extraction (pitch, tone, pace, etc.)
    // 2. ML model for voice emotion classification
    // 3. Or transcription + text emotion detection
    
    logger.warn('[EmotionDetection] Voice emotion detection not yet implemented');
    return {
      category: 'neutral',
      confidence: 50,
      timestamp: new Date(),
    };
  }

  /**
   * Fast local emotion detection using keyword matching.
   * Used as the primary detection in the chat hot path to avoid LLM latency.
   */
  fallbackEmotionDetection(text: string): EmotionDetection {
    const lowerText = text.toLowerCase();

    // Simple keyword-based detection
    const emotionKeywords: Record<EmotionCategory, string[]> = {
      happy: ['happy', 'joy', 'excited', 'great', 'wonderful', 'amazing', 'love', 'glad'],
      sad: ['sad', 'depressed', 'down', 'unhappy', 'hurt', 'upset', 'disappointed'],
      angry: ['angry', 'mad', 'frustrated', 'annoyed', 'irritated', 'furious'],
      anxious: ['anxious', 'worried', 'nervous', 'scared', 'afraid', 'fear'],
      calm: ['calm', 'peaceful', 'relaxed', 'serene', 'content', 'at ease'],
      stressed: ['stressed', 'overwhelmed', 'pressure', 'tension', 'strain'],
      excited: ['excited', 'enthusiastic', 'thrilled', 'pumped', 'energized'],
      tired: ['tired', 'exhausted', 'fatigued', 'drained', 'sleepy', 'weary'],
      neutral: [], // Default
      distressed: ['distressed', 'distraught', 'overwhelmed', 'desperate', 'hopeless'],
    };

    // Check for crisis keywords first (highest priority)
    if (
      lowerText.includes('hurt myself') ||
      lowerText.includes('suicide') ||
      lowerText.includes('end it all') ||
      lowerText.includes("don't want to be here") ||
      lowerText.includes("can't take it")
    ) {
      return {
        category: 'distressed',
        confidence: 90,
        reasoning: 'Crisis indicators detected in text',
        timestamp: new Date(),
      };
    }

    // Count keyword matches
    const scores: Partial<Record<EmotionCategory, number>> = {};
    for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
      if (emotion === 'neutral') continue;
      const count = keywords.filter(keyword => lowerText.includes(keyword)).length;
      if (count > 0) {
        scores[emotion as EmotionCategory] = count;
      }
    }

    // Get emotion with highest score
    const entries = Object.entries(scores);
    if (entries.length === 0) {
      return {
        category: 'neutral',
        confidence: 50,
        timestamp: new Date(),
      };
    }

    entries.sort((a, b) => (b[1] as number) - (a[1] as number));
    const [dominantEmotion, score] = entries[0];

    // Calculate confidence based on keyword count
    const confidence = Math.min(85, 50 + (score as number) * 10);

    return {
      category: dominantEmotion as EmotionCategory,
      confidence,
      timestamp: new Date(),
    };
  }

  /**
   * Log detected emotion to database
   * Handles foreign key constraint errors gracefully
   */
  async logEmotion(
    userId: string,
    emotion: EmotionDetection,
    options?: {
      callId?: string;
      conversationId?: string;
      source?: 'voice' | 'text';
    }
  ): Promise<string> {
    try {
      // Check cached permission first (avoids 2 DB queries per call)
      const cached = this.userLoggingCache.get(userId);
      if (cached && cached.expiresAt > Date.now()) {
        if (!cached.enabled) return '';
      } else {
        // Single query: verify user exists + check logging preference
        const check = await query<{ id: string; logging_enabled: boolean }>(
          `SELECT u.id, COALESCE(p.emotion_logging_enabled, true) as logging_enabled
           FROM users u
           LEFT JOIN user_preferences p ON u.id = p.user_id
           WHERE u.id = $1`,
          [userId]
        );

        if (check.rows.length === 0) {
          this.userLoggingCache.set(userId, { enabled: false, expiresAt: Date.now() + 5 * 60 * 1000 });
          logger.warn('[EmotionDetection] User not found, skipping emotion log', { userId, emotionCategory: emotion.category });
          return '';
        }

        const enabled = check.rows[0].logging_enabled !== false;
        this.userLoggingCache.set(userId, { enabled, expiresAt: Date.now() + 5 * 60 * 1000 });

        if (!enabled) {
          logger.info('[EmotionDetection] Emotion logging disabled for user', { userId });
          return '';
        }
      }

      const source = options?.source || 'text';
      const result = await query<{ id: string }>(
        `INSERT INTO emotion_logs (
          user_id, call_id, conversation_id, timestamp, emotion_category, 
          confidence_score, source, raw_data
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id`,
        [
          userId,
          options?.callId || null,
          options?.conversationId || null,
          emotion.timestamp,
          emotion.category,
          Number.isFinite(emotion.confidence) ? emotion.confidence : 50,
          source,
          JSON.stringify(emotion.rawData || {}),
        ]
      );

      const emotionLogId = result.rows[0].id;
      logger.info('[EmotionDetection] Emotion logged', {
        userId,
        emotionLogId,
        category: emotion.category,
        confidence: emotion.confidence,
      });

      return emotionLogId;
    } catch (error: any) {
      // Handle foreign key constraint errors gracefully
      if (error?.code === '23503') {
        logger.warn('[EmotionDetection] Foreign key constraint violation - user or related record not found', {
          error: error?.message,
          errorDetail: error?.detail,
          userId,
          callId: options?.callId,
          conversationId: options?.conversationId,
        });
        return ''; // Return empty ID instead of throwing
      }

      logger.error('[EmotionDetection] Error logging emotion', {
        error: error?.message,
        errorCode: error?.code,
        userId,
      });
      // Don't throw - emotion logging is non-critical and shouldn't break the flow
      return '';
    }
  }

  /**
   * Analyze emotional trends over time
   */
  async analyzeEmotionalTrends(
    userId: string,
    days: number = 30
  ): Promise<EmotionTrend> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const result = await query<EmotionLogRow>(
        `SELECT * FROM emotion_logs
         WHERE user_id = $1 AND timestamp >= $2
         ORDER BY timestamp DESC`,
        [userId, startDate]
      );

      if (result.rows.length === 0) {
        return {
          userId,
          period: {
            start: startDate,
            end: new Date(),
            days,
          },
          dominantEmotion: 'neutral',
          averageConfidence: 0,
          emotionDistribution: {
            happy: 0,
            sad: 0,
            angry: 0,
            anxious: 0,
            calm: 0,
            stressed: 0,
            excited: 0,
            tired: 0,
            neutral: 0,
            distressed: 0,
          },
          trend: 'stable',
          recentEmotions: [],
        };
      }

      const emotions: EmotionDetection[] = result.rows.map(row => ({
        category: row.emotion_category,
        confidence: row.confidence_score,
        timestamp: row.timestamp,
        rawData: row.raw_data as Record<string, unknown>,
      }));

      // Calculate distribution
      const distribution: Record<EmotionCategory, number> = {
        happy: 0,
        sad: 0,
        angry: 0,
        anxious: 0,
        calm: 0,
        stressed: 0,
        excited: 0,
        tired: 0,
        neutral: 0,
        distressed: 0,
      };

      let totalConfidence = 0;
      for (const emotion of emotions) {
        distribution[emotion.category]++;
        totalConfidence += emotion.confidence;
      }

      // Find dominant emotion
      const dominantEmotion = Object.entries(distribution).reduce((a, b) =>
        distribution[a[0] as EmotionCategory] > distribution[b[0] as EmotionCategory] ? a : b
      )[0] as EmotionCategory;

      // Calculate average confidence
      const averageConfidence = emotions.length > 0 ? totalConfidence / emotions.length : 0;

      // Determine trend (comparing first half vs second half)
      let trend: 'improving' | 'stable' | 'declining' = 'stable';
      if (emotions.length >= 4) {
        const midPoint = Math.floor(emotions.length / 2);
        const firstHalf = emotions.slice(0, midPoint);
        const secondHalf = emotions.slice(midPoint);

        // Simple trend: positive emotions (happy, calm, excited) vs negative (sad, angry, anxious, stressed, distressed)
        const positiveEmotions: EmotionCategory[] = ['happy', 'calm', 'excited'];
        const negativeEmotions: EmotionCategory[] = ['sad', 'angry', 'anxious', 'stressed', 'distressed'];

        const firstHalfPositive = firstHalf.filter(e => positiveEmotions.includes(e.category)).length;
        const firstHalfNegative = firstHalf.filter(e => negativeEmotions.includes(e.category)).length;
        const secondHalfPositive = secondHalf.filter(e => positiveEmotions.includes(e.category)).length;
        const secondHalfNegative = secondHalf.filter(e => negativeEmotions.includes(e.category)).length;

        const firstHalfScore = firstHalfPositive - firstHalfNegative;
        const secondHalfScore = secondHalfPositive - secondHalfNegative;

        if (secondHalfScore > firstHalfScore) {
          trend = 'improving';
        } else if (secondHalfScore < firstHalfScore) {
          trend = 'declining';
        }
      }

      return {
        userId,
        period: {
          start: startDate,
          end: new Date(),
          days,
        },
        dominantEmotion,
        averageConfidence: Math.round(averageConfidence),
        emotionDistribution: distribution,
        trend,
        recentEmotions: emotions.slice(0, 10), // Last 10 emotions
      };
    } catch (error) {
      logger.error('[EmotionDetection] Error analyzing emotional trends', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        days,
      });
      throw error;
    }
  }

  /**
   * Get recent emotions for a user
   */
  async getRecentEmotions(
    userId: string,
    limit: number = 20
  ): Promise<EmotionDetection[]> {
    try {
      const result = await query<EmotionLogRow>(
        `SELECT * FROM emotion_logs
         WHERE user_id = $1
         ORDER BY timestamp DESC
         LIMIT $2`,
        [userId, limit]
      );

      return result.rows.map(row => ({
        category: row.emotion_category,
        confidence: row.confidence_score,
        timestamp: row.timestamp,
        rawData: row.raw_data as Record<string, unknown>,
      }));
    } catch (error) {
      logger.error('[EmotionDetection] Error getting recent emotions', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      throw error;
    }
  }
}

export const emotionDetectionService = new EmotionDetectionService();

