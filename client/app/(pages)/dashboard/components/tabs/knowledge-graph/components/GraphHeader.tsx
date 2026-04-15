'use client';

import { Network, List, LayoutGrid, RefreshCw, Loader2 } from 'lucide-react';

type ViewMode = 'graph' | 'timeline' | 'cards';

interface GraphHeaderProps {
  totalNodes: number;
  totalEdges: number;
  dateRange: { from: string; to: string };
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

const VIEW_MODES: { mode: ViewMode; icon: typeof Network; label: string }[] = [
  { mode: 'graph', icon: Network, label: 'Graph view' },
  { mode: 'timeline', icon: List, label: 'Timeline view' },
  { mode: 'cards', icon: LayoutGrid, label: 'Cards view' },
];

function formatDateDisplay(from: string, to: string): string {
  if (from === to) return from;
  return `${from} - ${to}`;
}

export function GraphHeader({
  totalNodes,
  totalEdges,
  dateRange,
  viewMode,
  onViewModeChange,
  onRefresh,
  isLoading,
}: GraphHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 bg-[#02000f]/50 border-b border-white/10">
      {/* Stats */}
      <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
        <span className="font-medium text-slate-200">
          {totalNodes}
          <span className="text-slate-500 font-normal"> nodes</span>
        </span>
        <span className="text-slate-600" aria-hidden="true">
          &middot;
        </span>
        <span className="font-medium text-slate-200">
          {totalEdges}
          <span className="text-slate-500 font-normal"> edges</span>
        </span>
        <span className="text-slate-600" aria-hidden="true">
          &middot;
        </span>
        <span className="text-slate-500">
          {formatDateDisplay(dateRange.from, dateRange.to)}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* View mode toggle */}
        <div
          className="flex items-center bg-white/5 rounded-lg p-0.5 border border-white/10"
          role="radiogroup"
          aria-label="View mode"
        >
          {VIEW_MODES.map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => onViewModeChange(mode)}
              className={`p-2 rounded-md transition-colors ${
                viewMode === mode
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-transparent text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              role="radio"
              aria-checked={viewMode === mode}
              aria-label={label}
              title={label}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-all disabled:opacity-40"
          aria-label="Refresh data"
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
