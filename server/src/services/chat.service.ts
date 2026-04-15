/**
 * @file Chat Service
 * @description Handles chat CRUD operations, participant management, and community group handling
 */

import { query, transaction } from '../database/pg.js';
import type { PoolClient } from 'pg';
import { logger } from './logger.service.js';
import { chatCacheService } from './chat-cache.service.js';
import { ApiError } from '../utils/ApiError.js';
import { socketService } from './socket.service.js';
import { messageService } from './message.service.js';

// ============================================
// TYPES
// ============================================

export interface ChatRow {
  id: string;
  chat_name: string;
  is_group_chat: boolean;
  is_community: boolean;
  avatar: string | null;
  group_admin: string | null;
  latest_message_id: string | null;
  join_code: string | null;
  join_code_expires_at: Date | null;
  created_by: string | null;
  message_permission_mode: string;
  allowed_sender_ids: string[];
  created_at: Date;
  updated_at: Date;
}

export interface ChatParticipantRow {
  id: string;
  chat_id: string;
  user_id: string;
  joined_at: Date;
  left_at: Date | null;
  is_blocked: boolean;
  unread_count: number;
  last_read_at: Date | null;
}

export interface ChatWithParticipants extends ChatRow {
  participants: Array<{
    id: string;
    user_id: string;
    joined_at: Date;
    left_at: Date | null;
    is_blocked: boolean;
    unread_count: number;
    last_read_at: Date | null;
    user?: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      avatar: string | null;
      role: string;
    };
  }>;
  latest_message?: {
    id: string;
    content: string;
    content_type: string;
    sender_id: string;
    created_at: Date;
    sender?: {
      id: string;
      first_name: string;
      last_name: string;
      avatar: string | null;
    };
  };
}

interface CreateChatParams {
  userId: string;
  otherUserId?: string; // For one-on-one chat
  chatName?: string; // For group chat
  isGroupChat: boolean;
  avatar?: string;
  userIds?: string[]; // For group chat participants
}

interface UpdateGroupChatParams {
  chatId: string;
  chatName?: string;
  avatar?: string;
  userIds?: string[];
}

// ============================================
// CHAT SERVICE
// ============================================

