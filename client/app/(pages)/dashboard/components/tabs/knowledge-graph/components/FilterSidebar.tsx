'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  SlidersHorizontal,
  Search,
  X,
  Sparkles,
} from 'lucide-react';
import type { GraphNodeCategory } from '@shared/types/domain/knowledge-graph';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../constants/graph-config';

interface FilterSidebarProps {
  filters: {
    from: string;
    to: string;
    categories: GraphNodeCategory[];
    edgeCategories: string[];
    searchQuery: string;
    maxNodes: number;
  };
  onDatePreset: (preset: 'day' | 'week' | 'month') => void;
  onToggleCategory: (category: GraphNodeCategory) => void;
  onDateRangeChange: (from: string, to: string) => void;
  onSearchChange: (query: string) => void;
  categoryStats: Partial<Record<GraphNodeCategory, number>>;
  isOpen: boolean;
  onToggle: () => void;
}

const ALL_CATEGORIES: GraphNodeCategory[] = [
  'fitness', 'nutrition', 'hydration', 'wellbeing', 'biometrics',
  'goals', 'intelligence', 'coaching', 'finance',
];

function getActivePreset(from: string, to: string): 'day' | 'week' | 'month' | 'custom' {
  if (from === to) return 'day';
  const diff = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000);
  if (diff <= 7) return 'week';
  if (diff <= 31) return 'month';
  return 'custom';
}

