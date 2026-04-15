/**
 * Admin Analytics Routes
 * Visitor analytics and comprehensive analytics - admin only
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { getVisitorAnalyticsHandler } from '../controllers/visitor.controller.js';
import { getAnalyticsOverviewHandler } from '../controllers/admin-analytics.controller.js';

const router = Router();

router.use(authenticate);
router.use(authorize('admin'));

/**
 * Get visitor analytics (time series + by country)
 * GET /api/admin/analytics/visitors?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
router.get('/visitors', getVisitorAnalyticsHandler);

/**
 * Get comprehensive analytics overview
 * GET /api/admin/analytics/overview?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
router.get('/overview', getAnalyticsOverviewHandler);

export default router;
