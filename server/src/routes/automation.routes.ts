/**
 * @file Automation Routes
 * @description Routes for automation settings, testing, and logs
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { automationController } from '../controllers/automation.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// AUTOMATION SETTINGS
// ============================================

// Get user automation settings
router.get('/settings', automationController.getSettings);

// Update user automation settings
router.patch('/settings', automationController.updateSettings);

// ============================================
// AUTOMATION TESTING
// ============================================

// Test automation for a specific activity
router.post('/test', automationController.testAutomation);

// ============================================
// AUTOMATION LOGS
// ============================================

// Get automation message history
router.get('/logs', automationController.getLogs);

// ============================================
// JOB STATUS (Admin only)
// ============================================

// Get job status and metrics
router.get('/status', automationController.getStatus);

// Auto-create today's schedule and send message
router.post('/create-today-schedule', automationController.createTodaySchedule);

export default router;

