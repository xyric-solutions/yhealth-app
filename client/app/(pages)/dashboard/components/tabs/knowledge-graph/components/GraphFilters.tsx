'use client';

import { Calendar, Filter } from 'lucide-react';
import type { GraphNodeCategory } from '@shared/types/domain/knowledge-graph';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../constants/graph-config';
import type { GraphFilterState } from '../hooks/useKnowledgeGraph';

interface GraphFiltersProps {
  filters: GraphFilterState;
  onDatePreset: (preset: 'day' | 'week' | 'month') => void;
  onToggleCategory: (category: GraphNodeCategory) => void;
  onDateRangeChange: (from: string, to: string) => void;
}

const ALL_CATEGORIES: GraphNodeCategory[] = [
  'fitness', 'nutrition', 'hydration', 'wellbeing',
  'biometrics', 'goals', 'intelligence', 'coaching', 'finance',
];

export function GraphFilters({
  filters,
  onDatePreset,
  onToggleCategory,
  onDateRangeChange,
}: GraphFiltersProps) {
  const activePreset =
    filters.from === filters.to
      ? 'day'
      : (() => {
          const diff = Math.round(
            (new Date(filters.to).getTime() - new Date(filters.from).getTime()) / (1000 * 60 * 60 * 24)
          );
          if (diff <= 7) return 'week';
          if (diff <= 31) return 'month';
          return 'custom';
        })();

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Date range presets */}
      <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5 border border-white/10">
        <Calendar className="w-3.5 h-3.5 text-slate-400 ml-2" />
        {(['day', 'week', 'month'] as const).map((preset) => (
          <button
            key={preset}
            onClick={() => onDatePreset(preset)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activePreset === preset
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {preset === 'day' ? 'Today' : preset === 'week' ? '7 Days' : '30 Days'}
          </button>
        ))}
      </div>

      {/* Custom date inputs */}
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={filters.from}
          onChange={(e) => onDateRangeChange(e.target.value, filters.to)}
          className="bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-xs text-slate-300 [color-scheme:dark]"
        />
        <span className="text-xs text-slate-500">to</span>
        <input
          type="date"
          value={filters.to}
          onChange={(e) => onDateRangeChange(filters.from, e.target.value)}
          className="bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-xs text-slate-300 [color-scheme:dark]"
        />
      </div>

      {/* Category filters */}
      <div className="flex items-center gap-1 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-slate-400 mr-1" />
        {ALL_CATEGORIES.map((cat) => {
          const isActive = filters.categories.length === 0 || filters.categories.includes(cat);
          return (
            <button
              key={cat}
              onClick={() => onToggleCategory(cat)}
              className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border transition-colors ${
                isActive
                  ? 'border-white/20 text-white bg-white/5'
                  : 'border-transparent text-slate-500 hover:text-slate-300'
              }`}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: CATEGORY_COLORS[cat],
                  opacity: isActive ? 1 : 0.3,
                }}
              />
              <span>{CATEGORY_LABELS[cat]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
