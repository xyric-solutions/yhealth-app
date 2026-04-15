/**
 * @file Message Service Unit Tests
 */

import { messageService } from '../../../src/services/message.service.js';
import { query, transaction } from '../../../src/database/pg.js';
import { chatService } from '../../../src/services/chat.service.js';
import { chatCacheService } from '../../../src/services/chat-cache.service.js';
import { r2Service } from '../../../src/services/r2.service.js';
import { ApiError } from '../../../src/utils/ApiError.js';
import {
  createTestUser,
  createTestUsers,
  createTestChat,
  createTestMessage,
} from '../../helpers/chat.testUtils.js';

// Mock dependencies
jest.mock('../../../src/database/pg.js');
jest.mock('../../../src/services/chat.service.js');
jest.mock('../../../src/services/chat-cache.service.js');
jest.mock('../../../src/services/r2.service.js');
jest.mock('../../../src/services/logger.service.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockTransaction = transaction as jest.MockedFunction<typeof transaction>;
const mockChatService = chatService as jest.Mocked<typeof chatService>;
const mockChatCacheService = chatCacheService as jest.Mocked<typeof chatCacheService>;
const mockR2Service = r2Service as jest.Mocked<typeof r2Service>;

describe('MessageService', () => {
  let user1: { id: string };
  let user2: { id: string };
  let chat: { id: string };

  beforeEach(() => {
    jest.clearAllMocks();
    mockChatCacheService.getOrSetMessage.mockImplementation(async (messageId, factory) => {
      return factory();
    });
    mockChatCacheService.getOrSetMessages.mockImplementation(async (chatId, page, limit, factory) => {
      return factory();
    });
    mockChatCacheService.invalidateMessage.mockImplementation(() => {});
    mockChatCacheService.invalidateMessages.mockImplementation(() => {});
    mockChatCacheService.invalidateChatDetail.mockImplementation(() => {});
    mockChatCacheService.invalidateChatList.mockImplementation(() => {});
  });

  beforeEach(async () => {
    user1 = await createTestUser();
    user2 = await createTestUser();
    chat = await createTestChat([user1.id, user2.id]);
  });

  describe('sendMessage', () => {
    it('should send a text message', async () => {
      const mockClient = {
        query: jest.fn(),
      };
      mockTransaction.mockImplementation(async (callback) => {
        return callback(mockClient as any);
      });

      mockChatService.getChatById.mockResolvedValue({
        id: chat.id,
        chat_name: 'Test Chat',
        is_group_chat: false,
        is_community: false,
        avatar: null,
        group_admin: null,
        latest_message_id: null,
        created_at: new Date(),
        updated_at: new Date(),
        participants: [],
      });

      mockChatService.incrementUnreadCount.mockResolvedValue();
      mockChatService.getChatParticipants.mockResolvedValue([
        { id: 'cp-1', chat_id: chat.id, user_id: user1.id, joined_at: new Date(), left_at: null, is_blocked: false, unread_count: 0, last_read_at: null },
        { id: 'cp-2', chat_id: chat.id, user_id: user2.id, joined_at: new Date(), left_at: null, is_blocked: false, unread_count: 0, last_read_at: null },
      ]);

      mockClient.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'msg-123',
            chat_id: chat.id,
            sender_id: user1.id,
            content: 'Hello',
            content_type: 'text',
            media_url: null,
            media_thumbnail: null,
            media_size: null,
            media_duration: null,
            is_edited: false,
            edited_at: null,
            is_deleted: false,
            deleted_at: null,
            deleted_by: null,
            is_pinned: false,
            pinned_at: null,
            pinned_by: null,
            replied_to_id: null,
            forwarded_from_id: null,
            forwarded_by: null,
            created_at: new Date(),
            updated_at: new Date(),
          }],
        })
        .mockResolvedValueOnce({ rows: [] }); // Update chat

      // Mock getMessageById
      mockQuery.mockResolvedValue({
        rows: [{
          id: 'msg-123',
          chat_id: chat.id,
          sender_id: user1.id,
          content: 'Hello',
          content_type: 'text',
          media_url: null,
          media_thumbnail: null,
          media_size: null,
          media_duration: null,
          is_edited: false,
          edited_at: null,
          is_deleted: false,
          deleted_at: null,
          deleted_by: null,
          is_pinned: false,
          pinned_at: null,
          pinned_by: null,
          replied_to_id: null,
          forwarded_from_id: null,
          forwarded_by: null,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      }).mockResolvedValue({
        rows: [{
          id: user1.id,
          first_name: 'Test',
          last_name: 'User',
          email: 'test@example.com',
          avatar: null,
          role: 'user',
        }],
      }).mockResolvedValue({
        rows: [],
      }).mockResolvedValue({
        rows: [],
      }).mockResolvedValue({
        rows: [],
      });

      const result = await messageService.sendMessage({
        chatId: chat.id,
        senderId: user1.id,
        content: 'Hello',
        contentType: 'text',
      });

      expect(result).toBeDefined();
      expect(result.content).toBe('Hello');
      expect(mockTransaction).toHaveBeenCalled();
    });

    it('should throw error if user is not a participant', async () => {
      mockChatService.getChatById.mockRejectedValue(
        ApiError.forbidden('You are not a participant of this chat')
      );

      await expect(
        messageService.sendMessage({
          chatId: chat.id,
          senderId: 'non-participant-id',
          content: 'Hello',
        })
      ).rejects.toThrow(ApiError);
    });
  });

  describe('getMessageById', () => {
    it('should get message by ID with relations', async () => {
      const messageId = 'msg-123';

      mockQuery
        .mockResolvedValueOnce({
          rows: [{
            id: messageId,
            chat_id: chat.id,
            sender_id: user1.id,
            content: 'Test message',
            content_type: 'text',
            media_url: null,
            media_thumbnail: null,
            media_size: null,
            media_duration: null,
            is_edited: false,
            edited_at: null,
            is_deleted: false,
            deleted_at: null,
            deleted_by: null,
            is_pinned: false,
            pinned_at: null,
            pinned_by: null,
            replied_to_id: null,
            forwarded_from_id: null,
            forwarded_by: null,
            created_at: new Date(),
            updated_at: new Date(),
          }],
        })
        .mockResolvedValueOnce({
          rows: [{
            id: chat.id,
            chat_name: 'Test Chat',
            is_group_chat: false,
            is_community: false,
            avatar: null,
            group_admin: null,
            latest_message_id: null,
            created_at: new Date(),
            updated_at: new Date(),
            participants: [],
          }],
        })
        .mockResolvedValueOnce({
          rows: [{
            id: user1.id,
            first_name: 'Test',
            last_name: 'User',
            email: 'test@example.com',
            avatar: null,
            role: 'user',
          }],
        })
        .mockResolvedValueOnce({ rows: [] }) // Reactions
        .mockResolvedValueOnce({ rows: [] }) // Starred
        .mockResolvedValueOnce({ rows: [] }); // Read by

      mockChatService.getChatById.mockResolvedValue({
        id: chat.id,
        chat_name: 'Test Chat',
        is_group_chat: false,
        is_community: false,
        avatar: null,
        group_admin: null,
        latest_message_id: null,
        created_at: new Date(),
        updated_at: new Date(),
        participants: [],
      });

      const result = await messageService.getMessageById(messageId, user1.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(messageId);
      expect(result.sender).toBeDefined();
    });
  });

  describe('getChatMessages', () => {
    it('should get messages for a chat with pagination', async () => {
      mockChatService.getChatById.mockResolvedValue({
        id: chat.id,
        chat_name: 'Test Chat',
        is_group_chat: false,
        is_community: false,
        avatar: null,
        group_admin: null,
        latest_message_id: null,
        created_at: new Date(),
        updated_at: new Date(),
        participants: [],
      });

      mockQuery
        .mockResolvedValueOnce({
          rows: [{
            id: 'msg-1',
            chat_id: chat.id,
            sender_id: user1.id,
            content: 'Message 1',
            content_type: 'text',
            media_url: null,
            media_thumbnail: null,
            media_size: null,
            media_duration: null,
            is_edited: false,
            edited_at: null,
            is_deleted: false,
            deleted_at: null,
            deleted_by: null,
            is_pinned: false,
            pinned_at: null,
            pinned_by: null,
            replied_to_id: null,
            forwarded_from_id: null,
            forwarded_by: null,
            created_at: new Date(),
            updated_at: new Date(),
          }],
        })
        .mockResolvedValue({
          rows: [{
            id: user1.id,
            first_name: 'Test',
            last_name: 'User',
            email: 'test@example.com',
            avatar: null,
            role: 'user',
          }],
        })
        .mockResolvedValue({ rows: [] })
        .mockResolvedValue({ rows: [] })
        .mockResolvedValue({ rows: [] });

      const result = await messageService.getChatMessages(chat.id, user1.id, 1, 50);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('editMessage', () => {
    it('should edit a message', async () => {
      const messageId = 'msg-123';

      mockQuery
        .mockResolvedValueOnce({
          rows: [{
            id: messageId,
            chat_id: chat.id,
            sender_id: user1.id,
            content: 'Original message',
            content_type: 'text',
            media_url: null,
            media_thumbnail: null,
            media_size: null,
            media_duration: null,
            is_edited: false,
            edited_at: null,
            is_deleted: false,
            deleted_at: null,
            deleted_by: null,
            is_pinned: false,
            pinned_at: null,
            pinned_by: null,
            replied_to_id: null,
            forwarded_from_id: null,
            forwarded_by: null,
            created_at: new Date(),
            updated_at: new Date(),
          }],
        })
        .mockResolvedValueOnce({ rows: [] }) // Update query
        .mockResolvedValue({
          rows: [{
            id: messageId,
            chat_id: chat.id,
            sender_id: user1.id,
            content: 'Edited message',
            content_type: 'text',
            media_url: null,
            media_thumbnail: null,
            media_size: null,
            media_duration: null,
            is_edited: true,
            edited_at: new Date(),
            is_deleted: false,
            deleted_at: null,
            deleted_by: null,
            is_pinned: false,
            pinned_at: null,
            pinned_by: null,
            replied_to_id: null,
            forwarded_from_id: null,
            forwarded_by: null,
            created_at: new Date(),
            updated_at: new Date(),
          }],
        })
        .mockResolvedValue({
          rows: [{
            id: user1.id,
            first_name: 'Test',
            last_name: 'User',
            email: 'test@example.com',
            avatar: null,
            role: 'user',
          }],
        })
        .mockResolvedValue({ rows: [] })
        .mockResolvedValue({ rows: [] })
        .mockResolvedValue({ rows: [] });

      mockChatService.getChatById.mockResolvedValue({
        id: chat.id,
        chat_name: 'Test Chat',
        is_group_chat: false,
        is_community: false,
        avatar: null,
        group_admin: null,
        latest_message_id: null,
        created_at: new Date(),
        updated_at: new Date(),
        participants: [],
      });

      const result = await messageService.editMessage(messageId, user1.id, 'user', 'Edited message');

      expect(result).toBeDefined();
      expect(result.is_edited).toBe(true);
    });

    it('should throw error if user is not sender or admin', async () => {
      const messageId = 'msg-123';

      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: messageId,
          chat_id: chat.id,
          sender_id: user2.id, // Different sender
          content: 'Original',
          content_type: 'text',
          media_url: null,
          media_thumbnail: null,
          media_size: null,
          media_duration: null,
          is_edited: false,
          edited_at: null,
          is_deleted: false,
          deleted_at: null,
          deleted_by: null,
          is_pinned: false,
          pinned_at: null,
          pinned_by: null,
          replied_to_id: null,
          forwarded_from_id: null,
          forwarded_by: null,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      });

      await expect(
        messageService.editMessage(messageId, user1.id, 'user', 'Edited')
      ).rejects.toThrow(ApiError);
    });
  });

  describe('deleteMessage', () => {
    it('should soft delete a message', async () => {
      const messageId = 'msg-123';
      const mockClient = {
        query: jest.fn(),
      };
      mockTransaction.mockImplementation(async (callback) => {
        return callback(mockClient as any);
      });

      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: messageId,
          chat_id: chat.id,
          sender_id: user1.id,
          content: 'Original',
          content_type: 'text',
          media_url: null,
          media_thumbnail: null,
          media_size: null,
          media_duration: null,
          is_edited: false,
          edited_at: null,
          is_deleted: false,
          deleted_at: null,
          deleted_by: null,
          is_pinned: false,
          pinned_at: null,
          pinned_by: null,
          replied_to_id: null,
          forwarded_from_id: null,
          forwarded_by: null,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      });

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // Soft delete
        .mockResolvedValueOnce({
          rows: [{ latest_message_id: messageId }],
        })
        .mockResolvedValueOnce({ rows: [] }); // Find new latest

      mockQuery.mockResolvedValue({
        rows: [{
          id: messageId,
          chat_id: chat.id,
          sender_id: user1.id,
          content: 'This message was deleted',
          content_type: 'deleted',
          media_url: null,
          media_thumbnail: null,
          media_size: null,
          media_duration: null,
          is_edited: false,
          edited_at: null,
          is_deleted: true,
          deleted_at: new Date(),
          deleted_by: user1.id,
          is_pinned: false,
          pinned_at: null,
          pinned_by: null,
          replied_to_id: null,
          forwarded_from_id: null,
          forwarded_by: null,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      }).mockResolvedValue({
        rows: [{
          id: user1.id,
          first_name: 'Test',
          last_name: 'User',
          email: 'test@example.com',
          avatar: null,
          role: 'user',
        }],
      }).mockResolvedValue({ rows: [] })
      .mockResolvedValue({ rows: [] })
      .mockResolvedValue({ rows: [] });

      mockChatService.getChatById.mockResolvedValue({
        id: chat.id,
        chat_name: 'Test Chat',
        is_group_chat: false,
        is_community: false,
        avatar: null,
        group_admin: null,
        latest_message_id: null,
        created_at: new Date(),
        updated_at: new Date(),
        participants: [],
      });

      const result = await messageService.deleteMessage(messageId, user1.id, 'user');

      expect(result).toBeDefined();
      expect(result.is_deleted).toBe(true);
      expect(mockTransaction).toHaveBeenCalled();
    });
  });

  describe('toggleReaction', () => {
    it('should add a reaction to a message', async () => {
      const messageId = 'msg-123';

      mockQuery
        .mockResolvedValueOnce({
          rows: [{
            id: messageId,
            chat_id: chat.id,
            sender_id: user1.id,
            content: 'Test',
            content_type: 'text',
            media_url: null,
            media_thumbnail: null,
            media_size: null,
            media_duration: null,
            is_edited: false,
            edited_at: null,
            is_deleted: false,
            deleted_at: null,
            deleted_by: null,
            is_pinned: false,
            pinned_at: null,
            pinned_by: null,
            replied_to_id: null,
            forwarded_from_id: null,
            forwarded_by: null,
            created_at: new Date(),
            updated_at: new Date(),
          }],
        })
        .mockResolvedValueOnce({ rows: [] }) // Check existing reaction
        .mockResolvedValueOnce({ rows: [] }) // Insert reaction
        .mockResolvedValue({
          rows: [{
            id: messageId,
            chat_id: chat.id,
            sender_id: user1.id,
            content: 'Test',
            content_type: 'text',
            media_url: null,
            media_thumbnail: null,
            media_size: null,
            media_duration: null,
            is_edited: false,
            edited_at: null,
            is_deleted: false,
            deleted_at: null,
            deleted_by: null,
            is_pinned: false,
            pinned_at: null,
            pinned_by: null,
            replied_to_id: null,
            forwarded_from_id: null,
            forwarded_by: null,
            created_at: new Date(),
            updated_at: new Date(),
          }],
        })
        .mockResolvedValue({
          rows: [{
            id: user1.id,
            first_name: 'Test',
            last_name: 'User',
            email: 'test@example.com',
            avatar: null,
            role: 'user',
          }],
        })
        .mockResolvedValue({ rows: [] })
        .mockResolvedValue({ rows: [{ emoji: '👍', user_id: user1.id }] })
        .mockResolvedValue({ rows: [] })
        .mockResolvedValue({ rows: [] });

      mockChatService.getChatById.mockResolvedValue({
        id: chat.id,
        chat_name: 'Test Chat',
        is_group_chat: false,
        is_community: false,
        avatar: null,
        group_admin: null,
        latest_message_id: null,
        created_at: new Date(),
        updated_at: new Date(),
        participants: [],
      });

      const result = await messageService.toggleReaction(messageId, user1.id, '👍');

      expect(result).toBeDefined();
      expect(mockQuery).toHaveBeenCalled();
    });

    it('should remove a reaction if it already exists', async () => {
      const messageId = 'msg-123';

      mockQuery
        .mockResolvedValueOnce({
          rows: [{
            id: messageId,
            chat_id: chat.id,
            sender_id: user1.id,
            content: 'Test',
            content_type: 'text',
            media_url: null,
            media_thumbnail: null,
            media_size: null,
            media_duration: null,
            is_edited: false,
            edited_at: null,
            is_deleted: false,
            deleted_at: null,
            deleted_by: null,
            is_pinned: false,
            pinned_at: null,
            pinned_by: null,
            replied_to_id: null,
            forwarded_from_id: null,
            forwarded_by: null,
            created_at: new Date(),
            updated_at: new Date(),
          }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 'reaction-1' }], // Reaction exists
        })
        .mockResolvedValueOnce({ rows: [] }) // Delete reaction
        .mockResolvedValue({
          rows: [{
            id: messageId,
            chat_id: chat.id,
            sender_id: user1.id,
            content: 'Test',
            content_type: 'text',
            media_url: null,
            media_thumbnail: null,
            media_size: null,
            media_duration: null,
            is_edited: false,
            edited_at: null,
            is_deleted: false,
            deleted_at: null,
            deleted_by: null,
            is_pinned: false,
            pinned_at: null,
            pinned_by: null,
            replied_to_id: null,
            forwarded_from_id: null,
            forwarded_by: null,
            created_at: new Date(),
            updated_at: new Date(),
          }],
        })
        .mockResolvedValue({
          rows: [{
            id: user1.id,
            first_name: 'Test',
            last_name: 'User',
            email: 'test@example.com',
            avatar: null,
            role: 'user',
          }],
        })
        .mockResolvedValue({ rows: [] })
        .mockResolvedValue({ rows: [] })
        .mockResolvedValue({ rows: [] });

      mockChatService.getChatById.mockResolvedValue({
        id: chat.id,
        chat_name: 'Test Chat',
        is_group_chat: false,
        is_community: false,
        avatar: null,
        group_admin: null,
        latest_message_id: null,
        created_at: new Date(),
        updated_at: new Date(),
        participants: [],
      });

      const result = await messageService.toggleReaction(messageId, user1.id, '👍');

      expect(result).toBeDefined();
      expect(mockQuery).toHaveBeenCalled();
    });
  });

  describe('togglePinMessage', () => {
    it('should pin a message', async () => {
      const messageId = 'msg-123';

      mockQuery
        .mockResolvedValueOnce({
          rows: [{
            id: messageId,
            chat_id: chat.id,
            sender_id: user1.id,
            content: 'Test',
            content_type: 'text',
            media_url: null,
            media_thumbnail: null,
            media_size: null,
            media_duration: null,
            is_edited: false,
            edited_at: null,
            is_deleted: false,
            deleted_at: null,
            deleted_by: null,
            is_pinned: false,
            pinned_at: null,
            pinned_by: null,
            replied_to_id: null,
            forwarded_from_id: null,
            forwarded_by: null,
            created_at: new Date(),
            updated_at: new Date(),
          }],
        })
        .mockResolvedValueOnce({ rows: [] }) // Update pin
        .mockResolvedValue({
          rows: [{
            id: messageId,
            chat_id: chat.id,
            sender_id: user1.id,
            content: 'Test',
            content_type: 'text',
            media_url: null,
            media_thumbnail: null,
            media_size: null,
            media_duration: null,
            is_edited: false,
            edited_at: null,
            is_deleted: false,
            deleted_at: null,
            deleted_by: null,
            is_pinned: true,
            pinned_at: new Date(),
            pinned_by: user1.id,
            replied_to_id: null,
            forwarded_from_id: null,
            forwarded_by: null,
            created_at: new Date(),
            updated_at: new Date(),
          }],
        })
        .mockResolvedValue({
          rows: [{
            id: user1.id,
            first_name: 'Test',
            last_name: 'User',
            email: 'test@example.com',
            avatar: null,
            role: 'user',
          }],
        })
        .mockResolvedValue({ rows: [] })
        .mockResolvedValue({ rows: [] })
        .mockResolvedValue({ rows: [] });

      mockChatService.getChatById.mockResolvedValue({
        id: chat.id,
        chat_name: 'Test Chat',
        is_group_chat: false,
        is_community: false,
        avatar: null,
        group_admin: null,
        latest_message_id: null,
        created_at: new Date(),
        updated_at: new Date(),
        participants: [],
      });

      const result = await messageService.togglePinMessage(messageId, user1.id);

      expect(result).toBeDefined();
      expect(result.is_pinned).toBe(true);
    });
  });

  describe('toggleStarMessage', () => {
    it('should star a message', async () => {
      const messageId = 'msg-123';

      mockQuery
        .mockResolvedValueOnce({
          rows: [{
            id: messageId,
            chat_id: chat.id,
            sender_id: user1.id,
            content: 'Test',
            content_type: 'text',
            media_url: null,
            media_thumbnail: null,
            media_size: null,
            media_duration: null,
            is_edited: false,
            edited_at: null,
            is_deleted: false,
            deleted_at: null,
            deleted_by: null,
            is_pinned: false,
            pinned_at: null,
            pinned_by: null,
            replied_to_id: null,
            forwarded_from_id: null,
            forwarded_by: null,
            created_at: new Date(),
            updated_at: new Date(),
          }],
        })
        .mockResolvedValueOnce({ rows: [] }) // Check starred
        .mockResolvedValueOnce({ rows: [] }) // Insert star
        .mockResolvedValue({
          rows: [{
            id: messageId,
            chat_id: chat.id,
            sender_id: user1.id,
            content: 'Test',
            content_type: 'text',
            media_url: null,
            media_thumbnail: null,
            media_size: null,
            media_duration: null,
            is_edited: false,
            edited_at: null,
            is_deleted: false,
            deleted_at: null,
            deleted_by: null,
            is_pinned: false,
            pinned_at: null,
            pinned_by: null,
            replied_to_id: null,
            forwarded_from_id: null,
            forwarded_by: null,
            created_at: new Date(),
            updated_at: new Date(),
          }],
        })
        .mockResolvedValue({
          rows: [{
            id: user1.id,
            first_name: 'Test',
            last_name: 'User',
            email: 'test@example.com',
            avatar: null,
            role: 'user',
          }],
        })
        .mockResolvedValue({ rows: [] })
        .mockResolvedValue({ rows: [] })
        .mockResolvedValue({ rows: [{ id: 'star-1' }] }); // Starred

      mockChatService.getChatById.mockResolvedValue({
        id: chat.id,
        chat_name: 'Test Chat',
        is_group_chat: false,
        is_community: false,
        avatar: null,
        group_admin: null,
        latest_message_id: null,
        created_at: new Date(),
        updated_at: new Date(),
        participants: [],
      });

      const result = await messageService.toggleStarMessage(messageId, user1.id);

      expect(result).toBeDefined();
      expect(result.is_starred).toBe(true);
    });
  });

  describe('markMessageAsRead', () => {
    it('should mark message as read', async () => {
      const messageId = 'msg-123';

      mockQuery
        .mockResolvedValueOnce({
          rows: [{
            id: messageId,
            chat_id: chat.id,
            sender_id: user1.id,
            content: 'Test',
            content_type: 'text',
            media_url: null,
            media_thumbnail: null,
            media_size: null,
            media_duration: null,
            is_edited: false,
            edited_at: null,
            is_deleted: false,
            deleted_at: null,
            deleted_by: null,
            is_pinned: false,
            pinned_at: null,
            pinned_by: null,
            replied_to_id: null,
            forwarded_from_id: null,
            forwarded_by: null,
            created_at: new Date(),
            updated_at: new Date(),
          }],
        })
        .mockResolvedValueOnce({ rows: [] }); // Insert read receipt

      mockChatService.getChatById.mockResolvedValue({
        id: chat.id,
        chat_name: 'Test Chat',
        is_group_chat: false,
        is_community: false,
        avatar: null,
        group_admin: null,
        latest_message_id: null,
        created_at: new Date(),
        updated_at: new Date(),
        participants: [],
      });

      await messageService.markMessageAsRead(messageId, user2.id);

      expect(mockQuery).toHaveBeenCalled();
    });
  });

  describe('markChatAsRead', () => {
    it('should mark all messages in chat as read', async () => {
      mockChatService.getChatById.mockResolvedValue({
        id: chat.id,
        chat_name: 'Test Chat',
        is_group_chat: false,
        is_community: false,
        avatar: null,
        group_admin: null,
        latest_message_id: null,
        created_at: new Date(),
        updated_at: new Date(),
        participants: [],
      });

      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // Mark messages as read
        .mockResolvedValueOnce({ rows: [] }); // Reset unread count

      mockChatService.resetUnreadCount.mockResolvedValue();

      await messageService.markChatAsRead(chat.id, user2.id);

      expect(mockQuery).toHaveBeenCalled();
      expect(mockChatService.resetUnreadCount).toHaveBeenCalledWith(chat.id, user2.id);
    });
  });

  describe('uploadMedia', () => {
    it('should upload media file', async () => {
      const buffer = Buffer.from('test file content');
      const originalName = 'test.jpg';
      const mimeType = 'image/jpeg';

      mockR2Service.upload.mockResolvedValue({
        key: 'media/test.jpg',
        url: 'https://r2.example.com/media/test.jpg',
        size: buffer.length,
        mimeType,
        originalName,
        publicUrl: 'https://r2.example.com/media/test.jpg',
      });

      const result = await messageService.uploadMedia(
        buffer,
        originalName,
        mimeType,
        user1.id,
        'image'
      );

      expect(result).toBeDefined();
      expect(result.mediaUrl).toBeDefined();
      expect(result.mediaSize).toBe(buffer.length);
      expect(mockR2Service.upload).toHaveBeenCalled();
    });
  });
});

