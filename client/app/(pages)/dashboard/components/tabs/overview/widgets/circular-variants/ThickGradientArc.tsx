'use client';

import { motion } from 'framer-motion';
import { useId } from 'react';

interface ThickGradientArcProps {
  progress: number;
  colors: { primary: string; secondary: string; glow: string; tertiary: string };
  type: string;
  delay: number;
  isLoading: boolean;
}

const RADIUS = 82;
const STROKE = 12;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Clean thick gradient arc with glow — used for WHOOP Age and as default fallback.
 */
export function ThickGradientArc({ progress, colors, type, delay, isLoading }: ThickGradientArcProps) {
  const id = useId();
  const dashOffset = CIRCUMFERENCE - (progress / 100) * CIRCUMFERENCE;

  return (
    <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <linearGradient id={`tga-grad-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors.primary} />
          <stop offset="100%" stopColor={colors.secondary} />
        </linearGradient>
        <filter id={`tga-glow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Track */}
      <circle cx="100" cy="100" r={RADIUS} fill="none" stroke={`${colors.primary}18`} strokeWidth={STROKE} />

      {/* Progress arc */}
      {!isLoading && progress > 0 && (
        <motion.circle
          cx="100" cy="100" r={RADIUS}
          fill="none"
          stroke={`url(#tga-grad-${id})`}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={{ duration: 1.4, ease: [0.4, 0, 0.2, 1], delay: delay + 0.2 }}
          filter={`url(#tga-glow-${id})`}
        />
      )}

      {/* Loading spinner */}
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
