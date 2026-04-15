"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Eye, CheckCircle2, XCircle, Clock, ArrowRight,
  RotateCw, Trophy, Target, Zap, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { generatePlate } from "../utils/plateGenerator";
import { generatePlateConfigs, computeSummary } from "../utils/scoringEngine";
import { visionTestService } from "@/src/shared/services/vision.service";
import type {
  VisionTestType,
  PlateConfig,
  SubmitPlateResponseInput,
  VisionClassification,
} from "@shared/types/domain/vision";

// ─── Classification Labels ──────────────────────────────────────────

const classLabels: Record<VisionClassification, { label: string; color: string; icon: typeof Eye }> = {
  normal: { label: "Normal Color Vision", color: "text-emerald-400", icon: CheckCircle2 },
  protan_weak: { label: "Mild Red Weakness", color: "text-amber-400", icon: AlertCircle },
  protan_strong: { label: "Red-Green Deficiency", color: "text-red-400", icon: XCircle },
  deutan_weak: { label: "Mild Green Weakness", color: "text-amber-400", icon: AlertCircle },
  deutan_strong: { label: "Green Deficiency", color: "text-red-400", icon: XCircle },
  tritan_weak: { label: "Mild Blue-Yellow Weakness", color: "text-amber-400", icon: AlertCircle },
  tritan_strong: { label: "Blue-Yellow Deficiency", color: "text-red-400", icon: XCircle },
};

// ─── Color Plate Canvas Component ───────────────────────────────────

function ColorPlateCanvas({
  plateConfig,
  seed,
  size = 280,
}: {
  plateConfig: PlateConfig;
  seed: string;
  size?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    generatePlate(canvasRef.current, {
      size,
      plateType: plateConfig.plateType,
      character: plateConfig.character,
      seed: `${seed}-${plateConfig.character}-${plateConfig.plateType}`,
    });
  }, [plateConfig, seed, size]);

  return (
    <motion.canvas
      ref={canvasRef}
      width={size}
      height={size}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-full shadow-2xl shadow-black/50"
    />
  );
}

// ─── Answer Option Button ───────────────────────────────────────────

function AnswerOption({
  value,
  isSelected,
  isCorrect,
  showResult,
  onSelect,
  disabled,
}: {
  value: string;
  isSelected: boolean;
  isCorrect: boolean;
  showResult: boolean;
  onSelect: () => void;
  disabled: boolean;
}) {
  let bgClass = "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20";
  if (showResult && isCorrect) {
    bgClass = "bg-emerald-500/15 border-emerald-500/30";
  } else if (showResult && isSelected && !isCorrect) {
    bgClass = "bg-red-500/15 border-red-500/30";
  } else if (isSelected) {
    bgClass = "bg-sky-500/15 border-sky-500/30";
  }

  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.05 } : undefined}
      whileTap={!disabled ? { scale: 0.95 } : undefined}
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl",
        "border text-xl sm:text-2xl font-bold text-white",
        "transition-all duration-200",
        bgClass,
        disabled && "opacity-60 cursor-not-allowed"
      )}
    >
      {value}
    </motion.button>
  );
}

// ─── Timer Ring ─────────────────────────────────────────────────────

function TimerRing({ remaining, total }: { remaining: number; total: number }) {
  const progress = remaining / total;
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);
  const isUrgent = remaining <= 3;

  return (
    <div className="flex items-center gap-2">
      <svg width="44" height="44" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
        <circle
          cx="22" cy="22" r={radius} fill="none"
          stroke={isUrgent ? "#ef4444" : "#38bdf8"}
          strokeWidth="3" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 22 22)"
          className="transition-all duration-200"
        />
      </svg>
      <span className={cn("text-sm font-bold tabular-nums", isUrgent ? "text-red-400" : "text-white")}>
        {remaining}s
      </span>
    </div>
  );
}

// ─── Results Summary ────────────────────────────────────────────────

