'use client';

import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface ComparisonCardProps {
  label: string;
  value: number;
  delay?: number;
}

export function ComparisonCard({ label, value, delay = 0 }: ComparisonCardProps) {
  const isPositive = value >= 0;
  const isNeutral = value === 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay }}
      whileHover={{ scale: 1.05, y: -2 }}
      className={`relative bg-gradient-to-br ${
        isPositive
          ? 'from-green-500/10 to-emerald-500/10 border-green-500/20'
          : isNeutral
          ? 'from-slate-500/10 to-slate-600/10 border-slate-500/20'
          : 'from-red-500/10 to-pink-500/10 border-red-500/20'
      } backdrop-blur-xl rounded-xl p-4 border-2 overflow-hidden group`}
    >
      <p className="text-xs font-medium text-slate-400 mb-2">{label}</p>
      <div className="flex items-center gap-2">
        {isNeutral ? (
          <Minus className={`w-4 h-4 ${isNeutral ? 'text-slate-400' : ''}`} />
        ) : isPositive ? (
          <ArrowUpRight className="w-4 h-4 text-green-400" />
        ) : (
          <ArrowDownRight className="w-4 h-4 text-red-400" />
        )}
        <p
          className={`text-xl font-bold ${
            isPositive ? 'text-green-400' : isNeutral ? 'text-slate-400' : 'text-red-400'
          }`}
        >
          {isPositive ? '+' : ''}
          {value.toFixed(1)}
        </p>
      </div>
    </motion.div>
  );
}

