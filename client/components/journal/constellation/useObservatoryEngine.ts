"use client";

/**
 * @file useObservatoryEngine
 * @description 30fps RAF loop that publishes rotation angle and parallax offset
 * as React state. Pauses rotation while mouse is over the constellation area.
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ============================================
// TYPES
// ============================================

export interface ObservatoryEngineState {
  rotationAngle: number;
  parallaxX: number;
  parallaxY: number;
}

interface EngineOptions {
  /** Pause rotation when true (e.g. mouse over stars) */
  pauseRotation: boolean;
  /** Container dimensions */
  width: number;
  height: number;
  /** Disable all animation (reduced motion) */
  disabled: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const ROTATION_SPEED = 0.001; // radians per frame (~3.6 deg/s at 30fps)
const PARALLAX_STRENGTH_X = 0.04;
const PARALLAX_STRENGTH_Y = 0.025;
const PARALLAX_LERP = 0.05;
const FRAME_INTERVAL = 1000 / 30; // 30fps

// ============================================
// HOOK
// ============================================

export function useObservatoryEngine({
  pauseRotation,
  width,
  height,
  disabled,
}: EngineOptions): ObservatoryEngineState {
  const [state, setState] = useState<ObservatoryEngineState>({
    rotationAngle: 0,
    parallaxX: 0,
    parallaxY: 0,
  });

  const rotationRef = useRef(0);
  const parallaxRef = useRef({ x: 0, y: 0 });
  const targetParallaxRef = useRef({ x: 0, y: 0 });
  const lastFrameRef = useRef(0);
  const rafRef = useRef(0);

  // Track mouse position for parallax
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (width === 0 || height === 0) return;
      const cx = width / 2;
      const cy = height / 2;
      targetParallaxRef.current = {
        x: (e.clientX - cx) * PARALLAX_STRENGTH_X,
        y: (e.clientY - cy) * PARALLAX_STRENGTH_Y,
      };
    },
    [width, height]
  );

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  // RAF loop
  useEffect(() => {
    if (disabled || width === 0 || height === 0) return;

    const tick = (time: number) => {
      // Throttle to ~30fps
      if (time - lastFrameRef.current < FRAME_INTERVAL) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      lastFrameRef.current = time;

      // Rotation
      if (!pauseRotation) {
        rotationRef.current += ROTATION_SPEED;
      }

      // Parallax lerp
      const p = parallaxRef.current;
      const t = targetParallaxRef.current;
      p.x += (t.x - p.x) * PARALLAX_LERP;
      p.y += (t.y - p.y) * PARALLAX_LERP;

      setState({
        rotationAngle: rotationRef.current,
        parallaxX: p.x,
        parallaxY: p.y,
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [disabled, pauseRotation, width, height]);

  return state;
}
