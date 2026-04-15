/**
 * @file Model Factory Service
 * @description Centralized LLM model factory with cascading fallback:
 *   Gemini → Anthropic → DeepSeek → OpenAI
 *
 * Three model tiers:
 *   - default: Main chatbot, general tasks
 *   - reasoning: Complex analysis, profile generation
 *   - light: Theme extraction, lesson extraction, voice journal
 */

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatOpenAI } from '@langchain/openai';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { env } from '../config/env.config.js';
import { logger } from './logger.service.js';

// ============================================
// TYPES
// ============================================

export type ModelTier = 'default' | 'reasoning' | 'light';

export interface ModelOptions {
  tier?: ModelTier;
  temperature?: number;
  maxTokens?: number;
  streaming?: boolean;
}

type ProviderName = 'gemini' | 'anthropic' | 'deepseek' | 'openai';

interface ProviderEntry {
  name: ProviderName;
  available: boolean;
}

// ============================================
// MODEL CONFIGS PER PROVIDER + TIER
// ============================================

/**
 * Gemini fallback models: if the primary model 503s or hits MAX_TOKENS,
 * retry with gemini-2.5-flash-lite which is more stable under load.
 */
const GEMINI_FALLBACK_MODELS: Record<ModelTier, string[]> = {
  default: [env.gemini.model, 'gemini-2.5-flash-lite'],
  reasoning: [env.gemini.reasoningModel, 'gemini-2.5-flash-lite'],
  light: [env.gemini.lightModel, 'gemini-2.5-flash-lite'],
};

const MODEL_MAP: Record<ProviderName, Record<ModelTier, string>> = {
  gemini: {
    default: env.gemini.model,
    reasoning: env.gemini.reasoningModel,
    light: env.gemini.lightModel,
  },
  anthropic: {
    default: env.anthropic.model,
    reasoning: env.anthropic.model,
    light: 'claude-haiku-4-5-20251001',
  },
  deepseek: {
    default: env.deepseek.model,
    reasoning: env.deepseek.reasoningModel,
    light: env.deepseek.model,
  },
  openai: {
    default: env.openai.model,
    reasoning: env.openai.model,
    light: env.openai.model,
  },
};

// ============================================
// FACTORY
// ============================================

class ModelFactory {
  private providers: ProviderEntry[];
  private primaryProvider: ProviderName | null = null;

  /** Per-provider rate limit state: provider → blacklisted until (epoch ms) */
  private providerRateLimits: Map<ProviderName, number> = new Map();

  /** Which provider was used for the most recent getModel() call */
  private lastProviderUsed: ProviderName | null = null;

  constructor() {
    this.providers = [
      { name: 'gemini', available: !!env.gemini.apiKey },
      { name: 'anthropic', available: !!env.anthropic.apiKey },
      { name: 'deepseek', available: !!env.deepseek.apiKey },
      { name: 'openai', available: !!env.openai.apiKey },
    ];

    const available = this.providers.filter(p => p.available);
    this.primaryProvider = available.length > 0 ? available[0].name : null;

    if (this.primaryProvider) {
      logger.info(`[ModelFactory] Primary provider: ${this.primaryProvider} | Fallbacks: ${available.slice(1).map(p => p.name).join(', ') || 'none'}`);
    } else {
      logger.warn('[ModelFactory] No LLM providers configured. AI features will be unavailable.');
    }
  }

  /**
   * Get a LangChain chat model with fallback chain.
   * Skips providers that are currently rate-limited, returning the next available one.
   */
  getModel(options: ModelOptions = {}): BaseChatModel {
    const { tier = 'default', temperature = 0.7, maxTokens = 1000, streaming = false } = options;

    for (const provider of this.providers) {
      if (!provider.available) continue;
      if (this.isProviderRateLimited(provider.name)) continue;

      const modelId = MODEL_MAP[provider.name][tier];

      try {
        const model = this.createModel(provider.name, modelId, { temperature, maxTokens, streaming });
        this.lastProviderUsed = provider.name;
        return model;
      } catch (error) {
        logger.warn(`[ModelFactory] Failed to create ${provider.name} model, trying next`, { error });
        continue;
      }
    }

    throw new Error('[ModelFactory] No LLM providers available. Set GEMINI_API_KEY, ANTHROPIC_API_KEY, DEEPSEEK_API_KEY, or OPENAI_API_KEY.');
  }

