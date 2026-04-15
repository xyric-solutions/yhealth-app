'use client';

import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Snowflake, Loader2, TrendingUp, Star } from 'lucide-react';
import { useStreak } from '@/hooks/use-streak';

// ─── CSS ──────────────────────────────────────────────────────
const STREAK_CSS = `
  @keyframes sk-flame { 0%,100%{transform:scale(1) translateY(0)} 25%{transform:scale(1.06) translateY(-2px)} 50%{transform:scale(1) translateY(0)} 75%{transform:scale(1.04) translateY(-1px)} }
  @keyframes sk-glow { 0%,100%{opacity:.3;transform:scale(1)} 50%{opacity:.65;transform:scale(1.18)} }
  @keyframes sk-shimmer { 0%{transform:translateX(-200%) skewX(-12deg)} 100%{transform:translateX(200%) skewX(-12deg)} }
  @keyframes sk-ring-pulse { 0%,100%{opacity:.12} 50%{opacity:.35} }
`;

// ─── Tier config ──────────────────────────────────────────────

interface TierConfig {
  name: string; minDays: number; maxDays: number;
  textColor: string; glowColor: string; rgb: string;
}

const TIERS: TierConfig[] = [
  { name: 'Cold',      minDays: 0,  maxDays: 0,        textColor: 'text-slate-500',  glowColor: 'rgba(100,116,139,0.3)', rgb: '100,116,139' },
  { name: 'Spark',     minDays: 1,  maxDays: 6,        textColor: 'text-slate-400',  glowColor: 'rgba(148,163,184,0.3)', rgb: '148,163,184' },
  { name: 'Flame',     minDays: 7,  maxDays: 13,       textColor: 'text-blue-400',   glowColor: 'rgba(96,165,250,0.3)',  rgb: '96,165,250' },
  { name: 'Blaze',     minDays: 14, maxDays: 29,       textColor: 'text-purple-400', glowColor: 'rgba(167,139,250,0.3)', rgb: '167,139,250' },
  { name: 'Inferno',   minDays: 30, maxDays: 59,       textColor: 'text-orange-400', glowColor: 'rgba(251,146,60,0.4)',  rgb: '251,146,60' },
  { name: 'Wildfire',  minDays: 60, maxDays: 89,       textColor: 'text-amber-400',  glowColor: 'rgba(251,191,36,0.4)',  rgb: '251,191,36' },
  { name: 'Supernova', minDays: 90, maxDays: Infinity,  textColor: 'text-yellow-300', glowColor: 'rgba(253,224,71,0.4)',  rgb: '253,224,71' },
];

function getTierConfig(days: number): TierConfig {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (days >= TIERS[i].minDays) return TIERS[i];
  }
  return TIERS[0];
}

function getNextTier(days: number): TierConfig | null {
  const current = getTierConfig(days);
  const idx = TIERS.indexOf(current);
  return idx < TIERS.length - 1 ? TIERS[idx + 1] : null;
}

function getTierProgressPercent(days: number): number {
  const tier = getTierConfig(days);
  const next = getNextTier(days);
  if (!next) return 100;
  const range = next.minDays - tier.minDays;
  return Math.min(100, Math.round(((days - tier.minDays) / range) * 100));
}

// ─── Component ────────────────────────────────────────────────

