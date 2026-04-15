/**
 * Activity Status Service
 * Client-side service for activity status operations
 */

import { api } from '@/lib/api-client';

// ============================================================================
// Types
// ============================================================================

export type ActivityStatus = 'working' | 'sick' | 'injury' | 'rest' | 'vacation' | 'travel' | 'stress' | 'excellent' | 'good' | 'fair' | 'poor';

export interface ActivityStatusHistory {
  id: string;
  user_id: string;
  status_date: string;
  activity_status: ActivityStatus;
  mood?: number;
  notes?: string;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface CurrentStatusResponse {
  status: ActivityStatus;
  updatedAt?: string;
}

export interface SetStatusRequest {
  date: string;
  status: ActivityStatus;
  mood?: number;
  notes?: string;
}

export interface CalendarDayStatus {
  date: string;
  status?: ActivityStatus;
  mood?: number;
  notes?: string;
}

export interface CalendarMonthResponse {
  year: number;
  month: number;
  days: CalendarDayStatus[];
}

export interface StatusHistoryResponse {
  statuses: ActivityStatusHistory[];
  total: number;
}

export interface StatusStats {
  totalDays: number;
  statusDistribution: Record<ActivityStatus, number>;
  averageMood?: number;
  mostCommonStatus: ActivityStatus;
  streakDays: number;
}

// ============================================================================
// Status Configuration
// ============================================================================

export interface ActivityStatusConfig {
  status: ActivityStatus;
  color: string;
  icon: string;
  mood: number;
  description: string;
}

export const STATUS_CONFIG: Record<ActivityStatus, ActivityStatusConfig> = {
  working: { status: 'working', color: '#10B981', icon: '💼', mood: 4, description: 'Normal working day' },
  sick: { status: 'sick', color: '#EF4444', icon: '🤒', mood: 2, description: 'Sick/illness' },
  injury: { status: 'injury', color: '#F59E0B', icon: '🩹', mood: 2, description: 'Injury/recovery' },
  rest: { status: 'rest', color: '#6366F1', icon: '😴', mood: 3, description: 'Rest day' },
  vacation: { status: 'vacation', color: '#8B5CF6', icon: '🏖️', mood: 5, description: 'Vacation/holiday' },
  travel: { status: 'travel', color: '#06B6D4', icon: '✈️', mood: 4, description: 'Traveling' },
  stress: { status: 'stress', color: '#F97316', icon: '😰', mood: 2, description: 'High stress day' },
  excellent: { status: 'excellent', color: '#22C55E', icon: '🌟', mood: 5, description: 'Excellent day' },
  good: { status: 'good', color: '#84CC16', icon: '😊', mood: 4, description: 'Good day' },
  fair: { status: 'fair', color: '#EAB308', icon: '😐', mood: 3, description: 'Fair day' },
  poor: { status: 'poor', color: '#DC2626', icon: '😞', mood: 1, description: 'Poor day' },
};

// ============================================================================
// Activity Status Service
// ============================================================================

export const activityStatusService = {
  /**
   * Get current activity status
   */
  getCurrent: () =>
    api.get<CurrentStatusResponse>('/activity-status/current'),

  /**
   * Update current activity status
   */
  updateCurrent: (status: ActivityStatus) =>
    api.put<CurrentStatusResponse>('/activity-status/current', { status }),

  /**
   * Get status history
   */
  getHistory: (params?: {
    startDate: string;
    endDate: string;
    page?: number;
    limit?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    
    const query = queryParams.toString();
    return api.get<StatusHistoryResponse>(`/activity-status/history${query ? `?${query}` : ''}`);
  },

  /**
   * Set status for a specific date
   */
  setStatusForDate: (data: SetStatusRequest) =>
    api.post<ActivityStatusHistory>('/activity-status/date', data),

  /**
   * Get calendar data for a month
   */
  getCalendar: (year: number, month: number) =>
    api.get<CalendarMonthResponse>(`/activity-status/calendar?year=${year}&month=${month}`),

  /**
   * Get status statistics
   */
  getStats: (params?: {
    startDate?: string;
    endDate?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.startDate) queryParams.append('startDate', params.startDate);
    if (params?.endDate) queryParams.append('endDate', params.endDate);
    
    const query = queryParams.toString();
    return api.get<StatusStats>(`/activity-status/stats${query ? `?${query}` : ''}`);
  },

  /**
   * Get status for a specific date
   */
  getStatusForDate: (date: string) =>
    api.get<ActivityStatusHistory | null>(`/activity-status/date/${date}`),

  /**
   * Delete status for a specific date
   */
  deleteStatusForDate: (date: string) =>
    api.delete<{ success: boolean }>(`/activity-status/date/${date}`),
};

