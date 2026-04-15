'use client';

import { useState, useCallback } from 'react';
import { Search, X } from 'lucide-react';

interface GraphSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function GraphSearch({ value, onChange }: GraphSearchProps) {
  const [focused, setFocused] = useState(false);

  const handleClear = useCallback(() => {
    onChange('');
  }, [onChange]);

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
        focused
          ? 'border-emerald-500/50 bg-white/10'
          : 'border-white/10 bg-white/5'
      }`}
    >
      <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Search nodes..."
        className="bg-transparent text-sm text-white placeholder:text-slate-500 outline-none w-full min-w-[120px]"
      />
      {value && (
        <button
          onClick={handleClear}
          className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors shrink-0"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
