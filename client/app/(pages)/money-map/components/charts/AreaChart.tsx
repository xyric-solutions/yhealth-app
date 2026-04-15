"use client";

import { motion } from "framer-motion";

interface AreaChartProps {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
  showLabels?: boolean;
  showGrid?: boolean;
  showValues?: boolean;
  formatValue?: (v: number) => string;
}

function formatK(v: number): string {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function AreaChart({
  data,
  color = "#06b6d4",
  height = 160,
  showLabels = true,
  showGrid = true,
  showValues = true,
  formatValue = formatK,
}: AreaChartProps) {
  if (data.length < 2) return null;

  const width = 400;
  const padLeft = showValues ? 45 : 10;
  const padRight = 10;
  const padTop = 10;
  const padBottom = showLabels ? 28 : 10;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const max = Math.max(...data.map(d => d.value), 1);
  const gridLines = 4;

  const points = data.map((d, i) => ({
    x: padLeft + (i / (data.length - 1)) * chartW,
    y: padTop + (1 - d.value / max) * chartH,
  }));

  // Smooth curve using cubic bezier
  const lineD = points.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = points[i - 1];
    const cpx = (prev.x + p.x) / 2;
    return `${acc} C ${cpx} ${prev.y}, ${cpx} ${p.y}, ${p.x} ${p.y}`;
  }, "");

  const fillD = `${lineD} L ${points[points.length - 1].x} ${padTop + chartH} L ${points[0].x} ${padTop + chartH} Z`;

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
      <defs>
        <linearGradient id={`areaGrad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {showGrid && Array.from({ length: gridLines + 1 }).map((_, i) => {
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

      {/* Fill */}
      <motion.path
        d={fillD}
        fill={`url(#areaGrad-${color.replace("#", "")})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      />

      {/* Line */}
      <motion.path
        d={lineD}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
      />

      {/* Data points */}
      {points.map((p, i) => (
        <motion.circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="3.5"
          fill="#0f172a"
          stroke={color}
          strokeWidth="2"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 * i + 0.5, duration: 0.2 }}
          className="cursor-pointer"
        />
      ))}

      {/* X-axis labels */}
      {showLabels && data.map((d, i) => (
        <text
          key={i}
          x={padLeft + (i / (data.length - 1)) * chartW}
          y={height - 4}
          textAnchor="middle"
          fill="#64748b"
          fontSize="10"
        >
          {d.label}
        </text>
      ))}
    </svg>
  );
}
