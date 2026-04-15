"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ambientOrbVariants } from "./tour-variants";

interface TourAmbientBackgroundProps {
  visible: boolean;
  reducedMotion?: boolean;
}

/**
 * Subtle ambient aurora/orb animation displayed behind the tour overlay.
 * Adds a premium, atmospheric feel without distracting from content.
 * Disabled when prefers-reduced-motion is active.
 */
export function TourAmbientBackground({
  visible,
  reducedMotion = false,
}: TourAmbientBackgroundProps) {
  // Skip entirely for reduced motion
  if (reducedMotion) return null;

  return (
    <AnimatePresence>
      {visible && (
        <div className="fixed inset-0 z-[9997] pointer-events-none overflow-hidden">
          {/* Emerald orb — top right */}
          <motion.div
            className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-emerald-500/15 blur-[120px]"
            variants={ambientOrbVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.div
              className="w-full h-full"
              animate={{ x: [0, 30, -20, 0], y: [0, -20, 30, 0] }}
              transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>

          {/* Cyan orb — bottom left */}
          <motion.div
            className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-cyan-500/10 blur-[140px]"
            variants={ambientOrbVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.div
              className="w-full h-full"
              animate={{ x: [0, -25, 15, 0], y: [0, 25, -15, 0] }}
              transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>

          {/* Purple orb — center */}
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-purple-500/8 blur-[100px]"
            variants={ambientOrbVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.div
              className="w-full h-full"
              animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
