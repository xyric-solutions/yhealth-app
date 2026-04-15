'use client';

import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import type { ConfidenceSliderProps } from './types';

export function ConfidenceSlider({ value, onChange }: ConfidenceSliderProps) {
  const getColor = () => {
    if (value >= 8) return 'text-emerald-400';
    if (value >= 6) return 'text-yellow-400';
    return 'text-orange-400';
  };

  return (
    <div className="mt-4">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-white">How confident are you?</span>
        <span className={`text-lg font-bold ${getColor()}`}>{value}/10</span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer
                   [&::-webkit-slider-thumb]:appearance-none
                   [&::-webkit-slider-thumb]:w-5
                   [&::-webkit-slider-thumb]:h-5
                   [&::-webkit-slider-thumb]:rounded-full
                   [&::-webkit-slider-thumb]:bg-sky-600
                   [&::-webkit-slider-thumb]:shadow-lg
                   [&::-webkit-slider-thumb]:shadow-sky-600/20"
      />
      {value < 7 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-yellow-200">
              We recommend at least 7/10 confidence. Consider adjusting the goal or timeline.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
