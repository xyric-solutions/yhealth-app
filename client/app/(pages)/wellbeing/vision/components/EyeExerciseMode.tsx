"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye, RotateCcw, Focus, Hand, Play, Pause, RotateCw,
  Clock, CheckCircle2, ArrowRight, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { eyeExerciseService } from "@/src/shared/services/vision.service";
import { toast } from "sonner";
import type { EyeExerciseType } from "@shared/types/domain/vision";

// ─── Exercise Definitions ───────────────────────────────────────────

interface ExerciseDef {
  type: EyeExerciseType;
  title: string;
  description: string;
  duration: number; // seconds
  icon: typeof Eye;
  accent: string;
  gradient: string;
  instructions: string[];
}

const EXERCISES: ExerciseDef[] = [
  {
    type: "trataka",
    title: "Trataka Gazing",
    description: "Fixed-point gazing to strengthen focus and calm the mind",
    duration: 120,
    icon: Eye,
    accent: "text-amber-400",
    gradient: "from-amber-500/10 to-orange-500/5",
    instructions: [
      "Sit comfortably with a straight spine",
      "Focus your gaze on the dot below without blinking",
      "When eyes water, close them and visualize the dot",
      "Open eyes and repeat until the timer ends",
    ],
  },
  {
    type: "eye_circles",
    title: "Eye Circles",
    description: "Smooth circular eye movements to improve range of motion",
    duration: 90,
    icon: RotateCcw,
    accent: "text-sky-400",
    gradient: "from-sky-500/10 to-blue-500/5",
    instructions: [
      "Keep your head still, move only your eyes",
      "Follow the dot as it traces a circle",
      "5 circles clockwise, then 5 counter-clockwise",
      "Blink naturally between sets",
    ],
  },
  {
    type: "focus_shift",
    title: "Focus Shifting",
    description: "Near-to-far focus transitions to strengthen eye muscles",
    duration: 120,
    icon: Focus,
    accent: "text-emerald-400",
    gradient: "from-emerald-500/10 to-teal-500/5",
    instructions: [
      "Hold your thumb 10 inches from your face",
      "Focus on the near dot for 5 seconds",
      "Shift focus to the far dot for 5 seconds",
      "Alternate smoothly without squinting",
    ],
  },
  {
    type: "palming",
    title: "Palming",
    description: "Warm darkness therapy to relax and restore tired eyes",
    duration: 90,
    icon: Hand,
    accent: "text-rose-400",
    gradient: "from-rose-500/10 to-pink-500/5",
    instructions: [
      "Rub your palms together vigorously until warm",
      "Cup palms gently over closed eyes",
      "Don't press on your eyeballs",
      "Breathe deeply and visualize darkness",
    ],
  },
];

// ─── Trataka Animation ──────────────────────────────────────────────

function TratakaAnimation() {
  return (
    <div className="relative flex items-center justify-center h-48">
      {/* Pulsing rings */}
      {[0, 0.8, 1.6].map((delay, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border border-amber-400/20"
          style={{ width: 80 + i * 40, height: 80 + i * 40 }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.1, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, delay }}
        />
      ))}
      {/* Center dot */}
      <motion.div
        className="w-4 h-4 rounded-full bg-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.6)]"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
    </div>
  );
}

// ─── Eye Circle Animation ───────────────────────────────────────────

function EyeCircleAnimation({ elapsed }: { elapsed: number }) {
  const angle = (elapsed * 4) % 360; // ~4 degrees per second
  const radius = 70;
  const x = Math.cos((angle * Math.PI) / 180) * radius;
  const y = Math.sin((angle * Math.PI) / 180) * radius;

  return (
    <div className="relative flex items-center justify-center h-48">
      {/* Circle path */}
      <div className="absolute w-36 h-36 rounded-full border border-dashed border-sky-400/20" />
      {/* Moving dot */}
      <motion.div
        className="absolute w-5 h-5 rounded-full bg-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.6)]"
        animate={{ x, y }}
        transition={{ duration: 0.1 }}
      />
      {/* Direction label */}
      <span className="absolute bottom-2 text-[10px] text-sky-400/50 uppercase tracking-wider">
        {elapsed % 20 < 10 ? "Clockwise" : "Counter-clockwise"}
      </span>
    </div>
  );
}

// ─── Focus Shift Animation ──────────────────────────────────────────

