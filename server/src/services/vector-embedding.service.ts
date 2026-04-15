import { OpenAIEmbeddings } from '@langchain/openai';
import { Embeddings } from '@langchain/core/embeddings';
import { env } from '../config/env.config.js';
import { logger } from './logger.service.js';
import { query } from '../database/pg.js';

/**
 * Thrown when an embedding provider returns an authentication error (401/403).
 * Signals to BullMQ worker that retries are pointless.
 */
export class EmbeddingAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmbeddingAuthError';
  }
}

// Task types for Gemini embeddings
type GeminiTaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' | 'SEMANTIC_SIMILARITY' | 'CLASSIFICATION' | 'CLUSTERING';

/**
 * Direct REST-based Gemini Embedding 2 — bypasses @google/generative-ai SDK entirely.
 * Verified available models via ListModels API: gemini-embedding-2-preview (768 dims with outputDimensionality).
 * Uses outputDimensionality=768 to match existing pgvector columns.
 */
class GeminiDirectEmbeddings extends Embeddings {
  private apiKey: string;
  private model: string;
  private outputDimensionality: number;
  taskType: GeminiTaskType;

  constructor(fields: { apiKey: string; model?: string; taskType?: GeminiTaskType; outputDimensionality?: number }) {
    super({});
    this.apiKey = fields.apiKey;
    this.model = fields.model || 'gemini-embedding-2-preview';
    this.taskType = fields.taskType || 'RETRIEVAL_DOCUMENT';
    this.outputDimensionality = fields.outputDimensionality || 768;
  }

  async embedQuery(text: string): Promise<number[]> {
    return this._embed(text, this.taskType);
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (const doc of documents) {
      results.push(await this._embed(doc, 'RETRIEVAL_DOCUMENT'));
    }
    return results;
  }

  private async _embed(text: string, taskType: GeminiTaskType): Promise<number[]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:embedContent?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${this.model}`,
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: this.outputDimensionality,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Gemini embedding error (${response.status}): ${errorBody}`);
    }

    const data = await response.json() as { embedding: { values: number[] } };
    return data.embedding.values;
  }
}

// Embedding provider type
type EmbeddingProvider = OpenAIEmbeddings | GeminiDirectEmbeddings;

// ============================================================================
// Types
// ============================================================================

export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
}

export interface VectorSearchResult {
  id: string;
  content: string;
  sourceType: string;
  sourceId: string;
  metadata: Record<string, unknown>;
  similarity: number;
  createdAt: Date;
}

export interface ConversationSearchResult {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  similarity: number;
  sequenceNumber: number;
  createdAt: Date;
}

export interface KnowledgeSearchResult {
  id: string;
  category: string;
  subcategory: string | null;
  title: string;
  content: string;
  tags: string[];
  similarity: number;
  trustScore: number;
}

// ============================================================================
// Vector Embedding Service
// ============================================================================

class VectorEmbeddingService {
  private embeddings: EmbeddingProvider;
  private providerName: string;
  private fallbackProviders: Array<{ name: string; create: () => EmbeddingProvider }> = [];
  private readonly dimensions: number;
  private vectorExtensionAvailable: boolean | null = null; // null = not checked yet
  private extensionCheckPromise: Promise<boolean> | null = null;
  private geminiEmbeddings: GeminiDirectEmbeddings | null = null;
  /** In-flight de-duplication: concurrent embedText() calls for the same text share one API request */
  private embeddingInflight: Map<string, Promise<number[]>> = new Map();
  /** Primary provider factory for auto-recovery after quota cooldown */
  private primaryProvider: { name: string; create: () => EmbeddingProvider } | null = null;
  /** Timestamp when fallback was activated (null = using primary) */
  private fallbackActivatedAt: number | null = null;
  /** Cooldown before attempting to recover primary provider (60s = typical quota reset) */
  private readonly primaryCooldownMs = 60_000;

  constructor() {
    // Initialize embedding provider with fallback chain: OpenAI → Gemini
    const { embeddings, providerName, dimensions, fallbacks } = this.initializeProvider();
    this.embeddings = embeddings;
    this.providerName = providerName;
    this.dimensions = dimensions;
    this.fallbackProviders = fallbacks;

    logger.info(`[VectorEmbedding] Using ${this.providerName} for embeddings (dimensions: ${this.dimensions})`);

    // Check vector extension availability on startup (non-blocking)
    this.checkVectorExtension()
      .then((available) => {
        if (!available) {
          logger.info('[VectorEmbedding] Running in text search mode (pgvector extension not available). For better search results, install pgvector: https://github.com/pgvector/pgvector#installation');
        } else {
          logger.info('[VectorEmbedding] Vector search enabled (pgvector extension available)');
        }
      })
      .catch(() => {
        // Silently fail - will be checked on first use
      });
  }

  /**
   * Check if an API key looks like a real key (not a placeholder).
   */
  private static isValidApiKey(key: string | undefined): boolean {
    if (!key || key.length < 10) return false;
    const placeholders = [
      /^your[_-]?key/i,
      /^sk-xxx/i,
      /^placeholder/i,
      /^change[_-]?me/i,
      /^insert[_-]?/i,
      /^todo/i,
      /^REPLACE/i,
      /^test[_-]?key/i,
      /^fake[_-]?/i,
      /^dummy/i,
    ];
    return !placeholders.some((re) => re.test(key));
  }

