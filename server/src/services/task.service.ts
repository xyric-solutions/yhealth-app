/**
 * @file Task Service
 * @description Handles user task management with scheduling and notifications
 * Sends push notifications and emails when task time arrives
 */

import { query, pool } from '../database/pg.js';
import { logger } from './logger.service.js';
import { notificationService } from './notification.service.js';
import { mailHelper } from '../helper/mail.js';
import { embeddingQueueService } from './embedding-queue.service.js';
import { JobPriorities } from '../config/queue.config.js';

// ============================================
// TYPES
// ============================================

export type TaskCategory = 'health' | 'fitness' | 'nutrition' | 'work' | 'personal' | 'general';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface UserTask {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  scheduledAt: string;
  reminderMinutesBefore: number;
  reminderSentAt: string | null;
  notifyPush: boolean;
  notifyEmail: boolean;
  notifySms: boolean;
  status: TaskStatus;
  completedAt: string | null;
  isRecurring: boolean;
  recurrencePattern: RecurrencePattern | null;
  recurrenceDays: number[] | null;
  recurrenceEndDate: string | null;
  color: string | null;
  icon: string | null;
  tags: string[] | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  category?: TaskCategory;
  priority?: TaskPriority;
  scheduledAt: string; // ISO date string
  reminderMinutesBefore?: number;
  notifyPush?: boolean;
  notifyEmail?: boolean;
  notifySms?: boolean;
  isRecurring?: boolean;
  recurrencePattern?: RecurrencePattern;
  recurrenceDays?: number[];
  recurrenceEndDate?: string;
  color?: string;
  icon?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  category?: TaskCategory;
  priority?: TaskPriority;
  scheduledAt?: string;
  reminderMinutesBefore?: number;
  notifyPush?: boolean;
  notifyEmail?: boolean;
  notifySms?: boolean;
  status?: TaskStatus;
  isRecurring?: boolean;
  recurrencePattern?: RecurrencePattern;
  recurrenceDays?: number[];
  recurrenceEndDate?: string;
  color?: string;
  icon?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

interface TaskRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  scheduled_at: Date;
  reminder_minutes_before: number;
  reminder_sent_at: Date | null;
  notify_push: boolean;
  notify_email: boolean;
  notify_sms: boolean;
  status: string;
  completed_at: Date | null;
  is_recurring: boolean;
  recurrence_pattern: string | null;
  recurrence_days: number[] | null;
  recurrence_end_date: Date | null;
  color: string | null;
  icon: string | null;
  tags: string[] | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function mapTaskRow(row: TaskRow): UserTask {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    category: row.category as TaskCategory,
    priority: row.priority as TaskPriority,
    scheduledAt: row.scheduled_at.toISOString(),
    reminderMinutesBefore: row.reminder_minutes_before,
    reminderSentAt: row.reminder_sent_at?.toISOString() || null,
    notifyPush: row.notify_push,
    notifyEmail: row.notify_email,
    notifySms: row.notify_sms,
    status: row.status as TaskStatus,
    completedAt: row.completed_at?.toISOString() || null,
    isRecurring: row.is_recurring,
    recurrencePattern: row.recurrence_pattern as RecurrencePattern | null,
    recurrenceDays: row.recurrence_days,
    recurrenceEndDate: row.recurrence_end_date ? (typeof row.recurrence_end_date === 'string' ? row.recurrence_end_date : row.recurrence_end_date.toISOString().split('T')[0]) : null,
    color: row.color,
    icon: row.icon,
    tags: row.tags,
    metadata: row.metadata || {},
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const PRIORITY_ICONS: Record<TaskPriority, string> = {
  low: '🔵',
  medium: '🟡',
  high: '🟠',
  urgent: '🔴',
};

const CATEGORY_ICONS: Record<TaskCategory, string> = {
  health: '❤️',
  fitness: '💪',
  nutrition: '🥗',
  work: '💼',
  personal: '👤',
  general: '📋',
};

// ============================================
// SERVICE CLASS
// ============================================

class TaskService {
  // ============================================
  // CRUD OPERATIONS
  // ============================================

  /**
   * Create a new task
   */
  async createTask(userId: string, input: CreateTaskInput): Promise<UserTask> {
    const result = await query<TaskRow>(
      `INSERT INTO user_tasks (
        user_id, title, description, category, priority,
        scheduled_at, reminder_minutes_before,
        notify_push, notify_email, notify_sms,
        is_recurring, recurrence_pattern, recurrence_days, recurrence_end_date,
        color, icon, tags, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        userId,
        input.title,
        input.description || null,
        input.category || 'general',
        input.priority || 'medium',
        input.scheduledAt,
        input.reminderMinutesBefore ?? 15,
        input.notifyPush ?? true,
        input.notifyEmail ?? true,
        input.notifySms ?? false,
        input.isRecurring ?? false,
        input.recurrencePattern || null,
        input.recurrenceDays || null,
        input.recurrenceEndDate || null,
        input.color || null,
        input.icon || CATEGORY_ICONS[input.category || 'general'],
        input.tags || null,
        JSON.stringify(input.metadata || {}),
      ]
    );

    const task = mapTaskRow(result.rows[0]);
    logger.info('[Tasks] Created task', { userId, taskId: task.id, title: task.title, scheduledAt: task.scheduledAt });

    // Enqueue embedding creation (async, non-blocking)
    await embeddingQueueService.enqueueEmbedding({
      userId: task.userId,
      sourceType: 'user_task',
      sourceId: task.id,
      operation: 'create',
      priority: JobPriorities.HIGH,
    });

    return task;
  }

  /**
   * Get all tasks for a user
   */
  async getTasks(
    userId: string,
    options: {
      status?: TaskStatus;
      category?: TaskCategory;
      fromDate?: string;
      toDate?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ tasks: UserTask[]; total: number }> {
    const conditions: string[] = ['user_id = $1'];
    const params: (string | number)[] = [userId];
    let paramIndex = 2;

    if (options.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(options.status);
    }
    if (options.category) {
      conditions.push(`category = $${paramIndex++}`);
      params.push(options.category);
    }
    if (options.fromDate) {
      conditions.push(`scheduled_at >= $${paramIndex++}`);
      params.push(options.fromDate);
    }
    if (options.toDate) {
      conditions.push(`scheduled_at <= $${paramIndex++}`);
      params.push(options.toDate);
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM user_tasks WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count, 10);

    // Get tasks
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    const result = await query<TaskRow>(
      `SELECT * FROM user_tasks
       WHERE ${whereClause}
       ORDER BY scheduled_at ASC
       LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    );

    return {
      tasks: result.rows.map(mapTaskRow),
      total,
    };
  }

  /**
   * Get a specific task
   */
  async getTask(userId: string, taskId: string): Promise<UserTask | null> {
    const result = await query<TaskRow>(
      `SELECT * FROM user_tasks WHERE id = $1 AND user_id = $2`,
      [taskId, userId]
    );

    if (result.rows.length === 0) return null;
    return mapTaskRow(result.rows[0]);
  }

  /**
   * Update a task
   */
  async updateTask(userId: string, taskId: string, input: UpdateTaskInput): Promise<UserTask | null> {
    const existing = await this.getTask(userId, taskId);
    if (!existing) return null;

    const updates: string[] = [];
    const values: (string | number | boolean | string[] | number[] | null)[] = [];
    let paramIndex = 1;

    if (input.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(input.title);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(input.description);
    }
    if (input.category !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      values.push(input.category);
    }
    if (input.priority !== undefined) {
      updates.push(`priority = $${paramIndex++}`);
      values.push(input.priority);
    }
    if (input.scheduledAt !== undefined) {
      updates.push(`scheduled_at = $${paramIndex++}`);
      values.push(input.scheduledAt);
      // Reset reminder sent if schedule changed
      updates.push(`reminder_sent_at = NULL`);
    }
    if (input.reminderMinutesBefore !== undefined) {
      updates.push(`reminder_minutes_before = $${paramIndex++}`);
      values.push(input.reminderMinutesBefore);
    }
    if (input.notifyPush !== undefined) {
      updates.push(`notify_push = $${paramIndex++}`);
      values.push(input.notifyPush);
    }
    if (input.notifyEmail !== undefined) {
      updates.push(`notify_email = $${paramIndex++}`);
      values.push(input.notifyEmail);
    }
    if (input.notifySms !== undefined) {
      updates.push(`notify_sms = $${paramIndex++}`);
      values.push(input.notifySms);
    }
    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(input.status);
      if (input.status === 'completed') {
        updates.push(`completed_at = CURRENT_TIMESTAMP`);
      }
    }
    if (input.isRecurring !== undefined) {
      updates.push(`is_recurring = $${paramIndex++}`);
      values.push(input.isRecurring);
    }
    if (input.recurrencePattern !== undefined) {
      updates.push(`recurrence_pattern = $${paramIndex++}`);
      values.push(input.recurrencePattern);
    }
    if (input.recurrenceDays !== undefined) {
      updates.push(`recurrence_days = $${paramIndex++}`);
      values.push(input.recurrenceDays);
    }
    if (input.recurrenceEndDate !== undefined) {
      updates.push(`recurrence_end_date = $${paramIndex++}`);
      values.push(input.recurrenceEndDate);
    }
    if (input.color !== undefined) {
      updates.push(`color = $${paramIndex++}`);
      values.push(input.color);
    }
    if (input.icon !== undefined) {
      updates.push(`icon = $${paramIndex++}`);
      values.push(input.icon);
    }
    if (input.tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      values.push(input.tags);
    }
    if (input.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(input.metadata));
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    if (updates.length === 1) return existing;

    values.push(taskId, userId);

    const result = await query<TaskRow>(
      `UPDATE user_tasks SET ${updates.join(', ')}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) return null;

    const updatedTask = mapTaskRow(result.rows[0]);
    logger.info('[Tasks] Updated task', { userId, taskId });

    // Enqueue embedding update (async, non-blocking)
    await embeddingQueueService.enqueueEmbedding({
      userId: updatedTask.userId,
      sourceType: 'user_task',
      sourceId: updatedTask.id,
      operation: 'update',
      priority: JobPriorities.HIGH,
    });

    return updatedTask;
  }

  /**
   * Delete a task
   */
  async deleteTask(userId: string, taskId: string): Promise<boolean> {
    // Enqueue embedding deletion BEFORE actual delete (preserve ID)
    await embeddingQueueService.enqueueEmbedding({
      userId,
      sourceType: 'user_task',
      sourceId: taskId,
      operation: 'delete',
      priority: JobPriorities.MEDIUM,
    });

    const result = await pool.query(
      `DELETE FROM user_tasks WHERE id = $1 AND user_id = $2`,
      [taskId, userId]
    );

    if (result.rowCount === 0) return false;

    logger.info('[Tasks] Deleted task', { userId, taskId });
    return true;
  }

  /**
   * Mark task as completed
   */
  async completeTask(userId: string, taskId: string): Promise<UserTask | null> {
    return this.updateTask(userId, taskId, { status: 'completed' });
  }

  // ============================================
  // REMINDER PROCESSING
  // ============================================

  /**
   * Get tasks that need reminders sent now
   */
  async getTasksNeedingReminders(): Promise<UserTask[]> {
    const result = await query<TaskRow>(
      `SELECT * FROM user_tasks
       WHERE status = 'pending'
       AND reminder_sent_at IS NULL
       AND scheduled_at - (reminder_minutes_before * INTERVAL '1 minute') <= CURRENT_TIMESTAMP
       AND scheduled_at > CURRENT_TIMESTAMP
       ORDER BY scheduled_at ASC`
    );

    return result.rows.map(mapTaskRow);
  }

  /**
   * Send reminder for a task
   */
  async sendTaskReminder(task: UserTask): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get user details for email
      const userResult = await client.query<{
        email: string;
        first_name: string;
        phone_number: string | null;
      }>(
        `SELECT email, first_name, phone_number FROM users WHERE id = $1`,
        [task.userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult.rows[0];
      const scheduledTime = new Date(task.scheduledAt).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });

      const priorityIcon = PRIORITY_ICONS[task.priority];
      const categoryIcon = task.icon || CATEGORY_ICONS[task.category];

      // Send push notification
      if (task.notifyPush) {
        try {
          await notificationService.create({
            userId: task.userId,
            type: 'reminder',
            title: `${categoryIcon} ${task.title}`,
            message: task.description || `Scheduled for ${scheduledTime}`,
            icon: categoryIcon,
            actionUrl: '/tasks',
            actionLabel: 'View Task',
            category: 'task',
            priority: task.priority === 'urgent' ? 'high' : 'normal',
            relatedEntityType: 'task',
            relatedEntityId: task.id,
            metadata: {
              taskId: task.id,
              category: task.category,
              priority: task.priority,
              scheduledAt: task.scheduledAt,
            },
          });

          // Log push notification
          await client.query(
            `INSERT INTO task_reminder_logs (task_id, user_id, channel, status)
             VALUES ($1, $2, 'push', 'sent')`,
            [task.id, task.userId]
          );

          logger.info('[Tasks] Push notification sent', { taskId: task.id, userId: task.userId });
        } catch (error) {
          logger.error('[Tasks] Push notification failed', {
            taskId: task.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });

          await client.query(
            `INSERT INTO task_reminder_logs (task_id, user_id, channel, status, error_message)
             VALUES ($1, $2, 'push', 'failed', $3)`,
            [task.id, task.userId, error instanceof Error ? error.message : 'Unknown error']
          );
        }
      }

      // Send email notification
      if (task.notifyEmail && user.email) {
        try {
          const emailSent = await mailHelper.send({
            email: user.email,
            subject: `${priorityIcon} Task Reminder: ${task.title} - Balencia`,
            template: 'taskReminder',
            data: {
              firstName: user.first_name,
              taskTitle: task.title,
              taskDescription: task.description || 'No description provided',
              scheduledTime,
              priority: task.priority,
              priorityIcon,
              category: task.category,
              categoryIcon,
              dashboardUrl: `${mailHelper.getAppUrl()}/tasks`,
              completeUrl: `${mailHelper.getAppUrl()}/tasks/${task.id}/complete`,
            },
          });

          if (emailSent) {
            await client.query(
              `INSERT INTO task_reminder_logs (task_id, user_id, channel, status)
               VALUES ($1, $2, 'email', 'sent')`,
              [task.id, task.userId]
            );

            logger.info('[Tasks] Email notification sent', { taskId: task.id, userId: task.userId, email: user.email });
          } else {
            throw new Error('Email send returned false');
          }
        } catch (error) {
          logger.error('[Tasks] Email notification failed', {
            taskId: task.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });

          await client.query(
            `INSERT INTO task_reminder_logs (task_id, user_id, channel, status, error_message)
             VALUES ($1, $2, 'email', 'failed', $3)`,
            [task.id, task.userId, error instanceof Error ? error.message : 'Unknown error']
          );
        }
      }

      // Mark reminder as sent
      await client.query(
        `UPDATE user_tasks SET reminder_sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [task.id]
      );

      await client.query('COMMIT');

      logger.info('[Tasks] Task reminder processed', { taskId: task.id, userId: task.userId });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Process all pending task reminders (called by scheduler job)
   */
  async processTaskReminders(): Promise<number> {
    const tasks = await this.getTasksNeedingReminders();
    let processed = 0;

    for (const task of tasks) {
      try {
        await this.sendTaskReminder(task);
        processed++;
      } catch (error) {
        logger.error('[Tasks] Failed to process task reminder', {
          taskId: task.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    if (processed > 0) {
      logger.info('[Tasks] Processed task reminders', { count: processed });
    }

    return processed;
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Get today's tasks for a user
   */
  async getTodayTasks(userId: string): Promise<UserTask[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await query<TaskRow>(
      `SELECT * FROM user_tasks
       WHERE user_id = $1
       AND scheduled_at >= $2
       AND scheduled_at < $3
       AND status != 'cancelled'
       ORDER BY scheduled_at ASC`,
      [userId, today.toISOString(), tomorrow.toISOString()]
    );

    return result.rows.map(mapTaskRow);
  }

  /**
   * Get upcoming tasks for a user
   */
  async getUpcomingTasks(userId: string, days: number = 7): Promise<UserTask[]> {
    const now = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const result = await query<TaskRow>(
      `SELECT * FROM user_tasks
       WHERE user_id = $1
       AND scheduled_at >= $2
       AND scheduled_at < $3
       AND status = 'pending'
       ORDER BY scheduled_at ASC`,
      [userId, now.toISOString(), endDate.toISOString()]
    );

    return result.rows.map(mapTaskRow);
  }

  /**
   * Get task statistics for a user
   */
  async getTaskStats(userId: string): Promise<{
    total: number;
    pending: number;
    completed: number;
    overdue: number;
    todayCount: number;
    completionRate: number;
  }> {
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await query<{
      status: string;
      count: string;
    }>(
      `SELECT status, COUNT(*) as count FROM user_tasks
       WHERE user_id = $1
       GROUP BY status`,
      [userId]
    );

    const statusCounts: Record<string, number> = {};
    result.rows.forEach((row) => {
      statusCounts[row.status] = parseInt(row.count, 10);
    });

    // Get overdue count
    const overdueResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM user_tasks
       WHERE user_id = $1 AND status = 'pending' AND scheduled_at < $2`,
      [userId, now.toISOString()]
    );
    const overdue = parseInt(overdueResult.rows[0].count, 10);

    // Get today's count
    const todayResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM user_tasks
       WHERE user_id = $1 AND scheduled_at >= $2 AND scheduled_at < $3 AND status != 'cancelled'`,
      [userId, today.toISOString(), tomorrow.toISOString()]
    );
    const todayCount = parseInt(todayResult.rows[0].count, 10);

    const pending = statusCounts['pending'] || 0;
    const completed = statusCounts['completed'] || 0;
    const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      pending,
      completed,
      overdue,
      todayCount,
      completionRate,
    };
  }
}

// Export singleton instance
export const taskService = new TaskService();

export default taskService;
