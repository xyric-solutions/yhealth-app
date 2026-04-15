'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { GeneratingViewProps } from './types';

export function GeneratingView({ phases, currentPhaseIndex }: GeneratingViewProps) {
  const currentPhase = phases[currentPhaseIndex] || phases[phases.length - 1];
  const progress = ((currentPhaseIndex + 1) / phases.length) * 100;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative min-h-[75vh] flex flex-col items-center justify-center px-4 overflow-hidden"
    >
      {/* ── Animated background layers ── */}

      {/* Radial gradient pulse */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{
          background: [
            'radial-gradient(ellipse 600px 400px at 50% 45%, rgba(14,165,233,0.06) 0%, transparent 70%)',
            'radial-gradient(ellipse 700px 500px at 50% 45%, rgba(16,185,129,0.05) 0%, transparent 70%)',
            'radial-gradient(ellipse 600px 400px at 50% 45%, rgba(14,165,233,0.06) 0%, transparent 70%)',
          ],
        }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Grid overlay — subtle tech feel */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Rising particles — 16 floating dots */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 16 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: 1.5 + (i % 4),
              height: 1.5 + (i % 4),
              left: `${5 + i * 5.8}%`,
              bottom: '-5%',
              background: i % 3 === 0
                ? 'rgba(14,165,233,0.5)'
                : i % 3 === 1
                  ? 'rgba(16,185,129,0.4)'
                  : 'rgba(45,212,191,0.35)',
            }}
            animate={{
              y: [0, -(400 + i * 40)],
              x: [0, (i % 2 === 0 ? 20 : -20), 0],
              opacity: [0, 0.8, 0],
            }}
            transition={{
              duration: 6 + i * 0.8,
              repeat: Infinity,
              delay: i * 0.5,
              ease: 'easeOut',
            }}
          />
        ))}
      </div>

      {/* ── Title section ── */}
      <motion.h1
        className="text-xl sm:text-2xl md:text-3xl font-semibold text-white mb-2 text-center relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        Generating Your Personalized Plan
      </motion.h1>
      <motion.p
        className="text-white/30 text-sm sm:text-base mb-14 sm:mb-20 text-center relative z-10"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        Our AI is crafting a unique plan just for you...
      </motion.p>

      {/* ── Central phase display ── */}
      <div className="relative z-10 flex flex-col items-center min-h-[220px] sm:min-h-[260px] justify-center">
        <AnimatePresence mode="wait">
          <PhaseDisplay
            key={currentPhase.id}
            phase={currentPhase}
            index={currentPhaseIndex}
          />
        </AnimatePresence>
      </div>

      {/* ── Bottom progress section ── */}
      <motion.div
        className="relative z-10 w-full max-w-xs sm:max-w-sm mt-14 sm:mt-20"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        {/* Step indicator dots */}
        <div className="flex items-center justify-center gap-2.5 mb-4">
          {phases.map((_, i) => (
            <motion.div
              key={i}
              className={`
                rounded-full transition-all duration-700
                ${i < currentPhaseIndex
                  ? 'w-2.5 h-2.5 bg-emerald-500'
                  : i === currentPhaseIndex
                    ? 'w-8 h-2.5 bg-sky-500'
                    : 'w-2 h-2 bg-white/10'
                }
              `}
              layout
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            />
          ))}
        </div>

        {/* Animated progress track */}
        <div className="relative h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
          {/* Shimmer overlay */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
          />
          {/* Fill */}
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{
              background: 'linear-gradient(90deg, #0ea5e9, #10b981, #14b8a6)',
              boxShadow: '0 0 12px rgba(14,165,233,0.4), 0 0 24px rgba(16,185,129,0.2)',
            }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Single Phase Display ───

interface PhaseDisplayProps {
  phase: { id: string; label: string; icon: React.ReactNode };
  index: number;
}

function PhaseDisplay({ phase, index }: PhaseDisplayProps) {
  // Unique loop animation per phase
  const loops = [
    { scale: [1, 1.1, 1] },
    { y: [0, -10, 0] },
    { rotate: [0, 12, -12, 0] },
    { scale: [1, 1.15, 1], rotate: [0, 6, -6, 0] },
    { y: [0, -6, 0], rotate: [0, -8, 8, 0] },
    { scale: [1, 1.08, 0.95, 1.08, 1] },
  ];
  const loop = loops[index % loops.length];

  return (
    <motion.div
      className="flex flex-col items-center"
      initial={{ opacity: 0, scale: 0.7, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.5, y: -40 }}
      transition={{ type: 'spring', stiffness: 180, damping: 18 }}
    >
      {/* Outer glow layers */}
      <div className="relative mb-6 sm:mb-8">
        {/* Pulsing glow ring 1 */}
        <motion.div
          className="absolute -inset-6 sm:-inset-8 rounded-full border border-sky-500/10"
          animate={{ scale: [1, 1.3, 1.3], opacity: [0.4, 0, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut' }}
        />
        {/* Pulsing glow ring 2 */}
        <motion.div
          className="absolute -inset-4 sm:-inset-6 rounded-full border border-emerald-500/8"
          animate={{ scale: [1, 1.5, 1.5], opacity: [0.3, 0, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
        />

        {/* Rotating orbit */}
        <motion.div
          className="absolute -inset-5 sm:-inset-7 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-sky-400/60" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1 h-1 rounded-full bg-emerald-400/50" />
        </motion.div>

        {/* Counter-rotating orbit */}
        <motion.div
          className="absolute -inset-3 sm:-inset-4 rounded-full"
          animate={{ rotate: -360 }}
          transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
        >
          <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-teal-400/40" />
        </motion.div>

        {/* Background glow */}
        <motion.div
          className="absolute -inset-8 rounded-full blur-3xl"
          animate={{
            opacity: [0.08, 0.15, 0.08],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            background: 'radial-gradient(circle, rgba(14,165,233,0.3) 0%, rgba(16,185,129,0.15) 50%, transparent 70%)',
          }}
        />

        {/* Dashed orbit ring */}
        <motion.div
          className="absolute -inset-3 sm:-inset-4 rounded-full border border-dashed border-white/[0.06]"
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        />

        {/* Main icon container */}
        <motion.div
          className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl sm:rounded-3xl flex items-center justify-center overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(14,165,233,0.08) 0%, rgba(16,185,129,0.05) 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 0 40px rgba(14,165,233,0.08), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}
        >
          {/* Inner shimmer */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent"
            animate={{ x: ['-150%', '150%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', repeatDelay: 2 }}
          />

          {/* Icon with unique loop */}
          <motion.div
            className="relative text-emerald-400"
            animate={loop}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full">
              {phase.icon}
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Phase label with typing-feel animation */}
      <motion.h2
        className="text-lg sm:text-xl md:text-2xl font-medium text-white text-center"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
      >
        {phase.label}
      </motion.h2>
    </motion.div>
  );
}
