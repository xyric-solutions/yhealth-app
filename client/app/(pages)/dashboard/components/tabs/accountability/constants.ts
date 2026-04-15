import {
  FileText,
  Shield,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Pause,
  Ban,
  Flame,
  Zap,
  Heart,
  Target,
  Moon,
  Settings,
  Coins,
  Users,
  Snowflake,
} from "lucide-react";
import type { ContractStatus } from "./types";

// ─── Status Visual System ────────────────────────────────────────────

export const statusConfig: Record<
  ContractStatus,
  {
    icon: typeof Shield;
    label: string;
    color: string;
    bg: string;
    border: string;
    glow: string;
    dot: string;
  }
> = {
  draft: {
    icon: FileText,
    label: "Draft",
    color: "text-zinc-400",
    bg: "bg-zinc-500/8",
    border: "border-dashed border-zinc-500/20",
    glow: "",
    dot: "#71717a",
  },
  active: {
    icon: Shield,
    label: "Active",
    color: "text-emerald-400",
    bg: "bg-emerald-500/8",
    border: "border-emerald-500/25",
    glow: "shadow-[0_0_20px_-4px_rgba(52,211,153,0.15)]",
    dot: "#34d399",
  },
  at_risk: {
    icon: AlertTriangle,
    label: "At Risk",
    color: "text-amber-400",
    bg: "bg-amber-500/8",
    border: "border-amber-500/25",
    glow: "shadow-[0_0_20px_-4px_rgba(251,191,36,0.18)]",
    dot: "#fbbf24",
  },
  violated: {
    icon: XCircle,
    label: "Violated",
    color: "text-rose-400",
    bg: "bg-rose-500/8",
    border: "border-rose-500/25",
    glow: "shadow-[0_0_20px_-4px_rgba(244,63,94,0.15)]",
    dot: "#fb7185",
  },
  completed: {
    icon: CheckCircle2,
    label: "Completed",
    color: "text-sky-400",
    bg: "bg-sky-500/8",
    border: "border-sky-500/20",
    glow: "",
    dot: "#38bdf8",
  },
  cancelled: {
    icon: Ban,
    label: "Cancelled",
    color: "text-zinc-500",
    bg: "bg-zinc-500/5",
    border: "border-zinc-500/10",
    glow: "",
    dot: "#52525b",
  },
  paused: {
    icon: Pause,
    label: "Paused",
    color: "text-indigo-400",
    bg: "bg-indigo-500/8",
    border: "border-indigo-500/20",
    glow: "",
    dot: "#818cf8",
  },
};

// ─── Condition Type Config ───────────────────────────────────────────

export const conditionConfig: Record<
  string,
  { icon: typeof Flame; label: string; color: string }
> = {
  missed_activity: {
    icon: Flame,
    label: "Missed Activity",
    color: "#f97316",
  },
  calorie_exceeded: {
    icon: Zap,
    label: "Calorie Exceeded",
    color: "#eab308",
  },
  streak_break: {
    icon: Heart,
    label: "Streak Break",
    color: "#ef4444",
  },
  missed_goal: {
    icon: Target,
    label: "Missed Goal",
    color: "#06b6d4",
  },
  sleep_deficit: {
    icon: Moon,
    label: "Sleep Deficit",
    color: "#8b5cf6",
  },
  custom: {
    icon: Settings,
    label: "Custom",
    color: "#64748b",
  },
};

// ─── Penalty Type Config ─────────────────────────────────────────────

export const penaltyConfig: Record<
  string,
  { icon: typeof Coins; label: string; color: string }
> = {
  donation: {
    icon: Coins,
    label: "Donation",
    color: "#f59e0b",
  },
  xp_loss: {
    icon: Zap,
    label: "XP Loss",
    color: "#a78bfa",
  },
  social_alert: {
    icon: Users,
    label: "Social Alert",
    color: "#06b6d4",
  },
  streak_freeze_loss: {
    icon: Snowflake,
    label: "Freeze Loss",
    color: "#38bdf8",
  },
  custom: {
    icon: Settings,
    label: "Custom",
    color: "#64748b",
  },
};

// ─── Animation Presets ───────────────────────────────────────────────

export const staggerChildren = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
};

export const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};
