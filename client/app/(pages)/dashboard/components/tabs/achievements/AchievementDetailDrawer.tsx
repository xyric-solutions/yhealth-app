"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, Star, CheckCircle2, Calendar, Sparkles, Zap } from "lucide-react";
import type { Achievement } from "./types";
import {
  rarityBgColors,
  rarityBorderColors,
  rarityGlowStyles,
  rarityTextColors,
  rarityHexColors,
  categoryConfig,
} from "./constants";
import { AchievementProgressRing } from "./AchievementProgressRing";

interface AchievementDetailDrawerProps {
  achievement: Achievement | null;
  onClose: () => void;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return date.toLocaleDateString();
}

export function AchievementDetailDrawer({
  achievement,
  onClose,
}: AchievementDetailDrawerProps) {
  const isMobile = useIsMobile();
  const prefersReducedMotion = useReducedMotion();
  const catConfig = achievement ? categoryConfig[achievement.category] : null;
  const CatIcon = catConfig?.icon;

  useEffect(() => {
    if (achievement) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [achievement]);

  // Keyboard escape
  useEffect(() => {
    if (!achievement) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [achievement, onClose]);

  const drawerVariants = isMobile
    ? { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" } }
    : { initial: { x: "100%" }, animate: { x: 0 }, exit: { x: "100%" } };

  if (!achievement) return null;

  const [c1, c2, c3] = rarityHexColors[achievement.rarity];

  return (
    <AnimatePresence>
      {achievement && (
        <>
          {/* ── Backdrop ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 bg-black/65 backdrop-blur-md z-50"
            onClick={onClose}
            aria-label="Close achievement detail"
          />

          {/* ── Drawer ── */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`${achievement.title} achievement details`}
            {...drawerVariants}
            transition={
              prefersReducedMotion
                ? { duration: 0.1 }
                : { type: "spring", stiffness: 320, damping: 30 }
            }
            className={`fixed z-50 overflow-y-auto overscroll-contain
              ${
                isMobile
                  ? "inset-x-0 bottom-0 max-h-[92vh] rounded-t-3xl"
                  : "right-0 top-0 bottom-0 w-full max-w-[440px]"
              }`}
            style={{
              background: "linear-gradient(180deg, #0d1117 0%, #0a0e13 100%)",
            }}
          >
            {/* Mobile drag handle */}
            {isMobile && (
              <div className="flex justify-center pt-3 pb-1 sticky top-0 z-20">
                <div className="w-10 h-1 rounded-full bg-white/15" />
              </div>
            )}

            {/* Close button */}
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 z-20 p-2.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12]
                transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            >
              <X className="w-5 h-5 text-white/60" />
            </button>

            {/* ── Header with atmospheric glow ── */}
            <div className="relative px-6 sm:px-8 pt-8 sm:pt-10 pb-8">
              {/* Glow orbs */}
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[200px] rounded-full blur-[100px] pointer-events-none"
                style={{
                  background: `radial-gradient(ellipse, ${c1}18, ${c2}0c, transparent 70%)`,
                }}
              />
              {/* Top edge accent */}
              {!isMobile && (
                <div
                  className="absolute top-0 left-[15%] right-[15%] h-px pointer-events-none"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${c1}40, transparent)`,
                  }}
                />
              )}

              {/* Icon with progress ring */}
              <div className="relative flex justify-center mb-7">
                <AchievementProgressRing
                  percentage={achievement.progressPercentage}
                  rarity={achievement.rarity}
                  size={152}
                  strokeWidth={5}
                >
                  <div
                    className={`w-[100px] h-[100px] rounded-3xl flex items-center justify-center text-[52px]
                      border border-white/[0.08]
                      ${rarityGlowStyles[achievement.rarity]}
                      ${achievement.unlocked ? "" : "grayscale opacity-40"}`}
                    style={{
                      background: achievement.unlocked
                        ? `linear-gradient(135deg, ${c1}14, ${c2}0c)`
                        : "rgba(255,255,255,0.02)",
                      boxShadow: achievement.unlocked
                        ? `0 12px 40px -12px ${c1}25, inset 0 1px 0 ${c1}10`
                        : undefined,
                    }}
                  >
                    {achievement.icon}
                  </div>
                </AchievementProgressRing>
              </div>

              {/* Title + emotional context */}
              <div className="relative text-center">
                <h2 className="text-2xl sm:text-[28px] font-bold text-white font-display mb-2 leading-tight">
                  {achievement.title}
                </h2>
                {achievement.emotionalContext && (
                  <p className="text-sm text-indigo-300/80 mb-2.5 italic flex items-center justify-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{achievement.emotionalContext}</span>
                  </p>
                )}
                <p className="text-[15px] text-zinc-400 leading-relaxed max-w-sm mx-auto">
                  {achievement.description}
                </p>
              </div>
            </div>

            {/* ── Content ── */}
            <div className="px-6 sm:px-8 pb-8 sm:pb-10 space-y-4">
              {/* Badges */}
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <span
                  className="inline-flex items-center px-3 py-1.5 rounded-lg text-[12px] font-bold uppercase tracking-wider text-white/90"
                  style={{
                    background: `linear-gradient(135deg, ${c1}cc, ${c2}aa)`,
                  }}
                >
                  {achievement.rarity}
                </span>
                {CatIcon && (
                  <span
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold ${catConfig.bg} ${catConfig.color}`}
                  >
                    <CatIcon className="w-3.5 h-3.5" />
                    <span className="capitalize">{achievement.category}</span>
                  </span>
                )}
                {achievement.aiGenerated && (
                  <span className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
                    AI Generated
                  </span>
                )}
              </div>

              {/* Progress card */}
              <div
                className="p-5 rounded-2xl border border-white/[0.05]"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))",
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[12px] font-semibold text-zinc-500 uppercase tracking-wider">
                    Progress
                  </span>
                  <span
                    className={`text-sm font-bold tabular-nums ${
                      achievement.unlocked
                        ? "text-emerald-400"
                        : rarityTextColors[achievement.rarity]
                    }`}
                  >
                    {achievement.progress}/{achievement.maxProgress}
                  </span>
                </div>
                <div className="relative h-2.5 rounded-full bg-white/[0.04] overflow-hidden">
                  <div className="absolute inset-0 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]" />
                  <motion.div
                    initial={
                      prefersReducedMotion
                        ? { width: `${achievement.progressPercentage}%` }
                        : { width: 0 }
                    }
                    animate={{ width: `${achievement.progressPercentage}%` }}
                    transition={
                      prefersReducedMotion
                        ? { duration: 0 }
                        : { duration: 1.2, ease: [0.22, 1, 0.36, 1] }
                    }
                    className="h-full rounded-full relative overflow-hidden"
                    style={{
                      background: achievement.unlocked
                        ? "linear-gradient(90deg, #34d399, #10b981)"
                        : `linear-gradient(90deg, ${c1}, ${c2})`,
                    }}
                  >
                    <div
                      className="absolute inset-0 animate-shimmer"
                      style={{
                        background:
                          "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)",
                      }}
                    />
                  </motion.div>
                </div>
                <p className="text-center mt-2.5 text-[13px] text-zinc-500">
                  {achievement.progressPercentage}% Complete
                </p>
              </div>

              {/* XP Reward */}
              <div
                className="flex items-center justify-center gap-3 p-4 rounded-2xl border"
                style={{
                  background: `linear-gradient(135deg, ${c1}0c, ${c2}08)`,
                  borderColor: `${c1}18`,
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${c1}18` }}
                >
                  <Zap className="w-5 h-5" style={{ color: c1 }} />
                </div>
                <div>
                  <p className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider">
                    Reward
                  </p>
                  <p
                    className="font-bold text-xl tabular-nums"
                    style={{ color: c1 }}
                  >
                    +{achievement.xpReward} XP
                  </p>
                </div>
              </div>

              {/* Unlock status */}
              {achievement.unlocked ? (
                <div className="flex items-center justify-center gap-2.5 p-4 rounded-2xl bg-emerald-500/8 border border-emerald-500/15">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <div className="text-center">
                    <span className="text-emerald-300 font-semibold text-[15px]">
                      Achievement Unlocked!
                    </span>
                    {achievement.unlockedAt && (
                      <p className="text-emerald-400/50 text-[12px] flex items-center justify-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {formatRelativeDate(achievement.unlockedAt)}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
                  <div
                    className="w-8 h-1.5 rounded-full overflow-hidden bg-white/[0.06]"
                    style={{ width: "60px" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${achievement.progressPercentage}%`,
                        background: `linear-gradient(90deg, ${c1}, ${c2})`,
                      }}
                    />
                  </div>
                  <span className="text-zinc-400 text-[13px] font-medium">
                    {100 - achievement.progressPercentage}% to go
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
