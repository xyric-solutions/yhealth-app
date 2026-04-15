"use client";

import { motion } from "framer-motion";
import { useCountUp } from "../../lib/motion";

interface AnimatedGaugeProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  glowColor?: string;
  label?: string;
  sublabel?: string;
  formatValue?: (v: number) => string;
  showTrack?: boolean;
  trackOpacity?: number;
  delay?: number;
}

export function AnimatedGauge({
  value,
  max,
  size = 120,
  strokeWidth = 8,
  color,
  glowColor,
  label,
  sublabel,
  formatValue,
  showTrack = true,
  trackOpacity = 0.08,
  delay = 0,
}: AnimatedGaugeProps) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const displayValue = useCountUp(value, 1400);
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);
  const glow = glowColor || color;

  const dotAngle = pct * 360 - 90;
  const dotRad = (dotAngle * Math.PI) / 180;
  const dotX = size / 2 + radius * Math.cos(dotRad);
  const dotY = size / 2 + radius * Math.sin(dotRad);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <defs>
            <linearGradient id={`gauge-grad-${color.replace(/[^a-zA-Z0-9]/g, "")}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={glow} stopOpacity="0.6" />
            </linearGradient>
            <filter id={`gauge-glow-${color.replace(/[^a-zA-Z0-9]/g, "")}`}>
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Dashed background track */}
          {showTrack && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="white"
              strokeOpacity={trackOpacity}
              strokeWidth={strokeWidth * 0.4}
              strokeDasharray="2 4"
            />
          )}

          {/* Solid faint track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="white"
            strokeOpacity={0.04}
            strokeWidth={strokeWidth}
          />

          {/* Animated progress arc */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#gauge-grad-${color.replace(/[^a-zA-Z0-9]/g, "")})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            filter={`url(#gauge-glow-${color.replace(/[^a-zA-Z0-9]/g, "")})`}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.8, ease: "easeOut", delay }}
          />

          {/* End dot */}
          {pct > 0.02 && (
            <motion.circle
              cx={dotX}
              cy={dotY}
              r={strokeWidth * 0.6}
              fill={color}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: delay + 1.6, duration: 0.3 }}
            />
          )}
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: delay + 0.3, duration: 0.5 }}
            className="text-lg font-bold text-white font-mono leading-none"
          >
            {formatValue ? formatValue(displayValue) : `${Math.round(displayValue)}%`}
          </motion.span>
          {sublabel && (
            <span className="text-[9px] text-slate-500 mt-0.5">{sublabel}</span>
          )}
        </div>
      </div>

      {label && (
        <span className="text-[10px] font-medium text-slate-400 tracking-wide uppercase">
          {label}
        </span>
      )}
    </div>
  );
}

interface GaugeRowProps {
  gauges: Array<{
    value: number;
    max: number;
    color: string;
    glowColor?: string;
    label: string;
    formatValue?: (v: number) => string;
  }>;
  size?: number;
}

export function GaugeRow({ gauges, size = 100 }: GaugeRowProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex items-center justify-around gap-2 rounded-2xl bg-white/[0.02] border border-white/[0.06] p-5"
    >
      {gauges.map((g, i) => (
        <AnimatedGauge
          key={g.label}
          value={g.value}
          max={g.max}
          size={size}
          color={g.color}
          glowColor={g.glowColor}
          label={g.label}
          formatValue={g.formatValue}
          delay={i * 0.15}
          strokeWidth={7}
        />
      ))}
    </motion.div>
  );
}
