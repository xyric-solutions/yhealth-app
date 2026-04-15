/**
 * @file Correlation Engine
 * @description Cross-pillar correlation analysis for wellbeing data
 */

import { calculateCorrelation } from './pattern-detection.js';

/**
 * Correlation result between two metrics
 */
export interface CorrelationResult {
  metric1: string;
  metric2: string;
  correlation: number; // -1 to 1
  dataPoints: number;
  confidence: 'high' | 'medium' | 'low';
  insight?: string;
}

/**
 * Calculate correlation between habit completion and mood
 */
export function correlateHabitWithMood(
  habitCompletions: boolean[],
  moodScores: number[],
  habitName: string
): CorrelationResult | null {
  if (habitCompletions.length !== moodScores.length || habitCompletions.length < 7) {
    return null; // Need at least 7 data points
  }

  // Convert boolean to number for correlation
  const habitValues = habitCompletions.map((c) => (c ? 1 : 0));

  const correlation = calculateCorrelation(habitValues, moodScores);

  const confidence =
    habitCompletions.length >= 30 ? 'high' : habitCompletions.length >= 14 ? 'medium' : 'low';

  let insight: string | undefined;
  if (Math.abs(correlation) > 0.3) {
    const percentage = Math.round(Math.abs(correlation) * 100);
    const direction = correlation > 0 ? 'better' : 'worse';
    insight = `Your mood is ${percentage}% ${direction} on days you ${habitName}`;
  }

  return {
    metric1: `Habit: ${habitName}`,
    metric2: 'Mood Score',
    correlation,
    dataPoints: habitCompletions.length,
    confidence,
    insight,
  };
}

/**
 * Calculate correlation between energy and another metric
 */
export function correlateEnergyWithMetric(
  energyRatings: number[],
  otherMetric: number[],
  metricName: string
): CorrelationResult | null {
  if (energyRatings.length !== otherMetric.length || energyRatings.length < 7) {
    return null;
  }

  const correlation = calculateCorrelation(energyRatings, otherMetric);

  const confidence =
    energyRatings.length >= 30 ? 'high' : energyRatings.length >= 14 ? 'medium' : 'low';

  let insight: string | undefined;
  if (Math.abs(correlation) > 0.3) {
    const percentage = Math.round(Math.abs(correlation) * 100);
    const direction = correlation > 0 ? 'higher' : 'lower';
    insight = `Energy is ${percentage}% ${direction} when ${metricName} is ${direction}`;
  }

  return {
    metric1: 'Energy Level',
    metric2: metricName,
    correlation,
    dataPoints: energyRatings.length,
    confidence,
    insight,
  };
}

/**
 * Calculate correlation between stress and sleep quality
 */
export function correlateStressWithSleep(
  stressRatings: number[],
  sleepScores: number[]
): CorrelationResult | null {
  if (stressRatings.length !== sleepScores.length || stressRatings.length < 7) {
    return null;
  }

  // Invert stress for correlation (higher stress should correlate with lower sleep)
  const invertedStress = stressRatings.map((s) => 11 - s); // Invert 1-10 scale

  const correlation = calculateCorrelation(invertedStress, sleepScores);

  const confidence =
    stressRatings.length >= 30 ? 'high' : stressRatings.length >= 14 ? 'medium' : 'low';

  let insight: string | undefined;
  if (Math.abs(correlation) > 0.3) {
    const percentage = Math.round(Math.abs(correlation) * 100);
    insight = `Sleep quality is ${percentage}% better when stress is lower`;
  }

  return {
    metric1: 'Stress Level',
    metric2: 'Sleep Quality',
    correlation: -correlation, // Negate because we inverted stress
    dataPoints: stressRatings.length,
    confidence,
    insight,
  };
}

