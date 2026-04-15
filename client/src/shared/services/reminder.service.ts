/**
 * @file Reminder API Service
 * @description Centralized API calls for scheduled reminders (meals, workouts, water, etc.)
 */

import { api } from '@/lib/api-client';
import type { NotificationChannel } from '@/src/types';

// ============================================
// TYPES
// ============================================

export type ReminderType = 'meal' | 'workout' | 'water' | 'medication' | 'custom';
export type SourceType = 'diet_plan' | 'workout_plan' | 'manual';

export interface ScheduledReminder {
  id: string;
  userId: string;
  reminderType: ReminderType;
  sourceType: SourceType | null;
  sourceId: string | null;
  title: string;
  message: string | null;
  icon: string | null;
  reminderTime: string; // HH:MM:SS format
  daysOfWeek: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  timezone: string;
  notificationChannels: NotificationChannel[];
  advanceMinutes: number;
  repeatIfMissed: boolean;
  snoozeMinutes: number;
  isEnabled: boolean;
  lastTriggeredAt: string | null;
  nextTriggerAt: string | null;
  triggerCount: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReminderInput {
  reminderType: ReminderType;
  sourceType?: SourceType;
  sourceId?: string;
  title?: string;
  message?: string;
  icon?: string;
  reminderTime: string; // HH:MM or HH:MM:SS
  daysOfWeek?: number[];
  timezone?: string;
  notificationChannels?: NotificationChannel[];
  advanceMinutes?: number;
  repeatIfMissed?: boolean;
  snoozeMinutes?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateReminderInput {
  title?: string;
  message?: string;
  icon?: string;
  reminderTime?: string;
  daysOfWeek?: number[];
  timezone?: string;
  notificationChannels?: NotificationChannel[];
  advanceMinutes?: number;
  repeatIfMissed?: boolean;
  snoozeMinutes?: number;
  isEnabled?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ReminderSummary {
  totalReminders: number;
  enabledReminders: number;
  byType: Record<ReminderType, number>;
  nextReminder: ScheduledReminder | null;
  todayReminders: ScheduledReminder[];
}

// Response types
export interface RemindersResponse {
  reminders: ScheduledReminder[];
}

export interface ReminderResponse {
  reminder: ScheduledReminder;
}

export interface ReminderSummaryResponse {
  summary: ReminderSummary;
}

// Quick setup input types
export interface SetupWaterRemindersInput {
  startTime?: string; // HH:MM default "08:00"
  endTime?: string; // HH:MM default "21:00"
  intervalHours?: number; // default 2
  glassesPerDay?: number; // default 8
}

export interface SetupWorkoutReminderInput {
  workoutPlanId?: string;
  title?: string;
  message?: string;
  reminderTime: string; // HH:MM required
  daysOfWeek?: number[]; // default [1,2,3,4,5] (weekdays)
  advanceMinutes?: number; // default 10
}

export interface SetupMealReminderInput {
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  dietPlanId?: string;
  title?: string;
  message?: string;
  reminderTime: string; // HH:MM required
  daysOfWeek?: number[]; // default [0,1,2,3,4,5,6] (every day)
  advanceMinutes?: number; // default 5
}

// ============================================
// DAY HELPERS
// ============================================

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Format days of week array to display string
 */
export function formatDaysOfWeek(days: number[], short = false): string {
  const names = short ? DAY_SHORT : DAY_NAMES;
  const sorted = [...days].sort((a, b) => a - b);

  // Check for common patterns
  if (sorted.length === 7) return 'Every day';
  if (JSON.stringify(sorted) === JSON.stringify([1, 2, 3, 4, 5])) return 'Weekdays';
  if (JSON.stringify(sorted) === JSON.stringify([0, 6])) return 'Weekends';

  return sorted.map((d) => names[d]).join(', ');
}

/**
 * Format time string for display
 */
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Get time until next trigger
 */
export function getTimeUntilTrigger(nextTriggerAt: string | null): string {
  if (!nextTriggerAt) return 'Not scheduled';

  const now = new Date();
  const trigger = new Date(nextTriggerAt);
  const diffMs = trigger.getTime() - now.getTime();

  if (diffMs < 0) return 'Overdue';

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `in ${diffDays}d ${diffHours % 24}h`;
  if (diffHours > 0) return `in ${diffHours}h ${diffMins % 60}m`;
  return `in ${diffMins}m`;
}

// ============================================
// REMINDER SERVICE
// ============================================

/**
 * Reminder Service - handles all scheduled reminder API operations
 */
export const reminderService = {
  // ============================================
  // CRUD OPERATIONS
  // ============================================

  /**
   * Get all reminders for the user
   */
  getReminders: (type?: ReminderType) => {
    const params = type ? `?type=${type}` : '';
    return api.get<RemindersResponse>(`/reminders${params}`);
  },

  /**
   * Get reminder summary
   */
  getSummary: () => api.get<ReminderSummaryResponse>('/reminders/summary'),

  /**
   * Get today's reminders
   */
  getTodayReminders: () => api.get<RemindersResponse>('/reminders/today'),

  /**
   * Get a specific reminder
   */
  getReminder: (reminderId: string) =>
    api.get<ReminderResponse>(`/reminders/${reminderId}`),

  /**
   * Create a new reminder
   */
  createReminder: (data: CreateReminderInput) =>
    api.post<ReminderResponse>('/reminders', data),

  /**
   * Update a reminder
   */
  updateReminder: (reminderId: string, data: UpdateReminderInput) =>
    api.patch<ReminderResponse>(`/reminders/${reminderId}`, data),

  /**
   * Toggle reminder enabled state
   */
  toggleReminder: (reminderId: string) =>
    api.patch<ReminderResponse>(`/reminders/${reminderId}/toggle`, {}),

  /**
   * Snooze a reminder
   */
  snoozeReminder: (reminderId: string) =>
    api.post<ReminderResponse>(`/reminders/${reminderId}/snooze`, {}),

  /**
   * Delete a reminder
   */
  deleteReminder: (reminderId: string) =>
    api.delete(`/reminders/${reminderId}`),

  // ============================================
  // QUICK SETUP
  // ============================================

  /**
   * Create reminders from a diet plan's meal times
   */
  setupFromDietPlan: (dietPlanId: string) =>
    api.post<RemindersResponse>('/reminders/setup/from-diet-plan', { dietPlanId }),

  /**
   * Set up water intake reminders throughout the day
   */
  setupWaterReminders: (options?: SetupWaterRemindersInput) =>
    api.post<RemindersResponse>('/reminders/setup/water', options || {}),

  /**
   * Create a workout reminder (quick setup)
   */
  setupWorkoutReminder: (data: SetupWorkoutReminderInput) =>
    api.post<ReminderResponse>('/reminders/setup/workout', data),

  /**
   * Create a meal reminder (quick setup)
   */
  setupMealReminder: (data: SetupMealReminderInput) =>
    api.post<ReminderResponse>('/reminders/setup/meal', data),
};

export default reminderService;
