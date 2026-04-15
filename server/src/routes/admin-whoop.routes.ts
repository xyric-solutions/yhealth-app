/**
 * @file Admin WHOOP Routes
 * @description Admin endpoints for manual WHOOP sync, backfill, and monitoring.
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../services/logger.service.js';
import { fetchHistoricalData } from '../services/whoop-data.service.js';
import { query } from '../database/pg.js';
import type { Request, Response } from 'express';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin'));

/**
 * @route   POST /api/admin/whoop/sync/:userId
 * @desc    Trigger a 1-day sync for a specific user
 * @access  Admin
 */
router.post(
  '/sync/:userId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;

    // Verify user has active WHOOP integration
    const integration = await query<{ id: string; status: string }>(
      `SELECT id, status FROM user_integrations
       WHERE user_id = $1 AND provider = 'whoop' LIMIT 1`,
      [userId]
    );

    if (integration.rows.length === 0) {
      throw ApiError.notFound('No WHOOP integration found for this user');
    }

    if (integration.rows[0].status !== 'active') {
      throw ApiError.badRequest(`WHOOP integration is ${integration.rows[0].status}, not active`);
    }

    logger.info('[AdminWhoop] Manual sync triggered', { userId, adminId: (req as any).user?.id });

    const counts = await fetchHistoricalData(userId, 1);

    // Write sync_log
    await query(
      `INSERT INTO sync_logs (
        user_id, integration_id, provider, sync_type,
        started_at, completed_at, duration_ms, status,
        records_processed, records_created, records_updated, records_skipped
      ) VALUES ($1, $2, 'whoop', 'admin_manual', NOW(), NOW(), 0, 'success', $3, $4, $5, $6)`,
      [
        userId,
        integration.rows[0].id,
        counts.recovery + counts.sleep + counts.workouts,
        counts.created,
        counts.updated,
        counts.skipped,
      ]
    );

    ApiResponse.success(res, { userId, counts }, 'Sync completed successfully');
  })
);

/**
 * @route   POST /api/admin/whoop/backfill/:userId
 * @desc    Trigger a 90-day backfill for a specific user
 * @access  Admin
 */
router.post(
  '/backfill/:userId',
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const days = parseInt(req.query.days as string, 10) || 90;

    const integration = await query<{ id: string; status: string }>(
      `SELECT id, status FROM user_integrations
       WHERE user_id = $1 AND provider = 'whoop' LIMIT 1`,
      [userId]
    );

    if (integration.rows.length === 0) {
      throw ApiError.notFound('No WHOOP integration found for this user');
    }

    if (integration.rows[0].status !== 'active') {
      throw ApiError.badRequest(`WHOOP integration is ${integration.rows[0].status}, not active`);
    }

    logger.info('[AdminWhoop] Manual backfill triggered', { userId, days, adminId: (req as any).user?.id });

    const counts = await fetchHistoricalData(userId, days);

    // Mark initial sync complete
    await query(
      `UPDATE user_integrations SET initial_sync_complete = true, updated_at = NOW()
       WHERE user_id = $1 AND provider = 'whoop'`,
      [userId]
    );

    // Write sync_log
    await query(
      `INSERT INTO sync_logs (
        user_id, integration_id, provider, sync_type,
        started_at, completed_at, duration_ms, status,
        records_processed, records_created, records_updated, records_skipped
      ) VALUES ($1, $2, 'whoop', 'admin_backfill', NOW(), NOW(), 0, 'success', $3, $4, $5, $6)`,
      [
        userId,
        integration.rows[0].id,
        counts.recovery + counts.sleep + counts.workouts,
        counts.created,
        counts.updated,
        counts.skipped,
      ]
    );

    ApiResponse.success(res, { userId, days, counts }, 'Backfill completed successfully');
  })
);

/**
 * @route   POST /api/admin/whoop/sync-all
 * @desc    Trigger sync for all users with active WHOOP integration
 * @access  Admin
 */
router.post(
  '/sync-all',
  asyncHandler(async (req: Request, res: Response) => {
    const users = await query<{ id: string }>(
      `SELECT u.id FROM users u
       JOIN user_integrations ui ON ui.user_id = u.id
       WHERE ui.provider = 'whoop' AND ui.status = 'active' AND u.is_active = true`
    );

    logger.info('[AdminWhoop] Bulk sync triggered', {
      userCount: users.rows.length,
      adminId: (req as any).user?.id,
    });

    const results: Array<{ userId: string; success: boolean; error?: string }> = [];

    for (const user of users.rows) {
      try {
        await fetchHistoricalData(user.id, 1);
        results.push({ userId: user.id, success: true });
      } catch (error) {
        results.push({
          userId: user.id,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    ApiResponse.success(res, {
      total: users.rows.length,
      synced: successCount,
      errors: errorCount,
      details: results,
    }, 'Bulk sync completed');
  })
);

/**
 * @route   GET /api/admin/whoop/sync-status
 * @desc    Get recent sync logs for monitoring
 * @access  Admin
 */
router.get(
  '/sync-status',
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const userId = req.query.userId as string;

    let sql = `SELECT sl.*, u.email as user_email
               FROM sync_logs sl
               JOIN users u ON u.id = sl.user_id
               WHERE sl.provider = 'whoop'`;
    const params: (string | number | boolean | object | Date | null)[] = [];

    if (userId) {
      params.push(userId);
      sql += ` AND sl.user_id = $${params.length}`;
    }

    params.push(limit);
    sql += ` ORDER BY sl.created_at DESC LIMIT $${params.length}`;

    const logs = await query(sql, params);

    // Also get aggregate stats
    const stats = await query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'success') as successful_syncs,
         COUNT(*) FILTER (WHERE status = 'error') as failed_syncs,
         AVG(duration_ms) FILTER (WHERE status = 'success') as avg_duration_ms,
         SUM(records_created) as total_created,
         SUM(records_updated) as total_updated,
         MAX(completed_at) as last_sync_at
       FROM sync_logs
       WHERE provider = 'whoop' AND created_at > NOW() - INTERVAL '24 hours'`
    );

    ApiResponse.success(res, {
      logs: logs.rows,
      stats24h: stats.rows[0],
    }, 'Sync status retrieved');
  })
);

/**
 * @route   GET /api/admin/whoop/integrations
 * @desc    List all WHOOP integrations with sync status
 * @access  Admin
 */
router.get(
  '/integrations',
  asyncHandler(async (_req: Request, res: Response) => {
    const integrations = await query(
      `SELECT ui.id, ui.user_id, u.email, u.first_name, u.last_name,
              ui.status, ui.last_sync_at, ui.last_sync_status, ui.last_sync_error,
              ui.sync_retry_count, ui.initial_sync_complete, ui.connected_at
       FROM user_integrations ui
       JOIN users u ON u.id = ui.user_id
       WHERE ui.provider = 'whoop'
       ORDER BY ui.connected_at DESC`
    );

    ApiResponse.success(res, { integrations: integrations.rows }, 'WHOOP integrations listed');
  })
);

export default router;
