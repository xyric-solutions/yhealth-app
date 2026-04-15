"use client";

import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { Check } from 'lucide-react';

interface BodyMeasurements {
  chest?: number;
  waist?: number;
  hips?: number;
  bicepLeft?: number;
  bicepRight?: number;
  thighLeft?: number;
  thighRight?: number;
  calfLeft?: number;
  calfRight?: number;
  neck?: number;
  shoulders?: number;
}

interface MeasurementRecord {
  date: string;
  measurements: BodyMeasurements;
}

interface MeasurementTrendChartProps {
  history: MeasurementRecord[];
  timePeriod?: number | null;
}

const measurementColors: Record<string, string> = {
  chest: '#10b981',
  waist: '#f59e0b',
  hips: '#8b5cf6',
  bicepLeft: '#3b82f6',
  bicepRight: '#06b6d4',
  thighLeft: '#ec4899',
  thighRight: '#f97316',
  calfLeft: '#84cc16',
  calfRight: '#14b8a6',
  neck: '#6366f1',
  shoulders: '#ef4444',
};

const measurementLabels: Record<string, string> = {
  chest: 'Chest',
  waist: 'Waist',
  hips: 'Hips',
  bicepLeft: 'Left Bicep',
  bicepRight: 'Right Bicep',
  thighLeft: 'Left Thigh',
  thighRight: 'Right Thigh',
  calfLeft: 'Left Calf',
  calfRight: 'Right Calf',
  neck: 'Neck',
  shoulders: 'Shoulders',
};

interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
  payload: {
    dateFormatted: string;
    [key: string]: string | number;
  };
}

interface TooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}

