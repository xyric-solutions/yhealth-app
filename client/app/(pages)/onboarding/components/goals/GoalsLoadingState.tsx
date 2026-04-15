'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

const PHASES = [
  { label: 'Analyzing your assessment', icon: '🔍' },
  { label: 'Identifying key patterns', icon: '🧬' },
  { label: 'Building SMART goals', icon: '🎯' },
  { label: 'Personalizing your plan', icon: '✨' },
];

export function GoalsLoadingState() {
  const [activePhase, setActivePhase] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActivePhase((p) => (p < PHASES.length - 1 ? p + 1 : p));
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <motion.div
        className="flex flex-col items-center justify-center min-h-[500px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        {/* Animated orb with rings */}
        <div className="relative w-32 h-32 sm:w-40 sm:h-40 mb-10">
          {/* Outer pulse rings */}
          <motion.div
            className="absolute inset-0 rounded-full border border-sky-500/20"
            animate={{ scale: [1, 1.6, 1.6], opacity: [0.4, 0, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut' }}
          />
          <motion.div
            className="absolute inset-0 rounded-full border border-emerald-500/15"
            animate={{ scale: [1, 1.8, 1.8], opacity: [0.3, 0, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut', delay: 0.4 }}
          />
          <motion.div
            className="absolute inset-0 rounded-full border border-sky-400/10"
            animate={{ scale: [1, 2.0, 2.0], opacity: [0.2, 0, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut', delay: 0.8 }}
          />

          {/* Rotating orbit ring */}
          <motion.div
            className="absolute inset-2 rounded-full border-2 border-dashed border-sky-500/20"
            animate={{ rotate: 360 }}
            transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
          />

          {/* Orbiting dot */}
          <motion.div
            className="absolute inset-0"
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-sky-400 shadow-lg shadow-sky-400/50" />
          </motion.div>

          {/* Second orbiting dot (counter-rotate) */}
          <motion.div
            className="absolute inset-4"
            animate={{ rotate: -360 }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          >
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" />
          </motion.div>

          {/* Glow backdrop */}
          <div className="absolute inset-4 rounded-full bg-sky-500/10 blur-2xl" />

          {/* Inner core circle */}
          <motion.div
            className="absolute inset-6 sm:inset-8 rounded-full bg-gradient-to-br from-sky-600 via-sky-500 to-teal-500 flex items-center justify-center shadow-2xl shadow-sky-600/30"
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            {/* DNA / brain SVG animation */}
            <motion.svg
              className="w-10 h-10 sm:w-12 sm:h-12 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              {/* Brain-like icon */}
              <path d="M12 2a4 4 0 0 1 4 4c0 1.1-.9 2-2 2h-4a2 2 0 0 1-2-2 4 4 0 0 1 4-4Z" />
              <path d="M8 8v1a4 4 0 0 0 1.38 3.02L12 14l2.62-1.98A4 4 0 0 0 16 9V8" />
              <path d="M12 14v4" />
              <path d="M8 18h8" />
              <path d="M7 22h10" />
              <circle cx="12" cy="6" r="1" fill="currentColor" />
            </motion.svg>
          </motion.div>
        </div>

        {/* Title */}
        <motion.h2
          className="text-xl sm:text-2xl md:text-3xl font-medium text-white mb-3 text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          Generating Your Personalized Goals
        </motion.h2>

        {/* Subtitle */}
        <motion.p
          className="text-[rgba(239,237,253,0.6)] text-sm sm:text-base text-center max-w-md mb-10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          Our AI is analyzing your responses to create SMART goals tailored to your needs
        </motion.p>

        {/* Phase progress steps */}
        <motion.div
          className="w-full max-w-sm space-y-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          {PHASES.map((phase, i) => {
            const isActive = i === activePhase;
            const isDone = i < activePhase;

            return (
              <motion.div
                key={i}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-500
                  ${isActive ? 'bg-sky-600/10 border border-sky-600/30' : isDone ? 'opacity-60' : 'opacity-30'}
                `}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: isActive ? 1 : isDone ? 0.6 : 0.3, x: 0 }}
                transition={{ delay: 0.7 + i * 0.15 }}
              >
                {/* Status icon */}
                <div className={`
                  w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0
                  ${isActive ? 'bg-sky-600/20' : isDone ? 'bg-emerald-600/20' : 'bg-white/5'}
                `}>
                  {isDone ? (
                    <motion.svg
                      className="w-4 h-4 text-emerald-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.4 }}
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </motion.svg>
                  ) : (
                    <span>{phase.icon}</span>
                  )}
                </div>

                {/* Label */}
                <span className={`
                  text-sm font-medium
                  ${isActive ? 'text-white' : isDone ? 'text-white/60' : 'text-white/40'}
                `}>
                  {phase.label}
                </span>

                {/* Active spinner */}
                {isActive && (
                  <motion.div
                    className="ml-auto w-4 h-4 rounded-full border-2 border-sky-500/30 border-t-sky-500"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                )}
              </motion.div>
            );
          })}
        </motion.div>
      </motion.div>
    </div>
  );
}