function TestResults({
  responses,
  onRetry,
  onClose,
}: {
  responses: SubmitPlateResponseInput[];
  onRetry: () => void;
  onClose: () => void;
}) {
  const summary = computeSummary(responses);
  const cls = classLabels[summary.classification];
  const ResultIcon = cls.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-6 max-w-sm mx-auto text-center px-4"
    >
      {/* Score Circle */}
      <div className="relative">
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r="60" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
          <circle
            cx="70" cy="70" r="60" fill="none"
            stroke={summary.accuracyPercentage >= 80 ? "#34d399" : summary.accuracyPercentage >= 50 ? "#fbbf24" : "#ef4444"}
            strokeWidth="6" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 60}
            strokeDashoffset={2 * Math.PI * 60 * (1 - summary.accuracyPercentage / 100)}
            transform="rotate(-90 70 70)"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-white">{Math.round(summary.accuracyPercentage)}%</span>
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Accuracy</span>
        </div>
      </div>

      {/* Classification */}
      <div className="space-y-2">
        <div className="flex items-center justify-center gap-2">
          <ResultIcon className={cn("h-5 w-5", cls.color)} />
          <span className={cn("text-lg font-semibold", cls.color)}>{cls.label}</span>
        </div>
        <p className="text-xs text-zinc-500">
          Confidence: {summary.confidence}% | {summary.correctCount}/{summary.totalPlates} correct
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 w-full">
        <div className="text-center">
          <Target className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
          <p className="text-sm font-bold text-white">{summary.correctCount}/{summary.totalPlates}</p>
          <p className="text-[10px] text-zinc-500">Correct</p>
        </div>
        <div className="text-center">
          <Clock className="h-4 w-4 text-sky-400 mx-auto mb-1" />
          <p className="text-sm font-bold text-white">{(summary.averageResponseTimeMs / 1000).toFixed(1)}s</p>
          <p className="text-[10px] text-zinc-500">Avg Time</p>
        </div>
        <div className="text-center">
          <Zap className="h-4 w-4 text-amber-400 mx-auto mb-1" />
          <p className="text-sm font-bold text-white">{summary.confidence}%</p>
          <p className="text-[10px] text-zinc-500">Confidence</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 w-full">
        <button
          onClick={onRetry}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-medium text-white hover:bg-white/10 transition-colors"
        >
          <RotateCw className="h-4 w-4" />
          Retry
        </button>
        <button
          onClick={onClose}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
        >
          Done
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main Test Player ───────────────────────────────────────────────

interface ColorTestPlayerProps {
  testType: VisionTestType;
  onClose: () => void;
}

