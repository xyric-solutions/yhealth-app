/**
 * AI Coach Service
 * Handles image analysis, goal generation, and AI coaching features
 */

import OpenAI from 'openai';
import crypto from 'crypto';
import path from 'path';
import { env } from '../config/env.config.js';
import { logger } from './logger.service.js';
import { ApiError } from '../utils/ApiError.js';
import { r2Service } from './r2.service.js';
import { humanDetectionService } from './human-detection.service.js';
import { query } from '../database/pg.js';
import { langGraphChatbotService } from './langgraph-chatbot.service.js';

export type HealthImageType = 'body_photo' | 'xray' | 'medical_report' | 'food_photo' | 'nutrition_label' | 'fitness_progress' | 'unknown';
export type GoalCategory = string;
export type ConversationPhase = string;
export type SupportedLanguage = 'en' | 'ur';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ConversationContext {
  messages?: ChatMessage[];
  phase?: ConversationPhase;
  userId?: string;
  goal?: GoalCategory;
  messageCount?: number;
  extractedInsights?: ExtractedInsight[];
  userProfile?: { name: string };
  language?: SupportedLanguage;
  isOnboarding?: boolean;
}

export interface ExtractedInsight {
  category: string;
  text: string;
  confidence: number;
}

export interface ImageValidationResult {
  isValid: boolean;
  imageType: HealthImageType;
  confidence: number;
  reason?: string;
}

export interface ImageAnalysisResult {
  isHealthRelated: boolean;
  imageType: HealthImageType;
  analysis: string;
  insights: ExtractedInsight[];
  recommendations?: string[];
  warnings?: string[];
}

export interface UploadedHealthImage {
  key: string;
  url: string;
  mimeType: string;
  size: number;
  imageType: HealthImageType;
  analysisResult?: ImageAnalysisResult;
}

export interface DietPlanRequest {
  userId: string;
  goal?: GoalCategory;
  goalCategory?: GoalCategory;
  insights?: ExtractedInsight[];
  preferences?: Record<string, unknown>;
}

export interface GeneratedDietPlan {
  plan: unknown;
}

export interface AssessmentResponseInput {
  questionId: string;
  value: string;
}

export interface BodyStatsInput {
  height?: number;
  weight?: number;
  age?: number;
}

export interface GeneratedGoal {
  title: string;
  description: string;
  targetValue?: number;
  targetUnit?: string;
  timeline?: {
    startDate?: string;
    targetDate?: string;
    durationWeeks?: number;
  };
  motivation?: string;
  milestones?: Array<{
    week?: number;
    target?: number;
    description?: string;
  }>;
  // Additional properties that may be added during enrichment
  id?: string;
  category?: string;
  pillar?: string;
  isPrimary?: boolean;
  currentValue?: number;
  confidenceScore?: number;
  aiSuggested?: boolean;
}

export interface GenerateGoalsRequest {
  userId: string;
  goalCategory: GoalCategory;
  assessmentResponses: AssessmentResponseInput[];
  bodyStats?: BodyStatsInput;
  customGoalText?: string;
}

export interface GenerateGoalsResponse {
  goals: GeneratedGoal[];
  reasoning?: string;
}

export type MCQCategory = string;

export interface MCQOption {
  id: string;
  text: string;
  insightValue?: string;
}

export interface MCQQuestion {
  id: string;
  question: string;
  options: MCQOption[];
}

export interface MCQGenerationRequest {
  userId?: string;
  goal: GoalCategory;
  category?: MCQCategory;
  phase?: ConversationPhase;
  previousAnswers?: { questionId: string; questionText?: string; selectedOptions: string[] }[];
  extractedInsights?: ExtractedInsight[];
  language?: SupportedLanguage;
}

export interface MCQGenerationResponse {
  question: MCQQuestion;
  phase: ConversationPhase;
  progress: number;
  isComplete?: boolean;
  insights?: ExtractedInsight[];
}

export interface AICoachResponse {
  message: string;
  phase: ConversationPhase;
  insights: ExtractedInsight[];
  isComplete: boolean;
  suggestedActions?: string[];
}

export interface AICoachSession {
  id: string;
  userId: string;
  goalCategory: GoalCategory;
  sessionType: string;
  messages: ChatMessage[];
  extractedInsights: ExtractedInsight[];
  conversationPhase: ConversationPhase;
  messageCount: number;
  userMessageCount: number;
  isComplete: boolean;
  sessionSummary?: string;
  keyTakeaways?: string[];
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

class AICoachService {
  private visionClient: OpenAI | null = null;
  private geminiApiKey: string | null = null;

  /** Strip markdown code fences from AI responses (```json ... ```) */
  private stripMarkdownFences(text: string): string {
    const trimmed = text.trim();
    if (trimmed.startsWith('```')) {
      return trimmed.replace(/^```(?:json|javascript|ts)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    return trimmed;
  }

  /**
   * Determine if model requires max_completion_tokens instead of max_tokens
   * Models like o1, o1-preview, o1-mini, o3, o3-mini, gpt-4o, gpt-4o-mini, gpt-5-mini require max_completion_tokens
   */
  private requiresMaxCompletionTokens(model: string): boolean {
    const modelLower = model.toLowerCase();
    return (
      modelLower.startsWith('o1') || 
      modelLower.startsWith('o3') ||
      modelLower.startsWith('gpt-4o') ||
      modelLower.startsWith('gpt-5')
    );
  }

  /**
   * Check if model is a reasoning model that uses internal reasoning tokens
   */
  private isReasoningModel(model: string): boolean {
    const modelLower = model.toLowerCase();
    return modelLower.startsWith('o1') || modelLower.startsWith('o3') || modelLower.startsWith('gpt-5');
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

  /**
   * Determine if model supports custom temperature values
   * Models like gpt-4o, gpt-4o-mini, gpt-5-mini only support default temperature (1)
   */
  private supportsCustomTemperature(model: string): boolean {
    const modelLower = model.toLowerCase();
    // Models that only support default temperature
    const restrictedModels = [
      'gpt-4o',
      'gpt-5',
    ];
    return !restrictedModels.some(prefix => modelLower.startsWith(prefix));
  }

  /**
   * Get temperature parameter for the model (only if supported)
   */
  private getTemperatureParameter(model: string, temperature: number): { temperature?: number } {
    if (this.supportsCustomTemperature(model)) {
      return { temperature };
    }
    // Return empty object - model will use default temperature
    return {};
  }

  /**
   * Check if model supports response_format parameter
   * Most models support it, but we can exclude specific ones if needed
   */
  private supportsResponseFormat(_model: string): boolean {
    // Allow response_format for most models including gpt-5-mini
    // If a model doesn't support it, the API will return an error which we'll handle
    return true;
  }

  /**
   * Get response_format parameter for the model (only if supported)
   */
  private getResponseFormatParameter(model: string): { response_format?: { type: 'json_object' } } {
    if (this.supportsResponseFormat(model)) {
      return { response_format: { type: 'json_object' } };
    }
    // Return empty object - will need to parse JSON from text response
    return {};
  }

  constructor() {
    this.initializeVisionClient();
  }

  private initializeVisionClient(): void {
    // Gemini as primary vision provider
    if (env.gemini.apiKey) {
      this.geminiApiKey = env.gemini.apiKey;
      logger.info('[AICoach] Gemini vision available (primary)');
    }

    // OpenAI as fallback vision provider
    if (env.openai.apiKey) {
      try {
        this.visionClient = new OpenAI({
          apiKey: env.openai.apiKey,
          timeout: 30000,
          maxRetries: 0,
        });
        logger.info('[AICoach] OpenAI vision client initialized (fallback)');
      } catch (error) {
        logger.warn('[AICoach] Failed to initialize OpenAI Vision client', { error });
      }
    }
  }

  isAvailable(): boolean {
    return this.geminiApiKey !== null || this.visionClient !== null;
  }

  /**
   * Call Gemini vision API directly via REST
   */
  private async callGeminiVision(
    systemPrompt: string,
    promptText: string,
    imageDataUrl: string,
    maxTokens: number,
    jsonMode: boolean = false,
  ): Promise<string> {
    const VISION_MODELS = [env.gemini.model || 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];

    // Extract base64 and mime from data URL or use as-is for http URLs
    let inlineData: { mimeType: string; data: string } | undefined;

    if (imageDataUrl.startsWith('data:')) {
      const match = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) throw new Error('Invalid data URL format');
      inlineData = { mimeType: match[1], data: match[2] };
    } else {
      // For http URLs, download and convert to base64
      const imgResp = await fetch(imageDataUrl);
      if (!imgResp.ok) throw new Error(`Failed to fetch image: ${imgResp.status}`);
      const buf = Buffer.from(await imgResp.arrayBuffer());
      const contentType = imgResp.headers.get('content-type') || 'image/jpeg';
      inlineData = { mimeType: contentType, data: buf.toString('base64') };
    }

    const body = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{
        parts: [
          { inlineData },
          { text: promptText },
        ],
      }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.4,
        ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
      },
    };

    // Try each Gemini model — fallback on 503/429
    let lastError: Error | null = null;
    for (const model of VISION_MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.geminiApiKey}`;

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        if ((resp.status === 503 || resp.status === 429) && model !== VISION_MODELS[VISION_MODELS.length - 1]) {
          logger.warn(`[AICoach] Gemini vision ${model} returned ${resp.status}, trying fallback`, { model, fallback: VISION_MODELS[VISION_MODELS.indexOf(model) + 1] });
          lastError = new Error(`Gemini vision error (${resp.status}): ${errText}`);
          continue;
        }
        throw new Error(`Gemini vision error (${resp.status}): ${errText}`);
      }

      // Success — proceed with this model's response
      lastError = null;

      const data = await resp.json() as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
          finishReason?: string;
        }>;
        promptFeedback?: { blockReason?: string };
      };

      // Check for safety blocks
      if (data.promptFeedback?.blockReason) {
        logger.warn('[AICoach] Gemini vision blocked by safety filter', { blockReason: data.promptFeedback.blockReason });
        throw new Error(`Gemini vision blocked: ${data.promptFeedback.blockReason}`);
      }

      const candidate = data.candidates?.[0];
      if (candidate?.finishReason === 'SAFETY') {
        logger.warn('[AICoach] Gemini vision response blocked by safety', { finishReason: candidate.finishReason });
        throw new Error('Gemini vision response blocked by safety filter');
      }

      // Try to extract text from all parts
      const text = candidate?.content?.parts?.map(p => p.text || '').join('').trim();
      if (!text) {
        logger.warn('[AICoach] Gemini vision returned empty content', {
          hasCandidates: !!data.candidates?.length,
          finishReason: candidate?.finishReason,
          responseKeys: Object.keys(data),
        });
        throw new Error('Gemini vision returned empty response');
      }
      return text;
    }

