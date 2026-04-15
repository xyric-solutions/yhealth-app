'use client';

import { useMemo } from 'react';
import { Flame, Droplets, Moon, Heart, Footprints, Loader2 } from 'lucide-react';
import type { HealthMetrics as HealthMetricsType } from './types';

interface HealthMetricsSectionProps {
  healthMetrics: HealthMetricsType | null;
  isLoadingStats: boolean;
}

export function HealthMetricsSection({ healthMetrics, isLoadingStats }: HealthMetricsSectionProps) {
  const displayMetrics = useMemo(() => [
    {
      icon: <Flame className="w-4 h-4" />,
      label: 'Calories',
      value: healthMetrics?.calories.value?.toLocaleString() || '—',
      target: healthMetrics?.calories.target?.toLocaleString() || '2,200',
      color: 'text-orange-400',
      bg: 'bg-orange-500/20',
      hasData: !!healthMetrics?.calories.value,
    },
    {
      icon: <Droplets className="w-4 h-4" />,
      label: 'Water',
      value: healthMetrics?.water.value?.toString() || '—',
      target: `${healthMetrics?.water.target || 8} glasses`,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/20',
      hasData: !!healthMetrics?.water.value,
    },
    {
      icon: <Moon className="w-4 h-4" />,
      label: 'Sleep',
      value: healthMetrics?.sleep.value || '—',
      target: healthMetrics?.sleep.target || '8h',
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/20',
      hasData: !!healthMetrics?.sleep.value,
    },
    {
      icon: <Heart className="w-4 h-4" />,
      label: 'Heart Rate',
      value: healthMetrics?.heartRate.value?.toString() || '—',
      target: 'bpm',
      color: 'text-rose-400',
      bg: 'bg-rose-500/20',
      hasData: !!healthMetrics?.heartRate.value,
    },
    {
      icon: <Footprints className="w-4 h-4" />,
      label: 'Steps',
      value: healthMetrics?.steps.value?.toLocaleString() || '—',
      target: healthMetrics?.steps.target?.toLocaleString() || '10,000',
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/20',
      hasData: !!healthMetrics?.steps.value,
    },
  ], [healthMetrics]);

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white">Health Metrics</h3>
        {isLoadingStats && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
      </div>

      <div className="space-y-4">
        {displayMetrics.map((metric, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${metric.bg}`}>
              <span className={metric.color}>{metric.icon}</span>
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-400">{metric.label}</p>
            </div>
            <div className="text-right">
              <p className={`font-medium ${metric.hasData ? 'text-white' : 'text-slate-500'}`}>
                {metric.value}
              </p>
              <p className="text-xs text-slate-500">{metric.target}</p>
            </div>
          </div>
        ))}
      </div>

      {!healthMetrics && !isLoadingStats && (
        <div className="mt-4 p-3 rounded-xl bg-slate-800/50 border border-slate-700">
          <p className="text-xs text-slate-400 text-center">
            Connect integrations or log data to see your health metrics
          </p>
        </div>
      )}
    </div>
  );
}
