"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Lock, CheckCircle2, Sparkles } from "lucide-react";
import type { Achievement } from "./types";
import {
  rarityGradients,
  rarityBgColors,
  rarityBorderColors,
  rarityGlowStyles,
  rarityTextColors,
  rarityHexColors,
  categoryConfig,
  gentleSpring,
} from "./constants";

interface AchievementCardProps {
  achievement: Achievement;
  index: number;
  onClick: (achievement: Achievement) => void;
}

export function AchievementCard({
  achievement,
  index,
  onClick,
}: AchievementCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const { unlocked, rarity, category, progressPercentage, xpReward } =
    achievement;
  const catConfig = categoryConfig[category];
  const CatIcon = catConfig?.icon;
  const [color1, color2, color3] = rarityHexColors[rarity];
  const isLegendary = unlocked && rarity === "legendary";
  const isEpic = unlocked && rarity === "epic";

  return (
    <motion.div
      layout
      initial={prefersReducedMotion ? false : { opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{
        delay: index * 0.04,
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={
        prefersReducedMotion
          ? undefined
          : { y: -4, scale: 1.015, transition: gentleSpring }
      }
      whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
      onClick={() => onClick(achievement)}
      role="button"
      tabIndex={0}
      aria-label={`${achievement.title} — ${rarity} ${category} achievement, ${progressPercentage}% complete`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(achievement);
        }
      }}
      className={`
        relative rounded-[20px] overflow-hidden cursor-pointer group
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080C10]
        ${
          unlocked
            ? `${rarityGlowStyles[rarity]}`
            : "opacity-60 hover:opacity-85"
        }
      `}
    >
      {/* ── Holographic animated border (legendary + epic) ── */}
      {(isLegendary || isEpic) && (
        <div
          className="absolute inset-0 rounded-[20px] pointer-events-none z-0"
          style={{
            padding: "1.5px",
            background: isLegendary
              ? `conic-gradient(from var(--card-angle, 0deg), ${color1}88, ${color2}66, ${color3}55, ${color2}66, ${color1}88)`
              : `conic-gradient(from var(--card-angle, 0deg), ${color1}55, ${color2}44, ${color3}33, ${color2}44, ${color1}55)`,
            mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            maskComposite: "exclude",
            WebkitMaskComposite: "xor",
            animation: prefersReducedMotion
              ? "none"
              : `spin-slow ${isLegendary ? "6s" : "10s"} linear infinite`,
          }}
        />
      )}

      {/* ── Card inner surface ── */}
      <div
        className={`
          relative z-[1] p-5 sm:p-6 rounded-[20px] h-full
          border backdrop-blur-2xl
          transition-all duration-300
          ${
            unlocked
              ? `bg-gradient-to-br ${rarityBgColors[rarity]} ${rarityBorderColors[rarity]}`
              : "bg-[#0d1117]/80 border-white/[0.05]"
          }
        `}
      >
        {/* ── Atmospheric glow orbs ── */}
        {unlocked && (
          <>
            <div
              className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700"
              style={{
                background: `radial-gradient(circle, ${color1}18 0%, transparent 70%)`,
              }}
            />
            <div
              className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full blur-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700"
              style={{
                background: `radial-gradient(circle, ${color2}12 0%, transparent 70%)`,
              }}
            />
          </>
        )}

        {/* ── Top row: Icon + Status ── */}
        <div className="relative flex items-start justify-between mb-4">
          {/* Icon container */}
          <div className="relative">
            <div
              className={`
                w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-2xl sm:text-[28px]
                transition-all duration-300 group-hover:scale-105
                ${
                  unlocked
                    ? "bg-white/[0.06] border border-white/[0.08] shadow-lg"
                    : "bg-white/[0.03] border border-white/[0.04]"
                }
              `}
              style={
                unlocked
                  ? {
                      boxShadow: `0 8px 24px -8px ${color1}20, inset 0 1px 0 ${color1}10`,
                    }
                  : undefined
              }
            >
              {unlocked ? (
                achievement.icon
              ) : (
                <Lock className="w-6 h-6 text-zinc-600" />
              )}
            </div>
            {/* Rarity pip */}
            {unlocked && (
              <div
                className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-[#0d1117] flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${color1}, ${color2})`,
                }}
              >
                <CheckCircle2 className="w-3 h-3 text-white" />
              </div>
            )}
          </div>

          {/* XP Badge */}
          {unlocked && (
            <motion.div
              initial={prefersReducedMotion ? false : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{
                type: "spring",
                stiffness: 400,
                damping: 20,
                delay: index * 0.04 + 0.3,
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide"
              style={{
                background: `linear-gradient(135deg, ${color1}25, ${color2}18)`,
                color: color1,
                border: `1px solid ${color1}20`,
              }}
            >
              <Sparkles className="w-3 h-3" />+{xpReward}
            </motion.div>
          )}
        </div>

        {/* ── Title ── */}
        <h3
          className={`font-semibold text-[15px] sm:text-base leading-snug mb-1 transition-colors duration-200 ${
            unlocked
              ? "text-white group-hover:text-white/90 font-display"
              : "text-zinc-500"
          }`}
        >
          {achievement.title}
        </h3>

        {/* ── Description ── */}
        <p
          className={`text-[13px] leading-relaxed mb-4 line-clamp-2 ${
            unlocked ? "text-slate-400" : "text-zinc-600"
          }`}
        >
          {achievement.emotionalContext || achievement.description}
        </p>

        {/* ── Progress bar ── */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
              Progress
            </span>
            <span
              className={`text-[11px] font-semibold tabular-nums ${
                unlocked ? "text-emerald-400" : "text-zinc-400"
              }`}
            >
              {achievement.progress}/{achievement.maxProgress}
              {unlocked && " ✓"}
            </span>
          </div>
          <div className="relative h-[6px] rounded-full bg-white/[0.04] overflow-hidden">
            {/* Track inner shadow */}
            <div className="absolute inset-0 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]" />
            <motion.div
              initial={
                prefersReducedMotion
                  ? { width: `${progressPercentage}%` }
                  : { width: 0 }
              }
              animate={{ width: `${progressPercentage}%` }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : {
                      duration: 1,
                      ease: [0.22, 1, 0.36, 1],
                      delay: index * 0.04 + 0.2,
                    }
              }
              className="h-full rounded-full relative overflow-hidden"
              style={{
                background: unlocked
                  ? "linear-gradient(90deg, #34d399, #10b981)"
                  : `linear-gradient(90deg, ${color1}, ${color2})`,
              }}
            >
              {/* Animated shimmer */}
              <div
                className="absolute inset-0 animate-shimmer"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)",
                }}
              />
            </motion.div>
          </div>
        </div>

        {/* ── Footer badges ── */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {/* Rarity badge */}
            <span
              className="inline-flex items-center px-2 py-[3px] rounded-md text-[10px] font-bold uppercase tracking-wider text-white/90"
              style={{
                background: `linear-gradient(135deg, ${color1}cc, ${color2}aa)`,
              }}
            >
              {rarity}
            </span>
            {/* Category icon */}
            {CatIcon && (
              <span
                className={`p-1 rounded-md ${catConfig.bg} ${catConfig.color}`}
              >
                <CatIcon className="w-3 h-3" />
              </span>
            )}
            {/* AI badge */}
            {achievement.aiGenerated && (
              <span
                className="px-1.5 py-[2px] rounded-md text-[9px] font-bold uppercase tracking-widest"
                style={{
                  background: "rgba(99,102,241,0.15)",
                  color: "#818cf8",
                  border: "1px solid rgba(99,102,241,0.2)",
                }}
              >
                AI
              </span>
            )}
          </div>
          {!unlocked && (
            <span
              className="text-[11px] font-semibold tabular-nums"
              style={{ color: color1 + "88" }}
            >
              {progressPercentage}%
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
