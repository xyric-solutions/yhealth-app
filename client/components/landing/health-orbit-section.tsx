"use client";

import { motion } from "framer-motion";
import { useRef, useState } from "react";
import { useGSAP } from "@/hooks/use-gsap";
import { gsap } from "@/lib/gsap-init";
import { HealthOrbitSpline } from "./spline/HealthOrbitSpline";
import {
  Dumbbell,
  Moon,
  Heart,
  Droplets,
  Footprints,
  Brain,
  Apple,
  Flame,
  TrendingUp,
  Zap,
} from "lucide-react";

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

interface MetricNode {
  id: string;
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  color: string;
  ring: number; // 0-100 progress ring percentage
}

function generateMetrics(): MetricNode[] {
  const sleepH = (rand(55, 85) / 10).toFixed(1);
  const steps = rand(4000, 14000);
  const hr = rand(58, 78);
  const cal = rand(1200, 2200);
  const water = rand(4, 10);
  const waterGoal = rand(8, 12);
  const workouts = rand(2, 6);
  const streak = rand(3, 45);
  const mind = rand(1, 21);
  const recovery = rand(40, 98);

  return [
    { id: "fitness", label: "Fitness", value: `${workouts}/6`, sub: "workouts today", icon: <Dumbbell className="w-5 h-5" />, color: "#10b981", ring: (workouts / 6) * 100 },
    { id: "recovery", label: "Recovery", value: `${recovery}%`, sub: "from WHOOP", icon: <TrendingUp className="w-5 h-5" />, color: "#06b6d4", ring: recovery },
    { id: "nutrition", label: "Nutrition", value: `${cal}`, sub: "kcal today", icon: <Apple className="w-5 h-5" />, color: "#f59e0b", ring: Math.min(100, (cal / 2200) * 100) },
    { id: "sleep", label: "Sleep", value: `${sleepH}h`, sub: "last night", icon: <Moon className="w-5 h-5" />, color: "#6366f1", ring: Math.min(100, (parseFloat(sleepH) / 8) * 100) },
    { id: "heart", label: "Heart Rate", value: `${hr} bpm`, sub: `resting`, icon: <Heart className="w-5 h-5" />, color: "#ef4444", ring: Math.max(0, 100 - ((hr - 50) / 40) * 100) },
    { id: "hydration", label: "Hydration", value: `${water}/${waterGoal}`, sub: "glasses", icon: <Droplets className="w-5 h-5" />, color: "#3b82f6", ring: (water / waterGoal) * 100 },
    { id: "steps", label: "Steps", value: steps.toLocaleString(), sub: "of 10,000", icon: <Footprints className="w-5 h-5" />, color: "#06b6d4", ring: Math.min(100, (steps / 10000) * 100) },
    { id: "mindfulness", label: "Mindfulness", value: `${mind}d`, sub: "streak", icon: <Brain className="w-5 h-5" />, color: "#8b5cf6", ring: Math.min(100, (mind / 21) * 100) },
    { id: "streak", label: "Streak", value: `${streak}`, sub: "days active", icon: <Flame className="w-5 h-5" />, color: "#f59e0b", ring: Math.min(100, (streak / 30) * 100) },
    { id: "energy", label: "Energy", value: `${rand(60, 95)}%`, sub: "today", icon: <Zap className="w-5 h-5" />, color: "#eab308", ring: rand(60, 95) },
  ];
}

// SVG progress ring
function ProgressRing({ percent, color, size }: { percent: number; color: string; size: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, percent) / 100) * circ;

  return (
    <svg width={size} height={size} className="absolute inset-0">
      {/* Track */}
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
      {/* Progress */}
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={circ}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
        style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
      />
    </svg>
  );
}

