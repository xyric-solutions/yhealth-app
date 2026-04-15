"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type DashboardUnderlineTabItem = {
  id: string;
  label: string;
  icon?: LucideIcon;
  /** Shown on small screens when set (e.g. yoga short labels) */
  shortLabel?: string;
  /** Extra node after label (e.g. notification dot) */
  suffix?: ReactNode;
};

export interface DashboardUnderlineTabsProps {
  tabs: DashboardUnderlineTabItem[];
  activeId: string;
  onTabChange: (id: string) => void;
  /** Unique per tab strip (framer-motion layoutId) */
  layoutId: string;
  className?: string;
  listClassName?: string;
  /** Right-aligned slot (e.g. refresh) on the same row as tabs */
  trailing?: ReactNode;
  /** Stretch tabs equally (e.g. drawer segment control) */
  equalWidth?: boolean;
}

/**
 * Horizontal tabs: icon + label, active = white + emerald underline (Workouts / Overview style).
 */
export function DashboardUnderlineTabs({
  tabs,
  activeId,
  onTabChange,
  layoutId,
  className,
  listClassName,
  trailing,
  equalWidth = false,
}: DashboardUnderlineTabsProps) {
  return (
    <div
      className={cn(
        "overflow-x-auto scrollbar-hide border-b border-white/6",
        className
      )}
    >
      <div
        className={cn(
          "flex justify-between gap-3 min-w-0",
          trailing ? "items-end" : "items-stretch"
        )}
      >
        <div
          role="tablist"
          aria-orientation="horizontal"
          className={cn(
            "flex gap-0",
            equalWidth ? "w-full" : "w-max",
            listClassName
          )}
        >
          {tabs.map((tab) => {
            const isActive = activeId === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                id={`tab-${tab.id}`}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "relative flex items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-3 text-xs sm:text-sm transition-colors whitespace-nowrap",
                  equalWidth && "flex-1 justify-center",
                  isActive
                    ? "text-white font-semibold"
                    : "text-slate-500 hover:text-slate-300 font-medium"
                )}
              >
                {Icon ? (
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" aria-hidden />
                ) : null}
                {tab.shortLabel ? (
                  <>
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.shortLabel}</span>
                  </>
                ) : (
                  <span>{tab.label}</span>
                )}
                {tab.suffix ? (
                  <span className="relative z-10 inline-flex">{tab.suffix}</span>
                ) : null}
                {isActive ? (
                  <motion.div
                    layoutId={layoutId}
                    className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-emerald-500"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
        {trailing ? (
          <div className="shrink-0 flex items-center pb-3">{trailing}</div>
        ) : null}
      </div>
    </div>
  );
}
