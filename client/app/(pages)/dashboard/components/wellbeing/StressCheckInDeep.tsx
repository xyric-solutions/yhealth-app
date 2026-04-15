/**
 * @file StressCheckInDeep Component
 * @description Detailed stress check-in with triggers and notes for deep mode
 */

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, AlertTriangle } from "lucide-react";
import { SliderInput } from "@/components/common/questions/SliderInput";
import { stressService, type CreateStressLogInput, type CheckInType, type StressTrigger } from "@/src/shared/services/stress.service";

const STRESS_TRIGGERS: StressTrigger[] = [
  "Work",
  "Relationships",
  "Finances",
  "Health",
  "Family",
  "Uncertainty",
  "Time pressure",
  "Conflict",
  "Other",
];

interface StressCheckInDeepProps {
  checkInType?: CheckInType;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function StressCheckInDeep({ checkInType = 'on_demand', onSuccess, onCancel }: StressCheckInDeepProps) {
  const [stressRating, setStressRating] = useState<number>(5);
  const [selectedTriggers, setSelectedTriggers] = useState<StressTrigger[]>([]);
  const [otherTrigger, setOtherTrigger] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTrigger = (trigger: StressTrigger) => {
    if (trigger === "Other") {
      // If toggling "Other", clear the other trigger text
      if (selectedTriggers.includes("Other")) {
        setOtherTrigger("");
      }
    }
    setSelectedTriggers((prev) =>
      prev.includes(trigger) ? prev.filter((t) => t !== trigger) : [...prev, trigger]
    );
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const data: CreateStressLogInput = {
        stressRating,
        checkInType,
        ...(selectedTriggers.length > 0 && { triggers: selectedTriggers }),
        ...(selectedTriggers.includes("Other") && otherTrigger.trim() && { otherTrigger: otherTrigger.trim() }),
        ...(note.trim() && { note: note.trim() }),
        clientRequestId: stressService.generateClientRequestId(),
      };

      const response = await stressService.createLog(data);

      if (response.success) {
        onSuccess?.();
      } else {
        setError((response.error as { message?: string })?.message || "Failed to log stress");
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to log stress");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRatingLabel = () => {
    return stressService.getStressRatingLabel(stressRating);
  };

  const getRatingColor = () => {
    return stressService.getStressRatingColor(stressRating);
  };

  return (
    <div className="space-y-6">
      {/* Stress Rating */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-4">
          How stressed are you right now?
        </label>
        <div className="space-y-4">
          <div className="flex items-center justify-center">
            <div className={`text-6xl font-bold ${getRatingColor()}`}>
              {stressRating}
            </div>
            <div className="ml-4">
              <div className={`text-lg font-medium ${getRatingColor()}`}>
                {getRatingLabel()}
              </div>
            </div>
          </div>
          <SliderInput
            value={stressRating}
            onChange={setStressRating}
            min={1}
            max={10}
            step={1}
            showValue={false}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-slate-500 px-2">
            <span>1 - No stress</span>
            <span>10 - Extreme</span>
          </div>
        </div>
      </div>

      {/* Triggers */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-3">
          What&apos;s causing this stress? (optional)
        </label>
        <div className="flex flex-wrap gap-2">
          {STRESS_TRIGGERS.map((trigger) => {
            const isSelected = selectedTriggers.includes(trigger);
            return (
              <motion.button
                key={trigger}
                onClick={() => toggleTrigger(trigger)}
                className={`
                  px-4 py-2 rounded-full text-sm font-medium transition-all
                  ${isSelected
                    ? "bg-gradient-to-r from-red-600 to-orange-600 text-white shadow-lg"
                    : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
                  }
                `}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {trigger}
              </motion.button>
            );
          })}
        </div>
        {selectedTriggers.includes("Other") && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3"
          >
            <Input
              type="text"
              placeholder="Please specify..."
              value={otherTrigger}
              onChange={(e) => setOtherTrigger(e.target.value)}
              maxLength={100}
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
            />
          </motion.div>
        )}
      </div>

      {/* Note */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Additional notes (optional)
        </label>
        <Textarea
          placeholder="What's on your mind?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={3}
          className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 resize-none"
        />
        <p className="text-xs text-slate-500 mt-1">{note.length}/500</p>
      </div>

      {/* Error Message */}
      {error && (
        <motion.div
          className="p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-300 text-sm"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {error}
        </motion.div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        {onCancel && (
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 border-white/20 hover:bg-white/10"
          >
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex-1 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Logging...
            </>
          ) : (
            <>
              <AlertTriangle className="w-4 h-4 mr-2" />
              Log Detailed Stress
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

