/**
 * @file Motion tokens & animation utilities for Money Map
 * @description Shared spring configs, variants, hooks, and components
 */

"use client";

import { useEffect, useState, useRef, type ReactNode } from "react";
import { motion, useInView, type Variants } from "framer-motion";

// ============================================
// SPRING CONFIGS
// ============================================

export const spring = {
  soft:   { type: "spring" as const, stiffness: 200, damping: 25 },
  snappy: { type: "spring" as const, stiffness: 400, damping: 30 },
  bouncy: { type: "spring" as const, stiffness: 350, damping: 20 },
  slow:   { type: "spring" as const, stiffness: 100, damping: 20 },
};

// ============================================
// ANIMATION VARIANTS
// ============================================

export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

export const fadeSlideUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: spring.soft },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  show: { opacity: 1, scale: 1, transition: spring.snappy },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.4 } },
};

export const slideFromRight: Variants = {
  hidden: { opacity: 0, x: 30 },
  show: { opacity: 1, x: 0, transition: spring.soft },
};

// ============================================
// CHART COLORS (design system)
// ============================================

export const CHART_COLORS = [
  "#059669", // Emerald — Food
  "#0284c7", // Sky — Transport
  "#f59e0b", // Amber — Bills
  "#8b5cf6", // Violet — Entertainment
  "#f43f5e", // Rose — Shopping
  "#06b6d4", // Cyan — Subscriptions
  "#84cc16", // Lime — Savings
  "#fb923c", // Orange — Health
  "#ec4899", // Pink
  "#14b8a6", // Teal
];

// ============================================
// HOOKS
// ============================================

/**
 * Animated count-up hook. Returns a smoothly animated number.
 */
export function useCountUp(target: number, duration = 1200): number {
  const [value, setValue] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = target;
    const startTime = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(from + (target - from) * eased);
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [target, duration]);

  return value;
}

/**
 * Format a number as currency string
 */
export function formatCurrency(value: number, compact = false): string {
  if (compact) {
    if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  }
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Animated currency display component
 */
export function AnimatedCurrency({
  value,
  className = "",
  compact = false,
}: {
  value: number;
  className?: string;
  compact?: boolean;
}) {
  const displayed = useCountUp(value);
  return <span className={className}>{formatCurrency(displayed, compact)}</span>;
}

/**
 * Viewport-triggered animated section wrapper.
 * Children stagger in when the section scrolls into view.
 */
export function AnimatedSection({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-8% 0px" });

  // eslint-disable-next-line react-hooks/refs -- framer-motion API requires ref pass during render
  return motion.div({
    ref,
    variants: staggerContainer,
    initial: "hidden",
    animate: isInView ? "show" : "hidden",
    className,
    style: delay ? { transitionDelay: `${delay}ms` } : undefined,
    children,
  });
}
