/**
 * AI Coach Service - Unit Tests
 *
 * Tests for AICoachServiceClient (15 methods, ~30 test cases).
 * Validates API delegation, error handling, FormData construction,
 * cookie-based auth for PDF downloads, and default parameter behavior.
 *
 * @module __tests__/services/ai-coach.service.test
 */

import type {
  AICoachGoalCategory,
  ChatMessage,
  ExtractedInsight,
  GenerateGoalsRequest,
  MCQGenerationRequest,
  MCQAnswerRequest,
} from '@/src/shared/services/ai-coach.service';

// ---------------------------------------------------------------------------
// Mock: @/lib/api-client
// ---------------------------------------------------------------------------
jest.mock('@/lib/api-client', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    upload: jest.fn(),
    delete: jest.fn(),
  },
  api: {
    get: jest.fn(),
    post: jest.fn(),
    upload: jest.fn(),
    delete: jest.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      public statusCode: number,
      public code: string,
      public details?: unknown
    ) {
      super(message);
      this.name = 'ApiError';
    }
  },
}));

// Must import AFTER jest.mock so the mock is in place
import { api } from '@/lib/api-client';
import { aiCoachService } from '@/src/shared/services/ai-coach.service';

// Typed mock references
const mockApi = api as jest.Mocked<typeof api>;

// ---------------------------------------------------------------------------
// Global fetch mock (for downloadSessionPDF)
// ---------------------------------------------------------------------------
const mockFetch = jest.fn();
global.fetch = mockFetch;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a successful ApiResponse wrapper */
function ok<T>(data: T) {
  return { success: true, data };
}

/** Build a failed ApiResponse wrapper */
function fail(message = 'Something went wrong') {
  return { success: false, error: { code: 'ERROR', message } };
}

/** Minimal conversation history fixture */
const sampleHistory: ChatMessage[] = [
  { role: 'user', content: 'Hello' },
  { role: 'assistant', content: 'Hi there!' },
];

