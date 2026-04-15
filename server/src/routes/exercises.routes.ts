/**
 * @file Exercise Library Routes (Public)
 * REST API endpoints for the exercise catalog.
 * No authentication required — read-only public data.
 *
 * Endpoints:
 *   GET /api/v1/exercises           - List with pagination + filtering
 *   GET /api/v1/exercises/search    - Full-text search
 *   GET /api/v1/exercises/filters   - Available filter options
 *   GET /api/v1/exercises/stats     - Exercise counts by category/source
 *   GET /api/v1/exercises/:id       - Get by UUID
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  listExercisesQuerySchema,
  searchExercisesQuerySchema,
  exerciseIdParamsSchema,
} from '../validators/exercise.validator.js';
import {
  listExercises,
  listExercisesCursor,
  searchExercises,
  getExerciseById,
  getAvailableFilters,
  getExerciseStats,
  getETag,
} from '../services/exercise-library.service.js';

const router = Router();

// ============================================
// LIST EXERCISES (offset or cursor pagination)
// ============================================

/**
 * GET /api/v1/exercises
 * List exercises with filtering and pagination.
 * Supports both offset-based (?page=&limit=) and cursor-based (?cursor=&limit=) pagination.
 */
router.get(
  '/',
  validate(listExercisesQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const {
      page, limit, cursor,
      category, muscle, equipment, difficulty, bodyPart, source,
      sort, order,
    } = req.query as Record<string, string>;

    const filters = { category, muscle, equipment, difficulty, bodyPart, source, sort, order: order as 'asc' | 'desc' };

    // ETag / conditional request support
    const etag = await getETag(filters);
    res.setHeader('ETag', `"${etag}"`);
    res.setHeader('Cache-Control', 'public, max-age=300');

    if (req.headers['if-none-match'] === `"${etag}"`) {
      res.status(304).end();
      return;
    }

    // Cursor-based pagination if cursor is provided
    if (cursor) {
      const result = await listExercisesCursor(filters, {
        cursor,
        limit: parseInt(limit as string, 10) || 20,
      });

      ApiResponse.success(res, result.data, {
        message: 'Exercises retrieved successfully',
        meta: {
          page: 0,
          limit: result.meta.limit,
          total: result.meta.total || 0,
          totalPages: 0,
          hasNextPage: result.meta.hasMore,
          hasPrevPage: !!result.meta.prevCursor,
          nextCursor: result.meta.nextCursor,
          prevCursor: result.meta.prevCursor,
        } as any,
      });
      return;
    }

    // Offset-based pagination (default)
    const result = await listExercises(filters, {
      page: parseInt(page as string, 10) || 1,
      limit: parseInt(limit as string, 10) || 20,
    });

    ApiResponse.paginated(
      res,
      result.data,
      { page: result.meta.page, limit: result.meta.limit, total: result.meta.total },
      'Exercises retrieved successfully'
    );
  })
);

// ============================================
// SEARCH EXERCISES
// ============================================

/**
 * GET /api/v1/exercises/search
 * Full-text search using PostgreSQL tsvector
 */
router.get(
  '/search',
  validate(searchExercisesQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { q, page, limit, category, muscle, difficulty } = req.query as Record<string, string>;

    const filters = { category, muscle, difficulty };

    const result = await searchExercises(
      q,
      filters,
      {
        page: parseInt(page as string, 10) || 1,
        limit: parseInt(limit as string, 10) || 20,
      }
    );

    ApiResponse.paginated(
      res,
      result.data,
      { page: result.meta.page, limit: result.meta.limit, total: result.meta.total },
      'Search results retrieved successfully'
    );
  })
);

// ============================================
// FILTER OPTIONS
// ============================================

/**
 * GET /api/v1/exercises/filters
 * Get available filter options for dropdowns
 */
router.get(
  '/filters',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const filters = await getAvailableFilters();
    ApiResponse.success(res, filters, 'Filter options retrieved successfully');
  })
);

// ============================================
// STATISTICS
// ============================================

/**
 * GET /api/v1/exercises/stats
 * Get exercise counts by category, source, difficulty
 */
router.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const stats = await getExerciseStats();
    ApiResponse.success(res, stats, 'Exercise statistics retrieved successfully');
  })
);

// ============================================
// SINGLE EXERCISE
// ============================================

/**
 * GET /api/v1/exercises/:id
 * Get a single exercise by UUID with media assets
 */
router.get(
  '/:id',
  validate(exerciseIdParamsSchema, 'params'),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const exercise = await getExerciseById(id);

    if (!exercise) {
      throw ApiError.notFound('Exercise not found');
    }

    // ETag for individual exercise
    const etag = `"exercise-${exercise.id}-${exercise.updated_at}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=300');

    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }

    ApiResponse.success(res, exercise, 'Exercise retrieved successfully');
  })
);

export default router;
