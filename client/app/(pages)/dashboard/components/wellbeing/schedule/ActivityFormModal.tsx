"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Square, Circle, Diamond, Shapes } from "lucide-react";
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
import { scheduleService, type ScheduleItem, type UpdateScheduleItemRequest } from "@/src/shared/services/schedule.service";
import { IconPicker } from "./IconPicker";

interface ActivityFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: ScheduleItem | null;
  onSave: (item?: ScheduleItem) => void;
  scheduleId?: string;
}

const SHAPES = [
  { value: "square", label: "Square", icon: Square },
  { value: "circle", label: "Circle", icon: Circle },
  { value: "rounded", label: "Rounded", icon: Square },
  { value: "diamond", label: "Diamond", icon: Diamond },
];

const COLORS = [
  { value: "#10b981", label: "Emerald" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#ef4444", label: "Red" },
  { value: "#06b6d4", label: "Cyan" },
  { value: "#ec4899", label: "Pink" },
  { value: "#14b8a6", label: "Teal" },
];

const CATEGORIES = [
  "Work",
  "Exercise",
  "Meal",
  "Break",
  "Personal",
  "Study",
  "Social",
  "Health",
  "Other",
];

export function ActivityFormModal({ isOpen, onClose, activity, onSave, scheduleId }: ActivityFormModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    start_time: "",
    end_time: "",
    duration_minutes: "",
    color: "#10b981",
    icon: "",
    category: "",
    shape: "square" as "square" | "circle" | "rounded" | "diamond",
  });

  useEffect(() => {
    if (activity) {
      const shape = activity.shape || (activity.metadata as { shape?: string })?.shape || "square";
      setFormData({
        title: activity.title,
        description: activity.description || "",
        start_time: activity.startTime,
        end_time: activity.endTime || "",
        duration_minutes: activity.durationMinutes?.toString() || "",
        color: activity.color || "#10b981",
        icon: activity.icon || "",
        category: activity.category || "",
        shape: shape as "square" | "circle" | "rounded" | "diamond",
      });
    } else {
      setFormData({
        title: "",
        description: "",
        start_time: "",
        end_time: "",
        duration_minutes: "",
        color: "#10b981",
        icon: "",
        category: "",
        shape: "square",
      });
    }
    setError(null);
  }, [activity, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (activity) {
        // Update existing activity
        const updateData: UpdateScheduleItemRequest = {
          title: formData.title,
          description: formData.description || undefined,
          start_time: formData.start_time,
          end_time: formData.end_time || undefined,
          duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes) : undefined,
          color: formData.color,
          icon: formData.icon || undefined,
          category: formData.category || undefined,
          shape: formData.shape,
          metadata: {
            shape: formData.shape,
          },
        };

        const result = await scheduleService.updateScheduleItem(activity.id, updateData);
        if (result.success) {
          onSave(result.data?.item);
          onClose();
        } else {
          setError("Failed to update activity");
        }
      } else if (scheduleId) {
        // Create new activity
        const createData = {
          title: formData.title,
          description: formData.description || undefined,
          start_time: formData.start_time,
          end_time: formData.end_time || undefined,
          duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes) : undefined,
          color: formData.color,
          icon: formData.icon || undefined,
          category: formData.category || undefined,
          shape: formData.shape,
          position: 0,
          metadata: {
            shape: formData.shape,
            x: 100,
            y: 100,
          },
        };

        const result = await scheduleService.addScheduleItem(scheduleId, createData);
        if (result.success) {
          onSave(result.data?.item);
          onClose();
        } else {
          setError("Failed to create activity");
        }
      }
    } catch (err) {
      console.error("Error saving activity:", err);
      setError(activity ? "Failed to update activity. Please try again." : "Failed to create activity. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (typeof window === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-emerald-500/20 rounded-2xl shadow-2xl z-[10000] p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                {activity ? "Edit Activity" : "Create Activity"}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div>
                <Label htmlFor="title" className="text-slate-300 mb-2 block">
                  Title *
                </Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  className="bg-slate-800/50 border-slate-700 text-white"
                  placeholder="Activity title"
                />
              </div>

              <div>
                <Label htmlFor="description" className="text-slate-300 mb-2 block">
                  Description
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="bg-slate-800/50 border-slate-700 text-white"
                  placeholder="Activity description"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_time" className="text-slate-300 mb-2 block">
                    Start Time *
                  </Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    required
                    className="bg-slate-800/50 border-slate-700 text-white"
                  />
                </div>
                <div>
                  <Label htmlFor="end_time" className="text-slate-300 mb-2 block">
                    End Time
                  </Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="bg-slate-800/50 border-slate-700 text-white"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="duration_minutes" className="text-slate-300 mb-2 block">
                  Duration (minutes)
                </Label>
                <Input
                  id="duration_minutes"
                  type="number"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                  className="bg-slate-800/50 border-slate-700 text-white"
                  placeholder="30"
                  min="1"
                />
              </div>

              <div>
                <Label htmlFor="category" className="text-slate-300 mb-2 block">
                  Category
                </Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white w-full">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 z-[10001] w-full">
                    {CATEGORIES.map((cat) => (
                      <SelectItem
                        key={cat}
                        value={cat}
                        className="cursor-pointer text-white hover:bg-slate-700"
                      >
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="color" className="text-slate-300 mb-2 block">
                  Color
                </Label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: color.value })}
                      className={`w-10 h-10 rounded-lg border-2 transition-all ${
                        formData.color === color.value
                          ? "border-white scale-110"
                          : "border-slate-600 hover:border-slate-400"
                      }`}
                      style={{ backgroundColor: color.value }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="shape" className="text-slate-300 mb-2 block flex items-center gap-2">
                  <Shapes className="w-4 h-4" />
                  Shape
                </Label>
                <div className="grid grid-cols-5 gap-3">
                  {SHAPES.map((shape) => {
                    const IconComponent = shape.icon;
                    return (
                      <button
                        key={shape.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, shape: shape.value as "square" | "circle" | "rounded" | "diamond" })}
                        className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                          formData.shape === shape.value
                            ? "border-emerald-500 bg-emerald-500/20 scale-105"
                            : "border-slate-600 hover:border-slate-400 bg-slate-800/50"
                        }`}
                      >
                        <IconComponent className="w-6 h-6 text-slate-300" />
                        <span className="text-xs text-slate-400">{shape.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="relative">
                <Label htmlFor="icon" className="text-slate-300 mb-2 block">
                  Icon
                </Label>
                <div className="flex gap-2">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowIconPicker(!showIconPicker);
                      }}
                      className="w-12 h-12 rounded-lg border-2 border-slate-600 bg-slate-800/50 hover:bg-slate-700/50 flex items-center justify-center text-2xl transition-all"
                    >
                      {formData.icon || "😀"}
                    </button>
                    {showIconPicker && (
                      <div className="absolute top-full left-0 mt-2 z-[10002]">
                        <IconPicker
                          value={formData.icon}
                          onChange={(icon) => {
                            setFormData({ ...formData, icon });
                            setShowIconPicker(false);
                          }}
                          onClose={() => setShowIconPicker(false)}
                        />
                      </div>
                    )}
                  </div>
                  <Input
                    id="icon"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    className="flex-1 bg-slate-800/50 border-slate-700 text-white"
                    placeholder="Or type emoji"
                    maxLength={2}
                    onClick={() => setShowIconPicker(false)}
                  />
                  {formData.icon && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, icon: "" })}
                      className="px-3 rounded-lg border border-slate-600 bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-white transition-all"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  onClick={onClose}
                  variant="outline"
                  className="flex-1 bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700/50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

