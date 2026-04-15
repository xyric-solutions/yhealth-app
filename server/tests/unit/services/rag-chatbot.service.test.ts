/**
 * @file RAG Chatbot Service - Unit Tests
 * @description Senior-level unit tests with proper mocking and failure injection
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { RAGChatbotService } from '../../../src/services/rag-chatbot.service.js';
import { createMockQuery, waitForAsync } from '../../helpers/test-utils.js';

// Mock all external dependencies
jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn(),
    stream: jest.fn(),
  })),
}));

jest.mock('../../../src/services/vector-embedding.service.js', () => ({
  vectorEmbeddingService: {
    searchKnowledge: jest.fn(),
    searchUserProfile: jest.fn(),
    searchConversationHistory: jest.fn(),
  },
}));

jest.mock('../../../src/database/pg.js', () => ({
  query: jest.fn(),
}));

jest.mock('../../../src/services/logger.service.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../../src/config/env.config.js', () => ({
  env: {
    openai: {
      apiKey: 'test-api-key',
    },
  },
}));

import { ChatOpenAI } from '@langchain/openai';
import { vectorEmbeddingService } from '../../../src/services/vector-embedding.service.js';
import { query } from '../../../src/database/pg.js';

describe('RAG Chatbot Service – Unit', () => {
  let service: RAGChatbotService;
  let mockLLM: jest.Mocked<ChatOpenAI>;
  const mockVectorService = vectorEmbeddingService as jest.Mocked<typeof vectorEmbeddingService>;
  const mockQuery = query as jest.MockedFunction<typeof query>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup LLM mock
    const mockInvoke = jest.fn();
    mockLLM = {
      invoke: mockInvoke,
    } as any;

    (ChatOpenAI as jest.Mock).mockImplementation(() => mockLLM);

    service = new RAGChatbotService();
  });

  describe('chat', () => {
    const userId = 'test-user-123';
    const message = 'What is my current recovery score?';

    test('throws error for empty message', async () => {
      await expect(
        service.chat({ userId, message: '' })
      ).rejects.toThrow();
    });

    test('throws error for missing userId', async () => {
      await expect(
        service.chat({ userId: '', message })
      ).rejects.toThrow();
    });

    test('retrieves relevant context from vector search', async () => {
      mockVectorService.searchKnowledge.mockResolvedValue([
        { content: 'Recovery score ranges from 0-100', category: 'health', similarity: 0.9 },
      ]);
      mockVectorService.searchUserProfile.mockResolvedValue([
        { section: 'goals', content: 'Improve recovery', similarity: 0.8 },
      ]);
      mockVectorService.searchConversationHistory.mockResolvedValue([]);

      mockQuery.mockResolvedValue([]); // No existing conversation
      mockLLM.invoke.mockResolvedValue({
        content: 'Your recovery score is 85.',
      } as any);

      const result = await service.chat({ userId, message });

      expect(mockVectorService.searchKnowledge).toHaveBeenCalled();
      expect(mockVectorService.searchUserProfile).toHaveBeenCalled();
      expect(result.response).toContain('recovery');
    });

    test('creates new conversation when conversationId not provided', async () => {
      mockVectorService.searchKnowledge.mockResolvedValue([]);
      mockVectorService.searchUserProfile.mockResolvedValue([]);
      mockVectorService.searchConversationHistory.mockResolvedValue([]);

      mockQuery
        .mockResolvedValueOnce([]) // Check existing conversation
        .mockResolvedValueOnce([{ id: 'new-conv-123' }]) // Create conversation
        .mockResolvedValueOnce([{ id: 'msg-123' }]); // Save message

      mockLLM.invoke.mockResolvedValue({
        content: 'Hello!',
      } as any);

      const result = await service.chat({ userId, message });

      expect(result.conversationId).toBeDefined();
      expect(mockQuery).toHaveBeenCalledTimes(3); // Check, create, save
    });

    test('uses existing conversation when conversationId provided', async () => {
      const conversationId = 'existing-conv-123';

      mockVectorService.searchKnowledge.mockResolvedValue([]);
      mockVectorService.searchUserProfile.mockResolvedValue([]);
      mockVectorService.searchConversationHistory.mockResolvedValue([
        { content: 'Previous message', similarity: 0.7 },
      ]);

      mockQuery
        .mockResolvedValueOnce([{ id: conversationId }]) // Get conversation
        .mockResolvedValueOnce([{ id: 'msg-123' }]); // Save message

      mockLLM.invoke.mockResolvedValue({
        content: 'Response',
      } as any);

      const result = await service.chat({ userId, message, conversationId });

      expect(result.conversationId).toBe(conversationId);
      expect(mockQuery).toHaveBeenCalledTimes(2); // Get, save (no create)
    });
  });

  describe('Failure Injection Tests', () => {
    const userId = 'test-user-123';
    const message = 'Test message';

    test('gracefully handles vector search failure', async () => {
      const searchError = new Error('Vector search service unavailable');
      mockVectorService.searchKnowledge.mockRejectedValue(searchError);

      await expect(
        service.chat({ userId, message })
      ).rejects.toThrow('Vector search service unavailable');
    });

    test('gracefully handles LLM API failure', async () => {
      mockVectorService.searchKnowledge.mockResolvedValue([]);
      mockVectorService.searchUserProfile.mockResolvedValue([]);
      mockVectorService.searchConversationHistory.mockResolvedValue([]);

      mockQuery.mockResolvedValue([]);

      const llmError = new Error('OpenAI API rate limit exceeded');
      mockLLM.invoke.mockRejectedValue(llmError);

      await expect(
        service.chat({ userId, message })
      ).rejects.toThrow('OpenAI API rate limit exceeded');
    });

    test('gracefully handles database failure during conversation creation', async () => {
      mockVectorService.searchKnowledge.mockResolvedValue([]);
      mockVectorService.searchUserProfile.mockResolvedValue([]);
      mockVectorService.searchConversationHistory.mockResolvedValue([]);

      const dbError = new Error('Database connection lost');
      mockQuery.mockRejectedValue(dbError);

      await expect(
        service.chat({ userId, message })
      ).rejects.toThrow('Database connection lost');
    });
  });

  describe('Contract Tests', () => {
    const userId = 'test-user-123';
    const message = 'Test message';

    test('always returns ChatResponse structure', async () => {
      mockVectorService.searchKnowledge.mockResolvedValue([]);
      mockVectorService.searchUserProfile.mockResolvedValue([]);
      mockVectorService.searchConversationHistory.mockResolvedValue([]);

      mockQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'conv-123' }])
        .mockResolvedValueOnce([{ id: 'msg-123' }]);

      mockLLM.invoke.mockResolvedValue({
        content: 'Response',
      } as any);

      const result = await service.chat({ userId, message });

      // Contract: Must have these properties
      expect(result).toHaveProperty('conversationId');
      expect(result).toHaveProperty('response');
      expect(typeof result.conversationId).toBe('string');
      expect(typeof result.response).toBe('string');
    });

    test('response is never empty string', async () => {
      mockVectorService.searchKnowledge.mockResolvedValue([]);
      mockVectorService.searchUserProfile.mockResolvedValue([]);
      mockVectorService.searchConversationHistory.mockResolvedValue([]);

      mockQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'conv-123' }])
        .mockResolvedValueOnce([{ id: 'msg-123' }]);

      mockLLM.invoke.mockResolvedValue({
        content: 'Valid response',
      } as any);

      const result = await service.chat({ userId, message });

      expect(result.response.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    const userId = 'test-user-123';

    test('handles very long messages', async () => {
      const longMessage = 'A'.repeat(10000);

      mockVectorService.searchKnowledge.mockResolvedValue([]);
      mockVectorService.searchUserProfile.mockResolvedValue([]);
      mockVectorService.searchConversationHistory.mockResolvedValue([]);

      mockQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'conv-123' }])
        .mockResolvedValueOnce([{ id: 'msg-123' }]);

      mockLLM.invoke.mockResolvedValue({
        content: 'Response',
      } as any);

      const result = await service.chat({ userId, message: longMessage });

      expect(result).toBeDefined();
      expect(result.response).toBeDefined();
    });

    test('handles special characters in message', async () => {
      const specialMessage = 'Test with <script>alert("xss")</script> and "quotes"';

      mockVectorService.searchKnowledge.mockResolvedValue([]);
      mockVectorService.searchUserProfile.mockResolvedValue([]);
      mockVectorService.searchConversationHistory.mockResolvedValue([]);

      mockQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'conv-123' }])
        .mockResolvedValueOnce([{ id: 'msg-123' }]);

      mockLLM.invoke.mockResolvedValue({
        content: 'Response',
      } as any);

      const result = await service.chat({ userId, message: specialMessage });

      expect(result).toBeDefined();
    });
  });
});

