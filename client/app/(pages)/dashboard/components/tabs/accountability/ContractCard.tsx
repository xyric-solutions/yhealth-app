"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Calendar, ChevronRight, TriangleAlert } from "lucide-react";
import type { Contract } from "./types";
import { statusConfig, conditionConfig, penaltyConfig } from "./constants";

interface ContractCardProps {
  contract: Contract;
  index: number;
  onClick: (contract: Contract) => void;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function daysRemaining(endDate: string): number {
  return Math.max(
    0,
    Math.ceil(
      (new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
  );
}

export function ContractCard({ contract, index, onClick }: ContractCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const sc = statusConfig[contract.status];
  const StatusIcon = sc.icon;
  const cc = conditionConfig[contract.conditionType] || conditionConfig.custom;
  const CondIcon = cc.icon;
  const pc = penaltyConfig[contract.penaltyType] || penaltyConfig.custom;
  const PenaltyIcon = pc.icon;

  const successRate =
    contract.totalChecks > 0
      ? Math.round((contract.successCount / contract.totalChecks) * 100)
      : null;
  const days = daysRemaining(contract.endDate);
  const isActive = contract.status === "active" || contract.status === "at_risk";

  return (
    <motion.div
      layout
      initial={
        prefersReducedMotion ? false : { opacity: 0, y: 14, scale: 0.98 }
      }
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{
        delay: index * 0.04,
        duration: 0.45,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={
        prefersReducedMotion ? undefined : { y: -3, transition: { duration: 0.2 } }
      }
      whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
      onClick={() => onClick(contract)}
      role="button"
      tabIndex={0}
      aria-label={`${contract.title} — ${sc.label} contract`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(contract);
        }
      }}
      className={`
        relative rounded-2xl overflow-hidden cursor-pointer group
        border ${sc.border} ${sc.glow}
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080C10]
        transition-colors duration-200
      `}
    >
      <div
        className="relative p-5 sm:p-6 h-full"
        style={{
          background: `linear-gradient(135deg, ${sc.dot}08, transparent 60%)`,
        }}
      >
        {/* ── Hover glow orb ── */}
        <div
          className="absolute -top-10 -right-10 w-28 h-28 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${sc.dot}12, transparent 70%)`,
          }}
        />

        {/* ── Top row: Status badge + days remaining ── */}
        <div className="flex items-center justify-between mb-4">
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wider ${sc.bg} ${sc.color}`}
          >
            <StatusIcon className="w-3.5 h-3.5" />
            {sc.label}
          </div>

          {isActive && (
            <div className="flex items-center gap-1 text-[11px] text-zinc-500">
              <Calendar className="w-3 h-3" />
              <span className="tabular-nums">{days}d left</span>
            </div>
          )}

          {contract.status === "at_risk" && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-[11px] font-medium">
              <TriangleAlert className="w-3 h-3" />
              At Risk
            </div>
          )}
        </div>

        {/* ── Title ── */}
        <h3 className="font-semibold text-[15px] text-white leading-snug mb-1 group-hover:text-white/90 transition-colors">
          {contract.title}
        </h3>
        {contract.description && (
          <p className="text-[13px] text-zinc-500 line-clamp-2 leading-relaxed mb-4">
            {contract.description}
          </p>
        )}

        {/* ── Condition + Penalty row ── */}
        <div className="flex items-center gap-2 mb-4">
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium border border-white/[0.05]"
            style={{ color: cc.color, background: `${cc.color}10` }}
          >
            <CondIcon className="w-3 h-3" />
            {cc.label}
          </div>
          <span className="text-zinc-700">→</span>
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium border border-white/[0.05]"
            style={{ color: pc.color, background: `${pc.color}10` }}
          >
            <PenaltyIcon className="w-3 h-3" />
            {contract.penaltyAmount
              ? `${contract.penaltyAmount} ${contract.penaltyCurrency}`
              : pc.label}
          </div>
        </div>

        {/* ── Progress / Stats bar ── */}
        {contract.totalChecks > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                Success Rate
              </span>
              <span
                className="text-[11px] font-semibold tabular-nums"
                style={{ color: sc.dot }}
              >
                {successRate}%
              </span>
            </div>
            <div className="relative h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
              <motion.div
                initial={
                  prefersReducedMotion
                    ? { width: `${successRate}%` }
                    : { width: 0 }
                }
                animate={{ width: `${successRate}%` }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: index * 0.04 + 0.2 }
                }
                className="h-full rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${sc.dot}, ${sc.dot}88)`,
                }}
              />
            </div>
          </div>
        )}

        {/* ── Footer: dates + violations + arrow ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-[11px] text-zinc-600">
            <span className="tabular-nums">
              {formatDate(contract.startDate)} – {formatDate(contract.endDate)}
            </span>
            {contract.violationCount > 0 && (
              <span className="flex items-center gap-1 text-rose-400/80">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                {contract.violationCount} violation
                {contract.violationCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
        </div>
      </div>
    </motion.div>
  );
}
