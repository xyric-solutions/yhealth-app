/**
 * @file Finance Routes
 * @description API endpoints for the Finance & Money Management module
 */

import { Router } from 'express';
import authenticate from '../middlewares/auth.middleware.js';
import * as fc from '../controllers/finance.controller.js';

const router = Router();

// All finance routes require authentication
router.use(authenticate);

// ============================================
// Profile
// ============================================
router.get('/profile', fc.getProfile);
router.put('/profile', fc.updateProfile);

// ============================================
// Transactions
// ============================================
router.post('/transactions', fc.createTransaction);
router.get('/transactions', fc.getTransactions);
router.get('/transactions/summary', fc.getTransactionSummary);
router.get('/transactions/:id', fc.getTransaction);
router.put('/transactions/:id', fc.updateTransaction);
router.delete('/transactions/:id', fc.deleteTransaction);

// ============================================
// Analytics
// ============================================
router.get('/analytics/monthly', fc.getMonthlySummary);
router.get('/analytics/categories', fc.getCategoryBreakdown);
router.get('/analytics/trends', fc.getSpendingTrends);
router.get('/analytics/comparison', fc.getMonthComparison);
router.get('/analytics/forecast', fc.getForecast);

// ============================================
// Budgets
// ============================================
router.get('/budgets', fc.getBudgets);
router.post('/budgets', fc.createBudget);
router.get('/budgets/alerts', fc.getBudgetAlerts);
router.put('/budgets/:id', fc.updateBudget);
router.delete('/budgets/:id', fc.deleteBudget);

// ============================================
// Saving Goals
// ============================================
router.get('/goals', fc.getGoals);
router.post('/goals', fc.createGoal);
router.put('/goals/:id', fc.updateGoal);
router.delete('/goals/:id', fc.deleteGoal);
router.post('/goals/:id/contribute', fc.contributeToGoal);
router.get('/goals/:id/projection', fc.getGoalProjection);

// ============================================
// AI Insights
// ============================================
router.get('/ai/insights', fc.getInsights);
router.post('/ai/insights/:id/dismiss', fc.dismissInsight);
router.post('/ai/coach', fc.aiCoachChat);

// ============================================
// Receipt Scanning
// ============================================
router.post('/receipts/scan', fc.scanReceipt);

export default router;
