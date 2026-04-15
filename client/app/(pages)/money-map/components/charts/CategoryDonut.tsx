"use client";

import { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { CHART_COLORS, fadeSlideUp, formatCurrency } from "../../lib/motion";
import type { CategoryBreakdownItem, FinanceCategory } from "@shared/types/domain/finance";
import { FINANCE_CATEGORY_LABELS, FINANCE_CATEGORY_ICONS } from "@shared/types/domain/finance";

interface CategoryDonutProps {
  data: CategoryBreakdownItem[];
  size?: number;
  totalExpense: number;
}

export function CategoryDonut({ data, size = 240, totalExpense }: CategoryDonutProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const chartData = data.slice(0, 8).map(item => ({
    name: item.category,
    value: item.amount,
    percentage: item.percentage,
  }));

  const activeCategory = activeIndex !== null ? chartData[activeIndex] : null;

  return (
    <motion.div variants={fadeSlideUp} className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius="58%"
              outerRadius="82%"
              paddingAngle={2}
              dataKey="value"
              animationBegin={0}
              animationDuration={900}
              animationEasing="ease-out"
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {chartData.map((_, i) => (
                <Cell
                  key={i}
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                  stroke="transparent"
                  style={{
                    filter: activeIndex === i
                      ? `drop-shadow(0 0 8px ${CHART_COLORS[i % CHART_COLORS.length]}80)`
                      : "none",
                    transform: activeIndex === i ? "scale(1.04)" : "scale(1)",
                    transformOrigin: "center",
                    transition: "all 0.2s ease",
                    cursor: "pointer",
                  }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory?.name || "total"}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              className="text-center"
            >
              {activeCategory ? (
                <>
                  <p className="text-xs text-slate-400">
                    {FINANCE_CATEGORY_ICONS[activeCategory.name as FinanceCategory]} {FINANCE_CATEGORY_LABELS[activeCategory.name as FinanceCategory]}
                  </p>
                  <p className="text-lg font-bold text-white font-mono">{formatCurrency(activeCategory.value)}</p>
                  <p className="text-[10px] text-slate-500">{activeCategory.percentage}%</p>
                </>
              ) : (
                <>
                  <p className="text-[10px] text-slate-500">Total Expense</p>
                  <p className="text-lg font-bold text-white font-mono">{formatCurrency(totalExpense, true)}</p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Legend */}
      <div className="w-full mt-4 space-y-2">
        {chartData.map((item, i) => (
          <motion.div
            key={item.name}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 * i + 0.5, duration: 0.3 }}
            className={`flex items-center justify-between text-xs py-1 px-2 rounded-lg transition-colors cursor-pointer ${
              activeIndex === i ? "bg-white/5" : "hover:bg-white/[0.03]"
            }`}
            onMouseEnter={() => setActiveIndex(i)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
              <span className="text-slate-300">{FINANCE_CATEGORY_LABELS[item.name as FinanceCategory]}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${item.percentage}%` }}
                  transition={{ duration: 0.8, delay: 0.05 * i + 0.6 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                />
              </div>
              <span className="text-white font-mono w-16 text-right">{formatCurrency(item.value, true)}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
