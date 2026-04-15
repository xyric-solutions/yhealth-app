/**
 * Plan Generation Constants
 */

import {
  TrendingUp,
  Brain,
  Utensils,
  Dumbbell,
  Moon,
  Calendar,
} from 'lucide-react';
import type { GenerationPhase, GeneratedPlan } from './types';

export const GENERATION_PHASES: GenerationPhase[] = [
  {
    id: 'analyzing',
    label: 'Analyzing your goals',
    icon: <TrendingUp className="w-5 h-5" />,
    duration: 2000,
  },
  {
    id: 'reviewing',
    label: 'Reviewing your assessment',
    icon: <Brain className="w-5 h-5" />,
    duration: 2500,
  },
  {
    id: 'nutrition',
    label: 'Calculating nutrition targets',
    icon: <Utensils className="w-5 h-5" />,
    duration: 2000,
  },
  {
    id: 'workout',
    label: 'Designing workout plan',
    icon: <Dumbbell className="w-5 h-5" />,
    duration: 2500,
  },
  {
    id: 'wellbeing',
    label: 'Adding wellbeing strategies',
    icon: <Moon className="w-5 h-5" />,
    duration: 2000,
  },
  {
    id: 'finalizing',
    label: 'Finalizing Week 1 actions',
    icon: <Calendar className="w-5 h-5" />,
    duration: 1500,
  },
];

export const MOCK_PLAN: GeneratedPlan = {
  name: 'Your Personalized Health Plan',
  description: 'A 16-week journey to achieve your goals',
  activities: [
    {
      id: '1',
      type: 'workout',
      title: 'Strength Training',
      description: 'Full body workout focusing on compound movements',
      days: ['Monday', 'Wednesday', 'Friday'],
      time: '7:00 AM',
      icon: <Dumbbell className="w-5 h-5" />,
    },
    {
      id: '2',
      type: 'nutrition',
      title: 'Meal Logging',
      description: 'Track your daily food intake',
      days: ['Daily'],
      time: 'After meals',
      icon: <Utensils className="w-5 h-5" />,
    },
    {
      id: '3',
      type: 'wellbeing',
      title: 'Evening Wind-Down',
      description: 'Prepare for quality sleep',
      days: ['Daily'],
      time: '9:30 PM',
      icon: <Moon className="w-5 h-5" />,
    },
    {
      id: '4',
      type: 'check-in',
      title: 'Daily Check-in',
      description: 'Rate your energy and mood',
      days: ['Daily'],
      time: '9:00 AM',
      icon: <Brain className="w-5 h-5" />,
    },
  ],
  weeklyFocuses: [
    { week: 1, theme: 'Foundation', focus: 'Building habits and establishing baseline routines' },
    { week: 2, theme: 'Momentum', focus: 'Increasing consistency and tracking progress' },
    { week: 3, theme: 'Adaptation', focus: 'Fine-tuning based on your feedback' },
    { week: 4, theme: 'Growth', focus: 'Progressive challenge and celebrating wins' },
  ],
  milestones: [
    { day: 30, title: 'First Month Complete', description: 'Review progress and adjust' },
    { day: 60, title: 'Halfway There', description: 'Major milestone assessment' },
    { day: 90, title: 'Three Months Strong', description: 'Habit formation achieved' },
  ],
};

export const COACH_MESSAGES: Record<string, string> = {
  supportive:
    "I'm so excited to be on this journey with you! This plan is designed just for you, and I'll be here every step of the way.",
  direct:
    'Your plan is ready. Follow it consistently and you\'ll see results. Let\'s get to work.',
  analytical:
    "I've analyzed your goals and data to create this optimized plan. The activities are sequenced for maximum effectiveness.",
  motivational:
    "This is YOUR time! I've created an amazing plan that's going to transform your life. Let's crush these goals together!",
};
