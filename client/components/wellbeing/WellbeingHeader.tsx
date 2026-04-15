"use client";

import { motion } from "framer-motion";
import { Heart, Download, Calendar, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DateRange = "today" | "7d" | "30d";

interface WellbeingHeaderProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  onExport?: () => void;
  onStartCheckIn?: () => void;
}

export function WellbeingHeader({
  dateRange,
  onDateRangeChange,
  onExport,
  onStartCheckIn,
}: WellbeingHeaderProps) {
  const dateRangeOptions: { value: DateRange; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "7d", label: "7D" },
    { value: "30d", label: "30D" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -30, filter: "blur(20px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
      className="relative mb-10"
    >
      {/* Animated background gradient with multiple layers */}
      <div className="absolute -inset-4 -z-10">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/30 via-teal-600/20 to-cyan-600/30 blur-3xl rounded-3xl animate-pulse" />
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-teal-500/10 blur-2xl rounded-3xl" />
      </div>

      <div className="relative">
        {/* Title Section with enhanced styling */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-8 flex items-center gap-4"
        >
          {/* Icon with animated glow */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.3 }}
            className="relative"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl blur-xl opacity-60 animate-pulse" />
            <div className="relative p-4 rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 shadow-2xl shadow-emerald-500/40 border border-emerald-400/20">
              <Heart className="w-8 h-8 text-white" fill="currentColor" />
            </div>
          </motion.div>

          <div className="flex-1">
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-5xl font-extrabold tracking-tight mb-2"
            >
              <span className="bg-gradient-to-r from-white via-emerald-100 via-teal-100 to-cyan-100 bg-clip-text text-transparent">
                Wellbeing
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="text-lg text-slate-300 font-medium"
            >
              Track your mood, energy, journaling, habits, schedule, and more
            </motion.p>
          </div>
        </motion.div>

        {/* Enhanced Controls Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between"
        >
          {/* Date Range Selector with premium styling */}
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: "spring", stiffness: 400 }}
              className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50"
            >
              <Calendar className="h-5 w-5 text-emerald-400" />
            </motion.div>
            <div className="flex rounded-xl border border-slate-700/50 bg-slate-800/60 backdrop-blur-xl p-1.5 shadow-lg">
              {dateRangeOptions.map((option, index) => (
                <motion.button
                  key={option.value}
                  onClick={() => onDateRangeChange(option.value)}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + index * 0.1 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    "relative px-5 py-2.5 text-sm font-semibold rounded-lg transition-all duration-300",
                    "focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900",
                    dateRange === option.value
                      ? "bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border border-emerald-500/40 shadow-lg shadow-emerald-500/20"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                  )}
                  aria-label={`Select ${option.label} date range`}
                  aria-pressed={dateRange === option.value}
                >
                  {option.label}
                  {dateRange === option.value && (
                    <motion.div
                      layoutId="activeDateRange"
                      className="absolute inset-0 rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Action Buttons with enhanced styling */}
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.8 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={onExport}
                className="group relative overflow-hidden border-slate-700/50 bg-slate-800/60 backdrop-blur-xl hover:bg-slate-700/60 hover:border-emerald-500/30 transition-all duration-300"
              >
                <Download className="h-4 w-4 mr-2 transition-transform group-hover:translate-y-[-2px]" />
                <span className="relative z-10">Export</span>
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/10 to-emerald-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              </Button>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.9 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                onClick={onStartCheckIn}
                className="group relative overflow-hidden bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-600 hover:via-emerald-700 hover:to-teal-700 text-white shadow-2xl shadow-emerald-500/40 border border-emerald-400/20 font-semibold transition-all duration-300"
              >
                <Sparkles className="h-4 w-4 mr-2 transition-transform group-hover:rotate-12" />
                <span className="relative z-10">Start Check-in</span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
