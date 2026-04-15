/**
 * @file Intelligence Controller
 * @description API endpoints for Cross-Domain Intelligence (Epic 08)
 * Exposes daily analysis reports, contradictions, score breakdowns,
 * correlations, best-day formula, and insight feedback.
 */

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { dailyAnalysisService } from '../services/daily-analysis.service.js';
import { crossPillarIntelligenceService } from '../services/cross-pillar-intelligence.service.js';
import { aiScoringService } from '../services/ai-scoring.service.js';
import { healthCorrelationService } from '../services/wellbeing/health-correlation.service.js';
import { weeklyReportService } from '../services/weekly-report.service.js';
import { predictionAccuracyService } from '../services/prediction-accuracy.service.js';
import { bestDayFormulaService } from '../services/best-day-formula.service.js';
import { query } from '../database/pg.js';

class IntelligenceController {
  // ============================================
  // DAILY ANALYSIS REPORTS
  // ============================================

  /**
   * @route   GET /api/v1/intelligence
   * @desc    Get latest daily analysis report
   */
  getLatestReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const report = await dailyAnalysisService.getLatestReport(userId);
    if (!report) {
      ApiResponse.success(res, { report: null }, 'No reports available yet', undefined, req);
      return;
    }
    ApiResponse.success(res, { report }, 'Latest report retrieved', undefined, req);
  });

  /**
   * @route   GET /api/v1/intelligence/report/:date
   * @desc    Get daily analysis report for a specific date
   */
  getReportByDate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const { date } = req.params;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw ApiError.badRequest('Invalid date format. Use YYYY-MM-DD');
    }

    const report = await dailyAnalysisService.getReport(userId, date);
    if (!report) {
      ApiResponse.success(res, { report: null }, 'No report for this date', undefined, req);
      return;
    }
    ApiResponse.success(res, { report }, 'Report retrieved', undefined, req);
  });

  /**
   * @route   GET /api/v1/intelligence/history
   * @desc    Get paginated report history summaries
   */
  getReportHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const limit = Math.min(parseInt(req.query.limit as string) || 30, 90);
    const offset = parseInt(req.query.offset as string) || 0;

    const history = await dailyAnalysisService.getReportHistory(userId, limit, offset);
    ApiResponse.success(res, { history, limit, offset }, 'Report history retrieved', undefined, req);
  });

  // ============================================
  // CONTRADICTIONS
  // ============================================

  /**
   * @route   GET /api/v1/intelligence/contradictions
   * @desc    Get active contradictions sorted by severity
   */
  getActiveContradictions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const contradictions = await crossPillarIntelligenceService.getActiveContradictions(userId);
    ApiResponse.success(res, { contradictions }, 'Contradictions retrieved', undefined, req);
  });

  /**
   * @route   GET /api/v1/intelligence/contradictions/summary
   * @desc    Get contradiction count by severity
   */
  getContradictionSummary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const summary = await crossPillarIntelligenceService.getContradictionSummary(userId);
    ApiResponse.success(res, { summary }, 'Contradiction summary retrieved', undefined, req);
  });

  /**
   * @route   POST /api/v1/intelligence/contradictions/:id/resolve
   * @desc    Mark a contradiction as resolved
   */
  resolveContradiction = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    await crossPillarIntelligenceService.resolveContradiction(req.params.id, 'resolved');
    ApiResponse.success(res, {}, 'Contradiction resolved', undefined, req);
  });

  /**
   * @route   POST /api/v1/intelligence/contradictions/:id/dismiss
   * @desc    Dismiss a contradiction
   */
  dismissContradiction = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    await crossPillarIntelligenceService.resolveContradiction(req.params.id, 'dismissed');
    ApiResponse.success(res, {}, 'Contradiction dismissed', undefined, req);
  });

  // ============================================
  // SCORE
  // ============================================

  /**
   * @route   GET /api/v1/intelligence/score/breakdown
   * @desc    Get daily score with full component breakdown
   */
  getScoreBreakdown = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const score = await aiScoringService.getDailyScore(userId, date);
    ApiResponse.success(res, { score, date }, 'Score breakdown retrieved', undefined, req);
  });

  /**
   * @route   GET /api/v1/intelligence/score/trend
   * @desc    Get score trend over N days
   */
  getScoreTrend = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const days = Math.min(parseInt(req.query.days as string) || 30, 90);
    const trend = await aiScoringService.getScoreTrend(userId, days);
    ApiResponse.success(res, { trend, days }, 'Score trend retrieved', undefined, req);
  });

  // ============================================
  // CORRELATIONS & BEST DAY
  // ============================================

  /**
   * @route   GET /api/v1/intelligence/correlations
   * @desc    Get all active health correlations
   */
  getCorrelations = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const correlations = await healthCorrelationService.getActiveCorrelations(userId);
    ApiResponse.success(res, { correlations }, 'Correlations retrieved', undefined, req);
  });

  /**
   * @route   GET /api/v1/intelligence/best-day
   * @desc    Get user's best day formula
   */
  getBestDayFormula = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const correlations = await healthCorrelationService.getActiveCorrelations(userId);
    // Filter for best-day pattern
    const bestDay = (correlations as Array<{ pattern_type?: string }>).find(
      (c) => c.pattern_type === 'best_day_profile'
    );
    ApiResponse.success(res, { bestDay: bestDay || null }, 'Best day formula retrieved', undefined, req);
  });

  // ============================================
  // WEEKLY REPORTS
  // ============================================

  /**
   * @route   GET /api/v1/intelligence/weekly
   * @desc    Get latest or specific weekly report
   */
  getWeeklyReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const weekEnd = req.query.weekEnd as string | undefined;
    const report = await weeklyReportService.getWeeklyReport(userId, weekEnd);
    ApiResponse.success(res, { report }, report ? 'Weekly report retrieved' : 'No weekly report available', undefined, req);
  });

  /**
   * @route   GET /api/v1/intelligence/weekly/history
   * @desc    Get paginated weekly report history
   */
  getWeeklyHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const limit = Math.min(parseInt(req.query.limit as string) || 12, 52);
    const history = await weeklyReportService.getWeeklyHistory(userId, limit);
    ApiResponse.success(res, { history, limit }, 'Weekly history retrieved', undefined, req);
  });

  // ============================================
  // PREDICTIONS & BEST DAY
  // ============================================

  /**
   * @route   GET /api/v1/intelligence/predictions/accuracy
   * @desc    Get prediction accuracy statistics
   */
  getPredictionAccuracy = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const days = Math.min(parseInt(req.query.days as string) || 30, 90);
    const stats = await predictionAccuracyService.getAccuracyStats(userId, days);
    ApiResponse.success(res, { stats, days }, 'Prediction accuracy retrieved', undefined, req);
  });

  /**
   * @route   GET /api/v1/intelligence/best-day/progress
   * @desc    Get today's best day formula achievement + streak
   */
  getBestDayProgress = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const date = req.query.date as string | undefined;
    const progress = await bestDayFormulaService.getFormulaAchievementScore(userId, date);
    ApiResponse.success(res, { progress }, 'Best day progress retrieved', undefined, req);
  });

  // ============================================
  // INSIGHT FEEDBACK
  // ============================================

  /**
   * @route   POST /api/v1/intelligence/insights/:id/feedback
   * @desc    Submit feedback on an insight (useful/not useful)
   */
  submitInsightFeedback = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized('Authentication required');

    const insightId = req.params.id;
    if (!insightId || insightId.trim().length === 0 || insightId.length > 100) {
      throw ApiError.badRequest('Invalid insight ID (max 100 characters)');
    }

    const { useful, comment, reportDate } = req.body;
    if (typeof useful !== 'boolean') {
      throw ApiError.badRequest('Field "useful" (boolean) is required');
    }
    if (!reportDate || !/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) {
      throw ApiError.badRequest('Field "reportDate" (YYYY-MM-DD) is required');
    }

    await query(
      `INSERT INTO insight_feedback (user_id, insight_id, report_date, useful, comment)
       VALUES ($1, $2, $3::date, $4, $5)
       ON CONFLICT ON CONSTRAINT uq_insight_feedback_user_insight DO UPDATE SET
         useful = EXCLUDED.useful,
         comment = EXCLUDED.comment`,
      [userId, insightId, reportDate, useful, comment || null]
    );

    ApiResponse.success(res, {}, 'Feedback submitted', undefined, req);
  });
}

export const intelligenceController = new IntelligenceController();
