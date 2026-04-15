/**
 * @file Skeleton drawing utilities
 * @description Renders MediaPipe pose landmarks onto a canvas overlay with
 *              colour-coded joints and connections based on pose scoring.
 */

import { LANDMARK } from './landmarks';

// ============================================
// POSE CONNECTIONS (MediaPipe standard 35)
// ============================================

export const POSE_CONNECTIONS: [number, number][] = [
  // Face
  [LANDMARK.NOSE, LANDMARK.LEFT_EYE_INNER],
  [LANDMARK.LEFT_EYE_INNER, LANDMARK.LEFT_EYE],
  [LANDMARK.LEFT_EYE, LANDMARK.LEFT_EYE_OUTER],
  [LANDMARK.LEFT_EYE_OUTER, LANDMARK.LEFT_EAR],
  [LANDMARK.NOSE, LANDMARK.RIGHT_EYE_INNER],
  [LANDMARK.RIGHT_EYE_INNER, LANDMARK.RIGHT_EYE],
  [LANDMARK.RIGHT_EYE, LANDMARK.RIGHT_EYE_OUTER],
  [LANDMARK.RIGHT_EYE_OUTER, LANDMARK.RIGHT_EAR],
  [LANDMARK.MOUTH_LEFT, LANDMARK.MOUTH_RIGHT],
  // Torso
  [LANDMARK.LEFT_SHOULDER, LANDMARK.RIGHT_SHOULDER],
  [LANDMARK.LEFT_SHOULDER, LANDMARK.LEFT_HIP],
  [LANDMARK.RIGHT_SHOULDER, LANDMARK.RIGHT_HIP],
  [LANDMARK.LEFT_HIP, LANDMARK.RIGHT_HIP],
  // Left arm
  [LANDMARK.LEFT_SHOULDER, LANDMARK.LEFT_ELBOW],
  [LANDMARK.LEFT_ELBOW, LANDMARK.LEFT_WRIST],
  [LANDMARK.LEFT_WRIST, LANDMARK.LEFT_PINKY],
  [LANDMARK.LEFT_WRIST, LANDMARK.LEFT_INDEX],
  [LANDMARK.LEFT_WRIST, LANDMARK.LEFT_THUMB],
  [LANDMARK.LEFT_INDEX, LANDMARK.LEFT_PINKY],
  // Right arm
  [LANDMARK.RIGHT_SHOULDER, LANDMARK.RIGHT_ELBOW],
  [LANDMARK.RIGHT_ELBOW, LANDMARK.RIGHT_WRIST],
  [LANDMARK.RIGHT_WRIST, LANDMARK.RIGHT_PINKY],
  [LANDMARK.RIGHT_WRIST, LANDMARK.RIGHT_INDEX],
  [LANDMARK.RIGHT_WRIST, LANDMARK.RIGHT_THUMB],
  [LANDMARK.RIGHT_INDEX, LANDMARK.RIGHT_PINKY],
  // Left leg
  [LANDMARK.LEFT_HIP, LANDMARK.LEFT_KNEE],
  [LANDMARK.LEFT_KNEE, LANDMARK.LEFT_ANKLE],
  [LANDMARK.LEFT_ANKLE, LANDMARK.LEFT_HEEL],
  [LANDMARK.LEFT_ANKLE, LANDMARK.LEFT_FOOT_INDEX],
  [LANDMARK.LEFT_HEEL, LANDMARK.LEFT_FOOT_INDEX],
  // Right leg
  [LANDMARK.RIGHT_HIP, LANDMARK.RIGHT_KNEE],
  [LANDMARK.RIGHT_KNEE, LANDMARK.RIGHT_ANKLE],
  [LANDMARK.RIGHT_ANKLE, LANDMARK.RIGHT_HEEL],
  [LANDMARK.RIGHT_ANKLE, LANDMARK.RIGHT_FOOT_INDEX],
  [LANDMARK.RIGHT_HEEL, LANDMARK.RIGHT_FOOT_INDEX],
];

// ============================================
// COLOUR MAPPING
// ============================================

