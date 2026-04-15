'use client';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import type { LifeArea } from '../types';

export function LifeAreaCard({ area, onClick }: { area: LifeArea; onClick: () => void }) {
  const Icon = (Icons[(area.icon ?? 'Target') as keyof typeof Icons] ??
    Icons.Target) as React.ComponentType<{ className?: string }>;
  const accent = area.color ?? '#6366f1';

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
      className="group relative w-full text-left rounded-2xl border border-white/10
                 bg-slate-900/50 backdrop-blur-sm p-5 hover:border-white/20 transition
                 shadow-lg shadow-black/20 overflow-hidden"
    >
      <div
        aria-hidden
        className="absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl opacity-40 group-hover:opacity-60 transition"
        style={{ background: accent }}
      />
      <div className="relative flex items-start justify-between mb-6">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center ring-1 ring-white/10"
          style={{ background: `${accent}22` }}
        >
          <Icon className="w-6 h-6" />
        </div>
        {area.is_flagship && (
          <span className="text-[10px] uppercase tracking-wider text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-md px-2 py-0.5">
            Flagship
          </span>
        )}
      </div>
      <div className="relative">
        <h3 className="text-white font-semibold text-lg truncate">{area.display_name}</h3>
        <p className="text-xs text-slate-400 mt-1 capitalize">{area.domain_type}</p>
      </div>
    </motion.button>
  );
}
