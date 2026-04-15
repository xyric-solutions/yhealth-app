"use client";

import { useRef, useEffect } from "react";
import { useMotionValue, useSpring, MotionValue } from "framer-motion";

interface TiltOptions {
  maxTilt?: number; // Max rotation in degrees (default: 4)
  stiffness?: number; // Spring stiffness (default: 200)
  damping?: number; // Spring damping (default: 25)
}

interface TiltResult {
  rotateX: MotionValue<number>;
  rotateY: MotionValue<number>;
  ref: React.RefObject<HTMLElement>;
}

/**
 * Hook for 3D tilt/parallax effect based on cursor position
 * Returns motion values for rotateX and rotateY
 */
export function useTilt(options: TiltOptions = {}): TiltResult {
  const {
    maxTilt = 4,
    stiffness = 200,
    damping = 25,
  } = options;

  const ref = useRef<HTMLElement>(null);
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);

  const springRotateX = useSpring(rotateX, { stiffness, damping });
  const springRotateY = useSpring(rotateY, { stiffness, damping });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = e.clientX - centerX;
      const deltaY = e.clientY - centerY;

      // Normalize to -1 to 1 range
      const normalizedX = (deltaX / (rect.width / 2)) * -1; // Invert for natural tilt
      const normalizedY = (deltaY / (rect.height / 2));

      // Clamp and apply max tilt
      const tiltX = Math.max(-maxTilt, Math.min(maxTilt, normalizedY * maxTilt));
      const tiltY = Math.max(-maxTilt, Math.min(maxTilt, normalizedX * maxTilt));

      rotateX.set(tiltX);
      rotateY.set(tiltY);
    };

    const handleMouseLeave = () => {
      rotateX.set(0);
      rotateY.set(0);
    };

    element.addEventListener("mousemove", handleMouseMove);
    element.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      element.removeEventListener("mousemove", handleMouseMove);
      element.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [maxTilt, rotateX, rotateY]);

  return {
    rotateX: springRotateX,
    rotateY: springRotateY,
    ref: ref as React.RefObject<HTMLElement>,
  };
}

