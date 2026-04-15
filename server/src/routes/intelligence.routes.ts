/**
 * @file Intelligence Routes
 * @description API routes for Cross-Domain Intelligence (Epic 08)
 * Mounted at /api/v1/intelligence
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { intelligenceController } from '../controllers/intelligence.controller.js';
import knowledgeGraphRoutes from './knowledge-graph.routes.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Daily analysis reports
router.get('/', intelligenceController.getLatestReport);
router.get('/report/:date', intelligenceController.getReportByDate);
router.get('/history', intelligenceController.getReportHistory);

// Contradictions
router.get('/contradictions', intelligenceController.getActiveContradictions);
router.get('/contradictions/summary', intelligenceController.getContradictionSummary);
router.post('/contradictions/:id/resolve', intelligenceController.resolveContradiction);
router.post('/contradictions/:id/dismiss', intelligenceController.dismissContradiction);

// Score
router.get('/score/breakdown', intelligenceController.getScoreBreakdown);
router.get('/score/trend', intelligenceController.getScoreTrend);

// Correlations & Best Day
router.get('/correlations', intelligenceController.getCorrelations);
router.get('/best-day', intelligenceController.getBestDayFormula);

// Weekly reports
router.get('/weekly', intelligenceController.getWeeklyReport);
router.get('/weekly/history', intelligenceController.getWeeklyHistory);

// Predictions & Best Day
router.get('/predictions/accuracy', intelligenceController.getPredictionAccuracy);
router.get('/best-day/progress', intelligenceController.getBestDayProgress);

// Insight feedback
router.post('/insights/:id/feedback', intelligenceController.submitInsightFeedback);

// Knowledge Graph sub-router
router.use('/graph', knowledgeGraphRoutes);

export default router;
