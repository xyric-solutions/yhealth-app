'use client';

import { motion } from 'framer-motion';
import { Gauge, Clock, Heart } from 'lucide-react';
import type { Goal } from '@/src/types';
import type { TimelineOption } from './types';

interface GoalEditFormProps {
  goal: Goal;
  editedValues: Partial<Goal> | undefined;
  onEditChange: (field: string, value: number | string) => void;
  onTimelineChange: (weeks: number) => void;
}

const TIMELINE_OPTIONS: TimelineOption[] = [
  { weeks: 4, label: '1 month' },
  { weeks: 8, label: '2 months' },
  { weeks: 12, label: '3 months' },
  { weeks: 16, label: '4 months' },
  { weeks: 24, label: '6 months' },
];

export function GoalEditForm({
  goal,
  editedValues,
  onEditChange,
  onTimelineChange,
}: GoalEditFormProps) {
  const currentWeeks = editedValues?.timeline?.durationWeeks ?? goal.timeline.durationWeeks;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4 space-y-4"
    >
      {/* Target Value Editor */}
      <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
        <div className="flex items-center gap-2 mb-3">
          <Gauge className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-white">Target Value</span>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number"
            value={editedValues?.targetValue ?? goal.targetValue}
            onChange={(e) => onEditChange('targetValue', Number(e.target.value))}
            className="w-24 px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-600 text-white text-center focus:border-cyan-500 focus:outline-none"
          />
          <span className="text-slate-400">{goal.targetUnit}</span>
        </div>
      </div>

      {/* Timeline Editor */}
      <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-white">Timeline</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {TIMELINE_OPTIONS.map((option) => {
            const isSelected = currentWeeks === option.weeks;
            return (
              <button
                key={option.weeks}
                onClick={() => onTimelineChange(option.weeks)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isSelected
                    ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                    : 'bg-slate-700/50 text-slate-400 border border-slate-600 hover:bg-slate-700'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Motivation Editor */}
      <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
        <div className="flex items-center gap-2 mb-3">
          <Heart className="w-4 h-4 text-pink-400" />
          <span className="text-sm font-medium text-white">Why this matters to you</span>
        </div>
        <textarea
          value={editedValues?.motivation ?? goal.motivation}
          onChange={(e) => onEditChange('motivation', e.target.value)}
          placeholder="What's driving you to achieve this goal?"
          rows={2}
          className="w-full px-3 py-2 rounded-lg bg-slate-900/50 border border-slate-600 text-white placeholder-slate-500 focus:border-pink-500 focus:outline-none resize-none"
        />
      </div>
    </motion.div>
  );
}
