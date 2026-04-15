/**
 * @file Chat Cache Service
 * @description Caching layer for chats and messages with proper invalidation
 */

import { cache } from './cache.service.js';
import { logger } from './logger.service.js';

// Cache TTL constants (in seconds)
const CACHE_TTL = {
  CHAT_LIST: 300,      // 5 minutes
  CHAT_DETAIL: 600,    // 10 minutes
  MESSAGES: 300,       // 5 minutes
  MESSAGE: 900,        // 15 minutes
} as const;

/**
 * Cache key generators for chat-related data
 */
export const chatCacheKeys = {
  chatList: (userId: string, isAdmin: boolean = false) => 
    `chat:list:${userId}:${isAdmin ? 'admin' : 'user'}`,
  
  chatDetail: (chatId: string) => 
    `chat:detail:${chatId}`,
  
  messages: (chatId: string, page: number = 1, limit: number = 50) => 
    `messages:${chatId}:page:${page}:limit:${limit}`,
  
  message: (messageId: string) => 
    `message:${messageId}`,
  
  chatParticipants: (chatId: string) => 
    `chat:participants:${chatId}`,
  
  unreadCount: (userId: string, chatId: string) => 
    `chat:unread:${userId}:${chatId}`,
};

class ChatCacheService {
  private static instance: ChatCacheService;

  private constructor() {}

  public static getInstance(): ChatCacheService {
    if (!ChatCacheService.instance) {
      ChatCacheService.instance = new ChatCacheService();
    }
    return ChatCacheService.instance;
  }

  /**
   * Get or set chat list for a user
   */
  public async getOrSetChatList<T>(
    userId: string,
    isAdmin: boolean,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const key = chatCacheKeys.chatList(userId, isAdmin);
    return cache.getOrSet(key, factory, ttl ?? CACHE_TTL.CHAT_LIST);
  }

  /**
   * Get or set chat details
   */
  public async getOrSetChatDetail<T>(
    chatId: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const key = chatCacheKeys.chatDetail(chatId);
    return cache.getOrSet(key, factory, ttl ?? CACHE_TTL.CHAT_DETAIL);
  }

  /**
   * Get or set messages for a chat
   */
  public async getOrSetMessages<T>(
    chatId: string,
    page: number,
    limit: number,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const key = chatCacheKeys.messages(chatId, page, limit);
    return cache.getOrSet(key, factory, ttl ?? CACHE_TTL.MESSAGES);
  }

  /**
   * Get or set single message
   */
  public async getOrSetMessage<T>(
    messageId: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const key = chatCacheKeys.message(messageId);
    return cache.getOrSet(key, factory, ttl ?? CACHE_TTL.MESSAGE);
  }

  /**
   * Invalidate chat list cache for user(s)
   */
  public invalidateChatList(userIds: string[]): void {
    const keys: string[] = [];
    for (const userId of userIds) {
      keys.push(chatCacheKeys.chatList(userId, false));
      keys.push(chatCacheKeys.chatList(userId, true));
    }
    const deleted = cache.delete(keys);
    if (deleted > 0) {
      logger.debug('Invalidated chat list cache', { userIds, deleted });
    }
  }

  /**
   * Invalidate chat detail cache
   */
  public invalidateChatDetail(chatIds: string[]): void {
    const keys = chatIds.map(id => chatCacheKeys.chatDetail(id));
    const deleted = cache.delete(keys);
    if (deleted > 0) {
      logger.debug('Invalidated chat detail cache', { chatIds, deleted });
    }
  }

  /**
   * Invalidate messages cache for a chat
   */
  public invalidateMessages(chatId: string): void {
    // Delete all message pages for this chat
    const pattern = new RegExp(`^messages:${chatId}:`);
    const deleted = cache.deleteByPattern(pattern);
    if (deleted > 0) {
      logger.debug('Invalidated messages cache', { chatId, deleted });
    }
  }

  /**
   * Invalidate single message cache
   */
  public invalidateMessage(messageIds: string[]): void {
    const keys = messageIds.map(id => chatCacheKeys.message(id));
    const deleted = cache.delete(keys);
    if (deleted > 0) {
      logger.debug('Invalidated message cache', { messageIds, deleted });
    }
  }

  /**
   * Invalidate chat participants cache
   */
  public invalidateChatParticipants(chatIds: string[]): void {
    const keys = chatIds.map(id => chatCacheKeys.chatParticipants(id));
    const deleted = cache.delete(keys);
    if (deleted > 0) {
      logger.debug('Invalidated chat participants cache', { chatIds, deleted });
    }
  }

  /**
   * Invalidate unread count cache
   */
  public invalidateUnreadCount(userId: string, chatId?: string): void {
    if (chatId) {
      const key = chatCacheKeys.unreadCount(userId, chatId);
      cache.delete(key);
    } else {
      // Invalidate all unread counts for user
      const pattern = new RegExp(`^chat:unread:${userId}:`);
      cache.deleteByPattern(pattern);
    }
  }

  /**
   * Invalidate all chat-related cache for a user
   */
  public invalidateUserChatCache(userId: string): void {
    this.invalidateChatList([userId]);
    this.invalidateUnreadCount(userId);
    logger.debug('Invalidated all chat cache for user', { userId });
  }

  /**
   * Invalidate all cache related to a chat
   */
  public invalidateChatCache(chatId: string, userIds?: string[]): void {
    this.invalidateChatDetail([chatId]);
    this.invalidateMessages(chatId);
    this.invalidateChatParticipants([chatId]);
    
    if (userIds && userIds.length > 0) {
      this.invalidateChatList(userIds);
      userIds.forEach(userId => this.invalidateUnreadCount(userId, chatId));
    }
    
    logger.debug('Invalidated all cache for chat', { chatId, userIds });
  }
}

export const chatCacheService = ChatCacheService.getInstance();
export default chatCacheService;

