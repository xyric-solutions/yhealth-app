/**
 * Automation Service
 * Client-side service for automation settings and logs
 */

import { api } from '@/lib/api-client';

// ============================================================================
// Types
// ============================================================================

export interface AutomationSettings {
  scheduleAutomationEnabled: boolean;
  activityAutomationEnabled: boolean;
  scheduleReminderMinutes: number;
  aiMessageStyle: 'friendly' | 'professional' | 'motivational';
  timezone: string;
}

export interface AutomationLog {
  id: string;
  sourceId: string;
  sourceType: 'schedule_item' | 'activity_log';
  messageType: 'reminder' | 'start' | 'followup' | 'completion_check';
  messageContent: string;
  sentAt: string;
}

export interface AutomationLogsResponse {
  scheduleLogs: AutomationLog[];
  activityLogs: AutomationLog[];
}

export interface UpdateAutomationSettingsRequest {
  scheduleAutomationEnabled?: boolean;
  activityAutomationEnabled?: boolean;
  scheduleReminderMinutes?: number;
  aiMessageStyle?: 'friendly' | 'professional' | 'motivational';
}

export interface TestAutomationRequest {
  activityLogId: string;
  messageType: 'reminder' | 'start' | 'followup';
}

// ============================================================================
// Automation Service
// ============================================================================

export const automationService = {
  /**
   * Get user automation settings
   */
  getSettings: () => api.get<AutomationSettings>('/automation/settings'),

  /**
   * Update user automation settings
   */
  updateSettings: (data: UpdateAutomationSettingsRequest) =>
    api.patch<{ message: string }>('/automation/settings', data),

  /**
   * Test automation for a specific activity
   */
  test: (data: TestAutomationRequest) =>
    api.post<{ message: string; activityLogId: string; messageType: string }>('/automation/test', data),

  /**
   * Get automation message history
   */
  getLogs: (params?: { limit?: number; offset?: number }) => {
    const queryParams = new URLSearchParams();
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());
    const queryString = queryParams.toString();
    return api.get<AutomationLogsResponse>(`/automation/logs${queryString ? `?${queryString}` : ''}`);
  },
};

