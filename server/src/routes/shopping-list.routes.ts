/**
 * @file Shopping List Routes
 * API endpoints for shopping list management
 */

import { Router, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import authenticate from '../middlewares/auth.middleware.js';
import { shoppingListService } from '../services/shopping-list.service.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/shopping-list
 * Get all shopping list items
 */
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { isPurchased, category, limit, offset } = req.query;

    const result = await shoppingListService.getItems(userId, {
      isPurchased: isPurchased !== undefined ? isPurchased === 'true' : undefined,
      category: category as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * GET /api/shopping-list/stats
 * Get shopping list statistics
 */
router.get(
  '/stats',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;

    const stats = await shoppingListService.getStats(userId);

    res.json({
      success: true,
      data: { stats },
    });
  })
);

/**
 * GET /api/shopping-list/:id
 * Get a specific shopping list item
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;

    const item = await shoppingListService.getItem(userId, id);

    if (!item) {
      res.status(404).json({
        success: false,
        error: 'Shopping list item not found',
      });
      return;
    }

    res.json({
      success: true,
      data: { item },
    });
  })
);

/**
 * POST /api/shopping-list
 * Create a shopping list item
 */
router.post(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { name, quantity, category, notes, calories, priority } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({
        success: false,
        error: 'Item name is required',
      });
      return;
    }

    const item = await shoppingListService.createItem(userId, {
      name: name.trim(),
      quantity,
      category,
      notes,
      calories: calories !== undefined ? (calories === null || calories === '' ? null : parseInt(calories)) : undefined,
      priority,
      source: 'manual',
    });

    res.status(201).json({
      success: true,
      data: { item },
    });
  })
);

/**
 * POST /api/shopping-list/bulk
 * Create multiple shopping list items
 */
router.post(
  '/bulk',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Items array is required',
      });
      return;
    }

    // Validate all items have names
    const validItems = items.filter((item: { name?: string }) => item.name && item.name.trim());
    if (validItems.length === 0) {
      res.status(400).json({
        success: false,
        error: 'At least one valid item name is required',
      });
      return;
    }

    const createdItems = await shoppingListService.createItems(
      userId,
      validItems.map((item: { name: string; quantity?: string; category?: string; notes?: string; calories?: number | null }) => ({
        name: item.name.trim(),
        quantity: item.quantity,
        category: item.category,
        notes: item.notes,
        calories: item.calories,
        source: 'manual' as const,
      }))
    );

    res.status(201).json({
      success: true,
      data: { items: createdItems },
    });
  })
);

/**
 * POST /api/shopping-list/generate
 * Generate shopping list with AI
 */
router.post(
  '/generate',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { description } = req.body;

    if (!description || !description.trim()) {
      res.status(400).json({
        success: false,
        error: 'Description is required for AI generation',
      });
      return;
    }

    try {
      const result = await shoppingListService.generateWithAI(userId, description.trim());

      res.json({
        success: true,
        data: {
          items: result.items,
          aiResponse: result.aiResponse,
          provider: result.provider,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check for specific error types to give better user feedback
      if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        res.status(503).json({
          success: false,
          error: 'AI service is temporarily busy. Please try again in a few minutes.',
          code: 'RATE_LIMITED',
        });
        return;
      }

      if (errorMessage.includes('Insufficient Balance') || errorMessage.includes('402')) {
        res.status(503).json({
          success: false,
          error: 'AI service is temporarily unavailable. Please try again later.',
          code: 'SERVICE_UNAVAILABLE',
        });
        return;
      }

      if (errorMessage.includes('No AI providers')) {
        res.status(503).json({
          success: false,
          error: 'AI generation is not configured. Please add items manually.',
          code: 'NOT_CONFIGURED',
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to generate shopping list. Please try again or add items manually.',
      });
    }
  })
);

/**
 * PATCH /api/shopping-list/:id
 * Update a shopping list item
 */
router.patch(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { name, quantity, category, notes, calories, isPurchased, priority } = req.body;

    const item = await shoppingListService.updateItem(userId, id, {
      name: name?.trim(),
      quantity,
      category,
      notes,
      calories: calories !== undefined ? (calories === null || calories === '' ? null : parseInt(calories)) : undefined,
      isPurchased,
      priority,
    });

    if (!item) {
      res.status(404).json({
        success: false,
        error: 'Shopping list item not found',
      });
      return;
    }

    res.json({
      success: true,
      data: { item },
    });
  })
);

/**
 * PATCH /api/shopping-list/:id/toggle
 * Toggle purchased status
 */
router.patch(
  '/:id/toggle',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;

    const item = await shoppingListService.togglePurchased(userId, id);

    if (!item) {
      res.status(404).json({
        success: false,
        error: 'Shopping list item not found',
      });
      return;
    }

    res.json({
      success: true,
      data: { item },
    });
  })
);

/**
 * DELETE /api/shopping-list/:id
 * Delete a shopping list item
 */
router.delete(
  '/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;

    const deleted = await shoppingListService.deleteItem(userId, id);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: 'Shopping list item not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Shopping list item deleted',
    });
  })
);

/**
 * DELETE /api/shopping-list/clear/purchased
 * Clear all purchased items
 */
router.delete(
  '/clear/purchased',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;

    const count = await shoppingListService.clearPurchased(userId);

    res.json({
      success: true,
      data: { deletedCount: count },
      message: `${count} purchased items cleared`,
    });
  })
);

export default router;
