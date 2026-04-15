"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Save,
  Loader2,
  Sparkles,
  Wand2,
  Calendar,
  Clock,
  Dumbbell,
  MapPin,
  Target,
  ChevronRight,
  Check,
} from "lucide-react";
import { workoutsService } from "@/src/shared/services";
import type { ExerciseListItem } from "@/src/shared/services/exercises.service";
import { ExerciseSearchInput } from "./ExerciseSearchInput";
import { workoutLogger } from "./logger";
import {
  PRESET_EXERCISES,
  MUSCLE_GROUPS,
  DIFFICULTY_OPTIONS,
  DEFAULT_EQUIPMENT,
  EQUIPMENT_OPTIONS,
  LOCATION_OPTIONS,
  GOAL_CATEGORY_OPTIONS,
  DURATION_OPTIONS,
  WORKOUTS_PER_WEEK_OPTIONS,
  TIME_PER_WORKOUT_OPTIONS,
  DAYS_OF_WEEK,
  DAYS_LABELS,
} from "./constants";
import type { Exercise, WorkoutPlan, CreateWorkoutFormData, AIGenerationFormData, DayWorkout } from "./types";

interface CreateWorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWorkoutCreated: (workout: WorkoutPlan) => void;
}

type CreationMode = "manual" | "ai";

const getTodayDateStr = () => new Date().toISOString().split('T')[0];

const initialFormData: CreateWorkoutFormData = {
  name: "",
  description: "",
  muscleGroups: [],
  difficulty: "beginner",
  scheduledTime: "07:00",
  exercises: [],
  useAI: false,
  aiPrompt: "",
  workoutsPerWeek: 4, // Default to 4 days per week
  selectedDays: ['monday', 'tuesday', 'thursday', 'friday'], // Default days for 4 days/week
  startDate: getTodayDateStr(),
};

const initialAIFormData: AIGenerationFormData = {
  description: "",
  durationWeeks: 1,
  workoutsPerWeek: 3,
  timePerWorkout: 45,
  fitnessLevel: "beginner",
  equipment: ["bodyweight"],
  workoutLocation: "home",
  goalCategory: "overall_optimization",
  selectedDays: ['monday', 'wednesday', 'friday'], // Default days for 3 days/week
  startDate: getTodayDateStr(),
};

