"use client";

import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Search,
  Plus,
  X,
  Receipt,
  ChevronDown,
  Check,
  Pencil,
  Trash2,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { AnimatedIcon } from "@/components/ui/animated-icon";
import type { FinanceTransaction, FinanceCategory, FinanceTransactionType, CreateTransactionInput } from "@shared/types/domain/finance";
import { FINANCE_CATEGORY_ICONS, FINANCE_CATEGORY_LABELS } from "@shared/types/domain/finance";
import {
  formatCurrency,
  fadeSlideUp,
  staggerContainer,
  spring,
} from "../lib/motion";
import { TransactionVolume } from "./charts/TransactionVolume";
import { MiniCategoryRing } from "./charts/MiniCategoryRing";

// ============================================
// VARIANTS
// ============================================

const rowExpand: Variants = {
  collapsed: { height: 0, opacity: 0 },
  expanded: { height: "auto", opacity: 1, transition: spring.soft },
};

const sheetBackdrop: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const sheetPanel: Variants = {
  hidden: { y: "100%", opacity: 0 },
  visible: { y: 0, opacity: 1, transition: spring.snappy },
  exit: { y: "100%", opacity: 0, transition: { duration: 0.25 } },
};

const stepSlide: Variants = {
  enter: { x: 60, opacity: 0 },
  center: { x: 0, opacity: 1, transition: spring.soft },
  exit: { x: -60, opacity: 0, transition: { duration: 0.2 } },
};

const successPop: Variants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { type: "spring", stiffness: 500, damping: 15 },
  },
};

// ============================================
// TYPES
// ============================================

type DateRange = "today" | "week" | "month" | "all";
type TypeFilter = "all" | "income" | "expense";

interface DateGroup {
  label: string;
  totalSpent: number;
  transactions: FinanceTransaction[];
}

interface TransactionsSectionProps {
  transactions: FinanceTransaction[];
  total: number;
  onRefresh: () => void;
}

// ============================================
// HELPERS
// ============================================

function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Parse YYYY-MM-DD as LOCAL date (not UTC).
 * new Date("2026-04-02") creates UTC midnight which shifts day in non-UTC timezones.
 * This splits the string to avoid timezone issues.
 */
function parseLocalDate(dateStr: string): Date {
  // Handle both "2026-04-02" and "2026-04-02T..." formats
  const parts = dateStr.split("T")[0].split("-");
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
}

function isToday(dateStr: string): boolean {
  const today = new Date();
  const d = parseLocalDate(dateStr);
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

function isThisWeek(dateStr: string): boolean {
  const now = new Date();
  const d = parseLocalDate(dateStr);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  return d >= weekStart;
}

function isThisMonth(dateStr: string): boolean {
  const now = new Date();
  const d = parseLocalDate(dateStr);
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  );
}

