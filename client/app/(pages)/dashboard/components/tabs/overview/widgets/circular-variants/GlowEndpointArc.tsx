'use client';

import { motion } from 'framer-motion';
import { useId, useMemo } from 'react';
import { polarToCartesian } from './arc-utils';

interface GlowEndpointArcProps {
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
 * Thick gradient arc with a pulsing glowing dot at the progress endpoint — used for Calories.
 */
export function GlowEndpointArc({ progress, colors, type, delay, isLoading }: GlowEndpointArcProps) {
  const id = useId();
  const dashOffset = CIRCUMFERENCE - (progress / 100) * CIRCUMFERENCE;

  // Calculate endpoint position (progress arc starts at top = -90°)
  const endpoint = useMemo(() => {
    const angleDeg = (progress / 100) * 360 - 90;
    return polarToCartesian(100, 100, RADIUS, angleDeg);
  }, [progress]);

  return (
    <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <linearGradient id={`gea-grad-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors.primary} />
          <stop offset="100%" stopColor={colors.secondary} />
        </linearGradient>
        <filter id={`gea-glow-${id}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <filter id={`gea-dot-glow-${id}`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      {/* Track */}
      <circle cx="100" cy="100" r={RADIUS} fill="none" stroke={`${colors.primary}18`} strokeWidth={STROKE} />

      {/* Progress arc */}
      {!isLoading && progress > 0 && (
        <>
          <motion.circle
            cx="100" cy="100" r={RADIUS}
            fill="none"
            stroke={`url(#gea-grad-${id})`}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            initial={{ strokeDashoffset: CIRCUMFERENCE }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 1.4, ease: [0.4, 0, 0.2, 1], delay: delay + 0.2 }}
            filter={`url(#gea-glow-${id})`}
          />

          {/* Outer glow halo at endpoint */}
          <motion.circle
            cx={endpoint.x} cy={endpoint.y} r={12}
            fill={colors.primary}
            filter={`url(#gea-dot-glow-${id})`}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity, delay: delay + 1.2 }}
          />

          {/* Solid dot at endpoint */}
          <motion.circle
            cx={endpoint.x} cy={endpoint.y}
            fill={colors.tertiary}
            initial={{ r: 0, opacity: 0 }}
            animate={{ r: [5, 7, 5], opacity: 1 }}
            transition={{
              r: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
              opacity: { duration: 0.3, delay: delay + 1 },
            }}
          />
        </>
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
