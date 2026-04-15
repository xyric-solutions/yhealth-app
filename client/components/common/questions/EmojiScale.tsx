"use client";

import type React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { EmojiScaleProps } from "./types";

/**
 * EmojiScale - A visual scale selector with emoji/number indicators
 *
 * Features:
 * - Responsive grid layout
 * - Animated selection state
 * - Accessible with keyboard navigation
 * - Auto-generated numeric indicators if no emoji provided
 *
 * @example
 * <EmojiScale
 *   value={selected}
 *   onChange={setSelected}
 *   options={[
 *     { value: "1", label: "Never", emoji: "1" },
 *     { value: "2", label: "Rarely" },
 *     { value: "3", label: "Sometimes" },
 *     { value: "4", label: "Often" },
 *     { value: "5", label: "Always" },
 *   ]}
 * />
 */
export function EmojiScale({
  id,
  label,
  value,
  onChange,
  options,
  columns,
  disabled = false,
  error,
  className,
}: EmojiScaleProps) {
  // Auto-calculate columns based on options length if not provided
  const gridCols = columns || (options.length <= 3 ? 3 : options.length <= 4 ? 4 : 5);

  // Get visual indicator for an option (icon, emoji, or index+1)
  const getVisualIndicator = (option: typeof options[number], index: number): React.ReactNode => {
    if (option.icon) {
      const IconComponent = option.icon;
      return <IconComponent className="w-5 h-5" />;
    }
    if (option.emoji) return option.emoji;
    return String(index + 1);
  };

  const gridColsClass = {
    3: "grid-cols-3",
    4: "grid-cols-4",
    5: "grid-cols-5",
  }[gridCols];

  return (
    <div className={cn("space-y-4", className)}>
      {label && (
        <label className="block text-sm font-medium text-slate-300">
          {label}
        </label>
      )}

      <div
        role="radiogroup"
        aria-label={label || "Scale selection"}
        className={cn("grid gap-2 md:gap-4", gridColsClass)}
      >
        {options.map((option, index) => {
          const isSelected = value === option.value;
          const optionId = id ? `${id}-${option.value}` : `scale-${option.value}`;

          return (
            <motion.button
              key={option.value}
              id={optionId}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => !disabled && onChange(option.value)}
              disabled={disabled}
              className={cn(
                "flex flex-col items-center gap-2 p-3 md:p-4 rounded-xl",
                "transition-all duration-200 border",
                isSelected
                  ? "bg-blue-500/20 border-blue-500/50"
                  : "bg-white/5 border-white/10 hover:bg-white/10",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              whileHover={!disabled ? { scale: 1.05 } : {}}
              whileTap={!disabled ? { scale: 0.95 } : {}}
            >
              <motion.div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold",
                  isSelected
                    ? "bg-blue-500 text-white"
                    : "bg-white/10 text-slate-300"
                )}
                animate={{ 
                  scale: isSelected ? 1.1 : 1,
                  rotate: isSelected ? [0, -5, 5, -5, 5, 0] : 0,
                }}
                transition={{ 
                  scale: { duration: 0.2 },
                  rotate: { duration: 0.5, repeat: isSelected ? Infinity : 0, repeatDelay: 2 }
                }}
              >
                <motion.div
                  animate={isSelected ? { 
                    y: [0, -3, 0],
                  } : {}}
                  transition={{ 
                    duration: 1.5,
                    repeat: isSelected ? Infinity : 0,
                    repeatDelay: 0.5
                  }}
                >
                  {getVisualIndicator(option, index)}
                </motion.div>
              </motion.div>
              <span
                className={cn(
                  "text-xs text-center",
                  isSelected ? "text-blue-400" : "text-slate-400"
                )}
              >
                {option.label}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-sm text-red-400 mt-2">{error}</p>
      )}
    </div>
  );
}
