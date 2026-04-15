'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
  Activity,
  TrendingUp,
  Flame,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
} from 'lucide-react';
import type { Plan } from './types';

interface StatsCardsProps {
  completedToday: number;
  totalToday: number;
  todayProgress: number;
  effectiveWeekRate: number;
  weekChange: number;
  currentStreak: number;
  plan: Plan | null;
  isLoadingStats: boolean;
}

/* ------------------------------------------------------------------ */
/*  AnimatedNumber — counter with ease-out cubic                      */
/* ------------------------------------------------------------------ */
function AnimatedNumber({ value, duration = 1000 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current) {
      setDisplayValue(value);
      return;
    }

    hasAnimated.current = true;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(value * easeOut));

      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span>{displayValue}</span>;
}

/* ------------------------------------------------------------------ */
/*  Skeleton placeholder                                              */
/* ------------------------------------------------------------------ */
function CardSkeleton({ accentClass }: { accentClass: string }) {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-xl ${accentClass} opacity-30`} />
        <div className="w-12 h-4 rounded bg-slate-700/60" />
      </div>
      <div className="w-20 h-8 rounded bg-slate-700/60" />
      <div className="w-16 h-4 rounded bg-slate-700/40" />
      <div className="h-2 rounded-full bg-slate-700/40" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TiltCard — mouse-driven 3D glassmorphic card ±6 deg               */
/* ------------------------------------------------------------------ */
function TiltCard({
  children,
  gradient,
  borderColor,
  shadowColor,
  delay = 0,
}: {
  children: React.ReactNode;
  gradient: string;
  borderColor: string;
  shadowColor: string;
  delay?: number;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mx = useSpring(x, { stiffness: 300, damping: 30 });
  const my = useSpring(y, { stiffness: 300, damping: 30 });

  const rotateX = useTransform(my, [-0.5, 0.5], ['6deg', '-6deg']);
  const rotateY = useTransform(mx, [-0.5, 0.5], ['-6deg', '6deg']);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      x.set(((e.clientX - rect.left) / rect.width) - 0.5);
      y.set(((e.clientY - rect.top) / rect.height) - 0.5);
    },
    [x, y],
  );

  const handleMouseLeave = useCallback(() => {
    x.set(0);
    y.set(0);
  }, [x, y]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
      className="relative"
    >
      <div
        className="relative overflow-hidden rounded-2xl backdrop-blur-xl transition-all duration-300 hover:-translate-y-1"
        style={{
          background: gradient,
          border: `1px solid ${borderColor}`,
          boxShadow: `0 4px 24px ${shadowColor}`,
          transform: 'translateZ(20px)',
        }}
      >
        {/* top-left highlight for glass depth */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.07] to-transparent" />

        {/* shimmer sweep */}
        <motion.div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent"
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        />

        {/* content */}
        <div className="relative z-10 p-4 sm:p-5">{children}</div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  StatsCards                                                         */
/* ------------------------------------------------------------------ */
export function StatsCards({
  completedToday,
  totalToday,
  todayProgress,
  effectiveWeekRate,
  weekChange,
  currentStreak,
  plan,
  isLoadingStats,
}: StatsCardsProps) {
  const currentWeek = plan?.currentWeek ?? 1;
  const totalWeeks = plan?.durationWeeks ?? 12;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* ── 1. Activities (Cyan) ─────────────────────────────────── */}
      <TiltCard
        gradient="linear-gradient(135deg, rgba(6,182,212,0.15), rgba(8,145,178,0.08) 50%, rgba(15,23,42,0.95))"
        borderColor="rgba(6,182,212,0.2)"
        shadowColor="rgba(6,182,212,0.15)"
        delay={0}
      >
        {isLoadingStats ? (
          <CardSkeleton accentClass="bg-cyan-500" />
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <motion.div
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-500/20"
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: 'spring', stiffness: 400, damping: 10 }}
              >
                <Activity className="w-5 h-5 text-cyan-400" />
              </motion.div>
              <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-cyan-400/70">
                Today
              </span>
            </div>

            <div className="flex items-baseline gap-1">
              <p className="text-3xl sm:text-4xl font-bold text-white tabular-nums">
                <AnimatedNumber value={completedToday} />
              </p>
              <span className="text-lg text-slate-500">/</span>
              <span className="text-lg text-slate-400">{totalToday}</span>
            </div>
            <p className="text-sm text-slate-400 mt-0.5">Activities</p>

            {/* progress bar — cyan to purple gradient */}
            <div className="mt-4 h-2 rounded-full bg-slate-700/50 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #06b6d4, #a855f7)',
                }}
                initial={{ width: 0 }}
                animate={{ width: `${todayProgress}%` }}
                transition={{ duration: 1, ease: 'easeOut', delay: 0.5 }}
              />
            </div>
          </>
        )}
      </TiltCard>

      {/* ── 2. Week Progress (Emerald) ───────────────────────────── */}
      <TiltCard
        gradient="linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.08) 50%, rgba(15,23,42,0.95))"
        borderColor="rgba(16,185,129,0.2)"
        shadowColor="rgba(16,185,129,0.15)"
        delay={0.1}
      >
        {isLoadingStats ? (
          <CardSkeleton accentClass="bg-emerald-500" />
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <motion.div
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/20"
                whileHover={{ scale: 1.1, rotate: -5 }}
                transition={{ type: 'spring', stiffness: 400, damping: 10 }}
              >
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </motion.div>

              {/* delta badge */}
              <motion.div
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className={`flex items-center gap-0.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                  weekChange >= 0
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-red-500/20 text-red-400'
                }`}
              >
                {weekChange >= 0 ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                {weekChange >= 0 ? '+' : ''}
                {weekChange}%
              </motion.div>
            </div>

            <p className="text-3xl sm:text-4xl font-bold text-white tabular-nums">
              <AnimatedNumber value={Math.round(effectiveWeekRate)} />
              <span className="text-xl">%</span>
            </p>
            <p className="text-sm text-slate-400 mt-0.5">Week Progress</p>

            {/* dashed segments */}
            <div className="mt-4 flex gap-1">
              {Array.from({ length: 7 }).map((_, i) => {
                const filled = i < Math.round((effectiveWeekRate / 100) * 7);
                return (
                  <motion.div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full ${
                      filled ? 'bg-emerald-400' : 'bg-slate-700/60'
                    }`}
                    style={{
                      borderStyle: filled ? 'solid' : 'dashed',
                      borderWidth: filled ? 0 : '1px',
                      borderColor: filled ? undefined : 'rgba(16,185,129,0.3)',
                      backgroundColor: filled ? undefined : 'transparent',
                    }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.5 + i * 0.06 }}
                  />
                );
              })}
            </div>
          </>
        )}
      </TiltCard>

      {/* ── 3. Day Streak (Amber) ────────────────────────────────── */}
      <TiltCard
        gradient="linear-gradient(135deg, rgba(217,119,6,0.15), rgba(180,83,9,0.08) 50%, rgba(15,23,42,0.95))"
        borderColor="rgba(217,119,6,0.2)"
        shadowColor="rgba(217,119,6,0.15)"
        delay={0.2}
      >
        {isLoadingStats ? (
          <CardSkeleton accentClass="bg-amber-500" />
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <motion.div
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/20"
                whileHover={{ scale: 1.1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 10 }}
              >
                <Flame className="w-5 h-5 text-amber-400" />
              </motion.div>
              {currentStreak >= 7 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="text-[10px] font-bold tracking-wider uppercase text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full"
                >
                  On Fire
                </motion.span>
              )}
            </div>

            <p className="text-3xl sm:text-4xl font-bold text-white tabular-nums">
              <AnimatedNumber value={currentStreak} />
            </p>
            <p className="text-sm text-slate-400 mt-0.5">Day Streak</p>

            {/* 3 zap icons */}
            <motion.div
              className="mt-4 flex gap-1.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0, y: 8 }}
                  animate={{ scale: 1, y: 0 }}
                  transition={{ delay: 0.7 + i * 0.12 }}
                >
                  <Zap
                    className={`w-4 h-4 ${
                      currentStreak > i
                        ? 'text-amber-400 fill-amber-400'
                        : 'text-amber-400/25'
                    }`}
                  />
                </motion.div>
              ))}
            </motion.div>
          </>
        )}
      </TiltCard>

      {/* ── 4. Current Week (Purple) ─────────────────────────────── */}
      <TiltCard
        gradient="linear-gradient(135deg, rgba(139,92,246,0.15), rgba(124,58,237,0.08) 50%, rgba(15,23,42,0.95))"
        borderColor="rgba(139,92,246,0.2)"
        shadowColor="rgba(139,92,246,0.15)"
        delay={0.3}
      >
        {isLoadingStats ? (
          <CardSkeleton accentClass="bg-purple-500" />
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <motion.div
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-500/20"
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: 'spring', stiffness: 400, damping: 10 }}
              >
                <Calendar className="w-5 h-5 text-purple-400" />
              </motion.div>
              <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-purple-400/70">
                Current
              </span>
            </div>

            <p className="text-3xl sm:text-4xl font-bold text-white tabular-nums">
              Week <AnimatedNumber value={currentWeek} />
            </p>
            <p className="text-sm text-slate-400 mt-0.5">
              of {totalWeeks} weeks
            </p>

            {/* segmented dashes */}
            <div className="mt-4 flex gap-1">
              {Array.from({ length: totalWeeks }).map((_, i) => (
                <motion.div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${
                    i < currentWeek - 1
                      ? 'bg-purple-500'
                      : i === currentWeek - 1
                        ? 'bg-purple-400'
                        : ''
                  }`}
                  style={
                    i >= currentWeek
                      ? {
                          borderStyle: 'dashed',
                          borderWidth: '1px',
                          borderColor: 'rgba(139,92,246,0.3)',
                          backgroundColor: 'transparent',
                        }
                      : i === currentWeek - 1
                        ? { animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }
                        : undefined
                  }
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.5 + i * 0.03 }}
                />
              ))}
            </div>
          </>
        )}
      </TiltCard>
    </div>
  );
}
