"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { FinanceTransaction, FinanceCategory } from "@shared/types/domain/finance";
import { FINANCE_CATEGORY_ICONS, FINANCE_CATEGORY_LABELS } from "@shared/types/domain/finance";
import { CHART_COLORS, formatCurrency } from "../../lib/motion";

interface MiniCategoryRingProps {
  transactions: FinanceTransaction[];
  size?: number;
}

export function MiniCategoryRing({ transactions, size = 120 }: MiniCategoryRingProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const expenses = transactions.filter(t => t.transactionType === "expense");
  const categoryMap = new Map<FinanceCategory, number>();
  for (const tx of expenses) {
    categoryMap.set(tx.category, (categoryMap.get(tx.category) || 0) + tx.amount);
  }

  const categories = [...categoryMap.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([cat, amount]) => ({ category: cat, amount }));

  const total = categories.reduce((s, c) => s + c.amount, 0);
  if (total === 0 || categories.length === 0) return null;

  const strokeWidth = 10;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let accumulated = 0;
  const arcs = categories.map((cat, i) => {
    const pct = cat.amount / total;
    const dashLen = pct * circumference;
    const gap = circumference - dashLen;
    const offset = -(accumulated * circumference) + circumference * 0.25;
    accumulated += pct;
    return { ...cat, dashLen, gap, offset, pct, color: CHART_COLORS[i % CHART_COLORS.length] };
  });

  const hoveredArc = hovered !== null ? arcs[hovered] : null;

  return (
    <div className="flex items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <defs>
            <filter id="mini-ring-glow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <circle cx={center} cy={center} r={radius} fill="none" stroke="white" strokeOpacity={0.04} strokeWidth={strokeWidth} />

          {arcs.map((arc, i) => (
            <motion.circle
              key={arc.category}
              cx={center} cy={center} r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={hovered === i ? strokeWidth + 3 : strokeWidth}
              strokeLinecap="butt"
              strokeDasharray={`${arc.dashLen} ${arc.gap}`}
              strokeDashoffset={arc.offset}
              initial={{ opacity: 0 }}
              animate={{ opacity: hovered === null || hovered === i ? 1 : 0.4 }}
              transition={{ delay: 0.08 * i, duration: 0.5 }}
              style={{
                filter: hovered === i ? "url(#mini-ring-glow)" : undefined,
                cursor: "pointer",
                transition: "stroke-width 0.2s",
              }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
        </svg>

        {/* Center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <AnimatePresence mode="wait">
            {hoveredArc ? (
              <motion.div
                key={hoveredArc.category}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="text-center"
              >
                <span className="text-sm">{FINANCE_CATEGORY_ICONS[hoveredArc.category]}</span>
                <p className="text-[10px] font-mono font-bold text-white">
                  {(hoveredArc.pct * 100).toFixed(0)}%
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="total"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <p className="text-[8px] text-slate-600">TOTAL</p>
                <p className="text-[11px] font-mono font-bold text-white">{formatCurrency(total, true)}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-1 min-w-0">
        {arcs.slice(0, 4).map((arc, i) => (
          <motion.div
            key={arc.category}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.06 }}
            className="flex items-center gap-1.5 cursor-pointer"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: arc.color }} />
            <span className="text-[9px] text-slate-400 truncate">
              {FINANCE_CATEGORY_LABELS[arc.category]?.split(" ")[0]}
            </span>
            <span className="text-[9px] text-slate-600 font-mono ml-auto">
              {(arc.pct * 100).toFixed(0)}%
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
