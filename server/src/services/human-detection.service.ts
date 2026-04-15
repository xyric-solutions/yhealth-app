/**
 * Human Detection Service
 * Detects if an image contains a human person before analysis
 * Uses Gemini Vision API (primary), OpenAI Vision as fallback
 */

import OpenAI from 'openai';
import { env } from '../config/env.config.js';
import { logger } from './logger.service.js';

export interface HumanDetectionResult {
  hasHuman: boolean;
  confidence: number;
  reason?: string;
  requiresHuman: boolean; // Whether this image type requires human presence
}

class HumanDetectionService {
  private visionClient: OpenAI | null = null;
  private geminiApiKey: string | null = null;

  constructor() {
    this.initializeClients();
  }

  private initializeClients(): void {
    // Gemini as primary
    if (env.gemini.apiKey) {
      this.geminiApiKey = env.gemini.apiKey;
      logger.info('[HumanDetection] Gemini vision available (primary)');
    }

    // OpenAI as fallback
    if (env.openai.apiKey) {
      try {
        this.visionClient = new OpenAI({
          apiKey: env.openai.apiKey,
          timeout: 30000,
          maxRetries: 1,
        });
        logger.info('[HumanDetection] OpenAI vision client initialized (fallback)');
      } catch (error) {
        logger.warn('[HumanDetection] Failed to initialize OpenAI Vision client', { error });
      }
    }
  }

  /**
   * Call Gemini vision for human detection
   */
  private async callGeminiDetection(base64Image: string, mimeType: string): Promise<string> {
    const model = env.gemini.lightModel || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.geminiApiKey}`;

    const body = {
      contents: [{
        parts: [
          {
            text: `Analyze this image and determine if it contains a human person.
Respond ONLY with JSON: {"hasHuman": true|false, "confidence": 0.0-1.0, "reason": "brief explanation"}

Guidelines:
- A human person means: visible face, body parts (arms, legs, torso), or clearly identifiable human form
- Body parts visible in fitness/progress photos count as human
- Food items, objects, animals, landscapes alone do NOT count as human
- If human is partially visible (e.g., arm holding food), respond hasHuman: true
- Be strict: only respond hasHuman: true if a person is clearly present

Does this image contain a human person? Respond with JSON only.`,
          },
          {
            inlineData: { mimeType, data: base64Image },
          },
        ],
      }],
      generationConfig: {
        maxOutputTokens: 100,
        temperature: 0.1,
      },
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Gemini vision error (${resp.status}): ${errText}`);
    }

    const data = await resp.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  /**
   * Detect if image contains a human person
   */
  async detectHuman(
    imageBuffer: Buffer,
    mimeType: string,
    imageType?: 'body_photo' | 'food_photo' | 'nutrition_label' | 'fitness_progress' | 'xray' | 'medical_report' | 'unknown'
  ): Promise<HumanDetectionResult> {
    const requiresHuman = imageType ? ['body_photo', 'fitness_progress'].includes(imageType) : true;

    // Food photos and nutrition labels don't require human detection
    if (imageType === 'food_photo' || imageType === 'nutrition_label') {
      return { hasHuman: false, confidence: 1.0, requiresHuman: false, reason: 'Food photos and nutrition labels do not require human detection' };
    }

    // Medical images don't require human detection
    if (imageType === 'xray' || imageType === 'medical_report') {
      return { hasHuman: false, confidence: 1.0, requiresHuman: false, reason: 'Medical images do not require human detection' };
    }

    // If no vision API available
    if (!this.geminiApiKey && !this.visionClient) {
      logger.warn('[HumanDetection] No vision API available');
      return {
        hasHuman: false,
        confidence: requiresHuman ? 0 : 0.5,
        requiresHuman,
        reason: requiresHuman ? 'Human detection failed - Vision API unavailable' : 'Human detection skipped - Vision API unavailable',
      };
    }

    try {
      const base64Image = imageBuffer.toString('base64');
      let content = '';

      // Try Gemini first
      if (this.geminiApiKey) {
        try {
          content = await this.callGeminiDetection(base64Image, mimeType);
          logger.debug('[HumanDetection] Gemini detection succeeded');
        } catch (geminiError: any) {
          logger.warn('[HumanDetection] Gemini detection failed', { error: geminiError?.message });
        }
      }

      // Fallback to OpenAI
      if (!content && this.visionClient) {
        try {
          const dataUrl = `data:${mimeType};base64,${base64Image}`;
          const response = await this.visionClient.chat.completions.create({
            model: 'gpt-4o-mini',
            max_tokens: 100,
            messages: [
              {
                role: 'system',
                content: `You are a human detection system for a health app. Analyze the image and determine if it contains a human person.
Respond ONLY with JSON: {"hasHuman": true|false, "confidence": 0.0-1.0, "reason": "brief explanation"}`,
              },
              {
                role: 'user',
                content: [
                  { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
                  { type: 'text', text: 'Does this image contain a human person? Respond with JSON only.' },
                ],
              },
            ],
          });
          content = response.choices[0]?.message?.content || '';
        } catch (openaiError: any) {
          logger.warn('[HumanDetection] OpenAI detection also failed', { error: openaiError?.message });
        }
      }

      if (!content) {
        // Both providers failed
        return {
          hasHuman: false,
          confidence: requiresHuman ? 0 : 0.5,
          requiresHuman,
          reason: 'Human detection failed - all providers unavailable',
        };
      }

      // Parse response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const result = JSON.parse(jsonMatch[0]);
          const hasHuman = Boolean(result.hasHuman);
          const confidence = typeof result.confidence === 'number' ? result.confidence : 0.5;
          return {
            hasHuman,
            confidence: Math.max(0, Math.min(1, confidence)),
            requiresHuman,
            reason: result.reason || (hasHuman ? 'Human detected in image' : 'No human detected in image'),
          };
        } catch (parseError) {
          logger.warn('[HumanDetection] Failed to parse JSON response', { content, error: parseError });
        }
      }

      // Fallback: keyword detection
      const lowerContent = content.toLowerCase();
      const hasHumanKeywords = lowerContent.includes('yes') || lowerContent.includes('true') || lowerContent.includes('human');
      return {
        hasHuman: hasHumanKeywords,
        confidence: 0.6,
        requiresHuman,
        reason: 'Detection completed with lower confidence (parsing failed)',
      };
    } catch (error) {
      logger.error('[HumanDetection] Human detection error', { error });
      return {
        hasHuman: false,
        confidence: requiresHuman ? 0 : 0.5,
        requiresHuman,
        reason: requiresHuman ? 'Human detection failed due to error' : 'Human detection failed - proceeding with caution',
      };
    }
  }

  /**
   * Check if image should be analyzed based on human detection
   */
  shouldAnalyzeImage(detectionResult: HumanDetectionResult): boolean {
    if (!detectionResult.requiresHuman) return true;
    return detectionResult.hasHuman && detectionResult.confidence >= 0.5;
  }
}

export const humanDetectionService = new HumanDetectionService();
export default humanDetectionService;