export function CreateWorkoutModal({
  isOpen,
  onClose,
  onWorkoutCreated,
}: CreateWorkoutModalProps) {
  const [mode, setMode] = useState<CreationMode>("ai");
  const [formData, setFormData] = useState<CreateWorkoutFormData>(initialFormData);
  const [aiFormData, setAIFormData] = useState<AIGenerationFormData>(initialAIFormData);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiWorkoutTips, setAIWorkoutTips] = useState<string[]>([]);
  const [generatedSchedule, setGeneratedSchedule] = useState<Record<string, DayWorkout | null> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState("");

  // Reset form
  const resetForm = useCallback(() => {
    setFormData(initialFormData);
    setAIFormData(initialAIFormData);
    setAIWorkoutTips([]);
    setGeneratedSchedule(null);
    setError(null);
    setMode("ai");
  }, []);

  // Handle close
  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  // Toggle muscle group selection
  const toggleMuscleGroup = useCallback((group: string) => {
    setFormData(prev => ({
      ...prev,
      muscleGroups: prev.muscleGroups.includes(group)
        ? prev.muscleGroups.filter(g => g !== group)
        : [...prev.muscleGroups, group],
    }));
  }, []);

  // Toggle equipment selection
  const toggleEquipment = useCallback((equipment: string) => {
    setAIFormData(prev => ({
      ...prev,
      equipment: prev.equipment.includes(equipment)
        ? prev.equipment.filter(e => e !== equipment)
        : [...prev.equipment, equipment],
    }));
  }, []);

  // Toggle day selection
  const toggleDay = useCallback((day: string) => {
    setFormData(prev => {
      const currentDays = prev.selectedDays || [];
      const newDays = currentDays.includes(day)
        ? currentDays.filter(d => d !== day)
        : [...currentDays, day];
      
      // Update workoutsPerWeek to match selected days count
      const workoutsPerWeek = newDays.length;
      
      return {
        ...prev,
        selectedDays: newDays,
        workoutsPerWeek: workoutsPerWeek > 0 ? workoutsPerWeek : prev.workoutsPerWeek || 4,
      };
    });
  }, []);

  // Auto-select days when workoutsPerWeek changes
  const handleWorkoutsPerWeekChange = useCallback((value: number) => {
    const dayMappings: Record<number, string[]> = {
      2: ['monday', 'thursday'],
      3: ['monday', 'wednesday', 'friday'],
      4: ['monday', 'tuesday', 'thursday', 'friday'],
      5: ['monday', 'tuesday', 'wednesday', 'friday', 'saturday'],
      6: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    };
    
    setFormData(prev => ({
      ...prev,
      workoutsPerWeek: value,
      selectedDays: dayMappings[value] || dayMappings[4],
    }));
  }, []);

  // Add exercise to form
  const addExercise = useCallback((exerciseName: string, muscleGroup: string) => {
    const newExercise: Exercise = {
      id: `exercise-${Date.now()}`,
      name: exerciseName,
      sets: 3,
      reps: "10-12",
      restSeconds: 60,
      muscleGroup,
      completed: false,
    };
    setFormData(prev => ({
      ...prev,
      exercises: [...prev.exercises, newExercise],
    }));
    workoutLogger.debug('Exercise added to form', { exercise: exerciseName, muscleGroup });
  }, []);

  // Add exercise from search (with DB data)
  const addExerciseFromSearch = useCallback((ex: ExerciseListItem) => {
    if (formData.exercises.some(e => e.name.toLowerCase() === ex.name.toLowerCase())) return;
    const newExercise: Exercise = {
      id: `db-${ex.id}-${Date.now()}`,
      name: ex.name,
      sets: ex.default_sets || 3,
      reps: ex.default_reps ? String(ex.default_reps) : "10-12",
      restSeconds: ex.default_rest_seconds || 60,
      muscleGroup: ex.primary_muscle_group || ex.body_part || "Full Body",
      completed: false,
      thumbnailUrl: ex.thumbnail_url || ex.animation_url || undefined,
    };
    setFormData(prev => ({
      ...prev,
      exercises: [...prev.exercises, newExercise],
    }));
    setExerciseSearchQuery("");
    workoutLogger.debug('Exercise added from DB search', { exercise: ex.name, id: ex.id });
  }, [formData.exercises]);

  // Remove exercise from form
  const removeExercise = useCallback((exerciseId: string) => {
    setFormData(prev => ({
      ...prev,
      exercises: prev.exercises.filter(e => e.id !== exerciseId),
    }));
  }, []);

  // Update exercise in form
  const updateExercise = useCallback((exerciseId: string, updates: Partial<Exercise>) => {
    setFormData(prev => ({
      ...prev,
      exercises: prev.exercises.map(ex =>
        ex.id === exerciseId ? { ...ex, ...updates } : ex
      ),
    }));
  }, []);

  // Get AI exercise suggestions (for manual mode)
  const handleGetAISuggestions = useCallback(async () => {
    if (formData.muscleGroups.length === 0) {
      setError("Please select at least one muscle group first");
      return;
    }

    setIsLoadingAI(true);
    setError(null);

    workoutLogger.logAIGeneration('start', {
      component: 'CreateWorkoutModal',
      action: 'suggestExercises',
      muscleGroups: formData.muscleGroups,
      difficulty: formData.difficulty,
    });

    try {
      const response = await workoutsService.suggestExercises({
        muscleGroups: formData.muscleGroups,
        difficulty: formData.difficulty,
        equipment: DEFAULT_EQUIPMENT,
        duration: 45,
      });

      if (response.data?.exercises) {
        const suggestedExercises: Exercise[] = response.data.exercises.map((ex, index) => ({
          id: `ai-${Date.now()}-${index}`,
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          restSeconds: ex.restSeconds,
          muscleGroup: ex.muscleGroup,
          completed: false,
        }));

        setFormData(prev => ({
          ...prev,
          exercises: [...prev.exercises, ...suggestedExercises],
        }));
        setAIWorkoutTips(response.data.workoutTips || []);

        workoutLogger.logAIGeneration('success', {
          component: 'CreateWorkoutModal',
          action: 'suggestExercises',
          exerciseCount: suggestedExercises.length,
          provider: response.data.provider,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get AI suggestions';
      setError(errorMessage);

      workoutLogger.logAIGeneration('error', {
        component: 'CreateWorkoutModal',
        action: 'suggestExercises',
        error: errorMessage,
      });
    } finally {
      setIsLoadingAI(false);
    }
  }, [formData.muscleGroups, formData.difficulty]);

  // Generate AI workout plan
  const handleGenerateAIPlan = useCallback(async () => {
    if (!aiFormData.description.trim()) {
      setError("Please describe what kind of workout plan you want");
      return;
    }

    setIsLoadingAI(true);
    setError(null);
    setGeneratedSchedule(null);

    workoutLogger.logAIGeneration('start', {
      component: 'CreateWorkoutModal',
      action: 'generatePlan',
      description: aiFormData.description,
      durationWeeks: aiFormData.durationWeeks,
    });

    try {
      const response = await workoutsService.generateAIPlan({
        description: aiFormData.description,
        goalCategory: aiFormData.goalCategory,
        fitnessLevel: aiFormData.fitnessLevel,
        durationWeeks: aiFormData.durationWeeks,
        workoutsPerWeek: aiFormData.workoutsPerWeek,
        equipment: aiFormData.equipment,
        workoutLocation: aiFormData.workoutLocation,
        timePerWorkout: aiFormData.timePerWorkout,
        startDate: aiFormData.startDate,
      });

      if (response.data?.plan) {
        const plan = response.data.plan;
        setAIWorkoutTips(response.data.tips || []);

        // Store the generated schedule for preview
        const schedule = plan.weeklySchedule as Record<string, DayWorkout | null>;
        setGeneratedSchedule(schedule);

        workoutLogger.logAIGeneration('success', {
          component: 'CreateWorkoutModal',
          action: 'generatePlan',
          planId: plan.id,
          provider: response.data.provider,
        });

        // Extract today's exercises from weeklySchedule
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const todayKey = days[new Date().getDay()];
        
        // Get exercises from today's schedule or first available workout day
        let todayExercises: Exercise[] = [];
        if (schedule) {
          const todayWorkout = schedule[todayKey];
          if (todayWorkout?.exercises) {
            todayExercises = todayWorkout.exercises.map((ex, idx) => ({
              id: `${plan.id}-${todayKey}-${idx}`,
              name: ex.name,
              sets: ex.sets,
              reps: String(ex.reps),
              restSeconds: ex.restSeconds || 60,
              muscleGroup: ex.muscleGroup || 'Full Body',
              completed: false,
            }));
          } else {
            // Find first workout day if today is a rest day
            for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']) {
              const dayWorkout = schedule[day];
              if (dayWorkout?.exercises && dayWorkout.exercises.length > 0) {
                todayExercises = dayWorkout.exercises.map((ex, idx) => ({
                  id: `${plan.id}-${day}-${idx}`,
                  name: ex.name,
                  sets: ex.sets,
                  reps: String(ex.reps),
                  restSeconds: ex.restSeconds || 60,
                  muscleGroup: ex.muscleGroup || 'Full Body',
                  completed: false,
                }));
                break;
              }
            }
          }
        }

        // Create the workout plan object with extracted exercises
        const newWorkout: WorkoutPlan = {
          id: plan.id,
          name: plan.name || 'AI Generated Plan',
          description: plan.description,
          muscleGroups: plan.muscleGroups || [],
          exercises: todayExercises,
          duration: aiFormData.timePerWorkout,
          scheduledTime: formData.scheduledTime,
          difficulty: aiFormData.fitnessLevel,
          isCustom: false,
          status: 'active',
          weeklySchedule: schedule,
          durationWeeks: aiFormData.durationWeeks,
        };

        onWorkoutCreated(newWorkout);
        handleClose();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate AI plan';
      setError(errorMessage);

      workoutLogger.logAIGeneration('error', {
        component: 'CreateWorkoutModal',
        action: 'generatePlan',
        error: errorMessage,
      });
    } finally {
      setIsLoadingAI(false);
    }
  }, [aiFormData, formData.scheduledTime, handleClose, onWorkoutCreated]);

  // Create manual workout
  const handleCreateWorkout = useCallback(async () => {
    if (!formData.name.trim()) {
      setError("Workout name is required");
      return;
    }
    if (formData.exercises.length === 0) {
      setError("Please add at least one exercise");
      return;
    }
    if (!formData.selectedDays || formData.selectedDays.length === 0) {
      setError("Please select at least one workout day");
      return;
    }

    setIsCreating(true);
    setError(null);

    workoutLogger.info('Creating workout plan', {
      component: 'CreateWorkoutModal',
      name: formData.name,
      exerciseCount: formData.exercises.length,
      muscleGroups: formData.muscleGroups,
    });

    try {
      // Build weekly schedule from exercises - add to all selected workout days
      const weeklySchedule: Record<string, unknown> = {};
      
      // Use selectedDays from form data, or fallback to default mapping
      const selectedDays = formData.selectedDays && formData.selectedDays.length > 0
        ? formData.selectedDays
        : (() => {
            const dayMappings: Record<number, string[]> = {
              2: ['monday', 'thursday'],
              3: ['monday', 'wednesday', 'friday'],
              4: ['monday', 'tuesday', 'thursday', 'friday'],
              5: ['monday', 'tuesday', 'wednesday', 'friday', 'saturday'],
              6: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
            };
            const workoutsPerWeek = formData.workoutsPerWeek || 4;
            return dayMappings[workoutsPerWeek] || dayMappings[4];
          })();
      
      const workoutsPerWeek = selectedDays.length;
      
      selectedDays.forEach((day) => {
        weeklySchedule[day] = {
          dayOfWeek: day,
          workoutName: formData.name,
          focusArea: formData.muscleGroups.join(', ') || 'Full Body',
          exercises: formData.exercises.map((ex, idx) => ({
            id: `manual-${day}-${idx}`,
            name: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            restSeconds: ex.restSeconds || 60,
            muscleGroup: ex.muscleGroup,
          })),
          estimatedDuration: formData.exercises.length * 8,
          estimatedCalories: formData.exercises.length * 25,
        };
      });

      const response = await workoutsService.createPlan({
        name: formData.name,
        description: formData.description || undefined,
        fitnessLevel: formData.difficulty,
        scheduledTime: formData.scheduledTime,
        muscleGroups: formData.muscleGroups,
        exercises: formData.exercises,
        weeklySchedule,
        workoutsPerWeek: workoutsPerWeek,
        isActive: true,
        startDate: formData.startDate,
      });

      if (response.data?.plan) {
        const newWorkout: WorkoutPlan = {
          id: response.data.plan.id,
          name: response.data.plan.name,
          description: formData.description,
          muscleGroups: formData.muscleGroups,
          exercises: formData.exercises,
          duration: formData.exercises.length * 8,
          scheduledTime: formData.scheduledTime,
          difficulty: formData.difficulty,
          isCustom: true,
        };

        workoutLogger.logAPI('create', 'workout_plan', {
          success: true,
          planId: newWorkout.id,
          name: newWorkout.name,
        });

        onWorkoutCreated(newWorkout);
        handleClose();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create workout plan';
      setError(errorMessage);

      workoutLogger.logAPI('create', 'workout_plan', {
        success: false,
        error: errorMessage,
        name: formData.name,
      });

      // Create locally as fallback
      const fallbackWorkout: WorkoutPlan = {
        id: `local-${Date.now()}`,
        name: formData.name || "Custom Workout",
        description: formData.description,
        muscleGroups: formData.muscleGroups,
        exercises: formData.exercises,
        duration: formData.exercises.length * 8,
        scheduledTime: formData.scheduledTime,
        difficulty: formData.difficulty,
        isCustom: true,
      };

      onWorkoutCreated(fallbackWorkout);
      handleClose();
    } finally {
      setIsCreating(false);
    }
  }, [formData, handleClose, onWorkoutCreated]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-700">
            <h3 className="text-[16px] sm:text-xl font-bold text-white">Create New Workout</h3>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mode Toggle */}
          <div className="px-4 sm:px-6 pt-4">
            <div className="flex gap-2 p-1 bg-slate-800 rounded-xl">
              <button
                onClick={() => setMode("ai")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  mode === "ai"
                    ? "bg-sky-600 text-white shadow-lg shadow-sky-500/25 hover:bg-sky-500"
                    : "text-slate-400 hover:text-white hover:bg-slate-700"
                }`}
              >
                <Wand2 className="w-4 h-4" />
                AI Generate Plan
              </button>
              <button
                onClick={() => setMode("manual")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  mode === "manual"
                    ? "bg-sky-600 text-white shadow-lg shadow-sky-500/25 hover:bg-sky-500"
                    : "text-slate-400 hover:text-white hover:bg-slate-700"
                }`}
              >
                <Dumbbell className="w-4 h-4" />
                Manual Create
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="p-4 sm:p-6 overflow-y-auto max-h-[60vh] space-y-4 sm:space-y-6">
            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* AI Generation Mode */}
            {mode === "ai" && (
              <>
                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <Sparkles className="w-4 h-4 inline mr-2 text-violet-400" />
                    Describe Your Workout Plan
                  </label>
                  <textarea
                    value={aiFormData.description}
                    onChange={(e) => setAIFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="E.g., I want to build muscle and lose fat. Focus on upper body strength with some cardio. I'm a beginner with limited time..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 resize-none"
                  />
                </div>

                {/* Start Date */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <Calendar className="w-4 h-4 inline mr-2 text-violet-400" />
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={aiFormData.startDate}
                    onChange={(e) => setAIFormData(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-violet-500"
                  />
                </div>

                {/* Duration & Frequency Row */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-[13px] sm:text-sm font-medium text-slate-300 mb-1.5 sm:mb-2">
                      <Calendar className="w-4 h-4 inline mr-1.5 text-slate-400" />
                      Duration
                    </label>
                    <select
                      value={aiFormData.durationWeeks}
                      onChange={(e) => setAIFormData(prev => ({ ...prev, durationWeeks: parseInt(e.target.value) }))}
                      className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-violet-500"
                    >
                      {DURATION_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      <Dumbbell className="w-4 h-4 inline mr-2 text-slate-400" />
                      Workouts/Week
                    </label>
                    <select
                      value={aiFormData.workoutsPerWeek}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        const dayMappings: Record<number, string[]> = {
                          2: ['monday', 'thursday'],
                          3: ['monday', 'wednesday', 'friday'],
                          4: ['monday', 'tuesday', 'thursday', 'friday'],
                          5: ['monday', 'tuesday', 'wednesday', 'friday', 'saturday'],
                          6: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
                        };
                        setAIFormData(prev => ({
                          ...prev,
                          workoutsPerWeek: value,
                          selectedDays: dayMappings[value] || dayMappings[3],
                        }));
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-violet-500"
                    >
                      {WORKOUTS_PER_WEEK_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Select Workout Days for AI */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Select Workout Days ({aiFormData.selectedDays?.length || 0} selected)
                  </label>
                  <div className="grid grid-cols-7 gap-2">
                    {DAYS_OF_WEEK.map((day) => {
                      const isSelected = aiFormData.selectedDays?.includes(day) || false;
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            const currentDays = aiFormData.selectedDays || [];
                            const newDays = currentDays.includes(day)
                              ? currentDays.filter(d => d !== day)
                              : [...currentDays, day];
                            setAIFormData(prev => ({
                              ...prev,
                              selectedDays: newDays,
                              workoutsPerWeek: newDays.length > 0 ? newDays.length : prev.workoutsPerWeek,
                            }));
                          }}
                          className={`
                            px-3 py-2 rounded-xl border text-sm font-medium transition-all
                            ${isSelected
                              ? "bg-violet-500/20 border-violet-500 text-violet-400"
                              : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                            }
                          `}
                        >
                          {DAYS_LABELS[day]?.substring(0, 3) || day.substring(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Time & Fitness Level Row */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-[13px] sm:text-sm font-medium text-slate-300 mb-1.5 sm:mb-2">
                      <Clock className="w-4 h-4 inline mr-1.5 text-slate-400" />
                      Time/Workout
                    </label>
                    <select
                      value={aiFormData.timePerWorkout}
                      onChange={(e) => setAIFormData(prev => ({ ...prev, timePerWorkout: parseInt(e.target.value) }))}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-[13px] sm:text-sm focus:outline-none focus:border-violet-500"
                    >
                      {TIME_PER_WORKOUT_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[13px] sm:text-sm font-medium text-slate-300 mb-1.5 sm:mb-2">
                      <Target className="w-4 h-4 inline mr-1.5 text-slate-400" />
                      Fitness Level
                    </label>
                    <select
                      value={aiFormData.fitnessLevel}
                      onChange={(e) => setAIFormData(prev => ({ ...prev, fitnessLevel: e.target.value as "beginner" | "intermediate" | "advanced" }))}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-[13px] sm:text-sm focus:outline-none focus:border-violet-500"
                    >
                      {DIFFICULTY_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Goal Category */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Goal
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {GOAL_CATEGORY_OPTIONS.map((goal) => (
                      <button
                        key={goal.value}
                        onClick={() => setAIFormData(prev => ({ ...prev, goalCategory: goal.value }))}
                        className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[13px] sm:text-sm font-medium transition-all ${
                          aiFormData.goalCategory === goal.value
                            ? "bg-violet-500/20 border border-violet-500 text-violet-400"
                            : "bg-slate-800 border border-slate-700 text-slate-400 hover:border-slate-600"
                        }`}
                      >
                        {goal.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    <MapPin className="w-4 h-4 inline mr-2 text-slate-400" />
                    Workout Location
                  </label>
                  <div className="flex gap-2">
                    {LOCATION_OPTIONS.map((loc) => (
                      <button
                        key={loc.value}
                        onClick={() => setAIFormData(prev => ({ ...prev, workoutLocation: loc.value }))}
                        className={`flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border text-[13px] sm:text-sm font-medium transition-all ${
                          aiFormData.workoutLocation === loc.value
                            ? "bg-violet-500/20 border-violet-500 text-violet-400"
                            : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                        }`}
                      >
                        {loc.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Equipment */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Available Equipment
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {EQUIPMENT_OPTIONS.map((eq) => (
                      <button
                        key={eq.value}
                        onClick={() => toggleEquipment(eq.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          aiFormData.equipment.includes(eq.value)
                            ? "bg-violet-500/20 border border-violet-500 text-violet-400"
                            : "bg-slate-800 border border-slate-700 text-slate-400 hover:border-slate-600"
                        }`}
                      >
                        {aiFormData.equipment.includes(eq.value) && (
                          <Check className="w-3 h-3 inline mr-1" />
                        )}
                        {eq.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* AI Tips */}
                {aiWorkoutTips.length > 0 && (
                  <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/30">
                    <h4 className="text-sm font-medium text-violet-400 mb-2 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      AI Tips
                    </h4>
                    <ul className="space-y-1 text-sm text-slate-300">
                      {aiWorkoutTips.map((tip, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <ChevronRight className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" />
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Generated Schedule Preview */}
                {generatedSchedule && (
                  <div className="p-4 rounded-xl bg-slate-800 border border-slate-700">
                    <h4 className="text-sm font-medium text-white mb-3">Weekly Schedule Preview</h4>
                    <div className="grid grid-cols-7 gap-1">
                      {DAYS_OF_WEEK.map((day) => {
                        const workout = generatedSchedule[day];
                        return (
                          <div
                            key={day}
                            className={`p-2 rounded-lg text-center ${
                              workout ? "bg-violet-500/20" : "bg-slate-700/50"
                            }`}
                          >
                            <p className="text-xs text-slate-400">{DAYS_LABELS[day].slice(0, 3)}</p>
                            <p className={`text-xs font-medium truncate ${workout ? "text-violet-400" : "text-slate-500"}`}>
                              {workout ? workout.focusArea?.split(',')[0] || 'Workout' : 'Rest'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Manual Mode */}
            {mode === "manual" && (
              <>
                {/* Workout Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Workout Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Upper Body Power"
                    className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  />
                </div>

                {/* Start Date & Scheduled Time */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-[13px] sm:text-sm font-medium text-slate-300 mb-1.5 sm:mb-2">
                      <Calendar className="w-4 h-4 inline mr-1.5 text-orange-400" />
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-[13px] sm:text-sm focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[13px] sm:text-sm font-medium text-slate-300 mb-1.5 sm:mb-2">
                      <Clock className="w-4 h-4 inline mr-1.5 text-slate-400" />
                      Time
                    </label>
                    <input
                      type="time"
                      value={formData.scheduledTime}
                      onChange={(e) => setFormData(prev => ({ ...prev, scheduledTime: e.target.value }))}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-slate-800 border border-slate-700 text-white text-[13px] sm:text-sm focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                {/* Workouts Per Week */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Workouts Per Week
                  </label>
                  <select
                    value={formData.workoutsPerWeek || 4}
                    onChange={(e) => handleWorkoutsPerWeekChange(parseInt(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-orange-500"
                  >
                    {WORKOUTS_PER_WEEK_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Select Workout Days */}
                <div>
                  <label className="block text-[13px] sm:text-sm font-medium text-slate-300 mb-1.5 sm:mb-2">
                    Select Workout Days ({formData.selectedDays?.length || 0} selected)
                  </label>
                  <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                    {DAYS_OF_WEEK.map((day) => {
                      const isSelected = formData.selectedDays?.includes(day) || false;
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(day)}
                          className={`
                            px-1.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border text-[11px] sm:text-sm font-medium transition-all
                            ${isSelected
                              ? "bg-sky-600/20 border-sky-500 text-sky-400 hover:bg-sky-600/30"
                              : "bg-slate-800 border-slate-700 text-slate-400 hover:border-sky-500/50 hover:text-sky-400"
                            }
                          `}
                        >
                          {DAYS_LABELS[day]?.substring(0, 3) || day.substring(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                  {(!formData.selectedDays || formData.selectedDays.length === 0) && (
                    <p className="text-xs text-red-400 mt-2">Please select at least one day</p>
                  )}
                </div>

                {/* Difficulty */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Difficulty
                  </label>
                  <div className="flex gap-2">
                    {DIFFICULTY_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setFormData(prev => ({ ...prev, difficulty: option.value }))}
                        className={`flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border text-[13px] sm:text-sm font-medium transition-all ${
                          formData.difficulty === option.value
                            ? "bg-orange-500/20 border-orange-500 text-orange-400"
                            : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Muscle Groups */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Target Muscle Groups
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {MUSCLE_GROUPS.map((group) => (
                      <button
                        key={group}
                        onClick={() => toggleMuscleGroup(group)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          formData.muscleGroups.includes(group)
                            ? "bg-orange-500/20 border border-orange-500 text-orange-400"
                            : "bg-slate-800 border border-slate-700 text-slate-400 hover:border-slate-600"
                        }`}
                      >
                        {group}
                      </button>
                    ))}
                  </div>
                </div>

                {/* AI Suggestions Button */}
                {formData.muscleGroups.length > 0 && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleGetAISuggestions}
                      disabled={isLoadingAI}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500/20 to-purple-500/20 border border-violet-500/30 text-violet-400 hover:bg-violet-500/30 transition-colors disabled:opacity-50"
                    >
                      {isLoadingAI ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      {isLoadingAI ? 'Getting AI Suggestions...' : 'Get AI Exercise Suggestions'}
                    </button>
                    {aiWorkoutTips.length > 0 && (
                      <div className="flex-1 text-xs text-slate-400">
                        <span className="text-violet-400">AI Tip:</span> {aiWorkoutTips[0]}
                      </div>
                    )}
                  </div>
                )}

                {/* Exercises */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Exercises ({formData.exercises.length})
                  </label>

                  {/* Search from Exercise Library */}
                  <div className="mb-4">
                    <ExerciseSearchInput
                      value={exerciseSearchQuery}
                      onChange={setExerciseSearchQuery}
                      onExerciseSelect={addExerciseFromSearch}
                      placeholder="Search 1,500+ exercises..."
                    />
                  </div>

                  {/* Added Exercises */}
                  {formData.exercises.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {formData.exercises.map((exercise) => (
                        <div
                          key={exercise.id}
                          className="flex items-center gap-3 p-3 rounded-xl bg-slate-800 border border-slate-700"
                        >
                          {/* Thumbnail */}
                          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-slate-700">
                            {exercise.thumbnailUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={exercise.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Dumbbell className="w-4 h-4 text-slate-500" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-white text-[13px] sm:text-sm block truncate mb-1">{exercise.name}</span>
                            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                              <input
                                type="number"
                                value={exercise.sets}
                                onChange={(e) => updateExercise(exercise.id, { sets: parseInt(e.target.value) || 0 })}
                                className="px-2 py-1 rounded bg-slate-700 text-white text-[13px] sm:text-sm w-full"
                                placeholder="Sets"
                              />
                              <input
                                type="text"
                                value={exercise.reps}
                                onChange={(e) => updateExercise(exercise.id, { reps: e.target.value })}
                                className="px-2 py-1 rounded bg-slate-700 text-white text-[13px] sm:text-sm w-full"
                                placeholder="Reps"
                              />
                              <input
                                type="number"
                                value={exercise.restSeconds || ""}
                                onChange={(e) => updateExercise(exercise.id, { restSeconds: parseInt(e.target.value) || 60 })}
                                className="px-2 py-1 rounded bg-slate-700 text-white text-[13px] sm:text-sm w-full"
                                placeholder="Rest"
                              />
                            </div>
                          </div>
                          <button
                            onClick={() => removeExercise(exercise.id)}
                            className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Quick Add from Preset */}
                  {formData.muscleGroups.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-400 font-medium">Quick Add</p>
                      {formData.muscleGroups.map((group) => (
                        <div key={group}>
                          <p className="text-xs text-slate-500 mb-2">{group}</p>
                          <div className="flex flex-wrap gap-2">
                            {PRESET_EXERCISES[group]?.map((exercise) => (
                              <button
                                key={exercise}
                                onClick={() => addExercise(exercise, group)}
                                disabled={formData.exercises.some(e => e.name === exercise)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                  formData.exercises.some(e => e.name === exercise)
                                    ? "bg-slate-800 text-slate-600 cursor-not-allowed"
                                    : "bg-slate-800 border border-slate-700 text-slate-300 hover:border-orange-500 hover:text-orange-400"
                                }`}
                              >
                                + {exercise}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2 sm:gap-3 p-4 sm:p-6 border-t border-slate-700">
            <button
              onClick={handleClose}
              className="px-3 sm:px-4 py-2 rounded-xl text-slate-400 hover:text-white transition-colors text-[13px] sm:text-sm"
            >
              Cancel
            </button>

            {mode === "ai" ? (
              <button
                onClick={handleGenerateAIPlan}
                disabled={!aiFormData.description.trim() || isLoadingAI}
                className="flex items-center gap-2 px-4 sm:px-6 py-2 rounded-xl bg-sky-600 text-white font-medium text-[13px] sm:text-sm hover:bg-sky-500 hover:shadow-lg hover:shadow-sky-500/25 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingAI ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4" />
                )}
                {isLoadingAI ? 'Generating...' : 'Generate AI Plan'}
              </button>
            ) : (
              <button
                onClick={handleCreateWorkout}
                disabled={!formData.name || formData.exercises.length === 0 || isCreating}
                className="flex items-center gap-2 px-4 sm:px-6 py-2 rounded-xl bg-sky-600 text-white font-medium text-[13px] sm:text-sm hover:bg-sky-500 hover:shadow-lg hover:shadow-sky-500/25 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {isCreating ? 'Creating...' : 'Create Workout'}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
