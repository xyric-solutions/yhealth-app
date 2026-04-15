/**
 * @file TensorFlow Sentiment Analysis Service
 * @description Fast, local sentiment analysis using TensorFlow.js and Universal Sentence Encoder
 */

import { logger } from './logger.service.js';
import { emotionDetectionService } from './emotion-detection.service.js';

// ============================================
// TYPES
// ============================================

export interface SentimentResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number; // 0-1
  score: number; // -1 to 1, where -1 is very negative, 1 is very positive
  method: 'tensorflow' | 'llm_fallback' | 'keyword_fallback';
}

// Reference vectors for sentiment classification
// These are learned from training data - positive and negative examples
const POSITIVE_REFERENCE = [
  'I feel great today',
  'This is amazing',
  'I love this',
  'I am happy',
  'Everything is wonderful',
  'I feel energized',
  'This makes me excited',
  'I am grateful',
  'Life is good',
  'I feel confident',
];

const NEGATIVE_REFERENCE = [
  'I feel terrible',
  'This is awful',
  'I hate this',
  'I am sad',
  'Everything is wrong',
  'I feel exhausted',
  'This makes me anxious',
  'I am stressed',
  'Life is hard',
  'I feel hopeless',
];

// ============================================
// SERVICE CLASS
// ============================================

class TensorFlowSentimentService {
  private model: any = null;
  private isModelLoading = false;
  private modelLoadPromise: Promise<void> | null = null;
  private cache: Map<string, SentimentResult> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private cacheTimestamps: Map<string, number> = new Map();
  private tensorflowAvailable = false;
  private availabilityChecked = false; // Track if we've checked availability
  private availabilityCheckLogged = false; // Track if we've logged the warning

  constructor() {
    // Check if TensorFlow is available (will be checked on first use)
  }

  /**
   * Check if TensorFlow packages are available
   */
  private async checkTensorFlowAvailability(): Promise<boolean> {
    if (this.tensorflowAvailable) {
      return true;
    }

    // If we've already checked and it's not available, skip the check
    if (this.availabilityChecked && !this.tensorflowAvailable) {
      return false;
    }

    try {
      // Try to dynamically import TensorFlow packages
      await import('@tensorflow/tfjs-node');
      await import('@tensorflow-models/universal-sentence-encoder');
      this.tensorflowAvailable = true;
      this.availabilityChecked = true;
      return true;
    } catch (error) {
      this.availabilityChecked = true;
      this.tensorflowAvailable = false;
      
      // Only log warning once to avoid log spam
      if (!this.availabilityCheckLogged) {
        logger.info('[TensorFlowSentiment] TensorFlow native addon not available on this platform, using LLM fallback (Gemini emotion detection)');
        this.availabilityCheckLogged = true;
      } else {
        logger.debug('[TensorFlowSentiment] TensorFlow not available, using LLM fallback');
      }
      
      return false;
    }
  }

  /**
   * Load the Universal Sentence Encoder model
   */
  private async loadModel(): Promise<void> {
    if (this.model) {
      return;
    }

    if (this.isModelLoading && this.modelLoadPromise) {
      return this.modelLoadPromise;
    }

    // Check if TensorFlow is available first
    const isAvailable = await this.checkTensorFlowAvailability();
    if (!isAvailable) {
      this.model = null;
      return;
    }

    this.isModelLoading = true;
    this.modelLoadPromise = (async () => {
      try {
        logger.info('[TensorFlowSentiment] Loading Universal Sentence Encoder model...');
        const use = await import('@tensorflow-models/universal-sentence-encoder');
        this.model = await use.load();
        logger.info('[TensorFlowSentiment] Model loaded successfully');
      } catch (error) {
        logger.error('[TensorFlowSentiment] Failed to load model', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        this.model = null;
        this.tensorflowAvailable = false;
      } finally {
        this.isModelLoading = false;
      }
    })();

    return this.modelLoadPromise;
  }

  /**
   * Analyze sentiment of text using TensorFlow
   */
  async analyzeSentiment(text: string): Promise<SentimentResult> {
    // Check cache first
    const cacheKey = text.toLowerCase().trim();
    const cached = this.cache.get(cacheKey);
    const cacheTime = this.cacheTimestamps.get(cacheKey);
    
    if (cached && cacheTime && Date.now() - cacheTime < this.CACHE_TTL) {
      return cached;
    }

    try {
      // Check if TensorFlow is available first
      const isAvailable = await this.checkTensorFlowAvailability();
      if (!isAvailable) {
        logger.debug('[TensorFlowSentiment] TensorFlow not available, using LLM fallback');
        return this.fallbackToLLM(text);
      }

      // Load model if not loaded
      await this.loadModel();

      if (!this.model) {
        logger.warn('[TensorFlowSentiment] Model not available, using LLM fallback');
        return this.fallbackToLLM(text);
      }

      // Get embeddings for input text and reference sentences
      const [textEmbedding, positiveEmbeddings, negativeEmbeddings] = await Promise.all([
        this.model.embed([text]),
        this.model.embed(POSITIVE_REFERENCE),
        this.model.embed(NEGATIVE_REFERENCE),
      ]);

      // Calculate cosine similarity with positive and negative references
      const positiveSimilarity = this.cosineSimilarity(
        textEmbedding.arraySync()[0],
        this.averageEmbedding(positiveEmbeddings.arraySync())
      );

      const negativeSimilarity = this.cosineSimilarity(
        textEmbedding.arraySync()[0],
        this.averageEmbedding(negativeEmbeddings.arraySync())
      );

      // Calculate sentiment score (-1 to 1)
      const score = positiveSimilarity - negativeSimilarity;

      // Determine sentiment category
      let sentiment: 'positive' | 'negative' | 'neutral';
      let confidence: number;

      if (score > 0.15) {
        sentiment = 'positive';
        confidence = Math.min(1, 0.5 + Math.abs(score) * 0.5);
      } else if (score < -0.15) {
        sentiment = 'negative';
        confidence = Math.min(1, 0.5 + Math.abs(score) * 0.5);
      } else {
        sentiment = 'neutral';
        confidence = 0.5 + (0.15 - Math.abs(score)) / 0.15 * 0.3;
      }

      const result: SentimentResult = {
        sentiment,
        confidence,
        score,
        method: 'tensorflow',
      };

      // Cache result
      this.cache.set(cacheKey, result);
      this.cacheTimestamps.set(cacheKey, Date.now());

      return result;
    } catch (error) {
      logger.error('[TensorFlowSentiment] Error analyzing sentiment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        textLength: text.length,
      });
      return this.fallbackToLLM(text);
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) {
      return 0;
    }

    return dotProduct / denominator;
  }

