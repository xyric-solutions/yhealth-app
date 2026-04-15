'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';

interface Insight {
  type: 'positive' | 'warning' | 'info';
  message: string;
  recommendation?: string;
  priority?: 'high' | 'medium' | 'low';
}

interface InsightCardProps {
  insight: Insight;
  index: number;
}

export function InsightCard({ insight, index }: InsightCardProps) {
  const iconMap = {
    positive: CheckCircle2,
    warning: AlertTriangle,
    info: Info,
  };

  const Icon = iconMap[insight.type];
  const priorityColors = {
    high: 'border-red-500/50 bg-red-500/5',
    medium: 'border-orange-500/50 bg-orange-500/5',
    low: 'border-blue-500/50 bg-blue-500/5',
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ x: 4 }}
      className={`p-5 rounded-xl border-2 backdrop-blur-xl ${
        insight.type === 'positive'
          ? 'bg-green-500/10 border-green-500/30'
          : insight.type === 'warning'
          ? 'bg-orange-500/10 border-orange-500/30'
          : 'bg-blue-500/10 border-blue-500/30'
      } ${insight.priority ? priorityColors[insight.priority] : ''}`}
    >
      <div className="flex items-start gap-3">
        <motion.div
          className={`p-2 rounded-lg ${
            insight.type === 'positive'
              ? 'bg-green-500/20 text-green-400'
              : insight.type === 'warning'
              ? 'bg-orange-500/20 text-orange-400'
              : 'bg-blue-500/20 text-blue-400'
          }`}
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
        >
          <Icon className="w-5 h-5" />
        </motion.div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-white">{insight.message}</p>
            {insight.priority === 'high' && (
              <span className="px-2 py-0.5 text-xs font-bold bg-red-500/20 text-red-400 rounded-full border border-red-500/30">
                HIGH
              </span>
            )}
          </div>
          {insight.recommendation && (
            <p className="text-sm text-slate-400 mt-1">{insight.recommendation}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

