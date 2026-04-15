"use client";

import { motion } from "framer-motion";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useEffect, useState } from "react";
import { useMagnetic } from "@/hooks/use-magnetic";
import { useReducedMotionSafe } from "@/hooks/use-reduced-motion-safe";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: number;
  delta?: number; // Change vs previous period
  trend?: "up" | "down" | "stable";
  sparkline?: number[]; // Mini trend data
  icon?: LucideIcon;
  maxValue?: number; // For circular progress (default: 100)
  isLoading?: boolean;
  className?: string;
}

export function StatCard({
  title,
  value,
  delta,
  trend,
  sparkline,
  icon: Icon,
  maxValue = 100,
  isLoading = false,
  className,
}: StatCardProps) {
  const prefersReducedMotion = useReducedMotionSafe();
  const { x, y, ref } = useMagnetic({
    strength: prefersReducedMotion ? 0 : 6,
    stiffness: 300,
    damping: 30,
  });

  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = ref as React.RefObject<HTMLDivElement>;

  // Cursor spotlight effect
  useEffect(() => {
    if (prefersReducedMotion) return;

    const element = cardRef.current;
    if (!element) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = element.getBoundingClientRect();
      setCursorPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    };

    const handleMouseEnter = () => setIsHovered(true);
    const handleMouseLeave = () => setIsHovered(false);

    element.addEventListener("mousemove", handleMouseMove);
    element.addEventListener("mouseenter", handleMouseEnter);
    element.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      element.removeEventListener("mousemove", handleMouseMove);
      element.removeEventListener("mouseenter", handleMouseEnter);
      element.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [prefersReducedMotion, cardRef]);

  const percentage = Math.min((value / maxValue) * 100, 100);
  const circumference = 2 * Math.PI * 40; // radius = 40
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getTrendIcon = () => {
    if (trend === "up") return <TrendingUp className="w-4 h-4" />;
    if (trend === "down") return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const _getDeltaColor = () => {
    if (!delta) return "text-slate-400";
    if (delta > 0) return "text-emerald-400";
    if (delta < 0) return "text-red-400";
    return "text-slate-400";
  };

  const getGradientForCard = () => {
    if (title.includes("Overall")) return "from-emerald-500/20 via-teal-500/10 to-cyan-500/20";
    if (title.includes("Mood")) return "from-purple-500/20 via-pink-500/10 to-rose-500/20";
    if (title.includes("Energy")) return "from-yellow-500/20 via-orange-500/10 to-amber-500/20";
    if (title.includes("Stress")) return "from-red-500/20 via-rose-500/10 to-pink-500/20";
    return "from-slate-700/20 via-slate-600/10 to-slate-700/20";
  };

  return (
    <motion.div
      ref={cardRef}
      style={{
        x: prefersReducedMotion ? 0 : x,
        y: prefersReducedMotion ? 0 : y,
      }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-slate-700/50",
        "bg-gradient-to-br from-slate-800/95 via-slate-800/80 to-slate-900/95",
        "backdrop-blur-2xl p-6 transition-all duration-500",
        "hover:border-emerald-500/50 hover:shadow-2xl hover:shadow-emerald-500/20",
        "before:absolute before:inset-0 before:bg-gradient-to-br",
        `before:${getGradientForCard()}`,
        "before:opacity-0 before:transition-opacity before:duration-500",
        "hover:before:opacity-100",
        "h-full flex flex-col",
        className
      )}
      whileHover={prefersReducedMotion ? {} : { scale: 1.02, y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {/* Animated border glow */}
      <motion.div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(6, 182, 212, 0.3))`,
          filter: "blur(20px)",
          zIndex: -1,
        }}
        animate={isHovered ? { opacity: [0, 0.5, 0.3] } : { opacity: 0 }}
        transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
      />

      {/* Cursor spotlight effect */}
      {!prefersReducedMotion && (
        <motion.div
          className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: `radial-gradient(circle 200px at ${cursorPos.x}px ${cursorPos.y}px, rgba(16, 185, 129, 0.2), transparent 70%)`,
          }}
          animate={{
            background: isHovered
              ? [
                  `radial-gradient(circle 200px at ${cursorPos.x}px ${cursorPos.y}px, rgba(16, 185, 129, 0.2), transparent 70%)`,
                  `radial-gradient(circle 250px at ${cursorPos.x}px ${cursorPos.y}px, rgba(6, 182, 212, 0.15), transparent 70%)`,
                  `radial-gradient(circle 200px at ${cursorPos.x}px ${cursorPos.y}px, rgba(16, 185, 129, 0.2), transparent 70%)`,
                ]
              : `radial-gradient(circle 200px at ${cursorPos.x}px ${cursorPos.y}px, rgba(16, 185, 129, 0.2), transparent 70%)`,
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* Subtle grain texture */}
      <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48ZmlsdGVyIGlkPSJub2lzZSI+PGZlVHVyYnVsZW5jZSBiYXNlRnJlcXVlbmN5PSIwLjkiIG51bU9jdGF2ZXM9IjQiLz48L2ZpbHRlcj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbHRlcj0idXJsKCNub2lzZSkiIG9wYWNpdHk9IjAuNSIvPjwvc3ZnPg==')] pointer-events-none" />

      {/* Shimmer effect on hover */}
      <motion.div
        className="absolute inset-0 opacity-0 group-hover:opacity-100"
        initial={{ x: "-100%" }}
        whileHover={{ x: "100%" }}
        transition={{ duration: 1.5, ease: "easeInOut" }}
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent)",
        }}
      />

      <div className="relative z-10 flex flex-col h-full">
        {/* Header with enhanced styling */}
        <div className="mb-5 flex items-start justify-between flex-shrink-0">
          <div className="flex-1">
            <motion.p
              initial={{ opacity: 0.7 }}
              whileHover={{ opacity: 1 }}
              className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3"
            >
              {title}
            </motion.p>
            {isLoading ? (
              <div className="mt-2 h-10 w-32 animate-pulse rounded-lg bg-slate-700/50" />
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex items-baseline gap-3"
              >
                <span className="text-4xl font-extrabold bg-gradient-to-br from-white to-slate-200 bg-clip-text text-transparent">
                  {value}
                </span>
                {delta !== undefined && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
                      delta > 0
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : delta < 0
                        ? "bg-red-500/20 text-red-300 border border-red-500/30"
                        : "bg-slate-700/50 text-slate-400 border border-slate-600/50"
                    )}
                  >
                    {getTrendIcon()}
                    {Math.abs(delta).toFixed(1)}%
                  </motion.span>
                )}
              </motion.div>
            )}
          </div>
          {Icon && (
            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: "spring", stiffness: 400 }}
              className="rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 p-3 border border-emerald-500/20 shadow-lg"
            >
              <Icon className="h-6 w-6 text-emerald-400" />
            </motion.div>
          )}
        </div>

        {/* Content area - flex-grow to fill space */}
        <div className="flex-grow flex items-center justify-center">
          {/* Circular progress for overall score with enhanced animation */}
          {title === "Overall Wellbeing Score" && !isLoading && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.3 }}
              className="relative h-24 w-24"
            >
              <svg className="h-24 w-24 -rotate-90 transform" viewBox="0 0 100 100">
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="50%" stopColor="#14b8a6" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="6"
                  fill="none"
                  className="text-slate-700/50"
                />
                <motion.circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="url(#progressGradient)"
                  strokeWidth="6"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.span
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-xl font-extrabold bg-gradient-to-br from-emerald-300 to-teal-300 bg-clip-text text-transparent"
                >
                  {Math.round(percentage)}
                </motion.span>
              </div>
            </motion.div>
          )}

          {/* Enhanced mini sparkline with gradient */}
          {sparkline && sparkline.length > 0 && !isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="w-full h-14 rounded-lg bg-slate-900/50 p-2 border border-slate-700/30"
            >
              <svg viewBox={`0 0 ${sparkline.length * 10} 40`} className="h-full w-full">
                <defs>
                  <linearGradient id={`sparklineGradient-${title.replace(/\s+/g, '-')}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.1" />
                  </linearGradient>
                </defs>
                <polyline
                  points={sparkline
                    .map((val, i) => {
                      const x = i * 10;
                      const y = 40 - (val / maxValue) * 40;
                      return `${x},${y}`;
                    })
                    .join(" ")}
                  fill={`url(#sparklineGradient-${title.replace(/\s+/g, '-')})`}
                  stroke={`url(#sparklineGradient-${title.replace(/\s+/g, '-')})`}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
