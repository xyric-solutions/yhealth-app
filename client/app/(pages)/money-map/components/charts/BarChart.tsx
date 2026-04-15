"use client";

import { motion } from "framer-motion";

interface BarChartSeries {
  label: string;
  values: number[];
  color: string;
}

interface BarChartProps {
  labels: string[];
  series: BarChartSeries[];
  height?: number;
  showValues?: boolean;
  formatValue?: (v: number) => string;
}

function formatK(v: number): string {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function BarChart({
  labels,
  series,
  height = 180,
  showValues = true,
  formatValue = formatK,
}: BarChartProps) {
  if (labels.length === 0) return null;

  const width = 400;
  const padLeft = showValues ? 45 : 10;
  const padRight = 10;
  const padTop = 10;
  const padBottom = 28;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const allValues = series.flatMap(s => s.values);
  const max = Math.max(...allValues, 1);
  const gridLines = 4;
  const barGroupWidth = chartW / labels.length;
  const barsPerGroup = series.length;
  const barWidth = Math.min((barGroupWidth * 0.7) / barsPerGroup, 24);
  const groupGap = barGroupWidth - barWidth * barsPerGroup;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
      {/* Grid */}
      {Array.from({ length: gridLines + 1 }).map((_, i) => {
        const y = padTop + (i / gridLines) * chartH;
        return (
          <g key={i}>
            <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="#1e293b" strokeWidth="1" />
            {showValues && (
              <text x={padLeft - 6} y={y + 4} textAnchor="end" fill="#475569" fontSize="9" fontFamily="monospace">
                {formatValue(max * (1 - i / gridLines))}
              </text>
            )}
          </g>
        );
      })}

      {/* Bars */}
      {labels.map((label, li) => {
        const groupX = padLeft + li * barGroupWidth + groupGap / 2;
        return (
          <g key={label}>
            {series.map((s, si) => {
              const val = s.values[li] || 0;
              const barH = (val / max) * chartH;
              const x = groupX + si * barWidth;
              const y = padTop + chartH - barH;

              return (
                <motion.rect
                  key={si}
                  x={x}
                  y={padTop + chartH}
                  width={barWidth - 1}
                  rx={3}
                  fill={s.color}
                  fillOpacity={0.8}
                  initial={{ height: 0, y: padTop + chartH }}
                  animate={{ height: barH, y }}
                  transition={{ duration: 0.6, delay: 0.05 * li + 0.02 * si, ease: "easeOut" }}
                  className="cursor-pointer hover:fill-opacity-100 transition-all"
                />
              );
            })}
            {/* Label */}
            <text
              x={groupX + (barsPerGroup * barWidth) / 2}
              y={height - 4}
              textAnchor="middle"
              fill="#64748b"
              fontSize="10"
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
