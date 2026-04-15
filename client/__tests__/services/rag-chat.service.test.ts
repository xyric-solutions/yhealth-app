/**
 * @file RAG Chat Service (Client) - Unit Tests
 * @description Senior-level unit tests for client-side service
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { ragChatService } from '@/src/shared/services/rag-chat.service';
import { api } from '@/lib/api-client';

// Mock API client
jest.mock('@/lib/api-client', () => ({
  api: {
    post: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
  },
}));

const mockApi = api as jest.Mocked<typeof api>;

describe('RAG Chat Service (Client) – Unit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendMessage', () => {
    const message = 'What is my recovery score?';
    const conversationId = 'conv-123';

    test('throws error for empty message', async () => {
      await expect(
        ragChatService.sendMessage({ message: '', conversationId })
      ).rejects.toThrow();
    });

    test('sends correct request structure to API', async () => {
      const mockResponse = {
        success: true,
        data: {
          conversationId: 'conv-123',
          message: 'Your recovery score is 85.',
          messageId: 'msg-123',
        },
      };

      mockApi.post.mockResolvedValue(mockResponse as any);

      const result = await ragChatService.sendMessage({ message, conversationId });

      expect(mockApi.post).toHaveBeenCalledWith(
        '/rag-chat/message',
        expect.objectContaining({
          message,
          conversationId,
        })
      );

      expect(result.conversationId).toBe('conv-123');
      expect(result.message).toBe('Your recovery score is 85.');
    });

    test('handles API error response', async () => {
      const mockError = {
        success: false,
        error: {
          message: 'Rate limit exceeded',
          code: 'RATE_LIMIT',
        },
      };

      mockApi.post.mockResolvedValue(mockError as any);

      await expect(
        ragChatService.sendMessage({ message, conversationId })
      ).rejects.toThrow();
    });
  });

  describe('createConversation', () => {
    test('creates conversation with default parameters', async () => {
      const mockResponse = {
        success: true,
        data: {
          conversationId: 'new-conv-123',
        },
      };

      mockApi.post.mockResolvedValue(mockResponse as any);

      const result = await ragChatService.createConversation();

      expect(mockApi.post).toHaveBeenCalledWith('/rag-chat/conversations', {});
      expect(result.conversationId).toBe('new-conv-123');
    });

    test('creates conversation with session type', async () => {
      const mockResponse = {
        success: true,
        data: {
          conversationId: 'new-conv-123',
        },
      };

      mockApi.post.mockResolvedValue(mockResponse as any);

      await ragChatService.createConversation({
        sessionType: 'coaching_session',
      });

      expect(mockApi.post).toHaveBeenCalledWith(
        '/rag-chat/conversations',
        expect.objectContaining({
          sessionType: 'coaching_session',
        })
      );
    });
  });

  describe('Failure Injection Tests', () => {
    const message = 'Test message';

    test('gracefully handles network failure', async () => {
      const networkError = new Error('Network request failed');
      mockApi.post.mockRejectedValue(networkError);

      await expect(
        ragChatService.sendMessage({ message })
      ).rejects.toThrow('Network request failed');
    });

    test('gracefully handles timeout', async () => {
      mockApi.post.mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), 100)
          )
      );

      await expect(
        ragChatService.sendMessage({ message })
      ).rejects.toThrow('Request timeout');
    });
  });

  describe('Contract Tests', () => {
    const message = 'Test message';

    test('always returns response with conversationId and message', async () => {
      const mockResponse = {
        success: true,
        data: {
          conversationId: 'conv-123',
          message: 'Test response',
          messageId: 'msg-123',
        },
      };

      mockApi.post.mockResolvedValue(mockResponse as any);

      const result = await ragChatService.sendMessage({ message });

      expect(result).toHaveProperty('conversationId');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('messageId');
      expect(typeof result.conversationId).toBe('string');
      expect(typeof result.message).toBe('string');
    });
  });
});

