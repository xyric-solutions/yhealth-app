"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Youtube } from "lucide-react";
import { cn } from "@/lib/utils";
import type { useYogaSession } from "@/hooks/use-yoga-session";
import SessionPlayerControls from "./SessionPlayerControls";
import DemoVideoModal from "./DemoVideoModal";
import EyeExerciseAnimation from "./EyeExerciseAnimation";

interface SessionPlayerProps {
  yogaSession: ReturnType<typeof useYogaSession>;
  onClose: () => void;
}

const ambientGradients: Record<
  string,
  { bg: string; accent: string; particle: string }
> = {
  forest: {
    bg: "from-emerald-950 via-green-950 to-zinc-950",
    accent: "from-emerald-400 to-green-500",
    particle: "bg-emerald-400",
  },
  ocean: {
    bg: "from-blue-950 via-cyan-950 to-zinc-950",
    accent: "from-blue-400 to-cyan-500",
    particle: "bg-cyan-400",
  },
  mountain: {
    bg: "from-slate-950 via-stone-950 to-zinc-950",
    accent: "from-slate-400 to-stone-500",
    particle: "bg-slate-400",
  },
  night: {
    bg: "from-indigo-950 via-violet-950 to-zinc-950",
    accent: "from-indigo-400 to-violet-500",
    particle: "bg-violet-400",
  },
  sunrise: {
    bg: "from-amber-950 via-orange-950 to-zinc-950",
    accent: "from-amber-400 to-orange-500",
    particle: "bg-amber-400",
  },
  space: {
    bg: "from-purple-950 via-indigo-950 to-zinc-950",
    accent: "from-purple-400 to-indigo-500",
    particle: "bg-purple-400",
  },
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Animated background orbs
// ---------------------------------------------------------------------------

function BackgroundOrbs({ particleClass }: { particleClass: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Large slow orb */}
      <motion.div
        animate={{
          x: [0, 100, -50, 0],
          y: [0, -80, 50, 0],
          scale: [1, 1.2, 0.9, 1],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        className={cn(
          "absolute -top-32 -right-32 h-96 w-96 rounded-full blur-[100px] opacity-[0.08]",
          particleClass
        )}
      />
      {/* Medium orb */}
      <motion.div
        animate={{
          x: [0, -60, 80, 0],
          y: [0, 100, -40, 0],
          scale: [1, 0.8, 1.1, 1],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 3,
        }}
        className={cn(
          "absolute -bottom-24 -left-24 h-72 w-72 rounded-full blur-[80px] opacity-[0.06]",
          particleClass
        )}
      />
      {/* Small floating orb */}
      <motion.div
        animate={{
          x: [0, 40, -30, 0],
          y: [0, -50, 30, 0],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 6,
        }}
        className={cn(
          "absolute top-1/3 left-1/4 h-48 w-48 rounded-full blur-[60px] opacity-[0.04]",
          particleClass
        )}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Breathing pulse visual cue
// ---------------------------------------------------------------------------

function BreathingPulse({ isBreathing }: { isBreathing: boolean }) {
  if (!isBreathing) return null;

  return (
    <div className="relative flex items-center justify-center">
      <motion.div
        animate={{
          scale: [1, 1.4, 1],
          opacity: [0.15, 0.3, 0.15],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute h-32 w-32 rounded-full border border-white/10"
      />
      <motion.div
        animate={{
          scale: [1, 1.25, 1],
          opacity: [0.1, 0.2, 0.1],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.5,
        }}
        className="absolute h-24 w-24 rounded-full border border-white/10"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Celebration particles for completion
// ---------------------------------------------------------------------------

function CelebrationParticles() {
  const particles = useMemo(
    () =>
      Array.from({ length: 24 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 2,
        duration: 2 + Math.random() * 2,
        size: 3 + Math.random() * 5,
        color:
          [
            "bg-emerald-400",
            "bg-sky-400",
            "bg-amber-400",
            "bg-cyan-400",
            "bg-emerald-400",
            "bg-rose-400",
          ][i % 6],
      })),
    []
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          initial={{
            x: `${p.x}vw`,
            y: "110%",
            opacity: 0,
            scale: 0,
          }}
          animate={{
            y: "-10%",
            opacity: [0, 1, 1, 0],
            scale: [0, 1, 1, 0.5],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: "easeOut",
          }}
          className={cn("absolute rounded-full", p.color)}
          style={{ width: p.size, height: p.size }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Phase progress dots with connecting line
// ---------------------------------------------------------------------------

function PhaseIndicator({
  phases,
  currentIndex,
}: {
  phases: { name?: string }[];
  currentIndex: number;
}) {
  if (phases.length <= 1) return null;

  return (
    <div className="flex items-center gap-1">
      {phases.map((_, idx) => {
        const isActive = idx === currentIndex;
        const isComplete = idx < currentIndex;

        return (
          <div key={idx} className="flex items-center">
            <motion.div
              animate={{
                scale: isActive ? 1.3 : 1,
                opacity: isActive ? 1 : isComplete ? 0.6 : 0.2,
              }}
              className="relative"
            >
              <div
                className={cn(
                  "h-2 w-2 rounded-full transition-colors duration-500",
                  isActive
                    ? "bg-white"
                    : isComplete
                      ? "bg-white/50"
                      : "bg-white/20"
                )}
              />
              {/* Glow for active */}
              {isActive && (
                <motion.div
                  animate={{
                    scale: [1, 1.8, 1],
                    opacity: [0.4, 0, 0.4],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute inset-0 rounded-full bg-white"
                />
              )}
            </motion.div>

            {/* Connecting line */}
            {idx < phases.length - 1 && (
              <div
                className={cn(
                  "h-[1px] w-4 sm:w-6 mx-0.5 transition-colors duration-500",
                  idx < currentIndex ? "bg-white/30" : "bg-white/10"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function SessionPlayer({
  yogaSession,
  onClose,
}: SessionPlayerProps) {
  const {
    state,
    session,
    currentPhaseIndex,
    currentPhase,
    elapsedSeconds,
    phaseElapsedSeconds,
    totalDurationSeconds,
    pause,
    resume,
    skipPhase,
    prevPhase,
    complete,
    reset,
  } = yogaSession;

  const [showDemo, setShowDemo] = useState(false);

  const theme = session
    ? ambientGradients[session.ambientTheme] || ambientGradients.forest
    : ambientGradients.forest;

  const overallProgress = totalDurationSeconds
    ? Math.min(elapsedSeconds / totalDurationSeconds, 1)
    : 0;

  const phaseProgress =
    currentPhase && currentPhase.durationSeconds
      ? Math.min(phaseElapsedSeconds / currentPhase.durationSeconds, 1)
      : 0;

  const phaseTimeRemaining = currentPhase
    ? Math.max(0, currentPhase.durationSeconds - phaseElapsedSeconds)
    : 0;

  const phases = session?.phases || [];

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const phaseLabel = currentPhase?.phaseType
    ? currentPhase.phaseType.charAt(0).toUpperCase() +
      currentPhase.phaseType.slice(1)
    : "";

  const isBreathingPhase =
    currentPhase?.phaseType === "warmup" ||
    currentPhase?.phaseType === "savasana";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-between",
        "bg-linear-to-b",
        theme.bg
      )}
    >
      {/* Animated background */}
      <BackgroundOrbs particleClass={theme.particle} />

      {/* Top Bar - Glass morphism */}
      <div className="relative z-10 w-full">
        <div
          className={cn(
            "mx-3 mt-3 sm:mx-4 sm:mt-4 rounded-2xl px-4 py-3 sm:px-5 sm:py-3.5",
            "bg-white/5 backdrop-blur-2xl",
            "border border-white/8",
            "flex items-center justify-between"
          )}
        >
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-semibold text-white truncate">
              {session?.title || "Session"}
            </h2>
            <p className="text-[11px] sm:text-xs text-white/40 tabular-nums mt-0.5">
              {formatTime(elapsedSeconds)} / {formatTime(totalDurationSeconds)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDemo(true)}
              aria-label="Watch demo"
              className={cn(
                "flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-medium",
                "bg-red-500/10 hover:bg-red-500/15",
                "text-red-400 hover:text-red-300",
                "border border-red-500/15 hover:border-red-500/25",
                "transition-all duration-200"
              )}
            >
              <Youtube className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Demo</span>
            </button>
            <button
              onClick={handleClose}
              aria-label="Close session"
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-xl",
                "bg-white/8 hover:bg-white/15",
                "text-white/60 hover:text-white",
                "transition-all duration-200"
              )}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="px-4 sm:px-5 mt-3">
          <div className="h-[3px] w-full rounded-full bg-white/6 overflow-hidden">
            <motion.div
              className={cn(
                "h-full rounded-full bg-linear-to-r",
                theme.accent
              )}
              animate={{ width: `${overallProgress * 100}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      {/* Center Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center gap-4 sm:gap-6 px-4 w-full max-w-lg mx-auto">
        <AnimatePresence mode="wait">
          {state === "complete" ? (
            /* ----------- Complete State ----------- */
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="flex flex-col items-center text-center gap-5"
            >
              <CelebrationParticles />

              {/* Glowing icon */}
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="relative"
              >
                <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-2xl scale-150" />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-linear-to-br from-emerald-500/20 to-sky-500/20 border border-white/10">
                  <Sparkles className="h-8 w-8 text-emerald-400" />
                </div>
              </motion.div>

              <div>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-2xl sm:text-3xl font-bold text-white"
                >
                  Namaste
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="text-sm text-white/40 mt-2"
                >
                  {formatTime(elapsedSeconds)} of mindful practice
                </motion.p>
              </div>

              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleClose}
                className={cn(
                  "mt-2 px-8 py-3 rounded-xl",
                  "bg-linear-to-r from-emerald-500 to-sky-500",
                  "text-white text-sm font-semibold",
                  "shadow-lg shadow-emerald-500/25",
                  "hover:shadow-xl hover:shadow-emerald-500/30",
                  "transition-shadow duration-300"
                )}
              >
                Complete
              </motion.button>
            </motion.div>
          ) : (
            /* ----------- Active Session ----------- */
            <motion.div
              key={`phase-${currentPhaseIndex}`}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="flex flex-col items-center gap-4 sm:gap-5 w-full"
            >
              {/* Phase Type Label */}
              <motion.span
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full",
                  "bg-white/6 border border-white/8",
                  "text-[11px] uppercase tracking-[0.2em] text-white/40 font-medium"
                )}
              >
                {phaseLabel}
              </motion.span>

              {/* Breathing pulse */}
              <BreathingPulse isBreathing={isBreathingPhase} />

              {/* Eye exercise animation */}
              {session?.sessionType === "eye_exercise" && currentPhase?.name && (
                <div className="py-2">
                  <EyeExerciseAnimation phaseName={currentPhase.name} />
                </div>
              )}

              {/* Phase Name */}
              <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white text-center leading-tight">
                {currentPhase?.name || ""}
              </h3>

              {/* Timer Countdown */}
              <div className="text-5xl sm:text-6xl md:text-7xl font-extralight text-white tabular-nums tracking-tight">
                {formatTime(phaseTimeRemaining)}
              </div>

              {/* Phase Progress Bar */}
              <div className="w-48 sm:w-64 h-1 rounded-full bg-white/8 overflow-hidden">
                <motion.div
                  className={cn(
                    "h-full rounded-full bg-linear-to-r",
                    theme.accent
                  )}
                  animate={{ width: `${phaseProgress * 100}%` }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                />
              </div>

              {/* Narration / Instructions */}
              {currentPhase?.narrationScript && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-sm text-white/40 text-center max-w-sm leading-relaxed"
                >
                  {currentPhase.narrationScript}
                </motion.p>
              )}

              {/* Phase Indicator Dots */}
              <div className="mt-2">
                <PhaseIndicator
                  phases={phases}
                  currentIndex={currentPhaseIndex}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls */}
      <AnimatePresence>
        {state !== "complete" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="relative z-10 w-full pb-6 sm:pb-8 md:pb-10"
          >
            <SessionPlayerControls
              state={state}
              elapsed={elapsedSeconds}
              total={totalDurationSeconds}
              phaseProgress={phaseProgress}
              onPause={pause}
              onResume={resume}
              onSkip={skipPhase}
              onPrev={prevPhase}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <DemoVideoModal
        isOpen={showDemo}
        onClose={() => setShowDemo(false)}
        sessionName={currentPhase?.name || session?.title || "Yoga"}
        accentColor="text-emerald-400"
      />
    </motion.div>
  );
}
