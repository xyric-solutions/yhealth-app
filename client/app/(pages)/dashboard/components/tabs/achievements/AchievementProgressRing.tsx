"use client";

import { useId, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { AchievementRarity } from "./types";
import { rarityHexColors } from "./constants";

interface AchievementProgressRingProps {
  percentage: number;
  rarity: AchievementRarity;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}

export function AchievementProgressRing({
  percentage,
  rarity,
  size = 80,
  strokeWidth = 4,
  children,
}: AchievementProgressRingProps) {
  const prefersReducedMotion = useReducedMotion();
  const uniqueId = useId();
  const gradientId = `progress-ring-${uniqueId}`;

  const { radius, circumference, offset } = useMemo(() => {
    const r = (size - strokeWidth) / 2;
    const c = 2 * Math.PI * r;
    const pct = Math.min(100, Math.max(0, percentage));
    return { radius: r, circumference: c, offset: c - (pct / 100) * c };
  }, [size, strokeWidth, percentage]);

  const [startColor, endColor] = rarityHexColors[rarity];

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        role="progressbar"
        aria-valuenow={Math.round(percentage)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={startColor} />
            <stop offset="100%" stopColor={endColor} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: prefersReducedMotion ? offset : circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 1.2, ease: "easeOut", delay: 0.2 }
          }
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}
