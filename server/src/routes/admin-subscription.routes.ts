/**
 * Admin Subscription Routes
 * CRUD plans, list subscriptions - admin only
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  adminListPlansHandler,
  adminGetPlanHandler,
  adminCreatePlanHandler,
  adminUpdatePlanHandler,
  adminDeletePlanHandler,
  adminListSubscriptionsHandler,
  getRevenueStatsHandler,
  adminUpdateSubscriptionHandler,
  adminDeleteSubscriptionHandler,
  generateInvoiceHandler,
} from '../controllers/subscription.controller.js';
import {
  createPlanSchema,
  updatePlanSchema,
  planIdParamSchema,
  adminListPlansQuerySchema,
  adminListSubscriptionsQuerySchema,
} from '../validators/subscription.validator.js';

const router = Router();

router.use(authenticate);
router.use(authorize('admin'));

/** GET /api/admin/subscriptions/plans */
router.get('/plans', validate(adminListPlansQuerySchema, 'query'), adminListPlansHandler);

/** GET /api/admin/subscriptions/plans/:id */
router.get('/plans/:id', validate(planIdParamSchema, 'params'), adminGetPlanHandler);

/** POST /api/admin/subscriptions/plans */
router.post('/plans', validate(createPlanSchema, 'body'), adminCreatePlanHandler);

/** PATCH /api/admin/subscriptions/plans/:id */
router.patch('/plans/:id', validate(planIdParamSchema, 'params'), validate(updatePlanSchema, 'body'), adminUpdatePlanHandler);

/** DELETE /api/admin/subscriptions/plans/:id */
router.delete('/plans/:id', validate(planIdParamSchema, 'params'), adminDeletePlanHandler);

/** GET /api/admin/subscriptions/subscriptions */
router.get('/subscriptions', validate(adminListSubscriptionsQuerySchema, 'query'), adminListSubscriptionsHandler);

/** GET /api/admin/subscriptions/revenue */
router.get('/revenue', getRevenueStatsHandler);

/** PATCH /api/admin/subscriptions/subscriptions/:id */
router.patch('/subscriptions/:id', adminUpdateSubscriptionHandler);

/** DELETE /api/admin/subscriptions/subscriptions/:id */
router.delete('/subscriptions/:id', adminDeleteSubscriptionHandler);

/** POST /api/admin/subscriptions/invoice */
router.post('/invoice', generateInvoiceHandler);

export default router;
