/**
 * Admin Role Routes
 * Admin-only routes for role and permission management
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createRoleSchema,
  updateRoleSchema,
  bulkDeleteRolesSchema,
  updateRolePermissionsSchema,
} from '../validators/role.validator.js';
import {
  getRoles,
  getAllPermissions,
  getRoleStatistics,
  getRoleByIdHandler,
  getRolePermissionsHandler,
  createRolePost,
  updateRolePut,
  updateRolePermissionsPut,
  deleteRoleDelete,
  bulkDeleteRolesPost,
  toggleRoleStatusPost,
  archiveRolePost,
  unarchiveRolePost,
  bulkArchiveRolesPost,
} from '../controllers/role.controller.js';

const router = Router();

router.use(authenticate);
router.use(authorize('admin'));

// Must be before /:id
router.get('/permissions', getAllPermissions);
router.get('/stats', getRoleStatistics);
router.get('/', getRoles);

router.get('/:id', getRoleByIdHandler);
router.get('/:id/permissions', getRolePermissionsHandler);

router.post('/', validate(createRoleSchema), createRolePost);
router.put('/:id', validate(updateRoleSchema), updateRolePut);
router.put('/:id/permissions', validate(updateRolePermissionsSchema), updateRolePermissionsPut);
router.delete('/:id', deleteRoleDelete);

router.post('/:id/toggle-status', toggleRoleStatusPost);
router.post('/:id/archive', archiveRolePost);
router.post('/:id/unarchive', unarchiveRolePost);

router.post('/bulk-delete', validate(bulkDeleteRolesSchema), bulkDeleteRolesPost);
router.post('/bulk-archive', validate(bulkDeleteRolesSchema), bulkArchiveRolesPost);

export default router;