const SCORE_COLORS = {
  good: '#22c55e', // green-500
  fair: '#f59e0b', // amber-500
  poor: '#ef4444', // red-500
} as const;

export type JointScore = 'good' | 'fair' | 'poor';

// ============================================
// LANDMARK <-> JOINT NAME MAPPING
// ============================================

/** Map scored joint names to their MediaPipe landmark vertex index */
const JOINT_LANDMARK_MAP: Record<string, number> = {
  left_elbow: LANDMARK.LEFT_ELBOW,
  right_elbow: LANDMARK.RIGHT_ELBOW,
  left_knee: LANDMARK.LEFT_KNEE,
  right_knee: LANDMARK.RIGHT_KNEE,
  left_hip: LANDMARK.LEFT_HIP,
  right_hip: LANDMARK.RIGHT_HIP,
};

// ============================================
// INTERNAL HELPERS
// ============================================

interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

/** Minimum visibility threshold for rendering a landmark */
const VISIBILITY_THRESHOLD = 0.3;

/** Get the colour for a connection based on the worst score of its endpoints */
function getConnectionColour(
  a: number,
  b: number,
  jointIndexToName: Map<number, string>,
  jointScores: Record<string, JointScore>,
): string {
  const nameA = jointIndexToName.get(a);
  const nameB = jointIndexToName.get(b);
  const scoreA = nameA ? jointScores[nameA] : undefined;
  const scoreB = nameB ? jointScores[nameB] : undefined;

  // Use the worst score between the two joints
  if (scoreA === 'poor' || scoreB === 'poor') return SCORE_COLORS.poor;
  if (scoreA === 'fair' || scoreB === 'fair') return SCORE_COLORS.fair;
  if (scoreA === 'good' || scoreB === 'good') return SCORE_COLORS.good;
  return '#6b7280'; // gray-500 default for unscored connections
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Draw a colour-coded skeleton overlay on a canvas.
 *
 * Connections and joints are coloured based on the worst score of their
 * endpoints: green (good), amber (fair), red (poor), grey (unscored).
 *
 * @param ctx        - 2D canvas rendering context
 * @param landmarks  - MediaPipe normalised landmarks (0-1 coordinate space)
 * @param jointScores - Per-joint scores from pose evaluation
 * @param canvasWidth  - Canvas element width in pixels
 * @param canvasHeight - Canvas element height in pixels
 */
export function drawSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  jointScores: Record<string, JointScore>,
  canvasWidth: number,
  canvasHeight: number,
): void {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Build reverse map: landmark index -> joint name
  const indexToName = new Map<number, string>();
  for (const [name, idx] of Object.entries(JOINT_LANDMARK_MAP)) {
    indexToName.set(idx, name);
  }

  // Draw connections
  ctx.lineWidth = 3;
  for (const [a, b] of POSE_CONNECTIONS) {
    const lmA = landmarks[a];
    const lmB = landmarks[b];
    if (!lmA || !lmB) continue;
    if (
      (lmA.visibility ?? 0) < VISIBILITY_THRESHOLD ||
      (lmB.visibility ?? 0) < VISIBILITY_THRESHOLD
    )
      continue;

    const colour = getConnectionColour(a, b, indexToName, jointScores);
    ctx.strokeStyle = colour;
    ctx.shadowColor = colour;
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(lmA.x * canvasWidth, lmA.y * canvasHeight);
    ctx.lineTo(lmB.x * canvasWidth, lmB.y * canvasHeight);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  // Draw joints (scored joints are larger)
  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];
    if (!lm || (lm.visibility ?? 0) < VISIBILITY_THRESHOLD) continue;

    const name = indexToName.get(i);
    const score = name ? jointScores[name] : undefined;
    const colour = score ? SCORE_COLORS[score] : '#94a3b8'; // slate-400 default
    const radius = name ? 6 : 3; // Scored joints are rendered larger

    ctx.fillStyle = colour;
    ctx.shadowColor = colour;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(lm.x * canvasWidth, lm.y * canvasHeight, radius, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}
