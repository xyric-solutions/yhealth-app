/**
 * @file Finance Service
 * @description Core business logic for the Finance module — transactions, analytics,
 * budgets, saving goals, and monthly snapshots.
 */

import { query } from '../database/pg.js';
import { logger } from './logger.service.js';
import { ApiError } from '../utils/ApiError.js';
import type {
  FinanceTransaction,
  FinanceBudget,
  FinanceSavingGoal,
  FinanceAIInsight,
  FinanceProfile,
  TransactionSummary,
  MonthlySummary,
  CategoryBreakdownItem,
  SpendingTrend,
  BudgetAlert,
  GoalProjection,
  FinanceForecast,
  FinanceCategory,
} from '../../../shared/types/domain/finance.js';

// ============================================
// ROW TYPES (snake_case from DB)
// ============================================

interface TransactionRow {
  id: string;
  user_id: string;
  amount: string;
  transaction_type: string;
  category: string;
  title: string;
  description: string | null;
  transaction_date: string;
  is_recurring: boolean;
  recurring_interval: string | null;
  tags: string[];
  created_at: Date;
  updated_at: Date;
}

interface BudgetRow {
  id: string;
  user_id: string;
  category: string;
  monthly_limit: string;
  current_spend: string;
  alert_threshold: number;
  month: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

interface GoalRow {
  id: string;
  user_id: string;
  title: string;
  target_amount: string;
  current_amount: string;
  deadline: string | null;
  category: string;
  status: string;
  emoji: string;
  created_at: Date;
  updated_at: Date;
}

interface InsightRow {
  id: string;
  user_id: string;
  insight_type: string;
  title: string;
  body: string;
  actionable: boolean;
  related_category: string | null;
  savings_potential: string | null;
  generated_at: Date;
  expires_at: Date | null;
  dismissed: boolean;
}

interface ProfileRow {
  id: string;
  user_id: string;
  currency: string;
  monthly_income: string;
  budget_limit: string | null;
  timezone: string;
  ai_insights_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

// ============================================
// MAPPERS
// ============================================

function mapTransaction(row: TransactionRow): FinanceTransaction {
  return {
    id: row.id,
    userId: row.user_id,
    amount: parseFloat(row.amount),
    transactionType: row.transaction_type as FinanceTransaction['transactionType'],
    category: row.category as FinanceCategory,
    title: row.title,
    description: row.description,
    transactionDate: typeof row.transaction_date === 'string'
      ? row.transaction_date
      : new Date(row.transaction_date).toISOString().split('T')[0],
    isRecurring: row.is_recurring,
    recurringInterval: row.recurring_interval as FinanceTransaction['recurringInterval'],
    tags: row.tags || [],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapBudget(row: BudgetRow): FinanceBudget {
  return {
    id: row.id,
    userId: row.user_id,
    category: row.category as FinanceCategory,
    monthlyLimit: parseFloat(row.monthly_limit),
    currentSpend: parseFloat(row.current_spend),
    alertThreshold: row.alert_threshold,
    month: row.month,
    status: row.status as FinanceBudget['status'],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapGoal(row: GoalRow): FinanceSavingGoal {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    targetAmount: parseFloat(row.target_amount),
    currentAmount: parseFloat(row.current_amount),
    deadline: row.deadline,
    category: row.category as FinanceCategory,
    status: row.status as FinanceSavingGoal['status'],
    emoji: row.emoji,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function mapInsight(row: InsightRow): FinanceAIInsight {
  return {
    id: row.id,
    userId: row.user_id,
    insightType: row.insight_type as FinanceAIInsight['insightType'],
    title: row.title,
    body: row.body,
    actionable: row.actionable,
    relatedCategory: row.related_category as FinanceCategory | null,
    savingsPotential: row.savings_potential ? parseFloat(row.savings_potential) : null,
    generatedAt: row.generated_at.toISOString(),
    expiresAt: row.expires_at ? row.expires_at.toISOString() : null,
    dismissed: row.dismissed,
  };
}

function mapProfile(row: ProfileRow): FinanceProfile {
  return {
    id: row.id,
    userId: row.user_id,
    currency: row.currency,
    monthlyIncome: parseFloat(row.monthly_income),
    budgetLimit: row.budget_limit ? parseFloat(row.budget_limit) : null,
    timezone: row.timezone,
    aiInsightsEnabled: row.ai_insights_enabled,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

// ============================================
// PROFILE
// ============================================

async function getOrCreateProfile(userId: string): Promise<FinanceProfile> {
  const result = await query<ProfileRow>(
    `SELECT * FROM finance_profiles WHERE user_id = $1`,
    [userId]
  );
  if (result.rows.length > 0) return mapProfile(result.rows[0]);

  const created = await query<ProfileRow>(
    `INSERT INTO finance_profiles (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING
     RETURNING *`,
    [userId]
  );
  if (created.rows.length > 0) return mapProfile(created.rows[0]);

  // Race condition fallback
  const retry = await query<ProfileRow>(
    `SELECT * FROM finance_profiles WHERE user_id = $1`,
    [userId]
  );
  return mapProfile(retry.rows[0]);
}

async function updateProfile(
  userId: string,
  input: Partial<{ currency: string; monthlyIncome: number; budgetLimit: number | null; aiInsightsEnabled: boolean }>
): Promise<FinanceProfile> {
  await getOrCreateProfile(userId);

  const sets: string[] = [];
  const params: (string | number | boolean | null)[] = [userId];
  let idx = 2;

  if (input.currency !== undefined) { sets.push(`currency = $${idx++}`); params.push(input.currency); }
  if (input.monthlyIncome !== undefined) { sets.push(`monthly_income = $${idx++}`); params.push(input.monthlyIncome); }
  if (input.budgetLimit !== undefined) { sets.push(`budget_limit = $${idx++}`); params.push(input.budgetLimit); }
  if (input.aiInsightsEnabled !== undefined) { sets.push(`ai_insights_enabled = $${idx++}`); params.push(input.aiInsightsEnabled); }

  if (sets.length === 0) return getOrCreateProfile(userId);

  sets.push(`updated_at = CURRENT_TIMESTAMP`);
  const result = await query<ProfileRow>(
    `UPDATE finance_profiles SET ${sets.join(', ')} WHERE user_id = $1 RETURNING *`,
    params
  );
  return mapProfile(result.rows[0]);
}

// ============================================
// TRANSACTIONS
// ============================================

async function createTransaction(
  userId: string,
  input: {
    amount: number;
    transactionType: string;
    category: string;
    title: string;
    description?: string;
    transactionDate?: string;
    isRecurring?: boolean;
    recurringInterval?: string;
    tags?: string[];
  }
): Promise<FinanceTransaction> {
  const result = await query<TransactionRow>(
    `INSERT INTO finance_transactions
     (user_id, amount, transaction_type, category, title, description,
      transaction_date, is_recurring, recurring_interval, tags)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      userId,
      input.amount,
      input.transactionType,
      input.category,
      input.title,
      input.description || null,
      input.transactionDate || new Date().toISOString().split('T')[0],
      input.isRecurring || false,
      input.recurringInterval || null,
      input.tags || [],
    ]
  );

  const tx = mapTransaction(result.rows[0]);

  // Update budget spend if this is an expense
  if (input.transactionType === 'expense') {
    const month = tx.transactionDate.substring(0, 7);
    await query(
      `UPDATE finance_budgets
       SET current_spend = current_spend + $1,
           status = CASE
             WHEN current_spend + $1 >= monthly_limit THEN 'exceeded'::budget_status
             ELSE status
           END,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2 AND category = $3 AND month = $4`,
      [input.amount, userId, input.category, month]
    );
  }

  logger.info('[FinanceService] Transaction created', {
    userId: userId.slice(0, 8),
    type: input.transactionType,
    category: input.category,
  });

  return tx;
}

async function getTransactions(
  userId: string,
  options: {
    category?: string;
    transactionType?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}
): Promise<{ transactions: FinanceTransaction[]; total: number; page: number; limit: number }> {
  const page = options.page || 1;
  const limit = Math.min(options.limit || 50, 100);
  const offset = (page - 1) * limit;

  let where = `WHERE user_id = $1 AND is_deleted = false`;
  const params: (string | number)[] = [userId];
  let idx = 2;

  if (options.category) {
    where += ` AND category = $${idx++}`;
    params.push(options.category);
  }
  if (options.transactionType) {
    where += ` AND transaction_type = $${idx++}`;
    params.push(options.transactionType);
  }
  if (options.startDate) {
    where += ` AND transaction_date >= $${idx++}`;
    params.push(options.startDate);
  }
  if (options.endDate) {
    where += ` AND transaction_date <= $${idx++}`;
    params.push(options.endDate);
  }
  if (options.search) {
    where += ` AND (title ILIKE $${idx} OR description ILIKE $${idx})`;
    params.push(`%${options.search}%`);
    idx++;
  }

  const countParams = [...params];
  params.push(limit, offset);

  const [txResult, countResult] = await Promise.all([
    query<TransactionRow>(
      `SELECT * FROM finance_transactions ${where} ORDER BY transaction_date DESC, created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    ),
    query<{ total: string }>(
      `SELECT COUNT(*) as total FROM finance_transactions ${where}`,
      countParams
    ),
  ]);

  return {
    transactions: txResult.rows.map(mapTransaction),
    total: parseInt(countResult.rows[0].total, 10),
    page,
    limit,
  };
}

async function getTransaction(userId: string, id: string): Promise<FinanceTransaction | null> {
  const result = await query<TransactionRow>(
    `SELECT * FROM finance_transactions WHERE id = $1 AND user_id = $2 AND is_deleted = false`,
    [id, userId]
  );
  return result.rows.length > 0 ? mapTransaction(result.rows[0]) : null;
}

async function updateTransaction(
  userId: string,
  id: string,
  input: Record<string, unknown>
): Promise<FinanceTransaction> {
  const existing = await getTransaction(userId, id);
  if (!existing) throw ApiError.notFound('Transaction not found');

  const sets: string[] = [];
  const params: (string | number | boolean | null)[] = [id, userId];
  let idx = 3;

  const fieldMap: Record<string, string> = {
    amount: 'amount',
    transactionType: 'transaction_type',
    category: 'category',
    title: 'title',
    description: 'description',
    transactionDate: 'transaction_date',
    isRecurring: 'is_recurring',
    recurringInterval: 'recurring_interval',
    tags: 'tags',
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    if (input[key] !== undefined) {
      sets.push(`${col} = $${idx++}`);
      params.push(input[key] as string | number | boolean | null);
    }
  }

  if (sets.length === 0) return existing;
  sets.push(`updated_at = CURRENT_TIMESTAMP`);

  const result = await query<TransactionRow>(
    `UPDATE finance_transactions SET ${sets.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *`,
    params
  );
  return mapTransaction(result.rows[0]);
}

async function deleteTransaction(userId: string, id: string): Promise<void> {
  const existing = await getTransaction(userId, id);
  if (!existing) throw ApiError.notFound('Transaction not found');

  await query(
    `UPDATE finance_transactions SET is_deleted = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );

  // Reverse budget impact for expenses
  if (existing.transactionType === 'expense') {
    const month = existing.transactionDate.substring(0, 7);
    await query(
      `UPDATE finance_budgets
       SET current_spend = GREATEST(current_spend - $1, 0),
           status = CASE
             WHEN GREATEST(current_spend - $1, 0) < monthly_limit THEN 'active'::budget_status
             ELSE status
           END,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2 AND category = $3 AND month = $4`,
      [existing.amount, userId, existing.category, month]
    );
  }
}

async function getTransactionSummary(
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<TransactionSummary> {
  const now = new Date();
  const start = startDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const end = endDate || now.toISOString().split('T')[0];

  const result = await query<{
    total_income: string;
    total_expense: string;
    tx_count: string;
  }>(
    `SELECT
       COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END), 0) as total_income,
       COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END), 0) as total_expense,
       COUNT(*) as tx_count
     FROM finance_transactions
     WHERE user_id = $1 AND is_deleted = false
       AND transaction_date >= $2 AND transaction_date <= $3`,
    [userId, start, end]
  );

  const row = result.rows[0];
  const income = parseFloat(row.total_income);
  const expense = parseFloat(row.total_expense);

  return {
    totalIncome: income,
    totalExpense: expense,
    netCashFlow: income - expense,
    transactionCount: parseInt(row.tx_count, 10),
    period: { start, end },
  };
}

// ============================================
// ANALYTICS
// ============================================

async function getMonthlySummary(userId: string, month?: string): Promise<MonthlySummary> {
  const now = new Date();
  const currentMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [year, mon] = currentMonth.split('-').map(Number);
  const prevMonth = mon === 1
    ? `${year - 1}-12`
    : `${year}-${String(mon - 1).padStart(2, '0')}`;

  const [currentResult, prevResult, breakdown] = await Promise.all([
    query<{ total_income: string; total_expense: string }>(
      `SELECT
         COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END), 0) as total_income,
         COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END), 0) as total_expense
       FROM finance_transactions
       WHERE user_id = $1 AND is_deleted = false AND to_char(transaction_date, 'YYYY-MM') = $2`,
      [userId, currentMonth]
    ),
    query<{ total_expense: string }>(
      `SELECT COALESCE(SUM(amount), 0) as total_expense
       FROM finance_transactions
       WHERE user_id = $1 AND is_deleted = false AND transaction_type = 'expense'
         AND to_char(transaction_date, 'YYYY-MM') = $2`,
      [userId, prevMonth]
    ),
    getCategoryBreakdown(userId, currentMonth),
  ]);

  const income = parseFloat(currentResult.rows[0].total_income);
  const expense = parseFloat(currentResult.rows[0].total_expense);
  const prevExpense = parseFloat(prevResult.rows[0].total_expense);
  const momDelta = prevExpense > 0 ? ((expense - prevExpense) / prevExpense) * 100 : 0;

  return {
    month: currentMonth,
    totalIncome: income,
    totalExpense: expense,
    netSavings: income - expense,
    momDelta: Math.round(momDelta * 10) / 10,
    categoryBreakdown: breakdown,
  };
}

async function getCategoryBreakdown(userId: string, month?: string): Promise<CategoryBreakdownItem[]> {
  const now = new Date();
  const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const result = await query<{
    category: string;
    total: string;
    count: string;
  }>(
    `SELECT category, SUM(amount) as total, COUNT(*) as count
     FROM finance_transactions
     WHERE user_id = $1 AND is_deleted = false AND transaction_type = 'expense'
       AND to_char(transaction_date, 'YYYY-MM') = $2
     GROUP BY category
     ORDER BY total DESC`,
    [userId, targetMonth]
  );

  const totalExpense = result.rows.reduce((sum, r) => sum + parseFloat(r.total), 0);

  return result.rows.map(row => ({
    category: row.category as FinanceCategory,
    amount: parseFloat(row.total),
    percentage: totalExpense > 0 ? Math.round((parseFloat(row.total) / totalExpense) * 1000) / 10 : 0,
    transactionCount: parseInt(row.count, 10),
  }));
}

async function getSpendingTrends(userId: string, months: number = 6): Promise<SpendingTrend[]> {
  const result = await query<{
    month: string;
    income: string;
    expense: string;
  }>(
    `SELECT
       to_char(transaction_date, 'YYYY-MM') as month,
       COALESCE(SUM(CASE WHEN transaction_type = 'income' THEN amount ELSE 0 END), 0) as income,
       COALESCE(SUM(CASE WHEN transaction_type = 'expense' THEN amount ELSE 0 END), 0) as expense
     FROM finance_transactions
     WHERE user_id = $1 AND is_deleted = false
       AND transaction_date >= (CURRENT_DATE - ($2 || ' months')::interval)
     GROUP BY to_char(transaction_date, 'YYYY-MM')
     ORDER BY month ASC`,
    [userId, months]
  );

  return result.rows.map(row => ({
    month: row.month,
    income: parseFloat(row.income),
    expense: parseFloat(row.expense),
    net: parseFloat(row.income) - parseFloat(row.expense),
  }));
}

async function getMonthComparison(userId: string): Promise<{
  current: MonthlySummary;
  previous: MonthlySummary;
}> {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const mon = now.getMonth() + 1;
  const prevMonth = mon === 1
    ? `${now.getFullYear() - 1}-12`
    : `${now.getFullYear()}-${String(mon - 1).padStart(2, '0')}`;

  const [current, previous] = await Promise.all([
    getMonthlySummary(userId, currentMonth),
    getMonthlySummary(userId, prevMonth),
  ]);

  return { current, previous };
}

async function getForecast(userId: string): Promise<FinanceForecast> {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - dayOfMonth;

  // Get current month spend by category
  const result = await query<{ category: string; total: string }>(
    `SELECT category, SUM(amount) as total
     FROM finance_transactions
     WHERE user_id = $1 AND is_deleted = false AND transaction_type = 'expense'
       AND to_char(transaction_date, 'YYYY-MM') = $2
     GROUP BY category`,
    [userId, currentMonth]
  );

  const currentTotal = result.rows.reduce((sum, r) => sum + parseFloat(r.total), 0);
  const dailyBurnRate = dayOfMonth > 0 ? currentTotal / dayOfMonth : 0;
  const projectedTotal = currentTotal + (dailyBurnRate * daysRemaining);

  const projectedByCategory: Record<string, number> = {};
  for (const row of result.rows) {
    const catSpend = parseFloat(row.total);
    const catDaily = dayOfMonth > 0 ? catSpend / dayOfMonth : 0;
    projectedByCategory[row.category] = Math.round((catSpend + catDaily * daysRemaining) * 100) / 100;
  }

  return {
    projectedTotal: Math.round(projectedTotal * 100) / 100,
    projectedByCategory,
    dailyBurnRate: Math.round(dailyBurnRate * 100) / 100,
    daysRemaining,
    savingsSuggestion: dailyBurnRate > 0
      ? `Reduce daily spending by $${Math.round(dailyBurnRate * 0.1 * 100) / 100} to save $${Math.round(dailyBurnRate * 0.1 * daysRemaining * 100) / 100} this month.`
      : 'Start tracking your expenses to get savings suggestions.',
  };
}

// ============================================
// BUDGETS
// ============================================

async function getBudgets(userId: string, month?: string): Promise<FinanceBudget[]> {
  const targetMonth = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const result = await query<BudgetRow>(
    `SELECT * FROM finance_budgets WHERE user_id = $1 AND month = $2 ORDER BY category`,
    [userId, targetMonth]
  );
  return result.rows.map(mapBudget);
}

async function createBudget(
  userId: string,
  input: { category: string; monthlyLimit: number; alertThreshold?: number; month: string }
): Promise<FinanceBudget> {
  // Calculate current spend for this category/month
  const spendResult = await query<{ total: string }>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM finance_transactions
     WHERE user_id = $1 AND is_deleted = false AND transaction_type = 'expense'
       AND category = $2 AND to_char(transaction_date, 'YYYY-MM') = $3`,
    [userId, input.category, input.month]
  );
  const currentSpend = parseFloat(spendResult.rows[0].total);
  const status = currentSpend >= input.monthlyLimit ? 'exceeded' : 'active';

  const result = await query<BudgetRow>(
    `INSERT INTO finance_budgets (user_id, category, monthly_limit, current_spend, alert_threshold, month, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, category, month) DO UPDATE SET
       monthly_limit = EXCLUDED.monthly_limit,
       alert_threshold = EXCLUDED.alert_threshold,
       current_spend = EXCLUDED.current_spend,
       status = EXCLUDED.status,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [userId, input.category, input.monthlyLimit, currentSpend, input.alertThreshold || 80, input.month, status]
  );

  return mapBudget(result.rows[0]);
}

async function updateBudget(
  userId: string,
  id: string,
  input: { monthlyLimit?: number; alertThreshold?: number }
): Promise<FinanceBudget> {
  const sets: string[] = [];
  const params: (string | number)[] = [id, userId];
  let idx = 3;

  if (input.monthlyLimit !== undefined) { sets.push(`monthly_limit = $${idx++}`); params.push(input.monthlyLimit); }
  if (input.alertThreshold !== undefined) { sets.push(`alert_threshold = $${idx++}`); params.push(input.alertThreshold); }

  if (sets.length === 0) throw ApiError.badRequest('No fields to update');
  sets.push(`updated_at = CURRENT_TIMESTAMP`);

  const result = await query<BudgetRow>(
    `UPDATE finance_budgets SET ${sets.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *`,
    params
  );

  if (result.rows.length === 0) throw ApiError.notFound('Budget not found');
  return mapBudget(result.rows[0]);
}

async function deleteBudget(userId: string, id: string): Promise<void> {
  const result = await query(
    `DELETE FROM finance_budgets WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  if (result.rowCount === 0) throw ApiError.notFound('Budget not found');
}

async function getBudgetAlerts(userId: string): Promise<BudgetAlert[]> {
  const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const result = await query<BudgetRow>(
    `SELECT * FROM finance_budgets
     WHERE user_id = $1 AND month = $2
       AND (current_spend * 100.0 / NULLIF(monthly_limit, 0)) >= alert_threshold`,
    [userId, month]
  );

  return result.rows.map(row => {
    const limit = parseFloat(row.monthly_limit);
    const spend = parseFloat(row.current_spend);
    return {
      budgetId: row.id,
      category: row.category as FinanceCategory,
      monthlyLimit: limit,
      currentSpend: spend,
      percentUsed: limit > 0 ? Math.round((spend / limit) * 1000) / 10 : 0,
      status: row.status as FinanceBudget['status'],
    };
  });
}

// ============================================
// SAVING GOALS
// ============================================

async function getGoals(userId: string): Promise<FinanceSavingGoal[]> {
  const result = await query<GoalRow>(
    `SELECT * FROM finance_saving_goals WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows.map(mapGoal);
}

async function createGoal(
  userId: string,
  input: { title: string; targetAmount: number; deadline?: string; category?: string; emoji?: string }
): Promise<FinanceSavingGoal> {
  const result = await query<GoalRow>(
    `INSERT INTO finance_saving_goals (user_id, title, target_amount, deadline, category, emoji)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, input.title, input.targetAmount, input.deadline || null, input.category || 'savings', input.emoji || '🎯']
  );
  return mapGoal(result.rows[0]);
}

