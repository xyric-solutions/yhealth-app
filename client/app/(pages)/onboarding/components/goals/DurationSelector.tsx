'use client';

import { motion } from 'framer-motion';
import { Calendar, Zap, Timer } from 'lucide-react';
import Image from 'next/image';

interface DurationSelectorProps {
  value: number;
  onChange: (weeks: number) => void;
  disabled?: boolean;
}

const ICON_BASE = '/Onboardingicons';

const DURATION_PRESETS = [
  { weeks: 2, label: '2 Weeks', description: 'Quick Start', icon: Zap },
  { weeks: 4, label: '4 Weeks', description: 'Recommended', recommended: true, icon: Timer },
  { weeks: 8, label: '8 Weeks', description: 'Build Habits', icon: Calendar },
];

const ALL_WEEKS = Array.from({ length: 12 }, (_, i) => i + 1);

export function DurationSelector({ value, onChange, disabled = false }: DurationSelectorProps) {
  const fillPercent = ((value - 1) / 11) * 100;

  return (
    <motion.div
      className="rounded-2xl bg-[#0a0a1a] border border-white/10 p-4 sm:p-6 mb-6 sm:mb-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      {/* Header */}
      <div className="text-center mb-5 sm:mb-6">
        <h3 className="text-lg sm:text-xl font-semibold text-white mb-1">Plan Duration</h3>
        <p className="text-slate-400 text-xs sm:text-sm">How long should your health plan run?</p>
      </div>

      {/* 3 Preset Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6 sm:mb-8">
        {DURATION_PRESETS.map((preset) => {
          const isSelected = value === preset.weeks;
          const IconComp = preset.icon;

          return (
            <button
              key={preset.weeks}
              onClick={() => !disabled && onChange(preset.weeks)}
              disabled={disabled}
              className={`
                relative flex flex-col items-center gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-xl sm:rounded-2xl
                transition-all duration-200 border
                ${isSelected
                  ? 'border-emerald-600 border-[1.5px] text-white'
                  : 'bg-[#02000f] border-white/[0.24] text-white/80 hover:border-white/40'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              style={isSelected ? { backgroundImage: 'linear-gradient(178deg, rgba(5,150,105,0) 3%, rgba(5,150,105,0.3) 99%)' } : undefined}
            >
              <IconComp className={`w-4 h-4 sm:w-5 sm:h-5 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span className="font-semibold text-sm sm:text-base">{preset.label}</span>
              <span className={`text-[10px] sm:text-xs ${isSelected ? 'text-emerald-400' : 'text-slate-500'}`}>
                {preset.description}
              </span>
            </button>
          );
        })}
      </div>

      {/* ─── Horizontal Week Picker ─── */}
      <div className="rounded-xl sm:rounded-2xl bg-[#0b081e] border border-dashed border-white/10 px-3 sm:px-4 py-4 sm:py-5 mb-5 sm:mb-6">
        <div className="relative flex items-center">
          {/* Start icon */}
          <div className="shrink-0 w-6 sm:w-8 flex items-center justify-center mr-1 sm:mr-2">
            <Image src={`${ICON_BASE}/Train for event.svg`} alt="" width={18} height={18} className="opacity-60 sm:w-5 sm:h-5" />
          </div>

          {/* Track container */}
          <div className="flex-1 relative">
            {/* Background track line */}
            <div className="absolute left-0 right-0 top-[11px] sm:top-[13px] h-[3px] bg-slate-700/60 rounded-full">
              <motion.div
                className="h-full bg-gradient-to-r from-sky-500 to-teal-400 rounded-full"
                animate={{ width: `${fillPercent}%` }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            </div>

            {/* Week stops */}
            <div className="relative flex justify-between">
              {ALL_WEEKS.map((week) => {
                const isActive = week === value;
                const isBefore = week < value;

                return (
                  <button
                    key={week}
                    onClick={() => !disabled && onChange(week)}
                    disabled={disabled}
                    className="flex flex-col items-center z-10"
                  >
                    {/* Dot or active circle */}
                    {isActive ? (
                      <motion.div
                        className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-sky-500 flex items-center justify-center shadow-lg shadow-sky-500/40 ring-[3px] ring-sky-500/20"
                        layoutId="weekThumb"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      >
                        <span className="text-[9px] sm:text-[10px] font-bold text-white">{week}w</span>
                      </motion.div>
                    ) : (
                      <div
                        className={`
                          w-[6px] h-[6px] sm:w-2 sm:h-2 rounded-full mt-[9px] sm:mt-[10px] mb-[9px] sm:mb-[10px]
                          transition-colors duration-200
                          ${isBefore ? 'bg-sky-500/60' : 'bg-slate-600'}
                        `}
                      />
                    )}

                    {/* Label below */}
                    <span
                      className={`
                        mt-1.5 text-[9px] sm:text-[10px] font-medium transition-colors
                        ${isActive ? 'text-sky-400' : isBefore ? 'text-white/50' : 'text-white/30'}
                      `}
                    >
                      {week}w
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* End icon */}
          <div className="shrink-0 w-6 sm:w-8 flex items-center justify-center ml-1 sm:ml-2">
            <Image src={`${ICON_BASE}/Boost Energy.svg`} alt="" width={18} height={18} className="sm:w-5 sm:h-5" />
          </div>
        </div>
      </div>

      {/* Duration Info Box */}
      <div className="p-3 sm:p-4 rounded-xl border border-emerald-600/30 bg-emerald-600/5">
        <div className="flex items-start gap-2.5">
          <div className="shrink-0 w-5 h-5 rounded-full bg-emerald-600/20 flex items-center justify-center mt-0.5">
            <span className="text-emerald-400 text-xs font-bold">i</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {value <= 2 && (
              <>
                <span className="text-amber-400 font-semibold">Quick Start:</span>{' '}
                Ideal for testing the waters. You&apos;ll see initial progress but sustainable change takes longer.
              </>
            )}
            {value > 2 && value <= 5 && (
              <>
                <span className="text-emerald-400 font-semibold">Recommended:</span>{' '}
                Perfect balance of commitment and results. Enough time to build habits and see progress.
              </>
            )}
            {value > 5 && value <= 8 && (
              <>
                <span className="text-sky-400 font-semibold">Build Habits:</span>{' '}
                Excellent for lasting change. Research shows 66 days to form a habit — you&apos;ll solidify new behaviors.
              </>
            )}
            {value > 8 && (
              <>
                <span className="text-sky-400 font-semibold">Full Transformation:</span>{' '}
                Comprehensive journey for significant change. Perfect for major fitness goals or lifestyle overhauls.
              </>
            )}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
