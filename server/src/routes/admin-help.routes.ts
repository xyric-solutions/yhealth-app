/**
 * Admin Help Center Routes
 * Admin-only routes for help article management
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  createHelpArticleSchema,
  updateHelpArticleSchema,
  bulkDeleteHelpSchema,
  generateHelpArticleSchema,
} from '../validators/help.validator.js';
import {
  getAdminHelpArticles,
  getAdminHelpArticle,
  createHelpArticleHandler,
  updateHelpArticleHandler,
  deleteHelpArticleHandler,
  bulkDeleteHelpArticlesHandler,
  getHelpStatsHandler,
  generateHelpArticle,
} from '../controllers/help.controller.js';

const router = Router();

// All admin routes require authentication and admin role
router.use(authenticate);
router.use(authorize('admin'));

/**
 * Get help stats (admin)
 * GET /api/admin/help/stats
 */
router.get('/stats', getHelpStatsHandler);

/**
 * Get all help articles (admin)
 * GET /api/admin/help
 */
router.get('/', getAdminHelpArticles);

/**
 * Generate help article with AI (admin)
 * POST /api/admin/help/generate
 */
router.post('/generate', validate(generateHelpArticleSchema), generateHelpArticle);

/**
 * Get single help article by ID (admin)
 * GET /api/admin/help/:id
 */
router.get('/:id', getAdminHelpArticle);

/**
 * Create help article (admin)
 * POST /api/admin/help
 */
router.post('/', validate(createHelpArticleSchema), createHelpArticleHandler);

/**
 * Update help article (admin)
 * PUT /api/admin/help/:id
 * PATCH /api/admin/help/:id
 */
router.put('/:id', validate(updateHelpArticleSchema), updateHelpArticleHandler);
router.patch('/:id', validate(updateHelpArticleSchema), updateHelpArticleHandler);

/**
 * Delete help article (admin)
 * DELETE /api/admin/help/:id
 */
router.delete('/:id', deleteHelpArticleHandler);

/**
 * Bulk delete help articles (admin)
 * POST /api/admin/help/bulk-delete
 */
router.post('/bulk-delete', validate(bulkDeleteHelpSchema), bulkDeleteHelpArticlesHandler);

export default router;
