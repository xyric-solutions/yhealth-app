/**
 * @file MorningCheckin Component
 * @description Multi-step morning check-in flow: predicted mood/energy, stressors, intentions, sleep
 */

"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, ChevronLeft, ChevronRight, Check, Loader2, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoodGradientSlider } from "@/components/journal/checkin/MoodGradientSlider";
import { EnergyBatterySelector } from "@/components/journal/checkin/EnergyBatterySelector";
import { SleepMoonSelector } from "@/components/journal/checkin/SleepMoonSelector";
import { dailyCheckinService, lifeGoalsService } from "@/src/shared/services/wellbeing.service";
import type { TriggerCategory } from "@shared/types/domain/wellbeing";

const STEPS = [
  { key: "mood", label: "Predicted Mood", question: "How do you expect to feel today?" },
  { key: "energy", label: "Predicted Energy", question: "How much energy do you expect?" },
  { key: "sleep", label: "Sleep Quality", question: "How did you sleep last night?" },
  { key: "stressors", label: "Known Stressors", question: "Anything stressful ahead today?" },
  { key: "intentions", label: "Set Intentions", question: "What are your top 3 intentions?" },
] as const;

const STRESSOR_TAGS: Array<{ value: TriggerCategory; label: string }> = [
  { value: "work", label: "Work" },
  { value: "social", label: "Social" },
  { value: "conflict", label: "Conflict" },
  { value: "exercise", label: "Exercise" },
  { value: "sleep", label: "Sleep" },
  { value: "news", label: "News" },
  { value: "other", label: "Other" },
];

const SLIDE_VARIANTS = {
  enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0, scale: 0.95 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0, scale: 0.95 }),
};

interface MorningCheckinProps {
  onComplete?: () => void;
  onCancel?: () => void;
}

export function MorningCheckin({ onComplete, onCancel }: MorningCheckinProps) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Values
  const [predictedMood, setPredictedMood] = useState<number | undefined>(undefined);
  const [predictedEnergy, setPredictedEnergy] = useState<number | undefined>(undefined);
  const [sleepQuality, setSleepQuality] = useState<number | undefined>(undefined);
  const [stressors, setStressors] = useState<string[]>([]);
  const [stressorText, setStressorText] = useState("");
  const [intentions, setIntentions] = useState<string[]>(["", "", ""]);

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

  const addStressor = () => {
    if (stressorText.trim() && stressors.length < 5) {
      setStressors([...stressors, stressorText.trim()]);
      setStressorText("");
    }
  };

  const toggleStressorTag = (tag: string) => {
    setStressors((prev) =>
      prev.includes(tag) ? prev.filter((s) => s !== tag) : [...prev, tag]
    );
  };

  const updateIntention = (index: number, value: string) => {
    setIntentions((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // Create morning check-in
      await dailyCheckinService.createOrUpdate({
        checkin_type: "morning",
        predicted_mood: predictedMood,
        predicted_energy: predictedEnergy ? predictedEnergy * 2 : undefined, // Convert 1-5 to 1-10
        sleep_quality: sleepQuality,
        known_stressors: stressors.length > 0 ? stressors : undefined,
      });

      // Set intentions (filter empty)
      const validIntentions = intentions
        .filter((i) => i.trim().length > 0)
        .map((intentionText, _idx) => ({ intentionText, domain: undefined }));

      if (validIntentions.length > 0) {
        await lifeGoalsService.bulkSetIntentions({ intentions: validIntentions });
      }

      setIsSuccess(true);
      setTimeout(() => onComplete?.(), 1500);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save check-in. Please try again.");
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
          className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <Check className="w-8 h-8 text-emerald-400" />
        </motion.div>
        <h3 className="text-lg font-semibold text-white">Morning check-in complete!</h3>
        <p className="text-sm text-slate-400">Have a great day ahead.</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 text-amber-400">
        <Sun className="w-5 h-5" />
        <span className="text-sm font-medium">Morning Check-in</span>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-2">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              i === step ? "w-6 bg-emerald-400" : i < step ? "bg-emerald-400/60" : "bg-white/20"
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
          {step === 0 && (
            <MoodGradientSlider value={predictedMood ?? 5} onChange={setPredictedMood} />
          )}
          {step === 1 && (
            <EnergyBatterySelector value={predictedEnergy ?? 3} onChange={setPredictedEnergy} />
          )}
          {step === 2 && (
            <SleepMoonSelector value={sleepQuality ?? 3} onChange={setSleepQuality} />
          )}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {STRESSOR_TAGS.map((tag) => (
                  <button
                    key={tag.value}
                    onClick={() => toggleStressorTag(tag.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      stressors.includes(tag.value)
                        ? "bg-amber-500/30 text-amber-300 border border-amber-500/50"
                        : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
                    }`}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add custom stressor..."
                  value={stressorText}
                  onChange={(e) => setStressorText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addStressor()}
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                />
                <Button
                  variant="outline"
                  onClick={addStressor}
                  disabled={!stressorText.trim()}
                  className="border-white/20 shrink-0"
                >
                  Add
                </Button>
              </div>
              {stressors.filter((s) => !STRESSOR_TAGS.some((t) => t.value === s)).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {stressors
                    .filter((s) => !STRESSOR_TAGS.some((t) => t.value === s))
                    .map((s) => (
                      <span
                        key={s}
                        className="px-2 py-1 rounded-full text-xs bg-white/10 text-slate-300 flex items-center gap-1"
                      >
                        {s}
                        <button onClick={() => setStressors((prev) => prev.filter((x) => x !== s))} className="hover:text-white">
                          ×
                        </button>
                      </span>
                    ))}
                </div>
              )}
            </div>
          )}
          {step === 4 && (
            <div className="space-y-3">
              {[0, 1, 2].map((idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-sm text-slate-500 w-4">{idx + 1}.</span>
                  <Input
                    placeholder={
                      idx === 0
                        ? "Most important intention..."
                        : idx === 1
                        ? "Second priority..."
                        : "Nice to have..."
                    }
                    value={intentions[idx]}
                    onChange={(e) => updateIntention(idx, e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                  />
                </div>
              ))}
              <p className="text-xs text-slate-500 text-center">Set 1-3 intentions for today</p>
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
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500"
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
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500"
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
