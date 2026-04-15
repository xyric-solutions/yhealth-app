"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CashFlowWaveProps {
  data: Array<{ label: string; income: number; expense: number }>;
  height?: number;
}

function formatK(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

export function CashFlowWave({ data, height = 220 }: CashFlowWaveProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (data.length < 2) return null;

  const width = 500;
  const padL = 48;
  const padR = 16;
  const padT = 16;
  const padB = 30;
  const cW = width - padL - padR;
  const cH = height - padT - padB;

  const allVals = data.flatMap(d => [d.income, d.expense]);
  const maxVal = Math.max(...allVals, 1);
  const gridLines = 4;

  const toX = (i: number) => padL + (i / (data.length - 1)) * cW;
  const toY = (v: number) => padT + (1 - v / maxVal) * cH;

  const incomePoints = data.map((d, i) => ({ x: toX(i), y: toY(d.income) }));
  const expensePoints = data.map((d, i) => ({ x: toX(i), y: toY(d.expense) }));

  const buildCurve = (pts: { x: number; y: number }[]) =>
    pts.reduce((acc, p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`;
      const prev = pts[i - 1];
      const cpx = (prev.x + p.x) / 2;
      return `${acc} C ${cpx} ${prev.y}, ${cpx} ${p.y}, ${p.x} ${p.y}`;
    }, "");

  const buildFill = (pts: { x: number; y: number }[], curve: string) =>
    `${curve} L ${pts[pts.length - 1].x} ${padT + cH} L ${pts[0].x} ${padT + cH} Z`;

  const incomeCurve = buildCurve(incomePoints);
  const expenseCurve = buildCurve(expensePoints);
  const incomeFill = buildFill(incomePoints, incomeCurve);
  const expenseFill = buildFill(expensePoints, expenseCurve);

  const hoveredData = hovered !== null ? data[hovered] : null;

  return (
    <div className="relative w-full">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="overflow-visible"
        onMouseLeave={() => setHovered(null)}
      >
        <defs>
          <linearGradient id="cashflow-income-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#059669" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#059669" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="cashflow-expense-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#f43f5e" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="cashflow-income-line" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#059669" />
            <stop offset="50%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="cashflow-expense-line" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f43f5e" />
            <stop offset="50%" stopColor="#fb7185" />
            <stop offset="100%" stopColor="#f43f5e" />
          </linearGradient>
          <filter id="cashflow-glow-green">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="cashflow-glow-red">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid */}
        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const y = padT + (i / gridLines) * cH;
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" />
              <text x={padL - 8} y={y + 4} textAnchor="end" fill="#475569" fontSize="9" fontFamily="monospace">
                {formatK(maxVal * (1 - i / gridLines))}
              </text>
            </g>
          );
        })}

        {/* Income fill + line */}
        <motion.path
          d={incomeFill}
          fill="url(#cashflow-income-grad)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        />
        <motion.path
          d={incomeCurve}
          fill="none"
          stroke="url(#cashflow-income-line)"
          strokeWidth="2.5"
          strokeLinecap="round"
          filter="url(#cashflow-glow-green)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />

        {/* Expense fill + line */}
        <motion.path
          d={expenseFill}
          fill="url(#cashflow-expense-grad)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        />
        <motion.path
          d={expenseCurve}
          fill="none"
          stroke="url(#cashflow-expense-line)"
          strokeWidth="2"
          strokeLinecap="round"
          filter="url(#cashflow-glow-red)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
        />

        {/* Interactive hover columns */}
        {data.map((d, i) => {
          const x = toX(i);
          const colW = cW / (data.length - 1);
          return (
            <g key={i}>
              <rect
                x={x - colW / 2}
                y={padT}
                width={colW}
                height={cH}
                fill="transparent"
                onMouseEnter={() => setHovered(i)}
                className="cursor-pointer"
              />
              {hovered === i && (
                <>
                  <line x1={x} y1={padT} x2={x} y2={padT + cH} stroke="#475569" strokeWidth="1" strokeDasharray="3 3" />
                  <circle cx={x} cy={incomePoints[i].y} r="5" fill="#0f172a" stroke="#34d399" strokeWidth="2.5" />
                  <circle cx={x} cy={expensePoints[i].y} r="5" fill="#0f172a" stroke="#fb7185" strokeWidth="2.5" />
                </>
              )}
            </g>
          );
        })}

        {/* Income dots */}
        {incomePoints.map((p, i) => (
          <motion.circle
            key={`inc-${i}`}
            cx={p.x}
            cy={p.y}
            r="3"
            fill="#059669"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: hovered === null || hovered === i ? 0.8 : 0.3, scale: 1 }}
            transition={{ delay: 0.1 * i + 0.8, duration: 0.2 }}
          />
        ))}

        {/* Expense dots */}
        {expensePoints.map((p, i) => (
          <motion.circle
            key={`exp-${i}`}
            cx={p.x}
            cy={p.y}
            r="3"
            fill="#f43f5e"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: hovered === null || hovered === i ? 0.8 : 0.3, scale: 1 }}
            transition={{ delay: 0.1 * i + 1, duration: 0.2 }}
          />
        ))}

        {/* X labels */}
        {data.map((d, i) => (
          <text
            key={i}
            x={toX(i)}
            y={height - 4}
            textAnchor="middle"
            fill={hovered === i ? "#e2e8f0" : "#64748b"}
            fontSize="10"
            fontWeight={hovered === i ? 600 : 400}
          >
            {d.label}
          </text>
        ))}
      </svg>

      {/* Hover Tooltip */}
      <AnimatePresence>
        {hoveredData && hovered !== null && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute z-20 pointer-events-none"
            style={{
              left: `${((toX(hovered) / width) * 100)}%`,
              top: -8,
              transform: "translateX(-50%)",
            }}
          >
            <div className="bg-[#0c1322]/95 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 shadow-2xl min-w-[170px]">
              <p className="text-[10px] text-slate-400 font-medium mb-2">{hoveredData.label}</p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                    Income
                  </span>
                  <span className="text-emerald-400 font-mono">{formatK(hoveredData.income)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.5)]" />
                    Expenses
                  </span>
                  <span className="text-rose-400 font-mono">{formatK(hoveredData.expense)}</span>
                </div>
                <div className="border-t border-white/5 pt-1.5 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Net</span>
                  <span className={`font-mono font-semibold ${hoveredData.income - hoveredData.expense >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {hoveredData.income - hoveredData.expense >= 0 ? "+" : ""}{formatK(hoveredData.income - hoveredData.expense)}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
