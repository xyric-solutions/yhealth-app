/**
 * @file Emotion Modulation Parameters
 * @description Per-emotion modulation table that controls animation intensity,
 * frequency, posture, blink rate, eye saccade behavior, and finger curl
 * across ALL animation subsystems. The RAF loop reads one entry per frame.
 */

// ============================================
// TYPES
// ============================================

export interface EmotionModulators {
  /** Multiplier on idle channel amplitudes (1.0 = default). */
  amplitudeScale: number;
  /** Multiplier on idle channel frequencies (1.0 = default). */
  frequencyScale: number;
  /** Additive spine tilt in radians (+forward, -backward). */
  postureLean: number;
  /** Shoulder raise offset in radians (+ = raised/hunched, - = relaxed/dropped). */
  shoulderOffset: number;
  /** Head tilt offset in radians (z-axis, + = tilt left, - = tilt right). */
  headTilt: number;
  /** Head nod offset in radians (x-axis, + = look down, - = look up). */
  headNod: number;
  /** Blink interval range [minSeconds, maxSeconds]. */
  blinkInterval: [number, number];
  /** Probability of a double-blink (0-1). */
  doubleBlinkProb: number;
  /** Eye saccade interval range [minSeconds, maxSeconds]. */
  saccadeInterval: [number, number];
  /** Eye saccade amplitude range [minDeg, maxDeg]. */
  saccadeAmplitude: [number, number];
  /** Base finger curl change in radians (+ = more curled, - = more open). */
  fingerCurlOffset: number;
  /** Finger micro-movement amplitude multiplier. */
  fingerMicroScale: number;
  /** Weight-shift amplitude multiplier. */
  weightShiftScale: number;
  /** Speaking gesture amplitude multiplier (1.0 = default). */
  gestureScale: number;
  /** Speaking gesture frequency multiplier (1.0 = default). */
  gestureSpeed: number;
  /** Breathing rate multiplier (1.0 = default). */
  breathingRate: number;
  /** Breathing depth multiplier (1.0 = default). */
  breathingDepth: number;
  /** Micro-expression probability during this emotion (0-1). */
  microExpressionProb: number;
  /** Tension in body (affects stiffness of movements, 0-1). */
  bodyTension: number;
}

// ============================================
// MODULATOR TABLE
// ============================================

