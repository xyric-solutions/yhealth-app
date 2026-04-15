'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import { useWhoopRealtime } from '../hooks/useWhoopRealtime';
import { Moon, Zap, Droplets, Apple } from 'lucide-react';
import { HeartRateCard } from './HeartRateCard';
import { HealthScoreCard } from './HealthScoreCard';
import { WaterDetailCard } from './WaterDetailCard';

// ─────────────────────────────────────────────────────────────
// Types (exported — other files depend on this)
// ─────────────────────────────────────────────────────────────

export interface EnhancedHealthMetrics {
  steps: { value: number | null; target: number };
  whoopAge: { value: number | null; chronologicalAge: number | null };
  water: { consumed: number; target: number };
  calories: { consumed: number; burned: number; target: number };
  nutrition: {
    macros: { protein: number; carbs: number; fats: number };
    targets: { protein: number; carbs: number; fats: number };
    calories?: number;
  };
  heartRate: {
    current: number | null;
    resting: number | null;
    history: Array<{ time: string; bpm: number }>;
  };
  analytics: {
    weeklyAvg: number;
    consistencyScore: number;
    dataPoints: number;
    trend: 'up' | 'down' | 'stable';
  };
  sleep?: {
    hours: number | null;
    quality: number | null;
  };
}

interface UnifiedHealthDashboardProps {
  data: EnhancedHealthMetrics;
  isLoading?: boolean;
  onAddWater?: () => void;
  onRemoveWater?: () => void;
}

// ─────────────────────────────────────────────────────────────
// AnimatedNumber — spring-driven counter
// ─────────────────────────────────────────────────────────────

function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const spring = useSpring(0, { stiffness: 60, damping: 20 });
  const display = useTransform(spring, (v) =>
    decimals > 0 ? v.toFixed(decimals) : Math.round(v).toString(),
  );
  const [text, setText] = useState(decimals > 0 ? '0.0' : '0');

  useEffect(() => {
    spring.set(value);
    const unsub = display.on('change', (v) => setText(v));
    return unsub;
  }, [value, spring, display]);

  return <>{text}</>;
}

// ─────────────────────────────────────────────────────────────
// Injected CSS — metric glow animations
// ─────────────────────────────────────────────────────────────

const METRIC_CSS = `
  @keyframes mc-orb { 0%,100%{opacity:.35;transform:scale(1)} 50%{opacity:.7;transform:scale(1.15)} }
  @keyframes mc-shimmer { 0%{transform:translateX(-200%) rotate(-12deg);opacity:0} 40%{opacity:.08} 100%{transform:translateX(200%) rotate(-12deg);opacity:0} }
  @keyframes mc-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
  @keyframes mc-pulse-border { 0%,100%{opacity:.15} 50%{opacity:.4} }
  @keyframes mc-twinkle { 0%,100%{opacity:.2;transform:scale(.8)} 50%{opacity:.9;transform:scale(1.2)} }
  @keyframes mc-needle { 0%{transform:rotate(-135deg)} }
  @keyframes mc-segment-pop { from{opacity:0;transform:scale(.7)} to{opacity:1;transform:scale(1)} }
`;

