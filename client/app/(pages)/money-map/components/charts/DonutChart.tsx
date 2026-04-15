"use client";

import { motion } from "framer-motion";

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string;
}

export function DonutChart({
  segments,
  size = 160,
  strokeWidth = 20,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return null;

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  let accumulated = 0;
  const arcs = segments.map((seg) => {
    const pct = seg.value / total;
    const dashLen = pct * circumference;
    const gap = circumference - dashLen;
    const offset = -(accumulated * circumference) + circumference * 0.25; // start from top
    accumulated += pct;
    return { ...seg, dashLen, gap, offset, pct };
  });

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background ring */}
        <circle
          cx={center} cy={center} r={radius}
          fill="none" stroke="#1e293b" strokeWidth={strokeWidth}
        />
        {/* Segments */}
        {arcs.map((arc, i) => (
          <motion.circle
            key={i}
            cx={center} cy={center} r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
            strokeDasharray={`${arc.dashLen} ${arc.gap}`}
            strokeDashoffset={arc.offset}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 * i, duration: 0.5 }}
            className="cursor-pointer hover:brightness-125 transition-all"
          />
        ))}
      </svg>
      {/* Center text */}
      {(centerLabel || centerValue) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerLabel && <p className="text-[10px] text-slate-500">{centerLabel}</p>}
          {centerValue && (
            <motion.p
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="text-lg font-bold text-white font-mono"
            >
              {centerValue}
            </motion.p>
          )}
        </div>
      )}
    </div>
  );
}
