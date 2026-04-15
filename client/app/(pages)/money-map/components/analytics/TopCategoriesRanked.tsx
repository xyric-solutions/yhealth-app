"use client";

import { useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import type { CategoryBreakdownItem, FinanceCategory } from "@shared/types/domain/finance";
import { FINANCE_CATEGORY_ICONS, FINANCE_CATEGORY_LABELS } from "@shared/types/domain/finance";
import { CHART_COLORS, formatCurrency, fadeSlideUp } from "../../lib/motion";

interface TopCategoriesRankedProps {
  data: CategoryBreakdownItem[];
  previousData?: CategoryBreakdownItem[];
}

type SortBy = "amount" | "percentage" | "change";

export function TopCategoriesRanked({ data, previousData }: TopCategoriesRankedProps) {
  const [sortBy, setSortBy] = useState<SortBy>("amount");

  const enriched = data.map((item, i) => {
    const prev = previousData?.find(p => p.category === item.category);
    const delta = prev ? ((item.amount - prev.amount) / Math.max(prev.amount, 1)) * 100 : 0;
    return { ...item, delta: Math.round(delta), rank: i + 1, color: CHART_COLORS[i % CHART_COLORS.length] };
  });

  const sorted = [...enriched].sort((a, b) => {
    if (sortBy === "amount") return b.amount - a.amount;
    if (sortBy === "percentage") return b.percentage - a.percentage;
    return Math.abs(b.delta) - Math.abs(a.delta);
  });

  const maxAmount = Math.max(...sorted.map(s => s.amount), 1);

  return (
    <motion.div variants={fadeSlideUp}>
      {/* Sort controls */}
      <div className="flex items-center gap-1 mb-4 text-[10px]">
        <span className="text-slate-500 mr-1">Sort:</span>
        {(["amount", "percentage", "change"] as const).map(s => (
          <button
            key={s}
            onClick={() => setSortBy(s)}
            className={`px-2 py-0.5 rounded-md transition-colors ${
              sortBy === s ? "bg-emerald-500/15 text-emerald-400" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {s === "amount" ? "Amount" : s === "percentage" ? "% Total" : "Change"}
          </button>
        ))}
      </div>

      {/* Ranked list */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {sorted.slice(0, 8).map((item, i) => (
            <motion.div
              key={item.category}
              layout
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ delay: 0.04 * i, duration: 0.3 }}
              className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-white/[0.03] transition-colors"
            >
              <span className="text-[10px] text-slate-600 w-4 text-right font-mono">#{i + 1}</span>
              <span className="text-base w-6 text-center">{FINANCE_CATEGORY_ICONS[item.category as FinanceCategory] || "📌"}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-300 truncate">
                    {FINANCE_CATEGORY_LABELS[item.category as FinanceCategory]}
                  </span>
                  <span className="text-xs text-white font-mono">{formatCurrency(item.amount)}</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(item.amount / maxAmount) * 100}%` }}
                    transition={{ duration: 0.7, delay: 0.05 * i, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                </div>
              </div>
              {/* Delta badge */}
              <div className={`flex items-center gap-0.5 text-[10px] font-medium w-12 justify-end ${
                item.delta > 0 ? "text-rose-400" : item.delta < 0 ? "text-emerald-400" : "text-slate-500"
              }`}>
                {item.delta > 0 ? <ArrowUp className="w-2.5 h-2.5" /> :
                 item.delta < 0 ? <ArrowDown className="w-2.5 h-2.5" /> :
                 <Minus className="w-2.5 h-2.5" />}
                {Math.abs(item.delta)}%
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
