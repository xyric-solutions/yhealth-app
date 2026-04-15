"use client";

import { useState, useCallback, useMemo, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flower2,
  Library,
  BarChart3,
  Sparkles,
  Loader2,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout";
import { DashboardUnderlineTabs } from "@/app/(pages)/dashboard/components/DashboardUnderlineTabs";
import { cn } from "@/lib/utils";
import { useYogaSession } from "@/hooks/use-yoga-session";
import type { YogaSession } from "@shared/types/domain/yoga";
import YogaHome from "./components/YogaHome";
import PoseLibrary from "./components/PoseLibrary";
import ProgressDashboard from "./components/ProgressDashboard";
import SessionPlayer from "./components/SessionPlayer";

const YogaAICoach = lazy(
  () => import("./components/ai-coach/YogaAICoach")
);

type YogaTab = "practice" | "poses" | "progress" | "ai-coach";

const tabs: {
  id: YogaTab;
  label: string;
  shortLabel: string;
  icon: typeof Flower2;
  accent: string;
}[] = [
  {
    id: "practice",
    label: "Practice",
    shortLabel: "Practice",
    icon: Flower2,
    accent: "emerald",
  },
  {
    id: "poses",
    label: "Pose Library",
    shortLabel: "Poses",
    icon: Library,
    accent: "sky",
  },
  {
    id: "ai-coach",
    label: "AI Coach",
    shortLabel: "AI",
    icon: Sparkles,
    accent: "amber",
  },
  {
    id: "progress",
    label: "Progress",
    shortLabel: "Stats",
    icon: BarChart3,
    accent: "cyan",
  },
];

/* ------------------------------------------------------------------ */
/*  Animated mesh gradient background                                  */
/* ------------------------------------------------------------------ */
function MeshBackground() {
  const orbs = useMemo(
    () => [
      {
        size: 500,
        x: "5%",
        y: "8%",
        color: "bg-emerald-500/[0.04]",
        duration: 25,
        delay: 0,
        blur: "blur-[120px]",
      },
      {
        size: 400,
        x: "70%",
        y: "5%",
        color: "bg-sky-500/[0.035]",
        duration: 30,
        delay: 3,
        blur: "blur-[100px]",
      },
      {
        size: 350,
        x: "50%",
        y: "55%",
        color: "bg-cyan-500/[0.03]",
        duration: 28,
        delay: 6,
        blur: "blur-[90px]",
      },
      {
        size: 250,
        x: "85%",
        y: "65%",
        color: "bg-emerald-400/[0.025]",
        duration: 22,
        delay: 9,
        blur: "blur-[80px]",
      },
    ],
    []
  );

  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Noise texture overlay */}
      <div className="absolute inset-0 opacity-[0.015] mix-blend-overlay bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIj48ZmlsdGVyIGlkPSJhIiB4PSIwIiB5PSIwIj48ZmVUdXJidWxlbmNlIGJhc2VGcmVxdWVuY3k9Ii43NSIgc3RpdGNoVGlsZXM9InN0aXRjaCIgdHlwZT0iZnJhY3RhbE5vaXNlIi8+PGZlQ29sb3JNYXRyaXggdHlwZT0ic2F0dXJhdGUiIHZhbHVlcz0iMCIvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbHRlcj0idXJsKCNhKSIgb3BhY2l0eT0iMSIvPjwvc3ZnPg==')]" />

      {/* Gradient orbs */}
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          className={cn("absolute rounded-full", orb.color, orb.blur)}
          style={{
            width: orb.size,
            height: orb.size,
            left: orb.x,
            top: orb.y,
          }}
          animate={{
            x: [0, 40, -30, 20, 0],
            y: [0, -35, 20, -15, 0],
            scale: [1, 1.1, 0.95, 1.05, 1],
          }}
          transition={{
            duration: orb.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: orb.delay,
          }}
        />
      ))}

      {/* Top edge gradient */}
      <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-emerald-950/20 via-transparent to-transparent" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page header with animated badge                                    */
/* ------------------------------------------------------------------ */
const headerWords = ["Yoga", "&", "Meditation"];

