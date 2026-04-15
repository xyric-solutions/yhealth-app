"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 

  Target,
  BarChart3,
  MessageCircle,
  Settings2,
  ThumbsUp,
} from "lucide-react";

// Session phases for Goal Review (10 minutes)
const PHASES = [
  { id: "goal_selection", label: "Goal Selection", duration: 60, icon: Target, description: "Select which goal to review" },
  { id: "progress_analysis", label: "Progress Analysis", duration: 150, icon: BarChart3, description: "Analyze progress and metrics" },
  { id: "barrier_exploration", label: "Barrier Exploration", duration: 150, icon: MessageCircle, description: "Identify obstacles and challenges" },
  { id: "goal_adjustment", label: "Goal Adjustment", duration: 120, icon: Settings2, description: "Modify goals if needed" },
  { id: "commitment", label: "Commitment", duration: 120, icon: ThumbsUp, description: "Commit to next steps" },
] as const;

type Phase = typeof PHASES[number]["id"];

interface Goal {
  id: string;
  name: string;
  progress: number;
  status: "on_track" | "at_risk" | "behind";
  daysRemaining?: number;
}

interface GoalReviewFlowProps {
  isActive: boolean;
  goals?: Goal[];
  selectedGoalId?: string;
  onPhaseChange?: (phase: Phase, phaseIndex: number) => void;
  onComplete?: () => void;
  onTimeWarning?: (secondsRemaining: number) => void;
  onGoalSelect?: (goalId: string) => void;
}

export function GoalReviewFlow({
  isActive,
  goals = [],
  selectedGoalId,
  onPhaseChange,
  onComplete,
  onTimeWarning,
  onGoalSelect,
}: GoalReviewFlowProps) {
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [phaseTimeElapsed, setPhaseTimeElapsed] = useState(0);
  const [totalTimeElapsed, setTotalTimeElapsed] = useState(0);
  const [showTimeWarning, setShowTimeWarning] = useState(false);
  const [localSelectedGoal, setLocalSelectedGoal] = useState<string | undefined>(selectedGoalId);
  const timeWarningShownRef = useRef(false);
  const lastPhaseIndexRef = useRef(currentPhaseIndex);

  const currentPhase = PHASES[currentPhaseIndex];
  const totalDuration = PHASES.reduce((sum, p) => sum + p.duration, 0);
  const selectedGoal = goals.find(g => g.id === localSelectedGoal);

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
        const nextIndex = currentPhaseIndex + 1;
        lastPhaseIndexRef.current = nextIndex;
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
    if (timeRemaining <= 120 && timeRemaining > 60 && !timeWarningShownRef.current) {
      timeWarningShownRef.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowTimeWarning(true);
      onTimeWarning?.(timeRemaining);
    }
  }, [totalTimeElapsed, totalDuration, onTimeWarning]);

  const handleGoalSelect = (goalId: string) => {
    setLocalSelectedGoal(goalId);
    onGoalSelect?.(goalId);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getStatusColor = (status: Goal["status"]) => {
    switch (status) {
      case "on_track":
        return "text-green-400 bg-green-500/20";
      case "at_risk":
        return "text-amber-400 bg-amber-500/20";
      case "behind":
        return "text-red-400 bg-red-500/20";
    }
  };

  const progress = (totalTimeElapsed / totalDuration) * 100;
  const phaseProgress = (phaseTimeElapsed / currentPhase.duration) * 100;

  if (!isActive) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 backdrop-blur-xl rounded-xl border border-green-500/20 p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
            <Target className="w-4 h-4 text-green-400" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Goal Review</h4>
            <p className="text-xs text-white/60">10 minute focused review</p>
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
            className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
            style={{ width: `${Math.min(progress, 100)}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Goal Selection Phase */}
      {currentPhase.id === "goal_selection" && goals.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-xs text-white/60 mb-2">Select a goal to review:</p>
          {goals.slice(0, 3).map((goal) => (
            <motion.button
              key={goal.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleGoalSelect(goal.id)}
              className={`w-full p-3 rounded-lg text-left transition-all ${
                localSelectedGoal === goal.id
                  ? "bg-green-500/20 border-2 border-green-500/50"
                  : "bg-white/5 border-2 border-transparent hover:border-white/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{goal.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${goal.progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-white/60">{goal.progress}%</span>
                  </div>
                </div>
                <span className={`ml-3 px-2 py-0.5 text-xs font-medium rounded ${getStatusColor(goal.status)}`}>
                  {goal.status.replace("_", " ")}
                </span>
              </div>
              {goal.daysRemaining !== undefined && (
                <p className="text-xs text-white/40 mt-1">
                  {goal.daysRemaining} days remaining
                </p>
              )}
            </motion.button>
          ))}
        </div>
      )}

      {/* Selected Goal Display */}
      {selectedGoal && currentPhase.id !== "goal_selection" && (
        <div className="mb-4 p-3 bg-white/5 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/60">Reviewing</p>
              <p className="text-sm font-medium text-white">{selectedGoal.name}</p>
            </div>
            <div className="text-right">
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${getStatusColor(selectedGoal.status)}`}>
                {selectedGoal.progress}% complete
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Phase Timeline */}
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
                  ? "bg-emerald-500"
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
          className="p-3 bg-white/5 rounded-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {(() => {
                const Icon = currentPhase.icon;
                return <Icon className="w-4 h-4 text-green-400" />;
              })()}
              <span className="text-sm font-medium text-white">{currentPhase.label}</span>
            </div>
            <span className="text-xs text-white/60">
              {formatTime(currentPhase.duration - phaseTimeElapsed)} remaining
            </span>
          </div>
          <p className="text-xs text-white/60 mb-2">{currentPhase.description}</p>
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-green-500"
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
              About 2 minutes remaining to complete review
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default GoalReviewFlow;