  /**
   * Initialize embedding provider with fallback chain.
   * Priority: Gemini → OpenAI
   */
  private initializeProvider(): {
    embeddings: EmbeddingProvider;
    providerName: string;
    dimensions: number;
    fallbacks: Array<{ name: string; create: () => EmbeddingProvider }>;
  } {
    const providers: Array<{
      name: string;
      available: boolean;
      create: () => EmbeddingProvider;
      dimensions: number;
    }> = [
      {
        name: 'gemini',
        available: VectorEmbeddingService.isValidApiKey(env.gemini.apiKey),
        create: () => new GeminiDirectEmbeddings({
          apiKey: env.gemini.apiKey!,
          model: 'gemini-embedding-2-preview',
          outputDimensionality: 1536, // Match existing vector(1536) DB columns
        }),
        dimensions: 1536,
      },
      {
        name: 'openai',
        available: VectorEmbeddingService.isValidApiKey(env.openai.apiKey),
        create: () => new OpenAIEmbeddings({
          openAIApiKey: env.openai.apiKey,
          modelName: 'text-embedding-3-small',
          dimensions: 1536,
        }),
        dimensions: 1536,
      },
    ];

    // Warn about placeholder keys
    for (const p of providers) {
      const rawKey = p.name === 'gemini' ? env.gemini.apiKey : env.openai.apiKey;
      if (rawKey && !p.available) {
        logger.warn(`[VectorEmbedding] ${p.name} API key looks like a placeholder — skipping provider`);
      }
    }

    // Find first available provider
    const available = providers.filter((p) => p.available);
    if (available.length === 0) {
      logger.warn('[VectorEmbedding] No valid embedding API keys configured. Embeddings will be disabled.');
      return {
        embeddings: providers[0].create(),
        providerName: 'none',
        dimensions: 1536,
        fallbacks: [],
      };
    }

    const primary = available[0];
    const fallbacks = available.slice(1).map((p) => ({ name: p.name, create: p.create }));

    // Save primary factory for auto-recovery after quota cooldown
    this.primaryProvider = { name: primary.name, create: primary.create };

    return {
      embeddings: primary.create(),
      providerName: primary.name,
      dimensions: primary.dimensions,
      fallbacks,
    };
  }

  /**
   * Switch to the next available fallback provider.
   * Returns true if switched, false if no fallbacks left.
   */
  private switchToFallback(): boolean {
    if (this.fallbackProviders.length === 0) return false;

    const next = this.fallbackProviders.shift()!;
    this.embeddings = next.create();
    this.providerName = next.name;
    this.fallbackActivatedAt = Date.now();
    logger.warn(`[VectorEmbedding] Switched to ${next.name} embeddings (previous provider quota exceeded)`);
    return true;
  }

  /**
   * Try reverting to primary provider after cooldown period.
   * Called before each embedding request to check if recovery is possible.
   */
  private maybeRecoverPrimary(): void {
    if (
      !this.fallbackActivatedAt ||
      !this.primaryProvider ||
      this.providerName === this.primaryProvider.name
    ) {
      return;
    }
    if (Date.now() - this.fallbackActivatedAt >= this.primaryCooldownMs) {
      logger.info(`[VectorEmbedding] Cooldown elapsed, recovering primary provider: ${this.primaryProvider.name}`);
      // Save current provider as fallback before switching back
      const currentName = this.providerName;
      const currentCreate = () => this.embeddings;
      this.fallbackProviders.push({ name: currentName, create: currentCreate });
      // Restore primary
      this.embeddings = this.primaryProvider.create();
      this.providerName = this.primaryProvider.name;
      this.fallbackActivatedAt = null;
    }
  }

  /**
   * Check if an error is a quota/rate limit error that should trigger fallback.
   */
  private isQuotaError(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : String(error);
    const name = error instanceof Error ? error.name : '';
    return (
      name === 'InsufficientQuotaError' ||
      msg.includes('429') ||
      msg.includes('quota') ||
      msg.includes('rate limit') ||
      msg.includes('exceeded')
    );
  }

  /**
   * Check if an error is an authentication/authorization error (unrecoverable).
   */
  private isAuthError(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : String(error);
    return (
      msg.includes('401') ||
      msg.includes('403') ||
      msg.includes('Unauthorized') ||
      msg.includes('Incorrect API key') ||
      msg.includes('Invalid API key') ||
      msg.includes('invalid_api_key')
    );
  }

  /**
   * Check if pgvector extension is available in the database
   * Caches the result to avoid repeated checks
   */
  private async checkVectorExtension(): Promise<boolean> {
    // Return cached result if available
    if (this.vectorExtensionAvailable !== null) {
      return this.vectorExtensionAvailable;
    }

    // If check is in progress, wait for it
    if (this.extensionCheckPromise) {
      return this.extensionCheckPromise;
    }

    // Start new check
    this.extensionCheckPromise = (async () => {
      try {
        // Try to query for the vector type
        const result = await query(
          `SELECT EXISTS(
            SELECT 1 FROM pg_type WHERE typname = 'vector'
          ) as exists`
        );
        
        const exists = result.rows[0]?.exists === true;
        
        if (!exists) {
          // Try to install the extension
          try {
            await query('CREATE EXTENSION IF NOT EXISTS vector');
            logger.info('[VectorEmbedding] pgvector extension installed successfully');
            this.vectorExtensionAvailable = true;
            return true;
          } catch (installError: any) {
            // Extension installation failed - could be:
            // 1. Extension not installed on PostgreSQL server (needs system-level installation)
            // 2. Requires superuser privileges
            // 3. Extension files not available
            const errorCode = installError?.code;
            const errorMessage = installError?.message || '';
            
            // Check if extension is simply not available (not installed on server)
            const isExtensionNotAvailable = 
              errorCode === '58P01' || 
              errorMessage.includes('extension "vector" is not available') ||
              errorMessage.includes('could not open extension control file');
            
            if (isExtensionNotAvailable) {
              logger.debug('[VectorEmbedding] pgvector extension not installed on PostgreSQL server. Text search fallback will be used.', {
                hint: 'To enable vector search, install pgvector extension: https://github.com/pgvector/pgvector#installation'
              });
            } else {
              // Other errors (permissions, etc.)
              logger.debug('[VectorEmbedding] pgvector extension not available (may require superuser privileges or system installation)', {
                error: errorMessage,
                errorCode
              });
            }
            
            this.vectorExtensionAvailable = false;
            return false;
          }
        } else {
          logger.debug('[VectorEmbedding] pgvector extension is available');
          this.vectorExtensionAvailable = true;
          return true;
        }
      } catch (error: any) {
        // If check fails, assume extension is not available
        logger.debug('[VectorEmbedding] Could not verify pgvector extension, using text search fallback', {
          error: error.message
        });
        this.vectorExtensionAvailable = false;
        return false;
      } finally {
        this.extensionCheckPromise = null;
      }
    })();

    return this.extensionCheckPromise;
  }

