/**
 * Integration Constants
 */

import type { Integration } from '@/src/types';

// Integration logos/icons with brand colors
export const INTEGRATION_BRANDING: Record<
  string,
  { bg: string; text: string; border: string; glow: string; logo: string }
> = {
  whoop: {
    bg: 'bg-yellow-500/15',
    text: 'text-yellow-400',
    border: 'border-yellow-500/40',
    glow: 'shadow-yellow-500/20',
    logo: 'W',
  },
  apple_health: {
    bg: 'bg-red-500/15',
    text: 'text-red-400',
    border: 'border-red-500/40',
    glow: 'shadow-red-500/20',
    logo: '♥',
  },
  fitbit: {
    bg: 'bg-cyan-500/15',
    text: 'text-cyan-400',
    border: 'border-cyan-500/40',
    glow: 'shadow-cyan-500/20',
    logo: 'F',
  },
  garmin: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-400',
    border: 'border-blue-500/40',
    glow: 'shadow-blue-500/20',
    logo: 'G',
  },
  oura: {
    bg: 'bg-purple-500/15',
    text: 'text-purple-400',
    border: 'border-purple-500/40',
    glow: 'shadow-purple-500/20',
    logo: 'O',
  },
  google_fit: {
    bg: 'bg-green-500/15',
    text: 'text-green-400',
    border: 'border-green-500/40',
    glow: 'shadow-green-500/20',
    logo: 'G',
  },
  myfitnesspal: {
    bg: 'bg-blue-600/15',
    text: 'text-blue-400',
    border: 'border-blue-600/40',
    glow: 'shadow-blue-600/20',
    logo: 'M',
  },
  strava: {
    bg: 'bg-orange-500/15',
    text: 'text-orange-400',
    border: 'border-orange-500/40',
    glow: 'shadow-orange-500/20',
    logo: 'S',
  },
  samsung_health: {
    bg: 'bg-indigo-500/15',
    text: 'text-indigo-400',
    border: 'border-indigo-500/40',
    glow: 'shadow-indigo-500/20',
    logo: 'S',
  },
  cronometer: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/40',
    glow: 'shadow-emerald-500/20',
    logo: 'C',
  },
};

// Available integrations
export const AVAILABLE_INTEGRATIONS: Integration[] = [
  {
    id: 'whoop',
    name: 'WHOOP',
    type: 'wearable',
    icon: 'W',
    connected: false,
    dataTypes: ['HRV', 'Sleep', 'Strain', 'Recovery'],
  },
  {
    id: 'apple_health',
    name: 'Apple Health',
    type: 'platform',
    icon: 'AH',
    connected: false,
    dataTypes: ['Steps', 'Heart Rate', 'Sleep', 'Workouts'],
  },
  {
    id: 'fitbit',
    name: 'Fitbit',
    type: 'wearable',
    icon: 'FB',
    connected: false,
    dataTypes: ['Steps', 'Sleep', 'Heart Rate', 'Activity'],
  },
  {
    id: 'garmin',
    name: 'Garmin',
    type: 'wearable',
    icon: 'G',
    connected: false,
    dataTypes: ['Training', 'Heart Rate', 'Sleep', 'VO2 Max'],
  },
  {
    id: 'oura',
    name: 'Oura Ring',
    type: 'wearable',
    icon: 'O',
    connected: false,
    dataTypes: ['Sleep', 'Readiness', 'Activity', 'HRV'],
  },
  {
    id: 'google_fit',
    name: 'Google Fit',
    type: 'platform',
    icon: 'GF',
    connected: false,
    dataTypes: ['Steps', 'Heart Rate', 'Workouts', 'Sleep'],
  },
  {
    id: 'myfitnesspal',
    name: 'MyFitnessPal',
    type: 'app',
    icon: 'MFP',
    connected: false,
    dataTypes: ['Nutrition', 'Calories', 'Macros', 'Meals'],
  },
  {
    id: 'strava',
    name: 'Strava',
    type: 'app',
    icon: 'S',
    connected: false,
    dataTypes: ['Running', 'Cycling', 'Swimming', 'GPS'],
  },
];

// Animation variants
export const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

export const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 100,
      damping: 15,
    },
  },
};
