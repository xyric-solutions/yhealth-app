'use client';
import * as Icons from 'lucide-react';
import type { LifeAreaDomain } from '../types';

export function DomainPicker({
  domains, value, onChange,
}: { domains: LifeAreaDomain[]; value: string | null; onChange: (type: string) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {domains.map((d) => {
        const Icon = (Icons[d.defaultIcon as keyof typeof Icons] ?? Icons.Target) as React.ComponentType<{ className?: string }>;
        const active = value === d.type;
        return (
          <button
            key={d.type}
            type="button"
            onClick={() => onChange(d.type)}
            className={[
              'rounded-xl border p-3 text-left transition',
              active
                ? 'border-blue-400/60 bg-blue-500/10'
                : 'border-white/10 bg-slate-900/40 hover:border-white/20',
            ].join(' ')}
            style={active ? { boxShadow: `0 0 0 2px ${d.defaultColor}55` } : undefined}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
              style={{ background: `${d.defaultColor}22` }}
            >
              <Icon className="w-4 h-4" />
            </div>
            <div className="text-sm font-medium text-white">{d.displayName}</div>
          </button>
        );
      })}
    </div>
  );
}
