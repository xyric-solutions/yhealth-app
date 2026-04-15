"use client";

import { motion } from "framer-motion";
import { Clock, Zap, Target, AlertCircle, Sparkles, CheckCircle2 } from "lucide-react";

export type SessionTypeOption = 
  | 'quick_checkin'
  | 'coaching_session'
  | 'emergency_support'
  | 'goal_review'
  | 'health_coach'
  | 'nutrition'
  | 'fitness'
  | 'wellness';

interface SessionTypeSelectorProps {
  selectedType?: SessionTypeOption;
  onSelect: (type: SessionTypeOption) => void;
  aiSuggestion?: {
    sessionType: SessionTypeOption;
    confidence: number;
    reasoning: string;
    estimatedDuration: number;
  };
  showEmergency?: boolean;
}

const SESSION_TYPES: Array<{
  type: SessionTypeOption;
  label: string;
  description: string;
  duration: string;
  durationMinutes: number; // For auto-close functionality
  icon: typeof Clock;
  color: string;
  gradient: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
}> = [
  {
    type: 'quick_checkin',
    label: 'Quick Check-In',
    description: 'Short questions & answers',
    duration: '2.5 min',
    durationMinutes: 2.5,
    icon: Zap,
    color: 'text-blue-400',
    gradient: 'from-blue-500 via-cyan-500 to-blue-600',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/30',
    glowColor: 'rgba(59, 130, 246, 0.5)',
  },
  {
    type: 'coaching_session',
    label: 'Coaching Session',
    description: '10 minute deep dive',
    duration: '10 min',
    durationMinutes: 10,
    icon: Sparkles,
    color: 'text-purple-400',
    gradient: 'from-purple-500 via-pink-500 to-purple-600',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/30',
    glowColor: 'rgba(168, 85, 247, 0.5)',
  },
  {
    type: 'goal_review',
    label: 'Goal Review',
    description: '10-minute goal assessment',
    duration: '10 min',
    durationMinutes: 10,
    icon: Target,
    color: 'text-green-400',
    gradient: 'from-green-500 via-emerald-500 to-green-600',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/30',
    glowColor: 'rgba(34, 197, 94, 0.5)',
  },
  {
    type: 'emergency_support',
    label: 'Emergency Support',
    description: 'Immediate crisis help',
    duration: '15 min',
    durationMinutes: 15,
    icon: AlertCircle,
    color: 'text-red-400',
    gradient: 'from-red-500 via-rose-500 to-red-600',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/30',
    glowColor: 'rgba(239, 68, 68, 0.5)',
  },
];

