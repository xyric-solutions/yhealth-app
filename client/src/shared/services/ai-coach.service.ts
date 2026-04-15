/**
 * AI Coach Service
 * Client-side service for deep assessment conversations
 * Uses the shared api client for proper authentication handling
 */

import { api } from '@/lib/api-client';

export type AICoachGoalCategory =
  | 'weight_loss'
  | 'muscle_building'
  | 'sleep_improvement'
  | 'stress_wellness'
  | 'energy_productivity'
  | 'event_training'
  | 'health_condition'
  | 'habit_building'
  | 'overall_optimization'
  | 'nutrition'
  | 'fitness'
  | 'custom';

export type ConversationPhase = 'opening' | 'exploration' | 'deepening' | 'closing';

export type SupportedLanguage = 'en' | 'ur';

export const LANGUAGE_CONFIG = {
  en: { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr' as const },
  ur: { code: 'ur', name: 'Urdu', nativeName: 'اردو', dir: 'rtl' as const },
} as const;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ExtractedInsight {
  category: 'motivation' | 'barrier' | 'preference' | 'lifestyle' | 'goal' | 'health_status';
  text: string;
  confidence: number;
}

export interface AICoachStartResponse {
  message: string;
  phase: ConversationPhase;
  conversationId: string;
  insights: ExtractedInsight[];
  isComplete: boolean;
}

export interface AICoachMessageResponse {
  message: string;
  phase: ConversationPhase;
  insights: ExtractedInsight[];
  isComplete: boolean;
  suggestedActions?: string[];
}

export interface AICoachCompleteResponse {
  userId: string;
  goal: AICoachGoalCategory;
  completedAt: string;
  conversationSummary: {
    totalMessages: number;
    userMessages: number;
    aiMessages: number;
  };
  insights: {
    motivations: ExtractedInsight[];
    barriers: ExtractedInsight[];
    preferences: ExtractedInsight[];
    lifestyle: ExtractedInsight[];
    healthStatus: ExtractedInsight[];
    goals: ExtractedInsight[];
  };
  readyForPlanGeneration: boolean;
}

export interface AICoachStatusResponse {
  available: boolean;
  message: string;
}

export type HealthImageType = 'body_photo' | 'xray' | 'medical_report' | 'food_photo' | 'nutrition_label' | 'fitness_progress' | 'unknown';

export interface ImageAnalysisResult {
  isHealthRelated: boolean;
  imageType: HealthImageType;
  analysis: string;
  insights: ExtractedInsight[];
  recommendations?: string[];
  warnings?: string[];
}

export interface ImageAnalyzeResponse {
  imageKey: string;
  imageUrl: string;
  imageType: HealthImageType;
  analysis: ImageAnalysisResult;
  response: string;
}

export interface ChatWithImageResponse {
  sessionId: string;
  message: string;
  imageAnalysis: ImageAnalysisResult;
  imageUrl: string;
  imageType: HealthImageType;
  insights: ExtractedInsight[];
}

// Session Types for persistence
export interface AICoachSession {
  id: string;
  goalCategory: AICoachGoalCategory;
  sessionType: string;
  messages: ChatMessage[];
  extractedInsights: ExtractedInsight[];
  conversationPhase: ConversationPhase;
  messageCount: number;
  isComplete: boolean;
  completedAt?: string;
  sessionSummary?: string;
  keyTakeaways?: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface SessionResponse {
  session: AICoachSession;
}

export interface ChatHistoryResponse {
  sessions: AICoachSession[];
  total: number;
}

export interface AICoachChatResponse {
  sessionId: string;
  message: string;
  phase: ConversationPhase;
  insights: ExtractedInsight[];
  isComplete: boolean;
  suggestedActions?: string[];
  historicalContextUsed: boolean;
}

// Goal Generation Types
export interface AssessmentResponseInput {
  questionId: string;
  value: string | number | string[];
}

export interface BodyStatsInput {
  heightCm?: number;
  weightKg?: number;
  targetWeightKg?: number;
  bodyFatPercentage?: number;
  age?: number;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
}

export interface GeneratedGoalMilestone {
  week: number;
  target: number;
  description: string;
}

export interface GeneratedGoal {
  id: string;
  category: AICoachGoalCategory;
  pillar: 'fitness' | 'nutrition' | 'wellbeing';
  isPrimary: boolean;
  title: string;
  description: string;
  targetValue: number;
  targetUnit: string;
  currentValue?: number;
  timeline: {
    startDate: string;
    targetDate: string;
    durationWeeks: number;
  };
  motivation: string;
  confidenceScore: number;
  aiSuggested: boolean;
  milestones?: GeneratedGoalMilestone[];
}

export interface GenerateGoalsRequest {
  goalCategory: AICoachGoalCategory;
  assessmentResponses: AssessmentResponseInput[];
  bodyStats: BodyStatsInput;
  customGoalText?: string;
}

export interface GenerateGoalsResponse {
  goals: GeneratedGoal[];
  reasoning: string;
}

// ============================================================================
// MCQ Types for Dynamic Question Generation
// ============================================================================

export type MCQCategory = 'lifestyle' | 'fitness' | 'nutrition' | 'sleep' | 'stress' | 'goals';

export interface MCQOption {
  id: string;
  text: string;
  insightValue?: string;
}

export interface MCQQuestion {
  id: string;
  question: string;
  options: MCQOption[];
  category: MCQCategory;
  allowMultiple?: boolean;
}

export interface MCQGenerationRequest {
  goal: AICoachGoalCategory;
  phase?: ConversationPhase;
  previousAnswers?: { questionId: string; questionText?: string; selectedOptions: string[] }[];
  extractedInsights?: ExtractedInsight[];
  language?: SupportedLanguage;
}

export interface MCQGenerationResponse {
  question: MCQQuestion;
  phase: ConversationPhase;
  progress: number;
  isComplete: boolean;
  insights: ExtractedInsight[];
}

export interface MCQAnswerRequest {
  questionId: string;
  selectedOptions: MCQOption[];
  goal: AICoachGoalCategory;
}

export interface MCQAnswerResponse {
  insights: ExtractedInsight[];
}

class AICoachServiceClient {
  /**
   * Check if AI Coach is available
   */
  async checkStatus(): Promise<AICoachStatusResponse> {
    try {
      const response = await api.get<AICoachStatusResponse>('/ai-coach/status');
      if (response.success && response.data) {
        return response.data;
      }
      return { available: false, message: 'Failed to get status' };
    } catch (error) {
      console.error('[AICoach] Status check failed:', error);
      return { available: false, message: 'Failed to connect to AI Coach service' };
    }
  }

  /**
   * Start a new AI coach conversation
   */
  async startConversation(
    goal: AICoachGoalCategory, 
    userName?: string, 
    language: SupportedLanguage = 'en',
    isOnboarding: boolean = false
  ): Promise<AICoachStartResponse> {
    const response = await api.post<AICoachStartResponse>('/ai-coach/start', { 
      goal, 
      userName, 
      language,
      isOnboarding,
    });

    if (!response.success || !response.data) {
      throw new Error('Failed to start conversation');
    }

    return response.data;
  }

  /**
   * Send a message and get AI response
   */
  async sendMessage(
    message: string,
    goal: AICoachGoalCategory,
    conversationHistory: ChatMessage[],
    messageCount: number,
    extractedInsights?: ExtractedInsight[],
    language: SupportedLanguage = 'en'
  ): Promise<AICoachMessageResponse> {
    const response = await api.post<AICoachMessageResponse>('/ai-coach/message', {
      message,
      goal,
      conversationHistory,
      messageCount,
      extractedInsights,
      language,
    });

    if (!response.success || !response.data) {
      throw new Error('Failed to send message');
    }

    return response.data;
  }

  /**
   * Complete the assessment
   */
  async completeAssessment(
    goal: AICoachGoalCategory,
    conversationHistory: ChatMessage[],
    extractedInsights: ExtractedInsight[]
  ): Promise<AICoachCompleteResponse> {
    const response = await api.post<AICoachCompleteResponse>('/ai-coach/complete', {
      goal,
      conversationHistory,
      extractedInsights,
    });

    if (!response.success || !response.data) {
      throw new Error('Failed to complete assessment');
    }

    return response.data;
  }

  /**
   * Analyze a health image
   */
  async analyzeImage(
    file: File,
    goal?: AICoachGoalCategory,
    question?: string
  ): Promise<ImageAnalyzeResponse> {
    const formData = new FormData();
    formData.append('image', file);
    if (goal) formData.append('goal', goal);
    if (question) formData.append('question', question);

    const response = await api.upload<ImageAnalyzeResponse>('/ai-coach/image/analyze', formData);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to analyze image');
    }

    return response.data;
  }

  /**
   * Send chat message with image
   */
  async chatWithImage(
    file: File,
    goal: AICoachGoalCategory,
    message?: string,
    sessionId?: string
  ): Promise<ChatWithImageResponse> {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('goal', goal);
    if (message) formData.append('message', message);
    if (sessionId) formData.append('sessionId', sessionId);

    const response = await api.upload<ChatWithImageResponse>('/ai-coach/chat-with-image', formData);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to send image');
    }

    return response.data;
  }

  // ============================================================================
  // Session Management - Auto-persisting chat
  // ============================================================================

  /**
   * Get or create an active session (auto-persists chat)
   */
  async getOrCreateSession(goal: AICoachGoalCategory, sessionType = 'assessment'): Promise<SessionResponse> {
    const response = await api.post<SessionResponse>('/ai-coach/session', { goal, sessionType });

    if (!response.success || !response.data) {
      throw new Error('Failed to get/create session');
    }

    return response.data;
  }

  /**
   * Get a specific session by ID
   */
  async getSession(sessionId: string): Promise<SessionResponse> {
    const response = await api.get<SessionResponse>(`/ai-coach/session/${sessionId}`);

    if (!response.success || !response.data) {
      throw new Error('Failed to get session');
    }

    return response.data;
  }

  /**
   * Get chat history (all previous sessions)
   */
  async getChatHistory(limit = 20): Promise<ChatHistoryResponse> {
    const response = await api.get<ChatHistoryResponse>('/ai-coach/history', {
      params: { limit },
    });

    if (!response.success || !response.data) {
      throw new Error('Failed to get chat history');
    }

    return response.data;
  }

  /**
   * Send message with automatic session persistence
   * This is the preferred method for chat - it auto-saves everything
   */
  async chat(
    message: string,
    goal: AICoachGoalCategory,
    sessionId?: string,
    isOnboarding: boolean = false
  ): Promise<AICoachChatResponse> {
    const response = await api.post<AICoachChatResponse>('/ai-coach/chat', {
      message,
      goal,
      sessionId,
      isOnboarding,
    });

    if (!response.success || !response.data) {
      throw new Error('Failed to send message');
    }

    return response.data;
  }

  /**
   * Download chat session as PDF
   * Uses direct fetch since api client doesn't support blob responses
   */
  async downloadSessionPDF(sessionId: string): Promise<Blob> {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

    // Get token from cookie
    const getCookie = (name: string): string | null => {
      if (typeof document === 'undefined') return null;
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) {
        return parts.pop()?.split(';').shift() || null;
      }
      return null;
    };

    const token = getCookie('balencia_access_token');

    const response = await fetch(`${API_URL}/ai-coach/session/${sessionId}/pdf`, {
      method: 'GET',
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to download PDF');
    }

    return response.blob();
  }

  /**
   * Delete a chat session
   */
  async deleteSession(sessionId: string): Promise<void> {
    const response = await api.delete(`/ai-coach/session/${sessionId}`);

    if (!response.success) {
      throw new Error('Failed to delete session');
    }
  }

  // ============================================================================
  // Goal Generation
  // ============================================================================

  /**
   * Generate personalized SMART goals based on assessment
   * @param request - Goal category, assessment responses, body stats, and optional custom goal text
   * @returns Generated goals with reasoning
   */
  async generateGoals(request: GenerateGoalsRequest): Promise<GenerateGoalsResponse> {
    const response = await api.post<GenerateGoalsResponse>('/ai-coach/generate-goals', {
      goalCategory: request.goalCategory,
      assessmentResponses: request.assessmentResponses,
      bodyStats: request.bodyStats,
      customGoalText: request.customGoalText,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to generate goals');
    }

    return response.data;
  }

  // ============================================================================
  // MCQ Dynamic Question Generation
  // ============================================================================

  /**
   * Generate next MCQ question dynamically based on user's goal and previous answers
   */
  async generateMCQQuestion(request: MCQGenerationRequest): Promise<MCQGenerationResponse> {
    const response = await api.post<MCQGenerationResponse>('/ai-coach/mcq/question', {
      goal: request.goal,
      phase: request.phase,
      previousAnswers: request.previousAnswers,
      extractedInsights: request.extractedInsights,
      language: request.language,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to generate MCQ question');
    }

    return response.data;
  }

  /**
   * Process MCQ answer and extract insights
   */
  async processMCQAnswer(request: MCQAnswerRequest): Promise<MCQAnswerResponse> {
    const response = await api.post<MCQAnswerResponse>('/ai-coach/mcq/answer', {
      questionId: request.questionId,
      selectedOptions: request.selectedOptions,
      goal: request.goal,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to process MCQ answer');
    }

    return response.data;
  }

  // ============================================================================
  // Coaching Profile
  // ============================================================================

  /**
   * Get user's coaching profile with insights, adherence, predictions
   */
  async getCoachingProfile(): Promise<CoachingProfileResponse> {
    const response = await api.get<CoachingProfileResponse>('/ai-coach/profile');

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to get coaching profile');
    }

    return response.data;
  }

  /**
   * Force regenerate the coaching profile
   */
  async refreshCoachingProfile(): Promise<CoachingProfileResponse> {
    const response = await api.post<CoachingProfileResponse>('/ai-coach/profile/refresh');

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to refresh coaching profile');
    }

    return response.data;
  }

  /**
   * Update coaching tone preference
   */
  async updateCoachingTone(tone: 'supportive' | 'direct' | 'tough_love'): Promise<void> {
    const response = await api.patch('/ai-coach/profile/tone', { tone });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to update coaching tone');
    }
  }
}

