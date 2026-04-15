'use client';

import { motion } from 'framer-motion';
import { useId, useMemo } from 'react';

interface MultiRingArcProps {
  progress: number;
  colors: { primary: string; secondary: string; glow: string; tertiary: string };
  type: string;
  delay: number;
  isLoading: boolean;
  extraData?: Record<string, unknown>;
}

interface RingConfig {
  radius: number;
  stroke: number;
  color: string;
  progress: number;
  label: string;
}

const RING_CONFIGS: Array<{ radius: number; stroke: number; color: string; label: string }> = [
  { radius: 86, stroke: 7, color: '#ec4899', label: 'P' },  // Protein — pink
  { radius: 74, stroke: 7, color: '#f59e0b', label: 'C' },  // Carbs — amber
  { radius: 62, stroke: 7, color: '#a855f7', label: 'F' },  // Fat — purple
];

/**
 * Three concentric colored rings for Protein / Carbs / Fat.
 * Used for Nutrition metric.
 */
export function MultiRingArc({ progress, colors, delay, isLoading, extraData }: MultiRingArcProps) {
  const id = useId();

  const rings: RingConfig[] = useMemo(() => {
    const macros = extraData?.macros as { protein: number; carbs: number; fats: number } | undefined;
    const targets = extraData?.targets as { protein: number; carbs: number; fats: number } | undefined;

    if (macros && targets) {
      return [
        { ...RING_CONFIGS[0], progress: targets.protein > 0 ? Math.min(100, (macros.protein / targets.protein) * 100) : 0 },
        { ...RING_CONFIGS[1], progress: targets.carbs > 0 ? Math.min(100, (macros.carbs / targets.carbs) * 100) : 0 },
        { ...RING_CONFIGS[2], progress: targets.fats > 0 ? Math.min(100, (macros.fats / targets.fats) * 100) : 0 },
      ];
    }

    // Fallback: distribute overall progress evenly
    return RING_CONFIGS.map((cfg) => ({ ...cfg, progress }));
  }, [extraData, progress]);

  return (
    <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        {rings.map((ring, i) => {
          const circ = 2 * Math.PI * ring.radius;
          return (
            <linearGradient key={`grad-${i}`} id={`mra-grad-${id}-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={ring.color} />
              <stop offset="100%" stopColor={ring.color} stopOpacity="0.6" />
            </linearGradient>
          );
        })}
        <filter id={`mra-glow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Track rings */}
      {rings.map((ring, i) => (
        <circle
          key={`track-${i}`}
          cx="100" cy="100" r={ring.radius}
          fill="none"
          stroke={`${ring.color}15`}
          strokeWidth={ring.stroke}
        />
      ))}

      {/* Progress rings */}
      {!isLoading && rings.map((ring, i) => {
        const circ = 2 * Math.PI * ring.radius;
        const offset = circ - (ring.progress / 100) * circ;

        return ring.progress > 0 ? (
          <motion.circle
            key={`prog-${i}`}
            cx="100" cy="100" r={ring.radius}
            fill="none"
            stroke={`url(#mra-grad-${id}-${i})`}
            strokeWidth={ring.stroke}
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.4, ease: [0.4, 0, 0.2, 1], delay: delay + 0.2 + i * 0.15 }}
            filter={`url(#mra-glow-${id})`}
          />
        ) : null;
      })}

      {isLoading && (
        <motion.circle
          cx="100" cy="100" r={74}
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
