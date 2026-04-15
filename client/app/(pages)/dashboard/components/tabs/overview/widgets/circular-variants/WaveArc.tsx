'use client';

import { motion } from 'framer-motion';
import { useId } from 'react';

interface WaveArcProps {
  progress: number;
  colors: { primary: string; secondary: string; glow: string; tertiary: string };
  type: string;
  delay: number;
  isLoading: boolean;
}

const RADIUS = 82;
const STROKE = 12;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const WAVE_CLIP_RADIUS = 68;

/**
 * Thick outer arc + animated wave fill inside the circle center.
 * Used for Water metric.
 */
export function WaveArc({ progress, colors, delay, isLoading }: WaveArcProps) {
  const id = useId();
  const dashOffset = CIRCUMFERENCE - (progress / 100) * CIRCUMFERENCE;

  // Wave Y position: at 0% = below circle, at 100% = above circle
  // Map progress to Y position within the circle (200px viewBox)
  // Center is 100, wave clip goes from ~168 (bottom) to ~32 (top)
  const waveY = 168 - (progress / 100) * 136;

  return (
    <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <linearGradient id={`wav-grad-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors.primary} />
          <stop offset="100%" stopColor={colors.secondary} />
        </linearGradient>
        <linearGradient id={`wav-fill-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={colors.primary} stopOpacity="0.25" />
          <stop offset="100%" stopColor={colors.secondary} stopOpacity="0.08" />
        </linearGradient>
        <clipPath id={`wav-clip-${id}`}>
          <circle cx="100" cy="100" r={WAVE_CLIP_RADIUS} />
        </clipPath>
        <filter id={`wav-glow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Track */}
      <circle cx="100" cy="100" r={RADIUS} fill="none" stroke={`${colors.primary}15`} strokeWidth={STROKE} />

      {/* Wave fill inside circle (rendered in non-rotated space) */}
      {!isLoading && progress > 0 && (
        <g clipPath={`url(#wav-clip-${id})`} transform="rotate(90 100 100)">
          <motion.path
            d={`M -50 ${waveY} Q -25 ${waveY - 10} 0 ${waveY} T 50 ${waveY} T 100 ${waveY} T 150 ${waveY} T 200 ${waveY} T 250 ${waveY} V 250 H -50 Z`}
            fill={`url(#wav-fill-${id})`}
            initial={{ x: 0, opacity: 0 }}
            animate={{ x: [-50, 0], opacity: 1 }}
            transition={{
              x: { duration: 3, repeat: Infinity, ease: 'linear' },
              opacity: { duration: 0.5, delay: delay + 0.5 },
            }}
          />
          {/* Second wave layer for depth */}
          <motion.path
            d={`M -50 ${waveY + 4} Q -15 ${waveY + 14} 25 ${waveY + 4} T 75 ${waveY + 4} T 125 ${waveY + 4} T 175 ${waveY + 4} T 225 ${waveY + 4} T 275 ${waveY + 4} V 250 H -50 Z`}
            fill={`${colors.primary}10`}
            initial={{ x: 0 }}
            animate={{ x: [0, -50] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          />
        </g>
      )}

      {/* Progress arc */}
      {!isLoading && progress > 0 && (
        <motion.circle
          cx="100" cy="100" r={RADIUS}
          fill="none"
          stroke={`url(#wav-grad-${id})`}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1.4, ease: [0.4, 0, 0.2, 1], delay: delay + 0.2 }}
          filter={`url(#wav-glow-${id})`}
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
