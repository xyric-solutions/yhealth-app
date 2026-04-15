'use client';

import { motion } from 'framer-motion';
import { useId } from 'react';

interface DoubleRingArcProps {
  progress: number;
  colors: { primary: string; secondary: string; glow: string; tertiary: string };
  type: string;
  delay: number;
  isLoading: boolean;
  extraData?: Record<string, unknown>;
}

const OUTER_RADIUS = 84;
const OUTER_STROKE = 10;
const INNER_RADIUS = 70;
const INNER_STROKE = 6;
const OUTER_CIRC = 2 * Math.PI * OUTER_RADIUS;
const INNER_CIRC = 2 * Math.PI * INNER_RADIUS;

/**
 * Double concentric ring — outer = main progress, inner = quality/recovery.
 * Used for Sleep metric.
 */
export function DoubleRingArc({ progress, colors, delay, isLoading, extraData }: DoubleRingArcProps) {
  const id = useId();

  const outerOffset = OUTER_CIRC - (progress / 100) * OUTER_CIRC;
  const innerProgress = typeof extraData?.quality === 'number' ? Math.min(100, extraData.quality as number) : 0;
  const innerOffset = INNER_CIRC - (innerProgress / 100) * INNER_CIRC;

  return (
    <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <linearGradient id={`dra-outer-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors.primary} />
          <stop offset="100%" stopColor={colors.secondary} />
        </linearGradient>
        <linearGradient id={`dra-inner-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors.tertiary} />
          <stop offset="100%" stopColor={colors.primary} />
        </linearGradient>
        <filter id={`dra-glow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer track */}
      <circle cx="100" cy="100" r={OUTER_RADIUS} fill="none" stroke={`${colors.primary}15`} strokeWidth={OUTER_STROKE} />
      {/* Inner track */}
      <circle cx="100" cy="100" r={INNER_RADIUS} fill="none" stroke={`${colors.tertiary}12`} strokeWidth={INNER_STROKE} />

      {!isLoading && (
        <>
          {/* Outer progress ring (hours) */}
          {progress > 0 && (
            <motion.circle
              cx="100" cy="100" r={OUTER_RADIUS}
              fill="none"
              stroke={`url(#dra-outer-${id})`}
              strokeWidth={OUTER_STROKE}
              strokeLinecap="round"
              strokeDasharray={OUTER_CIRC}
              initial={{ strokeDashoffset: OUTER_CIRC }}
              animate={{ strokeDashoffset: outerOffset }}
              transition={{ duration: 1.4, ease: [0.4, 0, 0.2, 1], delay: delay + 0.2 }}
              filter={`url(#dra-glow-${id})`}
            />
          )}

          {/* Inner progress ring (quality/recovery) */}
          {innerProgress > 0 && (
            <motion.circle
              cx="100" cy="100" r={INNER_RADIUS}
              fill="none"
              stroke={`url(#dra-inner-${id})`}
              strokeWidth={INNER_STROKE}
              strokeLinecap="round"
              strokeDasharray={INNER_CIRC}
              initial={{ strokeDashoffset: INNER_CIRC }}
              animate={{ strokeDashoffset: innerOffset }}
              transition={{ duration: 1.4, ease: [0.4, 0, 0.2, 1], delay: delay + 0.4 }}
              opacity={0.7}
            />
          )}
        </>
      )}

      {isLoading && (
        <motion.circle
          cx="100" cy="100" r={OUTER_RADIUS}
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
