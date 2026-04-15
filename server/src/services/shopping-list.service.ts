/**
 * @file Shopping List Service
 * Handles shopping list CRUD and AI generation
 */

import { pool } from '../database/pg.js';
import { logger } from './logger.service.js';
import { aiProviderService } from './ai-provider.service.js';

// ============================================
// TYPES
// ============================================

export interface ShoppingListItem {
  id: string;
  userId: string;
  name: string;
  quantity: string | null;
  category: string | null;
  notes: string | null;
  calories: number | null;
  source: 'manual' | 'ai_generated' | 'diet_plan';
  sourceDescription: string | null;
  isPurchased: boolean;
  purchasedAt: string | null;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShoppingItemInput {
  name: string;
  quantity?: string;
  category?: string;
  notes?: string;
  calories?: number | null;
  source?: 'manual' | 'ai_generated' | 'diet_plan';
  sourceDescription?: string;
  priority?: number;
}

export interface UpdateShoppingItemInput {
  name?: string;
  quantity?: string;
  category?: string;
  notes?: string;
  calories?: number | null;
  isPurchased?: boolean;
  priority?: number;
}

export interface ShoppingListStats {
  totalItems: number;
  purchasedItems: number;
  pendingItems: number;
  categories: Array<{ category: string; count: number }>;
}

// ============================================
// CONSTANTS
// ============================================

const VALID_CATEGORIES = ['produce', 'protein', 'dairy', 'grains', 'pantry', 'beverages', 'frozen', 'other'];

// ============================================
// SERVICE
// ============================================

class ShoppingListService {
  /**
   * Get all shopping list items for a user
   */
  async getItems(
    userId: string,
    options?: {
      isPurchased?: boolean;
      category?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ items: ShoppingListItem[]; total: number }> {
    let query = 'SELECT * FROM shopping_list_items WHERE user_id = $1';
    const params: (string | boolean | number)[] = [userId];
    let paramIndex = 2;

    if (options?.isPurchased !== undefined) {
      query += ` AND is_purchased = $${paramIndex}`;
      params.push(options.isPurchased);
      paramIndex++;
    }

    if (options?.category) {
      query += ` AND category = $${paramIndex}`;
      params.push(options.category);
      paramIndex++;
    }

    // Count query
    const countResult = await pool.query(
      query.replace('SELECT *', 'SELECT COUNT(*)'),
      params
    );

    // Order and paginate
    query += ' ORDER BY is_purchased ASC, priority DESC, created_at DESC';

    if (options?.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(options.limit);
      paramIndex++;
    }

    if (options?.offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(options.offset);
    }

    const result = await pool.query(query, params);

    return {
      items: result.rows.map(this.mapItemRow),
      total: parseInt(countResult.rows[0].count),
    };
  }

  /**
   * Get a single shopping list item
   */
  async getItem(userId: string, itemId: string): Promise<ShoppingListItem | null> {
    const result = await pool.query(
      'SELECT * FROM shopping_list_items WHERE id = $1 AND user_id = $2',
      [itemId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapItemRow(result.rows[0]);
  }

  /**
   * Create a shopping list item
   */
  async createItem(userId: string, input: CreateShoppingItemInput): Promise<ShoppingListItem> {
    const result = await pool.query(
      `INSERT INTO shopping_list_items (user_id, name, quantity, category, notes, calories, source, source_description, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        userId,
        input.name,
        input.quantity || null,
        input.category || 'other',
        input.notes || null,
        input.calories !== undefined ? input.calories : null,
        input.source || 'manual',
        input.sourceDescription || null,
        input.priority || 0,
      ]
    );

    logger.info(`Shopping item created for user ${userId}: ${input.name}`);
    return this.mapItemRow(result.rows[0]);
  }

  /**
   * Create multiple shopping list items (bulk)
   */
  async createItems(userId: string, items: CreateShoppingItemInput[]): Promise<ShoppingListItem[]> {
    const createdItems: ShoppingListItem[] = [];

    for (const item of items) {
      const created = await this.createItem(userId, item);
      createdItems.push(created);
    }

    logger.info(`${items.length} shopping items created for user ${userId}`);
    return createdItems;
  }

  /**
   * Update a shopping list item
   */
  async updateItem(
    userId: string,
    itemId: string,
    input: UpdateShoppingItemInput
  ): Promise<ShoppingListItem | null> {
    // Build dynamic update query
    const updates: string[] = [];
    const params: (string | boolean | number)[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(input.name);
      paramIndex++;
    }

    if (input.quantity !== undefined) {
      updates.push(`quantity = $${paramIndex}`);
      params.push(input.quantity);
      paramIndex++;
    }

    if (input.category !== undefined) {
      updates.push(`category = $${paramIndex}`);
      params.push(input.category);
      paramIndex++;
    }

    if (input.notes !== undefined) {
      updates.push(`notes = $${paramIndex}`);
      params.push(input.notes);
      paramIndex++;
    }

    if (input.calories !== undefined && input.calories !== null) {
      updates.push(`calories = $${paramIndex}`);
      params.push(input.calories);
      paramIndex++;
    }

    if (input.isPurchased !== undefined) {
      updates.push(`is_purchased = $${paramIndex}`);
      params.push(input.isPurchased);
      paramIndex++;

      if (input.isPurchased) {
        updates.push(`purchased_at = CURRENT_TIMESTAMP`);
      } else {
        updates.push(`purchased_at = NULL`);
      }
    }

    if (input.priority !== undefined) {
      updates.push(`priority = $${paramIndex}`);
      params.push(input.priority);
      paramIndex++;
    }

    if (updates.length === 0) {
      return this.getItem(userId, itemId);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(itemId, userId);

    const result = await pool.query(
      `UPDATE shopping_list_items
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapItemRow(result.rows[0]);
  }

  /**
   * Delete a shopping list item
   */
  async deleteItem(userId: string, itemId: string): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM shopping_list_items WHERE id = $1 AND user_id = $2',
      [itemId, userId]
    );

    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Toggle purchased status
   */
  async togglePurchased(userId: string, itemId: string): Promise<ShoppingListItem | null> {
    const item = await this.getItem(userId, itemId);
    if (!item) return null;

    return this.updateItem(userId, itemId, { isPurchased: !item.isPurchased });
  }

  /**
   * Clear all purchased items
   */
  async clearPurchased(userId: string): Promise<number> {
    const result = await pool.query(
      'DELETE FROM shopping_list_items WHERE user_id = $1 AND is_purchased = true',
      [userId]
    );

    logger.info(`Cleared ${result.rowCount} purchased items for user ${userId}`);
    return result.rowCount || 0;
  }

  /**
   * Get shopping list statistics
   */
  async getStats(userId: string): Promise<ShoppingListStats> {
    const [totalResult, purchasedResult, categoryResult] = await Promise.all([
      pool.query(
        'SELECT COUNT(*) FROM shopping_list_items WHERE user_id = $1',
        [userId]
      ),
      pool.query(
        'SELECT COUNT(*) FROM shopping_list_items WHERE user_id = $1 AND is_purchased = true',
        [userId]
      ),
      pool.query(
        `SELECT category, COUNT(*) as count
         FROM shopping_list_items
         WHERE user_id = $1 AND is_purchased = false
         GROUP BY category
         ORDER BY count DESC`,
        [userId]
      ),
    ]);

    const totalItems = parseInt(totalResult.rows[0].count);
    const purchasedItems = parseInt(purchasedResult.rows[0].count);

    return {
      totalItems,
      purchasedItems,
      pendingItems: totalItems - purchasedItems,
      categories: categoryResult.rows.map((row) => ({
        category: row.category || 'other',
        count: parseInt(row.count),
      })),
    };
  }

  /**
   * Generate shopping list using AI based on description
   * Uses multi-provider fallback: OpenAI → DeepSeek → Gemini
   */
  async generateWithAI(
    userId: string,
    description: string
  ): Promise<{ items: ShoppingListItem[]; aiResponse: string; provider: string }> {
    if (!aiProviderService.isAvailable()) {
      throw new Error('AI generation is not available. No AI providers configured.');
    }

    const systemPrompt = `You are a nutrition and shopping assistant. Generate practical, healthy shopping suggestions based on the user's description. Always respond with valid JSON.

Respond ONLY with a JSON object in this exact format (no markdown, no code blocks):
{
  "items": [
    {"name": "item name", "quantity": "amount", "category": "produce|protein|dairy|grains|pantry|beverages|frozen|other", "calories": number}
  ],
  "explanation": "Brief explanation of your suggestions"
}

Categories:
- produce: fruits, vegetables, fresh herbs
- protein: meat, fish, eggs, tofu, legumes
- dairy: milk, cheese, yogurt, butter
- grains: rice, pasta, bread, cereals
- pantry: canned goods, spices, oils, sauces
- beverages: drinks, juices, tea, coffee
- frozen: frozen foods
- other: anything else

IMPORTANT: For each item, provide the estimated calories per unit/portion. For example:
- "salmon fillets" (1 lb) might be ~800 calories
- "eggs" (1 dozen) might be ~840 calories (70 per egg)
- "quinoa" (500g) might be ~555 calories
- "spinach" (1 bunch) might be ~20 calories
- "broccoli" (500g) might be ~165 calories

Include sensible quantities like "500g", "2 lbs", "1 bunch", "6 pack", etc.
Always include calories as a number (can be null if truly unknown, but try to estimate based on standard nutritional values).`;

    const userPrompt = `Create a shopping list for: "${description}"`;

    try {
      const response = await aiProviderService.generateCompletion({
        systemPrompt,
        userPrompt,
        maxTokens: 1000,
        temperature: 0.7,
      });

      const aiContent = response.content;

      // Parse AI response
      let parsedItems: Array<{ name: string; quantity: string; category: string; calories?: number | null }> = [];
      let explanation = '';

      try {
        // Extract JSON from response (handle markdown code blocks if any)
        let jsonStr = aiContent.trim();
        const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1].trim();
        }

        const parsed = JSON.parse(jsonStr);
        parsedItems = parsed.items || [];
        explanation = parsed.explanation || '';
      } catch {
        // If JSON parsing fails, log warning
        logger.warn(`Failed to parse AI response as JSON for user ${userId}`, { response: aiContent });
        explanation = 'Generated suggestions based on your description.';
      }

      // Create items
      const createdItems = await this.createItems(
        userId,
        parsedItems.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          category: VALID_CATEGORIES.includes(item.category) ? item.category : 'other',
          calories: item.calories !== undefined && item.calories !== null ? Number(item.calories) : null,
          source: 'ai_generated' as const,
          sourceDescription: description,
        }))
      );

      logger.info(`AI generated ${createdItems.length} shopping items for user ${userId} using ${response.provider}`);

      return {
        items: createdItems,
        aiResponse: explanation,
        provider: response.provider,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`AI shopping list generation failed for user ${userId}:`, { error: errorMessage });
      throw new Error(`Failed to generate shopping list with AI: ${errorMessage}`);
    }
  }

  // ============================================
  // PRIVATE HELPERS
  // ============================================

  private mapItemRow(row: Record<string, unknown>): ShoppingListItem {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      name: row.name as string,
      quantity: row.quantity as string | null,
      category: row.category as string | null,
      notes: row.notes as string | null,
      calories: row.calories !== null && row.calories !== undefined ? (row.calories as number) : null,
      source: row.source as 'manual' | 'ai_generated' | 'diet_plan',
      sourceDescription: row.source_description as string | null,
      isPurchased: row.is_purchased as boolean,
      purchasedAt: row.purchased_at ? (row.purchased_at as Date).toISOString() : null,
      priority: row.priority as number,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
    };
  }
}

// Export singleton instance
export const shoppingListService = new ShoppingListService();
