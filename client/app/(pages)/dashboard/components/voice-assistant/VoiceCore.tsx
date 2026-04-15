"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";

type VoiceState = "idle" | "listening" | "processing" | "speaking";

interface VoiceCoreProps {
  voiceState: VoiceState;
  isActive: boolean;
  onClick: () => void;
  size?: number;
}

const COLORS = {
  idle: {
    primary: "#1DE9B6",
    secondary: "#00E5FF",
    glow: "#1DE9B6",
  },
  listening: {
    primary: "#00E5FF",
    secondary: "#1DE9B6",
    glow: "#00E5FF",
  },
  processing: {
    primary: "#7C4DFF",
    secondary: "#00E5FF",
    glow: "#7C4DFF",
  },
  speaking: {
    primary: "#1DE9B6",
    secondary: "#00E5FF",
    glow: "#1DE9B6",
  },
};

export function VoiceCore({ voiceState, isActive, onClick, size = 280 }: VoiceCoreProps) {
  const shouldReduceMotion = useReducedMotion();

  // Orbiting particles for thinking/processing state
  const particles = useMemo(
    () =>
      Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const radius = size * 0.6;
        return {
          id: i,
          angle,
          radius,
          delay: i * 0.1,
        };
      }),
    [size]
  );

  // Waveform bars for listening state
  const waveformBars = useMemo(() => {
    // Use a seeded random function for deterministic results
    let seed = 22222;
    const seededRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    return Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      delay: i * 0.05,
      height: 20 + seededRandom() * 40,
    }));
  }, []);

  const colors = COLORS[voiceState];
  const halfSize = size / 2;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      {/* Outer rotating concentric circles - 360 rotation */}
      {!shouldReduceMotion && (
        <div className="absolute inset-0" style={{ width: size * 2, height: size * 2, left: `-${size / 2}px`, top: `-${size / 2}px` }}>
          <svg className="w-full h-full" style={{ overflow: "visible" }}>
            <defs>
              <filter id="glow-filter">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            
            {/* Outer rotating ring with dots */}
            <motion.g
              animate={{ rotate: 360 }}
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: `${size}px ${size}px` }}
            >
              <circle
                cx={size}
                cy={size}
                r={size * 0.9}
                fill="none"
                stroke={colors.primary}
                strokeWidth="1"
                strokeDasharray="4 4"
                opacity="0.3"
                filter="url(#glow-filter)"
              />
              {/* Dotted markers */}
              {Array.from({ length: 24 }).map((_, i) => {
                const angle = (i / 24) * Math.PI * 2;
                const x = size + (size * 0.9) * Math.cos(angle);
                const y = size + (size * 0.9) * Math.sin(angle);
                return (
                  <rect
                    key={i}
                    x={x - 2}
                    y={y - 2}
                    width="4"
                    height="4"
                    fill={colors.primary}
                    opacity="0.6"
                    filter="url(#glow-filter)"
                  />
                );
              })}
            </motion.g>

            {/* Single rotating circle */}
            <motion.g
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              style={{ transformOrigin: `${size}px ${size}px` }}
            >
              <circle
                cx={size}
                cy={size}
                r={size * 0.7}
                fill="none"
                stroke={colors.primary}
                strokeWidth="2"
                opacity="0.4"
                filter="url(#glow-filter)"
              />
            </motion.g>

            {/* Radial dash marks */}
            {Array.from({ length: 36 }).map((_, i) => {
              const angle = (i / 36) * Math.PI * 2;
              const startRadius = size * 0.95;
              const endRadius = size * 1.05;
              const x1 = size + startRadius * Math.cos(angle);
              const y1 = size + startRadius * Math.sin(angle);
              const x2 = size + endRadius * Math.cos(angle);
              const y2 = size + endRadius * Math.sin(angle);
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={colors.primary}
                  strokeWidth="1"
                  opacity="0.2"
                />
              );
            })}
          </svg>
        </div>
      )}

      {/* Outer glow layers */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: size * 1.4,
          height: size * 1.4,
          background: `radial-gradient(circle, ${colors.glow}20 0%, transparent 70%)`,
        }}
        animate={
          shouldReduceMotion
            ? {}
            : {
                scale: isActive && voiceState === "listening" ? [1, 1.2, 1] : voiceState === "speaking" ? [1, 1.1, 1] : 1,
                opacity: isActive ? [0.3, 0.5, 0.3] : 0.2,
              }
        }
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Radial waves for listening state */}
      {voiceState === "listening" && !shouldReduceMotion && (
        <>
          {[0, 1, 2].map((wave) => (
            <motion.div
              key={wave}
              className="absolute rounded-full border"
              style={{
                width: size,
                height: size,
                borderColor: colors.primary,
                borderWidth: 2,
              }}
              initial={{ scale: 0.8, opacity: 0.8 }}
              animate={{
                scale: [0.8, 1.5, 2],
                opacity: [0.8, 0.4, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: wave * 0.7,
                ease: "easeOut",
              }}
            />
          ))}
        </>
      )}

      {/* Orbiting particles for processing state */}
      {voiceState === "processing" && !shouldReduceMotion && (
        <svg className="absolute inset-0" style={{ width: size * 1.5, height: size * 1.5 }}>
          {particles.map((particle) => {
            const x = halfSize + particle.radius * Math.cos(particle.angle);
            const y = halfSize + particle.radius * Math.sin(particle.angle);
            return (
              <motion.g
                key={particle.id}
                animate={{
                  rotate: 360,
                }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: "linear",
                }}
                style={{ transformOrigin: `${halfSize}px ${halfSize}px` }}
              >
                <circle
                  cx={x}
                  cy={y}
                  r="3"
                  fill={colors.primary}
                  opacity={0.8}
                >
                  <animate
                    attributeName="opacity"
                    values="0.3;1;0.3"
                    dur="2s"
                    begin={`${particle.delay}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              </motion.g>
            );
          })}
        </svg>
      )}

      {/* Main core button */}
      <motion.button
        onClick={onClick}
        className="relative rounded-full flex items-center justify-center overflow-hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0B0F14]"
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle at 30% 30%, ${colors.primary}15, ${colors.secondary}10, transparent 60%)`,
          backdropFilter: "blur(20px)",
          border: `1px solid ${colors.primary}30`,
          boxShadow: `
            0 0 60px ${colors.glow}40,
            0 0 100px ${colors.glow}30,
            0 0 140px ${colors.glow}20,
            inset 0 0 40px ${colors.primary}10
          `,
        }}
        whileHover={shouldReduceMotion ? {} : { scale: 1.05 }}
        whileTap={shouldReduceMotion ? {} : { scale: 0.95 }}
        animate={
          shouldReduceMotion
            ? {}
            : {
                scale:
                  voiceState === "idle" && isActive
                    ? [1, 1.02, 1]
                    : voiceState === "listening"
                    ? [1, 1.03, 1]
                    : voiceState === "speaking"
                    ? [1, 1.04, 1.02, 1]
                    : 1,
                boxShadow: [
                  `0 0 60px ${colors.glow}40, 0 0 100px ${colors.glow}30, 0 0 140px ${colors.glow}20`,
                  `0 0 80px ${colors.glow}60, 0 0 120px ${colors.glow}40, 0 0 160px ${colors.glow}30`,
                  `0 0 60px ${colors.glow}40, 0 0 100px ${colors.glow}30, 0 0 140px ${colors.glow}20`,
                ],
              }
        }
        transition={{
          scale: {
            duration: voiceState === "idle" ? 4 : voiceState === "speaking" ? 1.5 : 2,
            repeat: voiceState === "idle" || voiceState === "listening" || voiceState === "speaking" ? Infinity : 0,
            ease: "easeInOut",
          },
          boxShadow: {
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          },
        }}
        aria-label={isActive ? "Stop conversation" : "Start conversation"}
      >
        {/* Multiple rotating gradient layers - 360 rotation */}
        {!shouldReduceMotion && (
          <>
            {/* Fast rotating inner gradient */}
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{
                background: `conic-gradient(from 0deg, ${colors.primary}15, ${colors.secondary}20, ${colors.primary}15)`,
              }}
              animate={{ rotate: 360 }}
              transition={{
                duration: 15,
                repeat: Infinity,
                ease: "linear",
              }}
            />
            {/* Slow rotating outer gradient (reverse) */}
            <motion.div
              className="absolute inset-[10%] rounded-full"
              style={{
                background: `conic-gradient(from 180deg, ${colors.secondary}10, ${colors.primary}15, ${colors.secondary}10)`,
              }}
              animate={{ rotate: -360 }}
              transition={{
                duration: 25,
                repeat: Infinity,
                ease: "linear",
              }}
            />
          </>
        )}

        {/* Center highlight */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(ellipse 40% 30% at 35% 30%, ${colors.primary}30, transparent 60%)`,
          }}
        />

        {/* Waveform visualization for listening */}
        {voiceState === "listening" && !shouldReduceMotion && (
          <div className="absolute inset-0 flex items-center justify-center gap-1">
            {waveformBars.map((bar) => (
              <motion.div
                key={bar.id}
                className="rounded-full"
                style={{
                  width: 3,
                  height: bar.height,
                  background: `linear-gradient(to top, ${colors.primary}, ${colors.secondary})`,
                }}
                animate={{
                  height: [bar.height, bar.height * 1.5, bar.height],
                  opacity: [0.6, 1, 0.6],
                }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: bar.delay,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
        )}

        {/* Grid pattern overlay (like the image) */}
        <div
          className="absolute inset-0 rounded-full opacity-15"
          style={{
            backgroundImage: `linear-gradient(${colors.primary}20 1px, transparent 1px), linear-gradient(90deg, ${colors.primary}20 1px, transparent 1px)`,
            backgroundSize: "12px 12px",
          }}
        />
        
        {/* Rotating concentric circles with 360 rotation - inside core */}
        {!shouldReduceMotion && (
          <div className="absolute inset-0">
            <svg className="w-full h-full" style={{ overflow: "visible" }}>
              {/* Inner solid circle - rotating */}
              <motion.g
                animate={{ rotate: 360 }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                style={{ transformOrigin: `${size / 2}px ${size / 2}px` }}
              >
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={size * 0.35}
                  fill="none"
                  stroke={colors.primary}
                  strokeWidth="1.5"
                  opacity="0.4"
                />
              </motion.g>

              {/* Middle dotted circle - rotating reverse */}
              <motion.g
                animate={{ rotate: -360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                style={{ transformOrigin: `${size / 2}px ${size / 2}px` }}
              >
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={size * 0.45}
                  fill="none"
                  stroke={colors.secondary}
                  strokeWidth="1"
                  strokeDasharray="3 6"
                  opacity="0.3"
                />
                {/* Square markers on dotted circle */}
                {Array.from({ length: 12 }).map((_, i) => {
                  const angle = (i / 12) * Math.PI * 2;
                  const x = size / 2 + (size * 0.45) * Math.cos(angle);
                  const y = size / 2 + (size * 0.45) * Math.sin(angle);
                  return (
                    <rect
                      key={i}
                      x={x - 2}
                      y={y - 2}
                      width="4"
                      height="4"
                      fill={colors.secondary}
                      opacity="0.6"
                    />
                  );
                })}
              </motion.g>

              {/* Outer circle - rotating */}
              <motion.g
                animate={{ rotate: 360 }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                style={{ transformOrigin: `${size / 2}px ${size / 2}px` }}
              >
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={size * 0.48}
                  fill="none"
                  stroke={colors.primary}
                  strokeWidth="1"
                  opacity="0.25"
                />
              </motion.g>
            </svg>
          </div>
        )}

        {/* Pulsing concentric rings */}
        {!shouldReduceMotion && (
          <>
            {[0, 1, 2].map((ring) => (
              <motion.div
                key={`pulse-ring-${ring}`}
                className="absolute rounded-full border"
                style={{
                  width: size * (0.7 + ring * 0.1),
                  height: size * (0.7 + ring * 0.1),
                  borderColor: `${colors.primary}${20 + ring * 10}`,
                  borderWidth: 1,
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                }}
                animate={{
                  scale: [1, 1.05, 1],
                  opacity: [0.2, 0.4, 0.2],
                }}
                transition={{
                  duration: 3 + ring,
                  repeat: Infinity,
                  delay: ring * 0.5,
                  ease: "easeInOut",
                }}
              />
            ))}
          </>
        )}

        {/* Inner glow pulse */}
        <motion.div
          className="absolute inset-[20%] rounded-full"
          style={{
            background: `radial-gradient(circle, ${colors.primary}20, transparent 70%)`,
          }}
          animate={
            shouldReduceMotion
              ? {}
              : {
                  opacity: isActive ? [0.3, 0.6, 0.3] : 0.2,
                  scale: voiceState === "speaking" ? [1, 1.1, 1] : 1,
                }
          }
          transition={{
            duration: voiceState === "speaking" ? 1.5 : 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </motion.button>

      {/* Corner brackets (scientific/HUD aesthetic) */}
      <div
        className="absolute -top-2 -left-2 w-6 h-6 border-t-2 border-l-2"
        style={{ borderColor: `${colors.primary}40` }}
      />
      <div
        className="absolute -top-2 -right-2 w-6 h-6 border-t-2 border-r-2"
        style={{ borderColor: `${colors.primary}40` }}
      />
      <div
        className="absolute -bottom-2 -left-2 w-6 h-6 border-b-2 border-l-2"
        style={{ borderColor: `${colors.primary}40` }}
      />
      <div
        className="absolute -bottom-2 -right-2 w-6 h-6 border-b-2 border-r-2"
        style={{ borderColor: `${colors.primary}40` }}
      />
    </div>
  );
}