export function SessionTypeSelector({
  selectedType,
  onSelect,
  aiSuggestion,
  showEmergency = true,
}: SessionTypeSelectorProps) {
  const sessionTypes = showEmergency
    ? SESSION_TYPES
    : SESSION_TYPES.filter(st => st.type !== 'emergency_support');

  return (
    <div className="space-y-6">
      {/* AI Suggestion */}
      {aiSuggestion && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative p-5 bg-gradient-to-r from-purple-500/20 via-blue-500/20 to-purple-500/20 backdrop-blur-xl rounded-2xl border border-purple-500/40 overflow-hidden"
        >
          {/* Animated background gradient */}
          <motion.div
            className="absolute inset-0 opacity-30"
            animate={{
              backgroundPosition: ['0% 0%', '100% 100%'],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              repeatType: 'reverse',
            }}
            style={{
              background: `linear-gradient(135deg, rgba(168, 85, 247, 0.3), rgba(59, 130, 246, 0.3))`,
            }}
          />
          <div className="relative flex items-start gap-4">
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/30 to-blue-500/30"
            >
              <Sparkles className="w-6 h-6 text-white" />
            </motion.div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white mb-1.5 flex items-center gap-2">
                <span>AI Recommendation</span>
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs font-medium">
                  {Math.round(aiSuggestion.confidence * 100)}% match
                </span>
              </p>
              <p className="text-xs text-white/80 mb-3 leading-relaxed">{aiSuggestion.reasoning}</p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onSelect(aiSuggestion.sessionType)}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 text-white text-xs font-semibold hover:shadow-lg hover:shadow-purple-500/30 transition-all"
              >
                Select {SESSION_TYPES.find(st => st.type === aiSuggestion.sessionType)?.label}
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Session Type Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {sessionTypes.map((session, index) => {
          const Icon = session.icon;
          const isSelected = selectedType === session.type;
          const isEmergency = session.type === 'emergency_support';

          return (
            <motion.button
              key={session.type}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelect(session.type)}
              className={`group relative p-5 rounded-2xl backdrop-blur-xl border-2 transition-all text-left overflow-hidden ${
                isSelected
                  ? `${session.borderColor} border-opacity-100 shadow-2xl`
                  : 'bg-gradient-to-br from-white/5 to-white/0 border-white/10 hover:border-white/20 hover:bg-white/10'
              } ${isEmergency ? 'ring-2 ring-red-500/50 shadow-red-500/20' : ''}`}
              style={{
                boxShadow: isSelected
                  ? `0 0 30px ${session.glowColor}, 0 10px 40px rgba(0, 0, 0, 0.3)`
                  : undefined,
              }}
            >
              {/* Animated gradient background */}
              {isSelected && (
                <motion.div
                  className="absolute inset-0 opacity-20"
                  animate={{
                    backgroundPosition: ['0% 0%', '100% 100%'],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    repeatType: 'reverse',
                  }}
                  style={{
                    background: `linear-gradient(135deg, ${session.gradient})`,
                  }}
                />
              )}

              {/* Glow effect */}
              {isSelected && (
                <motion.div
                  className="absolute inset-0 rounded-2xl"
                  animate={{
                    opacity: [0.3, 0.6, 0.3],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  style={{
                    background: `radial-gradient(circle at center, ${session.glowColor}, transparent 70%)`,
                  }}
                />
              )}

              <div className="relative flex items-start gap-4">
                {/* Icon with animated background */}
                <motion.div
                  className={`p-3 rounded-xl transition-all ${
                    isSelected
                      ? `bg-gradient-to-br ${session.gradient} shadow-lg`
                      : 'bg-white/5 group-hover:bg-white/10'
                  }`}
                  animate={isSelected ? { rotate: [0, 360] } : {}}
                  transition={isSelected ? { duration: 20, repeat: Infinity, ease: "linear" } : {}}
                >
                  <Icon
                    className={`w-6 h-6 ${
                      isSelected ? 'text-white' : 'text-white/60 group-hover:text-white/80'
                    } transition-colors`}
                  />
                </motion.div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <h3
                      className={`text-base font-bold ${
                        isSelected ? 'text-white' : 'text-white/90 group-hover:text-white'
                      } transition-colors`}
                    >
                      {session.label}
                    </h3>
                    <div className="flex items-center gap-2">
                      <Clock className={`w-4 h-4 ${isSelected ? session.color : 'text-white/50'}`} />
                      <span className={`text-xs font-semibold ${
                        isSelected ? session.color : 'text-white/60'
                      }`}>
                        {session.duration}
                      </span>
                    </div>
                  </div>
                  <p className={`text-sm ${
                    isSelected ? 'text-white/90' : 'text-white/70 group-hover:text-white/80'
                  } transition-colors`}>
                    {session.description}
                  </p>
                </div>
              </div>

              {/* Selected indicator */}
              {isSelected && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute top-3 right-3"
                >
                  <div className="relative">
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 rounded-full bg-emerald-400/30 blur-md"
                    />
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 relative z-10" />
                  </div>
                </motion.div>
              )}

              {/* Hover glow effect */}
              {!isSelected && (
                <motion.div
                  className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    background: `radial-gradient(circle at center, ${session.glowColor}20, transparent 70%)`,
                  }}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// Export duration mapping for auto-close functionality
export const SESSION_DURATIONS: Record<SessionTypeOption, number> = {
  quick_checkin: 2.5,
  coaching_session: 10,
  goal_review: 10,
  emergency_support: 15,
  health_coach: 20,
  nutrition: 15,
  fitness: 20,
  wellness: 15,
};