  // ============================================================================
  // Core Embedding Functions
  // ============================================================================

  /**
   * Generate embedding for a single text.
   * Uses in-flight de-duplication: concurrent calls with identical text share one API request.
   */
  async embedText(text: string): Promise<number[]> {
    this.maybeRecoverPrimary();
    const cleanText = this.preprocessText(text);

    // De-duplicate concurrent identical embedding requests
    const inflight = this.embeddingInflight.get(cleanText);
    if (inflight) {
      logger.debug('Embedding de-dup hit', { provider: this.providerName, textLength: text.length });
      return inflight;
    }

    const promise = (async () => {
      try {
        const embedding = await this.embeddings.embedQuery(cleanText);
        logger.debug('Generated embedding', { provider: this.providerName, textLength: text.length, dimensions: embedding.length });
        return embedding;
      } catch (error) {
        // Auth errors are unrecoverable — don't retry, don't fallback
        if (this.isAuthError(error)) {
          logger.error('[VectorEmbedding] Auth error (unrecoverable)', { provider: this.providerName, error: (error as Error).message });
          throw new EmbeddingAuthError(`Embedding auth failed on ${this.providerName}: ${(error as Error).message}`);
        }
        // Quota errors — try fallback provider
        if (this.isQuotaError(error) && this.switchToFallback()) {
          try {
            const embedding = await this.embeddings.embedQuery(cleanText);
            logger.debug('Generated embedding via fallback', { provider: this.providerName, textLength: text.length, dimensions: embedding.length });
            return embedding;
          } catch (fallbackError) {
            if (this.isAuthError(fallbackError)) {
              logger.error('[VectorEmbedding] Fallback auth error (unrecoverable)', { provider: this.providerName, error: (fallbackError as Error).message });
              throw new EmbeddingAuthError(`Embedding auth failed on fallback ${this.providerName}: ${(fallbackError as Error).message}`);
            }
            throw fallbackError;
          }
        }
        logger.error('Failed to generate embedding', { provider: this.providerName, error: (error as Error).message });
        throw error;
      } finally {
        // Keep entry briefly to catch near-concurrent calls, then clean up
        setTimeout(() => this.embeddingInflight.delete(cleanText), 200);
      }
    })();

    this.embeddingInflight.set(cleanText, promise);
    return promise;
  }

