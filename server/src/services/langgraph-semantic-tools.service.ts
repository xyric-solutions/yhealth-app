/**
 * @file LangGraph Semantic Tools Service
 * @description Semantic manager tools that collapse CRUD operations into single tools
 *
 * Problem: 163 individual CRUD tools (getMeal, updateMeal, deleteMeal, etc.)
 * Solution: Semantic managers (mealManager, goalManager, etc.) with action parameter
 *
 * Benefits:
 * - Reduces tool count by ~60%
 * - LLMs handle semantic tools better than CRUD proliferation
 * - Cleaner API surface
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { logger } from './logger.service.js';
import { query } from '../database/pg.js';
import { lifeHistoryEmbeddingService } from './life-history-embedding.service.js';
import { lifeGoalsService } from './wellbeing/life-goals.service.js';
import { goalDecompositionService } from './goal-decomposition.service.js';
import { getWhoopOverview, getRecoveryTrends, getSleepTrends, getStrainTrends } from './whoop-analytics.service.js';
import { stressService } from './stress.service.js';
import { journalService } from './wellbeing/journal.service.js';
import { voiceJournalService } from './wellbeing/voice-journal.service.js';
import { getCuratedPlaylists, getPlaylistTracks, searchSpotify, getRecommendations } from './spotify-playlist.service.js';
import { getJamendoTracks, getJamendoCuratedPlaylists, getJamendoPlaylistTracks, searchJamendo, getJamendoRecommendations, isJamendoConfigured } from './jamendo.service.js';

// ============================================
// COMMON SCHEMAS
// ============================================

const ActionSchema = z.enum(['get', 'getById', 'getByName', 'create', 'update', 'delete']);
const IdentifierSchema = z.object({
  id: z.string().optional().describe('Record ID (UUID)'),
  name: z.string().optional().describe('Record name for lookup'),
  date: z.string().optional().describe('Date for lookup (YYYY-MM-DD)'),
}).optional();

// ============================================
// MEAL MANAGER
// ============================================

const MealManagerSchema = z.object({
  action: ActionSchema.describe('Action: get, getById, create, update, delete'),
  identifier: IdentifierSchema.describe('ID or name to identify the record'),
  filters: z.object({
    date: z.string().optional().describe('Filter by date (YYYY-MM-DD)'),
    startDate: z.string().optional().describe('Filter from date'),
    endDate: z.string().optional().describe('Filter to date'),
  }).optional(),
  data: z.object({
    name: z.string().optional(),
    mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional(),
    foods: z.array(z.object({
      name: z.string(),
      servingSize: z.number().optional(),
      servingUnit: z.string().optional(),
      calories: z.number().optional(),
      protein: z.number().optional(),
      carbs: z.number().optional(),
      fat: z.number().optional(),
    })).optional(),
    totalCalories: z.number().optional(),
    notes: z.string().optional(),
    loggedAt: z.string().optional(),
  }).optional().describe('Data for create/update'),
});

async function handleMealManager(userId: string, params: z.infer<typeof MealManagerSchema>): Promise<string> {
  const { action, identifier, filters, data } = params;

  try {
    switch (action) {
      case 'get': {
        let sql = 'SELECT * FROM meal_logs WHERE user_id = $1';
        const values: (string | number)[] = [userId];
        if (filters?.date) { sql += ` AND DATE(eaten_at) = $${values.length + 1}`; values.push(filters.date); }
        if (filters?.startDate) { sql += ` AND eaten_at >= $${values.length + 1}`; values.push(filters.startDate); }
        if (filters?.endDate) { sql += ` AND eaten_at <= $${values.length + 1}`; values.push(filters.endDate); }
        sql += ' ORDER BY eaten_at DESC LIMIT 20';
        const result = await query(sql, values);
        return JSON.stringify({ success: true, meals: result.rows, count: result.rowCount });
      }

      case 'getById': {
        if (!identifier?.id) return JSON.stringify({ success: false, error: 'ID required' });
        const result = await query(
          'SELECT * FROM meal_logs WHERE id = $1 AND user_id = $2',
          [identifier.id, userId]
        );
        return JSON.stringify({ success: true, meal: result.rows[0] || null });
      }

      case 'getByName': {
        if (!identifier?.name) return JSON.stringify({ success: false, error: 'Name required' });
        const result = await query(
          `SELECT * FROM meal_logs WHERE user_id = $1 AND meal_name ILIKE $2 ORDER BY eaten_at DESC LIMIT 5`,
          [userId, `%${identifier.name}%`]
        );
        return JSON.stringify({ success: true, meals: result.rows });
      }

      case 'create': {
        if (!data) return JSON.stringify({ success: false, error: 'Data required for create' });

        const mealName = data.name || 'Meal';
        const eatenAt = data.loggedAt || new Date().toISOString();

        // Deduplication: check for same meal name within ±5 minutes
        const existing = await query<{ id: string; meal_name: string }>(
          `SELECT id, meal_name FROM meal_logs
           WHERE user_id = $1
             AND LOWER(TRIM(meal_name)) = LOWER(TRIM($2))
             AND eaten_at BETWEEN ($3::timestamp - INTERVAL '5 minutes') AND ($3::timestamp + INTERVAL '5 minutes')
           LIMIT 1`,
          [userId, mealName, eatenAt]
        );
        if (existing.rows.length > 0) {
          logger.info('[MealManager] Duplicate meal blocked', { userId, mealName });
          return JSON.stringify({
            success: true,
            meal: existing.rows[0],
            message: `"${mealName}" was already logged at this time. No duplicate created.`,
            duplicate: true,
          });
        }

        // Calculate macros from food items if not provided at meal level
        const foods = data.foods || [];
        let totalCalories = data.totalCalories || 0;
        let totalProtein = 0;
        let totalCarbs = 0;
        let totalFat = 0;

        for (const food of foods) {
          totalCalories += food.calories || 0;
          totalProtein += food.protein || 0;
          totalCarbs += food.carbs || 0;
          totalFat += food.fat || 0;
        }

        // If we have calories but no macros, estimate a balanced split
        if (totalCalories > 0 && totalProtein === 0 && totalCarbs === 0 && totalFat === 0) {
          totalProtein = Math.round((totalCalories * 0.30) / 4);  // 30% from protein
          totalCarbs = Math.round((totalCalories * 0.40) / 4);    // 40% from carbs
          totalFat = Math.round((totalCalories * 0.30) / 9);      // 30% from fat
        }

        const result = await query(
          `INSERT INTO meal_logs (user_id, meal_name, meal_type, foods, calories, protein_grams, carbs_grams, fat_grams, notes, eaten_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
          [userId, mealName, data.mealType || 'snack', JSON.stringify(foods),
           totalCalories, totalProtein, totalCarbs, totalFat,
           data.notes || null, eatenAt]
        );
        return JSON.stringify({ success: true, meal: result.rows[0], message: 'Meal logged successfully' });
      }

      case 'update': {
        if (!identifier?.id) return JSON.stringify({ success: false, error: 'ID required for update' });
        const updates: string[] = [];
        const values: (string | number)[] = [identifier.id, userId];
        let paramIndex = 3;

        if (data?.name) { updates.push(`meal_name = $${paramIndex++}`); values.push(data.name); }
        if (data?.mealType) { updates.push(`meal_type = $${paramIndex++}`); values.push(data.mealType); }
        if (data?.foods) { updates.push(`foods = $${paramIndex++}`); values.push(JSON.stringify(data.foods)); }
        if (data?.totalCalories !== undefined) { updates.push(`calories = $${paramIndex++}`); values.push(data.totalCalories); }
        if (data?.notes) { updates.push(`notes = $${paramIndex++}`); values.push(data.notes); }

        if (updates.length === 0) return JSON.stringify({ success: false, error: 'No updates provided' });

        const result = await query(
          `UPDATE meal_logs SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`,
          values
        );
        return JSON.stringify({ success: true, meal: result.rows[0], message: 'Meal updated' });
      }

      case 'delete': {
        if (!identifier?.id) return JSON.stringify({ success: false, error: 'ID required for delete' });
        await query('DELETE FROM meal_logs WHERE id = $1 AND user_id = $2', [identifier.id, userId]);
        return JSON.stringify({ success: true, message: 'Meal deleted' });
      }

      default:
        return JSON.stringify({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (error) {
    logger.error('[MealManager] Error', { action, error });
    return JSON.stringify({ success: false, error: String(error) });
  }
}

// ============================================
// GOAL MANAGER
// ============================================

const GoalManagerSchema = z.object({
  action: ActionSchema.describe('Action: get, getById, getByName, create, update, delete'),
  identifier: IdentifierSchema,
  filters: z.object({
    status: z.string().optional().describe('Filter: active, completed, paused, archived'),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }).optional(),
  data: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    targetValue: z.number().optional(),
    currentValue: z.number().optional(),
    unit: z.string().optional(),
    deadline: z.string().optional(),
    status: z.string().optional(),
  }).optional(),
});

async function handleGoalManager(userId: string, params: z.infer<typeof GoalManagerSchema>): Promise<string> {
  const { action, identifier, filters, data } = params;

  try {
    switch (action) {
      case 'get': {
        let sql = 'SELECT * FROM user_goals WHERE user_id = $1';
        const values: (string | number)[] = [userId];
        if (filters?.status) { sql += ` AND status = $${values.length + 1}`; values.push(filters.status); }
        sql += ' ORDER BY created_at DESC LIMIT 20';
        const result = await query(sql, values);
        return JSON.stringify({ success: true, goals: result.rows, count: result.rowCount });
      }

      case 'getById': {
        if (!identifier?.id) return JSON.stringify({ success: false, error: 'ID required' });
        const result = await query('SELECT * FROM user_goals WHERE id = $1 AND user_id = $2', [identifier.id, userId]);
        return JSON.stringify({ success: true, goal: result.rows[0] || null });
      }

      case 'getByName': {
        if (!identifier?.name) return JSON.stringify({ success: false, error: 'Name required' });
        const result = await query(
          `SELECT * FROM user_goals WHERE user_id = $1 AND title ILIKE $2 ORDER BY created_at DESC LIMIT 5`,
          [userId, `%${identifier.name}%`]
        );
        return JSON.stringify({ success: true, goals: result.rows });
      }

      case 'create': {
        if (!data?.name) return JSON.stringify({ success: false, error: 'Name required' });
        const result = await query(
          `INSERT INTO user_goals (user_id, title, description, category, target_value, current_value, target_unit, target_date, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
          [userId, data.name, data.description || null, data.category || 'general', data.targetValue || 0,
           data.currentValue || 0, data.unit || null, data.deadline || null, data.status || 'active']
        );
        return JSON.stringify({ success: true, goal: result.rows[0], message: 'Goal created' });
      }

      case 'update': {
        if (!identifier?.id) return JSON.stringify({ success: false, error: 'ID required' });
        const updates: string[] = [];
        const values: (string | number)[] = [identifier.id, userId];
        let i = 3;

        if (data?.name) { updates.push(`title = $${i++}`); values.push(data.name); }
        if (data?.description) { updates.push(`description = $${i++}`); values.push(data.description); }
        if (data?.targetValue !== undefined) { updates.push(`target_value = $${i++}`); values.push(data.targetValue); }
        if (data?.currentValue !== undefined) { updates.push(`current_value = $${i++}`); values.push(data.currentValue); }
        if (data?.status) { updates.push(`status = $${i++}`); values.push(data.status); }
        if (data?.deadline) { updates.push(`target_date = $${i++}`); values.push(data.deadline); }

        if (updates.length === 0) return JSON.stringify({ success: false, error: 'No updates' });

        const result = await query(
          `UPDATE user_goals SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`,
          values
        );
        return JSON.stringify({ success: true, goal: result.rows[0], message: 'Goal updated' });
      }

      case 'delete': {
        if (!identifier?.id) return JSON.stringify({ success: false, error: 'ID required' });
        await query('DELETE FROM user_goals WHERE id = $1 AND user_id = $2', [identifier.id, userId]);
        return JSON.stringify({ success: true, message: 'Goal deleted' });
      }

      default:
        return JSON.stringify({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (error) {
    logger.error('[GoalManager] Error', { action, error });
    return JSON.stringify({ success: false, error: String(error) });
  }
}

// ============================================
// MOOD MANAGER
// ============================================

const MoodManagerSchema = z.object({
  action: z.enum(['get', 'create', 'update', 'delete', 'timeline', 'patterns']).describe('Action to perform'),
  identifier: IdentifierSchema,
  filters: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    page: z.number().optional(),
    limit: z.number().optional(),
    days: z.number().optional().describe('Days for patterns analysis'),
  }).optional(),
  data: z.object({
    moodEmoji: z.string().optional(),
    descriptor: z.string().optional(),
    happinessRating: z.number().optional(),
    energyRating: z.number().optional(),
    stressRating: z.number().optional(),
    anxietyRating: z.number().optional(),
    emotionTags: z.array(z.string()).optional(),
    contextNote: z.string().optional(),
    mode: z.enum(['light', 'deep']).optional(),
    loggedAt: z.string().optional(),
  }).optional(),
});

async function handleMoodManager(userId: string, params: z.infer<typeof MoodManagerSchema>): Promise<string> {
  const { action, identifier, filters, data } = params;

  try {
    switch (action) {
      case 'get': {
        let sql = 'SELECT * FROM mood_logs WHERE user_id = $1';
        const values: (string | number)[] = [userId];
        if (filters?.startDate) { sql += ` AND logged_at >= $${values.length + 1}`; values.push(filters.startDate); }
        if (filters?.endDate) { sql += ` AND logged_at <= $${values.length + 1}`; values.push(filters.endDate); }
        sql += ` ORDER BY logged_at DESC LIMIT ${filters?.limit || 50}`;
        const result = await query(sql, values);
        return JSON.stringify({ success: true, moodLogs: result.rows });
      }

      case 'create': {
        if (!data?.mode) return JSON.stringify({ success: false, error: 'Mode (light/deep) required' });
        const result = await query(
          `INSERT INTO mood_logs (user_id, mood_emoji, descriptor, happiness_rating, energy_rating, stress_rating, anxiety_rating, emotion_tags, context_note, mode, logged_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
          [userId, data.moodEmoji || null, data.descriptor || null, data.happinessRating || null,
           data.energyRating || null, data.stressRating || null, data.anxietyRating || null,
           JSON.stringify(data.emotionTags || []), data.contextNote || null, data.mode,
           data.loggedAt || new Date().toISOString()]
        );
        return JSON.stringify({ success: true, moodLog: result.rows[0], message: 'Mood logged' });
      }

      case 'update': {
        if (!identifier?.id) return JSON.stringify({ success: false, error: 'Log ID required' });
        const updates: string[] = [];
        const values: (string | number)[] = [identifier.id, userId];
        let i = 3;

        if (data?.moodEmoji) { updates.push(`mood_emoji = $${i++}`); values.push(data.moodEmoji); }
        if (data?.happinessRating !== undefined) { updates.push(`happiness_rating = $${i++}`); values.push(data.happinessRating); }
        if (data?.energyRating !== undefined) { updates.push(`energy_rating = $${i++}`); values.push(data.energyRating); }
        if (data?.stressRating !== undefined) { updates.push(`stress_rating = $${i++}`); values.push(data.stressRating); }
        if (data?.contextNote) { updates.push(`context_note = $${i++}`); values.push(data.contextNote); }

        if (updates.length === 0) return JSON.stringify({ success: false, error: 'No updates' });

        const result = await query(
          `UPDATE mood_logs SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`,
          values
        );
        return JSON.stringify({ success: true, moodLog: result.rows[0], message: 'Mood updated' });
      }

      case 'delete': {
        if (!identifier?.id) return JSON.stringify({ success: false, error: 'Log ID required' });
        await query('DELETE FROM mood_logs WHERE id = $1 AND user_id = $2', [identifier.id, userId]);
        return JSON.stringify({ success: true, message: 'Mood log deleted' });
      }

      case 'timeline': {
        if (!filters?.startDate || !filters?.endDate) {
          return JSON.stringify({ success: false, error: 'startDate and endDate required' });
        }
        const result = await query(
          `SELECT DATE(logged_at) as date, AVG(happiness_rating) as avg_happiness, AVG(energy_rating) as avg_energy, COUNT(*) as logs
           FROM mood_logs WHERE user_id = $1 AND logged_at >= $2 AND logged_at <= $3
           GROUP BY DATE(logged_at) ORDER BY date`,
          [userId, filters.startDate, filters.endDate]
        );
        return JSON.stringify({ success: true, timeline: result.rows });
      }

      case 'patterns': {
        const days = filters?.days || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const result = await query(
          `SELECT EXTRACT(DOW FROM logged_at) as day_of_week, AVG(happiness_rating) as avg_happiness,
                  AVG(energy_rating) as avg_energy, COUNT(*) as logs
           FROM mood_logs WHERE user_id = $1 AND logged_at >= $2
           GROUP BY EXTRACT(DOW FROM logged_at) ORDER BY day_of_week`,
          [userId, startDate.toISOString()]
        );
        return JSON.stringify({ success: true, patterns: result.rows });
      }

      default:
        return JSON.stringify({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (error) {
    logger.error('[MoodManager] Error', { action, error });
    return JSON.stringify({ success: false, error: String(error) });
  }
}

// ============================================
// STRESS MANAGER
// ============================================

const StressManagerSchema = z.object({
  action: z.enum(['get', 'create', 'update', 'delete', 'trends']).describe('Action to perform'),
  identifier: IdentifierSchema,
  filters: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    page: z.number().optional(),
    limit: z.number().optional(),
    days: z.number().optional(),
  }).optional(),
  data: z.object({
    stressRating: z.number().optional().describe('Stress level 1-10'),
    triggers: z.array(z.string()).optional(),
    otherTrigger: z.string().optional(),
    note: z.string().optional(),
    checkInType: z.enum(['daily', 'on_demand']).optional(),
    loggedAt: z.string().optional(),
  }).optional(),
});

async function handleStressManager(userId: string, params: z.infer<typeof StressManagerSchema>): Promise<string> {
  const { action, identifier, filters, data } = params;

  try {
    switch (action) {
      case 'get': {
        let sql = 'SELECT * FROM stress_logs WHERE user_id = $1';
        const values: (string | number)[] = [userId];
        if (filters?.startDate) { sql += ` AND logged_at >= $${values.length + 1}`; values.push(filters.startDate); }
        if (filters?.endDate) { sql += ` AND logged_at <= $${values.length + 1}`; values.push(filters.endDate); }
        sql += ` ORDER BY logged_at DESC LIMIT ${filters?.limit || 50}`;
        const result = await query(sql, values);
        return JSON.stringify({ success: true, stressLogs: result.rows });
      }

      case 'create': {
        if (!data?.stressRating) return JSON.stringify({ success: false, error: 'stressRating required' });
        const triggers = Array.isArray(data.triggers) && data.triggers.length > 0
          ? `{${data.triggers.map((t: string) => `"${t}"`).join(',')}}`
          : '{}';
        const result = await query(
          `INSERT INTO stress_logs (user_id, stress_rating, triggers, other_trigger, note, check_in_type, logged_at)
           VALUES ($1, $2, $3::text[], $4, $5, $6, $7) RETURNING *`,
          [userId, data.stressRating, triggers, data.otherTrigger || null,
           data.note || null, data.checkInType || 'on_demand', data.loggedAt || new Date().toISOString()]
        );
        return JSON.stringify({ success: true, stressLog: result.rows[0], message: 'Stress logged' });
      }

      case 'update': {
        if (!identifier?.id) return JSON.stringify({ success: false, error: 'Log ID required' });
        const updates: string[] = [];
        const values: (string | number)[] = [identifier.id, userId];
        let i = 3;

        if (data?.stressRating !== undefined) { updates.push(`stress_rating = $${i++}`); values.push(data.stressRating); }
        if (data?.triggers) {
          const pgTriggers = Array.isArray(data.triggers) && data.triggers.length > 0
            ? `{${data.triggers.map((t: string) => `"${t}"`).join(',')}}`
            : '{}';
          updates.push(`triggers = $${i++}::text[]`); values.push(pgTriggers);
        }
        if (data?.note) { updates.push(`note = $${i++}`); values.push(data.note); }

        if (updates.length === 0) return JSON.stringify({ success: false, error: 'No updates' });

        const result = await query(
          `UPDATE stress_logs SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`,
          values
        );
        return JSON.stringify({ success: true, stressLog: result.rows[0], message: 'Stress log updated' });
      }

      case 'delete': {
        if (!identifier?.id) return JSON.stringify({ success: false, error: 'Log ID required' });
        await query('DELETE FROM stress_logs WHERE id = $1 AND user_id = $2', [identifier.id, userId]);
        return JSON.stringify({ success: true, message: 'Stress log deleted' });
      }

      case 'trends': {
        const days = filters?.days || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const result = await query(
          `SELECT DATE(logged_at) as date, AVG(stress_rating) as avg_stress, COUNT(*) as logs
           FROM stress_logs WHERE user_id = $1 AND logged_at >= $2
           GROUP BY DATE(logged_at) ORDER BY date`,
          [userId, startDate.toISOString()]
        );
        return JSON.stringify({ success: true, trends: result.rows });
      }

      default:
        return JSON.stringify({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (error) {
    logger.error('[StressManager] Error', { action, error });
    return JSON.stringify({ success: false, error: String(error) });
  }
}

// ============================================
// JOURNAL MANAGER
// ============================================

// Valid PostgreSQL enum values for journal_prompt_category
const VALID_JOURNAL_CATEGORIES = ['gratitude', 'reflection', 'emotional_processing', 'goal_setting', 'stress_management', 'self_compassion', 'future_focus', 'identity', 'productivity', 'relationships', 'spirituality', 'anxiety', 'creativity', 'cbt_reflection', 'cross_pillar'] as const;

function safeJournalCategory(cat: string | undefined | null): string {
  if (!cat) return 'reflection';
  const lower = cat.toLowerCase().trim();
  // Map common LLM-generated aliases to valid enum values
  const aliases: Record<string, string> = {
    'daily_review': 'reflection', 'general': 'reflection', 'creative': 'creativity',
    'daily': 'reflection', 'review': 'reflection', 'free_write': 'reflection',
    'personal': 'identity', 'goals': 'goal_setting', 'stress': 'stress_management',
    'emotional': 'emotional_processing', 'spiritual': 'spirituality', 'anxious': 'anxiety',
  };
  if ((VALID_JOURNAL_CATEGORIES as readonly string[]).includes(lower)) return lower;
  return aliases[lower] || 'reflection';
}

const JournalManagerSchema = z.object({
  action: z.enum(['get', 'create', 'update', 'delete', 'streak']).describe('REQUIRED. get=list entries, create=new entry, update=edit entry, delete=remove entry, streak=get journaling streak.'),
  identifier: IdentifierSchema,
  filters: z.object({
    startDate: z.string().optional().describe('Filter from date (YYYY-MM-DD)'),
    endDate: z.string().optional().describe('Filter to date (YYYY-MM-DD)'),
    category: z.string().optional().describe('Filter by prompt category: gratitude, reflection, emotional_processing, goal_setting, stress_management, creativity, spirituality, anxiety, identity, productivity, relationships'),
    page: z.number().optional(),
    limit: z.number().optional(),
  }).optional(),
  data: z.object({
    prompt: z.string().optional().describe('Journal prompt or title for the entry'),
    promptCategory: z.string().optional().describe('Category: gratitude, reflection, emotional_processing, goal_setting, stress_management, creativity, identity, productivity, relationships, spirituality, anxiety'),
    entryText: z.string().optional().describe('The journal entry text content. REQUIRED for create.'),
    mode: z.enum(['light', 'deep']).optional().describe('light=quick reflection, deep=detailed journaling'),
    loggedAt: z.string().optional().describe('ISO date string. Defaults to now.'),
  }).optional(),
});

async function handleJournalManager(userId: string, params: z.infer<typeof JournalManagerSchema>): Promise<string> {
  const { action, identifier, filters, data } = params;
  const safeCategory = safeJournalCategory(data?.promptCategory);
  const safeCategoryFilter = filters?.category ? safeJournalCategory(filters.category) : undefined;

  try {
    switch (action) {
      case 'get': {
        try {
          const result = await journalService.getJournalEntries(userId, {
            startDate: filters?.startDate,
            endDate: filters?.endDate,
            category: safeCategoryFilter as any,
            page: filters?.page || 1,
            limit: filters?.limit || 20,
          });
          return JSON.stringify({ success: true, journalEntries: result.entries, total: result.total });
        } catch (getError: any) {
          logger.warn('[JournalManager] GET via journalService failed, using fallback', { error: getError?.message });
          let sql = 'SELECT id, prompt, prompt_category, entry_text, word_count, mode, sentiment_label, streak_day, logged_at, created_at FROM journal_entries WHERE user_id = $1';
          const values: (string | number)[] = [userId];
          if (filters?.startDate) { sql += ` AND logged_at >= $${values.length + 1}`; values.push(filters.startDate); }
          if (filters?.endDate) { sql += ` AND logged_at <= $${values.length + 1}`; values.push(filters.endDate); }
          if (safeCategoryFilter) { sql += ` AND prompt_category = $${values.length + 1}::journal_prompt_category`; values.push(safeCategoryFilter); }
          sql += ` ORDER BY logged_at DESC LIMIT ${Math.min(filters?.limit || 20, 100)}`;
          const result = await query(sql, values);
          return JSON.stringify({ success: true, journalEntries: result.rows, total: result.rows.length });
        }
      }

      case 'create': {
        if (!data?.entryText) {
          return JSON.stringify({ success: false, error: 'entryText is required' });
        }
        const prompt = data.prompt || 'AI Coach reflection';
        const entryText = data.entryText;
        const mode = data.mode || 'light';
        const loggedAt = data.loggedAt || new Date().toISOString();
        const wordCount = entryText.trim().split(/\s+/).filter((w: string) => w.length > 0).length;

        // Attempt 1: journalService (uses all columns including enhanced ones)
        try {
          const entry = await journalService.createJournalEntry(userId, {
            prompt,
            promptCategory: safeCategory as any,
            entryText,
            mode,
            loggedAt,
          });
          logger.info('[JournalManager] CREATE succeeded via journalService', { entryId: entry.id });
          return JSON.stringify({ success: true, journalEntry: { id: entry.id, prompt: entry.prompt, entryText: entry.entryText, loggedAt: entry.loggedAt }, message: 'Journal entry created successfully' });
        } catch (svcError: any) {
          logger.warn('[JournalManager] CREATE via journalService failed, trying fallback', { error: svcError?.message });
        }

        // Attempt 2: Direct INSERT with safe enum cast
        try {
          const result = await query(
            `INSERT INTO journal_entries (user_id, prompt, prompt_category, entry_text, word_count, mode, logged_at)
             VALUES ($1, $2, $3::journal_prompt_category, $4, $5, $6, $7)
             RETURNING id, prompt, entry_text as "entryText", logged_at as "loggedAt"`,
            [userId, prompt, safeCategory, entryText, wordCount, mode, loggedAt]
          );
          logger.info('[JournalManager] CREATE succeeded via fallback INSERT', { entryId: result.rows[0]?.id });
          return JSON.stringify({ success: true, journalEntry: result.rows[0], message: 'Journal entry created' });
        } catch (sqlError: any) {
          logger.warn('[JournalManager] CREATE fallback with enum failed, trying without category', { error: sqlError?.message });
        }

        // Attempt 3: INSERT without prompt_category (skip enum entirely)
        try {
          const result = await query(
            `INSERT INTO journal_entries (user_id, prompt, entry_text, word_count, mode, logged_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, prompt, entry_text as "entryText", logged_at as "loggedAt"`,
            [userId, prompt, entryText, wordCount, mode, loggedAt]
          );
          logger.info('[JournalManager] CREATE succeeded via minimal INSERT (no category)', { entryId: result.rows[0]?.id });
          return JSON.stringify({ success: true, journalEntry: result.rows[0], message: 'Journal entry created' });
        } catch (minError: any) {
          logger.error('[JournalManager] ALL CREATE attempts failed', { error: minError?.message });
          return JSON.stringify({ success: false, error: `Failed to create journal entry: ${minError?.message}` });
        }
      }

      case 'update': {
        if (!identifier?.id) return JSON.stringify({ success: false, error: 'Entry ID required' });
        try {
          const entry = await journalService.updateJournalEntry(userId, identifier.id, {
            entryText: data?.entryText,
            prompt: data?.prompt,
            promptCategory: safeCategory as any,
          });
          return JSON.stringify({ success: true, journalEntry: { id: entry.id, prompt: entry.prompt, entryText: entry.entryText }, message: 'Journal entry updated' });
        } catch (updateError: any) {
          logger.warn('[JournalManager] UPDATE via journalService failed, using fallback', { error: updateError?.message });
          const updates: string[] = [];
          const values: (string | number)[] = [identifier.id, userId];
          let i = 3;
          if (data?.entryText) { updates.push(`entry_text = $${i++}`); values.push(data.entryText); }
          if (data?.prompt) { updates.push(`prompt = $${i++}`); values.push(data.prompt); }
          if (updates.length === 0) return JSON.stringify({ success: false, error: 'No updates provided' });
          updates.push('updated_at = NOW()');
          const result = await query(
            `UPDATE journal_entries SET ${updates.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING id, prompt, entry_text as "entryText"`,
            values
          );
          if (result.rows.length === 0) return JSON.stringify({ success: false, error: 'Journal entry not found' });
          return JSON.stringify({ success: true, journalEntry: result.rows[0], message: 'Journal entry updated' });
        }
      }

      case 'delete': {
        if (!identifier?.id) return JSON.stringify({ success: false, error: 'Entry ID required' });
        try {
          await journalService.deleteJournalEntry(userId, identifier.id);
        } catch {
          await query('DELETE FROM journal_entries WHERE id = $1 AND user_id = $2', [identifier.id, userId]);
        }
        return JSON.stringify({ success: true, message: 'Journal entry deleted' });
      }

      case 'streak': {
        try {
          const streak = await journalService.getJournalStreak(userId);
          return JSON.stringify({ success: true, ...streak });
        } catch {
          const result = await query(
            `SELECT COUNT(DISTINCT DATE(logged_at)) as streak FROM journal_entries WHERE user_id = $1 AND logged_at >= CURRENT_DATE - INTERVAL '30 days'`,
            [userId]
          );
          return JSON.stringify({ success: true, currentStreak: parseInt(result.rows[0]?.streak || '0', 10), longestStreak: 0 });
        }
      }

      default:
        return JSON.stringify({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (error: any) {
    const msg = error?.message || String(error);
    logger.error('[JournalManager] Unhandled error', { action, error: msg, stack: error?.stack?.slice(0, 300) });
    return JSON.stringify({ success: false, error: msg, action });
  }
}

// ============================================
// VOICE JOURNAL MANAGER
// ============================================

const VoiceJournalManagerSchema = z.object({
  action: z.enum(['start', 'status']).describe('start = begin a new voice journal session, status = check for active session'),
  identifier: IdentifierSchema,
  data: z.object({
    mode: z.enum(['quick_reflection', 'deep_dive', 'gratitude', 'free_write']).optional().describe('Journaling mode for the voice session'),
  }).optional(),
});

async function handleVoiceJournalManager(userId: string, params: z.infer<typeof VoiceJournalManagerSchema>): Promise<string> {
  const { action } = params;

  try {
    switch (action) {
      case 'start': {
        const session = await voiceJournalService.startSession(userId);
        return JSON.stringify({
          success: true,
          sessionId: session.id,
          message: 'Voice journal session started. Guide the user to the voice journal page to begin recording.',
          navigateTo: 'wellbeing/journal',
        });
      }

      case 'status': {
        const session = await voiceJournalService.getActiveSession(userId);
        if (session) {
          return JSON.stringify({
            success: true,
            hasActiveSession: true,
            sessionId: session.id,
            status: session.status,
            exchangeCount: session.exchangeCount,
          });
        }
        return JSON.stringify({ success: true, hasActiveSession: false });
      }

      default:
        return JSON.stringify({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (error) {
    logger.error('[VoiceJournalManager] Error', { action, error });
    return JSON.stringify({ success: false, error: String(error) });
  }
}

// ============================================
// ENERGY MANAGER
// ============================================

const EnergyManagerSchema = z.object({
  action: z.enum(['get', 'create', 'update', 'delete', 'timeline', 'patterns']).describe('REQUIRED. The action to perform.'),
  identifier: IdentifierSchema,
  filters: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    limit: z.number().optional(),
    days: z.number().optional(),
  }).optional(),
  data: z.object({
    energyRating: z.number().optional().describe('Energy level 1-10'),
    factors: z.array(z.string()).optional(),
    note: z.string().optional(),
    loggedAt: z.string().optional(),
  }).optional(),
});

async function handleEnergyManager(userId: string, params: z.infer<typeof EnergyManagerSchema>): Promise<string> {
  const { action, identifier, filters, data } = params;

  try {
    switch (action) {
      case 'get': {
        let sql = 'SELECT * FROM energy_logs WHERE user_id = $1';
        const values: (string | number)[] = [userId];
        if (filters?.startDate) { sql += ` AND logged_at >= $${values.length + 1}`; values.push(filters.startDate); }
        if (filters?.endDate) { sql += ` AND logged_at <= $${values.length + 1}`; values.push(filters.endDate); }
        sql += ` ORDER BY logged_at DESC LIMIT ${filters?.limit || 50}`;
        const result = await query(sql, values);
        return JSON.stringify({ success: true, energyLogs: result.rows });
      }

      case 'create': {
        if (!data?.energyRating) return JSON.stringify({ success: false, error: 'energyRating required' });
        const contextTag = data.factors && data.factors.length > 0 ? data.factors[0] : null;
        const result = await query(
          `INSERT INTO energy_logs (user_id, energy_rating, context_tag, context_note, logged_at)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [userId, data.energyRating, contextTag, data.note || null,
           data.loggedAt || new Date().toISOString()]
        );
        return JSON.stringify({ success: true, energyLog: result.rows[0], message: 'Energy logged' });
      }

      case 'update': {
        if (!identifier?.id) return JSON.stringify({ success: false, error: 'Log ID required' });
        const updates: string[] = [];
        const values: (string | number)[] = [identifier.id, userId];
        let i = 3;

        if (data?.energyRating !== undefined) { updates.push(`energy_rating = $${i++}`); values.push(data.energyRating); }
        if (data?.note) { updates.push(`context_note = $${i++}`); values.push(data.note); }

        if (updates.length === 0) return JSON.stringify({ success: false, error: 'No updates' });

        const result = await query(
          `UPDATE energy_logs SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`,
          values
        );
        return JSON.stringify({ success: true, energyLog: result.rows[0], message: 'Energy log updated' });
      }

      case 'delete': {
        if (!identifier?.id) return JSON.stringify({ success: false, error: 'Log ID required' });
        await query('DELETE FROM energy_logs WHERE id = $1 AND user_id = $2', [identifier.id, userId]);
        return JSON.stringify({ success: true, message: 'Energy log deleted' });
      }

      case 'timeline': {
        if (!filters?.startDate || !filters?.endDate) {
          return JSON.stringify({ success: false, error: 'startDate and endDate required' });
        }
        const result = await query(
          `SELECT DATE(logged_at) as date, AVG(energy_rating) as avg_energy, COUNT(*) as logs
           FROM energy_logs WHERE user_id = $1 AND logged_at >= $2 AND logged_at <= $3
           GROUP BY DATE(logged_at) ORDER BY date`,
          [userId, filters.startDate, filters.endDate]
        );
        return JSON.stringify({ success: true, timeline: result.rows });
      }

      case 'patterns': {
        const days = filters?.days || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const result = await query(
          `SELECT EXTRACT(HOUR FROM logged_at) as hour, AVG(energy_rating) as avg_energy, COUNT(*) as logs
           FROM energy_logs WHERE user_id = $1 AND logged_at >= $2
           GROUP BY EXTRACT(HOUR FROM logged_at) ORDER BY hour`,
          [userId, startDate.toISOString()]
        );
        return JSON.stringify({ success: true, patterns: result.rows });
      }

      default:
        return JSON.stringify({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (error) {
    logger.error('[EnergyManager] Error', { action, error });
    return JSON.stringify({ success: false, error: String(error) });
  }
}

// ============================================
// HABIT MANAGER
// ============================================

const HabitManagerSchema = z.object({
  action: z.enum(['get', 'create', 'update', 'delete', 'log', 'analytics']).describe('REQUIRED. The action to perform.'),
  identifier: IdentifierSchema,
  filters: z.object({
    status: z.string().optional(),
  }).optional(),
  data: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    frequency: z.string().optional(),
    targetCount: z.number().optional(),
    category: z.string().optional(),
    reminderTime: z.string().optional(),
    completedAt: z.string().optional().describe('For logging completion'),
    notes: z.string().optional(),
  }).optional(),
});

async function handleHabitManager(userId: string, params: z.infer<typeof HabitManagerSchema>): Promise<string> {
  const { action, identifier, filters, data } = params;

  try {
    switch (action) {
      case 'get': {
        let sql = 'SELECT * FROM habits WHERE user_id = $1';
        const values: (string | number | boolean)[] = [userId];
        if (filters?.status === 'active') { sql += ` AND is_active = true AND is_archived = false`; }
        else if (filters?.status === 'archived') { sql += ` AND is_archived = true`; }
        else if (filters?.status) { sql += ` AND is_active = $${values.length + 1}`; values.push(filters.status === 'true'); }
        sql += ' ORDER BY created_at DESC';
        const result = await query(sql, values);
        return JSON.stringify({ success: true, habits: result.rows });
      }

      case 'create': {
        if (!data?.name) return JSON.stringify({ success: false, error: 'Habit name required' });
        const result = await query(
          `INSERT INTO habits (user_id, habit_name, description, frequency, target_value, category, reminder_time)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [userId, data.name, data.description || null, data.frequency || 'daily',
           data.targetCount || 1, data.category || null, data.reminderTime || null]
        );
        return JSON.stringify({ success: true, habit: result.rows[0], message: 'Habit created' });
      }

      case 'update': {
        if (!identifier?.id) return JSON.stringify({ success: false, error: 'Habit ID required' });
        const updates: string[] = [];
        const values: (string | number)[] = [identifier.id, userId];
        let i = 3;

        if (data?.name) { updates.push(`habit_name = $${i++}`); values.push(data.name); }
        if (data?.description) { updates.push(`description = $${i++}`); values.push(data.description); }
        if (data?.frequency) { updates.push(`frequency = $${i++}`); values.push(data.frequency); }
        if (data?.targetCount !== undefined) { updates.push(`target_value = $${i++}`); values.push(data.targetCount); }

        if (updates.length === 0) return JSON.stringify({ success: false, error: 'No updates' });

        const result = await query(
          `UPDATE habits SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`,
          values
        );
        return JSON.stringify({ success: true, habit: result.rows[0], message: 'Habit updated' });
      }

      case 'delete': {
        if (!identifier?.id) return JSON.stringify({ success: false, error: 'Habit ID required' });
        await query('DELETE FROM habits WHERE id = $1 AND user_id = $2', [identifier.id, userId]);
        return JSON.stringify({ success: true, message: 'Habit deleted' });
      }

      case 'log': {
        if (!identifier?.id) return JSON.stringify({ success: false, error: 'Habit ID required' });
        const result = await query(
          `INSERT INTO habit_logs (habit_id, user_id, completed_at, notes)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [identifier.id, userId, data?.completedAt || new Date().toISOString(), data?.notes || null]
        );
        return JSON.stringify({ success: true, log: result.rows[0], message: 'Habit completion logged' });
      }

      case 'analytics': {
        const result = await query(
          `SELECT h.id, h.habit_name, h.target_value, COUNT(hl.id) as completed_count,
                  COUNT(hl.id)::float / NULLIF(h.target_value, 0) * 100 as completion_rate
           FROM habits h
           LEFT JOIN habit_logs hl ON h.id = hl.habit_id AND hl.completed_at >= CURRENT_DATE - INTERVAL '30 days'
           WHERE h.user_id = $1 AND h.is_active = true
           GROUP BY h.id`,
          [userId]
        );
        return JSON.stringify({ success: true, analytics: result.rows });
      }

      default:
        return JSON.stringify({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (error) {
    logger.error('[HabitManager] Error', { action, error });
    return JSON.stringify({ success: false, error: String(error) });
  }
}

// ============================================
// SCHEDULE MANAGER
// ============================================

const ScheduleManagerSchema = z.object({
  action: z.enum(['get', 'getByDate', 'create', 'update', 'delete']).describe('REQUIRED. The action to perform.'),
  identifier: IdentifierSchema,
  filters: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }).optional(),
  data: z.object({
    scheduleDate: z.string().optional().describe('Date for the schedule (YYYY-MM-DD)'),
    title: z.string().optional(),
    description: z.string().optional(),
    items: z.array(z.object({
      title: z.string(),
      startTime: z.string(),
      endTime: z.string().optional(),
      description: z.string().optional(),
      category: z.string().optional(),
    })).optional(),
  }).optional(),
});

async function handleScheduleManager(userId: string, params: z.infer<typeof ScheduleManagerSchema>): Promise<string> {
  const { action, identifier, filters, data } = params;

  try {
    switch (action) {
      case 'get': {
        let sql = 'SELECT * FROM daily_schedules WHERE user_id = $1';
        const values: (string | number)[] = [userId];
        if (filters?.startDate) { sql += ` AND schedule_date >= $${values.length + 1}`; values.push(filters.startDate); }
        if (filters?.endDate) { sql += ` AND schedule_date <= $${values.length + 1}`; values.push(filters.endDate); }
        sql += ' ORDER BY schedule_date DESC LIMIT 30';
        const result = await query(sql, values);
        return JSON.stringify({ success: true, schedules: result.rows });
      }

      case 'getByDate': {
        const date = identifier?.date || new Date().toISOString().split('T')[0];
        
        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return JSON.stringify({ 
            success: false, 
            error: `Invalid date format: ${date}. Please use YYYY-MM-DD format (e.g., 2024-01-15)` 
          });
        }

        try {
          const result = await query(
            `SELECT ds.*, COALESCE(json_agg(
              json_build_object(
                'id', si.id,
                'title', si.title,
                'startTime', si.start_time,
                'endTime', si.end_time,
                'description', si.description,
                'category', si.category,
                'position', si.position
              )
            ) FILTER (WHERE si.id IS NOT NULL), '[]') as items
             FROM daily_schedules ds
             LEFT JOIN schedule_items si ON ds.id = si.schedule_id
             WHERE ds.user_id = $1 AND ds.schedule_date = $2::date AND ds.is_template = false
             GROUP BY ds.id`,
            [userId, date]
          );
          
          if (result.rows.length === 0) {
            logger.debug('[ScheduleManager] No schedule found for date', { userId, date });
            return JSON.stringify({ 
              success: true, 
              schedule: null, 
              date,
              message: `No schedule found for ${date}` 
            });
          }

          const schedule = result.rows[0];
          logger.info('[ScheduleManager] Retrieved schedule by date', { 
            userId, 
            scheduleId: schedule.id, 
            date,
            itemsCount: Array.isArray(schedule.items) ? schedule.items.length : 0
          });

          return JSON.stringify({ 
            success: true, 
            schedule, 
            date,
            message: `Schedule found for ${date} with ${Array.isArray(schedule.items) ? schedule.items.length : 0} items`
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.error('[ScheduleManager] Failed to get schedule by date', { userId, date, error: errorMsg });
          return JSON.stringify({ 
            success: false, 
            error: `Failed to retrieve schedule: ${errorMsg}` 
          });
        }
      }

      case 'create': {
        const scheduleDate = data?.scheduleDate || new Date().toISOString().split('T')[0];
        
        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduleDate)) {
          return JSON.stringify({ 
            success: false, 
            error: `Invalid date format: ${scheduleDate}. Please use YYYY-MM-DD format (e.g., 2024-01-15)` 
          });
        }

        try {
          // Check if schedule exists first
          const existing = await query(
            `SELECT id FROM daily_schedules WHERE user_id = $1 AND schedule_date = $2 AND is_template = false`,
            [userId, scheduleDate]
          );
          
          let schedule;
          let isUpdate = false;
          
          if (existing.rows.length > 0) {
            // Update existing schedule
            isUpdate = true;
            const result = await query(
              `UPDATE daily_schedules SET name = $1, notes = $2, updated_at = NOW() 
               WHERE id = $3 AND user_id = $4 RETURNING *`,
              [data?.title || 'Daily Schedule', data?.description || null, existing.rows[0].id, userId]
            );
            schedule = result.rows[0];
            logger.info('[ScheduleManager] Updated existing schedule', { userId, scheduleId: schedule.id, scheduleDate });
          } else {
            // Create new schedule
            const result = await query(
              `INSERT INTO daily_schedules (user_id, schedule_date, name, notes, is_template)
               VALUES ($1, $2, $3, $4, false)
               RETURNING *`,
              [userId, scheduleDate, data?.title || 'Daily Schedule', data?.description || null]
            );
            schedule = result.rows[0];
            logger.info('[ScheduleManager] Created new schedule', { userId, scheduleId: schedule.id, scheduleDate });
          }

          // Add items if provided
          const createdItems: Array<{ id: string; title: string }> = [];
          const itemErrors: Array<{ title: string; error: string }> = [];
          
          if (data?.items && data.items.length > 0) {
            for (const item of data.items) {
              try {
                // Validate required fields
                if (!item.title || !item.startTime) {
                  const errorMsg = !item.title ? 'Missing title' : 'Missing startTime';
                  itemErrors.push({ title: item.title || 'Unknown', error: errorMsg });
                  logger.warn('[ScheduleManager] Invalid schedule item', { userId, scheduleId: schedule.id, item, error: errorMsg });
                  continue;
                }

                // Normalize time format (convert "5:30 AM" to "05:30")
                const normalizeTime = (time: string): string => {
                  if (!time) return time;
                  let normalized = time.trim().toUpperCase();
                  const isPM = normalized.includes('PM');
                  const isAM = normalized.includes('AM');
                  normalized = normalized.replace(/[AP]M/gi, '').trim();
                  const parts = normalized.split(':');
                  if (parts.length !== 2) return time;
                  let hours = parseInt(parts[0], 10);
                  const minutes = parts[1].padStart(2, '0');
                  if (isPM && hours !== 12) hours += 12;
                  else if (isAM && hours === 12) hours = 0;
                  return `${hours.toString().padStart(2, '0')}:${minutes}`;
                };

                const normalizedStartTime = normalizeTime(item.startTime);
                const normalizedEndTime = item.endTime ? normalizeTime(item.endTime) : null;

                const itemResult = await query<{ id: string; title: string }>(
                  `INSERT INTO schedule_items (schedule_id, title, start_time, end_time, description, category, position)
                   VALUES ($1, $2, $3, $4, $5, $6, 
                     COALESCE((SELECT MAX(position) FROM schedule_items WHERE schedule_id = $1), -1) + 1)
                   RETURNING id, title`,
                  [
                    schedule.id, 
                    item.title, 
                    normalizedStartTime, 
                    normalizedEndTime, 
                    item.description || null, 
                    item.category || 'general'
                  ]
                );
                
                if (itemResult.rows[0]) {
                  createdItems.push(itemResult.rows[0]);
                }
                logger.debug('[ScheduleManager] Created schedule item', { 
                  userId, 
                  scheduleId: schedule.id, 
                  itemId: itemResult.rows[0].id,
                  title: item.title 
                });
              } catch (itemError) {
                const errorMsg = itemError instanceof Error ? itemError.message : String(itemError);
                itemErrors.push({ title: item.title || 'Unknown', error: errorMsg });
                logger.error('[ScheduleManager] Failed to create schedule item', { 
                  userId, 
                  scheduleId: schedule.id, 
                  item, 
                  error: errorMsg 
                });
              }
            }
          }

          const message = isUpdate 
            ? `Schedule updated for ${scheduleDate}. ${createdItems.length} items added.`
            : `Schedule created for ${scheduleDate} with ${createdItems.length} items.`;
          
          const response: {
            success: boolean;
            schedule: typeof schedule;
            itemsCreated: number;
            items: Array<{ id: string; title: string }>;
            errors?: Array<{ title: string; error: string }>;
            message: string;
          } = {
            success: true,
            schedule,
            itemsCreated: createdItems.length,
            items: createdItems,
            message,
          };

          if (itemErrors.length > 0) {
            response.errors = itemErrors;
            response.message += ` ${itemErrors.length} items failed to create.`;
          }

          logger.info('[ScheduleManager] Schedule creation completed', {
            userId,
            scheduleId: schedule.id,
            scheduleDate,
            itemsCreated: createdItems.length,
            itemsFailed: itemErrors.length,
            isUpdate,
          });

          // Return a clear, actionable response that the AI can understand
          const finalMessage = `${isUpdate ? 'Updated' : 'Created'} schedule for ${scheduleDate} with ${createdItems.length} items${itemErrors.length > 0 ? ` (${itemErrors.length} items failed)` : ''}. Schedule ID: ${schedule.id}. ${itemErrors.length === 0 ? 'All items saved successfully to database.' : 'Some items may need to be added manually.'}`;
          
          return JSON.stringify({
            ...response,
            message: finalMessage,
            scheduleId: schedule.id,
            scheduleDate,
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.error('[ScheduleManager] Failed to create schedule', { userId, scheduleDate, error: errorMsg });
          return JSON.stringify({ 
            success: false, 
            error: `Failed to create schedule: ${errorMsg}` 
          });
        }
      }

      case 'update': {
        if (!identifier?.id) return JSON.stringify({ success: false, error: 'Schedule ID required' });
        const updates: string[] = [];
        const values: (string | number)[] = [identifier.id, userId];
        let i = 3;

        if (data?.title) { updates.push(`name = $${i++}`); values.push(data.title); }
        if (data?.description) { updates.push(`notes = $${i++}`); values.push(data.description); }

        if (updates.length === 0) return JSON.stringify({ success: false, error: 'No updates' });

        const result = await query(
          `UPDATE daily_schedules SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`,
          values
        );
        return JSON.stringify({ success: true, schedule: result.rows[0], message: 'Schedule updated' });
      }

      case 'delete': {
        if (!identifier?.id) return JSON.stringify({ success: false, error: 'Schedule ID required' });
        await query('DELETE FROM daily_schedules WHERE id = $1 AND user_id = $2', [identifier.id, userId]);
        return JSON.stringify({ success: true, message: 'Schedule deleted' });
      }

      default:
        return JSON.stringify({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (error) {
    logger.error('[ScheduleManager] Error', { action, error });
    return JSON.stringify({ success: false, error: String(error) });
  }
}

// ============================================
// WORKOUT MANAGER
// ============================================

const WorkoutManagerSchema = z.object({
  action: z.enum(['getPlans', 'getLogs', 'createPlan', 'updatePlan', 'deletePlan', 'createLog', 'updateLog', 'deleteLog']).describe('REQUIRED. The action to perform. Use "getPlans" to list plans, "getLogs" to list logs.'),
  identifier: IdentifierSchema,
  filters: z.object({
    status: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    limit: z.number().optional(),
  }).optional(),
  data: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    difficulty: z.string().optional(),
    durationWeeks: z.number().optional(),
    workoutsPerWeek: z.number().optional(),
    status: z.string().optional(),
    workoutPlanId: z.string().optional(),
    exercises: z.array(z.object({
      name: z.string(),
      sets: z.number().optional(),
      reps: z.number().optional(),
      weight: z.number().optional(),
      duration: z.number().optional(),
    })).optional(),
    durationMinutes: z.number().optional(),
    notes: z.string().optional(),
    loggedAt: z.string().optional(),
  }).optional(),
});

async function handleWorkoutManager(userId: string, params: z.infer<typeof WorkoutManagerSchema>): Promise<string> {
  const { action, identifier, filters, data } = params;

  try {
    switch (action) {
      case 'getPlans': {
        let sql = 'SELECT * FROM workout_plans WHERE user_id = $1';
        const values: (string | number)[] = [userId];
        if (filters?.status) { sql += ` AND status = $${values.length + 1}`; values.push(filters.status); }
        sql += ' ORDER BY created_at DESC';
        const result = await query(sql, values);
        return JSON.stringify({ success: true, workoutPlans: result.rows });
      }

      case 'getLogs': {
        let sql = 'SELECT * FROM workout_logs WHERE user_id = $1';
        const values: (string | number)[] = [userId];
        if (filters?.startDate) { sql += ` AND logged_at >= $${values.length + 1}`; values.push(filters.startDate); }
        if (filters?.endDate) { sql += ` AND logged_at <= $${values.length + 1}`; values.push(filters.endDate); }
        sql += ` ORDER BY logged_at DESC LIMIT ${filters?.limit || 20}`;
        const result = await query(sql, values);
        return JSON.stringify({ success: true, workoutLogs: result.rows });
      }

      case 'createPlan': {
        if (!data?.name) return JSON.stringify({ success: false, error: 'Plan name required' });
        const result = await query(
          `INSERT INTO workout_plans (user_id, name, description, initial_difficulty_level, duration_weeks, workouts_per_week, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [userId, data.name, data.description || null, data.difficulty || 'intermediate',
           data.durationWeeks || 4, data.workoutsPerWeek || 3, data.status || 'active']
        );
        return JSON.stringify({ success: true, workoutPlan: result.rows[0], message: 'Workout plan created' });
      }

      case 'updatePlan': {
        if (!identifier?.id) return JSON.stringify({ success: false, error: 'Plan ID required' });
        const updates: string[] = [];
        const values: (string | number)[] = [identifier.id, userId];
        let i = 3;

        if (data?.name) { updates.push(`name = $${i++}`); values.push(data.name); }
        if (data?.description) { updates.push(`description = $${i++}`); values.push(data.description); }
        if (data?.status) { updates.push(`status = $${i++}`); values.push(data.status); }
        if (data?.difficulty) { updates.push(`initial_difficulty_level = $${i++}`); values.push(data.difficulty); }

        if (updates.length === 0) return JSON.stringify({ success: false, error: 'No updates' });

        const result = await query(
          `UPDATE workout_plans SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`,
          values
        );
        return JSON.stringify({ success: true, workoutPlan: result.rows[0], message: 'Plan updated' });
      }

      case 'deletePlan': {
        if (!identifier?.id) return JSON.stringify({ success: false, error: 'Plan ID required' });
        await query('DELETE FROM workout_plans WHERE id = $1 AND user_id = $2', [identifier.id, userId]);
        return JSON.stringify({ success: true, message: 'Workout plan deleted' });
      }

      case 'createLog': {
        const result = await query(
          `INSERT INTO workout_logs (user_id, workout_plan_id, exercises, duration_minutes, notes, logged_at)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [userId, data?.workoutPlanId || null, JSON.stringify(data?.exercises || []),
           data?.durationMinutes || null, data?.notes || null, data?.loggedAt || new Date().toISOString()]
        );
        return JSON.stringify({ success: true, workoutLog: result.rows[0], message: 'Workout logged' });
      }

      case 'updateLog': {
        if (!identifier?.id) return JSON.stringify({ success: false, error: 'Log ID required' });
        const updates: string[] = [];
        const values: (string | number)[] = [identifier.id, userId];
        let i = 3;

        if (data?.exercises) { updates.push(`exercises = $${i++}`); values.push(JSON.stringify(data.exercises)); }
        if (data?.durationMinutes !== undefined) { updates.push(`duration_minutes = $${i++}`); values.push(data.durationMinutes); }
        if (data?.notes) { updates.push(`notes = $${i++}`); values.push(data.notes); }

        if (updates.length === 0) return JSON.stringify({ success: false, error: 'No updates' });

        const result = await query(
          `UPDATE workout_logs SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`,
          values
        );
        return JSON.stringify({ success: true, workoutLog: result.rows[0], message: 'Log updated' });
      }

      case 'deleteLog': {
        if (!identifier?.id) return JSON.stringify({ success: false, error: 'Log ID required' });
        await query('DELETE FROM workout_logs WHERE id = $1 AND user_id = $2', [identifier.id, userId]);
        return JSON.stringify({ success: true, message: 'Workout log deleted' });
      }

      default:
        return JSON.stringify({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (error) {
    logger.error('[WorkoutManager] Error', { action, error });
    return JSON.stringify({ success: false, error: String(error) });
  }
}

// ============================================
// RECIPE MANAGER
// ============================================

const RecipeManagerSchema = z.object({
  action: z.enum(['get', 'getById', 'getByName', 'create', 'update', 'delete']).describe('REQUIRED. The action to perform.'),
  identifier: IdentifierSchema,
  filters: z.object({
    cuisine: z.string().optional(),
    mealType: z.string().optional(),
    limit: z.number().optional(),
  }).optional(),
  data: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    ingredients: z.array(z.object({
      name: z.string(),
      amount: z.number().optional(),
      unit: z.string().optional(),
    })).optional(),
    instructions: z.array(z.string()).optional(),
    prepTimeMinutes: z.number().optional(),
    cookTimeMinutes: z.number().optional(),
    servings: z.number().optional(),
    calories: z.number().optional(),
    cuisine: z.string().optional(),
    mealType: z.string().optional(),
  }).optional(),
});

async function handleRecipeManager(userId: string, params: z.infer<typeof RecipeManagerSchema>): Promise<string> {
  const { action, identifier, filters, data } = params;

  try {
    switch (action) {
      case 'get': {
        let sql = 'SELECT * FROM user_recipes WHERE user_id = $1';
        const values: (string | number)[] = [userId];
        if (filters?.cuisine) { sql += ` AND cuisine = $${values.length + 1}`; values.push(filters.cuisine); }
        if (filters?.mealType) { sql += ` AND category = $${values.length + 1}`; values.push(filters.mealType); }
        sql += ` ORDER BY created_at DESC LIMIT ${filters?.limit || 20}`;
        const result = await query(sql, values);
        return JSON.stringify({ success: true, recipes: result.rows });
      }

      case 'getById': {
        if (!identifier?.id) return JSON.stringify({ success: false, error: 'ID required' });
        const result = await query('SELECT * FROM user_recipes WHERE id = $1 AND user_id = $2', [identifier.id, userId]);
        return JSON.stringify({ success: true, recipe: result.rows[0] });
      }

      case 'getByName': {
        if (!identifier?.name) return JSON.stringify({ success: false, error: 'Name required' });
        const result = await query(
          `SELECT * FROM user_recipes WHERE user_id = $1 AND name ILIKE $2 LIMIT 5`,
          [userId, `%${identifier.name}%`]
        );
        return JSON.stringify({ success: true, recipes: result.rows });
      }

      case 'create': {
        if (!data?.name) return JSON.stringify({ success: false, error: 'Recipe name required' });
        const result = await query(
          `INSERT INTO user_recipes (user_id, name, description, ingredients, instructions, prep_time_minutes, cook_time_minutes, servings, calories_per_serving, cuisine, category)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
          [userId, data.name, data.description || null, JSON.stringify(data.ingredients || []),
           JSON.stringify(data.instructions || []), data.prepTimeMinutes || null, data.cookTimeMinutes || null,
           data.servings || null, data.calories || null, data.cuisine || null, data.mealType || null]
        );
        return JSON.stringify({ success: true, recipe: result.rows[0], message: 'Recipe created' });
      }

      case 'update': {
        if (!identifier?.id) return JSON.stringify({ success: false, error: 'Recipe ID required' });
        const updates: string[] = [];
        const values: (string | number)[] = [identifier.id, userId];
        let i = 3;

        if (data?.name) { updates.push(`name = $${i++}`); values.push(data.name); }
        if (data?.description) { updates.push(`description = $${i++}`); values.push(data.description); }
        if (data?.ingredients) { updates.push(`ingredients = $${i++}`); values.push(JSON.stringify(data.ingredients)); }
        if (data?.instructions) { updates.push(`instructions = $${i++}`); values.push(JSON.stringify(data.instructions)); }
        if (data?.calories !== undefined) { updates.push(`calories_per_serving = $${i++}`); values.push(data.calories); }

        if (updates.length === 0) return JSON.stringify({ success: false, error: 'No updates' });

        const result = await query(
          `UPDATE user_recipes SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`,
          values
        );
        return JSON.stringify({ success: true, recipe: result.rows[0], message: 'Recipe updated' });
      }

      case 'delete': {
        if (!identifier?.id) return JSON.stringify({ success: false, error: 'Recipe ID required' });
        await query('DELETE FROM user_recipes WHERE id = $1 AND user_id = $2', [identifier.id, userId]);
        return JSON.stringify({ success: true, message: 'Recipe deleted' });
      }

      default:
        return JSON.stringify({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (error) {
    logger.error('[RecipeManager] Error', { action, error });
    return JSON.stringify({ success: false, error: String(error) });
  }
}

// ============================================
// DIET PLAN MANAGER
// ============================================

const DietPlanManagerSchema = z.object({
  action: z.enum(['get', 'getById', 'getByName', 'create', 'update', 'delete']).describe('REQUIRED. The action to perform. Use "get" to list all plans.'),
  identifier: IdentifierSchema,
  filters: z.object({
    status: z.string().optional(),
  }).optional(),
  data: z.object({
    name: z.string().optional(),
    description: z.string().optional(),
    dailyCalories: z.number().optional(),
    proteinGrams: z.number().optional(),
    carbGrams: z.number().optional(),
    fatGrams: z.number().optional(),
    mealsPerDay: z.number().optional(),
    restrictions: z.array(z.string()).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    status: z.string().optional(),
  }).optional(),
});

async function handleDietPlanManager(userId: string, params: z.infer<typeof DietPlanManagerSchema>): Promise<string> {
  const { action, identifier, filters, data } = params;

  try {
    switch (action) {
      case 'get': {
        let sql = 'SELECT * FROM diet_plans WHERE user_id = $1';
        const values: (string | number)[] = [userId];
        if (filters?.status) { sql += ` AND status = $${values.length + 1}`; values.push(filters.status); }
        sql += ' ORDER BY created_at DESC';
        const result = await query(sql, values);
        return JSON.stringify({ success: true, dietPlans: result.rows });
      }

      case 'getById': {
        if (!identifier?.id) return JSON.stringify({ success: false, error: 'ID required' });
        const result = await query('SELECT * FROM diet_plans WHERE id = $1 AND user_id = $2', [identifier.id, userId]);
        return JSON.stringify({ success: true, dietPlan: result.rows[0] });
      }

      case 'getByName': {
        if (!identifier?.name) return JSON.stringify({ success: false, error: 'Name required' });
        const result = await query(
          `SELECT * FROM diet_plans WHERE user_id = $1 AND name ILIKE $2`,
          [userId, `%${identifier.name}%`]
        );
        return JSON.stringify({ success: true, dietPlans: result.rows });
      }

      case 'create': {
        if (!data?.name) return JSON.stringify({ success: false, error: 'Plan name required' });
        const result = await query(
          `INSERT INTO diet_plans (user_id, name, description, daily_calories, protein_grams, carbs_grams, fat_grams, meals_per_day, dietary_preferences, start_date, end_date, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
          [userId, data.name, data.description || null, data.dailyCalories || null, data.proteinGrams || null,
           data.carbGrams || null, data.fatGrams || null, data.mealsPerDay || 3, JSON.stringify(data.restrictions || []),
           data.startDate || null, data.endDate || null, data.status || 'active']
        );
        return JSON.stringify({ success: true, dietPlan: result.rows[0], message: 'Diet plan created' });
      }

      case 'update': {
        if (!identifier?.id) return JSON.stringify({ success: false, error: 'Plan ID required' });
        const updates: string[] = [];
        const values: (string | number)[] = [identifier.id, userId];
        let i = 3;

        if (data?.name) { updates.push(`name = $${i++}`); values.push(data.name); }
        if (data?.dailyCalories !== undefined) { updates.push(`daily_calories = $${i++}`); values.push(data.dailyCalories); }
        if (data?.status) { updates.push(`status = $${i++}`); values.push(data.status); }

        if (updates.length === 0) return JSON.stringify({ success: false, error: 'No updates' });

        const result = await query(
          `UPDATE diet_plans SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`,
          values
        );
        return JSON.stringify({ success: true, dietPlan: result.rows[0], message: 'Diet plan updated' });
      }

      case 'delete': {
        if (!identifier?.id) return JSON.stringify({ success: false, error: 'Plan ID required' });
        await query('DELETE FROM diet_plans WHERE id = $1 AND user_id = $2', [identifier.id, userId]);
        return JSON.stringify({ success: true, message: 'Diet plan deleted' });
      }

      default:
        return JSON.stringify({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (error) {
    logger.error('[DietPlanManager] Error', { action, error });
    return JSON.stringify({ success: false, error: String(error) });
  }
}

// ============================================
// WATER INTAKE MANAGER
// ============================================

const WaterIntakeManagerSchema = z.object({
  action: z.enum(['get', 'getByDate', 'create', 'update', 'delete', 'addEntry']).describe('REQUIRED. The action to perform.'),
  identifier: IdentifierSchema,
  filters: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }).optional(),
  data: z.object({
    date: z.string().optional().describe('Date (YYYY-MM-DD)'),
    totalMl: z.number().optional(),
    goalMl: z.number().optional(),
    amountMl: z.number().optional().describe('Amount to add'),
  }).optional(),
});

async function handleWaterIntakeManager(userId: string, params: z.infer<typeof WaterIntakeManagerSchema>): Promise<string> {
  const { action, identifier, filters, data } = params;

  try {
    switch (action) {
      case 'get': {
        let sql = 'SELECT * FROM water_intake_logs WHERE user_id = $1';
        const values: (string | number)[] = [userId];
        if (filters?.startDate) { sql += ` AND log_date >= $${values.length + 1}`; values.push(filters.startDate); }
        if (filters?.endDate) { sql += ` AND log_date <= $${values.length + 1}`; values.push(filters.endDate); }
        sql += ' ORDER BY log_date DESC LIMIT 30';
        const result = await query(sql, values);
        return JSON.stringify({ success: true, waterLogs: result.rows });
      }

      case 'getByDate': {
        const date = identifier?.date || new Date().toISOString().split('T')[0];
        const result = await query('SELECT * FROM water_intake_logs WHERE user_id = $1 AND log_date = $2', [userId, date]);
        return JSON.stringify({ success: true, waterLog: result.rows[0] || null });
      }

      case 'create': {
        const date = data?.date || new Date().toISOString().split('T')[0];
        const result = await query(
          `INSERT INTO water_intake_logs (user_id, log_date, ml_consumed, target_ml, entries)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [userId, date, data?.totalMl || 0, data?.goalMl || 2000, '[]']
        );
        return JSON.stringify({ success: true, waterLog: result.rows[0], message: 'Water log created' });
      }

      case 'addEntry': {
        const date = data?.date || new Date().toISOString().split('T')[0];
        const amount = data?.amountMl || 250;
        const result = await query(
          `INSERT INTO water_intake_logs (user_id, log_date, ml_consumed, target_ml, entries)
           VALUES ($1, $2, $3, 2000, $4)
           ON CONFLICT (user_id, log_date)
           DO UPDATE SET ml_consumed = water_intake_logs.ml_consumed + $3,
                         entries = water_intake_logs.entries || $4,
                         updated_at = NOW()
           RETURNING *`,
          [userId, date, amount, JSON.stringify([{ amountMl: amount, time: new Date().toISOString() }])]
        );
        return JSON.stringify({ success: true, waterLog: result.rows[0], message: `Added ${amount}ml of water` });
      }

      case 'update': {
        if (!identifier?.id) return JSON.stringify({ success: false, error: 'Log ID required' });
        const updates: string[] = [];
        const values: (string | number)[] = [identifier.id, userId];
        let i = 3;

        if (data?.totalMl !== undefined) { updates.push(`ml_consumed = $${i++}`); values.push(data.totalMl); }
        if (data?.goalMl !== undefined) { updates.push(`target_ml = $${i++}`); values.push(data.goalMl); }

        if (updates.length === 0) return JSON.stringify({ success: false, error: 'No updates' });

        const result = await query(
          `UPDATE water_intake_logs SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`,
          values
        );
        return JSON.stringify({ success: true, waterLog: result.rows[0], message: 'Water log updated' });
      }

      case 'delete': {
        if (!identifier?.id) return JSON.stringify({ success: false, error: 'Log ID required' });
        await query('DELETE FROM water_intake_logs WHERE id = $1 AND user_id = $2', [identifier.id, userId]);
        return JSON.stringify({ success: true, message: 'Water log deleted' });
      }

      default:
        return JSON.stringify({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (error) {
    logger.error('[WaterIntakeManager] Error', { action, error });
    return JSON.stringify({ success: false, error: String(error) });
  }
}

// ============================================
// PROGRESS MANAGER
// ============================================

const ProgressManagerSchema = z.object({
  action: z.enum(['get', 'getById', 'getByDate', 'create', 'update', 'delete']).describe('REQUIRED. The action to perform.'),
  identifier: IdentifierSchema,
  filters: z.object({
    type: z.string().optional().describe('Record type: weight, measurements, body_fat'),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }).optional(),
  data: z.object({
    recordType: z.string().optional(),
    value: z.number().optional(),
    unit: z.string().optional(),
    notes: z.string().optional(),
    measurements: z.object({
      chest: z.number().optional(),
      waist: z.number().optional(),
      hips: z.number().optional(),
      biceps: z.number().optional(),
      thighs: z.number().optional(),
    }).optional(),
    loggedAt: z.string().optional(),
  }).optional(),
});

async function handleProgressManager(userId: string, params: z.infer<typeof ProgressManagerSchema>): Promise<string> {
  const { action, identifier, filters, data } = params;

  try {
    switch (action) {
      case 'get': {
        let sql = 'SELECT * FROM progress_records WHERE user_id = $1';
        const values: (string | number)[] = [userId];
        if (filters?.type) { sql += ` AND record_type = $${values.length + 1}`; values.push(filters.type); }
        if (filters?.startDate) { sql += ` AND record_date >= $${values.length + 1}`; values.push(filters.startDate); }
        if (filters?.endDate) { sql += ` AND record_date <= $${values.length + 1}`; values.push(filters.endDate); }
        sql += ' ORDER BY record_date DESC LIMIT 50';
        const result = await query(sql, values);
        return JSON.stringify({ success: true, progressRecords: result.rows });
      }

      case 'getById': {
        if (!identifier?.id) return JSON.stringify({ success: false, error: 'ID required' });
        const result = await query('SELECT * FROM progress_records WHERE id = $1 AND user_id = $2', [identifier.id, userId]);
        return JSON.stringify({ success: true, record: result.rows[0] });
      }

      case 'getByDate': {
        const date = identifier?.date || new Date().toISOString().split('T')[0];
        const result = await query(
          `SELECT * FROM progress_records WHERE user_id = $1 AND record_date = $2`,
          [userId, date]
        );
        return JSON.stringify({ success: true, records: result.rows });
      }

      case 'create': {
        if (!data?.recordType) return JSON.stringify({ success: false, error: 'recordType required' });
        const recordDate = data.loggedAt ? data.loggedAt.split('T')[0] : new Date().toISOString().split('T')[0];
        const notes = data.measurements
          ? `${data.notes || ''}\nMeasurements: ${JSON.stringify(data.measurements)}`.trim()
          : (data.notes || null);
        const result = await query(
          `INSERT INTO progress_records (user_id, record_type, value, notes, record_date)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [userId, data.recordType, data.value || null, notes, recordDate]
        );
        return JSON.stringify({ success: true, record: result.rows[0], message: 'Progress recorded' });
      }

      case 'update': {
        if (!identifier?.id) return JSON.stringify({ success: false, error: 'Record ID required' });
        const updates: string[] = [];
        const values: (string | number)[] = [identifier.id, userId];
        let i = 3;

        if (data?.value !== undefined) { updates.push(`value = $${i++}`); values.push(data.value); }
        if (data?.notes) { updates.push(`notes = $${i++}`); values.push(data.notes); }

        if (updates.length === 0) return JSON.stringify({ success: false, error: 'No updates' });

        const result = await query(
          `UPDATE progress_records SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`,
          values
        );
        return JSON.stringify({ success: true, record: result.rows[0], message: 'Progress updated' });
      }

      case 'delete': {
        if (!identifier?.id) return JSON.stringify({ success: false, error: 'Record ID required' });
        await query('DELETE FROM progress_records WHERE id = $1 AND user_id = $2', [identifier.id, userId]);
        return JSON.stringify({ success: true, message: 'Progress record deleted' });
      }

      default:
        return JSON.stringify({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (error) {
    logger.error('[ProgressManager] Error', { action, error });
    return JSON.stringify({ success: false, error: String(error) });
  }
}

// ============================================
// COMPETITION MANAGER
// ============================================

const CompetitionManagerSchema = z.object({
  action: z.enum(['getActive', 'getMyEntries', 'join', 'getLeaderboard']).describe('REQUIRED. The action to perform.'),
  identifier: z.object({
    competitionId: z.string().optional().describe('Competition ID'),
  }).optional(),
});

async function handleCompetitionManager(userId: string, params: z.infer<typeof CompetitionManagerSchema>): Promise<string> {
  const { action, identifier } = params;

  try {
    switch (action) {
      case 'getActive': {
        const result = await query(
          `SELECT id, name, type, description, start_date, end_date, status,
                  EXTRACT(DAY FROM end_date - NOW()) as days_remaining
           FROM competitions WHERE status = 'active' AND end_date > NOW()
           ORDER BY end_date ASC`,
          []
        );
        return JSON.stringify({ success: true, competitions: result.rows });
      }

      case 'getMyEntries': {
        const result = await query(
          `SELECT ce.id, ce.competition_id, ce.status, ce.current_rank, ce.current_score, ce.joined_at,
                  c.name, c.type, c.start_date, c.end_date, c.status as competition_status,
                  EXTRACT(DAY FROM c.end_date - NOW()) as days_remaining
           FROM competition_entries ce
           JOIN competitions c ON ce.competition_id = c.id
           WHERE ce.user_id = $1
           ORDER BY c.end_date DESC`,
          [userId]
        );
        return JSON.stringify({ success: true, entries: result.rows });
      }

      case 'join': {
        if (!identifier?.competitionId) return JSON.stringify({ success: false, error: 'competitionId required' });
        const result = await query(
          `INSERT INTO competition_entries (competition_id, user_id, status, current_score)
           VALUES ($1, $2, 'active', 0)
           ON CONFLICT (competition_id, user_id) DO NOTHING
           RETURNING *`,
          [identifier.competitionId, userId]
        );
        if (result.rowCount === 0) {
          return JSON.stringify({ success: false, error: 'Already joined this competition' });
        }
        return JSON.stringify({ success: true, entry: result.rows[0], message: 'Joined competition' });
      }

      case 'getLeaderboard': {
        if (!identifier?.competitionId) return JSON.stringify({ success: false, error: 'competitionId required' });
        const result = await query(
          `SELECT ce.current_rank, ce.current_score, ce.user_id,
                  u.first_name, u.last_name,
                  CASE WHEN ce.user_id = $2 THEN true ELSE false END as is_you
           FROM competition_entries ce
           JOIN users u ON ce.user_id = u.id
           WHERE ce.competition_id = $1 AND ce.status = 'active'
           ORDER BY ce.current_score DESC LIMIT 20`,
          [identifier.competitionId, userId]
        );
        return JSON.stringify({ success: true, leaderboard: result.rows });
      }

      default:
        return JSON.stringify({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (error) {
    logger.error('[CompetitionManager] Error', { action, error });
    return JSON.stringify({ success: false, error: String(error) });
  }
}

// ============================================
// EMOTIONAL CHECK-IN MANAGER
// ============================================

const EmotionalCheckinManagerSchema = z.object({
  action: z.enum(['get', 'create', 'getLatest']).describe('REQUIRED. The action to perform.'),
  identifier: IdentifierSchema,
  filters: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    screeningType: z.string().optional().describe('Filter: light, standard, deep'),
    limit: z.number().optional(),
  }).optional(),
  data: z.object({
    screeningType: z.enum(['light', 'standard', 'deep']).optional(),
    overallAnxietyScore: z.number().optional().describe('0-10'),
    overallMoodScore: z.number().optional().describe('0-10'),
    riskLevel: z.enum(['none', 'low', 'moderate', 'high', 'critical']).optional(),
    insights: z.record(z.any()).optional(),
    recommendations: z.array(z.string()).optional(),
  }).optional(),
});

async function handleEmotionalCheckinManager(userId: string, params: z.infer<typeof EmotionalCheckinManagerSchema>): Promise<string> {
  const { action, filters, data } = params;

  try {
    switch (action) {
      case 'get': {
        let sql = 'SELECT * FROM emotional_checkin_sessions WHERE user_id = $1';
        const values: (string | number)[] = [userId];
        if (filters?.startDate) { sql += ` AND started_at >= $${values.length + 1}`; values.push(filters.startDate); }
        if (filters?.endDate) { sql += ` AND started_at <= $${values.length + 1}`; values.push(filters.endDate); }
        if (filters?.screeningType) { sql += ` AND screening_type = $${values.length + 1}`; values.push(filters.screeningType); }
        sql += ` ORDER BY started_at DESC LIMIT ${filters?.limit || 20}`;
        const result = await query(sql, values);
        return JSON.stringify({ success: true, sessions: result.rows });
      }

      case 'getLatest': {
        const result = await query(
          `SELECT * FROM emotional_checkin_sessions
           WHERE user_id = $1 AND completed_at IS NOT NULL
           ORDER BY completed_at DESC LIMIT 1`,
          [userId]
        );
        return JSON.stringify({ success: true, session: result.rows[0] || null });
      }

      case 'create': {
        const result = await query(
          `INSERT INTO emotional_checkin_sessions (user_id, screening_type, overall_anxiety_score, overall_mood_score, risk_level, insights, recommendations, completed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
          [userId, data?.screeningType || 'standard', data?.overallAnxietyScore || null,
           data?.overallMoodScore || null, data?.riskLevel || 'none',
           JSON.stringify(data?.insights || {}), JSON.stringify(data?.recommendations || [])]
        );
        return JSON.stringify({ success: true, session: result.rows[0], message: 'Emotional check-in recorded' });
      }

      default:
        return JSON.stringify({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (error) {
    logger.error('[EmotionalCheckinManager] Error', { action, error });
    return JSON.stringify({ success: false, error: String(error) });
  }
}

// ============================================
// GAMIFICATION MANAGER (read-only)
// ============================================

const GamificationManagerSchema = z.object({
  action: z.enum(['getStats', 'getXPHistory', 'getAchievements']).describe('REQUIRED. The action to perform.'),
  filters: z.object({
    limit: z.number().optional(),
    sourceType: z.string().optional().describe('Filter XP by source: activity, workout, meal, water, streak, achievement, bonus'),
  }).optional(),
});

async function handleGamificationManager(userId: string, params: z.infer<typeof GamificationManagerSchema>): Promise<string> {
  const { action, filters } = params;

  try {
    switch (action) {
      case 'getStats': {
        const result = await query(
          `SELECT total_xp, current_level, current_streak, longest_streak, last_activity_date
           FROM users WHERE id = $1`,
          [userId]
        );
        const stats = result.rows[0];
        if (!stats) return JSON.stringify({ success: false, error: 'User not found' });

        const streakAtRisk = stats.last_activity_date
          ? (new Date().getTime() - new Date(stats.last_activity_date).getTime()) > 24 * 60 * 60 * 1000
          : false;

        return JSON.stringify({
          success: true,
          stats: { ...stats, streakAtRisk },
        });
      }

      case 'getXPHistory': {
        let sql = 'SELECT * FROM user_xp_transactions WHERE user_id = $1';
        const values: (string | number)[] = [userId];
        if (filters?.sourceType) { sql += ` AND source_type = $${values.length + 1}`; values.push(filters.sourceType); }
        sql += ` ORDER BY created_at DESC LIMIT ${filters?.limit || 20}`;
        const result = await query(sql, values);
        return JSON.stringify({ success: true, xpHistory: result.rows });
      }

      case 'getAchievements': {
        // Achievements are computed, not stored. Get recent achievement XP transactions as proxy.
        const result = await query(
          `SELECT description, xp_amount, created_at
           FROM user_xp_transactions
           WHERE user_id = $1 AND source_type = 'achievement'
           ORDER BY created_at DESC LIMIT ${filters?.limit || 20}`,
          [userId]
        );
        return JSON.stringify({ success: true, achievements: result.rows });
      }

      default:
        return JSON.stringify({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (error) {
    logger.error('[GamificationManager] Error', { action, error });
    return JSON.stringify({ success: false, error: String(error) });
  }
}

// ============================================
// MENTAL RECOVERY MANAGER (read-only)
// ============================================

const MentalRecoveryManagerSchema = z.object({
  action: z.enum(['getLatest', 'getTrend']).describe('REQUIRED. The action to perform.'),
  filters: z.object({
    days: z.number().optional().describe('Days for trend (default 14)'),
  }).optional(),
});

async function handleMentalRecoveryManager(userId: string, params: z.infer<typeof MentalRecoveryManagerSchema>): Promise<string> {
  const { action, filters } = params;

  try {
    switch (action) {
      case 'getLatest': {
        const result = await query(
          `SELECT recovery_score, score_date, components, factors, trend, previous_score
           FROM mental_recovery_scores
           WHERE user_id = $1
           ORDER BY score_date DESC LIMIT 1`,
          [userId]
        );
        return JSON.stringify({ success: true, recoveryScore: result.rows[0] || null });
      }

      case 'getTrend': {
        const days = filters?.days || 14;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const result = await query(
          `SELECT recovery_score, score_date, trend, components
           FROM mental_recovery_scores
           WHERE user_id = $1 AND score_date >= $2
           ORDER BY score_date ASC`,
          [userId, startDate.toISOString().split('T')[0]]
        );
        const scores = result.rows;
        const avgScore = scores.length > 0
          ? scores.reduce((sum: number, r: any) => sum + Number(r.recovery_score), 0) / scores.length
          : null;
        return JSON.stringify({
          success: true,
          trend: {
            scores,
            averageScore: avgScore ? Math.round(avgScore * 10) / 10 : null,
            dataPoints: scores.length,
            period: `${days} days`,
          },
        });
      }

      default:
        return JSON.stringify({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (error) {
    logger.error('[MentalRecoveryManager] Error', { action, error });
    return JSON.stringify({ success: false, error: String(error) });
  }
}

// ============================================
// PERSONAL CONTEXT HANDLER
// ============================================

async function handlePersonalContextManager(
  userId: string,
  params: { action: string; category?: string; fact?: string; healthRelevance?: string }
): Promise<string> {
  try {
    const { action } = params;

    if (!action) {
      return JSON.stringify({ success: false, error: 'Action is required (save or get)' });
    }

    if (action === 'get') {
      const result = await query(
        `SELECT personal_context FROM user_coaching_profiles WHERE user_id = $1`,
        [userId]
      );
      const context = result.rows[0]?.personal_context;
      return JSON.stringify({ success: true, personalContext: context || {} });
    }

    if (action === 'save') {
      if (!params.category || !params.fact) {
        return JSON.stringify({ success: false, error: 'Category and fact are required for save action' });
      }

      // Get existing personal context
      const existing = await query(
        `SELECT personal_context FROM user_coaching_profiles WHERE user_id = $1`,
        [userId]
      );

      const currentContext = existing.rows[0]?.personal_context || {};

      if (params.category === 'other') {
        // Append to otherFacts array
        if (!currentContext.otherFacts) currentContext.otherFacts = [];
        const factWithRelevance = params.healthRelevance
          ? `${params.fact} (Health impact: ${params.healthRelevance})`
          : params.fact;
        currentContext.otherFacts.push(factWithRelevance);
        // Keep max 20 other facts
        if (currentContext.otherFacts.length > 20) {
          currentContext.otherFacts = currentContext.otherFacts.slice(-20);
        }
      } else {
        // Overwrite the category with latest fact
        currentContext[params.category] = params.healthRelevance
          ? `${params.fact} | Health impact: ${params.healthRelevance}`
          : params.fact;
      }

      currentContext.lastUpdated = new Date().toISOString();

      // Upsert personal context
      await query(
        `UPDATE user_coaching_profiles
         SET personal_context = $1, updated_at = NOW()
         WHERE user_id = $2`,
        [JSON.stringify(currentContext), userId]
      );

      logger.info('[PersonalContextManager] Saved personal context', {
        userId,
        category: params.category,
        totalFacts: Object.keys(currentContext).filter(k => k !== 'lastUpdated' && k !== 'otherFacts').length + (currentContext.otherFacts?.length || 0),
      });

      return JSON.stringify({
        success: true,
        message: `Saved ${params.category}: ${params.fact}`,
        totalFacts: Object.keys(currentContext).filter(k => k !== 'lastUpdated' && k !== 'otherFacts').length + (currentContext.otherFacts?.length || 0),
      });
    }

    return JSON.stringify({ success: false, error: 'Invalid action. Use "save" or "get".' });
  } catch (error) {
    logger.error('[PersonalContextManager] Error', { action: params.action, error });
    return JSON.stringify({ success: false, error: `Failed to manage personal context: ${error}` });
  }
}

// ============================================
// LIFE GOAL MANAGER
// ============================================

const LifeGoalManagerSchema = z.object({
  action: z.enum(['list', 'getById', 'create', 'decompose', 'checkIn', 'completeAction']).describe(
    'Action: list (active life goals), getById (goal detail with actions/milestones), create (new life goal), decompose (re-run AI decomposition), checkIn (progress check-in), completeAction (mark action done)'
  ),
  goalId: z.string().optional().describe('Goal ID (required for getById, decompose, checkIn, completeAction)'),
  actionId: z.string().optional().describe('Action ID (required for completeAction)'),
  title: z.string().optional().describe('Goal title (for create)'),
  category: z.string().optional().describe('Goal category: spiritual, social, productivity, happiness, anxiety_management, creative, personal_growth, financial, faith, relationships, education, career, health_wellness, custom (for create)'),
  description: z.string().optional().describe('Goal description (for create)'),
  motivation: z.string().optional().describe('Why this goal matters to the user (for create)'),
  progressValue: z.number().optional().describe('Numeric progress value (for checkIn)'),
  note: z.string().optional().describe('Check-in note (for checkIn)'),
  moodAboutGoal: z.number().optional().describe('How user feels about goal progress 1-10 (for checkIn)'),
});

async function handleLifeGoalManager(userId: string, params: z.infer<typeof LifeGoalManagerSchema>): Promise<string> {
  const { action } = params;

  try {
    switch (action) {
      case 'list': {
        const result = await query(
          `SELECT id, category, title, description, motivation, progress, status, current_value, target_value, target_unit, is_primary, created_at, updated_at
           FROM life_goals WHERE user_id = $1 AND status = 'active'
           ORDER BY is_primary DESC, created_at DESC`,
          [userId]
        );
        return JSON.stringify({ success: true, goals: result.rows, count: result.rowCount });
      }

      case 'getById': {
        if (!params.goalId) return JSON.stringify({ success: false, error: 'goalId required' });

        const [goalResult, actionsResult, milestonesResult] = await Promise.all([
          query(
            `SELECT * FROM life_goals WHERE id = $1 AND user_id = $2`,
            [params.goalId, userId]
          ),
          query(
            `SELECT id, title, description, effort_level, timeframe, is_completed, completed_at, is_ai_generated, sort_order
             FROM goal_actions WHERE goal_id = $1 AND user_id = $2 ORDER BY sort_order ASC`,
            [params.goalId, userId]
          ),
          query(
            `SELECT id, title, description, target_date, target_value, current_value, completed, completed_at, sort_order
             FROM life_goal_milestones WHERE life_goal_id = $1 AND user_id = $2 ORDER BY sort_order ASC`,
            [params.goalId, userId]
          ),
        ]);

        if (goalResult.rows.length === 0) {
          return JSON.stringify({ success: false, error: 'Life goal not found' });
        }

        return JSON.stringify({
          success: true,
          goal: goalResult.rows[0],
          actions: actionsResult.rows,
          milestones: milestonesResult.rows,
        });
      }

      case 'create': {
        if (!params.title) return JSON.stringify({ success: false, error: 'title required' });
        if (!params.category) return JSON.stringify({ success: false, error: 'category required' });

        const goal = await lifeGoalsService.createGoal(userId, {
          title: params.title,
          category: params.category as any,
          description: params.description,
          motivation: params.motivation,
        });

        return JSON.stringify({
          success: true,
          goal,
          message: 'Life goal created. AI decomposition into actionable steps will run automatically.',
        });
      }

      case 'decompose': {
        if (!params.goalId) return JSON.stringify({ success: false, error: 'goalId required' });

        const decomposition = await goalDecompositionService.redecomposeGoal(userId, params.goalId);

        return JSON.stringify({
          success: true,
          decomposition,
          message: 'Goal re-decomposed into new actionable steps.',
        });
      }

      case 'checkIn': {
        if (!params.goalId) return JSON.stringify({ success: false, error: 'goalId required' });

        const checkin = await lifeGoalsService.createCheckin(userId, params.goalId, {
          progressValue: params.progressValue,
          note: params.note,
          moodAboutGoal: params.moodAboutGoal,
        });

        return JSON.stringify({
          success: true,
          checkin,
          message: 'Check-in recorded successfully.',
        });
      }

      case 'completeAction': {
        if (!params.actionId) return JSON.stringify({ success: false, error: 'actionId required' });

        await goalDecompositionService.completeAction(userId, params.actionId);

        return JSON.stringify({
          success: true,
          message: 'Action marked as completed.',
        });
      }

      default:
        return JSON.stringify({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (error) {
    logger.error('[LifeGoalManager] Error', { action, error });
    return JSON.stringify({ success: false, error: String(error) });
  }
}

// ============================================
// CREATE SEMANTIC TOOLS
// ============================================

/**
 * Creates semantic manager tools (replaces 163 CRUD tools with ~13 managers)
 */
