'use client';

import { useState } from 'react';

interface ParticleBackgroundProps {
  color: string; // e.g., 'emerald', 'cyan', 'orange', 'purple', 'red', 'indigo'
  particleCount?: number;
  className?: string;
  opacity?: number;
}

const colorMap: Record<string, { gradient: string; glow: string; particle: string }> = {
  emerald: {
    gradient: 'from-emerald-400/30 via-green-400/20 to-teal-400/30',
    glow: 'bg-emerald-400',
    particle: '#10b981',
  },
  cyan: {
    gradient: 'from-cyan-400/30 via-blue-400/20 to-sky-400/30',
    glow: 'bg-cyan-400',
    particle: '#06b6d4',
  },
  orange: {
    gradient: 'from-orange-400/30 via-amber-400/20 to-red-400/30',
    glow: 'bg-orange-400',
    particle: '#f97316',
  },
  purple: {
    gradient: 'from-purple-400/30 via-pink-400/20 to-fuchsia-400/30',
    glow: 'bg-purple-400',
    particle: '#a855f7',
  },
  red: {
    gradient: 'from-red-400/30 via-rose-400/20 to-pink-400/30',
    glow: 'bg-red-400',
    particle: '#ef4444',
  },
  indigo: {
    gradient: 'from-indigo-400/30 via-violet-400/20 to-purple-400/30',
    glow: 'bg-indigo-400',
    particle: '#6366f1',
  },
};

export function ParticleBackground({ color, particleCount = 150, className = '', opacity = 1 }: ParticleBackgroundProps) {
  const [particles] = useState(() => {
    return Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      delay: Math.random() * 2,
      opacity: 0.6 + Math.random() * 0.4,
    }));
  });

  const colors = colorMap[color] || colorMap.emerald;

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`}>
      {/* Base glow - removed blur for glass effect */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${colors.gradient} rounded-full animate-pulse`}
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '200%',
          height: '200%',
          opacity: opacity * 0.3,
        }}
      />

      {/* Particle layer - more subtle and professional */}
      <div className="absolute inset-0" style={{ mixBlendMode: 'screen', opacity: opacity * 0.6 }}>
        <svg className="w-full h-full" viewBox="0 0 200 200" preserveAspectRatio="none">
          <defs>
            <radialGradient id={`particleGradient-${color}`}>
              <stop offset="0%" stopColor={colors.particle} stopOpacity="0.8" />
              <stop offset="50%" stopColor={colors.particle} stopOpacity="0.4" />
              <stop offset="100%" stopColor={colors.particle} stopOpacity="0.1" />
            </radialGradient>
            <filter id={`glow-${color}`}>
              <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          {/* Perimeter particles - denser */}
          {particles.slice(0, Math.floor(particleCount * 0.7)).map((particle) => {
            const angle = (particle.id / particleCount) * Math.PI * 2;
            // eslint-disable-next-line react-hooks/purity
            const radius = 88 + Math.random() * 8;
            const x = 100 + Math.cos(angle) * radius;
            const y = 100 + Math.sin(angle) * radius;
            return (
              <circle
                key={particle.id}
                cx={x}
                cy={y}
                r={particle.size * 0.8}
                fill={`url(#particleGradient-${color})`}
                opacity={particle.opacity * 0.7}
                filter={`url(#glow-${color})`}
              >
                <animate
                  attributeName="opacity"
                  values={`${particle.opacity * 0.3};${particle.opacity * 0.8};${particle.opacity * 0.3}`}
                  // eslint-disable-next-line react-hooks/purity
                  dur={`${2 + Math.random() * 2}s`}
                  repeatCount="indefinite"
                  begin={`${particle.delay}s`}
                />
              </circle>
            );
          })}
          {/* Center particles - sparse */}
          {Array.from({ length: Math.floor(particleCount / 6) }, (_, i) => {
            // eslint-disable-next-line react-hooks/purity
            const angle = Math.random() * Math.PI * 2;
            // eslint-disable-next-line react-hooks/purity
            const radius = Math.random() * 35;
            const x = 100 + Math.cos(angle) * radius;
            const y = 100 + Math.sin(angle) * radius;
            // eslint-disable-next-line react-hooks/purity
            const size = Math.random() * 1.2 + 0.4;
            return (
              <circle
                key={`center-${i}`}
                cx={x}
                cy={y}
                r={size}
                fill={`url(#particleGradient-${color})`}
                // eslint-disable-next-line react-hooks/purity
                opacity={0.2 + Math.random() * 0.2}
                filter={`url(#glow-${color})`}
              >
                <animate
                  attributeName="opacity"
                  values="0.2;0.4;0.2"
                  // eslint-disable-next-line react-hooks/purity
                  dur={`${2 + Math.random() * 2}s`}
                  repeatCount="indefinite"
                />
              </circle>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

