/**
 * Admin Exercise Controller
 * Handles HTTP requests for admin exercise management
 */

import type { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import type { AuthenticatedRequest } from '../types/index.js';
import {
  adminListExercises,
  adminGetExerciseById,
  adminCreateExercise,
  adminUpdateExercise,
  adminSoftDeleteExercise,
  adminBulkSoftDelete,
  adminBulkToggleActive,
  adminToggleActive,
  adminGetExerciseStats,
} from '../services/exercise-library.service.js';
import {
  ingestFromExerciseDB,
  ingestFromMuscleWiki,
} from '../services/exercise-ingestion.service.js';
import {
  adminListExercisesQuerySchema,
  createExerciseSchema,
  updateExerciseSchema,
  bulkDeleteExercisesSchema,
  bulkToggleActiveSchema,
  syncExercisesSchema,
} from '../validators/admin-exercise.validator.js';

/**
 * List exercises (admin — includes inactive)
 * GET /api/admin/exercises
 */
export const getAdminExercises = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const filters = adminListExercisesQuerySchema.parse(req.query);
    const result = await adminListExercises(filters);

    ApiResponse.paginated(
      res,
      result.data,
      { page: result.meta.page, limit: result.meta.limit, total: result.meta.total },
      'Exercises retrieved successfully'
    );
  }
);

/**
 * Get exercise stats (admin — includes active/inactive counts)
 * GET /api/admin/exercises/stats
 */
export const getAdminExerciseStats = asyncHandler(
  async (_req: AuthenticatedRequest, res: Response) => {
    const stats = await adminGetExerciseStats();
    ApiResponse.success(res, stats, 'Exercise stats retrieved successfully');
  }
);

/**
 * Get single exercise by ID (admin)
 * GET /api/admin/exercises/:id
 */
export const getAdminExerciseById = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const exercise = await adminGetExerciseById(id);

    if (!exercise) {
      throw ApiError.notFound('Exercise not found');
    }

    ApiResponse.success(res, exercise, 'Exercise retrieved successfully');
  }
);

/**
 * Create a new exercise
 * POST /api/admin/exercises
 */
export const createExercise = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const data = createExerciseSchema.parse(req.body);
    const exercise = await adminCreateExercise(data);
    ApiResponse.created(res, exercise, 'Exercise created successfully');
  }
);

/**
 * Update an exercise
 * PUT /api/admin/exercises/:id
 * PATCH /api/admin/exercises/:id
 */
export const updateExercise = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const data = updateExerciseSchema.parse(req.body);
    const exercise = await adminUpdateExercise(id, data);

    if (!exercise) {
      throw ApiError.notFound('Exercise not found');
    }

    ApiResponse.success(res, exercise, 'Exercise updated successfully');
  }
);

/**
 * Delete an exercise (soft delete)
 * DELETE /api/admin/exercises/:id
 */
export const deleteExercise = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const deleted = await adminSoftDeleteExercise(id);

    if (!deleted) {
      throw ApiError.notFound('Exercise not found');
    }

    ApiResponse.success(res, null, 'Exercise deleted successfully');
  }
);

/**
 * Bulk delete exercises (soft delete)
 * POST /api/admin/exercises/bulk-delete
 */
export const bulkDeleteExercises = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { ids } = bulkDeleteExercisesSchema.parse(req.body);
    const deletedCount = await adminBulkSoftDelete(ids);
    ApiResponse.success(res, { deletedCount }, `${deletedCount} exercises deleted`);
  }
);

/**
 * Bulk toggle active status
 * POST /api/admin/exercises/bulk-toggle-active
 */
export const bulkToggleActiveExercises = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { ids, is_active } = bulkToggleActiveSchema.parse(req.body);
    const updatedCount = await adminBulkToggleActive(ids, is_active);
    ApiResponse.success(res, { updatedCount }, `${updatedCount} exercises ${is_active ? 'activated' : 'deactivated'}`);
  }
);

/**
 * Toggle single exercise active status
 * POST /api/admin/exercises/:id/toggle-active
 */
export const toggleExerciseActive = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const exercise = await adminToggleActive(id);

    if (!exercise) {
      throw ApiError.notFound('Exercise not found');
    }

    ApiResponse.success(res, exercise, `Exercise ${exercise.is_active ? 'activated' : 'deactivated'}`);
  }
);

/**
 * Sync exercises from external API
 * POST /api/admin/exercises/sync
 */
export const syncExercises = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { source, dryRun, limit } = syncExercisesSchema.parse(req.body);

    const options = { dryRun, limit };

    let result;
    switch (source) {
      case 'exercisedb':
        result = await ingestFromExerciseDB(options);
        break;
      case 'musclewiki':
        result = await ingestFromMuscleWiki(options);
        break;
      default:
        throw ApiError.badRequest(`Unknown source: ${source}`);
    }

    ApiResponse.success(res, result, `Sync from ${source} completed`);
  }
);
