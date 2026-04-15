'use client';

import { motion } from 'framer-motion';
import { Apple } from 'lucide-react';
import { useMemo } from 'react';
import { ParticleBackground } from './ParticleBackground';

interface NutritionWidgetProps {
  macros: {
    protein: number | null;
    carbs: number | null;
    fats: number | null;
  };
  targets: {
    protein: number;
    carbs: number;
    fats: number;
  };
  isLoading?: boolean;
}

export function NutritionWidget({ macros, targets, isLoading }: NutritionWidgetProps) {
  const macroData = useMemo(() => {
    return [
      {
        name: 'Protein',
        value: macros.protein || 0,
        target: targets.protein,
        color: 'from-blue-500 to-cyan-500',
        bgColor: 'bg-blue-500/20',
        textColor: 'text-blue-400',
      },
      {
        name: 'Carbs',
        value: macros.carbs || 0,
        target: targets.carbs,
        color: 'from-orange-500 to-amber-500',
        bgColor: 'bg-orange-500/20',
        textColor: 'text-orange-400',
      },
      {
        name: 'Fats',
        value: macros.fats || 0,
        target: targets.fats,
        color: 'from-purple-500 to-pink-500',
        bgColor: 'bg-purple-500/20',
        textColor: 'text-purple-400',
      },
    ].map((macro) => ({
      ...macro,
      progress: macro.target > 0 ? Math.min((macro.value / macro.target) * 100, 100) : 0,
      percentage: macro.target > 0 ? Math.round((macro.value / macro.target) * 100) : 0,
    }));
  }, [macros, targets]);

  const totalCalories = useMemo(() => {
    const proteinCal = (macros.protein || 0) * 4;
    const carbsCal = (macros.carbs || 0) * 4;
    const fatsCal = (macros.fats || 0) * 9;
    return proteinCal + carbsCal + fatsCal;
  }, [macros]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-2xl bg-black/40 border border-purple-400/50 p-6 backdrop-blur-sm shadow-lg shadow-purple-500/20"
    >
      <ParticleBackground color="purple" particleCount={120} className="rounded-2xl" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
              <Apple className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-slate-400">Nutrition</h3>
              <p className="text-lg font-bold text-white">
                {isLoading ? '—' : `${Math.round(totalCalories)} kcal`}
              </p>
            </div>
          </div>
        </div>

        {/* Macros */}
        <div className="space-y-3">
          {macroData.map((macro, index) => (
            <motion.div
              key={macro.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="space-y-1.5"
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${macro.color}`} />
                  <span className="text-slate-400">{macro.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold">
                    {isLoading ? '—' : `${Math.round(macro.value)}g`}
                  </span>
                  <span className="text-slate-500">/ {macro.target}g</span>
                  <span className={`text-xs font-medium ${macro.textColor}`}>
                    {macro.percentage}%
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-slate-800/50 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${macro.progress}%` }}
                  transition={{ duration: 0.8, delay: index * 0.1, ease: 'easeOut' }}
                  className={`h-full rounded-full bg-gradient-to-r ${macro.color}`}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

