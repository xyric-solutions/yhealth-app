'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Pencil, Check } from 'lucide-react';
import Link from 'next/link';
import { RoutingChipAlternatives } from './RoutingChipAlternatives';
import type {
  RoutingChip as ChipData,
  LifeAreaDomainType,
} from '@/app/(pages)/life-areas/types';

interface Props {
  chip: ChipData;
  onReroute: (domainType: LifeAreaDomainType) => Promise<void>;
}

export function RoutingChip({ chip, onReroute }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleReroute(type: LifeAreaDomainType) {
    setBusy(true);
    try {
      await onReroute(type);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative mt-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/60 backdrop-blur px-3 py-1 text-xs text-slate-300"
    >
      <Check className="w-3 h-3 text-emerald-400" />
      <span>
        Added to{' '}
        <Link href="/life-areas" className="font-medium text-white hover:underline">
          {chip.lifeAreaName}
        </Link>
      </span>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        className="inline-flex items-center gap-1 text-slate-400 hover:text-white transition"
      >
        <Pencil className="w-3 h-3" />
        Change
      </button>
      {open && (
        <RoutingChipAlternatives alternatives={chip.alternatives} onPick={handleReroute} />
      )}
    </motion.div>
  );
}
