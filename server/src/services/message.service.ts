/**
 * @file Message Service
 * @description Handles message CRUD, reactions, pin/star, forwarding, read receipts, and media handling
 */

import { query, transaction } from '../database/pg.js';
import { logger } from './logger.service.js';
import { chatCacheService } from './chat-cache.service.js';
import { chatService } from './chat.service.js';
import { r2Service } from './r2.service.js';
import { socketService } from './socket.service.js';
import { ApiError } from '../utils/ApiError.js';

// ============================================
// TYPES
// ============================================

export interface MessageRow {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string | null;
  content_type: string;
  media_url: string | null;
  media_thumbnail: string | null;
  media_size: number | null;
  media_duration: number | null;
  is_edited: boolean;
  edited_at: Date | null;
  is_deleted: boolean;
  deleted_at: Date | null;
  deleted_by: string | null;
  is_pinned: boolean;
  pinned_at: Date | null;
  pinned_by: string | null;
  replied_to_id: string | null;
  forwarded_from_id: string | null;
  forwarded_by: string | null;
  is_view_once: boolean;
  view_once_opened_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface MessageWithRelations extends MessageRow {
  sender?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    avatar: string | null;
    role: string;
  };
  replied_to?: MessageWithRelations | null;
  forwarded_from?: MessageWithRelations | null;
  reactions?: Array<{
    emoji: string;
    user_ids: string[];
    count: number;
  }>;
  is_starred?: boolean;
  read_by?: string[];
}

interface CreateMessageParams {
  chatId: string;
  senderId: string;
  content?: string;
  contentType?: string;
  mediaUrl?: string;
  mediaThumbnail?: string;
  mediaSize?: number;
  mediaDuration?: number;
  repliedToId?: string;
  isViewOnce?: boolean;
}

interface ForwardMessageParams {
  messageId: string;
  senderId: string;
  chatIds: string[];
}

// ============================================
// MESSAGE SERVICE
// ============================================

/**
 * Extract file key from a presigned R2 URL
 * Handles both presigned URLs with query params and direct public URLs
 */
function extractKeyFromUrl(url: string | null): string | null {
  if (!url) return null;
  
  try {
    // Parse the URL to extract the pathname
    // Format: https://account.r2.cloudflarestorage.com/images/.../file.jpg?X-Amz-...
    const urlObj = new URL(url);
    let pathname = urlObj.pathname;
    
    // Remove leading slash if present
    if (pathname.startsWith('/')) {
      pathname = pathname.slice(1);
    }
    
    // Return the pathname which is the file key
    return pathname || null;
  } catch (error) {
    // If URL parsing fails, try to extract from string using regex
    // Look for pattern after .cloudflarestorage.com/ or after domain/
    const match = url.match(/r2\.cloudflarestorage\.com\/(.+?)(?:\?|$)/) || 
                  url.match(/cloudflarestorage\.com\/(.+?)(?:\?|$)/) ||
                  url.match(/\/(images|documents|audio|video|files)\/.+?(?:\?|$)/);
    
    if (match && match[1]) {
      return match[1];
    }
    
    logger.warn('Could not extract key from URL', { url, error });
    return null;
  }
}

/**
 * Check if a URL is a presigned URL that might be expired
 */
function isPresignedUrl(url: string | null): boolean {
  if (!url) return false;
  return url.includes('X-Amz-Algorithm') || url.includes('X-Amz-Credential') || url.includes('X-Amz-Signature');
}

/**
 * Refresh a presigned URL if needed by generating a new one
 */
