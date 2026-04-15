"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  PieChart,
  Target,
  Wallet,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  X,
  ChevronRight,
  BarChart3,
  AlertTriangle,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import type { TransactionSummary, MonthlySummary, CategoryBreakdownItem, SpendingTrend, FinanceTransaction, FinanceBudget, FinanceSavingGoal, FinanceAIInsight, BudgetAlert, FinanceCategory, CreateTransactionInput } from "@shared/types/domain/finance";
import { FINANCE_CATEGORY_ICONS, FINANCE_CATEGORY_LABELS } from "@shared/types/domain/finance";

// ============================================
// ANIMATED COUNTER
// ============================================

function AnimatedCounter({ value, prefix = "$", className = "" }: {
  value: number;
  prefix?: string;
  className?: string;
}) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const duration = 800;
    const start = displayed;
    const diff = value - start;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(start + diff * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [value]);

  return (
    <span className={className}>
      {prefix}{displayed.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}

// ============================================
// BUDGET RING
// ============================================

function BudgetRing({ budget }: { budget: FinanceBudget }) {
  const percent = budget.monthlyLimit > 0
    ? Math.min((budget.currentSpend / budget.monthlyLimit) * 100, 100)
    : 0;
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  const color = percent >= 90 ? "#f43f5e" : percent >= 70 ? "#f59e0b" : "#059669";
  const icon = FINANCE_CATEGORY_ICONS[budget.category as FinanceCategory] || "📌";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-2"
    >
      <div className="relative w-20 h-20">
        <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={radius} fill="none" stroke="#1e293b" strokeWidth="6" />
          <motion.circle
            cx="40" cy="40" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-lg">
          {icon}
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs text-slate-400 truncate max-w-[80px]">
          {FINANCE_CATEGORY_LABELS[budget.category as FinanceCategory] || budget.category}
        </p>
        <p className="text-xs font-mono" style={{ color }}>{Math.round(percent)}%</p>
      </div>
    </motion.div>
  );
}

// ============================================
// QUICK ADD MODAL
// ============================================

