/**
 * @file Emotion Data Controller
 * @description Handles emotion data endpoints with privacy controls
 */

import { Response } from 'express';
import { emotionDetectionService } from '../services/emotion-detection.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { query } from '../database/pg.js';
import type { AuthenticatedRequest } from '../types/index.js';

class EmotionDataController {
  /**
   * @route   GET /api/emotions/logs
   * @desc    Get user's emotion logs (with privacy controls)
   * @access  Private
   */
  getLogs = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    // Check if emotion logging is enabled
    const preferencesResult = await query<{ emotion_logging_enabled: boolean }>(
      `SELECT emotion_logging_enabled FROM user_preferences WHERE user_id = $1`,
      [userId]
    );

    if (
      preferencesResult.rows.length > 0 &&
      preferencesResult.rows[0].emotion_logging_enabled === false
    ) {
      ApiResponse.success(res, { logs: [], enabled: false }, 'Emotion logging disabled');
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;

    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    let queryText = `SELECT id, call_id, conversation_id, timestamp, emotion_category, 
                     confidence_score, source, created_at
                     FROM emotion_logs WHERE user_id = $1`;
    const params: (string | number | boolean | null | Date | object)[] = [userId];
    let paramIndex = 2;

    if (startDate) {
      queryText += ` AND timestamp >= $${paramIndex}::TIMESTAMP`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      queryText += ` AND timestamp <= $${paramIndex}::TIMESTAMP`;
      params.push(endDate);
      paramIndex++;
    }

    queryText += ` ORDER BY timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM emotion_logs WHERE user_id = $1${
      startDate ? ` AND timestamp >= $2::TIMESTAMP` : ''
    }${endDate ? ` AND timestamp <= $${startDate ? 3 : 2}::TIMESTAMP` : ''}`;
    const countParams = [userId, ...(startDate ? [startDate] : []), ...(endDate ? [endDate] : [])];
    const countResult = await query<{ total: string }>(countQuery, countParams);

    const total = parseInt(countResult.rows[0].total || '0', 10);

    const logs = result.rows.map(row => ({
      id: row.id,
      callId: row.call_id,
      conversationId: row.conversation_id,
      timestamp: row.timestamp,
      category: row.emotion_category,
      confidence: row.confidence_score,
      source: row.source,
      createdAt: row.created_at,
    }));

    ApiResponse.success(
      res,
      {
        logs,
        enabled: true,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1,
        },
      },
      'Emotion logs retrieved successfully'
    );
  });

  /**
   * @route   GET /api/emotions/trends
   * @desc    Get emotion trends
   * @access  Private
   */
  getTrends = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const days = parseInt(req.query.days as string) || 30;

    const trends = await emotionDetectionService.analyzeEmotionalTrends(userId, days);
    ApiResponse.success(res, trends, 'Emotion trends retrieved successfully');
  });

  /**
   * @route   DELETE /api/emotions/logs/:id
   * @desc    Delete specific emotion log
   * @access  Private
   */
  deleteLog = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { id } = req.params;

    const result = await query(
      `DELETE FROM emotion_logs WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      throw ApiError.notFound('Emotion log not found');
    }

    ApiResponse.success(res, { deleted: true }, 'Emotion log deleted successfully');
  });

  /**
   * @route   DELETE /api/emotions/logs
   * @desc    Delete all emotion logs
   * @access  Private
   */
  deleteAllLogs = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const result = await query(
      `DELETE FROM emotion_logs WHERE user_id = $1 RETURNING id`,
      [userId]
    );

    const deleted = result.rows.length;

    ApiResponse.success(res, { deleted }, {
      message: 'All emotion logs deleted successfully',
    }, undefined, req);
  });

  /**
   * @route   GET /api/emotions/preferences
   * @desc    Get emotion logging preferences
   * @access  Private
   */
  getPreferences = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const result = await query<{
      emotion_logging_enabled: boolean;
      emotion_data_retention_days: number;
    }>(
      `SELECT emotion_logging_enabled, emotion_data_retention_days 
       FROM user_preferences 
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // Return defaults if preferences don't exist
      ApiResponse.success(
        res,
        {
          emotionLoggingEnabled: true,
          emotionDataRetentionDays: 730,
        },
        'Emotion preferences retrieved successfully (defaults)'
      );
      return;
    }

    const prefs = result.rows[0];
    ApiResponse.success(
      res,
      {
        emotionLoggingEnabled: prefs.emotion_logging_enabled ?? true,
        emotionDataRetentionDays: prefs.emotion_data_retention_days ?? 730,
      },
      'Emotion preferences retrieved successfully'
    );
  });

  /**
   * @route   PATCH /api/emotions/preferences
   * @desc    Update emotion logging preferences
   * @access  Private
   */
  updatePreferences = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      throw ApiError.unauthorized('Authentication required');
    }

    const { emotionLoggingEnabled, emotionDataRetentionDays } = req.body as {
      emotionLoggingEnabled?: boolean;
      emotionDataRetentionDays?: number;
    };

    // Check if preferences exist
    const existingResult = await query<{ id: string }>(
      `SELECT id FROM user_preferences WHERE user_id = $1`,
      [userId]
    );

    if (existingResult.rows.length === 0) {
      // Create preferences
      await query(
        `INSERT INTO user_preferences (
          user_id, emotion_logging_enabled, emotion_data_retention_days
        ) VALUES ($1, $2, $3)`,
        [
          userId,
          emotionLoggingEnabled ?? true,
          emotionDataRetentionDays ?? 730,
        ]
      );
    } else {
      // Update preferences
      const updates: string[] = [];
      const values: (string | number | boolean | null | Date | object)[] = [];
      let paramIndex = 1;

      if (emotionLoggingEnabled !== undefined) {
        updates.push(`emotion_logging_enabled = $${paramIndex}`);
        values.push(emotionLoggingEnabled);
        paramIndex++;
      }

      if (emotionDataRetentionDays !== undefined) {
        if (emotionDataRetentionDays < 30 || emotionDataRetentionDays > 2555) {
          throw ApiError.badRequest('Retention days must be between 30 and 2555 (7 years)');
        }
        updates.push(`emotion_data_retention_days = $${paramIndex}`);
        values.push(emotionDataRetentionDays);
        paramIndex++;
      }

      if (updates.length > 0) {
        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(userId);

        await query(
          `UPDATE user_preferences SET ${updates.join(', ')} WHERE user_id = $${paramIndex}`,
          values
        );
      }
    }

    ApiResponse.success(res, { updated: true }, 'Emotion preferences updated successfully');
  });
}

export const emotionDataController = new EmotionDataController();

