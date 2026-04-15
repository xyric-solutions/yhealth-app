"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  SkipForward,
  BookOpen,
  Sparkles,
  Sun,
  Moon,
  Brain,
  Tag,
  FileText,
  Target,
  Smartphone,
} from "lucide-react";
import type { CheckinTag } from "@shared/types/domain/wellbeing";
import { dailyCheckinService } from "@/src/shared/services/wellbeing.service";
import { MoodGradientSlider } from "./checkin/MoodGradientSlider";
import { EnergyBatterySelector } from "./checkin/EnergyBatterySelector";
import { SleepMoonSelector } from "./checkin/SleepMoonSelector";
import { StressWaveSlider } from "./checkin/StressWaveSlider";
import { QuickTagSelector } from "./checkin/QuickTagSelector";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DailyCheckinFlowProps {
  onComplete: (checkinId?: string) => void;
  onContinueToJournal?: () => void;
  onClose?: () => void;
}

interface StepConfig {
  key: string;
  label: string;
  question: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface CheckinValues {
  mood: number | undefined;
  energy: number | undefined;
  sleep: number | undefined;
  stress: number | undefined;
  screenTimeMinutes: number | undefined;
  tags: CheckinTag[];
  intention: string;
  summary: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEPS: StepConfig[] = [
  { key: "mood", label: "Mood", question: "How are you feeling?", icon: Sun },
  {
    key: "energy",
    label: "Energy",
    question: "What's your energy level?",
    icon: Sparkles,
  },
  {
    key: "sleep",
    label: "Sleep",
    question: "How was your sleep?",
    icon: Moon,
  },
  {
    key: "stress",
    label: "Stress",
    question: "How stressed are you?",
    icon: Brain,
  },
  {
    key: "screenTime",
    label: "Screen Time",
    question: "How much screen time today?",
    icon: Smartphone,
  },
  {
    key: "tags",
    label: "Tags",
    question: "What describes your day?",
    icon: Tag,
  },
  {
    key: "intention",
    label: "Intention",
    question: "What life goal will you focus on today?",
    icon: Target,
  },
  {
    key: "summary",
    label: "Summary",
    question: "Anything else on your mind?",
    icon: FileText,
  },
];

const TOTAL_STEPS = STEPS.length;
const MAX_SUMMARY_LENGTH = 500;

const SLIDE_VARIANTS = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
    scale: 0.96,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
    scale: 0.96,
  }),
};

