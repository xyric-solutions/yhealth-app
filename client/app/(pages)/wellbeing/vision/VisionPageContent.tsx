"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, Dumbbell, BarChart3, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout";
import { cn } from "@/lib/utils";
import VisionHome from "./components/VisionHome";
import EyeExerciseMode from "./components/EyeExerciseMode";
import VisionProgress from "./components/VisionProgress";

// ─── Types ──────────────────────────────────────────────────────────

type VisionTab = "test" | "exercises" | "progress";

const tabs: {
  id: VisionTab;
  label: string;
  shortLabel: string;
  icon: typeof Eye;
  accent: string;
}[] = [
  { id: "test", label: "Vision Test", shortLabel: "Test", icon: Eye, accent: "emerald" },
  { id: "exercises", label: "Eye Exercises", shortLabel: "Exercises", icon: Dumbbell, accent: "sky" },
  { id: "progress", label: "Progress", shortLabel: "Stats", icon: BarChart3, accent: "emerald" },
];

// ─── Animated Background ────────────────────────────────────────────

function MeshBackground() {
  const orbs = useMemo(
    () => [
      { x: "15%", y: "20%", size: "45%", color: "bg-emerald-600", duration: 25, delay: 0 },
      { x: "70%", y: "60%", size: "40%", color: "bg-sky-600", duration: 30, delay: 2 },
      { x: "40%", y: "80%", size: "35%", color: "bg-emerald-600", duration: 20, delay: 4 },
    ],
    []
  );

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-950" />
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          className={cn("absolute rounded-full blur-[120px] opacity-[0.04]", orb.color)}
          style={{ left: orb.x, top: orb.y, width: orb.size, height: orb.size }}
          animate={{
            x: [0, 40, -30, 0],
            y: [0, -30, 20, 0],
            scale: [1, 1.15, 0.9, 1],
          }}
          transition={{
            duration: orb.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: orb.delay,
          }}
        />
      ))}
    </div>
  );
}

// ─── Tab Bar ────────────────────────────────────────────────────────

function TabBar({
  active,
  onChange,
}: {
  active: VisionTab;
  onChange: (tab: VisionTab) => void;
}) {
  const accentMap: Record<string, string> = {
    sky: "bg-sky-500/15 text-sky-400 border-sky-500/25 shadow-sky-500/10",
    emerald: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25 shadow-emerald-500/10",
    violet: "bg-violet-500/15 text-violet-400 border-violet-500/25 shadow-violet-500/10",
  };

  return (
    <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl w-fit mx-auto">
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300",
              isActive
                ? cn("border shadow-lg", accentMap[tab.accent])
                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Content Variants ───────────────────────────────────────────────

const contentVariants = {
  enter: { opacity: 0, y: 16 },
  center: { opacity: 1, y: 0, transition: { duration: 0.35 } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.2 } },
};

// ─── Main Component ─────────────────────────────────────────────────

export default function VisionPageContent() {
  const [activeTab, setActiveTab] = useState<VisionTab>("test");
  const router = useRouter();

  return (
    <DashboardLayout activeTab="vision">
      <MeshBackground />

      <div className="mx-auto max-w-8xl px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Back button */}
        <motion.button
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => router.push("/wellbeing")}
          className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Wellbeing
        </motion.button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-2"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <Eye className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Vision Health</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Vision Assessment</h1>
          <p className="text-sm text-zinc-500 max-w-md mx-auto">
            Test your color vision, train your eye muscles, and track your progress
          </p>
        </motion.div>

        {/* Tab Bar */}
        <TabBar active={activeTab} onChange={setActiveTab} />

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={contentVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {activeTab === "test" && <VisionHome />}
            {activeTab === "exercises" && <EyeExerciseMode />}
            {activeTab === "progress" && <VisionProgress />}
          </motion.div>
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
