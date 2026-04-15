'use client';

import { Droplets, Scale, Loader2 } from 'lucide-react';
import { quickActions } from './constants';
import type { QuickLogModalState } from './types';

interface QuickActionsProps {
  onQuickLog: (type: QuickLogModalState['type'], value?: number, duration?: number) => Promise<void>;
  isLoggingQuickAction: boolean;
}

export function QuickActions({ onQuickLog, isLoggingQuickAction }: QuickActionsProps) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm p-5">
      <h3 className="font-semibold text-white mb-4">Quick Actions</h3>

      <div className="grid grid-cols-2 gap-3">
        {quickActions.map((action) => (
          <button
            key={action.type}
            onClick={() => onQuickLog(action.type)}
            disabled={isLoggingQuickAction}
            className={`p-4 rounded-xl bg-gradient-to-br ${action.color} border border-white/10 hover:border-white/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex flex-col items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isLoggingQuickAction ? (
              <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
            ) : (
              <span className="text-slate-300">{action.icon}</span>
            )}
            <span className="text-xs text-slate-400">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Extra quick actions */}
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => onQuickLog('water', 1)}
          disabled={isLoggingQuickAction}
          className="flex-1 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 hover:border-cyan-500/40 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Droplets className="w-4 h-4 text-cyan-400" />
          <span className="text-xs text-cyan-400">+1 Glass Water</span>
        </button>
        <button
          onClick={() => onQuickLog('weight')}
          disabled={isLoggingQuickAction}
          className="flex-1 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 hover:border-purple-500/40 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Scale className="w-4 h-4 text-purple-400" />
          <span className="text-xs text-purple-400">Log Weight</span>
        </button>
      </div>
    </div>
  );
}
