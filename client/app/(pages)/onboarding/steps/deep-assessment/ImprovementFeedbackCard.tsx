'use client';

import { motion } from 'framer-motion';
import { 
  Target, 
  Zap, 
  TrendingUp, 
  Star,
  Calendar,
  ChevronRight,
  Award
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ImprovementFeedback } from './types';

interface ImprovementFeedbackCardProps {
  feedback: ImprovementFeedback;
  userName?: string;
}

export function ImprovementFeedbackCard({ feedback, userName = 'there' }: ImprovementFeedbackCardProps) {
  const levelConfig = {
    beginner: { 
      label: 'Getting Started', 
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/20',
      border: 'border-emerald-500/30'
    },
    intermediate: { 
      label: 'Making Progress', 
      color: 'text-blue-400',
      bg: 'bg-blue-500/20',
      border: 'border-blue-500/30'
    },
    advanced: { 
      label: 'Advanced Level', 
      color: 'text-violet-400',
      bg: 'bg-violet-500/20',
      border: 'border-violet-500/30'
    },
  };

  const level = levelConfig[feedback.currentLevel];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-white/10 backdrop-blur-sm"
    >
      {/* Header */}
      <div className="p-5 border-b border-white/10 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-violet-400" />
            <h3 className="text-lg font-semibold text-white">Your Health Profile</h3>
          </div>
          <span className={cn('px-3 py-1 rounded-full text-xs font-medium', level.bg, level.border, level.color)}>
            {level.label}
          </span>
        </div>
        <p className="text-slate-400 text-sm">
          Hey {userName}! Based on your assessment, here&apos;s your personalized improvement plan for <span className="text-white font-medium">{feedback.goalArea}</span>.
        </p>
      </div>

      {/* Strengths */}
      {feedback.strengths.length > 0 && (
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-semibold text-white">Your Strengths</h4>
          </div>
          <div className="flex flex-wrap gap-2">
            {feedback.strengths.map((strength, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs"
              >
                {strength}
              </motion.span>
            ))}
          </div>
        </div>
      )}

      {/* Areas to Improve */}
      {feedback.areasToImprove.length > 0 && (
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <h4 className="text-sm font-semibold text-white">Focus Areas</h4>
          </div>
          <ul className="space-y-2">
            {feedback.areasToImprove.map((area, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-2 text-sm text-slate-300"
              >
                <ChevronRight className="w-3 h-3 text-blue-400" />
                {area}
              </motion.li>
            ))}
          </ul>
        </div>
      )}

      {/* Quick Wins */}
      {feedback.quickWins.length > 0 && (
        <div className="p-4 border-b border-white/10 bg-emerald-500/5">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-semibold text-white">Quick Wins (Start Today!)</h4>
          </div>
          <ul className="space-y-2">
            {feedback.quickWins.map((win, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 + 0.3 }}
                className="flex items-start gap-2 text-sm text-emerald-300"
              >
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {win}
              </motion.li>
            ))}
          </ul>
        </div>
      )}

      {/* Long Term Goals */}
      {feedback.longTermGoals.length > 0 && (
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-4 h-4 text-violet-400" />
            <h4 className="text-sm font-semibold text-white">Long-Term Goals</h4>
          </div>
          <ul className="space-y-2">
            {feedback.longTermGoals.map((goal, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 + 0.4 }}
                className="flex items-center gap-2 text-sm text-slate-300"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                {goal}
              </motion.li>
            ))}
          </ul>
        </div>
      )}

      {/* Weekly Focus */}
      {feedback.weeklyFocus && (
        <div className="p-4 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-1">This Week&apos;s Focus</h4>
              <p className="text-sm text-slate-300">{feedback.weeklyFocus}</p>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
