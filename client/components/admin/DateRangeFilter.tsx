'use client';

import { useState } from 'react';
import { Calendar, X } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface DateRange {
  start: string;
  end: string;
}

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  presets?: ReadonlyArray<{ label: string; days: number }>;
}

const DEFAULT_PRESETS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '1 year', days: 365 },
] as const;

function getDefaultRange(): DateRange {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = subDays(end, 30);
  start.setHours(0, 0, 0, 0);
  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
  };
}

export function DateRangeFilter({ value, onChange, presets = DEFAULT_PRESETS }: DateRangeFilterProps) {
  const [customRange, setCustomRange] = useState<DateRange>(value);
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);

  const handlePresetClick = (days: number, index: number) => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = subDays(end, days);
    start.setHours(0, 0, 0, 0);

    const newRange: DateRange = {
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd'),
    };

    setSelectedPreset(index);
    setIsCustomOpen(false);
    onChange(newRange);
  };

  const handleCustomApply = () => {
    if (customRange.start && customRange.end) {
      if (customRange.start > customRange.end) {
        // Swap if start > end
        onChange({
          start: customRange.end,
          end: customRange.start,
        });
      } else {
        onChange(customRange);
      }
      setSelectedPreset(null);
      setIsCustomOpen(false);
    }
  };

  const handleReset = () => {
    const defaultRange = getDefaultRange();
    setCustomRange(defaultRange);
    setSelectedPreset(1); // 30 days
    onChange(defaultRange);
  };

  const dateRangeLabel = () => {
    try {
      const s = new Date(value.start);
      const e = new Date(value.end);
      return `${format(s, 'MMM d, yyyy')} – ${format(e, 'MMM d, yyyy')}`;
    } catch {
      return `${value.start} – ${value.end}`;
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 rounded-lg bg-white/10 border border-white/10 overflow-hidden backdrop-blur-sm">
        <Calendar className="h-4 w-4 text-white/80 ml-3" />
        {presets.map((preset, i) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => handlePresetClick(preset.days, i)}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              selectedPreset === i
                ? 'bg-white/20 text-white'
                : 'text-white/80 hover:bg-white/10'
            }`}
          >
            {preset.label}
          </button>
        ))}
        <Popover open={isCustomOpen} onOpenChange={setIsCustomOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`px-3 py-2 text-sm font-medium transition-colors border-l border-white/10 ${
                selectedPreset === null
                  ? 'bg-white/20 text-white'
                  : 'text-white/80 hover:bg-white/10'
              }`}
            >
              Custom
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4 bg-slate-900 border-slate-700" align="end">
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label className="text-slate-200">From</Label>
                <Input
                  type="date"
                  value={customRange.start}
                  onChange={(e) => setCustomRange((r) => ({ ...r, start: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-slate-200">To</Label>
                <Input
                  type="date"
                  value={customRange.end}
                  onChange={(e) => setCustomRange((r) => ({ ...r, end: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  className="bg-emerald-600 hover:bg-emerald-500 flex-1"
                  onClick={handleCustomApply}
                >
                  Apply
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
                  onClick={handleReset}
                >
                  Reset
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <div className="text-sm text-white/90 flex items-center gap-2">
        <span>{dateRangeLabel()}</span>
        {(value.start !== getDefaultRange().start || value.end !== getDefaultRange().end) && (
          <button
            type="button"
            onClick={handleReset}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            title="Reset to default"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

