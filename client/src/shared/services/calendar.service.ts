/**
 * @file Calendar Service (Client)
 * @description API client for Google Calendar integration and schedule context
 */

import { api } from '@/lib/api-client';

// ============================================
// TYPES
// ============================================

export interface CalendarConnection {
  id: string;
  userId: string;
  provider: string;
  tokenExpiresAt: string;
  calendarIds: string[];
  syncEnabled: boolean;
  lastSyncAt: string | null;
  syncStatus: string;
  syncError: string | null;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  allDay: boolean;
  location: string | null;
  status: string;
  busyStatus: string;
}

export interface FreeWindow {
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

export interface TimeBlock {
  startTime: string;
  endTime: string;
  durationMinutes: number;
  title: string;
  category?: string;
  source: 'manual' | 'workout' | 'google_calendar';
}

export interface SpecialDay {
  type: 'ramadan' | 'eid' | 'holiday' | 'weekend' | 'user_defined';
  name: string;
  adjustments: {
    reduceWorkoutIntensity: boolean;
    adjustMealTiming: boolean;
    reduceNotifications: boolean;
    customMessage?: string;
  };
}

export interface DayContext {
  date: string;
  totalItems: number;
  timeBlocks: TimeBlock[];
  freeWindows: FreeWindow[];
  busyHours: number;
  freeHours: number;
  stressLevel: 'low' | 'medium' | 'high' | 'critical';
  hasEarlyMorning: boolean;
  hasLateNight: boolean;
  longestFreeWindow: FreeWindow | null;
  longestBusyStreak: number;
  backToBackCount: number;
  categories: Record<string, number>;
  specialDays: SpecialDay[];
}

// ============================================
// SERVICE
// ============================================

class CalendarApiService {
  // ── Schedule Context ──

  async getScheduleContext(date?: string) {
    const params = date ? { date } : {};
    return api.get<DayContext>('/v1/schedules/context', { params });
  }

  // ── Google Calendar ──

  async getAuthUrl() {
    return api.get<{ url: string }>('/calendar/auth-url');
  }

  async getConnections() {
    return api.get<{ connections: CalendarConnection[]; configured: boolean }>('/calendar/connections');
  }

  async disconnectCalendar(connectionId: string) {
    return api.delete(`/calendar/connections/${connectionId}`);
  }

  async syncCalendar() {
    return api.post<{ eventsSynced: number }>('/calendar/sync');
  }

  async getCalendarEvents(startDate: string, endDate: string) {
    return api.get<{ events: CalendarEvent[]; count: number }>('/calendar/events', {
      params: { start: startDate, end: endDate },
    });
  }
}

export const calendarApiService = new CalendarApiService();