export default function ColorTestPlayer({ testType, onClose }: ColorTestPlayerProps) {
  const [plates, setPlates] = useState<PlateConfig[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<SubmitPlateResponseInput[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [timer, setTimer] = useState(0);
  const [seed, setSeed] = useState("");

  const sessionIdRef = useRef<string | null>(null);
  const startTimeRef = useRef(0);
  const plateStartRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize test
  useEffect(() => {
    const newSeed = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setSeed(newSeed);

    const type = testType === 'color_vision_advanced' ? 'color_vision_advanced' : 'color_vision_quick';
    const configs = generatePlateConfigs(type, newSeed);
    setPlates(configs);
    setTimer(configs[0]?.timerSeconds || 8);
    startTimeRef.current = Date.now();
    plateStartRef.current = Date.now();

    // Start backend session
    visionTestService
      .startTest({ testType: type })
      .then((res) => {
        if (res.success && res.data?.session) {
          sessionIdRef.current = res.data.session.id;
        }
      })
      .catch(() => {});
  }, [testType]);

  // Timer countdown
  useEffect(() => {
    if (isComplete || showResult || plates.length === 0) return;

    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          // Time out — auto-submit
          handleAnswer(null, true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, isComplete, showResult, plates.length]);

  const handleAnswer = useCallback((answer: string | null, timedOut = false) => {
    if (timerRef.current) clearInterval(timerRef.current);

    const plate = plates[currentIndex];
    if (!plate) return;

    const responseTimeMs = Date.now() - plateStartRef.current;
    const isCorrect = answer !== null && answer === plate.character;

    setSelectedAnswer(answer);
    setShowResult(true);

    const response: SubmitPlateResponseInput = {
      plateIndex: currentIndex,
      plateType: plate.plateType,
      correctAnswer: plate.character,
      userAnswer: answer ?? undefined,
      isCorrect,
      responseTimeMs,
      timedOut,
    };

    setResponses((prev) => [...prev, response]);

    // Brief delay to show result, then advance
    setTimeout(() => {
      const nextIndex = currentIndex + 1;
      if (nextIndex >= plates.length) {
        // Test complete — submit to backend
        const allResponses = [...responses, response];
        const totalDuration = Math.round((Date.now() - startTimeRef.current) / 1000);

        if (sessionIdRef.current) {
          visionTestService
            .completeTest(sessionIdRef.current, {
              responses: allResponses,
              totalDurationSeconds: totalDuration,
            })
            .catch(() => {});
        }

        setIsComplete(true);
      } else {
        setCurrentIndex(nextIndex);
        setSelectedAnswer(null);
        setShowResult(false);
        setTimer(plates[nextIndex].timerSeconds);
        plateStartRef.current = Date.now();
      }
    }, 800);
  }, [currentIndex, plates, responses]);

  const handleRetry = () => {
    setIsComplete(false);
    setCurrentIndex(0);
    setResponses([]);
    setSelectedAnswer(null);
    setShowResult(false);

    const newSeed = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setSeed(newSeed);
    const type = testType === 'color_vision_advanced' ? 'color_vision_advanced' : 'color_vision_quick';
    const configs = generatePlateConfigs(type, newSeed);
    setPlates(configs);
    setTimer(configs[0]?.timerSeconds || 8);
    startTimeRef.current = Date.now();
    plateStartRef.current = Date.now();

    visionTestService
      .startTest({ testType: type })
      .then((res) => {
        if (res.success && res.data?.session) sessionIdRef.current = res.data.session.id;
      })
      .catch(() => {});
  };

  const currentPlate = plates[currentIndex];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950"
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-3 sm:px-6 z-10">
        <div className="flex items-center gap-3">
          <Eye className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-medium text-white">
            {isComplete ? "Test Complete" : `Plate ${currentIndex + 1} of ${plates.length}`}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {!isComplete && currentPlate && (
            <TimerRing remaining={timer} total={currentPlate.timerSeconds} />
          )}
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {!isComplete && (
        <div className="absolute top-14 left-4 right-4 sm:left-6 sm:right-6">
          <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-500"
              animate={{ width: `${((currentIndex) / plates.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-col items-center gap-6 sm:gap-8 px-4">
        <AnimatePresence mode="wait">
          {isComplete ? (
            <TestResults
              key="results"
              responses={responses}
              onRetry={handleRetry}
              onClose={onClose}
            />
          ) : currentPlate ? (
            <motion.div
              key={`plate-${currentIndex}`}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center gap-6 sm:gap-8"
            >
              {/* Plate */}
              <ColorPlateCanvas plateConfig={currentPlate} seed={seed} size={320} />

              {/* Question */}
              <p className="text-sm text-zinc-400">What number do you see?</p>

              {/* Options */}
              <div className="flex items-center gap-3 sm:gap-4">
                {currentPlate.options.map((opt) => (
                  <AnswerOption
                    key={opt}
                    value={opt}
                    isSelected={selectedAnswer === opt}
                    isCorrect={opt === currentPlate.character}
                    showResult={showResult}
                    onSelect={() => !showResult && handleAnswer(opt)}
                    disabled={showResult}
                  />
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
