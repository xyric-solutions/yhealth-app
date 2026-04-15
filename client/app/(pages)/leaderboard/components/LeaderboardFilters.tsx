'use client';

import { motion } from 'framer-motion';
import { Calendar, Globe, Users, Trophy, MapPin } from 'lucide-react';
import type { BoardType, TimeFilter } from '@/src/shared/services/leaderboard.service';
import { cn } from '@/lib/utils';

interface LeaderboardFiltersProps {
  boardType: BoardType;
  timeFilter: TimeFilter;
  selectedDate: string;
  onBoardTypeChange: (type: BoardType) => void;
  onTimeFilterChange: (filter: TimeFilter) => void;
  onDateChange: (date: string) => void;
  onSearchChange?: (query: string) => void;
  searchQuery?: string;
  country?: string;
  onCountryChange?: (country: string) => void;
}

const TIME_FILTERS: { value: TimeFilter; label: string }[] = [
  { value: 'daily', label: 'Day' },
  { value: 'weekly', label: 'Week' },
  { value: 'monthly', label: 'Month' },
  { value: 'all-time', label: 'All' },
];

const BOARD_TYPES: { value: BoardType; label: string; icon: typeof Globe }[] = [
  { value: 'global', label: 'Global', icon: Globe },
  { value: 'country', label: 'Country', icon: MapPin },
  { value: 'friends', label: 'Friends', icon: Users },
  { value: 'competition', label: 'Compete', icon: Trophy },
];

export function LeaderboardFilters({
  boardType,
  timeFilter,
  selectedDate,
  onBoardTypeChange,
  onTimeFilterChange,
  onDateChange,
}: LeaderboardFiltersProps) {
  return (
    <div className="space-y-3">
      {/* Row 1: Time + Board Type filters side by side */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Time period segmented control */}
        <div
          className="inline-flex p-1 rounded-xl bg-white/4 border border-white/8 backdrop-blur-xl"
          role="radiogroup"
          aria-label="Time period"
        >
          {TIME_FILTERS.map((filter) => {
            const isActive = timeFilter === filter.value;
            return (
              <button
                key={filter.value}
                onClick={() => onTimeFilterChange(filter.value)}
                role="radio"
                aria-checked={isActive}
                className={cn(
                  'relative px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors duration-200 whitespace-nowrap',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50',
                  isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300',
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="timeFilter"
                    className="absolute inset-0 rounded-lg bg-emerald-600 shadow-lg shadow-emerald-600/20"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{filter.label}</span>
              </button>
            );
          })}
        </div>

        {/* Board type segmented control */}
        <div
          className="inline-flex p-1 rounded-xl bg-white/4 border border-white/8 backdrop-blur-xl"
          role="radiogroup"
          aria-label="Leaderboard type"
        >
          {BOARD_TYPES.map((type) => {
            const Icon = type.icon;
            const isActive = boardType === type.value;
            return (
              <button
                key={type.value}
                onClick={() => onBoardTypeChange(type.value)}
                role="radio"
                aria-checked={isActive}
                className={cn(
                  'relative px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors duration-200 flex items-center gap-1.5 whitespace-nowrap',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50',
                  isActive ? 'text-white' : 'text-gray-500 hover:text-gray-300',
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="boardType"
                    className="absolute inset-0 rounded-lg bg-white/10 border border-white/12"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{type.label}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Date picker — only for daily */}
        {timeFilter === 'daily' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative flex items-center"
          >
            <Calendar className="absolute left-3 w-4 h-4 text-gray-500 pointer-events-none" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className={cn(
                'pl-9 pr-3 py-2 rounded-xl text-sm font-medium',
                'bg-white/4 border border-white/8 text-white',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40',
                'backdrop-blur-xl',
                'scheme-dark',
              )}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}
