/**
 * @file Pose angle extraction, scoring, and fallback target definitions
 * @description Client-side utilities for extracting joint angles from MediaPipe
 *              landmarks, scoring them against target poses, and providing
 *              fallback pose definitions when the server is unavailable.
 */

import type { PoseTargets, JointAngles } from '@shared/types/domain/yoga';
import { LANDMARK } from './landmarks';
import { calcAngle } from './calcAngle';

// ============================================
// JOINT EXTRACTION MAP
// ============================================

/**
 * Defines how to compute each joint angle from MediaPipe landmarks.
 * Each entry maps a joint name to a triplet [pointA, vertex, pointC]
 * where the angle is measured at the vertex.
 */
export const JOINT_EXTRACTION_MAP: Record<string, [number, number, number]> = {
  left_elbow: [LANDMARK.LEFT_SHOULDER, LANDMARK.LEFT_ELBOW, LANDMARK.LEFT_WRIST],
  right_elbow: [LANDMARK.RIGHT_SHOULDER, LANDMARK.RIGHT_ELBOW, LANDMARK.RIGHT_WRIST],
  left_knee: [LANDMARK.LEFT_HIP, LANDMARK.LEFT_KNEE, LANDMARK.LEFT_ANKLE],
  right_knee: [LANDMARK.RIGHT_HIP, LANDMARK.RIGHT_KNEE, LANDMARK.RIGHT_ANKLE],
  left_hip: [LANDMARK.LEFT_SHOULDER, LANDMARK.LEFT_HIP, LANDMARK.LEFT_KNEE],
  right_hip: [LANDMARK.RIGHT_SHOULDER, LANDMARK.RIGHT_HIP, LANDMARK.RIGHT_KNEE],
};

// ============================================
// TYPES
// ============================================

interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export type JointScore = 'good' | 'fair' | 'poor';

// ============================================
// ANGLE EXTRACTION
// ============================================

/**
 * Extract all 6 joint angles from MediaPipe normalised landmarks.
 *
 * @param landmarks - Array of 33 MediaPipe normalised landmarks
 * @returns Map of joint name to angle in degrees
 */
export function extractAngles(landmarks: NormalizedLandmark[]): JointAngles {
  const angles: JointAngles = {};
  for (const [name, [a, b, c]] of Object.entries(JOINT_EXTRACTION_MAP)) {
    const lmA = landmarks[a];
    const lmB = landmarks[b];
    const lmC = landmarks[c];
    if (lmA && lmB && lmC) {
      angles[name] = calcAngle(lmA, lmB, lmC);
    }
  }
  return angles;
}

// ============================================
// POSE SCORING
// ============================================

/**
 * Score each joint against pose targets.
 *
 * Scoring rules:
 * - deviation <= tolerance: "good" (100 pts)
 * - deviation <= tolerance * 2: "fair" (50 pts)
 * - deviation > tolerance * 2: "poor" (0 pts)
 *
 * @param currentAngles - Detected joint angles from MediaPipe
 * @param targets - Target angles and tolerances for the pose
 * @returns Overall score (0-100) and per-joint scores
 */
export function scorePose(
  currentAngles: JointAngles,
  targets: PoseTargets,
): { overallScore: number; jointScores: Record<string, JointScore> } {
  const jointScores: Record<string, JointScore> = {};
  let totalPoints = 0;
  let jointCount = 0;

  for (const [joint, target] of Object.entries(targets)) {
    const current = currentAngles[joint];
    if (current === undefined) continue;

    const deviation = Math.abs(current - target.angle);
    let score: JointScore;
    let points: number;

    if (deviation <= target.tolerance) {
      score = 'good';
      points = 100;
    } else if (deviation <= target.tolerance * 2) {
      score = 'fair';
      points = 50;
    } else {
      score = 'poor';
      points = 0;
    }

    jointScores[joint] = score;
    totalPoints += points;
    jointCount++;
  }

  const overallScore = jointCount > 0 ? Math.round(totalPoints / jointCount) : 0;
  return { overallScore, jointScores };
}

// ============================================
// FALLBACK POSE TARGETS
// ============================================

/**
 * Client-side fallback pose targets used when the server-provided targets
 * are unavailable. These mirror the database seed data.
 */
export const FALLBACK_POSE_TARGETS: Record<string, PoseTargets> = {
  'mountain-pose': {
    left_elbow: { angle: 170, tolerance: 15 },
    right_elbow: { angle: 170, tolerance: 15 },
    left_knee: { angle: 175, tolerance: 10 },
    right_knee: { angle: 175, tolerance: 10 },
    left_hip: { angle: 175, tolerance: 10 },
    right_hip: { angle: 175, tolerance: 10 },
  },
  'warrior-i': {
    left_elbow: { angle: 170, tolerance: 15 },
    right_elbow: { angle: 170, tolerance: 15 },
    left_knee: { angle: 90, tolerance: 15 },
    right_knee: { angle: 170, tolerance: 15 },
    left_hip: { angle: 95, tolerance: 15 },
    right_hip: { angle: 165, tolerance: 15 },
  },
  'downward-facing-dog': {
    left_elbow: { angle: 175, tolerance: 10 },
    right_elbow: { angle: 175, tolerance: 10 },
    left_knee: { angle: 170, tolerance: 15 },
    right_knee: { angle: 170, tolerance: 15 },
    left_hip: { angle: 75, tolerance: 15 },
    right_hip: { angle: 75, tolerance: 15 },
  },
  'tree-pose': {
    left_elbow: { angle: 170, tolerance: 20 },
    right_elbow: { angle: 170, tolerance: 20 },
    left_knee: { angle: 175, tolerance: 10 },
    right_knee: { angle: 50, tolerance: 20 },
    left_hip: { angle: 175, tolerance: 10 },
    right_hip: { angle: 120, tolerance: 20 },
  },
  'childs-pose': {
    left_elbow: { angle: 170, tolerance: 20 },
    right_elbow: { angle: 170, tolerance: 20 },
    left_knee: { angle: 35, tolerance: 15 },
    right_knee: { angle: 35, tolerance: 15 },
    left_hip: { angle: 40, tolerance: 15 },
    right_hip: { angle: 40, tolerance: 15 },
  },
};