const SLIDE_TRANSITION = {
  x: { type: "spring" as const, stiffness: 300, damping: 30 },
  opacity: { duration: 0.25 },
  scale: { duration: 0.25 },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ProgressDots({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) {
  return (
    <div
      className="flex items-center justify-center gap-2"
      role="progressbar"
      aria-valuenow={currentStep + 1}
      aria-valuemin={1}
      aria-valuemax={totalSteps}
      aria-label={`Step ${currentStep + 1} of ${totalSteps}`}
    >
      {Array.from({ length: totalSteps }, (_, i) => {
        const isActive = i === currentStep;
        const isCompleted = i < currentStep;

        return (
          <motion.div
            key={i}
            className={`
              rounded-full transition-colors duration-300
              ${
                isActive
                  ? "h-3 w-3 bg-emerald-400 shadow-lg shadow-emerald-400/50"
                  : isCompleted
                    ? "h-2.5 w-2.5 bg-indigo-500"
                    : "h-2.5 w-2.5 bg-slate-600"
              }
            `}
            animate={
              isActive
                ? { scale: [1, 1.2, 1] }
                : { scale: 1 }
            }
            transition={
              isActive
                ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
                : { duration: 0.2 }
            }
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}

function SuccessState({
  onComplete,
  onContinueToJournal,
}: {
  onComplete: () => void;
  onContinueToJournal?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className="flex flex-col items-center justify-center py-10 text-center"
    >
      {/* Checkmark animation */}
      <motion.div
        initial={{ scale: 0, rotate: -90 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{
          type: "spring",
          stiffness: 200,
          damping: 15,
          delay: 0.1,
        }}
        className="relative mb-6"
      >
        <div className="absolute inset-0 bg-emerald-400/20 rounded-full blur-2xl" />
        <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-2xl shadow-emerald-500/40">
          <motion.div
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.3, duration: 0.4, ease: "easeOut" }}
          >
            <Check className="w-10 h-10 text-white" strokeWidth={3} />
          </motion.div>
        </div>
      </motion.div>

      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-2xl font-bold text-white mb-2"
      >
        Check-in Complete
      </motion.h3>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-slate-400 text-base mb-8 max-w-xs"
      >
        Great job taking a moment to reflect and set your intentions today.
      </motion.p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        {onContinueToJournal && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onContinueToJournal}
            className="flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/30 transition-all duration-200"
          >
            <BookOpen className="w-5 h-5" />
            Continue to Journal
          </motion.button>
        )}

        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onComplete}
          className="w-full py-3 px-6 rounded-xl font-medium text-slate-300 bg-slate-800/60 border border-slate-700/50 hover:bg-slate-700/60 hover:text-white transition-all duration-200"
        >
          Done
        </motion.button>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function DailyCheckinFlow({
  onComplete,
  onContinueToJournal,
  onClose,
}: DailyCheckinFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [checkinId, setCheckinId] = useState<string | undefined>(undefined);

  const [values, setValues] = useState<CheckinValues>({
    mood: undefined,
    energy: undefined,
    sleep: undefined,
    stress: undefined,
    screenTimeMinutes: undefined,
    tags: [],
    intention: "",
    summary: "",
  });

  const currentStepConfig = STEPS[currentStep];
  const isLastStep = currentStep === TOTAL_STEPS - 1;
  const isFirstStep = currentStep === 0;

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const goNext = useCallback(() => {
    if (currentStep < TOTAL_STEPS - 1) {
      setDirection(1);
      setCurrentStep((prev) => prev + 1);
      setSubmitError(null);
    }
  }, [currentStep]);

  const goBack = useCallback(() => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep((prev) => prev - 1);
      setSubmitError(null);
    }
  }, [currentStep]);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        mood_score: values.mood,
        energy_score:
          values.energy !== undefined ? values.energy * 2 : undefined,
        sleep_quality: values.sleep,
        stress_score: values.stress,
        screen_time_minutes: values.screenTimeMinutes,
        tags: values.tags.length > 0 ? values.tags : undefined,
        intention: values.intention.trim() || undefined,
        day_summary: values.summary.trim() || undefined,
      };

      const response = await dailyCheckinService.createOrUpdate(payload);
      const id = response?.data?.checkin?.id;

      setCheckinId(id);
      setIsSuccess(true);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [values]);

  const handleSkip = useCallback(() => {
    const stepKey = STEPS[currentStep].key;

    setValues((prev) => {
      const updated = { ...prev };
      switch (stepKey) {
        case "mood":
          updated.mood = undefined;
          break;
        case "energy":
          updated.energy = undefined;
          break;
        case "sleep":
          updated.sleep = undefined;
          break;
        case "stress":
          updated.stress = undefined;
          break;
        case "screenTime":
          updated.screenTimeMinutes = undefined;
          break;
        case "tags":
          updated.tags = [];
          break;
        case "intention":
          updated.intention = "";
          break;
        case "summary":
          updated.summary = "";
          break;
      }
      return updated;
    });

    if (isLastStep) {
      handleSubmit();
    } else {
      goNext();
    }
  }, [currentStep, isLastStep, goNext, handleSubmit]);

  const handleComplete = useCallback(() => {
    onComplete(checkinId);
  }, [onComplete, checkinId]);

  const handleContinueToJournal = useCallback(() => {
    onContinueToJournal?.();
  }, [onContinueToJournal]);

  // -----------------------------------------------------------------------
  // Step Content Renderer
  // -----------------------------------------------------------------------

  function renderStepContent() {
    switch (currentStepConfig.key) {
      case "mood":
        return (
          <MoodGradientSlider
            value={values.mood ?? 5}
            onChange={(val) =>
              setValues((prev) => ({ ...prev, mood: val }))
            }
          />
        );

      case "energy":
        return (
          <EnergyBatterySelector
            value={values.energy ?? 3}
            onChange={(val) =>
              setValues((prev) => ({ ...prev, energy: val }))
            }
          />
        );

      case "sleep":
        return (
          <SleepMoonSelector
            value={values.sleep ?? 3}
            onChange={(val) =>
              setValues((prev) => ({ ...prev, sleep: val }))
            }
          />
        );

      case "stress":
        return (
          <StressWaveSlider
            value={values.stress ?? 5}
            onChange={(val) =>
              setValues((prev) => ({ ...prev, stress: val }))
            }
          />
        );

      case "screenTime":
        return (
          <div className="space-y-4">
            {/* Quick-select buttons */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "< 1 hr", value: 30 },
                { label: "1-3 hrs", value: 120 },
                { label: "3-5 hrs", value: 240 },
                { label: "5+ hrs", value: 360 },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setValues((prev) => ({
                      ...prev,
                      screenTimeMinutes: option.value,
                    }))
                  }
                  className={`
                    py-3 px-4 rounded-xl text-sm font-medium transition-all duration-200 border
                    ${
                      values.screenTimeMinutes === option.value
                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-lg shadow-emerald-500/10"
                        : "bg-slate-800/60 border-slate-700/50 text-slate-300 hover:bg-slate-700/60 hover:text-white"
                    }
                  `}
                  aria-label={`Select ${option.label} screen time`}
                  aria-pressed={values.screenTimeMinutes === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* Manual input */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 whitespace-nowrap">
                Or exact:
              </span>
              <input
                type="number"
                min={0}
                max={1440}
                value={
                  values.screenTimeMinutes !== undefined &&
                  ![30, 120, 240, 360].includes(values.screenTimeMinutes)
                    ? values.screenTimeMinutes
                    : ""
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") {
                    setValues((prev) => ({
                      ...prev,
                      screenTimeMinutes: undefined,
                    }));
                  } else {
                    const num = Math.min(1440, Math.max(0, parseInt(val, 10)));
                    if (!isNaN(num)) {
                      setValues((prev) => ({
                        ...prev,
                        screenTimeMinutes: num,
                      }));
                    }
                  }
                }}
                placeholder="minutes"
                className="flex-1 rounded-xl bg-slate-800/60 border border-slate-700/50 text-white placeholder:text-slate-500 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all duration-200 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                aria-label="Exact screen time in minutes"
              />
              <span className="text-xs text-slate-500">min</span>
            </div>
          </div>
        );

      case "tags":
        return (
          <QuickTagSelector
            selected={values.tags}
            onChange={(tags) =>
              setValues((prev) => ({ ...prev, tags }))
            }
          />
        );

      case "intention":
        return (
          <div className="space-y-3">
            <textarea
              value={values.intention}
              onChange={(e) => {
                const text = e.target.value;
                if (text.length <= 200) {
                  setValues((prev) => ({ ...prev, intention: text }));
                }
              }}
              placeholder="e.g. Practice patience, work on my side project, stick to my meal plan... (optional)"
              rows={3}
              maxLength={200}
              className="w-full rounded-xl bg-slate-800/60 border border-slate-700/50 text-white placeholder:text-slate-500 px-4 py-3 text-base resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all duration-200"
              aria-label="Life goal intention for today"
            />
            <p className="text-right text-xs text-slate-500">
              {values.intention.length}/200
            </p>
          </div>
        );

      case "summary":
        return (
          <div className="space-y-3">
            <textarea
              value={values.summary}
              onChange={(e) => {
                const text = e.target.value;
                if (text.length <= MAX_SUMMARY_LENGTH) {
                  setValues((prev) => ({ ...prev, summary: text }));
                }
              }}
              placeholder="Reflect on your day, wins, lessons, or anything on your mind... (optional)"
              rows={4}
              maxLength={MAX_SUMMARY_LENGTH}
              className="w-full rounded-xl bg-slate-800/60 border border-slate-700/50 text-white placeholder:text-slate-500 px-4 py-3 text-base resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all duration-200"
              aria-label="Day summary"
            />
            <p className="text-right text-xs text-slate-500">
              {values.summary.length}/{MAX_SUMMARY_LENGTH}
            </p>
          </div>
        );

      default:
        return null;
    }
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="relative rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 shadow-2xl overflow-hidden">
        {/* Glassmorphic background effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative p-6 sm:p-8">
          {/* Header: Close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors duration-200"
              aria-label="Close check-in"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          )}

          {isSuccess ? (
            <SuccessState
              onComplete={handleComplete}
              onContinueToJournal={
                onContinueToJournal ? handleContinueToJournal : undefined
              }
            />
          ) : (
            <>
              {/* Progress Dots */}
              <div className="mb-6">
                <ProgressDots
                  currentStep={currentStep}
                  totalSteps={TOTAL_STEPS}
                />
              </div>

              {/* Step Label */}
              <motion.div
                key={`label-${currentStep}`}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="text-center mb-2"
              >
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 uppercase tracking-widest">
                  Step {currentStep + 1} of {TOTAL_STEPS}
                  <span className="text-slate-600">--</span>
                  {currentStepConfig.label}
                </span>
              </motion.div>

              {/* Question */}
              <motion.h2
                key={`question-${currentStep}`}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.05 }}
                className="text-center text-xl sm:text-2xl font-bold text-white mb-8"
              >
                {currentStepConfig.question}
              </motion.h2>

              {/* Step Content with AnimatePresence */}
              <div className="min-h-[180px] flex items-center justify-center">
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={currentStep}
                    custom={direction}
                    variants={SLIDE_VARIANTS}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={SLIDE_TRANSITION}
                    className="w-full"
                  >
                    {renderStepContent()}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Error Message */}
              {submitError && (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center text-sm text-red-400 mt-4"
                  role="alert"
                >
                  {submitError}
                </motion.p>
              )}

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between mt-8 gap-3">
                {/* Back Button */}
                <div className="flex-1">
                  {!isFirstStep && (
                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={goBack}
                      disabled={isSubmitting}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Go to previous step"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </motion.button>
                  )}
                </div>

                {/* Skip Button */}
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSkip}
                  disabled={isSubmitting}
                  className="flex items-center gap-1 px-3 py-2.5 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Skip this step"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  Skip
                </motion.button>

                {/* Next / Submit Button */}
                <div className="flex-1 flex justify-end">
                  {isLastStep ? (
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/25 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                      aria-label="Submit check-in"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          Submit
                        </>
                      )}
                    </motion.button>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={goNext}
                      disabled={isSubmitting}
                      className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg shadow-emerald-500/25 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                      aria-label="Go to next step"
                    >
                      Next
                      <ArrowRight className="w-4 h-4" />
                    </motion.button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
