"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { Dumbbell, Layers, Target, Brain } from "lucide-react";
import { exercisesService, type ExerciseStats } from "@/src/shared/services/exercises.service";

function AnimatedCounter({ value, duration = 2 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    if (value <= 0) return;
    const start = performance.now();
    const from = 0;

    function step(now: number) {
      const progress = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(from + (value - from) * eased));
      if (progress < 1) {
        ref.current = requestAnimationFrame(step);
      }
    }
    ref.current = requestAnimationFrame(step);
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current);
    };
  }, [value, duration]);

  return <>{display.toLocaleString()}</>;
}

function ProgressRing({
  progress,
  size = 48,
  strokeWidth = 3,
  color,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="currentColor"
        className="text-white/[0.06]"
        strokeWidth={strokeWidth}
        fill="none"
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: circumference - (progress / 100) * circumference }}
        transition={{ duration: 1.8, delay: 0.3, ease: "easeOut" }}
        strokeDasharray={circumference}
      />
    </svg>
  );
}

interface PremiumStatCardProps {
  icon: typeof Dumbbell;
  label: string;
  value: number | string;
  subLabel?: string;
  gradient: string;
  glowColor: string;
  ringProgress?: number;
  ringColor?: string;
  delay: number;
}

function PremiumStatCard({
  icon: Icon,
  label,
  value,
  subLabel,
  gradient,
  glowColor,
  ringProgress,
  ringColor,
  delay,
}: PremiumStatCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, delay, type: "spring", bounce: 0.15 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative"
    >
      {/* Animated gradient border */}
      <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-[1px]"
        style={{ backgroundImage: `linear-gradient(135deg, ${glowColor}, transparent, ${glowColor})` }}
      />

      {/* Glow effect */}
      <motion.div
        animate={{ opacity: isHovered ? 0.15 : 0 }}
        transition={{ duration: 0.3 }}
        className={`absolute -inset-4 rounded-3xl bg-gradient-to-r ${gradient} blur-3xl pointer-events-none`}
      />

      {/* Card body */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-white/[0.08] p-5 sm:p-6 hover:border-white/[0.12] transition-all duration-300">
        {/* Background gradient orb */}
        <div className={`absolute -top-8 -right-8 w-32 h-32 rounded-full bg-gradient-to-br ${gradient} opacity-[0.07] blur-2xl group-hover:opacity-[0.12] transition-opacity duration-500`} />

        {/* Mesh gradient pattern */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 80%, rgba(16, 185, 129, 0.3), transparent 50%), radial-gradient(circle at 80% 20%, rgba(20, 184, 166, 0.3), transparent 50%)`,
          }}
        />

        <div className="relative z-10 flex items-start justify-between">
          <div className="space-y-3">
            {/* Icon */}
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
              <Icon className="w-5 h-5 text-white" />
            </div>

            {/* Value */}
            <div>
              <p className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                {typeof value === "number" ? <AnimatedCounter value={value} /> : value}
              </p>
              {subLabel && (
                <p className="text-[11px] text-slate-500 mt-0.5">{subLabel}</p>
              )}
            </div>

            {/* Label */}
            <p className="text-xs text-slate-400 uppercase tracking-[0.15em] font-medium">{label}</p>
          </div>

          {/* Progress ring */}
          {ringProgress !== undefined && ringColor && (
            <div className="relative flex-shrink-0">
              <ProgressRing progress={ringProgress} color={ringColor} />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold text-slate-400">{ringProgress}%</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function ExerciseStatsHeader() {
  const [stats, setStats] = useState<ExerciseStats | null>(null);

  useEffect(() => {
    exercisesService.getStats().then((res) => {
      if (res.success && res.data) {
        setStats(res.data);
      }
    });
  }, []);

  const categoryCount = stats ? Object.keys(stats.byCategory).length : 0;
  const muscleGroupCount = stats ? Object.keys(stats.byDifficulty).length : 0;
  const sourceCount = stats ? Object.keys(stats.bySource).length : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <PremiumStatCard
        icon={Dumbbell}
        label="Total Exercises"
        value={stats?.totalExercises ?? 0}
        subLabel="curated & verified"
        gradient="from-emerald-500 to-teal-600"
        glowColor="rgba(16, 185, 129, 0.4)"
        ringProgress={95}
        ringColor="#34d399"
        delay={0}
      />
      <PremiumStatCard
        icon={Layers}
        label="Categories"
        value={categoryCount || 0}
        subLabel="exercise types"
        gradient="from-teal-500 to-cyan-600"
        glowColor="rgba(20, 184, 166, 0.4)"
        ringProgress={88}
        ringColor="#2dd4bf"
        delay={0.1}
      />
      <PremiumStatCard
        icon={Target}
        label="Difficulty Levels"
        value={muscleGroupCount || 0}
        subLabel="beginner to expert"
        gradient="from-amber-500 to-orange-600"
        glowColor="rgba(245, 158, 11, 0.4)"
        ringProgress={100}
        ringColor="#fbbf24"
        delay={0.2}
      />
      <PremiumStatCard
        icon={Brain}
        label="AI-Powered"
        value={sourceCount || 0}
        subLabel="data sources"
        gradient="from-emerald-500 to-cyan-500"
        glowColor="rgba(16, 185, 129, 0.4)"
        ringProgress={78}
        ringColor="#34d399"
        delay={0.3}
      />
    </div>
  );
}
