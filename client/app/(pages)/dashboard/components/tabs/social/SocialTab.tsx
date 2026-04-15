"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import {
  Users,
  UserPlus,
  UserCheck,
  Clock,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Check,
  X,
  MessageSquare,
  Flame,
  Target,
  Loader2,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { staggerChildren, fadeInUp, pillarConfig, activityLevelColors } from "./constants";
import type { BuddySuggestion, Follow, SocialStats } from "./types";

/* ── Skeleton ── */
function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-white/[0.03] ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
    </div>
  );
}

/* ── Stat Card ── */
function StatCard({ icon: Icon, value, label, color, index }: {
  icon: typeof Users; value: number; label: string; color: string; index: number;
}) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="p-4 sm:p-5 rounded-2xl border border-white/[0.05] hover:border-white/[0.1] transition-colors"
      style={{ background: `linear-gradient(135deg, ${color}06, transparent 60%)` }}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center border border-white/[0.06] mb-3"
        style={{ background: `${color}12` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <p className="text-2xl font-bold text-white tabular-nums leading-none mb-1">{value}</p>
      <p className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider">{label}</p>
    </motion.div>
  );
}

/* ── Buddy Suggestion Card ── */
function BuddySuggestionCard({ suggestion, onFollow, onDismiss, index }: {
  suggestion: BuddySuggestion; onFollow: () => void; onDismiss: () => void; index: number;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [loading, setLoading] = useState(false);
  const pillar = suggestion.primaryPillar ? pillarConfig[suggestion.primaryPillar] : null;
  const PillarIcon = pillar?.icon;
  const actColor = activityLevelColors[suggestion.activityLevel] || "#a1a1aa";

  const handleFollow = async () => {
    setLoading(true);
    try { await onFollow(); } finally { setLoading(false); }
  };

  return (
    <motion.div
      layout
      initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.04, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative p-4 sm:p-5 rounded-2xl border border-white/[0.05] hover:border-white/[0.1]
        transition-all group bg-white/[0.02]"
    >
      {/* Dismiss */}
      <button onClick={onDismiss} aria-label="Dismiss suggestion"
        className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer opacity-0 group-hover:opacity-100">
        <X className="w-3.5 h-3.5 text-zinc-600" />
      </button>

      {/* Avatar + Info */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-white/[0.08]
          flex items-center justify-center text-lg font-bold text-white flex-shrink-0">
          {suggestion.avatar ? (
            <img src={suggestion.avatar} alt="" className="w-full h-full rounded-xl object-cover" />
          ) : (
            suggestion.firstName?.[0]?.toUpperCase() || "?"
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-white truncate">
            {suggestion.firstName} {suggestion.lastName || ""}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {PillarIcon && (
              <span className="flex items-center gap-1 text-[11px] font-medium" style={{ color: pillar.color }}>
                <PillarIcon className="w-3 h-3" /> {pillar.label}
              </span>
            )}
            <span className="text-[11px] font-medium" style={{ color: actColor }}>
              {suggestion.activityLevel}
            </span>
          </div>
        </div>
        {/* Match score ring */}
        <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 flex-shrink-0"
          style={{ borderColor: suggestion.matchScore >= 0.7 ? "#34d399" : suggestion.matchScore >= 0.5 ? "#fbbf24" : "#60a5fa" }}>
          <span className="text-[11px] font-bold text-white tabular-nums">
            {Math.round(suggestion.matchScore * 100)}%
          </span>
        </div>
      </div>

      {/* Match reason — the key feature */}
      <p className="text-[13px] text-indigo-300/80 italic mb-3 leading-relaxed">
        &ldquo;{suggestion.matchReason}&rdquo;
      </p>

      {/* Streak + Goal */}
      <div className="flex items-center gap-3 mb-4 text-[11px] text-zinc-500">
        {suggestion.currentStreak > 0 && (
          <span className="flex items-center gap-1">
            <Flame className="w-3 h-3 text-orange-400" /> {suggestion.currentStreak}-day streak
          </span>
        )}
        {suggestion.primaryGoal && (
          <span className="flex items-center gap-1 truncate">
            <Target className="w-3 h-3 text-cyan-400" /> {suggestion.primaryGoal}
          </span>
        )}
      </div>

      {/* CTAs */}
      <div className="flex gap-2">
        <button onClick={handleFollow} disabled={loading}
          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold
            bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25 border border-indigo-500/20
            disabled:opacity-50 transition-all cursor-pointer">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          Follow
        </button>
        <button className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-medium
          bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] border border-white/[0.06] transition-all cursor-pointer">
          <MessageSquare className="w-3.5 h-3.5" /> Challenge
        </button>
      </div>
    </motion.div>
  );
}

/* ── Follow Request Card ── */
function FollowRequestCard({ request, onAccept, onReject }: {
  request: Follow; onAccept: () => void; onReject: () => void;
}) {
  const [processing, setProcessing] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.1] transition-colors">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-white/[0.08]
        flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
        {request.requesterName?.[0]?.toUpperCase() || "?"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-white truncate">{request.requesterName || "User"}</p>
        {request.requesterMessage && (
          <p className="text-[11px] text-zinc-500 truncate">{request.requesterMessage}</p>
        )}
      </div>
      <div className="flex gap-1.5 flex-shrink-0">
        <button onClick={async () => { setProcessing('accept'); await onAccept(); setProcessing(null); }}
          disabled={!!processing}
          className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20 transition-all cursor-pointer disabled:opacity-50">
          {processing === 'accept' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        </button>
        <button onClick={async () => { setProcessing('reject'); await onReject(); setProcessing(null); }}
          disabled={!!processing}
          className="p-2 rounded-lg bg-white/[0.04] text-zinc-500 hover:bg-rose-500/15 hover:text-rose-400 border border-white/[0.06] transition-all cursor-pointer disabled:opacity-50">
          {processing === 'reject' ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

/* ── Main Social Tab ── */
export function SocialTab() {
  const [stats, setStats] = useState<SocialStats | null>(null);
  const [suggestions, setSuggestions] = useState<BuddySuggestion[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Follow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsResult, suggestionsResult, pendingResult] = await Promise.allSettled([
        api.get<{ stats: SocialStats }>("/follows/stats"),
        api.get<{ suggestions: BuddySuggestion[] }>("/follows/suggestions"),
        api.get<{ requests: Follow[] }>("/follows/pending"),
      ]);
      if (statsResult.status === "fulfilled" && statsResult.value.success && statsResult.value.data) setStats(statsResult.value.data.stats);
      if (suggestionsResult.status === "fulfilled" && suggestionsResult.value.success && suggestionsResult.value.data) setSuggestions(suggestionsResult.value.data.suggestions || []);
      if (pendingResult.status === "fulfilled" && pendingResult.value.success && pendingResult.value.data) setPendingRequests(pendingResult.value.data.requests || []);
      if (statsResult.status === "rejected" && suggestionsResult.status === "rejected" && pendingResult.status === "rejected") {
        throw statsResult.reason;
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load social data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFollow = async (userId: string) => {
    await api.post(`/follows/${userId}`, {});
    fetchData();
  };

  const handleAccept = async (followId: string) => {
    await api.post(`/follows/${followId}/accept`, {});
    fetchData();
  };

  const handleReject = async (followId: string) => {
    await api.post(`/follows/${followId}/reject`, {});
    fetchData();
  };

  const handleDismiss = async (userId: string) => {
    await api.post(`/follows/suggestions/${userId}/dismiss`, {});
    setSuggestions(prev => prev.filter(s => s.userId !== userId));
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-[100px]" />)}</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-[220px]" />)}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-xs">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/15 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-rose-400" />
          </div>
          <p className="text-zinc-300 font-medium mb-1">Something went wrong</p>
          <p className="text-sm text-zinc-500 mb-5">{error}</p>
          <button onClick={fetchData}
            className="px-5 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white rounded-xl transition-all cursor-pointer inline-flex items-center gap-2 text-sm font-medium">
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div variants={staggerChildren} initial="hidden" animate="visible" className="space-y-5 sm:space-y-6">
      {/* ─── Header ── */}
      <motion.div variants={fadeInUp} className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/15 flex items-center justify-center">
          <Users className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Social</h2>
          <p className="text-[12px] text-zinc-500">AI-matched buddies and accountability partners</p>
        </div>
      </motion.div>

      {/* ─── Stats ── */}
      {stats && (
        <motion.div variants={fadeInUp} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Users} value={stats.followersCount} label="Followers" color="#60a5fa" index={0} />
          <StatCard icon={UserPlus} value={stats.followingCount} label="Following" color="#a78bfa" index={1} />
          <StatCard icon={UserCheck} value={stats.mutualCount} label="Buddies" color="#34d399" index={2} />
          <StatCard icon={Clock} value={stats.pendingCount} label="Pending" color="#fbbf24" index={3} />
        </motion.div>
      )}

      {/* ─── Pending Requests ── */}
      {pendingRequests.length > 0 && (
        <motion.div variants={fadeInUp} className="rounded-2xl border border-amber-500/10 p-5"
          style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.04), rgba(245,158,11,0.02))" }}>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-[12px] font-semibold text-amber-300 uppercase tracking-wider">
              Pending Requests ({pendingRequests.length})
            </span>
          </div>
          <div className="space-y-2">
            {pendingRequests.map(req => (
              <FollowRequestCard key={req.id} request={req}
                onAccept={() => handleAccept(req.id)}
                onReject={() => handleReject(req.id)} />
            ))}
          </div>
        </motion.div>
      )}

      {/* ─── AI Buddy Suggestions ── */}
      {suggestions.length > 0 && (
        <motion.div variants={fadeInUp}>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="text-[12px] font-semibold text-indigo-300 uppercase tracking-wider">
              Suggested Buddies
            </span>
            <span className="text-[11px] text-zinc-600 ml-auto">AI-matched based on your goals</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <AnimatePresence mode="popLayout">
              {suggestions.map((s, i) => (
                <BuddySuggestionCard key={s.userId} suggestion={s} index={i}
                  onFollow={() => handleFollow(s.userId)}
                  onDismiss={() => handleDismiss(s.userId)} />
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* ─── Empty State ── */}
      {suggestions.length === 0 && pendingRequests.length === 0 && (
        <motion.div variants={fadeInUp} className="text-center py-20">
          <div className="w-20 h-20 rounded-3xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-5">
            <Users className="w-9 h-9 text-zinc-700" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-400 mb-1.5">No suggestions yet</h3>
          <p className="text-[13px] text-zinc-600 max-w-[280px] mx-auto">
            Set your goals and enable buddy discovery in settings to get AI-matched with accountability partners
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
