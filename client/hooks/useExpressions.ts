"use client";

/**
 * @file useExpressions Hook
 * @description Expression blend manager with crossfade transitions.
 * Only one emotion expression is active at a time. Smooth fade in/out 150-300ms.
 * Mouth (lip-sync) is applied separately in the RAF loop and doesn't conflict.
 */

import { useRef, useState, useCallback, type MutableRefObject } from "react";
import { lerp } from "@/lib/avatar/smoothing";
import {
  type AvatarExpression,
  type AvatarState,
  STATE_EXPRESSION_MAP,
  ALL_EMOTION_EXPRESSIONS,
} from "@/lib/avatar/vrmMappings";

// ============================================
// TYPES
// ============================================

interface ExpressionSlot {
  name: AvatarExpression;
  targetIntensity: number;
  currentIntensity: number;
}

export interface UseExpressionsOptions {
  expressionValuesRef: MutableRefObject<Record<string, number>>;
  defaultFadeMs?: number;
}

export interface UseExpressionsReturn {
  setExpression: (
    name: AvatarExpression,
    intensity?: number,
    fadeMs?: number
  ) => void;
  setState: (state: AvatarState) => void;
  /** Update body pose state without changing facial expression. */
  setStateWithoutExpression: (state: AvatarState) => void;
  currentExpression: AvatarExpression;
  currentState: AvatarState;
  /** Register this as the expressions tick function in the RAF loop. */
  tick: () => void;
}

// ============================================
// HOOK
// ============================================

export function useExpressions({
  expressionValuesRef,
  defaultFadeMs = 200,
}: UseExpressionsOptions): UseExpressionsReturn {
  // React state for UI overlay (changes infrequently)
  const [currentExpression, setCurrentExpression] =
    useState<AvatarExpression>("neutral");
  const [currentState, setCurrentState] = useState<AvatarState>("idle");

  // Active expression (fading in)
  const activeRef = useRef<ExpressionSlot>({
    name: "neutral",
    targetIntensity: 0,
    currentIntensity: 0,
  });

  // Previous expression (fading out)
  const previousRef = useRef<ExpressionSlot | null>(null);

  // Fade control
  const fadeProgressRef = useRef<number>(1); // 1 = complete
  const fadeSpeedRef = useRef<number>(0); // progress per frame (~16.67ms)

  // ---- Set Expression ----

  const setExpression = useCallback(
    (name: AvatarExpression, intensity = 1.0, fadeMs?: number) => {
      const fade = fadeMs ?? defaultFadeMs;
      const framesPerFade = Math.max(1, fade / 16.67);

      if (name === activeRef.current.name) {
        // Same expression — just update target intensity
        activeRef.current.targetIntensity = intensity;
        return;
      }

      // Move current active to previous (will fade out)
      previousRef.current = { ...activeRef.current };

      // Start new active (will fade in)
      activeRef.current = {
        name,
        targetIntensity: intensity,
        currentIntensity: 0,
      };

      fadeProgressRef.current = 0;
      fadeSpeedRef.current = 1 / framesPerFade;

      // Update React state for UI badge
      setCurrentExpression(name);
    },
    [defaultFadeMs]
  );

  // ---- Set State ----

  const setState = useCallback(
    (state: AvatarState) => {
      const mapping = STATE_EXPRESSION_MAP[state];
      if (mapping) {
        setExpression(mapping.expression, mapping.intensity, 250);
      }
      setCurrentState(state);
    },
    [setExpression]
  );

  // ---- Set State Without Expression (body pose only) ----

  const setStateWithoutExpression = useCallback(
    (state: AvatarState) => {
      setCurrentState(state);
    },
    []
  );

  // ---- Facial Asymmetry ----
  // Seeded per-expression random offsets for natural asymmetry.
  // Generated once per expression name, cached for the session.
  const asymmetryCache = useRef<Map<string, number>>(new Map());

  function getAsymmetryOffset(expressionName: string): number {
    const cached = asymmetryCache.current.get(expressionName);
    if (cached !== undefined) return cached;
    // Deterministic hash from expression name → [-0.05, +0.05]
    let hash = 0;
    for (let i = 0; i < expressionName.length; i++) {
      hash = ((hash << 5) - hash + expressionName.charCodeAt(i)) | 0;
    }
    const offset = ((hash % 100) / 100) * 0.1 - 0.05; // [-0.05, +0.05]
    asymmetryCache.current.set(expressionName, offset);
    return offset;
  }

  // ---- Tick (called each frame from RAF loop) ----

  const tick = useCallback(() => {
    // Advance fade
    if (fadeProgressRef.current < 1) {
      fadeProgressRef.current = Math.min(
        1,
        fadeProgressRef.current + fadeSpeedRef.current
      );
    }

    const progress = fadeProgressRef.current;
    const active = activeRef.current;
    const previous = previousRef.current;

    // Build expression values
    const values: Record<string, number> = {};

    // Reset all emotion expressions to 0 first
    for (const expr of ALL_EMOTION_EXPRESSIONS) {
      values[expr] = 0;
    }

    // Previous expression fading out
    if (previous && progress < 1) {
      const prevIntensity = previous.currentIntensity * (1 - progress);
      if (prevIntensity > 0.001) {
        values[previous.name] = prevIntensity;
      }
    } else if (progress >= 1) {
      // Fade complete — clear previous
      previousRef.current = null;
    }

    // Active expression fading in
    active.currentIntensity = lerp(0, active.targetIntensity, progress);
    if (active.currentIntensity > 0.001) {
      values[active.name] = active.currentIntensity;
    }

    // Apply facial asymmetry — subtle ±0.05 offset per expression for natural feel
    for (const expr of ALL_EMOTION_EXPRESSIONS) {
      if (values[expr] > 0.001) {
        const offset = getAsymmetryOffset(expr);
        values[expr] = Math.max(0, Math.min(1, values[expr] + offset));
      }
    }

    // Write to shared ref
    expressionValuesRef.current = values;
  }, [expressionValuesRef]);

  return {
    setExpression,
    setState,
    setStateWithoutExpression,
    currentExpression,
    currentState,
    tick,
  };
}
