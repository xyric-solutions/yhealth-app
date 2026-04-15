/**
 * @file Body Images Controller
 * @description Handles body image uploads, storage, and AI analysis during onboarding
 */

import type { Response } from 'express';
import { query } from '../database/pg.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../services/logger.service.js';
import type { AuthenticatedRequest } from '../types/index.js';
import type { FileRequest } from '../middlewares/upload.middleware.js';
import { r2Service } from '../services/r2.service.js';
import { aiCoachService } from '../services/ai-coach.service.js';

type AuthFileRequest = AuthenticatedRequest & FileRequest;

/**
 * Upload body image during onboarding
 * POST /api/onboarding/body-images/upload
 */
export const uploadBodyImage = asyncHandler(
  async (req: AuthFileRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { imageType, captureContext = 'onboarding' } = req.body;
    const file = req.file;

    if (!file) {
      throw ApiError.badRequest('No image file provided');
    }

    // Validate image type
    const validImageTypes = ['face', 'front', 'side', 'back'];
    if (!imageType || !validImageTypes.includes(imageType)) {
      throw ApiError.badRequest(
        `Invalid image type. Allowed: ${validImageTypes.join(', ')}`
      );
    }

    // Validate file type
    if (!file.mimetype.startsWith('image/')) {
      throw ApiError.badRequest('File must be an image');
    }

    // Upload to R2
    if (!r2Service.isR2Configured()) {
      throw ApiError.internal('File storage service not configured');
    }

    const uploadResult = await r2Service.upload(
      file.buffer,
      file.originalname,
      file.mimetype,
      {
        fileType: 'image',
        userId,
        customPath: `body-images/${imageType}`,
        isPublic: false,
      }
    );

    // Save to database
    const result = await query<{
      id: string;
      image_type: string;
      image_key: string;
      capture_context: string;
      analysis_status: string;
      created_at: Date;
    }>(
      `INSERT INTO user_body_images (
        user_id, image_type, image_key, capture_context, analysis_status
      ) VALUES ($1, $2, $3, $4, 'pending')
      RETURNING id, image_type, image_key, capture_context, analysis_status, created_at`,
      [userId, imageType, uploadResult.key, captureContext]
    );

    const imageRecord = result.rows[0];

    logger.info('Body image uploaded', {
      userId,
      imageId: imageRecord.id,
      imageType,
      key: uploadResult.key,
    });

    ApiResponse.created(res, {
      id: imageRecord.id,
      imageType: imageRecord.image_type,
      imageKey: imageRecord.image_key,
      imageUrl: uploadResult.url,
      captureContext: imageRecord.capture_context,
      analysisStatus: imageRecord.analysis_status,
      createdAt: imageRecord.created_at,
    }, 'Body image uploaded successfully');
  }
);

/**
 * Analyze body image with AI
 * POST /api/onboarding/body-images/:imageId/analyze
 */
export const analyzeBodyImage = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { imageId } = req.params;

    // Get image record
    const imageResult = await query<{
      id: string;
      user_id: string;
      image_type: string;
      image_key: string;
      analysis_status: string;
      analysis_result: object | null;
    }>(
      `SELECT id, user_id, image_type, image_key, analysis_status, analysis_result
       FROM user_body_images
       WHERE id = $1 AND user_id = $2`,
      [imageId, userId]
    );

    if (imageResult.rows.length === 0) {
      throw ApiError.notFound('Body image not found');
    }

    const imageRecord = imageResult.rows[0];

    // Check if already analyzed
    if (imageRecord.analysis_status === 'completed' && imageRecord.analysis_result) {
      ApiResponse.success(res, {
        imageId: imageRecord.id,
        imageType: imageRecord.image_type,
        analysis: imageRecord.analysis_result,
        status: 'completed',
      }, 'Image already analyzed');
      return;
    }

    // Update status to processing
    await query(
      `UPDATE user_body_images SET analysis_status = 'processing', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [imageId]
    );

    try {
      // Get signed URL for the image
      const imageUrl = await r2Service.getSignedUrl(imageRecord.image_key, 3600);

      // Get user's primary goal for context
      const goalResult = await query<{ category: string }>(
        `SELECT category FROM user_goals
         WHERE user_id = $1 AND status = 'active' AND is_primary = true
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      );

      const goalCategory = goalResult.rows[0]?.category || undefined;

      // Analyze with AI
      // Map database image_type to HealthImageType (all body images are 'body_photo')
      const analysis = await aiCoachService.analyzeHealthImage(
        imageUrl,
        'body_photo',
        { goal: goalCategory as any }
      );

      // Save analysis result
      await query(
        `UPDATE user_body_images
         SET analysis_status = 'completed',
             analysis_result = $1,
             analyzed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [JSON.stringify(analysis), imageId]
      );

      logger.info('Body image analyzed', {
        userId,
        imageId,
        imageType: imageRecord.image_type,
      });

      ApiResponse.success(res, {
        imageId: imageRecord.id,
        imageType: imageRecord.image_type,
        analysis,
        status: 'completed',
      }, 'Image analyzed successfully');
    } catch (error) {
      // Update status to failed
      await query(
        `UPDATE user_body_images SET analysis_status = 'failed', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [imageId]
      );

      logger.error('Body image analysis failed', {
        userId,
        imageId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw ApiError.internal('Failed to analyze image. Please try again.');
    }
  }
);

/**
 * Get user's body images
 * GET /api/onboarding/body-images
 */