// ============================================
// WHOOP ANALYTICS MANAGER
// ============================================

function resolveDateRange(period: string, customStart?: string, customEnd?: string): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  switch (period) {
    case 'today': start.setHours(0, 0, 0, 0); break;
    case 'week': start.setDate(start.getDate() - 7); break;
    case 'month': start.setDate(start.getDate() - 30); break;
    case 'quarter': start.setDate(start.getDate() - 90); break;
    case 'custom':
      if (customStart && customEnd) return { start: new Date(customStart), end: new Date(customEnd) };
      start.setDate(start.getDate() - 7); // fallback
      break;
  }
  return { start, end };
}

function avgNumbers(arr: number[]): number | null {
  const valid = arr.filter(v => v > 0);
  return valid.length > 0 ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length) * 10) / 10 : null;
}

async function handleWhoopAnalyticsManager(
  userId: string,
  params: { action: string; period?: string; startDate?: string; endDate?: string; comparePeriod?: { startDate: string; endDate: string } },
): Promise<string> {
  const { action, period = 'week', startDate: customStart, endDate: customEnd, comparePeriod } = params;

  try {
    const { start, end } = resolveDateRange(period, customStart, customEnd);
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

    switch (action) {
      case 'overview': {
        const overview = await getWhoopOverview(userId, start, end);
        return JSON.stringify({
          success: true,
          data: overview,
          period: { start: start.toISOString(), end: end.toISOString(), label: period },
        });
      }

      case 'recoveryTrends': {
        const trends = await getRecoveryTrends(userId, days, start, end);
        const scores = trends.map(t => t.recovery_score).filter(s => s > 0);
        const hrvs = trends.map(t => t.hrv_rmssd_ms).filter(h => h > 0);
        const rhrs = trends.map(t => t.resting_heart_rate_bpm).filter(r => r > 0);
        return JSON.stringify({
          success: true,
          data: trends,
          summary: {
            dataPoints: trends.length,
            avgRecovery: avgNumbers(scores),
            minRecovery: scores.length ? Math.min(...scores) : null,
            maxRecovery: scores.length ? Math.max(...scores) : null,
            avgHRV: avgNumbers(hrvs),
            avgRHR: avgNumbers(rhrs),
            spo2Available: trends.some(t => t.spo2_percent),
            skinTempAvailable: trends.some(t => t.skin_temp_celsius),
          },
          period: { start: start.toISOString(), end: end.toISOString(), label: period },
        });
      }

      case 'sleepAnalysis': {
        const trends = await getSleepTrends(userId, days, start, end);
        const durations = trends.map(t => t.duration_minutes / 60).filter(d => d > 0);
        const qualities = trends.map(t => t.sleep_quality_score).filter(q => q > 0);
        const rems = trends.map(t => t.rem_minutes).filter(r => r > 0);
        const deeps = trends.map(t => t.deep_minutes).filter(d => d > 0);
        return JSON.stringify({
          success: true,
          data: trends,
          summary: {
            dataPoints: trends.length,
            avgDurationHours: avgNumbers(durations),
            minDurationHours: durations.length ? Math.round(Math.min(...durations) * 10) / 10 : null,
            maxDurationHours: durations.length ? Math.round(Math.max(...durations) * 10) / 10 : null,
            avgQuality: avgNumbers(qualities),
            avgRemMinutes: avgNumbers(rems),
            avgDeepMinutes: avgNumbers(deeps),
          },
          period: { start: start.toISOString(), end: end.toISOString(), label: period },
        });
      }

      case 'strainAnalysis': {
        const trends = await getStrainTrends(userId, days, start, end);
        const strains = trends.map(t => t.strain_score).filter(s => s > 0);
        const cals = trends.map(t => t.calories_kcal).filter(c => c > 0);
        return JSON.stringify({
          success: true,
          data: trends,
          summary: {
            dataPoints: trends.length,
            avgStrain: avgNumbers(strains),
            maxStrain: strains.length ? Math.round(Math.max(...strains) * 10) / 10 : null,
            avgCalories: avgNumbers(cals),
            totalCalories: Math.round(cals.reduce((a, b) => a + b, 0)),
          },
          period: { start: start.toISOString(), end: end.toISOString(), label: period },
        });
      }

      case 'stressAnalysis': {
        const fromStr = start.toISOString().split('T')[0];
        const toStr = end.toISOString().split('T')[0];
        const stressLogs = await stressService.getStressLogs(userId, fromStr, toStr);
        return JSON.stringify({
          success: true,
          logs: stressLogs.slice(0, 20), // Limit for token efficiency
          count: stressLogs.length,
          period: { start: fromStr, end: toStr, label: period },
        });
      }

      case 'compare': {
        if (!comparePeriod) {
          return JSON.stringify({ success: false, error: 'comparePeriod required for compare action (startDate + endDate)' });
        }
        const { start: start2, end: end2 } = { start: new Date(comparePeriod.startDate), end: new Date(comparePeriod.endDate) };
        const days2 = Math.max(1, Math.ceil((end2.getTime() - start2.getTime()) / (1000 * 60 * 60 * 24)));
        const [recovery1, recovery2, sleep1, sleep2, strain1, strain2] = await Promise.all([
          getRecoveryTrends(userId, days, start, end),
          getRecoveryTrends(userId, days2, start2, end2),
          getSleepTrends(userId, days, start, end),
          getSleepTrends(userId, days2, start2, end2),
          getStrainTrends(userId, days, start, end),
          getStrainTrends(userId, days2, start2, end2),
        ]);
        return JSON.stringify({
          success: true,
          period1: {
            range: { start: start.toISOString(), end: end.toISOString() },
            avgRecovery: avgNumbers(recovery1.map(r => r.recovery_score)),
            avgHRV: avgNumbers(recovery1.map(r => r.hrv_rmssd_ms)),
            avgRHR: avgNumbers(recovery1.map(r => r.resting_heart_rate_bpm)),
            avgSleepHours: avgNumbers(sleep1.map(s => s.duration_minutes / 60)),
            avgSleepQuality: avgNumbers(sleep1.map(s => s.sleep_quality_score)),
            avgStrain: avgNumbers(strain1.map(s => s.strain_score)),
            dataPoints: recovery1.length,
          },
          period2: {
            range: { start: start2.toISOString(), end: end2.toISOString() },
            avgRecovery: avgNumbers(recovery2.map(r => r.recovery_score)),
            avgHRV: avgNumbers(recovery2.map(r => r.hrv_rmssd_ms)),
            avgRHR: avgNumbers(recovery2.map(r => r.resting_heart_rate_bpm)),
            avgSleepHours: avgNumbers(sleep2.map(s => s.duration_minutes / 60)),
            avgSleepQuality: avgNumbers(sleep2.map(s => s.sleep_quality_score)),
            avgStrain: avgNumbers(strain2.map(s => s.strain_score)),
            dataPoints: recovery2.length,
          },
        });
      }

      default:
        return JSON.stringify({ success: false, error: `Unknown action: ${action}` });
    }
  } catch (error) {
    logger.error('[WhoopAnalyticsManager] Error', { userId, action, error: String(error) });
    return JSON.stringify({ success: false, error: `WHOOP analytics error: ${error}` });
  }
}

