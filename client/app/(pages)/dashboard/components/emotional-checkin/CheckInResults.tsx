"use client";

import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Heart,
  Sparkles,
  Clock,
  Target,
  Lightbulb,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

interface Insight {
  category: string;
  description: string;
  severity: "mild" | "moderate" | "significant";
  trend?: "improving" | "stable" | "declining";
}

interface CheckInInsights {
  summary: string;
  details: Insight[];
  patterns?: Record<string, unknown>;
}

interface CheckInSession {
  id: string;
  userId: string;
  startedAt: string;
  completedAt?: string;
  questionCount: number;
  screeningType: string;
  overallAnxietyScore?: number;
  overallMoodScore?: number;
  riskLevel: string;
  crisisDetected: boolean;
  insights: CheckInInsights;
  recommendations: Array<{
    type: string;
    title: string;
    description: string;
    duration?: number;
  }>;
}

interface CheckInResultsProps {
  session: CheckInSession;
}

/* ── Circular Score Ring ── */
function ScoreRing({
  score,
  max = 10,
  label,
  color,
  delay = 0,
}: {
  score: number;
  max?: number;
  label: string;
  color: "pink" | "emerald" | "amber";
  delay?: number;
}) {
  const pct = Math.min((score / max) * 100, 100);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  const colorMap = {
    pink: {
      stroke: "#ec4899",
      glow: "drop-shadow(0 0 8px rgba(236,72,153,0.4))",
      text: "text-pink-400",
      bg: "bg-pink-500/10",
    },
    emerald: {
      stroke: "#10b981",
      glow: "drop-shadow(0 0 8px rgba(16,185,129,0.4))",
      text: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    amber: {
      stroke: "#f59e0b",
      glow: "drop-shadow(0 0 8px rgba(245,158,11,0.4))",
      text: "text-amber-400",
      bg: "bg-amber-500/10",
    },
  };

  const c = colorMap[color];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.4 }}
      className="flex flex-col items-center gap-3 rounded-xl border border-white/[0.06] bg-[#0f0f18] p-5"
    >
      <div className="relative h-24 w-24">
        <svg
          viewBox="0 0 100 100"
          className="h-full w-full -rotate-90"
          style={{ filter: c.glow }}
        >
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="6"
          />
          <motion.circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={c.stroke}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ delay: delay + 0.2, duration: 1, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-xl font-bold ${c.text}`}>
            {score.toFixed(1)}
          </span>
          <span className="text-[10px] text-slate-600">/ {max}</span>
        </div>
      </div>
      <span className="text-xs font-medium text-slate-400">{label}</span>
    </motion.div>
  );
}

/* ── Risk Level Badge ── */
function RiskBadge({ level }: { level: string }) {
  const config: Record<string, { icon: typeof ShieldCheck; color: string; bg: string; border: string }> = {
    low: { icon: ShieldCheck, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    moderate: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
    high: { icon: AlertTriangle, color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
  };
  const c = config[level.toLowerCase()] || config.low;
  const Icon = c.icon;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${c.color} ${c.bg} border ${c.border}`}>
      <Icon className="h-3 w-3" />
      {level.charAt(0).toUpperCase() + level.slice(1)} Risk
    </div>
  );
}

/* ── Severity Dot ── */
function SeverityDot({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    mild: "bg-emerald-400",
    moderate: "bg-amber-400",
    significant: "bg-rose-400",
  };
  return <div className={`h-1.5 w-1.5 rounded-full ${colors[severity] || "bg-slate-500"}`} />;
}

/* ── Recommendation Icon ── */
function RecIcon({ type }: { type: string }) {
  const t = type.toLowerCase();
  if (t.includes("exercise") || t.includes("activity")) return <Target className="h-4 w-4 text-blue-400" />;
  if (t.includes("breath") || t.includes("relax")) return <Heart className="h-4 w-4 text-pink-400" />;
  if (t.includes("journal") || t.includes("reflect")) return <Lightbulb className="h-4 w-4 text-amber-400" />;
  return <Sparkles className="h-4 w-4 text-violet-400" />;
}

/* ── Main Results ── */
export function CheckInResults({ session }: CheckInResultsProps) {
  const insights = session.insights?.details || [];
  const summary = session.insights?.summary || "Your check-in is complete.";

  const duration =
    session.startedAt && session.completedAt
      ? Math.round(
          (new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()) / 60000
        )
      : null;

  return (
    <div className="space-y-5">
      {/* ── Summary Header ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-white/[0.06] bg-[#0f0f18] p-5"
      >
        <div className="flex items-start gap-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pink-500/10">
            <CheckCircle2 className="h-4.5 w-4.5 text-pink-400" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-base font-bold text-white">Check-In Complete</h2>
              <RiskBadge level={session.riskLevel} />
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">{summary}</p>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-4 pt-3 border-t border-white/[0.04]">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Clock className="h-3 w-3" />
            {duration ? `${duration} min` : "Just now"}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Target className="h-3 w-3" />
            {session.questionCount} questions
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Sparkles className="h-3 w-3" />
            {session.screeningType}
          </div>
        </div>
      </motion.div>

      {/* ── Score Rings ── */}
      {(session.overallAnxietyScore !== undefined ||
        session.overallMoodScore !== undefined) && (
        <div className="grid grid-cols-2 gap-3">
          {session.overallMoodScore !== undefined && (
            <ScoreRing
              score={session.overallMoodScore}
              label="Mood Score"
              color="emerald"
              delay={0.1}
            />
          )}
          {session.overallAnxietyScore !== undefined && (
            <ScoreRing
              score={session.overallAnxietyScore}
              label="Anxiety Score"
              color="amber"
              delay={0.2}
            />
          )}
        </div>
      )}

      {/* ── Insights ── */}
      {insights.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-xl border border-white/[0.06] bg-[#0f0f18] p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-white">AI Insights</h3>
          </div>
          <div className="space-y-2.5">
            {insights.map((insight: Insight, index: number) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + index * 0.08 }}
                className="flex items-start gap-3 p-3.5 rounded-lg bg-white/[0.02] border border-white/[0.04]"
              >
                <div className="flex items-center gap-2 mt-0.5">
                  <SeverityDot severity={insight.severity} />
                  {insight.trend === "improving" && (
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                  )}
                  {insight.trend === "declining" && (
                    <TrendingDown className="h-3.5 w-3.5 text-amber-400" />
                  )}
                  {insight.trend === "stable" && (
                    <Minus className="h-3.5 w-3.5 text-slate-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-0.5">
                    {insight.category}
                  </span>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {insight.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Recommendations ── */}
      {session.recommendations && session.recommendations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="rounded-xl border border-white/[0.06] bg-[#0f0f18] p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">
              Suggestions for You
            </h3>
          </div>
          <div className="space-y-2.5">
            {session.recommendations.map((rec, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + index * 0.08 }}
                className="group flex items-start gap-3 p-3.5 rounded-lg bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08] transition-colors cursor-pointer"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] shrink-0">
                  <RecIcon type={rec.type} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-white mb-0.5 group-hover:text-pink-200 transition-colors">
                    {rec.title}
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                    {rec.description}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 mt-1">
                  {rec.duration && (
                    <span className="text-[10px] text-slate-600 font-medium">
                      {rec.duration}m
                    </span>
                  )}
                  <ArrowRight className="h-3.5 w-3.5 text-slate-600 group-hover:text-pink-400 transition-colors" />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
