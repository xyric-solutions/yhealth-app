"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CategoryBreakdownItem, FinanceCategory } from "@shared/types/domain/finance";
import { FINANCE_CATEGORY_ICONS, FINANCE_CATEGORY_LABELS } from "@shared/types/domain/finance";
import { CHART_COLORS, formatCurrency } from "../../lib/motion";

interface SpendingRadarProps {
  data: CategoryBreakdownItem[];
  size?: number;
  maxCategories?: number;
}

export function SpendingRadar({ data, size = 280, maxCategories = 8 }: SpendingRadarProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const items = data.slice(0, maxCategories);
  if (items.length < 3) return null;

  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.38;
  const rings = 4;
  const maxVal = Math.max(...items.map(i => i.amount), 1);

  const angleStep = (2 * Math.PI) / items.length;
  const startAngle = -Math.PI / 2;

  const getPoint = (index: number, radius: number) => ({
    x: cx + radius * Math.cos(startAngle + index * angleStep),
    y: cy + radius * Math.sin(startAngle + index * angleStep),
  });

  const dataPoints = items.map((item, i) => {
    const r = (item.amount / maxVal) * maxR;
    return { ...getPoint(i, r), amount: item.amount, category: item.category, r };
  });

  const polygonPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  const hoveredItem = hovered !== null ? { ...items[hovered], ...dataPoints[hovered] } : null;

  return (
    <div className="relative flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
        <defs>
          <radialGradient id="radar-fill-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#059669" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#0284c7" stopOpacity="0.05" />
          </radialGradient>
          <filter id="radar-glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Concentric rings */}
        {Array.from({ length: rings }).map((_, i) => {
          const r = ((i + 1) / rings) * maxR;
          return (
            <circle key={i} cx={cx} cy={cy} r={r}
              fill="none" stroke="white" strokeOpacity={0.04} strokeWidth={1}
            />
          );
        })}

        {/* Axis lines */}
        {items.map((_, i) => {
          const end = getPoint(i, maxR + 8);
          return (
            <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y}
              stroke="white" strokeOpacity={0.06} strokeWidth={1}
            />
          );
        })}

        {/* Filled polygon */}
        <motion.path
          d={polygonPath}
          fill="url(#radar-fill-grad)"
          stroke="url(#radar-fill-grad)"
          strokeWidth="0"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />

        {/* Polygon outline with glow */}
        <motion.path
          d={polygonPath}
          fill="none"
          stroke="#34d399"
          strokeWidth="2"
          strokeLinejoin="round"
          filter="url(#radar-glow)"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.8 }}
          transition={{ duration: 2, ease: "easeOut" }}
        />

        {/* Data points */}
        {dataPoints.map((p, i) => {
          const isHov = hovered === i;
          const color = CHART_COLORS[i % CHART_COLORS.length];
          return (
            <g key={i}>
              <motion.circle
                cx={p.x} cy={p.y} r={isHov ? 7 : 5}
                fill="#0f172a" stroke={color} strokeWidth={isHov ? 3 : 2}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8 + i * 0.08, duration: 0.3 }}
                style={{
                  filter: isHov ? `drop-shadow(0 0 8px ${color}80)` : undefined,
                  cursor: "pointer",
                }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
              {/* Invisible larger hit area */}
              <circle
                cx={p.x} cy={p.y} r={18} fill="transparent"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                className="cursor-pointer"
              />
            </g>
          );
        })}

        {/* Category labels around the chart */}
        {items.map((item, i) => {
          const labelR = maxR + 22;
          const pos = getPoint(i, labelR);
          const isLeft = pos.x < cx - 10;
          const isRight = pos.x > cx + 10;

          return (
            <g key={item.category}>
              <text
                x={pos.x}
                y={pos.y}
                textAnchor={isLeft ? "end" : isRight ? "start" : "middle"}
                dominantBaseline="central"
                fill={hovered === i ? "#e2e8f0" : "#64748b"}
                fontSize="10"
                fontWeight={hovered === i ? 600 : 400}
                className="cursor-pointer transition-all"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                {FINANCE_CATEGORY_ICONS[item.category]} {FINANCE_CATEGORY_LABELS[item.category]?.split(" ")[0]}
              </text>
            </g>
          );
        })}

        {/* Center dot */}
        <circle cx={cx} cy={cy} r="3" fill="#34d399" fillOpacity="0.4" />
      </svg>

      {/* Tooltip */}
      <AnimatePresence>
        {hoveredItem && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute z-20 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          >
            <div className="bg-[#0c1322]/95 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 shadow-2xl text-center">
              <p className="text-lg mb-0.5">{FINANCE_CATEGORY_ICONS[hoveredItem.category]}</p>
              <p className="text-xs text-slate-400 font-medium">
                {FINANCE_CATEGORY_LABELS[hoveredItem.category]}
              </p>
              <p className="text-sm font-bold text-white font-mono mt-1">
                {formatCurrency(hoveredItem.amount)}
              </p>
              <p className="text-[10px] text-slate-500">
                {hoveredItem.percentage.toFixed(1)}% of total
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
