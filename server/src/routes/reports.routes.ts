/**
 * @file Report Routes
 * @description API routes for report generation and downloads
 */

import { Router } from 'express';
import { reportController } from '../controllers/report.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * @route   GET /api/reports/generate
 * @desc    Generate comprehensive report
 * @access  Private
 */
router.get('/generate', authenticate, reportController.generate);

/**
 * @route   GET /api/reports/download/pdf
 * @desc    Download report as PDF
 * @access  Private
 */
router.get('/download/pdf', authenticate, reportController.downloadPDF);

/**
 * @route   GET /api/reports/download/csv
 * @desc    Download report as CSV
 * @access  Private
 */
router.get('/download/csv', authenticate, reportController.downloadCSV);

export default router;

