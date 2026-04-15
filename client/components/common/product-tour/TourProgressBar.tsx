"use client";

import { motion } from "framer-motion";
import { dotVariants } from "./tour-variants";

interface TourProgressBarProps {
  currentStep: number;
  totalSteps: number;
  reducedMotion?: boolean;
}

/**
 * Dot-based step progress indicator for the product tour.
 */
export function TourProgressBar({
  currentStep,
  totalSteps,
  reducedMotion = false,
}: TourProgressBarProps) {
  return (
    <div
      className="flex items-center gap-1.5"
      role="progressbar"
      aria-valuenow={currentStep + 1}
      aria-valuemin={1}
      aria-valuemax={totalSteps}
      aria-label={`Tour step ${currentStep + 1} of ${totalSteps}`}
    >
      {Array.from({ length: totalSteps }, (_, i) => {
        const state =
          i < currentStep ? "completed" : i === currentStep ? "active" : "inactive";

        return (
          <motion.div
            key={i}
            className={`rounded-full ${
              state === "active"
                ? "w-6 h-2 bg-gradient-to-r from-cyan-500 to-blue-500"
                : "w-2 h-2 bg-white/30"
            }`}
            variants={reducedMotion ? undefined : dotVariants}
            animate={reducedMotion ? undefined : state}
            layout={!reducedMotion}
            transition={
              reducedMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 500, damping: 30 }
            }
          />
        );
      })}
    </div>
  );
}
