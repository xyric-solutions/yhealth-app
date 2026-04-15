/**
 * @file Follow / Buddy Relationship Service
 * @description Manages follow requests, acceptance (creates chat + AI action),
 * blocking, and relationship queries. Integrates with chat, notifications,
 * and Socket.IO for real-time updates.
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import { notificationService } from './notification.service.js';
import { socketService } from './socket.service.js';

// ─── Types ───────────────────────────────────────────────────────────

export interface Follow {
  id: string;
  requesterId: string;
  recipientId: string;
  status: string;
  chatId: string | null;
  matchReason: string | null;
  matchScore: number | null;
  requesterMessage: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  // Enriched fields (joined from users)
  requesterName?: string;
  requesterAvatar?: string;
  recipientName?: string;
  recipientAvatar?: string;
}

// ─── Table auto-creation ─────────────────────────────────────────────

let tablesEnsured = false;

async function ensureTables(): Promise<void> {
  if (tablesEnsured) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS user_follows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        chat_id UUID REFERENCES chats(id) ON DELETE SET NULL,
        match_reason TEXT, match_score NUMERIC(3,2),
        requester_message TEXT, accepted_at TIMESTAMPTZ, rejected_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(requester_id, recipient_id), CHECK(requester_id != recipient_id)
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_uf_requester ON user_follows(requester_id, status)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_uf_recipient ON user_follows(recipient_id, status)`);

    await query(`
      CREATE TABLE IF NOT EXISTS buddy_discovery_consent (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        allow_suggestions BOOLEAN DEFAULT false,
        allow_goal_sharing BOOLEAN DEFAULT false,
        allow_activity_sharing BOOLEAN DEFAULT false,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS buddy_suggestions_cache (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        suggested_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        match_score NUMERIC(3,2) NOT NULL, match_reason TEXT NOT NULL,
        goal_overlap JSONB DEFAULT '{}', computed_at TIMESTAMPTZ DEFAULT NOW(),
        dismissed BOOLEAN DEFAULT false,
        UNIQUE(user_id, suggested_user_id)
      )
    `);
    await query(`CREATE INDEX IF NOT EXISTS idx_bsc_user ON buddy_suggestions_cache(user_id, dismissed, match_score DESC)`);

    tablesEnsured = true;
  } catch (error) {
    logger.error('[Follow] Error ensuring tables', { error: error instanceof Error ? error.message : 'Unknown' });
  }
}

// ─── Row mapping ─────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): Follow {
  return {
    id: row.id as string,
    requesterId: row.requester_id as string,
    recipientId: row.recipient_id as string,
    status: row.status as string,
    chatId: row.chat_id as string | null,
    matchReason: row.match_reason as string | null,
    matchScore: row.match_score != null ? Number(row.match_score) : null,
    requesterMessage: row.requester_message as string | null,
    acceptedAt: row.accepted_at as string | null,
    rejectedAt: row.rejected_at as string | null,
    createdAt: row.created_at as string,
    requesterName: row.requester_name as string | undefined,
    requesterAvatar: row.requester_avatar as string | undefined,
    recipientName: row.recipient_name as string | undefined,
    recipientAvatar: row.recipient_avatar as string | undefined,
  };
}

// ─── Service ─────────────────────────────────────────────────────────

class FollowService {

  async sendFollowRequest(requesterId: string, recipientId: string, message?: string): Promise<Follow> {
    await ensureTables();

    // Check existing relationship
    const existing = await query(
      `SELECT id, status FROM user_follows
       WHERE (requester_id = $1 AND recipient_id = $2)
          OR (requester_id = $2 AND recipient_id = $1)`,
      [requesterId, recipientId]
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      if (row.status === 'blocked') throw new Error('Cannot send follow request to this user');
      if (row.status === 'accepted') throw new Error('Already connected');
      if (row.status === 'pending') throw new Error('Follow request already pending');
    }

    const result = await query(
      `INSERT INTO user_follows (requester_id, recipient_id, requester_message)
       VALUES ($1, $2, $3)
       ON CONFLICT (requester_id, recipient_id) DO UPDATE SET
         status = 'pending', requester_message = $3, rejected_at = NULL, updated_at = NOW()
       RETURNING *`,
      [requesterId, recipientId, message || null]
    );

    const follow = mapRow(result.rows[0]);

    // Get requester name for notification
    const userResult = await query<{ first_name: string }>(
      'SELECT first_name FROM users WHERE id = $1', [requesterId]
    );
    const name = userResult.rows[0]?.first_name || 'Someone';

    // Notify recipient
    notificationService.create({
      userId: recipientId,
      type: 'social',
      title: 'New Follow Request',
      message: `${name} wants to connect with you${message ? `: "${message}"` : ''}`,
      icon: '🤝',
      priority: 'normal',
      relatedEntityType: 'follow_request',
      relatedEntityId: follow.id,
      actionUrl: '/chat',
      actionLabel: 'View Request',
    }).catch(() => {});

    socketService.emitToUser(recipientId, 'follow:request', {
      followId: follow.id,
      requesterId,
      requesterName: name,
      message,
    });

    logger.info('[Follow] Request sent', { requesterId, recipientId });
    return follow;
  }

  async acceptFollowRequest(followId: string, userId: string): Promise<Follow> {
    await ensureTables();

    // Verify recipient is the one accepting
    const result = await query(
      `UPDATE user_follows
       SET status = 'accepted', accepted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND recipient_id = $2 AND status = 'pending'
       RETURNING *`,
      [followId, userId]
    );

    if (result.rows.length === 0) throw new Error('Follow request not found or already processed');

    const follow = mapRow(result.rows[0]);

    // Create 1:1 chat
    try {
      const { chatService } = await import('./chat.service.js');
      const chat = await chatService.createOrGetChat({
        userId: follow.requesterId,
        otherUserId: follow.recipientId,
        isGroupChat: false,
      });

      // Link chat to follow
      await query(
        'UPDATE user_follows SET chat_id = $1 WHERE id = $2',
        [chat.id, followId]
      );
      follow.chatId = chat.id;

      // Generate AI conversation starter based on shared goals
      const starter = await this.generateConversationStarter(follow.requesterId, follow.recipientId);
      if (starter && chat.id) {
        const { messageService } = await import('./message.service.js');
        await messageService.sendMessage({
          chatId: chat.id,
          senderId: follow.requesterId,
          content: starter,
          contentType: 'text',
        }).catch(() => {});
      }
    } catch (error) {
      logger.error('[Follow] Chat creation failed on accept', {
        followId, error: error instanceof Error ? error.message : 'Unknown',
      });
    }

    // Notify requester
    const userResult = await query<{ first_name: string }>(
      'SELECT first_name FROM users WHERE id = $1', [userId]
    );
    const name = userResult.rows[0]?.first_name || 'Someone';

    notificationService.create({
      userId: follow.requesterId,
      type: 'social',
      title: 'Follow Request Accepted!',
      message: `${name} accepted your follow request. Start chatting!`,
      icon: '🎉',
      priority: 'high',
      relatedEntityType: 'follow_accepted',
      relatedEntityId: followId,
      actionUrl: '/chat',
    }).catch(() => {});

    socketService.emitToUser(follow.requesterId, 'follow:accepted', {
      followId, recipientId: userId, recipientName: name, chatId: follow.chatId,
    });

    logger.info('[Follow] Request accepted', { followId, acceptedBy: userId });
    return follow;
  }

  async rejectFollowRequest(followId: string, userId: string): Promise<void> {
    await ensureTables();
    const result = await query(
      `UPDATE user_follows SET status = 'rejected', rejected_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND recipient_id = $2 AND status = 'pending'`,
      [followId, userId]
    );
    if (result.rowCount === 0) throw new Error('Follow request not found');
  }

  async removeFollow(userId: string, targetId: string): Promise<void> {
    await ensureTables();
    await query(
      `DELETE FROM user_follows
       WHERE (requester_id = $1 AND recipient_id = $2)
          OR (requester_id = $2 AND recipient_id = $1)`,
      [userId, targetId]
    );
  }

  async blockUser(userId: string, targetId: string): Promise<void> {
    await ensureTables();
    await query(
      `INSERT INTO user_follows (requester_id, recipient_id, status)
       VALUES ($1, $2, 'blocked')
       ON CONFLICT (requester_id, recipient_id) DO UPDATE SET
         status = 'blocked', updated_at = NOW()`,
      [userId, targetId]
    );
  }

  async getFollowers(userId: string, limit = 50): Promise<Follow[]> {
    await ensureTables();
    const result = await query(
      `SELECT f.*, u.first_name || ' ' || COALESCE(u.last_name, '') as requester_name, u.avatar as requester_avatar
       FROM user_follows f
       JOIN users u ON u.id = f.requester_id
       WHERE f.recipient_id = $1 AND f.status = 'accepted'
       ORDER BY f.accepted_at DESC LIMIT $2`,
      [userId, limit]
    );
    return result.rows.map(mapRow);
  }

  async getFollowing(userId: string, limit = 50): Promise<Follow[]> {
    await ensureTables();
    const result = await query(
      `SELECT f.*, u.first_name || ' ' || COALESCE(u.last_name, '') as recipient_name, u.avatar as recipient_avatar
       FROM user_follows f
       JOIN users u ON u.id = f.recipient_id
       WHERE f.requester_id = $1 AND f.status = 'accepted'
       ORDER BY f.accepted_at DESC LIMIT $2`,
      [userId, limit]
    );
    return result.rows.map(mapRow);
  }

  async getPendingRequests(userId: string): Promise<Follow[]> {
    await ensureTables();
    const result = await query(
      `SELECT f.*, u.first_name || ' ' || COALESCE(u.last_name, '') as requester_name, u.avatar as requester_avatar
       FROM user_follows f
       JOIN users u ON u.id = f.requester_id
       WHERE f.recipient_id = $1 AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [userId]
    );
    return result.rows.map(mapRow);
  }

  async getMutualFollows(userId: string): Promise<Follow[]> {
    await ensureTables();
    const result = await query(
      `SELECT f1.*, u.first_name || ' ' || COALESCE(u.last_name, '') as recipient_name, u.avatar as recipient_avatar
       FROM user_follows f1
       JOIN user_follows f2 ON f1.requester_id = f2.recipient_id AND f1.recipient_id = f2.requester_id
       JOIN users u ON u.id = f1.recipient_id
       WHERE f1.requester_id = $1 AND f1.status = 'accepted' AND f2.status = 'accepted'
       ORDER BY f1.accepted_at DESC`,
      [userId]
    );
    return result.rows.map(mapRow);
  }

  async getRelationship(userId: string, targetId: string): Promise<{ status: string | null; followId: string | null; chatId: string | null }> {
    await ensureTables();
    const result = await query(
      `SELECT id, status, chat_id FROM user_follows
       WHERE (requester_id = $1 AND recipient_id = $2)
          OR (requester_id = $2 AND recipient_id = $1)
       ORDER BY created_at DESC LIMIT 1`,
      [userId, targetId]
    );
    if (result.rows.length === 0) return { status: null, followId: null, chatId: null };
    return {
      status: result.rows[0].status as string,
      followId: result.rows[0].id as string,
      chatId: result.rows[0].chat_id as string | null,
    };
  }

  async getSocialStats(userId: string): Promise<{
    followersCount: number;
    followingCount: number;
    mutualCount: number;
    pendingCount: number;
  }> {
    await ensureTables();
    const result = await query<{
      followers: string; following: string; mutual: string; pending: string;
    }>(
      `SELECT
        (SELECT COUNT(*) FROM user_follows WHERE recipient_id = $1 AND status = 'accepted') as followers,
        (SELECT COUNT(*) FROM user_follows WHERE requester_id = $1 AND status = 'accepted') as following,
        (SELECT COUNT(*) FROM user_follows f1
         JOIN user_follows f2 ON f1.requester_id = f2.recipient_id AND f1.recipient_id = f2.requester_id
         WHERE f1.requester_id = $1 AND f1.status = 'accepted' AND f2.status = 'accepted') as mutual,
        (SELECT COUNT(*) FROM user_follows WHERE recipient_id = $1 AND status = 'pending') as pending`,
      [userId]
    );
    const r = result.rows[0];
    return {
      followersCount: Number(r?.followers || 0),
      followingCount: Number(r?.following || 0),
      mutualCount: Number(r?.mutual || 0),
      pendingCount: Number(r?.pending || 0),
    };
  }

  // ─── Consent ───────────────────────────────────────────────────────

  async getConsent(userId: string): Promise<{ allowSuggestions: boolean; allowGoalSharing: boolean; allowActivitySharing: boolean }> {
    await ensureTables();
    await query(
      `INSERT INTO buddy_discovery_consent (user_id) VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );
    // Fetch actual value
    const row = await query(
      'SELECT * FROM buddy_discovery_consent WHERE user_id = $1',
      [userId]
    );
    const r = row.rows[0];
    return {
      allowSuggestions: r?.allow_suggestions ?? false,
      allowGoalSharing: r?.allow_goal_sharing ?? false,
      allowActivitySharing: r?.allow_activity_sharing ?? false,
    };
  }

  async updateConsent(userId: string, data: { allow_suggestions?: boolean; allow_goal_sharing?: boolean; allow_activity_sharing?: boolean }): Promise<void> {
    await ensureTables();
    const fields: string[] = [];
    const values: (string | boolean)[] = [userId];
    let idx = 2;

    if (data.allow_suggestions !== undefined) {
      fields.push(`allow_suggestions = $${idx++}`);
      values.push(data.allow_suggestions);
    }
    if (data.allow_goal_sharing !== undefined) {
      fields.push(`allow_goal_sharing = $${idx++}`);
      values.push(data.allow_goal_sharing);
    }
    if (data.allow_activity_sharing !== undefined) {
      fields.push(`allow_activity_sharing = $${idx++}`);
      values.push(data.allow_activity_sharing);
    }
    if (fields.length === 0) return;

    fields.push('updated_at = NOW()');
    await query(
      `INSERT INTO buddy_discovery_consent (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );
    await query(
      `UPDATE buddy_discovery_consent SET ${fields.join(', ')} WHERE user_id = $1`,
      values
    );
  }

  // ─── AI Conversation Starter ───────────────────────────────────────

  private async generateConversationStarter(userAId: string, userBId: string): Promise<string | null> {
    try {
      // Get shared goals
      const goals = await query<{ a_title: string; b_title: string; a_pillar: string; b_pillar: string }>(
        `SELECT
          ga.title as a_title, gb.title as b_title,
          ga.pillar as a_pillar, gb.pillar as b_pillar
        FROM user_goals ga
        CROSS JOIN user_goals gb
        WHERE ga.user_id = $1 AND gb.user_id = $2
          AND ga.status = 'active' AND gb.status = 'active'
          AND ga.pillar = gb.pillar
        LIMIT 1`,
        [userAId, userBId]
      );

      if (goals.rows.length > 0) {
        const { a_pillar } = goals.rows[0];
        const pillarName = a_pillar === 'fitness' ? 'fitness' : a_pillar === 'nutrition' ? 'nutrition' : 'wellbeing';
        return `Hey! Looks like we're both working on ${pillarName} goals. Want to keep each other accountable? 💪`;
      }

      return "Hey! Excited to connect. What are you working on right now? 🎯";
    } catch {
      return null;
    }
  }
}

export const followService = new FollowService();
export default followService;
