/// <reference types="jest" />

/**
 * @file Chat Cache Service Unit Tests
 */

import { chatCacheService, chatCacheKeys } from '../../../src/services/chat-cache.service.js';
import { cache } from '../../../src/services/cache.service.js';

describe('ChatCacheService', () => {
  beforeEach(() => {
    // Clear cache before each test
    cache.flush();
  });

  describe('getOrSetChatList', () => {
    it('should call factory and cache result', async () => {
      const userId = 'user-123';
      const factoryData = [{ id: 'chat-1', chat_name: 'Test Chat' }];

      const factory = async () => factoryData;

      const result = await chatCacheService.getOrSetChatList(userId, false, factory);

      expect(result).toEqual(factoryData);
      // Verify it was cached
      const cached = cache.get(chatCacheKeys.chatList(userId, false));
      expect(cached).toEqual(factoryData);
    });

    it('should return cached value if exists', async () => {
      const userId = 'user-123';
      const cachedData = [{ id: 'chat-1', chat_name: 'Test Chat' }];
      
      // Set cache first
      cache.set(chatCacheKeys.chatList(userId, false), cachedData);

      const factory = async () => [{ id: 'chat-2' }];
      const result = await chatCacheService.getOrSetChatList(userId, false, factory);

      expect(result).toEqual(cachedData);
    });
  });

  describe('getOrSetChatDetail', () => {
    it('should call factory and cache result', async () => {
      const chatId = 'chat-123';
      const factoryData = { id: chatId, chat_name: 'Test Chat' };

      const factory = async () => factoryData;
      const result = await chatCacheService.getOrSetChatDetail(chatId, factory);

      expect(result).toEqual(factoryData);
      // Verify it was cached
      const cached = cache.get(chatCacheKeys.chatDetail(chatId));
      expect(cached).toEqual(factoryData);
    });

    it('should return cached value if exists', async () => {
      const chatId = 'chat-123';
      const cachedData = { id: chatId, chat_name: 'Test Chat' };
      
      // Set cache first
      cache.set(chatCacheKeys.chatDetail(chatId), cachedData);

      const factory = async () => ({ id: chatId });
      const result = await chatCacheService.getOrSetChatDetail(chatId, factory);

      expect(result).toEqual(cachedData);
    });
  });

  describe('getOrSetMessages', () => {
    it('should call factory and cache result', async () => {
      const chatId = 'chat-123';
      const page = 1;
      const limit = 50;
      const factoryData = [{ id: 'msg-1' }];

      const factory = async () => factoryData;
      const result = await chatCacheService.getOrSetMessages(chatId, page, limit, factory);

      expect(result).toEqual(factoryData);
      // Verify it was cached
      const cached = cache.get(chatCacheKeys.messages(chatId, page, limit));
      expect(cached).toEqual(factoryData);
    });

    it('should return cached value if exists', async () => {
      const chatId = 'chat-123';
      const page = 1;
      const limit = 50;
      const cachedData = [{ id: 'msg-1' }];
      
      // Set cache first
      cache.set(chatCacheKeys.messages(chatId, page, limit), cachedData);

      const factory = async () => [{ id: 'msg-2' }];
      const result = await chatCacheService.getOrSetMessages(chatId, page, limit, factory);

      expect(result).toEqual(cachedData);
    });
  });

  describe('invalidateChatList', () => {
    it('should invalidate chat list for multiple users', () => {
      const userIds = ['user-1', 'user-2'];
      
      // Set some cache values
      cache.set(chatCacheKeys.chatList(userIds[0], false), []);
      cache.set(chatCacheKeys.chatList(userIds[1], false), []);

      chatCacheService.invalidateChatList(userIds);

      // Verify cache is cleared
      expect(cache.get(chatCacheKeys.chatList(userIds[0], false))).toBeUndefined();
      expect(cache.get(chatCacheKeys.chatList(userIds[1], false))).toBeUndefined();
    });
  });

  describe('invalidateChatDetail', () => {
    it('should invalidate chat detail for multiple chats', () => {
      const chatIds = ['chat-1', 'chat-2'];
      
      // Set cache values
      cache.set(chatCacheKeys.chatDetail(chatIds[0]), { id: chatIds[0] });
      cache.set(chatCacheKeys.chatDetail(chatIds[1]), { id: chatIds[1] });

      chatCacheService.invalidateChatDetail(chatIds);

      // Verify cache is cleared
      expect(cache.get(chatCacheKeys.chatDetail(chatIds[0]))).toBeUndefined();
      expect(cache.get(chatCacheKeys.chatDetail(chatIds[1]))).toBeUndefined();
    });
  });

  describe('invalidateMessages', () => {
    it('should invalidate all message pages for a chat', () => {
      const chatId = 'chat-123';
      
      // Set some cache values
      cache.set(chatCacheKeys.messages(chatId, 1, 50), []);
      cache.set(chatCacheKeys.messages(chatId, 2, 50), []);

      chatCacheService.invalidateMessages(chatId);

      // Verify cache is cleared (deleteByPattern should remove matching keys)
      expect(cache.get(chatCacheKeys.messages(chatId, 1, 50))).toBeUndefined();
    });
  });

  describe('invalidateMessage', () => {
    it('should invalidate specific messages', () => {
      const messageIds = ['msg-1', 'msg-2'];
      
      // Set cache values
      cache.set(chatCacheKeys.message(messageIds[0]), { id: messageIds[0] });
      cache.set(chatCacheKeys.message(messageIds[1]), { id: messageIds[1] });

      chatCacheService.invalidateMessage(messageIds);

      // Verify cache is cleared
      expect(cache.get(chatCacheKeys.message(messageIds[0]))).toBeUndefined();
      expect(cache.get(chatCacheKeys.message(messageIds[1]))).toBeUndefined();
    });
  });

  describe('invalidateChatParticipants', () => {
    it('should invalidate participants cache for chats', () => {
      const chatIds = ['chat-1', 'chat-2'];
      
      // Set cache values
      cache.set(chatCacheKeys.chatParticipants(chatIds[0]), []);
      cache.set(chatCacheKeys.chatParticipants(chatIds[1]), []);

      chatCacheService.invalidateChatParticipants(chatIds);

      // Verify cache is cleared
      expect(cache.get(chatCacheKeys.chatParticipants(chatIds[0]))).toBeUndefined();
      expect(cache.get(chatCacheKeys.chatParticipants(chatIds[1]))).toBeUndefined();
    });
  });

  describe('invalidateUnreadCount', () => {
    it('should invalidate unread count for specific chat', () => {
      const userId = 'user-123';
      const chatId = 'chat-123';
      
      // Set cache value
      cache.set(chatCacheKeys.unreadCount(userId, chatId), 5);

      chatCacheService.invalidateUnreadCount(userId, chatId);

      // Verify cache is cleared
      expect(cache.get(chatCacheKeys.unreadCount(userId, chatId))).toBeUndefined();
    });

    it('should invalidate all unread counts for user if chatId not provided', () => {
      const userId = 'user-123';
      
      // Set cache values
      cache.set(chatCacheKeys.unreadCount(userId, 'chat-1'), 5);
      cache.set(chatCacheKeys.unreadCount(userId, 'chat-2'), 3);

      chatCacheService.invalidateUnreadCount(userId);

      // Verify cache is cleared (deleteByPattern should remove matching keys)
      expect(cache.get(chatCacheKeys.unreadCount(userId, 'chat-1'))).toBeUndefined();
    });
  });

  describe('invalidateUserChatCache', () => {
    it('should invalidate all chat-related cache for a user', () => {
      const userId = 'user-123';
      
      // Set cache values
      cache.set(chatCacheKeys.chatList(userId, false), []);
      cache.set(chatCacheKeys.chatList(userId, true), []);

      chatCacheService.invalidateUserChatCache(userId);

      // Verify cache is cleared
      expect(cache.get(chatCacheKeys.chatList(userId, false))).toBeUndefined();
      expect(cache.get(chatCacheKeys.chatList(userId, true))).toBeUndefined();
    });
  });

  describe('invalidateChatCache', () => {
    it('should invalidate all cache related to a chat', () => {
      const chatId = 'chat-123';
      const userIds = ['user-1', 'user-2'];
      
      // Set cache values
      cache.set(chatCacheKeys.chatDetail(chatId), { id: chatId });
      cache.set(chatCacheKeys.chatParticipants(chatId), []);
      cache.set(chatCacheKeys.chatList(userIds[0], false), []);

      chatCacheService.invalidateChatCache(chatId, userIds);

      // Verify cache is cleared
      expect(cache.get(chatCacheKeys.chatDetail(chatId))).toBeUndefined();
      expect(cache.get(chatCacheKeys.chatParticipants(chatId))).toBeUndefined();
    });
  });

  describe('chatCacheKeys', () => {
    it('should generate correct cache keys', () => {
      expect(chatCacheKeys.chatList('user-1', false)).toBe('chat:list:user-1:user');
      expect(chatCacheKeys.chatList('user-1', true)).toBe('chat:list:user-1:admin');
      expect(chatCacheKeys.chatDetail('chat-1')).toBe('chat:detail:chat-1');
      expect(chatCacheKeys.messages('chat-1', 1, 50)).toBe('messages:chat-1:page:1:limit:50');
      expect(chatCacheKeys.message('msg-1')).toBe('message:msg-1');
      expect(chatCacheKeys.chatParticipants('chat-1')).toBe('chat:participants:chat-1');
      expect(chatCacheKeys.unreadCount('user-1', 'chat-1')).toBe('chat:unread:user-1:chat-1');
    });
  });
});

