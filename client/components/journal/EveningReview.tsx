/**
 * @file EveningReview Component
 * @description Multi-step evening review: actual mood/energy, day rating, intention review,
 *   what went well/badly, lessons learned, tomorrow focus
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Moon, ChevronLeft, ChevronRight, Check, Loader2, SkipForward, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoodGradientSlider } from "@/components/journal/checkin/MoodGradientSlider";
import { EnergyBatterySelector } from "@/components/journal/checkin/EnergyBatterySelector";
import { dailyCheckinService, lifeGoalsService } from "@/src/shared/services/wellbeing.service";
import type { DailyIntention } from "@shared/types/domain/wellbeing";

const STEPS = [
  { key: "mood", label: "Actual Mood", question: "How did you actually feel today?" },
  { key: "energy", label: "Actual Energy", question: "How was your energy today?" },
  { key: "rating", label: "Day Rating", question: "Rate your day overall" },
  { key: "intentions", label: "Intention Review", question: "How did your intentions go?" },
  { key: "well", label: "What Went Well", question: "What went well today?" },
  { key: "notwell", label: "Improvements", question: "What didn't go well?" },
  { key: "lessons", label: "Lessons Learned", question: "What did you learn today?" },
  { key: "tomorrow", label: "Tomorrow Focus", question: "What's your focus for tomorrow?" },
] as const;

const SLIDE_VARIANTS = {
  enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0, scale: 0.95 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0, scale: 0.95 }),
};

interface EveningReviewProps {
  onComplete?: () => void;
  onCancel?: () => void;
}

export function EveningReview({ onComplete, onCancel }: EveningReviewProps) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Values
  const [moodScore, setMoodScore] = useState<number | undefined>(undefined);
  const [energyScore, setEnergyScore] = useState<number | undefined>(undefined);
  const [dayRating, setDayRating] = useState<number>(5);
  const [todayIntentions, setTodayIntentions] = useState<DailyIntention[]>([]);
  const [intentionResults, setIntentionResults] = useState<Record<string, boolean>>({});
  const [wentWell, setWentWell] = useState<string[]>([""]);
  const [didntGoWell, setDidntGoWell] = useState<string[]>([""]);
  const [lessons, setLessons] = useState<string[]>([""]);
  const [tomorrowFocus, setTomorrowFocus] = useState("");

  // Load today's intentions
  useEffect(() => {
    lifeGoalsService.getTodayIntentions().then((res) => {
      if (res.success && res.data?.intentions) {
        setTodayIntentions(res.data.intentions);
      }
    }).catch(() => {});
  }, []);

  const goNext = useCallback(() => {
    if (step < STEPS.length - 1) {
      setDirection(1);
      setStep((s) => s + 1);
    }
  }, [step]);

  const goBack = useCallback(() => {
    if (step > 0) {
      setDirection(-1);
      setStep((s) => s - 1);
    }
  }, [step]);

  const _addListItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, max: number) => {
    setter((prev) => (prev.length < max ? [...prev, ""] : prev));
  };

  const _updateListItem = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
    value: string
  ) => {
    setter((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const _removeListItem = (setter: React.Dispatch<React.SetStateAction<string[]>>, index: number) => {
    setter((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const filteredWell = wentWell.filter((s) => s.trim());
      const filteredBad = didntGoWell.filter((s) => s.trim());
      const filteredLessons = lessons.filter((s) => s.trim());

      await dailyCheckinService.createOrUpdate({
        checkin_type: "evening",
        mood_score: moodScore,
        energy_score: energyScore ? energyScore * 2 : undefined,
        day_rating: dayRating,
        went_well: filteredWell.length > 0 ? filteredWell : undefined,
        didnt_go_well: filteredBad.length > 0 ? filteredBad : undefined,
        evening_lessons: filteredLessons.length > 0 ? filteredLessons : undefined,
        tomorrow_focus: tomorrowFocus.trim() || undefined,
      });

      // Update intention fulfillment in parallel
      const intentionUpdates = todayIntentions
        .filter((intention) => intentionResults[intention.id] !== undefined)
        .map((intention) =>
          lifeGoalsService.updateIntention(intention.id, {
            fulfilled: intentionResults[intention.id],
          })
        );

      if (intentionUpdates.length > 0) {
        await Promise.allSettled(intentionUpdates);
      }

      setIsSuccess(true);
      setTimeout(() => onComplete?.(), 1500);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save evening review. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLastStep = step === STEPS.length - 1;

  if (isSuccess) {
    return (
      <motion.div
        className="flex flex-col items-center justify-center py-12 space-y-4"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <motion.div
          className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <Moon className="w-8 h-8 text-indigo-400" />
        </motion.div>
        <h3 className="text-lg font-semibold text-white">Evening review complete!</h3>
        <p className="text-sm text-slate-400">Rest well tonight.</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 text-indigo-400">
        <Moon className="w-5 h-5" />
        <span className="text-sm font-medium">Evening Review</span>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-1.5">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
              i === step ? "w-5 bg-indigo-400" : i < step ? "bg-indigo-400/60" : "bg-white/20"
            }`}
          />
        ))}
      </div>

      {/* Question */}
      <h3 className="text-lg font-medium text-white text-center">
        {STEPS[step].question}
      </h3>

      {/* Step content */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          variants={SLIDE_VARIANTS}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="min-h-[200px]"
        >
          {/* Mood */}
          {step === 0 && (
            <MoodGradientSlider value={moodScore ?? 5} onChange={setMoodScore} />
          )}

          {/* Energy */}
          {step === 1 && (
            <EnergyBatterySelector value={energyScore ?? 3} onChange={setEnergyScore} />
          )}

          {/* Day Rating */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="flex justify-center">
                <span className="text-6xl font-bold text-white">{dayRating}</span>
                <span className="text-2xl text-slate-500 mt-8">/10</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={dayRating}
                onChange={(e) => setDayRating(parseInt(e.target.value))}
                className="w-full accent-indigo-500"
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>Terrible</span>
                <span>Average</span>
                <span>Amazing</span>
              </div>
            </div>
          )}

          {/* Intention Review */}
          {step === 3 && (
            <div className="space-y-3">
              {todayIntentions.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  No intentions were set this morning.
                </p>
              ) : (
                todayIntentions.map((intention) => (
                  <div
                    key={intention.id}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      intentionResults[intention.id] === true
                        ? "bg-emerald-500/10 border-emerald-500/30"
                        : intentionResults[intention.id] === false
                        ? "bg-red-500/10 border-red-500/30"
                        : "bg-white/5 border-white/10"
                    }`}
                    onClick={() =>
                      setIntentionResults((prev) => ({
                        ...prev,
                        [intention.id]: prev[intention.id] === true ? false : true,
                      }))
                    }
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          intentionResults[intention.id] === true
                            ? "bg-emerald-500 border-emerald-500"
                            : "border-white/30"
                        }`}
                      >
                        {intentionResults[intention.id] === true && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <span className="text-sm text-slate-200">{intention.intentionText}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* What Went Well */}
          {step === 4 && (
            <ListInput
              items={wentWell}
              setItems={setWentWell}
              placeholder="Something that went well..."
              max={5}
            />
          )}

          {/* What Didn't Go Well */}
          {step === 5 && (
            <ListInput
              items={didntGoWell}
              setItems={setDidntGoWell}
              placeholder="Something to improve..."
              max={5}
            />
          )}

          {/* Lessons Learned */}
          {step === 6 && (
            <ListInput
              items={lessons}
              setItems={setLessons}
              placeholder="A lesson or realization..."
              max={3}
            />
          )}

          {/* Tomorrow Focus */}
          {step === 7 && (
            <div className="space-y-4 py-4">
              <Input
                placeholder="What's your main focus for tomorrow?"
                value={tomorrowFocus}
                onChange={(e) => setTomorrowFocus(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 text-lg py-6"
              />
              <p className="text-xs text-slate-500 text-center">
                This will be shown in tomorrow&apos;s morning check-in
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Error message */}
      {submitError && (
        <p className="text-sm text-red-400 text-center bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {submitError}
        </p>
      )}

      {/* Navigation */}
      <div className="flex justify-between items-center pt-4">
        <Button
          variant="ghost"
          onClick={step === 0 ? onCancel : goBack}
          className="text-slate-400 hover:text-white"
        >
          {step === 0 ? (
            "Cancel"
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </>
          )}
        </Button>

        <div className="flex gap-2">
          {!isLastStep && (
            <Button
              variant="ghost"
              onClick={goNext}
              className="text-slate-500 hover:text-slate-300"
            >
              <SkipForward className="w-4 h-4 mr-1" />
              Skip
            </Button>
          )}
          {isLastStep ? (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Complete
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={goNext}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// HELPER COMPONENT
// ============================================

function ListInput({
  items,
  setItems,
  placeholder,
  max,
}: {
  items: string[];
  setItems: React.Dispatch<React.SetStateAction<string[]>>;
  placeholder: string;
  max: number;
}) {
  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Input
            placeholder={placeholder}
            value={item}
            onChange={(e) => {
              const updated = [...items];
              updated[idx] = e.target.value;
              setItems(updated);
            }}
            className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
          />
          {items.length > 1 && (
            <button
              onClick={() => setItems(items.filter((_, i) => i !== idx))}
              className="p-1 text-slate-500 hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
      {items.length < max && (
        <button
          onClick={() => setItems([...items, ""])}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          <Plus className="w-3 h-3" />
          Add another
        </button>
      )}
    </div>
  );
}
