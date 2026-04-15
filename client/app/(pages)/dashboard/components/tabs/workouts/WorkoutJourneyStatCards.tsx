"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useId, useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import type { WorkoutStats } from "./types";

/** Icons from `client/public/Workout` (same set as WeeklyPlanView / workout UI). */
const WORKOUT_CARD_ICONS = {
  workout: { src: "/Workout/Frame-2.svg", alt: "Workout" },
  time: { src: "/Workout/Frame.svg", alt: "Total time" },
  burned: { src: "/Workout/fi_2731653.svg", alt: "Calories burned" },
  streak: { src: "/Workout/fi_7299732.svg", alt: "Streak" },
} as const;

export interface JourneyScheduleDay {
  completed: boolean;
  isRest?: boolean;
}

export interface WorkoutJourneyStatCardsProps {
  workoutStats: WorkoutStats;
  weeklySchedule: JourneyScheduleDay[];
}

/** Dense sampling for smooth spline-like sparklines (matches reference artwork). */
const SPARKLINE_SAMPLES = 42;

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

// ─── Reference-style shape templates (0–1), distinct per card like the design mock ───

/** Workout: one gentle bump biased to the middle-right. */
function shapeWorkout(): number[] {
  return Array.from({ length: SPARKLINE_SAMPLES }, (_, i) => {
    const t = i / (SPARKLINE_SAMPLES - 1);
    const bump = Math.exp(-Math.pow((t - 0.62) / 0.19, 2));
    const tail = 0.06 * Math.sin(t * Math.PI * 3.2);
    return 0.06 + 0.88 * bump + tail;
  });
}

/** Total time: two separate smooth peaks (reference: “two distinct peaks”). */
function shapeTimeTwinPeaks(): number[] {
  return Array.from({ length: SPARKLINE_SAMPLES }, (_, i) => {
    const t = i / (SPARKLINE_SAMPLES - 1);
    const left = 0.46 * Math.exp(-Math.pow((t - 0.26) / 0.1, 2));
    const right = 0.5 * Math.exp(-Math.pow((t - 0.74) / 0.11, 2));
    return 0.05 + left + right;
  });
}

/** Burned: stays low with small multi-scale ripples. */
function shapeBurnedLowRipples(): number[] {
  return Array.from({ length: SPARKLINE_SAMPLES }, (_, i) => {
    const t = i / (SPARKLINE_SAMPLES - 1);
    return (
      0.1 +
      0.05 * Math.sin(t * Math.PI * 2.4 + 0.2) +
      0.042 * Math.sin(t * Math.PI * 6.1) +
      0.028 * Math.sin(t * Math.PI * 10.5 + 0.7)
    );
  });
}

/** Streak: high-frequency peaks/valleys; phase & bias tied to streak so it updates with data. */
function shapeStreakBusy(streak: number): number[] {
  const phase = streak * 0.37 + 2.1;
  return Array.from({ length: SPARKLINE_SAMPLES }, (_, i) => {
    const t = i / (SPARKLINE_SAMPLES - 1);
    const hi = 0.26 * Math.sin(t * Math.PI * 16 + phase);
    const mid = 0.11 * Math.sin(t * Math.PI * 8 + phase * 0.5);
    const ramp = 0.12 + Math.min(0.38, streak * 0.055) * Math.pow(t, 0.9);
    return 0.14 + ramp + hi + mid;
  });
}

/**
 * Scale template by live stats. `floor` keeps the designed silhouette visible when the
 * metric is zero (reference still shows waves at 0 minutes / 0 cal).
 */
function modulateShape(
  template: number[],
  intensity: number,
  floor: number,
  gain: number,
): number[] {
  const k = floor + (1 - floor) * clamp01(intensity);
  return template.map((v) => Math.max(0, v * k * gain));
}

function toChartData(values: number[]) {
  return values.map((v, i) => ({ i, v }));
}

function chartMax(values: { v: number }[]): number {
  const m = Math.max(0, ...values.map((d) => d.v));
  return m <= 0 ? 1 : m * 1.08;
}

interface CardDef {
  label: string;
  value: string;
  sub: string;
  color: string;
  rgb: string;
  icon: (typeof WORKOUT_CARD_ICONS)[keyof typeof WORKOUT_CARD_ICONS];
  data: { i: number; v: number }[];
  yMax: number;
  /** Stronger glow for streak (busier line). */
  glowMul?: number;
}

