"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import {
  Flame,
  Target,
  Sparkles,
  Zap,
  Award,
  Filter,
  Gift,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  RotateCcw,
  TrendingUp,
} from "lucide-react";
import { api } from "@/lib/api-client";
import { DashboardUnderlineTabs } from "../DashboardUnderlineTabs";

import { AchievementCard } from "./achievements/AchievementCard";
import { AchievementHeroSection } from "./achievements/AchievementHeroSection";
import { AchievementStatsBar } from "./achievements/AchievementStatsBar";
import { AchievementDetailDrawer } from "./achievements/AchievementDetailDrawer";
import { AchievementUnlockCelebration } from "./achievements/AchievementUnlockCelebration";
import { AchievementProgressRing } from "./achievements/AchievementProgressRing";
import { AchievementToast } from "./achievements/AchievementToast";

import type {
  Achievement,
  AchievementSummary,
  AchievementsData,
  AchievementFilter,
  AchievementCategory,
} from "./achievements/types";
import {
  rarityGradients,
  rarityHexColors,
  categoryConfig,
  staggerChildren,
  fadeInUp,
} from "./achievements/constants";

/* ── Skeleton shimmer block ── */
function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-white/[0.03] ${className}`}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Hero skeleton */}
      <Skeleton className="h-[200px] sm:h-[180px]" />
      {/* Stats skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-[110px]" />
        ))}
      </div>
      {/* Cards skeleton */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-[220px]" />
        ))}
      </div>
    </div>
  );
}

export function AchievementsTab() {
  const prefersReducedMotion = useReducedMotion();
  const [filter, setFilter] = useState<AchievementFilter>("all");
  const [categoryFilter, setCategoryFilter] =
    useState<AchievementCategory>("all");
  const [summary, setSummary] = useState<AchievementSummary | null>(null);
  const [achievementsData, setAchievementsData] =
    useState<AchievementsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAchievement, setSelectedAchievement] =
    useState<Achievement | null>(null);
  const [celebrationAchievement, setCelebrationAchievement] =
    useState<Achievement | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryResult, achievementsResult] = await Promise.allSettled([
        api.get<AchievementSummary>("/achievements/summary"),
        api.get<AchievementsData>("/achievements", {
          params: {
            category: categoryFilter !== "all" ? categoryFilter : undefined,
            status: filter !== "all" ? filter : undefined,
          },
        }),
      ]);
      if (summaryResult.status === "fulfilled" && summaryResult.value.success && summaryResult.value.data) {
        setSummary(summaryResult.value.data);
        const recentUnlocks = summaryResult.value.data.recentUnlocks;
        if (recentUnlocks && recentUnlocks.length > 0) {
          setCelebrationAchievement(recentUnlocks[0]);
        }
      }
      if (achievementsResult.status === "fulfilled" && achievementsResult.value.success && achievementsResult.value.data) {
        setAchievementsData(achievementsResult.value.data);
      }
      // If both failed, show error
      if (summaryResult.status === "rejected" && achievementsResult.status === "rejected") {
        throw summaryResult.reason;
      }
    } catch (err) {
      console.error("Error fetching achievements:", err);
      setError("Failed to load achievements. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, filter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Skeleton loading ── */
  if (loading && !achievementsData) {
    return <LoadingSkeleton />;
  }

  /* ── Error state ── */
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-xs">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/15 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-red-400" />
          </div>
          <p className="text-zinc-300 mb-1 font-medium">Something went wrong</p>
          <p className="text-sm text-zinc-500 mb-5">{error}</p>
          <button
            onClick={fetchData}
            className="px-5 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08]
              text-white rounded-xl transition-all cursor-pointer inline-flex items-center gap-2 text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const achievements = achievementsData?.achievements || [];
  const stats = achievementsData?.summary;

  return (
    <motion.div
      variants={staggerChildren}
      initial="hidden"
      animate="visible"
      className="space-y-5 sm:space-y-6"
    >
      {/* ─── Hero Section ── */}
      {summary && (
        <AchievementHeroSection
          summary={summary}
          onAchievementClick={setSelectedAchievement}
        />
      )}

      {/* ─── Stats Bar ── */}
      {stats && (
        <AchievementStatsBar
          unlockedCount={stats.unlockedCount}
          totalAchievements={stats.totalAchievements}
          unlockedPercentage={stats.unlockedPercentage}
          totalXP={stats.totalXP}
          legendaryCount={stats.rarityBreakdown?.legendary || 0}
          epicCount={stats.rarityBreakdown?.epic || 0}
        />
      )}

      {/* ─── Nearly Unlocked ── */}
      {summary && summary.nearlyUnlocked.length > 0 && (
        <motion.div
          variants={fadeInUp}
          className="rounded-2xl border border-cyan-500/10 p-5 sm:p-6"
          style={{
            background:
              "linear-gradient(135deg, rgba(6,182,212,0.05), rgba(59,130,246,0.03))",
          }}
        >
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center">
              <Gift className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-[15px]">
                Almost There
              </h3>
              <p className="text-[11px] text-zinc-500">
                Keep going to unlock these
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {summary.nearlyUnlocked.map((achievement, i) => {
              const [nc1] = rarityHexColors[achievement.rarity];
              return (
                <motion.button
                  key={achievement.id}
                  initial={
                    prefersReducedMotion ? false : { opacity: 0, x: -12 }
                  }
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    delay: i * 0.06,
                    duration: 0.4,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05]
                    hover:bg-white/[0.06] hover:border-white/[0.1] transition-all cursor-pointer group text-left"
                  onClick={() => setSelectedAchievement(achievement)}
                >
                  <AchievementProgressRing
                    percentage={achievement.progressPercentage}
                    rarity={achievement.rarity}
                    size={44}
                    strokeWidth={3}
                  >
                    <span className="text-base">{achievement.icon}</span>
                  </AchievementProgressRing>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-white truncate">
                      {achievement.title}
                    </p>
                    <p
                      className="text-[11px] mt-0.5 font-medium tabular-nums"
                      style={{ color: `${nc1}88` }}
                    >
                      {achievement.progressPercentage}%
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors flex-shrink-0" />
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ─── Filter Tabs ── */}
      <motion.div variants={fadeInUp} className="flex flex-col gap-3">
        <DashboardUnderlineTabs
          layoutId="achievementsFilterUnderline"
          activeId={filter}
          onTabChange={(id) => setFilter(id as AchievementFilter)}
          tabs={[
            { id: "all", label: "All" },
            { id: "unlocked", label: "Unlocked" },
            { id: "locked", label: "Locked" },
          ]}
        />
        <div className="flex gap-2 items-stretch min-w-0">
          <div
            className="hidden sm:flex items-center shrink-0 text-zinc-600 pt-1 pr-1"
            aria-hidden
          >
            <Filter className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <DashboardUnderlineTabs
              layoutId="achievementsCategoryUnderline"
              activeId={categoryFilter}
              onTabChange={(id) =>
                setCategoryFilter(id as AchievementCategory)
              }
              tabs={[
                { id: "all", label: "All" },
                { id: "streak", label: "Streak", icon: Flame },
                { id: "milestone", label: "Milestone", icon: Target },
                { id: "pillar", label: "Pillar", icon: Award },
                { id: "special", label: "Special", icon: Sparkles },
                { id: "challenge", label: "Challenge", icon: Zap },
                { id: "comeback", label: "Comeback", icon: RotateCcw },
                { id: "micro-win", label: "Micro-Win", icon: TrendingUp },
              ]}
            />
          </div>
        </div>
      </motion.div>

      {/* ─── Category Progress ── */}
      {stats?.categoryBreakdown && (
        <motion.div
          variants={fadeInUp}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5"
        >
          {Object.entries(stats.categoryBreakdown).map(([category, data]) => {
            const config = categoryConfig[category];
            const CatIcon = config?.icon;
            const pct =
              data.total > 0
                ? Math.round((data.unlocked / data.total) * 100)
                : 0;
            const isActive = categoryFilter === category;

            return (
              <button
                key={category}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer
                  ${
                    isActive
                      ? "border-amber-500/30 bg-amber-500/[0.06]"
                      : "border-white/[0.05] bg-white/[0.02] hover:border-white/[0.1] hover:bg-white/[0.04]"
                  }`}
                onClick={() =>
                  setCategoryFilter(
                    category === categoryFilter
                      ? "all"
                      : (category as AchievementCategory)
                  )
                }
              >
                {CatIcon && (
                  <div
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md ${config.bg} ${config.color} mb-2`}
                  >
                    <CatIcon className="w-3 h-3" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider capitalize">
                      {category}
                    </span>
                  </div>
                )}
                <div className="flex items-end justify-between">
                  <p className="text-lg font-bold text-white tabular-nums">
                    {data.unlocked}
                    <span className="text-zinc-600 font-normal text-sm">
                      /{data.total}
                    </span>
                  </p>
                  <p className="text-[11px] text-zinc-500 tabular-nums font-medium">
                    {pct}%
                  </p>
                </div>
                <div className="h-1 rounded-full bg-white/[0.04] mt-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${pct}%`,
                      background: config?.accent
                        ? `linear-gradient(90deg, ${config.accent}, ${config.accent}88)`
                        : "linear-gradient(90deg, #f59e0b, #f97316)",
                    }}
                  />
                </div>
              </button>
            );
          })}
        </motion.div>
      )}

      {/* ─── Achievement Cards Grid ── */}
      <motion.div
        variants={fadeInUp}
        className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
      >
        <AnimatePresence mode="popLayout">
          {achievements.map((achievement, index) => (
            <AchievementCard
              key={achievement.id}
              achievement={achievement}
              index={index}
              onClick={setSelectedAchievement}
            />
          ))}
        </AnimatePresence>
      </motion.div>

      {/* ─── Empty State ── */}
      {achievements.length === 0 && (
        <motion.div variants={fadeInUp} className="text-center py-20">
          <div className="w-20 h-20 rounded-3xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-5">
            <Award className="w-9 h-9 text-zinc-700" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-400 mb-1.5">
            No achievements found
          </h3>
          <p className="text-[13px] text-zinc-600 max-w-[240px] mx-auto">
            Try adjusting your filters to see more achievements
          </p>
        </motion.div>
      )}

      {/* ─── Rarity Legend ── */}
      <motion.div
        variants={fadeInUp}
        className="flex flex-wrap items-center justify-center gap-5 py-4"
      >
        {(["common", "rare", "epic", "legendary"] as const).map((rarity) => {
          const [rc1] = rarityHexColors[rarity];
          return (
            <div key={rarity} className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  background: `linear-gradient(135deg, ${rc1}, ${rc1}88)`,
                  boxShadow: `0 0 6px ${rc1}30`,
                }}
              />
              <span className="text-[11px] text-zinc-400 capitalize font-medium">
                {rarity}
              </span>
              <span className="text-[11px] text-zinc-600 tabular-nums">
                {stats?.rarityBreakdown?.[rarity] || 0}
              </span>
            </div>
          );
        })}
      </motion.div>

      {/* ─── Overlays ── */}
      <AchievementDetailDrawer
        achievement={selectedAchievement}
        onClose={() => setSelectedAchievement(null)}
      />
      <AchievementUnlockCelebration
        achievement={celebrationAchievement}
        onDismiss={() => setCelebrationAchievement(null)}
      />
      <AchievementToast onAchievementClick={setSelectedAchievement} />

      {/* Global animations — respects reduced-motion */}
      <style jsx global>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s ease-in-out infinite;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-shimmer { animation: none; }
          [style*="spin-slow"] { animation: none !important; }
        }
      `}</style>
    </motion.div>
  );
}
