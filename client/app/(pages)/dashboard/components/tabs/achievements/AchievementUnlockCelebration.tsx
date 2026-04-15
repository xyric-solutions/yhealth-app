"use client";

import { useEffect, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Zap, X } from "lucide-react";
import confetti from "canvas-confetti";
import type { Achievement } from "./types";
import { rarityGlowStyles, rarityHexColors } from "./constants";

interface AchievementUnlockCelebrationProps {
  achievement: Achievement | null;
  onDismiss: () => void;
}

export function AchievementUnlockCelebration({
  achievement,
  onDismiss,
}: AchievementUnlockCelebrationProps) {
  const prefersReducedMotion = useReducedMotion();

  const fireConfetti = useCallback(() => {
    if (prefersReducedMotion || !achievement) return;

    const [c1, c2, c3] = rarityHexColors[achievement.rarity];
    const isLegendary = achievement.rarity === "legendary";
    const isEpic = achievement.rarity === "epic";
    const colors = isLegendary
      ? [c1, c2, c3, "#fde047", "#ffffff"]
      : [c1, c2, "#ffffff"];

    // Central burst
    confetti({
      particleCount: isLegendary ? 150 : isEpic ? 80 : 50,
      spread: isLegendary ? 100 : 70,
      origin: { y: 0.45, x: 0.5 },
      colors,
      ticks: 200,
      gravity: 0.8,
      scalar: 1.1,
      disableForReducedMotion: true,
    });

    if (isLegendary) {
      // Delayed side cannons
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 60,
          origin: { x: 0, y: 0.55 },
          colors,
          ticks: 180,
          disableForReducedMotion: true,
        });
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 60,
          origin: { x: 1, y: 0.55 },
          colors,
          ticks: 180,
          disableForReducedMotion: true,
        });
      }, 250);
      // Second wave
      setTimeout(() => {
        confetti({
          particleCount: 40,
          spread: 120,
          origin: { y: 0.5, x: 0.5 },
          colors: [c1, "#ffffff"],
          startVelocity: 25,
          ticks: 150,
          disableForReducedMotion: true,
        });
      }, 600);
    }
  }, [achievement, prefersReducedMotion]);

  useEffect(() => {
    if (!achievement) return;
    const t1 = setTimeout(fireConfetti, 150);
    const t2 = setTimeout(onDismiss, 4500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [achievement, fireConfetti, onDismiss]);

  if (!achievement) return null;
  const [c1, c2] = rarityHexColors[achievement.rarity];

  return (
    <AnimatePresence>
      {achievement && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={onDismiss}
        >
          {/* Backdrop with vignette */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.9) 100%)",
              backdropFilter: "blur(12px)",
            }}
          />

          {/* Content */}
          <motion.div
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { scale: 0.6, opacity: 0, y: 30 }
            }
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { scale: 0.92, opacity: 0, y: -10 }
            }
            transition={
              prefersReducedMotion
                ? { duration: 0.15 }
                : { type: "spring", stiffness: 180, damping: 16 }
            }
            onClick={(e) => e.stopPropagation()}
            className="relative text-center max-w-[360px] w-full"
          >
            {/* Dismiss */}
            <button
              onClick={onDismiss}
              aria-label="Dismiss"
              className="absolute -top-3 -right-3 z-10 p-2 rounded-full bg-white/[0.08] hover:bg-white/[0.15] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4 text-white/50" />
            </button>

            {/* ── Pulsing glow rings ── */}
            <div className="relative flex items-center justify-center mb-8">
              {/* Outer ring */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{
                  scale: [1, 1.35, 1],
                  opacity: [0.15, 0.04, 0.15],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute w-48 h-48 rounded-full pointer-events-none"
                style={{
                  background: `radial-gradient(circle, ${c1}22, transparent 70%)`,
                }}
              />
              {/* Inner ring */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.25, 0.08, 0.25],
                }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: 0.4,
                }}
                className="absolute w-32 h-32 rounded-full pointer-events-none"
                style={{
                  background: `radial-gradient(circle, ${c2}28, transparent 70%)`,
                }}
              />

              {/* Icon */}
              <motion.div
                initial={
                  prefersReducedMotion ? {} : { scale: 0, rotate: -120 }
                }
                animate={{ scale: 1, rotate: 0 }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : {
                        type: "spring",
                        stiffness: 160,
                        damping: 12,
                        delay: 0.2,
                      }
                }
                className={`relative w-[120px] h-[120px] rounded-[28px] flex items-center justify-center text-[64px]
                  border border-white/[0.1] ${rarityGlowStyles[achievement.rarity]}`}
                style={{
                  background: `linear-gradient(135deg, ${c1}18, ${c2}10)`,
                  boxShadow: `0 16px 48px -12px ${c1}30, inset 0 1px 0 ${c1}15`,
                }}
              >
                {achievement.icon}
              </motion.div>
            </div>

            {/* Label */}
            <motion.div
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-3"
              style={{
                background: `linear-gradient(90deg, ${c1}20, ${c2}15)`,
                border: `1px solid ${c1}25`,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: c1 }}
              />
              <span
                className="text-[11px] font-bold uppercase tracking-[0.2em]"
                style={{ color: c1 }}
              >
                Achievement Unlocked
              </span>
            </motion.div>

            {/* Title */}
            <motion.h2
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65, duration: 0.4 }}
              className="text-[28px] sm:text-[32px] font-bold text-white font-display mb-2 leading-tight"
            >
              {achievement.title}
            </motion.h2>

            {/* Description */}
            <motion.p
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.4 }}
              className="text-zinc-400 mb-7 leading-relaxed text-[15px] max-w-[280px] mx-auto"
            >
              {achievement.emotionalContext || achievement.description}
            </motion.p>

            {/* XP reward pill */}
            <motion.div
              initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1, duration: 0.35 }}
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl"
              style={{
                background: `linear-gradient(135deg, ${c1}18, ${c2}10)`,
                border: `1px solid ${c1}22`,
                boxShadow: `0 8px 24px -8px ${c1}20`,
              }}
            >
              <Zap className="w-5 h-5" style={{ color: c1 }} />
              <span
                className="font-bold text-xl tabular-nums"
                style={{ color: c1 }}
              >
                +{achievement.xpReward} XP
              </span>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
