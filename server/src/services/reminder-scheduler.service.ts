/**
 * @file Reminder Scheduler Service
 * Handles scheduling and triggering of reminders for workouts, meals, water, etc.
 * Integrates with diet plans and workout schedules
 */

import { pool, query } from '../database/pg.js';
import { logger } from './logger.service.js';
import { notificationService } from './notification.service.js';

// ============================================
// TYPES
// ============================================

export type ReminderType = 'meal' | 'workout' | 'water' | 'medication' | 'custom';
export type SourceType = 'diet_plan' | 'workout_plan' | 'manual';
export type NotificationChannel = 'push' | 'email' | 'whatsapp' | 'sms';
export type DeliveryStatus = 'pending' | 'sent' | 'failed' | 'snoozed' | 'dismissed';
export type UserAction = 'acknowledged' | 'snoozed' | 'dismissed' | 'completed';

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
  title: string;
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

export interface ReminderLog {
  id: string;
  reminderId: string;
  userId: string;
  triggeredAt: string;
  scheduledFor: string;
  deliveryStatus: DeliveryStatus;
  channelsUsed: NotificationChannel[] | null;
  errorMessage: string | null;
  userAction: UserAction | null;
  actionAt: string | null;
  notificationId: string | null;
  createdAt: string;
}

interface ReminderRow {
  id: string;
  user_id: string;
  reminder_type: string;
  source_type: string | null;
  source_id: string | null;
  title: string;
  message: string | null;
  icon: string | null;
  reminder_time: string;
  days_of_week: number[];
  timezone: string;
  notification_channels: string[];
  advance_minutes: number;
  repeat_if_missed: boolean;
  snooze_minutes: number;
  is_enabled: boolean;
  last_triggered_at: Date | null;
  next_trigger_at: Date | null;
  trigger_count: number;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function normalizeTime(time: string): string {
  // Convert HH:MM to HH:MM:00
  if (/^\d{2}:\d{2}$/.test(time)) {
    return `${time}:00`;
  }
  return time;
}

function calculateNextTrigger(
  reminderTime: string,
  daysOfWeek: number[],
  _timezone: string,
  advanceMinutes: number = 0
): string {
  const [hours, minutes] = reminderTime.split(':').map(Number);
  const now = new Date();
  const today = now.getDay();

  // Adjust for advance notification
  const effectiveHours = hours;
  const effectiveMinutes = minutes - advanceMinutes;

  // Check if alarm should trigger today
  if (daysOfWeek.includes(today)) {
    const todayTrigger = new Date(now);
    todayTrigger.setHours(effectiveHours, effectiveMinutes, 0, 0);
    if (todayTrigger > now) {
      return todayTrigger.toISOString();
    }
  }

  // Find next day in the schedule
  for (let i = 1; i <= 7; i++) {
    const checkDay = (today + i) % 7;
    if (daysOfWeek.includes(checkDay)) {
      const nextTrigger = new Date(now);
      nextTrigger.setDate(nextTrigger.getDate() + i);
      nextTrigger.setHours(effectiveHours, effectiveMinutes, 0, 0);
      return nextTrigger.toISOString();
    }
  }

  // Fallback: tomorrow at reminder time
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(effectiveHours, effectiveMinutes, 0, 0);
  return tomorrow.toISOString();
}

function mapReminderRow(row: ReminderRow): ScheduledReminder {
  return {
    id: row.id,
    userId: row.user_id,
    reminderType: row.reminder_type as ReminderType,
    sourceType: row.source_type as SourceType | null,
    sourceId: row.source_id,
    title: row.title,
    message: row.message,
    icon: row.icon,
    reminderTime: row.reminder_time,
    daysOfWeek: row.days_of_week,
    timezone: row.timezone,
    notificationChannels: row.notification_channels as NotificationChannel[],
    advanceMinutes: row.advance_minutes,
    repeatIfMissed: row.repeat_if_missed,
    snoozeMinutes: row.snooze_minutes,
    isEnabled: row.is_enabled,
    lastTriggeredAt: row.last_triggered_at?.toISOString() || null,
    nextTriggerAt: row.next_trigger_at?.toISOString() || null,
    triggerCount: row.trigger_count,
    metadata: row.metadata || {},
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

// ============================================
// REMINDER ICONS AND MESSAGES
// ============================================

const REMINDER_DEFAULTS: Record<ReminderType, { icon: string; title: string; message: string }> = {
  meal: {
    icon: '🍽️',
    title: 'Meal Time',
    message: "Time to eat! Don't forget to log your meal.",
  },
  workout: {
    icon: '💪',
    title: 'Workout Time',
    message: "Time to get moving! Your workout is waiting.",
  },
  water: {
    icon: '💧',
    title: 'Stay Hydrated',
    message: 'Remember to drink water! Aim for 8 glasses today.',
  },
  medication: {
    icon: '💊',
    title: 'Medication Reminder',
    message: "Time to take your medication.",
  },
  custom: {
    icon: '⏰',
    title: 'Reminder',
    message: 'You have a scheduled reminder.',
  },
};

const MEAL_TYPE_ICONS: Record<string, { icon: string; title: string }> = {
  breakfast: { icon: '🌅', title: 'Breakfast Time' },
  lunch: { icon: '☀️', title: 'Lunch Time' },
  dinner: { icon: '🌙', title: 'Dinner Time' },
  snack: { icon: '🍎', title: 'Snack Time' },
};

// ============================================
// SERVICE CLASS
// ============================================

class ReminderSchedulerService {
  // ============================================
  // CRUD OPERATIONS
  // ============================================

  /**
   * Create a new scheduled reminder
   */
  async createReminder(userId: string, input: CreateReminderInput): Promise<ScheduledReminder> {
    const defaults = REMINDER_DEFAULTS[input.reminderType];
    const mealType = input.metadata?.mealType as string | undefined;
    const mealDefaults = mealType ? MEAL_TYPE_ICONS[mealType] : null;

    const reminderTime = normalizeTime(input.reminderTime);
    const daysOfWeek = input.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
    const advanceMinutes = input.advanceMinutes || 0;
    const timezone = input.timezone || 'UTC';

    const nextTriggerAt = calculateNextTrigger(reminderTime, daysOfWeek, timezone, advanceMinutes);

    const result = await query<ReminderRow>(
      `INSERT INTO scheduled_reminders (
        user_id, reminder_type, source_type, source_id,
        title, message, icon, reminder_time, days_of_week, timezone,
        notification_channels, advance_minutes, repeat_if_missed, snooze_minutes,
        next_trigger_at, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *`,
      [
        userId,
        input.reminderType,
        input.sourceType || null,
        input.sourceId || null,
        input.title || mealDefaults?.title || defaults.title,
        input.message || defaults.message,
        input.icon || mealDefaults?.icon || defaults.icon,
        reminderTime,
        daysOfWeek,
        timezone,
        input.notificationChannels || ['push'],
        advanceMinutes,
        input.repeatIfMissed ?? false,
        input.snoozeMinutes || 10,
        nextTriggerAt,
        JSON.stringify(input.metadata || {}),
      ]
    );

    logger.info('[Reminders] Created reminder', { userId, reminderType: input.reminderType, reminderTime });
    return mapReminderRow(result.rows[0]);
  }

  /**
   * Get all reminders for a user
   */
  async getReminders(userId: string, type?: ReminderType): Promise<ScheduledReminder[]> {
    let sqlQuery = `SELECT * FROM scheduled_reminders WHERE user_id = $1`;
    const params: (string | number | boolean | Date | object | null)[] = [userId];

    if (type) {
      sqlQuery += ` AND reminder_type = $2`;
      params.push(type);
    }

    sqlQuery += ` ORDER BY reminder_time ASC`;

    const result = await query<ReminderRow>(sqlQuery, params);
    return result.rows.map(mapReminderRow);
  }

  /**
   * Get a specific reminder
   */
  async getReminder(userId: string, reminderId: string): Promise<ScheduledReminder | null> {
    const result = await query<ReminderRow>(
      `SELECT * FROM scheduled_reminders WHERE id = $1 AND user_id = $2`,
      [reminderId, userId]
    );

    if (result.rows.length === 0) return null;
    return mapReminderRow(result.rows[0]);
  }

  /**
   * Update a reminder
   */
  async updateReminder(
    userId: string,
    reminderId: string,
    input: UpdateReminderInput
  ): Promise<ScheduledReminder | null> {
    const existing = await this.getReminder(userId, reminderId);
    if (!existing) return null;

    const updates: string[] = [];
    const values: (string | number | boolean | Date | object | null)[] = [];
    let paramIndex = 1;

    if (input.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(input.title);
    }
    if (input.message !== undefined) {
      updates.push(`message = $${paramIndex++}`);
      values.push(input.message);
    }
    if (input.icon !== undefined) {
      updates.push(`icon = $${paramIndex++}`);
      values.push(input.icon);
    }
    if (input.reminderTime !== undefined) {
      updates.push(`reminder_time = $${paramIndex++}`);
      values.push(normalizeTime(input.reminderTime));
    }
    if (input.daysOfWeek !== undefined) {
      updates.push(`days_of_week = $${paramIndex++}`);
      values.push(input.daysOfWeek);
    }
    if (input.timezone !== undefined) {
      updates.push(`timezone = $${paramIndex++}`);
      values.push(input.timezone);
    }
    if (input.notificationChannels !== undefined) {
      updates.push(`notification_channels = $${paramIndex++}`);
      values.push(input.notificationChannels);
    }
    if (input.advanceMinutes !== undefined) {
      updates.push(`advance_minutes = $${paramIndex++}`);
      values.push(input.advanceMinutes);
    }
    if (input.repeatIfMissed !== undefined) {
      updates.push(`repeat_if_missed = $${paramIndex++}`);
      values.push(input.repeatIfMissed);
    }
    if (input.snoozeMinutes !== undefined) {
      updates.push(`snooze_minutes = $${paramIndex++}`);
      values.push(input.snoozeMinutes);
    }
    if (input.isEnabled !== undefined) {
      updates.push(`is_enabled = $${paramIndex++}`);
      values.push(input.isEnabled);
    }
    if (input.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(input.metadata));
    }

    // Recalculate next trigger if time or days changed
    if (input.reminderTime !== undefined || input.daysOfWeek !== undefined || input.advanceMinutes !== undefined) {
      const newTime = input.reminderTime ? normalizeTime(input.reminderTime) : existing.reminderTime;
      const newDays = input.daysOfWeek || existing.daysOfWeek;
      const newAdvance = input.advanceMinutes ?? existing.advanceMinutes;
      const nextTriggerAt = calculateNextTrigger(newTime, newDays, existing.timezone, newAdvance);
      updates.push(`next_trigger_at = $${paramIndex++}`);
      values.push(nextTriggerAt);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    if (updates.length === 1) return existing;

    values.push(reminderId, userId);

    const result = await query<ReminderRow>(
      `UPDATE scheduled_reminders SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) return null;

    logger.info('[Reminders] Updated reminder', { userId, reminderId });
    return mapReminderRow(result.rows[0]);
  }

  /**
   * Toggle reminder enabled state
   */
  async toggleReminder(userId: string, reminderId: string): Promise<ScheduledReminder | null> {
    const result = await query<ReminderRow>(
      `UPDATE scheduled_reminders
       SET is_enabled = NOT is_enabled, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [reminderId, userId]
    );

    if (result.rows.length === 0) return null;

    const reminder = mapReminderRow(result.rows[0]);
    logger.info('[Reminders] Toggled reminder', { userId, reminderId, isEnabled: reminder.isEnabled });
    return reminder;
  }

  /**
   * Delete a reminder
   */
  async deleteReminder(userId: string, reminderId: string): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM scheduled_reminders WHERE id = $1 AND user_id = $2`,
      [reminderId, userId]
    );

    if (result.rowCount === 0) return false;

    logger.info('[Reminders] Deleted reminder', { userId, reminderId });
    return true;
  }

  // ============================================
  // DIET PLAN INTEGRATION
  // ============================================

  /**
   * Create reminders from a diet plan's meal times
   */
  async createRemindersFromDietPlan(userId: string, dietPlanId: string): Promise<ScheduledReminder[]> {
    // Get the diet plan
    const planResult = await query<{
      id: string;
      name: string;
      meal_times: Record<string, string>;
      meals_per_day: number;
    }>(
      `SELECT id, name, meal_times, meals_per_day FROM diet_plans WHERE id = $1 AND user_id = $2`,
      [dietPlanId, userId]
    );

    if (planResult.rows.length === 0) {
      throw new Error('Diet plan not found');
    }

    const plan = planResult.rows[0];
    const mealTimes = plan.meal_times || {};
    const createdReminders: ScheduledReminder[] = [];

    // Delete existing reminders for this diet plan
    await pool.query(
      `DELETE FROM scheduled_reminders WHERE user_id = $1 AND source_type = 'diet_plan' AND source_id = $2`,
      [userId, dietPlanId]
    );

    // Create reminder for each meal time
    for (const [mealType, time] of Object.entries(mealTimes)) {
      if (!time) continue;

      const reminder = await this.createReminder(userId, {
        reminderType: 'meal',
        sourceType: 'diet_plan',
        sourceId: dietPlanId,
        title: MEAL_TYPE_ICONS[mealType]?.title || `${mealType.charAt(0).toUpperCase() + mealType.slice(1)} Time`,
        message: `Time for ${mealType}! Follow your ${plan.name} plan.`,
        icon: MEAL_TYPE_ICONS[mealType]?.icon || '🍽️',
        reminderTime: time,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // Every day
        advanceMinutes: 5, // 5 minutes before
        metadata: {
          mealType,
          dietPlanId,
          dietPlanName: plan.name,
        },
      });

      createdReminders.push(reminder);
    }

    logger.info('[Reminders] Created reminders from diet plan', {
      userId,
      dietPlanId,
      count: createdReminders.length,
    });

    return createdReminders;
  }

  /**
   * Create water reminders throughout the day
   */
  async createWaterReminders(
    userId: string,
    options: {
      startTime?: string;
      endTime?: string;
      intervalHours?: number;
      glassesPerDay?: number;
    } = {}
  ): Promise<ScheduledReminder[]> {
    const {
      startTime = '08:00',
      endTime = '21:00',
      intervalHours = 2,
      glassesPerDay = 8,
    } = options;

    // Delete existing water reminders
    await pool.query(
      `DELETE FROM scheduled_reminders WHERE user_id = $1 AND reminder_type = 'water' AND source_type = 'manual'`,
      [userId]
    );

    const createdReminders: ScheduledReminder[] = [];
    const [startHour] = startTime.split(':').map(Number);
    const [endHour] = endTime.split(':').map(Number);

    let currentHour = startHour;
    let reminderCount = 0;

    while (currentHour <= endHour && reminderCount < glassesPerDay) {
      const time = `${currentHour.toString().padStart(2, '0')}:00`;

      const reminder = await this.createReminder(userId, {
        reminderType: 'water',
        sourceType: 'manual',
        title: '💧 Hydration Check',
        message: `Time for a glass of water! ${reminderCount + 1} of ${glassesPerDay} today.`,
        icon: '💧',
        reminderTime: time,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        metadata: {
          glassNumber: reminderCount + 1,
          totalGlasses: glassesPerDay,
        },
      });

      createdReminders.push(reminder);
      currentHour += intervalHours;
      reminderCount++;
    }

    logger.info('[Reminders] Created water reminders', { userId, count: createdReminders.length });
    return createdReminders;
  }

  // ============================================
  // SCHEDULER OPERATIONS
  // ============================================

  /**
   * Get reminders that should trigger now (for background job)
   */
  async getRemindersToTrigger(): Promise<ScheduledReminder[]> {
    const result = await query<ReminderRow>(
      `SELECT * FROM scheduled_reminders
       WHERE is_enabled = true
       AND next_trigger_at <= CURRENT_TIMESTAMP
       ORDER BY next_trigger_at ASC`
    );

    return result.rows.map(mapReminderRow);
  }

  /**
   * Trigger a reminder and create notification
   */
  async triggerReminder(reminder: ScheduledReminder): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Create the notification
      const notification = await notificationService.create({
        userId: reminder.userId,
        type: 'reminder',
        title: reminder.title,
        message: reminder.message || '',
        icon: reminder.icon || undefined,
        actionUrl: this.getActionUrl(reminder),
        actionLabel: this.getActionLabel(reminder),
        category: reminder.reminderType,
        priority: 'normal',
        relatedEntityType: reminder.sourceType || undefined,
        relatedEntityId: reminder.sourceId || undefined,
        metadata: reminder.metadata,
      });

      // Calculate next trigger time
      const nextTriggerAt = calculateNextTrigger(
        reminder.reminderTime,
        reminder.daysOfWeek,
        reminder.timezone,
        reminder.advanceMinutes
      );

      // Update reminder with new next trigger
      await client.query(
        `UPDATE scheduled_reminders
         SET last_triggered_at = CURRENT_TIMESTAMP,
             next_trigger_at = $1,
             trigger_count = trigger_count + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [nextTriggerAt, reminder.id]
      );

      // Log the trigger
      await client.query(
        `INSERT INTO reminder_logs (
          reminder_id, user_id, scheduled_for, delivery_status, channels_used, notification_id
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          reminder.id,
          reminder.userId,
          reminder.nextTriggerAt,
          'sent',
          reminder.notificationChannels,
          notification?.id || null,
        ]
      );

      await client.query('COMMIT');

      logger.info('[Reminders] Triggered reminder', {
        reminderId: reminder.id,
        userId: reminder.userId,
        type: reminder.reminderType,
        nextTriggerAt,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Process all pending reminders (called by scheduler job)
   */
  async processReminders(): Promise<number> {
    const reminders = await this.getRemindersToTrigger();
    let processed = 0;

    for (const reminder of reminders) {
      try {
        await this.triggerReminder(reminder);
        processed++;
      } catch (error) {
        logger.error('[Reminders] Failed to trigger reminder', {
          reminderId: reminder.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        // Log the failure
        await query(
          `INSERT INTO reminder_logs (
            reminder_id, user_id, scheduled_for, delivery_status, error_message
          ) VALUES ($1, $2, $3, $4, $5)`,
          [
            reminder.id,
            reminder.userId,
            reminder.nextTriggerAt,
            'failed',
            error instanceof Error ? error.message : 'Unknown error',
          ]
        );
      }
    }

    if (processed > 0) {
      logger.info('[Reminders] Processed reminders', { count: processed });
    }

    return processed;
  }

  /**
   * Snooze a reminder
   */
  async snoozeReminder(userId: string, reminderId: string): Promise<ScheduledReminder | null> {
    const reminder = await this.getReminder(userId, reminderId);
    if (!reminder) return null;

    const snoozedUntil = new Date();
    snoozedUntil.setMinutes(snoozedUntil.getMinutes() + reminder.snoozeMinutes);

    const result = await query<ReminderRow>(
      `UPDATE scheduled_reminders
       SET next_trigger_at = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [snoozedUntil.toISOString(), reminderId, userId]
    );

    if (result.rows.length === 0) return null;

    logger.info('[Reminders] Snoozed reminder', { userId, reminderId, snoozedUntil });
    return mapReminderRow(result.rows[0]);
  }

  /**
   * Get today's reminders for a user
   */
  async getTodayReminders(userId: string): Promise<ScheduledReminder[]> {
    const today = new Date().getDay();

    const result = await query<ReminderRow>(
      `SELECT * FROM scheduled_reminders
       WHERE user_id = $1
       AND is_enabled = true
       AND $2 = ANY(days_of_week)
       ORDER BY reminder_time ASC`,
      [userId, today]
    );

    return result.rows.map(mapReminderRow);
  }

  /**
   * Get reminder summary for a user
   */
  async getReminderSummary(userId: string): Promise<{
    totalReminders: number;
    enabledReminders: number;
    byType: Record<ReminderType, number>;
    nextReminder: ScheduledReminder | null;
    todayReminders: ScheduledReminder[];
  }> {
    const [allReminders, todayReminders] = await Promise.all([
      this.getReminders(userId),
      this.getTodayReminders(userId),
    ]);

    const enabledReminders = allReminders.filter((r) => r.isEnabled);
    const byType: Record<ReminderType, number> = {
      meal: 0,
      workout: 0,
      water: 0,
      medication: 0,
      custom: 0,
    };

    for (const reminder of allReminders) {
      byType[reminder.reminderType]++;
    }

    // Find next upcoming reminder
    const now = new Date();
    let nextReminder: ScheduledReminder | null = null;

    for (const reminder of enabledReminders) {
      if (reminder.nextTriggerAt) {
        const triggerTime = new Date(reminder.nextTriggerAt);
        if (triggerTime > now) {
          if (!nextReminder || triggerTime < new Date(nextReminder.nextTriggerAt!)) {
            nextReminder = reminder;
          }
        }
      }
    }

    return {
      totalReminders: allReminders.length,
      enabledReminders: enabledReminders.length,
      byType,
      nextReminder,
      todayReminders,
    };
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private getActionUrl(reminder: ScheduledReminder): string {
    switch (reminder.reminderType) {
      case 'meal':
        return '/dashboard?tab=nutrition';
      case 'workout':
        return '/dashboard?tab=workouts';
      case 'water':
        return '/dashboard?tab=nutrition';
      case 'medication':
        return '/dashboard?tab=health';
      default:
        return '/dashboard';
    }
  }

  private getActionLabel(reminder: ScheduledReminder): string {
    switch (reminder.reminderType) {
      case 'meal':
        return 'Log Meal';
      case 'workout':
        return 'Start Workout';
      case 'water':
        return 'Log Water';
      case 'medication':
        return 'Mark Done';
      default:
        return 'View';
    }
  }
}

// Export singleton instance
export const reminderSchedulerService = new ReminderSchedulerService();

export default reminderSchedulerService;
