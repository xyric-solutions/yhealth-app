/**
 * Emotional Check-In Service
 * Client-side service for emotional check-in API calls
 */

import { api } from '@/lib/api-client';

// ============================================
// TYPES
// ============================================

export interface EmotionalCheckInSession {
  id: string;
  userId: string;
  startedAt: string;
  completedAt?: string;
  durationSeconds?: number;
  questionCount: number;
  screeningType: 'light' | 'standard' | 'deep';
  overallAnxietyScore?: number;
  overallMoodScore?: number;
  riskLevel: 'none' | 'low' | 'moderate' | 'high' | 'critical';
  crisisDetected: boolean;
  insights: Record<string, unknown>;
  recommendations: Array<{
    type: string;
    title: string;
    description: string;
    duration?: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface CheckInQuestion {
  id: string;
  question: string;
  type: 'scale' | 'frequency' | 'text';
  options?: string[];
  scaleRange?: { min: number; max: number; labels?: string[] };
}

export interface CheckInResponse {
  questionId: string;
  value: number | string;
  text?: string;
}

export interface StartCheckInResponse {
  session: EmotionalCheckInSession;
  greeting: string;
  firstQuestion: CheckInQuestion;
}

export interface ProcessResponseResult {
  nextQuestion?: CheckInQuestion;
  isComplete: boolean;
  message?: string;
}

// ============================================
// SERVICE
// ============================================

class EmotionalCheckInService {
  private readonly baseUrl = '/v1/wellbeing/emotional-checkin';

  /**
   * Start a new emotional check-in session
   */
  async startCheckIn(type: 'light' | 'standard' | 'deep' = 'standard'): Promise<StartCheckInResponse> {
    const response = await api.post<StartCheckInResponse>(
      `${this.baseUrl}/start`,
      { type }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to start check-in');
    }

    return response.data;
  }

  /**
   * Submit a response to a check-in question
   */
  async submitResponse(
    sessionId: string,
    questionId: string,
    value: number | string,
    text: string | undefined,
    conversationHistory: Array<{ role: 'assistant' | 'user'; content: string; timestamp: string }>
  ): Promise<ProcessResponseResult> {
    const response = await api.post<ProcessResponseResult>(
      `${this.baseUrl}/${sessionId}/respond`,
      {
        questionId,
        value,
        text,
        conversationHistory,
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to submit response');
    }

    return response.data;
  }

  /**
   * Get check-in session
   */
  async getSession(sessionId: string): Promise<EmotionalCheckInSession> {
    const response = await api.get<{ session: EmotionalCheckInSession }>(
      `${this.baseUrl}/${sessionId}`
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to get session');
    }

    return response.data.session;
  }

  /**
   * Complete check-in session
   */
  async completeSession(sessionId: string): Promise<EmotionalCheckInSession> {
    const response = await api.post<{ session: EmotionalCheckInSession }>(
      `${this.baseUrl}/${sessionId}/complete`
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to complete session');
    }

    return response.data.session;
  }

  /**
   * Get check-in history
   */
  async getHistory(options: { page?: number; limit?: number } = {}): Promise<{
    sessions: EmotionalCheckInSession[];
    total: number;
    page: number;
    limit: number;
  }> {
    const params = new URLSearchParams();
    if (options.page) params.append('page', String(options.page));
    if (options.limit) params.append('limit', String(options.limit));

    const response = await api.get<{
      sessions: EmotionalCheckInSession[];
      total: number;
      page: number;
      limit: number;
    }>(`${this.baseUrl}/history?${params.toString()}`);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to get history');
    }

    return response.data;
  }

  /**
   * Get trend analysis
   */
  async getTrends(timeWindow: 'week' | 'month' = 'week'): Promise<{
    trends: Array<{
      period: string;
      anxiety: number;
      mood: number;
      energy: number;
      change: {
        anxiety: number;
        mood: number;
        energy: number;
      };
    }>;
    baseline: {
      anxiety: number;
      mood: number;
      energy: number;
      stress: number;
      sampleSize: number;
      lastUpdated: string;
    };
  }> {
    const response = await api.get<{
      trends: unknown[];
      baseline: unknown;
    }>(`${this.baseUrl}/trends?timeWindow=${timeWindow}`);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to get trends');
    }

    return response.data as {
      trends: Array<{
        period: string;
        anxiety: number;
        mood: number;
        energy: number;
        change: { anxiety: number; mood: number; energy: number };
      }>;
      baseline: {
        anxiety: number;
        mood: number;
        energy: number;
        stress: number;
        sampleSize: number;
        lastUpdated: string;
      };
    };
  }

  /**
   * Analyze camera image for emotional check-in (legacy - uses server-side OpenAI Vision)
   */
  async analyzeCameraImage(
    sessionId: string,
    file: File
  ): Promise<{
    moodIndicators: {
      facialExpression: string;
      energyLevel: string;
      stressIndicators: string[];
      overallAssessment: string;
    };
    scores: {
      mood: number;
      energy: number;
      stress: number;
    };
  }> {
    const formData = new FormData();
    formData.append('image', file);

    const response = await api.upload<{
      moodIndicators: {
        facialExpression: string;
        energyLevel: string;
        stressIndicators: string[];
        overallAssessment: string;
      };
      scores: {
        mood: number;
        energy: number;
        stress: number;
      };
    }>(`${this.baseUrl}/${sessionId}/analyze-camera`, formData);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to analyze camera image');
    }

    return response.data;
  }

