"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Plus,
  Trash2,
  Sparkles,
  Dumbbell,

} from "lucide-react";
import toast from "react-hot-toast";
import { DayWorkout, Exercise } from "./types";
import { workoutsService } from "@/src/shared/services";
import { MUSCLE_GROUPS } from "./constants";
import { ExerciseSearchInput } from "./ExerciseSearchInput";
import type { ExerciseListItem } from "@/src/shared/services/exercises.service";

interface DayWorkoutEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  dayOfWeek: string;
  workout: DayWorkout | null;
  planName: string;
  onSave: (dayOfWeek: string, updatedWorkout: DayWorkout | null) => Promise<void>;
}

const DAY_LABELS: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export function DayWorkoutEditModal({
  isOpen,
  onClose,
  dayOfWeek,
  workout,
  planName,
  onSave,
}: DayWorkoutEditModalProps) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workoutName, setWorkoutName] = useState("");
  const [focusArea, setFocusArea] = useState("");
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<string[]>([]);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [aiTips, setAiTips] = useState<string[]>([]);

  // Initialize form data when modal opens
  useEffect(() => {
    if (isOpen && workout) {
      setExercises(
        workout.exercises.map((ex) => ({
          id: ex.id || `${Date.now()}-${Math.random()}`,
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          restSeconds: ex.restSeconds,
          muscleGroup: ex.muscleGroup,
          weight: ex.weight,
          completed: false,
        }))
      );
      setWorkoutName(workout.workoutName || planName);
      setFocusArea(workout.focusArea || "");
      // Extract muscle groups from focus area
      const groups = workout.focusArea
        ? workout.focusArea.split(",").map((g) => g.trim())
        : [];
      setSelectedMuscleGroups(groups);
    } else if (isOpen && !workout) {
      // Creating new workout for this day
      setExercises([]);
      setWorkoutName(planName);
      setFocusArea("");
      setSelectedMuscleGroups([]);
    }
  }, [isOpen, workout, planName]);

  const addExercise = useCallback(() => {
    const newExercise: Exercise = {
      id: `new-${Date.now()}-${Math.random()}`,
      name: "",
      sets: 3,
      reps: "10-12",
      restSeconds: 60,
      muscleGroup: selectedMuscleGroups[0] || "Full Body",
      completed: false,
    };
    setExercises((prev) => [...prev, newExercise]);
  }, [selectedMuscleGroups]);

  const removeExercise = useCallback((exerciseId: string) => {
    setExercises((prev) => prev.filter((ex) => ex.id !== exerciseId));
  }, []);

  const updateExercise = useCallback(
    (exerciseId: string, updates: Partial<Exercise>) => {
      setExercises((prev) =>
        prev.map((ex) => (ex.id === exerciseId ? { ...ex, ...updates } : ex))
      );
    },
    []
  );

  const toggleMuscleGroup = useCallback((group: string) => {
    setSelectedMuscleGroups((prev) =>
      prev.includes(group)
        ? prev.filter((g) => g !== group)
        : [...prev, group]
    );
  }, []);

  const handleGetAISuggestions = useCallback(async () => {
    if (selectedMuscleGroups.length === 0) {
      alert("Please select at least one muscle group");
      return;
    }

    setIsLoadingAI(true);
    try {
      const response = await workoutsService.suggestExercises({
        muscleGroups: selectedMuscleGroups,
        difficulty: "beginner", // Could be made configurable
        equipment: ["bodyweight", "dumbbells", "barbell"],
        duration: 45,
      });

      if (response.data?.exercises) {
        const suggestedExercises: Exercise[] = response.data.exercises.map(
          (ex, index) => ({
            id: `ai-${Date.now()}-${index}`,
            name: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            restSeconds: ex.restSeconds,
            muscleGroup: ex.muscleGroup,
            completed: false,
          })
        );
        setExercises((prev) => [...prev, ...suggestedExercises]);
        setAiTips(response.data.workoutTips || []);
      }
    } catch (error) {
      console.error("Failed to get AI suggestions:", error);
      alert("Failed to get AI suggestions. Please try again.");
    } finally {
      setIsLoadingAI(false);
    }
  }, [selectedMuscleGroups]);

  const handleSave = useCallback(async () => {
    if (exercises.length === 0) {
      alert("Please add at least one exercise");
      return;
    }

    setIsSaving(true);
    try {
      const updatedWorkout: DayWorkout = {
        dayOfWeek,
        workoutName: workoutName || planName,
        focusArea: focusArea || selectedMuscleGroups.join(", ") || "Full Body",
        exercises: exercises.map((ex) => ({
          id: ex.id,
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          restSeconds: ex.restSeconds || 60,
          muscleGroup: ex.muscleGroup,
          weight: ex.weight,
        })),
        estimatedDuration: exercises.length * 8, // ~8 min per exercise
        estimatedCalories: exercises.length * 25, // ~25 cal per exercise
      };

      await onSave(dayOfWeek, updatedWorkout);
      toast.success(`${DAY_LABELS[dayOfWeek] || "Workout"} saved`);
      onClose();
    } catch (error) {
      console.error("Failed to save workout:", error);
      toast.error("Failed to save workout. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [
    exercises,
    dayOfWeek,
    workoutName,
    planName,
    focusArea,
    selectedMuscleGroups,
    onSave,
    onClose,
  ]);

  const handleRemoveDay = useCallback(async () => {
    const { confirm: confirmAction } = await import("@/components/common/ConfirmDialog");
    const confirmed = await confirmAction({
      title: "Remove Workout Day",
      description: "Are you sure you want to remove this workout day?",
      confirmText: "Remove",
      cancelText: "Cancel",
      variant: "destructive",
    });

    if (!confirmed) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave(dayOfWeek, null);
      toast.success(`${DAY_LABELS[dayOfWeek] || "Workout"} removed`);
      onClose();
    } catch (error) {
      console.error("Failed to remove workout:", error);
      toast.error("Failed to remove workout. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }, [dayOfWeek, onSave, onClose]);

  const mapLibraryMuscleToFormMuscle = useCallback((muscle: string | null): string => {
    if (!muscle) return selectedMuscleGroups[0] || "Full Body";
    const lower = muscle.toLowerCase();
    const mapping: Record<string, string> = {
      chest: "Chest", pectorals: "Chest",
      back: "Back", lats: "Back", traps: "Back", "lower back": "Back", "upper back": "Back",
      shoulders: "Shoulders", delts: "Shoulders", deltoids: "Shoulders",
      quadriceps: "Legs", hamstrings: "Legs", glutes: "Legs", calves: "Legs", adductors: "Legs", abductors: "Legs",
      biceps: "Arms", triceps: "Arms", forearms: "Arms",
      abdominals: "Core", abs: "Core", obliques: "Core",
      cardio: "Cardio", cardiovascular: "Cardio",
    };
    return mapping[lower] || MUSCLE_GROUPS.find((g) => lower.includes(g.toLowerCase())) || selectedMuscleGroups[0] || "Full Body";
  }, [selectedMuscleGroups]);

  const handleExerciseSelect = useCallback(
    (exerciseId: string, exercise: ExerciseListItem) => {
      updateExercise(exerciseId, {
        name: exercise.name,
        sets: exercise.default_sets || 3,
        reps: String(exercise.default_reps || 10),
        restSeconds: exercise.default_rest_seconds || 60,
        muscleGroup: mapLibraryMuscleToFormMuscle(exercise.primary_muscle_group),
      });
    },
    [updateExercise, mapLibraryMuscleToFormMuscle]
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-700 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">
                Edit {DAY_LABELS[dayOfWeek]} Workout
              </h2>
              <p className="text-slate-400 text-sm mt-1">{planName}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Workout Name */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Workout Name
              </label>
              <input
                type="text"
                value={workoutName}
                onChange={(e) => setWorkoutName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                placeholder="Enter workout name"
              />
            </div>

            {/* Focus Area / Muscle Groups */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Focus Areas / Muscle Groups
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {MUSCLE_GROUPS.map((group) => {
                  const isSelected = selectedMuscleGroups.includes(group);
                  return (
                    <button
                      key={group}
                      type="button"
                      onClick={() => toggleMuscleGroup(group)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        isSelected
                          ? "bg-orange-500/20 border border-orange-500 text-orange-400"
                          : "bg-slate-800 border border-slate-700 text-slate-400 hover:border-slate-600"
                      }`}
                    >
                      {group}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                value={focusArea}
                onChange={(e) => setFocusArea(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                placeholder="Or enter custom focus area"
              />
            </div>

            {/* AI Suggestions */}
            <div className="flex items-center justify-between p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl">
              <div>
                <h3 className="text-sm font-medium text-violet-400 mb-1">
                  AI Exercise Suggestions
                </h3>
                <p className="text-xs text-slate-400">
                  Get AI-generated exercises based on selected muscle groups
                </p>
              </div>
              <button
                onClick={handleGetAISuggestions}
                disabled={isLoadingAI || selectedMuscleGroups.length === 0}
                className="px-4 py-2 bg-violet-500/20 border border-violet-500 text-violet-400 rounded-xl hover:bg-violet-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {isLoadingAI ? "Loading..." : "Get AI Suggestions"}
              </button>
            </div>

            {/* AI Tips */}
            {aiTips.length > 0 && (
              <div className="p-4 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                <h4 className="text-sm font-medium text-violet-400 mb-2">
                  AI Tips
                </h4>
                <ul className="text-xs text-slate-400 space-y-1">
                  {aiTips.map((tip, i) => (
                    <li key={i}>• {tip}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Exercises List */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-medium text-slate-300">
                  Exercises ({exercises.length})
                </label>
                <button
                  onClick={addExercise}
                  className="px-4 py-2 bg-orange-500/20 border border-orange-500 text-orange-400 rounded-xl hover:bg-orange-500/30 transition-colors flex items-center gap-2 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Exercise
                </button>
              </div>

              <div className="space-y-3">
                {exercises.map((exercise, index) => (
                  <div
                    key={exercise.id}
                    className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-xs text-slate-500">
                        Exercise {index + 1}
                      </span>
                      <button
                        onClick={() => removeExercise(exercise.id)}
                        className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">
                          Exercise Name
                        </label>
                        <ExerciseSearchInput
                          value={exercise.name}
                          onChange={(name) =>
                            updateExercise(exercise.id, { name })
                          }
                          onExerciseSelect={(lib) =>
                            handleExerciseSelect(exercise.id, lib)
                          }
                          placeholder="Search exercises or type custom..."
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">
                          Muscle Group
                        </label>
                        <select
                          value={exercise.muscleGroup}
                          onChange={(e) =>
                            updateExercise(exercise.id, {
                              muscleGroup: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-orange-500"
                        >
                          {MUSCLE_GROUPS.map((group) => (
                            <option key={group} value={group}>
                              {group}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">
                          Sets
                        </label>
                        <input
                          type="number"
                          value={exercise.sets}
                          onChange={(e) =>
                            updateExercise(exercise.id, {
                              sets: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-orange-500"
                          min="1"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">
                          Reps
                        </label>
                        <input
                          type="text"
                          value={exercise.reps}
                          onChange={(e) =>
                            updateExercise(exercise.id, { reps: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-orange-500"
                          placeholder="e.g., 10-12"
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-slate-400 mb-1">
                          Rest (seconds)
                        </label>
                        <input
                          type="number"
                          value={exercise.restSeconds}
                          onChange={(e) =>
                            updateExercise(exercise.id, {
                              restSeconds: parseInt(e.target.value) || 60,
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-orange-500"
                          min="0"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {exercises.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <Dumbbell className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No exercises added yet</p>
                  <p className="text-xs mt-1">
                    {/* eslint-disable-next-line react/no-unescaped-entities */}
                    Click "Add Exercise" or use AI suggestions
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-700 flex items-center justify-between gap-4">
            <button
              onClick={handleRemoveDay}
              className="px-4 py-2 text-red-400 hover:bg-red-500/20 rounded-xl transition-colors text-sm"
            >
              Remove Day
            </button>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || exercises.length === 0}
                className="px-6 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? "Saving..." : "Save Workout"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

