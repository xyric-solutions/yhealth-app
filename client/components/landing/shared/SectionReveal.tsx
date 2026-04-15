"use client";

import { forwardRef } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";

const defaultTransition = { duration: 0.6, ease: [0.4, 0, 0.2, 1] as const };

export interface SectionRevealProps extends Omit<HTMLMotionProps<"section">, "initial" | "whileInView" | "viewport"> {
  /** Vertical offset for entrance (default 40) */
  y?: number;
  /** Viewport margin (default "-80px") */
  viewportMargin?: string;
  children: React.ReactNode;
}

/**
 * Bevel-style section entrance: fades in and slides up when section enters viewport.
 * Respects reduced motion (no animation when preferred).
 */
export const SectionReveal = forwardRef<HTMLElement, SectionRevealProps>(function SectionReveal(
  {
    y = 40,
    viewportMargin = "-80px",
    children,
    className = "",
    ...rest
  },
  ref
) {
  const prefersReducedMotion = useReducedMotionSafe();
  const viewport = { once: true, margin: viewportMargin };

  return (
    <motion.section
      ref={ref}
      initial={prefersReducedMotion ? false : { opacity: 0, y }}
      whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={viewport}
      transition={defaultTransition}
      className={className}
      {...rest}
    >
      {children}
    </motion.section>
  );
});
