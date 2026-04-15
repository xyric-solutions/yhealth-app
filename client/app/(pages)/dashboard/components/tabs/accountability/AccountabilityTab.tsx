"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Plus,
  AlertCircle,
  RefreshCw,
  BarChart3,
  CheckCircle2,
  XCircle,
  Sparkles,
  Zap,
  FileText,
  TrendingUp,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { DashboardUnderlineTabs } from "../../DashboardUnderlineTabs";

import { ContractCard } from "./ContractCard";
import { CreateContractModal } from "./CreateContractModal";
import { statusConfig, staggerChildren, fadeInUp } from "./constants";
import type {
  Contract,
  ContractStats,
  ContractSuggestion,
  ContractsResponse,
  ContractStatus,
} from "./types";

/* ── Skeleton ── */
function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-white/[0.03] ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-[140px]" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-[100px]" />)}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-[200px]" />)}
      </div>
    </div>
  );
}

/* ── Stat Card ── */
function StatCard({
  icon: Icon,
  value,
  label,
  color,
  index,
}: {
  icon: typeof Shield;
  value: string | number;
  label: string;
  color: string;
  index: number;
}) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 + 0.1, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="p-4 sm:p-5 rounded-2xl border border-white/[0.05] hover:border-white/[0.1] transition-colors"
      style={{ background: `linear-gradient(135deg, ${color}06, transparent 60%)` }}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center border border-white/[0.06]"
          style={{ background: `${color}12` }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums leading-none mb-1">
        {value}
      </p>
      <p className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider">{label}</p>
    </motion.div>
  );
}

/* ── Main Tab ── */
export function AccountabilityTab() {
  const prefersReducedMotion = useReducedMotion();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [stats, setStats] = useState<ContractStats | null>(null);
  const [suggestions, setSuggestions] = useState<ContractSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (filter !== "all") params.status = filter;

      const [contractsResult, statsResult, suggestionsResult] = await Promise.allSettled([
        api.get<ContractsResponse>("/contracts", { params }),
        api.get<{ stats: ContractStats }>("/contracts/stats"),
        api.get<{ suggestions: ContractSuggestion[] }>("/contracts/suggestions"),
      ]);

      if (contractsResult.status === "fulfilled" && contractsResult.value.success && contractsResult.value.data) {
        setContracts(contractsResult.value.data.contracts || []);
      }
      if (statsResult.status === "fulfilled" && statsResult.value.success && statsResult.value.data) {
        setStats(statsResult.value.data.stats);
      }
      if (suggestionsResult.status === "fulfilled" && suggestionsResult.value.success && suggestionsResult.value.data) {
        setSuggestions(suggestionsResult.value.data.suggestions || []);
      }
      if (contractsResult.status === "rejected" && statsResult.status === "rejected") {
        throw contractsResult.reason;
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load contracts");
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading && contracts.length === 0) return <LoadingSkeleton />;

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-xs">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/15 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-rose-400" />
          </div>
          <p className="text-zinc-300 font-medium mb-1">Something went wrong</p>
          <p className="text-sm text-zinc-500 mb-5">{error}</p>
          <button
            onClick={fetchData}
            className="px-5 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08]
              text-white rounded-xl transition-all cursor-pointer inline-flex items-center gap-2 text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div variants={staggerChildren} initial="hidden" animate="visible" className="space-y-5 sm:space-y-6">
      {/* ─── Header + Create Button ── */}
      <motion.div variants={fadeInUp} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center">
            <Shield className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Accountability Contracts</h2>
            <p className="text-[12px] text-zinc-500">Self-imposed commitments with real consequences</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold
            bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20
            transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Contract</span>
        </button>
      </motion.div>

      {/* ─── Stats Row ── */}
      {stats && (
        <motion.div variants={fadeInUp} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Shield} value={stats.activeCount} label="Active" color="#34d399" index={0} />
          <StatCard icon={CheckCircle2} value={`${stats.overallSuccessRate}%`} label="Success Rate" color="#38bdf8" index={1} />
          <StatCard icon={XCircle} value={stats.totalViolations} label="Violations" color="#fb7185" index={2} />
          <StatCard icon={BarChart3} value={stats.completedCount} label="Completed" color="#a78bfa" index={3} />
        </motion.div>
      )}

      {/* ─── AI Suggestions ── */}
      {suggestions.length > 0 && (
        <motion.div
          variants={fadeInUp}
          className="rounded-2xl border border-indigo-500/10 p-5"
          style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.04), rgba(139,92,246,0.03))" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span className="text-[12px] font-semibold text-indigo-300 uppercase tracking-wider">
              AI Suggestions
            </span>
          </div>
          <div className="grid sm:grid-cols-2 gap-2.5">
            {suggestions.slice(0, 4).map((s, i) => (
              <motion.button
                key={s.id}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, duration: 0.35 }}
                className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]
                  hover:bg-white/[0.05] hover:border-indigo-500/20 transition-all cursor-pointer text-left group"
                onClick={() => {
                  // Pre-fill contract from suggestion
                  setShowCreate(true);
                }}
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <TrendingUp className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-white truncate">{s.title}</p>
                  <p className="text-[11px] text-zinc-500 line-clamp-2 mt-0.5">{s.reason}</p>
                </div>
                <Plus className="w-4 h-4 text-zinc-600 group-hover:text-indigo-400 transition-colors flex-shrink-0 mt-1" />
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* ─── Filters ── */}
      <motion.div variants={fadeInUp}>
        <DashboardUnderlineTabs
          layoutId="contractFilterUnderline"
          activeId={filter}
          onTabChange={setFilter}
          tabs={[
            { id: "all", label: "All" },
            { id: "active", label: "Active", icon: Shield },
            { id: "at_risk", label: "At Risk", icon: AlertCircle },
            { id: "violated", label: "Violated", icon: XCircle },
            { id: "draft", label: "Drafts", icon: FileText },
            { id: "completed", label: "Completed", icon: CheckCircle2 },
          ]}
        />
      </motion.div>

      {/* ─── Contract Cards Grid ── */}
      <motion.div variants={fadeInUp} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <AnimatePresence mode="popLayout">
          {contracts.map((contract, index) => (
            <ContractCard
              key={contract.id}
              contract={contract}
              index={index}
              onClick={setSelectedContract}
            />
          ))}
        </AnimatePresence>
      </motion.div>

      {/* ─── Empty State ── */}
      {contracts.length === 0 && !loading && (
        <motion.div variants={fadeInUp} className="text-center py-20">
          <div className="w-20 h-20 rounded-3xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-5">
            <Shield className="w-9 h-9 text-zinc-700" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-400 mb-1.5">No contracts yet</h3>
          <p className="text-[13px] text-zinc-600 max-w-[280px] mx-auto mb-6">
            Create your first accountability contract to boost your discipline
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold
              bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20
              transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create Contract
          </button>
        </motion.div>
      )}

      {/* ─── Create Modal ── */}
      <CreateContractModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={fetchData}
      />
    </motion.div>
  );
}
