/**
 * AI Coach Controller Unit Tests
 * Regression: goal enrichment with UUID IDs (undefined===undefined bug), isPrimary, confidenceScore defaults
 */

import { jest } from '@jest/globals';
import crypto from 'crypto';

// Mock dependencies (unstable_mockModule for ESM)
const mockAiCoachService = {
  isAvailable: jest.fn<any>().mockReturnValue(true),
  generateGoals: jest.fn<any>(),
  getUserName: jest.fn<any>().mockResolvedValue('Test User'),
  generateOpeningMessage: jest.fn<any>(),
};

jest.unstable_mockModule('../../../src/services/index.js', () => ({
  aiCoachService: mockAiCoachService,
}));

jest.unstable_mockModule('../../../src/services/logger.service.js', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.unstable_mockModule('../../../src/services/model-factory.service.js', () => ({
  modelFactory: {
    getModel: jest.fn().mockReturnValue({}),
    getActiveProvider: jest.fn().mockReturnValue('mock'),
  },
}));

// Dynamic imports after mock setup
const { createMockAuthRequest, createMockResponse, createMockNext } = await import('../../helpers/mocks.js');
const { aiCoachController } = await import('../../../src/controllers/ai-coach.controller.js');

const mockGenerateGoals = mockAiCoachService.generateGoals;

describe('AICoachController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateGoals - goal enrichment', () => {
    const baseBody = {
      goalCategory: 'weight_loss',
      assessmentResponses: [{ questionId: 'q1', answer: 'test' }],
      bodyStats: { weight: 80, height: 175 },
    };

    it('should assign crypto.randomUUID to goals without IDs (regression: undefined===undefined)', async () => {
      const mockGoals = {
        goals: [
          { title: 'Lose 5kg', targetValue: 75, unit: 'kg' },
          { title: 'Run 5km', targetValue: 5, unit: 'km' },
        ],
        reasoning: 'Based on your assessment',
      };
      mockGenerateGoals.mockResolvedValueOnce(mockGoals);

      const req = createMockAuthRequest({}, { body: baseBody });
      const res = createMockResponse();

      await aiCoachController.generateGoals(req as any, res as any, createMockNext());

      const responseData = (res.json as jest.Mock<any>).mock.calls[0]?.[0] as any;
      const goals = responseData?.data?.goals;

      expect(goals).toHaveLength(2);
      // Each goal MUST have a unique non-undefined ID
      expect(goals[0].id).toBeDefined();
      expect(goals[1].id).toBeDefined();
      expect(goals[0].id).not.toBe(goals[1].id);
      // IDs should be valid UUIDs
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(goals[0].id).toMatch(uuidRegex);
      expect(goals[1].id).toMatch(uuidRegex);
    });

    it('should preserve existing IDs from AI service', async () => {
      const existingId = crypto.randomUUID();
      const mockGoals = {
        goals: [
          { id: existingId, title: 'Lose 5kg', targetValue: 75, unit: 'kg' },
        ],
        reasoning: 'Based on your assessment',
      };
      mockGenerateGoals.mockResolvedValueOnce(mockGoals);

      const req = createMockAuthRequest({}, { body: baseBody });
      const res = createMockResponse();

      await aiCoachController.generateGoals(req as any, res as any, createMockNext());

      const goals = ((res.json as jest.Mock<any>).mock.calls[0]?.[0] as any)?.data?.goals;
      expect(goals[0].id).toBe(existingId);
    });

    it('should set isPrimary=true for first goal and false for rest', async () => {
      const mockGoals = {
        goals: [
          { title: 'Goal A', targetValue: 10, unit: 'kg' },
          { title: 'Goal B', targetValue: 20, unit: 'km' },
          { title: 'Goal C', targetValue: 30, unit: 'min' },
        ],
        reasoning: 'Test',
      };
      mockGenerateGoals.mockResolvedValueOnce(mockGoals);

      const req = createMockAuthRequest({}, { body: baseBody });
      const res = createMockResponse();

      await aiCoachController.generateGoals(req as any, res as any, createMockNext());

      const goals = ((res.json as jest.Mock<any>).mock.calls[0]?.[0] as any)?.data?.goals;
      expect(goals[0].isPrimary).toBe(true);
      expect(goals[1].isPrimary).toBe(false);
      expect(goals[2].isPrimary).toBe(false);
    });

    it('should preserve explicit isPrimary from AI service', async () => {
      const mockGoals = {
        goals: [
          { title: 'Goal A', targetValue: 10, unit: 'kg', isPrimary: false },
          { title: 'Goal B', targetValue: 20, unit: 'km', isPrimary: true },
        ],
        reasoning: 'Test',
      };
      mockGenerateGoals.mockResolvedValueOnce(mockGoals);

      const req = createMockAuthRequest({}, { body: baseBody });
      const res = createMockResponse();

      await aiCoachController.generateGoals(req as any, res as any, createMockNext());

      const goals = ((res.json as jest.Mock<any>).mock.calls[0]?.[0] as any)?.data?.goals;
      expect(goals[0].isPrimary).toBe(false);
      expect(goals[1].isPrimary).toBe(true);
    });

    it('should set default confidenceScore of 0.7', async () => {
      const mockGoals = {
        goals: [{ title: 'Goal', targetValue: 10, unit: 'kg' }],
        reasoning: 'Test',
      };
      mockGenerateGoals.mockResolvedValueOnce(mockGoals);

      const req = createMockAuthRequest({}, { body: baseBody });
      const res = createMockResponse();

      await aiCoachController.generateGoals(req as any, res as any, createMockNext());

      const goals = ((res.json as jest.Mock<any>).mock.calls[0]?.[0] as any)?.data?.goals;
      expect(goals[0].confidenceScore).toBe(0.7);
    });

    it('should preserve explicit confidenceScore', async () => {
      const mockGoals = {
        goals: [{ title: 'Goal', targetValue: 10, unit: 'kg', confidenceScore: 0.95 }],
        reasoning: 'Test',
      };
      mockGenerateGoals.mockResolvedValueOnce(mockGoals);

      const req = createMockAuthRequest({}, { body: baseBody });
      const res = createMockResponse();

      await aiCoachController.generateGoals(req as any, res as any, createMockNext());

      const goals = ((res.json as jest.Mock<any>).mock.calls[0]?.[0] as any)?.data?.goals;
      expect(goals[0].confidenceScore).toBe(0.95);
    });

    it('should set default aiSuggested=true', async () => {
      const mockGoals = {
        goals: [{ title: 'Goal', targetValue: 10, unit: 'kg' }],
        reasoning: 'Test',
      };
      mockGenerateGoals.mockResolvedValueOnce(mockGoals);

      const req = createMockAuthRequest({}, { body: baseBody });
      const res = createMockResponse();

      await aiCoachController.generateGoals(req as any, res as any, createMockNext());

      const goals = ((res.json as jest.Mock<any>).mock.calls[0]?.[0] as any)?.data?.goals;
      expect(goals[0].aiSuggested).toBe(true);
    });

    it('should set default category from goalCategory when not provided', async () => {
      const mockGoals = {
        goals: [{ title: 'Goal', targetValue: 10, unit: 'kg' }],
        reasoning: 'Test',
      };
      mockGenerateGoals.mockResolvedValueOnce(mockGoals);

      const req = createMockAuthRequest({}, { body: baseBody });
      const res = createMockResponse();

      await aiCoachController.generateGoals(req as any, res as any, createMockNext());

      const goals = ((res.json as jest.Mock<any>).mock.calls[0]?.[0] as any)?.data?.goals;
      expect(goals[0].category).toBe('weight_loss');
    });
  });
});
