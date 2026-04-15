'use client';

import { motion } from 'framer-motion';
import { useId, useMemo } from 'react';
import { polarToCartesian } from './arc-utils';

interface TickMarkedArcProps {
  progress: number;
  colors: { primary: string; secondary: string; glow: string; tertiary: string };
  type: string;
  delay: number;
  isLoading: boolean;
}

const RADIUS = 80;
const STROKE = 14;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const TICK_COUNT = 24;
const TICK_INNER_R = 92;
const TICK_OUTER_R = 97;

/**
 * Thick arc with tick marks around the perimeter that light up with progress.
 * Used for Health Score metric.
 */
export function TickMarkedArc({ progress, colors, delay, isLoading }: TickMarkedArcProps) {
  const id = useId();
  const dashOffset = CIRCUMFERENCE - (progress / 100) * CIRCUMFERENCE;
  const filledTicks = Math.round((progress / 100) * TICK_COUNT);

  const ticks = useMemo(() => {
    return Array.from({ length: TICK_COUNT }, (_, i) => {
      const angleDeg = (i / TICK_COUNT) * 360 - 90;
      const inner = polarToCartesian(100, 100, TICK_INNER_R, angleDeg);
      const outer = polarToCartesian(100, 100, TICK_OUTER_R, angleDeg);
      return { inner, outer, filled: i < filledTicks, index: i };
    });
  }, [filledTicks]);

  return (
    <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <linearGradient id={`tma-grad-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors.primary} />
          <stop offset="50%" stopColor={colors.secondary} />
          <stop offset="100%" stopColor={colors.primary} />
        </linearGradient>
        <filter id={`tma-glow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Track */}
      <circle cx="100" cy="100" r={RADIUS} fill="none" stroke={`${colors.primary}12`} strokeWidth={STROKE} />

      {/* Tick marks */}
      {ticks.map((tick) => (
        <motion.line
          key={tick.index}
          x1={tick.inner.x} y1={tick.inner.y}
          x2={tick.outer.x} y2={tick.outer.y}
          stroke={tick.filled ? colors.tertiary : 'rgba(255,255,255,0.08)'}
          strokeWidth={2}
          strokeLinecap="round"
          initial={{ opacity: 0 }}
          animate={{ opacity: tick.filled ? 0.9 : 0.4 }}
          transition={{ duration: 0.2, delay: delay + 0.3 + tick.index * 0.03 }}
        />
      ))}

      {/* Main progress arc */}
      {!isLoading && progress > 0 && (
        <motion.circle
          cx="100" cy="100" r={RADIUS}
          fill="none"
          stroke={`url(#tma-grad-${id})`}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1.4, ease: [0.4, 0, 0.2, 1], delay: delay + 0.2 }}
          filter={`url(#tma-glow-${id})`}
        />
      )}

      {isLoading && (
        <motion.circle
          cx="100" cy="100" r={RADIUS}
          fill="none" stroke={colors.primary} strokeWidth="4"
          strokeLinecap="round" strokeDasharray="30 100"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: '100px 100px' }}
        />
      )}
    </svg>
  );
}
