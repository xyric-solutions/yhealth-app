/**
 * @file Gesture System
 * @description Named discrete gestures (wave, point, shrug, thumbs-up, etc.)
 * that play as timed keyframe sequences, blending additively with the idle/speaking
 * animation layers. Managed by GesturePlayer which runs inside the RAF loop.
 *
 * Each gesture has 2-3 keyframes: attack → peak (hold) → release (return to rest).
 * Bone values are OFFSETS from the current pose, applied via quaternion multiplication.
 */

import { eulerDegToQuat } from './vrmPoses';

// ============================================
// TYPES
// ============================================

export type GestureType =
  | 'idle_rest'
  | 'open_palm_up'
  | 'point_forward'
  | 'both_hands_out'
  | 'hand_to_chin'
  | 'hands_together'
  | 'left_hand_wave'
  | 'shrug'
  | 'counting_fingers'
  | 'thumbs_up'
  | 'soft_nod'
  | 'arms_cross'
  | 'reach_out'
  | 'head_nod_agree'
  | 'head_shake_disagree';

type Quat = [number, number, number, number];

interface GestureBoneOffset {
  rotation: Quat;
}

interface GestureKeyframe {
  /** Bone offsets as Euler-degree-derived quaternions (additive). */
  bones: Record<string, GestureBoneOffset>;
  /** Duration of this keyframe segment in seconds. */
  duration: number;
}

interface GestureDefinition {
  name: GestureType;
  keyframes: GestureKeyframe[];
  /** Higher priority gestures interrupt lower ones. */
  priority: number;
  /** Can be interrupted by a higher-priority gesture before completion? */
  interruptible: boolean;
}

/** Output from GesturePlayer.tick() — bone offsets to apply this frame. */
export interface GestureBoneOutputs {
  [boneName: string]: Quat;
}

// ============================================
// GESTURE DEFINITIONS
// ============================================

// Helper: identity quaternion (no rotation offset)
const I: Quat = [0, 0, 0, 1];
const q = eulerDegToQuat;

/**
 * KEYFRAME CONVENTION:
 * The player slerps FROM kf[i] TO kf[i+1] during kf[i].duration.
 * Last keyframe auto-slerps toward identity (rest).
 *
 * Correct structure for attack → hold → release:
 *   kf[0] = { bones: {},     duration: attackTime }  — start at rest, ramp to peak
 *   kf[1] = { bones: {peak}, duration: holdTime   }  — hold at peak (slerps to kf[2] = peak)
 *   kf[2] = { bones: {peak}, duration: releaseTime}  — release (auto-fades to identity)
 *
 * All rotation values are SMALL OFFSETS (5-15°) applied additively on the speaking pose.
 * Upper arms use premultiply (parent space) in the RAF loop.
 */
