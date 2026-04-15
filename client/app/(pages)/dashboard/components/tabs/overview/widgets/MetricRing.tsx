'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface MetricRingProps {
  /** Current value */
  value: number;
  /** Maximum value (ring fills to value/max) */
  max: number;
  /** Display label below the value */
  label: string;
  /** Unit suffix (e.g., "bpm", "hrs", "%") */
  unit?: string;
  /** Subtitle text below value */
  subtitle?: string;
  /** Ring stroke color */
  color: string;
  /** Optional second ring (for multi-ring metrics) */
  secondaryRings?: Array<{ value: number; max: number; color: string; label?: string }>;
  /** Ring diameter in px */
  size?: number;
  /** Ring stroke width */
  strokeWidth?: number;
  /** Enable breathing pulse glow for live metrics */
  isLive?: boolean;
  /** Format value display (e.g., add commas) */
  formatValue?: (v: number) => string;
  /** Click handler */
  onClick?: () => void;
}

/**
 * Premium animated SVG metric ring with:
 * - Arc draw animation (0 → target, 1.2s spring)
 * - Tick-up number counter (800ms easeOut)
 * - Breathing pulse glow on live metrics
 * - Specular highlight for glass realism
 * - Optional multi-ring support (concentric arcs)
 */
export function MetricRing({
  value,
  max,
  label,
  unit,
  subtitle,
  color,
  secondaryRings,
  size = 120,
  strokeWidth = 6,
  isLive = false,
  formatValue,
  onClick,
}: MetricRingProps) {
  const ratio = max > 0 ? Math.min(value / max, 1) : 0;
  const r = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * r;
  const center = size / 2;

  // ── tick-up counter ──
  const springVal = useSpring(0, { stiffness: 60, damping: 20 });
  const displayVal = useTransform(springVal, (v) => {
    const formatted = formatValue ? formatValue(Math.round(v)) : Math.round(v).toString();
    return formatted;
  });
  const [displayText, setDisplayText] = useState(formatValue ? formatValue(0) : '0');

  useEffect(() => {
    springVal.set(value);
    const unsub = displayVal.on('change', (v) => setDisplayText(v));
    return unsub;
  }, [value, springVal, displayVal]);

  return (
    <motion.div
      className="flex flex-col items-center gap-1.5 cursor-pointer group"
      onClick={onClick}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          {/* ── track ── */}
          <circle
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeWidth}
          />

          {/* ── secondary rings (inner) ── */}
          {secondaryRings?.map((ring, i) => {
            const innerR = r - (i + 1) * (strokeWidth + 4);
            const innerCirc = 2 * Math.PI * innerR;
            const innerRatio = ring.max > 0 ? Math.min(ring.value / ring.max, 1) : 0;
            return (
              <g key={i}>
                <circle
                  cx={center}
                  cy={center}
                  r={innerR}
                  fill="none"
                  stroke="rgba(255,255,255,0.04)"
                  strokeWidth={strokeWidth - 1}
                />
                <motion.circle
                  cx={center}
                  cy={center}
                  r={innerR}
                  fill="none"
                  stroke={ring.color}
                  strokeWidth={strokeWidth - 1}
                  strokeLinecap="round"
                  strokeDasharray={innerCirc}
                  initial={{ strokeDashoffset: innerCirc }}
                  animate={{ strokeDashoffset: innerCirc * (1 - innerRatio) }}
                  transition={{ duration: 1.2, delay: 0.2 + i * 0.15, ease: [0.4, 0, 0.2, 1] }}
                  style={{ filter: `drop-shadow(0 0 4px ${ring.color}60)` }}
                />
              </g>
            );
          })}

          {/* ── primary arc ── */}
          <motion.circle
            cx={center}
            cy={center}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - ratio) }}
            transition={{ duration: 1.2, delay: 0.1, ease: [0.4, 0, 0.2, 1] }}
            style={{ filter: `drop-shadow(0 0 6px ${color}50)` }}
          />

          {/* ── live pulse glow ring ── */}
          {isLive && (
            <motion.circle
              cx={center}
              cy={center}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth + 4}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - ratio)}
              animate={{ opacity: [0.15, 0.35, 0.15] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              style={{ filter: `blur(4px)` }}
            />
          )}
        </svg>

        {/* ── center content ── */}
        <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
          <span
            className="font-bold tabular-nums leading-none"
            style={{ color, fontSize: size * 0.2 }}
          >
            {displayText}
            {unit && (
              <span className="font-normal text-white/50" style={{ fontSize: size * 0.11 }}>
                {unit}
              </span>
            )}
          </span>
          {subtitle && (
            <span className="text-white/40 mt-0.5 text-center leading-tight" style={{ fontSize: Math.max(size * 0.08, 9) }}>
              {subtitle}
            </span>
          )}
          {/* secondary ring labels */}
          {secondaryRings && secondaryRings.length > 0 && (
            <div className="flex gap-1 mt-1">
              {secondaryRings.map((ring, i) => (
                <span key={i} className="font-medium" style={{ fontSize: 8, color: ring.color }}>
                  {ring.label || `${Math.round((ring.value / Math.max(ring.max, 1)) * 100)}`}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── specular highlight ── */}
        <div
          className="absolute pointer-events-none rounded-full"
          style={{
            top: '12%',
            left: '18%',
            width: '25%',
            height: '15%',
            background: 'radial-gradient(ellipse, rgba(255,255,255,0.12) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* ── label ── */}
      <span className="text-[11px] text-white/60 font-medium tracking-wide text-center">
        {label}
      </span>
    </motion.div>
  );
}
