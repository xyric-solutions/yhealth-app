import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { query } from '../database/pg.js';
import { notificationEngine } from '../services/notification-engine.service.js';

// Types
interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  icon?: string;
  imageUrl?: string;
  actionUrl?: string;
  actionLabel?: string;
  category?: string;
  priority: string;
  isRead: boolean;
  readAt?: string;
  isArchived: boolean;
  archivedAt?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  metadata?: Record<string, unknown>;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  icon: string | null;
  image_url: string | null;
  action_url: string | null;
  action_label: string | null;
  category: string | null;
  priority: string;
  is_read: boolean;
  read_at: Date | null;
  is_archived: boolean;
  archived_at: Date | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  metadata: Record<string, unknown> | null;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// Helper to convert Date to ISO string with timezone (UTC)
function toISOStringWithTimezone(date: Date | null | undefined): string | undefined {
  if (!date) return undefined;
  // PostgreSQL TIMESTAMP without timezone is treated as UTC
  // Ensure we return a proper ISO 8601 string with 'Z' suffix
  return date instanceof Date ? date.toISOString() : undefined;
}

// Transform database row to API response
function transformNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    icon: row.icon || undefined,
    imageUrl: row.image_url || undefined,
    actionUrl: row.action_url || undefined,
    actionLabel: row.action_label || undefined,
    category: row.category || undefined,
    priority: row.priority,
    isRead: row.is_read,
    readAt: toISOStringWithTimezone(row.read_at),
    isArchived: row.is_archived,
    archivedAt: toISOStringWithTimezone(row.archived_at),
    relatedEntityType: row.related_entity_type || undefined,
    relatedEntityId: row.related_entity_id || undefined,
    metadata: row.metadata || undefined,
    expiresAt: toISOStringWithTimezone(row.expires_at),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

// Get all notifications with pagination and filters
const getNotifications = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const {
    page = '1',
    limit = '20',
    type,
    priority,
    isRead,
    isArchived = 'false',
    category,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = req.query;

  const pageNum = parseInt(page as string);
  const limitNum = Math.min(parseInt(limit as string), 100);
  const offset = (pageNum - 1) * limitNum;

  // Build WHERE clause
  const conditions: string[] = ['user_id = $1', 'is_archived = $2'];
  const values: (string | boolean)[] = [userId, isArchived === 'true'];

  let paramIndex = 3;

  if (type) {
    conditions.push(`type = $${paramIndex}`);
    values.push(type as string);
    paramIndex++;
  }

  if (priority) {
    conditions.push(`priority = $${paramIndex}`);
    values.push(priority as string);
    paramIndex++;
  }

  if (isRead !== undefined) {
    conditions.push(`is_read = $${paramIndex}`);
    values.push(isRead === 'true');
    paramIndex++;
  }

  if (category) {
    conditions.push(`category = $${paramIndex}`);
    values.push(category as string);
    paramIndex++;
  }

  // Filter out expired notifications
  conditions.push('(expires_at IS NULL OR expires_at > NOW())');

  const whereClause = conditions.join(' AND ');

  // Validate sort column
  const validSortColumns: Record<string, string> = {
    createdAt: 'created_at',
    priority: 'priority',
    type: 'type',
  };
  const sortColumn = validSortColumns[sortBy as string] || 'created_at';
  const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

  // Get total count
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM notifications WHERE ${whereClause}`,
    values
  );
  const total = parseInt(countResult.rows[0]?.count || '0');

  // Get notifications with priority ordering (urgent/high first if sorting by created_at)
  let orderByClause = `${sortColumn} ${order}`;
  if (sortColumn === 'created_at') {
    orderByClause = `CASE priority
      WHEN 'urgent' THEN 0
      WHEN 'high' THEN 1
      WHEN 'normal' THEN 2
      WHEN 'low' THEN 3
    END, ${sortColumn} ${order}`;
  }

  const result = await query<NotificationRow>(
    `SELECT * FROM notifications
     WHERE ${whereClause}
     ORDER BY ${orderByClause}
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    [...values, limitNum, offset]
  );

  const notifications = result.rows.map(transformNotification);

  ApiResponse.paginated(
    res,
    notifications,
    {
      page: pageNum,
      limit: limitNum,
      total,
    },
    'Notifications retrieved successfully'
  );
});

// Get unread notification count
const getUnreadCount = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const result = await query<{ count: string; urgent: string; high: string }>(
    `SELECT
      COUNT(*) as count,
      COUNT(*) FILTER (WHERE priority = 'urgent') as urgent,
      COUNT(*) FILTER (WHERE priority = 'high') as high
     FROM notifications
     WHERE user_id = $1
       AND is_read = false
       AND is_archived = false
       AND (expires_at IS NULL OR expires_at > NOW())`,
    [userId]
  );

  ApiResponse.success(
    res,
    {
      unreadCount: parseInt(result.rows[0]?.count || '0'),
      urgentCount: parseInt(result.rows[0]?.urgent || '0'),
      highCount: parseInt(result.rows[0]?.high || '0'),
    },
    'Unread count retrieved successfully'
  );
});

