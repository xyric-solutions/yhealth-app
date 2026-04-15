/**
 * @file Deep Assessment Constants
 */

import type { AICoachGoalCategory } from './types';

export const TARGET_USER_MESSAGES = 6;
export const TYPING_INDICATOR_MIN_DELAY = 500;

// Map onboarding goal to API goal format
export const GOAL_MAP: Record<string, AICoachGoalCategory> = {
  weight_loss: 'weight_loss',
  muscle_building: 'muscle_building',
  sleep_improvement: 'sleep_improvement',
  stress_wellness: 'stress_wellness',
  energy_productivity: 'energy_productivity',
  event_training: 'event_training',
  health_condition: 'health_condition',
  habit_building: 'habit_building',
  overall_optimization: 'overall_optimization',
  custom: 'custom',
};