const GESTURE_DEFS: Record<GestureType, GestureDefinition> = {
  idle_rest: {
    name: 'idle_rest',
    keyframes: [{ bones: {}, duration: 0.3 }],
    priority: 0,
    interruptible: true,
  },

  // ---- Right hand palm-up presenting gesture ----
  open_palm_up: {
    name: 'open_palm_up',
    keyframes: [
      { bones: {}, duration: 0.4 },  // attack: ramp from rest to peak
      { bones: {  // peak
        rightUpperArm: { rotation: q(10, -2, 5) },
        rightLowerArm: { rotation: q(-8, 0, 0) },
        rightHand: { rotation: q(12, -8, -5) },
        rightIndexProximal: { rotation: q(-5, 0, -2) },
        rightMiddleProximal: { rotation: q(-5, 0, 0) },
        rightRingProximal: { rotation: q(-4, 0, 2) },
        spine: { rotation: q(0, -2, 0) },
      }, duration: 0.6 },
      { bones: {  // hold (same as peak) — auto-releases to identity
        rightUpperArm: { rotation: q(10, -2, 5) },
        rightLowerArm: { rotation: q(-8, 0, 0) },
        rightHand: { rotation: q(12, -8, -5) },
        rightIndexProximal: { rotation: q(-5, 0, -2) },
        rightMiddleProximal: { rotation: q(-5, 0, 0) },
        rightRingProximal: { rotation: q(-4, 0, 2) },
        spine: { rotation: q(0, -2, 0) },
      }, duration: 0.45 },
    ],
    priority: 3,
    interruptible: true,
  },

  // ---- Point forward with index finger ----
  point_forward: {
    name: 'point_forward',
    keyframes: [
      { bones: {}, duration: 0.35 },
      { bones: {
        rightUpperArm: { rotation: q(12, -2, 6) },
        rightLowerArm: { rotation: q(-5, 0, 0) },
        rightHand: { rotation: q(5, -3, 0) },
        rightIndexProximal: { rotation: q(5, 0, 0) },
        rightMiddleProximal: { rotation: q(-12, 0, 0) },
        rightRingProximal: { rotation: q(-12, 0, 0) },
        rightLittleProximal: { rotation: q(-12, 0, 0) },
        spine: { rotation: q(0, -2, 0) },
        head: { rotation: q(-1, -2, 0) },
      }, duration: 0.5 },
      { bones: {
        rightUpperArm: { rotation: q(12, -2, 6) },
        rightLowerArm: { rotation: q(-5, 0, 0) },
        rightHand: { rotation: q(5, -3, 0) },
        rightIndexProximal: { rotation: q(5, 0, 0) },
        rightMiddleProximal: { rotation: q(-12, 0, 0) },
        rightRingProximal: { rotation: q(-12, 0, 0) },
        rightLittleProximal: { rotation: q(-12, 0, 0) },
        spine: { rotation: q(0, -2, 0) },
        head: { rotation: q(-1, -2, 0) },
      }, duration: 0.4 },
    ],
    priority: 4,
    interruptible: true,
  },

  // ---- Both hands out — emphasis / excitement ----
  both_hands_out: {
    name: 'both_hands_out',
    keyframes: [
      { bones: {}, duration: 0.4 },
      { bones: {
        leftUpperArm: { rotation: q(8, 2, -6) },
        rightUpperArm: { rotation: q(8, -2, 6) },
        leftLowerArm: { rotation: q(-6, 0, 0) },
        rightLowerArm: { rotation: q(-6, 0, 0) },
        leftHand: { rotation: q(8, 5, 4) },
        rightHand: { rotation: q(8, -5, -4) },
        leftIndexProximal: { rotation: q(-4, 0, -2) },
        rightIndexProximal: { rotation: q(-4, 0, 2) },
        chest: { rotation: q(2, 0, 0) },
      }, duration: 0.5 },
      { bones: {
        leftUpperArm: { rotation: q(8, 2, -6) },
        rightUpperArm: { rotation: q(8, -2, 6) },
        leftLowerArm: { rotation: q(-6, 0, 0) },
        rightLowerArm: { rotation: q(-6, 0, 0) },
        leftHand: { rotation: q(8, 5, 4) },
        rightHand: { rotation: q(8, -5, -4) },
        leftIndexProximal: { rotation: q(-4, 0, -2) },
        rightIndexProximal: { rotation: q(-4, 0, 2) },
        chest: { rotation: q(2, 0, 0) },
      }, duration: 0.45 },
    ],
    priority: 4,
    interruptible: true,
  },

  // ---- Hand to chin — thinking / pondering ----
  hand_to_chin: {
    name: 'hand_to_chin',
    keyframes: [
      { bones: {}, duration: 0.5 },
      { bones: {
        rightUpperArm: { rotation: q(15, 0, 10) },
        rightLowerArm: { rotation: q(-20, 0, 0) },
        rightHand: { rotation: q(-5, 0, 3) },
        head: { rotation: q(2, 0, 3) },
      }, duration: 0.8 },
      { bones: {
        rightUpperArm: { rotation: q(15, 0, 10) },
        rightLowerArm: { rotation: q(-20, 0, 0) },
        rightHand: { rotation: q(-5, 0, 3) },
        head: { rotation: q(2, 0, 3) },
      }, duration: 0.5 },
    ],
    priority: 3,
    interruptible: true,
  },

  // ---- Hands together — empathy / sincerity ----
  hands_together: {
    name: 'hands_together',
    keyframes: [
      { bones: {}, duration: 0.45 },
      { bones: {
        leftUpperArm: { rotation: q(6, 4, -3) },
        rightUpperArm: { rotation: q(6, -4, 3) },
        leftLowerArm: { rotation: q(-10, 0, 0) },
        rightLowerArm: { rotation: q(-10, 0, 0) },
        chest: { rotation: q(2, 0, 0) },
      }, duration: 0.7 },
      { bones: {
        leftUpperArm: { rotation: q(6, 4, -3) },
        rightUpperArm: { rotation: q(6, -4, 3) },
        leftLowerArm: { rotation: q(-10, 0, 0) },
        rightLowerArm: { rotation: q(-10, 0, 0) },
        chest: { rotation: q(2, 0, 0) },
      }, duration: 0.45 },
    ],
    priority: 3,
    interruptible: true,
  },

  // ---- Wave — greeting (multi-keyframe wave cycle) ----
  left_hand_wave: {
    name: 'left_hand_wave',
    keyframes: [
      { bones: {}, duration: 0.3 },  // attack
      { bones: {  // arm up
        leftUpperArm: { rotation: q(12, 0, -8) },
        leftLowerArm: { rotation: q(-8, 0, 0) },
        leftHand: { rotation: q(0, 0, 10) },
      }, duration: 0.2 },
      { bones: {  // wave right
        leftUpperArm: { rotation: q(12, 0, -8) },
        leftLowerArm: { rotation: q(-8, 0, 0) },
        leftHand: { rotation: q(0, 0, -10) },
      }, duration: 0.2 },
      { bones: {  // wave left
        leftUpperArm: { rotation: q(12, 0, -8) },
        leftLowerArm: { rotation: q(-8, 0, 0) },
        leftHand: { rotation: q(0, 0, 10) },
      }, duration: 0.25 },
    ],
    priority: 5,
    interruptible: false,
  },

  // ---- Shrug — uncertainty ----
  shrug: {
    name: 'shrug',
    keyframes: [
      { bones: {}, duration: 0.35 },
      { bones: {
        leftShoulder: { rotation: q(0, 0, -5) },
        rightShoulder: { rotation: q(0, 0, 5) },
        leftUpperArm: { rotation: q(5, 0, -3) },
        rightUpperArm: { rotation: q(5, 0, 3) },
        leftHand: { rotation: q(8, -6, 0) },
        rightHand: { rotation: q(8, 6, 0) },
        head: { rotation: q(0, 0, 3) },
      }, duration: 0.4 },
      { bones: {
        leftShoulder: { rotation: q(0, 0, -5) },
        rightShoulder: { rotation: q(0, 0, 5) },
        leftUpperArm: { rotation: q(5, 0, -3) },
        rightUpperArm: { rotation: q(5, 0, 3) },
        leftHand: { rotation: q(8, -6, 0) },
        rightHand: { rotation: q(8, 6, 0) },
        head: { rotation: q(0, 0, 3) },
      }, duration: 0.5 },
    ],
    priority: 4,
    interruptible: true,
  },

  // ---- Counting fingers — list items ----
  counting_fingers: {
    name: 'counting_fingers',
    keyframes: [
      { bones: {}, duration: 0.35 },  // attack
      { bones: {  // fist up, index extends
        rightUpperArm: { rotation: q(10, -2, 6) },
        rightLowerArm: { rotation: q(-12, 0, 0) },
        rightHand: { rotation: q(5, -4, 0) },
        rightIndexProximal: { rotation: q(5, 0, 0) },
        rightMiddleProximal: { rotation: q(-10, 0, 0) },
        rightRingProximal: { rotation: q(-10, 0, 0) },
        rightLittleProximal: { rotation: q(-10, 0, 0) },
      }, duration: 0.4 },
      { bones: {  // index + middle
        rightUpperArm: { rotation: q(10, -2, 6) },
        rightLowerArm: { rotation: q(-12, 0, 0) },
        rightHand: { rotation: q(5, -4, 0) },
        rightIndexProximal: { rotation: q(5, 0, -2) },
        rightMiddleProximal: { rotation: q(5, 0, 0) },
        rightRingProximal: { rotation: q(-10, 0, 0) },
        rightLittleProximal: { rotation: q(-10, 0, 0) },
      }, duration: 0.4 },
      { bones: {  // three fingers — hold then auto-release
        rightUpperArm: { rotation: q(10, -2, 6) },
        rightLowerArm: { rotation: q(-12, 0, 0) },
        rightHand: { rotation: q(5, -4, 0) },
        rightIndexProximal: { rotation: q(5, 0, -2) },
        rightMiddleProximal: { rotation: q(5, 0, 0) },
        rightRingProximal: { rotation: q(5, 0, 2) },
        rightLittleProximal: { rotation: q(-10, 0, 0) },
      }, duration: 0.4 },
    ],
    priority: 3,
    interruptible: true,
  },

  // ---- Thumbs up — approval ----
  thumbs_up: {
    name: 'thumbs_up',
    keyframes: [
      { bones: {}, duration: 0.35 },
      { bones: {
        rightUpperArm: { rotation: q(8, 0, 6) },
        rightLowerArm: { rotation: q(-10, 0, 0) },
        rightThumbProximal: { rotation: q(0, 0, -10) },
        rightIndexProximal: { rotation: q(-10, 0, 0) },
        rightMiddleProximal: { rotation: q(-10, 0, 0) },
      }, duration: 0.6 },
      { bones: {
        rightUpperArm: { rotation: q(8, 0, 6) },
        rightLowerArm: { rotation: q(-10, 0, 0) },
        rightThumbProximal: { rotation: q(0, 0, -10) },
        rightIndexProximal: { rotation: q(-10, 0, 0) },
        rightMiddleProximal: { rotation: q(-10, 0, 0) },
      }, duration: 0.35 },
    ],
    priority: 5,
    interruptible: false,
  },

  // ---- Soft nod — acknowledgement (head only, no keyframe fix needed) ----
  soft_nod: {
    name: 'soft_nod',
    keyframes: [
      { bones: {}, duration: 0.15 },
      { bones: { head: { rotation: q(5, 0, 0) } }, duration: 0.15 },
      { bones: { head: { rotation: q(-2, 0, 0) } }, duration: 0.15 },
      { bones: { head: { rotation: q(4, 0, 0) } }, duration: 0.2 },
    ],
    priority: 2,
    interruptible: true,
  },

  // ---- Arms crossed — defensive / skeptical ----
  arms_cross: {
    name: 'arms_cross',
    keyframes: [
      { bones: {}, duration: 0.5 },
      { bones: {
        leftUpperArm: { rotation: q(8, 6, -4) },
        rightUpperArm: { rotation: q(8, -6, 4) },
        leftLowerArm: { rotation: q(-15, 0, 0) },
        rightLowerArm: { rotation: q(-15, 0, 0) },
        chest: { rotation: q(-1, 0, 0) },
      }, duration: 1.0 },
      { bones: {
        leftUpperArm: { rotation: q(8, 6, -4) },
        rightUpperArm: { rotation: q(8, -6, 4) },
        leftLowerArm: { rotation: q(-15, 0, 0) },
        rightLowerArm: { rotation: q(-15, 0, 0) },
        chest: { rotation: q(-1, 0, 0) },
      }, duration: 0.5 },
    ],
    priority: 3,
    interruptible: true,
  },

  // ---- Reach out — empathy / connecting ----
  reach_out: {
    name: 'reach_out',
    keyframes: [
      { bones: {}, duration: 0.45 },
      { bones: {
        rightUpperArm: { rotation: q(12, -2, 4) },
        rightLowerArm: { rotation: q(-5, 0, 0) },
        rightHand: { rotation: q(8, -5, -4) },
        rightIndexProximal: { rotation: q(-4, 0, -2) },
        rightMiddleProximal: { rotation: q(-4, 0, 0) },
        chest: { rotation: q(2, -1, 0) },
        spine: { rotation: q(1, -1, 0) },
      }, duration: 0.6 },
      { bones: {
        rightUpperArm: { rotation: q(12, -2, 4) },
        rightLowerArm: { rotation: q(-5, 0, 0) },
        rightHand: { rotation: q(8, -5, -4) },
        rightIndexProximal: { rotation: q(-4, 0, -2) },
        rightMiddleProximal: { rotation: q(-4, 0, 0) },
        chest: { rotation: q(2, -1, 0) },
        spine: { rotation: q(1, -1, 0) },
      }, duration: 0.45 },
    ],
    priority: 4,
    interruptible: true,
  },

  // ---- Agreement nod — 3× quick nods (head only) ----
  head_nod_agree: {
    name: 'head_nod_agree',
    keyframes: [
      { bones: {}, duration: 0.1 },
      { bones: { head: { rotation: q(6, 0, 0) } }, duration: 0.12 },
      { bones: { head: { rotation: q(-2, 0, 0) } }, duration: 0.12 },
      { bones: { head: { rotation: q(5, 0, 0) } }, duration: 0.12 },
      { bones: { head: { rotation: q(-1, 0, 0) } }, duration: 0.12 },
      { bones: { head: { rotation: q(4, 0, 0) } }, duration: 0.15 },
    ],
    priority: 5,
    interruptible: false,
  },

  // ---- Disagreement shake — head side-to-side ----
  head_shake_disagree: {
    name: 'head_shake_disagree',
    keyframes: [
      { bones: {}, duration: 0.12 },
      { bones: { head: { rotation: q(0, 6, 0) } }, duration: 0.18 },
      { bones: { head: { rotation: q(0, -6, 0) } }, duration: 0.18 },
      { bones: { head: { rotation: q(0, 5, 0) } }, duration: 0.18 },
      { bones: { head: { rotation: q(0, -4, 0) } }, duration: 0.18 },
    ],
    priority: 5,
    interruptible: false,
  },
};

