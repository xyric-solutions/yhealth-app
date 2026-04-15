"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  RotateCcw,
  Check,
  Wind,
  Timer,
  Target,
  Zap,
  Trophy,
  ChevronRight,
  Sparkles,
  Flame,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LungAnimation, type BreathingPhase } from "./LungAnimation";
import { cn } from "@/lib/utils";

export type BreathingTestType = "breath_hold" | "box_breathing" | "4-7-8" | "relaxation";

type DifficultyLevel = "beginner" | "intermediate" | "advanced" | "master";

interface BreathingPattern {
  name: string;
  description: string;
  inhale: number;
  hold: number;
  exhale: number;
  holdAfterExhale?: number;
  cycles: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  gradient: string;
}

interface DifficultyConfig {
  name: string;
  label: string;
  multiplier: number;
  color: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const DIFFICULTY_LEVELS: Record<DifficultyLevel, DifficultyConfig> = {
  beginner: {
    name: "beginner",
    label: "Beginner",
    multiplier: 0.75,
    color: "text-emerald-400",
    icon: Star,
    description: "Shorter durations, easier pace",
  },
  intermediate: {
    name: "intermediate",
    label: "Intermediate",
    multiplier: 1,
    color: "text-cyan-400",
    icon: Zap,
    description: "Standard timing",
  },
  advanced: {
    name: "advanced",
    label: "Advanced",
    multiplier: 1.25,
    color: "text-amber-400",
    icon: Flame,
    description: "Extended durations",
  },
  master: {
    name: "master",
    label: "Master",
    multiplier: 1.5,
    color: "text-purple-400",
    icon: Trophy,
    description: "Maximum challenge",
  },
};

const BREATHING_PATTERNS: Record<BreathingTestType, BreathingPattern> = {
  breath_hold: {
    name: "Breath Hold Test",
    description: "Measure your maximum breath hold time",
    inhale: 4,
    hold: 999,
    exhale: 4,
    cycles: 1,
    icon: Timer,
    color: "cyan",
    gradient: "from-cyan-500 to-teal-500",
  },
  box_breathing: {
    name: "Box Breathing",
    description: "4-4-4-4 pattern for calm focus",
    inhale: 4,
    hold: 4,
    exhale: 4,
    holdAfterExhale: 4,
    cycles: 4,
    icon: Target,
    color: "emerald",
    gradient: "from-emerald-500 to-green-500",
  },
  "4-7-8": {
    name: "4-7-8 Technique",
    description: "Deep relaxation breathing",
    inhale: 4,
    hold: 7,
    exhale: 8,
    cycles: 4,
    icon: Wind,
    color: "violet",
    gradient: "from-violet-500 to-purple-500",
  },
  relaxation: {
    name: "Deep Relaxation",
    description: "Slow, calming breath pattern",
    inhale: 5,
    hold: 2,
    exhale: 7,
    cycles: 6,
    icon: Sparkles,
    color: "pink",
    gradient: "from-pink-500 to-rose-500",
  },
};

interface TestResult {
  testType: BreathingTestType;
  patternName: string;
  breathHoldDurationSeconds?: number;
  totalCyclesCompleted: number;
  totalDurationSeconds: number;
  consistencyScore?: number;
  startedAt: string;
  difficulty: DifficultyLevel;
}

interface BreathingTestProps {
  onComplete?: (result: TestResult) => void;
  className?: string;
}

export function BreathingTest({ onComplete, className }: BreathingTestProps) {
  const [selectedPattern, setSelectedPattern] = useState<BreathingTestType>("breath_hold");
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("intermediate");
  const [phase, setPhase] = useState<BreathingPhase>("idle");
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [phaseTime, setPhaseTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [cyclesCompleted, setCyclesCompleted] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [breathHoldTime, setBreathHoldTime] = useState(0);
  const [phaseTimes, setPhaseTimes] = useState<number[]>([]);
  const [step, setStep] = useState<"pattern" | "difficulty" | "test">("pattern");
  const [isHoldAfterExhale, setIsHoldAfterExhale] = useState(false);

  const startTimeRef = useRef<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasCompletedRef = useRef(false);

  const pattern = BREATHING_PATTERNS[selectedPattern];
  const difficultyConfig = DIFFICULTY_LEVELS[difficulty];
  const isBreathHoldTest = selectedPattern === "breath_hold";

  // Apply difficulty multiplier to pattern timings
  const getAdjustedTime = (time: number): number => {
    if (time === 999) return 999;
    return Math.round(time * difficultyConfig.multiplier);
  };

   
  const getPhaseTarget = useCallback((): number => {
    if (isBreathHoldTest && phase === "hold") return 999;
    const baseTime = (() => {
      switch (phase) {
        case "inhale": return pattern.inhale;
        case "hold":
          // Use holdAfterExhale duration if we're in that phase
          return isHoldAfterExhale && pattern.holdAfterExhale
            ? pattern.holdAfterExhale
            : pattern.hold;
        case "exhale": return pattern.exhale;
        default: return 0;
      }
    })();
    return getAdjustedTime(baseTime);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, pattern, isBreathHoldTest, isHoldAfterExhale, difficultyConfig.multiplier]);

  const getNextPhase = useCallback((currentPhase: BreathingPhase, currentIsHoldAfterExhale: boolean): { phase: BreathingPhase; isHoldAfterExhale: boolean } => {
    switch (currentPhase) {
      case "inhale":
        return { phase: "hold", isHoldAfterExhale: false };
      case "hold":
        if (currentIsHoldAfterExhale) {
          // After hold-after-exhale, go back to inhale (completing the cycle)
          return { phase: "inhale", isHoldAfterExhale: false };
        }
        return { phase: "exhale", isHoldAfterExhale: false };
      case "exhale":
        if (pattern.holdAfterExhale) {
          // Go to hold-after-exhale
          return { phase: "hold", isHoldAfterExhale: true };
        }
        // No hold after exhale, go directly to inhale
        return { phase: "inhale", isHoldAfterExhale: false };
      default:
        return { phase: "inhale", isHoldAfterExhale: false };
    }
  }, [pattern]);

  const startTest = useCallback(() => {
    hasCompletedRef.current = false; // Reset completion guard
    setIsRunning(true);
    setIsPaused(false);
    setPhase("inhale");
    setPhaseTime(0);
    setTotalTime(0);
    setCyclesCompleted(0);
    setShowResults(false);
    setBreathHoldTime(0);
    setPhaseTimes([]);
    setIsHoldAfterExhale(false);
    startTimeRef.current = new Date();
  }, []);

  const stopTest = useCallback(() => {
    // Guard against double submission
    if (hasCompletedRef.current) {
      return;
    }
    hasCompletedRef.current = true;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const result: TestResult = {
      testType: selectedPattern,
      patternName: pattern.name,
      totalCyclesCompleted: cyclesCompleted,
      totalDurationSeconds: Math.round(totalTime),
      startedAt: startTimeRef.current?.toISOString() || new Date().toISOString(),
      difficulty,
    };

    if (isBreathHoldTest) {
      result.breathHoldDurationSeconds = Math.round(breathHoldTime * 10) / 10;
    }

    if (!isBreathHoldTest && phaseTimes.length > 2) {
      const avgTime = phaseTimes.reduce((a, b) => a + b, 0) / phaseTimes.length;
      const variance = phaseTimes.reduce((sum, t) => sum + Math.pow(t - avgTime, 2), 0) / phaseTimes.length;
      const consistency = Math.max(0, 100 - variance * 10);
      result.consistencyScore = Math.round(consistency);
    }

    setIsRunning(false);
    setIsPaused(false);
    setPhase("idle");
    setShowResults(true);

    if (onComplete) {
      onComplete(result);
    }
  }, [selectedPattern, pattern, cyclesCompleted, totalTime, breathHoldTime, phaseTimes, isBreathHoldTest, onComplete, difficulty]);

  const pauseTest = useCallback(() => {
    setIsPaused(!isPaused);
  }, [isPaused]);

  const resetTest = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    hasCompletedRef.current = false; // Reset completion guard
    setIsRunning(false);
    setIsPaused(false);
    setPhase("idle");
    setPhaseTime(0);
    setTotalTime(0);
    setCyclesCompleted(0);
    setShowResults(false);
    setBreathHoldTime(0);
    setPhaseTimes([]);
    setIsHoldAfterExhale(false);
    startTimeRef.current = null;
    setStep("pattern");
  }, []);

