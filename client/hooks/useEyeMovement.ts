"use client";

/**
 * @file useEyeMovement Hook
 * @description Procedural eye saccade and gaze system. Writes lookLeft/Right/Up/Down
 * expression values to a shared ref that the RAF loop reads. Emotion-modulated
 * interval and amplitude. State-aware gaze bias (more eye contact when listening).
 *
 * All state lives in refs — zero React re-renders.
 */

import { useRef, useCallback, type MutableRefObject } from "react";
import { clamp, attackRelease } from "@/lib/avatar/smoothing";
import {
  EMOTION_MODULATORS,
  type EmotionModulators,
} from "@/lib/avatar/emotionModulation";

// ============================================
// TYPES
// ============================================

export interface UseEyeMovementOptions {
  /** Shared ref — this hook writes { lookLeft, lookRight, lookUp, lookDown } each tick. */
  eyeValuesRef: MutableRefObject<Record<string, number>>;
  /** Current emotion name — drives saccade interval/amplitude. */
  emotionModRef: MutableRefObject<string>;
  /** Current avatar state — drives gaze bias (listening = more eye contact). */
  avatarStateRef: MutableRefObject<string>;
}

export interface UseEyeMovementReturn {
  /** Register this as the eye movement tick in the RAF loop. */
  tick: () => void;
}

// ============================================
// CONSTANTS
// ============================================

/** Max expression value for look directions (0-1 range). */
const MAX_LOOK_VALUE = 0.4;

/** How fast eyes snap to new target (attack) vs drift (release). */
const EYE_ATTACK = 0.25;
const EYE_RELEASE = 0.06;

// ============================================
// HOOK
// ============================================

export function useEyeMovement({
  eyeValuesRef,
  emotionModRef,
  avatarStateRef,
}: UseEyeMovementOptions): UseEyeMovementReturn {
  // Gaze state (all refs, no React state)
  const nextSaccadeRef = useRef<number>(0); // when next eye shift fires
  const gazeTargetRef = useRef<{ yaw: number; pitch: number }>({ yaw: 0, pitch: 0 });
  const gazeCurrentRef = useRef<{ yaw: number; pitch: number }>({ yaw: 0, pitch: 0 });

  const tick = useCallback(() => {
    const elapsed = performance.now() / 1000;
    const mod: EmotionModulators =
      EMOTION_MODULATORS[emotionModRef.current] || EMOTION_MODULATORS.neutral;
    const state = avatarStateRef.current;

    // ---- Schedule new saccade ----
    if (elapsed >= nextSaccadeRef.current) {
      const [minInterval, maxInterval] = mod.saccadeInterval;
      nextSaccadeRef.current =
        elapsed + minInterval + Math.random() * (maxInterval - minInterval);

      const [minAmp, maxAmp] = mod.saccadeAmplitude;
      const amp = minAmp + Math.random() * (maxAmp - minAmp);

      // Pick gaze target based on weighted distribution
      const roll = Math.random();
      let targetYaw = 0;
      let targetPitch = 0;

      if (roll < 0.7) {
        // 70%: small offset from center (maintaining eye contact)
        targetYaw = (Math.random() - 0.5) * amp * 0.5;
        targetPitch = (Math.random() - 0.5) * amp * 0.3;
      } else if (roll < 0.9) {
        // 20%: look away to one side
        targetYaw = (Math.random() > 0.5 ? 1 : -1) * amp;
        targetPitch = (Math.random() - 0.5) * amp * 0.4;
      } else {
        // 10%: look down slightly (thoughtful)
        targetYaw = (Math.random() - 0.5) * amp * 0.3;
        targetPitch = -amp * 0.6;
      }

      // State-linked gaze bias
      if (state === "listening") {
        // More eye contact — pull toward center
        targetYaw *= 0.4;
        targetPitch *= 0.4;
      } else if (state === "thinking") {
        // Bias downward
        targetPitch -= 2.0;
      } else if (state === "speaking") {
        // Allow more look-away (natural for speakers)
        targetYaw *= 1.3;
      }

      gazeTargetRef.current = { yaw: targetYaw, pitch: targetPitch };
    }

    // ---- Smooth interpolation toward target ----
    const current = gazeCurrentRef.current;
    const target = gazeTargetRef.current;

    current.yaw = attackRelease(current.yaw, target.yaw, EYE_ATTACK, EYE_RELEASE);
    current.pitch = attackRelease(
      current.pitch,
      target.pitch,
      EYE_ATTACK,
      EYE_RELEASE,
    );

    // ---- Convert yaw/pitch to lookLeft/Right/Up/Down values ----
    // Yaw: negative = look left, positive = look right
    // Pitch: negative = look down, positive = look up
    const lookLeft = clamp(-current.yaw / 10, 0, MAX_LOOK_VALUE);
    const lookRight = clamp(current.yaw / 10, 0, MAX_LOOK_VALUE);
    const lookUp = clamp(current.pitch / 10, 0, MAX_LOOK_VALUE);
    const lookDown = clamp(-current.pitch / 10, 0, MAX_LOOK_VALUE);

    eyeValuesRef.current = { lookLeft, lookRight, lookUp, lookDown };
  }, [eyeValuesRef, emotionModRef, avatarStateRef]);

  return { tick };
}
