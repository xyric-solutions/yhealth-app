/**
 * Human Detection Service Unit Tests
 * Regression tests for model switch (gpt-4o-mini), JSON parsing, confidence clamping
 */

import { jest } from '@jest/globals';

jest.mock('../../../src/config/env.config.js', () => ({
  env: {
    openai: {
      apiKey: 'test-api-key',
    },
  },
}));

jest.mock('../../../src/services/logger.service.js', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

// Mock OpenAI - use __esModule and a module-scoped reference
const mockCreate = jest.fn<(...args: unknown[]) => Promise<unknown>>();

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: (...args: unknown[]) => mockCreate(...args),
      },
    },
  })),
}));

import { humanDetectionService } from '../../../src/services/human-detection.service.js';

describe('HumanDetectionService', () => {
  const dummyBuffer = Buffer.from('fake-image-data');

  // Inject mock visionClient directly since constructor may run before mocks settle
  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure visionClient is set to our mock
    (humanDetectionService as any).visionClient = {
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    };
  });

  describe('model selection', () => {
    it('should use gpt-4o-mini model (not gpt-5-mini)', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: '{"hasHuman": true, "confidence": 0.9, "reason": "Person visible"}' } }],
      });

      await humanDetectionService.detectHuman(dummyBuffer, 'image/jpeg', 'body_photo');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
        })
      );
    });

    it('should use max_tokens (not max_completion_tokens) for gpt-4o-mini', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: '{"hasHuman": true, "confidence": 0.9}' } }],
      });

      await humanDetectionService.detectHuman(dummyBuffer, 'image/jpeg', 'body_photo');

      const callArgs = mockCreate.mock.calls[0][0] as Record<string, unknown>;
      expect(callArgs).toHaveProperty('max_tokens');
      expect(callArgs).not.toHaveProperty('max_completion_tokens');
    });
  });

  describe('image type skipping', () => {
    it('should skip detection for food_photo and return requiresHuman=false', async () => {
      const result = await humanDetectionService.detectHuman(dummyBuffer, 'image/jpeg', 'food_photo');

      expect(result.hasHuman).toBe(false);
      expect(result.confidence).toBe(1.0);
      expect(result.requiresHuman).toBe(false);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should skip detection for xray and return requiresHuman=false', async () => {
      const result = await humanDetectionService.detectHuman(dummyBuffer, 'image/png', 'xray');

      expect(result.hasHuman).toBe(false);
      expect(result.confidence).toBe(1.0);
      expect(result.requiresHuman).toBe(false);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should skip detection for medical_report', async () => {
      const result = await humanDetectionService.detectHuman(dummyBuffer, 'image/png', 'medical_report');

      expect(result.hasHuman).toBe(false);
      expect(result.requiresHuman).toBe(false);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should require human for body_photo', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: '{"hasHuman": true, "confidence": 0.95}' } }],
      });

      const result = await humanDetectionService.detectHuman(dummyBuffer, 'image/jpeg', 'body_photo');

      expect(result.requiresHuman).toBe(true);
      expect(mockCreate).toHaveBeenCalled();
    });

    it('should require human for fitness_progress', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: '{"hasHuman": true, "confidence": 0.9}' } }],
      });

      const result = await humanDetectionService.detectHuman(dummyBuffer, 'image/jpeg', 'fitness_progress');

      expect(result.requiresHuman).toBe(true);
    });
  });

  describe('JSON parsing', () => {
    it('should parse valid JSON response from API', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: '{"hasHuman": true, "confidence": 0.92, "reason": "Person visible in photo"}' } }],
      });

      const result = await humanDetectionService.detectHuman(dummyBuffer, 'image/jpeg', 'body_photo');

      expect(result.hasHuman).toBe(true);
      expect(result.confidence).toBe(0.92);
      expect(result.reason).toBe('Person visible in photo');
    });

    it('should extract JSON from surrounding text', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Here is the result: {"hasHuman": false, "confidence": 0.8, "reason": "No person"} end.' } }],
      });

      const result = await humanDetectionService.detectHuman(dummyBuffer, 'image/jpeg', 'unknown');

      expect(result.hasHuman).toBe(false);
      expect(result.confidence).toBe(0.8);
    });

    it('should fallback to keyword detection when JSON parsing fails', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Yes, this image contains a human person.' } }],
      });

      const result = await humanDetectionService.detectHuman(dummyBuffer, 'image/jpeg', 'body_photo');

      expect(result.hasHuman).toBe(true);
      expect(result.confidence).toBe(0.6);
      expect(result.reason).toContain('lower confidence');
    });

    it('should detect human from keyword "true" in fallback', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'The answer is true, there is a person.' } }],
      });

      const result = await humanDetectionService.detectHuman(dummyBuffer, 'image/jpeg', 'body_photo');

      expect(result.hasHuman).toBe(true);
    });

    it('should return hasHuman=false when no keywords found in fallback', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'No person detected in image.' } }],
      });

      const result = await humanDetectionService.detectHuman(dummyBuffer, 'image/jpeg', 'body_photo');

      expect(result.hasHuman).toBe(false);
    });

    it('should handle empty response content', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: '' } }],
      });

      const result = await humanDetectionService.detectHuman(dummyBuffer, 'image/jpeg', 'body_photo');

      expect(result.hasHuman).toBe(false);
      // Empty response from all providers → confidence 0 for body_photo (requiresHuman=true)
      expect(result.confidence).toBe(0);
    });
  });

  describe('confidence clamping', () => {
    it('should clamp confidence above 1 to 1', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: '{"hasHuman": true, "confidence": 1.5}' } }],
      });

      const result = await humanDetectionService.detectHuman(dummyBuffer, 'image/jpeg', 'body_photo');

      expect(result.confidence).toBe(1.0);
    });

    it('should clamp negative confidence to 0', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: '{"hasHuman": false, "confidence": -0.5}' } }],
      });

      const result = await humanDetectionService.detectHuman(dummyBuffer, 'image/jpeg', 'body_photo');

      expect(result.confidence).toBe(0);
    });

    it('should default confidence to 0.5 when not a number', async () => {
      mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: '{"hasHuman": true, "confidence": "high"}' } }],
      });

      const result = await humanDetectionService.detectHuman(dummyBuffer, 'image/jpeg', 'body_photo');

      expect(result.confidence).toBe(0.5);
    });
  });

  describe('error handling', () => {
    it('should reject when human required and API errors', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API timeout'));

      const result = await humanDetectionService.detectHuman(dummyBuffer, 'image/jpeg', 'body_photo');

      expect(result.hasHuman).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.requiresHuman).toBe(true);
      expect(result.reason).toContain('failed');
    });

    it('should allow with warning when human not required and API errors', async () => {
      mockCreate.mockRejectedValueOnce(new Error('API timeout'));

      const result = await humanDetectionService.detectHuman(dummyBuffer, 'image/jpeg', 'unknown');

      expect(result.hasHuman).toBe(false);
      expect(result.confidence).toBe(0.5);
      expect(result.requiresHuman).toBe(false);
    });

    it('should handle null visionClient gracefully when human not required', async () => {
      (humanDetectionService as any).visionClient = null;

      const result = await humanDetectionService.detectHuman(dummyBuffer, 'image/jpeg', 'unknown');

      expect(result.hasHuman).toBe(false);
      expect(result.confidence).toBe(0.5);
      expect(result.requiresHuman).toBe(false);
    });

    it('should reject when null visionClient and human required', async () => {
      (humanDetectionService as any).visionClient = null;

      const result = await humanDetectionService.detectHuman(dummyBuffer, 'image/jpeg', 'body_photo');

      expect(result.hasHuman).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.requiresHuman).toBe(true);
    });
  });

  describe('shouldAnalyzeImage', () => {
    it('should return true when human not required', () => {
      const result = humanDetectionService.shouldAnalyzeImage({
        hasHuman: false,
        confidence: 0.5,
        requiresHuman: false,
      });

      expect(result).toBe(true);
    });

    it('should return true when human required and detected with high confidence', () => {
      const result = humanDetectionService.shouldAnalyzeImage({
        hasHuman: true,
        confidence: 0.8,
        requiresHuman: true,
      });

      expect(result).toBe(true);
    });

    it('should return false when human required but not detected', () => {
      const result = humanDetectionService.shouldAnalyzeImage({
        hasHuman: false,
        confidence: 0.9,
        requiresHuman: true,
      });

      expect(result).toBe(false);
    });

    it('should return false when human required and detected but low confidence', () => {
      const result = humanDetectionService.shouldAnalyzeImage({
        hasHuman: true,
        confidence: 0.3,
        requiresHuman: true,
      });

      expect(result).toBe(false);
    });

    it('should return true at exactly 0.5 confidence threshold', () => {
      const result = humanDetectionService.shouldAnalyzeImage({
        hasHuman: true,
        confidence: 0.5,
        requiresHuman: true,
      });

      expect(result).toBe(true);
    });
  });
});
