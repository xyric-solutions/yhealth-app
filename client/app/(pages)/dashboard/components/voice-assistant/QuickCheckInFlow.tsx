"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Clock, 
  CheckCircle2, 

  Activity, 

  Lightbulb,
  MessageCircle,
} from "lucide-react";

// Session phases for Quick Check-In (2.5 minutes)
const PHASES = [
  { id: "opening", label: "Opening", duration: 15, icon: MessageCircle },
  { id: "metric_review", label: "Metric Review", duration: 60, icon: Activity },
  { id: "recommendation", label: "Recommendation", duration: 60, icon: Lightbulb },
  { id: "closing", label: "Closing", duration: 15, icon: CheckCircle2 },
] as const;

type Phase = typeof PHASES[number]["id"];

interface QuickCheckInFlowProps {
  isActive: boolean;
  onPhaseChange?: (phase: Phase, phaseIndex: number) => void;
  onComplete?: () => void;
  onTimeWarning?: (secondsRemaining: number) => void;
}

export function QuickCheckInFlow({
  isActive,
  onPhaseChange,
  onComplete,
  onTimeWarning,
}: QuickCheckInFlowProps) {
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [phaseTimeElapsed, setPhaseTimeElapsed] = useState(0);
  const [totalTimeElapsed, setTotalTimeElapsed] = useState(0);
  const [showTimeWarning, setShowTimeWarning] = useState(false);
  const timeWarningShownRef = useRef(false);
  const lastPhaseIndexRef = useRef(currentPhaseIndex);

  const currentPhase = PHASES[currentPhaseIndex];
  const totalDuration = PHASES.reduce((sum, p) => sum + p.duration, 0);

  // Timer effect
  useEffect(() => {
    if (!isActive) return;

    const timer = setInterval(() => {
      setPhaseTimeElapsed((prev) => prev + 1);
      setTotalTimeElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive]);

  // Phase progression
  useEffect(() => {
    if (!isActive) return;

    if (phaseTimeElapsed >= currentPhase.duration && lastPhaseIndexRef.current === currentPhaseIndex) {
      if (currentPhaseIndex < PHASES.length - 1) {
        // Move to next phase
        const nextIndex = currentPhaseIndex + 1;
        lastPhaseIndexRef.current = nextIndex;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCurrentPhaseIndex(nextIndex);
        setPhaseTimeElapsed(0);
        onPhaseChange?.(PHASES[nextIndex].id, nextIndex);
      } else {
        // Session complete
        onComplete?.();
      }
    }
  }, [phaseTimeElapsed, currentPhase.duration, currentPhaseIndex, isActive, onPhaseChange, onComplete]);

  // Time warning
  useEffect(() => {
    const timeRemaining = totalDuration - totalTimeElapsed;
    if (timeRemaining <= 30 && timeRemaining > 0 && !timeWarningShownRef.current) {
      timeWarningShownRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowTimeWarning(true);
      onTimeWarning?.(timeRemaining);
    }
  }, [totalTimeElapsed, totalDuration, onTimeWarning]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = (totalTimeElapsed / totalDuration) * 100;
  const phaseProgress = (phaseTimeElapsed / currentPhase.duration) * 100;

  if (!isActive) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 backdrop-blur-xl rounded-xl border border-blue-500/20 p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Quick Check-In</h4>
            <p className="text-xs text-white/60">2.5 minute session</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-white">{formatTime(totalTimeElapsed)}</p>
          <p className="text-xs text-white/60">/ {formatTime(totalDuration)}</p>
        </div>
      </div>

      {/* Overall Progress */}
      <div className="mb-4">
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
            style={{ width: `${Math.min(progress, 100)}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Phase Indicators */}
      <div className="flex items-center justify-between mb-4">
        {PHASES.map((phase, index) => {
          const Icon = phase.icon;
          const isCompleted = index < currentPhaseIndex;
          const isCurrent = index === currentPhaseIndex;

          return (
            <div key={phase.id} className="flex items-center">
              <motion.div
                className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-all ${
                  isCompleted
                    ? "bg-green-500/30 border-2 border-green-500"
                    : isCurrent
                    ? "bg-blue-500/30 border-2 border-blue-500"
                    : "bg-white/10 border-2 border-white/20"
                }`}
                animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 1, repeat: isCurrent ? Infinity : 0 }}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isCompleted
                      ? "text-green-400"
                      : isCurrent
                      ? "text-blue-400"
                      : "text-white/40"
                  }`}
                />
                {isCurrent && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-blue-400"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}
              </motion.div>
              {index < PHASES.length - 1 && (
                <div className="w-8 sm:w-12 h-0.5 mx-1">
                  <div
                    className={`h-full transition-all ${
                      isCompleted ? "bg-green-500" : "bg-white/20"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Current Phase Info */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentPhase.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="p-3 bg-white/5 rounded-lg"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {(() => {
                const Icon = currentPhase.icon;
                return <Icon className="w-4 h-4 text-blue-400" />;
              })()}
              <span className="text-sm font-medium text-white">{currentPhase.label}</span>
            </div>
            <div className="text-xs text-white/60">
              {formatTime(currentPhase.duration - phaseTimeElapsed)} remaining
            </div>
          </div>
          <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-blue-500"
              style={{ width: `${Math.min(phaseProgress, 100)}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Time Warning */}
      <AnimatePresence>
        {showTimeWarning && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="mt-3 p-2 bg-amber-500/20 border border-amber-500/30 rounded-lg"
          >
            <p className="text-xs text-amber-400 text-center">
              Less than 30 seconds remaining in session
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default QuickCheckInFlow;

