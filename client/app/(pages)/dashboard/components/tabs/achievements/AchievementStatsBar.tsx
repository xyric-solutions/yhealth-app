"use client";

import { motion, useReducedMotion, useSpring, useMotionValue } from "framer-motion";
import { Trophy, Star, Crown, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import { fadeInUp } from "./constants";

interface AchievementStatsBarProps {
  unlockedCount: number;
  totalAchievements: number;
  unlockedPercentage: number;
  totalXP: number;
  legendaryCount: number;
  epicCount: number;
}

/* ── Animated number that springs from 0 ── */
function SpringNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 40, damping: 24 });
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) {
      if (ref.current) ref.current.textContent = value.toLocaleString();
      return;
    }
    motionVal.set(0);
    const t = setTimeout(() => motionVal.set(value), 200);
    return () => clearTimeout(t);
  }, [value, motionVal, prefersReducedMotion]);

  useEffect(() => {
    const unsub = spring.on("change", (v) => {
      if (ref.current) ref.current.textContent = Math.round(v).toLocaleString();
    });
    return unsub;
  }, [spring]);

  return (
    <span ref={ref} className="tabular-nums">
      {value.toLocaleString()}
    </span>
  );
}

/* ── Individual stat card ── */
function StatCard({
  icon: Icon,
  value,
  label,
  color,
  badge,
  index,
  isCompound,
}: {
  icon: typeof Trophy;
  value: number;
  label: string;
  color: string;
  badge?: string;
  index: number;
  isCompound?: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.08 + 0.1,
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={prefersReducedMotion ? undefined : { y: -3, transition: { duration: 0.25 } }}
      className="relative p-5 rounded-2xl overflow-hidden border border-white/[0.05] backdrop-blur-sm
        hover:border-white/[0.1] transition-all duration-300 group"
      style={{
        background: `linear-gradient(135deg, ${color}08, transparent 60%)`,
      }}
    >
      {/* Hover glow */}
      <div
        className="absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `radial-gradient(circle, ${color}15, transparent 70%)` }}
      />

      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/[0.06]"
            style={{ background: `${color}15` }}
          >
            <Icon className="w-[18px] h-[18px]" style={{ color }} />
          </div>
          {badge && (
            <span
              className="text-[11px] px-2 py-0.5 rounded-md font-semibold"
              style={{
                background: `${color}15`,
                color,
                border: `1px solid ${color}20`,
              }}
            >
              {badge}
            </span>
          )}
        </div>
        <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-none mb-1">
          {isCompound || <SpringNumber value={value} />}
        </p>
        <p className="text-[12px] text-zinc-500 font-medium uppercase tracking-wider">
          {label}
        </p>
      </div>
    </motion.div>
  );
}

export function AchievementStatsBar({
  unlockedCount,
  totalAchievements,
  unlockedPercentage,
  totalXP,
  legendaryCount,
  epicCount,
}: AchievementStatsBarProps) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
    >
      <StatCard
        icon={Trophy}
        value={unlockedCount}
        label="Achievements"
        color="#f59e0b"
        badge={`${unlockedPercentage}%`}
        index={0}
        isCompound={`${unlockedCount}/${totalAchievements}`}
      />
      <StatCard
        icon={Star}
        value={totalXP}
        label="Total XP"
        color="#a78bfa"
        index={1}
      />
      <StatCard
        icon={Crown}
        value={legendaryCount}
        label="Legendary"
        color="#fbbf24"
        index={2}
      />
      <StatCard
        icon={Sparkles}
        value={epicCount}
        label="Epic"
        color="#d946ef"
        index={3}
      />
    </motion.div>
  );
}
