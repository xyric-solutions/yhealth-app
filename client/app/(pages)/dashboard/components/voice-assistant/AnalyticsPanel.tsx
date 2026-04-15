"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { MessageSquare, Clock, TrendingUp, Zap } from "lucide-react";

interface AnalyticsPanelProps {
  totalSessions?: number;
  averageResponseTime?: number;
  accuracyScore?: number;
  totalInteractions?: number;
  isVisible: boolean;
}

export function AnalyticsPanel({
  totalSessions = 0,
  averageResponseTime = 0,
  accuracyScore = 0,
  totalInteractions = 0,
  isVisible,
}: AnalyticsPanelProps) {
  const stats = useMemo(
    () => [
      {
        label: "Total Sessions",
        value: totalSessions,
        icon: MessageSquare,
        color: "#00E5FF",
        suffix: "",
      },
      {
        label: "Avg Response",
        value: averageResponseTime,
        icon: Clock,
        color: "#1DE9B6",
        suffix: "ms",
      },
      {
        label: "Accuracy",
        value: accuracyScore,
        icon: TrendingUp,
        color: "#7C4DFF",
        suffix: "%",
      },
      {
        label: "Interactions",
        value: totalInteractions,
        icon: Zap,
        color: "#00E5FF",
        suffix: "",
      },
    ],
    [totalSessions, averageResponseTime, accuracyScore, totalInteractions]
  );

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.5 }}
      className="absolute top-32 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 z-20"
    >
      <div
        className="relative backdrop-blur-xl rounded-xl border p-6"
        style={{
          background: "rgba(11, 15, 20, 0.7)",
          borderColor: "rgba(0, 229, 255, 0.2)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0, 229, 255, 0.1)",
        }}
      >
        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 rounded-xl opacity-10"
          style={{
            backgroundImage: `linear-gradient(rgba(0, 229, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 229, 255, 0.1) 1px, transparent 1px)`,
            backgroundSize: "20px 20px",
          }}
        />

        <div className="relative grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1, duration: 0.3 }}
                className="relative"
              >
                <div
                  className="p-4 rounded-lg border backdrop-blur-sm"
                  style={{
                    background: "rgba(0, 229, 255, 0.05)",
                    borderColor: `${stat.color}30`,
                  }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="p-2 rounded-lg"
                      style={{
                        background: `${stat.color}15`,
                        border: `1px solid ${stat.color}30`,
                      }}
                    >
                      <Icon className="w-4 h-4" style={{ color: stat.color }} />
                    </div>
                    <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "#888" }}>
                      {stat.label}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <motion.span
                      className="text-2xl font-bold"
                      style={{ color: stat.color }}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.1 + 0.2 }}
                    >
                      {stat.value.toLocaleString()}
                    </motion.span>
                    {stat.suffix && (
                      <span className="text-sm" style={{ color: "#888" }}>
                        {stat.suffix}
                      </span>
                    )}
                  </div>
                </div>

                {/* Corner brackets */}
                <div
                  className="absolute top-1 left-1 w-2 h-2 border-t border-l"
                  style={{ borderColor: `${stat.color}40` }}
                />
                <div
                  className="absolute top-1 right-1 w-2 h-2 border-t border-r"
                  style={{ borderColor: `${stat.color}40` }}
                />
                <div
                  className="absolute bottom-1 left-1 w-2 h-2 border-b border-l"
                  style={{ borderColor: `${stat.color}40` }}
                />
                <div
                  className="absolute bottom-1 right-1 w-2 h-2 border-b border-r"
                  style={{ borderColor: `${stat.color}40` }}
                />
              </motion.div>
            );
          })}
        </div>

        {/* HUD-style corner accents */}
        <div
          className="absolute top-2 left-2 w-3 h-3 border-t border-l"
          style={{ borderColor: "rgba(0, 229, 255, 0.3)" }}
        />
        <div
          className="absolute top-2 right-2 w-3 h-3 border-t border-r"
          style={{ borderColor: "rgba(0, 229, 255, 0.3)" }}
        />
        <div
          className="absolute bottom-2 left-2 w-3 h-3 border-b border-l"
          style={{ borderColor: "rgba(0, 229, 255, 0.3)" }}
        />
        <div
          className="absolute bottom-2 right-2 w-3 h-3 border-b border-r"
          style={{ borderColor: "rgba(0, 229, 255, 0.3)" }}
        />
      </div>
    </motion.div>
  );
}

