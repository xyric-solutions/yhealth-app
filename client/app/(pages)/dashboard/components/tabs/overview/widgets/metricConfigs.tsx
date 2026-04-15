'use client';

import { motion } from 'framer-motion';
import { HealthMetric, HealthMetricType } from './CircularHealthMetric';
import { Footprints, Droplet, Flame, Apple, Heart, BarChart3, Sparkles, Activity } from 'lucide-react';

export interface MetricConfig {
  type: HealthMetricType;
  icon: React.ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getMetric: (data: any) => HealthMetric;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAdditionalInfo?: (data: any) => React.ReactNode;
}

// Helper to create trend label
const _createTrendLabel = (direction: 'up' | 'down' | 'stable', value: number, unit: string = '') => {
  if (direction === 'stable') return 'No change';
  const sign = direction === 'up' ? '+' : '';
  return `${sign}${value}${unit}`;
};

export const metricConfigs: Record<HealthMetricType, MetricConfig> = {
  age: {
    type: 'age',
    icon: <Sparkles className="w-6 h-6 text-emerald-400" />,
    getMetric: (data: { whoopAge: number | null; chronologicalAge: number | null }) => {
      const age = data.whoopAge || data.chronologicalAge || 0;
      const difference = data.chronologicalAge && data.whoopAge
        ? data.chronologicalAge - data.whoopAge
        : null;
      
      return {
        type: 'age',
        value: age,
        label: 'WHOOP AGE',
        unit: '',
        trend: difference && difference > 0
          ? {
              direction: 'up',
              value: Math.abs(difference),
              label: `${difference.toFixed(1)} years younger`,
            }
          : undefined,
      };
    },
  },

  steps: {
    type: 'steps',
    icon: <Footprints className="w-6 h-6 text-emerald-400" />,
    getMetric: (data: { steps: number | null; target: number }) => ({
      type: 'steps',
      value: data.steps || 0,
      max: data.target,
      label: 'STEPS',
      unit: '',
      subtitle: `Target: ${data.target.toLocaleString()}`,
    }),
    getAdditionalInfo: (data: { steps: number | null; target: number }) => {
      const progress = data.steps && data.target ? (data.steps / data.target) * 100 : 0;
      const remaining = Math.max(0, (data.target - (data.steps || 0)));
      
      return (
        <div className="space-y-2 mt-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Progress</span>
            <span className="text-emerald-400 font-semibold">{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-slate-800/50 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8 }}
              className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full"
            />
          </div>
          {remaining > 0 && (
            <p className="text-xs text-slate-400 text-center">
              {remaining.toLocaleString()} steps remaining
            </p>
          )}
        </div>
      );
    },
  },

  water: {
    type: 'water',
    icon: <Droplet className="w-6 h-6 text-cyan-400" />,
    getMetric: (data: { consumed: number; target: number }) => {
      const glasses = Math.round(data.consumed / 250);
      const targetGlasses = Math.round(data.target / 250);
      
      return {
        type: 'water',
        value: glasses,
        max: targetGlasses,
        label: 'WATER',
        unit: `/${targetGlasses} glasses`,
        subtitle: `${Math.round(data.consumed)}ml / ${Math.round(data.target)}ml`,
      };
    },
    getAdditionalInfo: (data: { consumed: number; target: number; onAddWater?: () => void }) => {
      const progress = (data.consumed / data.target) * 100;
      const remaining = Math.max(0, Math.round((data.target - data.consumed) / 250));
      
      return (
        <div className="space-y-2 mt-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Progress</span>
            <span className="text-cyan-400 font-semibold">{Math.round(progress)}%</span>
          </div>
          <div className="h-2.5 bg-slate-800/50 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.8 }}
              className="h-full bg-gradient-to-r from-cyan-400 to-blue-400 rounded-full"
            />
          </div>
          {remaining > 0 && (
            <p className="text-xs text-slate-400 text-center">
              {remaining} glasses remaining
            </p>
          )}
          {data.onAddWater && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={data.onAddWater}
              className="w-full mt-3 px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-400 text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <span>+</span>
              Add 250ml
            </motion.button>
          )}
        </div>
      );
    },
  },

  calories: {
    type: 'calories',
    icon: <Flame className="w-6 h-6 text-orange-400" />,
    getMetric: (data: { consumed: number; burned: number; target: number }) => ({
      type: 'calories',
      value: data.consumed,
      max: data.target,
      label: 'CALORIES',
      unit: 'kcal',
      subtitle: `Target: ${data.target.toLocaleString()} kcal`,
    }),
    getAdditionalInfo: (data: { consumed: number; burned: number; target: number }) => {
      const progress = (data.consumed / data.target) * 100;
      const net = data.consumed - data.burned;
      
      return (
        <div className="space-y-3 mt-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg bg-slate-800/30">
              <p className="text-xs text-slate-400 mb-1">Burned</p>
              <p className="text-sm font-semibold text-orange-400">
                {data.burned.toLocaleString()}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-slate-800/30">
              <p className="text-xs text-slate-400 mb-1">Net</p>
              <p className={`text-sm font-semibold ${net < 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                {net.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Progress</span>
              <span className="text-orange-400 font-semibold">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-slate-800/50 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(progress, 100)}%` }}
                transition={{ duration: 0.8 }}
                className="h-full bg-gradient-to-r from-orange-400 to-red-400 rounded-full"
              />
            </div>
          </div>
        </div>
      );
    },
  },

  nutrition: {
    type: 'nutrition',
    icon: <Apple className="w-6 h-6 text-purple-400" />,
    getMetric: (data: {
      macros: { protein: number; carbs: number; fats: number };
      targets: { protein: number; carbs: number; fats: number };
      calories?: number; // Actual calories from meals
    }) => {
      // Use actual calories from meals if available, otherwise calculate from macros
      const totalCal = data.calories ?? ((data.macros.protein * 4) + (data.macros.carbs * 4) + (data.macros.fats * 9));
      const avgProgress = (
        (data.macros.protein / data.targets.protein) +
        (data.macros.carbs / data.targets.carbs) +
        (data.macros.fats / data.targets.fats)
      ) / 3 * 100;
      
      return {
        type: 'nutrition',
        value: Math.round(avgProgress),
        max: 100,
        label: 'NUTRITION',
        unit: '%',
        subtitle: `${Math.round(totalCal)} kcal`,
      };
    },
    getAdditionalInfo: (data: {
      macros: { protein: number; carbs: number; fats: number };
      targets: { protein: number; carbs: number; fats: number };
    }) => {
      const macros = [
        { name: 'Protein', value: data.macros.protein, target: data.targets.protein, color: 'from-blue-500 to-cyan-500' },
        { name: 'Carbs', value: data.macros.carbs, target: data.targets.carbs, color: 'from-orange-500 to-amber-500' },
        { name: 'Fats', value: data.macros.fats, target: data.targets.fats, color: 'from-purple-500 to-pink-500' },
      ];
      
      return (
        <div className="space-y-2 mt-4">
          {macros.map((macro, i) => {
            const progress = (macro.value / macro.target) * 100;
            return (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{macro.name}</span>
                  <span className="text-white font-semibold">
                    {Math.round(macro.value)}g / {macro.target}g
                  </span>
                </div>
                <div className="h-1.5 bg-slate-800/50 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.8, delay: i * 0.1 }}
                    className={`h-full bg-gradient-to-r ${macro.color} rounded-full`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      );
    },
  },

  protein: {
    type: 'protein',
    icon: <Apple className="w-6 h-6 text-pink-400" />,
    getMetric: (data: { value: number; target: number }) => ({
      type: 'protein',
      value: data.value,
      max: data.target,
      label: 'PROTEIN',
      unit: 'g',
      subtitle: `${Math.round(data.value)} / ${data.target} g`,
    }),
  },

  carbs: {
    type: 'carbs',
    icon: <Apple className="w-6 h-6 text-amber-400" />,
    getMetric: (data: { value: number; target: number }) => ({
      type: 'carbs',
      value: data.value,
      max: data.target,
      label: 'CARBS',
      unit: 'g',
      subtitle: `${Math.round(data.value)} / ${data.target} g`,
    }),
  },

  fat: {
    type: 'fat',
    icon: <Apple className="w-6 h-6 text-purple-400" />,
    getMetric: (data: { value: number; target: number }) => ({
      type: 'fat',
      value: data.value,
      max: data.target,
      label: 'FAT',
      unit: 'g',
      subtitle: `${Math.round(data.value)} / ${data.target} g`,
    }),
  },

  heartRate: {
    type: 'heartRate',
    icon: <Heart className="w-6 h-6 text-red-400" />,
    getMetric: (data: { current: number | null; resting: number | null }) => {
      if (!data.current) {
        return {
          type: 'heartRate',
          value: 0,
          max: 220,
          label: 'HEART RATE',
          unit: 'BPM',
          subtitle: 'No data available',
        };
      }
      
      // Calculate zone for display
      const zone = data.current < 110 ? 0 : data.current < 132 ? 1 : data.current < 154 ? 2 : data.current < 176 ? 3 : data.current < 198 ? 4 : 5;
      
      return {
        type: 'heartRate',
        value: data.current,
        max: 220,
        label: 'HEART RATE',
        unit: 'BPM',
        subtitle: data.resting ? `Resting: ${data.resting} bpm • Zone ${zone}` : `Zone ${zone}`,
      };
    },
    getAdditionalInfo: (data: { current: number | null; resting: number | null; history: unknown[] }) => {
      if (!data.current) {
        return (
          <div className="mt-4 text-center">
            <p className="text-sm text-slate-400">Connect a device to track heart rate</p>
          </div>
        );
      }
      
      return (
        <div className="mt-4 space-y-2">
          {data.resting && (
            <div className="p-2 rounded-lg bg-slate-800/30">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Resting HR</span>
                <span className="text-white font-semibold">{data.resting} bpm</span>
              </div>
            </div>
          )}
        </div>
      );
    },
  },

  insights: {
    type: 'insights',
    icon: <BarChart3 className="w-6 h-6 text-indigo-400" />,
    getMetric: (data: {
      weeklyAvg: number;
      consistencyScore: number;
      dataPoints: number;
      trend: 'up' | 'down' | 'stable';
    }) => ({
      type: 'insights',
      value: data.consistencyScore,
      max: 100,
      label: 'INSIGHTS',
      unit: '%',
      subtitle: `Weekly Avg: ${data.weeklyAvg.toFixed(1)}%`,
      // Remove trend for insights to avoid showing "Stable"
    }),
    getAdditionalInfo: (data: {
      weeklyAvg: number;
      consistencyScore: number;
      dataPoints: number;
      trend: 'up' | 'down' | 'stable';
    }) => (
      <div className="space-y-2 mt-4">
        <div className="p-2 rounded-lg bg-slate-800/30">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Data Points</span>
            <span className="text-white font-semibold">{data.dataPoints.toLocaleString()}</span>
          </div>
        </div>
      </div>
    ),
  },

  overall: {
    type: 'overall',
    icon: <Activity className="w-6 h-6 text-violet-400" />,
    getMetric: (data: { score: number }) => ({
      type: 'overall',
      value: data.score,
      max: 100,
      label: 'HEALTH SCORE',
      unit: '%',
      subtitle: 'Daily composite',
    }),
  },
};

