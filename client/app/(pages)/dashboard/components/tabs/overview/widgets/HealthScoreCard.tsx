'use client';

import { motion } from 'framer-motion';
import { useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';

interface HealthMetric { label: string; value: number; color: string; glow: string }
interface HealthScoreCardProps {
  score: number;          // 0–100
  isLoading?: boolean;
  metrics?: HealthMetric[];
  steps?: number;
  calories?: number;
  sleepHours?: number;
}

const DEFAULT_METRICS: HealthMetric[] = [
  { label: 'Physical',  value: 82, color: 'linear-gradient(90deg,#34d399,#10b981)', glow: 'rgba(16,185,129,.7)'  },
  { label: 'Mental',    value: 76, color: 'linear-gradient(90deg,#38bdf8,#0ea5e9)', glow: 'rgba(14,165,233,.7)'  },
  { label: 'Sleep',     value: 68, color: 'linear-gradient(90deg,#a78bfa,#7c3aed)', glow: 'rgba(124,58,237,.7)'  },
  { label: 'Nutrition', value: 88, color: 'linear-gradient(90deg,#fb923c,#f97316)', glow: 'rgba(249,115,22,.7)'  },
];

// Body fill constants (external SVG mask)
const RING_R        = 40;
const RING_CIRC     = Math.round(2 * Math.PI * RING_R); // 251
const BODY_FEET_Y   = 100;
const BODY_HEAD_Y   = 0;
const BODY_FILL_RNG = BODY_FEET_Y - BODY_HEAD_Y;
const BODY_SVG_PATH = '/overview/health.svg';

function scoreMeta(s: number): { color: string; rgb: string; label: string; gradientLight: string; gradientMid: string; gradientDark: string; glowRgb: string } {
  if (s >= 80) return { color: '#10b981', rgb: '16,185,129', label: 'Excellent', gradientLight: '#6ee7b7', gradientMid: '#10b981', gradientDark: '#064e3b', glowRgb: '16,185,129' };
  if (s >= 60) return { color: '#38bdf8', rgb: '56,189,248', label: 'Good', gradientLight: '#7dd3fc', gradientMid: '#0ea5e9', gradientDark: '#0c4a6e', glowRgb: '14,165,233' };
  if (s >= 40) return { color: '#fbbf24', rgb: '251,191,36', label: 'Getting There', gradientLight: '#fde68a', gradientMid: '#f59e0b', gradientDark: '#78350f', glowRgb: '245,158,11' };
  if (s >= 20) return { color: '#fb923c', rgb: '251,146,60', label: 'Needs Work', gradientLight: '#fdba74', gradientMid: '#ea580c', gradientDark: '#7c2d12', glowRgb: '234,88,12' };
                return { color: '#f87171', rgb: '248,113,113', label: 'Keep Going', gradientLight: '#fca5a5', gradientMid: '#ef4444', gradientDark: '#7f1d1d', glowRgb: '239,68,68' };
}

function scoreToFillY(s: number): number {
  return Math.round(BODY_FEET_Y - (s / 100) * BODY_FILL_RNG);
}

const CARD_CSS = `
  @keyframes hs-cg {
    0%,100%{box-shadow:0 6px 12px rgba(0,0,0,.6),0 20px 48px rgba(0,0,0,.7),0 0 0 1px rgba(16,185,129,.2),0 0 60px rgba(16,185,129,.06)}
    50%    {box-shadow:0 6px 12px rgba(0,0,0,.6),0 20px 48px rgba(0,0,0,.7),0 0 0 1px rgba(16,185,129,.36),0 0 80px rgba(16,185,129,.22),0 0 140px rgba(16,185,129,.08)}
  }
  @keyframes hs-gb  { 0%,100%{opacity:.42} 50%{opacity:1} }
  @keyframes hs-fp  { 0%,100%{opacity:.06} 50%{opacity:.22} }
  @keyframes hs-ss  { 0%{transform:translateX(-80px) skewX(-12deg);opacity:0} 35%{opacity:.09} 100%{transform:translateX(160px) skewX(-12deg);opacity:0} }
  @keyframes hs-dp  { 0%,100%{box-shadow:0 0 6px rgba(16,185,129,.65)} 50%{box-shadow:0 0 14px rgba(16,185,129,1),0 0 28px rgba(16,185,129,.5)} }
  @keyframes hs-pr  { 0%{transform:translate(-50%,-50%) scale(.7);opacity:.5} 100%{transform:translate(-50%,-50%) scale(2.5);opacity:0} }
  .hs-ring { transition: stroke-dashoffset .9s cubic-bezier(.4,0,.2,1); }
  .hs-body-shell {
    -webkit-mask-image: url('/overview/health.svg');
    mask-image: url('/overview/health.svg');
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-position: center;
    mask-position: center;
    -webkit-mask-size: contain;
    mask-size: contain;
  }
`;

export function HealthScoreCard({
  score,
  isLoading    = false,
  metrics,
  steps        = 8432,
  calories     = 1840,
  sleepHours   = 7.2,
}: HealthScoreCardProps) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const { color, rgb, label, gradientLight, gradientMid, gradientDark, glowRgb } = useMemo(() => scoreMeta(clampedScore), [clampedScore]);
  const initialFillY = scoreToFillY(clampedScore);
  const normalizedSleep = Math.max(0, Math.min(10, sleepHours));
  const normalizedSteps = Math.max(0, Math.min(14000, steps));
  const normalizedCalories = Math.max(0, Math.min(3500, calories));

  const computedMetrics = useMemo<HealthMetric[]>(() => {
    if (metrics && metrics.length > 0) return metrics;
    return [
      { ...DEFAULT_METRICS[0], value: Math.round((normalizedSteps / 14000) * 100) },
      { ...DEFAULT_METRICS[1], value: clampedScore },
      { ...DEFAULT_METRICS[2], value: Math.round((normalizedSleep / 10) * 100) },
      { ...DEFAULT_METRICS[3], value: Math.round((normalizedCalories / 3500) * 100) },
    ];
  }, [metrics, normalizedSteps, clampedScore, normalizedSleep, normalizedCalories]);

  // Refs for imperative updates (RAF + ring)
  const fillGroupRef  = useRef<HTMLDivElement>(null);
  const ringRef       = useRef<SVGCircleElement>(null);
  const currentY      = useRef(initialFillY);
  const rafRef        = useRef<number>(0);

  // Smooth fill level with RAF lerp
  useEffect(() => {
    const target = scoreToFillY(clampedScore);
    const run = () => {
      const d = target - currentY.current;
      if (Math.abs(d) > 0.15) {
        currentY.current += d * 0.07;
          fillGroupRef.current?.style.setProperty('transform', `translateY(${currentY.current.toFixed(2)}%)`);
        rafRef.current = requestAnimationFrame(run);
      } else {
        currentY.current = target;
          fillGroupRef.current?.style.setProperty('transform', `translateY(${target}%)`);
      }
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(run);
    return () => cancelAnimationFrame(rafRef.current);
  }, [clampedScore]);

  // Ring dashoffset (CSS transition handles animation)
  useEffect(() => {
    if (ringRef.current) {
      const offset = isLoading
        ? RING_CIRC
        : RING_CIRC - (clampedScore / 100) * RING_CIRC;
      ringRef.current.setAttribute('stroke-dashoffset', offset.toFixed(1));
    }
  }, [clampedScore, isLoading]);

  return (
    <>
      <style>{CARD_CSS}</style>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -5, transition: { type: 'spring', stiffness: 380, damping: 24 } }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative overflow-hidden rounded-[28px] cursor-pointer"
        style={{
          padding: '24px 24px 18px',
          background: 'linear-gradient(148deg,#0e1626 0%,#090f1e 55%,#060a14 100%)',
          animation: 'hs-cg 3s ease-in-out infinite',
        }}
      >
        {/* Top / bottom accent lines */}
        <div className="absolute top-0 left-[8%] right-[8%] h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.1),transparent)' }} />
        <div className="absolute bottom-0 left-[8%] right-[8%] h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg,transparent,rgba(16,185,129,.2),transparent)' }} />

        {/* Ambient glows */}
        <div className="absolute pointer-events-none rounded-full"
          style={{ top:-70,left:-50,width:260,height:260,background:'radial-gradient(circle,rgba(16,185,129,.15) 0%,transparent 65%)',animation:'hs-gb 2.8s ease-in-out infinite' }} />
        <div className="absolute pointer-events-none rounded-full"
          style={{ bottom:-60,right:-40,width:220,height:220,background:'radial-gradient(circle,rgba(6,182,212,.09) 0%,transparent 65%)' }} />

        {/* ── Main content row ── */}
        <div className="relative z-10 flex items-center justify-between gap-2">

          {/* LEFT — score + metrics */}
          <div className="flex-1 min-w-0">
            {/* Live badge */}
            <div className="flex items-center gap-[7px] mb-[10px]">
              <span className="w-[7px] h-[7px] rounded-full bg-emerald-500 shrink-0"
                style={{ animation: 'hs-dp 1.3s ease-in-out infinite' }} />
              <h3 className="text-[12px] font-extrabold capitalize tracking-[0.14em] leading-[1.1] text-white">
                Health Score
              </h3>
            </div>

            {/* Ring + title */}
            <div className="flex items-center gap-4 mb-[14px]">
              {/* Circular progress ring */}
              <div className="relative shrink-0">
                <svg width="100" height="100" viewBox="0 0 100 100">
                  <defs>
                    <linearGradient id="hs-rg" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%"   stopColor={gradientLight} />
                      <stop offset="100%" stopColor={gradientDark} />
                    </linearGradient>
                    <filter id="hs-rf">
                      <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b" />
                      <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                    <filter id="hs-tf">
                      <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b" />
                      <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>
                  {/* Outer soft halo */}
                  <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(16,185,129,0.06)" strokeWidth="12" />
                  {/* Track */}
                  <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(16,185,129,0.1)" strokeWidth="5" />
                  {/* Progress arc */}
                  <circle
                    ref={ringRef}
                    className="hs-ring"
                    cx="50" cy="50" r="40"
                    fill="none"
                    stroke="url(#hs-rg)"
                    strokeWidth="5.5"
                    strokeLinecap="round"
                    strokeDasharray={RING_CIRC}
                    strokeDashoffset={RING_CIRC}
                    transform="rotate(-90 50 50)"
                    filter="url(#hs-rf)"
                  />
                  {/* Score number */}
                  <text
                    x="50" y="48" textAnchor="middle" fill="white"
                    fontSize="22" fontWeight="800" fontFamily="system-ui,sans-serif"
                    filter="url(#hs-tf)">
                    {isLoading ? '--' : clampedScore}
                  </text>
                  <text x="50" y="63" textAnchor="middle"
                    fill="rgba(255,255,255,0.38)" fontSize="10" fontWeight="400"
                    fontFamily="system-ui,sans-serif" letterSpacing="2">
                    SCORE
                  </text>
                </svg>
              </div>

              {/* <div>
                <h3 className="text-[21px] font-extrabold text-white leading-[1.1] tracking-tight mb-[5px]">
                  Health Score
                </h3>
                {!isLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="inline-flex items-center gap-[6px] px-[11px] py-[5px] rounded-full text-[11px] font-bold tracking-[0.04em]"
                    style={{
                      background: `rgba(${rgb},0.12)`,
                      border: `1px solid rgba(${rgb},0.3)`,
                      color,
                    }}
                  >
                    <span className="w-[5px] h-[5px] rounded-full shrink-0"
                      style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
                    {label}
                  </motion.div>
                )}
              </div> */}
            </div>

            {/* Health metric bars */}
            <div className="flex flex-col gap-[7px]">
              {computedMetrics.map((m) => (
                <div key={m.label}>
                  <div className="flex justify-between mb-1">
                    <span className="text-[11px] font-medium text-white/42">{m.label}</span>
                    <span className="text-[11px] font-semibold text-white/65">{m.value}%</span>
                  </div>
                  <div className="h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.07)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${m.value}%` }}
                      transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1], delay: 0.6 }}
                      style={{ background: m.color, boxShadow: `0 0 6px ${m.glow}` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            
          </div>

          {/* RIGHT — Human figure */}
          <div className="relative shrink-0 hidden sm:flex items-center justify-center"
            style={{ width: 180, height: 280 }}>

            {/* Pulse rings */}
            {[0, 0.9].map((d, i) => (
              <div key={i} className="absolute pointer-events-none"
                style={{
                  top: '50%', left: '50%', width: 120, height: 240,
                  borderRadius: '50%',
                  border: `${1.5 - i * 0.5}px solid rgba(16,185,129,${0.18 - i * 0.07})`,
                  animation: `hs-pr 2.6s ease-out ${d}s infinite`,
                }}
              />
            ))}

            {/* Glow behind figure */}
            <div className="absolute pointer-events-none rounded-full"
              style={{ inset: -20, background: 'radial-gradient(circle,rgba(16,185,129,.28) 0%,transparent 65%)', animation: 'hs-gb 1.8s ease-in-out infinite' }} />

            <div
              className="hs-body-shell relative w-[170px] h-[270px] overflow-hidden"
              style={{
                background: '#020610',
                filter: 'drop-shadow(0 0 30px rgba(16,185,129,.6)) drop-shadow(0 0 60px rgba(16,185,129,.25)) drop-shadow(0 14px 28px rgba(0,0,0,.8))',
              }}
            >
              {/* Deep base glow — multiple layers for intensity */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(circle at 50% 40%, rgba(16,185,129,0.3) 0%, rgba(16,185,129,0.08) 40%, rgba(16,185,129,0) 65%)' }}
              />
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(circle at 35% 25%, rgba(110,231,183,0.15) 0%, transparent 50%)', animation: 'hs-gb 2.5s ease-in-out infinite' }}
              />

              {/* Liquid fill layer */}
              <div
                ref={fillGroupRef}
                className="absolute inset-0 will-change-transform"
                style={{ transform: `translateY(${initialFillY}%)` }}
              >
                {/* Main fill — brighter, more vivid gradient */}
                <div
                  className="absolute -top-[12px] left-0 right-0 h-[320px]"
                  style={{ background: `linear-gradient(180deg, ${gradientLight} 0%, ${gradientMid} 40%, ${gradientDark} 100%)` }}
                />
                {/* Shimmer sweeps — brighter */}
                <div className="absolute -top-[12px] left-[-70px] h-[320px] w-[90px]"
                  style={{ background: 'rgba(255,255,255,0.1)', animation: 'hs-ss 4s ease-in-out .5s infinite' }} />
                <div className="absolute -top-[12px] left-[-70px] h-[320px] w-[70px]"
                  style={{ background: 'rgba(255,255,255,0.06)', animation: 'hs-ss 4s ease-in-out 2.5s infinite' }} />
                {/* Surface highlight */}
                <div className="absolute top-0 left-0 right-0 h-[20px]" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.15), rgba(255,255,255,0.02))' }} />
                {/* Surface glow sweep */}
                <div className="absolute top-0 left-[-100%] h-[22px] w-[200%]"
                  style={{
                    background: 'radial-gradient(ellipse at center, rgba(167,243,208,0.35) 0%, rgba(167,243,208,0) 70%)',
                    animation: 'hs-ss 2.8s linear infinite',
                  }}
                />
              </div>

              {/* SVG asset overlay — brighter, full opacity */}
              <Image
                src={BODY_SVG_PATH}
                alt="Body silhouette"
                fill
                sizes="170px"
                className="absolute inset-0 object-contain pointer-events-none"
                style={{ opacity: 0.9, filter: 'brightness(1.2) drop-shadow(0 0 8px rgba(16,185,129,0.3))' }}
                priority={false}
              />
            </div>
          </div>
        </div>

       
      </motion.div>
    </>
  );
}