async function refreshMediaUrl(mediaUrl: string | null): Promise<string | null> {
  if (!mediaUrl) return null;
  
  // If R2 service is not configured, return original URL
  if (!r2Service.isR2Configured()) {
    return mediaUrl;
  }
  
  // If it's not a presigned URL (e.g., public URL), return as is
  if (!isPresignedUrl(mediaUrl)) {
    return mediaUrl;
  }
  
  // Extract the key from the presigned URL
  const key = extractKeyFromUrl(mediaUrl);
  if (!key) {
    logger.warn('Could not extract key from media URL', { mediaUrl });
    return mediaUrl; // Return original URL if extraction fails
  }
  
  try {
    // Generate a fresh presigned URL with 7 days expiration (604800 seconds)
    // This gives plenty of time for users to access media
    const freshUrl = await r2Service.getSignedUrl(key, 604800);
    return freshUrl;
  } catch (error) {
    logger.error('Failed to refresh media URL', { error, key, originalUrl: mediaUrl });
    return mediaUrl; // Return original URL if refresh fails
  }
}

class MessageService {
  /**
   * Send a message
   */
  async sendMessage(params: CreateMessageParams): Promise<MessageWithRelations> {
    const { chatId, senderId, content, contentType = 'text', repliedToId } = params;

    // Verify user is participant and get chat details
    const chat = await chatService.getChatById(chatId, senderId);

    // Check message permissions for group chats
    if (chat.is_group_chat) {
      const isAdmin = chat.group_admin === senderId;
      const isCreator = chat.created_by === senderId;
      
      // Admin and creator can always send messages
      if (!isAdmin && !isCreator && chat.message_permission_mode === 'restricted') {
        const allowedSenderIds = chat.allowed_sender_ids || [];
        if (!allowedSenderIds.includes(senderId)) {
          throw ApiError.forbidden('You do not have permission to send messages in this group');
        }
      }
    }

    // Verify replied_to message exists and is in same chat
    if (repliedToId) {
      const repliedToResult = await query<MessageRow>(
        `SELECT * FROM messages WHERE id = $1 AND chat_id = $2`,
        [repliedToId, chatId]
      );

      if (repliedToResult.rows.length === 0) {
        throw ApiError.notFound('Replied message not found in this chat');
      }
    }

    let messageId: string | undefined;
    
    await transaction(async (client) => {
      // Create message
      // Explicitly set created_at to ensure correct timestamp (using NOW() for timezone-aware timestamp)
      const messageResult = await client.query<MessageRow>(
        `INSERT INTO messages (
          chat_id, sender_id, content, content_type,
          media_url, media_thumbnail, media_size, media_duration,
          replied_to_id, is_view_once, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        RETURNING *`,
        [
          chatId,
          senderId,
          content || null,
          contentType,
          params.mediaUrl || null,
          params.mediaThumbnail || null,
          params.mediaSize || null,
          params.mediaDuration || null,
          repliedToId || null,
          params.isViewOnce || false,
        ]
      );

      const message = messageResult.rows[0];
      messageId = message.id;

      // Update chat's latest message
      await client.query(
        `UPDATE chats
         SET latest_message_id = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [message.id, chatId]
      );

      // Increment unread count for other participants
      await chatService.incrementUnreadCount(chatId, senderId);
    });

    // Emit unread count updates to connected participants (async, non-blocking)
    const chatForNotify = await chatService.getChatById(chatId, senderId);
    if (chatForNotify.participants) {
      // Only query unread counts for connected users (skip offline ones)
      const connectedRecipients = chatForNotify.participants
        .filter(p => p.user_id !== senderId && socketService.isUserConnected(p.user_id))
        .map(p => p.user_id);

      if (connectedRecipients.length > 0) {
        // Single batched query instead of N sequential queries
        chatService.getBatchUnreadCounts(connectedRecipients).then(counts => {
          for (const userId of connectedRecipients) {
            socketService.emitToUser(userId, 'unreadCountUpdate', {
              totalUnread: counts.get(userId) ?? 0,
              chatId,
            });
          }
        }).catch(err => {
          logger.error('[MessageService] Failed to broadcast unread counts', { error: (err as Error).message });
        });
      }
    }

    // Invalidate cache (outside transaction)
    chatCacheService.invalidateMessages(chatId);
    chatCacheService.invalidateChatDetail([chatId]);
    // Refetch chat to get updated data (chat variable from above is already in scope but we refresh after cache invalidation)
    const updatedChat = await chatService.getChatById(chatId, senderId);
    const participantIds = updatedChat.participants?.map((p) => p.user_id) || [];
    chatCacheService.invalidateChatList(participantIds);

    // Get full message with relations (outside transaction so it can see committed data)
    if (!messageId) {
      throw ApiError.internal('Failed to create message');
    }
    return await this.getMessageById(messageId, senderId);
  }

  /**
   * Get message by ID with relations
   */
  async getMessageById(messageId: string, userId: string): Promise<MessageWithRelations> {
    return await chatCacheService.getOrSetMessage(
      messageId,
      async () => {
        // Get message
        const messageResult = await query<MessageRow>(
          `SELECT * FROM messages WHERE id = $1`,
          [messageId]
        );

        if (messageResult.rows.length === 0) {
          throw ApiError.notFound('Message not found');
        }

        const message = messageResult.rows[0];

        // Verify user is participant of chat
        await chatService.getChatById(message.chat_id, userId);

        // Get sender info
        const senderResult = await query<{
          id: string;
          first_name: string;
          last_name: string;
          email: string;
          avatar: string | null;
          role: string;
        }>(
          `SELECT u.id, u.first_name, u.last_name, u.email, u.avatar, r.slug AS role
           FROM users u
           LEFT JOIN roles r ON r.id = u.role_id
           WHERE u.id = $1`,
          [message.sender_id]
        );

        const sender = senderResult.rows[0];

        // Get replied_to message if exists
        let repliedTo: MessageWithRelations | null = null;
        if (message.replied_to_id) {
          const repliedToResult = await query<MessageRow>(
            `SELECT * FROM messages WHERE id = $1`,
            [message.replied_to_id]
          );

          if (repliedToResult.rows.length > 0) {
            const repliedToSender = await query<{
              id: string;
              first_name: string;
              last_name: string;
              avatar: string | null;
            }>(
              `SELECT id, first_name, last_name, avatar
               FROM users WHERE id = $1`,
              [repliedToResult.rows[0].sender_id]
            );

            repliedTo = {
              ...repliedToResult.rows[0],
              sender: repliedToSender.rows[0],
            } as MessageWithRelations;
          }
        }

        // Get forwarded_from message if exists
        let forwardedFrom: MessageWithRelations | null = null;
        if (message.forwarded_from_id) {
          const forwardedFromResult = await query<MessageRow>(
            `SELECT * FROM messages WHERE id = $1`,
            [message.forwarded_from_id]
          );

          if (forwardedFromResult.rows.length > 0) {
            const forwardedFromSender = await query<{
              id: string;
              first_name: string;
              last_name: string;
              avatar: string | null;
            }>(
              `SELECT id, first_name, last_name, avatar
               FROM users WHERE id = $1`,
              [forwardedFromResult.rows[0].sender_id]
            );

            forwardedFrom = {
              ...forwardedFromResult.rows[0],
              sender: forwardedFromSender.rows[0],
            } as MessageWithRelations;
          }
        }

        // Get reactions
        const reactionsResult = await query<{
          emoji: string;
          user_id: string;
        }>(
          `SELECT emoji, user_id FROM message_reactions WHERE message_id = $1`,
          [messageId]
        );

        const reactionsMap = new Map<string, string[]>();
        for (const reaction of reactionsResult.rows) {
          if (!reactionsMap.has(reaction.emoji)) {
            reactionsMap.set(reaction.emoji, []);
          }
          reactionsMap.get(reaction.emoji)!.push(reaction.user_id);
        }

        const reactions = Array.from(reactionsMap.entries()).map(([emoji, user_ids]) => ({
          emoji,
          user_ids,
          count: user_ids.length,
        }));

        // Check if starred by user
        const starredResult = await query<{ id: string }>(
          `SELECT id FROM starred_messages
           WHERE message_id = $1 AND user_id = $2`,
          [messageId, userId]
        );

        const isStarred = starredResult.rows.length > 0;

        // Get read_by users
        const readByResult = await query<{ user_id: string }>(
          `SELECT user_id FROM message_reads WHERE message_id = $1`,
          [messageId]
        );

        const readBy = readByResult.rows.map((r) => r.user_id);

        // Refresh expired media URLs
        const refreshedMediaUrl = await refreshMediaUrl(message.media_url);
        const refreshedMediaThumbnail = await refreshMediaUrl(message.media_thumbnail);
        
        // Refresh media URLs in replied_to message if exists
        if (repliedTo) {
          repliedTo.media_url = await refreshMediaUrl(repliedTo.media_url || null);
          repliedTo.media_thumbnail = await refreshMediaUrl(repliedTo.media_thumbnail || null);
        }
        
        // Refresh media URLs in forwarded_from message if exists
        if (forwardedFrom) {
          forwardedFrom.media_url = await refreshMediaUrl(forwardedFrom.media_url || null);
          forwardedFrom.media_thumbnail = await refreshMediaUrl(forwardedFrom.media_thumbnail || null);
        }

        return {
          ...message,
          media_url: refreshedMediaUrl,
          media_thumbnail: refreshedMediaThumbnail,
          sender,
          replied_to: repliedTo,
          forwarded_from: forwardedFrom,
          reactions,
          is_starred: isStarred,
          read_by: readBy,
        };
      },
      undefined // Use default TTL
    );
  }

  /**
   * Get messages for a chat (paginated)
   */
  async getChatMessages(
    chatId: string,
    userId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<MessageWithRelations[]> {
    // Verify user is participant
    await chatService.getChatById(chatId, userId);

    return await chatCacheService.getOrSetMessages(
      chatId,
      page,
      limit,
      async () => {
        const offset = (page - 1) * limit;

        // 1. Fetch messages with sender info in a single JOIN query
        const messagesResult = await query<MessageRow & {
          sender_first_name: string;
          sender_last_name: string;
          sender_email: string;
          sender_avatar: string | null;
          sender_role: string;
        }>(
          `SELECT m.*,
                  u.first_name AS sender_first_name,
                  u.last_name AS sender_last_name,
                  u.email AS sender_email,
                  u.avatar AS sender_avatar,
                  COALESCE(r.slug, 'user') AS sender_role
           FROM messages m
           LEFT JOIN users u ON u.id = m.sender_id
           LEFT JOIN roles r ON r.id = u.role_id
           WHERE m.chat_id = $1
           ORDER BY m.created_at DESC
           LIMIT $2 OFFSET $3`,
          [chatId, limit, offset]
        );

        if (messagesResult.rows.length === 0) {
          return [];
        }

        const messageIds = messagesResult.rows.map(m => m.id);

        // 2. Batch fetch all reactions for these messages
        const reactionsResult = await query<{
          message_id: string;
          emoji: string;
          user_id: string;
        }>(
          `SELECT message_id, emoji, user_id
           FROM message_reactions
           WHERE message_id = ANY($1)`,
          [messageIds]
        );

        // Group reactions by message_id
        const reactionsByMessage = new Map<string, Map<string, string[]>>();
        for (const row of reactionsResult.rows) {
          if (!reactionsByMessage.has(row.message_id)) {
            reactionsByMessage.set(row.message_id, new Map());
          }
          const emojiMap = reactionsByMessage.get(row.message_id)!;
          if (!emojiMap.has(row.emoji)) {
            emojiMap.set(row.emoji, []);
          }
          emojiMap.get(row.emoji)!.push(row.user_id);
        }

        // 3. Batch fetch starred status
        const starredResult = await query<{ message_id: string }>(
          `SELECT message_id
           FROM starred_messages
           WHERE message_id = ANY($1) AND user_id = $2`,
          [messageIds, userId]
        );
        const starredSet = new Set(starredResult.rows.map(r => r.message_id));

        // 4. Batch fetch read_by
        const readByResult = await query<{ message_id: string; user_id: string }>(
          `SELECT message_id, user_id
           FROM message_reads
           WHERE message_id = ANY($1)`,
          [messageIds]
        );
        const readByMap = new Map<string, string[]>();
        for (const row of readByResult.rows) {
          if (!readByMap.has(row.message_id)) {
            readByMap.set(row.message_id, []);
          }
          readByMap.get(row.message_id)!.push(row.user_id);
        }

        // 5. Collect IDs for replied_to and forwarded_from messages
        const repliedToIds = messagesResult.rows
          .filter(m => m.replied_to_id)
          .map(m => m.replied_to_id!);
        const forwardedFromIds = messagesResult.rows
          .filter(m => m.forwarded_from_id)
          .map(m => m.forwarded_from_id!);
        const relatedIds = [...new Set([...repliedToIds, ...forwardedFromIds])];

        // 6. Batch fetch related messages (replied_to / forwarded_from) with sender info
        const relatedMessagesMap = new Map<string, MessageWithRelations>();
        if (relatedIds.length > 0) {
          const relatedResult = await query<MessageRow & {
            sender_first_name: string;
            sender_last_name: string;
            sender_avatar: string | null;
          }>(
            `SELECT m.*,
                    u.first_name AS sender_first_name,
                    u.last_name AS sender_last_name,
                    u.avatar AS sender_avatar
             FROM messages m
             LEFT JOIN users u ON u.id = m.sender_id
             WHERE m.id = ANY($1)`,
            [relatedIds]
          );

          for (const row of relatedResult.rows) {
            const refreshedUrl = await refreshMediaUrl(row.media_url);
            const refreshedThumb = await refreshMediaUrl(row.media_thumbnail);
            relatedMessagesMap.set(row.id, {
              ...row,
              media_url: refreshedUrl,
              media_thumbnail: refreshedThumb,
              sender: {
                id: row.sender_id,
                first_name: row.sender_first_name,
                last_name: row.sender_last_name,
                email: '',
                avatar: row.sender_avatar,
                role: 'user',
              },
            } as MessageWithRelations);
          }
        }

        // 7. Assemble messages with all relations
        const messages: MessageWithRelations[] = [];
        for (const row of messagesResult.rows) {
          const refreshedMediaUrl = await refreshMediaUrl(row.media_url);
          const refreshedMediaThumbnail = await refreshMediaUrl(row.media_thumbnail);

          // Build reactions array
          const emojiMap = reactionsByMessage.get(row.id);
          const reactions = emojiMap
            ? Array.from(emojiMap.entries()).map(([emoji, user_ids]) => ({
                emoji,
                user_ids,
                count: user_ids.length,
              }))
            : [];

          messages.push({
            ...row,
            media_url: refreshedMediaUrl,
            media_thumbnail: refreshedMediaThumbnail,
            sender: {
              id: row.sender_id,
              first_name: row.sender_first_name,
              last_name: row.sender_last_name,
              email: row.sender_email,
              avatar: row.sender_avatar,
              role: row.sender_role,
            },
            replied_to: row.replied_to_id
              ? relatedMessagesMap.get(row.replied_to_id) || null
              : null,
            forwarded_from: row.forwarded_from_id
              ? relatedMessagesMap.get(row.forwarded_from_id) || null
              : null,
            reactions,
            is_starred: starredSet.has(row.id),
            read_by: readByMap.get(row.id) || [],
          });
        }

        // Reverse to get chronological order (query was DESC)
        return messages.reverse();
      },
      undefined // Use default TTL
    );
  }

  /**
   * Edit message
   */
  async editMessage(
    messageId: string,
    userId: string,
    userRole: string,
    newContent: string
  ): Promise<MessageWithRelations> {
    // Get message
    const messageResult = await query<MessageRow>(
      `SELECT * FROM messages WHERE id = $1`,
      [messageId]
    );

    if (messageResult.rows.length === 0) {
      throw ApiError.notFound('Message not found');
    }

    const message = messageResult.rows[0];

    // Check permissions (admin or sender)
    const isAdmin = userRole === 'admin';
    const isSender = message.sender_id === userId;

    if (!isAdmin && !isSender) {
      throw ApiError.forbidden('You do not have permission to edit this message');
    }

    // Update message
    await query(
      `UPDATE messages
       SET content = $1, is_edited = true, edited_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [newContent.trim(), messageId]
    );

    // Invalidate cache
    chatCacheService.invalidateMessage([messageId]);
    chatCacheService.invalidateMessages(message.chat_id);
    chatCacheService.invalidateChatDetail([message.chat_id]);

    return await this.getMessageById(messageId, userId);
  }

  /**
   * Delete message (soft delete)
   */
  async deleteMessage(
    messageId: string,
    userId: string,
    userRole: string
  ): Promise<MessageWithRelations> {
    // Get message
    const messageResult = await query<MessageRow>(
      `SELECT * FROM messages WHERE id = $1`,
      [messageId]
    );

    if (messageResult.rows.length === 0) {
      throw ApiError.notFound('Message not found');
    }

    const message = messageResult.rows[0];

    // Check permissions (admin or sender)
    const isAdmin = userRole === 'admin';
    const isSender = message.sender_id === userId;

    if (!isAdmin && !isSender) {
      throw ApiError.forbidden('You do not have permission to delete this message');
    }

    return await transaction(async (client) => {
      // Soft delete message
      await client.query(
        `UPDATE messages
         SET content = 'This message was deleted',
             content_type = 'deleted',
             is_deleted = true,
             deleted_at = CURRENT_TIMESTAMP,
             deleted_by = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [userId, messageId]
      );

      // Update chat's latest message if this was the latest
      const chatResult = await client.query<{ latest_message_id: string | null }>(
        `SELECT latest_message_id FROM chats WHERE id = $1`,
        [message.chat_id]
      );

      if (chatResult.rows[0].latest_message_id === messageId) {
        // Find most recent non-deleted message
        const latestMsgResult = await client.query<MessageRow>(
          `SELECT * FROM messages
           WHERE chat_id = $1 AND is_deleted = false
           ORDER BY created_at DESC
           LIMIT 1`,
          [message.chat_id]
        );

        const newLatestMessageId = latestMsgResult.rows.length > 0
          ? latestMsgResult.rows[0].id
          : null;

        await client.query(
          `UPDATE chats
           SET latest_message_id = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [newLatestMessageId, message.chat_id]
        );
      }

      // Invalidate cache
      chatCacheService.invalidateMessage([messageId]);
      chatCacheService.invalidateMessages(message.chat_id);
      chatCacheService.invalidateChatDetail([message.chat_id]);

      return await this.getMessageById(messageId, userId);
    });
  }

  /**
   * Add or remove reaction to message
   */
  async toggleReaction(
    messageId: string,
    userId: string,
    emoji: string
  ): Promise<MessageWithRelations> {
    // Verify message exists
    const messageResult = await query<MessageRow>(
      `SELECT * FROM messages WHERE id = $1`,
      [messageId]
    );

    if (messageResult.rows.length === 0) {
      throw ApiError.notFound('Message not found');
    }

    const message = messageResult.rows[0];

    // Verify user is participant
    await chatService.getChatById(message.chat_id, userId);

    // Check if reaction exists
    const existingReaction = await query<{ id: string }>(
      `SELECT id FROM message_reactions
       WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
      [messageId, userId, emoji]
    );

    if (existingReaction.rows.length > 0) {
      // Remove reaction
      await query(
        `DELETE FROM message_reactions
         WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
        [messageId, userId, emoji]
      );
    } else {
      // Add reaction
      await query(
        `INSERT INTO message_reactions (message_id, user_id, emoji)
         VALUES ($1, $2, $3)
         ON CONFLICT (message_id, user_id, emoji) DO NOTHING`,
        [messageId, userId, emoji]
      );
    }

    // Invalidate cache
    chatCacheService.invalidateMessage([messageId]);
    chatCacheService.invalidateMessages(message.chat_id);

    return await this.getMessageById(messageId, userId);
  }

