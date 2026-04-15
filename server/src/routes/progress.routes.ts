/**
 * @file Progress Routes
 * API endpoints for progress tracking (weight, measurements, photos)
 */

import { Router, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import authenticate from '../middlewares/auth.middleware.js';
import { progressService } from '../services/progress.service.js';
import type { AuthenticatedRequest } from '../types/index.js';
import multer from 'multer';

const router = Router();

// Configure multer for photo uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, 
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// All routes require authentication
router.use(authenticate);

// ============================================
// SUMMARY
// ============================================

/**
 * GET /api/progress/summary
 * Get comprehensive progress summary
 */
router.get(
  '/summary',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;

    const summary = await progressService.getProgressSummary(userId);

    res.json({
      success: true,
      data: { summary },
    });
  })
);

// ============================================
// WEIGHT TRACKING
// ============================================

/**
 * GET /api/progress/weight
 * Get weight history
 */
router.get(
  '/weight',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { startDate, endDate, limit } = req.query;

    const history = await progressService.getWeightHistory(
      userId,
      startDate as string,
      endDate as string,
      limit ? parseInt(limit as string) : 90
    );

    res.json({
      success: true,
      data: { history },
    });
  })
);

/**
 * GET /api/progress/weight/latest
 * Get latest weight entry
 */
router.get(
  '/weight/latest',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;

    const weight = await progressService.getLatestWeight(userId);

    res.json({
      success: true,
      data: { weight },
    });
  })
);

/**
 * POST /api/progress/weight
 * Log weight entry
 */
router.post(
  '/weight',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { weightKg, date, notes } = req.body;

    if (!weightKg || weightKg <= 0) {
      res.status(400).json({
        success: false,
        error: 'Weight in kg is required and must be positive',
      });
      return;
    }

    const record = await progressService.logWeight(userId, weightKg, date, notes);

    res.status(201).json({
      success: true,
      data: { record },
    });
  })
);

// ============================================
// MEASUREMENTS TRACKING
// ============================================

/**
 * GET /api/progress/measurements
 * Get measurement history
 */
router.get(
  '/measurements',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { limit } = req.query;

    const history = await progressService.getMeasurementHistory(
      userId,
      limit ? parseInt(limit as string) : 12
    );

    res.json({
      success: true,
      data: { history },
    });
  })
);

/**
 * GET /api/progress/measurements/latest
 * Get latest measurements
 */
router.get(
  '/measurements/latest',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;

    const measurements = await progressService.getLatestMeasurements(userId);

    res.json({
      success: true,
      data: { measurements },
    });
  })
);

/**
 * POST /api/progress/measurements
 * Log measurements
 */
router.post(
  '/measurements',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { measurements, date, notes } = req.body;

    if (!measurements || typeof measurements !== 'object') {
      res.status(400).json({
        success: false,
        error: 'Measurements object is required',
      });
      return;
    }

    const record = await progressService.logMeasurements(
      userId,
      measurements,
      date,
      notes
    );

    res.status(201).json({
      success: true,
      data: { record },
    });
  })
);

// ============================================
// PHOTO TRACKING
// ============================================

/**
 * GET /api/progress/photos
 * Get progress photos
 */
router.get(
  '/photos',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { limit } = req.query;

    const photos = await progressService.getProgressPhotos(
      userId,
      limit ? parseInt(limit as string) : 30
    );

    res.json({
      success: true,
      data: { photos },
    });
  })
);

/**
 * GET /api/progress/photos/compare
 * Get comparison photos (first vs latest)
 */
router.get(
  '/photos/compare',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;

    const comparison = await progressService.getComparisonPhotos(userId);

    res.json({
      success: true,
      data: { comparison },
    });
  })
);

/**
 * POST /api/progress/photos
 * Upload progress photo
 */
router.post(
  '/photos',
  upload.single('photo'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { photoType, date, notes } = req.body;

    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'Photo file is required',
      });
      return;
    }

    if (!photoType || !['front', 'side', 'back'].includes(photoType)) {
      res.status(400).json({
        success: false,
        error: 'Valid photoType (front, side, back) is required',
      });
      return;
    }

    const photo = await progressService.uploadProgressPhoto(
      userId,
      photoType,
      req.file.buffer,
      req.file.mimetype,
      date,
      notes
    );

    res.status(201).json({
      success: true,
      data: { photo },
    });
  })
);

/**
 * POST /api/progress/analyze-photos
 * Analyze before/after photos with AI
 */
router.post(
  '/analyze-photos',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const { beforePhotoUrl, afterPhotoUrl, photoType, beforeDate, afterDate } = req.body;

    if (!beforePhotoUrl || !afterPhotoUrl) {
      res.status(400).json({
        success: false,
        error: 'Both beforePhotoUrl and afterPhotoUrl are required',
      });
      return;
    }

    const analysis = await progressService.analyzeProgressPhotos(
      userId,
      beforePhotoUrl,
      afterPhotoUrl,
      photoType,
      beforeDate,
      afterDate
    );

    res.json({
      success: true,
      data: { analysis },
    });
  })
);

export default router;
