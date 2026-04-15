"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 

  CheckCircle2, 
  MessageCircle,
  BarChart3,
  Lightbulb,
  Target,
  ListTodo,
  Sparkles,
} from "lucide-react";

// Session phases for Coaching Session (10 minutes)
const PHASES = [
  { id: "opening_reflection", label: "Opening & Reflection", duration: 90, icon: MessageCircle, description: "Welcome and reflect on recent experiences" },
  { id: "data_review", label: "Data Review", duration: 120, icon: BarChart3, description: "Review health metrics and progress" },
  { id: "insight_discussion", label: "Insight Discussion", duration: 150, icon: Lightbulb, description: "Discuss patterns and discoveries" },
  { id: "goal_adjustment", label: "Goal Adjustment", duration: 150, icon: Target, description: "Review and adjust goals" },
  { id: "action_planning", label: "Action Planning", duration: 60, icon: ListTodo, description: "Create actionable next steps" },
  { id: "closing", label: "Closing", duration: 30, icon: CheckCircle2, description: "Summarize and commit" },
] as const;

type Phase = typeof PHASES[number]["id"];

interface CoachingSessionFlowProps {
  isActive: boolean;
  onPhaseChange?: (phase: Phase, phaseIndex: number) => void;
  onComplete?: () => void;
  onTimeWarning?: (secondsRemaining: number) => void;
  onExtendRequest?: () => void;
}

export function CoachingSessionFlow({
  isActive,
  onPhaseChange,
  onComplete,
  onTimeWarning,
  onExtendRequest,
}: CoachingSessionFlowProps) {
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [phaseTimeElapsed, setPhaseTimeElapsed] = useState(0);
  const [totalTimeElapsed, setTotalTimeElapsed] = useState(0);
  const [showTimeWarning, setShowTimeWarning] = useState(false);
  const [showExtendOption, setShowExtendOption] = useState(false);

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

    if (phaseTimeElapsed >= currentPhase.duration) {
      if (currentPhaseIndex < PHASES.length - 1) {
        const nextIndex = currentPhaseIndex + 1;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCurrentPhaseIndex(nextIndex);
        setPhaseTimeElapsed(0);
        onPhaseChange?.(PHASES[nextIndex].id, nextIndex);
      } else {
        onComplete?.();
      }
    }
  }, [phaseTimeElapsed, currentPhase.duration, currentPhaseIndex, isActive, onPhaseChange, onComplete]);

  // Time warning at 2 minutes
  useEffect(() => {
    const timeRemaining = totalDuration - totalTimeElapsed;
    if (timeRemaining <= 120 && timeRemaining > 60 && !showTimeWarning) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowTimeWarning(true);
      onTimeWarning?.(timeRemaining);
    }
    // Show extend option at 1 minute
    if (timeRemaining <= 60 && timeRemaining > 30 && !showExtendOption) {
      setShowExtendOption(true);
    }
  }, [totalTimeElapsed, totalDuration, showTimeWarning, showExtendOption, onTimeWarning]);

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
      className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 backdrop-blur-xl rounded-xl border border-purple-500/20 p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Coaching Session</h4>
            <p className="text-xs text-white/60">Deep dive coaching</p>
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
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
            style={{ width: `${Math.min(progress, 100)}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Phase Timeline - Compact */}
      <div className="mb-4 flex gap-1">
        {PHASES.map((phase, index) => {
          const isCompleted = index < currentPhaseIndex;
          const isCurrent = index === currentPhaseIndex;

          return (
            <div
              key={phase.id}
              className={`flex-1 h-1.5 rounded-full transition-all ${
                isCompleted
                  ? "bg-green-500"
                  : isCurrent
                  ? "bg-purple-500"
                  : "bg-white/20"
              }`}
              title={phase.label}
            />
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
          className="p-4 bg-white/5 rounded-lg"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              {(() => {
                const Icon = currentPhase.icon;
                return <Icon className="w-5 h-5 text-purple-400" />;
              })()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h5 className="text-sm font-semibold text-white">{currentPhase.label}</h5>
                <span className="text-xs text-white/60">
                  Phase {currentPhaseIndex + 1}/{PHASES.length}
                </span>
              </div>
              <p className="text-xs text-white/60 mb-2">{currentPhase.description}</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">
                  {formatTime(currentPhase.duration - phaseTimeElapsed)} remaining
                </span>
              </div>
              <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-purple-500"
                  style={{ width: `${Math.min(phaseProgress, 100)}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Time Warning */}
      <AnimatePresence>
        {showTimeWarning && !showExtendOption && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="mt-3 p-2 bg-amber-500/20 border border-amber-500/30 rounded-lg"
          >
            <p className="text-xs text-amber-400 text-center">
              About 2 minutes remaining in session
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Extend Option */}
      <AnimatePresence>
        {showExtendOption && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="mt-3 p-3 bg-purple-500/20 border border-purple-500/30 rounded-lg"
          >
            <p className="text-xs text-purple-300 text-center mb-2">
              Would you like to extend the session?
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={onExtendRequest}
                className="px-3 py-1.5 text-xs font-medium bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
              >
                Extend 10 min
              </button>
              <button
                onClick={() => setShowExtendOption(false)}
                className="px-3 py-1.5 text-xs font-medium bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
              >
                Continue
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default CoachingSessionFlow;

