/**
 * @file MoodCheckInDeep Component
 * @description Detailed multi-dimensional mood rating for deep mode
 */

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles } from "lucide-react";
import { SliderInput } from "@/components/common/questions/SliderInput";
import { moodService, type CreateMoodLogRequest } from "@/src/shared/services/wellbeing.service";
import type { EmotionTag } from "@shared/types/domain/wellbeing";

const EMOTION_TAGS: EmotionTag[] = [
  "grateful",
  "frustrated",
  "excited",
  "anxious",
  "content",
  "overwhelmed",
  "peaceful",
  "irritated",
  "hopeful",
  "lonely",
  "confident",
  "sad",
  "energized",
  "calm",
  "worried",
];

interface MoodCheckInDeepProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function MoodCheckInDeep({ onSuccess, onCancel }: MoodCheckInDeepProps) {
  const [happinessRating, setHappinessRating] = useState<number | undefined>(undefined);
  const [energyRating, setEnergyRating] = useState<number | undefined>(undefined);
  const [stressRating, setStressRating] = useState<number | undefined>(undefined);
  const [anxietyRating, setAnxietyRating] = useState<number | undefined>(undefined);
  const [selectedTags, setSelectedTags] = useState<EmotionTag[]>([]);
  const [contextNote, setContextNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTag = (tag: EmotionTag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    // At least one rating required
    if (!happinessRating && !energyRating && !stressRating && !anxietyRating) {
      setError("Please provide at least one rating");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const data: CreateMoodLogRequest = {
        mode: "deep",
        ...(happinessRating !== undefined && { happiness_rating: happinessRating }),
        ...(energyRating !== undefined && { energy_rating: energyRating }),
        ...(stressRating !== undefined && { stress_rating: stressRating }),
        ...(anxietyRating !== undefined && { anxiety_rating: anxietyRating }),
        ...(selectedTags.length > 0 && { emotion_tags: selectedTags }),
        ...(contextNote.trim() && { context_note: contextNote.trim() }),
      };

      const response = await moodService.createLog(data);

      if (response.success) {
        onSuccess?.();
      } else {
        setError(response.error?.message || "Failed to log mood");
      }
    } catch (err: unknown) {
      setError((err as Error).message || "Failed to log mood");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Ratings */}
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">
            Happiness (1-10)
          </label>
          <SliderInput
            value={happinessRating ?? 5}
            onChange={setHappinessRating}
            min={1}
            max={10}
            step={1}
            showValue
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">
            Energy (1-10)
          </label>
          <SliderInput
            value={energyRating ?? 5}
            onChange={setEnergyRating}
            min={1}
            max={10}
            step={1}
            showValue
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">
            Stress (1-10)
          </label>
          <SliderInput
            value={stressRating ?? 5}
            onChange={setStressRating}
            min={1}
            max={10}
            step={1}
            showValue
            className="w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3">
            Anxiety (1-10)
          </label>
          <SliderInput
            value={anxietyRating ?? 5}
            onChange={setAnxietyRating}
            min={1}
            max={10}
            step={1}
            showValue
            className="w-full"
          />
        </div>
      </div>

      {/* Emotion Tags */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-3">
          Emotion Tags (optional)
        </label>
        <div className="flex flex-wrap gap-2">
          {EMOTION_TAGS.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            return (
              <motion.button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`
                  px-4 py-2 rounded-full text-sm font-medium transition-all
                  ${isSelected
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/30"
                    : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
                  }
                `}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {tag}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Context Note */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Context Note (optional)
        </label>
        <Textarea
          placeholder="What's affecting your mood?"
          value={contextNote}
          onChange={(e) => setContextNote(e.target.value)}
          maxLength={500}
          rows={3}
          className="bg-white/5 border-white/10 text-white placeholder:text-slate-500 resize-none"
        />
        <p className="text-xs text-slate-500 mt-1">{contextNote.length}/500</p>
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
          disabled={
            isSubmitting ||
            (!happinessRating && !energyRating && !stressRating && !anxietyRating)
          }
          className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-500/30"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Logging...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Log Detailed Mood
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

