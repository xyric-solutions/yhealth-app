/**
 * @file Message Controller
 * @description Handles message-related API endpoints
 */

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { messageService, type MessageWithRelations } from '../services/message.service.js';
import { createUploadMiddleware } from '../middlewares/upload.middleware.js';
import { socketService } from '../services/socket.service.js';
import { ragChatbotService } from '../services/rag-chatbot.service.js';
import { tenorService } from '../services/tenor.service.js';
import { query } from '../database/pg.js';
import { logger } from '../services/logger.service.js';

/** Extract [GIF:search_term] marker from AI response and return { text, gifQuery } */
function extractGifMarker(text: string): { text: string; gifQuery: string | null } {
  const match = text.match(/\[GIF:([^\]]+)\]\s*$/);
  if (!match) return { text, gifQuery: null };
  return {
    text: text.replace(match[0], '').trim(),
    gifQuery: match[1].trim(),
  };
}

const AI_COACH_USER_ID = process.env.AI_COACH_USER_ID || '00000000-0000-0000-0000-000000000001';

/**
 * Helper to convert Date to ISO string (ensures UTC)
 * PostgreSQL TIMESTAMP without timezone should be treated as UTC
 */
function toISOString(date: Date | null | undefined): string | null | undefined {
  if (!date) return date === null ? null : undefined;
  return date instanceof Date ? date.toISOString() : undefined;
}

/**
 * Transform message to API format with proper timestamp conversion
 */
function transformMessage(message: MessageWithRelations): Record<string, unknown> {
  const transformed: Record<string, unknown> = {
    ...message,
    created_at: toISOString(message.created_at),
    updated_at: toISOString(message.updated_at),
    edited_at: toISOString(message.edited_at),
    deleted_at: toISOString(message.deleted_at),
    pinned_at: toISOString(message.pinned_at),
    view_once_opened_at: toISOString(message.view_once_opened_at),
    replied_to: message.replied_to ? transformMessage(message.replied_to) : null,
    forwarded_from: message.forwarded_from ? transformMessage(message.forwarded_from) : null,
  };

  // Strip media URLs from opened view-once messages (security: prevent replay)
  if (message.is_view_once && message.view_once_opened_at) {
    transformed.media_url = null;
    transformed.media_thumbnail = null;
  }

  return transformed;
}

/**
 * Check if a chat is with AI coach
 */
async function isAICoachChat(chatId: string, userId: string): Promise<boolean> {
  try {
    const result = await query<{ user_id: string }>(
      `SELECT cp.user_id
       FROM chat_participants cp
       INNER JOIN chats c ON cp.chat_id = c.id
       WHERE cp.chat_id = $1
         AND cp.user_id != $2
         AND cp.left_at IS NULL
         AND c.is_group_chat = false
       LIMIT 1`,
      [chatId, userId]
    );

    if (result.rows.length === 0) return false;
    return result.rows[0].user_id === AI_COACH_USER_ID;
  } catch (error) {
    logger.error('[MessageController] Error checking AI coach chat', { chatId, userId, error });
    return false;
  }
}

/**
 * POST /api/messages
 * Send a message
 */