// ============================================
// MUSIC MANAGER
// ============================================

const MusicManagerSchema = z.object({
  action: z.enum([
    'play_activity',
    'search_and_play',
    'control',
    'recommend',
  ]).describe('Music action: play_activity (curated playlist for activity type), search_and_play (search by query), control (pause/resume/next/previous/stop), recommend (smart recommendation)'),
  activity: z.enum(['workout', 'running', 'meditation', 'sleep', 'focus', 'recovery', 'stretching', 'yoga']).optional()
    .describe('Activity category for play_activity or recommend actions'),
  query: z.string().optional().describe('Search query for search_and_play action'),
  command: z.enum(['pause', 'resume', 'next', 'previous', 'stop', 'volume_up', 'volume_down']).optional()
    .describe('Playback control command for control action'),
});

function minifyTracks(tracks: any[]): any[] {
  return tracks.slice(0, 20).map(t => ({
    id: t.id,
    name: t.name,
    artists: (t.artists || []).map((a: any) => ({ id: a.id, name: a.name })),
    album: {
      id: t.album?.id,
      name: t.album?.name,
      images: (t.album?.images || []).slice(0, 1),
    },
    duration_ms: t.duration_ms,
    preview_url: t.preview_url,
    uri: t.uri,
    external_urls: t.external_urls,
  }));
}

