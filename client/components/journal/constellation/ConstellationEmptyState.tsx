"use client";

/**
 * @file ConstellationEmptyState Component
 * @description Observatory-styled empty state with Cinzel typography,
 * pulsing star, and CTA to create the first reflection.
 */

import { motion } from "framer-motion";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConstellationEmptyStateProps {
  onCreateEntry: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConstellationEmptyState({
  onCreateEntry,
}: ConstellationEmptyStateProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
      {/* Pulsing star */}
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative mb-8"
      >
        {/* Outer glow rings */}
        <div className="absolute inset-0 -m-8 rounded-full bg-purple-500/8 animate-pulse" />
        <div className="absolute inset-0 -m-4 rounded-full bg-purple-500/12 animate-pulse [animation-delay:200ms]" />

        {/* Star core */}
        <div
          className="relative w-3 h-3 rounded-full bg-white"
          style={{
            boxShadow:
              "0 0 20px rgba(139, 92, 246, 0.6), 0 0 60px rgba(139, 92, 246, 0.3), 0 0 100px rgba(139, 92, 246, 0.15)",
            animation: "constellation-core-pulse 3s ease-in-out infinite",
          }}
        />
      </motion.div>

      {/* Title */}
      <motion.h2
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="observatory-font-display text-center bg-linear-to-r from-white via-purple-200 to-indigo-200 bg-clip-text text-transparent mb-3"
        style={{ fontSize: 22, letterSpacing: "0.12em" }}
      >
        YOUR THOUGHTS WILL BECOME STARS
      </motion.h2>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35 }}
        className="observatory-font-body text-white/35 mb-8"
        style={{ fontSize: 13, letterSpacing: "0.04em" }}
      >
        Begin your inner journey
      </motion.p>

      {/* CTA button */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <button
          onClick={onCreateEntry}
          className="observatory-font-display px-6 py-2.5 rounded-full border border-purple-500/30 bg-purple-500/10 backdrop-blur-sm text-purple-200 hover:bg-purple-500/20 hover:border-purple-400/50 transition-all duration-300"
          style={{ fontSize: 10, letterSpacing: "0.18em" }}
        >
          CREATE YOUR FIRST REFLECTION
        </button>
      </motion.div>
    </div>
  );
}