export const sendMessage = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { chatId, content, contentType, repliedTo } = req.body;

    if (!content && !req.body.mediaUrl) {
      throw ApiError.badRequest('Content or media is required');
    }

    if (!chatId) {
      throw ApiError.badRequest('Chat ID is required');
    }

    const message = await messageService.sendMessage({
      chatId,
      senderId: userId,
      content,
      contentType: contentType || 'text',
      mediaUrl: req.body.mediaUrl,
      mediaThumbnail: req.body.mediaThumbnail,
      mediaSize: req.body.mediaSize,
      mediaDuration: req.body.mediaDuration,
      repliedToId: repliedTo || undefined,
      isViewOnce: req.body.isViewOnce || false,
    });

    // Emit socket event for real-time updates
    socketService.emitToChat(chatId, 'newMessage', {
      chatId,
      message: transformMessage(message),
      senderId: userId,
    });

    // If this is a text message to AI coach chat, trigger AI response via LangGraph
    // This enables: proactive message replies → AI processes with tools → auto-logs data
    if (content && contentType === 'text') {
      const isAIChat = await isAICoachChat(chatId, userId);
      if (isAIChat) {
        // Trigger AI response asynchronously (don't block the user's message delivery)
        setImmediate(async () => {
          try {
            // Show typing indicator while AI processes
            socketService.emitToChat(chatId, 'typing', {
              chatId,
              userId: AI_COACH_USER_ID,
            });

            // Generate AI response using RAG chatbot service
            // LangGraph has full tool access (mealManager, workoutManager, moodManager, etc.)
            // The auto-extraction system prompt instructs the AI to:
            // 1. Scan user message for loggable data (meals, mood, workouts, etc.)
            // 2. Call tools to log data automatically
            // 3. Provide coaching insights about the logged data
            const aiResponse = await ragChatbotService.chat({
              userId,
              message: content,
              conversationId: undefined, // Let RAG service manage conversations
            });

            // Stop typing indicator
            socketService.emitToChat(chatId, 'stopTyping', {
              chatId,
              userId: AI_COACH_USER_ID,
            });

            // Send AI response back to the chat
            if (aiResponse.response) {
              // Fetch AI coach display name for proper rendering
              let firstName = 'AI';
              let lastName = 'Coach';
              try {
                const coachUser = await query<{ first_name: string; last_name: string }>(
                  `SELECT first_name, last_name FROM users WHERE id = $1`,
                  [AI_COACH_USER_ID]
                );
                if (coachUser.rows[0]) {
                  firstName = coachUser.rows[0].first_name;
                  lastName = coachUser.rows[0].last_name;
                }
              } catch { /* use defaults */ }

              const senderInfo = {
                id: AI_COACH_USER_ID,
                firstName,
                lastName,
                avatar: '/default-voice-assistant-avatar.svg',
              };

              // Check for GIF marker in AI response
              const { text: cleanText, gifQuery } = extractGifMarker(aiResponse.response);

              const aiMessage = await messageService.sendMessage({
                chatId,
                senderId: AI_COACH_USER_ID,
                content: cleanText,
                contentType: 'text',
              });

              const messagePayload = {
                chatId,
                message: {
                  ...transformMessage(aiMessage),
                  sender: senderInfo,
                },
                senderId: AI_COACH_USER_ID,
              };

              // Emit socket event with full sender info for proper UI rendering
              socketService.emitToChat(chatId, 'newMessage', messagePayload);
              socketService.emitToUser(userId, 'newMessage', messagePayload);

              // If AI included a GIF marker, search and send it as a follow-up message
              if (gifQuery) {
                try {
                  const gifUrl = await tenorService.searchGif(gifQuery);
                  if (gifUrl) {
                    const gifMessage = await messageService.sendMessage({
                      chatId,
                      senderId: AI_COACH_USER_ID,
                      content: '',
                      contentType: 'gif',
                      mediaUrl: gifUrl,
                    });

                    const gifPayload = {
                      chatId,
                      message: {
                        ...transformMessage(gifMessage),
                        sender: senderInfo,
                      },
                      senderId: AI_COACH_USER_ID,
                    };
                    socketService.emitToChat(chatId, 'newMessage', gifPayload);
                    socketService.emitToUser(userId, 'newMessage', gifPayload);
                  }
                } catch (gifError) {
                  logger.warn('[MessageController] Failed to send AI GIF', {
                    gifQuery,
                    error: gifError instanceof Error ? gifError.message : 'Unknown',
                  });
                }
              }
            }
          } catch (error) {
            // Stop typing on error
            socketService.emitToChat(chatId, 'stopTyping', {
              chatId,
              userId: AI_COACH_USER_ID,
            });
            logger.error('[MessageController] Error generating AI response', {
              chatId,
              userId,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            // Don't throw - AI response failure shouldn't break message sending
          }
        });
      }
    }

    ApiResponse.created(res, transformMessage(message), 'Message sent successfully', req);
  }
);

/**
 * GET /api/messages/chat/:chatId
 * Get messages for a chat (paginated)
 */
export const getMessages = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { chatId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;

    const messages = await messageService.getChatMessages(chatId, userId, page, limit);

    // Transform messages to ensure proper timestamp formatting
    const transformedMessages = messages.map(transformMessage);

    ApiResponse.success(
      res,
      transformedMessages,
      {
        message: 'Messages retrieved successfully',
        meta: {
          page,
          limit,
          total: transformedMessages.length,
          totalPages: Math.ceil(transformedMessages.length / limit),
          hasNextPage: page < Math.ceil(transformedMessages.length / limit),
          hasPrevPage: page > 1,
        },
      },
      200,
      req
    );
  }
);

/**
 * PUT /api/messages/:id
 * Edit a message
 */
export const editMessage = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const userRole = req.user?.role || 'user';
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      throw ApiError.badRequest('Content is required');
    }

    const message = await messageService.editMessage(id, userId, userRole, content);

    // Emit socket event for real-time updates
    socketService.emitToChat(message.chat_id, 'messageEdited', {
      chatId: message.chat_id,
      messageId: id,
      message: transformMessage(message),
    });

    ApiResponse.success(res, transformMessage(message), 'Message edited successfully', 200, req);
  }
);

/**
 * DELETE /api/messages/:id
 * Delete a message (soft delete)
 */
export const deleteMessage = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const userRole = req.user?.role || 'user';
    const { id } = req.params;

    const message = await messageService.deleteMessage(id, userId, userRole);

    // Emit socket event for real-time updates
    socketService.emitToChat(message.chat_id, 'messageDeleted', {
      chatId: message.chat_id,
      messageId: id,
    });

    ApiResponse.success(res, transformMessage(message), 'Message deleted successfully', 200, req);
  }
);

/**
 * POST /api/messages/:id/reaction
 * Add or remove reaction to message
 */