// Get notification by ID
const getNotificationById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { id } = req.params;

  const result = await query<NotificationRow>(
    `SELECT * FROM notifications WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );

  if (result.rows.length === 0) {
    throw ApiError.notFound('Notification not found');
  }

  ApiResponse.success(
    res,
    { notification: transformNotification(result.rows[0]) },
    'Notification retrieved successfully'
  );
});

// Mark notification as read
const markAsRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { id } = req.params;

  const result = await query<NotificationRow>(
    `UPDATE notifications
     SET is_read = true, read_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [id, userId]
  );

  if (result.rows.length === 0) {
    throw ApiError.notFound('Notification not found');
  }

  ApiResponse.success(
    res,
    { notification: transformNotification(result.rows[0]) },
    'Notification marked as read'
  );

  // Emit updated counts via socket (fire-and-forget)
  notificationEngine.emitCountUpdate(userId).catch(() => {});
});

// Mark notification as unread
const markAsUnread = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { id } = req.params;

  const result = await query<NotificationRow>(
    `UPDATE notifications
     SET is_read = false, read_at = NULL
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [id, userId]
  );

  if (result.rows.length === 0) {
    throw ApiError.notFound('Notification not found');
  }

  ApiResponse.success(
    res,
    { notification: transformNotification(result.rows[0]) },
    'Notification marked as unread'
  );

  notificationEngine.emitCountUpdate(userId).catch(() => {});
});

// Mark multiple notifications as read
const markMultipleAsRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { notificationIds } = req.body;

  if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
    throw ApiError.badRequest('notificationIds must be a non-empty array');
  }

  // Limit to 100 notifications at a time
  if (notificationIds.length > 100) {
    throw ApiError.badRequest('Cannot mark more than 100 notifications at once');
  }

  const result = await query<{ count: string }>(
    `UPDATE notifications
     SET is_read = true, read_at = NOW()
     WHERE id = ANY($1::uuid[]) AND user_id = $2 AND is_read = false
     RETURNING id`,
    [notificationIds, userId]
  );

  ApiResponse.success(
    res,
    { updatedCount: result.rows.length },
    `${result.rows.length} notifications marked as read`
  );

  notificationEngine.emitCountUpdate(userId).catch(() => {});
});

// Mark all notifications as read
const markAllAsRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { type, category } = req.body;

  let queryStr = `UPDATE notifications
     SET is_read = true, read_at = NOW()
     WHERE user_id = $1 AND is_read = false AND is_archived = false`;
  const values: string[] = [userId];

  if (type) {
    queryStr += ` AND type = $2`;
    values.push(type);
  }

  if (category) {
    queryStr += ` AND category = $${values.length + 1}`;
    values.push(category);
  }

  const result = await query<{ count: string }>(
    queryStr + ' RETURNING id',
    values
  );

  ApiResponse.success(
    res,
    { updatedCount: result.rows.length },
    `${result.rows.length} notifications marked as read`
  );

  notificationEngine.emitCountUpdate(userId).catch(() => {});
});

// Archive notification
const archiveNotification = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { id } = req.params;

  const result = await query<NotificationRow>(
    `UPDATE notifications
     SET is_archived = true, archived_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [id, userId]
  );

  if (result.rows.length === 0) {
    throw ApiError.notFound('Notification not found');
  }

  ApiResponse.success(
    res,
    { notification: transformNotification(result.rows[0]) },
    'Notification archived'
  );

  notificationEngine.emitCountUpdate(userId).catch(() => {});
});

// Unarchive notification
const unarchiveNotification = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { id } = req.params;

  const result = await query<NotificationRow>(
    `UPDATE notifications
     SET is_archived = false, archived_at = NULL
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [id, userId]
  );

  if (result.rows.length === 0) {
    throw ApiError.notFound('Notification not found');
  }

  ApiResponse.success(
    res,
    { notification: transformNotification(result.rows[0]) },
    'Notification unarchived'
  );

  notificationEngine.emitCountUpdate(userId).catch(() => {});
});

// Delete notification
const deleteNotification = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { id } = req.params;

  const result = await query(
    `DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, userId]
  );

  if (result.rows.length === 0) {
    throw ApiError.notFound('Notification not found');
  }

  ApiResponse.success(res, null, 'Notification deleted');

  notificationEngine.emitCountUpdate(userId).catch(() => {});
});

// Delete multiple notifications
const deleteMultipleNotifications = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const { notificationIds } = req.body;

  if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
    throw ApiError.badRequest('notificationIds must be a non-empty array');
  }

  // Limit to 100 notifications at a time
  if (notificationIds.length > 100) {
    throw ApiError.badRequest('Cannot delete more than 100 notifications at once');
  }

  const result = await query<{ id: string }>(
    `DELETE FROM notifications
     WHERE id = ANY($1::uuid[]) AND user_id = $2
     RETURNING id`,
    [notificationIds, userId]
  );

  ApiResponse.success(
    res,
    { deletedCount: result.rows.length },
    `${result.rows.length} notifications deleted`
  );

  notificationEngine.emitCountUpdate(userId).catch(() => {});
});

