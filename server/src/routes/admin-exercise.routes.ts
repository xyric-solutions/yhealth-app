/**
 * Admin Exercise Routes
 * Admin-only routes for exercise library management
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createExerciseSchema,
  updateExerciseSchema,
  bulkDeleteExercisesSchema,
  bulkToggleActiveSchema,
  syncExercisesSchema,
} from '../validators/admin-exercise.validator.js';
import {
  getAdminExercises,
  getAdminExerciseStats,
  getAdminExerciseById,
  createExercise,
  updateExercise,
  deleteExercise,
  bulkDeleteExercises,
  bulkToggleActiveExercises,
  toggleExerciseActive,
  syncExercises,
} from '../controllers/admin-exercise.controller.js';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin'));

// List exercises (admin — includes inactive)
// GET /api/admin/exercises
router.get('/', getAdminExercises);

// Get exercise stats (admin)
// GET /api/admin/exercises/stats
router.get('/stats', getAdminExerciseStats);

// Create exercise
// POST /api/admin/exercises
router.post('/', validate(createExerciseSchema), createExercise);

// Sync from external APIs
// POST /api/admin/exercises/sync
router.post('/sync', validate(syncExercisesSchema), syncExercises);

// Bulk delete exercises
// POST /api/admin/exercises/bulk-delete
router.post('/bulk-delete', validate(bulkDeleteExercisesSchema), bulkDeleteExercises);

// Bulk toggle active status
// POST /api/admin/exercises/bulk-toggle-active
router.post('/bulk-toggle-active', validate(bulkToggleActiveSchema), bulkToggleActiveExercises);

// Get single exercise (admin)
// GET /api/admin/exercises/:id
router.get('/:id', getAdminExerciseById);

// Update exercise
// PUT /api/admin/exercises/:id
// PATCH /api/admin/exercises/:id
router.put('/:id', validate(updateExerciseSchema), updateExercise);
router.patch('/:id', validate(updateExerciseSchema), updateExercise);

// Delete exercise (soft delete)
// DELETE /api/admin/exercises/:id
router.delete('/:id', deleteExercise);

// Toggle active status
// POST /api/admin/exercises/:id/toggle-active
router.post('/:id/toggle-active', toggleExerciseActive);

export default router;