export function StreakWidget({ onClick }: { onClick?: () => void }) {
  const { streak, isLoading } = useStreak();

  if (isLoading) {
    return (
      <div className="rounded-2xl p-5" style={{
        background: 'linear-gradient(145deg, rgba(18,20,35,0.95) 0%, rgba(8,10,22,1) 100%)',
        border: '1px solid rgba(249,115,22,0.1)',
        boxShadow: '0 4px 8px rgba(0,0,0,0.4), 0 12px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}>
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
        </div>
      </div>
    );
  }

  if (!streak) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
        className="rounded-2xl overflow-hidden cursor-pointer"
        style={{
          background: 'linear-gradient(145deg, rgba(18,20,35,0.95) 0%, rgba(8,10,22,1) 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 4px 8px rgba(0,0,0,0.4), 0 12px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
        onClick={onClick}
      >
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 2.5, repeat: Infinity }}>
            <Image src="/overview/Streak.svg" alt="Streak" width={56} height={56} className="w-14 h-14 opacity-30" />
          </motion.div>
          <p className="text-sm font-semibold text-slate-400">Start Your Streak</p>
          <p className="text-xs text-slate-600">Log any activity to ignite</p>
        </div>
      </motion.div>
    );
  }

  const days = streak.currentStreak;
  const tier = getTierConfig(days);
  const nextTier = getNextTier(days);
  const progressPercent = getTierProgressPercent(days);
  const xpTotal = streak.totalActiveDays * 25;
  const xpInLevel = xpTotal % 500;
  const achievements = Math.min(streak.longestStreak, 26);

  // Progress ring values — larger ring to avoid overlapping the flame
  const R = 48;
  const C = 2 * Math.PI * R;
  const tierOffset = C - (C * progressPercent) / 100;

  return (
    <>
      <style>{STREAK_CSS}</style>
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
        className="group/streak relative overflow-hidden rounded-2xl cursor-pointer"
        style={{
          background: 'linear-gradient(145deg, rgba(18,20,35,0.95) 0%, rgba(12,13,30,0.98) 50%, rgba(8,10,22,1) 100%)',
          border: `1px solid rgba(${tier.rgb},0.18)`,
          boxShadow: `0 4px 8px rgba(0,0,0,0.4), 0 12px 32px rgba(0,0,0,0.5), 0 24px 64px rgba(0,0,0,0.25), 0 0 40px rgba(${tier.rgb},0.06), inset 0 1px 0 rgba(255,255,255,0.07), inset 0 -1px 0 rgba(0,0,0,0.3)`,
        }}
        onClick={onClick}
      >
        {/* Top edge light */}
        <div className="absolute top-0 left-[8%] right-[8%] h-px pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.09), transparent)' }} />

        {/* Ambient glow */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, rgba(${tier.rgb},0.1) 0%, transparent 70%)`, animation: 'sk-glow 3s ease-in-out infinite' }} />

        {/* Shimmer on hover */}
        <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
          <div className="absolute inset-0 opacity-0 group-hover/streak:opacity-100 transition-opacity duration-300"
            style={{ animation: 'sk-shimmer 3s ease-in-out infinite' }}>
            <div className="w-32 h-full bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
          </div>
        </div>

        {/* Tier badge — top right */}
        <div className="absolute top-3 right-3 z-10">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${tier.textColor}`}
            style={{ background: `rgba(${tier.rgb},0.1)`, border: `1px solid rgba(${tier.rgb},0.15)` }}>
            {tier.name}
          </span>
        </div>

        <div className="relative p-5 flex flex-col items-center text-center">
          {/* Flame + ring combo */}
          <div className="relative w-[112px] h-[112px] mb-3">
            {/* Progress ring around flame */}
            <svg width="112" height="112" viewBox="0 0 112 112" className="absolute inset-0 -rotate-90">
              <circle cx="56" cy="56" r={R} fill="none" stroke={`rgba(${tier.rgb},0.08)`} strokeWidth="4" />
              <motion.circle cx="56" cy="56" r={R} fill="none"
                stroke={`rgba(${tier.rgb},0.5)`} strokeWidth="4" strokeLinecap="round"
                strokeDasharray={C} initial={{ strokeDashoffset: C }}
                animate={{ strokeDashoffset: tierOffset }}
                transition={{ duration: 1.4, ease: [0.4, 0, 0.2, 1], delay: 0.3 }}
                style={{ filter: `drop-shadow(0 0 6px rgba(${tier.rgb},0.4))` }} />
              {/* Pulsing glow ring */}
              <circle cx="56" cy="56" r={R} fill="none" stroke={`rgba(${tier.rgb},0.15)`} strokeWidth="8"
                style={{ animation: 'sk-ring-pulse 2.5s ease-in-out infinite' }} />
            </svg>

            {/* Flame image — centered inside the ring */}
            <div className="absolute inset-0 flex items-center justify-center z-10" style={{ animation: 'sk-flame 2s ease-in-out infinite' }}>
              <Image src="/overview/Streak.svg" alt="Streak" width={52} height={52} className="w-[52px] h-[52px]"
                style={{ filter: `drop-shadow(0 0 12px rgba(${tier.rgb},0.5))` }} />
            </div>
          </div>

          {/* Day count — below the ring, no overlap */}
          <AnimatePresence mode="popLayout">
            <motion.span key={days}
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="text-4xl font-extrabold text-white tabular-nums leading-none"
              style={{ textShadow: `0 0 24px rgba(${tier.rgb},0.3), 0 2px 4px rgba(0,0,0,0.8)` }}>
              {days}
            </motion.span>
          </AnimatePresence>
          <p className="text-[11px] text-slate-500 mt-1.5 font-medium uppercase tracking-wider">Day Streak</p>

          {/* XP display */}
          <div className="flex items-center gap-1.5 mt-3 px-3 py-1 rounded-lg"
            style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.12)' }}>
            <Star className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400"
              style={{ filter: 'drop-shadow(0 0 4px rgba(16,185,129,0.5))' }} />
            <span className="text-sm font-bold text-emerald-400 tabular-nums"
              style={{ textShadow: '0 0 8px rgba(16,185,129,0.3)' }}>
              {xpTotal.toLocaleString()} XP
            </span>
          </div>

          {/* XP progress bar */}
          <div className="w-full mt-3">
            <div className="h-2 rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.04)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)' }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${(xpInLevel / 500) * 100}%` }}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
                className="h-full rounded-full relative overflow-hidden"
                style={{
                  background: 'linear-gradient(90deg, #10b981, #06b6d4)',
                  boxShadow: '0 0 12px rgba(16,185,129,0.3)',
                }}>
                <div className="absolute inset-0"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)', animation: 'sk-shimmer 2s ease-in-out infinite' }} />
              </motion.div>
            </div>
            <div className="flex justify-between mt-1">
              {nextTier && <span className="text-[9px] text-slate-600">{nextTier.name} in {nextTier.minDays - days}d</span>}
              <span className="text-[10px] text-slate-500 tabular-nums ml-auto">{xpInLevel}/500</span>
            </div>
          </div>

          {/* Bottom stats */}
          <div className="flex items-center justify-between w-full mt-3 pt-3"
            style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3 text-slate-500" />
              <span className="text-[10px] text-slate-400 font-medium">{achievements}/26</span>
            </div>
            <span className="text-[10px] text-emerald-400/80 font-semibold">+2% XP Bonus</span>
          </div>

          {/* Freeze indicators */}
          <div className="flex items-center gap-1.5 mt-2">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="p-0.5 rounded" style={{
                background: i < streak.freezesAvailable ? 'rgba(96,165,250,0.1)' : 'transparent',
                border: `1px solid ${i < streak.freezesAvailable ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.04)'}`,
              }}>
                <Snowflake className={`w-3 h-3 ${i < streak.freezesAvailable ? 'text-blue-400' : 'text-slate-700'}`}
                  style={i < streak.freezesAvailable ? { filter: 'drop-shadow(0 0 4px rgba(96,165,250,0.4))' } : undefined} />
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </>
  );
}
