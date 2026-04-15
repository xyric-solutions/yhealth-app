/**
 * Call Summary Service
 * Client-side service for call summaries and action items
 */

import { api } from '@/lib/api-client';

// ============================================================================
// Types
// ============================================================================

export type ActionCategory = 
  | 'fitness'
  | 'nutrition'
  | 'sleep'
  | 'stress'
  | 'wellness'
  | 'goal'
  | 'habit'
  | 'follow_up';

export type ActionStatus = 'pending' | 'in_progress' | 'completed' | 'dismissed';

export interface ActionItem {
  id: string;
  summaryId: string;
  content: string;
  category: ActionCategory;
  priority: 'high' | 'medium' | 'low';
  dueDate?: string;
  status: ActionStatus;
  completedAt?: string;
  reminderSet?: boolean;
}

export interface CallSummary {
  id: string;
  callId: string;
  userId: string;
  sessionType: string;
  depthMode: 'light' | 'deep';
  summary: string;
  keyInsights: string[];
  actionItems: ActionItem[];
  emotionalTrend?: string;
  duration: number;
  generatedAt: string;
  deliveryStatus: {
    app: boolean;
    whatsapp: boolean;
    push: boolean;
    deliveredAt?: string;
  };
}

export interface SummariesResponse {
  summaries: CallSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================================
// Service
// ============================================================================

export const callSummaryService = {
  /**
   * Get user's call summaries
   */
  getSummaries: (params?: { page?: number; limit?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const query = queryParams.toString();
    return api.get<SummariesResponse>(`/call-summaries${query ? `?${query}` : ''}`);
  },

  /**
   * Get summary for a specific call
   */
  getSummaryByCallId: (callId: string) =>
    api.get<CallSummary>(`/call-summaries/${callId}`),

  /**
   * Generate summary for a call
   */
  generateSummary: (data: {
    callId: string;
    sessionType: string;
    depthMode?: 'light' | 'deep';
    conversationId?: string;
    duration: number;
  }) => api.post<CallSummary>('/call-summaries/generate', data),

  /**
   * Update action item status
   */
  updateActionItemStatus: (actionItemId: string, status: ActionStatus) =>
    api.patch<ActionItem>(`/call-summaries/action-items/${actionItemId}`, { status }),

  /**
   * Get pending action items
   */
  getPendingActionItems: () =>
    api.get<{ actionItems: ActionItem[] }>('/call-summaries/action-items/pending'),
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get color for action category
 */
export function getCategoryColor(category: ActionCategory): string {
  const colors: Record<ActionCategory, string> = {
    fitness: '#f97316', // orange-500
    nutrition: '#22c55e', // green-500
    sleep: '#8b5cf6', // violet-500
    stress: '#ef4444', // red-500
    wellness: '#3b82f6', // blue-500
    goal: '#eab308', // yellow-500
    habit: '#06b6d4', // cyan-500
    follow_up: '#6b7280', // gray-500
  };
  return colors[category] || '#6b7280';
}

/**
 * Get icon name for action category
 */
export function getCategoryIcon(category: ActionCategory): string {
  const icons: Record<ActionCategory, string> = {
    fitness: 'dumbbell',
    nutrition: 'utensils',
    sleep: 'moon',
    stress: 'heart',
    wellness: 'sparkles',
    goal: 'target',
    habit: 'repeat',
    follow_up: 'calendar',
  };
  return icons[category] || 'check';
}

/**
 * Get priority color
 */
export function getPriorityColor(priority: 'high' | 'medium' | 'low'): string {
  const colors = {
    high: '#ef4444', // red-500
    medium: '#f59e0b', // amber-500
    low: '#22c55e', // green-500
  };
  return colors[priority];
}

/**
 * Format duration in seconds to human readable
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}

export default callSummaryService;

