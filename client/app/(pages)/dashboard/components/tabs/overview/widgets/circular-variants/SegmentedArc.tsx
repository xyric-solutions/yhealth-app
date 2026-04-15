'use client';

import { motion } from 'framer-motion';
import { useId } from 'react';

interface SegmentedArcProps {
  progress: number;
  colors: { primary: string; secondary: string; glow: string; tertiary: string };
  type: string;
  delay: number;
  isLoading: boolean;
}

const RADIUS = 82;
const STROKE = 6;
const SEGMENT_COUNT = 36;
const GAP_DEG = 2;
const SEGMENT_DEG = (360 - SEGMENT_COUNT * GAP_DEG) / SEGMENT_COUNT;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Segmented arc — thin discrete dashes that light up based on progress.
 * A mask clips the bright gradient layer to the filled portion.
 * Used for Consistency metric.
 */
export function SegmentedArc({ progress, colors, delay, isLoading }: SegmentedArcProps) {
  const id = useId();

  // Dash pattern that creates uniform segments
  const segLen = (SEGMENT_DEG / 360) * CIRCUMFERENCE;
  const gapLen = (GAP_DEG / 360) * CIRCUMFERENCE;
  const dashPattern = `${segLen} ${gapLen}`;

  // Mask: solid arc covering only the filled portion
  const maskOffset = CIRCUMFERENCE - (progress / 100) * CIRCUMFERENCE;

  return (
    <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <linearGradient id={`seg-grad-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors.primary} />
          <stop offset="100%" stopColor={colors.secondary} />
        </linearGradient>
        <filter id={`seg-glow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        {/* Mask: a continuous arc that reveals only the filled portion */}
        <mask id={`seg-mask-${id}`}>
          <motion.circle
            cx="100" cy="100" r={RADIUS}
            fill="none"
            stroke="white"
            strokeWidth={STROKE + 4}
            strokeLinecap="butt"
            strokeDasharray={CIRCUMFERENCE}
            initial={{ strokeDashoffset: CIRCUMFERENCE }}
            animate={{ strokeDashoffset: maskOffset }}
            transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1], delay: delay + 0.2 }}
          />
        </mask>
      </defs>

      {/* Track — all segments dimmed */}
      <circle
        cx="100" cy="100" r={RADIUS}
        fill="none"
        stroke={`${colors.primary}18`}
        strokeWidth={STROKE}
        strokeDasharray={dashPattern}
        strokeLinecap="butt"
      />

      {/* Filled segments — masked to show only up to progress */}
      {!isLoading && progress > 0 && (
        <g mask={`url(#seg-mask-${id})`}>
          <circle
            cx="100" cy="100" r={RADIUS}
            fill="none"
            stroke={`url(#seg-grad-${id})`}
            strokeWidth={STROKE}
            strokeDasharray={dashPattern}
            strokeLinecap="butt"
            filter={`url(#seg-glow-${id})`}
          />
        </g>
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
