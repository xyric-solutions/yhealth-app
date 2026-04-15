/**
 * @file Chat Service Unit Tests
 */

import { chatService } from '../../../src/services/chat.service.js';
import { query, transaction } from '../../../src/database/pg.js';
import { chatCacheService } from '../../../src/services/chat-cache.service.js';
import { ApiError } from '../../../src/utils/ApiError.js';
import {
  createTestUser,
  createTestUsers,
  createTestChat,
  cleanupChatTestData,
} from '../../helpers/chat.testUtils.js';

// Mock dependencies
jest.mock('../../../src/database/pg.js');
jest.mock('../../../src/services/chat-cache.service.js');
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
const mockChatCacheService = chatCacheService as jest.Mocked<typeof chatCacheService>;

describe('ChatService', () => {
  let user1: { id: string };
  let user2: { id: string };
  let user3: { id: string };

  beforeEach(() => {
    jest.clearAllMocks();
    // Setup default mocks
    mockChatCacheService.getOrSetChatDetail.mockImplementation(async (chatId, factory) => {
      return factory();
    });
    mockChatCacheService.getOrSetChatList.mockImplementation(async (userId, isAdmin, factory) => {
      return factory();
    });
    mockChatCacheService.invalidateChatList.mockImplementation(() => {});
    mockChatCacheService.invalidateChatDetail.mockImplementation(() => {});
    mockChatCacheService.invalidateChatParticipants.mockImplementation(() => {});
  });

  describe('createOrGetChat', () => {
    beforeEach(async () => {
      user1 = await createTestUser();
      user2 = await createTestUser();
    });

    it('should create a new one-on-one chat', async () => {
      // Mock transaction
      const mockClient = {
        query: jest.fn(),
      };
      mockTransaction.mockImplementation(async (callback) => {
        return callback(mockClient as any);
      });

      // Mock chat creation
      mockClient.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'chat-123',
            chat_name: 'sender',
            is_group_chat: false,
            is_community: false,
            avatar: null,
            group_admin: null,
            latest_message_id: null,
            created_at: new Date(),
            updated_at: new Date(),
          }],
        })
        .mockResolvedValueOnce({ rows: [] }) // Participants insert
        .mockResolvedValueOnce({ rows: [] }); // Participants insert

      // Mock getChatById
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'chat-123',
          chat_name: 'sender',
          is_group_chat: false,
          is_community: false,
          avatar: null,
          group_admin: null,
          latest_message_id: null,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      }).mockResolvedValueOnce({
        rows: [{
          id: 'cp-1',
          chat_id: 'chat-123',
          user_id: user1.id,
          joined_at: new Date(),
          left_at: null,
          is_blocked: false,
          unread_count: 0,
          last_read_at: null,
        }],
      }).mockResolvedValueOnce({
        rows: [],
      });

      const result = await chatService.createOrGetChat({
        userId: user1.id,
        otherUserId: user2.id,
        isGroupChat: false,
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('chat-123');
      expect(mockTransaction).toHaveBeenCalled();
    });

    it('should throw error if otherUserId is missing for one-on-one chat', async () => {
      await expect(
        chatService.createOrGetChat({
          userId: user1.id,
          isGroupChat: false,
        })
      ).rejects.toThrow(ApiError);
    });

    it('should find existing one-on-one chat', async () => {
      // Mock findOneOnOneChat
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'existing-chat',
          chat_name: 'sender',
          is_group_chat: false,
          is_community: false,
          avatar: null,
          group_admin: null,
          latest_message_id: null,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      }).mockResolvedValueOnce({
        rows: [{
          id: 'existing-chat',
          chat_name: 'sender',
          is_group_chat: false,
          is_community: false,
          avatar: null,
          group_admin: null,
          latest_message_id: null,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      }).mockResolvedValueOnce({
        rows: [],
      }).mockResolvedValueOnce({
        rows: [],
      });

      const result = await chatService.findOneOnOneChat(user1.id, user2.id);

      expect(result).toBeDefined();
      expect(mockQuery).toHaveBeenCalled();
    });
  });

  describe('getChatById', () => {
    beforeEach(async () => {
      user1 = await createTestUser();
    });

    it('should get chat by ID with participants', async () => {
      const chatId = 'chat-123';

      // Mock participant check
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'cp-1',
          chat_id: chatId,
          user_id: user1.id,
          joined_at: new Date(),
          left_at: null,
          is_blocked: false,
          unread_count: 0,
          last_read_at: null,
        }],
      })
      // Mock chat retrieval
      .mockResolvedValueOnce({
        rows: [{
          id: chatId,
          chat_name: 'Test Chat',
          is_group_chat: false,
          is_community: false,
          avatar: null,
          group_admin: null,
          latest_message_id: null,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      })
      // Mock participants with user info
      .mockResolvedValueOnce({
        rows: [{
          id: 'cp-1',
          chat_id: chatId,
          user_id: user1.id,
          joined_at: new Date(),
          left_at: null,
          is_blocked: false,
          unread_count: 0,
          last_read_at: null,
          user: {
            id: user1.id,
            first_name: 'Test',
            last_name: 'User',
            email: 'test@example.com',
            avatar: null,
            role: 'user',
          },
        }],
      })
      // Mock latest message (none)
      .mockResolvedValueOnce({
        rows: [],
      });

      const result = await chatService.getChatById(chatId, user1.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(chatId);
      expect(result.participants).toBeDefined();
    });

    it('should throw error if user is not a participant', async () => {
      const chatId = 'chat-123';

      // Mock participant check - no participants
      mockQuery.mockResolvedValueOnce({
        rows: [],
      });

      await expect(
        chatService.getChatById(chatId, user1.id)
      ).rejects.toThrow(ApiError);
    });
  });

  describe('getUserChats', () => {
    beforeEach(async () => {
      user1 = await createTestUser();
    });

    it('should get user chats with pagination', async () => {
      // Mock chat list query
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'chat-1',
          chat_name: 'Chat 1',
          is_group_chat: false,
          is_community: false,
          avatar: null,
          group_admin: null,
          latest_message_id: null,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      });

      // Mock getChatById for each chat
      mockQuery.mockResolvedValue({
        rows: [{
          id: 'chat-1',
          chat_name: 'Chat 1',
          is_group_chat: false,
          is_community: false,
          avatar: null,
          group_admin: null,
          latest_message_id: null,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      }).mockResolvedValue({
        rows: [{
          id: 'cp-1',
          chat_id: 'chat-1',
          user_id: user1.id,
          joined_at: new Date(),
          left_at: null,
          is_blocked: false,
          unread_count: 0,
          last_read_at: null,
        }],
      }).mockResolvedValue({
        rows: [],
      });

      const result = await chatService.getUserChats(user1.id, false, 1, 50);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('createGroupChat', () => {
    beforeEach(async () => {
      user1 = await createTestUser();
      user2 = await createTestUser();
      user3 = await createTestUser();
    });

    it('should create a group chat with multiple users', async () => {
      const mockClient = {
        query: jest.fn(),
      };
      mockTransaction.mockImplementation(async (callback) => {
        return callback(mockClient as any);
      });

      mockClient.query
        .mockResolvedValueOnce({
          rows: [{
            id: 'group-chat-123',
            chat_name: 'Test Group',
            is_group_chat: true,
            is_community: false,
            avatar: null,
            group_admin: user1.id,
            latest_message_id: null,
            created_at: new Date(),
            updated_at: new Date(),
          }],
        })
        .mockResolvedValue({ rows: [] }); // Participant inserts

      // Mock getChatById
      mockQuery.mockResolvedValue({
        rows: [{
          id: 'group-chat-123',
          chat_name: 'Test Group',
          is_group_chat: true,
          is_community: false,
          avatar: null,
          group_admin: user1.id,
          latest_message_id: null,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      }).mockResolvedValue({
        rows: [],
      }).mockResolvedValue({
        rows: [],
      });

      const result = await chatService.createGroupChat({
        userId: user1.id,
        chatName: 'Test Group',
        userIds: [user2.id, user3.id],
        isGroupChat: true,
      });

      expect(result).toBeDefined();
      expect(mockTransaction).toHaveBeenCalled();
    });

    it('should throw error if chat name is missing', async () => {
      await expect(
        chatService.createGroupChat({
          userId: user1.id,
          userIds: [user2.id],
          isGroupChat: true,
        })
      ).rejects.toThrow(ApiError);
    });

    it('should throw error if less than 2 users', async () => {
      await expect(
        chatService.createGroupChat({
          userId: user1.id,
          chatName: 'Test Group',
          userIds: [user2.id],
          isGroupChat: true,
        })
      ).rejects.toThrow(ApiError);
    });
  });

  describe('addUserToGroup', () => {
    beforeEach(async () => {
      user1 = await createTestUser();
      user2 = await createTestUser();
    });

    it('should add user to group chat', async () => {
      const chatId = 'group-chat-123';

      // Mock getChatById (verification)
      mockQuery.mockResolvedValue({
        rows: [{
          id: chatId,
          chat_name: 'Test Group',
          is_group_chat: true,
          is_community: false,
          avatar: null,
          group_admin: user1.id,
          latest_message_id: null,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      }).mockResolvedValue({
        rows: [{
          id: 'cp-1',
          chat_id: chatId,
          user_id: user1.id,
          joined_at: new Date(),
          left_at: null,
          is_blocked: false,
          unread_count: 0,
          last_read_at: null,
        }],
      }).mockResolvedValue({
        rows: [],
      })
      // Mock add user query
      .mockResolvedValue({
        rows: [],
      })
      // Mock getChatById (return)
      .mockResolvedValue({
        rows: [{
          id: chatId,
          chat_name: 'Test Group',
          is_group_chat: true,
          is_community: false,
          avatar: null,
          group_admin: user1.id,
          latest_message_id: null,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      }).mockResolvedValue({
        rows: [],
      }).mockResolvedValue({
        rows: [],
      });

      const result = await chatService.addUserToGroup(chatId, user2.id, user1.id);

      expect(result).toBeDefined();
      expect(mockQuery).toHaveBeenCalled();
    });
  });

  describe('removeUserFromGroup', () => {
    beforeEach(async () => {
      user1 = await createTestUser();
      user2 = await createTestUser();
    });

    it('should remove user from group chat', async () => {
      const chatId = 'group-chat-123';

      // Mock getChatById (verification)
      mockQuery.mockResolvedValue({
        rows: [{
          id: chatId,
          chat_name: 'Test Group',
          is_group_chat: true,
          is_community: false,
          avatar: null,
          group_admin: user1.id,
          latest_message_id: null,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      }).mockResolvedValue({
        rows: [{
          id: 'cp-1',
          chat_id: chatId,
          user_id: user1.id,
          joined_at: new Date(),
          left_at: null,
          is_blocked: false,
          unread_count: 0,
          last_read_at: null,
        }],
      }).mockResolvedValue({
        rows: [],
      })
      // Mock remove user query
      .mockResolvedValue({
        rows: [],
      })
      // Mock getChatById (return)
      .mockResolvedValue({
        rows: [{
          id: chatId,
          chat_name: 'Test Group',
          is_group_chat: true,
          is_community: false,
          avatar: null,
          group_admin: user1.id,
          latest_message_id: null,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      }).mockResolvedValue({
        rows: [],
      }).mockResolvedValue({
        rows: [],
      });

      const result = await chatService.removeUserFromGroup(chatId, user2.id, user1.id);

      expect(result).toBeDefined();
      expect(mockQuery).toHaveBeenCalled();
    });
  });

  describe('addUserToCommunityGroup', () => {
    beforeEach(async () => {
      user1 = await createTestUser();
    });

    it('should add user to community group', async () => {
      // Mock community group exists
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 'community-chat',
          chat_name: 'YHealth Community',
          is_group_chat: true,
          is_community: true,
          avatar: null,
          group_admin: null,
          latest_message_id: null,
          created_at: new Date(),
          updated_at: new Date(),
        }],
      })
      // Mock add participant
      .mockResolvedValueOnce({
        rows: [],
      });

      await chatService.addUserToCommunityGroup(user1.id);

      expect(mockQuery).toHaveBeenCalled();
    });

    it('should skip if community group does not exist', async () => {
      // Mock no community group
      mockQuery.mockResolvedValueOnce({
        rows: [],
      });

      await chatService.addUserToCommunityGroup(user1.id);

      // Should not throw, just skip
      expect(mockQuery).toHaveBeenCalled();
    });
  });

  afterEach(async () => {
    // Cleanup is handled by individual test cleanup
  });
});