  /**
   * Generate embeddings for multiple texts (batch processing)
   */
  async embedTexts(texts: string[]): Promise<number[][]> {
    this.maybeRecoverPrimary();
    const cleanTexts = texts.map((t) => this.preprocessText(t));
    try {
      const embeddings = await this.embeddings.embedDocuments(cleanTexts);
      logger.debug('Generated batch embeddings', { provider: this.providerName, count: texts.length });
      return embeddings;
    } catch (error) {
      if (this.isAuthError(error)) {
        logger.error('[VectorEmbedding] Auth error in batch (unrecoverable)', { provider: this.providerName, error: (error as Error).message });
        throw new EmbeddingAuthError(`Batch embedding auth failed on ${this.providerName}: ${(error as Error).message}`);
      }
      if (this.isQuotaError(error) && this.switchToFallback()) {
        try {
          const embeddings = await this.embeddings.embedDocuments(cleanTexts);
          logger.debug('Generated batch embeddings via fallback', { provider: this.providerName, count: texts.length });
          return embeddings;
        } catch (fallbackError) {
          if (this.isAuthError(fallbackError)) {
            throw new EmbeddingAuthError(`Batch embedding auth failed on fallback ${this.providerName}: ${(fallbackError as Error).message}`);
          }
          throw fallbackError;
        }
      }
      logger.error('Failed to generate batch embeddings', { provider: this.providerName, error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Preprocess text for embedding
   */
  private preprocessText(text: string): string {
    return text
      .trim()
      .replace(/\s+/g, ' ') 
      .slice(0, 8000);
  }

  // ============================================================================
  // Gemini 768-dim Embedding (for life history)
  // ============================================================================

  /**
   * Generate a 768-dim embedding using Gemini Embedding 2 (gemini-embedding-2-preview).
   * Separate from the main embedding pipeline (which uses OpenAI 1536-dim).
   * Used exclusively for the user_life_history table.
   *
   * @param text - Text to embed
   * @param taskType - 'RETRIEVAL_DOCUMENT' for storage, 'RETRIEVAL_QUERY' for search
   * @returns 768-dimensional embedding array
   */
  async embedWithGemini(
    text: string,
    taskType: GeminiTaskType = 'RETRIEVAL_DOCUMENT',
  ): Promise<number[]> {
    if (!this.geminiEmbeddings) {
      if (!env.gemini.apiKey) {
        throw new Error('[VectorEmbedding] Gemini API key not configured — cannot generate life history embeddings');
      }
      this.geminiEmbeddings = new GeminiDirectEmbeddings({
        apiKey: env.gemini.apiKey,
        model: 'gemini-embedding-2-preview',
        taskType,
      });
    }

    const cleanText = this.preprocessText(text);
    try {
      // Update taskType for this call (document vs query)
      this.geminiEmbeddings.taskType = taskType;
      const embedding = await this.geminiEmbeddings.embedQuery(cleanText);
      logger.debug('Generated Gemini embedding', { textLength: text.length, dimensions: embedding.length, taskType });
      return embedding;
    } catch (error) {
      logger.error('Failed to generate Gemini embedding', { error: (error as Error).message, taskType });
      throw error;
    }
  }

  // ============================================================================
  // Vector Storage Functions
  // ============================================================================

  /**
   * Store embedding in vector_embeddings table
   */
  async storeEmbedding(params: {
    sourceType: string;
    sourceId: string;
    userId?: string;
    content: string;
    contentType?: string;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    const { sourceType, sourceId, userId, content, contentType = 'message', metadata = {} } = params;

    const embedding = await this.embedText(content);
    const embeddingStr = `[${embedding.join(',')}]`;

    const result = await query<{ id: string }>(
      `INSERT INTO vector_embeddings
        (source_type, source_id, user_id, content, content_type, embedding, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [sourceType, sourceId, userId ?? null, content, contentType, embeddingStr, JSON.stringify(metadata)]
    );

    logger.debug('Stored embedding', { id: result.rows[0].id, sourceType });
    return result.rows[0].id;
  }

  /**
   * Store message embedding in rag_messages table
   */
  async storeMessageEmbedding(params: {
    conversationId: string;
    userId: string;
    role: string;
    content: string;
    sequenceNumber: number;
    metadata?: Record<string, unknown>;
    toolCalls?: Record<string, unknown>;
    extractedEntities?: unknown[];
  }): Promise<string> {
    const {
      conversationId,
      userId,
      role,
      content,
      sequenceNumber,
      metadata = {},
      toolCalls,
      extractedEntities = [],
    } = params;

    const embedding = await this.embedText(content);
    const embeddingStr = `[${embedding.join(',')}]`;

    const result = await query<{ id: string }>(
      `INSERT INTO rag_messages
        (conversation_id, user_id, role, content, embedding, sequence_number, metadata, tool_calls, extracted_entities)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        conversationId,
        userId,
        role,
        content,
        embeddingStr,
        sequenceNumber,
        JSON.stringify(metadata),
        toolCalls ? JSON.stringify(toolCalls) : null,
        JSON.stringify(extractedEntities),
      ]
    );

    // Update conversation message count and last_message_at
    await query(
      `UPDATE rag_conversations
       SET message_count = message_count + 1,
           last_message_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [conversationId]
    );

    logger.debug('Stored message embedding', { id: result.rows[0].id, conversationId, role });
    return result.rows[0].id;
  }

  /**
   * Store a chat message WITHOUT generating an embedding (fast path).
   * The embedding can be backfilled later via updateMessageEmbedding() from the async worker.
   */
  async storeMessage(params: {
    conversationId: string;
    userId: string;
    role: string;
    content: string;
    sequenceNumber: number;
    metadata?: Record<string, unknown>;
    toolCalls?: Record<string, unknown>;
    extractedEntities?: unknown[];
  }): Promise<string> {
    const {
      conversationId,
      userId,
      role,
      content,
      sequenceNumber,
      metadata = {},
      toolCalls,
      extractedEntities = [],
    } = params;

    const result = await query<{ id: string }>(
      `INSERT INTO rag_messages
        (conversation_id, user_id, role, content, sequence_number, metadata, tool_calls, extracted_entities)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        conversationId,
        userId,
        role,
        content,
        sequenceNumber,
        JSON.stringify(metadata),
        toolCalls ? JSON.stringify(toolCalls) : null,
        JSON.stringify(extractedEntities),
      ]
    );

    // Update conversation message count and last_message_at
    await query(
      `UPDATE rag_conversations
       SET message_count = message_count + 1,
           last_message_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [conversationId]
    );

    logger.debug('Stored message (embedding deferred)', { id: result.rows[0].id, conversationId, role });
    return result.rows[0].id;
  }

  /**
   * Backfill embedding for an existing rag_message row.
   * Called by the async embedding worker after storeMessage().
   */
  async updateMessageEmbedding(messageId: string, content: string): Promise<void> {
    const embedding = await this.embedText(content);
    const embeddingStr = `[${embedding.join(',')}]`;
    await query(
      `UPDATE rag_messages SET embedding = $1 WHERE id = $2`,
      [embeddingStr, messageId]
    );
    logger.debug('Backfilled message embedding', { messageId });
  }

  /**
   * Store knowledge base entry with embedding
   */
  async storeKnowledge(params: {
    category: string;
    subcategory?: string;
    title: string;
    content: string;
    source?: string;
    sourceUrl?: string;
    tags?: string[];
    metadata?: Record<string, unknown>;
    trustScore?: number;
  }): Promise<string> {
    const {
      category,
      subcategory,
      title,
      content,
      source,
      sourceUrl,
      tags = [],
      metadata = {},
      trustScore = 1.0,
    } = params;

    const embedding = await this.embedText(`${title}\n\n${content}`);
    const embeddingStr = `[${embedding.join(',')}]`;

    const result = await query<{ id: string }>(
      `INSERT INTO health_knowledge_base
        (category, subcategory, title, content, embedding, source, source_url, tags, metadata, trust_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        category,
        subcategory ?? null,
        title,
        content,
        embeddingStr,
        source ?? null,
        sourceUrl ?? null,
        tags,
        JSON.stringify(metadata),
        trustScore,
      ]
    );

    logger.debug('Stored knowledge entry', { id: result.rows[0].id, category, title });
    return result.rows[0].id;
  }

  /**
   * Store user health profile embedding
   */
  async storeUserHealthProfile(params: {
    userId: string;
    section: string;
    content: string;
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    const { userId, section, content, metadata = {} } = params;

    // Mark previous entries for this section as not current
    await query(
      `UPDATE user_health_embeddings
       SET is_current = false, valid_until = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND section = $2 AND is_current = true`,
      [userId, section]
    );

    const embedding = await this.embedText(content);
    const embeddingStr = `[${embedding.join(',')}]`;

    const result = await query<{ id: string }>(
      `INSERT INTO user_health_embeddings
        (user_id, section, content, embedding, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [userId, section, content, embeddingStr, JSON.stringify(metadata)]
    );

    logger.debug('Stored user health profile', { id: result.rows[0].id, userId, section });
    return result.rows[0].id;
  }

  // ============================================================================
  // Vector Search Functions
  // ============================================================================

  /**
   * Search similar vectors in vector_embeddings table
   */
  async searchSimilar(params: {
    queryText: string;
    sourceType?: string;
    userId?: string;
    limit?: number;
    minSimilarity?: number;
  }): Promise<VectorSearchResult[]> {
    const { queryText, sourceType, userId, limit = 10, minSimilarity = 0.7 } = params;

    // Check if vector extension is available (cached)
    const hasVectorExtension = await this.checkVectorExtension();
    
    if (!hasVectorExtension) {
      // Use text search fallback directly without trying vector query
      return this.searchSimilarTextFallback(params);
    }

    try {
      const queryEmbedding = await this.embedText(queryText);
      const embeddingStr = `[${queryEmbedding.join(',')}]`;

      // Try with vector extension
      let sql = `
        SELECT
          id, content, source_type, source_id, metadata, created_at,
          1 - (embedding <=> $1::vector) as similarity
        FROM vector_embeddings
        WHERE embedding IS NOT NULL AND 1 - (embedding <=> $1::vector) >= $2
      `;

      const queryParams: (string | number)[] = [embeddingStr, minSimilarity];
      let paramIndex = 3;

      if (sourceType) {
        sql += ` AND source_type = $${paramIndex}`;
        queryParams.push(sourceType);
        paramIndex++;
      }

      if (userId) {
        sql += ` AND user_id = $${paramIndex}`;
        queryParams.push(userId);
        paramIndex++;
      }

      sql += ` ORDER BY similarity DESC LIMIT $${paramIndex}`;
      queryParams.push(limit);

      const result = await query(sql, queryParams);

      return result.rows.map((row) => ({
        id: row.id,
        content: row.content,
        sourceType: row.source_type,
        sourceId: row.source_id,
        metadata: row.metadata,
        similarity: parseFloat(row.similarity),
        createdAt: row.created_at,
      }));
    } catch (error: any) {
      // If vector extension check was wrong or extension was removed, update cache and fallback
      if (error?.code === '42704' || error?.message?.includes('vector') || error?.message?.includes('does not exist')) {
        this.vectorExtensionAvailable = false; // Update cache
        logger.debug('[VectorEmbedding] Vector extension not available, using text search fallback');
        return this.searchSimilarTextFallback(params);
      }
      throw error;
    }
  }

  /**
   * Fallback text search when vector extension is not available
   * Uses improved text matching with word-based search
   */
  private async searchSimilarTextFallback(params: {
    queryText: string;
    sourceType?: string;
    userId?: string;
    limit?: number;
    minSimilarity?: number;
  }): Promise<VectorSearchResult[]> {
    const { queryText, sourceType, userId, limit = 10 } = params;
    
    // Extract keywords from query for better matching
    const keywords = queryText
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2) // Filter out short words
      .slice(0, 5); // Limit to 5 keywords
    
    // Build search conditions - match any keyword
    const searchConditions = keywords.length > 0
      ? keywords.map((_, idx) => `content ILIKE $${idx + 1}`).join(' OR ')
      : 'content ILIKE $1';
    
    const searchParams = keywords.length > 0
      ? keywords.map(k => `%${k}%`)
      : [`%${queryText}%`];
    
    let sql = `
      SELECT
        id, content, source_type, source_id, metadata, created_at,
        CASE 
          WHEN content ILIKE ANY(ARRAY[${searchParams.map((_, i) => `$${i + 1}`).join(', ')}]) THEN 0.7
          ELSE 0.5
        END as similarity
      FROM vector_embeddings
      WHERE (${searchConditions})
    `;
    
    const queryParams: (string | number)[] = [...searchParams];
    let paramIndex = searchParams.length + 1;

    if (sourceType) {
      sql += ` AND source_type = $${paramIndex}`;
      queryParams.push(sourceType);
      paramIndex++;
    }

    if (userId) {
      sql += ` AND user_id = $${paramIndex}`;
      queryParams.push(userId);
      paramIndex++;
    }

    sql += ` ORDER BY similarity DESC, created_at DESC LIMIT $${paramIndex}`;
    queryParams.push(limit);

    try {
      const result = await query(sql, queryParams);
      return result.rows.map((row) => ({
        id: row.id,
        content: row.content,
        sourceType: row.source_type,
        sourceId: row.source_id,
        metadata: row.metadata,
        similarity: parseFloat(row.similarity) || 0.5,
        createdAt: row.created_at,
      }));
    } catch (error) {
      logger.error('[VectorEmbedding] Text search fallback failed', { error, queryText });
      // Return empty array if search fails
      return [];
    }
  }

  /**
   * Search similar messages in user's conversation history
   */
  async searchConversationHistory(params: {
    queryText: string;
    userId: string;
    conversationId?: string;
    limit?: number;
    minSimilarity?: number;
    role?: string;
  }): Promise<ConversationSearchResult[]> {
    const { queryText, userId, conversationId, limit = 10, minSimilarity = 0.6, role } = params;

    // Check if vector extension is available (cached)
    const hasVectorExtension = await this.checkVectorExtension();
    
    if (!hasVectorExtension) {
      // Use text search fallback directly without trying vector query
      return this.searchConversationHistoryTextFallback(params);
    }

    try {
      const queryEmbedding = await this.embedText(queryText);
      const embeddingStr = `[${queryEmbedding.join(',')}]`;

      let sql = `
        SELECT
          m.id, m.conversation_id, m.role, m.content, m.sequence_number, m.created_at,
          1 - (m.embedding <=> $1::vector) as similarity
        FROM rag_messages m
        JOIN rag_conversations c ON m.conversation_id = c.id
        WHERE m.user_id = $2
          AND m.embedding IS NOT NULL
          AND 1 - (m.embedding <=> $1::vector) >= $3
      `;

    const queryParams: (string | number)[] = [embeddingStr, userId, minSimilarity];
    let paramIndex = 4;

    if (conversationId) {
      sql += ` AND m.conversation_id = $${paramIndex}`;
      queryParams.push(conversationId);
      paramIndex++;
    }

    if (role) {
      sql += ` AND m.role = $${paramIndex}`;
      queryParams.push(role);
      paramIndex++;
    }

      sql += ` ORDER BY similarity DESC LIMIT $${paramIndex}`;
      queryParams.push(limit);

      const result = await query(sql, queryParams);

      return result.rows.map((row) => ({
        id: row.id,
        conversationId: row.conversation_id,
        role: row.role,
        content: row.content,
        similarity: parseFloat(row.similarity),
        sequenceNumber: row.sequence_number,
        createdAt: row.created_at,
      }));
    } catch (error: any) {
      // If vector extension check was wrong or extension was removed, update cache and fallback
      if (error?.code === '42704' || error?.message?.includes('vector') || error?.message?.includes('does not exist')) {
        this.vectorExtensionAvailable = false; // Update cache
        logger.debug('[VectorEmbedding] Vector extension not available, using text search fallback');
        return this.searchConversationHistoryTextFallback(params);
      }
      throw error;
    }
  }

  /**
   * Fallback text search for conversation history
   * Uses improved text matching with word-based search
   */
  private async searchConversationHistoryTextFallback(params: {
    queryText: string;
    userId: string;
    conversationId?: string;
    limit?: number;
    role?: string;
  }): Promise<ConversationSearchResult[]> {
    const { queryText, userId, conversationId, limit = 10, role } = params;
    
    // Extract keywords from query for better matching
    const keywords = queryText
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 5);
    
    const searchConditions = keywords.length > 0
      ? keywords.map((_, idx) => `m.content ILIKE $${idx + 2}`).join(' OR ')
      : 'm.content ILIKE $2';
    
    const searchParams = keywords.length > 0
      ? keywords.map(k => `%${k}%`)
      : [`%${queryText}%`];
    
    let sql = `
      SELECT
        m.id, m.conversation_id, m.role, m.content, m.sequence_number, m.created_at,
        CASE 
          WHEN m.content ILIKE ANY(ARRAY[${searchParams.map((_, i) => `$${i + 2}`).join(', ')}]) THEN 0.7
          ELSE 0.5
        END as similarity
      FROM rag_messages m
      JOIN rag_conversations c ON m.conversation_id = c.id
      WHERE m.user_id = $1 AND (${searchConditions})
    `;
    
    const queryParams: (string | number)[] = [userId, ...searchParams];
    let paramIndex = searchParams.length + 2;

    if (conversationId) {
      sql += ` AND m.conversation_id = $${paramIndex}`;
      queryParams.push(conversationId);
      paramIndex++;
    }

    if (role) {
      sql += ` AND m.role = $${paramIndex}`;
      queryParams.push(role);
      paramIndex++;
    }

    sql += ` ORDER BY similarity DESC, m.created_at DESC LIMIT $${paramIndex}`;
    queryParams.push(limit);

    try {
      const result = await query(sql, queryParams);
      return result.rows.map((row) => ({
        id: row.id,
        conversationId: row.conversation_id,
        role: row.role,
        content: row.content,
        similarity: parseFloat(row.similarity) || 0.5,
        sequenceNumber: row.sequence_number,
        createdAt: row.created_at,
      }));
    } catch (error) {
      logger.error('[VectorEmbedding] Conversation history text search fallback failed', { error, queryText });
      return [];
    }
  }

  /**
   * Search knowledge base
   */
  async searchKnowledge(params: {
    queryText: string;
    category?: string;
    tags?: string[];
    limit?: number;
    minSimilarity?: number;
  }): Promise<KnowledgeSearchResult[]> {
    const { queryText, category, tags, limit = 5, minSimilarity = 0.65 } = params;

    // Check if vector extension is available (cached)
    const hasVectorExtension = await this.checkVectorExtension();
    
    if (!hasVectorExtension) {
      // Use text search fallback directly without trying vector query
      return this.searchKnowledgeTextFallback(params);
    }

    try {
      const queryEmbedding = await this.embedText(queryText);
      const embeddingStr = `[${queryEmbedding.join(',')}]`;

      let sql = `
        SELECT
          id, category, subcategory, title, content, tags, trust_score,
          1 - (embedding <=> $1::vector) as similarity
        FROM health_knowledge_base
        WHERE is_active = true
          AND embedding IS NOT NULL
          AND 1 - (embedding <=> $1::vector) >= $2
      `;

    const queryParams: (string | number | string[])[] = [embeddingStr, minSimilarity];
    let paramIndex = 3;

    if (category) {
      sql += ` AND category = $${paramIndex}`;
      queryParams.push(category);
      paramIndex++;
    }

    if (tags && tags.length > 0) {
      sql += ` AND tags && $${paramIndex}`;
      queryParams.push(tags);
      paramIndex++;
    }

      sql += ` ORDER BY similarity DESC, trust_score DESC LIMIT $${paramIndex}`;
      queryParams.push(limit);

      const result = await query(sql, queryParams);

      return result.rows.map((row) => ({
        id: row.id,
        category: row.category,
        subcategory: row.subcategory ?? null,
        title: row.title,
        content: row.content,
        tags: row.tags,
        similarity: parseFloat(row.similarity),
        trustScore: parseFloat(row.trust_score),
      }));
    } catch (error: any) {
      // If vector extension check was wrong or extension was removed, update cache and fallback
      if (error?.code === '42704' || error?.message?.includes('vector') || error?.message?.includes('does not exist')) {
        this.vectorExtensionAvailable = false; // Update cache
        logger.debug('[VectorEmbedding] Vector extension not available, using text search fallback');
        return this.searchKnowledgeTextFallback(params);
      }
      throw error;
    }
  }

  /**
   * Fallback text search for knowledge base
   * Uses improved text matching with word-based search
   */
  private async searchKnowledgeTextFallback(params: {
    queryText: string;
    category?: string;
    tags?: string[];
    limit?: number;
  }): Promise<KnowledgeSearchResult[]> {
    const { queryText, category, tags, limit = 5 } = params;
    
    // Extract keywords from query for better matching
    const keywords = queryText
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 5);
    
    const searchConditions = keywords.length > 0
      ? keywords.map((_, idx) => `(title ILIKE $${idx + 1} OR content ILIKE $${idx + 1})`).join(' OR ')
      : '(title ILIKE $1 OR content ILIKE $1)';
    
    const searchParams = keywords.length > 0
      ? keywords.map(k => `%${k}%`)
      : [`%${queryText}%`];
    
    let sql = `
      SELECT
        id, category, subcategory, title, content, tags, trust_score,
        CASE 
          WHEN title ILIKE ANY(ARRAY[${searchParams.map((_, i) => `$${i + 1}`).join(', ')}]) THEN 0.8
          WHEN content ILIKE ANY(ARRAY[${searchParams.map((_, i) => `$${i + 1}`).join(', ')}]) THEN 0.7
          ELSE 0.5
        END as similarity
      FROM health_knowledge_base
      WHERE is_active = true
        AND (${searchConditions})
    `;
    
    const queryParams: (string | number | string[])[] = [...searchParams];
    let paramIndex = searchParams.length + 1;

    if (category) {
      sql += ` AND category = $${paramIndex}`;
      queryParams.push(category);
      paramIndex++;
    }

    if (tags && tags.length > 0) {
      sql += ` AND tags && $${paramIndex}`;
      queryParams.push(tags);
      paramIndex++;
    }

    sql += ` ORDER BY similarity DESC, trust_score DESC LIMIT $${paramIndex}`;
    queryParams.push(limit);

    try {
      const result = await query(sql, queryParams);
      return result.rows.map((row) => ({
        id: row.id,
        category: row.category,
        subcategory: row.subcategory ?? null,
        title: row.title,
        content: row.content,
        tags: row.tags,
        similarity: parseFloat(row.similarity) || 0.5,
        trustScore: parseFloat(row.trust_score),
      }));
    } catch (error) {
      logger.error('[VectorEmbedding] Knowledge base text search fallback failed', { error, queryText });
      return [];
    }
  }

  /**
   * Search user health profile
   */
  async searchUserProfile(params: {
    queryText: string;
    userId: string;
    section?: string;
    limit?: number;
  }): Promise<{ section: string; content: string; similarity: number }[]> {
    const { queryText, userId, section, limit = 5 } = params;

    // Check if vector extension is available (cached)
    const hasVectorExtension = await this.checkVectorExtension();
    
    if (!hasVectorExtension) {
      // Use text search fallback directly without trying vector query
      return this.searchUserProfileTextFallback(params);
    }

    try {
      const queryEmbedding = await this.embedText(queryText);
      const embeddingStr = `[${queryEmbedding.join(',')}]`;

      let sql = `
        SELECT
          section, content,
          1 - (embedding <=> $1::vector) as similarity
        FROM user_health_embeddings
        WHERE user_id = $2
          AND is_current = true
          AND embedding IS NOT NULL
      `;

    const queryParams: (string | number)[] = [embeddingStr, userId];
    let paramIndex = 3;

    if (section) {
      sql += ` AND section = $${paramIndex}`;
      queryParams.push(section);
      paramIndex++;
    }

      sql += ` ORDER BY similarity DESC LIMIT $${paramIndex}`;
      queryParams.push(limit);

      const result = await query(sql, queryParams);

      return result.rows.map((row) => ({
        section: row.section,
        content: row.content,
        similarity: parseFloat(row.similarity),
      }));
    } catch (error: any) {
      // If vector extension check was wrong or extension was removed, update cache and fallback
      if (error?.code === '42704' || error?.message?.includes('vector') || error?.message?.includes('does not exist')) {
        this.vectorExtensionAvailable = false; // Update cache
        logger.debug('[VectorEmbedding] Vector extension not available, using text search fallback');
        return this.searchUserProfileTextFallback(params);
      }
      throw error;
    }
  }

  /**
   * Fallback text search for user profile
   */
  private async searchUserProfileTextFallback(params: {
    queryText: string;
    userId: string;
    section?: string;
    limit?: number;
  }): Promise<{ section: string; content: string; similarity: number }[]> {
    const { queryText, userId, section, limit = 5 } = params;
    
    let sql = `
      SELECT
        section, content,
        0.5 as similarity
      FROM user_health_embeddings
      WHERE user_id = $1
        AND is_current = true
        AND content ILIKE $2
    `;
    
    const queryParams: (string | number)[] = [userId, `%${queryText}%`];
    let paramIndex = 3;

    if (section) {
      sql += ` AND section = $${paramIndex}`;
      queryParams.push(section);
      paramIndex++;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    queryParams.push(limit);

    const result = await query(sql, queryParams);

    return result.rows.map((row) => ({
      section: row.section,
      content: row.content,
      similarity: 0.5,
    }));
  }

  // ============================================================================
  // Conversation Management
  // ============================================================================

  /**
   * Create a new RAG conversation
   */
  async createConversation(params: {
    userId: string;
    title?: string;
    sessionType?: string;
  }): Promise<string> {
    const { userId, title, sessionType = 'health_coach' } = params;

    const result = await query<{ id: string }>(
      `INSERT INTO rag_conversations (user_id, title, session_type)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [userId, title ?? null, sessionType]
    );

    logger.debug('Created RAG conversation', { id: result.rows[0].id, userId });
    return result.rows[0].id;
  }

  /**
   * Get conversation with recent messages
   */
  async getConversation(conversationId: string, messageLimit: number = 20): Promise<{
    conversation: {
      id: string;
      userId: string;
      title: string | null;
      sessionType: string;
      status: string;
      messageCount: number;
      topics: string[];
      createdAt: Date;
    };
    messages: {
      id: string;
      role: string;
      content: string;
      sequenceNumber: number;
      createdAt: Date;
    }[];
  } | null> {
    const convResult = await query(
      `SELECT id, user_id, title, session_type, status, message_count, topics, created_at
       FROM rag_conversations WHERE id = $1`,
      [conversationId]
    );

    if (convResult.rows.length === 0) return null;

    const conv = convResult.rows[0];

    const msgResult = await query(
      `SELECT id, role, content, sequence_number, created_at
       FROM rag_messages
       WHERE conversation_id = $1 AND role IN ('user', 'assistant')
       ORDER BY sequence_number DESC
       LIMIT $2`,
      [conversationId, messageLimit]
    );

    return {
      conversation: {
        id: conv.id,
        userId: conv.user_id,
        title: conv.title,
        sessionType: conv.session_type,
        status: conv.status,
        messageCount: conv.message_count,
        topics: conv.topics,
        createdAt: conv.created_at,
      },
      messages: msgResult.rows.reverse().map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sequenceNumber: m.sequence_number,
        createdAt: m.created_at,
      })),
    };
  }

  /**
   * Update conversation summary and topics
   */
  async updateConversationSummary(params: {
    conversationId: string;
    summary: string;
    topics?: string[];
  }): Promise<void> {
    const { conversationId, summary, topics } = params;

    const embedding = await this.embedText(summary);
    const embeddingStr = `[${embedding.join(',')}]`;

    await query(
      `UPDATE rag_conversations
       SET summary = $1,
           summary_embedding = $2,
           topics = COALESCE($3, topics),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [summary, embeddingStr, topics ?? null, conversationId]
    );

    logger.debug('Updated conversation summary', { conversationId });
  }

  /**
   * Get user's recent conversations
   */
  async getUserConversations(params: {
    userId: string;
    status?: string;
    limit?: number;
  }): Promise<
    {
      id: string;
      title: string | null;
      sessionType: string;
      status: string;
      messageCount: number;
      lastMessageAt: Date;
      createdAt: Date;
    }[]
  > {
    const { userId, status, limit = 20 } = params;

    let sql = `
      SELECT c.id, c.title, c.session_type, c.status, c.message_count, c.last_message_at, c.created_at,
        lm.content AS last_message_preview,
        lm.role AS last_message_role
      FROM rag_conversations c
      LEFT JOIN LATERAL (
        SELECT content, role FROM rag_messages
        WHERE conversation_id = c.id
        ORDER BY created_at DESC LIMIT 1
      ) lm ON true
      WHERE c.user_id = $1
    `;

    const queryParams: (string | number)[] = [userId];

    if (status) {
      sql += ` AND c.status = $2`;
      queryParams.push(status);
    }

    sql += ` ORDER BY c.last_message_at DESC LIMIT $${queryParams.length + 1}`;
    queryParams.push(limit);

    const result = await query(sql, queryParams);

    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      sessionType: row.session_type,
      status: row.status,
      messageCount: row.message_count,
      lastMessageAt: row.last_message_at,
      createdAt: row.created_at,
      lastMessagePreview: row.last_message_preview ? String(row.last_message_preview).slice(0, 80) : null,
      lastMessageRole: row.last_message_role || null,
    }));
  }

  /**
   * Save LangGraph checkpoint
   */
  async saveLangGraphCheckpoint(conversationId: string, checkpoint: Record<string, unknown>): Promise<void> {
    await query(
      `UPDATE rag_conversations
       SET langgraph_checkpoint = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [JSON.stringify(checkpoint), conversationId]
    );
  }

  /**
   * Get LangGraph checkpoint
   */
  async getLangGraphCheckpoint(conversationId: string): Promise<Record<string, unknown> | null> {
    const result = await query<{ langgraph_checkpoint: Record<string, unknown> | null }>(
      `SELECT langgraph_checkpoint FROM rag_conversations WHERE id = $1`,
      [conversationId]
    );

    return result.rows[0]?.langgraph_checkpoint ?? null;
  }
}

// Export singleton instance
export const vectorEmbeddingService = new VectorEmbeddingService();
export default vectorEmbeddingService;