class ChatService {
  /**
   * Create a one-on-one chat or check if it already exists
   */
  async createOrGetChat(params: CreateChatParams): Promise<ChatWithParticipants> {
    const { userId, otherUserId, isGroupChat } = params;

    if (!isGroupChat && !otherUserId) {
      throw ApiError.badRequest('Other user ID is required for one-on-one chat');
    }

    if (isGroupChat && !params.chatName) {
      throw ApiError.badRequest('Chat name is required for group chat');
    }

    // Check if one-on-one chat already exists
    if (!isGroupChat && otherUserId) {
      const existingChat = await this.findOneOnOneChat(userId, otherUserId);
      if (existingChat) {
        return existingChat;
      }
    }

    // Create new chat
    return await transaction(async (client) => {
      // Create chat
      const chatResult = await client.query<ChatRow>(
        `INSERT INTO chats (chat_name, is_group_chat, is_community, avatar, group_admin)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          params.chatName || 'sender',
          isGroupChat,
          false, // is_community
          params.avatar || null,
          isGroupChat ? userId : null, // group_admin
        ]
      );

      const chat = chatResult.rows[0];

      // Add participants
      const participantIds = isGroupChat
        ? (params.userIds || []).concat(userId)
        : [userId, otherUserId!];

      for (const participantId of participantIds) {
        await client.query(
          `INSERT INTO chat_participants (chat_id, user_id)
           VALUES ($1, $2)
           ON CONFLICT (chat_id, user_id) DO NOTHING`,
          [chat.id, participantId]
        );
      }

      // Invalidate cache
      chatCacheService.invalidateChatList(participantIds);

      return await this.getChatById(chat.id, userId);
    });
  }

  /**
   * Find existing one-on-one chat between two users
   */
  async findOneOnOneChat(userId1: string, userId2: string): Promise<ChatWithParticipants | null> {
    const result = await query<ChatRow>(
      `SELECT c.* FROM chats c
       INNER JOIN chat_participants cp1 ON c.id = cp1.chat_id
       INNER JOIN chat_participants cp2 ON c.id = cp2.chat_id
       WHERE c.is_group_chat = false
         AND cp1.user_id = $1
         AND cp2.user_id = $2
         AND cp1.left_at IS NULL
         AND cp2.left_at IS NULL
       LIMIT 1`,
      [userId1, userId2]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return await this.getChatById(result.rows[0].id, userId1);
  }

  /**
   * Get chat by ID with participants
   */
  async getChatById(chatId: string, userId: string): Promise<ChatWithParticipants> {
    return await chatCacheService.getOrSetChatDetail(
      chatId,
      async () => {
        // Verify user is participant
        const participantCheck = await query<ChatParticipantRow>(
          `SELECT * FROM chat_participants
           WHERE chat_id = $1 AND user_id = $2 AND left_at IS NULL`,
          [chatId, userId]
        );

        if (participantCheck.rows.length === 0) {
          throw ApiError.forbidden('You are not a participant of this chat');
        }

        // Get chat
        const chatResult = await query<ChatRow>(
          `SELECT * FROM chats WHERE id = $1`,
          [chatId]
        );

        if (chatResult.rows.length === 0) {
          throw ApiError.notFound('Chat not found');
        }

        const chat = chatResult.rows[0];

        // Get participants with user info
        const participantsResult = await query<ChatParticipantRow & { user: any }>(
          `SELECT cp.*,
                  json_build_object(
                    'id', u.id,
                    'first_name', u.first_name,
                    'last_name', u.last_name,
                    'email', u.email,
                    'avatar', u.avatar,
                    'role', r.slug
                  ) as user
           FROM chat_participants cp
           INNER JOIN users u ON cp.user_id = u.id
           LEFT JOIN roles r ON u.role_id = r.id
           WHERE cp.chat_id = $1 AND cp.left_at IS NULL
           ORDER BY cp.joined_at ASC`,
          [chatId]
        );

        // Get latest message if exists
        let latestMessage = null;
        if (chat.latest_message_id) {
          const messageResult = await query<{
            id: string;
            content: string;
            content_type: string;
            sender_id: string;
            created_at: Date;
            sender: any;
          }>(
            `SELECT m.id, m.content, m.content_type, m.sender_id, m.created_at,
                    json_build_object(
                      'id', u.id,
                      'first_name', u.first_name,
                      'last_name', u.last_name,
                      'avatar', u.avatar
                    ) as sender
             FROM messages m
             INNER JOIN users u ON m.sender_id = u.id
             WHERE m.id = $1`,
            [chat.latest_message_id]
          );

          if (messageResult.rows.length > 0) {
            latestMessage = messageResult.rows[0];
          }
        }

        return {
          ...chat,
          participants: participantsResult.rows.map((row) => ({
            id: row.id,
            user_id: row.user_id,
            joined_at: row.joined_at,
            left_at: row.left_at,
            is_blocked: row.is_blocked,
            unread_count: row.unread_count,
            last_read_at: row.last_read_at,
            user: row.user,
          })),
          latest_message: latestMessage || undefined,
        };
      },
      undefined // Use default TTL
    );
  }

  /**
   * Get user's chats (with pagination)
   */
  async getUserChats(
    userId: string,
    isAdmin: boolean = false,
    page: number = 1,
    limit: number = 50
  ): Promise<ChatWithParticipants[]> {
    return await chatCacheService.getOrSetChatList(
      userId,
      isAdmin,
      async () => {
        const offset = (page - 1) * limit;

        const queryText = isAdmin
          ? `SELECT DISTINCT c.*
             FROM chats c
             INNER JOIN chat_participants cp ON c.id = cp.chat_id
             WHERE cp.left_at IS NULL
             ORDER BY c.updated_at DESC
             LIMIT $1 OFFSET $2`
          : `SELECT DISTINCT c.*
             FROM chats c
             INNER JOIN chat_participants cp ON c.id = cp.chat_id
             WHERE cp.user_id = $1 AND cp.left_at IS NULL
             ORDER BY c.updated_at DESC
             LIMIT $2 OFFSET $3`;

        const params = isAdmin ? [limit, offset] : [userId, limit, offset];
        const result = await query<ChatRow>(queryText, params);

        // Get full chat details with participants
        const chats: ChatWithParticipants[] = [];
        for (const chat of result.rows) {
          try {
            const fullChat = await this.getChatById(chat.id, userId);
            chats.push(fullChat);
          } catch (error) {
            logger.warn('Failed to load chat details', { chatId: chat.id, error });
          }
        }

        return chats;
      },
      undefined // Use default TTL
    );
  }

  /**
   * Create group chat
   */
  async createGroupChat(params: CreateChatParams): Promise<ChatWithParticipants> {
    const { userId, chatName, userIds, avatar } = params;

    if (!chatName) {
      throw ApiError.badRequest('Chat name is required');
    }

    // Allow creating group with 0 users - users can join by code later
    // If userIds is not provided or empty, creator will be the only member initially

    // Check if group with same name exists
    const existingResult = await query<ChatRow>(
      `SELECT * FROM chats WHERE chat_name = $1 AND is_group_chat = true`,
      [chatName]
    );

    if (existingResult.rows.length > 0) {
      throw ApiError.conflict(`Group with name "${chatName}" already exists`);
    }

    const chatId = await transaction(async (client) => {
      // Generate unique 6-digit join code
      const joinCode = await this.generateJoinCode(client);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours from now

      // Create group chat
      const chatResult = await client.query<ChatRow>(
        `INSERT INTO chats (chat_name, is_group_chat, is_community, avatar, group_admin, created_by, join_code, join_code_expires_at, message_permission_mode)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [chatName, true, false, avatar || null, userId, userId, joinCode, expiresAt, 'all']
      );

      const chat = chatResult.rows[0];

      // Add all participants (including creator)
      // Ensure creator is always included, even if not in userIds array
      const allUserIds = userIds && userIds.length > 0 
        ? [...new Set([...userIds, userId])] // Remove duplicates and ensure creator is included
        : [userId]; // If no users provided, creator is the only participant

      for (const participantId of allUserIds) {
        await client.query(
          `INSERT INTO chat_participants (chat_id, user_id)
           VALUES ($1, $2)
           ON CONFLICT (chat_id, user_id) DO NOTHING`,
          [chat.id, participantId]
        );
      }

      // Invalidate cache (will be effective after transaction commits)
      chatCacheService.invalidateChatList(allUserIds);
      chatCacheService.invalidateChatDetail([chat.id]);

      return chat.id;
    });

    // Get the full chat details after transaction commits
    // This ensures the participant check can see the newly created participant
    return await this.getChatById(chatId, userId);
  }

