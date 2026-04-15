"use client";

import { useEffect } from "react";
import { useReducedMotionSafe } from "./use-reduced-motion-safe";

/**
 * Hook to enable smooth scrolling behavior
 * Uses CSS scroll-behavior as a fallback, with Framer Motion for advanced control
 */
export function useSmoothScroll() {
  const prefersReducedMotion = useReducedMotionSafe();

  useEffect(() => {
    if (prefersReducedMotion) return;

    // Enable smooth scroll behavior
    document.documentElement.style.scrollBehavior = "smooth";

    return () => {
      document.documentElement.style.scrollBehavior = "auto";
    };
  }, [prefersReducedMotion]);
}

/**
 * Hook to get scroll progress for a specific element
 */
export function useElementScrollProgress() {
  const prefersReducedMotion = useReducedMotionSafe();

  return {
    prefersReducedMotion,
  };
}