function QuickAddModal({ onClose, onSubmit }: {
  onClose: () => void;
  onSubmit: (input: CreateTransactionInput) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<FinanceCategory>("other");
  const [txType, setTxType] = useState<"expense" | "income">("expense");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories: FinanceCategory[] = [
    "food", "transport", "bills", "health", "entertainment",
    "shopping", "subscriptions", "education", "salary", "freelance", "other",
  ];

  const handleSubmit = async () => {
    if (!amount || !title) return;
    setIsSubmitting(true);
    try {
      await onSubmit({
        amount: parseFloat(amount),
        transactionType: txType,
        category,
        title,
      });
      onClose();
    } catch {
      // Error handled by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="w-full max-w-md bg-[#0f172a] border border-white/10 rounded-t-3xl sm:rounded-2xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Quick Add</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Type Toggle */}
        <div className="flex gap-2 p-1 bg-white/5 rounded-xl">
          {(["expense", "income"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTxType(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                txType === t
                  ? t === "expense" ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {t === "expense" ? "Expense" : "Income"}
            </button>
          ))}
        </div>

        {/* Amount */}
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            autoFocus
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-2xl font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>

        {/* Title */}
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What was this for?"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
        </div>

        {/* Category */}
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Category</label>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                  category === cat
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-white/5 text-slate-400 border border-white/10 hover:border-white/20"
                }`}
              >
                {FINANCE_CATEGORY_ICONS[cat]} {FINANCE_CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!amount || !title || isSubmitting}
          className="w-full py-3 rounded-xl font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:from-emerald-500 hover:to-emerald-400"
        >
          {isSubmitting ? "Adding..." : "Add Transaction"}
        </button>
      </motion.div>
    </motion.div>
  );
}

// ============================================
// MAIN FINANCE TAB
// ============================================

export function FinanceTab() {
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdownItem[]>([]);
  const [trends, setTrends] = useState<SpendingTrend[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<FinanceTransaction[]>([]);
  const [budgets, setBudgets] = useState<FinanceBudget[]>([]);
  const [goals, setGoals] = useState<FinanceSavingGoal[]>([]);
  const [insights, setInsights] = useState<FinanceAIInsight[]>([]);
  const [budgetAlerts, setBudgetAlerts] = useState<BudgetAlert[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [
        summaryRes,
        monthlyRes,
        breakdownRes,
        trendsRes,
        txRes,
        budgetsRes,
        goalsRes,
        insightsRes,
        alertsRes,
      ] = await Promise.allSettled([
        api.get<TransactionSummary>("/finance/transactions/summary"),
        api.get<MonthlySummary>("/finance/analytics/monthly"),
        api.get<CategoryBreakdownItem[]>("/finance/analytics/categories"),
        api.get<SpendingTrend[]>("/finance/analytics/trends"),
        api.get<{ transactions: FinanceTransaction[] }>("/finance/transactions", { params: { limit: 5 } }),
        api.get<FinanceBudget[]>("/finance/budgets"),
        api.get<FinanceSavingGoal[]>("/finance/goals"),
        api.get<FinanceAIInsight[]>("/finance/ai/insights"),
        api.get<BudgetAlert[]>("/finance/budgets/alerts"),
      ]);

      if (summaryRes.status === "fulfilled" && summaryRes.value.data) setSummary(summaryRes.value.data);
      if (monthlyRes.status === "fulfilled" && monthlyRes.value.data) setMonthlySummary(monthlyRes.value.data);
      if (breakdownRes.status === "fulfilled" && breakdownRes.value.data) setCategoryBreakdown(breakdownRes.value.data);
      if (trendsRes.status === "fulfilled" && trendsRes.value.data) setTrends(trendsRes.value.data);
      if (txRes.status === "fulfilled" && txRes.value.data) setRecentTransactions((txRes.value.data as any).transactions || []);
      if (budgetsRes.status === "fulfilled" && budgetsRes.value.data) setBudgets(budgetsRes.value.data);
      if (goalsRes.status === "fulfilled" && goalsRes.value.data) setGoals(goalsRes.value.data);
      if (insightsRes.status === "fulfilled" && insightsRes.value.data) setInsights(insightsRes.value.data);
      if (alertsRes.status === "fulfilled" && alertsRes.value.data) setBudgetAlerts(alertsRes.value.data);
    } catch (err) {
      // Partial failures handled by allSettled
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddTransaction = async (input: CreateTransactionInput) => {
    await api.post("/finance/transactions", input);
    fetchData();
  };

  const handleDismissInsight = async (id: string) => {
    await api.post(`/finance/ai/insights/${id}/dismiss`);
    setInsights((prev) => prev.filter((i) => i.id !== id));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 rounded-2xl bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  const income = summary?.totalIncome || 0;
  const expense = summary?.totalExpense || 0;
  const net = income - expense;
  const momDelta = monthlySummary?.momDelta || 0;

  return (
    <div className="space-y-6 pb-24">
      {/* ---- SECTION 1: Hero Summary ---- */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f172a] to-[#1e293b] border border-white/10 p-6"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="relative z-10">
          <p className="text-sm text-slate-400 mb-1">Net Balance</p>
          <AnimatedCounter
            value={net}
            className={`text-3xl font-bold ${net >= 0 ? "text-emerald-400" : "text-rose-400"}`}
          />

          {/* Income / Expense Split */}
          <div className="mt-4 flex gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Income</p>
                <p className="text-sm font-semibold text-emerald-400">${income.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center">
                <ArrowDownRight className="w-4 h-4 text-rose-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Expenses</p>
                <p className="text-sm font-semibold text-rose-400">${expense.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>

          {/* MoM Delta */}
          {momDelta !== 0 && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className={`mt-3 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                momDelta > 0 ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"
              }`}
            >
              {momDelta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {Math.abs(momDelta)}% vs last month
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* ---- SECTION 2: Budget Alerts ---- */}
      {budgetAlerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-rose-500/5 border border-rose-500/20 p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <h3 className="text-sm font-semibold text-rose-400">Budget Alerts</h3>
          </div>
          <div className="space-y-2">
            {budgetAlerts.map((alert) => (
              <div key={alert.budgetId} className="flex items-center justify-between text-xs">
                <span className="text-slate-300">
                  {FINANCE_CATEGORY_ICONS[alert.category]} {FINANCE_CATEGORY_LABELS[alert.category]}
                </span>
                <span className="text-rose-400 font-mono">{alert.percentUsed}% used</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ---- SECTION 3: Category Breakdown ---- */}
      {categoryBreakdown.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl bg-white/5 border border-white/10 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-[18px] h-[18px] text-sky-400" />
            <h3 className="text-sm font-semibold text-white">Spending Breakdown</h3>
          </div>
          <div className="space-y-3">
            {categoryBreakdown.slice(0, 6).map((item, i) => (
              <motion.div
                key={item.category}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i }}
                className="flex items-center gap-3"
              >
                <span className="text-lg w-7 text-center">{FINANCE_CATEGORY_ICONS[item.category] || "📌"}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300">{FINANCE_CATEGORY_LABELS[item.category]}</span>
                    <span className="text-white font-mono">${item.amount.toFixed(2)}</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${item.percentage}%` }}
                      transition={{ duration: 0.8, delay: 0.1 * i, ease: "easeOut" }}
                      className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500"
                    />
                  </div>
                </div>
                <span className="text-xs text-slate-500 w-10 text-right">{item.percentage}%</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ---- SECTION 4: Spending Trends ---- */}
      {trends.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl bg-white/5 border border-white/10 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-[18px] h-[18px] text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Spending Trends</h3>
          </div>
          <div className="flex items-end gap-2 h-32">
            {trends.map((t, i) => {
              const maxExpense = Math.max(...trends.map((tr) => tr.expense), 1);
              const height = (t.expense / maxExpense) * 100;
              return (
                <motion.div
                  key={t.month}
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{ duration: 0.6, delay: 0.1 * i, ease: "easeOut" }}
                  className="flex-1 bg-gradient-to-t from-emerald-600/60 to-emerald-400/30 rounded-t-lg relative group cursor-pointer"
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">
                    ${t.expense.toFixed(0)}
                  </div>
                </motion.div>
              );
            })}
          </div>
          <div className="flex gap-2 mt-2">
            {trends.map((t) => (
              <div key={t.month} className="flex-1 text-center text-[10px] text-slate-500">
                {t.month.split("-")[1]}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ---- SECTION 5: Budget Rings ---- */}
      {budgets.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl bg-white/5 border border-white/10 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="w-[18px] h-[18px] text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Budget Progress</h3>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            {budgets.map((b) => (
              <BudgetRing key={b.id} budget={b} />
            ))}
          </div>
        </motion.div>
      )}

      {/* ---- SECTION 6: AI Insights ---- */}
      {insights.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-[18px] h-[18px] text-sky-400" />
            <h3 className="text-sm font-semibold text-white">AI Insights</h3>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
            {insights.map((insight, i) => (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * i, type: "spring", stiffness: 200 }}
                className="min-w-[260px] max-w-[280px] rounded-2xl bg-gradient-to-br from-sky-500/5 to-emerald-500/5 border border-sky-500/20 p-4 flex-shrink-0"
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs font-medium text-sky-400 uppercase">{insight.insightType}</span>
                  <button
                    onClick={() => handleDismissInsight(insight.id)}
                    className="p-0.5 text-slate-500 hover:text-white transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <h4 className="text-sm font-semibold text-white mb-1">{insight.title}</h4>
                <p className="text-xs text-slate-400 line-clamp-3">{insight.body}</p>
                {insight.savingsPotential && (
                  <div className="mt-2 text-xs text-emerald-400 font-medium">
                    Potential savings: ${insight.savingsPotential.toFixed(2)}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ---- SECTION 7: Saving Goals ---- */}
      {goals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="rounded-2xl bg-white/5 border border-white/10 p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-[18px] h-[18px] text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Saving Goals</h3>
          </div>
          <div className="space-y-3">
            {goals.map((goal) => {
              const percent = goal.targetAmount > 0
                ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
                : 0;
              return (
                <motion.div
                  key={goal.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3"
                >
                  <span className="text-xl">{goal.emoji}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-white font-medium">{goal.title}</span>
                      <span className="text-slate-400">
                        ${goal.currentAmount.toFixed(0)} / ${goal.targetAmount.toFixed(0)}
                      </span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percent}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className={`h-full rounded-full ${
                          goal.status === "achieved"
                            ? "bg-emerald-500"
                            : "bg-gradient-to-r from-sky-500 to-emerald-500"
                        }`}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ---- SECTION 8: Recent Transactions ---- */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-2xl bg-white/5 border border-white/10 p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-[18px] h-[18px] text-slate-400" />
            <h3 className="text-sm font-semibold text-white">Recent Transactions</h3>
          </div>
          <button className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors">
            View All <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            No transactions yet. Add your first one!
          </div>
        ) : (
          <div className="space-y-2">
            {recentTransactions.map((tx, i) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
                className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-white/5 transition-colors"
              >
                <span className="text-lg w-7 text-center">
                  {FINANCE_CATEGORY_ICONS[tx.category] || "📌"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{tx.title}</p>
                  <p className="text-xs text-slate-500">{tx.transactionDate}</p>
                </div>
                <span className={`text-sm font-mono font-medium ${
                  tx.transactionType === "income" ? "text-emerald-400" : "text-rose-400"
                }`}>
                  {tx.transactionType === "income" ? "+" : "-"}${tx.amount.toFixed(2)}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* ---- FAB: Quick Add ---- */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, delay: 0.5 }}
        onClick={() => setShowQuickAdd(true)}
        className="fixed bottom-24 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-500/25 flex items-center justify-center hover:from-emerald-500 hover:to-emerald-400 transition-all active:scale-95"
      >
        <Plus className="w-6 h-6" />
      </motion.button>

      {/* ---- Quick Add Modal ---- */}
      <AnimatePresence>
        {showQuickAdd && (
          <QuickAddModal onClose={() => setShowQuickAdd(false)} onSubmit={handleAddTransaction} />
        )}
      </AnimatePresence>
    </div>
  );
}
