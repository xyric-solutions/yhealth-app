'use client';

import { motion } from 'framer-motion';
import { Sparkles, Lightbulb } from 'lucide-react';
import type { WeeklySummary } from './types';

interface WeeklyFocusProps {
  weeklySummary: WeeklySummary | null;
}

export function WeeklyFocus({ weeklySummary }: WeeklyFocusProps) {
  if (!weeklySummary?.focus) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.1 }}
      whileHover={{ y: -4, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
      className="group/focus relative rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(145deg, rgba(18,20,35,0.95) 0%, rgba(12,13,30,0.98) 50%, rgba(8,10,22,1) 100%)',
        border: '1px solid rgba(245,158,11,0.18)',
        boxShadow: '0 4px 8px rgba(0,0,0,0.4), 0 12px 32px rgba(0,0,0,0.5), 0 24px 64px rgba(0,0,0,0.25), 0 0 40px rgba(245,158,11,0.06), inset 0 1px 0 rgba(255,255,255,0.07), inset 0 -1px 0 rgba(0,0,0,0.3)',
      }}
    >
      {/* Top edge light */}
      <div className="absolute top-0 left-[8%] right-[8%] h-px pointer-events-none"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.09), transparent)' }} />

      {/* Ambient glow */}
      <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full pointer-events-none opacity-40 group-hover/focus:opacity-80 transition-opacity duration-700"
        style={{ background: 'radial-gradient(circle, rgba(245,158,11,0.1) 0%, transparent 70%)' }} />

      <div className="relative p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(251,146,60,0.08))',
              border: '1px solid rgba(245,158,11,0.2)',
              boxShadow: '0 0 16px rgba(245,158,11,0.08)',
            }}>
            <Sparkles className="h-[18px] w-[18px] text-amber-400"
              style={{ filter: 'drop-shadow(0 0 4px rgba(245,158,11,0.5))' }} />
          </div>
          <h3 className="text-sm font-bold text-white tracking-tight">Weekly Focus</h3>
        </div>

        {/* Theme pill */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mb-3 inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-bold"
          style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(251,146,60,0.08))',
            border: '1px solid rgba(245,158,11,0.2)',
            color: '#fbbf24',
            textShadow: '0 0 12px rgba(245,158,11,0.3)',
          }}
        >
          {weeklySummary.focus.theme}
        </motion.div>

        {/* Focus description */}
        <p className="text-sm leading-relaxed text-slate-300/90">{weeklySummary.focus.focus}</p>

        {/* Divider */}
        <div className="my-4 h-px w-full"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.12), transparent)' }} />

        {/* Expected outcome */}
        <div className="flex gap-2.5">
          <div className="mt-0.5 p-1 rounded-md shrink-0"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.1)' }}>
            <Lightbulb className="w-3.5 h-3.5 text-amber-400/70" />
          </div>
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-amber-400/50">
              Expected Outcome
            </p>
            <p className="text-sm leading-relaxed text-slate-300/80">{weeklySummary.focus.expectedOutcome}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
