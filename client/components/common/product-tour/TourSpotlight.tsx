"use client";

import { motion, AnimatePresence } from "framer-motion";
import { spotlightRingVariants } from "./tour-variants";

interface TourSpotlightProps {
  /** Bounding rect of the target element */
  targetRect: DOMRect | null;
  /** Tailwind gradient class for the accent glow */
  accentColor?: string;
  /** Whether the spotlight is visible */
  visible: boolean;
  /** Padding around the target */
  padding?: number;
  /** Whether to skip animations */
  reducedMotion?: boolean;
}

/**
 * Animated neon ring that highlights the spotlighted element.
 * Uses existing glow/neon CSS patterns from the design system.
 */
export function TourSpotlight({
  targetRect,
  accentColor = "from-cyan-500 to-blue-500",
  visible,
  padding = 12,
  reducedMotion = false,
}: TourSpotlightProps) {
  if (!targetRect) return null;

  const style = {
    top: targetRect.y - padding,
    left: targetRect.x - padding,
    width: targetRect.width + padding * 2,
    height: targetRect.height + padding * 2,
    transition: reducedMotion
      ? "none"
      : "top 0.4s cubic-bezier(0.4, 0, 0.2, 1), left 0.4s cubic-bezier(0.4, 0, 0.2, 1), width 0.4s cubic-bezier(0.4, 0, 0.2, 1), height 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed z-[9999] pointer-events-none rounded-[20px]"
          style={style}
          variants={reducedMotion ? undefined : spotlightRingVariants}
          initial={reducedMotion ? { opacity: 1 } : "hidden"}
          animate={reducedMotion ? { opacity: 1 } : "visible"}
          exit={reducedMotion ? { opacity: 0 } : "exit"}
          aria-hidden="true"
        >
          {/* Outer glow ring */}
          <div
            className={`absolute -inset-1 rounded-[22px] bg-gradient-to-r ${accentColor} opacity-30 blur-md`}
          />
          {/* Inner border ring */}
          <div
            className={`absolute inset-0 rounded-[20px] border-2 border-white/20`}
          />
          {/* Pulse animation ring */}
          <div
            className={`absolute -inset-2 rounded-[24px] bg-gradient-to-r ${accentColor} opacity-10 animate-pulse`}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
