'use client';

import { motion } from 'framer-motion';
import { MessageCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatEmptyStateProps {
  className?: string;
}

export function ChatEmptyState({ className }: ChatEmptyStateProps) {
  return (
    <div
      className={cn(
        'relative flex h-full flex-col items-center justify-center overflow-hidden',
        className
      )}
    >
      {/* Subtle background glow */}
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/[0.04] blur-[80px]"
          animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex flex-col items-center gap-6 px-6"
      >
        {/* Icon */}
        <div className="relative">
          {/* Pulse ring */}
          <motion.div
            className="absolute inset-0 rounded-3xl border border-emerald-500/15"
            animate={{ scale: [1, 1.4, 1.7], opacity: [0.3, 0.1, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeOut', repeatDelay: 1 }}
          />

          <motion.div
            className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-white/[0.04] border border-white/[0.08]"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            <MessageCircle className="h-9 w-9 text-emerald-500" strokeWidth={1.5} />

            {/* Sparkle badge */}
            <motion.div
              className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.4, type: 'spring', stiffness: 300, damping: 20 }}
            >
              <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
            </motion.div>
          </motion.div>
        </div>

        {/* Text */}
        <div className="flex flex-col items-center gap-2">
          <motion.h2
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-xl font-semibold tracking-tight text-white"
          >
            Select a conversation
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="max-w-[260px] text-center text-sm text-slate-400"
          >
            Choose a chat from the sidebar or start a new conversation
          </motion.p>
        </div>

        {/* Subtle animated line */}
        <motion.div
          className="h-px w-12 rounded-full bg-linear-to-r from-transparent via-emerald-500/30 to-transparent"
          animate={{ width: [48, 64, 48], opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
    </div>
  );
}