  /**
   * Update group chat
   */
  async updateGroupChat(params: UpdateGroupChatParams): Promise<ChatWithParticipants> {
    const { chatId, chatName, avatar, userIds } = params;

    // Get existing chat to get current participants
    const existingChat = await query<ChatRow>(
      `SELECT * FROM chats WHERE id = $1`,
      [chatId]
    );

    if (existingChat.rows.length === 0) {
      throw ApiError.notFound('Chat not found');
    }

    const chat = existingChat.rows[0];

    if (!chat.is_group_chat) {
      throw ApiError.badRequest('This is not a group chat');
    }

    return await transaction(async (client) => {
      // Update chat
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (chatName) {
        updateFields.push(`chat_name = $${paramIndex++}`);
        updateValues.push(chatName);
      }

      if (avatar !== undefined) {
        updateFields.push(`avatar = $${paramIndex++}`);
        updateValues.push(avatar);
      }

      if (updateFields.length > 0) {
        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        updateValues.push(chatId);

        await client.query(
          `UPDATE chats SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
          updateValues
        );
      }

      // Update participants if provided
      if (userIds) {
        // Get current participants
        const currentParticipants = await client.query<ChatParticipantRow>(
          `SELECT user_id FROM chat_participants
           WHERE chat_id = $1 AND left_at IS NULL`,
          [chatId]
        );

        const currentUserIds = currentParticipants.rows.map((p) => p.user_id);
        const newUserIds = userIds.filter((id) => !currentUserIds.includes(id));
        const removedUserIds = currentUserIds.filter((id) => !userIds.includes(id));

        // Add new participants
        for (const userId of newUserIds) {
          await client.query(
            `INSERT INTO chat_participants (chat_id, user_id)
             VALUES ($1, $2)
             ON CONFLICT (chat_id, user_id) DO UPDATE
             SET left_at = NULL, joined_at = CURRENT_TIMESTAMP`,
            [chatId, userId]
          );
        }

        // Remove participants (soft delete)
        for (const userId of removedUserIds) {
          await client.query(
            `UPDATE chat_participants
             SET left_at = CURRENT_TIMESTAMP
             WHERE chat_id = $1 AND user_id = $2`,
            [chatId, userId]
          );
        }

        // Invalidate cache for all affected users
        const allUserIds = [...new Set([...currentUserIds, ...userIds])];
        chatCacheService.invalidateChatList(allUserIds);
      }

      chatCacheService.invalidateChatDetail([chatId]);
      chatCacheService.invalidateChatParticipants([chatId]);

      // Get a participant to use for authorization
      const participant = await query<ChatParticipantRow>(
        `SELECT * FROM chat_participants
         WHERE chat_id = $1 AND left_at IS NULL
         LIMIT 1`,
        [chatId]
      );

      if (participant.rows.length > 0) {
        return await this.getChatById(chatId, participant.rows[0].user_id);
      }

      throw ApiError.notFound('Chat not found');
    });
  }

  /**
   * Rename group chat
   */
  async renameGroupChat(chatId: string, chatName: string, userId: string, avatar?: string | null): Promise<ChatWithParticipants> {
    if (!chatName) {
      throw ApiError.badRequest('Chat name is required');
    }

    // Verify user is participant or creator/admin
    // Check if user is participant first
    const participantCheck = await query<ChatParticipantRow>(
      `SELECT * FROM chat_participants
       WHERE chat_id = $1 AND user_id = $2 AND left_at IS NULL`,
      [chatId, userId]
    );

    // If not participant, check if user is creator or admin
    if (participantCheck.rows.length === 0) {
      const chatResult = await query<ChatRow>(
        `SELECT * FROM chats WHERE id = $1`,
        [chatId]
      );

      if (chatResult.rows.length === 0) {
        throw ApiError.notFound('Chat not found');
      }

      const chat = chatResult.rows[0];
      const isCreator = chat.created_by === userId;
      const isAdmin = chat.group_admin === userId;

      if (!isCreator && !isAdmin) {
        throw ApiError.forbidden('You are not a participant of this chat');
      }
    }

    const updateFields: string[] = ['chat_name = $1'];
    const updateValues: (string | null)[] = [chatName];
    let paramIndex = 2;

    if (avatar !== undefined) {
      updateFields.push(`avatar = $${paramIndex++}`);
      updateValues.push(avatar);
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(chatId);

    await query(
      `UPDATE chats
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex}`,
      updateValues
    );

    // Invalidate cache
    chatCacheService.invalidateChatDetail([chatId]);
    const participants = await this.getChatParticipants(chatId);
    chatCacheService.invalidateChatList(participants.map((p) => p.user_id));

    return await this.getChatById(chatId, userId);
  }

  /**
   * Add user to group chat
   */
  async addUserToGroup(chatId: string, userId: string, requesterId: string): Promise<ChatWithParticipants> {
    // Verify requester is participant
    await this.getChatById(chatId, requesterId);

    // Verify chat is a group
    const chatResult = await query<ChatRow>(
      `SELECT * FROM chats WHERE id = $1`,
      [chatId]
    );

    if (chatResult.rows.length === 0) {
      throw ApiError.notFound('Chat not found');
    }

    if (!chatResult.rows[0].is_group_chat) {
      throw ApiError.badRequest('This is not a group chat');
    }

    // Add user to chat
    await query(
      `INSERT INTO chat_participants (chat_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (chat_id, user_id) DO UPDATE
       SET left_at = NULL, joined_at = CURRENT_TIMESTAMP`,
      [chatId, userId]
    );

    // Get user's name for system message
    const userResult = await query<{ first_name: string; last_name: string }>(
      `SELECT first_name, last_name FROM users WHERE id = $1`,
      [userId]
    );

    const userName = userResult.rows[0]
      ? `${userResult.rows[0].first_name} ${userResult.rows[0].last_name}`.trim()
      : 'Someone';

    // Create system message: "salman joined this group"
    try {
      await messageService.sendMessage({
        chatId,
        senderId: userId, // System messages still need a sender_id, but we'll mark them as system
        content: `${userName} joined this group`,
        contentType: 'system',
      });
    } catch (error) {
      // Log error but don't fail the add operation
      logger.error('Failed to create system message for user join', {
        chatId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Invalidate cache
    chatCacheService.invalidateChatList([userId]);
    chatCacheService.invalidateChatDetail([chatId]);
    chatCacheService.invalidateChatParticipants([chatId]);

    // Emit real-time event
    try {
      socketService.emitToChat(chatId, 'userJoinedGroup', {
        chatId,
        userId,
        userName,
        joinedAt: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to emit socket event for user joining group', {
        chatId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return await this.getChatById(chatId, requesterId);
  }

  /**
   * Remove user from group chat
   */
  async removeUserFromGroup(chatId: string, userId: string, requesterId: string): Promise<ChatWithParticipants> {
    // Verify requester is participant (before removal)
    const chat = await this.getChatById(chatId, requesterId);

    // Prevent group admin/creator from leaving - they must delete the group instead
    if (userId === chat.group_admin || userId === chat.created_by) {
      throw ApiError.forbidden('Group admins and creators cannot leave the group. Please delete the group instead.');
    }

    // Verify the user to be removed is actually a participant
    const participantCheck = await query<ChatParticipantRow>(
      `SELECT * FROM chat_participants
       WHERE chat_id = $1 AND user_id = $2 AND left_at IS NULL`,
      [chatId, userId]
    );

    if (participantCheck.rows.length === 0) {
      throw ApiError.badRequest('User is not a participant of this group');
    }

    // Remove user (soft delete)
    await query(
      `UPDATE chat_participants
       SET left_at = CURRENT_TIMESTAMP
       WHERE chat_id = $1 AND user_id = $2`,
      [chatId, userId]
    );

    // Invalidate cache
    chatCacheService.invalidateChatList([userId]);
    chatCacheService.invalidateChatDetail([chatId]);
    chatCacheService.invalidateChatParticipants([chatId]);

    // Get updated chat - if requester is the one leaving, use a different approach
    let updatedChat: ChatWithParticipants;
    if (requesterId === userId) {
      // User is leaving themselves - get chat without participant check
      // We'll get the chat data directly since requester is no longer a participant
      const chatResult = await query<ChatRow>(
        `SELECT * FROM chats WHERE id = $1`,
        [chatId]
      );

      if (chatResult.rows.length === 0) {
        throw ApiError.notFound('Chat not found');
      }

      const chatRow = chatResult.rows[0];
      const participants = await this.getChatParticipants(chatId);

      updatedChat = {
        ...chatRow,
        participants: participants.map((p) => ({
          id: p.id,
          user_id: p.user_id,
          joined_at: p.joined_at,
          left_at: p.left_at,
          is_blocked: p.is_blocked,
          unread_count: p.unread_count,
          last_read_at: p.last_read_at,
        })),
      } as ChatWithParticipants;
    } else {
      // Someone else is removing a user - requester is still a participant
      updatedChat = await this.getChatById(chatId, requesterId);
    }

    // Emit real-time event to all chat participants
    try {
      socketService.emitToChat(chatId, 'userLeftGroup', {
        chatId,
        userId,
        leftAt: new Date().toISOString(),
      });

      // Also notify the user who left (if they're still connected)
      socketService.emitToUser(userId, 'groupLeft', {
        chatId,
        chatName: chat.chat_name,
      });
    } catch (error) {
      logger.error('Failed to emit socket event for user leaving group', {
        chatId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return updatedChat;
  }

  /**
   * Delete chat
   */
  async deleteChat(chatId: string, userId: string): Promise<void> {
    // Verify user is participant
    await this.getChatById(chatId, userId);

    // Get participants before deletion
    const participants = await this.getChatParticipants(chatId);

    // Delete chat (cascade will handle related records)
    await query(`DELETE FROM chats WHERE id = $1`, [chatId]);

    // Invalidate cache
    const participantIds = participants.map((p) => p.user_id);
    chatCacheService.invalidateChatList(participantIds);
    chatCacheService.invalidateChatDetail([chatId]);
    chatCacheService.invalidateMessages(chatId);
  }

  /**
   * Get chat participants
   */
  async getChatParticipants(chatId: string): Promise<ChatParticipantRow[]> {
    const result = await query<ChatParticipantRow>(
      `SELECT * FROM chat_participants
       WHERE chat_id = $1 AND left_at IS NULL
       ORDER BY joined_at ASC`,
      [chatId]
    );

    return result.rows;
  }

  /**
   * Add user to community group (Balencia Community)
   */
  async addUserToCommunityGroup(userId: string): Promise<void> {
    // Find community group
    const communityResult = await query<ChatRow>(
      `SELECT * FROM chats WHERE is_community = true LIMIT 1`,
      []
    );

    if (communityResult.rows.length === 0) {
      logger.warn('Community group not found, skipping user addition', { userId });
      return;
    }

    const communityChat = communityResult.rows[0];

    // Add user to community
    await query(
      `INSERT INTO chat_participants (chat_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (chat_id, user_id) DO UPDATE
       SET left_at = NULL, joined_at = CURRENT_TIMESTAMP`,
      [communityChat.id, userId]
    );

    // Invalidate cache
    chatCacheService.invalidateChatList([userId]);
    chatCacheService.invalidateChatDetail([communityChat.id]);
    chatCacheService.invalidateChatParticipants([communityChat.id]);

    logger.info('User added to community group', { userId, chatId: communityChat.id });
  }

  /**
   * Get community group ID
   */
  async getCommunityGroupId(): Promise<string | null> {
    const result = await query<ChatRow>(
      `SELECT id FROM chats WHERE is_community = true LIMIT 1`,
      []
    );

    return result.rows.length > 0 ? result.rows[0].id : null;
  }

  /**
   * Update chat's latest message
   */
  async updateLatestMessage(chatId: string, messageId: string): Promise<void> {
    await query(
      `UPDATE chats
       SET latest_message_id = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [messageId, chatId]
    );

    // Invalidate cache
    chatCacheService.invalidateChatDetail([chatId]);
  }

  /**
   * Increment unread count for chat participants (except sender)
   */
  async incrementUnreadCount(chatId: string, excludeUserId: string): Promise<void> {
    await query(
      `UPDATE chat_participants
       SET unread_count = unread_count + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE chat_id = $1 AND user_id != $2 AND left_at IS NULL`,
      [chatId, excludeUserId]
    );

    // Invalidate unread count cache
    const participants = await this.getChatParticipants(chatId);
    participants.forEach((p) => {
      if (p.user_id !== excludeUserId) {
        chatCacheService.invalidateUnreadCount(p.user_id, chatId);
      }
    });
  }

  /**
   * Reset unread count for a user in a chat
   */
  async resetUnreadCount(chatId: string, userId: string): Promise<void> {
    await query(
      `UPDATE chat_participants
       SET unread_count = 0,
           last_read_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE chat_id = $1 AND user_id = $2`,
      [chatId, userId]
    );

    chatCacheService.invalidateUnreadCount(userId, chatId);
  }

  /**
   * Get total unread message count across all chats for a user
   */
  async getTotalUnreadCount(userId: string): Promise<number> {
    const result = await query<{ total: string }>(
      `SELECT COALESCE(SUM(unread_count), 0) as total
       FROM chat_participants
       WHERE user_id = $1 AND left_at IS NULL`,
      [userId]
    );

    return parseInt(result.rows[0]?.total || '0', 10);
  }

  /**
   * Get total unread counts for multiple users in a single query
   */
  async getBatchUnreadCounts(userIds: string[]): Promise<Map<string, number>> {
    if (userIds.length === 0) return new Map();

    const placeholders = userIds.map((_, i) => `$${i + 1}`).join(',');
    const result = await query<{ user_id: string; total: string }>(
      `SELECT user_id, COALESCE(SUM(unread_count), 0) as total
       FROM chat_participants
       WHERE user_id IN (${placeholders}) AND left_at IS NULL
       GROUP BY user_id`,
      userIds
    );

    const counts = new Map<string, number>();
    for (const row of result.rows) {
      counts.set(row.user_id, parseInt(row.total || '0', 10));
    }
    // Ensure all requested userIds have an entry (0 if no rows)
    for (const id of userIds) {
      if (!counts.has(id)) counts.set(id, 0);
    }
    return counts;
  }

  /**
   * Generate unique 6-digit join code
   */
  private async generateJoinCode(client?: PoolClient): Promise<string> {
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      // Generate 6-digit code (000000-999999)
      const code = Math.floor(100000 + Math.random() * 900000).toString();

      // Check if code exists
      const result = client
        ? await client.query<{ count: string | number }>(
            `SELECT COUNT(*) as count FROM chats WHERE join_code = $1`,
            [code]
          )
        : await query<{ count: string | number }>(
            `SELECT COUNT(*) as count FROM chats WHERE join_code = $1`,
            [code]
          );

      const count = typeof result.rows[0].count === 'string' 
        ? parseInt(result.rows[0].count, 10) 
        : result.rows[0].count;

      if (count === 0) {
        return code;
      }

      attempts++;
    }

    throw ApiError.internal('Failed to generate unique join code');
  }

  /**
   * Join group by code
   */
  async joinGroupByCode(code: string, userId: string): Promise<ChatWithParticipants> {
    // Validate code format
    if (!/^\d{6}$/.test(code)) {
      throw ApiError.badRequest('Invalid join code format');
    }

    // Find group by code
    const chatResult = await query<ChatRow>(
      `SELECT * FROM chats WHERE join_code = $1 AND is_group_chat = true`,
      [code]
    );

    if (chatResult.rows.length === 0) {
      throw ApiError.notFound('Group not found with this code');
    }

    const chat = chatResult.rows[0];

    // Check if code is expired
    if (chat.join_code_expires_at && new Date(chat.join_code_expires_at) < new Date()) {
      throw ApiError.badRequest('Join code has expired');
    }

    // Check if user is already a participant
    const existingParticipant = await query<ChatParticipantRow>(
      `SELECT * FROM chat_participants 
       WHERE chat_id = $1 AND user_id = $2 AND left_at IS NULL`,
      [chat.id, userId]
    );

    if (existingParticipant.rows.length > 0) {
      // User is already in the group
      return await this.getChatById(chat.id, userId);
    }

    // Add user to group
    await query(
      `INSERT INTO chat_participants (chat_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (chat_id, user_id) 
       DO UPDATE SET left_at = NULL, joined_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP`,
      [chat.id, userId]
    );

    // Get user's name for system message
    const userResult = await query<{ first_name: string; last_name: string }>(
      `SELECT first_name, last_name FROM users WHERE id = $1`,
      [userId]
    );

    const userName = userResult.rows[0]
      ? `${userResult.rows[0].first_name} ${userResult.rows[0].last_name}`.trim()
      : 'Someone';

    // Create system message: "salman joined this group"
    try {
      await messageService.sendMessage({
        chatId: chat.id,
        senderId: userId, // System messages still need a sender_id, but we'll mark them as system
        content: `${userName} joined this group`,
        contentType: 'system',
      });
    } catch (error) {
      // Log error but don't fail the join operation
      logger.error('Failed to create system message for user join', {
        chatId: chat.id,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Invalidate cache
    chatCacheService.invalidateChatList([userId]);
    chatCacheService.invalidateChatDetail([chat.id]);
    chatCacheService.invalidateChatParticipants([chat.id]);

    // Emit real-time event
    try {
      socketService.emitToChat(chat.id, 'userJoinedGroup', {
        chatId: chat.id,
        userId,
        userName,
        joinedAt: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to emit socket event for user joining group', {
        chatId: chat.id,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return await this.getChatById(chat.id, userId);
  }

  /**
   * Regenerate join code (admin/creator only)
   */
  async regenerateJoinCode(chatId: string, userId: string): Promise<string> {
    const chat = await this.getChatById(chatId, userId);

    // Check permissions (admin or creator)
    const isAdmin = chat.group_admin === userId;
    const isCreator = chat.created_by === userId;

    if (!isAdmin && !isCreator) {
      throw ApiError.forbidden('Only admin or creator can regenerate join code');
    }

    const joinCode = await this.generateJoinCode();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await query(
      `UPDATE chats 
       SET join_code = $1, join_code_expires_at = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [joinCode, expiresAt, chatId]
    );

    // Invalidate cache
    chatCacheService.invalidateChatDetail([chatId]);

    return joinCode;
  }

  /**
   * Delete group (admin/creator only)
   */
  async deleteGroup(chatId: string, userId: string): Promise<void> {
    const chatResult = await query<ChatRow>(
      `SELECT * FROM chats WHERE id = $1`,
      [chatId]
    );

    if (chatResult.rows.length === 0) {
      throw ApiError.notFound('Group not found');
    }

    const chat = chatResult.rows[0];

    if (!chat.is_group_chat) {
      throw ApiError.badRequest('This is not a group chat');
    }

    // Check permissions (admin or creator)
    const isAdmin = chat.group_admin === userId;
    const isCreator = chat.created_by === userId;

    if (!isAdmin && !isCreator) {
      throw ApiError.forbidden('Only admin or creator can delete the group');
    }

    // Get all participant IDs for cache invalidation
    const participants = await query<{ user_id: string }>(
      `SELECT user_id FROM chat_participants WHERE chat_id = $1`,
      [chatId]
    );
    const participantIds = participants.rows.map(p => p.user_id);

    // Delete group (cascade will delete participants and messages)
    await query(`DELETE FROM chats WHERE id = $1`, [chatId]);

    // Invalidate cache
    chatCacheService.invalidateChatList(participantIds);
    chatCacheService.invalidateChatDetail([chatId]);
  }

  /**
   * Get group members
   */
  async getGroupMembers(chatId: string, userId: string): Promise<Array<{
    id: string;
    userId: string;
    joinedAt: Date;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      avatar: string | null;
      role: string;
    };
  }>> {
    // Verify user is participant
    await this.getChatById(chatId, userId);

    const participants = await query<ChatParticipantRow & {
      user_id: string;
      first_name: string;
      last_name: string;
      email: string;
      avatar: string | null;
      role: string;
    }>(
      `SELECT cp.*, u.id as user_id, u.first_name, u.last_name, u.email, u.avatar, r.slug as role
       FROM chat_participants cp
       INNER JOIN users u ON cp.user_id = u.id
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE cp.chat_id = $1 AND cp.left_at IS NULL
       ORDER BY cp.joined_at ASC`,
      [chatId]
    );

    return participants.rows.map(p => ({
      id: p.id,
      userId: p.user_id,
      joinedAt: p.joined_at,
      user: {
        id: p.user_id,
        firstName: p.first_name,
        lastName: p.last_name,
        email: p.email,
        avatar: p.avatar,
        role: p.role,
      },
    }));
  }

  /**
   * Update message permissions (admin only)
   */
  async updateMessagePermissions(
    chatId: string,
    userId: string,
    mode: 'all' | 'restricted',
    allowedUserIds?: string[]
  ): Promise<ChatWithParticipants> {
    const chat = await this.getChatById(chatId, userId);

    // Check if user is admin
    if (chat.group_admin !== userId) {
      throw ApiError.forbidden('Only admin can update message permissions');
    }

    if (mode === 'restricted' && (!allowedUserIds || allowedUserIds.length === 0)) {
      throw ApiError.badRequest('Allowed user IDs are required for restricted mode');
    }

    const allowedIds = mode === 'restricted' ? allowedUserIds || [] : [];

    await query(
      `UPDATE chats 
       SET message_permission_mode = $1, allowed_sender_ids = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [mode, allowedIds, chatId]
    );

    // Invalidate cache
    chatCacheService.invalidateChatDetail([chatId]);

    return await this.getChatById(chatId, userId);
  }
}

export const chatService = new ChatService();
export default chatService;