function FocusShiftAnimation({ elapsed }: { elapsed: number }) {
  const isNear = Math.floor(elapsed / 5) % 2 === 0;

  return (
    <div className="relative flex items-center justify-center h-48">
      <AnimatePresence mode="wait">
        <motion.div
          key={isNear ? "near" : "far"}
          initial={{ scale: isNear ? 0.3 : 1.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: isNear ? 1.5 : 0.3, opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-2"
        >
          <div className={cn(
            "rounded-full",
            isNear
              ? "w-10 h-10 bg-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.6)]"
              : "w-4 h-4 bg-emerald-400/60 shadow-[0_0_10px_rgba(52,211,153,0.3)]"
          )} />
          <span className="text-xs text-emerald-400/60">
            {isNear ? "Near — Focus here" : "Far — Look into the distance"}
          </span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── Palming Animation ──────────────────────────────────────────────

function PalmingAnimation() {
  return (
    <div className="relative flex items-center justify-center h-48">
      <motion.div
        className="flex items-center gap-4"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 4, repeat: Infinity }}
      >
        <Hand className="h-12 w-12 text-rose-400/40" style={{ transform: "scaleX(-1)" }} />
        <motion.div
          className="w-8 h-8 rounded-full bg-rose-400/10 border border-rose-400/20"
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
        <Hand className="h-12 w-12 text-rose-400/40" />
      </motion.div>
      <span className="absolute bottom-4 text-xs text-rose-400/40">Eyes closed — breathe deeply</span>
    </div>
  );
}

// ─── Active Exercise Overlay ────────────────────────────────────────

function ActiveExercise({
  exercise,
  onClose,
}: {
  exercise: ExerciseDef;
  onClose: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const [isComplete, setIsComplete] = useState(false);
  const sessionIdRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start backend session
  useEffect(() => {
    eyeExerciseService
      .startExercise({ exerciseType: exercise.type, durationSeconds: exercise.duration })
      .then((res) => {
        if (res.success && res.data?.session) {
          sessionIdRef.current = res.data.session.id;
        }
      })
      .catch(() => {});
  }, [exercise]);

  // Timer
  useEffect(() => {
    if (!isRunning || isComplete) return;
    intervalRef.current = setInterval(() => {
      setElapsed((prev) => {
        if (prev + 1 >= exercise.duration) {
          setIsComplete(true);
          setIsRunning(false);
          // Complete session
          if (sessionIdRef.current) {
            eyeExerciseService.completeExercise(sessionIdRef.current, {}).catch(() => {});
          }
          return exercise.duration;
        }
        return prev + 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, isComplete, exercise.duration]);

  const remaining = exercise.duration - elapsed;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const progress = elapsed / exercise.duration;

  const renderAnimation = () => {
    switch (exercise.type) {
      case "trataka": return <TratakaAnimation />;
      case "eye_circles": return <EyeCircleAnimation elapsed={elapsed} />;
      case "focus_shift": return <FocusShiftAnimation elapsed={elapsed} />;
      case "palming": return <PalmingAnimation />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950"
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors z-10"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="flex flex-col items-center gap-6 max-w-md px-6 text-center">
        {/* Title */}
        <div className="space-y-1">
          <p className="text-xs text-zinc-500 uppercase tracking-wider">{exercise.type.replace("_", " ")}</p>
          <h2 className="text-2xl font-bold text-white">{exercise.title}</h2>
        </div>

        {/* Animation area */}
        {!isComplete && renderAnimation()}

        {/* Complete state */}
        {isComplete && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-4 py-8"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/25">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
            <p className="text-lg font-semibold text-white">Exercise Complete!</p>
            <p className="text-sm text-zinc-400">Great work on your eye health.</p>
          </motion.div>
        )}

        {/* Timer */}
        {!isComplete && (
          <div className="space-y-3 w-full">
            <div className="text-4xl font-light text-white tabular-nums">
              {mins}:{secs.toString().padStart(2, "0")}
            </div>
            <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
              <motion.div
                className={cn("h-full rounded-full bg-gradient-to-r", exercise.gradient.replace("/10", "").replace("/5", ""))}
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-3">
          {!isComplete ? (
            <button
              onClick={() => setIsRunning(!isRunning)}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium hover:bg-white/10 transition-colors"
            >
              {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isRunning ? "Pause" : "Resume"}
            </button>
          ) : (
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors"
            >
              Done
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Instructions */}
        {!isComplete && (
          <div className="text-left w-full space-y-2 mt-4">
            <p className="text-[11px] text-zinc-600 uppercase tracking-wider font-medium">Instructions</p>
            {exercise.instructions.map((ins, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-[10px] text-zinc-600 mt-0.5">{i + 1}.</span>
                <span className="text-xs text-zinc-400">{ins}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

export default function EyeExerciseMode() {
  const [activeExercise, setActiveExercise] = useState<ExerciseDef | null>(null);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        {EXERCISES.map((ex) => {
          const Icon = ex.icon;
          const mins = Math.floor(ex.duration / 60);
          const secs = ex.duration % 60;
          return (
            <motion.div
              key={ex.type}
              whileHover={{ y: -4, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveExercise(ex)}
              className={cn(
                "group cursor-pointer overflow-hidden rounded-2xl",
                "border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-transparent",
                "backdrop-blur-2xl transition-all duration-500",
                "hover:border-white/[0.12] hover:shadow-xl"
              )}
            >
              <div className="p-5 sm:p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-xl",
                    "bg-gradient-to-br", ex.gradient,
                    "border border-white/[0.06] transition-transform duration-500",
                    "group-hover:scale-110 group-hover:rotate-3"
                  )}>
                    <Icon className={cn("h-6 w-6", ex.accent)} />
                  </div>
                  <span className="flex items-center gap-1 text-xs text-zinc-500">
                    <Clock className="h-3 w-3" />
                    {mins}:{secs.toString().padStart(2, "0")}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-[15px] text-white mb-1">{ex.title}</h3>
                  <p className="text-[13px] text-zinc-500 leading-relaxed">{ex.description}</p>
                </div>

                <div className="flex items-center gap-2 text-xs font-medium text-sky-400">
                  <Play className="h-3.5 w-3.5" />
                  Start Exercise
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      <AnimatePresence>
        {activeExercise && (
          <ActiveExercise
            exercise={activeExercise}
            onClose={() => setActiveExercise(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