  /**
   * Pin or unpin message
   */
  async togglePinMessage(
    messageId: string,
    userId: string
  ): Promise<MessageWithRelations> {
    // Get message
    const messageResult = await query<MessageRow>(
      `SELECT * FROM messages WHERE id = $1`,
      [messageId]
    );

    if (messageResult.rows.length === 0) {
      throw ApiError.notFound('Message not found');
    }

    const message = messageResult.rows[0];

    // Verify user is participant
    await chatService.getChatById(message.chat_id, userId);

    const isPinned = !message.is_pinned;

    // Update pin status
    await query(
      `UPDATE messages
       SET is_pinned = $1,
           pinned_at = $2,
           pinned_by = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [
        isPinned,
        isPinned ? new Date() : null,
        isPinned ? userId : null,
        messageId,
      ]
    );

    // Invalidate cache
    chatCacheService.invalidateMessage([messageId]);
    chatCacheService.invalidateMessages(message.chat_id);

    return await this.getMessageById(messageId, userId);
  }

  /**
   * Star or unstar message
   */
  async toggleStarMessage(
    messageId: string,
    userId: string
  ): Promise<MessageWithRelations> {
    // Get message
    const messageResult = await query<MessageRow>(
      `SELECT * FROM messages WHERE id = $1`,
      [messageId]
    );

    if (messageResult.rows.length === 0) {
      throw ApiError.notFound('Message not found');
    }

    const message = messageResult.rows[0];

    // Verify user is participant
    await chatService.getChatById(message.chat_id, userId);

    // Check if already starred
    const starredResult = await query<{ id: string }>(
      `SELECT id FROM starred_messages
       WHERE message_id = $1 AND user_id = $2`,
      [messageId, userId]
    );

    if (starredResult.rows.length > 0) {
      // Unstar
      await query(
        `DELETE FROM starred_messages
         WHERE message_id = $1 AND user_id = $2`,
        [messageId, userId]
      );
    } else {
      // Star
      await query(
        `INSERT INTO starred_messages (message_id, user_id)
         VALUES ($1, $2)
         ON CONFLICT (message_id, user_id) DO NOTHING`,
        [messageId, userId]
      );
    }

    // Invalidate cache
    chatCacheService.invalidateMessage([messageId]);

    return await this.getMessageById(messageId, userId);
  }

  /**
   * Forward message to multiple chats
   */
  async forwardMessage(params: ForwardMessageParams): Promise<MessageWithRelations[]> {
    const { messageId, senderId, chatIds } = params;

    if (!chatIds || chatIds.length === 0) {
      throw ApiError.badRequest('At least one chat ID is required');
    }

    // Get original message
    const originalMessage = await this.getMessageById(messageId, senderId);

    // Verify sender is participant of all target chats
    for (const chatId of chatIds) {
      await chatService.getChatById(chatId, senderId);
    }

    const forwardedMessages: MessageWithRelations[] = [];

    for (const chatId of chatIds) {
      // Create forwarded message
      const forwardedMessage = await this.sendMessage({
        chatId,
        senderId,
        content: originalMessage.content || '',
        contentType: originalMessage.content_type,
        mediaUrl: originalMessage.media_url || undefined,
        mediaThumbnail: originalMessage.media_thumbnail || undefined,
        mediaSize: originalMessage.media_size || undefined,
        mediaDuration: originalMessage.media_duration || undefined,
      });

      // Update forwarded_from and forwarded_by
      await query(
        `UPDATE messages
         SET forwarded_from_id = $1, forwarded_by = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [messageId, senderId, forwardedMessage.id]
      );

      // Get updated message
      const updatedMessage = await this.getMessageById(forwardedMessage.id, senderId);
      forwardedMessages.push(updatedMessage);
    }