export const EMOTION_MODULATORS: Record<string, EmotionModulators> = {
  // === BASE EMOTIONS ===
  neutral: {
    amplitudeScale: 1.0,
    frequencyScale: 1.0,
    postureLean: 0,
    shoulderOffset: 0,
    headTilt: 0,
    headNod: 0,
    blinkInterval: [2, 6],
    doubleBlinkProb: 0.15,
    saccadeInterval: [0.8, 2.0],
    saccadeAmplitude: [1, 4],
    fingerCurlOffset: 0,
    fingerMicroScale: 1.0,
    weightShiftScale: 1.0,
    gestureScale: 1.0,
    gestureSpeed: 1.0,
    breathingRate: 1.0,
    breathingDepth: 1.0,
    microExpressionProb: 0.1,
    bodyTension: 0.3,
  },
  happy: {
    amplitudeScale: 1.3,
    frequencyScale: 1.2,
    postureLean: -0.015,
    shoulderOffset: -0.02,
    headTilt: 0,
    headNod: 0,
    blinkInterval: [2, 5],
    doubleBlinkProb: 0.25,
    saccadeInterval: [0.6, 1.5],
    saccadeAmplitude: [2, 5],
    fingerCurlOffset: -0.02,
    fingerMicroScale: 1.3,
    weightShiftScale: 1.4,
    gestureScale: 1.5,
    gestureSpeed: 1.3,
    breathingRate: 1.1,
    breathingDepth: 1.2,
    microExpressionProb: 0.15,
    bodyTension: 0.2,
  },
  sad: {
    amplitudeScale: 0.6,
    frequencyScale: 0.7,
    postureLean: 0.03,
    shoulderOffset: 0.03,
    headTilt: 0.02,
    headNod: 0.04,
    blinkInterval: [3, 8],
    doubleBlinkProb: 0.05,
    saccadeInterval: [1.5, 3.0],
    saccadeAmplitude: [0.5, 2],
    fingerCurlOffset: 0.02,
    fingerMicroScale: 0.5,
    weightShiftScale: 0.5,
    gestureScale: 0.65,
    gestureSpeed: 0.6,
    breathingRate: 0.7,
    breathingDepth: 0.8,
    microExpressionProb: 0.05,
    bodyTension: 0.4,
  },
  angry: {
    amplitudeScale: 0.7,
    frequencyScale: 1.1,
    postureLean: 0.02,
    shoulderOffset: 0.02,
    headTilt: 0,
    headNod: -0.02,
    blinkInterval: [1.5, 4],
    doubleBlinkProb: 0.1,
    saccadeInterval: [0.3, 1.0],
    saccadeAmplitude: [1, 3],
    fingerCurlOffset: 0.08,
    fingerMicroScale: 0.3,
    weightShiftScale: 0.6,
    gestureScale: 0.8,
    gestureSpeed: 1.4,
    breathingRate: 1.3,
    breathingDepth: 0.9,
    microExpressionProb: 0.2,
    bodyTension: 0.9,
  },
  relaxed: {
    amplitudeScale: 1.1,
    frequencyScale: 0.8,
    postureLean: -0.01,
    shoulderOffset: -0.03,
    headTilt: 0,
    headNod: 0,
    blinkInterval: [3, 7],
    doubleBlinkProb: 0.2,
    saccadeInterval: [1.0, 2.5],
    saccadeAmplitude: [1, 3],
    fingerCurlOffset: -0.01,
    fingerMicroScale: 0.8,
    weightShiftScale: 1.2,
    gestureScale: 0.75,
    gestureSpeed: 0.75,
    breathingRate: 0.8,
    breathingDepth: 1.3,
    microExpressionProb: 0.08,
    bodyTension: 0.15,
  },
  surprised: {
    amplitudeScale: 0.4,
    frequencyScale: 0.6,
    postureLean: -0.02,
    shoulderOffset: -0.01,
    headTilt: 0,
    headNod: -0.03,
    blinkInterval: [1, 3],
    doubleBlinkProb: 0.3,
    saccadeInterval: [0.2, 0.8],
    saccadeAmplitude: [3, 7],
    fingerCurlOffset: -0.04,
    fingerMicroScale: 1.5,
    weightShiftScale: 0.5,
    gestureScale: 0.55,
    gestureSpeed: 0.6,
    breathingRate: 1.4,
    breathingDepth: 0.6,
    microExpressionProb: 0.25,
    bodyTension: 0.5,
  },

  // === NEW COMPLEX EMOTIONS ===
  curiosity: {
    amplitudeScale: 1.1,
    frequencyScale: 1.0,
    postureLean: 0.025,
    shoulderOffset: -0.01,
    headTilt: 0.03,
    headNod: 0.02,
    blinkInterval: [2, 4],
    doubleBlinkProb: 0.15,
    saccadeInterval: [0.4, 1.2],
    saccadeAmplitude: [2, 4],
    fingerCurlOffset: -0.03,
    fingerMicroScale: 1.1,
    weightShiftScale: 1.1,
    gestureScale: 1.1,
    gestureSpeed: 1.0,
    breathingRate: 1.0,
    breathingDepth: 1.0,
    microExpressionProb: 0.18,
    bodyTension: 0.4,
  },
  concern: {
    amplitudeScale: 0.8,
    frequencyScale: 0.85,
    postureLean: 0.015,
    shoulderOffset: 0.01,
    headTilt: 0.015,
    headNod: 0.02,
    blinkInterval: [2.5, 5],
    doubleBlinkProb: 0.08,
    saccadeInterval: [0.8, 2.0],
    saccadeAmplitude: [1, 3],
    fingerCurlOffset: 0.01,
    fingerMicroScale: 0.7,
    weightShiftScale: 0.8,
    gestureScale: 0.85,
    gestureSpeed: 0.85,
    breathingRate: 0.9,
    breathingDepth: 0.9,
    microExpressionProb: 0.12,
    bodyTension: 0.5,
  },
  confusion: {
    amplitudeScale: 0.9,
    frequencyScale: 0.9,
    postureLean: 0.01,
    shoulderOffset: 0.015,
    headTilt: 0.04,
    headNod: 0.01,
    blinkInterval: [2, 4],
    doubleBlinkProb: 0.2,
    saccadeInterval: [0.5, 1.5],
    saccadeAmplitude: [1.5, 4],
    fingerCurlOffset: 0.03,
    fingerMicroScale: 0.9,
    weightShiftScale: 0.9,
    gestureScale: 0.7,
    gestureSpeed: 0.8,
    breathingRate: 1.0,
    breathingDepth: 0.85,
    microExpressionProb: 0.22,
    bodyTension: 0.6,
  },
  disgust: {
    amplitudeScale: 0.6,
    frequencyScale: 0.8,
    postureLean: 0.015,
    shoulderOffset: 0.01,
    headTilt: 0,
    headNod: 0.03,
    blinkInterval: [2, 4],
    doubleBlinkProb: 0.1,
    saccadeInterval: [0.6, 1.8],
    saccadeAmplitude: [1, 3],
    fingerCurlOffset: 0.02,
    fingerMicroScale: 0.4,
    weightShiftScale: 0.7,
    gestureScale: 0.6,
    gestureSpeed: 0.9,
    breathingRate: 0.9,
    breathingDepth: 0.7,
    microExpressionProb: 0.15,
    bodyTension: 0.7,
  },
  fear: {
    amplitudeScale: 0.5,
    frequencyScale: 1.3,
    postureLean: -0.01,
    shoulderOffset: 0.015,
    headTilt: 0.02,
    headNod: -0.01,
    blinkInterval: [1, 2.5],
    doubleBlinkProb: 0.05,
    saccadeInterval: [0.2, 0.6],
    saccadeAmplitude: [2, 5],
    fingerCurlOffset: 0.01,
    fingerMicroScale: 1.8,
    weightShiftScale: 1.3,
    gestureScale: 0.5,
    gestureSpeed: 1.5,
    breathingRate: 1.6,
    breathingDepth: 0.5,
    microExpressionProb: 0.3,
    bodyTension: 0.95,
  },
  embarrassment: {
    amplitudeScale: 0.7,
    frequencyScale: 0.9,
    postureLean: 0.02,
    shoulderOffset: 0.02,
    headTilt: 0.03,
    headNod: 0.03,
    blinkInterval: [1.5, 3.5],
    doubleBlinkProb: 0.15,
    saccadeInterval: [0.8, 2.0],
    saccadeAmplitude: [1, 3],
    fingerCurlOffset: 0.04,
    fingerMicroScale: 0.6,
    weightShiftScale: 0.6,
    gestureScale: 0.6,
    gestureSpeed: 0.8,
    breathingRate: 1.1,
    breathingDepth: 0.7,
    microExpressionProb: 0.2,
    bodyTension: 0.6,
  },
  excitement: {
    amplitudeScale: 1.5,
    frequencyScale: 1.4,
    postureLean: -0.02,
    shoulderOffset: -0.025,
    headTilt: 0,
    headNod: -0.02,
    blinkInterval: [1.5, 3.5],
    doubleBlinkProb: 0.3,
    saccadeInterval: [0.3, 1.0],
    saccadeAmplitude: [2.5, 5.5],
    fingerCurlOffset: -0.05,
    fingerMicroScale: 1.6,
    weightShiftScale: 1.6,
    gestureScale: 1.8,
    gestureSpeed: 1.5,
    breathingRate: 1.3,
    breathingDepth: 1.1,
    microExpressionProb: 0.25,
    bodyTension: 0.4,
  },
  empathy: {
    amplitudeScale: 0.85,
    frequencyScale: 0.75,
    postureLean: 0.02,
    shoulderOffset: 0.005,
    headTilt: 0.025,
    headNod: 0.025,
    blinkInterval: [2.5, 5.5],
    doubleBlinkProb: 0.08,
    saccadeInterval: [1.0, 2.5],
    saccadeAmplitude: [1, 2.5],
    fingerCurlOffset: 0.01,
    fingerMicroScale: 0.8,
    weightShiftScale: 0.7,
    gestureScale: 0.8,
    gestureSpeed: 0.75,
    breathingRate: 0.85,
    breathingDepth: 0.9,
    microExpressionProb: 0.1,
    bodyTension: 0.3,
  },
  contemplation: {
    amplitudeScale: 0.8,
    frequencyScale: 0.6,
    postureLean: 0.01,
    shoulderOffset: -0.01,
    headTilt: 0.015,
    headNod: 0.05,
    blinkInterval: [3, 7],
    doubleBlinkProb: 0.05,
    saccadeInterval: [1.2, 3.0],
    saccadeAmplitude: [0.8, 2],
    fingerCurlOffset: 0.03,
    fingerMicroScale: 0.6,
    weightShiftScale: 0.8,
    gestureScale: 0.5,
    gestureSpeed: 0.6,
    breathingRate: 0.7,
    breathingDepth: 1.0,
    microExpressionProb: 0.08,
    bodyTension: 0.35,
  },
  determination: {
    amplitudeScale: 1.0,
    frequencyScale: 0.9,
    postureLean: 0.01,
    shoulderOffset: 0.01,
    headTilt: 0,
    headNod: -0.015,
    blinkInterval: [2, 4.5],
    doubleBlinkProb: 0.1,
    saccadeInterval: [0.6, 1.8],
    saccadeAmplitude: [1.2, 3.2],
    fingerCurlOffset: 0.02,
    fingerMicroScale: 0.9,
    weightShiftScale: 1.0,
    gestureScale: 1.1,
    gestureSpeed: 0.95,
    breathingRate: 1.0,
    breathingDepth: 1.1,
    microExpressionProb: 0.12,
    bodyTension: 0.7,
  },

  // === CONVERSATIONAL STATES ===
  listening: {
    amplitudeScale: 0.7,
    frequencyScale: 0.8,
    postureLean: 0.02,          // slight forward lean (engaged)
    shoulderOffset: -0.01,
    headTilt: 0.015,            // soft right tilt (attentive)
    headNod: 0.02,              // slow nod tendency
    blinkInterval: [2.5, 5],
    doubleBlinkProb: 0.12,
    saccadeInterval: [1.2, 2.8], // calm, steady gaze
    saccadeAmplitude: [0.8, 2.5],
    fingerCurlOffset: 0,
    fingerMicroScale: 0.5,      // quiet hands
    weightShiftScale: 0.6,
    gestureScale: 0.3,          // minimal gestures
    gestureSpeed: 0.6,
    breathingRate: 0.85,
    breathingDepth: 1.1,
    microExpressionProb: 0.08,
    bodyTension: 0.25,
  },
  explaining: {
    amplitudeScale: 1.2,
    frequencyScale: 1.1,
    postureLean: 0.015,         // slight forward lean (teaching)
    shoulderOffset: -0.015,
    headTilt: 0,
    headNod: -0.01,             // slight chin up (projecting)
    blinkInterval: [2, 4.5],
    doubleBlinkProb: 0.15,
    saccadeInterval: [0.5, 1.5], // engaged eye movement
    saccadeAmplitude: [1.5, 3.5],
    fingerCurlOffset: -0.03,    // open hands
    fingerMicroScale: 1.2,
    weightShiftScale: 1.0,
    gestureScale: 1.4,          // expressive gestures
    gestureSpeed: 1.1,
    breathingRate: 1.05,
    breathingDepth: 1.1,
    microExpressionProb: 0.15,
    bodyTension: 0.35,
  },
  confident: {
    amplitudeScale: 1.0,
    frequencyScale: 0.95,
    postureLean: -0.01,         // slight backward lean (assured)
    shoulderOffset: -0.02,      // shoulders back and down
    headTilt: 0,
    headNod: -0.01,             // chin slightly up
    blinkInterval: [2.5, 5],
    doubleBlinkProb: 0.1,
    saccadeInterval: [0.8, 2.2], // steady, deliberate gaze
    saccadeAmplitude: [1, 3],
    fingerCurlOffset: 0,
    fingerMicroScale: 0.8,
    weightShiftScale: 0.9,
    gestureScale: 1.2,          // controlled, purposeful gestures
    gestureSpeed: 0.9,
    breathingRate: 0.9,
    breathingDepth: 1.15,       // deep, calm breaths
    microExpressionProb: 0.1,
    bodyTension: 0.5,
  },
  disagreeing: {
    amplitudeScale: 0.85,
    frequencyScale: 1.0,
    postureLean: -0.015,        // slight backward lean
    shoulderOffset: 0.01,
    headTilt: -0.02,            // tilt left (questioning)
    headNod: 0,
    blinkInterval: [2, 4],
    doubleBlinkProb: 0.15,
    saccadeInterval: [0.5, 1.5],
    saccadeAmplitude: [1.5, 3.5],
    fingerCurlOffset: 0.02,
    fingerMicroScale: 0.7,
    weightShiftScale: 0.8,
    gestureScale: 0.9,
    gestureSpeed: 1.1,
    breathingRate: 1.05,
    breathingDepth: 0.9,
    microExpressionProb: 0.18,
    bodyTension: 0.55,
  },
};

