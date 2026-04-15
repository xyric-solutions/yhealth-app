/**
 * @file Wellbeing Embedding Service
 * @description Handles vector embeddings for all wellbeing data (mood, stress, journal, energy, habits, schedule)
 */

import { vectorEmbeddingService } from './vector-embedding.service.js';
import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import { moodService } from './wellbeing/mood.service.js';
import { stressService } from './stress.service.js';
import { journalService } from './wellbeing/journal.service.js';
import { energyService } from './wellbeing/energy.service.js';
import { habitService } from './wellbeing/habit.service.js';

// ============================================
// TYPES
// ============================================

export type WellbeingType = 'mood' | 'stress' | 'journal' | 'energy' | 'habits' | 'schedule';

export interface WellbeingEmbeddingData {
  userId: string;
  wellbeingType: WellbeingType;
  entryId: string;
  content: string;
  metadata: Record<string, unknown>;
}

// ============================================
// SERVICE CLASS
// ============================================

class WellbeingEmbeddingService {
  /**
   * Generate and store embedding for a wellbeing entry
   */
  async createEmbedding(data: WellbeingEmbeddingData): Promise<void> {
    try {
      // Generate embedding
      const embedding = await vectorEmbeddingService.embedText(data.content);
      
      // Store in vector_embeddings table
      const embeddingArray = `[${embedding.join(',')}]`;
      
      await query(
        `INSERT INTO vector_embeddings (
          source_type, source_id, user_id, content, content_type, embedding, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6::vector, $7)
        ON CONFLICT (source_type, source_id) 
        DO UPDATE SET 
          content = EXCLUDED.content,
          embedding = EXCLUDED.embedding,
          metadata = EXCLUDED.metadata,
          updated_at = CURRENT_TIMESTAMP`,
        [
          'wellbeing',
          data.entryId,
          data.userId,
          data.content,
          data.wellbeingType,
          embeddingArray,
          JSON.stringify({
            ...data.metadata,
            wellbeing_type: data.wellbeingType,
          }),
        ]
      );
      
      logger.debug('[WellbeingEmbedding] Created embedding', {
        userId: data.userId,
        wellbeingType: data.wellbeingType,
        entryId: data.entryId,
      });
    } catch (error) {
      logger.error('[WellbeingEmbedding] Failed to create embedding', {
        userId: data.userId,
        wellbeingType: data.wellbeingType,
        entryId: data.entryId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update embedding for a wellbeing entry
   */
  async updateEmbedding(data: WellbeingEmbeddingData): Promise<void> {
    // Update is same as create (uses ON CONFLICT UPDATE)
    return this.createEmbedding(data);
  }

  /**
   * Delete embedding for a wellbeing entry
   */
  async deleteEmbedding(userId: string, wellbeingType: WellbeingType, entryId: string): Promise<void> {
    try {
      await query(
        `DELETE FROM vector_embeddings 
         WHERE source_type = 'wellbeing' 
         AND source_id = $1 
         AND user_id = $2
         AND metadata->>'wellbeing_type' = $3`,
        [entryId, userId, wellbeingType]
      );
      
      logger.debug('[WellbeingEmbedding] Deleted embedding', {
        userId,
        wellbeingType,
        entryId,
      });
    } catch (error) {
      logger.error('[WellbeingEmbedding] Failed to delete embedding', {
        userId,
        wellbeingType,
        entryId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Generate content string from mood log
   */
  async generateMoodContent(moodLogId: string, userId: string): Promise<string> {
    try {
      const moodLogs = await moodService.getMoodLogs(userId, { limit: 1000 });
      const moodLog = moodLogs.logs.find((log) => log.id === moodLogId);
      
      if (!moodLog) {
        throw new Error('Mood log not found');
      }
      
      const parts: string[] = [];
      
      if (moodLog.moodEmoji) {
        parts.push(`Mood: ${moodLog.moodEmoji}`);
      }
      
      if (moodLog.descriptor) {
        parts.push(`Descriptor: ${moodLog.descriptor}`);
      }
      
      if (moodLog.happinessRating) {
        parts.push(`Happiness: ${moodLog.happinessRating}/10`);
      }
      
      if (moodLog.energyRating) {
        parts.push(`Energy: ${moodLog.energyRating}/10`);
      }
      
      if (moodLog.stressRating) {
        parts.push(`Stress: ${moodLog.stressRating}/10`);
      }
      
      if (moodLog.anxietyRating) {
        parts.push(`Anxiety: ${moodLog.anxietyRating}/10`);
      }
      
      if (moodLog.emotionTags && moodLog.emotionTags.length > 0) {
        parts.push(`Emotions: ${moodLog.emotionTags.join(', ')}`);
      }
      
      if (moodLog.contextNote) {
        parts.push(`Note: ${moodLog.contextNote}`);
      }
      
      parts.push(`Logged at: ${new Date(moodLog.loggedAt).toLocaleString()}`);
      
      return parts.join('. ');
    } catch (error) {
      logger.error('[WellbeingEmbedding] Failed to generate mood content', { moodLogId, userId, error });
      throw error;
    }
  }

  /**
   * Generate content string from stress log
   */
  async generateStressContent(stressLogId: string, userId: string): Promise<string> {
    try {
      const stressLogs = await stressService.getStressLogs(userId);
      const stressLog = stressLogs.find((log) => log.id === stressLogId);
      
      if (!stressLog) {
        throw new Error('Stress log not found');
      }
      
      const parts: string[] = [];
      parts.push(`Stress level: ${stressLog.stressRating}/10`);
      
      if (stressLog.triggers && stressLog.triggers.length > 0) {
        parts.push(`Triggers: ${stressLog.triggers.join(', ')}`);
      }
      
      if (stressLog.otherTrigger) {
        parts.push(`Other trigger: ${stressLog.otherTrigger}`);
      }
      
      if (stressLog.note) {
        parts.push(`Note: ${stressLog.note}`);
      }
      
      parts.push(`Logged at: ${new Date(stressLog.loggedAt).toLocaleString()}`);
      
      return parts.join('. ');
    } catch (error) {
      logger.error('[WellbeingEmbedding] Failed to generate stress content', { stressLogId, userId, error });
      throw error;
    }
  }

  /**
   * Generate content string from journal entry
   */
  async generateJournalContent(entryId: string, userId: string): Promise<string> {
    try {
      const entry = await journalService.getJournalEntryById(userId, entryId);
      
      const parts: string[] = [];
      parts.push(`Journal entry: ${entry.prompt}`);
      
      if (entry.promptCategory) {
        parts.push(`Category: ${entry.promptCategory}`);
      }
      
      parts.push(`Entry: ${entry.entryText}`);
      
      if (entry.sentimentLabel) {
        parts.push(`Sentiment: ${entry.sentimentLabel}`);
      }
      
      parts.push(`Logged at: ${new Date(entry.loggedAt).toLocaleString()}`);
      
      return parts.join('. ');
    } catch (error) {
      logger.error('[WellbeingEmbedding] Failed to generate journal content', { entryId, userId, error });
      throw error;
    }
  }

  /**
   * Generate content string from energy log
   */
  async generateEnergyContent(energyLogId: string, userId: string): Promise<string> {
    try {
      const energyLogs = await energyService.getEnergyLogs(userId, { limit: 1000 });
      const energyLog = energyLogs.logs.find((log) => log.id === energyLogId);
      
      if (!energyLog) {
        throw new Error('Energy log not found');
      }
      
      const parts: string[] = [];
      parts.push(`Energy level: ${energyLog.energyRating}/10`);
      
      if (energyLog.contextTag) {
        parts.push(`Context: ${energyLog.contextTag}`);
      }
      
      if (energyLog.contextNote) {
        parts.push(`Note: ${energyLog.contextNote}`);
      }
      
      parts.push(`Logged at: ${new Date(energyLog.loggedAt).toLocaleString()}`);
      
      return parts.join('. ');
    } catch (error) {
      logger.error('[WellbeingEmbedding] Failed to generate energy content', { energyLogId, userId, error });
      throw error;
    }
  }

  /**
   * Generate content string from habit
   */
  async generateHabitContent(habitId: string, userId: string): Promise<string> {
    try {
      const habits = await habitService.getHabits(userId);
      const habit = habits.find((h) => h.id === habitId);
      
      if (!habit) {
        throw new Error('Habit not found');
      }
      
      const parts: string[] = [];
      parts.push(`Habit: ${habit.habitName}`);
      
      if (habit.category) {
        parts.push(`Category: ${habit.category}`);
      }
      
      if (habit.description) {
        parts.push(`Description: ${habit.description}`);
      }
      
      parts.push(`Tracking type: ${habit.trackingType}`);
      parts.push(`Frequency: ${habit.frequency}`);
      
      if (habit.targetValue) {
        parts.push(`Target: ${habit.targetValue} ${habit.unit || ''}`);
      }
      
      return parts.join('. ');
    } catch (error) {
      logger.error('[WellbeingEmbedding] Failed to generate habit content', { habitId, userId, error });
      throw error;
    }
  }

  /**
   * Generate content string from schedule item
   */
  async generateScheduleContent(itemId: string, userId: string): Promise<string> {
    try {
      // Get schedule item from database
      const result = await query(
        `SELECT si.*, ds.schedule_date 
         FROM schedule_items si
         JOIN daily_schedules ds ON si.schedule_id = ds.id
         WHERE si.id = $1 AND ds.user_id = $2`,
        [itemId, userId]
      );
      
      if (result.rows.length === 0) {
        throw new Error('Schedule item not found');
      }
      
      const item = result.rows[0];
      const parts: string[] = [];
      
      parts.push(`Schedule item: ${item.title}`);
      
      if (item.description) {
        parts.push(`Description: ${item.description}`);
      }
      
      parts.push(`Time: ${item.start_time}${item.end_time ? ` - ${item.end_time}` : ''}`);
      
      if (item.duration_minutes) {
        parts.push(`Duration: ${item.duration_minutes} minutes`);
      }
      
      if (item.category) {
        parts.push(`Category: ${item.category}`);
      }
      
      parts.push(`Date: ${item.schedule_date}`);
      
      return parts.join('. ');
    } catch (error) {
      logger.error('[WellbeingEmbedding] Failed to generate schedule content', { itemId, userId, error });
      throw error;
    }
  }

  /**
   * Process embedding for a wellbeing entry
   */
  async processEmbedding(
    userId: string,
    wellbeingType: WellbeingType,
    entryId: string,
    operation: 'create' | 'update' | 'delete'
  ): Promise<void> {
    try {
      if (operation === 'delete') {
        await this.deleteEmbedding(userId, wellbeingType, entryId);
        return;
      }
      
      // Generate content based on type
      let content: string;
      let metadata: Record<string, unknown> = {};
      
      switch (wellbeingType) {
        case 'mood':
          content = await this.generateMoodContent(entryId, userId);
          metadata = { date: new Date().toISOString().split('T')[0] };
          break;
        case 'stress':
          content = await this.generateStressContent(entryId, userId);
          metadata = { date: new Date().toISOString().split('T')[0] };
          break;
        case 'journal':
          content = await this.generateJournalContent(entryId, userId);
          metadata = { date: new Date().toISOString().split('T')[0] };
          break;
        case 'energy':
          content = await this.generateEnergyContent(entryId, userId);
          metadata = { date: new Date().toISOString().split('T')[0] };
          break;
        case 'habits':
          content = await this.generateHabitContent(entryId, userId);
          break;
        case 'schedule':
          content = await this.generateScheduleContent(entryId, userId);
          metadata = { date: new Date().toISOString().split('T')[0] };
          break;
        default:
          throw new Error(`Unknown wellbeing type: ${wellbeingType}`);
      }
      
      if (operation === 'create') {
        await this.createEmbedding({
          userId,
          wellbeingType,
          entryId,
          content,
          metadata,
        });
      } else if (operation === 'update') {
        await this.updateEmbedding({
          userId,
          wellbeingType,
          entryId,
          content,
          metadata,
        });
      }
    } catch (error) {
      logger.error('[WellbeingEmbedding] Failed to process embedding', {
        userId,
        wellbeingType,
        entryId,
        operation,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Search wellbeing history using vector similarity
   */
  async searchWellbeingHistory(
    userId: string,
    queryText: string,
    wellbeingTypes?: WellbeingType[],
    limit: number = 10
  ): Promise<Array<{
    id: string;
    wellbeingType: WellbeingType;
    entryId: string;
    content: string;
    metadata: Record<string, unknown>;
    similarity: number;
  }>> {
    try {
      // Check if vector extension is available
      const hasVectorExtension = await this.checkVectorExtension();
      if (!hasVectorExtension) {
        logger.debug('[WellbeingEmbedding] Vector extension not available, using text search fallback');
        return this.fallbackTextSearch(userId, queryText, wellbeingTypes, limit);
      }

      // Generate query embedding
      const queryEmbedding = await vectorEmbeddingService.embedText(queryText);
      const embeddingArray = `[${queryEmbedding.join(',')}]`;
      
      // Build query
      let sqlQuery = `
        SELECT 
          id, source_id, content, metadata,
          1 - (embedding <=> $1::vector) as similarity
        FROM vector_embeddings
        WHERE source_type = 'wellbeing'
        AND user_id = $2
      `;
      
      const params: (string | number | string[])[] = [embeddingArray, userId];
      let paramIndex = 3;
      
      if (wellbeingTypes && wellbeingTypes.length > 0) {
        sqlQuery += ` AND metadata->>'wellbeing_type' = ANY($${paramIndex}::text[])`;
        params.push(wellbeingTypes);
        paramIndex++;
      }
      
      sqlQuery += ` ORDER BY similarity DESC LIMIT $${paramIndex}`;
      params.push(limit);
      
      const result = await query(sqlQuery, params);
      
      return result.rows.map((row) => ({
        id: row.id,
        wellbeingType: row.metadata?.wellbeing_type as WellbeingType,
        entryId: row.source_id,
        content: row.content,
        metadata: row.metadata || {},
        similarity: parseFloat(row.similarity) || 0,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Check if error is about vector type not existing
      if (errorMessage.includes('vector') && errorMessage.includes('does not exist')) {
        logger.debug('[WellbeingEmbedding] Vector extension not available, using text search fallback', {
          userId,
          queryText,
        });
        return this.fallbackTextSearch(userId, queryText, wellbeingTypes, limit);
      }
      
      logger.error('[WellbeingEmbedding] Failed to search wellbeing history', {
        userId,
        queryText,
        error: errorMessage,
      });
      // Fallback to text search if vector search fails
      return this.fallbackTextSearch(userId, queryText, wellbeingTypes, limit);
    }
  }

  /**
   * Check if vector extension is available in the database
   */
  private async checkVectorExtension(): Promise<boolean> {
    try {
      // Check if vector type exists
      const result = await query<{ exists: boolean }>(
        `SELECT EXISTS(
          SELECT 1 FROM pg_type WHERE typname = 'vector'
        ) as exists`
      );
      return result.rows[0]?.exists === true;
    } catch (error) {
      logger.debug('[WellbeingEmbedding] Error checking vector extension', { error });
      return false;
    }
  }

  /**
   * Fallback text search when vector search is unavailable
   */
  private async fallbackTextSearch(
    userId: string,
    queryText: string,
    wellbeingTypes?: WellbeingType[],
    limit: number = 10
  ): Promise<Array<{
    id: string;
    wellbeingType: WellbeingType;
    entryId: string;
    content: string;
    metadata: Record<string, unknown>;
    similarity: number;
  }>> {
    try {
      let sqlQuery = `
        SELECT 
          id, source_id, content, metadata
        FROM vector_embeddings
        WHERE source_type = 'wellbeing'
        AND user_id = $1
        AND content ILIKE $2
      `;
      
      const params: (string | number | string[])[] = [userId, `%${queryText}%`];
      let paramIndex = 3;
      
      if (wellbeingTypes && wellbeingTypes.length > 0) {
        sqlQuery += ` AND metadata->>'wellbeing_type' = ANY($${paramIndex}::text[])`;
        params.push(wellbeingTypes);
        paramIndex++;
      }
      
      sqlQuery += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
      params.push(limit);
      
      const result = await query(sqlQuery, params);
      
      return result.rows.map((row) => ({
        id: row.id,
        wellbeingType: row.metadata?.wellbeing_type as WellbeingType,
        entryId: row.source_id,
        content: row.content,
        metadata: row.metadata || {},
        similarity: 0.5, // Default similarity for text search
      }));
    } catch (error) {
      logger.error('[WellbeingEmbedding] Fallback text search failed', {
        userId,
        queryText,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }
}

export const wellbeingEmbeddingService = new WellbeingEmbeddingService();
export default wellbeingEmbeddingService;