  /**
   * Mark a provider as rate-limited for the given duration.
   * Subsequent getModel() calls will skip this provider until the cooldown expires.
   */
  markProviderRateLimited(provider: ProviderName, durationMs: number = 5 * 60 * 1000): void {
    this.providerRateLimits.set(provider, Date.now() + durationMs);
    const remaining = this.providers.filter(p => p.available && !this.isProviderRateLimited(p.name));
    logger.warn(`[ModelFactory] Provider ${provider} rate-limited for ${Math.round(durationMs / 1000)}s`, {
      remainingProviders: remaining.map(p => p.name),
    });
  }

  /**
   * Mark the most recently used provider as rate-limited.
   * Convenience method for services that don't track which provider they're using.
   */
  markCurrentProviderRateLimited(durationMs: number = 5 * 60 * 1000): void {
    if (this.lastProviderUsed) {
      this.markProviderRateLimited(this.lastProviderUsed, durationMs);
    }
  }

  /**
   * Clear rate limit for a specific provider (e.g. after a successful probe call).
   */
  clearProviderRateLimit(provider: ProviderName): void {
    if (this.providerRateLimits.has(provider)) {
      this.providerRateLimits.delete(provider);
      logger.info(`[ModelFactory] Rate limit cleared for ${provider}`);
    }
  }

  /**
   * Check if any non-rate-limited provider is available for LLM calls.
   */
  hasAvailableProviders(): boolean {
    return this.providers.some(p => p.available && !this.isProviderRateLimited(p.name));
  }

  /**
   * Get the name of the provider used in the most recent getModel() call.
   */
  getLastProviderUsed(): ProviderName | null {
    return this.lastProviderUsed;
  }

  /**
   * Get the name of the primary (first available) provider.
   */
  getActiveProvider(): string {
    // Return the first non-rate-limited provider (runtime-aware)
    const active = this.providers.find(p => p.available && !this.isProviderRateLimited(p.name));
    return active?.name || this.primaryProvider || 'none';
  }

  /**
   * Check if any provider is available.
   */
  isAvailable(): boolean {
    return this.primaryProvider !== null;
  }

