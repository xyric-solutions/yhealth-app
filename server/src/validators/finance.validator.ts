/**
 * @file Finance Validator
 * @description Zod schemas for all Finance module endpoints
 */

import { z } from 'zod';

// ============================================
// SHARED ENUMS
// ============================================

const transactionTypeEnum = z.enum(['income', 'expense']);

const financeCategoryEnum = z.enum([
  'food', 'transport', 'bills', 'health', 'entertainment',
  'shopping', 'subscriptions', 'savings', 'education',
  'salary', 'freelance', 'investments', 'other',
]);

const recurringIntervalEnum = z.enum(['daily', 'weekly', 'monthly', 'yearly']);
const savingGoalStatusEnum = z.enum(['in_progress', 'achieved', 'paused']);

// ============================================
// TRANSACTION SCHEMAS
// ============================================

export const createTransactionSchema = z.object({
  amount: z.number().positive('Amount must be positive').max(999999999.99, 'Amount too large'),
  transactionType: transactionTypeEnum,
  category: financeCategoryEnum,
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().max(1000).optional(),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  isRecurring: z.boolean().optional(),
  recurringInterval: recurringIntervalEnum.optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

export const updateTransactionSchema = createTransactionSchema.partial();

export const listTransactionsQuerySchema = z.object({
  category: financeCategoryEnum.optional(),
  transactionType: transactionTypeEnum.optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  search: z.string().max(100).optional(),
  page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1)).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
});

// ============================================
// BUDGET SCHEMAS
// ============================================

export const createBudgetSchema = z.object({
  category: financeCategoryEnum,
  monthlyLimit: z.number().positive('Budget limit must be positive').max(999999999.99),
  alertThreshold: z.number().int().min(1).max(100).optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be YYYY-MM'),
});

export const updateBudgetSchema = z.object({
  monthlyLimit: z.number().positive().max(999999999.99).optional(),
  alertThreshold: z.number().int().min(1).max(100).optional(),
});

// ============================================
// SAVING GOAL SCHEMAS
// ============================================

export const createSavingGoalSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  targetAmount: z.number().positive('Target must be positive').max(999999999.99),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  category: financeCategoryEnum.optional(),
  emoji: z.string().max(10).optional(),
});

export const updateSavingGoalSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  targetAmount: z.number().positive().max(999999999.99).optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  status: savingGoalStatusEnum.optional(),
  emoji: z.string().max(10).optional(),
});

export const contributeToGoalSchema = z.object({
  amount: z.number().positive('Contribution must be positive').max(999999999.99),
});

// ============================================
// ANALYTICS SCHEMAS
// ============================================

export const analyticsQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  months: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(24)).optional(),
});

// ============================================
// AI SCHEMAS
// ============================================

export const aiCoachMessageSchema = z.object({
  message: z.string().min(1, 'Message is required').max(500),
});

// ============================================
// PROFILE SCHEMAS
// ============================================

export const updateProfileSchema = z.object({
  currency: z.string().length(3).optional(),
  monthlyIncome: z.number().min(0).max(999999999.99).optional(),
  budgetLimit: z.number().positive().max(999999999.99).nullable().optional(),
  aiInsightsEnabled: z.boolean().optional(),
});
