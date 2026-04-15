"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { fadeSlideUp, formatCurrency } from "../../lib/motion";

interface HeatmapDay {
  date: string;
  amount: number;
}

interface SpendingHeatmapProps {
  data: HeatmapDay[];
  month: string; // initial YYYY-MM
  allTransactions?: Array<{ transactionDate: string; amount: number; transactionType: string }>;
}

const DAY_ABBREV = ["M", "T", "W", "T", "F", "S", "S"];

const COLORS = [
  "#111827",   // 0: no spend
  "#0c2a1f",   // 1: very low
  "#0d3b2a",   // 2: low
  "#0f5035",   // 3: medium
  "#10784e",   // 4: high
  "#059669",   // 5: very high
];

function getColor(amount: number, max: number): string {
  if (amount <= 0) return COLORS[0];
  if (max <= 0) return COLORS[0];
  const ratio = amount / max;
  if (ratio < 0.15) return COLORS[1];
  if (ratio < 0.3) return COLORS[2];
  if (ratio < 0.5) return COLORS[3];
  if (ratio < 0.75) return COLORS[4];
  return COLORS[5];
}

function getMonthStr(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function SpendingHeatmap({ data, month: initialMonth, allTransactions }: SpendingHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<HeatmapDay | null>(null);

  // Month navigation
  const [currentMonth, setCurrentMonth] = useState(initialMonth);
  const [yr, mn] = currentMonth.split("-").map(Number);

  const goBack = useCallback(() => {
    const prev = mn === 1 ? getMonthStr(yr - 1, 12) : getMonthStr(yr, mn - 1);
    setCurrentMonth(prev);
  }, [yr, mn]);

  const goForward = useCallback(() => {
    const now = new Date();
    const currentMax = getMonthStr(now.getFullYear(), now.getMonth() + 1);
    const next = mn === 12 ? getMonthStr(yr + 1, 1) : getMonthStr(yr, mn + 1);
    if (next <= currentMax) setCurrentMonth(next);
  }, [yr, mn]);

  const canGoForward = useMemo(() => {
    const now = new Date();
    return currentMonth < getMonthStr(now.getFullYear(), now.getMonth() + 1);
  }, [currentMonth]);

  // Build heatmap data for the displayed month
  const monthData = useMemo(() => {
    if (currentMonth === initialMonth) return data;
    if (!allTransactions) return [];
    const grouped: Record<string, number> = {};
    allTransactions
      .filter(t => t.transactionType === "expense" && t.transactionDate.startsWith(currentMonth))
      .forEach(t => {
        grouped[t.transactionDate] = (grouped[t.transactionDate] || 0) + t.amount;
      });
    return Object.entries(grouped).map(([date, amount]) => ({ date, amount }));
  }, [currentMonth, initialMonth, data, allTransactions]);

  const daysInMonth = new Date(yr, mn, 0).getDate();
  const firstDay = new Date(yr, mn - 1, 1);
  const startDow = (firstDay.getDay() + 6) % 7;
  const maxAmount = useMemo(() => Math.max(...monthData.map(d => d.amount), 1), [monthData]);
  const totalSpend = useMemo(() => monthData.reduce((s, d) => s + d.amount, 0), [monthData]);

  const todayStr = useMemo(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  }, []);

  const weeks = useMemo(() => {
    const result: (HeatmapDay | null)[][] = [];
    let week: (HeatmapDay | null)[] = Array(startDow).fill(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentMonth}-${String(day).padStart(2, "0")}`;
      const found = monthData.find(d => d.date === dateStr);
      week.push(found || { date: dateStr, amount: 0 });
      if (week.length === 7) { result.push(week); week = []; }
    }
    if (week.length > 0) { while (week.length < 7) week.push(null); result.push(week); }
    return result;
  }, [monthData, currentMonth, daysInMonth, startDow]);

  const monthLabel = new Date(yr, mn - 1).toLocaleDateString("en", { month: "short", year: "numeric" });
  const dailyAvg = useMemo(() => {
    const today = new Date();
    const daysElapsed = currentMonth === getMonthStr(today.getFullYear(), today.getMonth() + 1)
      ? today.getDate()
      : daysInMonth;
    return daysElapsed > 0 ? totalSpend / daysElapsed : 0;
  }, [totalSpend, currentMonth, daysInMonth]);

  return (
    <motion.div variants={fadeSlideUp} className="relative w-full">
      {/* Header: Month navigation + stats */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={goBack}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-medium text-white min-w-[80px] text-center">{monthLabel}</span>
          <button
            onClick={goForward}
            disabled={!canGoForward}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-[9px] text-slate-600 uppercase">Total</p>
            <p className="text-xs font-mono text-white">{formatCurrency(totalSpend)}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-slate-600 uppercase">Avg/day</p>
            <p className="text-xs font-mono text-slate-400">{formatCurrency(dailyAvg)}</p>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex gap-1">
        {/* Day labels */}
        <div className="flex flex-col gap-[2px] flex-shrink-0 w-5 pt-[1px]">
          {DAY_ABBREV.map((d, i) => (
            <div key={i} className="h-5 flex items-center text-[9px] text-slate-600">{d}</div>
          ))}
        </div>

        {/* Week columns */}
        <div className="flex gap-[2px] flex-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[2px] flex-1">
              {week.map((cell, di) => {
                const isToday = cell?.date === todayStr;
                const dayNum = cell ? parseInt(cell.date.split("-")[2]) : 0;
                const hasSpend = cell ? cell.amount > 0 : false;

                return (
                  <motion.div
                    key={`${wi}-${di}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: cell ? 1 : 0.1, scale: 1 }}
                    transition={{ delay: wi * 0.02 + di * 0.005, duration: 0.2 }}
                    className={`relative h-5 rounded-[3px] cursor-pointer transition-all duration-150 ${
                      isToday ? "ring-1 ring-emerald-400/60" : ""
                    } ${cell ? "hover:brightness-130 hover:z-10" : ""}`}
                    style={{ backgroundColor: cell ? getColor(cell.amount, maxAmount) : "transparent" }}
                    onMouseEnter={() => cell && setHoveredCell(cell)}
                    onMouseLeave={() => setHoveredCell(null)}
                  >
                    {cell && (
                      <span className={`absolute inset-0 flex items-center justify-center text-[7px] font-mono ${
                        hasSpend ? "text-white/50" : "text-slate-700"
                      }`}>
                        {dayNum}
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {hoveredCell && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute z-30 pointer-events-none left-1/2 -translate-x-1/2"
            style={{ top: -4, transform: "translateX(-50%) translateY(-100%)" }}
          >
            <div className="bg-[#0c1322] border border-white/10 rounded-lg px-3 py-2 shadow-2xl">
              <p className="text-[10px] text-slate-400">
                {new Date(hoveredCell.date + "T12:00:00").toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" })}
              </p>
              <p className={`text-sm font-mono font-semibold ${hoveredCell.amount > 0 ? "text-emerald-400" : "text-slate-600"}`}>
                {hoveredCell.amount > 0 ? formatCurrency(hoveredCell.amount) : "No spending"}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/[0.04]">
        <div className="flex items-center gap-1">
          <span className="text-[8px] text-slate-600">Less</span>
          {COLORS.map((c, i) => (
            <div key={i} className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: c }} />
          ))}
          <span className="text-[8px] text-slate-600">More</span>
        </div>
        {todayStr.startsWith(currentMonth) && (
          <span className="text-[8px] text-slate-600 flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-[2px] ring-1 ring-emerald-400/60 bg-[#111827]" /> Today
          </span>
        )}
      </div>
    </motion.div>
  );
}
