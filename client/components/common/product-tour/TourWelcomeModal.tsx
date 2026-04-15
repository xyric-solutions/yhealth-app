"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { modalVariants } from "./tour-variants";
import { interpolateText } from "./tour-utils";
import type { TourStepConfig } from "./types";

interface TourWelcomeModalProps {
  step: TourStepConfig;
  onStart: () => void;
  onSkip: () => void;
  userName?: string;
  visible: boolean;
  reducedMotion?: boolean;
}

/**
 * Fullscreen welcome modal — the first step of the product tour.
 * Centered modal with gradient accents, AI-friendly tone, and Start/Skip CTAs.
 */
export function TourWelcomeModal({
  step,
  onStart,
  onSkip,
  userName = "there",
  visible,
  reducedMotion = false,
}: TourWelcomeModalProps) {
  const title = interpolateText(step.title, { firstName: userName });
  const description = interpolateText(step.description, { firstName: userName });
  const accentGradient = step.accentColor ?? "from-emerald-500 to-cyan-500";

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[10001] flex items-center justify-center p-6"
          variants={reducedMotion ? undefined : modalVariants}
          initial={reducedMotion ? { opacity: 1 } : "hidden"}
          animate={reducedMotion ? { opacity: 1 } : "visible"}
          exit={reducedMotion ? { opacity: 0 } : "exit"}
          role="alertdialog"
          aria-labelledby="tour-welcome-title"
          aria-describedby="tour-welcome-description"
        >
          <div className="glass-card rounded-3xl p-10 max-w-lg w-full text-center border border-white/10 shadow-2xl relative overflow-hidden">
            {/* Background gradient orb */}
            <div
              className={`absolute -top-20 -right-20 w-60 h-60 rounded-full bg-gradient-to-br ${accentGradient} opacity-10 blur-3xl pointer-events-none`}
            />
            <div
              className={`absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 opacity-10 blur-3xl pointer-events-none`}
            />

            {/* Icon */}
            <div className="relative mb-6 inline-flex">
              <div
                className={`flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br ${accentGradient} text-white shadow-lg`}
              >
                <Sparkles className="w-10 h-10" />
              </div>
              {/* Pulse ring */}
              {!reducedMotion && (
                <div
                  className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${accentGradient} opacity-30 animate-ping`}
                  style={{ animationDuration: "2s" }}
                />
              )}
            </div>

            {/* Title */}
            <h2
              id="tour-welcome-title"
              className="text-3xl font-bold text-white mb-3 gradient-text-animated"
            >
              {title}
            </h2>

            {/* Description */}
            <p
              id="tour-welcome-description"
              className="text-base text-slate-300 leading-relaxed mb-8 max-w-sm mx-auto"
            >
              {description}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={onStart}
                className={`flex items-center gap-2 text-base font-semibold text-white px-8 py-3.5 rounded-2xl bg-gradient-to-r ${accentGradient} hover:opacity-90 transition-opacity active:scale-[0.97] shadow-lg`}
                autoFocus
              >
                {step.ctaPrimary ?? "Start Tour"}
              </button>
              <button
                onClick={onSkip}
                className="text-sm text-white/60 hover:text-white/80 transition-colors px-4 py-2"
              >
                {step.ctaSecondary ?? "Skip for now"}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
