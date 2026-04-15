'use client';

/**
 * @file Plans Tab Constants and Configuration
 */

import {
  Play,
  Pause,
  Archive,
  CheckCircle2,
  Settings2,
  Dumbbell,
  Utensils,
  Brain,
  Moon,
  Zap,
  Heart,
  BookOpen,
  Coffee,
} from 'lucide-react';
import type { PlanStatus, HealthPillar, ActivityType, GoalCategory } from './types';

// Status configuration
export const statusConfig: Record<
  PlanStatus,
  { label: string; color: string; bgColor: string; icon: React.ReactNode }
> = {
  draft: {
    label: 'Draft',
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/20',
    icon: <Settings2 className="w-3.5 h-3.5" />,
  },
  active: {
    label: 'Active',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    icon: <Play className="w-3.5 h-3.5" />,
  },
  paused: {
    label: 'Paused',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    icon: <Pause className="w-3.5 h-3.5" />,
  },
  completed: {
    label: 'Completed',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  archived: {
    label: 'Archived',
    color: 'text-slate-500',
    bgColor: 'bg-slate-600/20',
    icon: <Archive className="w-3.5 h-3.5" />,
  },
};

// Pillar configuration
export const pillarConfig: Record<
  HealthPillar,
  { label: string; icon: React.ReactNode; gradient: string }
> = {
  fitness: {
    label: 'Fitness',
    icon: <Dumbbell className="w-4 h-4" />,
    gradient: 'from-orange-500 to-red-500',
  },
  nutrition: {
    label: 'Nutrition',
    icon: <Utensils className="w-4 h-4" />,
    gradient: 'from-green-500 to-emerald-500',
  },
  wellbeing: {
    label: 'Wellbeing',
    icon: <Brain className="w-4 h-4" />,
    gradient: 'from-purple-500 to-pink-500',
  },
};

// Activity type configuration
export const activityTypeConfig: Record<
  ActivityType,
  { icon: React.ReactNode; color: string; bgColor: string }
> = {
  workout: {
    icon: <Dumbbell className="w-4 h-4" />,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
  },
  meal: {
    icon: <Utensils className="w-4 h-4" />,
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
  },
  sleep_routine: {
    icon: <Moon className="w-4 h-4" />,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/20',
  },
  mindfulness: {
    icon: <Brain className="w-4 h-4" />,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
  },
  habit: {
    icon: <Zap className="w-4 h-4" />,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
  },
  check_in: {
    icon: <Heart className="w-4 h-4" />,
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/20',
  },
  reflection: {
    icon: <BookOpen className="w-4 h-4" />,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
  },
  learning: {
    icon: <Coffee className="w-4 h-4" />,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
  },
};

// Goal category labels
export const goalCategoryLabels: Record<GoalCategory, string> = {
  weight_loss: 'Weight Loss',
  muscle_building: 'Muscle Building',
  sleep_improvement: 'Sleep Improvement',
  stress_wellness: 'Stress & Wellness',
  energy_productivity: 'Energy & Productivity',
  event_training: 'Event Training',
  health_condition: 'Health Condition',
  habit_building: 'Habit Building',
  overall_optimization: 'Overall Optimization',
  custom: 'Custom Goal',
};

// Days of week
export const daysOfWeek = [
  { id: 'monday', label: 'Mon' },
  { id: 'tuesday', label: 'Tue' },
  { id: 'wednesday', label: 'Wed' },
  { id: 'thursday', label: 'Thu' },
  { id: 'friday', label: 'Fri' },
  { id: 'saturday', label: 'Sat' },
  { id: 'sunday', label: 'Sun' },
];

// Filter tabs
export const filterTabs: { id: PlanStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All Plans' },
  { id: 'active', label: 'Active' },
  { id: 'paused', label: 'Paused' },
  { id: 'completed', label: 'Completed' },
  { id: 'archived', label: 'Archived' },
];
