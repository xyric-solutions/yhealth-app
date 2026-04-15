'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, LayoutGrid } from 'lucide-react';
import type { GraphNode, GraphNodeCategory } from '@shared/types/domain/knowledge-graph';
import { NODE_CATEGORY_COLORS } from '@shared/types/domain/knowledge-graph';

interface CardsViewProps {
  nodes: GraphNode[];
  onSelectNode: (node: GraphNode) => void;
  selectedNodeId: string | null;
}

type SortKey = 'date' | 'category' | 'type';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'category', label: 'Category' },
  { key: 'type', label: 'Type' },
];

function normalizeDate(val: string | undefined | null): string {
  if (!val) return '';
  const match = String(val).match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : String(val).slice(0, 10);
}

function formatShortDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  const match = String(dateStr).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(dateStr).slice(0, 10);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const month = months[parseInt(match[2], 10) - 1] || match[2];
  const day = parseInt(match[3], 10);
  return `${month} ${day}`;
}

function formatNodeType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function CardsView({
  nodes,
  onSelectNode,
  selectedNodeId,
}: CardsViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  const sortedNodes = useMemo(() => {
    const copy = [...nodes];
    switch (sortKey) {
      case 'date':
        return copy.sort(
          (a, b) =>
            normalizeDate(b.date).localeCompare(normalizeDate(a.date))
        );
      case 'category':
        return copy.sort((a, b) => a.category.localeCompare(b.category));
      case 'type':
        return copy.sort((a, b) => a.type.localeCompare(b.type));
      default:
        return copy;
    }
  }, [nodes, sortKey]);

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 py-16">
        <LayoutGrid className="w-12 h-12 text-slate-600 mb-4" />
        <h3 className="text-base font-semibold text-slate-300 mb-1">
          No data for this period
        </h3>
        <p className="text-sm text-slate-500 max-w-xs">
          Try expanding the date range or adjusting your category filters.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      {/* Sort dropdown */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-slate-500">
          {sortedNodes.length} {sortedNodes.length === 1 ? 'node' : 'nodes'}
        </span>
        <div className="relative">
          <button
            onClick={() => setSortMenuOpen(!sortMenuOpen)}
            onBlur={() => setTimeout(() => setSortMenuOpen(false), 150)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            aria-haspopup="listbox"
            aria-expanded={sortMenuOpen}
          >
            Sort by: {SORT_OPTIONS.find((o) => o.key === sortKey)?.label}
            <ChevronDown
              className={`w-3 h-3 transition-transform ${
                sortMenuOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
          {sortMenuOpen && (
            <div
              className="absolute right-0 top-full mt-1 bg-[#0d0f1e] border border-white/10 rounded-lg shadow-xl shadow-black/30 z-20 min-w-[120px] overflow-hidden"
              role="listbox"
            >
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  onClick={() => {
                    setSortKey(option.key);
                    setSortMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                    sortKey === option.key
                      ? 'bg-emerald-600/20 text-emerald-400'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                  role="option"
                  aria-selected={sortKey === option.key}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sortedNodes.map((node) => {
          const color =
            NODE_CATEGORY_COLORS[node.category as GraphNodeCategory] ||
            '#94A3B8';
          const isSelected = selectedNodeId === node.id;

          return (
            <button
              key={node.id}
              onClick={() => onSelectNode(node)}
              className={`text-left p-4 rounded-xl border transition-all ${
                isSelected
                  ? 'border-emerald-600 bg-emerald-600/5'
                  : 'border-white/[0.08] bg-[#02000f] hover:border-white/40'
              }`}
            >
              {/* Top row: dot + label */}
              <div className="flex items-start gap-2.5 mb-2.5">
                <div
                  className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-sm font-medium text-white truncate flex-1">
                  {node.label}
                </span>
              </div>

              {/* Date + type badge */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">
                  {formatShortDate(node.date)}
                </span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full truncate max-w-[120px]"
                  style={{ backgroundColor: `${color}15`, color }}
                >
                  {formatNodeType(node.type)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
