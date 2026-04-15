/**
 * @file HabitFormModal Component
 * @description Modal for creating and editing habits
 */

"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { habitService, type CreateHabitRequest, type UpdateHabitRequest } from "@/src/shared/services/wellbeing.service";
import type { Habit, HabitTrackingType, HabitFrequency, DayOfWeek } from "@shared/types/domain/wellbeing";

interface HabitFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  habit?: Habit | null;
}

const TRACKING_TYPES: { value: HabitTrackingType; label: string }[] = [
  { value: "checkbox", label: "Checkbox (Yes/No)" },
  { value: "counter", label: "Counter (Number)" },
  { value: "duration", label: "Duration (Time)" },
  { value: "rating", label: "Rating (1-10)" },
];

const FREQUENCIES: { value: HabitFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "custom", label: "Custom Days" },
];

const DAYS_OF_WEEK: { value: DayOfWeek; label: string }[] = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
];

export function HabitFormModal({ isOpen, onClose, habit }: HabitFormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    habit_name: "",
    category: "",
    tracking_type: "checkbox" as HabitTrackingType,
    frequency: "daily" as HabitFrequency,
    specific_days: [] as DayOfWeek[],
    description: "",
    target_value: "",
    unit: "",
    reminder_enabled: false,
    reminder_time: "",
  });

  useEffect(() => {
    if (habit) {
      setFormData({
        habit_name: habit.habitName,
        category: habit.category || "",
        tracking_type: habit.trackingType,
        frequency: habit.frequency,
        specific_days: habit.specificDays || [],
        description: habit.description || "",
        target_value: habit.targetValue?.toString() || "",
        unit: habit.unit || "",
        reminder_enabled: habit.reminderEnabled,
        reminder_time: habit.reminderTime || "",
      });
    } else {
      setFormData({
        habit_name: "",
        category: "",
        tracking_type: "checkbox",
        frequency: "daily",
        specific_days: [],
        description: "",
        target_value: "",
        unit: "",
        reminder_enabled: false,
        reminder_time: "",
      });
    }
    setError(null);
  }, [habit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const baseData: Partial<CreateHabitRequest> = {
        habit_name: formData.habit_name.trim(),
        tracking_type: formData.tracking_type,
        frequency: formData.frequency,
        category: formData.category || undefined,
        description: formData.description || undefined,
        reminder_enabled: formData.reminder_enabled,
        reminder_time: formData.reminder_time || undefined,
      };

      if (formData.frequency === "custom") {
        baseData.specific_days = formData.specific_days;
      }

      if (formData.tracking_type === "counter" || formData.tracking_type === "duration" || formData.tracking_type === "rating") {
        if (formData.target_value) {
          baseData.target_value = parseFloat(formData.target_value);
        }
        if (formData.unit) {
          baseData.unit = formData.unit;
        }
      }

      let result;
      if (habit) {
        result = await habitService.updateHabit(habit.id, baseData as UpdateHabitRequest);
      } else {
        result = await habitService.createHabit(baseData as CreateHabitRequest);
      }

      if (result.success) {
        onClose();
      } else {
        setError(result.error?.message || "Failed to save habit");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save habit");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleDay = (day: DayOfWeek) => {
    setFormData((prev) => ({
      ...prev,
      specific_days: prev.specific_days.includes(day)
        ? prev.specific_days.filter((d) => d !== day)
        : [...prev.specific_days, day],
    }));
  };

  if (typeof window === "undefined") return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl border border-emerald-500/20 shadow-2xl z-[10000]"
          >
          <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b border-emerald-500/20 bg-slate-900/80 backdrop-blur-sm">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              {habit ? "Edit Habit" : "Create New Habit"}
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="habit_name" className="text-white">
                Habit Name *
              </Label>
              <Input
                id="habit_name"
                value={formData.habit_name}
                onChange={(e) => setFormData({ ...formData, habit_name: e.target.value })}
                placeholder="e.g., Morning Meditation"
                required
                className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tracking_type" className="text-white">
                  Tracking Type *
                </Label>
                <Select
                  value={formData.tracking_type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, tracking_type: value as HabitTrackingType })
                  }
                >
                  <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white focus:border-emerald-500 w-full">
                    <SelectValue placeholder="Select tracking type" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 z-[10001]" position="popper">
                    {TRACKING_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value} className="text-white cursor-pointer">
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="frequency" className="text-white">
                  Frequency *
                </Label>
                <Select
                  value={formData.frequency}
                  onValueChange={(value) =>
                    setFormData({ ...formData, frequency: value as HabitFrequency })
                  }
                >
                  <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white focus:border-emerald-500 w-full">
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 z-[10001]" position="popper">
                    {FREQUENCIES.map((freq) => (
                      <SelectItem key={freq.value} value={freq.value} className="text-white cursor-pointer">
                        {freq.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.frequency === "custom" && (
              <div className="space-y-2">
                <Label className="text-white">Select Days</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        formData.specific_days.includes(day.value)
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="category" className="text-white">
                Category (Optional)
              </Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="e.g., Health, Productivity, Wellness"
                className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-white">
                Description (Optional)
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Add a description for this habit..."
                rows={3}
                className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500"
              />
            </div>

            {(formData.tracking_type === "counter" ||
              formData.tracking_type === "duration" ||
              formData.tracking_type === "rating") && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="target_value" className="text-white">
                    Target Value (Optional)
                  </Label>
                  <Input
                    id="target_value"
                    type="number"
                    value={formData.target_value}
                    onChange={(e) => setFormData({ ...formData, target_value: e.target.value })}
                    placeholder="e.g., 10000"
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit" className="text-white">
                    Unit (Optional)
                  </Label>
                  <Input
                    id="unit"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="e.g., steps, minutes, ml"
                    className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="reminder_enabled"
                  checked={formData.reminder_enabled}
                  onChange={(e) =>
                    setFormData({ ...formData, reminder_enabled: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-emerald-600 focus:ring-emerald-500"
                />
                <Label htmlFor="reminder_enabled" className="text-white cursor-pointer">
                  Enable Reminder
                </Label>
              </div>

              {formData.reminder_enabled && (
                <div className="space-y-2">
                  <Label htmlFor="reminder_time" className="text-white">
                    Reminder Time
                  </Label>
                  <Input
                    id="reminder_time"
                    type="time"
                    value={formData.reminder_time}
                    onChange={(e) => setFormData({ ...formData, reminder_time: e.target.value })}
                    className="bg-slate-800/50 border-slate-700 text-white focus:border-emerald-500"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 pt-4 border-t border-emerald-500/20">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !formData.habit_name.trim()}
                className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : habit ? (
                  "Update Habit"
                ) : (
                  "Create Habit"
                )}
              </Button>
            </div>
          </form>
        </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}

