/**
 * @file AI Provider Service
 * Multi-provider AI service with automatic fallback
 * Supports: OpenAI, DeepSeek, Google Gemini
 */

import OpenAI from 'openai';
import { env } from '../config/env.config.js';
import { logger } from './logger.service.js';

// ============================================
// TYPES
// ============================================

export interface AICompletionRequest {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number; // Optional timeout override (in milliseconds)
  model?: string;   // Override default model (e.g., 'gemini-2.5-pro' for high-quality generation)
  jsonMode?: boolean; // Request JSON output format (Gemini responseMimeType)
  imageBase64?: string; // Base64 image for vision models (data:image/jpeg;base64,... or raw base64)
}

export interface AICompletionResponse {
  content: string;
  provider: 'openai' | 'deepseek' | 'gemini';
  model: string;
}

interface ProviderConfig {
  name: 'openai' | 'deepseek' | 'gemini';
  isAvailable: boolean;
  priority: number;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
}

// ============================================
// SERVICE CLASS
// ============================================

class AIProviderService {
  private openaiClient: OpenAI | null = null;

  /**
   * Determine if model requires max_completion_tokens instead of max_tokens
   */
  private requiresMaxCompletionTokens(model: string): boolean {
    const modelLower = model.toLowerCase();
    return modelLower.startsWith('o1') || modelLower.startsWith('o3') || modelLower.startsWith('gpt-5');
  }

  /**
   * Check if model is a reasoning model that uses internal reasoning tokens
   */
  private isReasoningModel(model: string): boolean {
    const modelLower = model.toLowerCase();
    return modelLower.startsWith('o1') || modelLower.startsWith('o3') || modelLower === 'gpt-5';
  }

  /**
   * Get the correct token parameter for the model.
   * Reasoning models (o1, o3, gpt-5) consume tokens for internal thinking,
   * so we multiply the budget to ensure enough room for actual output.
   */
  private getTokenParameter(model: string, maxTokens: number): { max_tokens?: number; max_completion_tokens?: number } {
    const adjustedTokens = this.isReasoningModel(model) ? maxTokens * 4 : maxTokens;
    if (this.requiresMaxCompletionTokens(model)) {
      return { max_completion_tokens: adjustedTokens };
    }
    return { max_tokens: adjustedTokens };
  }
  private deepseekClient: OpenAI | null = null; // DeepSeek uses OpenAI-compatible API
  private providers: ProviderConfig[] = [];

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Initialize Gemini as PRIMARY (will use REST API directly)
    if (env.gemini.apiKey) {
      this.providers.push({ name: 'gemini', isAvailable: true, priority: 1 });
      logger.info('[AIProvider] Gemini initialized (primary)');
    }

    // Initialize DeepSeek (OpenAI-compatible API) as secondary
    if (env.deepseek.apiKey) {
      try {
        this.deepseekClient = new OpenAI({
          apiKey: env.deepseek.apiKey,
          baseURL: `${env.deepseek.baseUrl}/v1`,
          timeout: 60000,
          maxRetries: 1,
        });
        this.providers.push({ name: 'deepseek', isAvailable: true, priority: 2 });
        logger.info('[AIProvider] DeepSeek initialized (fallback)');
      } catch (error) {
        logger.warn('[AIProvider] Failed to initialize DeepSeek', { error });
      }
    }

    // Initialize OpenAI as last resort fallback
    if (env.openai.apiKey) {
      try {
        this.openaiClient = new OpenAI({
          apiKey: env.openai.apiKey,
          timeout: 60000,
          maxRetries: 1,
        });
        this.providers.push({ name: 'openai', isAvailable: true, priority: 3 });
        logger.info('[AIProvider] OpenAI initialized (fallback)');
      } catch (error) {
        logger.warn('[AIProvider] Failed to initialize OpenAI', { error });
      }
    }

    // Sort providers by priority
    this.providers.sort((a, b) => a.priority - b.priority);

