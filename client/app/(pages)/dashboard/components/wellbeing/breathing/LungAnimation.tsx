"use client";

import { motion, useAnimation } from "framer-motion";
import { useEffect } from "react";

export type BreathingPhase = "idle" | "inhale" | "hold" | "exhale";

interface LungAnimationProps {
  phase: BreathingPhase;
  size?: number;
  className?: string;
  progress?: number; // 0-100 for circular progress
}

export function LungAnimation({ phase, size = 240, className = "", progress = 0 }: LungAnimationProps) {
  const lungControls = useAnimation();
  const glowControls = useAnimation();

  useEffect(() => {
    const animatePhase = async () => {
      switch (phase) {
        case "inhale":
          await Promise.all([
            lungControls.start({
              scale: 1.15,
              filter: "brightness(1.2)",
              transition: { duration: 0.6, ease: "easeOut" },
            }),
            glowControls.start({
              scale: 1.4,
              opacity: 0.8,
              transition: { duration: 0.6, ease: "easeOut" },
            }),
          ]);
          break;
        case "hold":
          await Promise.all([
            lungControls.start({
              scale: [1.15, 1.12, 1.15],
              filter: ["brightness(1.2)", "brightness(1.3)", "brightness(1.2)"],
              transition: { duration: 2, repeat: Infinity, ease: "easeInOut" },
            }),
            glowControls.start({
              opacity: [0.8, 0.5, 0.8],
              scale: [1.4, 1.3, 1.4],
              transition: { duration: 2, repeat: Infinity, ease: "easeInOut" },
            }),
          ]);
          break;
        case "exhale":
          await Promise.all([
            lungControls.start({
              scale: 0.85,
              filter: "brightness(0.9)",
              transition: { duration: 0.8, ease: "easeIn" },
            }),
            glowControls.start({
              scale: 0.8,
              opacity: 0.3,
              transition: { duration: 0.8, ease: "easeIn" },
            }),
          ]);
          break;
        case "idle":
        default:
          await Promise.all([
            lungControls.start({
              scale: [1, 1.05, 1],
              filter: ["brightness(1)", "brightness(1.1)", "brightness(1)"],
              transition: { duration: 4, repeat: Infinity, ease: "easeInOut" },
            }),
            glowControls.start({
              opacity: [0.3, 0.5, 0.3],
              scale: [1, 1.1, 1],
              transition: { duration: 4, repeat: Infinity, ease: "easeInOut" },
            }),
          ]);
          break;
      }
    };

    animatePhase();
  }, [phase, lungControls, glowControls]);

  const phaseConfig = {
    idle: {
      primary: "#06b6d4",
      secondary: "#0891b2",
      glow: "#22d3ee",
      gradient: ["#06b6d4", "#0891b2"],
    },
    inhale: {
      primary: "#10b981",
      secondary: "#059669",
      glow: "#34d399",
      gradient: ["#10b981", "#059669"],
    },
    hold: {
      primary: "#f59e0b",
      secondary: "#d97706",
      glow: "#fbbf24",
      gradient: ["#f59e0b", "#d97706"],
    },
    exhale: {
      primary: "#8b5cf6",
      secondary: "#7c3aed",
      glow: "#a78bfa",
      gradient: ["#8b5cf6", "#7c3aed"],
    },
  };

  const colors = phaseConfig[phase];
  const circumference = 2 * Math.PI * 115;
  const strokeDashoffset = circumference * (1 - progress / 100);

  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      {/* Outer glow ring */}
      <motion.div
        animate={glowControls}
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, ${colors.glow}30 0%, transparent 70%)`,
          filter: "blur(20px)",
        }}
      />

      {/* Background rings */}
      <svg className="absolute inset-0" width={size} height={size} viewBox="0 0 240 240">
        {/* Outer decorative ring */}
        <circle
          cx="120"
          cy="120"
          r="118"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          className="text-slate-700/30"
        />

        {/* Progress track */}
        <circle
          cx="120"
          cy="120"
          r="115"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-slate-800/50"
        />

        {/* Progress indicator */}
        <motion.circle
          cx="120"
          cy="120"
          r="115"
          fill="none"
          stroke={`url(#progressGradient-${phase})`}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 120 120)"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.1 }}
        />

        {/* Inner glow circle */}
        <circle
          cx="120"
          cy="120"
          r="100"
          fill={`url(#innerGlow-${phase})`}
        />

        {/* Gradient definitions */}
        <defs>
          <linearGradient id={`progressGradient-${phase}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={colors.gradient[0]} />
            <stop offset="100%" stopColor={colors.gradient[1]} />
          </linearGradient>
          <radialGradient id={`innerGlow-${phase}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={colors.glow} stopOpacity="0.1" />
            <stop offset="100%" stopColor={colors.glow} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`lungGradient-${phase}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors.primary} stopOpacity="0.9" />
            <stop offset="100%" stopColor={colors.secondary} stopOpacity="0.7" />
          </linearGradient>
        </defs>
      </svg>

      {/* Lung SVG - Centered */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ pointerEvents: "none" }}
      >
        <motion.svg
          animate={lungControls}
          style={{
            width: size * 0.55,
            height: size * 0.55,
          }}
          viewBox="0 0 100 95"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Left Lung */}
          <motion.path
            d="M35 20 C20 25 15 40 15 55 C15 70 22 80 35 80 C42 80 48 75 48 65 L48 30 C48 23 42 18 35 20"
            fill={`url(#lungGradient-${phase})`}
            stroke={colors.primary}
            strokeWidth="1.5"
            opacity="0.9"
          />

          {/* Right Lung */}
          <motion.path
            d="M65 20 C80 25 85 40 85 55 C85 70 78 80 65 80 C58 80 52 75 52 65 L52 30 C52 23 58 18 65 20"
            fill={`url(#lungGradient-${phase})`}
            stroke={colors.primary}
            strokeWidth="1.5"
            opacity="0.9"
          />

          {/* Trachea */}
          <path
            d="M50 5 L50 25 M50 20 L45 30 M50 20 L55 30"
            fill="none"
            stroke={colors.secondary}
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.8"
          />

          {/* Bronchi details - left */}
          <g opacity="0.4" stroke={colors.secondary} strokeWidth="0.8" fill="none">
            <path d="M35 40 Q28 47 25 57" />
            <path d="M38 47 Q30 55 27 65" />
            <path d="M40 55 Q34 63 30 73" />
          </g>

          {/* Bronchi details - right */}
          <g opacity="0.4" stroke={colors.secondary} strokeWidth="0.8" fill="none">
            <path d="M65 40 Q72 47 75 57" />
            <path d="M62 47 Q70 55 73 65" />
            <path d="M60 55 Q66 63 70 73" />
          </g>
        </motion.svg>
      </div>

      {/* Animated particles for inhale */}
      {phase === "inhale" && (
        <div className="absolute inset-0 overflow-hidden rounded-full pointer-events-none">
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={`inhale-${i}`}
              className="absolute w-1.5 h-1.5 rounded-full"
              style={{
                background: `linear-gradient(135deg, ${colors.primary}, ${colors.glow})`,
                left: `${50 + Math.cos((i * Math.PI * 2) / 12) * 48}%`,
                top: `${50 + Math.sin((i * Math.PI * 2) / 12) * 48}%`,
                boxShadow: `0 0 6px ${colors.glow}`,
              }}
              animate={{
                left: "50%",
                top: "50%",
                opacity: [0, 1, 0],
                scale: [0.5, 1.2, 0.5],
              }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                delay: i * 0.12,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      )}

      {/* Animated particles for exhale */}
      {phase === "exhale" && (
        <div className="absolute inset-0 overflow-hidden rounded-full pointer-events-none">
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={`exhale-${i}`}
              className="absolute w-1.5 h-1.5 rounded-full"
              style={{
                background: `linear-gradient(135deg, ${colors.primary}, ${colors.glow})`,
                boxShadow: `0 0 6px ${colors.glow}`,
              }}
              initial={{ left: "50%", top: "50%", opacity: 1, scale: 1 }}
              animate={{
                left: `${50 + Math.cos((i * Math.PI * 2) / 12) * 50}%`,
                top: `${50 + Math.sin((i * Math.PI * 2) / 12) * 50}%`,
                opacity: [1, 0.6, 0],
                scale: [1, 0.8, 0.3],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                delay: i * 0.08,
                ease: "easeOut",
              }}
            />
          ))}
        </div>
      )}

      {/* Hold pulsing effect */}
      {phase === "hold" && (
        <motion.div
          className="absolute inset-0 rounded-full pointer-events-none"
          animate={{
            boxShadow: [
              `inset 0 0 30px ${colors.glow}30`,
              `inset 0 0 50px ${colors.glow}50`,
              `inset 0 0 30px ${colors.glow}30`,
            ],
          }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </div>
  );
}

export default LungAnimation;
