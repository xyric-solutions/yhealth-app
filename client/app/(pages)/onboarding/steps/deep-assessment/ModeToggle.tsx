'use client';

import { motion } from 'framer-motion';
import { MessageSquare, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AssessmentInteractionMode } from './types';

interface ModeToggleProps {
  mode: AssessmentInteractionMode;
  onModeChange: (mode: AssessmentInteractionMode) => void;
  disabled?: boolean;
}

export function ModeToggle({ mode, onModeChange, disabled = false }: ModeToggleProps) {
  const modes = [
    { id: 'qa' as const, label: 'Q&A', icon: MessageSquare, description: 'Chat style' },
    { id: 'mcq' as const, label: 'MCQs', icon: ListChecks, description: 'Quick answers' },
  ];

  return (
    <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-800/50 border border-slate-700/50">
      {modes.map(({ id, label, icon: Icon }) => {
        const isActive = mode === id;
        
        return (
          <motion.button
            key={id}
            onClick={() => !disabled && onModeChange(id)}
            disabled={disabled}
            className={cn(
              'relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              isActive ? 'text-white' : 'text-slate-400 hover:text-slate-300',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            whileHover={!disabled ? { scale: 1.02 } : undefined}
            whileTap={!disabled ? { scale: 0.98 } : undefined}
          >
            {isActive && (
              <motion.div
                layoutId="activeMode"
                className="absolute inset-0 bg-gradient-to-r from-violet-500/30 to-fuchsia-500/30 rounded-lg border border-violet-500/30"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
              />
            )}
            <Icon className="relative w-3.5 h-3.5" />
            <span className="relative">{label}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