    // All Gemini models exhausted
    throw lastError || new Error('All Gemini vision models failed');
  }

  /**
   * Call Gemini text-only completion via REST API
   */
  private async callGeminiText(
    systemPrompt: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    maxTokens?: number,
    temperature = 0.7,
    jsonMode = false,
  ): Promise<string> {
    if (!this.geminiApiKey) throw new Error('Gemini API key not available');
    const model = env.gemini.model || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.geminiApiKey}`;

    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const body = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        ...(maxTokens ? { maxOutputTokens: maxTokens } : {}),
        temperature,
        ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
      },
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Gemini text error (${resp.status}): ${errText}`);
    }

    const data = await resp.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini text returned empty response');
    return text;
  }

  async validateHealthImage(
    buffer: Buffer,
    mimeType: string,
    originalName: string
  ): Promise<ImageValidationResult> {
    // If no vision provider is available, default to accepting all images as valid
    if (!this.geminiApiKey && !this.visionClient) {
      logger.warn('[AICoach] No vision provider available, defaulting to unknown image type');
      return {
        isValid: true,
        imageType: 'unknown',
        confidence: 0.5,
      };
    }

    try {
      const base64Image = buffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64Image}`;

      const classifyPrompt = `Analyze this image and classify it into ONE of these categories:
- "nutrition_label": Photos of product Nutrition Facts panels, ingredient lists, food package labels, or nutrition information tables
- "food_photo": Any food, meal, dish, ingredient, recipe, or nutrition-related image (burgers, salads, fruits, vegetables, cooked meals, raw ingredients, etc.)
- "body_photo": Photos of people's bodies, physique, posture, or fitness progress
- "fitness_progress": Workout equipment, exercise form, fitness tracking screenshots
- "xray": Medical imaging scans (X-rays, CT scans, MRIs, etc.)
- "medical_report": Medical documents, lab results, health reports
- "unknown": If the image doesn't clearly fit any category above

IMPORTANT: If you see a Nutrition Facts panel, ingredient list, or food package label with printed nutrition data, classify it as "nutrition_label". If you see actual food items, ingredients, meals, or dishes, classify it as "food_photo".

Respond with ONLY the category name in lowercase (e.g., "nutrition_label", "food_photo", "body_photo", etc.). No explanations, no JSON, just the category name.`;

      let classificationText = '';

      // Try Gemini first
      if (this.geminiApiKey) {
        try {
          classificationText = await this.callGeminiVision('You classify images into health categories. Respond with ONLY the category name.', classifyPrompt, dataUrl, 100);
        } catch (geminiError: any) {
          logger.warn('[AICoach] Gemini classify failed, trying OpenAI', { error: geminiError?.message });
        }
      }

      // Fallback to OpenAI
      if (!classificationText && this.visionClient) {
        try {
          const model = env.openai.model || 'gpt-4o-mini';
          const response = await this.visionClient.chat.completions.create({
            model,
            ...this.getTokenParameter(model, 200),
            messages: [{ role: 'user', content: [{ type: 'text', text: classifyPrompt }, { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } }] }],
          });
          classificationText = response.choices[0]?.message?.content || '';
        } catch (openaiError: any) {
          logger.warn('[AICoach] OpenAI classify also failed', { error: openaiError?.message });
        }
      }

      const classification = (classificationText || 'unknown').trim().toLowerCase();
      
      // Map classification to HealthImageType
      // Be very lenient with food detection - check for any food-related keywords
      let imageType: HealthImageType = 'unknown';
      let confidence = 0.7;

      // Nutrition label detection - check before food to avoid misclassification
      const labelKeywords = ['nutrition_label', 'nutrition facts', 'label', 'package', 'ingredients list'];
      const isLabel = labelKeywords.some(kw => classification.includes(kw)) || classification === 'nutrition_label';

      // Food detection - check for various food-related terms
      const foodKeywords = ['food', 'meal', 'dish', 'burger', 'pizza', 'salad', 'fruit', 'vegetable',
                            'ingredient', 'recipe', 'cooking', 'nutrition', 'eat', 'dining', 'restaurant',
                            'breakfast', 'lunch', 'dinner', 'snack', 'beverage', 'drink'];
      const isFood = foodKeywords.some(keyword => classification.includes(keyword)) ||
                     classification === 'food_photo' ||
                     classification.startsWith('food');

      if (isLabel) {
        imageType = 'nutrition_label';
        confidence = 0.95;
      } else if (isFood) {
        imageType = 'food_photo';
        confidence = 0.95; // High confidence for food images
      } else if (classification.includes('body') || classification === 'body_photo' || classification.includes('physique')) {
        imageType = 'body_photo';
        confidence = 0.85;
      } else if (classification.includes('fitness') || classification === 'fitness_progress' || classification.includes('workout')) {
        imageType = 'fitness_progress';
        confidence = 0.8;
      } else if (classification.includes('xray') || classification.includes('x-ray') || classification.includes('medical imaging') || classification.includes('scan')) {
        imageType = 'xray';
        confidence = 0.85;
      } else if (classification.includes('medical') && (classification.includes('report') || classification.includes('document') || classification.includes('lab'))) {
        imageType = 'medical_report';
        confidence = 0.85;
      }

      logger.info('[AICoach] Image classified', {
        classification,
        imageType,
        confidence,
        filename: originalName,
      });

      // For food images and other health-related images, always return valid
      // Be especially lenient - if classification suggests food but we got unknown, 
      // still accept it as valid (might be edge case)
      const isValid = imageType !== 'unknown' || 
                      classification !== 'unknown' ||
                      // If we can't classify but it's not clearly non-health, accept it
                      (!classification.includes('not') && !classification.includes('invalid'));

      return {
        isValid,
        imageType,
        confidence,
        reason: isValid ? undefined : 'Image does not appear to be health or nutrition related',
      };
    } catch (error: any) {
      logger.error('[AICoach] Failed to classify image, defaulting to unknown', {
        error: error?.message || 'Unknown error',
        filename: originalName,
      });
      
      // On error, default to accepting the image as valid but unknown type
      // This prevents blocking legitimate food images due to API issues
      return {
        isValid: true,
        imageType: 'unknown',
        confidence: 0.5,
        reason: 'Image classification failed, but accepting image for analysis',
      };
    }
  }

  async uploadHealthImage(
    userId: string,
    buffer: Buffer,
    mimeType: string,
    originalName: string
  ): Promise<UploadedHealthImage> {
    const validation = await this.validateHealthImage(buffer, mimeType, originalName);

    if (!validation.isValid) {
      throw ApiError.badRequest(validation.reason || 'Invalid health image');
    }

    try {
      const uploadResult = await r2Service.upload(buffer, originalName, mimeType, {
        fileType: 'image',
        userId,
        customPath: `ai-coach/health-images/${validation.imageType}`,
        isPublic: false,
      });

      logger.info('[AICoach] Health image uploaded', {
        userId,
        key: uploadResult.key,
        imageType: validation.imageType,
      });

      return {
        key: uploadResult.key,
        url: uploadResult.url,
        mimeType: uploadResult.mimeType,
        size: uploadResult.size,
        imageType: validation.imageType,
      };
    } catch (uploadError: any) {
      // Handle timeout and other upload errors gracefully
      const isTimeout = uploadError?.code === 'ETIMEDOUT' || 
                       uploadError?.name === 'TimeoutError' ||
                       uploadError?.message?.includes('timeout') ||
                       uploadError?.message?.includes('ETIMEDOUT');

      if (isTimeout) {
        logger.warn('[AICoach] R2 upload timed out, proceeding with analysis using buffer directly', {
          userId,
          imageType: validation.imageType,
          error: uploadError?.message || 'Upload timeout',
        });
      } else {
        logger.warn('[AICoach] R2 upload failed, proceeding with analysis using buffer directly', {
          userId,
          imageType: validation.imageType,
          error: uploadError?.message || 'Upload failed',
        });
      }

      // Return a placeholder result - analysis will use buffer directly
      // Generate a temporary key for reference (won't be used for actual storage)
      const tempKey = `temp/${userId}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(originalName)}`;
      
      return {
        key: tempKey,
        url: '', // Empty URL - will use buffer directly
        mimeType,
        size: buffer.length,
        imageType: validation.imageType,
      };
    }
  }

  async analyzeHealthImage(
    imageUrlOrBuffer: string | Buffer,
    imageType: HealthImageType,
    userContext?: { goal?: GoalCategory; question?: string },
    mimeType?: string
  ): Promise<ImageAnalysisResult> {
    if (!this.geminiApiKey && !this.visionClient) {
      logger.error('[AICoach] No vision provider available', { imageType });
      throw ApiError.internal('Vision API not available. Please check API configuration.');
    }

    logger.info('[AICoach] Starting image analysis', {
      imageType,
      hasQuestion: !!userContext?.question,
      provider: this.geminiApiKey ? 'gemini' : 'openai',
    });

    let imageContent: { type: 'image_url'; image_url: { url: string; detail: 'auto' | 'low' | 'high' } };
    if (Buffer.isBuffer(imageUrlOrBuffer)) {
      if (!mimeType) {
        throw ApiError.badRequest('MIME type required when providing image buffer');
      }
      const base64Image = imageUrlOrBuffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64Image}`;
      imageContent = {
        type: 'image_url',
        image_url: { url: dataUrl, detail: 'auto' },
      };
    } else {
      imageContent = {
        type: 'image_url',
        image_url: { url: imageUrlOrBuffer, detail: 'auto' },
      };
    }

    const analysisPrompts: Record<HealthImageType, string> = {
      body_photo: `Analyze this body/physique/face photo for a comprehensive health, fitness, wellness, and nutrition coaching app. **FOCUS PRIMARILY ON THE PERSON IN THE IMAGE** - analyze their body, face, posture, and physical appearance in detail. Provide a detailed analysis including mood, fitness level, wellness indicators, body composition, and personalized recommendations.`,
      food_photo: `You are an expert nutritionist analyzing a food photo. Identify the COMPLETE DISH first, then break down components.

CRITICAL: Identify the DISH NAME first (e.g., "Chicken Biryani", "Pad Thai", "Caesar Salad", "Butter Chicken with Naan").
Do NOT just list raw ingredients — name the actual prepared dish as a whole.
For composite/mixed dishes (biryani, curry, stir-fry, pasta, bowl, wrap, sandwich), list the FULL DISH as the primary item with TOTAL macros for the entire dish.
If there are separate side items (bread, drink, salad on the side), list those as additional items.

Respond with ONLY valid JSON — no text before or after:

{
  "analysis": "**Foods Identified:**\\n1. Chicken Biryani (1 plate, ~450g) - ~650 kcal\\n2. Raita (1 bowl, ~100g) - ~60 kcal\\n\\n**Estimated Calories:** 710 kcal\\n\\n**Macronutrients:**\\nProtein: 38g | Carbs: 78g | Fat: 24g | Fiber: 4g\\n\\n**Recommendations:**\\n1. Good protein from chicken\\n2. Watch portion size of rice",
  "items": [
    {"name": "Chicken Biryani", "portion": "1 plate (~450g)", "calories": 650, "protein": 35, "carbs": 72, "fat": 22},
    {"name": "Raita", "portion": "1 small bowl (~100g)", "calories": 60, "protein": 3, "carbs": 6, "fat": 2}
  ],
  "totalCalories": 710,
  "totalProtein": 38,
  "totalCarbs": 78,
  "totalFat": 24,
  "insights": [{"category": "wellness", "text": "Balanced meal with good protein", "confidence": 0.9}],
  "recommendations": ["Good protein source", "Consider adding vegetables"],
  "warnings": []
}

ABSOLUTE RULES — DO NOT VIOLATE:
1. EVERY item in "items" MUST have ALL 6 fields: name, portion, calories, protein, carbs, fat
2. calories/protein/carbs/fat MUST be realistic NON-ZERO numbers estimated from USDA/standard nutrition databases
3. NEVER return 0 for calories, protein, carbs, or fat — every food has macros
4. Name the ACTUAL DISH (e.g., "Chicken Biryani" NOT "Chicken Drumsticks" + "Rice" separately; "Spaghetti Bolognese" NOT "Pasta" + "Meat Sauce")
5. For mixed dishes, include ALL components (rice, meat, spices, oil, vegetables) in the dish's total macros
6. Only list SEPARATE items if they are visually distinct dishes on the plate (e.g., a side salad, separate bread, a drink)
7. Be specific with regional cuisine names (e.g., "Chicken Tikka Masala", "Pad Thai", "Jollof Rice", "Chicken Biryani" — not generic "rice with chicken")
8. Estimate realistic portions (e.g., "1 plate (~450g)", "1 bowl (~300g)", "2 pieces (~200g)")
9. totalCalories/totalProtein/totalCarbs/totalFat MUST equal the sum of all items
10. The "analysis" field uses **bold** markdown headers as shown`,
      nutrition_label: `You are a nutrition label OCR specialist. Extract ALL nutrition data from this product label image.

CRITICAL: Respond with ONLY a valid JSON object. No text before or after.

{
  "productName": "Product name if visible",
  "servingSize": "e.g. 3 pieces (25g)",
  "servingsPerContainer": 8,
  "nutrients": {
    "calories": 60,
    "totalFat": 2.5,
    "saturatedFat": 1,
    "transFat": 0,
    "cholesterol": 0,
    "sodium": 60,
    "totalCarbs": 9,
    "dietaryFiber": 0,
    "totalSugars": 5,
    "protein": 1
  },
  "unitNote": "All values per serving unless noted"
}

IMPORTANT:
- Extract EXACT numbers from the label, do not estimate
- All nutrient values should be numeric (grams for macros, mg for sodium/cholesterol, kcal for calories)
- If a value is not visible or not listed, use null
- Include the serving size exactly as printed on the label
- If multiple columns exist (e.g. "per serving" vs "per 100g"), use the "per serving" column
- Read carefully — do not confuse similar-looking numbers`,
      fitness_progress: `Analyze this fitness progress photo. Focus on the person's fitness level, body composition, and progress indicators.`,
      xray: `This appears to be a medical imaging scan. Acknowledge you see the image, strongly recommend consulting with a qualified radiologist/doctor, and provide general wellness tips.`,
      medical_report: `This appears to be a medical document/report. Acknowledge the document, note that you cannot provide medical interpretation, and suggest discussing results with their healthcare provider.`,
      unknown: `Analyze this health-related image. If this appears to be food or a meal, identify the COMPLETE DISH NAME first (e.g., "Chicken Biryani" not just "chicken" or "rice"), then respond with JSON containing an "items" array where EACH item has name, portion, calories (number), protein (number), carbs (number), fat (number) — ALL must be realistic non-zero values from standard nutrition databases. For mixed/composite dishes, list the whole dish as one item with combined macros. Include totalCalories, totalProtein, totalCarbs, totalFat as sums. Include an "analysis" field with markdown text. If it's not food, provide relevant health observations.`,
    };

    try {
      let response;

      // Check if this is a nutrition label scan request
      const isNutritionLabelScan = imageType === 'nutrition_label' ||
        (userContext?.question &&
         (userContext.question.toLowerCase().includes('nutrition label') ||
          userContext.question.toLowerCase().includes('scan label') ||
          userContext.question.toLowerCase().includes('scan nutrition')));

      // Check if this is a recipe generation request (custom prompt for food photos)
      const isRecipeGeneration = !isNutritionLabelScan && imageType === 'food_photo' &&
        userContext?.question &&
        (userContext.question.toLowerCase().includes('recipe') ||
         userContext.question.toLowerCase().includes('ingredient') ||
         userContext.question.toLowerCase().includes('instruction'));

      // Determine the prompt to use
      let promptText: string;
      let systemPrompt: string;
      let maxTokens: number;

      if (isNutritionLabelScan) {
        // Use nutrition label OCR prompt with high detail for accuracy
        systemPrompt = 'You are a nutrition label OCR specialist. Extract exact nutrition data from product labels with high precision.';
        maxTokens = 1000;
        promptText = analysisPrompts['nutrition_label'];
        // Override image detail to 'high' for better OCR accuracy
        imageContent.image_url.detail = 'high';
      } else if (isRecipeGeneration && userContext?.question) {
        systemPrompt = 'You are an expert chef. Identify the dish in the image and generate a complete recipe as a JSON object. Respond with ONLY valid JSON — no markdown fences, no extra text.';
        maxTokens = 4096;

        promptText = `Identify this dish and generate a recipe. Return ONLY valid JSON:
{"name":"...","description":"...","category":"breakfast|lunch|dinner|snack|dessert","cuisine":"...","servings":4,"difficulty":"easy|medium|hard","ingredients":[{"quantity":"2","unit":"cups","name":"rice"}],"instructions":[{"step":1,"description":"..."}],"nutrition":{"calories":450,"protein":35,"carbs":25,"fat":18,"fiber":4},"time":{"prep":15,"cook":30},"tags":["..."],"dietaryFlags":["..."]}

Rules: identify all visible ingredients, provide realistic nutrition, write clear step-by-step instructions, estimate accurate times. ONLY JSON output.`;
      } else if (userContext?.question && userContext.question.length > 50) {
        // Use custom question as prompt if substantial
        systemPrompt = 'You are an expert AI health, fitness, wellness, and nutrition coach providing comprehensive image analysis.';
        maxTokens = 2000;
        promptText = `${userContext.question}

Provide your response in valid JSON format:
{
  "analysis": "Your detailed analysis based on the question",
  "insights": [{"category": "nutrition|fitness|wellness", "text": "insight", "confidence": 0.8}],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "warnings": []
}`;
      } else {
        // Use default prompts
        systemPrompt = 'You are an expert AI health, fitness, wellness, and nutrition coach providing comprehensive image analysis.';
        maxTokens = 1500;
        promptText = `${analysisPrompts[imageType]}

CRITICAL INSTRUCTIONS:
1. You MUST respond with valid JSON only - no additional text before or after the JSON
2. The "analysis" field MUST include markdown headers (##) for each section as specified in the prompt above
3. Be DETAILED and SPECIFIC in your analysis - avoid generic statements
4. Format your response EXACTLY as:
{
  "analysis": "Your comprehensive analysis with ## markdown headers for each section as specified",
  "insights": [
    {"category": "mood|fitness|wellness|posture", "text": "specific detailed insight", "confidence": 0.8}
  ],
  "recommendations": ["specific actionable tip 1", "specific actionable tip 2"],
  "warnings": []
}

IMPORTANT: The analysis text MUST follow the exact structure with ## headers as specified in the prompt. Do not use **bold** for section headers - use ## markdown headers.`;
      }

      logger.info('[AICoach] Using prompt configuration', {
        imageType,
        isRecipeGeneration,
        hasCustomQuestion: !!userContext?.question,
        maxTokens,
        promptLength: promptText.length,
      });

      // Get the image data URL for Gemini
      const imageDataUrl = imageContent.image_url.url;
      let content = '';

      // Try Gemini first (primary), then OpenAI (fallback)
      if (this.geminiApiKey) {
        try {
          logger.info('[AICoach] Trying Gemini vision (primary)', { imageType });
          content = await this.callGeminiVision(systemPrompt, promptText, imageDataUrl, maxTokens, !!isRecipeGeneration);
          logger.info('[AICoach] Gemini vision succeeded', { imageType, contentLength: content.length, jsonMode: isRecipeGeneration });
        } catch (geminiError: any) {
          logger.warn('[AICoach] Gemini vision failed, trying OpenAI fallback', {
            imageType,
            error: geminiError?.message,
          });
        }
      }

      // Fallback to OpenAI if Gemini failed or unavailable
      if (!content && this.visionClient) {
        try {
          const openaiModel = env.openai.model || 'gpt-4o-mini';
          response = await this.visionClient.chat.completions.create({
            model: openaiModel,
            ...this.getTokenParameter(openaiModel, maxTokens),
            messages: [
              {
                role: 'system',
                content: systemPrompt,
              },
              {
                role: 'user',
                content: [
                  imageContent,
                  {
                    type: 'text',
                    text: promptText,
                  },
                ],
              },
            ],
          });
          content = response?.choices?.[0]?.message?.content || '';
        } catch (apiError: any) {
          logger.error('[AICoach] OpenAI Vision API also failed', {
            imageType,
            error: apiError?.message || 'Unknown error',
            status: apiError?.status,
          });

          if (apiError?.status === 429 || apiError?.message?.includes('quota') || apiError?.message?.includes('billing')) {
            throw ApiError.internal('Image analysis service is temporarily rate-limited. Please try again in a few moments.');
          } else if (apiError?.status === 400) {
            throw ApiError.badRequest('Invalid image format or size. Please ensure the image is a valid JPEG, PNG, WebP, or HEIC file under 10MB.');
          } else {
            throw ApiError.internal(`Image analysis failed: ${apiError?.message || 'Unknown error'}. Please try again.`);
          }
        }
      }

      if (!content || content.trim().length === 0) {
        logger.error('[AICoach] All vision providers returned empty content', { imageType });
        throw ApiError.internal('Image analysis service returned no content. Please try again.');
      }

      logger.debug('[AICoach] Received analysis response', {
        imageType,
        contentLength: content.length,
        hasJson: content.includes('{'),
      });

      const cleanContent = this.stripMarkdownFences(content);
      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        let result;
        try {
          result = JSON.parse(jsonMatch[0]);
          logger.debug('[AICoach] Successfully parsed JSON response', {
            imageType,
            hasAnalysis: !!result.analysis,
            hasInsights: !!result.insights,
            isRecipeData: !!(result.name || result.ingredients),
          });
        } catch (parseError) {
          // Attempt to repair truncated JSON before giving up
          logger.warn('[AICoach] JSON parse failed, attempting repair', {
            imageType,
            error: parseError instanceof Error ? parseError.message : 'Unknown',
          });

          try {
            let repaired = jsonMatch[0];
            // Remove trailing incomplete key-value (e.g. `"name": "salt (divided`)
            repaired = repaired.replace(/,\s*"[^"]*":\s*"[^"]*$/, '');
            repaired = repaired.replace(/,\s*"[^"]*":\s*$/, '');
            repaired = repaired.replace(/,\s*$/, '');
            // Close unclosed strings
            const quotes = (repaired.match(/"/g) || []).length;
            if (quotes % 2 !== 0) repaired += '"';
            // Close unclosed brackets/braces
            const openBraces = (repaired.match(/\{/g) || []).length;
            const closeBraces = (repaired.match(/\}/g) || []).length;
            const openBrackets = (repaired.match(/\[/g) || []).length;
            const closeBrackets = (repaired.match(/\]/g) || []).length;
            for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += ']';
            for (let i = 0; i < openBraces - closeBraces; i++) repaired += '}';
            result = JSON.parse(repaired);
            logger.info('[AICoach] Successfully repaired truncated JSON', { imageType });
            if (!result.warnings) result.warnings = [];
            result.warnings.push('Some data may be incomplete due to response length limits.');
          } catch {
            logger.error('[AICoach] JSON repair also failed', {
              imageType,
              contentPreview: content.substring(0, 300),
            });
            const fallbackAnalysis = content.substring(0, 2000);
            return {
              isHealthRelated: true,
              imageType,
              analysis: fallbackAnalysis || 'Analysis completed, but response format was unexpected.',
              insights: [],
              recommendations: [],
              warnings: ['Response parsing failed. Analysis may be incomplete.'],
            };
          }
        }

        // Check if this is nutrition label data (has nutrients object at root level)
        const isNutritionLabelData = !!(result.nutrients && (result.nutrients.calories !== undefined || result.nutrients.protein !== undefined));

        if (isNutritionLabelData) {
          logger.info('[AICoach] Detected nutrition label data in response', {
            imageType,
            productName: result.productName,
            hasCalories: result.nutrients?.calories !== undefined,
          });

          return {
            isHealthRelated: true,
            imageType: 'nutrition_label' as HealthImageType,
            analysis: JSON.stringify(result),
            insights: [],
            recommendations: [],
            warnings: [],
          };
        }

        // Check if this is recipe data (has name/ingredients/instructions at root level)
        // Recipe responses don't have an 'analysis' field - they have recipe fields directly
        const isRecipeData = !!(result.name || result.ingredients || result.instructions);

        if (isRecipeData) {
          // For recipe data, return the full JSON as a string so the client can parse it
          logger.info('[AICoach] Detected recipe data in response, returning as JSON string', {
            imageType,
            hasName: !!result.name,
            ingredientCount: result.ingredients?.length || 0,
            instructionCount: result.instructions?.length || 0,
          });

          return {
            isHealthRelated: true,
            imageType,
            analysis: JSON.stringify(result), // Return stringified JSON for client to parse
            insights: [],
            recommendations: [],
            warnings: [],
          };
        }

        // For food analysis with items array, include the full JSON so client can parse items
        if (result.items && Array.isArray(result.items) && result.items.length > 0) {
          logger.info('[AICoach] Food analysis with items array', {
            imageType,
            itemCount: result.items.length,
            totalCalories: result.totalCalories,
          });
          return {
            isHealthRelated: true,
            imageType: imageType === 'unknown' ? 'food_photo' as HealthImageType : imageType,
            analysis: JSON.stringify(result), // Return full JSON so client can extract items + analysis text
            insights: result.insights || [],
            recommendations: result.recommendations || [],
            warnings: result.warnings || [],
          };
        }

        return {
          isHealthRelated: true,
          imageType,
          analysis: result.analysis || 'Image analyzed successfully',
          insights: result.insights || [],
          recommendations: result.recommendations || [],
          warnings: result.warnings || [],
        };
      }

      return {
        isHealthRelated: true,
        imageType,
        analysis: content.substring(0, 2000),
        insights: [],
        recommendations: [],
        warnings: ['This is AI-generated analysis. Consult professionals for medical concerns.'],
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('[AICoach] Image analysis error', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        imageType,
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw ApiError.internal('Failed to analyze image. Please try again.');
    }
  }

  private formatImageAnalysisResponse(analysis: ImageAnalysisResult, question?: string): string {
    let response = analysis.analysis;

    if (question && question.trim()) {
      response = `**Regarding your question: "${question}"**\n\n${response}`;
    }

    if (analysis.recommendations?.length) {
      response += '\n\n**Suggestions:**\n' + analysis.recommendations.map(r => `â€¢ ${r}`).join('\n');
    }

    if (analysis.warnings?.length) {
      response += '\n\nâš ï¸ ' + analysis.warnings.join(' ');
    }

    return response;
  }

  async processImageMessage(
    userId: string,
    imageBuffer: Buffer,
    mimeType: string,
    originalName: string,
    userQuestion?: string,
    goal?: GoalCategory
  ): Promise<{ image: UploadedHealthImage; analysis: ImageAnalysisResult; response: string }> {
    const uploadedImage = await this.uploadHealthImage(userId, imageBuffer, mimeType, originalName);

    const humanDetection = await humanDetectionService.detectHuman(
      imageBuffer,
      mimeType,
      uploadedImage.imageType
    );

    if (!humanDetectionService.shouldAnalyzeImage(humanDetection)) {
      throw ApiError.badRequest(
        humanDetection.reason || 'Image does not contain a human person. Please upload a photo of yourself for body/fitness analysis, or a food photo for nutrition analysis.'
      );
    }

    // Use buffer directly if upload failed (empty URL), otherwise use uploaded URL
    const imageSource = uploadedImage.url ? uploadedImage.url : imageBuffer;
    const analysisMimeType = uploadedImage.url ? undefined : mimeType;
    
    const analysis = await this.analyzeHealthImage(
      imageSource, 
      uploadedImage.imageType, 
      {
        goal,
        question: userQuestion,
      },
      analysisMimeType
    );

    const response = this.formatImageAnalysisResponse(analysis, userQuestion);

    const personImageTypes = ['body_photo', 'fitness_progress'];
    if (personImageTypes.includes(uploadedImage.imageType) && analysis.analysis) {
      logger.info('[AICoach] Starting wellbeing extraction from image analysis', {
        userId,
        imageType: uploadedImage.imageType,
        hasAnalysis: !!analysis.analysis,
        analysisLength: analysis.analysis?.length || 0,
      });

      (async () => {
        try {
          const { wellbeingAutoTrackerService } = await import('./wellbeing-auto-tracker.service.js');
          const wellbeingData = await wellbeingAutoTrackerService.extractWellbeingFromImageAnalysis(
            userId,
            analysis.analysis,
            uploadedImage.imageType
          );

          if (wellbeingData.entries.length > 0) {
            await wellbeingAutoTrackerService.autoCreateEntries(userId, wellbeingData.entries);
            logger.info('[AICoach] Extracted and stored wellbeing data from image analysis', {
              userId,
              entriesCreated: wellbeingData.entries.length,
              types: wellbeingData.entries.map(e => e.type),
            });
          }
        } catch (error) {
          logger.error('[AICoach] Failed to extract wellbeing data from image analysis', {
            userId,
            imageType: uploadedImage.imageType,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
          });
        }
      })();
    }

    return {
      image: { ...uploadedImage, analysisResult: analysis },
      analysis,
      response,
    };
  }

  /**
   * Get previous sessions for a user
   */
  async getPreviousSessions(userId: string, limit: number = 20): Promise<AICoachSession[]> {
    try {
      const result = await query<{
        id: string;
        user_id: string;
        goal_category: string;
        session_type: string;
        messages: ChatMessage[];
        extracted_insights: ExtractedInsight[];
        conversation_phase: string;
        message_count: number;
        user_message_count: number;
        is_complete: boolean;
        session_summary: string | null;
        key_takeaways: string[] | null;
        completed_at: Date | null;
        created_at: Date;
        updated_at: Date;
      }>(
        `SELECT * FROM ai_coach_sessions
         WHERE user_id = $1 AND status != 'active'
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit]
      );

      return result.rows.map(row => this.mapSessionRow(row));
    } catch (error) {
      logger.error('[AICoach] Error getting previous sessions', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw ApiError.internal('Failed to retrieve chat history');
    }
  }

  /**
   * Get active session for a user
   */
  async getActiveSession(userId: string, goal?: GoalCategory, sessionType?: string): Promise<AICoachSession | null> {
    let result: { rows: Array<{
      id: string;
      user_id: string;
      goal_category: string;
      session_type: string;
      messages: ChatMessage[] | unknown;
      extracted_insights: ExtractedInsight[] | unknown;
      conversation_phase: string;
      message_count: number;
      user_message_count: number;
      is_complete: boolean;
      session_summary: string | null;
      key_takeaways: string[] | null;
      completed_at: Date | null;
      created_at: Date | null;
      updated_at: Date | null;
    }> } | null = null;

    try {
      let queryText = `SELECT * FROM ai_coach_sessions 
                       WHERE user_id = $1 AND status = 'active'`;
      const params: (string | number | boolean | null | Date | object)[] = [userId];
      
      if (goal) {
        queryText += ` AND goal_category = $${params.length + 1}`;
        params.push(goal);
      }

      if (sessionType) {
        queryText += ` AND session_type = $${params.length + 1}`;
        params.push(sessionType);
      }

      queryText += ` ORDER BY created_at DESC LIMIT 1`;

      result = await query<{
        id: string;
        user_id: string;
        goal_category: string;
        session_type: string;
        messages: ChatMessage[] | unknown;
        extracted_insights: ExtractedInsight[] | unknown;
        conversation_phase: string;
        message_count: number;
        user_message_count: number;
        is_complete: boolean;
        session_summary: string | null;
        key_takeaways: string[] | null;
        completed_at: Date | null;
        created_at: Date | null;
        updated_at: Date | null;
      }>(queryText, params);

      if (result.rows.length === 0) {
        return null;
      }

      const session = this.mapSessionRow(result.rows[0]);
      return session;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      
      logger.error('[AICoach] Error getting active session', {
        userId,
        goal,
        error: errorMessage,
        errorName,
        stack: errorStack,
        // Include more context for debugging
        hasResult: result?.rows ? result.rows.length > 0 : false,
        resultRowCount: result?.rows ? result.rows.length : 0,
      });
      
      // Provide more specific error messages based on error type
      if (errorMessage.includes('JSON') || errorMessage.includes('parse')) {
        throw ApiError.internal('Failed to parse session data. The session may be corrupted.');
      } else if (errorMessage.includes('toISOString') || errorMessage.includes('Invalid Date')) {
        throw ApiError.internal('Failed to process session dates. The session may have invalid date data.');
      } else if (errorMessage.includes('connection') || errorMessage.includes('timeout')) {
        throw ApiError.internal('Database connection error. Please try again.');
      }
      
      throw ApiError.internal('Failed to retrieve active session');
    }
  }

  /**
   * Map database row to AICoachSession
   */
  private mapSessionRow(row: {
    id: string;
    user_id: string;
    goal_category: string;
    session_type: string;
    messages: ChatMessage[] | unknown;
    extracted_insights: ExtractedInsight[] | unknown;
    conversation_phase: string;
    message_count: number;
    user_message_count: number;
    is_complete: boolean;
    session_summary: string | null;
    key_takeaways: string[] | null;
    completed_at: Date | null;
    created_at: Date | null;
    updated_at: Date | null;
  }): AICoachSession {
    // Safely parse JSONB fields with error handling
    let messages: ChatMessage[] = [];
    try {
      if (Array.isArray(row.messages)) {
        messages = row.messages as ChatMessage[];
      } else if (typeof row.messages === 'string' && row.messages.trim()) {
        messages = JSON.parse(row.messages) as ChatMessage[];
        if (!Array.isArray(messages)) {
          logger.warn('[AICoach] messages is not an array after parsing', { 
            sessionId: row.id,
            messagesType: typeof messages,
          });
          messages = [];
        }
      }
    } catch (error) {
      logger.error('[AICoach] Failed to parse messages JSON', {
        sessionId: row.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        messagesValue: typeof row.messages === 'string' ? row.messages.substring(0, 100) : row.messages,
      });
      messages = [];
    }
    
    let extractedInsights: ExtractedInsight[] = [];
    try {
      if (Array.isArray(row.extracted_insights)) {
        extractedInsights = row.extracted_insights as ExtractedInsight[];
      } else if (typeof row.extracted_insights === 'string' && row.extracted_insights.trim()) {
        extractedInsights = JSON.parse(row.extracted_insights) as ExtractedInsight[];
        if (!Array.isArray(extractedInsights)) {
          logger.warn('[AICoach] extracted_insights is not an array after parsing', { 
            sessionId: row.id,
            extractedInsightsType: typeof extractedInsights,
          });
          extractedInsights = [];
        }
      }
    } catch (error) {
      const insightsValue = typeof row.extracted_insights === 'string' 
        ? row.extracted_insights.substring(0, 100) 
        : String(row.extracted_insights).substring(0, 100);
      logger.error('[AICoach] Failed to parse extracted_insights JSON', {
        sessionId: row.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        extractedInsightsValue: insightsValue,
      });
      extractedInsights = [];
    }

    let keyTakeaways: string[] | null = null;
    const keyTakeawaysRaw: string | string[] | null = row.key_takeaways as string | string[] | null; // Store raw value for error logging
    try {
      if (Array.isArray(keyTakeawaysRaw)) {
        keyTakeaways = keyTakeawaysRaw;
      } else if (keyTakeawaysRaw !== null && typeof keyTakeawaysRaw === 'string') {
        const trimmed = keyTakeawaysRaw.trim();
        if (trimmed) {
          const parsed = JSON.parse(trimmed);
          keyTakeaways = Array.isArray(parsed) ? parsed : null;
          if (keyTakeaways && !keyTakeaways.every(item => typeof item === 'string')) {
            logger.warn('[AICoach] key_takeaways contains non-string items', { 
              sessionId: row.id,
            });
            keyTakeaways = null;
          }
        }
      }
    } catch (error) {
      const takeawaysValue = keyTakeawaysRaw !== null && typeof keyTakeawaysRaw === 'string'
        ? keyTakeawaysRaw.substring(0, 100)
        : keyTakeawaysRaw !== null && keyTakeawaysRaw !== undefined
          ? String(keyTakeawaysRaw).substring(0, 100)
          : 'null';
      logger.error('[AICoach] Failed to parse key_takeaways JSON', {
        sessionId: row.id,
        error: error instanceof Error ? error.message : 'Unknown error',
        keyTakeawaysValue: takeawaysValue,
      });
      keyTakeaways = null;
    }

    // Safely handle date fields with null checks
    const createdAt = row.created_at instanceof Date 
      ? row.created_at.toISOString()
      : (row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString());
    
    const updatedAt = row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : (row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString());

    const completedAt = row.completed_at instanceof Date
      ? row.completed_at.toISOString()
      : (row.completed_at ? new Date(row.completed_at).toISOString() : undefined);

    return {
      id: row.id,
      userId: row.user_id,
      goalCategory: row.goal_category,
      sessionType: row.session_type,
      messages,
      extractedInsights,
      conversationPhase: row.conversation_phase,
      messageCount: row.message_count,
      userMessageCount: row.user_message_count ?? 0,
      isComplete: row.is_complete,
      sessionSummary: row.session_summary || undefined,
      keyTakeaways: keyTakeaways || undefined,
      completedAt,
      createdAt,
      updatedAt,
    };
  }

  /**
   * Generate personalized SMART goals based on assessment
   */
  async generateGoals(request: GenerateGoalsRequest): Promise<GenerateGoalsResponse> {
    if (!this.visionClient) {
      logger.error('[AICoach] Vision client not initialized for goal generation');
      throw ApiError.internal('AI Coach is not available. Please check OpenAI API configuration.');
    }

    try {
      const { userId, goalCategory, assessmentResponses, bodyStats, customGoalText } = request;

      logger.info('[AICoach] Generating goals', {
        userId,
        goalCategory,
        responsesCount: assessmentResponses.length,
        hasBodyStats: !!bodyStats,
        hasCustomText: !!customGoalText,
      });

      // Build context from assessment responses
      const assessmentContext = assessmentResponses.length > 0
        ? `Assessment Responses:\n${assessmentResponses.map(r => `- ${r.questionId}: ${r.value}`).join('\n')}`
        : 'No assessment responses provided.';

      // Build body stats context
      const bodyStatsContext = bodyStats
        ? `Body Statistics:\n${bodyStats.height ? `- Height: ${bodyStats.height}cm\n` : ''}${bodyStats.weight ? `- Weight: ${bodyStats.weight}kg\n` : ''}${bodyStats.age ? `- Age: ${bodyStats.age} years\n` : ''}`
        : 'No body statistics provided.';

      // Build the prompt
      const goalCategoryNames: Record<string, string> = {
        weight_loss: 'Weight Loss',
        muscle_building: 'Build Muscle',
        sleep_improvement: 'Better Sleep',
        stress_wellness: 'Stress Management',
        energy_productivity: 'More Energy',
        event_training: 'Event Training',
        health_condition: 'Health Condition',
        habit_building: 'Build Habits',
        overall_optimization: 'Overall Optimization',
        custom: 'Custom Goal',
      };

      const categoryName = goalCategoryNames[goalCategory] || goalCategory;
      const customGoalPrompt = customGoalText ? `\n\nCustom Goal Description: ${customGoalText}` : '';

      const prompt = `You are an expert health and wellness coach. Generate personalized SMART (Specific, Measurable, Achievable, Relevant, Time-bound) goals for a user.

Goal Category: ${categoryName}
${customGoalPrompt}

${assessmentContext}

${bodyStatsContext}

Generate 1-3 SMART goals that are:
1. Specific and clear
2. Measurable with concrete metrics
3. Achievable and realistic
4. Relevant to the user's goal category
5. Time-bound with clear deadlines

Respond with ONLY a valid JSON object. Each goal should have:
- "title": A clear, specific goal title (e.g., "Lose 10 pounds in 3 months")
- "description": A concise description (2-3 sentences max) explaining the goal and how to achieve it
- "targetValue": A numeric target value (e.g., 10 for "lose 10 pounds")
- "targetUnit": The unit of measurement (e.g., "pounds", "hours", "days per week")
- "timeline": An object with "durationWeeks" (number of weeks to achieve the goal, typically 4-16 weeks)
- "motivation": A brief motivational statement explaining why this goal matters
- "milestones": An optional array of weekly milestones (each with "week" number, "target" value, and "description")

Format your response EXACTLY as:
{
  "goals": [
    {
      "title": "Goal title here",
      "description": "Detailed goal description here",
      "targetValue": 10,
      "targetUnit": "pounds",
      "timeline": {
        "durationWeeks": 12
      },
      "motivation": "Why this goal matters to you",
      "milestones": [
        {
          "week": 4,
          "target": 3,
          "description": "Lose 3 pounds by week 4"
        },
        {
          "week": 8,
          "target": 7,
          "description": "Lose 7 pounds by week 8"
        }
      ]
    }
  ],
  "reasoning": "Brief explanation of why these goals were chosen and how they align with the user's assessment"
}

IMPORTANT: 
- Return ONLY valid JSON. No markdown, no additional text.
- Ensure all numeric values are actual numbers, not strings.
- Duration should be realistic (typically 4-16 weeks for most goals).
- For sleep goals, targetUnit might be "hours" and targetValue might be hours of sleep.
- For weight goals, use "pounds" or "kg" as targetUnit.
- For habit goals, targetUnit might be "days per week" or "times per week".
- Keep descriptions and motivations SHORT (2-3 sentences each). Do not write paragraphs.
- Limit milestones to 2-3 per goal maximum.`;

      let content = '';
      const goalSystemPrompt = 'You are an expert health and wellness coach specializing in creating personalized SMART goals. Always respond with valid JSON only.';

      // Try Gemini first
      if (this.geminiApiKey) {
        try {
          content = await this.callGeminiText(goalSystemPrompt, [{ role: 'user', content: prompt }], undefined, 0.4, true);
        } catch (geminiError: any) {
          logger.warn('[AICoach] Gemini goal generation failed, trying OpenAI', { error: geminiError?.message });
        }
      }

      // Fallback to OpenAI
      if (!content && this.visionClient) {
        try {
          const model = env.openai.model || 'gpt-4o-mini';
          const response = await this.visionClient.chat.completions.create({
            model,
            ...this.getTokenParameter(model, 4096),
            ...this.getResponseFormatParameter(model),
            messages: [
              { role: 'system', content: goalSystemPrompt },
              { role: 'user', content: prompt },
            ],
          });
          content = response.choices[0]?.message?.content || '';
        } catch (openaiError: any) {
          logger.warn('[AICoach] OpenAI goal generation also failed', { error: openaiError?.message });
        }
      }

      if (!content || content.trim().length === 0) {
        logger.error('[AICoach] All providers failed for goal generation');
        throw ApiError.internal('Failed to generate goals. Please try again.');
      }

      // Strip markdown fences and parse JSON
      const cleanContent = this.stripMarkdownFences(content);
      let result: GenerateGoalsResponse;
      try {
        result = JSON.parse(cleanContent);
      } catch {
        // Fallback: extract JSON object from text
        const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          logger.error('[AICoach] No JSON found in goal generation response', {
            contentPreview: content.substring(0, 200),
          });
          throw ApiError.internal('Invalid response format from goal generation service.');
        }
        try {
          result = JSON.parse(jsonMatch[0]);
        } catch (innerError) {
          logger.error('[AICoach] Failed to parse goal generation response', {
            error: innerError instanceof Error ? innerError.message : 'Unknown parse error',
            contentPreview: content.substring(0, 500),
          });
          throw ApiError.internal('Failed to parse goal generation response. Please try again.');
        }
      }

      // Validate response structure
      if (!result.goals || !Array.isArray(result.goals) || result.goals.length === 0) {
        logger.error('[AICoach] Invalid goal generation response structure', { result });
        throw ApiError.internal('Invalid goal generation response. Please try again.');
      }

      logger.info('[AICoach] Successfully generated goals', {
        userId,
        goalCategory,
        goalsCount: result.goals.length,
      });

      return {
        goals: result.goals,
        reasoning: result.reasoning || 'Goals generated based on your assessment and preferences.',
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('[AICoach] Error generating goals', {
        userId: request.userId,
        goalCategory: request.goalCategory,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw ApiError.internal('Failed to generate goals. Please try again.');
    }
  }

  // ============================================================================
  // Methods required by ai-coach.controller.ts
  // ============================================================================

  /**
   * Get user's display name from the database
   */
  async getUserName(userId: string): Promise<string | null> {
    try {
      const result = await query<{ first_name: string | null; last_name: string | null }>(
        `SELECT first_name, last_name FROM users WHERE id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const parts = [row.first_name, row.last_name].filter(Boolean);
      return parts.length > 0 ? parts.join(' ') : null;
    } catch (error) {
      logger.error('[AICoach] Error getting user name', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Generate an opening message for a new conversation
   * Uses LangGraph chatbot service to generate a personalized greeting
   * During onboarding, skips history-based personalized greetings
   */
  async generateOpeningMessage(
    goal: GoalCategory,
    userName?: string,
    language?: SupportedLanguage,
    userId?: string,
    isOnboarding?: boolean
  ): Promise<AICoachResponse> {
    try {
      let message: string;
      
      // During onboarding, ask goal-specific questions instead of greetings
      if (isOnboarding) {
        logger.debug('[AICoach] Generating onboarding question', {
          goal,
          userName,
          language,
        });
        message = this.generateOnboardingQuestion(goal, userName, language);
      } else {
        // During regular conversations, use personalized greetings
        const shouldUsePersonalizedGreeting = userId && 
          langGraphChatbotService && 
          typeof langGraphChatbotService.generateGreeting === 'function';
        
        if (shouldUsePersonalizedGreeting) {
          try {
            message = await langGraphChatbotService.generateGreeting(
              userId,
              goal,
              language || 'en'
            );
            
            // Validate greeting is not empty
            if (!message || message.trim().length === 0) {
              throw new Error('Empty greeting received');
            }
          } catch (langGraphError) {
            const errorMessage = langGraphError instanceof Error ? langGraphError.message : String(langGraphError);
            logger.warn('[AICoach] LangGraph greeting generation failed, using fallback', {
              userId,
              goal,
              error: errorMessage,
            });
            // Fall through to fallback greeting
            message = this.generateFallbackGreeting(goal, userName, language);
          }
        } else {
          // Use fallback greeting if service not available
          logger.debug('[AICoach] Using fallback greeting', {
            hasUserId: !!userId,
            hasService: !!langGraphChatbotService,
            hasMethod: langGraphChatbotService && typeof langGraphChatbotService.generateGreeting === 'function',
          });
          message = this.generateFallbackGreeting(goal, userName, language);
        }
      }
      
      return {
        message,
        phase: 'opening',
        insights: [],
        isComplete: false,
        suggestedActions: [],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[AICoach] Error generating opening message', {
        goal,
        userName,
        language,
        userId,
        isOnboarding,
        error: errorMessage,
      });
      
      // Final fallback - use onboarding question if onboarding, otherwise greeting
      const fallbackMessage = isOnboarding
        ? this.generateOnboardingQuestion(goal, userName, language)
        : this.generateFallbackGreeting(goal, userName, language);
      
      return {
        message: fallbackMessage,
        phase: 'opening',
        insights: [],
        isComplete: false,
        suggestedActions: [],
      };
    }
  }
  
  /**
   * Generate a goal-specific onboarding question
   */
  private generateOnboardingQuestion(
    goal: GoalCategory,
    userName?: string,
    language?: SupportedLanguage
  ): string {
    // Language support
    if (language === 'ur') {
      const questions: Record<string, string> = {
        weight_loss: userName 
          ? `${userName}، آپ وزن کم کرنے کا فیصلہ کیوں کیا؟ کیا کوئی خاص واقعہ یا وجہ ہے جس نے آپ کو متاثر کیا؟`
          : `آپ وزن کم کرنے کا فیصلہ کیوں کیا؟ کیا کوئی خاص واقعہ یا وجہ ہے جس نے آپ کو متاثر کیا؟`,
        muscle_building: userName
          ? `${userName}، آپ پٹھے بنانے کی کوشش کیوں کر رہے ہیں؟ آپ کا موجودہ فٹنس لیول کیا ہے؟`
          : `آپ پٹھے بنانے کی کوشش کیوں کر رہے ہیں؟ آپ کا موجودہ فٹنس لیول کیا ہے؟`,
        sleep_improvement: userName
          ? `${userName}، آپ کی نیند میں کیا مسائل ہیں؟ آپ عام طور پر کتنے گھنٹے سوتے ہیں؟`
          : `آپ کی نیند میں کیا مسائل ہیں؟ آپ عام طور پر کتنے گھنٹے سوتے ہیں؟`,
        stress_wellness: userName
          ? `${userName}، آپ کو تناؤ کب سب سے زیادہ محسوس ہوتا ہے؟ آپ اسے کیسے مینج کرتے ہیں؟`
          : `آپ کو تناؤ کب سب سے زیادہ محسوس ہوتا ہے؟ آپ اسے کیسے مینج کرتے ہیں؟`,
        energy_productivity: userName
          ? `${userName}، آپ کی توانائی کا لیول دن میں کب سب سے زیادہ ہوتا ہے؟ کیا چیزیں آپ کو تھکا دیتی ہیں؟`
          : `آپ کی توانائی کا لیول دن میں کب سب سے زیادہ ہوتا ہے؟ کیا چیزیں آپ کو تھکا دیتی ہیں؟`,
        event_training: userName
          ? `${userName}، آپ کس قسم کے ایونٹ کے لیے ٹریننگ کر رہے ہیں؟ ایونٹ کب ہے اور آپ کا موجودہ فٹنس لیول کیا ہے؟`
          : `آپ کس قسم کے ایونٹ کے لیے ٹریننگ کر رہے ہیں؟ ایونٹ کب ہے اور آپ کا موجودہ فٹنس لیول کیا ہے؟`,
        health_condition: userName
          ? `${userName}، آپ کس قسم کی صحت کی حالت کا انتظام کر رہے ہیں؟ یہ آپ کی روزمرہ زندگی کو کیسے متاثر کرتا ہے؟`
          : `آپ کس قسم کی صحت کی حالت کا انتظام کر رہے ہیں؟ یہ آپ کی روزمرہ زندگی کو کیسے متاثر کرتا ہے؟`,
        habit_building: userName
          ? `${userName}، آپ کون سا عادت بنانا چاہتے ہیں؟ آپ نے پہلے کبھی یہ عادت بنانے کی کوشش کی ہے؟`
          : `آپ کون سا عادت بنانا چاہتے ہیں؟ آپ نے پہلے کبھی یہ عادت بنانے کی کوشش کی ہے؟`,
        overall_optimization: userName
          ? `${userName}، آپ کی صحت کا کون سا پہلو سب سے زیادہ بہتری چاہتا ہے؟ آپ کیا تبدیلیاں کرنے کے لیے تیار ہیں؟`
          : `آپ کی صحت کا کون سا پہلو سب سے زیادہ بہتری چاہتا ہے؟ آپ کیا تبدیلیاں کرنے کے لیے تیار ہیں؟`,
        custom: userName
          ? `${userName}، آپ کا صحت کا بنیادی مقصد کیا ہے؟ آپ کیا تبدیلیاں کرنا چاہتے ہیں؟`
          : `آپ کا صحت کا بنیادی مقصد کیا ہے؟ آپ کیا تبدیلیاں کرنا چاہتے ہیں؟`,
      };
      return questions[goal] || (userName ? `${userName}، آپ کیا تبدیلیاں کرنا چاہتے ہیں؟` : `آپ کیا تبدیلیاں کرنا چاہتے ہیں؟`);
    }
    
    // English questions
    const questions: Record<string, string> = {
      weight_loss: userName
        ? `Hi ${userName}! I'd love to understand your motivation better. What made you decide to focus on weight loss? Was there a specific moment or reason that inspired you?`
        : `I'd love to understand your motivation better. What made you decide to focus on weight loss? Was there a specific moment or reason that inspired you?`,
      muscle_building: userName
        ? `Hey ${userName}! Let's talk about your muscle building goals. What's driving you to build muscle, and what's your current fitness level?`
        : `Let's talk about your muscle building goals. What's driving you to build muscle, and what's your current fitness level?`,
      sleep_improvement: userName
        ? `Hi ${userName}! Sleep is so important for overall health. What specific sleep challenges are you facing? How many hours of sleep do you typically get each night?`
        : `Sleep is so important for overall health. What specific sleep challenges are you facing? How many hours of sleep do you typically get each night?`,
      stress_wellness: userName
        ? `Hey ${userName}! Stress management is crucial. When do you feel most stressed in your daily life, and how do you currently handle it?`
        : `Stress management is crucial. When do you feel most stressed in your daily life, and how do you currently handle it?`,
      energy_productivity: userName
        ? `Hi ${userName}! Let's talk about your energy levels. When during the day do you feel most energized, and what tends to drain your energy?`
        : `Let's talk about your energy levels. When during the day do you feel most energized, and what tends to drain your energy?`,
      event_training: userName
        ? `Hey ${userName}! Exciting that you're training for an event! What type of event are you preparing for, when is it, and what's your current fitness level?`
        : `Exciting that you're training for an event! What type of event are you preparing for, when is it, and what's your current fitness level?`,
      health_condition: userName
        ? `Hi ${userName}! I'm here to support your health journey. What health condition are you managing, and how does it affect your daily life?`
        : `I'm here to support your health journey. What health condition are you managing, and how does it affect your daily life?`,
      habit_building: userName
        ? `Hey ${userName}! Building healthy habits is powerful. What specific habit are you looking to build, and have you tried building it before?`
        : `Building healthy habits is powerful. What specific habit are you looking to build, and have you tried building it before?`,
      overall_optimization: userName
        ? `Hi ${userName}! Let's optimize your health holistically. Which aspect of your health needs the most improvement, and what changes are you ready to make?`
        : `Let's optimize your health holistically. Which aspect of your health needs the most improvement, and what changes are you ready to make?`,
      custom: userName
        ? `Hey ${userName}! I'd love to understand your goals better. What's your primary health goal, and what changes would you like to make?`
        : `I'd love to understand your goals better. What's your primary health goal, and what changes would you like to make?`,
    };
    
    return questions[goal] || (userName ? `Hi ${userName}! What changes would you like to make?` : `What changes would you like to make?`);
  }

  /**
   * Generate a fallback greeting when LangGraph service is unavailable
   */
  private generateFallbackGreeting(
    goal: GoalCategory,
    userName?: string,
    language?: SupportedLanguage
  ): string {
    // Language support
    if (language === 'ur') {
      if (userName) {
        return `السلام علیکم ${userName}! میں آپ کی ${goal} کے لیے مدد کرنے کے لیے یہاں ہوں۔ آج آپ کیا کرنا چاہیں گے؟`;
      } else {
        return `السلام علیکم! میں آپ کی ${goal} کے لیے مدد کرنے کے لیے یہاں ہوں۔ آج آپ کیا کرنا چاہیں گے؟`;
      }
    }
    
    // English greetings
    if (userName) {
      const goalMessages: Record<string, string> = {
        weight_loss: `Hey ${userName}! Ready to start your weight loss journey? Let's create a plan that works for you.`,
        muscle_building: `Hey ${userName}! Let's build some muscle together. What's your current fitness level?`,
        sleep_improvement: `Hey ${userName}! Sleep is so important. Let's work on improving your rest.`,
        stress_wellness: `Hey ${userName}! Managing stress is key to overall wellness. How are you feeling today?`,
        energy_productivity: `Hey ${userName}! Let's boost your energy and productivity. What's been draining you lately?`,
        event_training: `Hey ${userName}! Got an event coming up? Let's get you ready!`,
        health_condition: `Hey ${userName}! I'm here to support your health journey. What would you like to focus on?`,
        habit_building: `Hey ${userName}! Building good habits is the foundation of success. What habit are we working on?`,
        overall_optimization: `Hey ${userName}! Let's optimize your overall health and wellness. Where should we start?`,
        custom: `Hey ${userName}! I'm here to help you reach your goals. What are we working on today?`,
      };
      
      return goalMessages[goal] || `Hey ${userName}! I'm here to help you with your ${goal} goal. What would you like to focus on today?`;
    } else {
      return `Hey! I'm here to help you with your ${goal} goal. What would you like to focus on today?`;
    }
  }

  /**
   * Generate a response to a user message within a conversation
   * During onboarding: uses lightweight direct OpenAI call for fast assessment questions
   * During regular chat: uses LangGraph chatbot service with full tool suite
   */
  async generateResponse(
    context: ConversationContext,
    history?: ChatMessage[],
    message?: string
  ): Promise<AICoachResponse> {
    try {
      if (!context.userId || !message) {
        throw ApiError.badRequest('userId and message are required');
      }

      // Determine phase based on message count
      let phase: ConversationPhase = context.phase || 'opening';
      if (context.messageCount) {
        if (context.messageCount < 3) {
          phase = 'opening';
        } else if (context.messageCount < 10) {
          phase = 'exploration';
        } else {
          phase = 'deep_dive';
        }
      }

      // During onboarding, use lightweight direct AI call instead of heavy LangGraph
      if (context.isOnboarding) {
        return this.generateOnboardingResponse(context, history || [], message, phase);
      }

      // Use LangGraph chatbot service for regular conversations
      const response = await langGraphChatbotService.chat({
        userId: context.userId,
        message,
        conversationId: undefined,
        callPurpose: context.goal || undefined,
        language: context.language || 'en',
      });

      const insights: ExtractedInsight[] = [];
      const isComplete = context.messageCount && context.messageCount > 20 ? true : false;

      return {
        message: response.response || 'I understand. How can I help you further?',
        phase,
        insights,
        isComplete,
        suggestedActions: [],
      };
    } catch (error) {
      logger.error('[AICoach] Error generating response', {
        userId: context.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        message: "I'm here to help you with your health and fitness goals. What would you like to work on today?",
        phase: context.phase || 'opening',
        insights: [],
        isComplete: false,
        suggestedActions: [],
      };
    }
  }

  /**
   * Generate a lightweight onboarding assessment response using direct OpenAI call.
   * Skips LangGraph (18 tools, 30s) in favor of a fast, focused assessment conversation.
   */
  private async generateOnboardingResponse(
    context: ConversationContext,
    history: ChatMessage[],
    message: string,
    phase: ConversationPhase
  ): Promise<AICoachResponse> {
    const goal = context.goal || 'custom';
    const language = context.language || 'en';
    const userCount = context.messageCount || 0;
    const targetMessages = 6;
    const isComplete = userCount >= targetMessages;

    const goalDescriptions: Record<string, string> = {
      weight_loss: 'weight loss and healthy weight management',
      muscle_building: 'building muscle and strength',
      sleep_improvement: 'improving sleep quality',
      stress_wellness: 'stress management and wellbeing',
      energy_productivity: 'increasing energy and productivity',
      event_training: 'training for a specific event',
      health_condition: 'managing a health condition',
      habit_building: 'building healthy habits',
      overall_optimization: 'overall health optimization',
      // Life goal categories
      financial: 'financial goals and money management',
      faith: 'faith, spiritual practice, and religious goals',
      relationships: 'improving relationships — family, friends, or partner',
      education: 'education, learning, and personal study goals',
      career: 'career development and professional growth',
      health_wellness: 'general health and wellness improvements',
      spiritual: 'spiritual growth and mindfulness',
      social: 'social connections and community building',
      productivity: 'productivity and time management',
      happiness: 'happiness and life satisfaction',
      anxiety_management: 'managing anxiety and building resilience',
      creative: 'creative pursuits and artistic goals',
      personal_growth: 'personal growth and self-improvement',
      custom: 'personalized goals',
    };
    const goalDesc = goalDescriptions[goal] || goalDescriptions.custom;

    const languageInstruction = language === 'ur'
      ? 'CRITICAL: Respond in Urdu (اردو) using Urdu script. Sound like a real Urdu-speaking friend.'
      : 'Respond in English. Sound like a friendly, casual life coach.';

    const systemPrompt = `You are a life coaching assessment specialist. You are conducting a brief onboarding assessment about ${goalDesc}.

${languageInstruction}

Your job is to:
1. Acknowledge the user's answer briefly and warmly (1 short sentence)
2. Ask ONE follow-up question to learn more about their situation
3. Focus on understanding: current habits, challenges, motivation, lifestyle, and preferences

Phase: ${phase} (${userCount}/${targetMessages} questions asked)
${isComplete ? 'IMPORTANT: This is the final response. Summarize what you learned and thank the user. Do NOT ask another question.' : ''}

Guidelines:
- Keep responses SHORT (2-3 sentences max)
- Be conversational and warm, not clinical
- Ask specific, focused questions (not open-ended)
- Each question should cover a different topic area
- Do NOT use tools, do NOT reference workouts/meals/data - this is a fresh assessment`;

    // Build conversation history for context
    const recentHistory = history.slice(-6).map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    try {
      let responseText = '';

      // Try Gemini first
      if (this.geminiApiKey) {
        try {
          const allMessages = [
            ...recentHistory,
            { role: 'user' as const, content: message },
          ];
          responseText = await this.callGeminiText(systemPrompt, allMessages, 200, 0.7);
        } catch (geminiError: any) {
          logger.warn('[AICoach] Gemini assessment failed, trying OpenAI', { error: geminiError?.message });
        }
      }

      // Fallback to OpenAI
      if (!responseText && this.visionClient) {
        const model = env.openai.model || 'gpt-4o-mini';
        const completion = await this.visionClient.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...recentHistory,
            { role: 'user', content: message },
          ],
          ...this.getTemperatureParameter(model, 0.7),
          ...this.getTokenParameter(model, 200),
        });
        responseText = completion.choices[0]?.message?.content?.trim() || '';
      }

      if (!responseText) {
        throw new Error('Empty response from all AI providers');
      }

      // Extract basic insights from the user's message
      const insights: ExtractedInsight[] = [{
        category: goal,
        text: message.substring(0, 200),
        confidence: 0.8,
      }];

      return {
        message: responseText,
        phase,
        insights,
        isComplete,
        suggestedActions: [],
      };
    } catch (error) {
      logger.warn('[AICoach] Onboarding response generation failed, using fallback', {
        error: error instanceof Error ? error.message : 'Unknown error',
        goal,
        phase,
      });

      // Fallback: acknowledge and ask a generic follow-up
      const fallbackMessage = isComplete
        ? "Thank you for sharing all of that! I have a great understanding of where you're at. Let's move on to creating your personalized plan."
        : "Thanks for sharing that! Can you tell me a bit more about your daily routine and what challenges you face?";

      return {
        message: fallbackMessage,
        phase,
        insights: [],
        isComplete,
        suggestedActions: [],
      };
    }
  }

  /**
   * Create a new AI coach session in the database
   */
  async createSession(
    userId: string,
    goal: GoalCategory,
    sessionType: string
  ): Promise<AICoachSession> {
    try {
      const result = await query<{
        id: string;
        user_id: string;
        goal_category: string;
        session_type: string;
        messages: ChatMessage[];
        extracted_insights: ExtractedInsight[];
        conversation_phase: string;
        message_count: number;
        user_message_count: number;
        is_complete: boolean;
        session_summary: string | null;
        key_takeaways: string[] | null;
        completed_at: Date | null;
        created_at: Date;
        updated_at: Date;
      }>(
        `INSERT INTO ai_coach_sessions (user_id, goal_category, session_type)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [userId, goal, sessionType]
      );

      return this.mapSessionRow(result.rows[0]);
    } catch (error) {
      logger.error('[AICoach] Error creating session', {
        userId,
        goal,
        sessionType,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw ApiError.internal('Failed to create AI coach session');
    }
  }

  /**
   * Delete an AI coach session
   */
  async deleteSession(userId: string, sessionId: string): Promise<void> {
    try {
      const result = await query(
        `DELETE FROM ai_coach_sessions WHERE id = $1 AND user_id = $2`,
        [sessionId, userId]
      );

      if (result.rowCount === 0) {
        throw ApiError.notFound('Session not found');
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      logger.error('[AICoach] Error deleting session', {
        userId,
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw ApiError.internal('Failed to delete session');
    }
  }

  /**
   * Generate a personalized diet plan
   * Stub -- will be implemented with full AI prompt logic
   */
  async generateDietPlan(_request: DietPlanRequest): Promise<GeneratedDietPlan> {
    throw new Error('Not implemented');
  }

  /**
   * Save a generated diet plan to the database
   */
  async saveDietPlan(userId: string, plan: GeneratedDietPlan, goal: GoalCategory): Promise<string> {
    try {
      const result = await query<{ id: string }>(
        `INSERT INTO diet_plans (user_id, name, goal_category, weekly_meals, ai_generated, ai_model, generation_params)
         VALUES ($1, $2, $3, $4, true, 'gpt-5-mini', $5)
         RETURNING id`,
        [
          userId,
          `AI Diet Plan - ${goal}`,
          goal,
          JSON.stringify(plan),
          JSON.stringify({ goal }),
        ]
      );

      return result.rows[0].id;
    } catch (error) {
      logger.error('[AICoach] Error saving diet plan', {
        userId,
        goal,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw ApiError.internal('Failed to save diet plan');
    }
  }

  /**
   * Get the active diet plan for a user
   */
  async getActiveDietPlan(userId: string): Promise<Record<string, unknown> | null> {
    try {
      const result = await query<Record<string, unknown>>(
        `SELECT * FROM diet_plans
         WHERE user_id = $1 AND status = 'active'
         ORDER BY created_at DESC
         LIMIT 1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      logger.error('[AICoach] Error getting active diet plan', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw ApiError.internal('Failed to retrieve diet plan');
    }
  }

  /**
   * Build historical context string from previous sessions for a user
   */
  async buildHistoricalContext(userId: string): Promise<string> {
    try {
      // Get recent completed sessions
      const result = await query<{
        goal_category: string;
        session_summary: string | null;
        key_takeaways: string[] | null;
        completed_at: Date;
      }>(
        `SELECT goal_category, session_summary, key_takeaways, completed_at
         FROM ai_coach_sessions
         WHERE user_id = $1 AND is_complete = true
         ORDER BY completed_at DESC
         LIMIT 5`,
        [userId]
      );

      if (result.rows.length === 0) {
        return '';
      }

      const contextParts: string[] = [];
      contextParts.push('Previous AI Coach Sessions:');

      for (const session of result.rows) {
        const date = new Date(session.completed_at).toLocaleDateString();
        contextParts.push(`\n- ${session.goal_category} (${date})`);
        if (session.session_summary) {
          contextParts.push(`  Summary: ${session.session_summary}`);
        }
        if (session.key_takeaways && session.key_takeaways.length > 0) {
          contextParts.push(`  Key Takeaways: ${session.key_takeaways.join(', ')}`);
        }
      }

      return contextParts.join('\n');
    } catch (error) {
      logger.error('[AICoach] Error building historical context', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return '';
    }
  }

  /**
   * Add a message to an existing session and update metadata
   */
  async addMessageToSession(
    sessionId: string,
    message: ChatMessage,
    insights?: ExtractedInsight[],
    phase?: ConversationPhase,
    isComplete?: boolean
  ): Promise<void> {
    try {
      // Build SET clauses dynamically
      let setClause = `messages = messages || $2::jsonb,
                        message_count = message_count + 1,
                        updated_at = NOW()`;
      const params: (string | number | boolean | null | Date | object)[] = [
        sessionId,
        JSON.stringify([message]),
      ];
      let paramIndex = 3;

      if (message.role === 'user') {
        setClause += `, user_message_count = user_message_count + 1`;
      }

      if (insights !== undefined) {
        setClause += `, extracted_insights = $${paramIndex}::jsonb`;
        params.push(JSON.stringify(insights));
        paramIndex++;
      }

      if (phase !== undefined) {
        setClause += `, conversation_phase = $${paramIndex}`;
        params.push(phase);
        paramIndex++;
      }

      if (isComplete !== undefined) {
        setClause += `, is_complete = $${paramIndex}`;
        params.push(isComplete);
        paramIndex++;

        if (isComplete) {
          setClause += `, status = 'completed', completed_at = NOW()`;
        }
      }

      await query(
        `UPDATE ai_coach_sessions SET ${setClause} WHERE id = $1`,
        params
      );
    } catch (error) {
      logger.error('[AICoach] Error adding message to session', {
        sessionId,
        role: message.role,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw ApiError.internal('Failed to update session');
    }
  }

  /**
   * Generate a dynamic MCQ question based on context
   * Uses AI to generate personalized, contextual questions
   */
  async generateMCQQuestion(request: MCQGenerationRequest): Promise<MCQGenerationResponse> {
    try {
      const { goal, phase = 'opening', previousAnswers = [], language = 'en' } = request;

      // Generate question ID
      const questionId = crypto.randomUUID();

      // Rich goal descriptions with context for better question generation
      const goalContextMap: Record<string, { name: string; description: string; keyTopics: string[] }> = {
        weight_loss: {
          name: 'Weight Loss',
          description: 'User wants to lose weight and reduce body fat',
          keyTopics: ['current diet habits', 'exercise frequency', 'eating triggers', 'portion control', 'meal timing', 'hydration', 'past diet attempts'],
        },
        muscle_building: {
          name: 'Muscle Building',
          description: 'User wants to build muscle mass and increase strength',
          keyTopics: ['training experience', 'workout preference', 'protein intake', 'recovery habits', 'gym access', 'supplement use', 'training schedule'],
        },
        sleep_improvement: {
          name: 'Sleep Improvement',
          description: 'User wants to improve sleep quality and duration',
          keyTopics: ['sleep challenges', 'sleep duration', 'bedtime routine', 'screen habits', 'caffeine intake', 'stress impact on sleep', 'sleep schedule'],
        },
        stress_wellness: {
          name: 'Stress Management & Wellness',
          description: 'User wants to reduce stress and improve mental wellbeing',
          keyTopics: ['stress triggers', 'coping mechanisms', 'mindfulness experience', 'stress impact on life', 'anxiety frequency', 'relaxation preferences', 'work-life balance'],
        },
        energy_productivity: {
          name: 'Energy & Productivity',
          description: 'User wants to boost energy levels and daily productivity',
          keyTopics: ['energy patterns', 'work hours', 'afternoon crashes', 'morning routine', 'hydration', 'sleep quality', 'break habits'],
        },
        event_training: {
          name: 'Event Training',
          description: 'User is training for a specific athletic event or competition',
          keyTopics: ['event type', 'event timeline', 'fitness level', 'training frequency', 'past events', 'nutrition strategy', 'recovery routine'],
        },
        health_condition: {
          name: 'Health Condition Management',
          description: 'User wants to manage a health condition through lifestyle changes',
          keyTopics: ['condition type', 'daily impact', 'medical supervision', 'medications', 'exercise capacity', 'dietary restrictions', 'health concerns'],
        },
        habit_building: {
          name: 'Habit Building',
          description: 'User wants to build healthy habits and stick to them',
          keyTopics: ['target habit', 'past attempts', 'barriers', 'preferred time', 'accountability preference', 'time commitment', 'motivation style'],
        },
        overall_optimization: {
          name: 'Overall Health Optimization',
          description: 'User wants to improve overall health across fitness, nutrition, sleep, and mental wellness',
          keyTopics: ['weakest health area', 'health priority', 'readiness for change', 'exercise frequency', 'eating habits', 'stress level', 'sleep quality'],
        },
        custom: {
          name: 'Custom Health Goals',
          description: 'User has personalized health goals',
          keyTopics: ['primary goal', 'desired changes', 'current challenges', 'exercise habits', 'stress level', 'sleep quality', 'hydration'],
        },
      };

      const goalContext = goalContextMap[goal] || goalContextMap.custom;

      // Build context with ALL previous Q&A to prevent repeating questions
      let previousQAContext = '';
      if (previousAnswers.length > 0) {
        const qaList = previousAnswers.map((a, i) =>
          `Q${i + 1}: "${a.questionText || a.questionId}" → Answer: ${a.selectedOptions.join(', ')}`
        ).join('\n');
        previousQAContext = `\nPreviously asked questions (DO NOT repeat or rephrase ANY of these):\n${qaList}`;
      }

      // Include extracted insights for smarter follow-up questions
      let insightsContext = '';
      if (request.extractedInsights && request.extractedInsights.length > 0) {
        const insightsList = request.extractedInsights
          .slice(-5) // Last 5 insights for context
          .map(i => `- ${i.category}: ${i.text} (confidence: ${i.confidence})`)
          .join('\n');
        insightsContext = `\nInsights gathered so far:\n${insightsList}`;
      }

      // Determine which topic to focus on next (avoid already-covered topics)
      const coveredTopics = previousAnswers.map(a => a.questionText?.toLowerCase() || '').join(' ');
      const remainingTopics = goalContext.keyTopics.filter(
        topic => !coveredTopics.includes(topic.split(' ')[0])
      );
      const suggestedTopic = remainingTopics.length > 0 ? remainingTopics[0] : goalContext.keyTopics[previousAnswers.length % goalContext.keyTopics.length];

      // Phase-aware topic guidance
      const phaseTopics: Record<string, string> = {
        opening: 'motivation, current habits, lifestyle basics',
        exploration: 'specific challenges, preferences, schedule, experience level',
        deep_dive: 'detailed preferences, constraints, medical considerations, past attempts',
      };
      const topicHint = phaseTopics[phase] || phaseTopics.opening;

      const mcqSystemPrompt = `You are an expert health assessment coach specializing in ${goalContext.name}.
The user's goal: ${goalContext.description}.

Your task: Generate ONE highly relevant MCQ question for their ${goalContext.name} assessment.

Phase: ${phase} (focus areas: ${topicHint}).
Suggested next topic: ${suggestedTopic}.
${previousQAContext}
${insightsContext}

Return ONLY valid JSON: {"question": "text", "options": [{"text": "opt1", "insightValue": "val1"}, {"text": "opt2", "insightValue": "val2"}, {"text": "opt3", "insightValue": "val3"}, {"text": "opt4", "insightValue": "val4"}]}

Rules:
- Question MUST be specifically about ${goalContext.name} — not generic health
- Question must be unique — never repeat or rephrase previous questions
- Exactly 4 meaningful options that reveal actionable insights about the user
- insightValue: snake_case key summarizing the option (e.g., "high_stress", "no_exercise")
- ${language === 'ur' ? 'Generate question and options in Urdu language' : 'Generate in English'}`;

      const userPrompt = `Generate assessment question ${previousAnswers.length + 1} of 7 specifically about ${goalContext.name}. Focus on: ${suggestedTopic}.`;

      try {
        let content: string | null = null;

        // Try Gemini first
        if (this.geminiApiKey) {
          try {
            content = await this.callGeminiText(mcqSystemPrompt, [{ role: 'user', content: userPrompt }], 500, 0.4, true);
          } catch (geminiError: any) {
            logger.warn('[AICoach] Gemini MCQ generation failed, trying OpenAI', { error: geminiError?.message });
          }
        }

        // Fallback to OpenAI
        if (!content && this.visionClient) {
          const model = env.openai.model || 'gpt-4o-mini';
          const tokenLimit = this.isReasoningModel(model) ? 200 : 500;
          const completion = await this.visionClient.chat.completions.create({
            model,
            messages: [
              { role: 'system', content: mcqSystemPrompt },
              { role: 'user', content: userPrompt },
            ],
            ...this.getTemperatureParameter(model, 0.7),
            ...this.getTokenParameter(model, tokenLimit),
            ...this.getResponseFormatParameter(model),
          });
          content = completion.choices[0]?.message?.content || null;
        }

        if (!content || content.trim().length === 0) {
          logger.warn('[AICoach] Empty response from all providers, using fallback');
          return this.generateFallbackMCQQuestion(goal, phase, language, questionId, previousAnswers);
        }

        // Try to parse JSON - if response_format wasn't used, extract JSON from text
        interface ParsedResponse {
          question?: string;
          options?: Array<{ text: string; insightValue?: string }>;
        }
        
        const cleanContent = this.stripMarkdownFences(content);

        let parsed: ParsedResponse;
        try {
          parsed = JSON.parse(cleanContent) as ParsedResponse;
        } catch (parseError) {
          // If direct parse fails, try to extract JSON from text
          const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]) as ParsedResponse;
          } else {
            logger.warn('[AICoach] Failed to parse JSON from response', {
              contentPreview: content.substring(0, 200),
              error: parseError instanceof Error ? parseError.message : 'Unknown parse error',
            });
            throw new Error('Invalid JSON response from AI');
          }
        }
        const questionText = parsed.question || 'How can I help you achieve your goals?';
        const rawOptions = parsed.options || [];

        // Ensure we have at least 2 options
        if (rawOptions.length < 2) {
          // Fallback to default options
          const fallbackOptions = language === 'ur'
            ? ['ہاں', 'نہیں', 'شاید', 'یقین نہیں']
            : ['Yes', 'No', 'Maybe', 'Not sure'];
          rawOptions.push(...fallbackOptions.slice(0, 4 - rawOptions.length).map(opt => ({ text: opt })));
        }

        const options: MCQOption[] = rawOptions.slice(0, 4).map((opt: { text: string; insightValue?: string }, idx: number) => ({
          id: `opt-${idx + 1}`,
          text: opt.text || `Option ${idx + 1}`,
          insightValue: opt.insightValue || opt.text?.toLowerCase().replace(/\s+/g, '_') || `option_${idx + 1}`,
        }));

        // Determine next phase based on progress
        let nextPhase: ConversationPhase = phase;
        const answerCount = previousAnswers.length;
        if (answerCount < 2) {
          nextPhase = 'opening';
        } else if (answerCount < 5) {
          nextPhase = 'exploration';
        } else {
          nextPhase = 'deep_dive';
        }

        // Calculate progress (complete after 6-8 questions)
        // Progress should reflect questions answered + current question being shown
        // If we've answered N questions, we're showing question N+1
        const targetQuestions = 7;
        const questionsAnswered = answerCount;
        const currentQuestionNumber = questionsAnswered + 1;
        // Progress is based on questions completed (answered), not including current
        // But we show progress for the current question being displayed
        const progress = Math.min(100, Math.round((currentQuestionNumber / targetQuestions) * 100));

        // Determine if complete (after 6+ questions answered, meaning 7th question shown)
        const isComplete = answerCount >= 6;

        return {
          question: {
            id: questionId,
            question: questionText,
            options,
          },
          phase: nextPhase,
          progress,
          isComplete: isComplete || false,
          insights: [],
        };
      } catch (aiError) {
        logger.warn('[AICoach] AI question generation failed, using fallback', {
          goal,
          phase,
          error: aiError instanceof Error ? aiError.message : 'Unknown error',
        });

        // Fallback to basic questions
        return this.generateFallbackMCQQuestion(goal, phase, language, questionId, previousAnswers);
      }
    } catch (error) {
      logger.error('[AICoach] Error generating MCQ question', {
        goal: request.goal,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw ApiError.internal('Failed to generate MCQ question');
    }
  }

  /**
   * Generate fallback MCQ question when AI generation fails
   */
  private generateFallbackMCQQuestion(
    goal: GoalCategory,
    phase: ConversationPhase,
    language: SupportedLanguage,
    questionId: string,
    previousAnswers: { questionId: string; questionText?: string; selectedOptions: string[] }[] = []
  ): MCQGenerationResponse {
    // 7+ questions per goal for full assessment coverage
    const goalQuestions: Record<string, { question: string; options: string[] }[]> = {
      weight_loss: [
        { question: language === 'ur' ? 'آپ کا وزن کم کرنے کا بنیادی مقصد کیا ہے؟' : 'What is your primary motivation for weight loss?', options: language === 'ur' ? ['صحت بہتر بنانا', 'بہتر لگنا', 'طاقت بڑھانا', 'طبی وجوہات'] : ['Improve health', 'Look better', 'Increase energy', 'Medical reasons'] },
        { question: language === 'ur' ? 'آپ کتنی بار ورزش کرتے ہیں؟' : 'How often do you currently exercise?', options: language === 'ur' ? ['کبھی نہیں', 'ہفتے میں 1-2 بار', 'ہفتے میں 3-4 بار', 'روزانہ'] : ['Never', '1-2 times per week', '3-4 times per week', 'Daily'] },
        { question: language === 'ur' ? 'آپ کی غذا میں سب سے بڑی چیلنج کیا ہے؟' : 'What is your biggest nutrition challenge?', options: language === 'ur' ? ['پورشن کنٹرول', 'صحت مند کھانا', 'میٹھا کھانا', 'وقت نہیں ملتا'] : ['Portion control', 'Eating healthy', 'Sweet cravings', 'No time'] },
        { question: language === 'ur' ? 'آپ روزانہ کتنا پانی پیتے ہیں؟' : 'How much water do you drink daily?', options: language === 'ur' ? ['2 گلاس سے کم', '2-4 گلاس', '5-8 گلاس', '8+ گلاس'] : ['Less than 2 glasses', '2-4 glasses', '5-8 glasses', '8+ glasses'] },
        { question: language === 'ur' ? 'آپ عام طور پر کتنے گھنٹے سوتے ہیں؟' : 'How many hours of sleep do you typically get?', options: language === 'ur' ? ['4 گھنٹے سے کم', '4-6 گھنٹے', '6-8 گھنٹے', '8+ گھنٹے'] : ['Less than 4 hours', '4-6 hours', '6-8 hours', '8+ hours'] },
        { question: language === 'ur' ? 'آپ کا تناؤ کی سطح کیا ہے؟' : 'How would you rate your stress level?', options: language === 'ur' ? ['بہت کم', 'کم', 'درمیانی', 'زیادہ'] : ['Very low', 'Low', 'Moderate', 'High'] },
        { question: language === 'ur' ? 'آپ کے پسندیدہ کھانے کی قسم کیا ہے؟' : 'What type of food do you eat most often?', options: language === 'ur' ? ['گھر کا کھانا', 'فاسٹ فوڈ', 'ملاجلا', 'باہر کا کھانا'] : ['Home cooked', 'Fast food', 'Mixed', 'Restaurant food'] },
        { question: language === 'ur' ? 'آپ نے پہلے کبھی ڈائیٹ پلان فالو کیا ہے؟' : 'Have you followed a diet plan before?', options: language === 'ur' ? ['ہاں، کامیاب', 'ہاں، ناکام', 'نہیں', 'ابھی کر رہا ہوں'] : ['Yes, successfully', 'Yes, unsuccessful', 'Never', 'Currently on one'] },
      ],
      muscle_building: [
        { question: language === 'ur' ? 'آپ کتنے عرصے سے ورزش کر رہے ہیں؟' : 'How long have you been working out?', options: language === 'ur' ? ['ابھی شروع کیا', '1-3 ماہ', '3-6 ماہ', '6 ماہ سے زیادہ'] : ['Just starting', '1-3 months', '3-6 months', 'More than 6 months'] },
        { question: language === 'ur' ? 'آپ کس قسم کی ورزش پسند کرتے ہیں؟' : 'What type of exercise do you prefer?', options: language === 'ur' ? ['ویٹ لفٹنگ', 'کارڈیو', 'یوگا', 'مکس'] : ['Weight lifting', 'Cardio', 'Yoga', 'Mixed'] },
        { question: language === 'ur' ? 'آپ کتنے دن ہفتے میں ورزش کر سکتے ہیں؟' : 'How many days per week can you commit to workouts?', options: language === 'ur' ? ['2-3 دن', '4-5 دن', '6 دن', 'روزانہ'] : ['2-3 days', '4-5 days', '6 days', 'Daily'] },
        { question: language === 'ur' ? 'آپ کا موجودہ پروٹین انٹیک کیا ہے؟' : 'How would you describe your current protein intake?', options: language === 'ur' ? ['بہت کم', 'کم', 'کافی', 'زیادہ'] : ['Very low', 'Low', 'Adequate', 'High'] },
        { question: language === 'ur' ? 'کیا آپ کو جم تک رسائی ہے؟' : 'Do you have access to a gym?', options: language === 'ur' ? ['ہاں، مکمل جم', 'گھر میں بنیادی سامان', 'صرف جسمانی وزن', 'نہیں'] : ['Yes, full gym', 'Home basic equipment', 'Bodyweight only', 'No equipment'] },
        { question: language === 'ur' ? 'آپ کا سب سے بڑا چیلنج کیا ہے؟' : 'What is your biggest challenge with building muscle?', options: language === 'ur' ? ['وقت نہیں', 'غذائیت', 'حوصلہ', 'علم نہیں'] : ['No time', 'Nutrition', 'Motivation', 'Lack of knowledge'] },
        { question: language === 'ur' ? 'آپ کتنے گھنٹے سوتے ہیں؟' : 'How many hours of sleep do you get per night?', options: language === 'ur' ? ['4 سے کم', '4-6 گھنٹے', '6-8 گھنٹے', '8+ گھنٹے'] : ['Less than 4', '4-6 hours', '6-8 hours', '8+ hours'] },
        { question: language === 'ur' ? 'کیا آپ کوئی سپلیمنٹس لیتے ہیں؟' : 'Do you currently take any supplements?', options: language === 'ur' ? ['پروٹین پاؤڈر', 'کریٹین', 'متعدد', 'کوئی نہیں'] : ['Protein powder', 'Creatine', 'Multiple supplements', 'None'] },
      ],
      sleep_improvement: [
        { question: language === 'ur' ? 'آپ کی نیند کی سب سے بڑی مشکل کیا ہے؟' : 'What is your biggest sleep challenge?', options: language === 'ur' ? ['سونا مشکل', 'رات کو جاگنا', 'جلدی اٹھنا', 'تھکاوٹ'] : ['Trouble falling asleep', 'Waking up at night', 'Waking up too early', 'Feeling tired'] },
        { question: language === 'ur' ? 'آپ عام طور پر کتنے گھنٹے سوتے ہیں؟' : 'How many hours of sleep do you typically get?', options: language === 'ur' ? ['4 گھنٹے سے کم', '4-6 گھنٹے', '6-8 گھنٹے', '8+ گھنٹے'] : ['Less than 4 hours', '4-6 hours', '6-8 hours', '8+ hours'] },
        { question: language === 'ur' ? 'آپ کا سونے کا معمول کیا ہے؟' : 'What is your bedtime routine?', options: language === 'ur' ? ['باقاعدہ', 'کبھی کبھار', 'بے ترتیب', 'کوئی نہیں'] : ['Consistent', 'Sometimes', 'Irregular', 'None'] },
        { question: language === 'ur' ? 'کیا آپ سونے سے پہلے اسکرین استعمال کرتے ہیں؟' : 'Do you use screens before bed?', options: language === 'ur' ? ['ہمیشہ', 'اکثر', 'کبھی کبھار', 'کبھی نہیں'] : ['Always', 'Often', 'Sometimes', 'Never'] },
        { question: language === 'ur' ? 'آپ کا کیفین کا استعمال کیا ہے؟' : 'How much caffeine do you consume daily?', options: language === 'ur' ? ['کوئی نہیں', '1-2 کپ', '3-4 کپ', '5+ کپ'] : ['None', '1-2 cups', '3-4 cups', '5+ cups'] },
        { question: language === 'ur' ? 'آپ کا تناؤ نیند کو کتنا متاثر کرتا ہے؟' : 'How much does stress affect your sleep?', options: language === 'ur' ? ['بہت زیادہ', 'کچھ حد تک', 'تھوڑا', 'بالکل نہیں'] : ['Very much', 'Somewhat', 'A little', 'Not at all'] },
        { question: language === 'ur' ? 'آپ عام طور پر کتنے بجے سوتے ہیں؟' : 'What time do you usually go to bed?', options: language === 'ur' ? ['9 بجے سے پہلے', '9-11 بجے', '11-1 بجے', '1 بجے کے بعد'] : ['Before 9 PM', '9-11 PM', '11 PM-1 AM', 'After 1 AM'] },
        { question: language === 'ur' ? 'کیا آپ سونے سے پہلے ورزش کرتے ہیں؟' : 'Do you exercise close to bedtime?', options: language === 'ur' ? ['ہاں، 2 گھنٹے پہلے', 'ہاں، 4 گھنٹے پہلے', 'صبح/دوپہر', 'ورزش نہیں کرتا'] : ['Yes, within 2 hours', 'Yes, within 4 hours', 'Morning/afternoon', 'I don\'t exercise'] },
      ],
      stress_wellness: [
        { question: language === 'ur' ? 'آپ کا تناؤ کب سب سے زیادہ ہوتا ہے؟' : 'When do you feel most stressed?', options: language === 'ur' ? ['صبح', 'دوپہر', 'شام', 'رات'] : ['Morning', 'Afternoon', 'Evening', 'Night'] },
        { question: language === 'ur' ? 'آپ تناؤ کو کیسے مینج کرتے ہیں؟' : 'How do you currently manage stress?', options: language === 'ur' ? ['ورزش', 'مراقبہ', 'دوستوں سے بات', 'کچھ نہیں'] : ['Exercise', 'Meditation', 'Talking to friends', 'Nothing'] },
        { question: language === 'ur' ? 'تناؤ آپ کی روزمرہ زندگی کو کس طرح متاثر کرتا ہے؟' : 'How does stress affect your daily life?', options: language === 'ur' ? ['بہت زیادہ', 'کچھ حد تک', 'کم', 'بہت کم'] : ['Very much', 'Somewhat', 'A little', 'Not much'] },
        { question: language === 'ur' ? 'آپ کے تناؤ کی بنیادی وجہ کیا ہے؟' : 'What is the main source of your stress?', options: language === 'ur' ? ['کام', 'رشتے', 'مالی', 'صحت'] : ['Work', 'Relationships', 'Financial', 'Health'] },
        { question: language === 'ur' ? 'کیا آپ نے کبھی مراقبہ یا مائنڈفلنیس کی مشق کی ہے؟' : 'Have you ever practiced meditation or mindfulness?', options: language === 'ur' ? ['باقاعدگی سے', 'کبھی کبھار', 'ایک بار', 'کبھی نہیں'] : ['Regularly', 'Occasionally', 'Tried once', 'Never'] },
        { question: language === 'ur' ? 'تناؤ آپ کی نیند کو کتنا متاثر کرتا ہے؟' : 'How much does stress affect your sleep quality?', options: language === 'ur' ? ['بہت زیادہ', 'کچھ حد تک', 'تھوڑا', 'بالکل نہیں'] : ['Severely', 'Moderately', 'Slightly', 'Not at all'] },
        { question: language === 'ur' ? 'آپ کتنی بار بے چینی محسوس کرتے ہیں؟' : 'How often do you feel anxious or overwhelmed?', options: language === 'ur' ? ['روزانہ', 'ہفتے میں کئی بار', 'ہفتے میں ایک بار', 'شاذ و نادر'] : ['Daily', 'Several times a week', 'Once a week', 'Rarely'] },
        { question: language === 'ur' ? 'آپ کو ذہنی سکون کے لیے کیا چاہیے؟' : 'What would help you feel more at peace?', options: language === 'ur' ? ['بہتر نیند', 'ورزش', 'سماجی تعلقات', 'فارغ وقت'] : ['Better sleep', 'Exercise routine', 'Social connections', 'More free time'] },
      ],
      energy_productivity: [
        { question: language === 'ur' ? 'آپ کی توانائی کا لیول دن میں کب سب سے زیادہ ہوتا ہے؟' : 'When is your energy level highest during the day?', options: language === 'ur' ? ['صبح', 'دوپہر', 'شام', 'رات'] : ['Morning', 'Afternoon', 'Evening', 'Night'] },
        { question: language === 'ur' ? 'آپ کتنے گھنٹے کام کرتے ہیں؟' : 'How many hours do you work per day?', options: language === 'ur' ? ['4-6 گھنٹے', '6-8 گھنٹے', '8-10 گھنٹے', '10+ گھنٹے'] : ['4-6 hours', '6-8 hours', '8-10 hours', '10+ hours'] },
        { question: language === 'ur' ? 'آپ کی توانائی کو کیا متاثر کرتا ہے؟' : 'What affects your energy levels most?', options: language === 'ur' ? ['نیند', 'خوراک', 'ورزش', 'تناؤ'] : ['Sleep', 'Nutrition', 'Exercise', 'Stress'] },
        { question: language === 'ur' ? 'آپ دوپہر کو کتنا تھکا ہوا محسوس کرتے ہیں؟' : 'How often do you experience an afternoon energy crash?', options: language === 'ur' ? ['روزانہ', 'اکثر', 'کبھی کبھار', 'کبھی نہیں'] : ['Every day', 'Most days', 'Sometimes', 'Rarely'] },
        { question: language === 'ur' ? 'آپ کی صبح کی عادت کیا ہے؟' : 'What does your morning routine look like?', options: language === 'ur' ? ['ورزش + ناشتا', 'صرف ناشتا', 'صرف چائے/کافی', 'کوئی معمول نہیں'] : ['Exercise + breakfast', 'Just breakfast', 'Just coffee/tea', 'No routine'] },
        { question: language === 'ur' ? 'آپ دن میں کتنا پانی پیتے ہیں؟' : 'How much water do you drink during the day?', options: language === 'ur' ? ['2 گلاس سے کم', '2-4 گلاس', '5-8 گلاس', '8+ گلاس'] : ['Less than 2 glasses', '2-4 glasses', '5-8 glasses', '8+ glasses'] },
        { question: language === 'ur' ? 'آپ کتنے گھنٹے سوتے ہیں؟' : 'How many hours of sleep do you get?', options: language === 'ur' ? ['4 سے کم', '4-6 گھنٹے', '6-8 گھنٹے', '8+ گھنٹے'] : ['Less than 4', '4-6 hours', '6-8 hours', '8+ hours'] },
        { question: language === 'ur' ? 'آپ کام کے دوران کتنے وقفے لیتے ہیں؟' : 'How often do you take breaks during work?', options: language === 'ur' ? ['ہر 30 منٹ', 'ہر گھنٹے', 'ہر 2+ گھنٹے', 'شاذ و نادر'] : ['Every 30 minutes', 'Every hour', 'Every 2+ hours', 'Rarely'] },
      ],
      event_training: [
        { question: language === 'ur' ? 'آپ کس قسم کے ایونٹ کے لیے ٹریننگ کر رہے ہیں؟' : 'What type of event are you training for?', options: language === 'ur' ? ['ماراتھن', 'ٹرائیتھلون', 'ویٹ لفٹنگ', 'دوسرا'] : ['Marathon', 'Triathlon', 'Weightlifting', 'Other'] },
        { question: language === 'ur' ? 'ایونٹ کب ہے؟' : 'When is the event?', options: language === 'ur' ? ['1 ماہ میں', '3 ماہ میں', '6 ماہ میں', 'ایک سال میں'] : ['In 1 month', 'In 3 months', 'In 6 months', 'In 1 year'] },
        { question: language === 'ur' ? 'آپ کا موجودہ فٹنس لیول کیا ہے؟' : 'What is your current fitness level?', options: language === 'ur' ? ['ابتدائی', 'درمیانی', 'اعلیٰ', 'پیشہ ورانہ'] : ['Beginner', 'Intermediate', 'Advanced', 'Elite'] },
        { question: language === 'ur' ? 'آپ ہفتے میں کتنے دن ٹریننگ کرتے ہیں؟' : 'How many days per week do you currently train?', options: language === 'ur' ? ['1-2 دن', '3-4 دن', '5-6 دن', 'روزانہ'] : ['1-2 days', '3-4 days', '5-6 days', 'Every day'] },
        { question: language === 'ur' ? 'کیا آپ نے پہلے کوئی ایونٹ مکمل کیا ہے؟' : 'Have you completed a similar event before?', options: language === 'ur' ? ['ہاں، کئی بار', 'ہاں، ایک بار', 'نہیں، پہلی بار', 'اسی طرح کا'] : ['Yes, multiple times', 'Yes, once', 'No, first time', 'Similar events'] },
        { question: language === 'ur' ? 'آپ کی غذائیت کی حکمت عملی کیا ہے؟' : 'What is your nutrition strategy for training?', options: language === 'ur' ? ['منصوبہ بند', 'کچھ حد تک', 'کوئی نہیں', 'مدد چاہیے'] : ['Structured plan', 'Somewhat planned', 'No plan', 'Need help'] },
        { question: language === 'ur' ? 'آپ کی سب سے بڑی فکر کیا ہے؟' : 'What is your biggest concern about the event?', options: language === 'ur' ? ['ناکامی', 'چوٹ', 'وقت کم', 'تجربہ نہیں'] : ['Not finishing', 'Injury', 'Not enough time', 'Lack of experience'] },
        { question: language === 'ur' ? 'آپ کی ریکوری کی عادت کیا ہے؟' : 'What does your recovery routine look like?', options: language === 'ur' ? ['اسٹریچنگ + نیند', 'صرف آرام', 'کوئی معمول نہیں', 'مکمل ریکوری'] : ['Stretching + sleep', 'Just rest', 'No routine', 'Full recovery protocol'] },
      ],
      health_condition: [
        { question: language === 'ur' ? 'آپ کس قسم کی صحت کی حالت کا انتظام کر رہے ہیں؟' : 'What type of health condition are you managing?', options: language === 'ur' ? ['ذیابیطس', 'بلڈ پریشر', 'جوڑوں کا درد', 'دوسری'] : ['Diabetes', 'Blood pressure', 'Joint pain', 'Other'] },
        { question: language === 'ur' ? 'آپ کی صحت کی حالت آپ کی روزمرہ زندگی کو کس طرح متاثر کرتی ہے؟' : 'How does your health condition affect your daily life?', options: language === 'ur' ? ['بہت زیادہ', 'کچھ حد تک', 'کم', 'بہت کم'] : ['Very much', 'Somewhat', 'A little', 'Not much'] },
        { question: language === 'ur' ? 'آپ کیا تبدیلیاں کرنا چاہتے ہیں؟' : 'What changes would you like to make?', options: language === 'ur' ? ['خوراک', 'ورزش', 'نیند', 'سب کچھ'] : ['Nutrition', 'Exercise', 'Sleep', 'Everything'] },
        { question: language === 'ur' ? 'کیا آپ ڈاکٹر کی نگرانی میں ہیں؟' : 'Are you under medical supervision?', options: language === 'ur' ? ['ہاں، باقاعدہ', 'ہاں، کبھی کبھار', 'نہیں', 'جلد ملاقات ہے'] : ['Yes, regularly', 'Yes, occasionally', 'No', 'Have an upcoming visit'] },
        { question: language === 'ur' ? 'کیا آپ کوئی دوائی لیتے ہیں؟' : 'Are you currently taking any medications?', options: language === 'ur' ? ['ہاں، روزانہ', 'ہاں، ضرورت کے مطابق', 'نہیں', 'صرف سپلیمنٹس'] : ['Yes, daily', 'Yes, as needed', 'No', 'Only supplements'] },
        { question: language === 'ur' ? 'آپ کی ورزش کی صلاحیت کیا ہے؟' : 'What is your exercise capacity given your condition?', options: language === 'ur' ? ['مکمل ورزش', 'ہلکی ورزش', 'بہت محدود', 'یقین نہیں'] : ['Full exercise', 'Light exercise', 'Very limited', 'Not sure'] },
        { question: language === 'ur' ? 'آپ کی خوراک میں کوئی پابندیاں ہیں؟' : 'Do you have any dietary restrictions due to your condition?', options: language === 'ur' ? ['ہاں، سخت', 'ہاں، کچھ', 'نہیں', 'یقین نہیں'] : ['Yes, strict', 'Yes, some', 'No', 'Not sure'] },
        { question: language === 'ur' ? 'آپ کا سب سے بڑا خدشہ کیا ہے؟' : 'What is your biggest health concern right now?', options: language === 'ur' ? ['بگڑنا', 'دوائی کے اثرات', 'روزمرہ زندگی', 'مستقبل'] : ['Getting worse', 'Medication side effects', 'Daily limitations', 'Future outlook'] },
      ],
      habit_building: [
        { question: language === 'ur' ? 'آپ کون سا عادت بنانا چاہتے ہیں؟' : 'What habit would you like to build?', options: language === 'ur' ? ['روزانہ ورزش', 'صحت مند کھانا', 'بہتر نیند', 'دوسری'] : ['Daily exercise', 'Healthy eating', 'Better sleep', 'Other'] },
        { question: language === 'ur' ? 'آپ نے پہلے کبھی یہ عادت بنانے کی کوشش کی ہے؟' : 'Have you tried building this habit before?', options: language === 'ur' ? ['ہاں، کامیاب', 'ہاں، ناکام', 'نہیں', 'کبھی کبھار'] : ['Yes, successful', 'Yes, failed', 'No', 'Sometimes'] },
        { question: language === 'ur' ? 'آپ کو کیا رکاوٹیں آتی ہیں؟' : 'What barriers do you face?', options: language === 'ur' ? ['وقت نہیں', 'حوصلہ نہیں', 'علم نہیں', 'دوسری'] : ['No time', 'No motivation', 'No knowledge', 'Other'] },
        { question: language === 'ur' ? 'آپ کس وقت عادت پر عمل کرنا چاہتے ہیں؟' : 'When would you prefer to practice this habit?', options: language === 'ur' ? ['صبح', 'دوپہر', 'شام', 'لچکدار'] : ['Morning', 'Afternoon', 'Evening', 'Flexible'] },
        { question: language === 'ur' ? 'آپ کو جوابدہی کس طرح پسند ہے؟' : 'How do you prefer to stay accountable?', options: language === 'ur' ? ['ایپ ریمائنڈرز', 'دوست/ساتھی', 'خود', 'کوچ'] : ['App reminders', 'Friend/partner', 'Self-motivated', 'Coach'] },
        { question: language === 'ur' ? 'آپ کتنا وقت دے سکتے ہیں؟' : 'How much time can you dedicate daily to this habit?', options: language === 'ur' ? ['10 منٹ', '15-30 منٹ', '30-60 منٹ', '1+ گھنٹہ'] : ['10 minutes', '15-30 minutes', '30-60 minutes', '1+ hours'] },
        { question: language === 'ur' ? 'آپ کی سب سے کامیاب عادت کیا رہی ہے؟' : 'What has been your most successful habit in the past?', options: language === 'ur' ? ['ورزش', 'صحت مند کھانا', 'پڑھنا', 'کوئی نہیں'] : ['Exercise routine', 'Healthy eating', 'Reading', 'None yet'] },
        { question: language === 'ur' ? 'آپ کا حوصلہ کیسے بڑھتا ہے؟' : 'What motivates you most to keep going?', options: language === 'ur' ? ['نتائج دیکھنا', 'اچھا محسوس کرنا', 'مقابلہ', 'سپورٹ سسٹم'] : ['Seeing results', 'Feeling good', 'Competition', 'Support system'] },
      ],
      overall_optimization: [
        { question: language === 'ur' ? 'آپ کی صحت کا کون سا پہلو سب سے زیادہ بہتری چاہتا ہے؟' : 'Which aspect of your health needs the most improvement?', options: language === 'ur' ? ['فٹنس', 'خوراک', 'نیند', 'ذہنی صحت'] : ['Fitness', 'Nutrition', 'Sleep', 'Mental health'] },
        { question: language === 'ur' ? 'آپ اپنی صحت کو کس طرح ترجیح دیتے ہیں؟' : 'How do you prioritize your health?', options: language === 'ur' ? ['بہت زیادہ', 'کچھ حد تک', 'کم', 'بہت کم'] : ['Very much', 'Somewhat', 'A little', 'Not much'] },
        { question: language === 'ur' ? 'آپ کیا تبدیلیاں کرنے کے لیے تیار ہیں؟' : 'What changes are you ready to make?', options: language === 'ur' ? ['چھوٹی تبدیلیاں', 'درمیانی تبدیلیاں', 'بڑی تبدیلیاں', 'سب کچھ'] : ['Small changes', 'Moderate changes', 'Big changes', 'Everything'] },
        { question: language === 'ur' ? 'آپ کتنی بار ورزش کرتے ہیں؟' : 'How often do you currently exercise?', options: language === 'ur' ? ['کبھی نہیں', 'ہفتے میں 1-2 بار', 'ہفتے میں 3-4 بار', 'روزانہ'] : ['Never', '1-2 times per week', '3-4 times per week', 'Daily'] },
        { question: language === 'ur' ? 'آپ کی غذائی عادات کیسی ہیں؟' : 'How would you describe your eating habits?', options: language === 'ur' ? ['بہت اچھی', 'ٹھیک ہیں', 'بہتری چاہیے', 'بہت خراب'] : ['Very good', 'Decent', 'Needs improvement', 'Poor'] },
        { question: language === 'ur' ? 'آپ کا تناؤ کا لیول کیا ہے؟' : 'How would you rate your current stress level?', options: language === 'ur' ? ['بہت کم', 'کم', 'درمیانی', 'زیادہ'] : ['Very low', 'Low', 'Moderate', 'High'] },
        { question: language === 'ur' ? 'آپ کتنے گھنٹے سوتے ہیں؟' : 'How many hours of sleep do you get per night?', options: language === 'ur' ? ['4 سے کم', '4-6 گھنٹے', '6-8 گھنٹے', '8+ گھنٹے'] : ['Less than 4', '4-6 hours', '6-8 hours', '8+ hours'] },
        { question: language === 'ur' ? 'آپ کو کس قسم کی مدد چاہیے؟' : 'What kind of support do you need most?', options: language === 'ur' ? ['منصوبہ بندی', 'حوصلہ افزائی', 'ٹریکنگ', 'تعلیم'] : ['Planning', 'Motivation', 'Tracking', 'Education'] },
      ],
      custom: [
        { question: language === 'ur' ? 'آپ کا صحت کا بنیادی مقصد کیا ہے؟' : 'What is your primary health goal?', options: language === 'ur' ? ['بہتر محسوس کرنا', 'زیادہ فعال ہونا', 'بہتر کھانا', 'بہتر سونا'] : ['Feel better', 'Be more active', 'Eat better', 'Sleep better'] },
        { question: language === 'ur' ? 'آپ کیا تبدیلیاں کرنا چاہتے ہیں؟' : 'What changes would you like to make?', options: language === 'ur' ? ['خوراک', 'ورزش', 'نیند', 'سب کچھ'] : ['Nutrition', 'Exercise', 'Sleep', 'Everything'] },
        { question: language === 'ur' ? 'آپ کیا چیلنجز کا سامنا کر رہے ہیں؟' : 'What challenges are you facing?', options: language === 'ur' ? ['وقت نہیں', 'حوصلہ نہیں', 'علم نہیں', 'دوسری'] : ['No time', 'No motivation', 'No knowledge', 'Other'] },
        { question: language === 'ur' ? 'آپ کتنی بار ورزش کرتے ہیں؟' : 'How often do you currently exercise?', options: language === 'ur' ? ['کبھی نہیں', 'ہفتے میں 1-2 بار', 'ہفتے میں 3-4 بار', 'روزانہ'] : ['Never', '1-2 times per week', '3-4 times per week', 'Daily'] },
        { question: language === 'ur' ? 'آپ کا تناؤ کا لیول کیا ہے؟' : 'How would you rate your stress level?', options: language === 'ur' ? ['بہت کم', 'کم', 'درمیانی', 'زیادہ'] : ['Very low', 'Low', 'Moderate', 'High'] },
        { question: language === 'ur' ? 'آپ کتنے گھنٹے سوتے ہیں؟' : 'How many hours of sleep do you get?', options: language === 'ur' ? ['4 سے کم', '4-6 گھنٹے', '6-8 گھنٹے', '8+ گھنٹے'] : ['Less than 4', '4-6 hours', '6-8 hours', '8+ hours'] },
        { question: language === 'ur' ? 'آپ کتنا پانی پیتے ہیں؟' : 'How much water do you drink daily?', options: language === 'ur' ? ['2 گلاس سے کم', '2-4 گلاس', '5-8 گلاس', '8+ گلاس'] : ['Less than 2 glasses', '2-4 glasses', '5-8 glasses', '8+ glasses'] },
        { question: language === 'ur' ? 'آپ اپنے مقصد کے لیے کتنے پرعزم ہیں؟' : 'How committed are you to achieving your goal?', options: language === 'ur' ? ['بہت زیادہ', 'کافی حد تک', 'کچھ حد تک', 'یقین نہیں'] : ['Very committed', 'Fairly committed', 'Somewhat', 'Not sure'] },
      ],
    };

    const questionPool = goalQuestions[goal] || goalQuestions.custom;

    // Deduplicate: skip questions already asked
    const askedQuestions = new Set(
      previousAnswers.map(a => a.questionText?.toLowerCase().trim()).filter(Boolean)
    );

    const unusedQuestion = questionPool.find(
      q => !askedQuestions.has(q.question.toLowerCase().trim())
    );

    // Use first unused question, or last in pool as final fallback
    const selectedQuestion = unusedQuestion || questionPool[questionPool.length - 1];

    const options: MCQOption[] = selectedQuestion.options.map((opt, idx) => ({
      id: `opt-${idx + 1}`,
      text: opt,
      insightValue: opt.toLowerCase().replace(/\s+/g, '_'),
    }));

    // Calculate progress same way as main function
    const targetQuestions = 7;
    const questionsAnswered = previousAnswers.length;
    const currentQuestionNumber = questionsAnswered + 1;
    const progress = Math.min(100, Math.round((currentQuestionNumber / targetQuestions) * 100));
    const isComplete = questionsAnswered >= 6;

    return {
      question: {
        id: questionId,
        question: selectedQuestion.question,
        options,
      },
      phase,
      progress,
      isComplete,
      insights: [],
    };
  }

  /**
   * Process an MCQ answer and extract insights
   */
  async processMCQAnswer(
    questionId: string,
    selectedOptions: MCQOption[],
    goal: GoalCategory
  ): Promise<ExtractedInsight[]> {
    try {
      const insights: ExtractedInsight[] = [];

      // Extract insights from selected options
      for (const option of selectedOptions) {
        const insight: ExtractedInsight = {
          category: goal,
          text: option.text || option.insightValue || 'User selected an option',
          confidence: 0.8, // Default confidence for MCQ answers
        };
        insights.push(insight);
      }

      // Add goal-specific insights
      if (selectedOptions.length > 0) {
        const primaryOption = selectedOptions[0];
        insights.push({
          category: 'motivation',
          text: `User's primary focus: ${primaryOption.text || primaryOption.insightValue || 'Not specified'}`,
          confidence: 0.9,
        });
      }

      return insights;
    } catch (error) {
      logger.error('[AICoach] Error processing MCQ answer', {
        questionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw ApiError.internal('Failed to process MCQ answer');
    }
  }
}

export const aiCoachService = new AICoachService();
export default aiCoachService;