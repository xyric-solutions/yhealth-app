'use client';

/**
 * @file Overview Tab Constants and Configuration
 */

import {

  Dumbbell,
  Utensils,
  Moon,
  Brain,
  Zap,
  Heart,
  Sparkles,
  Target,
} from 'lucide-react';

// Activity icons mapping
export const activityIcons: Record<string, React.ReactNode> = {
  workout: <Dumbbell className="w-5 h-5" />,
  meal: <Utensils className="w-5 h-5" />,
  sleep_routine: <Moon className="w-5 h-5" />,
  mindfulness: <Brain className="w-5 h-5" />,
  habit: <Zap className="w-5 h-5" />,
  check_in: <Heart className="w-5 h-5" />,
  reflection: <Sparkles className="w-5 h-5" />,
  learning: <Target className="w-5 h-5" />,
};

// Activity color gradients
export const activityColors: Record<string, string> = {
  workout: 'from-orange-500 to-red-500',
  meal: 'from-green-500 to-emerald-500',
  sleep_routine: 'from-indigo-500 to-purple-500',
  mindfulness: 'from-cyan-500 to-blue-500',
  habit: 'from-yellow-500 to-amber-500',
  check_in: 'from-pink-500 to-rose-500',
  reflection: 'from-violet-500 to-purple-500',
  learning: 'from-blue-500 to-cyan-500',
};

// Quick action buttons configuration
export const quickActions = [
  {
    type: 'workout' as const,
    icon: <Dumbbell className="w-5 h-5" />,
    label: 'Log Workout',
    color: 'from-orange-500/20 to-red-500/20',
  },
  {
    type: 'meal' as const,
    icon: <Utensils className="w-5 h-5" />,
    label: 'Log Meal',
    color: 'from-green-500/20 to-emerald-500/20',
  },
  {
    type: 'mindfulness' as const,
    icon: <Brain className="w-5 h-5" />,
    label: 'Mindfulness',
    color: 'from-cyan-500/20 to-blue-500/20',
  },
  {
    type: 'sleep' as const,
    icon: <Moon className="w-5 h-5" />,
    label: 'Log Sleep',
    color: 'from-indigo-500/20 to-purple-500/20',
  },
];

// Helper function to format time from 24-hour to 12-hour AM/PM format
export function formatTime(time: string): string {
  if (!time || time === 'all day') return 'all day';

  const [hoursStr, minutesStr] = time.split(':');
  const hours = parseInt(hoursStr, 10);
  const minutes = minutesStr || '00';

  if (isNaN(hours)) return time;

  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;

  return `${hours12}:${minutes} ${period}`;
}