// ============================================
// HELPERS
// ============================================

/** All numeric keys on EmotionModulators (for lerp transitions). */
export const MODULATOR_NUMERIC_KEYS: (keyof EmotionModulators)[] = [
  "amplitudeScale",
  "frequencyScale",
  "postureLean",
  "shoulderOffset",
  "headTilt",
  "headNod",
  "doubleBlinkProb",
  "fingerCurlOffset",
  "fingerMicroScale",
  "weightShiftScale",
  "gestureScale",
  "gestureSpeed",
  "breathingRate",
  "breathingDepth",
  "microExpressionProb",
  "bodyTension",
];

/** Tuple keys that need per-element lerp. */
export const MODULATOR_TUPLE_KEYS: (keyof EmotionModulators)[] = [
  "blinkInterval",
  "saccadeInterval",
  "saccadeAmplitude",
];

/** All available emotion names. */
export const ALL_EMOTIONS = Object.keys(EMOTION_MODULATORS);

/** Get a safe emotion modulator, falling back to neutral. */
export function getEmotionModulator(emotion: string): EmotionModulators {
  return EMOTION_MODULATORS[emotion] || EMOTION_MODULATORS.neutral;
}

/** Blend two emotion modulators with a given weight (0 = first, 1 = second). */
export function blendEmotionModulators(
  first: EmotionModulators,
  second: EmotionModulators,
  weight: number
): EmotionModulators {
  const result = { ...first };

  for (const key of MODULATOR_NUMERIC_KEYS) {
    const a = first[key] as number;
    const b = second[key] as number;
    (result as unknown as Record<string, number>)[key] = a + (b - a) * weight;
  }

  for (const key of MODULATOR_TUPLE_KEYS) {
    const a = first[key] as [number, number];
    const b = second[key] as [number, number];
    (result as unknown as Record<string, [number, number]>)[key] = [
      a[0] + (b[0] - a[0]) * weight,
      a[1] + (b[1] - a[1]) * weight,
    ];
  }

  return result;
}
