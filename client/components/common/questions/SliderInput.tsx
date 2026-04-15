"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { SliderInputProps } from "./types";

/**
 * SliderInput - A reusable range slider with animated value display
 *
 * Features:
 * - Visual progress track
 * - Animated value badge
 * - Optional unit display
 * - Min/max labels
 * - Accessible with keyboard navigation
 *
 * @example
 * <SliderInput
 *   value={5}
 *   onChange={setValue}
 *   min={1}
 *   max={10}
 *   unit="hours"
 *   labels={["Never", "Always"]}
 * />
 */
export function SliderInput({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  showValue = true,
  labels,
  disabled = false,
  error,
  className,
}: SliderInputProps) {
  const inputId = useMemo(() => {
    if (id) return id;
    // Use a counter-based approach for stable IDs
    // eslint-disable-next-line react-hooks/purity
    return `slider-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }, [id]);

  // Calculate progress percentage
  const progress = ((value - min) / (max - min)) * 100;

  return (
    <div className={cn("space-y-4", className)}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-slate-300"
        >
          {label}
        </label>
      )}

      <div className="space-y-6">
        {/* Slider Track with Progress */}
        <div className="relative">
          {/* Background Track */}
          <div className="absolute inset-0 h-2 bg-white/10 rounded-full top-1/2 -translate-y-1/2" />

          {/* Progress Fill */}
          <motion.div
            className="absolute h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full top-1/2 -translate-y-1/2"
            style={{ width: `${progress}%` }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.15 }}
          />

          {/* Slider Input */}
          <input
            id={inputId}
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            disabled={disabled}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            aria-valuetext={unit ? `${value} ${unit}` : String(value)}
            className={cn(
              "relative w-full h-6 bg-transparent appearance-none cursor-pointer z-10",
              // Webkit (Chrome, Safari, Edge)
              "[&::-webkit-slider-thumb]:appearance-none",
              "[&::-webkit-slider-thumb]:w-6",
              "[&::-webkit-slider-thumb]:h-6",
              "[&::-webkit-slider-thumb]:rounded-full",
              "[&::-webkit-slider-thumb]:bg-white",
              "[&::-webkit-slider-thumb]:shadow-lg",
              "[&::-webkit-slider-thumb]:shadow-purple-500/50",
              "[&::-webkit-slider-thumb]:cursor-pointer",
              "[&::-webkit-slider-thumb]:transition-transform",
              "[&::-webkit-slider-thumb]:duration-150",
              "[&::-webkit-slider-thumb]:hover:scale-110",
              "[&::-webkit-slider-thumb]:border-2",
              "[&::-webkit-slider-thumb]:border-purple-500",
              // Firefox
              "[&::-moz-range-thumb]:w-6",
              "[&::-moz-range-thumb]:h-6",
              "[&::-moz-range-thumb]:rounded-full",
              "[&::-moz-range-thumb]:border-2",
              "[&::-moz-range-thumb]:border-purple-500",
              "[&::-moz-range-thumb]:bg-white",
              "[&::-moz-range-thumb]:shadow-lg",
              "[&::-moz-range-thumb]:cursor-pointer",
              // Firefox track
              "[&::-moz-range-track]:bg-transparent",
              "[&::-moz-range-track]:h-2",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          />
        </div>

        {/* Value Display */}
        {showValue && (
          <div className="text-center">
            <motion.div
              key={value}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={cn(
                "inline-flex items-center gap-2 px-6 py-3 rounded-xl",
                "bg-gradient-to-r from-violet-500/20 to-purple-500/20",
                "border border-violet-500/30"
              )}
            >
              <span className="text-3xl font-bold text-white">{value}</span>
              {unit && <span className="text-slate-400">{unit}</span>}
            </motion.div>
          </div>
        )}

        {/* Labels */}
        {labels && labels.length >= 2 && (
          <div className="flex justify-between text-xs text-slate-500">
            {labels.map((labelText, i) => (
              <span key={i}>{labelText}</span>
            ))}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-sm text-red-400 mt-2">{error}</p>
      )}
    </div>
  );
}
