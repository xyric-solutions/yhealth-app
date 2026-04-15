"use client";

import { useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface EnergyBatterySelectorProps {
  value: number;
  onChange: (val: number) => void;
}

const ENERGY_LABELS = ["Depleted", "Low", "Moderate", "Charged", "Full Power"];

/**
 * EnergyBatterySelector - 5 battery icons for energy level selection (1-5).
 *
 * Features:
 * - SVG battery icons with animated fill levels (20%, 40%, 60%, 80%, 100%)
 * - Amber glow fills all batteries up to the selected level
 * - Framer Motion animate for smooth fill transitions
 * - Accessible with radiogroup role and keyboard navigation
 */
export function EnergyBatterySelector({
  value,
  onChange,
}: EnergyBatterySelectorProps) {
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
          className="text-sm font-medium text-amber-400/80"
        >
          {ENERGY_LABELS[value - 1]}
        </motion.span>
      </div>

      {/* Battery Row */}
      <div
        role="radiogroup"
        aria-label="Energy level"
        className="flex items-end justify-center gap-3"
      >
        {[1, 2, 3, 4, 5].map((level) => {
          const isFilled = level <= value;
          const isSelected = level === value;
          const fillHeight = level * 20; // 20%, 40%, 60%, 80%, 100%

          return (
            <motion.button
              key={level}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`Energy level ${level}: ${ENERGY_LABELS[level - 1]}`}
              onClick={() => handleSelect(level)}
              onKeyDown={(e) => handleKeyDown(e, level)}
              tabIndex={isSelected ? 0 : -1}
              className={cn(
                "relative focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400",
                "focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 rounded-lg",
                "cursor-pointer"
              )}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg
                width="44"
                height="64"
                viewBox="0 0 44 64"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="overflow-visible"
              >
                {/* Battery terminal (top nub) */}
                <rect
                  x="15"
                  y="0"
                  width="14"
                  height="6"
                  rx="2"
                  className={cn(
                    "transition-colors duration-300",
                    isFilled ? "fill-amber-400/60" : "fill-slate-700"
                  )}
                />

                {/* Battery body outline */}
                <rect
                  x="2"
                  y="6"
                  width="40"
                  height="56"
                  rx="6"
                  className={cn(
                    "transition-colors duration-300",
                    isFilled
                      ? "stroke-amber-400/50 fill-slate-800/50"
                      : "stroke-slate-700 fill-slate-800/30"
                  )}
                  strokeWidth="2"
                />

                {/* Battery fill level - animated */}
                <defs>
                  <clipPath id={`battery-clip-${level}`}>
                    <rect x="6" y="10" width="32" height="48" rx="3" />
                  </clipPath>
                  <linearGradient
                    id={`battery-gradient-${level}`}
                    x1="22"
                    y1="58"
                    x2="22"
                    y2="10"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#fbbf24" />
                  </linearGradient>
                </defs>

                <motion.rect
                  x="6"
                  width="32"
                  rx="3"
                  clipPath={`url(#battery-clip-${level})`}
                  fill={`url(#battery-gradient-${level})`}
                  initial={false}
                  animate={{
                    y: isFilled ? 58 - (48 * fillHeight) / 100 : 58,
                    height: isFilled ? (48 * fillHeight) / 100 : 0,
                    opacity: isFilled ? 1 : 0,
                  }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />

                {/* Glow effect when filled */}
                {isFilled && (
                  <motion.rect
                    x="6"
                    width="32"
                    rx="3"
                    clipPath={`url(#battery-clip-${level})`}
                    fill="#f59e0b"
                    initial={{ opacity: 0 }}
                    animate={{
                      y: 58 - (48 * fillHeight) / 100,
                      height: (48 * fillHeight) / 100,
                      opacity: [0.15, 0.3, 0.15],
                    }}
                    transition={{
                      opacity: {
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      },
                      y: { duration: 0.4, ease: "easeOut" },
                      height: { duration: 0.4, ease: "easeOut" },
                    }}
                    style={{ filter: "blur(4px)" }}
                  />
                )}
              </svg>

              {/* Level number below battery */}
              <motion.span
                className={cn(
                  "block text-xs font-medium text-center mt-1 tabular-nums",
                  isSelected
                    ? "text-amber-400"
                    : isFilled
                      ? "text-amber-400/50"
                      : "text-slate-600"
                )}
                animate={{ scale: isSelected ? 1.1 : 1 }}
                transition={{ duration: 0.2 }}
              >
                {level}
              </motion.span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
