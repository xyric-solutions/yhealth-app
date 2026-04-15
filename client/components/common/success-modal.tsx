"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Sparkles,
  Trophy,
  Target,
  Rocket,
  PartyPopper,
  Star,
  X
} from "lucide-react";
import { useEffect, useState } from "react";
import confetti from "canvas-confetti";

export interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "goals" | "onboarding";
  title?: string;
  message?: string;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

export function SuccessModal({
  isOpen,
  onClose,
  type,
  title,
  message,
  autoClose = true,
  autoCloseDelay = 3000,
}: SuccessModalProps) {
  const [_showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true);

      // Trigger confetti
      const duration = 2000;
      const end = Date.now() + duration;

      const colors = type === "goals"
        ? ["#22c55e", "#10b981", "#14b8a6", "#06b6d4"]
        : ["#a855f7", "#ec4899", "#f43f5e", "#f97316"];

      (function frame() {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: colors
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: colors
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      }());

      // Auto close
      if (autoClose) {
        const timer = setTimeout(() => {
          onClose();
        }, autoCloseDelay);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, autoClose, autoCloseDelay, onClose, type]);

  const config = {
    goals: {
      icon: Target,
      gradient: "from-emerald-500 to-teal-500",
      bgGradient: "from-emerald-500/20 to-teal-500/20",
      borderColor: "border-emerald-500/30",
      title: title || "Goals Saved Successfully!",
      message: message || "Your health goals have been saved. Let's make them happen!",
      accentColor: "text-emerald-400",
      particles: ["#22c55e", "#10b981", "#14b8a6"],
    },
    onboarding: {
      icon: Rocket,
      gradient: "from-purple-500 to-pink-500",
      bgGradient: "from-purple-500/20 to-pink-500/20",
      borderColor: "border-purple-500/30",
      title: title || "You're All Set!",
      message: message || "Your personalized health journey begins now. Let's go!",
      accentColor: "text-purple-400",
      particles: ["#a855f7", "#ec4899", "#f43f5e"],
    },
  };

  const { icon: Icon, gradient, bgGradient, borderColor, accentColor } = config[type];
  const displayTitle = config[type].title;
  const displayMessage = config[type].message;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className={`
                relative w-full max-w-md pointer-events-auto
                bg-slate-900/95 backdrop-blur-xl rounded-3xl
                border ${borderColor} shadow-2xl overflow-hidden
              `}
            >
              {/* Gradient Background */}
              <div className={`absolute inset-0 bg-gradient-to-br ${bgGradient} opacity-30`} />

              {/* Animated Background Orbs */}
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.5, 0.3],
                }}
                transition={{ duration: 3, repeat: Infinity }}
                className={`absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br ${gradient} rounded-full blur-3xl`}
              />
              <motion.div
                animate={{
                  scale: [1.2, 1, 1.2],
                  opacity: [0.2, 0.4, 0.2],
                }}
                transition={{ duration: 4, repeat: Infinity }}
                className={`absolute -bottom-20 -left-20 w-40 h-40 bg-gradient-to-br ${gradient} rounded-full blur-3xl`}
              />

              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors z-10"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>

              {/* Content */}
              <div className="relative p-8 text-center">
                {/* Animated Icon */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", delay: 0.1, damping: 12 }}
                  className="relative mx-auto mb-6"
                >
                  {/* Outer Ring */}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                    className={`absolute inset-0 w-24 h-24 rounded-full border-2 border-dashed ${borderColor}`}
                  />

                  {/* Icon Container */}
                  <div className={`
                    w-24 h-24 rounded-full bg-gradient-to-br ${gradient}
                    flex items-center justify-center shadow-lg
                  `}>
                    <Icon className="w-12 h-12 text-white" />
                  </div>

                  {/* Success Check Badge */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3, type: "spring" }}
                    className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg"
                  >
                    <Check className="w-5 h-5 text-white" />
                  </motion.div>
                </motion.div>

                {/* Floating Stars */}
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{
                      opacity: [0, 1, 0],
                      scale: [0.5, 1, 0.5],
                      y: [-10, -30, -50],
                      x: [0, (i - 2) * 20, (i - 2) * 40],
                    }}
                    transition={{
                      delay: 0.2 + i * 0.1,
                      duration: 1.5,
                      repeat: Infinity,
                      repeatDelay: 1,
                    }}
                    className="absolute top-1/3 left-1/2"
                  >
                    <Star className={`w-4 h-4 ${accentColor} fill-current`} />
                  </motion.div>
                ))}

                {/* Title */}
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-2xl sm:text-3xl font-bold text-white mb-3"
                >
                  {displayTitle}
                </motion.h2>

                {/* Message */}
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-slate-400 text-base mb-6"
                >
                  {displayMessage}
                </motion.p>

                {/* Celebration Icons */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 }}
                  className="flex items-center justify-center gap-4 mb-6"
                >
                  <motion.div
                    animate={{ rotate: [-10, 10, -10] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  >
                    <PartyPopper className={`w-6 h-6 ${accentColor}`} />
                  </motion.div>
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                  >
                    <Trophy className="w-8 h-8 text-yellow-400" />
                  </motion.div>
                  <motion.div
                    animate={{ rotate: [10, -10, 10] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  >
                    <Sparkles className={`w-6 h-6 ${accentColor}`} />
                  </motion.div>
                </motion.div>

                {/* Continue Button */}
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  onClick={onClose}
                  className={`
                    w-full py-3.5 px-6 rounded-xl font-semibold text-white
                    bg-gradient-to-r ${gradient}
                    hover:opacity-90 transition-all duration-200
                    shadow-lg hover:shadow-xl
                  `}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Continue
                </motion.button>

                {/* Auto-close indicator */}
                {autoClose && (
                  <motion.div
                    initial={{ width: "100%" }}
                    animate={{ width: "0%" }}
                    transition={{ duration: autoCloseDelay / 1000, ease: "linear" }}
                    className={`absolute bottom-0 left-0 h-1 bg-gradient-to-r ${gradient} rounded-b-3xl`}
                  />
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
