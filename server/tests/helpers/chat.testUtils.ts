/**
 * @file Chat Test Utilities
 * @description Helper functions for creating test data for chat/messaging tests
 */

import { query, transaction as _transaction } from '../../src/database/pg.js';
import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export interface TestUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

export interface TestChat {
  id: string;
  chat_name: string;
  is_group_chat: boolean;
  is_community: boolean;
}

export interface TestMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  content_type: string;
}

/**
 * Create a test user in the database
 */
export async function createTestUser(overrides: Partial<{
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
  isEmailVerified: boolean;
}> = {}): Promise<TestUser> {
  const email = overrides.email || faker.internet.email().toLowerCase();
  const password = overrides.password || 'TestPassword123!';
  const hashedPassword = await bcrypt.hash(password, 12);

  // Map role name to role_id UUID
  const roleMap: Record<string, string> = {
    user: '11111111-1111-1111-1111-111111111101',
    admin: '11111111-1111-1111-1111-111111111102',
  };
  const roleId = roleMap[overrides.role || 'user'] || roleMap['user'];

  const result = await query<TestUser>(
    `INSERT INTO users (
      email, password, first_name, last_name,
      auth_provider, onboarding_status, is_email_verified, is_active, role_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id, email, first_name, last_name,
      (SELECT slug FROM roles WHERE id = role_id) as role`,
    [
      email,
      hashedPassword,
      overrides.firstName || faker.person.firstName(),
      overrides.lastName || faker.person.lastName(),
      'local',
      'consent_pending',
      overrides.isEmailVerified ?? true,
      true,
      roleId,
    ]
  );

  return result.rows[0];
}

/**
 * Create multiple test users
 */
export async function createTestUsers(count: number): Promise<TestUser[]> {
  const users: TestUser[] = [];
  for (let i = 0; i < count; i++) {
    users.push(await createTestUser());
  }
  return users;
}

/**
 * Create a test chat (one-on-one or group)
 */
export async function createTestChat(
  userIds: string[],
  options: Partial<{
    chatName: string;
    isGroupChat: boolean;
    isCommunity: boolean;
    avatar: string;
    groupAdmin: string;
  }> = {}
): Promise<TestChat> {
  if (userIds.length < 2 && !options.isGroupChat) {
    throw new Error('At least 2 users required for chat');
  }

  const chatName = options.chatName || 
    (options.isGroupChat ? faker.company.name() : 'Chat');

  const result = await query<TestChat>(
    `INSERT INTO chats (
      chat_name, is_group_chat, is_community, avatar, group_admin
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING id, chat_name, is_group_chat, is_community`,
    [
      chatName,
      options.isGroupChat || false,
      options.isCommunity || false,
      options.avatar || null,
      options.groupAdmin || (options.isGroupChat ? userIds[0] : null),
    ]
  );

  const chat = result.rows[0];

  // Add participants
  for (const userId of userIds) {
    await query(
      `INSERT INTO chat_participants (chat_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (chat_id, user_id) DO NOTHING`,
      [chat.id, userId]
    );
  }

  return chat;
}

/**
 * Create a test message
 */
