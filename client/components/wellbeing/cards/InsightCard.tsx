"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { LucideIcon, ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface InsightAction {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface InsightCardProps {
  text: string;
  actions: InsightAction[];
  explanation?: string;
  className?: string;
}

export function InsightCard({
  text,
  actions,
  explanation,
  className,
}: InsightCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-slate-700/50",
        "bg-gradient-to-br from-slate-800/95 via-slate-800/80 to-slate-900/95",
        "backdrop-blur-2xl p-8 shadow-2xl",
        "before:absolute before:inset-0 before:bg-gradient-to-r before:from-emerald-600/10 before:via-transparent before:to-teal-600/10",
        className
      )}
    >
      {/* Animated background effects */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
      </div>

      {/* Subtle grain texture */}
      <div className="absolute inset-0 opacity-[0.02] mix-blend-overlay bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48ZmlsdGVyIGlkPSJub2lzZSI+PGZlVHVyYnVsZW5jZSBiYXNlRnJlcXVlbmN5PSIwLjkiIG51bU9jdGF2ZXM9IjQiLz48L2ZpbHRlcj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbHRlcj0idXJsKCNub2lzZSkiIG9wYWNpdHk9IjAuNSIvPjwvc3ZnPg==')] pointer-events-none" />

      <div className="relative z-10">
        {/* Header with animated icon */}
        <div className="mb-6 flex items-start gap-4">
          <motion.div
            whileHover={{ scale: 1.1, rotate: 12 }}
            transition={{ type: "spring", stiffness: 400 }}
            className="relative"
          >
            <div className="absolute inset-0 bg-emerald-500/30 rounded-xl blur-xl" />
            <div className="relative rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 p-3 border border-emerald-500/30 shadow-lg">
              <Sparkles className="h-6 w-6 text-emerald-400" />
            </div>
          </motion.div>
          <div className="flex-1">
            <motion.h3
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-3 text-xl font-bold text-white"
            >
              AI Insight
            </motion.h3>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-base leading-relaxed text-slate-300 font-medium"
            >
              {text}
            </motion.p>
          </div>
        </div>

        {/* Action Buttons with enhanced styling */}
        <div className="mb-6 flex flex-wrap gap-3">
          {actions.map((action, index) => {
            const ActionIcon = action.icon;
            return (
              <motion.div
                key={action.href}
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.4 + index * 0.1, type: "spring", stiffness: 300 }}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  asChild
                  variant="outline"
                  className="group/action relative overflow-hidden border-emerald-500/30 bg-slate-700/30 hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all duration-300 shadow-lg hover:shadow-emerald-500/20"
                >
                  <a href={action.href}>
                    <span className="relative z-10 flex items-center gap-2 font-semibold">
                      <ActionIcon className="h-4 w-4 transition-transform group-hover/action:rotate-12" />
                      {action.label}
                    </span>
                    {/* Ripple effect */}
                    <motion.div
                      className="absolute inset-0 rounded-md bg-emerald-500/20"
                      initial={{ scale: 0, opacity: 0 }}
                      whileHover={{ scale: 1.5, opacity: 1 }}
                      transition={{ duration: 0.4 }}
                    />
                    {/* Shimmer */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      initial={{ x: "-100%" }}
                      whileHover={{ x: "100%" }}
                      transition={{ duration: 0.6, ease: "easeInOut" }}
                    />
                  </a>
                </Button>
              </motion.div>
            );
          })}
        </div>

        {/* Expandable Explanation with smooth animation */}
        {explanation && (
          <div>
            <motion.button
              onClick={() => setIsExpanded(!isExpanded)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex w-full items-center justify-between rounded-xl bg-slate-700/30 px-5 py-3 text-sm font-semibold text-slate-400 transition-all duration-300 hover:bg-slate-700/50 hover:text-slate-300 border border-slate-600/50 hover:border-emerald-500/30"
              aria-expanded={isExpanded}
              aria-label="Toggle explanation"
            >
              <span>Why this?</span>
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                <ChevronDown className="h-4 w-4" />
              </motion.div>
            </motion.button>
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 rounded-xl bg-slate-700/20 p-5 text-sm leading-relaxed text-slate-400 border border-slate-600/30 backdrop-blur-xl">
                    {explanation}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}
