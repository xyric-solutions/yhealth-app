"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Animated SVG eye exercise visualizations for the Eye Yoga session player.
 * Each exercise phase gets its own animation showing the user what to do.
 */

interface EyeExerciseAnimationProps {
  phaseName: string;
}

// ---------------------------------------------------------------------------
// Shared eye parts
// ---------------------------------------------------------------------------

function EyeSocket() {
  return (
    <ellipse
      cx="60"
      cy="50"
      rx="52"
      ry="36"
      className="fill-white/90"
      stroke="currentColor"
      strokeWidth="3"
    />
  );
}

function Eyebrow({ side }: { side: "left" | "right" }) {
  const flip = side === "right" ? "scale(-1, 1) translate(-120, 0)" : undefined;
  return (
    <path
      d="M20,18 Q60,2 100,18"
      fill="none"
      stroke="currentColor"
      strokeWidth="5"
      strokeLinecap="round"
      transform={flip}
    />
  );
}

// ---------------------------------------------------------------------------
// Eye Palming – eyes closed with warm glow
// ---------------------------------------------------------------------------

function EyePalmingAnimation() {
  return (
    <div className="relative flex items-center justify-center">
      {/* Warmth glow */}
      <motion.div
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.15, 0.3, 0.15],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-56 h-40 sm:w-72 sm:h-48 rounded-full bg-amber-500/20 blur-3xl"
      />
      {/* Hands cupping */}
      <motion.div
        animate={{ y: [4, 0, 4] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="relative flex gap-2 sm:gap-4"
      >
        {/* Left eye - closed */}
        <svg viewBox="0 0 120 100" className="w-24 h-20 sm:w-32 sm:h-24 text-white/60">
          <Eyebrow side="left" />
          <EyeSocket />
          {/* Closed lid */}
          <ellipse cx="60" cy="50" rx="52" ry="36" className="fill-slate-800" stroke="currentColor" strokeWidth="3" />
          {/* Eyelashes */}
          <path d="M20,50 Q40,58 60,60 Q80,58 100,50" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {/* Right eye - closed */}
        <svg viewBox="0 0 120 100" className="w-24 h-20 sm:w-32 sm:h-24 text-white/60">
          <Eyebrow side="right" />
          <EyeSocket />
          <ellipse cx="60" cy="50" rx="52" ry="36" className="fill-slate-800" stroke="currentColor" strokeWidth="3" />
          <path d="M20,50 Q40,58 60,60 Q80,58 100,50" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </motion.div>
      {/* Palm shapes */}
      <motion.div
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -bottom-2 flex gap-6"
      >
        <div className="w-20 h-8 sm:w-28 sm:h-10 rounded-t-full bg-amber-900/30 border border-amber-500/10" />
        <div className="w-20 h-8 sm:w-28 sm:h-10 rounded-t-full bg-amber-900/30 border border-amber-500/10" />
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Eye Circles – pupils rotating clockwise then counter-clockwise
// ---------------------------------------------------------------------------

function EyeCirclesAnimation() {
  const r = 14;
  const duration = 3;

  const cxKeys = [60, 60 + r, 60, 60 - r, 60];
  const cyKeys = [50 - r, 50, 50 + r, 50, 50 - r];

  const transition = {
    duration,
    repeat: Infinity,
    ease: "easeInOut" as const,
  };

  return (
    <div className="relative flex items-center justify-center">
      {/* Rotation direction hint */}
      <motion.div
        animate={{ rotate: [0, 360] }}
        transition={{ duration, repeat: Infinity, ease: "linear" }}
        className="absolute -top-1 right-4 sm:right-8 text-white/20 text-lg"
      >
        ↻
      </motion.div>

      <div className="flex gap-2 sm:gap-4">
        {[0, 1].map((i) => (
          <svg key={i} viewBox="0 0 120 100" className="w-24 h-20 sm:w-32 sm:h-24 text-white/60">
            <Eyebrow side={i === 0 ? "left" : "right"} />
            <EyeSocket />
            {/* Trace circle guide */}
            <circle cx="60" cy="50" r={r} fill="none" stroke="white" strokeWidth="0.5" opacity="0.1" strokeDasharray="3 3" />
            {/* Iris */}
            <motion.circle animate={{ cx: cxKeys, cy: cyKeys }} transition={transition} r="18" className="fill-amber-800" />
            {/* Pupil */}
            <motion.circle animate={{ cx: cxKeys, cy: cyKeys }} transition={transition} r="9" className="fill-zinc-900" />
            {/* Highlight */}
            <motion.circle
              animate={{ cx: cxKeys.map((v) => v + 5), cy: cyKeys.map((v) => v - 5) }}
              transition={transition}
              r="4"
              className="fill-white/70"
            />
          </svg>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Focus Shifting – pupils converge (near) then straighten (far)
// ---------------------------------------------------------------------------

function FocusShiftingAnimation() {
  const duration = 4;
  const times = [0, 0.25, 0.45, 0.7, 1];

  // Left eye: inward (right) for near, center for far
  const leftCx = [60, 72, 72, 60, 60];
  // Right eye: inward (left) for near, center for far
  const rightCx = [60, 48, 48, 60, 60];
  const cy = [50, 50, 50, 50, 50];

  const transition = { duration, repeat: Infinity, ease: "easeInOut" as const, times };

  return (
    <div className="relative flex flex-col items-center gap-4">
      {/* Near / Far indicator */}
      <div className="flex items-center gap-6 sm:gap-10">
        <motion.div
          animate={{ scale: [1, 1.2, 1.2, 1, 1], opacity: [0.3, 1, 1, 0.3, 0.3] }}
          transition={transition}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-sky-400/60 border border-sky-400/30" />
          <span className="text-[10px] text-white/30 uppercase tracking-wider">Near</span>
        </motion.div>
        <motion.div
          animate={{ opacity: [0.5, 0.2, 0.2, 0.5, 0.5] }}
          transition={transition}
          className="w-12 sm:w-16 h-[1px] bg-white/10"
        />
        <motion.div
          animate={{ scale: [1.2, 1, 1, 1.2, 1.2], opacity: [1, 0.3, 0.3, 1, 1] }}
          transition={transition}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-sky-400/40 border border-sky-400/20" />
          <span className="text-[10px] text-white/30 uppercase tracking-wider">Far</span>
        </motion.div>
      </div>

      <div className="flex gap-2 sm:gap-4">
        {/* Left eye */}
        <svg viewBox="0 0 120 100" className="w-24 h-20 sm:w-32 sm:h-24 text-white/60">
          <Eyebrow side="left" />
          <EyeSocket />
          <motion.circle animate={{ cx: leftCx, cy }} transition={transition} r="18" className="fill-amber-800" />
          <motion.circle animate={{ cx: leftCx, cy }} transition={transition} r="9" className="fill-zinc-900" />
          <motion.circle animate={{ cx: leftCx.map((v) => v + 5), cy: cy.map((v) => v - 5) }} transition={transition} r="4" className="fill-white/70" />
        </svg>
        {/* Right eye */}
        <svg viewBox="0 0 120 100" className="w-24 h-20 sm:w-32 sm:h-24 text-white/60">
          <Eyebrow side="right" />
          <EyeSocket />
          <motion.circle animate={{ cx: rightCx, cy }} transition={transition} r="18" className="fill-amber-800" />
          <motion.circle animate={{ cx: rightCx, cy }} transition={transition} r="9" className="fill-zinc-900" />
          <motion.circle animate={{ cx: rightCx.map((v) => v + 5), cy: cy.map((v) => v - 5) }} transition={transition} r="4" className="fill-white/70" />
        </svg>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Figure 8 Tracking – pupils trace an infinity / figure-8 path
// ---------------------------------------------------------------------------

function Figure8Animation() {
  const duration = 5;
  const cxKeys = [60, 74, 74, 60, 46, 46, 60, 74, 60];
  const cyKeys = [50, 40, 58, 50, 40, 58, 50, 40, 50];

  const transition = { duration, repeat: Infinity, ease: "easeInOut" as const };

  return (
    <div className="relative flex items-center justify-center">
      {/* Figure-8 trace guide */}
      <div className="absolute pointer-events-none">
        <svg viewBox="0 0 200 80" className="w-48 h-16 sm:w-64 sm:h-20 text-white/[0.06]">
          <path
            d="M100,40 C100,20 140,10 150,40 C160,70 100,60 100,40 C100,20 60,10 50,40 C40,70 100,60 100,40"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="4 4"
          />
        </svg>
      </div>

      <div className="flex gap-2 sm:gap-4">
        {[0, 1].map((i) => (
          <svg key={i} viewBox="0 0 120 100" className="w-24 h-20 sm:w-32 sm:h-24 text-white/60">
            <Eyebrow side={i === 0 ? "left" : "right"} />
            <EyeSocket />
            <motion.circle animate={{ cx: cxKeys, cy: cyKeys }} transition={transition} r="18" className="fill-amber-800" />
            <motion.circle animate={{ cx: cxKeys, cy: cyKeys }} transition={transition} r="9" className="fill-zinc-900" />
            <motion.circle
              animate={{ cx: cxKeys.map((v) => v + 5), cy: cyKeys.map((v) => v - 5) }}
              transition={transition}
              r="4"
              className="fill-white/70"
            />
          </svg>
        ))}
      </div>

      {/* Infinity symbol hint */}
      <motion.div
        animate={{ opacity: [0.1, 0.25, 0.1] }}
        transition={{ duration: 3, repeat: Infinity }}
        className="absolute -bottom-3 text-2xl sm:text-3xl text-white/10 font-light"
      >
        ∞
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Export — maps phase name to the right animation
// ---------------------------------------------------------------------------

export default function EyeExerciseAnimation({ phaseName }: EyeExerciseAnimationProps) {
  const name = phaseName.toLowerCase();

  if (name.includes("palming")) return <EyePalmingAnimation />;
  if (name.includes("circle")) return <EyeCirclesAnimation />;
  if (name.includes("focus") || name.includes("shifting")) return <FocusShiftingAnimation />;
  if (name.includes("figure") || name.includes("8") || name.includes("tracking")) return <Figure8Animation />;

  // Fallback: palming for any unknown eye exercise phase
  return <EyePalmingAnimation />;
}
