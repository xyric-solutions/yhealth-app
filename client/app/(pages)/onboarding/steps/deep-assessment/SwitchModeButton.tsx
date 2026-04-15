'use client';

import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SwitchModeButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function SwitchModeButton({ onClick, disabled = false }: SwitchModeButtonProps) {
  return (
    <motion.button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-xs transition-all',
        disabled
          ? 'text-slate-600 cursor-not-allowed opacity-50'
          : 'text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30'
      )}
      whileTap={disabled ? undefined : { scale: 0.98 }}
    >
      <Zap className="w-3 h-3" />
      <span className="hidden sm:inline">Quick Mode</span>
    </motion.button>
  );
}
