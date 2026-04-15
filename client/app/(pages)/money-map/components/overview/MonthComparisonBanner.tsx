"use client";

import { useMemo } from "react";
import { motion, type Variants } from "framer-motion";
import { ArrowUpRight, ArrowDownRight, Minus, Sparkles } from "lucide-react";
import type { MonthlySummary } from "@shared/types/domain/finance";
import { FINANCE_CATEGORY_LABELS, FINANCE_CATEGORY_ICONS } from "@shared/types/domain/finance";
import {
  AnimatedCurrency,
  formatCurrency,
  fadeSlideUp,
  staggerContainer,
  spring,
} from "../../lib/motion";

interface MonthComparisonBannerProps {
  current: MonthlySummary;
  previous: MonthlySummary;
}

const barVariants: Variants = {
  hidden: { width: "0%" },
  show: {
    width: "var(--bar-width)",
    transition: { ...spring.soft, delay: 0.2 },
  },
};

function formatMonthName(month: string): string {
  const [year, m] = month.split("-");
  return new Date(Number(year), Number(m) - 1).toLocaleString("en-US", { month: "short", year: "numeric" }).toUpperCase();
}

function getDeltaLabel(current: number, previous: number): { text: string; color: string; icon: "up" | "down" | "neutral" | "new" } {
  if (previous === 0 && current > 0) return { text: "New", color: "text-sky-400", icon: "new" };
  if (previous === 0 && current === 0) return { text: "--", color: "text-slate-500", icon: "neutral" };
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 0.5) return { text: "0%", color: "text-slate-500", icon: "neutral" };
  if (pct > 0) return { text: `+${pct.toFixed(0)}%`, color: "text-rose-400", icon: "up" };
  return { text: `${pct.toFixed(0)}%`, color: "text-emerald-400", icon: "down" };
}

export function MonthComparisonBanner({ current, previous }: MonthComparisonBannerProps) {
  const topCategories = useMemo(() => {
    const currentMap = new Map(current.categoryBreakdown.map(c => [c.category, c.amount]));
    const previousMap = new Map(previous.categoryBreakdown.map(c => [c.category, c.amount]));
    const allCategories = new Set([...currentMap.keys(), ...previousMap.keys()]);

    const merged = Array.from(allCategories).map(cat => ({
      category: cat,
      currentAmount: currentMap.get(cat) ?? 0,
      previousAmount: previousMap.get(cat) ?? 0,
    }));

    merged.sort((a, b) => Math.max(b.currentAmount, b.previousAmount) - Math.max(a.currentAmount, a.previousAmount));
    return merged.slice(0, 5);
  }, [current, previous]);

  const maxAmount = useMemo(
    () => Math.max(...topCategories.map(c => Math.max(c.currentAmount, c.previousAmount)), 1),
    [topCategories]
  );

  const totalDelta = getDeltaLabel(current.totalExpense, previous.totalExpense);
  const hasPreviousData = previous.totalExpense > 0;

  return (
    <motion.div variants={fadeSlideUp} initial="hidden" animate="show"
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className="font-[family-name:var(--font-syne)] text-sm font-bold text-white">
            {formatMonthName(current.month)}
          </span>
          <span className="text-xs text-slate-600">vs</span>
          <span className="font-[family-name:var(--font-syne)] text-sm font-semibold text-slate-500">
            {formatMonthName(previous.month)}
          </span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-1.5 rounded-full bg-emerald-500" /> Current</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-1.5 rounded-full bg-sky-500/50" /> Previous</span>
        </div>
      </div>

      {/* Category comparisons */}
      {topCategories.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">No expense categories to compare</div>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-4">
          {topCategories.map(({ category, currentAmount, previousAmount }) => {
            const delta = getDeltaLabel(currentAmount, previousAmount);
            const currentPct = maxAmount > 0 ? (currentAmount / maxAmount) * 100 : 0;
            const previousPct = maxAmount > 0 ? (previousAmount / maxAmount) * 100 : 0;

            return (
              <motion.div key={category} variants={fadeSlideUp} className="space-y-1.5">
                {/* Category label + delta */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{FINANCE_CATEGORY_ICONS[category]}</span>
                    <span className="text-xs text-slate-300 font-medium">{FINANCE_CATEGORY_LABELS[category]}</span>
                  </div>
                  <span className={`text-[10px] font-mono font-semibold ${delta.color}`}>
                    {delta.text}
                  </span>
                </div>

                {/* Current bar + amount */}
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
                    <motion.div
                      variants={barVariants} initial="hidden" animate="show"
                      className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
                      style={{ "--bar-width": `${Math.max(currentPct, 0.5)}%` } as React.CSSProperties}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-white w-16 text-right flex-shrink-0">
                    {formatCurrency(currentAmount, true)}
                  </span>
                </div>

                {/* Previous bar + amount */}
                <div className="flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
                    <motion.div
                      variants={barVariants} initial="hidden" animate="show"
                      className="h-full rounded-full bg-sky-500/40"
                      style={{ "--bar-width": `${Math.max(previousPct, hasPreviousData ? 0.5 : 0)}%` } as React.CSSProperties}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 w-16 text-right flex-shrink-0">
                    {formatCurrency(previousAmount, true)}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Bottom: total comparison */}
      <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center justify-between">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Total Expenses</p>
          <div className="flex items-baseline gap-2">
            <AnimatedCurrency value={current.totalExpense} compact className="font-mono text-lg font-bold text-white" />
            {hasPreviousData && (
              <AnimatedCurrency value={previous.totalExpense} compact className="font-mono text-sm text-slate-500" />
            )}
            {!hasPreviousData && previous.totalExpense === 0 && (
              <span className="text-xs text-slate-600 italic">No data last month</span>
            )}
          </div>
        </div>

        <div className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${
          totalDelta.icon === "up" ? "bg-rose-500/10 text-rose-400" :
          totalDelta.icon === "down" ? "bg-emerald-500/10 text-emerald-400" :
          totalDelta.icon === "new" ? "bg-sky-500/10 text-sky-400" :
          "bg-white/5 text-slate-500"
        }`}>
          {totalDelta.icon === "up" && <ArrowUpRight className="w-3.5 h-3.5" />}
          {totalDelta.icon === "down" && <ArrowDownRight className="w-3.5 h-3.5" />}
          {totalDelta.icon === "new" && <Sparkles className="w-3.5 h-3.5" />}
          {totalDelta.icon === "neutral" && <Minus className="w-3.5 h-3.5" />}
          <span className="font-mono">{totalDelta.text}</span>
        </div>
      </div>
    </motion.div>
  );
}