// ─── Shared 3D card wrapper for all metric circles ───────────
function MetricShell({
  children, color, delay = 0, onClick, subtitle,
}: {
  children: React.ReactNode; color: string; delay?: number;
  onClick?: () => void; subtitle?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 260, damping: 24 }}
      whileHover={{ scale: 1.06, transition: { type: 'spring', stiffness: 400, damping: 20 } }}
      onClick={onClick}
      className={`group/metric relative flex flex-col items-center min-w-[160px] snap-center ${onClick ? 'cursor-pointer' : ''}`}
      style={{ animation: 'mc-float 4s ease-in-out infinite', animationDelay: `${delay}s` }}
    >
      {/* Hover orb */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[220px] h-[220px] rounded-full pointer-events-none opacity-0 group-hover/metric:opacity-100 transition-opacity duration-700"
        style={{ background: `radial-gradient(circle, ${color}15 0%, transparent 70%)` }} />
      {/* 3D container */}
      <div className="relative rounded-full p-1" style={{
        background: `radial-gradient(circle at 35% 30%, ${color}1a 0%, rgba(10,12,28,0.85) 55%, rgba(6,8,18,0.95) 100%)`,
        border: `1px solid ${color}28`,
        boxShadow: `0 4px 8px rgba(0,0,0,0.4), 0 12px 32px rgba(0,0,0,0.5), 0 24px 64px rgba(0,0,0,0.25), 0 0 40px ${color}0d, 0 0 80px ${color}06, inset 0 1px 0 rgba(255,255,255,0.09), inset 0 -2px 8px rgba(0,0,0,0.4)`,
      }}>
        {/* Shimmer */}
        <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
          <div className="absolute inset-0 opacity-0 group-hover/metric:opacity-100" style={{ animation: 'mc-shimmer 2.5s ease-in-out infinite' }}>
            <div className="w-24 h-full bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
          </div>
        </div>
        {children}
      </div>
      {subtitle && <span className="text-[11px] text-slate-400/80 mt-2.5 text-center font-medium">{subtitle}</span>}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// 1. SleepCrescentChart — Moon arc with twinkling stars
// ─────────────────────────────────────────────────────────────

function SleepCrescentChart({ value, max, subtitle, delay = 0 }: {
  value: number | null; max: number; subtitle?: string; delay?: number;
}) {
  const uid = useRef(`sl-${Math.random().toString(36).slice(2, 8)}`).current;
  const ratio = value !== null && max > 0 ? Math.min(value / max, 1) : 0;
  // Arc sweeps from 210° to 330° (a 240° range at the bottom)
  const sweepDeg = ratio * 240;
  const r = 72;
  const startAngle = (150 * Math.PI) / 180; // 150° = bottom-left
  const endAngle = ((150 + sweepDeg) * Math.PI) / 180;
  const largeArc = sweepDeg > 180 ? 1 : 0;
  const x1 = 90 + r * Math.cos(startAngle);
  const y1 = 90 + r * Math.sin(startAngle);
  const x2 = 90 + r * Math.cos(endAngle);
  const y2 = 90 + r * Math.sin(endAngle);
  const arcD = value !== null ? `M${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2}` : '';

  // Decorative stars
  const stars = useMemo(() => [
    { cx: 30, cy: 25, r: 1.5, d: 0 }, { cx: 55, cy: 18, r: 1, d: 0.5 },
    { cx: 145, cy: 22, r: 1.2, d: 1 }, { cx: 160, cy: 45, r: 1, d: 1.5 },
    { cx: 25, cy: 55, r: 1, d: 0.8 }, { cx: 155, cy: 70, r: 1.4, d: 0.3 },
    { cx: 40, cy: 42, r: 0.8, d: 1.2 }, { cx: 130, cy: 30, r: 1.1, d: 0.7 },
  ], []);

  return (
    <MetricShell color="#a855f7" delay={delay} subtitle={subtitle}>
      <svg width="180" height="180" viewBox="0 0 180 180">
        <defs>
          <linearGradient id={`sg-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
        </defs>

        {/* Twinkling stars */}
        {stars.map((s, i) => (
          <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="#c084fc"
            style={{ animation: `mc-twinkle ${2 + s.d}s ease-in-out ${s.d}s infinite`, filter: 'drop-shadow(0 0 4px rgba(192,132,252,0.6))' }} />
        ))}

        {/* Track arc (dimmed) */}
        <path d={`M${90 + r * Math.cos(startAngle)},${90 + r * Math.sin(startAngle)} A${r},${r} 0 1 1 ${90 + r * Math.cos((390 * Math.PI) / 180)},${90 + r * Math.sin((390 * Math.PI) / 180)}`}
          fill="none" stroke="rgba(168,85,247,0.08)" strokeWidth={10} strokeLinecap="round" />

        {/* Glow layer */}
        {arcD && (
          <motion.path d={arcD} fill="none" stroke="#a855f7" strokeWidth={16} strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 1.4, delay: delay + 0.15, ease: [0.4, 0, 0.2, 1] }}
            style={{ filter: 'blur(10px)', opacity: 0.35 }} />
        )}

        {/* Progress arc */}
        {arcD && (
          <motion.path d={arcD} fill="none" stroke={`url(#sg-${uid})`} strokeWidth={10} strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 1.4, delay: delay + 0.15, ease: [0.4, 0, 0.2, 1] }}
            style={{ filter: 'drop-shadow(0 0 10px rgba(168,85,247,0.6))' }} />
        )}

        {/* Moon icon in center */}
        <g transform="translate(90,72)">
          <Moon style={{ color: '#c084fc', filter: 'drop-shadow(0 0 8px rgba(192,132,252,0.6))' } as React.CSSProperties}
            width={20} height={20} x={-10} y={-10} />
        </g>
      </svg>

      {/* Center value overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-6">
        <span className="text-[28px] font-bold text-white tabular-nums leading-none"
          style={{ textShadow: '0 0 24px rgba(168,85,247,0.4)' }}>
          {value === null ? <span className="text-slate-600">--</span> : <AnimatedNumber value={value} decimals={1} />}
        </span>
        <span className="text-[10px] text-purple-300/60 mt-1 uppercase tracking-wider font-medium">hours</span>
      </div>
    </MetricShell>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. ConsistencySegmentRing — Segmented tick-mark ring
// ─────────────────────────────────────────────────────────────

function ConsistencySegmentRing({ value, subtitle, delay = 0 }: {
  value: number; subtitle?: string; delay?: number;
}) {
  const uid = useRef(`cs-${Math.random().toString(36).slice(2, 8)}`).current;
  const SEGMENTS = 24;
  const r = 72;
  const gap = 3; // degrees gap between segments
  const segAngle = 360 / SEGMENTS - gap;
  const filledCount = Math.round((value / 100) * SEGMENTS);

  return (
    <MetricShell color="#6366f1" delay={delay} subtitle={subtitle}>
      <svg width="180" height="180" viewBox="0 0 180 180">
        <defs>
          <linearGradient id={`cg-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>
        </defs>

        {/* Outer dashed decorative */}
        <circle cx="90" cy="90" r="86" fill="none" stroke="rgba(99,102,241,0.05)" strokeWidth="0.5" strokeDasharray="1 6" />

        {/* Segments */}
        {Array.from({ length: SEGMENTS }, (_, i) => {
          const startDeg = -90 + i * (360 / SEGMENTS);
          const endDeg = startDeg + segAngle;
          const filled = i < filledCount;
          const startRad = (startDeg * Math.PI) / 180;
          const endRad = (endDeg * Math.PI) / 180;
          const x1 = 90 + r * Math.cos(startRad);
          const y1 = 90 + r * Math.sin(startRad);
          const x2 = 90 + r * Math.cos(endRad);
          const y2 = 90 + r * Math.sin(endRad);

          return (
            <motion.path
              key={i}
              d={`M${x1},${y1} A${r},${r} 0 0 1 ${x2},${y2}`}
              fill="none"
              stroke={filled ? `url(#cg-${uid})` : 'rgba(99,102,241,0.08)'}
              strokeWidth={filled ? 8 : 6}
              strokeLinecap="round"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: delay + 0.05 * i, duration: 0.15 }}
              style={filled ? { filter: 'drop-shadow(0 0 6px rgba(99,102,241,0.5))' } : undefined}
            />
          );
        })}
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="p-1.5 rounded-lg mb-1" style={{ background: 'rgba(99,102,241,0.15)' }}>
          <Zap className="w-[18px] h-[18px] text-indigo-400" style={{ filter: 'drop-shadow(0 0 6px rgba(99,102,241,0.6))' }} />
        </div>
        <span className="text-[28px] font-bold text-white tabular-nums leading-none"
          style={{ textShadow: '0 0 24px rgba(99,102,241,0.4)' }}>
          <AnimatedNumber value={value} />
        </span>
        <span className="text-[10px] text-indigo-300/60 mt-0.5 uppercase tracking-wider font-medium">%</span>
      </div>
    </MetricShell>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. WhoopAgeGauge — Speedometer/dial gauge
// ─────────────────────────────────────────────────────────────

function WhoopAgeGauge({ value, subtitle, delay = 0, label = 'Whoop Age', unit = 'years' }: {
  value: number | null; subtitle?: string; delay?: number; label?: string; unit?: string;
}) {
  const uid = useRef(`wg-${Math.random().toString(36).slice(2, 8)}`).current;
  // For temperature (°C): map 30-40 range to 0-100%. For age/other: map 0-100.
  const isTemp = unit === '°C';
  const ratio = value !== null
    ? isTemp ? Math.max(0, Math.min((value - 30) / 10, 1)) : Math.min(value / 100, 1)
    : 0;
  // Gauge from 135° to 405° (270° sweep)
  const r = 70;
  const totalDeg = 270;
  const startDeg = 135;
  const needleDeg = startDeg + ratio * totalDeg;

  // Build arc path for track & fill
  const arcPath = (start: number, sweep: number) => {
    const s = (start * Math.PI) / 180;
    const e = ((start + sweep) * Math.PI) / 180;
    const large = sweep > 180 ? 1 : 0;
    return `M${90 + r * Math.cos(s)},${90 + r * Math.sin(s)} A${r},${r} 0 ${large} 1 ${90 + r * Math.cos(e)},${90 + r * Math.sin(e)}`;
  };

  // Tick marks
  const ticks = useMemo(() => {
    const result = [];
    for (let i = 0; i <= 10; i++) {
      const deg = startDeg + (i / 10) * totalDeg;
      const rad = (deg * Math.PI) / 180;
      const isMain = i % 5 === 0;
      const innerR = isMain ? r - 12 : r - 8;
      result.push({
        x1: 90 + innerR * Math.cos(rad), y1: 90 + innerR * Math.sin(rad),
        x2: 90 + (r - 2) * Math.cos(rad), y2: 90 + (r - 2) * Math.sin(rad),
        isMain,
      });
    }
    return result;
  }, []);

  return (
    <MetricShell color="#10b981" delay={delay} subtitle={subtitle}>
      <svg width="180" height="180" viewBox="0 0 180 180">
        <defs>
          <linearGradient id={`gg-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>

        {/* Track */}
        <path d={arcPath(startDeg, totalDeg)} fill="none" stroke="rgba(16,185,129,0.08)" strokeWidth={12} strokeLinecap="round" />

        {/* Glow layer */}
        {value !== null && (
          <motion.path d={arcPath(startDeg, ratio * totalDeg || 0.1)} fill="none" stroke="#10b981" strokeWidth={18} strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 1.4, delay: delay + 0.15, ease: [0.4, 0, 0.2, 1] }}
            style={{ filter: 'blur(10px)', opacity: 0.3 }} />
        )}

        {/* Fill arc */}
        {value !== null && (
          <motion.path d={arcPath(startDeg, ratio * totalDeg || 0.1)} fill="none" stroke={`url(#gg-${uid})`} strokeWidth={12} strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
            transition={{ duration: 1.4, delay: delay + 0.15, ease: [0.4, 0, 0.2, 1] }}
            style={{ filter: 'drop-shadow(0 0 8px rgba(16,185,129,0.5))' }} />
        )}

        {/* Tick marks */}
        {ticks.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke={t.isMain ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'}
            strokeWidth={t.isMain ? 2 : 1} strokeLinecap="round" />
        ))}

        {/* Needle */}
        {value !== null && (
          <motion.g
            initial={{ rotate: startDeg }}
            animate={{ rotate: needleDeg }}
            transition={{ duration: 1.6, delay: delay + 0.2, ease: [0.4, 0, 0.2, 1] }}
            style={{ transformOrigin: '90px 90px' }}
          >
            <line x1="90" y1="90" x2={90 + 52} y2="90" stroke="url(#gg-${uid})" strokeWidth="2.5" strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 4px rgba(16,185,129,0.6))' }} />
            <circle cx="90" cy="90" r="5" fill="#10b981" style={{ filter: 'drop-shadow(0 0 8px rgba(16,185,129,0.8))' }} />
            <circle cx="90" cy="90" r="2.5" fill="#0f172a" />
          </motion.g>
        )}
      </svg>

      {/* Center value */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
        <span className="text-[28px] font-bold text-white tabular-nums leading-none"
          style={{ textShadow: '0 0 24px rgba(16,185,129,0.4)' }}>
          {value === null ? <span className="text-slate-600">--</span> : <AnimatedNumber value={value} decimals={1} />}
        </span>
        <span className="text-[10px] text-emerald-300/60 mt-0.5 uppercase tracking-wider font-medium">{unit}</span>
      </div>
      {/* Label below */}
      <span className="mt-2 text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">{label}</span>
    </MetricShell>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. WaterFillCircle — Bowl fill with animated waves
// ─────────────────────────────────────────────────────────────

function WaterFillCircle({ consumed, target, onClick, delay = 0 }: {
  consumed: number; target: number; onClick?: () => void; delay?: number;
}) {
  const uid = useRef(`wc-${Math.random().toString(36).slice(2, 8)}`).current;
  const glasses = Math.round(consumed / 250);
  const ratio = target > 0 ? Math.min(consumed / target, 1) : 0;
  const fillY = 175 - ratio * 170;

  return (
    <MetricShell color="#06b6d4" delay={delay} onClick={onClick}
      subtitle={`${Math.round(consumed)}/${Math.round(target)} ml`}>
      <svg width="180" height="180" viewBox="0 0 180 180">
        <defs>
          <clipPath id={`wclip-${uid}`}><circle cx="90" cy="90" r="80" /></clipPath>
          <linearGradient id={`wfill-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.9" />
            <stop offset="30%" stopColor="#06b6d4" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#0891b2" stopOpacity="0.95" />
          </linearGradient>
        </defs>

        <circle cx="90" cy="90" r="80" fill="rgba(6,4,18,0.9)" stroke="rgba(6,182,212,0.1)" strokeWidth="1.5" />

        <g clipPath={`url(#wclip-${uid})`}>
          <motion.rect x="0" width="180" height="180" fill={`url(#wfill-${uid})`}
            initial={{ y: 175 }} animate={{ y: fillY }}
            transition={{ duration: 1.5, ease: [0.4, 0, 0.2, 1], delay: delay + 0.2 }} />
          <motion.rect x="0" width="180" height="6" fill="rgba(34,211,238,0.4)"
            initial={{ y: 175 }} animate={{ y: fillY - 2 }}
            transition={{ duration: 1.5, ease: [0.4, 0, 0.2, 1], delay: delay + 0.2 }}
            style={{ filter: 'blur(4px)' }} />
          <motion.path fill="rgba(34,211,238,0.25)"
            animate={{ d: [
              `M0 ${fillY + 5} Q45 ${fillY - 7} 90 ${fillY + 5} Q135 ${fillY + 17} 180 ${fillY + 5} V190 H0 Z`,
              `M0 ${fillY + 5} Q45 ${fillY + 15} 90 ${fillY + 3} Q135 ${fillY - 9} 180 ${fillY + 5} V190 H0 Z`,
              `M0 ${fillY + 5} Q45 ${fillY - 7} 90 ${fillY + 5} Q135 ${fillY + 17} 180 ${fillY + 5} V190 H0 Z`,
            ] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }} />
          <motion.path fill="rgba(8,145,178,0.2)"
            animate={{ d: [
              `M0 ${fillY + 8} Q45 ${fillY + 18} 90 ${fillY + 6} Q135 ${fillY - 4} 180 ${fillY + 8} V190 H0 Z`,
              `M0 ${fillY + 8} Q45 ${fillY - 2} 90 ${fillY + 10} Q135 ${fillY + 20} 180 ${fillY + 8} V190 H0 Z`,
              `M0 ${fillY + 8} Q45 ${fillY + 18} 90 ${fillY + 6} Q135 ${fillY - 4} 180 ${fillY + 8} V190 H0 Z`,
            ] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} />
        </g>

        <circle cx="90" cy="90" r="80" fill="none" stroke="rgba(6,182,212,0.12)" strokeWidth="2"
          style={{ animation: 'mc-pulse-border 3s ease-in-out infinite' }} />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Droplets className="w-4 h-4 text-cyan-400 mb-1" style={{ filter: 'drop-shadow(0 0 6px rgba(6,182,212,0.6))' }} />
        <span className="text-[28px] font-bold text-white tabular-nums"
          style={{ textShadow: '0 0 16px rgba(6,182,212,0.4), 0 2px 4px rgba(0,0,0,0.6)' }}>
          {glasses}
        </span>
        <span className="text-[9px] font-semibold text-cyan-300/60 uppercase tracking-wider">glasses</span>
      </div>

      {onClick && (
        <motion.div className="absolute inset-3 rounded-full" style={{ border: '1px solid rgba(6,182,212,0.2)' }}
          animate={{ scale: [1, 1.08, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 2.5, repeat: Infinity }} />
      )}
    </MetricShell>
  );
}

// ─────────────────────────────────────────────────────────────
// 5. NutritionMultiRing — Triple concentric gradient rings
// ─────────────────────────────────────────────────────────────

function NutritionMultiRing({ protein, carbs, fat, proteinTarget, carbsTarget, fatTarget, delay = 0 }: {
  protein: number; carbs: number; fat: number;
  proteinTarget: number; carbsTarget: number; fatTarget: number; delay?: number;
}) {
  const uid = useRef(`nr-${Math.random().toString(36).slice(2, 8)}`).current;
  const total = protein + carbs + fat;
  const rings = [
    { value: protein, max: proteinTarget, color: '#3b82f6', end: '#60a5fa', label: 'P', r: 76 },
    { value: carbs, max: carbsTarget, color: '#f59e0b', end: '#fbbf24', label: 'C', r: 62 },
    { value: fat, max: fatTarget, color: '#22c55e', end: '#4ade80', label: 'F', r: 48 },
  ];

  return (
    <MetricShell color="#22c55e" delay={delay}>
      <svg width="180" height="180" viewBox="0 0 180 180" className="-rotate-90">
        <defs>
          {rings.map((ring, i) => (
            <linearGradient key={ring.label} id={`ng-${uid}-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={ring.color} />
              <stop offset="100%" stopColor={ring.end} />
            </linearGradient>
          ))}
        </defs>

        <circle cx="90" cy="90" r="86" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" strokeDasharray="2 4" />

        {rings.map((ring, i) => {
          const circ = 2 * Math.PI * ring.r;
          const ratio = ring.max > 0 ? Math.min(ring.value / ring.max, 1) : 0;
          const offset = circ * (1 - ratio);
          const tipAngle = 2 * Math.PI * ratio - Math.PI / 2;

          return (
            <g key={ring.label}>
              <circle cx="90" cy="90" r={ring.r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={9} />
              <motion.circle cx="90" cy="90" r={ring.r} fill="none" stroke={ring.color} strokeWidth={14}
                strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ}
                animate={{ strokeDashoffset: offset }}
                transition={{ duration: 1.4, ease: [0.4, 0, 0.2, 1], delay: delay + i * 0.15 }}
                style={{ filter: 'blur(8px)', opacity: 0.3 }} />
              <motion.circle cx="90" cy="90" r={ring.r} fill="none" stroke={`url(#ng-${uid}-${i})`}
                strokeWidth={9} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ}
                animate={{ strokeDashoffset: offset }}
                transition={{ duration: 1.4, ease: [0.4, 0, 0.2, 1], delay: delay + i * 0.15 }}
                style={{ filter: `drop-shadow(0 0 6px ${ring.color}55)` }} />
              {ratio > 0.05 && (
                <motion.circle cx={90 + ring.r * Math.cos(tipAngle)} cy={90 + ring.r * Math.sin(tipAngle)}
                  r="4" fill={ring.color}
                  initial={{ opacity: 0 }} animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity, delay: delay + i * 0.15 + 1.2 }}
                  style={{ filter: `drop-shadow(0 0 8px ${ring.color})` }} />
              )}
            </g>
          );
        })}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Apple className="w-4 h-4 text-emerald-400 mb-1" style={{ filter: 'drop-shadow(0 0 6px rgba(34,197,94,0.5))' }} />
        {total > 0 ? (
          <>
            <span className="text-2xl font-bold text-white tabular-nums" style={{ textShadow: '0 0 20px rgba(34,197,94,0.4)' }}>
              <AnimatedNumber value={total} /><span className="text-xs text-white/50 ml-0.5">g</span>
            </span>
            <div className="flex gap-2 mt-1.5">
              <span className="text-[9px] font-bold text-blue-400" style={{ textShadow: '0 0 8px rgba(59,130,246,0.4)' }}>P:{protein}</span>
              <span className="text-[9px] font-bold text-amber-400" style={{ textShadow: '0 0 8px rgba(245,158,11,0.4)' }}>C:{carbs}</span>
              <span className="text-[9px] font-bold text-emerald-400" style={{ textShadow: '0 0 8px rgba(34,197,94,0.4)' }}>F:{fat}</span>
            </div>
          </>
        ) : (
          <>
            <span className="text-lg font-bold text-white/30 tabular-nums">0g</span>
            <span className="text-[8px] text-white/25 mt-1">Log a meal</span>
          </>
        )}
      </div>
    </MetricShell>
  );
}

// ─────────────────────────────────────────────────────────────
// Skeleton Circle
// ─────────────────────────────────────────────────────────────

function SkeletonCircle() {
  return (
    <div className="flex flex-col items-center min-w-[160px] snap-center">
      <div className="w-[186px] h-[186px] rounded-full animate-pulse"
        style={{
          background: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.04) 0%, rgba(10,12,28,0.6) 70%)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 12px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        }} />
      <div className="w-16 h-3 rounded bg-white/[0.04] mt-3 animate-pulse" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────────

export function UnifiedHealthDashboard({
  data,
  isLoading = false,
  onAddWater,
  onRemoveWater,
}: UnifiedHealthDashboardProps) {
  // ── Whoop integration (preserved) ──
  const { data: whoopData, isLoading: whoopLoading, refetch: refetchWhoop } = useWhoopRealtime({
    pollInterval: 10000,
    enabled: true,
  });

  const [manualRefreshTime, setManualRefreshTime] = useState<Date | null>(null);

  const lastRefresh = useMemo(() => {
    const whoopTime = whoopData.lastSync ? new Date(whoopData.lastSync) : null;
    if (!whoopTime) return manualRefreshTime || new Date();
    if (!manualRefreshTime) return whoopTime;
    return whoopTime > manualRefreshTime ? whoopTime : manualRefreshTime;
  }, [whoopData.lastSync, manualRefreshTime]);

  // ── Score calculation (preserved) ──
  const overallScore = useMemo(() => {
    const metrics = [
      data.steps.value ? (data.steps.value / data.steps.target) * 100 : 0,
      data.water.consumed ? (data.water.consumed / data.water.target) * 100 : 0,
      data.calories.consumed ? Math.min((data.calories.consumed / data.calories.target) * 100, 100) : 0,
      data.analytics.consistencyScore,
      data.sleep?.hours ? (data.sleep.hours / 8) * 100 : 0,
    ];
    return Math.round(metrics.reduce((s, v) => s + v, 0) / metrics.length);
  }, [data]);

  const insightsData = useMemo(() => {
    const dataAny = data as unknown as Record<string, unknown>;
    if (dataAny.insights) {
      const insights = dataAny.insights as { weeklyAvg: number };
      return { weeklyAvg: insights.weeklyAvg, consistencyScore: insights.weeklyAvg, dataPoints: 0, trend: 'stable' as const };
    }
    return data.analytics;
  }, [data]);

  // ── Merged heart rate with min/avg/max from Whoop ──
  const mergedHeartRate = (() => {
    const history = whoopData.heartRate.history.length > 0
      ? whoopData.heartRate.history
      : data.heartRate.history;

    // Compute min/avg/max from history if available
    let minBpm: number | null = null;
    let avgBpm: number | null = null;
    let maxBpm: number | null = null;

    if (history.length > 0) {
      const bpmValues = history.map(h => h.bpm).filter(b => b > 0);
      if (bpmValues.length > 0) {
        minBpm = Math.min(...bpmValues);
        avgBpm = Math.round(bpmValues.reduce((a, b) => a + b, 0) / bpmValues.length);
        maxBpm = Math.max(...bpmValues);
      }
    }

    // Fallback to Whoop strain data for avg/max
    if (!avgBpm && whoopData.strain.avgHr) avgBpm = Math.round(whoopData.strain.avgHr);
    if (!maxBpm && whoopData.strain.maxHr) maxBpm = Math.round(whoopData.strain.maxHr);
    if (!maxBpm && whoopData.heartRate.max) maxBpm = Math.round(whoopData.heartRate.max);

    if (whoopData.heartRate.current) {
      return {
        current: whoopData.heartRate.current,
        resting: whoopData.heartRate.resting || data.heartRate.resting,
        minBpm,
        avgBpm,
        maxBpm,
      };
    }
    return {
      current: data.heartRate.current,
      resting: data.heartRate.resting,
      minBpm,
      avgBpm,
      maxBpm,
    };
  })();

  const handleRefresh = () => {
    refetchWhoop();
    setManualRefreshTime(new Date());
  };

  const loading = isLoading || whoopLoading;

  // ── Nutrition totals ──
  const totalMacros = data.nutrition.macros.protein + data.nutrition.macros.carbs + data.nutrition.macros.fats;
  const totalTargets = data.nutrition.targets.protein + data.nutrition.targets.carbs + data.nutrition.targets.fats;

  return (
    <div className="space-y-5">
      <style>{METRIC_CSS}</style>

      {/* ── Metrics Row — 5 premium 3D circles ── */}
      <div className="flex gap-9 pl-6 sm:pl-0 mt-4 sm:mt-0 sm:gap-4 overflow-x-auto pb-4 snap-x snap-mandatory lg:grid lg:grid-cols-5 lg:overflow-visible scrollbar-hide">
        {loading ? (
          <>
            <SkeletonCircle />
            <SkeletonCircle />
            <SkeletonCircle />
            <SkeletonCircle />
            <SkeletonCircle />
          </>
        ) : (
          <>
            {/* 1. Sleep — Crescent moon arc with stars */}
            <SleepCrescentChart
              value={whoopData.sleep.hours ?? data.sleep?.hours ?? null}
              max={10}
              subtitle={whoopData.recovery.score ? `Recovery: ${whoopData.recovery.score}%` : undefined}
              delay={0.05}
            />
            {/* 2. Consistency — Segmented tick-mark ring */}
            <ConsistencySegmentRing
              value={insightsData.consistencyScore}
              subtitle={`${insightsData.weeklyAvg} weekly avg`}
              delay={0.1}
            />
            {/* 3. Temperature — from Whoop skin temp */}
            <WhoopAgeGauge
              value={whoopData.recovery.skinTemp}
              subtitle={whoopData.recovery.skinTemp ? `Skin Temp` : undefined}
              delay={0.2}
              label=""
              unit="°C"
            />
            {/* 4. Water — Bowl fill with waves */}
            <WaterFillCircle
              consumed={data.water.consumed}
              target={data.water.target}
              onClick={onAddWater}
              delay={0.25}
            />
            {/* 5. Nutrition — Triple concentric rings */}
            <NutritionMultiRing
              protein={data.nutrition.macros.protein}
              carbs={data.nutrition.macros.carbs}
              fat={data.nutrition.macros.fats}
              proteinTarget={data.nutrition.targets.protein || 150}
              carbsTarget={data.nutrition.targets.carbs || 200}
              fatTarget={data.nutrition.targets.fats || 65}
              delay={0.3}
            />
          </>
        )}
      </div>

      {/* ── Row 3: Large Feature Cards (same height) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-8 auto-rows-fr">
        <HeartRateCard
          bpm={mergedHeartRate.current ?? mergedHeartRate.resting}
          restingBpm={mergedHeartRate.resting}
          minBpm={mergedHeartRate.minBpm ?? undefined}
          avgBpm={mergedHeartRate.avgBpm ?? undefined}
          maxBpm={mergedHeartRate.maxBpm ?? undefined}
          isLoading={loading}
        />
        <HealthScoreCard
          score={overallScore || insightsData.consistencyScore || 0}
          isLoading={loading}
          steps={data.steps.value || 0}
          calories={data.calories.consumed || 0}
          sleepHours={whoopData.sleep.hours ?? data.sleep?.hours ?? 0}
          metrics={[
            { label: 'Physical', value: Math.round(data.steps.value ? (data.steps.value / data.steps.target) * 100 : 0), color: 'linear-gradient(90deg,#34d399,#10b981)', glow: 'rgba(16,185,129,.7)' },
            { label: 'Mental', value: Math.round(insightsData.consistencyScore || 0), color: 'linear-gradient(90deg,#38bdf8,#0ea5e9)', glow: 'rgba(14,165,233,.7)' },
            { label: 'Sleep', value: Math.round((whoopData.sleep.hours ?? data.sleep?.hours ?? 0) / 10 * 100), color: 'linear-gradient(90deg,#a78bfa,#7c3aed)', glow: 'rgba(124,58,237,.7)' },
            { label: 'Nutrition', value: Math.round(data.calories.consumed ? Math.min((data.calories.consumed / data.calories.target) * 100, 100) : 0), color: 'linear-gradient(90deg,#fb923c,#f97316)', glow: 'rgba(249,115,22,.7)' },
          ]}
        />
        <WaterDetailCard
          glasses={Math.round(data.water.consumed / 250)}
          targetGlasses={Math.round(data.water.target / 250) || 8}
          mlConsumed={data.water.consumed}
          targetMl={data.water.target}
          onAddGlass={onAddWater}
          onRemoveGlass={onRemoveWater}
        />
      </div>
    </div>
  );
}