export const addReaction = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { id } = req.params;
    const { emoji } = req.body;

    if (!emoji) {
      throw ApiError.badRequest('Emoji is required');
    }

    const message = await messageService.toggleReaction(id, userId, emoji);

    // Emit socket event for real-time updates
    socketService.emitToChat(message.chat_id, 'messageReaction', {
      chatId: message.chat_id,
      messageId: id,
      reaction: {
        emoji,
        userId,
        reactions: message.reactions,
      },
    });

    ApiResponse.success(res, transformMessage(message), 'Reaction updated successfully', 200, req);
  }
);

/**
 * POST /api/messages/:id/pin
 * Pin or unpin a message
 */
export const togglePinMessage = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { id } = req.params;

    const message = await messageService.togglePinMessage(id, userId);

    // Emit socket event for real-time updates
    socketService.emitToChat(message.chat_id, 'messagePinned', {
      chatId: message.chat_id,
      messageId: id,
      message: transformMessage(message),
    });

    ApiResponse.success(
      res,
      transformMessage(message),
      message.is_pinned ? 'Message pinned successfully' : 'Message unpinned successfully',
      200,
      req
    );
  }
);

/**
 * POST /api/messages/:id/star
 * Star or unstar a message
 */
export const toggleStarMessage = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { id } = req.params;

    const message = await messageService.toggleStarMessage(id, userId);

    // Emit socket event for real-time updates
    socketService.emitToChat(message.chat_id, 'messageStarred', {
      chatId: message.chat_id,
      messageId: id,
      message: transformMessage(message),
      userId,
    });

    ApiResponse.success(
      res,
      transformMessage(message),
      message.is_starred ? 'Message starred successfully' : 'Message unstarred successfully',
      200,
      req
    );
  }
);

/**
 * POST /api/messages/:id/forward
 * Forward message to multiple chats
 */
export const forwardMessage = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { id } = req.params;
    const { chatIds } = req.body;

    if (!chatIds || !Array.isArray(chatIds) || chatIds.length === 0) {
      throw ApiError.badRequest('Chat IDs array is required');
    }

    const forwardedMessages = await messageService.forwardMessage({
      messageId: id,
      senderId: userId,
      chatIds,
    });

    const transformedMessages = forwardedMessages.map(transformMessage);

    ApiResponse.success(res, transformedMessages, 'Message forwarded successfully', 200, req);
  }
);

/**
 * POST /api/messages/:id/read
 * Mark message as read
 */
export const markMessageAsRead = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { id } = req.params;

    const message = await messageService.getMessageById(id, userId);
    await messageService.markMessageAsRead(id, userId);

    // Emit socket event for real-time updates
    socketService.emitToChat(message.chat_id, 'messageRead', {
      chatId: message.chat_id,
      messageId: id,
      userId,
    });

    ApiResponse.success(res, null, 'Message marked as read', 200, req);
  }
);

/**
 * POST /api/messages/chat/:chatId/read-all
 * Mark all messages in chat as read
 */
export const markChatAsRead = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { chatId } = req.params;

    await messageService.markChatAsRead(chatId, userId);

    // Emit socket event for real-time updates
    socketService.emitToChat(chatId, 'messagesRead', {
      chatId,
      userId,
    });

    ApiResponse.success(res, null, 'All messages marked as read', 200, req);
  }
);

/**
 * POST /api/messages/:id/view-once
 * Open a view-once message (one-time media access)
 */
export const openViewOnceMessage = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { id } = req.params;

    const result = await messageService.openViewOnceMessage(id, userId);

    // Emit socket event so sender sees "Opened" status
    socketService.emitToChat(result.chatId, 'viewOnceOpened', {
      messageId: id,
      openedBy: userId,
      openedAt: new Date().toISOString(),
    });

    ApiResponse.success(res, {
      mediaUrl: result.mediaUrl,
      mediaThumbnail: result.mediaThumbnail,
    }, 'View once message opened', 200, req);
  }
);

/**
 * GET /api/messages/:id
 * Get message details
 */
export const getMessageById = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { id } = req.params;

    const message = await messageService.getMessageById(id, userId);

    ApiResponse.success(res, transformMessage(message), 'Message retrieved successfully', 200, req);
  }
);

/**
 * POST /api/messages/upload
 * Upload media file for message
 */
export const uploadMedia = [
  createUploadMiddleware('file', 'file'),
  asyncHandler(
    async (req: AuthenticatedRequest, res: Response) => {
      const userId = req.user?.userId;
      if (!userId) throw ApiError.unauthorized();

      if (!req.file) {
        throw ApiError.badRequest('No file provided');
      }

      const { contentType } = req.body; // 'image', 'video', 'audio', 'document'

      if (!contentType || !['image', 'video', 'audio', 'document'].includes(contentType)) {
        throw ApiError.badRequest('Valid contentType is required: image, video, audio, or document');
      }

      const uploadResult = await messageService.uploadMedia(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        userId,
        contentType as 'image' | 'video' | 'audio' | 'document'
      );

      ApiResponse.success(
        res,
        uploadResult,
        'Media uploaded successfully',
        200,
        req
      );
    }
  ),
];

