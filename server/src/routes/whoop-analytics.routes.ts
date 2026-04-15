/**
 * @file WHOOP Analytics Routes
 * @description Routes for WHOOP analytics endpoints
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import whoopAnalyticsController from '../controllers/whoop-analytics.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// WHOOP Analytics endpoints
router.get('/overview', whoopAnalyticsController.getWhoopOverview);
router.get('/user-profile', whoopAnalyticsController.getUserHealthProfile);
router.get('/recovery', whoopAnalyticsController.getRecoveryTrends);
router.get('/sleep', whoopAnalyticsController.getSleepAnalysis);
router.get('/strain', whoopAnalyticsController.getStrainPatterns);
router.get('/cycles', whoopAnalyticsController.getCycleAnalysis);
router.get('/stress', whoopAnalyticsController.getStressAnalysis);

export default router;

