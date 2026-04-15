import {
  Flame,
  Target,
  Sparkles,
  Zap,
  Award,
  RotateCcw,
  TrendingUp,
} from "lucide-react";
import type { AchievementRarity } from "./types";

// ─── Rarity Visual System ────────────────────────────────────────────
// Premium holographic rarity hierarchy: Legendary > Epic > Rare > Common
// Each tier has distinct visual presence — legendary cards should feel like artifacts

export const rarityGradients: Record<AchievementRarity, string> = {
  common: "from-zinc-400 to-slate-500",
  rare: "from-sky-400 via-blue-500 to-cyan-400",
  epic: "from-violet-400 via-purple-500 to-fuchsia-500",
  legendary: "from-amber-300 via-orange-400 to-rose-500",
};

export const rarityBgColors: Record<AchievementRarity, string> = {
  common: "from-zinc-500/8 to-slate-600/8",
  rare: "from-sky-500/12 via-blue-500/10 to-cyan-500/8",
  epic: "from-violet-500/14 via-purple-500/12 to-fuchsia-500/10",
  legendary: "from-amber-500/16 via-orange-500/14 to-rose-500/10",
};

export const rarityBorderColors: Record<AchievementRarity, string> = {
  common: "border-zinc-500/15",
  rare: "border-sky-400/25",
  epic: "border-violet-400/35",
  legendary: "border-amber-400/45",
};

export const rarityGlowStyles: Record<AchievementRarity, string> = {
  common: "",
  rare: "shadow-[0_0_24px_-4px_rgba(56,189,248,0.18),0_0_8px_-2px_rgba(56,189,248,0.12)]",
  epic: "shadow-[0_0_32px_-4px_rgba(139,92,246,0.22),0_0_12px_-2px_rgba(168,85,247,0.16)]",
  legendary:
    "shadow-[0_0_48px_-4px_rgba(251,191,36,0.28),0_0_16px_-2px_rgba(245,158,11,0.2),0_4px_24px_-8px_rgba(244,63,94,0.12)]",
};

export const rarityTextColors: Record<AchievementRarity, string> = {
  common: "text-zinc-300",
  rare: "text-sky-200",
  epic: "text-violet-200",
  legendary: "text-amber-200",
};

export const rarityHexColors: Record<AchievementRarity, [string, string, string]> = {
  common: ["#a1a1aa", "#71717a", "#52525b"],
  rare: ["#38bdf8", "#3b82f6", "#22d3ee"],
  epic: ["#a78bfa", "#8b5cf6", "#d946ef"],
  legendary: ["#fbbf24", "#f97316", "#fb7185"],
};

// Holographic shimmer colors for legendary card borders
export const rarityShimmerColors: Record<AchievementRarity, string> = {
  common: "rgba(161,161,170,0.1)",
  rare: "rgba(56,189,248,0.15)",
  epic: "rgba(139,92,246,0.2)",
  legendary: "rgba(251,191,36,0.25)",
};

// ─── Category Visual System ──────────────────────────────────────────

export const categoryConfig: Record<
  string,
  { icon: typeof Flame; color: string; bg: string; accent: string }
> = {
  streak: {
    icon: Flame,
    color: "text-orange-400",
    bg: "bg-orange-500/15",
    accent: "#f97316",
  },
  milestone: {
    icon: Target,
    color: "text-cyan-400",
    bg: "bg-cyan-500/15",
    accent: "#06b6d4",
  },
  special: {
    icon: Sparkles,
    color: "text-pink-400",
    bg: "bg-pink-500/15",
    accent: "#ec4899",
  },
  challenge: {
    icon: Zap,
    color: "text-yellow-400",
    bg: "bg-yellow-500/15",
    accent: "#eab308",
  },
  pillar: {
    icon: Award,
    color: "text-emerald-400",
    bg: "bg-emerald-500/15",
    accent: "#10b981",
  },
  comeback: {
    icon: RotateCcw,
    color: "text-teal-400",
    bg: "bg-teal-500/15",
    accent: "#14b8a6",
  },
  "micro-win": {
    icon: TrendingUp,
    color: "text-indigo-400",
    bg: "bg-indigo-500/15",
    accent: "#6366f1",
  },
};

// ─── Level System ────────────────────────────────────────────────────

export const levelTiers = [
  {
    min: 0,
    max: 5,
    name: "Novice",
    gradient: "from-zinc-400 to-slate-500",
    hex: ["#a1a1aa", "#64748b"],
  },
  {
    min: 5,
    max: 10,
    name: "Explorer",
    gradient: "from-amber-400 to-orange-500",
    hex: ["#fbbf24", "#f97316"],
  },
  {
    min: 10,
    max: 20,
    name: "Achiever",
    gradient: "from-emerald-400 to-cyan-500",
    hex: ["#34d399", "#06b6d4"],
  },
  {
    min: 20,
    max: 50,
    name: "Champion",
    gradient: "from-violet-400 to-fuchsia-500",
    hex: ["#a78bfa", "#d946ef"],
  },
  {
    min: 50,
    max: Infinity,
    name: "Legend",
    gradient: "from-yellow-300 via-amber-400 to-orange-500",
    hex: ["#fde047", "#f59e0b"],
  },
] as const;

export function getLevelInfo(level: number) {
  return (
    levelTiers.find((l) => level >= l.min && level < l.max) ?? levelTiers[0]
  );
}

// ─── Animation Presets ───────────────────────────────────────────────
// Spring physics for natural, premium feel (Apple HIG fluid animations)

export const springTransition = {
  type: "spring" as const,
  stiffness: 380,
  damping: 28,
};

export const gentleSpring = {
  type: "spring" as const,
  stiffness: 260,
  damping: 24,
};

export const snappySpring = {
  type: "spring" as const,
  stiffness: 500,
  damping: 30,
};

export const staggerChildren = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
};

export const fadeInUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};