// ============================================================================
// Coaching Profile Types
// ============================================================================

export interface CoachingProfileResponse {
  profile: {
    firstName: string;
    daysOnPlatform: number;
    fitnessJourney: {
      totalWorkouts: number;
      workoutConsistencyRate: number;
      streakDays: number;
      longestStreak: number;
      favoriteWorkouts: string[];
      weightChange: number | null;
      recentWorkouts: { name: string; date?: string }[];
    };
    adherenceScores: {
      workout: number;
      nutrition: number;
      sleep: number;
      recovery: number;
      wellbeing: number;
    };
    keyInsights: { type: 'working' | 'blocking'; text: string }[];
    riskFlags: { severity: 'low' | 'medium' | 'high'; category: string; description: string }[];
    predictions: { timeframe: string; metric: string; projection: string; confidence: number }[];
    nextBestActions: { action: string; expectedImpact: string; priority: number }[];
    goalAlignment: { score: number; misaligned: { goal: string; reason: string }[] };
    dataGaps: { metric: string; description: string; howToFix: string }[];
    currentState: {
      energyLevel: number;
      moodLevel: number;
      stressLevel: number;
      readinessForWorkout: string;
      todaysBiometrics: { recoveryScore: number; sleepDuration: number } | null;
      suggestedFocus: string;
    };
    recommendedApproach: {
      tone: string;
      focus: string;
      openingStyle: string;
      avoidTopics: string[];
    };
    goalsContext: {
      primaryGoal: { title: string; progress: number; daysRemaining: number } | null;
      activeGoals: { title: string; progress: number }[];
    };
  };
}

export const aiCoachService = new AICoachServiceClient();