function PageHeader() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="relative"
    >
      {/* Animated badge */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-3.5 py-1.5"
      >
        <motion.div
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="h-1.5 w-1.5 rounded-full bg-emerald-400"
        />
        <span className="text-[11px] font-medium tracking-wide text-emerald-400/90">
          Mind & Body Wellness
        </span>
      </motion.div>

      {/* Title */}
      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
        {headerWords.map((word, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.5, delay: 0.2 + i * 0.1 }}
            className={cn(
              "inline-block mr-2 sm:mr-3",
              word === "&"
                ? "bg-gradient-to-r from-emerald-400 via-teal-400 to-sky-400 bg-clip-text text-transparent"
                : "text-white"
            )}
          >
            {word}
          </motion.span>
        ))}
      </h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.55 }}
        className="mt-3 text-sm sm:text-base text-zinc-400/80 max-w-lg"
      >
        Breathe, stretch, and find your inner balance with AI-powered guidance
      </motion.p>

      {/* Animated gradient line */}
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.7, ease: "easeOut" }}
        className="mt-5 h-px w-full max-w-sm origin-left"
      >
        <div className="h-full w-full bg-gradient-to-r from-emerald-500/50 via-sky-500/30 to-transparent" />
        <motion.div
          animate={{ x: ["-10%", "110%"] }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
            repeatDelay: 2,
          }}
          className="mt-[-1px] h-px w-12 bg-gradient-to-r from-transparent via-emerald-400/80 to-transparent"
        />
      </motion.div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Premium tab bar                                                    */
/* ------------------------------------------------------------------ */
function TabBar({
  activeTab,
  onChange,
}: {
  activeTab: YogaTab;
  onChange: (tab: YogaTab) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.6 }}
    >
      <DashboardUnderlineTabs
        layoutId="yogaSubTabUnderline"
        activeId={activeTab}
        onTabChange={(id) => onChange(id as YogaTab)}
        tabs={tabs.map((tab) => ({
          id: tab.id,
          label: tab.label,
          shortLabel: tab.shortLabel,
          icon: tab.icon,
          suffix:
            tab.id === "ai-coach" && activeTab !== "ai-coach" ? (
              <motion.span
                aria-hidden
                animate={{
                  scale: [1, 1.3, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 align-middle"
              />
            ) : undefined,
        }))}
      />
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Content transition                                                 */
/* ------------------------------------------------------------------ */
const contentVariants = {
  initial: { opacity: 0, y: 16, filter: "blur(6px)" },
  animate: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  },
  exit: {
    opacity: 0,
    y: -12,
    filter: "blur(6px)",
    transition: { duration: 0.25 },
  },
};

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
export default function YogaPageContent() {
  const [activeTab, setActiveTab] = useState<YogaTab>("practice");
  const yogaSession = useYogaSession();

  const handleStartSession = useCallback(
    (session: YogaSession) => {
      yogaSession.play(session);
    },
    [yogaSession]
  );

  const handleClosePlayer = useCallback(() => {
    yogaSession.reset();
  }, [yogaSession]);

  return (
    <DashboardLayout activeTab="yoga">
      <MeshBackground />

      <div className="relative z-10 flex flex-col gap-8 sm:gap-10 p-4 md:p-6 lg:p-8">
        <PageHeader />
        <TabBar activeTab={activeTab} onChange={setActiveTab} />

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={contentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {activeTab === "practice" && (
              <YogaHome onStartSession={handleStartSession} />
            )}
            {activeTab === "poses" && <PoseLibrary />}
            {activeTab === "ai-coach" && (
              <Suspense
                fallback={
                  <div className="flex flex-col items-center justify-center gap-4 py-24">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    >
                      <Loader2 className="h-7 w-7 text-emerald-400" />
                    </motion.div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-white/70">
                        Loading AI Coach
                      </p>
                      <p className="mt-1 text-xs text-white/40">
                        Initializing pose detection...
                      </p>
                    </div>
                  </div>
                }
              >
                <YogaAICoach />
              </Suspense>
            )}
            {activeTab === "progress" && <ProgressDashboard />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Session Player Overlay */}
      <AnimatePresence>
        {yogaSession.state !== "idle" && (
          <SessionPlayer
            yogaSession={yogaSession}
            onClose={handleClosePlayer}
          />
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
