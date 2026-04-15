"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Timer, ArrowRight, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import type { YogaPose, PoseDifficulty } from "@shared/types/domain/yoga";

interface PoseCardProps {
  pose: YogaPose;
  index?: number;
  isSelected?: boolean;
  onSelect?: (pose: YogaPose) => void;
}

const difficultyConfig: Record<
  PoseDifficulty,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    accent: string;
    glow: string;
  }
> = {
  beginner: {
    label: "Beginner",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    accent: "bg-emerald-400",
    glow: "shadow-emerald-500/15",
  },
  intermediate: {
    label: "Intermediate",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    accent: "bg-amber-400",
    glow: "shadow-amber-500/15",
  },
  advanced: {
    label: "Advanced",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    accent: "bg-red-400",
    glow: "shadow-red-500/15",
  },
};

const categoryIcons: Record<string, string> = {
  standing: "🧍",
  seated: "🧘",
  supine: "🛌",
  prone: "🤸",
  inversion: "🙃",
  balance: "⚖️",
  twist: "🔄",
  backbend: "🌊",
  forward_fold: "🙇",
  hip_opener: "🦋",
  restorative: "🌿",
};

const categoryLabel: Record<string, string> = {
  standing: "Standing",
  seated: "Seated",
  supine: "Supine",
  prone: "Prone",
  inversion: "Inversion",
  balance: "Balance",
  twist: "Twist",
  backbend: "Backbend",
  forward_fold: "Forward Fold",
  hip_opener: "Hip Opener",
  restorative: "Restorative",
};

const EASE_OUT_EXPO: [number, number, number, number] = [0.22, 1, 0.36, 1];

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.96 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: i * 0.05,
      duration: 0.5,
      ease: EASE_OUT_EXPO,
    },
  }),
};

export default function PoseCard({
  pose,
  index = 0,
  isSelected = false,
  onSelect,
}: PoseCardProps) {
  const diff = difficultyConfig[pose.difficulty];
  const cardRef = useRef<HTMLButtonElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: y * -6, y: x * 6 });
  };

  const handleMouseLeave = () => setTilt({ x: 0, y: 0 });

  return (
    <motion.button
      ref={cardRef}
      layout
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => onSelect?.(pose)}
      style={{
        transform: `perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transition: "transform 0.15s ease-out",
      }}
      className={cn(
        "group relative w-full text-left rounded-2xl overflow-hidden",
        "bg-linear-to-b from-white/4 to-transparent",
        "backdrop-blur-2xl",
        "border transition-all duration-300",
        isSelected
          ? cn(
              "border-emerald-500/40 shadow-lg shadow-emerald-500/10",
              "ring-1 ring-emerald-500/20"
            )
          : cn(
              "border-white/6",
              "hover:border-white/12",
              "hover:shadow-lg",
              `hover:${diff.glow}`
            ),
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-0"
      )}
      aria-label={`${pose.englishName} - ${diff.label} ${categoryLabel[pose.category] || pose.category} pose`}
      aria-pressed={isSelected}
    >
      {/* Hover gradient */}
      <div
        className={cn(
          "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none",
          "bg-linear-to-br from-white/3 via-transparent to-transparent"
        )}
      />

      {/* Shimmer sweep */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <motion.div
          animate={{ x: ["-100%", "200%"] }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatDelay: 4,
            ease: "easeInOut",
          }}
          className="absolute inset-y-0 w-1/4 -skew-x-12 bg-linear-to-r from-transparent via-white/3 to-transparent"
        />
      </div>

      {/* Difficulty accent bar */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl transition-all duration-300",
          diff.accent,
          isSelected ? "opacity-100" : "opacity-40 group-hover:opacity-100"
        )}
      />

      {/* Content */}
      <div className="p-4 pl-5">
        <div className="space-y-1.5 mb-3">
          <h3 className="font-bold text-[15px] text-white/95 truncate group-hover:text-white transition-colors">
            {pose.englishName}
          </h3>
          {pose.sanskritName && (
            <p className="text-[11px] text-zinc-500 italic tracking-wide font-light">
              {pose.sanskritName}
            </p>
          )}
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-lg",
              "bg-white/4 text-zinc-400 border border-white/6",
              "group-hover:bg-white/6 group-hover:text-zinc-300 transition-all duration-200"
            )}
          >
            <span className="text-xs leading-none">
              {categoryIcons[pose.category] || "🧘"}
            </span>
            {categoryLabel[pose.category] || pose.category}
          </span>

          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg",
              diff.bg,
              diff.color,
              diff.border,
              "border"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                diff.accent,
                "ring-2 ring-current/20"
              )}
            />
            {diff.label}
          </span>

          {pose.holdSecondsDefault > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500 font-medium">
              <Timer className="h-3 w-3" />
              {pose.holdSecondsDefault}s
            </span>
          )}
        </div>

        {/* View details hover reveal */}
        <div
          className={cn(
            "flex items-center gap-1.5 mt-3.5 text-[11px] font-semibold",
            "text-emerald-400 opacity-0 group-hover:opacity-100",
            "transform translate-y-1 group-hover:translate-y-0",
            "transition-all duration-200"
          )}
        >
          <Eye className="h-3 w-3" />
          View Details
          <ArrowRight className="h-3 w-3" />
        </div>
      </div>
    </motion.button>
  );
}

export { difficultyConfig, categoryIcons };
