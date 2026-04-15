'use client';

import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import type { ActivityCardProps } from './types';

const typeColors: Record<string, { bg: string; badge: string }> = {
  workout: { bg: 'bg-emerald-500/10', badge: 'bg-emerald-600/20 text-emerald-400' },
  meal: { bg: 'bg-sky-500/10', badge: 'bg-sky-600/20 text-sky-400' },
  nutrition: { bg: 'bg-sky-500/10', badge: 'bg-sky-600/20 text-sky-400' },
  checkin: { bg: 'bg-teal-500/10', badge: 'bg-teal-600/20 text-teal-400' },
  recovery: { bg: 'bg-teal-500/10', badge: 'bg-teal-600/20 text-teal-400' },
};

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    workout: 'Strength Training',
    meal: 'Nutrition',
    nutrition: 'Nutrition',
    checkin: 'Recovery & Check-in',
    recovery: 'Recovery & Check-in',
  };
  return labels[type] || type.charAt(0).toUpperCase() + type.slice(1);
}

function getScheduleLabel(days: string[]): string {
  if (days.length >= 5) return 'Mon-Fri';
  if (days.length === 7 || days.some(d => d.toLowerCase() === 'daily')) return 'Daily';
  return days.join(', ');
}

export function ActivityCard({ activity, index }: ActivityCardProps) {
  const colors = typeColors[activity.type] || typeColors.workout;
  const schedule = getScheduleLabel(activity.days);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.6 + index * 0.08 }}
      className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-[#02000f] border border-white/[0.24] hover:border-white/40 transition-colors"
    >
      {/* Icon */}
      <div className={`shrink-0 w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center ${colors.bg}`}>
        <span className="text-slate-300">{activity.icon}</span>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <span className="text-[10px] sm:text-xs text-[rgba(239,237,253,0.4)] block">
          {getTypeLabel(activity.type)}
        </span>
        <h4 className="font-medium text-sm sm:text-base text-white truncate">
          {activity.title}
        </h4>
      </div>

      {/* Schedule badge + time */}
      <div className="shrink-0 flex items-center gap-2 sm:gap-3">
        <span className={`px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-medium ${colors.badge}`}>
          {schedule}
        </span>
        <span className="text-[11px] sm:text-xs text-slate-500 hidden sm:inline">
          {activity.time}
        </span>
      </div>

      {/* Chevron */}
      <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
    </motion.div>
  );
}
