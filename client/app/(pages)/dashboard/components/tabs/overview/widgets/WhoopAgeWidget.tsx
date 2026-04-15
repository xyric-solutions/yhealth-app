'use client';

import { motion } from 'framer-motion';
import { Sparkles, TrendingDown } from 'lucide-react';
import { useMemo, useState } from 'react';

interface WhoopAgeWidgetProps {
  whoopAge: number | null;
  chronologicalAge: number | null;
  isLoading?: boolean;
}

// Generate random particles for the glowing effect
const generateParticles = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    delay: Math.random() * 2,
  }));
};

export function WhoopAgeWidget({ whoopAge, chronologicalAge, isLoading }: WhoopAgeWidgetProps) {
  const [particles] = useState(() => generateParticles(150));
  
  const ageDifference = useMemo(() => {
    if (!whoopAge || !chronologicalAge) return null;
    return chronologicalAge - whoopAge;
  }, [whoopAge, chronologicalAge]);

  const isYounger = ageDifference !== null && ageDifference > 0;
  const displayAge = whoopAge || chronologicalAge || null;

  if (isLoading || displayAge === null) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-cyan-500/10 border border-emerald-500/20 p-6 backdrop-blur-sm"
      >
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-24 h-24 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-emerald-400/50" />
          </div>
          <p className="text-sm text-slate-400">Connect WHOOP to see your age</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative overflow-hidden rounded-2xl bg-black/40 border border-emerald-500/30 p-6 backdrop-blur-sm"
    >
      {/* Animated background glow with particles */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl">
        {/* Base glow */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.4, 0.6, 0.4],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute inset-0 bg-gradient-to-br from-emerald-400/30 via-green-400/20 to-teal-400/30 rounded-full blur-3xl"
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '200%',
            height: '200%',
          }}
        />
        
        {/* Particle layer */}
        <div className="absolute inset-0" style={{ mixBlendMode: 'screen' }}>
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute rounded-full bg-emerald-400"
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                width: `${particle.size}px`,
                height: `${particle.size}px`,
                boxShadow: `0 0 ${particle.size * 2}px rgba(16, 185, 129, 0.8)`,
              }}
              animate={{
                opacity: [0.3, 1, 0.3],
                scale: [0.8, 1.2, 0.8],
              }}
              transition={{
                // eslint-disable-next-line react-hooks/purity
                duration: 2 + Math.random() * 2,
                repeat: Infinity,
                delay: particle.delay,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      </div>

      <div className="relative flex flex-col items-center justify-center py-6">
        {/* Circular Display with organic shape */}
        <div className="relative w-48 h-48 mb-4">
          {/* Organic circular background with particles */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-400/20 via-green-400/15 to-teal-400/20 blur-xl" />
          
          {/* Particle-filled circle */}
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <svg className="w-full h-full" viewBox="0 0 200 200">
              <defs>
                <radialGradient id="particleGradient">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.9" />
                  <stop offset="50%" stopColor="#22c55e" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.2" />
                </radialGradient>
              </defs>
              {/* Dense particles around perimeter, sparse in center */}
              {Array.from({ length: 200 }, (_, i) => {
                const angle = (i / 200) * Math.PI * 2;
                // eslint-disable-next-line react-hooks/purity
                const radius = 85 + Math.random() * 10;
                const x = 100 + Math.cos(angle) * radius;
                const y = 100 + Math.sin(angle) * radius;
                // eslint-disable-next-line react-hooks/purity
                const size = Math.random() * 2 + 0.5;
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r={size}
                    fill="url(#particleGradient)"
                    // eslint-disable-next-line react-hooks/purity
                    opacity={0.8 + Math.random() * 0.2}
                  >
                    <animate
                      attributeName="opacity"
                      // eslint-disable-next-line react-hooks/purity
                      values={`${0.6 + Math.random() * 0.4};${0.9 + Math.random() * 0.1};${0.6 + Math.random() * 0.4}`}
                      // eslint-disable-next-line react-hooks/purity
                      dur={`${1 + Math.random() * 2}s`}
                      repeatCount="indefinite"
                    />
                  </circle>
                );
              })}
              {/* Center particles */}
              {Array.from({ length: 30 }, (_, i) => {
                // eslint-disable-next-line react-hooks/purity
                const angle = Math.random() * Math.PI * 2;
                // eslint-disable-next-line react-hooks/purity
                const radius = Math.random() * 40;
                const x = 100 + Math.cos(angle) * radius;
                const y = 100 + Math.sin(angle) * radius;
                // eslint-disable-next-line react-hooks/purity
                const size = Math.random() * 1.5 + 0.5;
                return (
                  <circle
                    key={`center-${i}`}
                    cx={x}
                    cy={y}
                    r={size}
                    fill="url(#particleGradient)"
                    // eslint-disable-next-line react-hooks/purity
                    opacity={0.4 + Math.random() * 0.3}
                  >
                    <animate
                      attributeName="opacity"
                      values={`${0.3};${0.6};${0.3}`}
                      // eslint-disable-next-line react-hooks/purity
                      dur={`${1.5 + Math.random() * 1.5}s`}
                      repeatCount="indefinite"
                    />
                  </circle>
                );
              })}
            </svg>
          </div>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
            <motion.p
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
              className="text-2xl sm:text-3xl font-bold text-white mb-1 drop-shadow-lg"
              style={{ textShadow: '0 0 20px rgba(16, 185, 129, 0.5)' }}
            >
              {displayAge.toFixed(1)}
            </motion.p>
            <p className="text-xs font-semibold text-emerald-300 tracking-wider">WHOOP AGE</p>
          </div>
        </div>

        {/* Age difference */}
        {ageDifference !== null && isYounger && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/30 border border-emerald-400/50 backdrop-blur-sm"
          >
            <TrendingDown className="w-4 h-4 text-emerald-300" />
            <span className="text-sm font-bold text-emerald-300">
              {Math.abs(ageDifference).toFixed(1)} years younger
            </span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

