"use client";

import { useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SleepMoonSelectorProps {
  value: number;
  onChange: (val: number) => void;
}

const SLEEP_LABELS = ["Terrible", "Poor", "Fair", "Good", "Excellent"];

/**
 * SleepMoonSelector - Moon phase icons for sleep quality rating (1-5).
 *
 * Features:
 * - 5 moon phases: new moon (worst) to full moon (best)
 * - SVG circles with clip-path crescents for each phase
 * - Soft white glow on selected moon
 * - Accessible with radiogroup pattern and keyboard navigation
 */
export function SleepMoonSelector({ value, onChange }: SleepMoonSelectorProps) {
  const handleSelect = useCallback(
    (level: number) => {
      onChange(level);
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, level: number) => {
      if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        onChange(Math.min(level + 1, 5));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        onChange(Math.max(level - 1, 1));
      }
    },
    [onChange]
  );

  return (
    <div className="space-y-4">
      {/* Label */}
      <div className="text-center">
        <motion.span
          key={value}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm font-medium text-indigo-300/80"
        >
          {SLEEP_LABELS[value - 1]}
        </motion.span>
      </div>

      {/* Moon Row */}
      <div
        role="radiogroup"
        aria-label="Sleep quality"
        className="flex items-center justify-center gap-4"
      >
        {[1, 2, 3, 4, 5].map((level) => {
          const isSelected = level === value;

          return (
            <motion.button
              key={level}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`Sleep quality ${level}: ${SLEEP_LABELS[level - 1]}`}
              onClick={() => handleSelect(level)}
              onKeyDown={(e) => handleKeyDown(e, level)}
              tabIndex={isSelected ? 0 : -1}
              className={cn(
                "relative p-2 rounded-full focus:outline-none",
                "focus-visible:ring-2 focus-visible:ring-indigo-400",
                "focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
                "cursor-pointer"
              )}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
            >
              {/* Glow behind selected moon */}
              {isSelected && (
                <motion.div
                  className="absolute inset-0 rounded-full"
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: [0.4, 0.7, 0.4],
                    boxShadow: "0 0 24px 8px rgba(199, 210, 254, 0.35)",
                  }}
                  transition={{
                    opacity: { duration: 2.5, repeat: Infinity, ease: "easeInOut" },
                  }}
                />
              )}

              <MoonPhaseIcon
                phase={level}
                size={44}
                isSelected={isSelected}
              />

              {/* Quality label below */}
              <motion.span
                className={cn(
                  "block text-[10px] font-medium text-center mt-2 whitespace-nowrap",
                  isSelected ? "text-indigo-300" : "text-slate-600"
                )}
                animate={{ scale: isSelected ? 1.05 : 1 }}
                transition={{ duration: 0.2 }}
              >
                {SLEEP_LABELS[level - 1]}
              </motion.span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Individual SVG moon phase icon.
 * Phase 1 = new moon (dark), Phase 5 = full moon (bright).
 */
function MoonPhaseIcon({
  phase,
  size,
  isSelected,
}: {
  phase: number;
  size: number;
  isSelected: boolean;
}) {
  const r = size / 2 - 2;
  const cx = size / 2;
  const cy = size / 2;

  // Moon fill color varies by brightness
  const moonBrightness = isSelected ? 1 : 0.5;

  // Calculate the crescent: phase 1 is new moon, phase 5 is full moon
  // Using two arcs to create a crescent shape
  const getMoonPath = () => {
    switch (phase) {
      case 1:
        // New moon - just an outline, almost no fill
        return null;
      case 2: {
        // Waxing crescent - thin sliver on the right
        const innerOffset = r * 0.5;
        return `
          M ${cx} ${cy - r}
          A ${r} ${r} 0 1 1 ${cx} ${cy + r}
          A ${innerOffset} ${r} 0 0 0 ${cx} ${cy - r}
          Z
        `;
      }
      case 3: {
        // First quarter - right half lit
        return `
          M ${cx} ${cy - r}
          A ${r} ${r} 0 1 1 ${cx} ${cy + r}
          A 0 ${r} 0 0 0 ${cx} ${cy - r}
          Z
        `;
      }
      case 4: {
        // Waxing gibbous - mostly lit with shadow on left
        const innerOffset = r * 0.5;
        return `
          M ${cx} ${cy - r}
          A ${r} ${r} 0 1 1 ${cx} ${cy + r}
          A ${innerOffset} ${r} 0 0 1 ${cx} ${cy - r}
          Z
        `;
      }
      case 5:
        // Full moon - fully lit
        return null;
      default:
        return null;
    }
  };

  const crescentPath = getMoonPath();

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id={`moon-grad-${phase}`} cx="40%" cy="35%">
          <stop offset="0%" stopColor="#e8e0f0" stopOpacity={moonBrightness} />
          <stop offset="100%" stopColor="#c7d2fe" stopOpacity={moonBrightness * 0.7} />
        </radialGradient>
      </defs>

      {phase === 1 ? (
        <>
          {/* New moon: dark circle with subtle outline */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="rgba(30, 41, 59, 0.8)"
            stroke={isSelected ? "rgba(148, 163, 184, 0.5)" : "rgba(71, 85, 105, 0.4)"}
            strokeWidth="1.5"
          />
          {/* Subtle crater hint */}
          <circle cx={cx - 3} cy={cy - 2} r={3} fill="rgba(51, 65, 85, 0.5)" />
          <circle cx={cx + 5} cy={cy + 4} r={2} fill="rgba(51, 65, 85, 0.4)" />
        </>
      ) : phase === 5 ? (
        <>
          {/* Full moon: bright filled circle */}
          <motion.circle
            cx={cx}
            cy={cy}
            r={r}
            fill={`url(#moon-grad-${phase})`}
            animate={{ opacity: isSelected ? 1 : 0.5 }}
            transition={{ duration: 0.3 }}
          />
          {/* Moon surface texture (craters) */}
          <circle cx={cx - 4} cy={cy - 3} r={2.5} fill="rgba(148, 163, 184, 0.2)" />
          <circle cx={cx + 5} cy={cy + 4} r={2} fill="rgba(148, 163, 184, 0.15)" />
          <circle cx={cx + 2} cy={cy - 6} r={1.5} fill="rgba(148, 163, 184, 0.15)" />
        </>
      ) : (
        <>
          {/* Phases 2-4: dark base + lit crescent */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="rgba(30, 41, 59, 0.8)"
            stroke={isSelected ? "rgba(148, 163, 184, 0.3)" : "rgba(71, 85, 105, 0.3)"}
            strokeWidth="1"
          />
          {crescentPath && (
            <motion.path
              d={crescentPath}
              fill={`url(#moon-grad-${phase})`}
              animate={{ opacity: isSelected ? 1 : 0.45 }}
              transition={{ duration: 0.3 }}
            />
          )}
        </>
      )}
    </svg>
  );
}