export async function createTestMessage(
  chatId: string,
  senderId: string,
  options: Partial<{
    content: string;
    contentType: string;
    mediaUrl: string;
    repliedToId: string;
  }> = {}
): Promise<TestMessage> {
  const result = await query<TestMessage>(
    `INSERT INTO messages (
      chat_id, sender_id, content, content_type,
      media_url, replied_to_id
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, chat_id, sender_id, content, content_type`,
    [
      chatId,
      senderId,
      options.content || faker.lorem.sentence(),
      options.contentType || 'text',
      options.mediaUrl || null,
      options.repliedToId || null,
    ]
  );

  const message = result.rows[0];

  // Update chat's latest message
  await query(
    `UPDATE chats
     SET latest_message_id = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [message.id, chatId]
  );

  return message;
}

/**
 * Create multiple test messages
 */
export async function createTestMessages(
  chatId: string,
  senderId: string,
  count: number
): Promise<TestMessage[]> {
  const messages: TestMessage[] = [];
  for (let i = 0; i < count; i++) {
    messages.push(await createTestMessage(chatId, senderId));
  }
  return messages;
}

/**
 * Add user to chat
 */
export async function addUserToChat(chatId: string, userId: string): Promise<void> {
  await query(
    `INSERT INTO chat_participants (chat_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT (chat_id, user_id) DO UPDATE
     SET left_at = NULL, joined_at = CURRENT_TIMESTAMP`,
    [chatId, userId]
  );
}

/**
 * Remove user from chat
 */
export async function removeUserFromChat(chatId: string, userId: string): Promise<void> {
  await query(
    `UPDATE chat_participants
     SET left_at = CURRENT_TIMESTAMP
     WHERE chat_id = $1 AND user_id = $2`,
    [chatId, userId]
  );
}

/**
 * Create a message reaction
 */
export async function createMessageReaction(
  messageId: string,
  userId: string,
  emoji: string = '👍'
): Promise<void> {
  await query(
    `INSERT INTO message_reactions (message_id, user_id, emoji)
     VALUES ($1, $2, $3)
     ON CONFLICT (message_id, user_id, emoji) DO NOTHING`,
    [messageId, userId, emoji]
  );
}

/**
 * Mark message as read
 */
export async function markMessageAsRead(messageId: string, userId: string): Promise<void> {
  await query(
    `INSERT INTO message_reads (message_id, user_id, read_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (message_id, user_id)
     DO UPDATE SET read_at = CURRENT_TIMESTAMP`,
    [messageId, userId]
  );
}

/**
 * Star a message
 */
export async function starMessage(messageId: string, userId: string): Promise<void> {
  await query(
    `INSERT INTO starred_messages (message_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT (message_id, user_id) DO NOTHING`,
    [messageId, userId]
  );
}

/**
 * Clean up test data (delete in reverse dependency order)
 */
export async function cleanupTestData(ids: {
  userIds?: string[];
  chatIds?: string[];
  messageIds?: string[];
}): Promise<void> {
  // Delete messages first (has foreign keys)
  if (ids.messageIds && ids.messageIds.length > 0) {
    await query(
      `DELETE FROM messages WHERE id = ANY($1)`,
      [ids.messageIds]
    );
  }

  // Delete chats (cascade will handle participants)
  if (ids.chatIds && ids.chatIds.length > 0) {
    await query(
      `DELETE FROM chats WHERE id = ANY($1)`,
      [ids.chatIds]
    );
  }

  // Delete users last
  if (ids.userIds && ids.userIds.length > 0) {
    await query(
      `DELETE FROM users WHERE id = ANY($1)`,
      [ids.userIds]
    );
  }
}

/**
 * Clean up all test data for a chat
 */
export async function cleanupChatTestData(chatId: string): Promise<void> {
  // Get all related data
  const messagesResult = await query<{ id: string }>(
    `SELECT id FROM messages WHERE chat_id = $1`,
    [chatId]
  );
  const messageIds = messagesResult.rows.map(r => r.id);

  // Delete in order
  if (messageIds.length > 0) {
    await query(`DELETE FROM message_reads WHERE message_id = ANY($1)`, [messageIds]);
    await query(`DELETE FROM message_reactions WHERE message_id = ANY($1)`, [messageIds]);
    await query(`DELETE FROM starred_messages WHERE message_id = ANY($1)`, [messageIds]);
    await query(`DELETE FROM messages WHERE id = ANY($1)`, [messageIds]);
  }

  await query(`DELETE FROM chat_participants WHERE chat_id = $1`, [chatId]);
  await query(`DELETE FROM chats WHERE id = $1`, [chatId]);
}

/**
 * Get chat with participants
 */
export async function getChatWithParticipants(chatId: string): Promise<{
  chat: TestChat;
  participants: Array<{ user_id: string; joined_at: Date }>;
}> {
  const chatResult = await query<TestChat>(
    `SELECT * FROM chats WHERE id = $1`,
    [chatId]
  );

  const participantsResult = await query<{ user_id: string; joined_at: Date }>(
    `SELECT user_id, joined_at FROM chat_participants
     WHERE chat_id = $1 AND left_at IS NULL`,
    [chatId]
  );

  return {
    chat: chatResult.rows[0],
    participants: participantsResult.rows,
  };
}

/**
 * Generate JWT token for testing
 */
export function generateTestToken(userId: string, email: string, role: string = 'user'): string {
  const secret = process.env['JWT_SECRET'] || 'test-jwt-secret';

  return jwt.sign(
    { userId, email, role },
    secret,
    {
      expiresIn: '15m',
      issuer: 'yhealth-api-test',
      audience: 'yhealth-client-test',
    }
  );
}

