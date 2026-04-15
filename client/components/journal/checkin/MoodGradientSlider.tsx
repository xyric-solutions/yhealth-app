"use client";

import { useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface MoodGradientSliderProps {
  value: number;
  onChange: (val: number) => void;
}

/**
 * MoodGradientSlider - Premium mood selector with gradient track and morphing emoji.
 *
 * Features:
 * - Range 1-10 with tri-color gradient: deep-blue -> teal -> warm-gold
 * - Emoji face that morphs across 5 brackets
 * - Large animated value display
 * - Accessible with ARIA value attributes and keyboard support
 */
export function MoodGradientSlider({ value, onChange }: MoodGradientSliderProps) {
  const progress = ((value - 1) / 9) * 100;

  const emoji = useMemo(() => {
    if (value <= 2) return "😔";
    if (value <= 4) return "😕";
    if (value <= 6) return "😐";
    if (value <= 8) return "🙂";
    return "😊";
  }, [value]);

  const moodLabel = useMemo(() => {
    if (value <= 2) return "Low";
    if (value <= 4) return "Below Average";
    if (value <= 6) return "Neutral";
    if (value <= 8) return "Good";
    return "Great";
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(Number(e.target.value));
    },
    [onChange]
  );

  // Interpolate gradient color for the glow effect based on current value
  const glowColor = useMemo(() => {
    if (value <= 3) return "rgba(30, 58, 95, 0.6)";
    if (value <= 6) return "rgba(20, 184, 166, 0.5)";
    return "rgba(245, 158, 11, 0.5)";
  }, [value]);

  return (
    <div className="space-y-5">
      {/* Emoji + Value Display */}
      <div className="flex flex-col items-center gap-2">
        <AnimatePresence mode="wait">
          <motion.span
            key={emoji}
            initial={{ scale: 0.5, opacity: 0, rotateY: 90 }}
            animate={{ scale: 1, opacity: 1, rotateY: 0 }}
            exit={{ scale: 0.5, opacity: 0, rotateY: -90 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="text-5xl select-none"
            role="img"
            aria-label={`Mood: ${moodLabel}`}
          >
            {emoji}
          </motion.span>
        </AnimatePresence>

        <motion.div
          key={value}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="flex items-baseline gap-2"
        >
          <span className="text-4xl font-bold text-white tabular-nums">
            {value}
          </span>
          <span className="text-sm text-slate-400">/10</span>
        </motion.div>

        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          {moodLabel}
        </span>
      </div>

      {/* Slider Track */}
      <div className="relative px-1">
        {/* Background gradient track */}
        <div
          className="absolute inset-x-1 h-3 rounded-full top-1/2 -translate-y-1/2"
          style={{
            background:
              "linear-gradient(to right, #1e3a5f 0%, #14b8a6 50%, #f59e0b 100%)",
            opacity: 0.3,
          }}
        />

        {/* Active fill */}
        <motion.div
          className="absolute left-1 h-3 rounded-full top-1/2 -translate-y-1/2"
          style={{
            background:
              "linear-gradient(to right, #1e3a5f 0%, #14b8a6 50%, #f59e0b 100%)",
          }}
          animate={{ width: `calc(${progress}% - 4px)` }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        />

        {/* Glow on thumb position */}
        <motion.div
          className="absolute w-8 h-8 rounded-full top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none"
          animate={{
            left: `${progress}%`,
            boxShadow: `0 0 20px 8px ${glowColor}`,
          }}
          transition={{ duration: 0.15 }}
        />

        {/* Native range input */}
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={value}
          onChange={handleChange}
          aria-label="Mood score"
          aria-valuemin={1}
          aria-valuemax={10}
          aria-valuenow={value}
          aria-valuetext={`${value} out of 10, ${moodLabel}`}
          className={cn(
            "relative w-full h-8 bg-transparent appearance-none cursor-pointer z-10",
            // Webkit thumb
            "[&::-webkit-slider-thumb]:appearance-none",
            "[&::-webkit-slider-thumb]:w-7",
            "[&::-webkit-slider-thumb]:h-7",
            "[&::-webkit-slider-thumb]:rounded-full",
            "[&::-webkit-slider-thumb]:bg-white",
            "[&::-webkit-slider-thumb]:shadow-lg",
            "[&::-webkit-slider-thumb]:cursor-pointer",
            "[&::-webkit-slider-thumb]:transition-transform",
            "[&::-webkit-slider-thumb]:duration-150",
            "[&::-webkit-slider-thumb]:hover:scale-110",
            "[&::-webkit-slider-thumb]:border-2",
            "[&::-webkit-slider-thumb]:border-white/50",
            // Firefox thumb
            "[&::-moz-range-thumb]:w-7",
            "[&::-moz-range-thumb]:h-7",
            "[&::-moz-range-thumb]:rounded-full",
            "[&::-moz-range-thumb]:border-2",
            "[&::-moz-range-thumb]:border-white/50",
            "[&::-moz-range-thumb]:bg-white",
            "[&::-moz-range-thumb]:shadow-lg",
            "[&::-moz-range-thumb]:cursor-pointer",
            // Firefox track
            "[&::-moz-range-track]:bg-transparent",
            "[&::-moz-range-track]:h-3"
          )}
        />
      </div>

      {/* Scale labels */}
      <div className="flex justify-between px-1 text-xs text-slate-600">
        <span>Low</span>
        <span>Neutral</span>
        <span>Great</span>
      </div>
    </div>
  );
}
