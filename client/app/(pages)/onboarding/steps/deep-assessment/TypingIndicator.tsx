'use client';

import { motion } from 'framer-motion';
import { Brain } from 'lucide-react';

export function AdvancedTypingIndicator() {
  return (
    <motion.div
      className="flex items-end gap-2 max-w-[85%]"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
    >
      <div className="relative flex-shrink-0">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
          <Brain className="w-4 h-4 text-white" />
        </div>
        <motion.div
          className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-slate-900"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </div>

      <div className="relative">
        <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-slate-800/90 border border-slate-700/50 backdrop-blur-xl shadow-xl">
          <div className="flex items-center gap-2">
            <motion.div className="flex items-center gap-1" initial={{ opacity: 0.5 }} animate={{ opacity: 1 }}>
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="w-2 h-2 rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400"
                  animate={{ y: [0, -6, 0], scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                />
              ))}
            </motion.div>
            <span className="text-xs text-slate-500 ml-1">AI coach is thinking...</span>
          </div>
        </div>
        <div className="absolute inset-0 rounded-2xl rounded-bl-md bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 blur-xl -z-10" />
      </div>
    </motion.div>
  );
}
