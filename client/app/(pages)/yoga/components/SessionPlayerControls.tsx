"use client";

import { Play, Pause, SkipForward, SkipBack } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { SessionPlayerState } from "@shared/types/domain/yoga";

interface SessionPlayerControlsProps {
  state: SessionPlayerState;
  elapsed: number;
  total: number;
  phaseProgress: number;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
  onPrev: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function SessionPlayerControls({
  state,
  elapsed,
  total,
  phaseProgress,
  onPause,
  onResume,
  onSkip,
  onPrev,
}: SessionPlayerControlsProps) {
  const isPlaying = state === "playing";

  // SVG progress ring
  const radius = 32;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - phaseProgress);

  return (
    <div className="flex flex-col items-center gap-4 px-4">
      {/* Glass morphism control bar */}
      <div
        className={cn(
          "flex items-center gap-5 sm:gap-7 rounded-2xl px-6 sm:px-8 py-4",
          "bg-white/5 backdrop-blur-2xl",
          "border border-white/8",
          "shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
        )}
      >
        {/* Previous Phase */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onPrev}
          aria-label="Previous phase"
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl",
            "bg-white/6 hover:bg-white/12",
            "text-white/60 hover:text-white",
            "transition-all duration-200",
            "hover:shadow-[0_0_20px_rgba(255,255,255,0.05)]"
          )}
        >
          <SkipBack className="h-5 w-5" />
        </motion.button>

        {/* Play/Pause with Glowing Progress Ring */}
        <div className="relative flex items-center justify-center">
          {/* SVG Progress Ring with gradient */}
          <svg
            className="absolute -rotate-90"
            width="84"
            height="84"
            viewBox="0 0 84 84"
          >
            <defs>
              <linearGradient
                id="progress-gradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="rgba(16,185,129,0.9)" />
                <stop offset="100%" stopColor="rgba(14,165,233,0.9)" />
              </linearGradient>
              {/* Glow filter */}
              <filter id="ring-glow">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Background track */}
            <circle
              cx="42"
              cy="42"
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="3"
            />

            {/* Progress arc with gradient and glow */}
            <motion.circle
              cx="42"
              cy="42"
              r={radius}
              fill="none"
              stroke="url(#progress-gradient)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={circumference}
              animate={{ strokeDashoffset }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              filter="url(#ring-glow)"
            />
          </svg>

          {/* Play/Pause Button */}
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={isPlaying ? onPause : onResume}
            aria-label={isPlaying ? "Pause" : "Resume"}
            className={cn(
              "relative flex h-[84px] w-[84px] items-center justify-center rounded-full",
              "bg-white/8 hover:bg-white/14",
              "text-white",
              "transition-all duration-300",
              "hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]"
            )}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isPlaying ? (
                <motion.div
                  key="pause"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Pause className="h-7 w-7" />
                </motion.div>
              ) : (
                <motion.div
                  key="play"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Play className="h-7 w-7 ml-1" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>

        {/* Skip Phase */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onSkip}
          aria-label="Skip to next phase"
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl",
            "bg-white/6 hover:bg-white/12",
            "text-white/60 hover:text-white",
            "transition-all duration-200",
            "hover:shadow-[0_0_20px_rgba(255,255,255,0.05)]"
          )}
        >
          <SkipForward className="h-5 w-5" />
        </motion.button>
      </div>

      {/* Timer Display */}
      <p className="text-xs text-white/30 tabular-nums font-medium tracking-wider">
        {formatTime(elapsed)}
        <span className="mx-1.5 text-white/15">/</span>
        {formatTime(total)}
      </p>
    </div>
  );
}