export function WorkoutJourneyStatCards({
  workoutStats,
  weeklySchedule,
}: WorkoutJourneyStatCardsProps) {
  const baseId = useId().replace(/:/g, "");

  const cards: CardDef[] = useMemo(() => {
    const goal = Math.max(1, workoutStats.weeklyGoal);
    const workoutProgress = clamp01(workoutStats.weeklyWorkouts / goal);

    const minutesIntensity = clamp01(Math.sqrt(workoutStats.totalMinutes / 100));
    const caloriesIntensity = clamp01(Math.sqrt(workoutStats.caloriesBurned / 400));
    const streakIntensity = clamp01(Math.sqrt(workoutStats.currentStreak / 12));

    // Slight shift of workout peak from schedule density (keeps tie-in to the week without breaking the design silhouette)
    const scheduleHint =
      weeklySchedule.length > 0
        ? weeklySchedule.filter((d) => d.completed && !d.isRest).length / 7
        : 0;
    const workoutWave = shapeWorkout().map((v, i) => {
      const skew = 1 + 0.06 * scheduleHint * Math.sin((i / SPARKLINE_SAMPLES) * Math.PI * 2);
      return v * skew;
    });

    const workoutData = toChartData(
      modulateShape(workoutWave, workoutProgress, 0.26, 100),
    );

    const timeData = toChartData(
      modulateShape(shapeTimeTwinPeaks(), minutesIntensity, 0.3, 100),
    );

    const burnedData = toChartData(
      modulateShape(shapeBurnedLowRipples(), caloriesIntensity, 0.52, 100),
    );

    const streakData = toChartData(
      modulateShape(shapeStreakBusy(workoutStats.currentStreak), streakIntensity, 0.72, 100),
    );

    return [
      {
        label: "Workout",
        value: `${workoutStats.weeklyWorkouts}/${workoutStats.weeklyGoal}`,
        sub: "This Week",
        color: "#fb923c",
        rgb: "251,146,60",
        icon: WORKOUT_CARD_ICONS.workout,
        data: workoutData,
        yMax: chartMax(workoutData),
      },
      {
        label: "Total Time",
        value: String(workoutStats.totalMinutes),
        sub: "Minutes",
        color: "#2dd4bf",
        rgb: "45,212,191",
        icon: WORKOUT_CARD_ICONS.time,
        data: timeData,
        yMax: chartMax(timeData),
      },
      {
        label: "Burned",
        value: String(workoutStats.caloriesBurned),
        sub: "Calories",
        color: "#c084fc",
        rgb: "192,132,252",
        icon: WORKOUT_CARD_ICONS.burned,
        data: burnedData,
        yMax: chartMax(burnedData),
      },
      {
        label: "Streak",
        value: String(workoutStats.currentStreak),
        sub: "Days",
        color: "#f97316",
        rgb: "249,115,22",
        icon: WORKOUT_CARD_ICONS.streak,
        data: streakData,
        yMax: chartMax(streakData),
        glowMul: 1.35,
      },
    ];
  }, [weeklySchedule, workoutStats]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
      {cards.map((card, idx) => {
        const gid = `${baseId}-fill-${idx}`;
        const glow = (card.glowMul ?? 1) * 10;

        return (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.07, type: "spring", stiffness: 320, damping: 26 }}
            className="relative overflow-hidden rounded-2xl border border-white/[0.07] shadow-[0_12px_40px_-12px_rgba(0,0,0,0.65)]"
            style={{
              background:
                "linear-gradient(155deg, rgba(18,21,30,0.98) 0%, rgba(10,12,18,0.99) 48%, rgba(8,10,16,1) 100%)",
            }}
          >
            <div
              className="pointer-events-none absolute -right-6 -top-10 h-28 w-28 rounded-full opacity-[0.14] blur-2xl"
              style={{ background: `radial-gradient(circle, rgba(${card.rgb},0.9) 0%, transparent 70%)` }}
            />
            <div className="relative z-10 px-3.5 pt-3.5 sm:px-4 sm:pt-4 pb-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    {card.label}
                  </p>
                  <p className="mt-1 text-2xl sm:text-[1.65rem] font-bold tabular-nums tracking-tight text-white leading-none">
                    {card.value}
                  </p>
                  <p className="mt-1 text-[10px] sm:text-xs text-slate-600">{card.sub}</p>
                </div>
                <div
                  className="shrink-0 rounded-xl border p-2 sm:p-2.5 flex items-center justify-center"
                  style={{
                    color: card.color,
                    background: `rgba(${card.rgb},0.1)`,
                    borderColor: `rgba(${card.rgb},0.22)`,
                    boxShadow: `0 0 20px rgba(${card.rgb},0.12), inset 0 1px 0 rgba(255,255,255,0.06)`,
                  }}
                >
                  <Image
                    src={card.icon.src}
                    alt={card.icon.alt}
                    width={22}
                    height={22}
                    className="h-[18px] w-[18px] sm:h-5 sm:w-5 object-contain"
                  />
                </div>
              </div>
            </div>

            <div
              className="relative z-10 h-[52px] sm:h-[60px] w-full mt-0.5"
              style={{
                filter: `drop-shadow(0 0 ${glow}px rgba(${card.rgb},0.28)) drop-shadow(0 2px 8px rgba(${card.rgb},0.15))`,
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  key={`${card.label}-${card.value}-${card.yMax.toFixed(2)}`}
                  data={card.data}
                  margin={{ top: 5, right: 0, left: 0, bottom: 2 }}
                >
                  <defs>
                    <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={card.color} stopOpacity={0.45} />
                      <stop offset="45%" stopColor={card.color} stopOpacity={0.14} />
                      <stop offset="100%" stopColor={card.color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <YAxis hide domain={[0, card.yMax]} />
                  <Area
                    type="basis"
                    dataKey="v"
                    stroke={card.color}
                    strokeWidth={card.label === "Streak" ? 2.45 : 2.35}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill={`url(#${gid})`}
                    dot={false}
                    activeDot={false}
                    isAnimationActive
                    animationDuration={720}
                    animationEasing="ease-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