// ============================================
// GESTURE PLAYER
// ============================================

/**
 * Plays discrete named gestures as keyframe sequences.
 * Call tick(dt) every frame — returns bone quaternion offsets to apply additively.
 * Zero allocations in hot path (reuses output object).
 */
export class GesturePlayer {
  private current: GestureDefinition | null = null;
  private elapsed = 0;
  private keyframeIndex = 0;
  private keyframeElapsed = 0;

  private queue: GestureType[] = [];
  private recentHistory: GestureType[] = [];
  private cooldowns = new Map<GestureType, number>();

  private readonly output: GestureBoneOutputs = {};
  private static readonly COOLDOWN_SEC = 5;
  private static readonly MAX_HISTORY = 3;

  /** Queue a gesture to play. Respects priority and anti-repetition. */
  play(type: GestureType): void {
    if (type === 'idle_rest') return;

    // Anti-repetition: skip if played recently
    const lastTwo = this.recentHistory.slice(-2);
    if (lastTwo.includes(type)) return;

    // Cooldown check
    const cooldownEnd = this.cooldowns.get(type) ?? 0;
    if (cooldownEnd > 0) return;

    const def = GESTURE_DEFS[type];
    if (!def) return;

    // If nothing playing, start immediately
    if (!this.current) {
      this.startGesture(def);
      return;
    }

    // Priority check
    if (def.priority > this.current.priority && this.current.interruptible) {
      this.startGesture(def);
      return;
    }

    // Queue it (max 2 in queue)
    if (this.queue.length < 2) {
      this.queue.push(type);
    }
  }

