/**
 * @file EnergyCheckIn Component
 * @description Quick energy level check-in with slider
 */

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SliderInput } from "@/components/common/questions/SliderInput";
import { Loader2, Zap } from "lucide-react";
import { energyService, type CreateEnergyLogRequest } from "@/src/shared/services/wellbeing.service";

const CONTEXT_TAGS = [
  "post-meal",
  "post-workout",
  "during-work",
  "after-sleep",
  "after-caffeine",
  "after-social-activity",
];

interface EnergyCheckInProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function EnergyCheckIn({ onSuccess, onCancel }: EnergyCheckInProps) {
  const [energyRating, setEnergyRating] = useState(5);
  const [contextTag, setContextTag] = useState<string>("");
  const [contextNote, setContextNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getEnergyLabel = (rating: number): string => {
    if (rating <= 2) return "Exhausted";
    if (rating <= 4) return "Low";
    if (rating <= 5) return "Neutral";
    if (rating <= 7) return "Good";
    if (rating <= 9) return "High";
    return "Highly Energized";
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const data: CreateEnergyLogRequest = {
        energy_rating: energyRating,
        ...(contextTag && { context_tag: contextTag }),
        ...(contextNote.trim() && { context_note: contextNote.trim() }),
      };

      const response = await energyService.createLog(data);

      if (response.success) {
        onSuccess?.();
      } else {
        setError(response.error?.message || "Failed to log energy");
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to log energy");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Energy Rating Slider */}
      <div>
        <SliderInput
          value={energyRating}
          onChange={setEnergyRating}
          min={1}
          max={10}
          step={1}
          showValue
          labels={["Exhausted", "Highly Energized"]}
          label="How's your energy right now?"
        />
        <div className="mt-2 text-center">
          <span className="text-sm font-medium text-slate-300">
            {getEnergyLabel(energyRating)}
          </span>
        </div>
      </div>

      {/* Context Tag */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-3">
          Context (optional)
        </label>
        <div className="flex flex-wrap gap-2">
          {CONTEXT_TAGS.map((tag) => {
            const isSelected = contextTag === tag;
            return (
              <motion.button
                key={tag}
                onClick={() => setContextTag(isSelected ? "" : tag)}
                className={`
                  px-4 py-2 rounded-full text-sm font-medium transition-all
                  ${isSelected
                    ? "bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg"
                    : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
                  }
                `}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {tag.replace("-", " ")}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Context Note */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Note (optional)
        </label>
        <Input
          type="text"
          placeholder="e.g., after heavy lunch..."
          value={contextNote}
          onChange={(e) => setContextNote(e.target.value)}
          maxLength={300}
          className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
        />
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
          className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-500/30"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Logging...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              Log Energy
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

