"use client";

import { motion } from "framer-motion";
import { ModuleCard } from "./cards/ModuleCard";
import {
  Smile,
  Zap,
  BookOpen,
  Target,
  Activity,
  Calendar as CalendarIcon,
  Wind,
  Heart,
  Lightbulb,
  Eye,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface WellbeingModule {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  status: string; // "Logged 3h ago"
  trend: "up" | "down" | "stable";
  actionLabel: string;
  gradient?: string;
}

// Default modules configuration
export const WELLBEING_MODULES: WellbeingModule[] = [
  {
    id: "mood",
    title: "Mood",
    description: "Track your emotional state throughout the day",
    icon: Smile,
    href: "/wellbeing/mood",
    status: "Logged 3h ago",
    trend: "up",
    actionLabel: "Log now",
    gradient: "from-purple-500 via-pink-500 to-rose-500",
  },
  {
    id: "energy",
    title: "Energy",
    description: "Monitor your energy levels and patterns",
    icon: Zap,
    href: "/wellbeing/energy",
    status: "Logged 5h ago",
    trend: "stable",
    actionLabel: "Log now",
    gradient: "from-yellow-400 via-orange-500 to-red-500",
  },
  {
    id: "journal",
    title: "Journal",
    description: "Reflect with guided prompts and AI personalization",
    icon: BookOpen,
    href: "/wellbeing/journal",
    status: "Last entry yesterday",
    trend: "up",
    actionLabel: "Open",
    gradient: "from-blue-500 via-indigo-500 to-purple-500",
  },
  {
    id: "habits",
    title: "Habits",
    description: "Build and track your daily habits",
    icon: Target,
    href: "/wellbeing/habits",
    status: "4/5 completed today",
    trend: "up",
    actionLabel: "Open",
    gradient: "from-emerald-500 via-teal-500 to-cyan-500",
  },
  {
    id: "stress",
    title: "Stress",
    description: "Multi-signal stress detection and management",
    icon: Activity,
    href: "/wellbeing/stress",
    status: "Logged 2h ago",
    trend: "down",
    actionLabel: "Log now",
    gradient: "from-red-500 via-rose-500 to-pink-500",
  },
  {
    id: "schedule",
    title: "Schedule",
    description: "Plan your day with time-based activities and links",
    icon: CalendarIcon,
    href: "/wellbeing/schedule",
    status: "3 activities today",
    trend: "stable",
    actionLabel: "Open",
    gradient: "from-cyan-500 via-blue-500 to-indigo-500",
  },
  {
    id: "breathing",
    title: "Breathing",
    description: "Test lung capacity and practice breathing exercises",
    icon: Wind,
    href: "/wellbeing/breathing",
    status: "Last session 2 days ago",
    trend: "up",
    actionLabel: "Start",
    gradient: "from-cyan-400 via-teal-500 to-emerald-500",
  },
  {
    id: "emotional-checkin",
    title: "Emotional Check-In",
    description: "Brief screening conversation to notice patterns and get support",
    icon: Heart,
    href: "/wellbeing/emotional-checkin",
    status: "Available now",
    trend: "stable",
    actionLabel: "Start",
    gradient: "from-purple-500 via-pink-500 to-rose-500",
  },
  {
    id: "insights",
    title: "Insights",
    description: "Health correlations and recurring themes from your journals",
    icon: Lightbulb,
    href: "/wellbeing/insights",
    status: "Auto-updated",
    trend: "up",
    actionLabel: "View",
    gradient: "from-amber-500 via-orange-500 to-red-500",
  },
  {
    id: "vision",
    title: "Vision Health",
    description: "Color vision tests, eye exercises, and focus training",
    icon: Eye,
    href: "/wellbeing/vision",
    status: "Ready to test",
    trend: "stable",
    actionLabel: "Start",
    gradient: "from-sky-400 via-blue-500 to-indigo-500",
  },
];

interface WellbeingModulesGridProps {
  modules?: WellbeingModule[];
}

export function WellbeingModulesGrid({
  modules = WELLBEING_MODULES,
}: WellbeingModulesGridProps) {
  const _containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.03,
        delayChildren: 0.5,
      },
    },
  };

  const _itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: [0.4, 0, 0.2, 1],
      },
    },
  };

  return (
    <motion.div
      initial="visible"
      animate="visible"
      className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 w-full"
    >
      {modules.map((module, index) => (
        <motion.div
          key={module.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 + index * 0.03 }}
          className="h-full w-full"
        >
          <ModuleCard
            title={module.title}
            description={module.description}
            icon={module.icon}
            href={module.href}
            status={module.status}
            trend={module.trend}
            actionLabel={module.actionLabel}
            gradient={module.gradient}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}