// Delete all read notifications
const deleteAllRead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const result = await query<{ id: string }>(
    `DELETE FROM notifications
     WHERE user_id = $1 AND is_read = true
     RETURNING id`,
    [userId]
  );

  ApiResponse.success(
    res,
    { deletedCount: result.rows.length },
    `${result.rows.length} read notifications deleted`
  );

  notificationEngine.emitCountUpdate(userId).catch(() => {});
});

// Create notification (internal use / admin)
const createNotification = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  const {
    targetUserId,
    type,
    title,
    message,
    icon,
    imageUrl,
    actionUrl,
    actionLabel,
    category,
    priority = 'normal',
    relatedEntityType,
    relatedEntityId,
    metadata,
    expiresAt,
  } = req.body;

  // Use targetUserId if provided (for admin), otherwise use current user
  const notificationUserId = targetUserId || userId;

  const result = await query<NotificationRow>(
    `INSERT INTO notifications (
      user_id, type, title, message, icon, image_url, action_url, action_label,
      category, priority, related_entity_type, related_entity_id, metadata, expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *`,
    [
      notificationUserId,
      type,
      title,
      message,
      icon || null,
      imageUrl || null,
      actionUrl || null,
      actionLabel || null,
      category || null,
      priority,
      relatedEntityType || null,
      relatedEntityId || null,
      metadata ? JSON.stringify(metadata) : null,
      expiresAt || null,
    ]
  );

  const notification = result.rows[0];

  ApiResponse.success(
    res,
    { notification: transformNotification(notification) },
    'Notification created successfully'
  );

  // Emit real-time notification + updated counts (fire-and-forget)
  if (notification) {
    const { socketService } = await import('../services/socket.service.js');
    socketService.emitToUser(notificationUserId, 'notification:new', {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      priority: notification.priority,
      icon: notification.icon,
      actionUrl: notification.action_url,
      createdAt: notification.created_at.toISOString(),
    });
    notificationEngine.emitCountUpdate(notificationUserId).catch(() => {});
  }
});

// Get notification statistics
const getNotificationStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  // Get basic counts
  const countResult = await query<{
    total: string;
    unread: string;
    read: string;
    archived: string;
  }>(
    `SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE is_read = false AND is_archived = false) as unread,
      COUNT(*) FILTER (WHERE is_read = true AND is_archived = false) as read,
      COUNT(*) FILTER (WHERE is_archived = true) as archived
     FROM notifications
     WHERE user_id = $1`,
    [userId]
  );

  // Get counts by type
  const typeResult = await query<{ type: string; count: string }>(
    `SELECT type::text as type, COUNT(*) as count
     FROM notifications
     WHERE user_id = $1 AND is_archived = false
     GROUP BY type`,
    [userId]
  );

  // Get counts by priority
  const priorityResult = await query<{ priority: string; count: string }>(
    `SELECT priority::text as priority, COUNT(*) as count
     FROM notifications
     WHERE user_id = $1 AND is_archived = false
     GROUP BY priority`,
    [userId]
  );

  const byType: Record<string, number> = {};
  typeResult.rows.forEach((row) => {
    byType[row.type] = parseInt(row.count);
  });

  const byPriority: Record<string, number> = {};
  priorityResult.rows.forEach((row) => {
    byPriority[row.priority] = parseInt(row.count);
  });

  ApiResponse.success(
    res,
    {
      total: parseInt(countResult.rows[0]?.total || '0'),
      unread: parseInt(countResult.rows[0]?.unread || '0'),
      read: parseInt(countResult.rows[0]?.read || '0'),
      archived: parseInt(countResult.rows[0]?.archived || '0'),
      byType,
      byPriority,
    },
    'Notification stats retrieved successfully'
  );
});

// Cleanup expired notifications (cron job / scheduled task)
const cleanupExpired = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();

  // This would typically be run as a cron job, but can be triggered manually
  const result = await query<{ id: string }>(
    `DELETE FROM notifications
     WHERE expires_at IS NOT NULL AND expires_at < NOW()
     RETURNING id`
  );

  ApiResponse.success(
    res,
    { deletedCount: result.rows.length },
    `${result.rows.length} expired notifications cleaned up`
  );
});

export default {
  getNotifications,
  getUnreadCount,
  getNotificationById,
  markAsRead,
  markAsUnread,
  markMultipleAsRead,
  markAllAsRead,
  archiveNotification,
  unarchiveNotification,
  deleteNotification,
  deleteMultipleNotifications,
  deleteAllRead,
  createNotification,
  getNotificationStats,
  cleanupExpired,
};
