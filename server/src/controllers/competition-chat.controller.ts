/**
 * @file Competition Chat Controller
 * @description Handles competition live chat HTTP endpoints.
 */

import type { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { competitionChatService } from '../services/competition-chat.service.js';
import type { AuthenticatedRequest } from '../types/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract and validate the authenticated userId from the request.
 * Throws 401 if the user is not authenticated.
 */
function requireUserId(req: AuthenticatedRequest): string {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();
  return userId;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/competitions/:competitionId/chat
 *
 * Send a message to a competition chat room.
 *
 * Body:
 *   - content   (string, required, 1-500 chars)
 *   - replyToId (string, optional)
 */
export const sendMessage = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = requireUserId(req);
    const { competitionId } = req.params;

    const { content, replyToId } = req.body as {
      content?: unknown;
      replyToId?: unknown;
    };

    // --- Validation ---
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw ApiError.badRequest('Content is required and must be a non-empty string');
    }

    if (content.length > 500) {
      throw ApiError.badRequest('Content must be at most 500 characters');
    }

    if (replyToId !== undefined && typeof replyToId !== 'string') {
      throw ApiError.badRequest('replyToId must be a string');
    }

    if (!competitionId) {
      throw ApiError.badRequest('competitionId is required');
    }

    // --- Service call ---
    const message = await competitionChatService.sendMessage(
      competitionId,
      userId,
      content.trim(),
      typeof replyToId === 'string' ? replyToId : undefined,
    );

    ApiResponse.created(res, { message }, 'Message sent successfully');
  },
);

/**
 * GET /api/v1/competitions/:competitionId/chat
 *
 * Get messages for a competition (paginated, newest first).
 *
 * Query params:
 *   - limit  (number, optional, default 50, max 100)
 *   - before (string, optional, ISO-8601 date cursor)
 */
export const getMessages = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    requireUserId(req); // Ensure authenticated
    const { competitionId } = req.params;

    if (!competitionId) {
      throw ApiError.badRequest('competitionId is required');
    }

    // Parse & validate limit
    let limit = 50;
    if (req.query['limit'] !== undefined) {
      const parsed = parseInt(req.query['limit'] as string, 10);
      if (isNaN(parsed) || parsed < 1) {
        throw ApiError.badRequest('limit must be a positive integer');
      }
      limit = Math.min(parsed, 100);
    }

    // Parse & validate before cursor
    let before: string | undefined;
    if (req.query['before'] !== undefined) {
      const raw = req.query['before'] as string;
      if (isNaN(Date.parse(raw))) {
        throw ApiError.badRequest('before must be a valid ISO-8601 date string');
      }
      before = raw;
    }

    const result = await competitionChatService.getMessages(
      competitionId,
      limit,
      before,
    );

    ApiResponse.success(res, result, 'Messages retrieved successfully');
  },
);

/**
 * POST /api/v1/competitions/:competitionId/chat/:messageId/reactions
 *
 * Add a reaction to a message.
 *
 * Body:
 *   - emoji (string, required, max 10 chars)
 */
export const addReaction = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = requireUserId(req);
    const { messageId } = req.params;

    const { emoji } = req.body as { emoji?: unknown };

    // --- Validation ---
    if (!messageId) {
      throw ApiError.badRequest('messageId is required');
    }

    if (typeof emoji !== 'string' || emoji.trim().length === 0) {
      throw ApiError.badRequest('emoji is required and must be a non-empty string');
    }

    if (emoji.length > 10) {
      throw ApiError.badRequest('emoji must be at most 10 characters');
    }

    await competitionChatService.addReaction(messageId, userId, emoji.trim());

    ApiResponse.success(res, null, 'Reaction added successfully');
  },
);

/**
 * DELETE /api/v1/competitions/:competitionId/chat/:messageId/reactions/:emoji
 *
 * Remove a reaction from a message.
 */
export const removeReaction = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = requireUserId(req);
    const { messageId, emoji } = req.params;

    // --- Validation ---
    if (!messageId) {
      throw ApiError.badRequest('messageId is required');
    }

    if (!emoji || emoji.length > 10) {
      throw ApiError.badRequest('emoji is required and must be at most 10 characters');
    }

    await competitionChatService.removeReaction(
      messageId,
      userId,
      decodeURIComponent(emoji),
    );

    ApiResponse.success(res, null, 'Reaction removed successfully');
  },
);

/**
 * DELETE /api/v1/competitions/:competitionId/chat/:messageId
 *
 * Delete own message from a competition chat.
 */
export const deleteMessage = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = requireUserId(req);
    const { messageId } = req.params;

    if (!messageId) {
      throw ApiError.badRequest('messageId is required');
    }

    await competitionChatService.deleteMessage(messageId, userId);

    ApiResponse.success(res, null, 'Message deleted successfully');
  },
);