/** Minimal extracted insights fixture */
const sampleInsights: ExtractedInsight[] = [
  { category: 'motivation', text: 'Wants to lose weight', confidence: 0.9 },
];

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('AICoachServiceClient', () => {
  // =========================================================================
  // 1. checkStatus
  // =========================================================================
  describe('checkStatus', () => {
    it('should return status data on successful response', async () => {
      const statusData = { available: true, message: 'AI Coach is ready' };
      mockApi.get.mockResolvedValueOnce(ok(statusData));

      const result = await aiCoachService.checkStatus();

      expect(mockApi.get).toHaveBeenCalledWith('/ai-coach/status');
      expect(result).toEqual(statusData);
    });

    it('should return unavailable when response is unsuccessful', async () => {
      mockApi.get.mockResolvedValueOnce(fail());

      const result = await aiCoachService.checkStatus();

      expect(result).toEqual({ available: false, message: 'Failed to get status' });
    });

    it('should catch errors and return unavailable without throwing', async () => {
      mockApi.get.mockRejectedValueOnce(new Error('Network down'));

      const result = await aiCoachService.checkStatus();

      expect(result).toEqual({
        available: false,
        message: 'Failed to connect to AI Coach service',
      });
    });
  });

  // =========================================================================
  // 2. startConversation
  // =========================================================================
  describe('startConversation', () => {
    const startResponse = {
      message: 'Welcome!',
      phase: 'opening' as const,
      conversationId: 'conv-123',
      insights: [],
      isComplete: false,
    };

    it('should post correct body with all parameters and return data', async () => {
      mockApi.post.mockResolvedValueOnce(ok(startResponse));

      const result = await aiCoachService.startConversation(
        'weight_loss',
        'John',
        'ur',
        true
      );

      expect(mockApi.post).toHaveBeenCalledWith('/ai-coach/start', {
        goal: 'weight_loss',
        userName: 'John',
        language: 'ur',
        isOnboarding: true,
      });
      expect(result).toEqual(startResponse);
    });

    it('should use default language=en and isOnboarding=false', async () => {
      mockApi.post.mockResolvedValueOnce(ok(startResponse));

      await aiCoachService.startConversation('sleep_improvement');

      expect(mockApi.post).toHaveBeenCalledWith('/ai-coach/start', {
        goal: 'sleep_improvement',
        userName: undefined,
        language: 'en',
        isOnboarding: false,
      });
    });

    it('should throw when response is unsuccessful', async () => {
      mockApi.post.mockResolvedValueOnce(fail());

      await expect(aiCoachService.startConversation('weight_loss')).rejects.toThrow(
        'Failed to start conversation'
      );
    });
  });

  // =========================================================================
  // 3. sendMessage
  // =========================================================================
  describe('sendMessage', () => {
    const messageResponse = {
      message: 'Great to hear that!',
      phase: 'exploration' as const,
      insights: sampleInsights,
      isComplete: false,
      suggestedActions: ['Try journaling'],
    };

    it('should post correct body with all parameters and return data', async () => {
      mockApi.post.mockResolvedValueOnce(ok(messageResponse));

      const result = await aiCoachService.sendMessage(
        'I want to lose 10kg',
        'weight_loss',
        sampleHistory,
        3,
        sampleInsights,
        'ur'
      );

      expect(mockApi.post).toHaveBeenCalledWith('/ai-coach/message', {
        message: 'I want to lose 10kg',
        goal: 'weight_loss',
        conversationHistory: sampleHistory,
        messageCount: 3,
        extractedInsights: sampleInsights,
        language: 'ur',
      });
      expect(result).toEqual(messageResponse);
    });

    it('should throw when response is unsuccessful', async () => {
      mockApi.post.mockResolvedValueOnce(fail());

      await expect(
        aiCoachService.sendMessage('hi', 'weight_loss', [], 1)
      ).rejects.toThrow('Failed to send message');
    });
  });

  // =========================================================================
  // 4. completeAssessment
  // =========================================================================
  describe('completeAssessment', () => {
    const completeResponse = {
      userId: 'user-1',
      goal: 'weight_loss' as AICoachGoalCategory,
      completedAt: '2026-02-16T00:00:00Z',
      conversationSummary: { totalMessages: 10, userMessages: 5, aiMessages: 5 },
      insights: {
        motivations: [],
        barriers: [],
        preferences: [],
        lifestyle: [],
        healthStatus: [],
        goals: [],
      },
      readyForPlanGeneration: true,
    };

    it('should post correct body and return data', async () => {
      mockApi.post.mockResolvedValueOnce(ok(completeResponse));

      const result = await aiCoachService.completeAssessment(
        'weight_loss',
        sampleHistory,
        sampleInsights
      );

      expect(mockApi.post).toHaveBeenCalledWith('/ai-coach/complete', {
        goal: 'weight_loss',
        conversationHistory: sampleHistory,
        extractedInsights: sampleInsights,
      });
      expect(result).toEqual(completeResponse);
    });

    it('should throw when response is unsuccessful', async () => {
      mockApi.post.mockResolvedValueOnce(fail());

      await expect(
        aiCoachService.completeAssessment('weight_loss', [], [])
      ).rejects.toThrow('Failed to complete assessment');
    });
  });

  // =========================================================================
  // 5. analyzeImage
  // =========================================================================
  describe('analyzeImage', () => {
    const analyzeResponse = {
      imageKey: 'img-001',
      imageUrl: 'https://cdn.example.com/img.jpg',
      imageType: 'food_photo' as const,
      analysis: {
        isHealthRelated: true,
        imageType: 'food_photo' as const,
        analysis: 'This is a balanced meal.',
        insights: [],
      },
      response: 'Looks healthy!',
    };

    it('should build FormData correctly and call api.upload', async () => {
      mockApi.upload.mockResolvedValueOnce(ok(analyzeResponse));
      const file = new File(['image-data'], 'photo.jpg', { type: 'image/jpeg' });

      const result = await aiCoachService.analyzeImage(
        file,
        'weight_loss',
        'What is in this meal?'
      );

      expect(mockApi.upload).toHaveBeenCalledTimes(1);

      // Verify the endpoint
      const [endpoint, formData] = mockApi.upload.mock.calls[0];
      expect(endpoint).toBe('/ai-coach/image/analyze');

      // Verify FormData contents
      expect(formData).toBeInstanceOf(FormData);
      expect(formData.get('image')).toBeInstanceOf(File);
      expect((formData.get('image') as File).name).toBe('photo.jpg');
      expect(formData.get('goal')).toBe('weight_loss');
      expect(formData.get('question')).toBe('What is in this meal?');

      expect(result).toEqual(analyzeResponse);
    });

    it('should omit optional fields from FormData when not provided', async () => {
      mockApi.upload.mockResolvedValueOnce(ok(analyzeResponse));
      const file = new File(['data'], 'test.png', { type: 'image/png' });

      await aiCoachService.analyzeImage(file);

      const [, formData] = mockApi.upload.mock.calls[0];
      expect(formData.get('image')).toBeInstanceOf(File);
      expect(formData.get('goal')).toBeNull();
      expect(formData.get('question')).toBeNull();
    });

    it('should throw when response is unsuccessful', async () => {
      mockApi.upload.mockResolvedValueOnce(
        fail('Image analysis failed')
      );
      const file = new File(['data'], 'test.png', { type: 'image/png' });

      await expect(aiCoachService.analyzeImage(file)).rejects.toThrow(
        'Image analysis failed'
      );
    });
  });

  // =========================================================================
  // 6. chatWithImage
  // =========================================================================
  describe('chatWithImage', () => {
    const chatImageResponse = {
      sessionId: 'sess-001',
      message: 'I see a balanced meal.',
      imageAnalysis: {
        isHealthRelated: true,
        imageType: 'food_photo' as const,
        analysis: 'Balanced meal detected.',
        insights: [],
      },
      imageUrl: 'https://cdn.example.com/img.jpg',
      imageType: 'food_photo' as const,
      insights: [],
    };

    it('should build FormData with all optional fields and call api.upload', async () => {
      mockApi.upload.mockResolvedValueOnce(ok(chatImageResponse));
      const file = new File(['img'], 'meal.jpg', { type: 'image/jpeg' });

      const result = await aiCoachService.chatWithImage(
        file,
        'weight_loss',
        'Analyze this meal',
        'sess-001'
      );

      const [endpoint, formData] = mockApi.upload.mock.calls[0];
      expect(endpoint).toBe('/ai-coach/chat-with-image');
      expect(formData.get('image')).toBeInstanceOf(File);
      expect(formData.get('goal')).toBe('weight_loss');
      expect(formData.get('message')).toBe('Analyze this meal');
      expect(formData.get('sessionId')).toBe('sess-001');
      expect(result).toEqual(chatImageResponse);
    });

    it('should throw when response is unsuccessful', async () => {
      mockApi.upload.mockResolvedValueOnce(fail('Upload failed'));
      const file = new File(['img'], 'meal.jpg', { type: 'image/jpeg' });

      await expect(
        aiCoachService.chatWithImage(file, 'weight_loss')
      ).rejects.toThrow('Upload failed');
    });
  });

  // =========================================================================
  // 7. getOrCreateSession
  // =========================================================================
  describe('getOrCreateSession', () => {
    const sessionResponse = {
      session: {
        id: 'sess-100',
        goalCategory: 'weight_loss' as AICoachGoalCategory,
        sessionType: 'assessment',
        messages: [],
        extractedInsights: [],
        conversationPhase: 'opening' as const,
        messageCount: 0,
        isComplete: false,
        createdAt: '2026-02-16T00:00:00Z',
      },
    };

    it('should post goal and sessionType and return session data', async () => {
      mockApi.post.mockResolvedValueOnce(ok(sessionResponse));

      const result = await aiCoachService.getOrCreateSession('weight_loss', 'chat');

      expect(mockApi.post).toHaveBeenCalledWith('/ai-coach/session', {
        goal: 'weight_loss',
        sessionType: 'chat',
      });
      expect(result).toEqual(sessionResponse);
    });

    it('should default sessionType to assessment', async () => {
      mockApi.post.mockResolvedValueOnce(ok(sessionResponse));

      await aiCoachService.getOrCreateSession('sleep_improvement');

      expect(mockApi.post).toHaveBeenCalledWith('/ai-coach/session', {
        goal: 'sleep_improvement',
        sessionType: 'assessment',
      });
    });
  });

  // =========================================================================
  // 8. getSession
  // =========================================================================
  describe('getSession', () => {
    it('should GET the correct session URL and return data', async () => {
      const sessionData = {
        session: {
          id: 'sess-42',
          goalCategory: 'energy_productivity' as AICoachGoalCategory,
          sessionType: 'assessment',
          messages: [],
          extractedInsights: [],
          conversationPhase: 'opening' as const,
          messageCount: 0,
          isComplete: false,
          createdAt: '2026-02-16T00:00:00Z',
        },
      };
      mockApi.get.mockResolvedValueOnce(ok(sessionData));

      const result = await aiCoachService.getSession('sess-42');

      expect(mockApi.get).toHaveBeenCalledWith('/ai-coach/session/sess-42');
      expect(result).toEqual(sessionData);
    });

    it('should throw when response is unsuccessful', async () => {
      mockApi.get.mockResolvedValueOnce(fail());

      await expect(aiCoachService.getSession('bad-id')).rejects.toThrow(
        'Failed to get session'
      );
    });
  });

  // =========================================================================
  // 9. getChatHistory
  // =========================================================================
  describe('getChatHistory', () => {
    const historyResponse = { sessions: [], total: 0 };

    it('should use default limit of 20', async () => {
      mockApi.get.mockResolvedValueOnce(ok(historyResponse));

      const result = await aiCoachService.getChatHistory();

      expect(mockApi.get).toHaveBeenCalledWith('/ai-coach/history', {
        params: { limit: 20 },
      });
      expect(result).toEqual(historyResponse);
    });

    it('should pass custom limit parameter', async () => {
      mockApi.get.mockResolvedValueOnce(ok(historyResponse));

      await aiCoachService.getChatHistory(50);

      expect(mockApi.get).toHaveBeenCalledWith('/ai-coach/history', {
        params: { limit: 50 },
      });
    });
  });

  // =========================================================================
  // 10. chat
  // =========================================================================
  describe('chat', () => {
    const chatResponse = {
      sessionId: 'sess-200',
      message: 'That sounds great!',
      phase: 'exploration' as const,
      insights: [],
      isComplete: false,
      historicalContextUsed: false,
    };

    it('should post correct body and return data', async () => {
      mockApi.post.mockResolvedValueOnce(ok(chatResponse));

      const result = await aiCoachService.chat(
        'How do I start?',
        'habit_building',
        'sess-200',
        true
      );

      expect(mockApi.post).toHaveBeenCalledWith('/ai-coach/chat', {
        message: 'How do I start?',
        goal: 'habit_building',
        sessionId: 'sess-200',
        isOnboarding: true,
      });
      expect(result).toEqual(chatResponse);
    });

    it('should throw when response is unsuccessful', async () => {
      mockApi.post.mockResolvedValueOnce(fail());

      await expect(
        aiCoachService.chat('hello', 'weight_loss')
      ).rejects.toThrow('Failed to send message');
    });
  });

  // =========================================================================
  // 11. downloadSessionPDF
  // =========================================================================
  describe('downloadSessionPDF', () => {
    const fakeBlobContent = new Blob(['%PDF-1.4 fake content'], {
      type: 'application/pdf',
    });

    afterEach(() => {
      // Reset document.cookie between tests
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: '',
      });
    });

    it('should call fetch with correct URL and authorization header from cookie', async () => {
      // Set up the cookie
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: 'balencia_access_token=jwt-token-abc; other_cookie=xyz',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: jest.fn().mockResolvedValueOnce(fakeBlobContent),
      });

      const result = await aiCoachService.downloadSessionPDF('sess-pdf-1');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/ai-coach/session/sess-pdf-1/pdf',
        {
          method: 'GET',
          headers: {
            Authorization: 'Bearer jwt-token-abc',
          },
        }
      );
      expect(result).toBe(fakeBlobContent);
    });

    it('should send empty Authorization header when no cookie is present', async () => {
      Object.defineProperty(document, 'cookie', {
        writable: true,
        value: '',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        blob: jest.fn().mockResolvedValueOnce(fakeBlobContent),
      });

      await aiCoachService.downloadSessionPDF('sess-pdf-2');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/ai-coach/session/sess-pdf-2/pdf'),
        expect.objectContaining({
          headers: { Authorization: '' },
        })
      );
    });

    it('should throw when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(
        aiCoachService.downloadSessionPDF('sess-pdf-3')
      ).rejects.toThrow('Failed to download PDF');
    });
  });

  // =========================================================================
  // 12. deleteSession
  // =========================================================================
  describe('deleteSession', () => {
    it('should call api.delete with the session URL and resolve on success', async () => {
      mockApi.delete.mockResolvedValueOnce({ success: true });

      await expect(
        aiCoachService.deleteSession('sess-del-1')
      ).resolves.toBeUndefined();

      expect(mockApi.delete).toHaveBeenCalledWith('/ai-coach/session/sess-del-1');
    });

    it('should throw when response.success is false', async () => {
      mockApi.delete.mockResolvedValueOnce({ success: false });

      await expect(
        aiCoachService.deleteSession('sess-del-2')
      ).rejects.toThrow('Failed to delete session');
    });
  });

  // =========================================================================
  // 13. generateGoals
  // =========================================================================
  describe('generateGoals', () => {
    const goalsRequest: GenerateGoalsRequest = {
      goalCategory: 'weight_loss',
      assessmentResponses: [
        { questionId: 'q1', value: 'reduce body fat' },
      ],
      bodyStats: {
        heightCm: 180,
        weightKg: 90,
        targetWeightKg: 80,
        age: 30,
        gender: 'male',
      },
      customGoalText: 'Lose 10kg by summer',
    };

    const goalsResponse = {
      goals: [
        {
          id: 'goal-1',
          category: 'weight_loss' as AICoachGoalCategory,
          pillar: 'fitness' as const,
          isPrimary: true,
          title: 'Lose 10kg',
          description: 'Gradual weight loss over 12 weeks',
          targetValue: 80,
          targetUnit: 'kg',
          currentValue: 90,
          timeline: {
            startDate: '2026-02-16',
            targetDate: '2026-05-11',
            durationWeeks: 12,
          },
          motivation: 'Summer body',
          confidenceScore: 0.85,
          aiSuggested: true,
        },
      ],
      reasoning: 'Based on your current weight and target.',
    };

    it('should post the full request body and return goals', async () => {
      mockApi.post.mockResolvedValueOnce(ok(goalsResponse));

      const result = await aiCoachService.generateGoals(goalsRequest);

      expect(mockApi.post).toHaveBeenCalledWith('/ai-coach/generate-goals', {
        goalCategory: 'weight_loss',
        assessmentResponses: goalsRequest.assessmentResponses,
        bodyStats: goalsRequest.bodyStats,
        customGoalText: 'Lose 10kg by summer',
      });
      expect(result).toEqual(goalsResponse);
    });

    it('should throw with the response error message when available', async () => {
      mockApi.post.mockResolvedValueOnce({
        success: false,
        error: { code: 'GOAL_GEN_FAILED', message: 'Insufficient data for goals' },
      });

      await expect(aiCoachService.generateGoals(goalsRequest)).rejects.toThrow(
        'Insufficient data for goals'
      );
    });

    it('should throw with fallback message when no error message in response', async () => {
      mockApi.post.mockResolvedValueOnce({ success: false });

      await expect(aiCoachService.generateGoals(goalsRequest)).rejects.toThrow(
        'Failed to generate goals'
      );
    });
  });

  // =========================================================================
  // 14. generateMCQQuestion
  // =========================================================================
  describe('generateMCQQuestion', () => {
    const mcqRequest: MCQGenerationRequest = {
      goal: 'stress_wellness',
      phase: 'exploration',
      previousAnswers: [{ questionId: 'q1', selectedOptions: ['opt-a'] }],
      extractedInsights: sampleInsights,
      language: 'en',
    };

    const mcqResponse = {
      question: {
        id: 'mcq-1',
        question: 'How often do you feel stressed?',
        options: [
          { id: 'opt-1', text: 'Rarely' },
          { id: 'opt-2', text: 'Sometimes' },
        ],
        category: 'stress' as const,
      },
      phase: 'exploration' as const,
      progress: 0.3,
      isComplete: false,
      insights: [],
    };

    it('should post correct body and return MCQ question data', async () => {
      mockApi.post.mockResolvedValueOnce(ok(mcqResponse));

      const result = await aiCoachService.generateMCQQuestion(mcqRequest);

      expect(mockApi.post).toHaveBeenCalledWith('/ai-coach/mcq/question', {
        goal: 'stress_wellness',
        phase: 'exploration',
        previousAnswers: mcqRequest.previousAnswers,
        extractedInsights: sampleInsights,
        language: 'en',
      });
      expect(result).toEqual(mcqResponse);
    });

    it('should throw when response is unsuccessful', async () => {
      mockApi.post.mockResolvedValueOnce(
        fail('MCQ generation failed')
      );

      await expect(
        aiCoachService.generateMCQQuestion(mcqRequest)
      ).rejects.toThrow('MCQ generation failed');
    });
  });

  // =========================================================================
  // 15. processMCQAnswer
  // =========================================================================
  describe('processMCQAnswer', () => {
    const answerRequest: MCQAnswerRequest = {
      questionId: 'mcq-1',
      selectedOptions: [
        { id: 'opt-1', text: 'Rarely' },
      ],
      goal: 'stress_wellness',
    };

    const answerResponse = {
      insights: [
        { category: 'lifestyle' as const, text: 'Low stress level', confidence: 0.8 },
      ],
    };

    it('should post correct body and return insights', async () => {
      mockApi.post.mockResolvedValueOnce(ok(answerResponse));

      const result = await aiCoachService.processMCQAnswer(answerRequest);

      expect(mockApi.post).toHaveBeenCalledWith('/ai-coach/mcq/answer', {
        questionId: 'mcq-1',
        selectedOptions: answerRequest.selectedOptions,
        goal: 'stress_wellness',
      });
      expect(result).toEqual(answerResponse);
    });

    it('should throw when response is unsuccessful', async () => {
      mockApi.post.mockResolvedValueOnce(
        fail('MCQ answer processing failed')
      );

      await expect(
        aiCoachService.processMCQAnswer(answerRequest)
      ).rejects.toThrow('MCQ answer processing failed');
    });
  });
});
