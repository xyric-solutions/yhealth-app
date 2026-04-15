"use client";

import { motion } from "framer-motion";
import { LucideIcon, TrendingUp, TrendingDown, Minus, ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface ModuleCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  status: string;
  trend: "up" | "down" | "stable";
  actionLabel: string;
  gradient?: string;
  className?: string;
}

export function ModuleCard({
  title,
  description,
  icon: Icon,
  href,
  status,
  trend,
  actionLabel,
  gradient = "from-emerald-500 to-teal-600",
  className,
}: ModuleCardProps) {
  const getTrendIcon = () => {
    if (trend === "up") return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />;
    if (trend === "down") return <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
    return <Minus className="w-3.5 h-3.5 text-slate-500" />;
  };

  return (
    <Link href={href} className="block h-full">
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className={cn(
          "group relative overflow-hidden rounded-xl border border-white/[0.06]",
          "bg-[#0f0f18] p-5 transition-colors duration-300",
          "hover:border-white/[0.12] hover:bg-[#13131e]",
          "h-full flex flex-col",
          className
        )}
      >
        {/* Header: Icon + Trend */}
        <div className="flex items-start justify-between mb-4">
          <div
            className={cn(
              "p-3 rounded-xl bg-gradient-to-br shadow-lg",
              gradient
            )}
          >
            <Icon className="h-5 w-5 text-white" />
          </div>
          {getTrendIcon()}
        </div>

        {/* Content */}
        <div className="flex-1 mb-4">
          <h3 className="text-base font-semibold text-white mb-1.5 group-hover:text-emerald-100 transition-colors">
            {title}
          </h3>
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
            {description}
          </p>
        </div>

        {/* Footer: Status + Action */}
        <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] mt-auto">
          <span className="text-[11px] text-slate-600 font-medium">{status}</span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 group-hover:text-emerald-400 transition-colors">
            {actionLabel}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </motion.div>
    </Link>
  );
}
