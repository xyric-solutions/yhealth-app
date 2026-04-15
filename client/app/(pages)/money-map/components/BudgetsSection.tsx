"use client";

import { motion, AnimatePresence, type Variants, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useState, useMemo } from "react";
import {
  Wallet,
  Plus,
  X,
  AlertTriangle,
  TrendingUp,
  Pencil,
  Trash2,
  Download,
  Sparkles,
  Zap,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api-client";
import type { FinanceBudget, FinanceCategory, CreateBudgetInput } from "@shared/types/domain/finance";
import { FINANCE_CATEGORY_ICONS, FINANCE_CATEGORY_LABELS } from "@shared/types/domain/finance";
import {
  formatCurrency,
  AnimatedCurrency,
  fadeSlideUp,
  staggerContainer,
  spring,
} from "../lib/motion";

// ============================================
// PREMIUM 3D TILT CARD COMPONENT
// ============================================
function TiltCard({ 
  children, 
  className,
  glowColor = "amber",
}: { 
  children: React.ReactNode; 
  className?: string;
  glowColor?: "amber" | "rose" | "emerald" | "blue";
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const mouseXSpring = useSpring(x, { stiffness: 300, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 300, damping: 30 });
  
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["8deg", "-8deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-8deg", "8deg"]);
  
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };
  
  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const glowColors = {
    amber: "from-amber-500/20 to-orange-500/20",
    rose: "from-rose-500/20 to-pink-500/20",
    emerald: "from-emerald-500/20 to-teal-500/20",
    blue: "from-blue-500/20 to-cyan-500/20",
  };

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
      className={`relative ${className}`}
    >
      <div 
        className={`relative overflow-hidden rounded-2xl 
          bg-gradient-to-br ${glowColors[glowColor]}
          backdrop-blur-xl border border-white/[0.07]
          shadow-xl shadow-black/20`}
        style={{ transform: "translateZ(20px)" }}
      >
        {/* Shimmer overlay */}
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          />
        </div>
        <div className="relative z-10">
          {children}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================
// VARIANTS
// ============================================
const cardHover: Variants = {
  rest: { y: 0, scale: 1 },
  hover: { y: -4, scale: 1.02, transition: spring.soft },
};

const ringPulse: Variants = {
  idle: { opacity: 1 },
  pulse: {
    opacity: [1, 0.6, 1],
    scale: [1, 1.02, 1],
    transition: { duration: 2, repeat: Infinity, ease: "easeInOut" },
  },
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

// ============================================
// HELPERS
// ============================================
function getStatusColor(percent: number): {
  primary: string;
  secondary: string;
  glow: string;
} {
  if (percent >= 90) return { primary: "#f43f5e", secondary: "#fb7185", glow: "rgba(244,63,94,0.5)" };
  if (percent >= 75) return { primary: "#f59e0b", secondary: "#fbbf24", glow: "rgba(245,158,11,0.5)" };
  return { primary: "#10b981", secondary: "#34d399", glow: "rgba(16,185,129,0.5)" };
}

// ============================================
// TYPES
// ============================================
interface BudgetsSectionProps {
  budgets: FinanceBudget[];
  onRefresh: () => void;
}

// ============================================
// MAIN COMPONENT
// ============================================
export function BudgetsSection({ budgets, onRefresh }: BudgetsSectionProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingBudget, setEditingBudget] = useState<FinanceBudget | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

  const stats = useMemo(() => {
    const totalSpent = budgets.reduce((s, b) => s + b.currentSpend, 0);
    const totalLimit = budgets.reduce((s, b) => s + b.monthlyLimit, 0);
    const nearLimit = budgets.filter(
      (b) => b.monthlyLimit > 0 && (b.currentSpend / b.monthlyLimit) * 100 >= 80
    ).length;
    const overallPercent = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0;
    return { totalSpent, totalLimit, nearLimit, overallPercent };
  }, [budgets]);

  const animatedSpent = useCountUp(stats.totalSpent);
  const animatedLimit = useCountUp(stats.totalLimit);

  const handleDeleteBudget = async (budgetId: string) => {
    setDeletingId(budgetId);
    try {
      await api.delete(`/finance/budgets/${budgetId}`);
      onRefresh();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Premium Overview Banner */}
      {budgets.length > 0 && (
        <TiltCard glowColor={stats.overallPercent >= 80 ? "rose" : stats.overallPercent >= 60 ? "amber" : "emerald"}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <motion.div 
                  className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <Wallet className="w-5 h-5 text-amber-400" />
                </motion.div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Monthly Budget Overview
                  </h3>
                  <p className="text-xs text-slate-400">Track your spending across categories</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-lg font-mono font-bold text-white">
                    {formatCurrency(animatedSpent)}
                  </span>
                  <span className="text-xs text-slate-500 mx-1">/</span>
                  <span className="text-sm font-mono text-slate-400">
                    {formatCurrency(animatedLimit)}
                  </span>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowReport(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.07] text-xs text-slate-300 hover:text-white hover:bg-white/[0.1] hover:border-white/[0.15] transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export
                </motion.button>
              </div>
            </div>

            {/* Premium Progress Bar with Glow */}
            <div className="relative">
              <div className="h-3 bg-white/[0.05] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(stats.overallPercent, 100)}%` }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className={`h-full rounded-full bg-gradient-to-r ${
                    stats.overallPercent >= 80
                      ? "from-rose-500 via-rose-400 to-rose-500"
                      : stats.overallPercent >= 60
                      ? "from-amber-500 via-amber-400 to-amber-500"
                      : "from-emerald-500 via-emerald-400 to-emerald-500"
                  }`}
                  style={{
                    boxShadow: stats.overallPercent >= 80 
                      ? "0 0 20px rgba(244,63,94,0.5)" 
                      : stats.overallPercent >= 60
                      ? "0 0 20px rgba(245,158,11,0.5)"
                      : "0 0 20px rgba(16,185,129,0.5)"
                  }}
                >
                  <motion.div
                    className="h-full w-full bg-gradient-to-r from-transparent via-white/30 to-transparent"
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  />
                </motion.div>
              </div>
              {/* Percentage Badge */}
              <motion.div 
                className="absolute -top-1 left-0 transform -translate-y-full"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: `${Math.min(stats.overallPercent, 100) - 5}%` }}
                transition={{ delay: 0.5, duration: 1 }}
              >
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  stats.overallPercent >= 80 ? "bg-rose-500/20 text-rose-400" 
                  : stats.overallPercent >= 60 ? "bg-amber-500/20 text-amber-400" 
                  : "bg-emerald-500/20 text-emerald-400"
                }`}>
                  {Math.round(stats.overallPercent)}%
                </span>
              </motion.div>
            </div>

            {/* Status Indicators */}
            <div className="flex items-center gap-4 mt-4">
              {stats.nearLimit > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-full"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{stats.nearLimit} budget{stats.nearLimit > 1 ? "s" : ""} near limit</span>
                </motion.div>
              )}
              <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{budgets.length} active budgets</span>
              </div>
            </div>
          </div>
        </TiltCard>
      )}

      {/* Premium Budget Cards Grid */}
      {budgets.length === 0 ? (
        <motion.div
          variants={fadeSlideUp}
          initial="hidden"
          animate="show"
          className="rounded-2xl bg-white/[0.02] border border-white/[0.07] py-20 flex flex-col items-center justify-center"
        >
          <motion.div 
            className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center mb-5"
            whileHover={{ scale: 1.1, rotate: 5 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <Wallet className="w-10 h-10 text-amber-400" />
          </motion.div>
          <h3 className="text-lg font-semibold text-white mb-2">
            No budgets set for this month
          </h3>
          <p className="text-sm text-slate-400 mb-6 text-center max-w-sm">
            Create smart budgets to track spending limits and reach your financial goals faster
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all"
          >
            <Plus className="w-4 h-4" /> Create your first budget
          </motion.button>
        </motion.div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
        >
          {budgets.map((budget, i) => (
            <BudgetCard
              key={budget.id}
              budget={budget}
              index={i}
              onEdit={() => setEditingBudget(budget)}
              onDelete={() => handleDeleteBudget(budget.id)}
              isDeleting={deletingId === budget.id}
            />
          ))}

          {/* + New Budget Card */}
          <motion.button
            variants={fadeSlideUp}
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreate(true)}
            className="group rounded-2xl border-2 border-dashed border-white/[0.1] hover:border-emerald-500/30 p-5 flex flex-col items-center justify-center gap-3 min-h-[220px] transition-all bg-white/[0.01] hover:bg-white/[0.03]"
          >
            <motion.div 
              className="w-14 h-14 rounded-2xl bg-white/[0.05] group-hover:bg-emerald-500/20 border border-white/[0.1] group-hover:border-emerald-500/30 flex items-center justify-center transition-all"
              whileHover={{ scale: 1.1, rotate: 90 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <Plus className="w-6 h-6 text-slate-500 group-hover:text-emerald-400 transition-colors" />
            </motion.div>
            <span className="text-sm text-slate-400 font-medium group-hover:text-emerald-400 transition-colors">
              New Budget
            </span>
          </motion.button>
        </motion.div>
      )}

      {/* Create Sheet */}
      <AnimatePresence>
        {showCreate && (
          <CreateBudgetSheet
            onClose={() => setShowCreate(false)}
            onCreated={() => {
              setShowCreate(false);
              onRefresh();
            }}
          />
        )}
      </AnimatePresence>

      {/* Edit Sheet */}
      <AnimatePresence>
        {editingBudget && (
          <EditBudgetSheet
            budget={editingBudget}
            onClose={() => setEditingBudget(null)}
            onSaved={() => {
              setEditingBudget(null);
              onRefresh();
            }}
          />
        )}
      </AnimatePresence>

      {/* Report Export Modal */}
      <AnimatePresence>
        {showReport && (
          <ReportExportModal
            budgets={budgets}
            onClose={() => setShowReport(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================
// PREMIUM BUDGET CARD
// ============================================
function BudgetCard({
  budget,
  index,
  onEdit,
  onDelete,
  isDeleting,
}: {
  budget: FinanceBudget;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const percent = budget.monthlyLimit > 0
    ? Math.min((budget.currentSpend / budget.monthlyLimit) * 100, 100)
    : 0;

  const colors = getStatusColor(percent);
  const isNearLimit = percent >= 80;
  const isOverLimit = percent >= 100;
  const remaining = budget.monthlyLimit - budget.currentSpend;

  return (
    <TiltCard 
      glowColor={percent >= 80 ? "rose" : percent >= 60 ? "amber" : "emerald"}
      className="group cursor-default"
    >
      <div className="p-5">
        {/* Header with Actions */}
        <div className="flex items-start justify-between mb-4">
          <motion.div 
            className="p-2.5 rounded-xl bg-white/[0.05] border border-white/[0.07]"
            whileHover={{ scale: 1.1 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <span className="text-xl">{FINANCE_CATEGORY_ICONS[budget.category as FinanceCategory]}</span>
          </motion.div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="p-1.5 rounded-lg bg-white/[0.05] text-slate-400 hover:text-white hover:bg-white/[0.1] transition-all"
            >
              <Pencil className="w-3.5 h-3.5" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              disabled={isDeleting}
              className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all disabled:opacity-50"
            >
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </motion.button>
          </div>
        </div>

        {/* Category Name */}
        <h4 className="text-sm font-semibold text-white mb-1">
          {FINANCE_CATEGORY_LABELS[budget.category as FinanceCategory]}
        </h4>

        {/* Amount Display */}
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-lg font-mono font-bold" style={{ color: colors.primary }}>
            {formatCurrency(budget.currentSpend)}
          </span>
          <span className="text-xs text-slate-500">/</span>
          <span className="text-sm font-mono text-slate-400">
            {formatCurrency(budget.monthlyLimit)}
          </span>
        </div>

        {/* Circular Progress */}
        <div className="relative w-full aspect-square max-w-[120px] mx-auto mb-4">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            {/* Track */}
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="8"
            />
            {/* Progress */}
            <motion.circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke={colors.primary}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={264}
              initial={{ strokeDashoffset: 264 }}
              animate={{ strokeDashoffset: 264 - (percent / 100) * 264 }}
              transition={{ duration: 1.5, ease: "easeOut", delay: index * 0.1 }}
              style={{
                filter: `drop-shadow(0 0 8px ${colors.glow})`,
              }}
            />
          </svg>
          {/* Center Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span 
              className="text-2xl font-bold"
              style={{ color: colors.primary }}
              animate={isNearLimit ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {Math.round(percent)}%
            </motion.span>
            <span className="text-[10px] text-slate-500 mt-0.5">used</span>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center justify-between">
          {isOverLimit ? (
            <span className="text-xs text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-full font-medium">
              Over budget
            </span>
          ) : isNearLimit ? (
            <span className="text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full font-medium">
              Near limit
            </span>
          ) : (
            <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full font-medium">
              On track
            </span>
          )}
          <span className="text-xs text-slate-500">
            {remaining > 0 ? `${formatCurrency(remaining)} left` : "No budget left"}
          </span>
        </div>
      </div>
    </TiltCard>
  );
}

// ============================================
// CREATE BUDGET SHEET (Premium)
// ============================================
function CreateBudgetSheet({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [category, setCategory] = useState<FinanceCategory>("food");
  const [limit, setLimit] = useState("");
  const [alertThreshold, setAlertThreshold] = useState(80);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const categories: FinanceCategory[] = [
    "food", "transport", "bills", "health", "entertainment", 
    "shopping", "subscriptions", "education", "other",
  ];

  const handleSubmit = async () => {
    if (!limit) return;
    setIsSubmitting(true);
    try {
      await api.post("/finance/budgets", {
        category,
        monthlyLimit: parseFloat(limit),
        alertThreshold,
        month,
      } as CreateBudgetInput);
      onCreated();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      variants={sheetBackdrop}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        variants={sheetPanel}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="w-full max-w-lg bg-[#0a0f1c] border border-white/[0.1] rounded-t-3xl sm:rounded-2xl p-6 space-y-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20">
              <Zap className="w-5 h-5 text-amber-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">
              Create Smart Budget
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.05] transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Grid */}
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wider mb-3 block">
            Select Category
          </label>
          <div className="grid grid-cols-5 gap-2">
            {categories.map((cat) => {
              const isSelected = category === cat;
              return (
                <motion.button
                  key={cat}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setCategory(cat)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all ${
                    isSelected
                      ? "bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30"
                      : "bg-white/[0.03] border border-white/[0.07] hover:border-white/[0.15]"
                  }`}
                >
                  <motion.span
                    animate={isSelected ? { scale: 1.2 } : { scale: 1 }}
                    transition={spring.bouncy}
                    className="text-xl"
                  >
                    {FINANCE_CATEGORY_ICONS[cat]}
                  </motion.span>
                  <span className={`text-[10px] ${isSelected ? "text-amber-400" : "text-slate-500"}`}>
                    {FINANCE_CATEGORY_LABELS[cat].split(" ")[0]}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Amount Input */}
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wider mb-2 block">
            Monthly Limit
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-mono text-slate-500">
              $
            </span>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder="0.00"
              autoFocus
              className="w-full bg-white/[0.03] border border-white/[0.1] rounded-xl pl-12 pr-4 py-4 text-xl font-mono text-white placeholder:text-slate-700 focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 transition-all"
            />
          </div>
        </div>

        {/* Alert Threshold */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-slate-500 uppercase tracking-wider">
              Alert at
            </label>
            <span className="text-sm font-mono text-amber-400">{alertThreshold}%</span>
          </div>
          <input
            type="range"
            min={50}
            max={95}
            step={5}
            value={alertThreshold}
            onChange={(e) => setAlertThreshold(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-white/[0.05] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-400 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-amber-500/50"
          />
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-slate-600">50%</span>
            <span className="text-[10px] text-slate-600">95%</span>
          </div>
        </div>

        {/* Submit */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSubmit}
          disabled={!limit || isSubmitting}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium shadow-lg shadow-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <motion.div
                className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              Creating...
            </span>
          ) : (
            "Create Budget"
          )}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

// ============================================
// EDIT BUDGET SHEET
// ============================================
function EditBudgetSheet({
  budget,
  onClose,
  onSaved,
}: {
  budget: FinanceBudget;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [limit, setLimit] = useState(String(budget.monthlyLimit));
  const [alertThreshold, setAlertThreshold] = useState(budget.alertThreshold || 80);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!limit) return;
    setIsSubmitting(true);
    try {
      await api.put(`/finance/budgets/${budget.id}`, {
        monthlyLimit: parseFloat(limit),
        alertThreshold,
      });
      onSaved();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      variants={sheetBackdrop}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        variants={sheetPanel}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="w-full max-w-lg bg-[#0a0f1c] border border-white/[0.1] rounded-t-3xl sm:rounded-2xl p-6 space-y-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20">
              <Pencil className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Edit Budget</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.05]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/[0.07]">
          <span className="text-2xl">{FINANCE_CATEGORY_ICONS[budget.category as FinanceCategory]}</span>
          <span className="text-white font-medium">{FINANCE_CATEGORY_LABELS[budget.category as FinanceCategory]}</span>
        </div>

        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wider mb-2 block">Monthly Limit</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-mono text-slate-500">$</span>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="w-full bg-white/[0.03] border border-white/[0.1] rounded-xl pl-12 pr-4 py-4 text-xl font-mono text-white focus:outline-none focus:border-blue-500/40 transition-all"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-slate-500 uppercase tracking-wider">Alert at</label>
            <span className="text-sm font-mono text-blue-400">{alertThreshold}%</span>
          </div>
          <input
            type="range"
            min={50}
            max={95}
            step={5}
            value={alertThreshold}
            onChange={(e) => setAlertThreshold(parseInt(e.target.value, 10))}
            className="w-full h-2 bg-white/[0.05] rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-400 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-blue-500/50"
          />
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSubmit}
          disabled={!limit || isSubmitting}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium shadow-lg shadow-blue-500/25 disabled:opacity-50 transition-all"
        >
          {isSubmitting ? "Saving..." : "Save Changes"}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

// ============================================
// REPORT EXPORT MODAL
// ============================================
function ReportExportModal({
  budgets,
  onClose,
}: {
  budgets: FinanceBudget[];
  onClose: () => void;
}) {
  const [format, setFormat] = useState<"csv" | "pdf">("csv");
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    await new Promise((r) => setTimeout(r, 1000));
    
    if (format === "csv") {
      const csv = [
        ["Category", "Budget", "Spent", "Remaining", "Percent Used"].join(","),
        ...budgets.map((b) => [
          FINANCE_CATEGORY_LABELS[b.category as FinanceCategory],
          b.monthlyLimit,
          b.currentSpend,
          b.monthlyLimit - b.currentSpend,
          ((b.currentSpend / b.monthlyLimit) * 100).toFixed(1) + "%",
        ].join(",")),
      ].join("\n");
      
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `budget-report-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
    
    setIsExporting(false);
    onClose();
  };

  return (
    <motion.div
      variants={sheetBackdrop}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        variants={sheetPanel}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="w-full max-w-md bg-[#0a0f1c] border border-white/[0.1] rounded-2xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Export Report</h3>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {(["csv", "pdf"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`py-3 px-4 rounded-xl border transition-all capitalize ${
                format === f
                  ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                  : "bg-white/[0.03] border-white/[0.07] text-slate-400 hover:border-white/[0.15]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.07]">
          <p className="text-sm text-slate-400">
            Export {budgets.length} budget{budgets.length !== 1 ? "s" : ""} as {format.toUpperCase()}
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleExport}
          disabled={isExporting}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium disabled:opacity-50 transition-all"
        >
          {isExporting ? "Exporting..." : "Download Report"}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

// Helper hook for counting up
function useCountUp(target: number, duration = 1500) {
  const [value, setValue] = useState(0);
  
  useState(() => {
    let startTime: number;
    let animationFrame: number;
    
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * easeOut));
      
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };
    
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  });
  
  return value;
}