  /**
   * Check if an error is a rate limit / quota exceeded error.
   */
  isRateLimitError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('rate limit') ||
        message.includes('429') ||
        message.includes('quota') ||
        message.includes('too many requests') ||
        message.includes('insufficient balance') ||
        message.includes('exceeded your current quota') ||
        message.includes('402')
      );
    }
    return false;
  }

  /**
   * Check if an error is an authentication / invalid API key error.
   * These should permanently blacklist the provider until restart.
   */
  isAuthError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('401') ||
        message.includes('authentication fail') ||
        message.includes('invalid api key') ||
        message.includes('api key is invalid') ||
        message.includes('incorrect api key') ||
        message.includes('unauthorized') ||
        message.includes('credit balance') ||
        message.includes('billing') ||
        message.includes('purchase credits')
      );
    }
    return false;
  }

  /**
   * Handle a provider error: detect type and apply appropriate rate limiting.
   * Returns true if the error was handled (provider marked), false otherwise.
   */
  handleProviderError(error: unknown): boolean {
    if (!this.lastProviderUsed) return false;

    if (this.isAuthError(error)) {
      // Billing/auth errors: disable for 1 hour (effectively permanent for this session)
      this.markProviderRateLimited(this.lastProviderUsed, 60 * 60 * 1000);
      logger.error(`[ModelFactory] Provider ${this.lastProviderUsed} disabled for 1h (auth/billing error)`, {
        provider: this.lastProviderUsed,
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return true;
    }

    if (this.isRateLimitError(error)) {
      this.markCurrentProviderRateLimited(5 * 60 * 1000);
      return true;
    }

    // Generic provider failure (503, stream parse, etc.)
    if (error instanceof Error) {
      const msg = error.message;
      if (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('Failed to parse stream') || msg.includes('GoogleGenerativeAI')) {
        this.markCurrentProviderRateLimited(5 * 60 * 1000);
        return true;
      }
    }

    return false;
  }

  private isProviderRateLimited(provider: ProviderName): boolean {
    const until = this.providerRateLimits.get(provider);
    if (!until) return false;
    if (Date.now() >= until) {
      this.providerRateLimits.delete(provider);
      logger.info(`[ModelFactory] Rate limit expired for ${provider}, re-enabling`);
      return false;
    }
    return true;
  }

  // ============================================
  // PRIVATE
  // ============================================

  private createModel(
    provider: ProviderName,
    modelId: string,
    opts: { temperature: number; maxTokens: number; streaming: boolean },
  ): BaseChatModel {
    switch (provider) {
      case 'gemini':
        return new ChatGoogleGenerativeAI({
          apiKey: env.gemini.apiKey,
          model: modelId,
          temperature: opts.temperature,
          maxOutputTokens: opts.maxTokens,
          streaming: opts.streaming,
          maxRetries: 1, // Fail fast — circuit breaker handles retries at higher level
        });

      case 'anthropic':
        return new ChatAnthropic({
          anthropicApiKey: env.anthropic.apiKey,
          model: modelId,
          temperature: opts.temperature,
          maxTokens: opts.maxTokens,
          streaming: opts.streaming,
        });

      case 'deepseek':
        return new ChatOpenAI({
          openAIApiKey: env.deepseek.apiKey,
          configuration: { baseURL: `${env.deepseek.baseUrl}/v1` },
          modelName: modelId,
          temperature: opts.temperature,
          maxTokens: opts.maxTokens,
          streaming: opts.streaming,
        });

      case 'openai':
        return new ChatOpenAI({
          openAIApiKey: env.openai.apiKey,
          modelName: modelId,
          temperature: opts.temperature,
          maxTokens: opts.maxTokens,
          streaming: opts.streaming,
        });
    }
  }

  // ============================================
  // LLM INVOCATION WITH AUTOMATIC FALLBACK
  // ============================================

  /**
   * Get a Gemini model at a specific fallback index.
   * Used to try gemini-2.5-flash-lite when gemini-2.5-flash fails with 503 or MAX_TOKENS.
   */
  getGeminiFallbackModel(
    tier: ModelTier,
    fallbackIndex: number,
    opts: { temperature?: number; maxTokens?: number; streaming?: boolean } = {},
  ): BaseChatModel | null {
    const models = GEMINI_FALLBACK_MODELS[tier];
    if (fallbackIndex >= models.length) return null;
    const geminiAvailable = this.providers.find(p => p.name === 'gemini' && p.available);
    if (!geminiAvailable || this.isProviderRateLimited('gemini')) return null;

    const modelId = models[fallbackIndex];
    try {
      const model = this.createModel('gemini', modelId, {
        temperature: opts.temperature ?? 0.7,
        maxTokens: opts.maxTokens ?? 1000,
        streaming: opts.streaming ?? false,
      });
      logger.info(`[ModelFactory] Using Gemini fallback model: ${modelId}`, { tier, fallbackIndex });
      this.lastProviderUsed = 'gemini';
      return model;
    } catch {
      return null;
    }
  }

  /**
   * Invoke an LLM with automatic provider cascading on failure.
   * Strategy:
   *   1. Try current model (e.g. gemini-2.5-flash)
   *   2. If Gemini 503/truncation → try gemini-2.5-flash-lite (same provider, stable model)
   *   3. If still fails → cascade to next provider (anthropic → deepseek → openai)
   *
   * Returns the result AND the (possibly new) LLM instance so callers can update their reference.
   */
  async invokeWithFallback(
    currentLlm: BaseChatModel,
    messages: any[],
    modelOptions: ModelOptions,
    maxRetries = 2,
  ): Promise<{ result: any; llm: BaseChatModel }> {
    let llm = currentLlm;
    const tier = modelOptions.tier || 'default';

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await llm.invoke(messages);
        return { result, llm };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '';
        const is503 = errorMsg.includes('503') || errorMsg.includes('UNAVAILABLE');
        const isGemini = this.lastProviderUsed === 'gemini';

        // Step 2: If Gemini failed with 503, try the stable fallback model first
        if (isGemini && is503 && attempt === 0) {
          const fallbackModel = this.getGeminiFallbackModel(tier, 1, modelOptions);
          if (fallbackModel) {
            logger.info('[ModelFactory] Gemini 503 — retrying with gemini-2.5-flash-lite');
            llm = fallbackModel;
            continue;
          }
        }

        // Step 3: Mark provider and cascade to next
        const handled = this.handleProviderError(error);
        if (handled && attempt < maxRetries) {
          try {
            llm = this.getModel(modelOptions);
            logger.info('[ModelFactory] invokeWithFallback cascading to next provider', {
              attempt: attempt + 1,
              newProvider: this.lastProviderUsed,
            });
            continue;
          } catch {
            throw error;
          }
        }
        throw error;
      }
    }

    throw new Error('[ModelFactory] All LLM providers exhausted after retries');
  }
}

export const modelFactory = new ModelFactory();
export default modelFactory;
