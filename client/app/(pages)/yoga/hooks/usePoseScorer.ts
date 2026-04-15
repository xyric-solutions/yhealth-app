'use client';

/**
 * @file Pose scoring hook
 * @description Reactively computes joint angles and scores from MediaPipe
 *              landmarks against a set of pose targets. Memoised to avoid
 *              unnecessary re-computation on unchanged inputs.
 */

import { useMemo } from 'react';
import type { PoseTargets, JointAngles } from '@shared/types/domain/yoga';
import { extractAngles, scorePose, type JointScore } from '../utils/poses';

interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

interface PoseScorerResult {
  currentAngles: JointAngles;
  overallScore: number;
  jointScores: Record<string, JointScore>;
}

/**
 * Compute per-joint angles and scores from MediaPipe landmarks.
 *
 * @param landmarks - Current frame's normalised landmarks (null when no pose detected)
 * @param targets   - Target angles for the active pose (null when no pose selected)
 * @returns Joint angles, overall score (0-100), and per-joint scores
 */
export function usePoseScorer(
  landmarks: NormalizedLandmark[] | null,
  targets: PoseTargets | null,
): PoseScorerResult {
  return useMemo(() => {
    if (!landmarks || !targets) {
      return {
        currentAngles: {} as JointAngles,
        overallScore: 0,
        jointScores: {} as Record<string, JointScore>,
      };
    }

    const currentAngles = extractAngles(landmarks);
    const { overallScore, jointScores } = scorePose(currentAngles, targets);

    return { currentAngles, overallScore, jointScores };
  }, [landmarks, targets]);
}