export const getBodyImages = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { captureContext } = req.query;

    let queryText = `SELECT id, image_type, image_key, capture_context, analysis_status, 
                     analysis_result, analyzed_at, created_at
                     FROM user_body_images
                     WHERE user_id = $1`;
    const params: string[] = [userId];

    if (captureContext) {
      queryText += ' AND capture_context = $2';
      params.push(captureContext as string);
    }

    queryText += ' ORDER BY created_at DESC';

    const result = await query<{
      id: string;
      image_type: string;
      image_key: string;
      capture_context: string;
      analysis_status: string;
      analysis_result: object | null;
      analyzed_at: Date | null;
      created_at: Date;
    }>(queryText, params);

    // Get signed URLs for images
    const images = await Promise.all(
      result.rows.map(async (row) => {
        const imageUrl = await r2Service.getSignedUrl(row.image_key, 3600);
        return {
          id: row.id,
          imageType: row.image_type,
          imageKey: row.image_key,
          imageUrl,
          captureContext: row.capture_context,
          analysisStatus: row.analysis_status,
          analysis: row.analysis_result,
          analyzedAt: row.analyzed_at,
          createdAt: row.created_at,
        };
      })
    );

    ApiResponse.success(res, { images }, 'Body images retrieved successfully');
  }
);

/**
 * Delete body image
 * DELETE /api/onboarding/body-images/:imageId
 */
export const deleteBodyImage = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const { imageId } = req.params;

    // Get image record
    const imageResult = await query<{ image_key: string }>(
      `SELECT image_key FROM user_body_images WHERE id = $1 AND user_id = $2`,
      [imageId, userId]
    );

    if (imageResult.rows.length === 0) {
      throw ApiError.notFound('Body image not found');
    }

    const imageKey = imageResult.rows[0].image_key;

    // Delete from R2
    try {
      await r2Service.delete(imageKey);
    } catch (error) {
      logger.warn('Failed to delete image from R2', {
        userId,
        imageId,
        imageKey,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Continue with database deletion even if R2 deletion fails
    }

    // Delete from database
    await query(
      `DELETE FROM user_body_images WHERE id = $1 AND user_id = $2`,
      [imageId, userId]
    );

    logger.info('Body image deleted', { userId, imageId });

    ApiResponse.success(res, { deleted: true, imageId }, 'Body image deleted successfully');
  }
);

/**
 * Batch analyze all pending body images for a user
 * POST /api/onboarding/body-images/analyze-all
 */
export const analyzeAllBodyImages = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    // Get all pending images
    const imagesResult = await query<{ id: string; image_type: string; image_key: string }>(
      `SELECT id, image_type, image_key
       FROM user_body_images
       WHERE user_id = $1 AND analysis_status IN ('pending', 'failed')
       ORDER BY created_at ASC`,
      [userId]
    );

    if (imagesResult.rows.length === 0) {
      ApiResponse.success(res, {
        analyzed: 0,
        total: 0,
        message: 'No pending images to analyze',
      }, 'No images to analyze');
      return;
    }

    // Analyze each image (fire and forget - don't wait for all)
    const analysisPromises = imagesResult.rows.map(async (image) => {
      try {
        // Update status to processing
        await query(
          `UPDATE user_body_images SET analysis_status = 'processing', updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [image.id]
        );

        // Get signed URL
        const imageUrl = await r2Service.getSignedUrl(image.image_key, 3600);

        // Get user's primary goal for context
        const goalResult = await query<{ category: string }>(
          `SELECT category FROM user_goals
           WHERE user_id = $1 AND status = 'active' AND is_primary = true
           ORDER BY created_at DESC LIMIT 1`,
          [userId]
        );

        const goalCategory = goalResult.rows[0]?.category || undefined;

            // Analyze
            // Map database image_type to HealthImageType (all body images are 'body_photo')
            const analysis = await aiCoachService.analyzeHealthImage(
              imageUrl,
              'body_photo',
              { goal: goalCategory as any }
            );

        // Save result
        await query(
          `UPDATE user_body_images
           SET analysis_status = 'completed',
               analysis_result = $1,
               analyzed_at = CURRENT_TIMESTAMP,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [JSON.stringify(analysis), image.id]
        );

        return { imageId: image.id, status: 'completed' };
      } catch (error) {
        // Update status to failed
        await query(
          `UPDATE user_body_images SET analysis_status = 'failed', updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [image.id]
        );

        // Extract error message properly - handle ApiError and nested error structures
        let errorMessage = 'Unknown error';
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (error && typeof error === 'object') {
          // Handle nested error structures (e.g., from serialized ApiError)
          if ('message' in error && typeof error.message === 'string') {
            errorMessage = error.message;
          } else if ('error' in error && error.error && typeof error.error === 'object') {
            if ('message' in error.error && typeof error.error.message === 'string') {
              errorMessage = error.error.message;
            } else if ('error' in error.error && error.error.error && typeof error.error.error === 'object' && 'message' in error.error.error) {
              const nestedMessage = error.error.error.message;
              if (typeof nestedMessage === 'string') {
                errorMessage = nestedMessage;
              }
            }
          }
        } else if (typeof error === 'string') {
          errorMessage = error;
        }

        logger.error('Body image analysis failed in batch', {
          userId,
          imageId: image.id,
          error: errorMessage,
          errorType: error instanceof Error ? error.constructor.name : typeof error,
        });

        return { imageId: image.id, status: 'failed' };
      }
    });

    // Wait for all analyses to complete
    const results = await Promise.all(analysisPromises);

    const completed = results.filter(r => r.status === 'completed').length;
    const failed = results.filter(r => r.status === 'failed').length;

    logger.info('Batch body image analysis completed', {
      userId,
      total: imagesResult.rows.length,
      completed,
      failed,
    });

    ApiResponse.success(res, {
      analyzed: completed,
      failed,
      total: imagesResult.rows.length,
      results,
    }, `Analyzed ${completed} of ${imagesResult.rows.length} images`);
  }
);

