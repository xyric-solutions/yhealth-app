'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronRight,
  Plus,
  Sparkles,
  Calendar,
  Target,
  X,
  Check,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api-client';
import type {
  CreatePlanFormData,
  TaskInput,
  HealthPillar,
  ActivityType,
} from './types';
import {
  pillarConfig,
  activityTypeConfig,
  daysOfWeek,
} from './constants';

interface CreatePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreatePlanModal({ isOpen, onClose, onSuccess }: CreatePlanModalProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [formData, setFormData] = useState<CreatePlanFormData>({
    name: '',
    description: '',
    pillar: 'fitness',
    goalCategory: 'habit_building',
    durationWeeks: 4,
    tasks: [],
    useAI: false,
    aiGoalDescription: '',
  });

  const [newTask, setNewTask] = useState<TaskInput>({
    id: '',
    title: '',
    description: '',
    type: 'habit',
    daysOfWeek: ['monday', 'wednesday', 'friday'],
    preferredTime: '09:00',
    duration: 30,
  });

  const resetForm = () => {
    setStep(1);
    setFormData({
      name: '',
      description: '',
      pillar: 'fitness',
      goalCategory: 'habit_building',
      durationWeeks: 4,
      tasks: [],
      useAI: false,
      aiGoalDescription: '',
    });
    setNewTask({
      id: '',
      title: '',
      description: '',
      type: 'habit',
      daysOfWeek: ['monday', 'wednesday', 'friday'],
      preferredTime: '09:00',
      duration: 30,
    });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const addTask = () => {
    if (!newTask.title.trim()) return;

    setFormData((prev) => ({
      ...prev,
      tasks: [
        ...prev.tasks,
        { ...newTask, id: `task_${Date.now()}_${Math.random().toString(36).slice(2)}` },
      ],
    }));

    setNewTask({
      id: '',
      title: '',
      description: '',
      type: 'habit',
      daysOfWeek: ['monday', 'wednesday', 'friday'],
      preferredTime: '09:00',
      duration: 30,
    });
  };

  const removeTask = (taskId: string) => {
    setFormData((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((t) => t.id !== taskId),
    }));
  };

  const toggleDay = (day: string) => {
    setNewTask((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day],
    }));
  };

  const generateAITasks = async () => {
    if (!formData.aiGoalDescription?.trim()) return;
    setIsGeneratingAI(true);

    try {
      const response = await api.post<{
        tasks: TaskInput[];
        planName: string;
        planDescription: string;
      }>('/plans/generate-tasks', {
        goalDescription: formData.aiGoalDescription,
        pillar: formData.pillar,
        goalCategory: formData.goalCategory,
        durationWeeks: formData.durationWeeks,
      });

      if (response.success && response.data) {
        setFormData((prev) => ({
          ...prev,
          name: response.data?.planName || prev.name,
          description: response.data?.planDescription || prev.description,
          tasks: [...prev.tasks, ...(response.data?.tasks || [])],
        }));
        setStep(2);
      }
    } catch (err) {
      console.error('Failed to generate AI tasks:', err);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || formData.tasks.length === 0) return;
    setIsSubmitting(true);

    try {
      const activities = formData.tasks.map((task) => ({
        id: task.id,
        type: task.type,
        title: task.title,
        description: task.description,
        daysOfWeek: task.daysOfWeek,
        preferredTime: task.preferredTime,
        duration: task.duration,
      }));

      await api.post('/plans/create-manual', {
        name: formData.name,
        description: formData.description,
        pillar: formData.pillar,
        goalCategory: formData.goalCategory,
        durationWeeks: formData.durationWeeks,
        activities,
      });

      handleClose();
      onSuccess();
    } catch (err) {
      console.error('Failed to create plan:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={handleClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-slate-900 border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold text-white">Create Custom Plan</h2>
            <p className="text-sm text-slate-400 mt-1">
              Step {step} of 3: {step === 1 ? 'Plan Details' : step === 2 ? 'Add Tasks' : 'Review'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Step 1: Plan Details */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Use AI Toggle */}
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-white">Use AI to Generate Tasks</h4>
                  <p className="text-sm text-slate-400">
                    Describe your goal and AI will create relevant tasks
                  </p>
                </div>
                <button
                  onClick={() => setFormData((prev) => ({ ...prev, useAI: !prev.useAI }))}
                  className={`w-12 h-7 rounded-full transition-colors ${
                    formData.useAI ? 'bg-purple-500' : 'bg-slate-700'
                  }`}
                >
                  <motion.div
                    animate={{ x: formData.useAI ? 22 : 2 }}
                    className="w-5 h-5 rounded-full bg-white"
                  />
                </button>
              </div>

              {formData.useAI && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Describe Your Goal
                  </label>
                  <textarea
                    value={formData.aiGoalDescription}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, aiGoalDescription: e.target.value }))
                    }
                    placeholder="e.g., I want to lose 10kg in 3 months by exercising regularly and eating healthier..."
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 resize-none h-24"
                  />
                </div>
              )}

              {/* Plan Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Plan Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., My Fitness Journey"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Describe what you want to achieve..."
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 resize-none h-20"
                />
              </div>

              {/* Pillar & Category */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Health Pillar
                  </label>
                  <select
                    value={formData.pillar}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, pillar: e.target.value as HealthPillar }))
                    }
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50"
                  >
                    <option value="fitness">Fitness</option>
                    <option value="nutrition">Nutrition</option>
                    <option value="wellbeing">Wellbeing</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Duration</label>
                  <select
                    value={formData.durationWeeks}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, durationWeeks: parseInt(e.target.value) }))
                    }
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50"
                  >
                    <option value={2}>2 Weeks</option>
                    <option value={4}>4 Weeks</option>
                    <option value={8}>8 Weeks</option>
                    <option value={12}>12 Weeks</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Add Tasks */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Empty State Hint */}
              {formData.tasks.length === 0 && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <p className="text-sm text-amber-200">
                    Add at least one task to continue. Tasks define the daily activities for your plan.
                  </p>
                </div>
              )}

              {/* Existing Tasks */}
              {formData.tasks.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-slate-300">
                    Added Tasks ({formData.tasks.length})
                  </h4>
                  {formData.tasks.map((task) => {
                    const config = activityTypeConfig[task.type] || activityTypeConfig.habit;
                    return (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl"
                      >
                        <div className={`w-8 h-8 rounded-lg ${config.bgColor} flex items-center justify-center ${config.color}`}>
                          {config.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white truncate">{task.title}</p>
                          <p className="text-xs text-slate-400">
                            {task.daysOfWeek.length} days/week at {task.preferredTime}
                          </p>
                        </div>
                        <button
                          onClick={() => removeTask(task.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* New Task Form */}
              <div className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-4">
                <h4 className="text-sm font-medium text-slate-300">Add New Task</h4>

                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="text"
                    value={newTask.title}
                    onChange={(e) => setNewTask((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Task title"
                    className="col-span-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
                  />

                  <select
                    value={newTask.type}
                    onChange={(e) =>
                      setNewTask((prev) => ({ ...prev, type: e.target.value as ActivityType }))
                    }
                    className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50"
                  >
                    <option value="workout">Workout</option>
                    <option value="meal">Meal</option>
                    <option value="sleep_routine">Sleep Routine</option>
                    <option value="mindfulness">Mindfulness</option>
                    <option value="habit">Habit</option>
                    <option value="check_in">Check-in</option>
                    <option value="reflection">Reflection</option>
                    <option value="learning">Learning</option>
                  </select>

                  <input
                    type="time"
                    value={newTask.preferredTime}
                    onChange={(e) =>
                      setNewTask((prev) => ({ ...prev, preferredTime: e.target.value }))
                    }
                    className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-cyan-500/50"
                  />
                </div>

                {/* Days Selection */}
                <div>
                  <p className="text-xs text-slate-400 mb-2">Days of Week</p>
                  <div className="flex gap-2">
                    {daysOfWeek.map((day) => (
                      <button
                        key={day.id}
                        onClick={() => toggleDay(day.id)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          newTask.daysOfWeek.includes(day.id)
                            ? 'bg-cyan-500 text-white'
                            : 'bg-white/5 text-slate-400 hover:bg-white/10'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={addTask}
                  disabled={!newTask.title.trim() || newTask.daysOfWeek.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-500 text-white font-medium rounded-xl hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Task
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="p-4 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-white/10 rounded-xl">
                <h3 className="text-lg font-semibold text-white">{formData.name}</h3>
                <p className="text-sm text-slate-400 mt-1">
                  {formData.description || 'No description'}
                </p>
                <div className="flex items-center gap-4 mt-4">
                  <span className="flex items-center gap-1.5 text-sm text-slate-300">
                    {pillarConfig[formData.pillar].icon}
                    {pillarConfig[formData.pillar].label}
                  </span>
                  <span className="flex items-center gap-1.5 text-sm text-slate-300">
                    <Calendar className="w-4 h-4" />
                    {formData.durationWeeks} weeks
                  </span>
                  <span className="flex items-center gap-1.5 text-sm text-slate-300">
                    <Target className="w-4 h-4" />
                    {formData.tasks.length} tasks
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-slate-300">Tasks</h4>
                {formData.tasks.map((task) => {
                  const config = activityTypeConfig[task.type] || activityTypeConfig.habit;
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl"
                    >
                      <div
                        className={`w-8 h-8 rounded-lg ${config.bgColor} flex items-center justify-center ${config.color}`}
                      >
                        {config.icon}
                      </div>
                      <div className="flex-1">
                        <p className="text-white">{task.title}</p>
                        <p className="text-xs text-slate-400">
                          {task.daysOfWeek.map((d) => d.slice(0, 3)).join(', ')} at{' '}
                          {task.preferredTime}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-white/10">
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : handleClose())}
            className="px-4 py-2.5 text-slate-400 hover:text-white transition-colors"
          >
            {step > 1 ? 'Back' : 'Cancel'}
          </button>

          <div className="flex items-center gap-3">
            {step === 1 && formData.useAI && (
              <button
                onClick={generateAITasks}
                disabled={!formData.aiGoalDescription?.trim() || isGeneratingAI}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {isGeneratingAI ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Tasks with AI
                  </>
                )}
              </button>
            )}

            {step < 3 && (
              <button
                onClick={() => setStep(step + 1)}
                disabled={
                  (step === 1 && !formData.name.trim()) ||
                  (step === 2 && formData.tasks.length === 0)
                }
                className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 text-white font-medium rounded-xl hover:bg-cyan-600 disabled:opacity-50 transition-colors"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {step === 3 && (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || formData.tasks.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Create Plan
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