  /**
   * Submit TensorFlow.js emotion analysis results (on-device processing)
   * This is faster and more privacy-preserving than server-side analysis
   */
  async submitTensorFlowAnalysis(
    sessionId: string,
    analysis: {
      dominant: string;
      distribution: Record<string, number>;
      engagement: number;
      stressIndicators: {
        browFurrow: number;
        jawTension: number;
        eyeStrain: number;
      };
      averageConfidence: number;
      sampleCount: number;
    }
  ): Promise<{
    moodScore: number;
    stressScore: number;
    energyScore: number;
    emotionalProfile: {
      dominant: string;
      distribution: Record<string, number>;
      engagement: number;
    };
    stressIndicators: {
      browFurrow: number;
      jawTension: number;
      eyeStrain: number;
    };
    confidence: number;
    insights: string[];
  }> {
    const response = await api.post<{
      moodScore: number;
      stressScore: number;
      energyScore: number;
      emotionalProfile: {
        dominant: string;
        distribution: Record<string, number>;
        engagement: number;
      };
      stressIndicators: {
        browFurrow: number;
        jawTension: number;
        eyeStrain: number;
      };
      confidence: number;
      insights: string[];
    }>(`${this.baseUrl}/${sessionId}/tensorflow-analysis`, analysis);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to process emotion analysis');
    }

    return response.data;
  }

  /**
   * Get enhanced trend analysis (7/30/90 day windows with pattern detection)
   */
  async getEnhancedTrends(): Promise<{
    shortTerm: TrendWindow;
    mediumTerm: TrendWindow;
    longTerm: TrendWindow;
    patterns: PatternAnalysis;
    anomalies: Anomaly[];
    overallTrend: 'improving' | 'stable' | 'declining';
    confidenceScore: number;
  }> {
    const response = await api.get<{
      shortTerm: TrendWindow;
      mediumTerm: TrendWindow;
      longTerm: TrendWindow;
      patterns: PatternAnalysis;
      anomalies: Anomaly[];
      overallTrend: 'improving' | 'stable' | 'declining';
      confidenceScore: number;
    }>(`${this.baseUrl}/enhanced-trends`);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to get enhanced trends');
    }

    return response.data;
  }

  /**
   * Recover an incomplete session
   */
  async recoverSession(sessionId: string): Promise<{
    session: EmotionalCheckInSession;
    lastQuestion?: CheckInQuestion;
    conversationHistory: Array<{ role: 'assistant' | 'user'; content: string; timestamp: string }>;
  }> {
    const response = await api.post<{
      session: EmotionalCheckInSession;
      lastQuestion?: CheckInQuestion;
      conversationHistory: Array<{ role: 'assistant' | 'user'; content: string; timestamp: string }>;
    }>(`${this.baseUrl}/${sessionId}/recover`);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to recover session');
    }

    return response.data;
  }

  /**
   * Get incomplete sessions that can be recovered
   */
  async getIncompleteSessions(): Promise<{
    sessions: Array<{
      id: string;
      startedAt: string;
      questionCount: number;
      screeningType: string;
      lastActivityAt: string;
    }>;
  }> {
    const response = await api.get<{
      sessions: Array<{
        id: string;
        startedAt: string;
        questionCount: number;
        screeningType: string;
        lastActivityAt: string;
      }>;
    }>(`${this.baseUrl}/incomplete`);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to get incomplete sessions');
    }

    return response.data;
  }
}

// ============================================
// TYPES FOR ENHANCED TRENDS
// ============================================

export interface TrendWindow {
  window: '7d' | '30d' | '90d';
  days: number;
  trend: 'improving' | 'stable' | 'declining';
  delta: number;
  average: {
    anxiety: number;
    mood: number;
    energy: number;
    stress: number;
  };
  sampleCount: number;
}

export interface PatternAnalysis {
  weekdayVsWeekend: {
    weekday: { mood: number; stress: number };
    weekend: { mood: number; stress: number };
    significant: boolean;
  };
  timeOfDay: {
    morning: { mood: number; energy: number };
    afternoon: { mood: number; energy: number };
    evening: { mood: number; energy: number };
  };
  triggers: {
    work: boolean;
    sleep: boolean;
    social: boolean;
    health: boolean;
  };
  consistency: {
    checkInFrequency: number;
    streak: number;
    bestStreak: number;
  };
}

export interface Anomaly {
  date: string;
  metric: 'anxiety' | 'mood' | 'energy' | 'stress';
  value: number;
  expectedRange: { min: number; max: number };
  deviation: number;
  description: string;
}

export const emotionalCheckInService = new EmotionalCheckInService();
export default emotionalCheckInService;

