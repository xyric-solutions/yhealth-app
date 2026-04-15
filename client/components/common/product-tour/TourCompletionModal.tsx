"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PartyPopper } from "lucide-react";
import confetti from "canvas-confetti";
import { modalVariants } from "./tour-variants";
import { interpolateText } from "./tour-utils";
import type { TourStepConfig } from "./types";

interface TourCompletionModalProps {
  step: TourStepConfig;
  onComplete: () => void;
  userName?: string;
  visible: boolean;
  reducedMotion?: boolean;
}

/**
 * Fullscreen completion modal — the final step of the product tour.
 * Fires a confetti celebration and shows a motivational AI message.
 */
export function TourCompletionModal({
  step,
  onComplete,
  userName = "there",
  visible,
  reducedMotion = false,
}: TourCompletionModalProps) {
  const confettiFiredRef = useRef(false);

  const title = interpolateText(step.title, { firstName: userName });
  const description = interpolateText(step.description, { firstName: userName });
  const accentGradient = step.accentColor ?? "from-emerald-500 via-cyan-500 to-blue-500";

  // Fire confetti when modal becomes visible
  useEffect(() => {
    if (!visible || confettiFiredRef.current) return;
    confettiFiredRef.current = true;

    const colors = ["#10b981", "#06b6d4", "#3b82f6", "#a855f7", "#f59e0b"];

    // Main burst
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors,
    });

    // Side bursts after short delay
    const timer = setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ["#10b981", "#06b6d4"],
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ["#3b82f6", "#a855f7"],
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [visible]);

  // Reset confetti flag when not visible
  useEffect(() => {
    if (!visible) {
      confettiFiredRef.current = false;
    }
  }, [visible]);

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
          aria-labelledby="tour-completion-title"
          aria-describedby="tour-completion-description"
        >
          <div className="glass-card rounded-3xl p-10 max-w-lg w-full text-center border border-white/10 shadow-2xl relative overflow-hidden">
            {/* Background gradient orbs */}
            <div
              className={`absolute -top-24 -right-24 w-72 h-72 rounded-full bg-gradient-to-br ${accentGradient} opacity-10 blur-3xl pointer-events-none`}
            />
            <div
              className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 opacity-10 blur-3xl pointer-events-none"
            />

            {/* Icon */}
            <div className="relative mb-6 inline-flex">
              <div
                className={`flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br ${accentGradient} text-white shadow-lg`}
              >
                <PartyPopper className="w-10 h-10" />
              </div>
              {!reducedMotion && (
                <motion.div
                  className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${accentGradient} opacity-30`}
                  animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
            </div>

            {/* Title */}
            <h2
              id="tour-completion-title"
              className="text-3xl font-bold text-white mb-3 gradient-text-animated"
            >
              {title}
            </h2>

            {/* Description */}
            <p
              id="tour-completion-description"
              className="text-base text-slate-300 leading-relaxed mb-4 max-w-sm mx-auto"
            >
              {description}
            </p>

            {/* AI motivational message */}
            <p className="text-sm text-white/50 italic mb-8">
              &ldquo;You&rsquo;re ready. Let&rsquo;s build your best self.&rdquo;
            </p>

            {/* CTA */}
            <button
              onClick={onComplete}
              className={`text-base font-semibold text-white px-10 py-3.5 rounded-2xl bg-gradient-to-r ${accentGradient} hover:opacity-90 transition-opacity active:scale-[0.97] shadow-lg`}
              autoFocus
            >
              {step.ctaPrimary ?? "Go to Dashboard"}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
