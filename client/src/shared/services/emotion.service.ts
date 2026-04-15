/**
 * Emotion Data Service
 * Client-side service for emotion data operations with privacy controls
 */

import { api } from '@/lib/api-client';

// ============================================================================
// Types
// ============================================================================

export type EmotionCategory =
  | 'happy'
  | 'sad'
  | 'angry'
  | 'anxious'
  | 'calm'
  | 'stressed'
  | 'excited'
  | 'tired'
  | 'neutral'
  | 'distressed';

export interface EmotionLog {
  id: string;
  callId?: string;
  conversationId?: string;
  timestamp: string;
  category: EmotionCategory;
  confidence: number;
  source: 'voice' | 'text';
  createdAt: string;
}

export interface EmotionTrend {
  userId: string;
  period: {
    start: string;
    end: string;
    days: number;
  };
  dominantEmotion: EmotionCategory;
  averageConfidence: number;
  emotionDistribution: Record<EmotionCategory, number>;
  trend: 'improving' | 'stable' | 'declining';
  recentEmotions: Array<{
    category: EmotionCategory;
    confidence: number;
    timestamp: string;
  }>;
}

export interface EmotionPreferences {
  emotionLoggingEnabled: boolean;
  emotionDataRetentionDays: number;
}

export interface EmotionLogsResponse {
  logs: EmotionLog[];
  enabled: boolean;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface RecoveryScore {
  userId: string;
  scoreDate: string;
  recoveryScore: number;
  components: {
    sleep: number;
    stress: number;
    mood: number;
    emotion: number;
    activity: number;
  };
  emotionContribution: number;
  emotionWeight: number;
  factors: {
    sleepHours?: number;
    stressLevel?: number;
    moodScore?: number;
    avgEmotionScore?: number;
    activityLevel?: number;
  };
  trend?: 'improving' | 'stable' | 'declining';
  previousScore?: number;
}

export interface RecoveryTrend {
  date: string;
  score: number;
  trend: 'improving' | 'stable' | 'declining';
}

// ============================================================================
// Service
// ============================================================================

export const emotionService = {
  /**
   * Get emotion logs with pagination and filtering
   */
  getLogs: (params?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);

    const query = queryParams.toString();
    return api.get<EmotionLogsResponse>(`/emotions/logs${query ? `?${query}` : ''}`);
  },

  /**
   * Get emotion trends over time
   */
  getTrends: (days: number = 30) =>
    api.get<EmotionTrend>(`/emotions/trends?days=${days}`),

  /**
   * Delete specific emotion log
   */
  deleteLog: (logId: string) =>
    api.delete<{ deleted: boolean }>(`/emotions/logs/${logId}`),

  /**
   * Delete all emotion logs
   */
  deleteAllLogs: () =>
    api.delete<{ deleted: number }>('/emotions/logs'),

  /**
   * Get emotion preferences
   */
  getPreferences: () =>
    api.get<EmotionPreferences>('/emotions/preferences'),

  /**
   * Update emotion preferences
   */
  updatePreferences: (preferences: Partial<EmotionPreferences>) =>
    api.patch<{ updated: boolean }>('/emotions/preferences', preferences),

  /**
   * Get mental recovery score for today
   */
  getRecoveryScore: (date?: string) => {
    const queryDate = date || new Date().toISOString().split('T')[0];
    return api.get<RecoveryScore>(`/recovery-score?date=${queryDate}`);
  },

  /**
   * Get recovery score trends
   */
  getRecoveryTrends: (days: number = 30) =>
    api.get<RecoveryTrend[]>(`/recovery-score/trends?days=${days}`),
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get color for emotion category
 */
export function getEmotionColor(category: EmotionCategory): string {
  const colors: Record<EmotionCategory, string> = {
    happy: '#22c55e', // green-500
    calm: '#3b82f6', // blue-500
    excited: '#f59e0b', // amber-500
    neutral: '#6b7280', // gray-500
    tired: '#8b5cf6', // violet-500
    sad: '#64748b', // slate-500
    anxious: '#f97316', // orange-500
    stressed: '#ef4444', // red-500
    angry: '#dc2626', // red-600
    distressed: '#b91c1c', // red-700
  };
  return colors[category] || '#6b7280';
}

/**
 * Get emoji for emotion category
 */
export function getEmotionEmoji(category: EmotionCategory): string {
  const emojis: Record<EmotionCategory, string> = {
    happy: '😊',
    calm: '😌',
    excited: '🤩',
    neutral: '😐',
    tired: '😴',
    sad: '😢',
    anxious: '😰',
    stressed: '😫',
    angry: '😠',
    distressed: '😭',
  };
  return emojis[category] || '😐';
}

/**
 * Get display label for emotion category
 */
export function getEmotionLabel(category: EmotionCategory): string {
  const labels: Record<EmotionCategory, string> = {
    happy: 'Happy',
    calm: 'Calm',
    excited: 'Excited',
    neutral: 'Neutral',
    tired: 'Tired',
    sad: 'Sad',
    anxious: 'Anxious',
    stressed: 'Stressed',
    angry: 'Angry',
    distressed: 'Distressed',
  };
  return labels[category] || 'Unknown';
}

/**
 * Classify emotion as positive, negative, or neutral
 */
export function getEmotionSentiment(category: EmotionCategory): 'positive' | 'negative' | 'neutral' {
  const positive: EmotionCategory[] = ['happy', 'calm', 'excited'];
  const negative: EmotionCategory[] = ['sad', 'angry', 'anxious', 'stressed', 'distressed'];
  
  if (positive.includes(category)) return 'positive';
  if (negative.includes(category)) return 'negative';
  return 'neutral';
}

export default emotionService;