function formatDateGroupLabel(dateStr: string): string {
  if (isToday(dateStr)) return "Today";
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function groupByDate(txs: FinanceTransaction[]): DateGroup[] {
  const map = new Map<string, FinanceTransaction[]>();
  for (const tx of txs) {
    const key = tx.transactionDate;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(tx);
  }

  const sorted = [...map.entries()].sort(
    ([a], [b]) => new Date(b).getTime() - new Date(a).getTime()
  );

  return sorted.map(([date, items]) => ({
    label: formatDateGroupLabel(date),
    totalSpent: items
      .filter((t) => t.transactionType === "expense")
      .reduce((sum, t) => sum + t.amount, 0),
    transactions: items,
  }));
}

// ============================================
// MAIN COMPONENT
// ============================================

export function TransactionsSection({
  transactions,
  total,
  onRefresh,
}: TransactionsSectionProps) {
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [categoryFilter, setCategoryFilter] = useState<FinanceCategory | null>(
    null
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ title: string; amount: string; category: FinanceCategory; date: string }>({ title: "", amount: "", category: "other", date: "" });
  const [detailTx, setDetailTx] = useState<FinanceTransaction | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 300);

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (
        debouncedSearch &&
        !tx.title.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
        return false;
      if (typeFilter !== "all" && tx.transactionType !== typeFilter)
        return false;
      if (categoryFilter && tx.category !== categoryFilter) return false;
      if (dateRange === "today" && !isToday(tx.transactionDate)) return false;
      if (dateRange === "week" && !isThisWeek(tx.transactionDate)) return false;
      if (dateRange === "month" && !isThisMonth(tx.transactionDate))
        return false;
      return true;
    });
  }, [transactions, debouncedSearch, typeFilter, dateRange, categoryFilter]);

  const dateGroups = useMemo(() => groupByDate(filtered), [filtered]);

  const handleAddTransaction = useCallback(
    async (input: CreateTransactionInput) => {
      await api.post("/finance/transactions", input);
      onRefresh();
      setShowQuickAdd(false);
    },
    [onRefresh]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      await api.delete(`/finance/transactions/${id}`);
      onRefresh();
      setExpandedId(null);
      setDeleteConfirmId(null);
    },
    [onRefresh]
  );

  const handleStartEdit = useCallback((tx: FinanceTransaction) => {
    setEditingId(tx.id);
    setEditData({ title: tx.title, amount: String(tx.amount), category: tx.category, date: tx.transactionDate });
  }, []);

  const handleSaveEdit = useCallback(async (id: string) => {
    if (!editData.title || !editData.amount) return;
    await api.put(`/finance/transactions/${id}`, {
      title: editData.title,
      amount: parseFloat(editData.amount),
      category: editData.category,
      transactionDate: editData.date,
    });
    setEditingId(null);
    onRefresh();
  }, [editData, onRefresh]);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
  }, []);

  const hasActiveFilters =
    typeFilter !== "all" ||
    dateRange !== "all" ||
    categoryFilter !== null;

  // Compute quick stats
  const totalIncome = useMemo(() => filtered.filter(t => t.transactionType === "income").reduce((s, t) => s + t.amount, 0), [filtered]);
  const totalExpense = useMemo(() => filtered.filter(t => t.transactionType === "expense").reduce((s, t) => s + t.amount, 0), [filtered]);

  return (
    <div className="space-y-4">
      {/* Header + Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white font-[family-name:var(--font-syne)]">Transactions</h2>
          <p className="text-xs text-slate-500 mt-0.5">{filtered.length} of {total} transactions</p>
        </div>
        <button
          onClick={() => setShowQuickAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-colors min-h-[44px]"
        >
          <Plus className="w-4 h-4" /> Add New
        </button>
      </div>

      {/* Quick Stats + Charts — Premium Glass Layout */}
      {transactions.length > 0 && (
        <div className="space-y-3">
          {/* Stats Cards with glowing accents */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 gap-3"
          >
            {/* Income */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/[0.08] via-emerald-500/[0.03] to-transparent border border-emerald-500/10 p-4 group hover:border-emerald-500/20 transition-all duration-300">
              <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-emerald-500/[0.08] blur-2xl group-hover:bg-emerald-500/[0.12] transition-colors" />
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
              <div className="relative">
                <div className="flex items-center gap-1.5 mb-2">
                  <AnimatedIcon icon="trending" size={20} trigger="loop" delay={3000} colors={{ primary: "#34d399", secondary: "#10b981" }} />
                  <p className="text-[10px] text-emerald-400/60 uppercase tracking-wider font-medium">Income</p>
                </div>
                <p className="text-lg sm:text-xl font-bold font-mono text-emerald-400">{formatCurrency(totalIncome)}</p>
              </div>
            </div>

            {/* Expenses */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500/[0.08] via-rose-500/[0.03] to-transparent border border-rose-500/10 p-4 group hover:border-rose-500/20 transition-all duration-300">
              <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-rose-500/[0.08] blur-2xl group-hover:bg-rose-500/[0.12] transition-colors" />
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-rose-500/30 to-transparent" />
              <div className="relative">
                <div className="flex items-center gap-1.5 mb-2">
                  <AnimatedIcon icon="receipt" size={20} trigger="loop" delay={4000} colors={{ primary: "#f43f5e", secondary: "#e11d48" }} />
                  <p className="text-[10px] text-rose-400/60 uppercase tracking-wider font-medium">Expenses</p>
                </div>
                <p className="text-lg sm:text-xl font-bold font-mono text-rose-400">{formatCurrency(totalExpense)}</p>
              </div>
            </div>

            {/* Net */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500/[0.08] via-violet-500/[0.03] to-transparent border border-sky-500/10 p-4 group hover:border-sky-500/20 transition-all duration-300">
              <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-sky-500/[0.08] blur-2xl group-hover:bg-sky-500/[0.12] transition-colors" />
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-sky-500/30 to-transparent" />
              <div className="relative">
                <div className="flex items-center gap-1.5 mb-2">
                  <AnimatedIcon icon="wallet" size={20} trigger="loop" delay={5000} colors={{ primary: "#38bdf8", secondary: "#8b5cf6" }} />
                  <p className="text-[10px] text-sky-400/60 uppercase tracking-wider font-medium">Net</p>
                </div>
                <p className={`text-lg sm:text-xl font-bold font-mono ${totalIncome - totalExpense >= 0 ? "text-sky-400" : "text-rose-400"}`}>
                  {formatCurrency(totalIncome - totalExpense)}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Transaction Volume + Category Ring */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-3">
              <TransactionVolume transactions={filtered} />
            </div>
            <div className="lg:col-span-2 rounded-2xl bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.06] p-4 flex items-center justify-center">
              <MiniCategoryRing transactions={filtered} />
            </div>
          </div>
        </div>
      )}

      {/* Smart Search Bar */}
      <div className="relative group">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search transactions..."
          className="w-full bg-white/[0.03] backdrop-blur-xl border border-white/[0.07] rounded-2xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/40 focus:shadow-[0_0_20px_rgba(16,185,129,0.08)] transition-all duration-300"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Filter Chips */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Category Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all min-h-[44px] ${
              categoryFilter
                ? "bg-sky-500/15 text-sky-400 border border-sky-500/30"
                : "bg-white/[0.03] text-slate-400 border border-white/[0.07] hover:border-white/[0.15]"
            }`}
          >
            {categoryFilter
              ? `${FINANCE_CATEGORY_ICONS[categoryFilter]} ${FINANCE_CATEGORY_LABELS[categoryFilter]}`
              : "Category"}
            <ChevronDown className="w-3 h-3" />
          </button>
          <AnimatePresence>
            {showCategoryDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full left-0 mt-2 z-30 w-56 bg-[#0c1322] border border-white/[0.07] rounded-2xl p-2 shadow-2xl backdrop-blur-xl"
              >
                <button
                  onClick={() => {
                    setCategoryFilter(null);
                    setShowCategoryDropdown(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs text-slate-400 hover:bg-white/[0.05] hover:text-white transition-colors"
                >
                  All Categories
                </button>
                {(Object.keys(FINANCE_CATEGORY_LABELS) as FinanceCategory[]).map(
                  (cat) => (
                    <button
                      key={cat}
                      onClick={() => {
                        setCategoryFilter(cat);
                        setShowCategoryDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors ${
                        categoryFilter === cat
                          ? "bg-sky-500/15 text-sky-400"
                          : "text-slate-400 hover:bg-white/[0.05] hover:text-white"
                      }`}
                    >
                      {FINANCE_CATEGORY_ICONS[cat]}{" "}
                      {FINANCE_CATEGORY_LABELS[cat]}
                    </button>
                  )
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Type Toggle */}
        <div className="flex bg-white/[0.03] border border-white/[0.07] rounded-xl overflow-hidden">
          {(["all", "income", "expense"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-2 text-xs font-medium transition-all min-h-[44px] ${
                typeFilter === t
                  ? t === "income"
                    ? "bg-emerald-500/15 text-emerald-400"
                    : t === "expense"
                      ? "bg-rose-500/15 text-rose-400"
                      : "bg-white/[0.07] text-white"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {t === "all" ? "All" : t === "income" ? "Income" : "Expense"}
            </button>
          ))}
        </div>

        {/* Date Range Pills */}
        {(["today", "week", "month", "all"] as const).map((range) => (
          <button
            key={range}
            onClick={() => setDateRange(range)}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition-all min-h-[44px] ${
              dateRange === range
                ? "bg-white/[0.07] text-white border border-white/[0.15]"
                : "text-slate-500 hover:text-slate-300 border border-transparent"
            }`}
          >
            {range === "today"
              ? "Today"
              : range === "week"
                ? "Week"
                : range === "month"
                  ? "Month"
                  : "All"}
          </button>
        ))}

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={() => {
              setTypeFilter("all");
              setDateRange("all");
              setCategoryFilter(null);
            }}
            className="px-3 py-2 rounded-xl text-xs text-rose-400 hover:bg-rose-500/10 transition-colors min-h-[44px]"
          >
            Clear
          </button>
        )}
      </div>

      {/* Transaction List */}
      {dateGroups.length === 0 ? (
        <motion.div
          variants={fadeSlideUp}
          initial="hidden"
          animate="show"
          className="rounded-2xl bg-white/[0.03] border border-white/[0.07] py-16 flex flex-col items-center justify-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-white/[0.05] flex items-center justify-center mb-4">
            <Receipt className="w-7 h-7 text-slate-600" />
          </div>
          <p className="text-sm text-slate-400 font-medium">
            {debouncedSearch
              ? "No transactions match your search"
              : "No transactions yet"}
          </p>
          <p className="text-xs text-slate-600 mt-1 mb-4">
            {debouncedSearch
              ? "Try adjusting your filters"
              : "Track your first income or expense"}
          </p>
          {!debouncedSearch && (
            <button
              onClick={() => setShowQuickAdd(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-colors min-h-[44px]"
            >
              <Plus className="w-4 h-4" /> Add your first
            </button>
          )}
        </motion.div>
      ) : (
        <motion.div
          key={`${debouncedSearch}-${typeFilter}-${dateRange}-${categoryFilter || "all"}`}
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="space-y-3"
        >
          {dateGroups.map((group) => (
            <div key={group.label}>
              {/* Sticky Date Header */}
              <div className="sticky top-0 z-10 backdrop-blur-xl bg-[#030712]/80 py-2 px-1 -mx-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">
                    {group.label}
                  </span>
                  {group.totalSpent > 0 && (
                    <span className="text-xs font-mono text-rose-400/70">
                      {formatCurrency(group.totalSpent)} spent
                    </span>
                  )}
                </div>
              </div>

              {/* Transactions in Group */}
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] divide-y divide-white/[0.04] overflow-hidden">
                {group.transactions.map((tx) => {
                  const isExpanded = expandedId === tx.id;
                  const isIncome = tx.transactionType === "income";

                  return (
                    <motion.div
                      key={tx.id}
                      variants={fadeSlideUp}
                      layout
                      className="group"
                    >
                      {/* Main Row */}
                      <button
                        onClick={() => setDetailTx(tx)}
                        className="w-full flex items-center gap-3 py-3.5 px-4 hover:bg-white/[0.02] transition-colors text-left min-h-[44px]"
                      >
                        <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center flex-shrink-0 text-lg">
                          {FINANCE_CATEGORY_ICONS[tx.category] || "📌"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate font-medium">
                            {tx.title}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                            <span>
                              {FINANCE_CATEGORY_LABELS[tx.category]}
                            </span>
                            {tx.isRecurring && (
                              <>
                                <span className="w-1 h-1 rounded-full bg-slate-600" />
                                <span className="text-sky-400/60">
                                  Recurring
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span
                            className={`text-sm font-mono font-semibold ${
                              isIncome ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {isIncome ? "+" : "-"}
                            {formatCurrency(tx.amount)}
                          </span>
                          {isIncome ? (
                            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500/50" />
                          ) : (
                            <ArrowDownRight className="w-3.5 h-3.5 text-rose-500/50" />
                          )}
                        </div>
                      </button>

                      {/* Expanded Details */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            variants={rowExpand}
                            initial="collapsed"
                            animate="expanded"
                            exit="collapsed"
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 pt-1 space-y-3">
                              {/* Edit Mode */}
                              {editingId === tx.id ? (
                                <motion.div
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  className="space-y-3 rounded-xl bg-white/[0.03] border border-white/[0.07] p-4"
                                >
                                  <div>
                                    <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">Title</label>
                                    <input
                                      type="text"
                                      value={editData.title}
                                      onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
                                      className="w-full bg-white/[0.05] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/40 transition-colors"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">Amount</label>
                                    <input
                                      type="number"
                                      value={editData.amount}
                                      onChange={(e) => setEditData(prev => ({ ...prev, amount: e.target.value }))}
                                      className="w-full bg-white/[0.05] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/40 transition-colors"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">Date</label>
                                    <input
                                      type="date"
                                      value={editData.date}
                                      onChange={(e) => setEditData(prev => ({ ...prev, date: e.target.value }))}
                                      className="w-full bg-white/[0.05] border border-white/[0.07] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/40 transition-colors [color-scheme:dark]"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">Category</label>
                                    <div className="flex flex-wrap gap-1.5">
                                      {(["food", "transport", "bills", "health", "entertainment", "shopping", "subscriptions", "savings", "education", "salary", "freelance", "investments", "other"] as FinanceCategory[]).map((cat) => (
                                        <button
                                          key={cat}
                                          onClick={() => setEditData(prev => ({ ...prev, category: cat }))}
                                          className={`px-2.5 py-1 rounded-lg text-[11px] transition-all ${
                                            editData.category === cat
                                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                              : "bg-white/[0.03] text-slate-500 border border-white/[0.05] hover:border-white/[0.1]"
                                          }`}
                                        >
                                          {FINANCE_CATEGORY_ICONS[cat]} {FINANCE_CATEGORY_LABELS[cat]}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 pt-1">
                                    <button
                                      onClick={handleCancelEdit}
                                      className="px-4 py-2 rounded-lg text-xs text-slate-400 bg-white/[0.03] border border-white/[0.07] hover:text-white transition-all min-h-[44px]"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={() => handleSaveEdit(tx.id)}
                                      disabled={!editData.title || !editData.amount}
                                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-40 transition-all min-h-[44px]"
                                    >
                                      <Check className="w-3.5 h-3.5" /> Save Changes
                                    </button>
                                  </div>
                                </motion.div>
                              ) : deleteConfirmId === tx.id ? (
                                /* Delete Confirmation */
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="rounded-xl bg-rose-500/[0.06] border border-rose-500/20 p-4"
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                                      <Trash2 className="w-5 h-5 text-rose-400" />
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-white">Delete this transaction?</p>
                                      <p className="text-xs text-slate-400 mt-1">
                                        &quot;{tx.title}&quot; for {formatCurrency(tx.amount)} will be permanently removed.
                                      </p>
                                      <div className="flex items-center gap-2 mt-3">
                                        <button
                                          onClick={() => setDeleteConfirmId(null)}
                                          className="px-4 py-2 rounded-lg text-xs text-slate-400 bg-white/[0.03] border border-white/[0.07] hover:text-white transition-all min-h-[44px]"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          onClick={() => handleDelete(tx.id)}
                                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 transition-all min-h-[44px]"
                                        >
                                          <Trash2 className="w-3 h-3" /> Confirm Delete
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              ) : (
                                /* Detail View */
                                <div className="rounded-xl bg-white/[0.02] border border-white/[0.05] overflow-hidden">
                                  {/* Amount Hero */}
                                  <div className={`px-4 py-3 ${isIncome ? "bg-emerald-500/[0.04]" : "bg-rose-500/[0.04]"}`}>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2.5">
                                        <div className="w-9 h-9 rounded-lg bg-white/[0.06] flex items-center justify-center text-lg">
                                          {FINANCE_CATEGORY_ICONS[tx.category] || "📌"}
                                        </div>
                                        <div>
                                          <p className="text-sm font-semibold text-white">{tx.title}</p>
                                          <p className="text-[10px] text-slate-500">{isIncome ? "Income" : "Expense"} • {FINANCE_CATEGORY_LABELS[tx.category]}</p>
                                        </div>
                                      </div>
                                      <p className={`text-lg font-bold font-mono ${isIncome ? "text-emerald-400" : "text-rose-400"}`}>
                                        {isIncome ? "+" : "-"}{formatCurrency(tx.amount)}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Details Grid */}
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-white/[0.03]">
                                    <div className="px-4 py-2.5 bg-[#0a101f]">
                                      <p className="text-[9px] text-slate-600 uppercase tracking-wider">Date</p>
                                      <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-1">
                                        <Calendar className="w-3 h-3 text-slate-500" />
                                        {parseLocalDate(tx.transactionDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                      </p>
                                    </div>
                                    <div className="px-4 py-2.5 bg-[#0a101f]">
                                      <p className="text-[9px] text-slate-600 uppercase tracking-wider">Category</p>
                                      <p className="text-xs text-slate-300 mt-0.5">
                                        {FINANCE_CATEGORY_ICONS[tx.category]} {FINANCE_CATEGORY_LABELS[tx.category]}
                                      </p>
                                    </div>
                                    <div className="px-4 py-2.5 bg-[#0a101f]">
                                      <p className="text-[9px] text-slate-600 uppercase tracking-wider">Recurring</p>
                                      <p className="text-xs text-slate-300 mt-0.5">
                                        {tx.isRecurring ? `Yes • ${tx.recurringInterval || "monthly"}` : "No"}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Description */}
                                  {tx.description && (
                                    <div className="px-4 py-2.5 border-t border-white/[0.03]">
                                      <p className="text-[9px] text-slate-600 uppercase tracking-wider mb-1">Note</p>
                                      <p className="text-xs text-slate-400 leading-relaxed">{tx.description}</p>
                                    </div>
                                  )}

                                  {/* Tags */}
                                  {tx.tags && tx.tags.length > 0 && (
                                    <div className="px-4 py-2.5 border-t border-white/[0.03]">
                                      <p className="text-[9px] text-slate-600 uppercase tracking-wider mb-1.5">Tags</p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {tx.tags.map((tag) => (
                                          <span key={tag} className="px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.04] text-[10px] text-slate-400">
                                            {tag}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Actions */}
                                  <div className="flex items-center gap-2 px-4 py-3 border-t border-white/[0.03]">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleStartEdit(tx); }}
                                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-500/[0.06] border border-sky-500/15 text-sky-400 text-xs font-medium hover:bg-sky-500/10 transition-all"
                                    >
                                      <Pencil className="w-3 h-3" /> Edit
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(tx.id); }}
                                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-rose-500/[0.06] border border-rose-500/15 text-rose-400/70 text-xs font-medium hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                                    >
                                      <Trash2 className="w-3 h-3" /> Delete
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Quick Add Sheet */}
      <AnimatePresence>
        {showQuickAdd && (
          <QuickAddSheet
            onClose={() => setShowQuickAdd(false)}
            onSubmit={handleAddTransaction}
          />
        )}
      </AnimatePresence>

      {/* Transaction Detail Modal */}
      <AnimatePresence>
        {detailTx && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setDetailTx(null)}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg rounded-2xl bg-[#0a101f] border border-white/[0.08] shadow-2xl overflow-hidden"
            >
              {(() => {
                const tx = detailTx;
                const isIncome = tx.transactionType === "income";
                const isEditing = editingId === tx.id;

                return (
                  <>
                    {/* Hero */}
                    <div className={`px-6 py-5 ${isIncome ? "bg-emerald-500/[0.06]" : "bg-rose-500/[0.06]"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-white/[0.06] flex items-center justify-center text-2xl">
                            {FINANCE_CATEGORY_ICONS[tx.category] || "📌"}
                          </div>
                          <div>
                            <p className="text-lg font-semibold text-white">{tx.title}</p>
                            <p className="text-xs text-slate-500">{isIncome ? "Income" : "Expense"} • {FINANCE_CATEGORY_LABELS[tx.category]}</p>
                          </div>
                        </div>
                        <button onClick={() => setDetailTx(null)} className="p-2 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition-colors">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <p className={`text-3xl font-bold font-mono mt-4 ${isIncome ? "text-emerald-400" : "text-rose-400"}`}>
                        {isIncome ? "+" : "-"}{formatCurrency(tx.amount)}
                      </p>
                    </div>

                    {isEditing ? (
                      /* Edit Form */
                      <div className="p-5 space-y-3">
                        <div>
                          <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">Title</label>
                          <input type="text" value={editData.title} onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full bg-white/[0.05] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/40 transition-colors" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">Amount</label>
                            <input type="number" value={editData.amount} onChange={(e) => setEditData(prev => ({ ...prev, amount: e.target.value }))}
                              className="w-full bg-white/[0.05] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-emerald-500/40 transition-colors" />
                          </div>
                          <div>
                            <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">Date</label>
                            <input type="date" value={editData.date} onChange={(e) => setEditData(prev => ({ ...prev, date: e.target.value }))}
                              className="w-full bg-white/[0.05] border border-white/[0.07] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500/40 transition-colors [color-scheme:dark]" />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5 block">Category</label>
                          <div className="flex flex-wrap gap-1.5">
                            {(["food", "transport", "bills", "health", "entertainment", "shopping", "subscriptions", "savings", "education", "salary", "freelance", "investments", "other"] as FinanceCategory[]).map((cat) => (
                              <button key={cat} onClick={() => setEditData(prev => ({ ...prev, category: cat }))}
                                className={`px-2.5 py-1 rounded-lg text-[11px] transition-all ${editData.category === cat ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-white/[0.03] text-slate-500 border border-white/[0.05] hover:border-white/[0.1]"}`}>
                                {FINANCE_CATEGORY_ICONS[cat]} {FINANCE_CATEGORY_LABELS[cat]}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2">
                          <button onClick={handleCancelEdit} className="px-4 py-2.5 rounded-xl text-xs text-slate-400 bg-white/[0.04] border border-white/[0.06] hover:text-white transition-all">Cancel</button>
                          <button onClick={() => { handleSaveEdit(tx.id); setDetailTx(null); }} disabled={!editData.title || !editData.amount}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-40 transition-all">
                            <Check className="w-3.5 h-3.5" /> Save Changes
                          </button>
                        </div>
                      </div>
                    ) : deleteConfirmId === tx.id ? (
                      /* Delete Confirm */
                      <div className="p-5">
                        <div className="rounded-xl bg-rose-500/[0.06] border border-rose-500/20 p-4">
                          <p className="text-sm font-medium text-white">Delete this transaction?</p>
                          <p className="text-xs text-slate-400 mt-1">&quot;{tx.title}&quot; for {formatCurrency(tx.amount)} will be permanently removed.</p>
                          <div className="flex gap-2 mt-3">
                            <button onClick={() => setDeleteConfirmId(null)} className="px-4 py-2 rounded-lg text-xs text-slate-400 bg-white/[0.03] border border-white/[0.07] hover:text-white transition-all">Cancel</button>
                            <button onClick={() => { handleDelete(tx.id); setDetailTx(null); }}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 transition-all">
                              <Trash2 className="w-3 h-3" /> Confirm Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Detail View */
                      <div className="p-5 space-y-4">
                        {/* Info Grid */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-3">
                            <p className="text-[9px] text-slate-600 uppercase tracking-wider">Date</p>
                            <p className="text-xs text-slate-300 mt-1 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-500" />
                              {parseLocalDate(tx.transactionDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </p>
                          </div>
                          <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-3">
                            <p className="text-[9px] text-slate-600 uppercase tracking-wider">Category</p>
                            <p className="text-xs text-slate-300 mt-1">
                              {FINANCE_CATEGORY_ICONS[tx.category]} {FINANCE_CATEGORY_LABELS[tx.category]}
                            </p>
                          </div>
                          <div className="rounded-xl bg-white/[0.03] border border-white/[0.05] p-3">
                            <p className="text-[9px] text-slate-600 uppercase tracking-wider">Recurring</p>
                            <p className="text-xs text-slate-300 mt-1">
                              {tx.isRecurring ? `Yes • ${tx.recurringInterval || "monthly"}` : "No"}
                            </p>
                          </div>
                        </div>

                        {tx.description && (
                          <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3">
                            <p className="text-[9px] text-slate-600 uppercase tracking-wider mb-1">Description</p>
                            <p className="text-xs text-slate-400 leading-relaxed">{tx.description}</p>
                          </div>
                        )}

                        {tx.tags && tx.tags.length > 0 && (
                          <div>
                            <p className="text-[9px] text-slate-600 uppercase tracking-wider mb-1.5">Tags</p>
                            <div className="flex flex-wrap gap-1.5">
                              {tx.tags.map((tag) => (
                                <span key={tag} className="px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.04] text-[10px] text-slate-400">{tag}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="text-[10px] text-slate-600 flex items-center gap-3">
                          <span>ID: {tx.id.slice(0, 8)}...</span>
                          {tx.createdAt && <span>Created: {new Date(tx.createdAt).toLocaleDateString()}</span>}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => handleStartEdit(tx)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-sky-500/[0.08] border border-sky-500/15 text-sky-400 text-xs font-medium hover:bg-sky-500/15 transition-all">
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button onClick={() => setDeleteConfirmId(tx.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-rose-500/[0.06] border border-rose-500/15 text-rose-400/70 text-xs font-medium hover:text-rose-400 hover:bg-rose-500/10 transition-all">
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// ENHANCED QUICK ADD — 3-STEP FLOW
// ============================================

function QuickAddSheet({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: CreateTransactionInput) => Promise<void>;
}) {
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<FinanceCategory>("other");
  const [txType, setTxType] = useState<FinanceTransactionType>("expense");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const categories: FinanceCategory[] = [
    "food",
    "transport",
    "bills",
    "health",
    "entertainment",
    "shopping",
    "subscriptions",
    "education",
    "salary",
    "freelance",
    "other",
  ];

  const canProceedStep1 = !!amount && parseFloat(amount) > 0;
  const canProceedStep2 = !!title;

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
      setIsSuccess(true);
      setTimeout(onClose, 1000);
    } catch {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      variants={sheetBackdrop}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        variants={sheetPanel}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="w-full max-w-md bg-[#0a101f] border border-white/[0.07] rounded-t-3xl sm:rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-white font-[family-name:var(--font-syne)]">
              Quick Add
            </h3>
            <div className="flex gap-1">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    s <= step
                      ? "w-6 bg-emerald-400"
                      : "w-2 bg-white/[0.1]"
                  }`}
                />
              ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-1 text-slate-500 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps */}
        <div className="px-6 pb-6 min-h-[320px]">
          <AnimatePresence mode="wait">
            {/* STEP 1: Amount + Type */}
            {step === 1 && (
              <motion.div
                key="step1"
                variants={stepSlide}
                initial="enter"
                animate="center"
                exit="exit"
                className="space-y-6 pt-4"
              >
                {/* Type Toggle */}
                <div className="flex gap-2 p-1 bg-white/[0.03] border border-white/[0.07] rounded-2xl">
                  {(["expense", "income"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTxType(t)}
                      className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all min-h-[44px] ${
                        txType === t
                          ? t === "expense"
                            ? "bg-rose-500/15 text-rose-400 shadow-lg shadow-rose-500/10"
                            : "bg-emerald-500/15 text-emerald-400 shadow-lg shadow-emerald-500/10"
                          : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {t === "expense" ? "Expense" : "Income"}
                    </button>
                  ))}
                </div>

                {/* Large Amount Input */}
                <div className="text-center py-6">
                  <p className="text-xs text-slate-500 uppercase tracking-widest mb-3">
                    Amount
                  </p>
                  <div className="flex items-center justify-center gap-1">
                    <span
                      className={`text-2xl font-mono ${
                        txType === "expense"
                          ? "text-rose-400/60"
                          : "text-emerald-400/60"
                      }`}
                    >
                      $
                    </span>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      autoFocus
                      className="bg-transparent text-center text-4xl font-mono text-white placeholder:text-slate-700 focus:outline-none w-48 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>

                <button
                  onClick={() => setStep(2)}
                  disabled={!canProceedStep1}
                  className="w-full py-3.5 rounded-xl font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-white/[0.07] text-white hover:bg-white/[0.1] min-h-[44px]"
                >
                  Continue
                </button>
              </motion.div>
            )}

            {/* STEP 2: Title + Category */}
            {step === 2 && (
              <motion.div
                key="step2"
                variants={stepSlide}
                initial="enter"
                animate="center"
                exit="exit"
                className="space-y-5 pt-4"
              >
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-widest mb-2 block">
                    What was this for?
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Grocery shopping"
                    autoFocus
                    className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/40 transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-widest mb-3 block">
                    Category
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {categories.map((cat) => {
                      const isSelected = category === cat;
                      return (
                        <motion.button
                          key={cat}
                          whileTap={{ scale: 0.92 }}
                          onClick={() => setCategory(cat)}
                          className={`flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all min-h-[44px] ${
                            isSelected
                              ? "bg-emerald-500/15 border border-emerald-500/30 shadow-lg shadow-emerald-500/10"
                              : "bg-white/[0.03] border border-white/[0.07] hover:border-white/[0.15]"
                          }`}
                        >
                          <motion.span
                            animate={
                              isSelected
                                ? { scale: 1.2 }
                                : { scale: 1 }
                            }
                            transition={spring.bouncy}
                            className="text-lg"
                          >
                            {FINANCE_CATEGORY_ICONS[cat]}
                          </motion.span>
                          <span
                            className={`text-[10px] leading-tight ${
                              isSelected
                                ? "text-emerald-400"
                                : "text-slate-500"
                            }`}
                          >
                            {FINANCE_CATEGORY_LABELS[cat].split(" ")[0]}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => setStep(1)}
                    className="px-4 py-3 rounded-xl text-sm text-slate-400 bg-white/[0.03] border border-white/[0.07] hover:text-white transition-all min-h-[44px]"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={!canProceedStep2}
                    className="flex-1 py-3 rounded-xl font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-white/[0.07] text-white hover:bg-white/[0.1] min-h-[44px]"
                  >
                    Review
                  </button>
                </div>
              </motion.div>
            )}

            {/* STEP 3: Summary + Save */}
            {step === 3 && (
              <motion.div
                key="step3"
                variants={stepSlide}
                initial="enter"
                animate="center"
                exit="exit"
                className="space-y-5 pt-4"
              >
                {/* Summary Card */}
                <div className="rounded-2xl bg-white/[0.03] border border-white/[0.07] p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-white/[0.05] flex items-center justify-center text-2xl">
                        {FINANCE_CATEGORY_ICONS[category]}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">
                          {title}
                        </p>
                        <p className="text-xs text-slate-500">
                          {FINANCE_CATEGORY_LABELS[category]}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-lg font-mono font-semibold ${
                          txType === "income"
                            ? "text-emerald-400"
                            : "text-rose-400"
                        }`}
                      >
                        {txType === "income" ? "+" : "-"}$
                        {parseFloat(amount || "0").toFixed(2)}
                      </p>
                      <p className="text-xs text-slate-500 capitalize">
                        {txType}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setStep(2)}
                    className="px-4 py-3 rounded-xl text-sm text-slate-400 bg-white/[0.03] border border-white/[0.07] hover:text-white transition-all min-h-[44px]"
                  >
                    Back
                  </button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleSubmit}
                    disabled={isSubmitting || isSuccess}
                    className={`flex-1 py-3.5 rounded-xl font-medium transition-all min-h-[44px] flex items-center justify-center gap-2 ${
                      isSuccess
                        ? "bg-emerald-500 text-white"
                        : "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50"
                    }`}
                  >
                    <AnimatePresence mode="wait">
                      {isSuccess ? (
                        <motion.span
                          key="check"
                          variants={successPop}
                          initial="hidden"
                          animate="visible"
                        >
                          <Check className="w-5 h-5" />
                        </motion.span>
                      ) : (
                        <motion.span
                          key="text"
                          initial={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          {isSubmitting ? "Saving..." : "Save Transaction"}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
