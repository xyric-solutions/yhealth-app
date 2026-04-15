"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Crown, Flame, Trophy, TrendingUp, Star, Zap } from "lucide-react";
import { useRef, useEffect } from "react";
import type { AchievementSummary, Achievement } from "./types";
import {
  getLevelInfo,
  rarityBgColors,
  rarityBorderColors,
  rarityHexColors,
  fadeInUp,
} from "./constants";
import { AchievementProgressRing } from "./AchievementProgressRing";

interface AchievementHeroSectionProps {
  summary: AchievementSummary;
  onAchievementClick?: (achievement: Achievement) => void;
}

/* ── Animated stat pill ────────────────────────────────────────── */
function HeroStat({
  icon: Icon,
  value,
  label,
  color,
  delay,
}: {
  icon: typeof Flame;
  value: number;
  label: string;
  color: string;
  delay: number;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center gap-1"
    >
      <div
        className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center border border-white/[0.06]"
        style={{ background: `${color}15` }}
      >
        <Icon className="w-5 h-5 sm:w-[22px] sm:h-[22px]" style={{ color }} />
      </div>
      <span className="text-lg sm:text-xl font-bold text-white tabular-nums">
        {value.toLocaleString()}
      </span>
      <span className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider">
        {label}
      </span>
    </motion.div>
  );
}

/* ── Floating particles for atmosphere ─────────────────────────── */
function HeroParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();

    const particles = Array.from({ length: 24 }, () => ({
      x: Math.random() * canvas.offsetWidth,
      y: Math.random() * canvas.offsetHeight,
      r: Math.random() * 1.5 + 0.5,
      dx: (Math.random() - 0.5) * 0.3,
      dy: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.4 + 0.1,
    }));

    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      for (const p of particles) {
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0 || p.x > canvas.offsetWidth) p.dx *= -1;
        if (p.y < 0 || p.y > canvas.offsetHeight) p.dy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(251,191,36,${p.alpha})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();

    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [prefersReducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  );
}