    return forwardedMessages;
  }

  /**
   * Mark message as read
   */
  async markMessageAsRead(messageId: string, userId: string): Promise<void> {
    // Get message
    const messageResult = await query<MessageRow>(
      `SELECT * FROM messages WHERE id = $1`,
      [messageId]
    );

    if (messageResult.rows.length === 0) {
      throw ApiError.notFound('Message not found');
    }

    const message = messageResult.rows[0];

    // Verify user is participant
    await chatService.getChatById(message.chat_id, userId);

    // Insert or update read receipt
    await query(
      `INSERT INTO message_reads (message_id, user_id, read_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (message_id, user_id)
       DO UPDATE SET read_at = CURRENT_TIMESTAMP`,
      [messageId, userId]
    );

    // Invalidate cache
    chatCacheService.invalidateMessage([messageId]);
  }

  /**
   * Mark all messages in chat as read
   */
  async markChatAsRead(chatId: string, userId: string): Promise<void> {
    // Verify user is participant
    await chatService.getChatById(chatId, userId);

    // Mark all unread messages as read
    await query(
      `INSERT INTO message_reads (message_id, user_id, read_at)
       SELECT id, $1, CURRENT_TIMESTAMP
       FROM messages
       WHERE chat_id = $2
         AND sender_id != $1
         AND is_deleted = false
         AND id NOT IN (
           SELECT message_id FROM message_reads WHERE user_id = $1
         )
       ON CONFLICT (message_id, user_id) DO NOTHING`,
      [userId, chatId]
    );

    // Reset unread count
    await chatService.resetUnreadCount(chatId, userId);

    // Emit updated unread count to the user
    const newUnreadCount = await chatService.getTotalUnreadCount(userId);
    socketService.emitToUser(userId, 'unreadCountUpdate', {
      totalUnread: newUnreadCount,
      chatId,
    });

    // Invalidate cache
    chatCacheService.invalidateMessages(chatId);
    chatCacheService.invalidateUnreadCount(userId, chatId);
  }

  /**
   * Upload media file for message
   */
  async uploadMedia(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    userId: string,
    contentType: 'image' | 'video' | 'audio' | 'document'
  ): Promise<{
    mediaUrl: string;
    mediaThumbnail?: string;
    mediaSize: number;
  }> {
    // Determine file type for R2
    const r2FileType = contentType === 'image' ? 'image' :
                      contentType === 'video' ? 'video' :
                      contentType === 'audio' ? 'audio' : 'file';

    // Upload to R2
    const uploadResult = await r2Service.upload(
      buffer,
      originalName,
      mimeType,
      {
        fileType: r2FileType,
        userId,
        isPublic: true, // Media files should be publicly accessible
      }
    );

    return {
      // IMPORTANT: Use publicUrl for mediaUrl to avoid URL expiration
      // Presigned URLs expire, publicUrl is the permanent Cloudflare URL
      // Since isPublic: true is set above, publicUrl should always be available
      mediaUrl: uploadResult.publicUrl || uploadResult.url,
      mediaThumbnail: uploadResult.publicUrl,
      mediaSize: uploadResult.size,
    };
  }

  /**
   * Open a view-once message (one-time media access)
   * Returns the media URL for single-time viewing, then marks it as opened.
   */
  async openViewOnceMessage(messageId: string, userId: string): Promise<{
    mediaUrl: string;
    mediaThumbnail?: string;
    chatId: string;
  }> {
    const result = await query<MessageRow>(
      `SELECT * FROM messages WHERE id = $1`,
      [messageId]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Message not found');
    }

    const message = result.rows[0];

    if (!message.is_view_once) {
      throw ApiError.badRequest('This message is not a view-once message');
    }

    // Sender can't "open" their own view-once message
    if (message.sender_id === userId) {
      throw ApiError.forbidden('Cannot open your own view-once message');
    }

    // Verify user is a participant of the chat
    await chatService.getChatById(message.chat_id, userId);

    // Already opened
    if (message.view_once_opened_at) {
      throw ApiError.badRequest('This view-once message has already been opened');
    }

    // Mark as opened
    await query(
      `UPDATE messages SET view_once_opened_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [messageId]
    );

    // Invalidate cache
    chatCacheService.invalidateMessages(message.chat_id);

    return {
      mediaUrl: message.media_url!,
      mediaThumbnail: message.media_thumbnail || undefined,
      chatId: message.chat_id,
    };
  }
}

export const messageService = new MessageService();
export default messageService;