  /** Tick the player. Returns bone offsets for this frame. */
  tick(deltaTime: number): GestureBoneOutputs {
    // Clear previous output
    for (const key in this.output) {
      delete this.output[key];
    }

    // Update cooldowns
    for (const [type, remaining] of this.cooldowns) {
      const next = remaining - deltaTime;
      if (next <= 0) {
        this.cooldowns.delete(type);
      } else {
        this.cooldowns.set(type, next);
      }
    }

    if (!this.current) {
      // Try dequeue
      if (this.queue.length > 0) {
        const nextType = this.queue.shift()!;
        const def = GESTURE_DEFS[nextType];
        if (def) this.startGesture(def);
      }
      return this.output;
    }

    // Advance time
    this.elapsed += deltaTime;
    this.keyframeElapsed += deltaTime;

    const kf = this.current.keyframes;

    // Find current and next keyframe
    while (this.keyframeIndex < kf.length - 1 && this.keyframeElapsed >= kf[this.keyframeIndex].duration) {
      this.keyframeElapsed -= kf[this.keyframeIndex].duration;
      this.keyframeIndex++;
    }

    // If past last keyframe, gesture is done
    if (this.keyframeIndex >= kf.length - 1 && this.keyframeElapsed >= kf[kf.length - 1].duration) {
      this.finishGesture();
      return this.output;
    }

    // Interpolate between current keyframe and next (or identity for last)
    const currentKF = kf[this.keyframeIndex];
    const nextKF = this.keyframeIndex < kf.length - 1 ? kf[this.keyframeIndex + 1] : null;
    const t = Math.min(this.keyframeElapsed / currentKF.duration, 1);

    // Collect all bone names from both keyframes
    const boneNames = new Set<string>();
    for (const name in currentKF.bones) boneNames.add(name);
    if (nextKF) {
      for (const name in nextKF.bones) boneNames.add(name);
    }

    for (const boneName of boneNames) {
      const fromQuat = currentKF.bones[boneName]?.rotation ?? I;
      const toQuat = nextKF?.bones[boneName]?.rotation ?? I;
      this.output[boneName] = slerpQuat(fromQuat, toQuat, t);
    }

    return this.output;
  }

