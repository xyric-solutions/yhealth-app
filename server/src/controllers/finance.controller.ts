/**
 * @file Finance Controller
 * @description Request handlers for all Finance module endpoints
 */

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { financeService } from '../services/finance.service.js';
import { aiProviderService } from '../services/ai-provider.service.js';

function getUserId(req: AuthenticatedRequest): string {
  const userId = req.user?.userId;
  if (!userId) throw ApiError.unauthorized();
  return userId;
}

// ============================================
// PROFILE
// ============================================

export const getProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await financeService.getOrCreateProfile(getUserId(req));
  ApiResponse.success(res, profile, 'Profile retrieved');
});

export const updateProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const profile = await financeService.updateProfile(getUserId(req), req.body);
  ApiResponse.success(res, profile, 'Profile updated');
});

// ============================================
// TRANSACTIONS
// ============================================

export const createTransaction = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const tx = await financeService.createTransaction(getUserId(req), req.body);
  ApiResponse.created(res, tx, 'Transaction created');
});

export const getTransactions = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await financeService.getTransactions(getUserId(req), {
    category: req.query.category as string | undefined,
    transactionType: req.query.transactionType as string | undefined,
    startDate: req.query.startDate as string | undefined,
    endDate: req.query.endDate as string | undefined,
    search: req.query.search as string | undefined,
    page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
    limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
  });
  ApiResponse.success(res, result, 'Transactions retrieved');
});

export const getTransaction = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const tx = await financeService.getTransaction(getUserId(req), req.params.id);
  if (!tx) throw ApiError.notFound('Transaction not found');
  ApiResponse.success(res, tx, 'Transaction retrieved');
});

export const updateTransaction = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const tx = await financeService.updateTransaction(getUserId(req), req.params.id, req.body);
  ApiResponse.success(res, tx, 'Transaction updated');
});

export const deleteTransaction = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await financeService.deleteTransaction(getUserId(req), req.params.id);
  ApiResponse.success(res, null, 'Transaction deleted');
});

export const getTransactionSummary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const summary = await financeService.getTransactionSummary(
    getUserId(req),
    req.query.startDate as string | undefined,
    req.query.endDate as string | undefined
  );
  ApiResponse.success(res, summary, 'Summary retrieved');
});

// ============================================
// ANALYTICS
// ============================================

export const getMonthlySummary = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const summary = await financeService.getMonthlySummary(
    getUserId(req),
    req.query.month as string | undefined
  );
  ApiResponse.success(res, summary, 'Monthly summary retrieved');
});

export const getCategoryBreakdown = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const breakdown = await financeService.getCategoryBreakdown(
    getUserId(req),
    req.query.month as string | undefined
  );
  ApiResponse.success(res, breakdown, 'Category breakdown retrieved');
});

export const getSpendingTrends = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const months = req.query.months ? parseInt(req.query.months as string, 10) : 6;
  const trends = await financeService.getSpendingTrends(getUserId(req), months);
  ApiResponse.success(res, trends, 'Spending trends retrieved');
});

export const getMonthComparison = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const comparison = await financeService.getMonthComparison(getUserId(req));
  ApiResponse.success(res, comparison, 'Month comparison retrieved');
});

export const getForecast = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const forecast = await financeService.getForecast(getUserId(req));
  ApiResponse.success(res, forecast, 'Forecast retrieved');
});

// ============================================
// BUDGETS
// ============================================

export const getBudgets = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const budgets = await financeService.getBudgets(
    getUserId(req),
    req.query.month as string | undefined
  );
  ApiResponse.success(res, budgets, 'Budgets retrieved');
});

export const createBudget = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const budget = await financeService.createBudget(getUserId(req), req.body);
  ApiResponse.created(res, budget, 'Budget created');
});

export const updateBudget = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const budget = await financeService.updateBudget(getUserId(req), req.params.id, req.body);
  ApiResponse.success(res, budget, 'Budget updated');
});

export const deleteBudget = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await financeService.deleteBudget(getUserId(req), req.params.id);
  ApiResponse.success(res, null, 'Budget deleted');
});

export const getBudgetAlerts = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const alerts = await financeService.getBudgetAlerts(getUserId(req));
  ApiResponse.success(res, alerts, 'Budget alerts retrieved');
});

// ============================================
// SAVING GOALS
// ============================================

export const getGoals = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const goals = await financeService.getGoals(getUserId(req));
  ApiResponse.success(res, goals, 'Goals retrieved');
});

export const createGoal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const goal = await financeService.createGoal(getUserId(req), req.body);
  ApiResponse.created(res, goal, 'Goal created');
});

export const updateGoal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const goal = await financeService.updateGoal(getUserId(req), req.params.id, req.body);
  ApiResponse.success(res, goal, 'Goal updated');
});

