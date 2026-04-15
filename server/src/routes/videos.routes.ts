/**
 * @file Motivational Videos Routes
 * API endpoints for YouTube video recommendations
 */

import { Router, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import authenticate from '../middlewares/auth.middleware.js';
import { motivationalVideoService } from '../services/motivational-video.service.js';
import type { AuthenticatedRequest } from '../types/index.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/videos/recommended
 * Get recommended videos based on user's goal
 */
router.get(
  '/recommended',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { goal, limit } = req.query;

    // Default to overall_optimization if no goal specified
    const goalCategory = (goal as string) || 'overall_optimization';
    const videoLimit = Math.min(parseInt(limit as string) || 10, 50);

    const videos = await motivationalVideoService.getRecommendedVideos(
      userId,
      goalCategory,
      videoLimit
    );

    res.json({
      success: true,
      data: { videos },
    });
  })
);

/**
 * GET /api/videos/featured
 * Get featured videos across all categories
 */
router.get(
  '/featured',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { limit } = req.query;

    const videoLimit = Math.min(parseInt(limit as string) || 5, 20);
    const videos = await motivationalVideoService.getFeaturedVideos(userId, videoLimit);

    res.json({
      success: true,
      data: { videos },
    });
  })
);

/**
 * GET /api/videos/saved
 * Get user's saved videos
 */
router.get(
  '/saved',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const videos = await motivationalVideoService.getSavedVideos(userId);

    res.json({
      success: true,
      data: { videos },
    });
  })
);

/**
 * GET /api/videos/stats
 * Get user's video watching statistics
 */
router.get(
  '/stats',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const stats = await motivationalVideoService.getUserVideoStats(userId);

    res.json({
      success: true,
      data: { stats },
    });
  })
);

/**
 * GET /api/videos/search
 * Search videos by query
 */
router.get(
  '/search',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { q, limit } = req.query;

    if (!q || typeof q !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Search query is required',
      });
      return;
    }

    const videoLimit = Math.min(parseInt(limit as string) || 20, 50);
    const videos = await motivationalVideoService.searchVideos(q, videoLimit);

    res.json({
      success: true,
      data: { videos },
    });
  })
);

/**
 * POST /api/videos/:id/watch
 * Record that user watched a video
 */
router.post(
  '/:id/watch',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;

    const interaction = await motivationalVideoService.recordInteraction(userId, id, {
      watched: true,
    });

    res.json({
      success: true,
      data: { interaction },
    });
  })
);

/**
 * POST /api/videos/:id/like
 * Toggle like on a video
 */
router.post(
  '/:id/like',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { liked } = req.body;

    const interaction = await motivationalVideoService.recordInteraction(userId, id, {
      liked: liked !== false, // Default to true if not specified
    });

    res.json({
      success: true,
      data: { interaction },
    });
  })
);

/**
 * POST /api/videos/:id/save
 * Toggle save on a video
 */
router.post(
  '/:id/save',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { saved } = req.body;

    const interaction = await motivationalVideoService.recordInteraction(userId, id, {
      saved: saved !== false, // Default to true if not specified
    });

    res.json({
      success: true,
      data: { interaction },
    });
  })
);

// ============================================
// USER PRIVATE VIDEOS
// ============================================

/**
 * GET /api/videos/private
 * Get user's private videos
 */
router.get(
  '/private',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { goal } = req.query;

    const videos = await motivationalVideoService.getUserPrivateVideos(
      userId,
      goal as string | undefined
    );

    res.json({
      success: true,
      data: { videos },
    });
  })
);

/**
 * POST /api/videos/private
 * Add a new private video
 */
router.post(
  '/private',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { youtubeVideoId, title, channelName, goalCategory, contentType, tags, notes } = req.body;

    if (!youtubeVideoId || !title) {
      res.status(400).json({
        success: false,
        error: 'YouTube video ID and title are required',
      });
      return;
    }

    const video = await motivationalVideoService.addUserPrivateVideo(userId, {
      youtubeVideoId,
      title,
      channelName,
      goalCategory,
      contentType,
      tags,
      notes,
    });

    res.status(201).json({
      success: true,
      data: { video },
    });
  })
);

/**
 * PATCH /api/videos/private/:id
 * Update a private video
 */
router.patch(
  '/private/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;
    const { title, channelName, goalCategory, contentType, tags, notes, isFavorite, sortOrder } = req.body;

    const video = await motivationalVideoService.updateUserPrivateVideo(userId, id, {
      title,
      channelName,
      goalCategory,
      contentType,
      tags,
      notes,
      isFavorite,
      sortOrder,
    });

    if (!video) {
      res.status(404).json({
        success: false,
        error: 'Video not found or no changes provided',
      });
      return;
    }

    res.json({
      success: true,
      data: { video },
    });
  })
);

/**
 * DELETE /api/videos/private/:id
 * Delete a private video
 */
router.delete(
  '/private/:id',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;

    const deleted = await motivationalVideoService.deleteUserPrivateVideo(userId, id);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: 'Video not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Video deleted successfully',
    });
  })
);

/**
 * POST /api/videos/private/:id/favorite
 * Toggle favorite status on a private video
 */
router.post(
  '/private/:id/favorite',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { id } = req.params;

    const video = await motivationalVideoService.toggleUserVideoFavorite(userId, id);

    if (!video) {
      res.status(404).json({
        success: false,
        error: 'Video not found',
      });
      return;
    }

    res.json({
      success: true,
      data: { video },
    });
  })
);

export default router;
