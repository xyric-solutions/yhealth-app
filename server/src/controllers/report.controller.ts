/**
 * @file Report Controller
 * @description Handles report generation and download requests
 */

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { reportGenerationService } from '../services/report-generation.service.js';
import { logger } from '../services/logger.service.js';

class ReportController {
  /**
   * Generate comprehensive report
   * GET /api/reports/generate
   */
  generate = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const period = (req.query.period as 'week' | 'month' | 'quarter' | 'year') || 'month';

    if (!['week', 'month', 'quarter', 'year'].includes(period)) {
      throw ApiError.badRequest('Invalid period. Must be: week, month, quarter, or year');
    }

    logger.info('[ReportController] Generating report', { userId, period });

    const report = await reportGenerationService.generateReport(userId, period);

    ApiResponse.success(res, report, 'Report generated successfully');
  });

  /**
   * Download report as PDF
   * GET /api/reports/download/pdf
   */
  downloadPDF = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const period = (req.query.period as 'week' | 'month' | 'quarter' | 'year') || 'month';

    logger.info('[ReportController] Generating PDF report', { userId, period });

    const report = await reportGenerationService.generateReport(userId, period);
    const pdfBuffer = await reportGenerationService.generatePDF(report, userId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="balencia-report-${period}-${Date.now()}.pdf"`);
    res.send(pdfBuffer);
  });

  /**
   * Download report as CSV
   * GET /api/reports/download/csv
   */
  downloadCSV = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) throw ApiError.unauthorized();

    const period = (req.query.period as 'week' | 'month' | 'quarter' | 'year') || 'month';

    logger.info('[ReportController] Generating CSV report', { userId, period });

    const report = await reportGenerationService.generateReport(userId, period);
    const csvContent = await reportGenerationService.generateCSV(report);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="balencia-report-${period}-${Date.now()}.csv"`);
    res.send(csvContent);
  });
}

export const reportController = new ReportController();