async function handleMusicManager(userId: string, params: z.infer<typeof MusicManagerSchema>): Promise<string> {
  const { action } = params;
  logger.info('[MusicManager] Request', { userId, action, activity: params.activity, query: params.query, command: params.command });

  try {
    switch (action) {
      case 'play_activity': {
        const activity = params.activity || 'workout';
        let tracks: any[] = [];
        let playlistName = `${activity} music`;
        let source = 'spotify';

        // Strategy 1: Try Spotify playlist + tracks
        try {
          const playlists = await getCuratedPlaylists(activity as any, userId);
          logger.info('[MusicManager] Spotify playlists', { activity, count: playlists?.length || 0 });
          if (playlists?.length) {
            const playlist = playlists[0];
            playlistName = playlist.name;
            const tracksResult = await getPlaylistTracks(playlist.id, userId, 20, 0);
            tracks = tracksResult?.tracks || [];
            logger.info('[MusicManager] Spotify tracks', { activity, playlistId: playlist.id, count: tracks.length });
          }
        } catch (spotifyErr) {
          logger.warn('[MusicManager] Spotify failed', { activity, error: String(spotifyErr) });
        }

        // Strategy 2: Jamendo playlists (if Spotify returned no tracks)
        if (!tracks.length && isJamendoConfigured()) {
          try {
            source = 'jamendo';
            const jamPlaylists = await getJamendoCuratedPlaylists(activity as any);
            logger.info('[MusicManager] Jamendo playlists', { activity, count: jamPlaylists?.length || 0 });
            if (jamPlaylists?.length) {
              playlistName = jamPlaylists[0].name;
              const jamTracks = await getJamendoPlaylistTracks(jamPlaylists[0].id, 20, 0);
              tracks = jamTracks?.tracks || [];
              logger.info('[MusicManager] Jamendo playlist tracks', { activity, count: tracks.length });
            }
          } catch (jamErr) {
            logger.warn('[MusicManager] Jamendo playlists failed', { error: String(jamErr) });
          }
        }

        // Strategy 3: Jamendo direct tracks (last resort — tag-based, no playlist concept)
        if (!tracks.length && isJamendoConfigured()) {
          try {
            tracks = await getJamendoTracks(activity as any, 20);
            logger.info('[MusicManager] Jamendo direct tracks', { activity, count: tracks.length });
            if (tracks.length) {
              source = 'jamendo';
              playlistName = `${activity.charAt(0).toUpperCase() + activity.slice(1)} Mix`;
            }
          } catch (jamErr2) {
            logger.warn('[MusicManager] Jamendo direct tracks also failed', { error: String(jamErr2) });
          }
        }

        if (!tracks.length) {
          logger.error('[MusicManager] All music sources failed', {
            activity,
            spotifyAttempted: true,
            jamendoConfigured: isJamendoConfigured(),
          });
          return JSON.stringify({
            success: false,
            error: `I couldn't fetch ${activity} tracks right now.`,
            suggestedAction: {
              type: 'navigate',
              target: 'soundscape',
              params: {},
            },
            hint: 'Suggest the user open the Pulse page from the sidebar to browse and play music directly.',
          });
        }

        return JSON.stringify({
          success: true,
          playlistName,
          trackCount: tracks.length,
          activity,
          source,
          firstTrack: tracks[0]?.name,
          suggestedAction: {
            type: 'music_control',
            target: 'player',
            params: { command: 'play', tracks: minifyTracks(tracks), trackIndex: 0 },
          },
        });
      }

      case 'search_and_play': {
        if (!params.query) {
          return JSON.stringify({ success: false, error: 'Search query is required for search_and_play' });
        }
        let tracks: any[] = [];
        let source = 'spotify';

        // Try Spotify first
        try {
          const results = await searchSpotify(params.query, 'track', userId, 10);
          tracks = results?.tracks || [];
        } catch (spotifyErr) {
          logger.warn('[MusicManager] Spotify search failed, trying Jamendo', { query: params.query, error: String(spotifyErr) });
        }

        // Jamendo fallback
        if (!tracks.length && isJamendoConfigured()) {
          try {
            source = 'jamendo';
            const jamResults = await searchJamendo(params.query, 10);
            tracks = jamResults?.tracks || [];
          } catch (jamErr) {
            logger.warn('[MusicManager] Jamendo search also failed', { error: String(jamErr) });
          }
        }

        if (!tracks.length) {
          return JSON.stringify({
            success: false,
            error: `No tracks found for "${params.query}". Try a different search term or ask me to play activity-based music instead.`,
          });
        }

        return JSON.stringify({
          success: true,
          query: params.query,
          trackCount: tracks.length,
          source,
          firstTrack: tracks[0]?.name,
          suggestedAction: {
            type: 'music_control',
            target: 'player',
            params: { command: 'play', tracks: minifyTracks(tracks), trackIndex: 0 },
          },
        });
      }

      case 'control': {
        const cmd = params.command || 'pause';
        return JSON.stringify({
          success: true,
          command: cmd,
          suggestedAction: {
            type: 'music_control',
            target: 'player',
            params: { command: cmd },
          },
        });
      }

      case 'recommend': {
        const activity = params.activity || 'focus';
        let tracks: any[] = [];
        let source = 'spotify';

        // Try Spotify recommendations first
        try {
          tracks = await getRecommendations(activity as any, userId, undefined, 10);
        } catch (spotifyErr) {
          logger.warn('[MusicManager] Spotify recommendations failed, trying Jamendo', { activity, error: String(spotifyErr) });
        }

        // Jamendo fallback
        if (!tracks?.length && isJamendoConfigured()) {
          try {
            source = 'jamendo';
            tracks = await getJamendoRecommendations(activity as any, 10);
          } catch (jamErr) {
            logger.warn('[MusicManager] Jamendo recommendations also failed', { error: String(jamErr) });
          }
        }

        if (!tracks?.length) {
          return JSON.stringify({
            success: false,
            error: `Music recommendations for ${activity} aren't available right now. Try asking me to play ${activity} music instead, or search for specific songs.`,
          });
        }

        return JSON.stringify({
          success: true,
          activity,
          trackCount: tracks.length,
          source,
          firstTrack: tracks[0]?.name,
          suggestedAction: {
            type: 'music_control',
            target: 'player',
            params: { command: 'play', tracks: minifyTracks(tracks), trackIndex: 0 },
          },
        });
      }

      default:
        return JSON.stringify({ success: false, error: `Unknown music action: ${action}` });
    }
  } catch (error) {
    logger.error('[MusicManager] Error', { userId, action, error: String(error) });
    return JSON.stringify({
      success: false,
      error: `I ran into a problem playing music: ${String(error).replace(/^Error:\s*/, '')}. Try again or ask for a different type of music.`,
    });
  }
}