export function FilterSidebar({
  filters, onDatePreset, onToggleCategory, onDateRangeChange,
  onSearchChange, categoryStats, isOpen, onToggle,
}: FilterSidebarProps) {
  const [localSearch, setLocalSearch] = useState(filters.searchQuery);
  const [isMobile, setIsMobile] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => { setLocalSearch(filters.searchQuery); }, [filters.searchQuery]);

  const handleSearchInput = useCallback((value: string) => {
    setLocalSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onSearchChange(value), 300);
  }, [onSearchChange]);

  const activePreset = getActivePreset(filters.from, filters.to);
  const totalNodes = Object.values(categoryStats).reduce((a, b) => a + (b || 0), 0);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header with glass effect */}
      <div className="sticky top-0 z-10 px-4 py-3 border-b border-white/[0.06] backdrop-blur-xl" style={{ background: 'linear-gradient(180deg, rgba(10,11,26,0.98) 0%, rgba(10,11,26,0.9) 100%)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-sky-500/15 flex items-center justify-center">
              <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div>
              <span className="text-sm font-semibold text-white block leading-tight">Filters</span>
              <span className="text-[10px] text-slate-500">{totalNodes} nodes</span>
            </div>
          </div>
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
          >
            {isMobile ? <X className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Search — premium input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder="Search nodes..."
            className="w-full pl-9 pr-8 py-2 rounded-xl text-sm text-white placeholder:text-slate-600 bg-white/[0.04] border border-white/[0.08] focus:border-sky-500/40 focus:bg-white/[0.06] outline-none transition-all"
          />
          {localSearch && (
            <button
              onClick={() => handleSearchInput('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-white/10 text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

        {/* Date Range */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Time Range</span>
          </div>

          {/* Presets — pill buttons */}
          <div className="flex gap-1.5 mb-3">
            {([['day', 'Today'], ['week', '7 Days'], ['month', '30 Days']] as const).map(([preset, label]) => (
              <button
                key={preset}
                onClick={() => onDatePreset(preset)}
                className={`flex-1 py-2 text-xs font-medium rounded-xl border transition-all duration-200 ${
                  activePreset === preset
                    ? 'bg-sky-500/15 text-sky-400 border-sky-500/30 shadow-sm shadow-sky-500/10'
                    : 'bg-white/[0.03] text-slate-500 border-white/[0.06] hover:text-slate-300 hover:bg-white/[0.06]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Custom date inputs */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-slate-600 uppercase tracking-wider mb-1 block">From</label>
              <input
                type="date"
                value={filters.from}
                onChange={(e) => onDateRangeChange(e.target.value, filters.to)}
                className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-[11px] text-slate-400 scheme-dark focus:border-sky-500/40 outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-[9px] text-slate-600 uppercase tracking-wider mb-1 block">To</label>
              <input
                type="date"
                value={filters.to}
                onChange={(e) => onDateRangeChange(filters.from, e.target.value)}
                className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-2.5 py-1.5 text-[11px] text-slate-400 scheme-dark focus:border-sky-500/40 outline-none transition-colors"
              />
            </div>
          </div>
        </section>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

        {/* Categories */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Data Sources</span>
          </div>

          <div className="space-y-0.5">
            {ALL_CATEGORIES.map((cat) => {
              const isActive = filters.categories.length === 0 || filters.categories.includes(cat);
              const count = categoryStats[cat] ?? 0;
              const color = CATEGORY_COLORS[cat];

              return (
                <button
                  key={cat}
                  onClick={() => onToggleCategory(cat)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                    isActive
                      ? 'bg-white/[0.04] hover:bg-white/[0.07]'
                      : 'opacity-40 hover:opacity-60'
                  }`}
                >
                  {/* Color indicator — glowing dot */}
                  <div className="relative shrink-0">
                    <div
                      className="w-3 h-3 rounded-full transition-all"
                      style={{
                        backgroundColor: color,
                        boxShadow: isActive ? `0 0 8px ${color}60` : 'none',
                      }}
                    />
                    {isActive && (
                      <div
                        className="absolute inset-0 rounded-full animate-ping"
                        style={{ backgroundColor: color, opacity: 0.2 }}
                      />
                    )}
                  </div>

                  {/* Label */}
                  <span className={`text-xs font-medium flex-1 text-left transition-colors ${
                    isActive ? 'text-slate-200 group-hover:text-white' : 'text-slate-600'
                  }`}>
                    {CATEGORY_LABELS[cat]}
                  </span>

                  {/* Count badge */}
                  {count > 0 && (
                    <span className={`text-[10px] font-semibold tabular-nums px-2 py-0.5 rounded-full transition-colors ${
                      isActive
                        ? 'bg-white/[0.08] text-slate-300'
                        : 'bg-white/[0.03] text-slate-600'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );

  // ── Mobile: bottom drawer ──
  if (isMobile) {
    return (
      <>
        {!isOpen && (
          <button
            onClick={onToggle}
            className="fixed bottom-4 left-4 z-30 p-3 rounded-xl bg-sky-600 text-white shadow-lg shadow-sky-600/30 transition-transform active:scale-95"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </button>
        )}

        <AnimatePresence>
          {isOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
                onClick={onToggle}
              />
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed bottom-0 left-0 right-0 z-40 rounded-t-2xl border-t border-white/10 max-h-[80vh] overflow-hidden"
                style={{ background: 'linear-gradient(180deg, #0e0f20 0%, #080916 100%)' }}
              >
                {/* Drag handle */}
                <div className="flex justify-center py-2">
                  <div className="w-10 h-1 rounded-full bg-white/20" />
                </div>
                {sidebarContent}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </>
    );
  }

  // ── Desktop: side panel ──
  return (
    <>
      {!isOpen && (
        <div className="w-11 shrink-0 flex flex-col items-center pt-4 gap-3 border-r border-white/[0.04]" style={{ background: 'linear-gradient(180deg, #0c0d1e 0%, #080916 100%)' }}>
          <button
            onClick={onToggle}
            className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {/* Mini category dots */}
          <div className="flex flex-col items-center gap-1.5 mt-2">
            {ALL_CATEGORIES.map((cat) => {
              const isActive = filters.categories.length === 0 || filters.categories.includes(cat);
              return (
                <button
                  key={cat}
                  onClick={() => onToggleCategory(cat)}
                  className="p-0.5 rounded-full transition-opacity"
                  style={{ opacity: isActive ? 1 : 0.2 }}
                  title={CATEGORY_LABELS[cat]}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isOpen && (
        <div
          className="w-72 shrink-0 border-r border-white/[0.04] overflow-hidden flex flex-col"
          style={{ background: 'linear-gradient(180deg, #0c0d1e 0%, #080916 100%)' }}
        >
          {sidebarContent}
        </div>
      )}
    </>
  );
}
