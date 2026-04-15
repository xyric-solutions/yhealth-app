/**
 * @file Finance API Service
 * @description Client-side service for all Finance module API operations
 */

import { api } from '@/lib/api-client';
import type {
  FinanceProfile,
  FinanceTransaction,
  FinanceBudget,
  FinanceSavingGoal,
  FinanceAIInsight,
  TransactionListResponse,
  TransactionSummary,
  MonthlySummary,
  CategoryBreakdownItem,
  SpendingTrend,
  BudgetAlert,
  GoalProjection,
  FinanceForecast,
  CreateTransactionInput,
  UpdateTransactionInput,
  CreateBudgetInput,
  CreateSavingGoalInput,
  ContributeToGoalInput,
} from '@shared/types/domain/finance';

export const financeService = {
  // ============================================
  // Profile
  // ============================================
  getProfile: () =>
    api.get<FinanceProfile>('/finance/profile'),

  updateProfile: (input: Partial<Pick<FinanceProfile, 'currency' | 'monthlyIncome' | 'budgetLimit' | 'aiInsightsEnabled'>>) =>
    api.put<FinanceProfile>('/finance/profile', input),

  // ============================================
  // Transactions
  // ============================================
  createTransaction: (input: CreateTransactionInput) =>
    api.post<FinanceTransaction>('/finance/transactions', input),

  getTransactions: (params?: {
    category?: string;
    transactionType?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) =>
    api.get<TransactionListResponse>('/finance/transactions', { params }),

  getTransaction: (id: string) =>
    api.get<FinanceTransaction>(`/finance/transactions/${id}`),

  updateTransaction: (id: string, input: UpdateTransactionInput) =>
    api.put<FinanceTransaction>(`/finance/transactions/${id}`, input),

  deleteTransaction: (id: string) =>
    api.delete(`/finance/transactions/${id}`),

  getTransactionSummary: (params?: { startDate?: string; endDate?: string }) =>
    api.get<TransactionSummary>('/finance/transactions/summary', { params }),

  // ============================================
  // Analytics
  // ============================================
  getMonthlySummary: (month?: string) =>
    api.get<MonthlySummary>('/finance/analytics/monthly', { params: month ? { month } : undefined }),

  getCategoryBreakdown: (month?: string) =>
    api.get<CategoryBreakdownItem[]>('/finance/analytics/categories', { params: month ? { month } : undefined }),

  getSpendingTrends: (months?: number) =>
    api.get<SpendingTrend[]>('/finance/analytics/trends', { params: months ? { months } : undefined }),

  getMonthComparison: () =>
    api.get<{ current: MonthlySummary; previous: MonthlySummary }>('/finance/analytics/comparison'),

  getForecast: () =>
    api.get<FinanceForecast>('/finance/analytics/forecast'),

  // ============================================
  // Budgets
  // ============================================
  getBudgets: (month?: string) =>
    api.get<FinanceBudget[]>('/finance/budgets', { params: month ? { month } : undefined }),

  createBudget: (input: CreateBudgetInput) =>
    api.post<FinanceBudget>('/finance/budgets', input),

  updateBudget: (id: string, input: { monthlyLimit?: number; alertThreshold?: number }) =>
    api.put<FinanceBudget>(`/finance/budgets/${id}`, input),

  deleteBudget: (id: string) =>
    api.delete(`/finance/budgets/${id}`),

  getBudgetAlerts: () =>
    api.get<BudgetAlert[]>('/finance/budgets/alerts'),

  // ============================================
  // Saving Goals
  // ============================================
  getGoals: () =>
    api.get<FinanceSavingGoal[]>('/finance/goals'),

  createGoal: (input: CreateSavingGoalInput) =>
    api.post<FinanceSavingGoal>('/finance/goals', input),

  updateGoal: (id: string, input: Partial<CreateSavingGoalInput & { status: string }>) =>
    api.put<FinanceSavingGoal>(`/finance/goals/${id}`, input),

  deleteGoal: (id: string) =>
    api.delete(`/finance/goals/${id}`),

  contributeToGoal: (id: string, input: ContributeToGoalInput) =>
    api.post<FinanceSavingGoal>(`/finance/goals/${id}/contribute`, input),

  getGoalProjection: (id: string) =>
    api.get<GoalProjection>(`/finance/goals/${id}/projection`),

  // ============================================
  // AI Insights
  // ============================================
  getInsights: () =>
    api.get<FinanceAIInsight[]>('/finance/ai/insights'),

  dismissInsight: (id: string) =>
    api.post(`/finance/ai/insights/${id}/dismiss`),
};