export const deleteGoal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await financeService.deleteGoal(getUserId(req), req.params.id);
  ApiResponse.success(res, null, 'Goal deleted');
});

export const contributeToGoal = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const goal = await financeService.contributeToGoal(getUserId(req), req.params.id, req.body.amount);
  ApiResponse.success(res, goal, 'Contribution added');
});

export const getGoalProjection = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const projection = await financeService.getGoalProjection(getUserId(req), req.params.id);
  ApiResponse.success(res, projection, 'Projection retrieved');
});

// ============================================
// AI INSIGHTS
// ============================================

export const getInsights = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const insights = await financeService.getActiveInsights(getUserId(req));
  ApiResponse.success(res, insights, 'Insights retrieved');
});

export const dismissInsight = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await financeService.dismissInsight(getUserId(req), req.params.id);
  ApiResponse.success(res, null, 'Insight dismissed');
});

// ============================================
// AI FINANCE COACH CHAT
// ============================================

export const aiCoachChat = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = getUserId(req);
  const { message } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    throw ApiError.badRequest('Message is required');
  }

  // Import AI provider dynamically to avoid circular deps
  const { aiProviderService } = await import('../services/ai-provider.service.js');

  // Get user's financial context (anonymized)
  const summary = await financeService.getTransactionSummary(userId);
  const budgets = await financeService.getBudgets(userId);
  const goals = await financeService.getGoals(userId);
  const breakdown = await financeService.getCategoryBreakdown(userId);

  // Build anonymized context
  const context = [
    `Monthly income: $${summary.totalIncome.toFixed(0)}, expenses: $${summary.totalExpense.toFixed(0)}, net: $${(summary.totalIncome - summary.totalExpense).toFixed(0)}`,
    breakdown.length > 0
      ? `Top spending: ${breakdown.slice(0, 5).map(c => `${c.category} ${c.percentage}%`).join(', ')}`
      : '',
    budgets.length > 0
      ? `Budgets: ${budgets.map(b => `${b.category} $${b.currentSpend.toFixed(0)}/$${b.monthlyLimit.toFixed(0)}`).join(', ')}`
      : '',
    goals.length > 0
      ? `Goals: ${goals.map(g => `${g.title} $${g.currentAmount.toFixed(0)}/$${g.targetAmount.toFixed(0)}`).join(', ')}`
      : '',
  ].filter(Boolean).join('. ');

  const systemPrompt = `You are a personal finance coach inside Balencia. You have access to the user's financial data (anonymized summary below). Respond in a warm, direct, and motivating tone. Be specific with numbers when possible. Always suggest 1-2 concrete actions. Keep responses concise (under 250 words). CRITICAL: Always finish every sentence completely — never stop mid-sentence or mid-thought.

User's financial context: ${context}`;

  const result = await aiProviderService.generateCompletion({
    systemPrompt,
    userPrompt: message.trim(),
    maxTokens: 1500,
    temperature: 0.7,
  });

  ApiResponse.success(res, {
    reply: result.content,
    provider: result.provider,
  }, 'AI response generated');
});

// ============================================
// RECEIPT SCANNING (Gemini Vision)
// ============================================

export const scanReceipt = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  getUserId(req); // auth check

  const { imageBase64 } = req.body as { imageBase64: string };
  if (!imageBase64) throw ApiError.badRequest('imageBase64 is required');

  // Use Gemini Vision to extract receipt data
  const result = await aiProviderService.generateCompletion({
    systemPrompt: `You are a receipt OCR system. Extract structured data from receipt images.
Return ONLY valid JSON (no markdown fences):
{
  "vendor": "store/restaurant name",
  "date": "YYYY-MM-DD",
  "total": number (total amount),
  "currency": "USD" or detected currency code,
  "items": [{ "name": "item name", "price": number, "quantity": number }],
  "category": "food" | "transport" | "bills" | "health" | "entertainment" | "shopping" | "subscriptions" | "education" | "other",
  "paymentMethod": "cash" | "card" | "digital" | "unknown",
  "taxAmount": number or null,
  "confidence": number (0-100, how confident you are in the extraction)
}
If the image is not a receipt or is unreadable, return:
{ "error": "not_a_receipt", "message": "description of what you see instead" }`,
    userPrompt: 'Extract all data from this receipt image.',
    maxTokens: 2000,
    temperature: 0.1,
    imageBase64,
  });

  // Parse AI response
  try {
    const jsonStr = result.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const extracted = JSON.parse(jsonStr);
    ApiResponse.success(res, { receipt: extracted, provider: result.provider }, 'Receipt scanned');
  } catch {
    ApiResponse.success(res, {
      receipt: { error: 'parse_failed', rawText: result.content.substring(0, 500) },
      provider: result.provider,
    }, 'Receipt scan completed with parsing issues');
  }
});
