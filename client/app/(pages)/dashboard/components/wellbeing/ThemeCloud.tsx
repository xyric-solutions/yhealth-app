"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Hash,
  Briefcase,
  Heart,
  Stethoscope,
  DollarSign,
  Sparkles,
  Users,
  Home,
  Moon,
  Dumbbell,
  AlertTriangle,
  HelpCircle,
  Gauge,
  Flower2,
  Palette,
} from "lucide-react";
import {
  insightsService,
  type ThemeInsightData,
} from "@/src/shared/services/wellbeing.service";

/* ── Theme config: color + icon ── */
const THEME_CFG: Record<
  string,
  { color: string; bg: string; border: string; barBg: string; icon: typeof Hash }
> = {
  work_stress: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/15", barBg: "bg-red-400", icon: Briefcase },
  relationship_conflict: { color: "text-pink-400", bg: "bg-pink-500/10", border: "border-pink-500/15", barBg: "bg-pink-400", icon: Heart },
  health_concern: { color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/15", barBg: "bg-orange-400", icon: Stethoscope },
  financial_worry: { color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/15", barBg: "bg-yellow-400", icon: DollarSign },
  gratitude: { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/15", barBg: "bg-emerald-400", icon: Sparkles },
  personal_growth: { color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/15", barBg: "bg-purple-400", icon: TrendingUp },
  social_connection: { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/15", barBg: "bg-blue-400", icon: Users },
  family: { color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/15", barBg: "bg-rose-400", icon: Home },
  sleep_issues: { color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/15", barBg: "bg-indigo-400", icon: Moon },
  exercise_motivation: { color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/15", barBg: "bg-green-400", icon: Dumbbell },
  anxiety: { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/15", barBg: "bg-amber-400", icon: AlertTriangle },
  self_doubt: { color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/15", barBg: "bg-slate-400", icon: HelpCircle },
  productivity: { color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/15", barBg: "bg-cyan-400", icon: Gauge },
  spiritual: { color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/15", barBg: "bg-violet-400", icon: Flower2 },
  creative_expression: { color: "text-fuchsia-400", bg: "bg-fuchsia-500/10", border: "border-fuchsia-500/15", barBg: "bg-fuchsia-400", icon: Palette },
};

const DEFAULT_CFG = {
  color: "text-slate-400",
  bg: "bg-slate-500/10",
  border: "border-slate-500/15",
  barBg: "bg-slate-400",
  icon: Hash,
};

function TrendBadge({ trend }: { trend: string }) {
  if (trend === "increasing")
    return <TrendingUp className="h-2.5 w-2.5 text-emerald-400" />;
  if (trend === "decreasing")
    return <TrendingDown className="h-2.5 w-2.5 text-rose-400" />;
  return <Minus className="h-2.5 w-2.5 text-slate-600" />;
}

export function ThemeCloud() {
  const [themes, setThemes] = useState<ThemeInsightData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    insightsService
      .getThemes()
      .then((res) => {
        if (res.success && res.data?.themes) {
          setThemes(res.data.themes);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-8 rounded-lg bg-white/[0.03] border border-white/[0.04] animate-pulse"
            style={{ width: `${50 + i * 18}px` }}
          />
        ))}
      </div>
    );
  }

  if (themes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 mb-3">
          <Hash className="h-5 w-5 text-purple-400/50" />
        </div>
        <p className="text-sm font-medium text-slate-400 mb-1">
          No themes detected yet
        </p>
        <p className="text-xs text-slate-500 max-w-[260px] leading-relaxed">
          Start journaling and logging your mood to discover recurring themes
          in your wellbeing.
        </p>
      </div>
    );
  }

  const maxFreq = Math.max(...themes.map((t) => t.frequency));

  return (
    <div className="space-y-5">
      {/* Tag cloud */}
      <div className="flex flex-wrap gap-2">
        {themes.map((theme, idx) => {
          const cfg = THEME_CFG[theme.theme] || DEFAULT_CFG;
          const Icon = cfg.icon;
          const sizeScale = 0.8 + (theme.frequency / maxFreq) * 0.4;

          return (
            <motion.div
              key={theme.theme}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.04 }}
              whileHover={{ scale: 1.05, y: -2 }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${cfg.border} ${cfg.bg} cursor-default transition-colors hover:bg-white/[0.06]`}
              style={{ fontSize: `${sizeScale * 0.75}rem` }}
              title={`${theme.frequency} entries (${theme.percentage}%) — ${theme.trend}`}
            >
              <Icon className={`h-3 w-3 ${cfg.color}`} />
              <span className={`font-semibold capitalize ${cfg.color}`}>
                {theme.theme.replace(/_/g, " ")}
              </span>
              <span className="text-[10px] text-slate-500 font-medium tabular-nums">
                {theme.percentage}%
              </span>
              <TrendBadge trend={theme.trend} />
            </motion.div>
          );
        })}
      </div>

      {/* Frequency bars */}
      <div className="space-y-2">
        {themes.slice(0, 5).map((theme, idx) => {
          const cfg = THEME_CFG[theme.theme] || DEFAULT_CFG;
          const barPct = Math.min((theme.frequency / maxFreq) * 100, 100);

          return (
            <motion.div
              key={theme.theme}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + idx * 0.05 }}
              className="flex items-center gap-3"
            >
              <span className="text-xs text-slate-400 capitalize w-28 truncate">
                {theme.theme.replace(/_/g, " ")}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${barPct}%` }}
                  transition={{ duration: 0.5, delay: 0.3 + idx * 0.05 }}
                  className={`h-full rounded-full ${cfg.barBg} opacity-60`}
                />
              </div>
              <span className="text-[10px] text-slate-500 tabular-nums w-8 text-right">
                {theme.frequency}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Co-occurrences */}
      {themes.some((t) => t.coOccurrences && t.coOccurrences.length > 0) && (
        <div className="pt-3 border-t border-white/[0.04]">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Frequently together
          </p>
          <div className="flex flex-wrap gap-1.5">
            {themes
              .filter((t) => t.coOccurrences && t.coOccurrences.length > 0)
              .slice(0, 3)
              .map((t) => (
                <span
                  key={t.theme}
                  className="text-[10px] text-slate-400 bg-white/[0.03] border border-white/[0.06] px-2 py-0.5 rounded-md"
                >
                  {t.theme.replace(/_/g, " ")} +{" "}
                  {t.coOccurrences![0].replace(/_/g, " ")}
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
