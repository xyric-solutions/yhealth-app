"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { ScrollTrigger } from "@/lib/gsap-init";
import { useReducedMotionSafe } from "./use-reduced-motion-safe";

interface ScrollVelocityState {
  /** Normalized velocity 0–1 (clamped) */
  velocity: number;
  /** Raw velocity in px/s */
  rawVelocity: number;
  /** Scroll direction */
  direction: "up" | "down" | "idle";
  /** Page scroll progress 0–1 */
  progress: number;
}

const MAX_VELOCITY = 3000; // px/s cap for normalization

/**
 * Exposes scroll velocity, direction, and progress via GSAP ScrollTrigger.
 * Returns refs for 60fps animation consumers and state for UI consumers.
 */
export function useScrollVelocity() {
  const prefersReducedMotion = useReducedMotionSafe();
  const velocityRef = useRef(0);
  const rawVelocityRef = useRef(0);
  const directionRef = useRef<"up" | "down" | "idle">("idle");
  const progressRef = useRef(0);

  const [state, setState] = useState<ScrollVelocityState>({
    velocity: 0,
    rawVelocity: 0,
    direction: "idle",
    progress: 0,
  });

  // Throttled state setter — updates UI consumers at ~15fps max
  const lastUpdateRef = useRef(0);
  const rafRef = useRef<number>(0);

  const scheduleStateUpdate = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      const now = Date.now();
      if (now - lastUpdateRef.current > 66) {
        setState({
          velocity: velocityRef.current,
          rawVelocity: rawVelocityRef.current,
          direction: directionRef.current,
          progress: progressRef.current,
        });
        lastUpdateRef.current = now;
      }
      rafRef.current = 0;
    });
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const st = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate(self) {
        const raw = Math.abs(self.getVelocity());
        const normalized = Math.min(raw / MAX_VELOCITY, 1);
        const dir = self.direction === -1 ? "up" : self.direction === 1 ? "down" : "idle";

        velocityRef.current = normalized;
        rawVelocityRef.current = raw;
        directionRef.current = dir;
        progressRef.current = self.progress;

        scheduleStateUpdate();
      },
    });

    return () => {
      st.kill();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [prefersReducedMotion, scheduleStateUpdate]);

  return {
    ...state,
    // Refs for animation consumers (no re-render overhead)
    velocityRef,
    rawVelocityRef,
    directionRef,
    progressRef,
  };
}
