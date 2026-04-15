"use client";

import { useCallback, useRef, type RefObject } from "react";
import { useMotionValue, useSpring, type MotionValue } from "framer-motion";
import { useReducedMotionSafe } from "./use-reduced-motion-safe";
import { useIsMobile } from "./use-is-mobile";

interface MouseParallaxOptions {
  /** Max pixel displacement (default: 20) */
  strength?: number;
  /** Spring damping (default: 30) */
  damping?: number;
  /** Spring stiffness (default: 150) */
  stiffness?: number;
}

interface MouseParallaxResult {
  /** Spring-smoothed X displacement (MotionValue for style binding) */
  x: MotionValue<number>;
  /** Spring-smoothed Y displacement (MotionValue for style binding) */
  y: MotionValue<number>;
  /** Raw normalized X (-1 to 1) ref for GSAP consumers */
  normalizedXRef: React.RefObject<number>;
  /** Raw normalized Y (-1 to 1) ref for GSAP consumers */
  normalizedYRef: React.RefObject<number>;
  /** Attach to container onMouseMove */
  handleMouseMove: (e: React.MouseEvent) => void;
  /** Attach to container onMouseLeave */
  handleMouseLeave: () => void;
}

/**
 * Tracks mouse position relative to a container and provides
 * smoothed parallax displacement values.
 */
export function useMouseParallax(
  containerRef: RefObject<HTMLElement | null>,
  options: MouseParallaxOptions = {}
): MouseParallaxResult {
  const { strength = 20, damping = 30, stiffness = 150 } = options;
  const prefersReducedMotion = useReducedMotionSafe();
  const { isMobile } = useIsMobile();

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness, damping });
  const y = useSpring(rawY, { stiffness, damping });

  const normalizedXRef = useRef(0);
  const normalizedYRef = useRef(0);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (prefersReducedMotion || isMobile) return;
      const el = containerRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const nx = (e.clientX - cx) / (rect.width / 2); // -1 to 1
      const ny = (e.clientY - cy) / (rect.height / 2);

      normalizedXRef.current = nx;
      normalizedYRef.current = ny;
      rawX.set(nx * strength);
      rawY.set(ny * strength);
    },
    [containerRef, strength, prefersReducedMotion, isMobile, rawX, rawY]
  );

  const handleMouseLeave = useCallback(() => {
    normalizedXRef.current = 0;
    normalizedYRef.current = 0;
    rawX.set(0);
    rawY.set(0);
  }, [rawX, rawY]);

  return { x, y, normalizedXRef, normalizedYRef, handleMouseMove, handleMouseLeave };
}
