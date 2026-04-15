'use client';

import type { GraphNodeCategory } from '@shared/types/domain/knowledge-graph';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../constants/graph-config';

interface TooltipNode {
  label: string;
  category: GraphNodeCategory;
  nodeKind: string;
  entryCount: number;
  date?: string;
}

interface NodeTooltipProps {
  node: TooltipNode | null;
  position: { x: number; y: number } | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function NodeTooltip({ node, position, containerRef }: NodeTooltipProps) {
  /* eslint-disable react-hooks/refs -- containerRef is read-only, used for tooltip positioning */
  const container = containerRef?.current;
  if (!node || !position || !container) return null;

  const rect = container.getBoundingClientRect();
  /* eslint-enable react-hooks/refs */
  const color = CATEGORY_COLORS[node.category];

  return (
    <div
      className="fixed z-[60] pointer-events-none"
      style={{
        left: rect.left + position.x + 16,
        top: rect.top + position.y - 12,
      }}
    >
      <div
        className="px-3.5 py-2.5 rounded-xl border border-white/10 backdrop-blur-xl shadow-xl shadow-black/30 min-w-[140px]"
        style={{ background: 'rgba(15,17,30,0.95)' }}
      >
        <div
          className="absolute top-0 left-4 right-4 h-px"
          style={{ backgroundColor: `${color}50` }}
        />
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{
              backgroundColor: color,
              boxShadow: `0 0 6px ${color}40, 0 0 0 3px ${color}20`,
            }}
          />
          <span className="text-[13px] font-semibold text-white truncate max-w-[180px]">
            {node.label}
          </span>
        </div>
        <div className="flex items-center gap-2 pl-4">
          <span className="text-[11px] text-slate-400">
            {CATEGORY_LABELS[node.category]}
          </span>
          <span className="text-[11px] text-slate-600">·</span>
          <span className="text-[11px] font-medium" style={{ color }}>
            {node.entryCount} {node.entryCount === 1 ? 'entry' : 'entries'}
          </span>
          {node.date && (
            <>
              <span className="text-[11px] text-slate-600">·</span>
              <span className="text-[11px] text-slate-500">{node.date}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
