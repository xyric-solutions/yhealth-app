"use client";

import { useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StressWaveSliderProps {
  value: number;
  onChange: (val: number) => void;
}

const STRESS_LABELS = [
  "Calm",
  "At Ease",
  "Relaxed",
  "Mild",
  "Moderate",
  "Noticeable",
  "Tense",
  "High",
  "Very High",
  "Overwhelmed",
];

/**
 * StressWaveSlider - SVG wave visualization that responds to stress level (1-10).
 *
 * Features:
 * - Animated SVG waves that shift from calm/gentle (low) to aggressive/choppy (high)
 * - Color transitions from calm blue to warning red
 * - Range input beneath the wave for value control
 * - Smooth Framer Motion transitions when value changes
 * - Accessible with ARIA attributes
 */
export function StressWaveSlider({ value, onChange }: StressWaveSliderProps) {
  const progress = ((value - 1) / 9) * 100;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(Number(e.target.value));
    },
    [onChange]
  );

  // Interpolate wave color from calm blue to stress red
  const waveColor = useMemo(() => {
    const t = (value - 1) / 9;
    if (t < 0.3) return { primary: "#3b82f6", secondary: "#60a5fa" }; // Blue
    if (t < 0.5) return { primary: "#8b5cf6", secondary: "#a78bfa" }; // Purple
    if (t < 0.7) return { primary: "#f59e0b", secondary: "#fbbf24" }; // Amber
    return { primary: "#ef4444", secondary: "#f87171" }; // Red
  }, [value]);

  const stressLabel = STRESS_LABELS[value - 1];

  // Generate wave path based on stress level
  const wavePaths = useMemo(() => {
    const width = 400;
    const height = 120;
    const centerY = height / 2;
    const t = (value - 1) / 9; // 0 to 1

    // Wave parameters scale with stress
    const amplitude = 8 + t * 32; // 8px calm -> 40px stress
    const frequency = 2 + t * 4; // 2 cycles -> 6 cycles
    const jaggedness = t * 0.4; // smooth -> jagged

    const paths: string[] = [];

    // Generate 3 layered waves for depth
    for (let layer = 0; layer < 3; layer++) {
      const layerOffset = layer * 8;
      const layerAmp = amplitude * (1 - layer * 0.25);
      const phaseShift = layer * 1.2;
      const segments = 80;
      const points: string[] = [];

      for (let i = 0; i <= segments; i++) {
        const x = (i / segments) * width;
        const normalizedX = (i / segments) * Math.PI * 2 * frequency;

        // Primary wave
        let y = Math.sin(normalizedX + phaseShift) * layerAmp;

        // Add harmonics for choppiness at higher stress
        if (jaggedness > 0) {
          y += Math.sin(normalizedX * 2.7 + phaseShift * 1.5) * layerAmp * jaggedness * 0.5;
          y += Math.sin(normalizedX * 4.1 + phaseShift * 0.8) * layerAmp * jaggedness * 0.25;
        }

        y = centerY + y + layerOffset;

        if (i === 0) {
          points.push(`M ${x} ${y}`);
        } else {
          points.push(`L ${x} ${y}`);
        }
      }

      // Close the path along the bottom
      points.push(`L ${width} ${height}`);
      points.push(`L 0 ${height}`);
      points.push("Z");

      paths.push(points.join(" "));
    }

    return paths;
  }, [value]);

  return (
    <div className="space-y-4">
      {/* Stress level label */}
      <div className="flex items-center justify-between px-1">
        <motion.span
          key={stressLabel}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-sm font-medium"
          style={{ color: waveColor.primary }}
        >
          {stressLabel}
        </motion.span>
        <motion.span
          key={value}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-2xl font-bold text-white tabular-nums"
        >
          {value}
          <span className="text-sm text-slate-500 font-normal">/10</span>
        </motion.span>
      </div>

      {/* Wave SVG */}
      <div
        className={cn(
          "relative rounded-2xl overflow-hidden",
          "bg-slate-900/60 border border-white/5"
        )}
      >
        <svg
          viewBox="0 0 400 120"
          preserveAspectRatio="none"
          className="w-full h-24"
          role="img"
          aria-label={`Stress wave visualization: ${stressLabel}`}
        >
          <defs>
            <linearGradient
              id="stress-wave-gradient-0"
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor={waveColor.primary} stopOpacity="0.6" />
              <stop offset="100%" stopColor={waveColor.primary} stopOpacity="0.05" />
            </linearGradient>
            <linearGradient
              id="stress-wave-gradient-1"
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor={waveColor.secondary} stopOpacity="0.4" />
              <stop offset="100%" stopColor={waveColor.secondary} stopOpacity="0.02" />
            </linearGradient>
            <linearGradient
              id="stress-wave-gradient-2"
              x1="0%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor={waveColor.primary} stopOpacity="0.2" />
              <stop offset="100%" stopColor={waveColor.primary} stopOpacity="0" />
            </linearGradient>
          </defs>

          {wavePaths.map((path, i) => (
            <motion.path
              key={`wave-${i}`}
              fill={`url(#stress-wave-gradient-${i})`}
              initial={false}
              animate={{ d: path }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            />
          ))}

          {/* Subtle horizontal reference line */}
          <line
            x1="0"
            y1="60"
            x2="400"
            y2="60"
            stroke="white"
            strokeOpacity="0.05"
            strokeDasharray="4 4"
          />
        </svg>
      </div>

      {/* Range slider */}
      <div className="relative px-1">
        {/* Background track */}
        <div
          className="absolute inset-x-1 h-2 rounded-full top-1/2 -translate-y-1/2"
          style={{
            background: `linear-gradient(to right, #3b82f6, #8b5cf6, #f59e0b, #ef4444)`,
            opacity: 0.2,
          }}
        />

        {/* Active fill */}
        <motion.div
          className="absolute left-1 h-2 rounded-full top-1/2 -translate-y-1/2"
          style={{
            background: `linear-gradient(to right, #3b82f6, ${waveColor.primary})`,
          }}
          animate={{ width: `calc(${progress}% - 4px)` }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        />

        {/* Native range input */}
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={value}
          onChange={handleChange}
          aria-label="Stress level"
          aria-valuemin={1}
          aria-valuemax={10}
          aria-valuenow={value}
          aria-valuetext={`${value} out of 10, ${stressLabel}`}
          className={cn(
            "relative w-full h-6 bg-transparent appearance-none cursor-pointer z-10",
            // Webkit thumb
            "[&::-webkit-slider-thumb]:appearance-none",
            "[&::-webkit-slider-thumb]:w-6",
            "[&::-webkit-slider-thumb]:h-6",
            "[&::-webkit-slider-thumb]:rounded-full",
            "[&::-webkit-slider-thumb]:bg-white",
            "[&::-webkit-slider-thumb]:shadow-lg",
            "[&::-webkit-slider-thumb]:cursor-pointer",
            "[&::-webkit-slider-thumb]:transition-transform",
            "[&::-webkit-slider-thumb]:duration-150",
            "[&::-webkit-slider-thumb]:hover:scale-110",
            "[&::-webkit-slider-thumb]:border-2",
            "[&::-webkit-slider-thumb]:border-white/40",
            // Firefox thumb
            "[&::-moz-range-thumb]:w-6",
            "[&::-moz-range-thumb]:h-6",
            "[&::-moz-range-thumb]:rounded-full",
            "[&::-moz-range-thumb]:border-2",
            "[&::-moz-range-thumb]:border-white/40",
            "[&::-moz-range-thumb]:bg-white",
            "[&::-moz-range-thumb]:shadow-lg",
            "[&::-moz-range-thumb]:cursor-pointer",
            // Firefox track
            "[&::-moz-range-track]:bg-transparent",
            "[&::-moz-range-track]:h-2"
          )}
        />
      </div>

      {/* Scale labels */}
      <div className="flex justify-between px-1 text-xs text-slate-600">
        <span>Calm</span>
        <span>Moderate</span>
        <span>Overwhelmed</span>
      </div>
    </div>
  );
}