  /** Whether a gesture is currently playing. */
  get isPlaying(): boolean {
    return this.current !== null;
  }

  /** Name of the current gesture, or null. */
  get currentGesture(): GestureType | null {
    return this.current?.name ?? null;
  }

  private startGesture(def: GestureDefinition): void {
    this.current = def;
    this.elapsed = 0;
    this.keyframeIndex = 0;
    this.keyframeElapsed = 0;
  }

  private finishGesture(): void {
    if (this.current) {
      this.recentHistory.push(this.current.name);
      if (this.recentHistory.length > GesturePlayer.MAX_HISTORY) {
        this.recentHistory.shift();
      }
      this.cooldowns.set(this.current.name, GesturePlayer.COOLDOWN_SEC);
      this.current = null;
    }
  }
}

// ============================================
// QUATERNION SLERP (MINIMAL, NO ALLOCATION)
// ============================================

function slerpQuat(a: Quat, b: Quat, t: number): Quat {
  let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];

  // Flip sign for shortest path
  let bx = b[0], by = b[1], bz = b[2], bw = b[3];
  if (dot < 0) {
    dot = -dot;
    bx = -bx; by = -by; bz = -bz; bw = -bw;
  }

  let s0: number, s1: number;
  if (dot > 0.9999) {
    // Linear interpolation for very close quaternions
    s0 = 1 - t;
    s1 = t;
  } else {
    const omega = Math.acos(dot);
    const sinOmega = Math.sin(omega);
    s0 = Math.sin((1 - t) * omega) / sinOmega;
    s1 = Math.sin(t * omega) / sinOmega;
  }

  return [
    s0 * a[0] + s1 * bx,
    s0 * a[1] + s1 * by,
    s0 * a[2] + s1 * bz,
    s0 * a[3] + s1 * bw,
  ];
}

// ============================================
// EXPORTS
// ============================================

export { GESTURE_DEFS };
