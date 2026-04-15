"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { FinanceTransaction } from "@shared/types/domain/finance";
import { formatCurrency } from "../../lib/motion";

interface TransactionVolumeProps {
  transactions: FinanceTransaction[];
  days?: number;
}

export function TransactionVolume({ transactions, days = 14 }: TransactionVolumeProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const dailyData = useMemo(() => {
    const now = new Date();
    const result: Array<{ date: string; label: string; income: number; expense: number; count: number }> = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const dayTx = transactions.filter(t => t.transactionDate === dateStr);
      result.push({
        date: dateStr,
        label: d.toLocaleDateString("en", { weekday: "narrow" }),
        income: dayTx.filter(t => t.transactionType === "income").reduce((s, t) => s + t.amount, 0),
        expense: dayTx.filter(t => t.transactionType === "expense").reduce((s, t) => s + t.amount, 0),
        count: dayTx.length,
      });
    }
    return result;
  }, [transactions, days]);

  const maxAmount = Math.max(...dailyData.map(d => Math.max(d.income, d.expense)), 1);
  const height = 80;

  const hoveredDay = hoveredIdx !== null ? dailyData[hoveredIdx] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.06] p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
          Transaction Volume
        </h4>
        <span className="text-[10px] text-slate-600">{days}d</span>
      </div>

      <div className="relative" onMouseLeave={() => setHoveredIdx(null)}>
        <div className="flex items-end gap-[3px]" style={{ height }}>
          {dailyData.map((day, i) => {
            const incH = (day.income / maxAmount) * height * 0.9;
            const expH = (day.expense / maxAmount) * height * 0.9;
            const isHovered = hoveredIdx === i;
            const isToday = i === dailyData.length - 1;

            return (
              <div
                key={day.date}
                className="flex-1 flex flex-col items-center gap-[1px] cursor-pointer relative"
                style={{ height }}
                onMouseEnter={() => setHoveredIdx(i)}
              >
                <div className="flex-1 flex items-end w-full gap-[1px]">
                  {/* Income bar */}
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: Math.max(incH, day.income > 0 ? 2 : 0) }}
                    transition={{ duration: 0.5, delay: 0.02 * i }}
                    className="flex-1 rounded-t-sm"
                    style={{
                      background: isHovered
                        ? "linear-gradient(to top, #059669, #34d399)"
                        : "linear-gradient(to top, #059669cc, #059669)",
                      opacity: isHovered ? 1 : 0.6,
                      boxShadow: isHovered ? "0 0 8px rgba(16,185,129,0.3)" : undefined,
                    }}
                  />
                  {/* Expense bar */}
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: Math.max(expH, day.expense > 0 ? 2 : 0) }}
                    transition={{ duration: 0.5, delay: 0.02 * i + 0.05 }}
                    className="flex-1 rounded-t-sm"
                    style={{
                      background: isHovered
                        ? "linear-gradient(to top, #f43f5e, #fb7185)"
                        : "linear-gradient(to top, #f43f5ecc, #f43f5e)",
                      opacity: isHovered ? 1 : 0.5,
                      boxShadow: isHovered ? "0 0 8px rgba(244,63,94,0.3)" : undefined,
                    }}
                  />
                </div>
                {/* Day label */}
                <span className={`text-[7px] mt-0.5 ${isToday ? "text-emerald-400 font-bold" : isHovered ? "text-white" : "text-slate-700"}`}>
                  {day.label}
                </span>
                {isToday && (
                  <motion.div
                    layoutId="today-dot"
                    className="w-1 h-1 rounded-full bg-emerald-400 absolute -bottom-0.5"
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Hover tooltip */}
        <AnimatePresence>
          {hoveredDay && hoveredIdx !== null && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full z-10 pointer-events-none"
            >
              <div className="bg-[#0c1322]/95 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2 shadow-xl text-center min-w-[120px]">
                <p className="text-[9px] text-slate-400 mb-1">
                  {new Date(hoveredDay.date + "T12:00:00").toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}
                </p>
                <div className="flex items-center justify-center gap-3 text-[10px]">
                  <span className="text-emerald-400 font-mono">+{formatCurrency(hoveredDay.income)}</span>
                  <span className="text-rose-400 font-mono">-{formatCurrency(hoveredDay.expense)}</span>
                </div>
                <p className="text-[8px] text-slate-600 mt-0.5">{hoveredDay.count} transaction{hoveredDay.count !== 1 ? "s" : ""}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-2 pt-2 border-t border-white/[0.04]">
        <span className="flex items-center gap-1.5 text-[9px] text-slate-500">
          <span className="w-2 h-1.5 rounded-sm bg-emerald-500" /> Income
        </span>
        <span className="flex items-center gap-1.5 text-[9px] text-slate-500">
          <span className="w-2 h-1.5 rounded-sm bg-rose-500" /> Expense
        </span>
      </div>
    </motion.div>
  );
}
