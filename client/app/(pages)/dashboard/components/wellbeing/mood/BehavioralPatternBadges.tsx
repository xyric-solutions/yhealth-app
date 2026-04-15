/**
 * @file BehavioralPatternBadges Component
 * @description Dismissible alert cards for detected behavioral patterns
 */

"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Info, X, Eye } from "lucide-react";
import type { BehavioralPattern, PatternSeverity } from "@shared/types/domain/wellbeing";
import { behavioralPatternService } from "@/src/shared/services/wellbeing.service";

const SEVERITY_CONFIG: Record<PatternSeverity, { border: string; bg: string; icon: typeof Info; iconColor: string }> = {
  info: {
    border: "border-blue-500/30",
    bg: "bg-blue-500/10",
    icon: Info,
    iconColor: "text-blue-400",
  },
  warning: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/10",
    icon: AlertTriangle,
    iconColor: "text-amber-400",
  },
  alert: {
    border: "border-red-500/30",
    bg: "bg-red-500/10",
    icon: AlertTriangle,
    iconColor: "text-red-400",
  },
};

export function BehavioralPatternBadges() {
  const [patterns, setPatterns] = useState<BehavioralPattern[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPatterns();
  }, []);

  const loadPatterns = async () => {
    try {
      const response = await behavioralPatternService.getActive();
      if (response.success && response.data?.patterns) {
        setPatterns(response.data.patterns);
      }
    } catch {
      // Silent fail — patterns are supplementary
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (patternId: string) => {
    try {
      await behavioralPatternService.dismiss(patternId);
      setPatterns((prev) => prev.filter((p) => p.id !== patternId));
    } catch {
      // Silent fail
    }
  };

  const handleAcknowledge = async (patternId: string) => {
    try {
      await behavioralPatternService.acknowledge(patternId);
      setPatterns((prev) =>
        prev.map((p) =>
          p.id === patternId ? { ...p, acknowledgedAt: new Date().toISOString() } : p
        )
      );
    } catch {
      // Silent fail
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 bg-white/10 rounded shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-white/10 rounded" />
              <div className="h-3 w-1/2 bg-white/10 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (patterns.length === 0) return null;

  return (
    <div className="space-y-3">
      <AnimatePresence>
        {patterns.map((pattern) => {
          const config = SEVERITY_CONFIG[pattern.severity];
          const Icon = config.icon;

          return (
            <motion.div
              key={pattern.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className={`p-4 rounded-xl border ${config.border} ${config.bg}`}
            >
              <div className="flex items-start gap-3">
                <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${config.iconColor}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 leading-relaxed">
                    {pattern.patternDescription}
                  </p>
                  {!pattern.acknowledgedAt && (
                    <button
                      onClick={() => handleAcknowledge(pattern.id)}
                      className="mt-2 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      <Eye className="w-3 h-3" />
                      Got it
                    </button>
                  )}
                </div>
                <button
                  onClick={() => handleDismiss(pattern.id)}
                  className="shrink-0 p-1 rounded-lg hover:bg-white/10 text-slate-500 hover:text-slate-300 transition-colors"
                  aria-label="Dismiss pattern"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
