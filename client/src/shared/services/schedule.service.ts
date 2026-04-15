/**
 * @file Schedule API Service
 * @description Client-side API service for daily schedules
 */

import { api, type ApiResponse } from '@/lib/api-client';

// ============================================
// TYPES
// ============================================

export interface ScheduleTemplate {
  id: string;
  userId: string;
  name: string;
  description?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleItem {
  id: string;
  scheduleId: string;
  title: string;
  description?: string;
  startTime: string; // HH:mm format
  endTime?: string; // HH:mm format
  durationMinutes?: number;
  color?: string;
  icon?: string;
  category?: string;
  shape?: 'square' | 'circle' | 'rounded' | 'diamond' | 'hexagon';
  position: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleLink {
  id: string;
  scheduleId: string;
  sourceItemId: string;
  targetItemId: string;
  linkType: 'sequential' | 'conditional' | 'parallel';
  delayMinutes: number;
  conditions: Record<string, unknown>;
  createdAt: string;
}

export interface DailySchedule {
  id: string;
  userId: string;
  scheduleDate: string; // YYYY-MM-DD
  templateId?: string;
  name?: string;
  notes?: string;
  isTemplate: boolean;
  items: ScheduleItem[];
  links: ScheduleLink[];
  createdAt: string;
  updatedAt: string;
}

export interface CalendarSchedule {
  date: string;
  scheduleId?: string;
  itemCount: number;
  hasSchedule: boolean;
}

export interface CreateScheduleRequest {
  schedule_date: string;
  template_id?: string;
  name?: string;
  notes?: string;
}

export interface UpdateScheduleRequest {
  name?: string;
  notes?: string;
}

export interface CreateScheduleItemRequest {
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  duration_minutes?: number;
  color?: string;
  icon?: string;
  category?: string;
  position: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateScheduleItemRequest {
  title?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  duration_minutes?: number;
  color?: string;
  icon?: string;
  category?: string;
  shape?: 'square' | 'circle' | 'rounded' | 'diamond' | 'hexagon';
  position?: number;
  metadata?: Record<string, unknown>;
}

export interface CreateScheduleLinkRequest {
  source_item_id: string;
  target_item_id: string;
  link_type?: 'sequential' | 'conditional' | 'parallel';
  delay_minutes?: number;
  conditions?: Record<string, unknown>;
}

export interface CreateTemplateRequest {
  name: string;
  description?: string;
  is_default?: boolean;
}

// ============================================
// SCHEDULE SERVICE
// ============================================

export const scheduleService = {
  /**
   * Get schedules for calendar view
   */
  async getCalendarSchedules(
    startDate: string,
    endDate: string
  ): Promise<ApiResponse<{ schedules: CalendarSchedule[] }>> {
    return api.get('/v1/schedules/calendar', {
      params: { startDate, endDate },
    });
  },

  /**
   * Get schedule for specific date
   * @param date - Date string (YYYY-MM-DD) or date with cache-busting query param
   */
  async getScheduleByDate(date: string): Promise<ApiResponse<{ schedule: DailySchedule | null }>> {
    // Extract just the date part if query params are included
    const dateOnly = date.split('?')[0];
    // Check if cache-busting param is present
    const hasCacheBust = date.includes('?_t=');
    const url = hasCacheBust ? `/v1/schedules/${dateOnly}?${date.split('?')[1]}` : `/v1/schedules/${dateOnly}`;
    return api.get(url);
  },

  /**
   * Get schedule by ID
   */
  async getScheduleById(id: string): Promise<ApiResponse<{ schedule: DailySchedule }>> {
    return api.get(`/v1/schedules/${id}`);
  },

  /**
   * Create new schedule
   */
  async createSchedule(data: CreateScheduleRequest): Promise<ApiResponse<{ schedule: DailySchedule }>> {
    return api.post('/v1/schedules', data);
  },

  /**
   * Update schedule
   */
  async updateSchedule(id: string, data: UpdateScheduleRequest): Promise<ApiResponse<{ schedule: DailySchedule }>> {
    return api.put(`/v1/schedules/${id}`, data);
  },

  /**
   * Delete schedule
   */
  async deleteSchedule(id: string): Promise<ApiResponse<void>> {
    return api.delete(`/v1/schedules/${id}`);
  },

  /**
   * Add item to schedule
   */
  async addScheduleItem(
    scheduleId: string,
    data: CreateScheduleItemRequest
  ): Promise<ApiResponse<{ item: ScheduleItem }>> {
    return api.post(`/v1/schedules/${scheduleId}/items`, data);
  },

  /**
   * Update schedule item
   */
  async updateScheduleItem(
    id: string,
    data: UpdateScheduleItemRequest
  ): Promise<ApiResponse<{ item: ScheduleItem }>> {
    return api.put(`/v1/schedules/items/${id}`, data);
  },

  /**
   * Delete schedule item
   */
  async deleteScheduleItem(id: string): Promise<ApiResponse<void>> {
    return api.delete(`/v1/schedules/items/${id}`);
  },

  /**
   * Create link between schedule items
   */
  async createScheduleLink(
    scheduleId: string,
    data: CreateScheduleLinkRequest
  ): Promise<ApiResponse<{ link: ScheduleLink }>> {
    return api.post(`/v1/schedules/${scheduleId}/links`, data);
  },

  /**
   * Delete schedule link
   */
  async deleteScheduleLink(id: string): Promise<ApiResponse<void>> {
    return api.delete(`/v1/schedules/links/${id}`);
  },

  /**
   * Get all templates
   */
  async getTemplates(): Promise<ApiResponse<{ templates: ScheduleTemplate[] }>> {
    return api.get('/v1/schedules/templates');
  },

  /**
   * Create template
   */
  async createTemplate(data: CreateTemplateRequest): Promise<ApiResponse<{ template: ScheduleTemplate }>> {
    return api.post('/v1/schedules/templates', data);
  },

  /**
   * Save schedule as template
   */
  async saveScheduleAsTemplate(
    scheduleId: string,
    templateName: string,
    description?: string
  ): Promise<ApiResponse<{ template: ScheduleTemplate }>> {
    return api.post(`/v1/schedules/${scheduleId}/save-as-template`, {
      template_name: templateName,
      description,
    });
  },

  /**
   * Apply template to schedule
   */
  async applyTemplate(scheduleId: string, templateId: string): Promise<ApiResponse<{ schedule: DailySchedule }>> {
    return api.post(`/v1/schedules/${scheduleId}/apply-template/${templateId}`);
  },
};