    if (this.providers.length === 0) {
      logger.warn('[AIProvider] No AI providers configured. AI features will be unavailable.');
    } else {
      logger.info(`[AIProvider] ${this.providers.length} provider(s) available: ${this.providers.map(p => p.name).join(', ')}`);
    }
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): string[] {
    return this.providers.filter(p => p.isAvailable).map(p => p.name);
  }

  /**
   * Check if any provider is available
   */
  isAvailable(): boolean {
    return this.providers.some(p => p.isAvailable);
  }

  /**
   * Generate completion with automatic fallback
   */
  async generateCompletion(request: AICompletionRequest): Promise<AICompletionResponse> {
    const fullRequest: AICompletionRequest = {
      ...request,
      maxTokens: request.maxTokens ?? 1000,
      temperature: request.temperature ?? 0.7,
    };

    const errors: Array<{ provider: string; error: string }> = [];

    // Try each provider in order
    for (const provider of this.providers.filter(p => p.isAvailable)) {
      try {
        logger.info(`[AIProvider] Attempting completion with ${provider.name}`);

        const result = await this.callProvider(provider.name, fullRequest);

        logger.info(`[AIProvider] Successfully completed with ${provider.name}`);
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const isRateLimit = this.isRateLimitError(error);
        const isTimeout = this.isTimeoutError(error);

        const errorType = isRateLimit ? ' (rate limit/balance)' : isTimeout ? ' (timeout)' : '';
        logger.warn(`[AIProvider] ${provider.name} failed${errorType}`, {
          error: errorMessage,
        });

        errors.push({ provider: provider.name, error: errorMessage });

        // For timeout errors, continue to next provider immediately
        // For rate limit/balance errors, also continue to next provider
        // For other errors, continue to next provider as well
        continue;
      }
    }

    // All providers failed
    const errorSummary = errors.map(e => `${e.provider}: ${e.error}`).join('; ');
    const allTimeouts = errors.every(e => 
      e.error.toLowerCase().includes('timeout') || 
      e.error.toLowerCase().includes('timed out')
    );
    const allBalanceErrors = errors.every(e => 
      e.error.toLowerCase().includes('insufficient balance') || 
      e.error.toLowerCase().includes('402')
    );
    
    let errorMessage = `All AI providers failed. ${errorSummary}`;
    if (allTimeouts) {
      errorMessage += ' (All providers timed out - consider reducing prompt size or increasing timeout)';
    } else if (allBalanceErrors) {
      errorMessage += ' (All providers have insufficient balance - please check API keys and billing)';
    }
    
    throw new Error(errorMessage);
  }

  /**
   * Call specific provider
   */
  private async callProvider(
    provider: 'openai' | 'deepseek' | 'gemini',
    request: AICompletionRequest
  ): Promise<AICompletionResponse> {
    switch (provider) {
      case 'openai':
        return this.callOpenAI(request);
      case 'deepseek':
        return this.callDeepSeek(request);
      case 'gemini':
        return this.callGemini(request);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  /**
   * Call OpenAI
   */
  private async callOpenAI(request: AICompletionRequest): Promise<AICompletionResponse> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized');
    }

    const model = env.openai.model;
    const supportsTemp = !this.isReasoningModel(model);
    const response = await this.openaiClient.chat.completions.create({
      model,
      ...this.getTokenParameter(model, request.maxTokens || 1000),
      ...(supportsTemp ? { temperature: request.temperature } : {}),
      ...(request.jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    return {
      content,
      provider: 'openai',
      model: env.openai.model,
    };
  }

  /**
   * Call DeepSeek (OpenAI-compatible API)
   */
  private async callDeepSeek(request: AICompletionRequest): Promise<AICompletionResponse> {
    if (!this.deepseekClient) {
      throw new Error('DeepSeek client not initialized');
    }

    const model = env.deepseek.model;
    const response = await this.deepseekClient.chat.completions.create({
      model,
      ...this.getTokenParameter(model, request.maxTokens || 1000),
      temperature: request.temperature,
      ...(request.jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from DeepSeek');
    }

    return {
      content,
      provider: 'deepseek',
      model: env.deepseek.model,
    };
  }

  /**
   * Call Google Gemini (REST API)
   */
  private async callGemini(request: AICompletionRequest): Promise<AICompletionResponse> {
    if (!env.gemini.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const primaryModel = request.model || (request.imageBase64 ? (env.gemini.visionModel || env.gemini.model) : env.gemini.model);
    const GEMINI_FALLBACK_MODELS = [primaryModel, 'gemini-2.5-flash-lite'];
    let geminiModel = primaryModel;
    const timeout = request.timeout || 60000; // Default 60 seconds

    // Try each Gemini model in order (primary → fallback)
    for (let modelIdx = 0; modelIdx < GEMINI_FALLBACK_MODELS.length; modelIdx++) {
      geminiModel = GEMINI_FALLBACK_MODELS[modelIdx];
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${env.gemini.apiKey}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: request.systemPrompt }],
            },
            contents: [
              {
                role: 'user',
                parts: [
                  { text: request.userPrompt },
                  ...(request.imageBase64 ? [{
                    inlineData: {
                      mimeType: request.imageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg',
                      data: request.imageBase64.replace(/^data:image\/[a-z]+;base64,/, ''),
                    },
                  }] : []),
                ],
              },
            ],
            generationConfig: {
              temperature: request.temperature,
              maxOutputTokens: request.maxTokens,
              ...(request.jsonMode ? { responseMimeType: 'application/json' } : {}),
            },
          }),
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          // If 503/429 and we have a fallback model, try it
          if ((response.status === 503 || response.status === 429) && modelIdx < GEMINI_FALLBACK_MODELS.length - 1) {
            logger.warn(`[AIProvider] Gemini ${geminiModel} returned ${response.status}, trying fallback model`, {
              model: geminiModel,
              fallback: GEMINI_FALLBACK_MODELS[modelIdx + 1],
            });
            continue;
          }
          throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json() as GeminiResponse;
        const parts = data.candidates?.[0]?.content?.parts || [];
        const content = parts.map(p => p.text || '').join('');

        if (!content) {
          throw new Error('Empty response from Gemini');
        }

        const finishReason = data.candidates?.[0]?.finishReason;
        if (finishReason === 'MAX_TOKENS') {
          logger.warn(`[AIProvider] Gemini response truncated (MAX_TOKENS)`, { model: geminiModel, maxTokens: request.maxTokens });
          // If truncated and we have a fallback with higher limits, DON'T retry — return what we have
          // The caller should increase maxTokens instead
        }

        logger.info(`[AIProvider] Gemini completed`, { model: geminiModel, jsonMode: !!request.jsonMode, finishReason });

        return { content, provider: 'gemini', model: geminiModel };
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          // Timeout — try fallback model
          if (modelIdx < GEMINI_FALLBACK_MODELS.length - 1) {
            logger.warn(`[AIProvider] Gemini ${geminiModel} timed out, trying fallback model`);
            continue;
          }
          throw new Error('Request timed out.');
        }
        // Non-retryable error or last model — throw
        if (modelIdx >= GEMINI_FALLBACK_MODELS.length - 1) throw error;
        logger.warn(`[AIProvider] Gemini ${geminiModel} failed, trying fallback`, { error: (error as Error).message });
        continue;
      }
    }

    throw new Error('All Gemini models failed');
  }

  /**
   * Check if error is a rate limit error
   */
  private isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('rate limit') ||
        message.includes('429') ||
        message.includes('quota') ||
        message.includes('too many requests') ||
        message.includes('insufficient balance') ||
        message.includes('402')
      );
    }
    return false;
  }

  /**
   * Check if error is a timeout error
   */
  private isTimeoutError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('timeout') ||
        message.includes('timed out') ||
        message.includes('abort')
      );
    }
    return false;
  }
}

export const aiProviderService = new AIProviderService();