export function HealthOrbitSection() {
  const ref = useRef<HTMLElement>(null);
  const [metrics] = useState<MetricNode[]>(() => generateMetrics());
  const [score] = useState(() => rand(65, 95));

  useGSAP(() => {
    // Header reveal
    gsap.from('.orbit-header', {
      y: 30, opacity: 0, duration: 0.7, ease: 'power3.out',
      scrollTrigger: { trigger: ref.current, start: 'top 80%' },
    });
    // Orbit nodes stagger
    gsap.from('.orbit-node', {
      scale: 0, opacity: 0, duration: 0.6, stagger: 0.08, ease: 'back.out(1.7)',
      scrollTrigger: { trigger: ref.current, start: 'top 70%' },
    });
    // Bottom stats
    gsap.from('.orbit-stat', {
      y: 20, opacity: 0, duration: 0.5, stagger: 0.1, ease: 'power2.out',
      scrollTrigger: { trigger: ref.current, start: 'top 50%' },
    });
  }, ref);

  // Layout: center + inner ring (4) + outer ring (6)
  const innerRing = metrics.slice(0, 4); // Fitness, Recovery, Nutrition, Sleep
  const outerRing = metrics.slice(4);    // Heart, Hydration, Steps, Mindfulness, Streak, Energy

  return (
    <section ref={ref} className="relative py-20 sm:py-28 overflow-hidden">
      {/* Spline 3D background layer */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <HealthOrbitSpline />
      </div>

      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full" style={{ background: "radial-gradient(circle, rgba(14,165,233,0.04) 0%, rgba(16,185,129,0.02) 35%, transparent 65%)" }} />
      </div>

      {/* Header */}
      <div className="orbit-header text-center mb-12 sm:mb-16 px-4 relative z-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-sky-500/20 bg-sky-500/5 mb-5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-medium text-sky-300">Real-time health intelligence</span>
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
          Your Life Universe
        </h2>
        <p className="text-base sm:text-lg text-white/50 max-w-xl mx-auto">
          Every metric connected. See how your fitness, sleep, nutrition, and wellbeing interact in real-time.
        </p>
      </div>

      {/* Orbit Visualization */}
      <div className="relative max-w-[520px] sm:max-w-[600px] md:max-w-[680px] mx-auto aspect-square px-4">

        {/* Orbit ring guides */}
        <motion.div className="absolute inset-[20%] rounded-full border border-dashed border-white/[0.04]"
          animate={{ rotate: 360 }}
          transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
        />
        <motion.div className="absolute inset-[5%] rounded-full border border-dashed border-white/[0.03]"
          animate={{ rotate: -360 }}
          transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
        />

        {/* ── SVG connection lines ── */}
        <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 1 }}>
          <defs>
            {metrics.map((m) => (
              <linearGradient key={`lg-${m.id}`} id={`lg-${m.id}`} x1="50%" y1="50%" x2="50%" y2="0%">
                <stop offset="0%" stopColor="rgba(14,165,233,0.3)" />
                <stop offset="100%" stopColor={m.color} stopOpacity="0.2" />
              </linearGradient>
            ))}
          </defs>

          {/* Lines from center to inner ring */}
          {innerRing.map((m, i) => {
            const positions = [
              [50, 24], [76, 50], [50, 76], [24, 50],
            ];
            const [px, py] = positions[i];
            return (
              <motion.line key={`cline-${m.id}`}
                x1="50%" y1="50%" x2={`${px}%`} y2={`${py}%`}
                stroke={`url(#lg-${m.id})`} strokeWidth="2"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                transition={{ duration: 0.8, delay: 0.6 + i * 0.1 }}
              />
            );
          })}

          {/* Lines from center to outer ring */}
          {outerRing.map((m, i) => {
            const positions = [
              [16, 16], [84, 16], [84, 84], [16, 84], [50, 6], [50, 94],
            ];
            const pos = positions[i] || [50, 50];
            return (
              <motion.line key={`oline-${m.id}`}
                x1="50%" y1="50%" x2={`${pos[0]}%`} y2={`${pos[1]}%`}
                stroke={m.color} strokeWidth="1" strokeOpacity="0.08"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
                transition={{ duration: 1, delay: 1.0 + i * 0.08 }}
              />
            );
          })}

          {/* Cross connections between inner ring nodes */}
          {innerRing.length >= 4 && (
            <>
              <motion.line x1="50%" y1="24%" x2="76%" y2="50%" stroke="rgba(255,255,255,0.04)" strokeWidth="1"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: 1.5 }} />
              <motion.line x1="76%" y1="50%" x2="50%" y2="76%" stroke="rgba(255,255,255,0.04)" strokeWidth="1"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: 1.6 }} />
              <motion.line x1="50%" y1="76%" x2="24%" y2="50%" stroke="rgba(255,255,255,0.04)" strokeWidth="1"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: 1.7 }} />
              <motion.line x1="24%" y1="50%" x2="50%" y2="24%" stroke="rgba(255,255,255,0.04)" strokeWidth="1"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: 1.8 }} />
            </>
          )}
        </svg>

        {/* ── Center "You" Node ── */}
        <div className="orbit-node absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
          <motion.div className="absolute -inset-6 rounded-full border border-sky-500/10"
            animate={{ scale: [1, 1.3], opacity: [0.3, 0] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          />
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full flex flex-col items-center justify-center"
            style={{
              background: "radial-gradient(circle at 40% 35%, rgba(14,165,233,0.5), rgba(14,165,233,0.12) 65%, rgba(6,182,212,0.04))",
              border: "2px solid rgba(14,165,233,0.4)",
              boxShadow: "0 0 50px rgba(14,165,233,0.2), 0 0 100px rgba(14,165,233,0.06)",
            }}
          >
            <ProgressRing percent={score} color="#0ea5e9" size={96} />
            <span className="text-white font-bold text-sm sm:text-base relative z-10">You</span>
            <span className="text-sky-300 text-[10px] sm:text-xs font-medium relative z-10">{score}%</span>
          </div>
        </div>

        {/* ── Inner Ring (4 primary metrics) ── */}
        {innerRing.map((m, i) => {
          const positions = [
            { x: 50, y: 24 }, // top
            { x: 76, y: 50 }, // right
            { x: 50, y: 76 }, // bottom
            { x: 24, y: 50 }, // left
          ];
          const pos = positions[i];

          return (
            <div key={m.id}
              className="orbit-node absolute z-10 flex flex-col items-center"
              style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%, -50%)" }}
            >
              {/* Node with progress ring */}
              <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center"
                style={{
                  background: `radial-gradient(circle at 38% 32%, ${m.color}35, ${m.color}10 65%, transparent)`,
                  border: `2px solid ${m.color}40`,
                  boxShadow: `0 0 24px ${m.color}20, inset 0 0 12px ${m.color}08`,
                }}
              >
                <ProgressRing percent={m.ring} color={m.color} size={64} />
                <div style={{ color: m.color }} className="relative z-10">{m.icon}</div>
              </div>

              {/* Value + label */}
              <div className="text-center mt-2">
                <div className="text-sm sm:text-base font-bold text-white">{m.value}</div>
                <div className="text-[10px] sm:text-xs font-semibold text-white/70">{m.label}</div>
                <div className="text-[9px] text-white/35">{m.sub}</div>
              </div>
            </div>
          );
        })}

        {/* ── Outer Ring (6 secondary metrics) ── */}
        {outerRing.map((m, i) => {
          const positions = [
            { x: 16, y: 16 }, // top-left
            { x: 84, y: 16 }, // top-right
            { x: 84, y: 84 }, // bottom-right
            { x: 16, y: 84 }, // bottom-left
            { x: 50, y: 6 },  // top-center
            { x: 50, y: 94 }, // bottom-center
          ];
          const pos = positions[i] || { x: 50, y: 50 };

          return (
            <div key={m.id}
              className="orbit-node absolute z-10 flex flex-col items-center"
              style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%, -50%)" }}
            >
              <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center"
                style={{
                  background: `radial-gradient(circle at 38% 32%, ${m.color}25, ${m.color}08 65%, transparent)`,
                  border: `1.5px solid ${m.color}30`,
                  boxShadow: `0 0 16px ${m.color}12`,
                }}
              >
                <ProgressRing percent={m.ring} color={m.color} size={48} />
                <div style={{ color: m.color, opacity: 0.8 }} className="relative z-10 scale-75 sm:scale-90">{m.icon}</div>
              </div>

              <div className="text-center mt-1.5">
                <div className="text-[11px] sm:text-xs font-bold text-white/80">{m.value}</div>
                <div className="text-[9px] sm:text-[10px] text-white/40">{m.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom stats bar */}
      <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 mt-10 sm:mt-14 px-4">
        {[
          { label: "Data Points", value: "10+" },
          { label: "AI Insights", value: "Real-time" },
          { label: "Connected Sources", value: "8+" },
        ].map((stat) => (
          <div key={stat.label} className="orbit-stat text-center">
            <div className="text-lg sm:text-xl font-bold text-white">{stat.value}</div>
            <div className="text-[10px] sm:text-xs text-white/40">{stat.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
