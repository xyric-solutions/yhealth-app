"use client";

import { useRef, useEffect } from "react";
import { useMotionValue, useSpring, MotionValue } from "framer-motion";

interface MagneticOptions {
  strength?: number; // Max distance in pixels (default: 6)
  stiffness?: number; // Spring stiffness (default: 300)
  damping?: number; // Spring damping (default: 30)
}

interface MagneticResult {
  x: MotionValue<number>;
  y: MotionValue<number>;
  ref: React.RefObject<HTMLElement>;
}

/**
 * Hook for magnetic hover effect - card moves towards cursor
 * Returns motion values and ref to attach to element
 */
export function useMagnetic(options: MagneticOptions = {}): MagneticResult {
  const {
    strength = 6,
    stiffness = 300,
    damping = 30,
  } = options;

  const ref = useRef<HTMLElement>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springX = useSpring(x, { stiffness, damping });
  const springY = useSpring(y, { stiffness, damping });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleMouseEnter = () => {
      // Element is now being tracked
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = e.clientX - centerX;
      const deltaY = e.clientY - centerY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (distance > 0) {
        const normalizedX = deltaX / distance;
        const normalizedY = deltaY / distance;
        const moveDistance = Math.min(distance, strength);

        x.set(normalizedX * moveDistance);
        y.set(normalizedY * moveDistance);
      }
    };

    const handleMouseLeave = () => {
      x.set(0);
      y.set(0);
    };

    element.addEventListener("mouseenter", handleMouseEnter);
    element.addEventListener("mousemove", handleMouseMove);
    element.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      element.removeEventListener("mouseenter", handleMouseEnter);
      element.removeEventListener("mousemove", handleMouseMove);
      element.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [strength, x, y]);

  return {
    x: springX,
    y: springY,
    ref: ref as React.RefObject<HTMLElement>,
  };
}