  /**
   * Calculate average embedding from multiple embeddings
   */
  private averageEmbedding(embeddings: number[][]): number[] {
    if (embeddings.length === 0) {
      return [];
    }

    const dimension = embeddings[0].length;
    const average = new Array(dimension).fill(0);

    for (const embedding of embeddings) {
      for (let i = 0; i < dimension; i++) {
        average[i] += embedding[i];
      }
    }

    for (let i = 0; i < dimension; i++) {
      average[i] /= embeddings.length;
    }

    return average;
  }

  /**
   * Fallback to LLM-based emotion detection (uses DeepSeek → Gemini cascade via emotionDetectionService)
   */
  private async fallbackToLLM(text: string): Promise<SentimentResult> {
    try {
      const emotion = await emotionDetectionService.detectEmotionFromText(text);
      
      // Map emotion categories to sentiment
      const positiveEmotions: string[] = ['happy', 'calm', 'excited'];
      const negativeEmotions: string[] = ['sad', 'angry', 'anxious', 'stressed', 'distressed', 'tired'];
      
      let sentiment: 'positive' | 'negative' | 'neutral';
      if (positiveEmotions.includes(emotion.category)) {
        sentiment = 'positive';
      } else if (negativeEmotions.includes(emotion.category)) {
        sentiment = 'negative';
      } else {
        sentiment = 'neutral';
      }

      // Convert confidence (0-100) to 0-1
      const confidence = emotion.confidence / 100;
      
      // Estimate score from emotion
      let score = 0;
      if (sentiment === 'positive') {
        score = 0.3 + confidence * 0.5;
      } else if (sentiment === 'negative') {
        score = -0.3 - confidence * 0.5;
      }

      return {
        sentiment,
        confidence,
        score,
        method: 'llm_fallback',
      };
    } catch (error) {
      logger.warn('[TensorFlowSentiment] LLM fallback failed, using keyword fallback', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return this.keywordFallback(text);
    }
  }

  /**
   * Simple keyword-based fallback
   */
  private keywordFallback(text: string): SentimentResult {
    const lowerText = text.toLowerCase();

    const positiveKeywords = [
      'happy', 'great', 'good', 'excited', 'love', 'amazing', 'wonderful',
      'fantastic', 'awesome', 'grateful', 'thankful', 'blessed', 'energized',
      'confident', 'proud', 'relieved', 'calm', 'peaceful', 'content',
    ];

    const negativeKeywords = [
      'sad', 'bad', 'terrible', 'awful', 'hate', 'angry', 'frustrated',
      'anxious', 'worried', 'stressed', 'overwhelmed', 'exhausted', 'tired',
      'hopeless', 'depressed', 'upset', 'disappointed', 'hurt', 'pain',
    ];

    let positiveCount = 0;
    let negativeCount = 0;

    for (const keyword of positiveKeywords) {
      if (lowerText.includes(keyword)) {
        positiveCount++;
      }
    }

    for (const keyword of negativeKeywords) {
      if (lowerText.includes(keyword)) {
        negativeCount++;
      }
    }

    let sentiment: 'positive' | 'negative' | 'neutral';
    let score: number;
    let confidence: number;

    if (positiveCount > negativeCount && positiveCount > 0) {
      sentiment = 'positive';
      score = Math.min(0.7, 0.3 + positiveCount * 0.1);
      confidence = Math.min(0.8, 0.5 + positiveCount * 0.1);
    } else if (negativeCount > positiveCount && negativeCount > 0) {
      sentiment = 'negative';
      score = Math.max(-0.7, -0.3 - negativeCount * 0.1);
      confidence = Math.min(0.8, 0.5 + negativeCount * 0.1);
    } else {
      sentiment = 'neutral';
      score = 0;
      confidence = 0.5;
    }

    return {
      sentiment,
      confidence,
      score,
      method: 'keyword_fallback',
    };
  }

  /**
   * Clear cache (useful for testing or memory management)
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }

  /**
   * Check if model is loaded
   */
  isModelLoaded(): boolean {
    return this.model !== null;
  }
}

export const tensorflowSentimentService = new TensorFlowSentimentService();
export default tensorflowSentimentService;

