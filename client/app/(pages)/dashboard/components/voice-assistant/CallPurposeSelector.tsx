"use client";

import { motion } from "framer-motion";
import {
  Dumbbell,
  UtensilsCrossed,
  Apple,
  Heart,
  AlertCircle,
  Moon,
  Brain,
  Target,
  Activity,
  Sparkles,
  RefreshCw,
  X,
} from "lucide-react";
import type { CallPurpose } from "@/src/shared/services/voice-call.service";

interface CallPurposeSelectorProps {
  selectedPurpose?: CallPurpose | null;
  onSelect: (purpose: CallPurpose | null) => void;
  onClose?: () => void;
}

const PURPOSE_OPTIONS: Array<{
  purpose: CallPurpose;
  label: string;
  description: string;
  icon: typeof Dumbbell;
  color: string;
  bgColor: string;
  borderColor: string;
}> = [
  {
    purpose: 'workout',
    label: 'Workout',
    description: 'Exercise & fitness',
    icon: Dumbbell,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    borderColor: 'border-orange-500/30',
  },
  {
    purpose: 'fitness',
    label: 'Fitness',
    description: 'Training & routines',
    icon: Activity,
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/30',
  },
  {
    purpose: 'nutrition',
    label: 'Nutrition',
    description: 'Diet & meal planning',
    icon: Apple,
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/30',
  },
  {
    purpose: 'meal',
    label: 'Meal',
    description: 'Meal suggestions',
    icon: UtensilsCrossed,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500/30',
  },
  {
    purpose: 'emotion',
    label: 'Emotion',
    description: 'Mental health support',
    icon: Heart,
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/20',
    borderColor: 'border-pink-500/30',
  },
  {
    purpose: 'sleep',
    label: 'Sleep',
    description: 'Sleep quality',
    icon: Moon,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-500/20',
    borderColor: 'border-indigo-500/30',
  },
  {
    purpose: 'stress',
    label: 'Stress',
    description: 'Stress management',
    icon: Brain,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/30',
  },
  {
    purpose: 'wellness',
    label: 'Wellness',
    description: 'Overall wellness',
    icon: Sparkles,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    borderColor: 'border-cyan-500/30',
  },
  {
    purpose: 'recovery',
    label: 'Recovery',
    description: 'Recovery & rest',
    icon: RefreshCw,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/30',
  },
  {
    purpose: 'goal_review',
    label: 'Goal Review',
    description: 'Review progress',
    icon: Target,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    borderColor: 'border-emerald-500/30',
  },
  {
    purpose: 'emergency',
    label: 'Emergency',
    description: 'Crisis support',
    icon: AlertCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-600/30',
    borderColor: 'border-red-500/50',
  },
  {
    purpose: 'general_health',
    label: 'General Health',
    description: 'General advice',
    icon: Activity,
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20',
    borderColor: 'border-gray-500/30',
  },
];

export function CallPurposeSelector({
  selectedPurpose,
  onSelect,
  onClose,
}: CallPurposeSelectorProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl border border-white/10 shadow-2xl p-4 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white mb-1">
              What&apos;s the purpose of your call?
            </h2>
            <p className="text-xs sm:text-sm text-white/60">
              Select a topic to get personalized guidance
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 text-white/70" />
            </button>
          )}
        </div>

        {/* Purpose Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 mb-4">
          {PURPOSE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = selectedPurpose === option.purpose;
            const isEmergency = option.purpose === 'emergency';

            return (
              <motion.button
                key={option.purpose}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelect(option.purpose)}
                className={`relative p-3 sm:p-4 rounded-xl backdrop-blur-xl border-2 transition-all text-left ${
                  isSelected
                    ? `${option.bgColor} ${option.borderColor} border-opacity-100`
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                } ${isEmergency ? 'ring-2 ring-red-500/50' : ''}`}
              >
                <div className="flex items-start gap-2 sm:gap-3">
                  <div
                    className={`p-1.5 sm:p-2 rounded-lg flex-shrink-0 ${
                      isSelected ? option.bgColor : 'bg-white/5'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 sm:w-5 sm:h-5 ${
                        isSelected ? option.color : 'text-white/60'
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3
                      className={`text-xs sm:text-sm font-semibold mb-0.5 ${
                        isSelected ? 'text-white' : 'text-white/90'
                      }`}
                    >
                      {option.label}
                    </h3>
                    <p className="text-[10px] sm:text-xs text-white/70">
                      {option.description}
                    </p>
                  </div>
                </div>
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400"
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Skip/General Health Button */}
        <div className="flex gap-2 sm:gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(null)}
            className={`flex-1 p-3 sm:p-4 rounded-xl backdrop-blur-xl border-2 transition-all ${
              selectedPurpose === null
                ? 'bg-white/10 border-white/30'
                : 'bg-white/5 border-white/10 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <span className="text-xs sm:text-sm font-medium text-white/90">
                Skip / General Health
              </span>
            </div>
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

