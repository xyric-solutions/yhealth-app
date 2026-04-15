"use client";

import { motion } from "framer-motion";

interface ScoreRingProps {
  score: number; // 0-100
  size?: number;
  strokeWidth?: number;
  className?: string;
}

function getScoreColour(score: number) {
  if (score >= 70) return { stroke: "#22c55e", glow: "rgba(34,197,94,0.4)" };
  if (score >= 40) return { stroke: "#f59e0b", glow: "rgba(245,158,11,0.4)" };
  return { stroke: "#ef4444", glow: "rgba(239,68,68,0.4)" };
}

export default function ScoreRing({
  score,
  size = 120,
  strokeWidth = 8,
  className = "",
}: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, score)) / 100;
  const { stroke, glow } = getScoreColour(score);

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        {/* Animated progress arc */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - progress) }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 6px ${glow})` }}
        />
      </svg>
      {/* Score label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          key={score}
          initial={{ scale: 1.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="text-2xl font-bold text-white"
        >
          {Math.round(score)}
        </motion.span>
        <span className="text-[10px] uppercase tracking-wider text-white/50">
          accuracy
        </span>
      </div>
    </div>
  );
}