  useEffect(() => {
    if (isRunning && !isPaused) {
      intervalRef.current = setInterval(() => {
        setPhaseTime((prev) => {
          const newTime = prev + 0.1;
          const target = getPhaseTarget();

          if (isBreathHoldTest && phase === "hold") {
            setBreathHoldTime(newTime);
          }

          if (!isBreathHoldTest || phase !== "hold") {
            if (newTime >= target) {
              setPhaseTimes((prevTimes) => [...prevTimes, newTime]);
              const nextState = getNextPhase(phase, isHoldAfterExhale);

              // Cycle completes when transitioning to inhale
              // For patterns with holdAfterExhale: hold (after exhale) -> inhale
              // For patterns without holdAfterExhale: exhale -> inhale
              if (nextState.phase === "inhale") {
                setCyclesCompleted((prev) => {
                  const newCycles = prev + 1;
                  if (newCycles >= pattern.cycles) {
                    setTimeout(() => stopTest(), 100);
                    return newCycles;
                  }
                  return newCycles;
                });
              }

              setPhase(nextState.phase);
              setIsHoldAfterExhale(nextState.isHoldAfterExhale);
              return 0;
            }
          }

          return newTime;
        });

        setTotalTime((prev) => prev + 0.1);
      }, 100);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [isRunning, isPaused, phase, pattern, getPhaseTarget, getNextPhase, isBreathHoldTest, isHoldAfterExhale, stopTest]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const decimal = Math.floor((seconds % 1) * 10);
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, "0")}.${decimal}`;
    }
    return `${secs}.${decimal}`;
  };

  const getLungCapacityLabel = (seconds: number): { label: string; color: string; emoji: string } => {
    if (seconds < 20) return { label: "Keep Practicing", color: "text-rose-400", emoji: "💪" };
    if (seconds < 40) return { label: "Good Progress", color: "text-amber-400", emoji: "👍" };
    if (seconds < 60) return { label: "Great Job!", color: "text-emerald-400", emoji: "🎉" };
    return { label: "Amazing!", color: "text-cyan-400", emoji: "🏆" };
  };

  const progressPercent = isRunning
    ? isBreathHoldTest && phase === "hold"
      ? Math.min(100, (phaseTime / 60) * 100)
      : (phaseTime / getPhaseTarget()) * 100
    : 0;

  return (
    <div className={cn("w-full", className)}>
      <AnimatePresence mode="wait">
        {/* Step 1: Pattern Selection */}
        {step === "pattern" && !isRunning && !showResults && (
          <motion.div
            key="pattern-selection"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-white mb-2">Choose Your Exercise</h3>
              <p className="text-slate-400 text-sm">Select a breathing pattern to begin</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(Object.keys(BREATHING_PATTERNS) as BreathingTestType[]).map((key) => {
                const p = BREATHING_PATTERNS[key];
                const Icon = p.icon;
                const isSelected = selectedPattern === key;

                return (
                  <motion.button
                    key={key}
                    onClick={() => setSelectedPattern(key)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "relative p-5 rounded-2xl border text-left transition-all overflow-hidden group",
                      isSelected
                        ? "border-cyan-500/50 bg-gradient-to-br from-slate-800/90 to-slate-900/90"
                        : "border-slate-700/50 bg-slate-800/30 hover:border-slate-600"
                    )}
                  >
                    {/* Selected indicator glow */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-teal-500/10" />
                    )}

                    <div className="relative z-10">
                      <div className="flex items-start justify-between mb-3">
                        <div
                          className={cn(
                            "p-3 rounded-xl bg-gradient-to-br",
                            p.gradient,
                            "shadow-lg"
                          )}
                        >
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="p-1 rounded-full bg-cyan-500"
                          >
                            <Check className="w-4 h-4 text-white" />
                          </motion.div>
                        )}
                      </div>
                      <h4 className="font-semibold text-white mb-1">{p.name}</h4>
                      <p className="text-xs text-slate-400 mb-3">{p.description}</p>

                      {/* Pattern timing pills */}
                      <div className="flex flex-wrap gap-1.5">
                        {key !== "breath_hold" ? (
                          <>
                            <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-400">
                              {p.inhale}s inhale
                            </span>
                            <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-400">
                              {p.hold}s hold
                            </span>
                            <span className="px-2 py-0.5 text-xs rounded-full bg-violet-500/20 text-violet-400">
                              {p.exhale}s exhale
                            </span>
                          </>
                        ) : (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-cyan-500/20 text-cyan-400">
                            Hold as long as possible
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="pt-4">
              <Button
                onClick={() => setStep("difficulty")}
                size="lg"
                className="w-full bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 shadow-lg shadow-cyan-500/20"
              >
                Continue
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </motion.div>
          </motion.div>
        )}

        {/* Step 2: Difficulty Selection */}
        {step === "difficulty" && !isRunning && !showResults && (
          <motion.div
            key="difficulty-selection"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-white mb-2">Select Difficulty</h3>
              <p className="text-slate-400 text-sm">Choose your challenge level</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(DIFFICULTY_LEVELS) as DifficultyLevel[]).map((level) => {
                const config = DIFFICULTY_LEVELS[level];
                const Icon = config.icon;
                const isSelected = difficulty === level;

                return (
                  <motion.button
                    key={level}
                    onClick={() => setDifficulty(level)}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className={cn(
                      "relative p-4 rounded-xl border text-center transition-all overflow-hidden",
                      isSelected
                        ? "border-cyan-500/50 bg-gradient-to-br from-slate-800/90 to-slate-900/90"
                        : "border-slate-700/50 bg-slate-800/30 hover:border-slate-600"
                    )}
                  >
                    {isSelected && (
                      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-teal-500/10" />
                    )}

                    <div className="relative z-10">
                      <Icon className={cn("w-6 h-6 mx-auto mb-2", config.color)} />
                      <div className={cn("font-semibold mb-1", config.color)}>
                        {config.label}
                      </div>
                      <div className="text-xs text-slate-500">{config.description}</div>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => setStep("pattern")}
                variant="outline"
                className="flex-1 border-slate-600"
              >
                Back
              </Button>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                <Button
                  onClick={() => setStep("test")}
                  className="w-full bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 shadow-lg shadow-cyan-500/20"
                >
                  Start Test
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* Step 3: Active Test */}
        {step === "test" && !showResults && (
          <motion.div
            key="active-test"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative"
          >
            {/* Main Test Card */}
            <div className="relative rounded-3xl border border-slate-700/50 bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-xl shadow-2xl overflow-hidden">
              {/* Decorative background */}
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-600/5 via-transparent to-teal-600/5" />
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

              <div className="relative z-10 p-6 sm:p-8">
                {/* Header */}
                <div className="text-center mb-6">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full",
                      `bg-${pattern.color}-500/20 text-${pattern.color}-400`
                    )}>
                      {pattern.name}
                    </span>
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full bg-slate-700/50", difficultyConfig.color)}>
                      {difficultyConfig.label}
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm">{pattern.description}</p>
                </div>

                {/* Lung Animation */}
                <div className="flex justify-center mb-6">
                  <LungAnimation
                    phase={phase}
                    size={240}
                    progress={progressPercent}
                  />
                </div>

                {/* Timer Display */}
                <div className="text-center mb-6">
                  <motion.div
                    key={formatTime(isBreathHoldTest && phase === "hold" ? breathHoldTime : phaseTime)}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-6xl sm:text-7xl font-mono font-bold text-white tracking-tight"
                  >
                    {formatTime(isBreathHoldTest && phase === "hold" ? breathHoldTime : phaseTime)}
                  </motion.div>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={phase}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={cn(
                        "text-2xl font-bold uppercase tracking-widest mt-2",
                        phase === "inhale" && "text-emerald-400",
                        phase === "hold" && "text-amber-400",
                        phase === "exhale" && "text-violet-400",
                        phase === "idle" && "text-slate-400"
                      )}
                    >
                      {phase === "idle" ? "Ready" : phase}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Stats Row */}
                <div className="flex justify-center gap-8 mb-8">
                  <div className="text-center">
                    <Timer className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                    <div className="text-lg font-semibold text-white">{formatTime(totalTime)}</div>
                    <div className="text-xs text-slate-500">Total</div>
                  </div>
                  {!isBreathHoldTest && (
                    <div className="text-center">
                      <Target className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                      <div className="text-lg font-semibold text-white">
                        {cyclesCompleted}/{pattern.cycles}
                      </div>
                      <div className="text-xs text-slate-500">Cycles</div>
                    </div>
                  )}
                </div>

                {/* Control Buttons */}
                <div className="flex justify-center gap-3">
                  {!isRunning && (
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        onClick={startTest}
                        size="lg"
                        className="bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 shadow-lg shadow-cyan-500/30 px-8"
                      >
                        <Play className="w-5 h-5 mr-2" />
                        Start
                      </Button>
                    </motion.div>
                  )}

                  {isRunning && (
                    <>
                      {isBreathHoldTest && phase === "hold" && (
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                          <Button
                            onClick={stopTest}
                            size="lg"
                            className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 shadow-lg shadow-emerald-500/30 px-8"
                          >
                            <Check className="w-5 h-5 mr-2" />
                            Done
                          </Button>
                        </motion.div>
                      )}

                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Button
                          onClick={pauseTest}
                          size="lg"
                          variant="outline"
                          className="border-slate-600 hover:bg-slate-800"
                        >
                          {isPaused ? (
                            <><Play className="w-5 h-5 mr-2" /> Resume</>
                          ) : (
                            <><Pause className="w-5 h-5 mr-2" /> Pause</>
                          )}
                        </Button>
                      </motion.div>

                      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Button
                          onClick={resetTest}
                          size="lg"
                          variant="outline"
                          className="border-slate-600 hover:bg-slate-800"
                        >
                          <RotateCcw className="w-5 h-5 mr-2" />
                          Reset
                        </Button>
                      </motion.div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Results Screen */}
        {showResults && (
          <motion.div
            key="results"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-6"
          >
            <div className="relative rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-xl shadow-2xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/5 via-transparent to-teal-600/5" />
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />

              <div className="relative z-10 p-6 sm:p-8">
                {/* Success Animation */}
                <div className="text-center mb-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.2 }}
                    className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg shadow-emerald-500/30 mb-4"
                  >
                    <Trophy className="w-10 h-10 text-white" />
                  </motion.div>
                  <h3 className="text-2xl font-bold text-white mb-1">Great Job!</h3>
                  <p className="text-slate-400">You completed {pattern.name}</p>
                </div>

                {/* Main Result */}
                {isBreathHoldTest && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-center p-6 rounded-2xl bg-slate-800/50 border border-slate-700/50 mb-6"
                  >
                    <div className="text-5xl font-bold text-white mb-2">
                      {breathHoldTime.toFixed(1)}s
                    </div>
                    <div className={cn("text-lg font-medium", getLungCapacityLabel(breathHoldTime).color)}>
                      {getLungCapacityLabel(breathHoldTime).emoji} {getLungCapacityLabel(breathHoldTime).label}
                    </div>
                  </motion.div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50"
                  >
                    <Timer className="w-5 h-5 text-slate-400 mb-2" />
                    <div className="text-xl font-semibold text-white">{formatTime(totalTime)}</div>
                    <div className="text-xs text-slate-500">Total Duration</div>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50"
                  >
                    <Target className="w-5 h-5 text-slate-400 mb-2" />
                    <div className="text-xl font-semibold text-white">{cyclesCompleted}</div>
                    <div className="text-xs text-slate-500">Cycles Completed</div>
                  </motion.div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    onClick={resetTest}
                    variant="outline"
                    className="flex-1 border-slate-600"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    New Test
                  </Button>
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
                    <Button
                      onClick={() => {
                        resetTest();
                        startTest();
                      }}
                      className="w-full bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500"
                    >
                      <Wind className="w-4 h-4 mr-2" />
                      Try Again
                    </Button>
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default BreathingTest;
