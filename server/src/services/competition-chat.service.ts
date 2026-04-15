/**
 * @file Competition Chat Service
 * @description Persistent live chat service for competition rooms.
 *
 * Messages and reactions are stored in PostgreSQL so they survive server
 * restarts. Real-time delivery is handled via Socket.IO broadcasts.
 */

import { socketService } from './socket.service.js';
import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import { ApiError } from '../utils/ApiError.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string;
  competition_id: string;
  user_id: string;
  content: string;
  reply_to_id: string | null;
  created_at: string;
  user?: { name: string; avatar?: string };
  reactions?: Record<string, string[]>; // emoji -> user_ids
  reply_to?: { id: string; user_name: string; content: string } | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Socket.IO event names
const EVENTS = {
  MESSAGE: 'competition:chat:message',
  REACTION: 'competition:chat:reaction',
  DELETE: 'competition:chat:delete',
} as const;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class CompetitionChatService {
  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /**
   * Build the Socket.IO room name for a competition chat.
   * Must match the room the client joins via the `joinChat` socket event:
   *   client sends: socket.emit('joinChat', `competition:${id}`)
   *   server joins:  socket.join(`chat:competition:${id}`)
   */
  private roomName(competitionId: string): string {
    return `chat:competition:${competitionId}`;
  }

  /**
   * Fetch user display name and avatar from the database.
   * Returns a safe fallback when the user cannot be found.
   */
  private async fetchUser(
    userId: string,
  ): Promise<{ name: string; avatar?: string }> {
    try {
      const result = await query<{
        first_name: string;
        last_name: string;
        avatar: string | null;
      }>(
        'SELECT first_name, last_name, avatar FROM users WHERE id = $1',
        [userId],
      );

      if (result.rows.length === 0) {
        return { name: 'Unknown User' };
      }

      const row = result.rows[0];
      return {
        name: `${row.first_name} ${row.last_name}`.trim(),
        ...(row.avatar ? { avatar: row.avatar } : {}),
      };
    } catch (error) {
      logger.warn('[CompetitionChat] Failed to fetch user', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { name: 'Unknown User' };
    }
  }

  /**
   * Load reactions for a set of message IDs from the database.
   * Returns a map of messageId -> { emoji: userId[] }.
   */
  private async loadReactions(
    messageIds: string[],
  ): Promise<Map<string, Record<string, string[]>>> {
    if (messageIds.length === 0) return new Map();

    const result = await query<{
      message_id: string;
      emoji: string;
      user_id: string;
    }>(
      `SELECT message_id, emoji, user_id
       FROM competition_chat_reactions
       WHERE message_id = ANY($1)
       ORDER BY created_at ASC`,
      [messageIds],
    );

    const map = new Map<string, Record<string, string[]>>();
    for (const row of result.rows) {
      if (!map.has(row.message_id)) {
        map.set(row.message_id, {});
      }
      const reactions = map.get(row.message_id)!;
      if (!reactions[row.emoji]) {
        reactions[row.emoji] = [];
      }
      reactions[row.emoji].push(row.user_id);
    }
    return map;
  }

  /**
   * Load reactions for a single message.
   */
  private async getReactionsForMessage(
    messageId: string,
  ): Promise<Record<string, string[]>> {
    const map = await this.loadReactions([messageId]);
    return map.get(messageId) ?? {};
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Send a message to a competition chat room.
   */
  async sendMessage(
    competitionId: string,
    userId: string,
    content: string,
    replyToId?: string,
  ): Promise<ChatMessage> {
    const user = await this.fetchUser(userId);

    // Resolve reply-to metadata when replying to another message
    let replyTo: ChatMessage['reply_to'] = null;
    if (replyToId) {
      const replyResult = await query<{
        id: string;
        content: string;
        user_id: string;
        first_name: string;
        last_name: string;
      }>(
        `SELECT m.id, m.content, m.user_id, u.first_name, u.last_name
         FROM competition_chat_messages m
         JOIN users u ON u.id = m.user_id
         WHERE m.id = $1`,
        [replyToId],
      );

      if (replyResult.rows.length > 0) {
        const r = replyResult.rows[0];
        replyTo = {
          id: r.id,
          user_name: `${r.first_name} ${r.last_name}`.trim() || 'Unknown User',
          content:
            r.content.length > 100 ? r.content.slice(0, 100) + '...' : r.content,
        };
      }
    }

    // Insert the message into the database
    const insertResult = await query<{ id: string; created_at: string }>(
      `INSERT INTO competition_chat_messages (competition_id, user_id, content, reply_to_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [competitionId, userId, content, replyToId ?? null],
    );

    const row = insertResult.rows[0];

    const message: ChatMessage = {
      id: row.id,
      competition_id: competitionId,
      user_id: userId,
      content,
      reply_to_id: replyToId ?? null,
      created_at: row.created_at,
      user,
      reactions: {},
      reply_to: replyTo,
    };

    // Broadcast to every socket in the competition room
    socketService.emitToRoom(
      this.roomName(competitionId),
      EVENTS.MESSAGE,
      message,
    );

    logger.debug('[CompetitionChat] Message sent', {
      competitionId,
      messageId: message.id,
      userId,
    });

    return message;
  }

  /**
   * Get messages for a competition, paginated (newest first).
   *
   * @param competitionId - The competition to fetch messages for.
   * @param limit         - Max number of messages to return (default 50).
   * @param before        - ISO-8601 cursor; only messages created before
   *                        this timestamp are returned.
   */
  async getMessages(
    competitionId: string,
    limit = 50,
    before?: string,
  ): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
    // Fetch limit+1 to detect hasMore
    const fetchLimit = limit + 1;

    const params: (string | number)[] = [competitionId, fetchLimit];
    let whereClause = 'WHERE m.competition_id = $1';

    if (before) {
      whereClause += ' AND m.created_at < $3';
      params.push(before);
    }

    const result = await query<{
      id: string;
      competition_id: string;
      user_id: string;
      content: string;
      reply_to_id: string | null;
      created_at: string;
      first_name: string;
      last_name: string;
      avatar: string | null;
      reply_msg_id: string | null;
      reply_content: string | null;
      reply_first_name: string | null;
      reply_last_name: string | null;
    }>(
      `SELECT
         m.id, m.competition_id, m.user_id, m.content,
         m.reply_to_id, m.created_at,
         u.first_name, u.last_name, u.avatar,
         rm.id AS reply_msg_id, rm.content AS reply_content,
         ru.first_name AS reply_first_name, ru.last_name AS reply_last_name
       FROM competition_chat_messages m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN competition_chat_messages rm ON rm.id = m.reply_to_id
       LEFT JOIN users ru ON ru.id = rm.user_id
       ${whereClause}
       ORDER BY m.created_at DESC
       LIMIT $2`,
      params,
    );

    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

    // Load reactions for all messages in a single query
    const messageIds = rows.map((r) => r.id);
    const reactionsMap = await this.loadReactions(messageIds);

    const messages: ChatMessage[] = rows.map((r) => ({
      id: r.id,
      competition_id: r.competition_id,
      user_id: r.user_id,
      content: r.content,
      reply_to_id: r.reply_to_id,
      created_at: r.created_at,
      user: {
        name: `${r.first_name} ${r.last_name}`.trim(),
        ...(r.avatar ? { avatar: r.avatar } : {}),
      },
      reactions: reactionsMap.get(r.id) ?? {},
      reply_to: r.reply_msg_id
        ? {
            id: r.reply_msg_id,
            user_name:
              `${r.reply_first_name ?? ''} ${r.reply_last_name ?? ''}`.trim() ||
              'Unknown User',
            content:
              (r.reply_content?.length ?? 0) > 100
                ? r.reply_content!.slice(0, 100) + '...'
                : r.reply_content ?? '',
          }
        : null,
    }));

    // Reverse so messages are in chronological order (oldest first)
    // The SQL query fetches DESC for cursor-based pagination, but the
    // client renders top-to-bottom expecting oldest at the top.
    messages.reverse();

    return { messages, hasMore };
  }

  /**
   * Add a reaction (emoji) to a message.
   */
  async addReaction(
    messageId: string,
    userId: string,
    emoji: string,
  ): Promise<void> {
    // Verify the message exists and get its competition_id
    const msgResult = await query<{ competition_id: string }>(
      'SELECT competition_id FROM competition_chat_messages WHERE id = $1',
      [messageId],
    );

    if (msgResult.rows.length === 0) {
      throw ApiError.notFound('Message not found');
    }

    const { competition_id } = msgResult.rows[0];

    // Upsert the reaction (ignore conflict = already reacted)
    await query(
      `INSERT INTO competition_chat_reactions (message_id, user_id, emoji)
       VALUES ($1, $2, $3)
       ON CONFLICT (message_id, user_id, emoji) DO NOTHING`,
      [messageId, userId, emoji],
    );

    // Load updated reactions for broadcast
    const reactions = await this.getReactionsForMessage(messageId);

    socketService.emitToRoom(
      this.roomName(competition_id),
      EVENTS.REACTION,
      {
        messageId,
        emoji,
        userId,
        action: 'add',
        reactions,
      },
    );

    logger.debug('[CompetitionChat] Reaction added', {
      messageId,
      userId,
      emoji,
    });
  }

  /**
   * Remove a reaction (emoji) from a message.
   */
  async removeReaction(
    messageId: string,
    userId: string,
    emoji: string,
  ): Promise<void> {
    // Verify the message exists and get its competition_id
    const msgResult = await query<{ competition_id: string }>(
      'SELECT competition_id FROM competition_chat_messages WHERE id = $1',
      [messageId],
    );

    if (msgResult.rows.length === 0) {
      throw ApiError.notFound('Message not found');
    }

    const { competition_id } = msgResult.rows[0];

    await query(
      `DELETE FROM competition_chat_reactions
       WHERE message_id = $1 AND user_id = $2 AND emoji = $3`,
      [messageId, userId, emoji],
    );

    // Load updated reactions for broadcast
    const reactions = await this.getReactionsForMessage(messageId);

    socketService.emitToRoom(
      this.roomName(competition_id),
      EVENTS.REACTION,
      {
        messageId,
        emoji,
        userId,
        action: 'remove',
        reactions,
      },
    );

    logger.debug('[CompetitionChat] Reaction removed', {
      messageId,
      userId,
      emoji,
    });
  }

  /**
   * Get all reactions for a message as `{ emoji: userId[] }`.
   */
  async getReactions(
    messageId: string,
  ): Promise<Record<string, string[]>> {
    return this.getReactionsForMessage(messageId);
  }

  /**
   * Delete a message. Only the message author can delete their own message.
   */
  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const msgResult = await query<{
      competition_id: string;
      user_id: string;
    }>(
      'SELECT competition_id, user_id FROM competition_chat_messages WHERE id = $1',
      [messageId],
    );

    if (msgResult.rows.length === 0) {
      throw ApiError.notFound('Message not found');
    }

    const row = msgResult.rows[0];

    if (row.user_id !== userId) {
      throw ApiError.forbidden('You can only delete your own messages');
    }

    const competitionId = row.competition_id;

    // Delete the message (CASCADE deletes reactions)
    await query(
      'DELETE FROM competition_chat_messages WHERE id = $1',
      [messageId],
    );

    // Broadcast the deletion event
    socketService.emitToRoom(
      this.roomName(competitionId),
      EVENTS.DELETE,
      { messageId, competitionId },
    );

    logger.debug('[CompetitionChat] Message deleted', {
      messageId,
      userId,
      competitionId,
    });
  }
}

export const competitionChatService = new CompetitionChatService();
export default competitionChatService;