async function updateGoal(
  userId: string,
  id: string,
  input: Record<string, unknown>
): Promise<FinanceSavingGoal> {
  const sets: string[] = [];
  const params: (string | number | boolean | null)[] = [id, userId];
  let idx = 3;

  const fieldMap: Record<string, string> = {
    title: 'title',
    targetAmount: 'target_amount',
    deadline: 'deadline',
    status: 'status',
    emoji: 'emoji',
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    if (input[key] !== undefined) {
      sets.push(`${col} = $${idx++}`);
      params.push(input[key] as string | number | boolean | null);
    }
  }

  if (sets.length === 0) throw ApiError.badRequest('No fields to update');
  sets.push(`updated_at = CURRENT_TIMESTAMP`);

  const result = await query<GoalRow>(
    `UPDATE finance_saving_goals SET ${sets.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *`,
    params
  );

  if (result.rows.length === 0) throw ApiError.notFound('Goal not found');
  return mapGoal(result.rows[0]);
}

async function deleteGoal(userId: string, id: string): Promise<void> {
  const result = await query(
    `DELETE FROM finance_saving_goals WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  if (result.rowCount === 0) throw ApiError.notFound('Goal not found');
}

async function contributeToGoal(userId: string, id: string, amount: number): Promise<FinanceSavingGoal> {
  const result = await query<GoalRow>(
    `UPDATE finance_saving_goals
     SET current_amount = current_amount + $1,
         status = CASE
           WHEN current_amount + $1 >= target_amount THEN 'achieved'::saving_goal_status
           ELSE status
         END,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND user_id = $3
     RETURNING *`,
    [amount, id, userId]
  );

  if (result.rows.length === 0) throw ApiError.notFound('Goal not found');
  return mapGoal(result.rows[0]);
}

async function getGoalProjection(userId: string, id: string): Promise<GoalProjection> {
  const goal = await query<GoalRow>(
    `SELECT * FROM finance_saving_goals WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );

  if (goal.rows.length === 0) throw ApiError.notFound('Goal not found');
  const g = mapGoal(goal.rows[0]);

  const remaining = g.targetAmount - g.currentAmount;
  let projectedDate: string | null = null;
  let monthlyNeeded = 0;

  if (g.deadline) {
    const deadlineDate = new Date(g.deadline);
    const now = new Date();
    const monthsLeft = Math.max(
      (deadlineDate.getFullYear() - now.getFullYear()) * 12 + (deadlineDate.getMonth() - now.getMonth()),
      1
    );
    monthlyNeeded = Math.round((remaining / monthsLeft) * 100) / 100;
    projectedDate = remaining <= 0 ? now.toISOString().split('T')[0] : g.deadline;
  }

  return {
    goalId: g.id,
    title: g.title,
    targetAmount: g.targetAmount,
    currentAmount: g.currentAmount,
    remaining: Math.max(remaining, 0),
    projectedCompletionDate: projectedDate,
    monthlyContributionNeeded: monthlyNeeded,
  };
}

// ============================================
// AI INSIGHTS
// ============================================

async function getActiveInsights(userId: string, limit: number = 5): Promise<FinanceAIInsight[]> {
  const result = await query<InsightRow>(
    `SELECT * FROM finance_ai_insights
     WHERE user_id = $1 AND dismissed = false
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY generated_at DESC LIMIT $2`,
    [userId, limit]
  );
  return result.rows.map(mapInsight);
}

async function dismissInsight(userId: string, id: string): Promise<void> {
  const result = await query(
    `UPDATE finance_ai_insights SET dismissed = true WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  if (result.rowCount === 0) throw ApiError.notFound('Insight not found');
}

// ============================================
// EXPORT
// ============================================

export const financeService = {
  // Profile
  getOrCreateProfile,
  updateProfile,
  // Transactions
  createTransaction,
  getTransactions,
  getTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactionSummary,
  // Analytics
  getMonthlySummary,
  getCategoryBreakdown,
  getSpendingTrends,
  getMonthComparison,
  getForecast,
  // Budgets
  getBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
  getBudgetAlerts,
  // Goals
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  contributeToGoal,
  getGoalProjection,
  // AI Insights
  getActiveInsights,
  dismissInsight,
};
