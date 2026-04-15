"use client";

import { useState, useMemo } from "react";
import { motion, type Variants } from "framer-motion";
import type { CategoryBreakdownItem } from "@shared/types/domain/finance";
import { FINANCE_CATEGORY_LABELS, FINANCE_CATEGORY_ICONS } from "@shared/types/domain/finance";
import {
  AnimatedCurrency,
  formatCurrency,
  scaleIn,
  CHART_COLORS,
} from "../../lib/motion";

interface SpendingOrbitProps {
  categories: CategoryBreakdownItem[];
  totalExpense: number;
}

const RING_WIDTH = 8;
const RING_GAP = 4;
const START_RADIUS = 90;
const MAX_RINGS = 6;

const containerVariants: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  show: {
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 30,
      staggerChildren: 0.1,
    },
  },
};

const ringVariants: Variants = {
  hidden: { strokeDashoffset: 1 },
  show: {
    strokeDashoffset: 0,
    transition: { duration: 1.2, ease: "easeOut" },
  },
};

export function SpendingOrbit({ categories, totalExpense }: SpendingOrbitProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  const rings = useMemo(() => {
    const sorted = [...categories]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, MAX_RINGS);
    return sorted;
  }, [categories]);

  const outerRadius = START_RADIUS + (MAX_RINGS - 1) * (RING_WIDTH + RING_GAP);
  const svgSize = (outerRadius + RING_WIDTH + 2) * 2;
  const center = svgSize / 2;

  const hoveredItem = hovered !== null ? rings[hovered] : null;

  return (
    <motion.div
      variants={scaleIn}
      initial="hidden"
      animate="show"
      className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.03] p-6"
    >
      <h3 className="mb-4 self-start font-[family-name:var(--font-syne)] text-sm font-semibold tracking-wide text-white/60 uppercase">
        Spending Breakdown
      </h3>

      <div className="relative">
        <svg
          width={svgSize}
          height={svgSize}
          viewBox={`0 0 ${svgSize} ${svgSize}`}
          className="overflow-visible"
        >
          <motion.g
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {rings.map((item, i) => {
              const radius = START_RADIUS + i * (RING_WIDTH + RING_GAP);
              const circumference = 2 * Math.PI * radius;
              const proportion = totalExpense > 0 ? item.amount / totalExpense : 0;
              const strokeLength = circumference * proportion;
              const gapLength = circumference - strokeLength;
              const color = CHART_COLORS[i % CHART_COLORS.length];
              const isHovered = hovered === i;

              return (
                <g key={item.category}>
                  {/* Background track */}
                  <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.04)"
                    strokeWidth={RING_WIDTH}
                  />
                  {/* Filled arc */}
                  <motion.circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={isHovered ? RING_WIDTH + 3 : RING_WIDTH}
                    strokeLinecap="round"
                    strokeDasharray={`${strokeLength} ${gapLength}`}
                    transform={`rotate(-90 ${center} ${center})`}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: circumference - strokeLength }}
                    transition={{ duration: 1.2, ease: "easeOut", delay: i * 0.1 }}
                    style={{
                      filter: isHovered ? `drop-shadow(0 0 6px ${color}60)` : undefined,
                      cursor: "pointer",
                      transition: "stroke-width 0.2s, filter 0.2s",
                    }}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                  />
                </g>
              );
            })}
          </motion.g>
        </svg>

        {/* Center label */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {hoveredItem ? (
            <motion.div
              key={hoveredItem.category}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center"
            >
              <span className="text-lg">
                {FINANCE_CATEGORY_ICONS[hoveredItem.category]}
              </span>
              <span className="mt-1 text-xs font-medium text-white/60">
                {FINANCE_CATEGORY_LABELS[hoveredItem.category]}
              </span>
              <span className="font-mono text-sm font-semibold text-white">
                {formatCurrency(hoveredItem.amount)}
              </span>
              <span className="font-mono text-xs text-white/40">
                {hoveredItem.percentage.toFixed(1)}%
              </span>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center">
              <span className="text-xs font-medium text-white/40 uppercase">
                Total
              </span>
              <AnimatedCurrency
                value={totalExpense}
                compact
                className="font-mono text-xl font-bold text-white"
              />
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        {rings.map((item, i) => (
          <motion.div
            key={item.category}
            className="flex items-center gap-1.5 text-xs text-white/50 cursor-pointer hover:text-white/80 transition-colors"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            whileHover={{ scale: 1.1 }}
          >
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
              className="text-sm"
            >
              {FINANCE_CATEGORY_ICONS[item.category]}
            </motion.span>
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
            />
            {FINANCE_CATEGORY_LABELS[item.category]}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