export function createSemanticTools(userId: string): DynamicStructuredTool[] {
  try {
  return [
    // MEAL & NUTRITION
    new DynamicStructuredTool({
      name: 'mealManager',
      description: 'Manage meals. Actions: get, getById, getByName, create, update, delete.',
      schema: MealManagerSchema,
      func: async (params) => handleMealManager(userId, params),
    }),

    new DynamicStructuredTool({
      name: 'recipeManager',
      description: 'Manage recipes. Actions: get, getById, getByName, create, update, delete.',
      schema: RecipeManagerSchema,
      func: async (params) => handleRecipeManager(userId, params),
    }),

    new DynamicStructuredTool({
      name: 'dietPlanManager',
      description: 'Manage diet plans. REQUIRED parameter: "action" (one of: get, getById, getByName, create, update, delete). Example: {"action": "get"} to list all plans. Always include "action" in your call.',
      schema: DietPlanManagerSchema,
      func: async (params) => handleDietPlanManager(userId, params),
    }),

    // WORKOUTS
    new DynamicStructuredTool({
      name: 'workoutManager',
      description: 'Manage workouts. REQUIRED parameter: "action" (one of: getPlans, getLogs, createPlan, updatePlan, deletePlan, createLog, updateLog, deleteLog). Example: {"action": "getPlans"} to list plans. Always include "action" in your call.',
      schema: WorkoutManagerSchema,
      func: async (params) => handleWorkoutManager(userId, params),
    }),

    // GOALS
    new DynamicStructuredTool({
      name: 'goalManager',
      description: 'Manage goals. Actions: get, getById, getByName, create, update, delete.',
      schema: GoalManagerSchema,
      func: async (params) => handleGoalManager(userId, params),
    }),

    // SCHEDULES
    new DynamicStructuredTool({
      name: 'scheduleManager',
      description: `CRITICAL: ALWAYS use this tool when user requests schedule creation. This tool ACTUALLY SAVES schedules to the database - do NOT just describe schedules in text. 

Use action="create" with data.scheduleDate (YYYY-MM-DD, defaults to today), data.title (optional), data.description (optional), and data.items array. Each item needs: title (required), startTime (required, format: "HH:MM" or "H:MM AM/PM" like "6:30 AM", "09:00", "5:30 PM"), endTime (optional, same format), description (optional), category (optional). 

After creating, ALWAYS verify by calling action="getByDate" with identifier.date to confirm it was saved.

EXAMPLE for creating a daily schedule with prayers, meals, workout, and work:
{
  "action": "create",
  "identifier": {},
  "data": {
    "scheduleDate": "2024-02-09",
    "title": "Daily Schedule",
    "items": [
      {"title": "Fajr Prayer", "startTime": "5:30 AM", "endTime": "6:00 AM", "category": "prayer"},
      {"title": "Breakfast", "startTime": "7:00 AM", "endTime": "7:30 AM", "category": "meal"},
      {"title": "Dhuhr Prayer", "startTime": "12:30 PM", "endTime": "1:00 PM", "category": "prayer"},
      {"title": "Lunch", "startTime": "1:00 PM", "endTime": "1:30 PM", "category": "meal"},
      {"title": "Asr Prayer", "startTime": "4:00 PM", "endTime": "4:30 PM", "category": "prayer"},
      {"title": "Maghrib Prayer", "startTime": "6:30 PM", "endTime": "7:00 PM", "category": "prayer"},
      {"title": "Dinner", "startTime": "7:30 PM", "endTime": "8:00 PM", "category": "meal"},
      {"title": "Isha Prayer", "startTime": "8:30 PM", "endTime": "9:00 PM", "category": "prayer"},
      {"title": "Workout", "startTime": "6:00 AM", "endTime": "7:00 AM", "category": "fitness"},
      {"title": "Office Work", "startTime": "9:00 AM", "endTime": "5:00 PM", "category": "work"}
    ]
  }
}

This tool saves schedules to the daily_schedules table. Actions: get, getByDate (to verify/retrieve), create, update, delete.`,
      schema: ScheduleManagerSchema,
      func: async (params) => handleScheduleManager(userId, params),
    }),

    // WELLBEING
    new DynamicStructuredTool({
      name: 'moodManager',
      description: 'Manage mood logs. Actions: get, create, update, delete, timeline, patterns.',
      schema: MoodManagerSchema,
      func: async (params) => handleMoodManager(userId, params),
    }),

    new DynamicStructuredTool({
      name: 'stressManager',
      description: 'Manage stress logs. Actions: get, create, update, delete, trends.',
      schema: StressManagerSchema,
      func: async (params) => handleStressManager(userId, params),
    }),

    new DynamicStructuredTool({
      name: 'journalManager',
      description: 'Manage user journal entries — create new entries from conversation, read past reflections, edit or delete entries, check journaling streak. Use when user wants to journal, reflect, or manage their journal.',
      schema: JournalManagerSchema,
      func: async (params) => handleJournalManager(userId, params),
    }),

    new DynamicStructuredTool({
      name: 'voiceJournalManager',
      description: 'Start or check status of voice journal sessions. Use when user wants to do voice journaling or record a spoken reflection.',
      schema: VoiceJournalManagerSchema,
      func: async (params) => handleVoiceJournalManager(userId, params),
    }),

    new DynamicStructuredTool({
      name: 'energyManager',
      description: 'Manage energy logs. Actions: get, create, update, delete, timeline, patterns.',
      schema: EnergyManagerSchema,
      func: async (params) => handleEnergyManager(userId, params),
    }),

    new DynamicStructuredTool({
      name: 'habitManager',
      description: 'Manage habits. Actions: get, create, update, delete, log, analytics.',
      schema: HabitManagerSchema,
      func: async (params) => handleHabitManager(userId, params),
    }),

    // PROGRESS & TRACKING
    new DynamicStructuredTool({
      name: 'progressManager',
      description: 'Manage progress (weight, measurements). Actions: get, getById, getByDate, create, update, delete.',
      schema: ProgressManagerSchema,
      func: async (params) => handleProgressManager(userId, params),
    }),

    new DynamicStructuredTool({
      name: 'waterIntakeManager',
      description: 'Manage water intake. Actions: get, getByDate, create, update, delete, addEntry.',
      schema: WaterIntakeManagerSchema,
      func: async (params) => handleWaterIntakeManager(userId, params),
    }),

    // COMPETITIONS
    new DynamicStructuredTool({
      name: 'competitionManager',
      description: 'Manage competitions. Actions: getActive (list active competitions), getMyEntries (my competition entries with rank/score), join (join a competition), getLeaderboard (competition rankings).',
      schema: CompetitionManagerSchema,
      func: async (params) => handleCompetitionManager(userId, params),
    }),

    // EMOTIONAL & MENTAL HEALTH
    new DynamicStructuredTool({
      name: 'emotionalCheckinManager',
      description: 'Manage emotional check-in sessions. Actions: get (list sessions), create (record check-in), getLatest (most recent completed session with scores).',
      schema: EmotionalCheckinManagerSchema,
      func: async (params) => handleEmotionalCheckinManager(userId, params),
    }),

    new DynamicStructuredTool({
      name: 'gamificationManager',
      description: 'Get gamification stats (XP, level, streak), XP history, and achievements. Actions: getStats, getXPHistory, getAchievements.',
      schema: GamificationManagerSchema,
      func: async (params) => handleGamificationManager(userId, params),
    }),

    new DynamicStructuredTool({
      name: 'mentalRecoveryManager',
      description: 'Get mental recovery scores and trends. Actions: getLatest (most recent score with components), getTrend (scores over time period).',
      schema: MentalRecoveryManagerSchema,
      func: async (params) => handleMentalRecoveryManager(userId, params),
    }),

    // PERSONAL CONTEXT
    new DynamicStructuredTool({
      name: 'personalContextManager',
      description: 'Save or retrieve personal life context shared by the user during conversation. Use this EVERY TIME the user shares personal information (occupation, family, routine, etc.). Actions: save (persist a fact), get (retrieve all saved context).',
      schema: z.object({
        action: z.enum(['save', 'get']).describe('Action to perform'),
        category: z.enum([
          'occupation', 'workSchedule', 'familySituation', 'cookingHabits',
          'dietaryCulture', 'stressSources', 'hobbies', 'livingSituation',
          'financialContext', 'dailyRoutine', 'other'
        ]).optional().describe('Category of the personal fact (required for save)'),
        fact: z.string().optional().describe('The personal fact to save (required for save)'),
        healthRelevance: z.string().optional().describe('How this fact affects their health/fitness goals'),
      }),
      func: async (params) => handlePersonalContextManager(userId, params),
    }),

    // LIFE GOALS (non-health: financial, faith, relationships, career, etc.)
    new DynamicStructuredTool({
      name: 'lifeGoalManager',
      description: 'Manage life goals (non-health goals like financial, faith, relationships, career, education, creativity, etc.). Actions: list (active goals with progress), getById (goal detail with actions and milestones), create (new life goal — AI auto-decomposes into steps), decompose (re-run AI decomposition), checkIn (record progress check-in), completeAction (mark a goal action as done).',
      schema: LifeGoalManagerSchema,
      func: async (params) => handleLifeGoalManager(userId, params),
    }),

    // WHOOP ANALYTICS
    new DynamicStructuredTool({
      name: 'whoopAnalyticsManager',
      description: 'Analyze WHOOP wearable data with time-range support. Actions: overview (snapshot + 7d trends), recoveryTrends (recovery/HRV/RHR over time), sleepAnalysis (duration/quality/stages), strainAnalysis (strain/calories/HR), stressAnalysis (stress logs + biometrics), compare (two periods side by side). Periods: today, week (7d), month (30d), quarter (90d), custom (with startDate/endDate).',
      schema: z.object({
        action: z.enum(['overview', 'recoveryTrends', 'sleepAnalysis', 'strainAnalysis', 'stressAnalysis', 'compare'])
          .describe('Analysis type to run'),
        period: z.enum(['today', 'week', 'month', 'quarter', 'custom']).optional().default('week')
          .describe('Time period: today, week (7d), month (30d), quarter (90d), custom'),
        startDate: z.string().optional().describe('Start date for custom period (YYYY-MM-DD)'),
        endDate: z.string().optional().describe('End date for custom period (YYYY-MM-DD)'),
        comparePeriod: z.object({
          startDate: z.string(),
          endDate: z.string(),
        }).optional().describe('Second period for compare action'),
      }),
      func: async (params) => handleWhoopAnalyticsManager(userId, params),
    }),

    // LIFE HISTORY SEARCH
    new DynamicStructuredTool({
      name: 'searchUserHistory',
      description: `Search user's complete life history for progress analysis, pattern detection, and longitudinal insights. Finds relevant days, journal entries, coaching conversations, lessons, and health events by semantic similarity. Always include date range for focused results.`,
      schema: z.object({
        query: z.string().describe('Semantic search about user history/progress/patterns'),
        startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
        endDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
        category: z.enum(['all', 'fitness', 'nutrition', 'sleep', 'wellbeing', 'habits', 'goals', 'coaching']).optional().describe('Filter by health pillar'),
        entryType: z.enum(['daily_digest', 'journal', 'voice_session', 'emotional_checkin', 'lesson', 'goal_milestone', 'health_alert', 'daily_checkin']).optional().describe('Filter by entry type'),
        limit: z.number().optional().default(10).describe('Max results (default 10)'),
      }),
      func: async (params) => {
        try {
          const results = await lifeHistoryEmbeddingService.searchHistory({
            userId,
            queryText: params.query,
            startDate: params.startDate,
            endDate: params.endDate,
            category: params.category as any,
            entryType: params.entryType as any,
            limit: params.limit,
          });

          if (results.length === 0) {
            return JSON.stringify({ success: true, message: 'No matching history found for the given query and filters.', results: [] });
          }

          return JSON.stringify({
            success: true,
            count: results.length,
            results: results.map(r => ({
              date: r.eventDate,
              type: r.entryType,
              category: r.category,
              content: r.content,
              metadata: r.metadata,
              similarity: Math.round(r.similarity * 100) / 100,
            })),
          });
        } catch (error) {
          logger.error('[searchUserHistory] Error', { error });
          return JSON.stringify({ success: false, error: `Failed to search history: ${error}` });
        }
      },
    }),

    // MUSIC / PULSE
    new DynamicStructuredTool({
      name: 'musicManager',
      description: 'Control the Pulse music player. Actions: play_activity (play curated playlist for workout/meditation/sleep/focus/etc), search_and_play (search music by query and play), control (pause/resume/next/previous/stop/volume), recommend (AI-powered music recommendations based on activity). When the result includes a suggestedAction, you MUST include it in your response actions to trigger the music player automatically.',
      schema: MusicManagerSchema,
      func: async (params) => handleMusicManager(userId, params),
    }),
  ];
  } catch (error) {
    logger.error('[SemanticTools] CRITICAL: Failed to create semantic tools', {
      userId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.slice(0, 500) : undefined,
    });
    return [];
  }
}

// ============================================
// SERVICE EXPORT
// ============================================

export const semanticToolsService = {
  createSemanticTools,
};