/* ── Main Hero ─────────────────────────────────────────────────── */
export function AchievementHeroSection({
  summary,
  onAchievementClick,
}: AchievementHeroSectionProps) {
  const prefersReducedMotion = useReducedMotion();
  const levelInfo = getLevelInfo(summary.level);
  const levelRarity =
    summary.level >= 50
      ? "legendary"
      : summary.level >= 20
        ? "epic"
        : summary.level >= 10
          ? "rare"
          : ("common" as const);
  const [lc1, lc2] = (levelInfo.hex ?? ["#fbbf24", "#f97316"]) as [string, string];

  return (
    <motion.section
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      aria-label="Achievement level overview"
      className="relative overflow-hidden rounded-3xl border border-white/[0.06] p-6 sm:p-8 lg:p-10"
      style={{
        background:
          "linear-gradient(135deg, rgba(251,191,36,0.06) 0%, rgba(249,115,22,0.04) 40%, rgba(15,20,25,0.95) 100%)",
      }}
    >
      {/* ── Atmospheric layers ── */}
      <HeroParticles />
      <div
        className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full blur-[120px] pointer-events-none"
        style={{ background: `radial-gradient(circle, ${lc1}0d, transparent 70%)` }}
      />
      <div
        className="absolute -bottom-24 -left-24 w-[300px] h-[300px] rounded-full blur-[100px] pointer-events-none"
        style={{ background: `radial-gradient(circle, ${lc2}0a, transparent 70%)` }}
      />
      {/* Top edge highlight */}
      <div
        className="absolute top-0 left-[10%] right-[10%] h-px pointer-events-none"
        style={{
          background: `linear-gradient(90deg, transparent, ${lc1}30, transparent)`,
        }}
      />

      <div className="relative z-10 flex flex-col xl:flex-row xl:items-center gap-8">
        {/* ── Level Badge + Ring ── */}
        <motion.div
          initial={prefersReducedMotion ? false : { scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
          className="flex items-center gap-5 sm:gap-6"
        >
          <div className="relative">
            <AchievementProgressRing
              percentage={summary.xpProgressPercentage}
              rarity={levelRarity}
              size={108}
              strokeWidth={5}
            >
              <div
                className="w-[76px] h-[76px] rounded-2xl flex flex-col items-center justify-center border border-white/[0.08]"
                style={{
                  background: `linear-gradient(135deg, ${lc1}15, ${lc2}10)`,
                  boxShadow: `0 8px 32px -8px ${lc1}20`,
                }}
              >
                <Crown className="w-6 h-6 mb-0.5" style={{ color: lc1 }} />
                <span className="text-lg font-bold text-white leading-none">
                  {summary.level}
                </span>
              </div>
            </AchievementProgressRing>
            {/* Pulse dot */}
            <div
              className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#0F1419]"
              style={{
                background: `linear-gradient(135deg, ${lc1}, ${lc2})`,
                animation: prefersReducedMotion
                  ? "none"
                  : "pulse 2s ease-in-out infinite",
              }}
            />
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500 mb-1">
              Current Level
            </p>
            <h2
              className="text-2xl sm:text-3xl lg:text-4xl font-bold font-display bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(135deg, ${lc1}, ${lc2})`,
              }}
            >
              {levelInfo.name}
            </h2>
            <div className="flex items-center gap-2 mt-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400/70" />
              <span className="text-sm text-zinc-400 tabular-nums">
                {summary.totalXP.toLocaleString()} XP earned
              </span>
            </div>
          </div>
        </motion.div>

        {/* ── XP Progress Bar ── */}
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex-1 xl:max-w-lg"
        >
          <div className="flex items-baseline justify-between mb-2.5">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              Next Level
            </span>
            <span className="text-sm font-semibold tabular-nums" style={{ color: lc1 }}>
              {summary.xpProgress}
              <span className="text-zinc-500 font-normal">
                /{summary.xpNeeded} XP
              </span>
            </span>
          </div>
          <div className="relative h-3 rounded-full bg-white/[0.04] overflow-hidden">
            <div className="absolute inset-0 rounded-full shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)]" />
            <motion.div
              initial={
                prefersReducedMotion
                  ? { width: `${summary.xpProgressPercentage}%` }
                  : { width: 0 }
              }
              animate={{ width: `${summary.xpProgressPercentage}%` }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 1.4, ease: [0.22, 1, 0.36, 1] }
              }
              className="absolute inset-y-0 left-0 rounded-full overflow-hidden"
              style={{
                background: `linear-gradient(90deg, ${lc1}, ${lc2})`,
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
          <p className="text-[11px] text-zinc-600 mt-1.5">
            {summary.xpNeeded - summary.xpProgress} XP to Level{" "}
            {summary.level + 1}
          </p>
        </motion.div>

        {/* ── Quick Stats ── */}
        <div className="flex justify-center gap-6 sm:gap-8">
          <HeroStat
            icon={Flame}
            value={summary.currentStreak}
            label="Streak"
            color="#f97316"
            delay={0.35}
          />
          <HeroStat
            icon={Trophy}
            value={summary.totalUnlocked}
            label="Unlocked"
            color="#a78bfa"
            delay={0.45}
          />
          <HeroStat
            icon={TrendingUp}
            value={summary.longestStreak}
            label="Best"
            color="#22d3ee"
            delay={0.55}
          />
        </div>
      </div>

      {/* ── Featured achievements ribbon ── */}
      {summary.featuredAchievements.length > 0 && (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 mt-7 pt-6 border-t border-white/[0.05]"
        >
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-amber-400" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Featured
            </span>
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
            {summary.featuredAchievements.slice(0, 5).map((ach, i) => {
              const [ac1, ac2] = rarityHexColors[ach.rarity];
              return (
                <motion.button
                  key={ach.id}
                  initial={
                    prefersReducedMotion ? false : { opacity: 0, scale: 0.92 }
                  }
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    delay: 0.75 + i * 0.06,
                    duration: 0.4,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  whileHover={
                    prefersReducedMotion ? undefined : { scale: 1.04, y: -2 }
                  }
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onAchievementClick?.(ach)}
                  className={`flex-shrink-0 flex items-center gap-2.5 px-4 py-2.5 rounded-xl
                    border backdrop-blur-sm cursor-pointer transition-colors
                    ${rarityBorderColors[ach.rarity]} hover:border-white/20`}
                  style={{
                    background: `linear-gradient(135deg, ${ac1}12, ${ac2}08)`,
                  }}
                >
                  <span className="text-xl">{ach.icon}</span>
                  <span className="text-[13px] font-medium text-white/90 whitespace-nowrap">
                    {ach.title}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}
    </motion.section>
  );
}
