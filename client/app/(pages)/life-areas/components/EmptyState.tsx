'use client';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-sm p-10 text-center"
    >
      <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mb-5">
        <Sparkles className="w-7 h-7 text-blue-300" />
      </div>
      <h2 className="text-xl font-semibold text-white">Start your first area</h2>
      <p className="mt-2 text-slate-400 max-w-md mx-auto">
        Try: <em className="text-slate-200">&ldquo;I want a better job&rdquo;</em>,{' '}
        <em className="text-slate-200">&ldquo;spend more time with my mother&rdquo;</em>,{' '}
        <em className="text-slate-200">&ldquo;read more books&rdquo;</em>. Or pick a category to get started.
      </p>
      <button
        onClick={onCreate}
        className="mt-6 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white
                   bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 shadow-lg shadow-blue-500/20"
      >
        Pick a category
      </button>
    </motion.div>
  );
}