const MeasurementTooltip = ({ active, payload }: TooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload;
    if (!data) return null;
    
    return (
      <div className="bg-slate-900/95 border border-white/20 rounded-lg p-3 shadow-xl backdrop-blur-sm min-w-[200px]">
        <p className="text-white font-medium mb-2">{data.dateFormatted}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm flex items-center gap-2" style={{ color: entry.color }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
            {entry.name}: <span className="font-semibold">{entry.value} cm</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function MeasurementTrendChart({
  history,
  timePeriod,
}: MeasurementTrendChartProps) {
  const [selectedMeasurements, setSelectedMeasurements] = useState<string[]>([
    'waist',
    'chest',
    'hips',
  ]);

  const chartData = useMemo(() => {
    if (!history || history.length === 0) return [];

    try {
      // Validate and filter history items
      const validHistory = history.filter((item) => {
        if (!item || typeof item.date !== 'string' || !item.measurements) {
          return false;
        }
        if (typeof item.measurements !== 'object') {
          return false;
        }
        try {
          parseISO(item.date);
          return true;
        } catch {
          return false;
        }
      });

      if (validHistory.length === 0) return [];

      // Filter by time period if specified
      let filtered = validHistory;
      if (timePeriod) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - timePeriod);
        filtered = validHistory.filter((item) => {
          try {
            const itemDate = parseISO(item.date);
            return itemDate >= cutoffDate;
          } catch {
            return false;
          }
        });
      }

      if (filtered.length === 0) return [];

      // Sort by date
      const sorted = [...filtered].sort((a, b) => {
        try {
          return parseISO(a.date).getTime() - parseISO(b.date).getTime();
        } catch {
          return 0;
        }
      });

      // Prepare chart data
      return sorted.map((item) => {
        try {
          const date = parseISO(item.date);
          const dataPoint: Record<string, string | number> = {
            date: item.date,
            dateFormatted: format(date, 'MMM d'),
          };

          // Add selected measurements
          selectedMeasurements.forEach((key) => {
            const value = item.measurements[key as keyof BodyMeasurements];
            if (value !== undefined && typeof value === 'number' && !isNaN(value) && value > 0) {
              dataPoint[measurementLabels[key]] = Math.round(value * 10) / 10;
            }
          });

          return dataPoint;
        } catch (error) {
          console.error('[MeasurementTrendChart] Error processing item:', item, error);
          return null;
        }
      }).filter((item): item is Record<string, string | number> => item !== null);
    } catch (error) {
      console.error('[MeasurementTrendChart] Error processing history:', error);
      return [];
    }
  }, [history, timePeriod, selectedMeasurements]);

  const availableMeasurements = useMemo(() => {
    const allKeys = new Set<string>();
    history.forEach((item) => {
      Object.keys(item.measurements).forEach((key) => {
        if (item.measurements[key as keyof BodyMeasurements] !== undefined) {
          allKeys.add(key);
        }
      });
    });
    return Array.from(allKeys);
  }, [history]);

  if (history.length === 0 || availableMeasurements.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-slate-400 bg-slate-900/20 rounded-lg border border-white/5">
        <div className="text-6xl mb-3 opacity-20">📏</div>
        <p className="text-base font-medium mb-1">No measurement data yet</p>
        <p className="text-sm text-slate-500">Start logging measurements to see trends</p>
      </div>
    );
  }

  const formatXAxisTick = (dateStr: string) => {
    const date = parseISO(dateStr);
    const days = chartData.length;
    if (days <= 7) {
      return format(date, 'EEE d');
    } else if (days <= 30) {
      return format(date, 'MMM d');
    } else {
      return format(date, 'MMM');
    }
  };

  return (
    <div className="space-y-6">
      {/* Measurement selector - Beautiful filter buttons */}
      <div className="flex flex-wrap gap-3">
        {availableMeasurements.map((key) => {
          const isSelected = selectedMeasurements.includes(key);
          const color = measurementColors[key] || '#94a3b8';
          return (
            <button
              key={key}
              onClick={() => {
                if (isSelected) {
                  setSelectedMeasurements(selectedMeasurements.filter((m) => m !== key));
                } else {
                  setSelectedMeasurements([...selectedMeasurements, key]);
                }
              }}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isSelected
                  ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border-2 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                  : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:border-white/20 hover:text-white'
              } backdrop-blur-sm`}
            >
              {isSelected && (
                <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 text-white" />
                </div>
              )}
              <span
                className="w-3 h-3 rounded-full shadow-sm"
                style={{ backgroundColor: color }}
              />
              <span className="font-semibold">{measurementLabels[key] || key}</span>
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <div className="w-full h-80 bg-gradient-to-br from-slate-900/50 to-slate-800/50 rounded-xl p-4 border border-white/10 backdrop-blur-sm">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 15, right: 20, left: 10, bottom: 15 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            
            <XAxis
              dataKey="date"
              tickFormatter={formatXAxisTick}
              stroke="#94a3b8"
              style={{ fontSize: '12px', fontWeight: 500 }}
              interval="preserveStartEnd"
              tick={{ fill: '#cbd5e1' }}
            />
            
            <YAxis
              stroke="#94a3b8"
              style={{ fontSize: '12px', fontWeight: 500 }}
              tickFormatter={(value) => `${value}`}
              label={{ value: 'cm', angle: -90, position: 'insideLeft', fill: '#94a3b8', style: { fontSize: '12px' } }}
              width={50}
              tick={{ fill: '#cbd5e1' }}
            />
            
            <Tooltip 
              content={<MeasurementTooltip />}
              cursor={{ stroke: 'rgba(255,255,255,0.2)', strokeWidth: 1 }}
            />
            
            {selectedMeasurements.map((key) => {
              const label = measurementLabels[key];
              const color = measurementColors[key] || '#94a3b8';
              
              // Only render if this measurement exists in data
              if (chartData.some((d) => d[label] !== undefined)) {
                return (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={label}
                    stroke={color}
                    strokeWidth={3}
                    dot={{ fill: color, r: 4, strokeWidth: 2, stroke: '#0f172a' }}
                    activeDot={{ r: 6, stroke: color, strokeWidth: 2, fill: color }}
                    name={label}
                  />
                );
              }
              return null;
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

