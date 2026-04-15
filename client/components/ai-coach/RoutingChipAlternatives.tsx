'use client';
import { motion } from 'framer-motion';
import type { LifeAreaDomainType } from '@/app/(pages)/life-areas/types';

interface Props {
  alternatives: { type: LifeAreaDomainType; displayName: string }[];
  onPick: (type: LifeAreaDomainType) => Promise<void>;
}

export function RoutingChipAlternatives({ alternatives, onPick }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="absolute left-0 top-full mt-1 z-10 rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-xl p-2 shadow-2xl"
    >
      <ul className="min-w-[180px]">
        {alternatives.map((a) => (
          <li key={a.type}>
            <button
              onClick={() => onPick(a.type)}
              className="w-full text-left px-3 py-1.5 text-sm text-slate-200 rounded-md hover:bg-white/5"
            >
              {a.displayName}
            </button>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
