/**
 * @file MoodCheckInLight Component
 * @description Quick emoji-based mood check-in with 9-state emotional model and trigger tracking
 */

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Smile } from "lucide-react";
import { moodService, type CreateMoodLogRequest } from "@/src/shared/services/wellbeing.service";
import type { MoodEmoji, TriggerCategory } from "@shared/types/domain/wellbeing";

const MOOD_EMOJIS: Array<{ emoji: MoodEmoji; label: string; color: string }> = [
  // Row 1: Positive
  { emoji: "😌", label: "Calm", color: "from-blue-400 to-blue-600" },
  { emoji: "😎", label: "Confident", color: "from-green-400 to-green-600" },
  { emoji: "🎯", label: "Focused", color: "from-purple-400 to-purple-600" },
  // Row 2: Neutral / Mixed
  { emoji: "😐", label: "Neutral", color: "from-gray-400 to-gray-600" },
  { emoji: "🤔", label: "Distracted", color: "from-yellow-400 to-yellow-600" },
  { emoji: "🤩", label: "Euphoric", color: "from-pink-400 to-pink-600" },
  // Row 3: Negative
  { emoji: "😰", label: "Anxious", color: "from-orange-400 to-orange-600" },
  { emoji: "😤", label: "Frustrated", color: "from-red-400 to-red-600" },
  { emoji: "😨", label: "Fearful", color: "from-red-700 to-rose-800" },
];

const TRIGGER_CATEGORIES: Array<{ value: TriggerCategory; label: string }> = [
  { value: "work", label: "Work" },
  { value: "exercise", label: "Exercise" },
  { value: "social", label: "Social" },
  { value: "food", label: "Food" },
  { value: "sleep", label: "Sleep" },
  { value: "meditation", label: "Meditation" },
  { value: "conflict", label: "Conflict" },
  { value: "news", label: "News" },
  { value: "weather", label: "Weather" },
  { value: "other", label: "Other" },
];

interface MoodCheckInLightProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function MoodCheckInLight({ onSuccess, onCancel }: MoodCheckInLightProps) {
  const [selectedEmoji, setSelectedEmoji] = useState<MoodEmoji | null>(null);
  const [descriptor, setDescriptor] = useState("");
  const [transitionTrigger, setTransitionTrigger] = useState("");
  const [triggerCategory, setTriggerCategory] = useState<TriggerCategory | "">("");
  const [showTrigger, setShowTrigger] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!selectedEmoji) {
      setError("Please select a mood");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const data: CreateMoodLogRequest = {
        mode: "light",
        mood_emoji: selectedEmoji,
        ...(descriptor.trim() && { descriptor: descriptor.trim() }),
        ...(transitionTrigger.trim() && { transition_trigger: transitionTrigger.trim() }),
        ...(triggerCategory && { trigger_category: triggerCategory }),
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
      {/* Mood Emoji Selection — 3×3 grid */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-4">
          How are you feeling?
        </label>
        <div className="grid grid-cols-3 gap-3">
          {MOOD_EMOJIS.map((mood) => (
            <motion.button
              key={mood.emoji}
              onClick={() => {
                setSelectedEmoji(mood.emoji);
                setShowTrigger(true);
              }}
              className={`
                relative p-4 rounded-2xl border-2 transition-all
                ${selectedEmoji === mood.emoji
                  ? `bg-gradient-to-br ${mood.color} border-white shadow-lg scale-105`
                  : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                }
              `}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <div className="text-4xl mb-1">{mood.emoji}</div>
              <div
                className={`text-xs font-medium ${
                  selectedEmoji === mood.emoji ? "text-white" : "text-slate-400"
                }`}
              >
                {mood.label}
              </div>
              {selectedEmoji === mood.emoji && (
                <motion.div
                  className="absolute top-1.5 right-1.5 w-5 h-5 bg-white rounded-full flex items-center justify-center"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500 }}
                >
                  <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full" />
                </motion.div>
              )}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Trigger Input — shown after emoji selection */}
      <AnimatePresence>
        {showTrigger && selectedEmoji && (
          <motion.div
            className="space-y-3"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <label className="block text-sm font-medium text-slate-300">
              What triggered this mood? <span className="text-slate-500">(optional)</span>
            </label>
            <Input
              type="text"
              placeholder="e.g., stressful meeting, good workout..."
              value={transitionTrigger}
              onChange={(e) => setTransitionTrigger(e.target.value)}
              maxLength={100}
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
            />
            <div className="flex flex-wrap gap-2">
              {TRIGGER_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setTriggerCategory(triggerCategory === cat.value ? "" : cat.value)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    triggerCategory === cat.value
                      ? "bg-emerald-500/30 text-emerald-300 border border-emerald-500/50"
                      : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Optional Descriptor */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Optional: One-word descriptor
        </label>
        <Input
          type="text"
          placeholder="e.g., grateful, frustrated, excited..."
          value={descriptor}
          onChange={(e) => setDescriptor(e.target.value)}
          maxLength={50}
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
          disabled={isSubmitting || !selectedEmoji}
          className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-500/30"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Logging...
            </>
          ) : (
            <>
              <Smile className="w-4 h-4 mr-2" />
              Log Mood
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
