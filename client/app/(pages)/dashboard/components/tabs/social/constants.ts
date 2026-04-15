import { Users, UserPlus, UserCheck, Clock, Heart, Dumbbell, Brain, Flame } from "lucide-react";

export const statusColors: Record<string, { color: string; bg: string }> = {
  pending: { color: "text-amber-400", bg: "bg-amber-500/10" },
  accepted: { color: "text-emerald-400", bg: "bg-emerald-500/10" },
  rejected: { color: "text-zinc-500", bg: "bg-zinc-500/10" },
  blocked: { color: "text-rose-500", bg: "bg-rose-500/10" },
};

export const pillarConfig: Record<string, { icon: typeof Heart; color: string; label: string }> = {
  fitness: { icon: Dumbbell, color: "#f97316", label: "Fitness" },
  nutrition: { icon: Heart, color: "#10b981", label: "Nutrition" },
  wellbeing: { icon: Brain, color: "#3b82f6", label: "Wellbeing" },
};

export const activityLevelColors: Record<string, string> = {
  "Very Active": "#34d399",
  Active: "#60a5fa",
  "Getting Started": "#fbbf24",
  New: "#a1a1aa",
};

export const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

export const staggerChildren = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
};
