'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { CATEGORY_COLORS, CATEGORY_LABELS, EDGE_CATEGORY_COLORS } from '../constants/graph-config';
import type { GraphNodeCategory, EdgeCategory } from '@shared/types/domain/knowledge-graph';

const EDGE_LABELS: Record<EdgeCategory, string> = {
  temporal: 'Same-day',
  hierarchical: 'Belongs to',
  causal: 'Influences',
  correlation: 'Correlated',
  semantic: 'Similar',
};

const EDGE_STYLES: Record<EdgeCategory, string> = {
  temporal: 'border-dashed',
  hierarchical: 'border-solid',
  causal: 'border-solid',
  correlation: 'border-dashed',
  semantic: 'border-dotted',
};

export function GraphLegend() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="absolute bottom-4 right-4 z-10 bg-slate-800/90 border border-white/10 rounded-lg backdrop-blur-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:text-white w-full transition-colors"
      >
        <span className="font-medium">Legend</span>
        {expanded ? <ChevronDown className="w-3 h-3 ml-auto" /> : <ChevronUp className="w-3 h-3 ml-auto" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-white/5 pt-2">
          {/* Node categories */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Nodes</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {(Object.keys(CATEGORY_COLORS) as GraphNodeCategory[]).map((cat) => (
                <div key={cat} className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                  />
                  <span className="text-[11px] text-slate-300">{CATEGORY_LABELS[cat]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Edge types */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Edges</p>
            <div className="space-y-1">
              {(Object.keys(EDGE_CATEGORY_COLORS) as EdgeCategory[]).map((cat) => (
                <div key={cat} className="flex items-center gap-2">
                  <div
                    className={`w-6 h-0 ${EDGE_STYLES[cat]} border-t-2`}
                    style={{ borderColor: EDGE_CATEGORY_COLORS[cat] }}
                  />
                  <span className="text-[11px] text-slate-300">{EDGE_LABELS[cat]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Size encoding */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Size</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-slate-400" />
              <span className="text-[11px] text-slate-400">Low</span>
              <div className="w-3.5 h-3.5 rounded-full bg-slate-300" />
              <span className="text-[11px] text-slate-400">Mid</span>
              <div className="w-5 h-5 rounded-full bg-white" />
              <span className="text-[11px] text-slate-400">High</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
