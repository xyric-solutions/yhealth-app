/**
 * Admin Newsletter Routes
 * List, view, delete, bulk-delete newsletter subscriptions
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { bulkDeleteNewsletterSchema } from '../validators/newsletter.validator.js';
import {
  getAdminList,
  getAdminById,
  deleteOne,
  bulkDelete,
} from '../controllers/newsletter.controller.js';

const router = Router();

router.use(authenticate);
router.use(authorize('admin'));

router.get('/', getAdminList);
router.post('/bulk-delete', validate(bulkDeleteNewsletterSchema), bulkDelete);
router.get('/:id', getAdminById);
router.delete('/:id', deleteOne);

export default router;
