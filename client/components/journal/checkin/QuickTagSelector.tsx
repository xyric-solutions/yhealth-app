"use client";

import { useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Users,
  Sparkles,
  Palette,
  Moon,
  AlertTriangle,
  Brain,
  Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CheckinTag } from "@shared/types/domain/wellbeing";
import type { LucideIcon } from "lucide-react";

interface QuickTagSelectorProps {
  selected: CheckinTag[];
  onChange: (tags: CheckinTag[]) => void;
}

interface TagConfig {
  tag: CheckinTag;
  label: string;
  icon: LucideIcon;
  gradient: string;
  activeTextColor: string;
}

const TAG_CONFIG: TagConfig[] = [
  {
    tag: "productive",
    label: "Productive",
    icon: Zap,
    gradient: "from-emerald-500/80 to-green-600/80",
    activeTextColor: "text-emerald-100",
  },
  {
    tag: "social",
    label: "Social",
    icon: Users,
    gradient: "from-blue-500/80 to-cyan-600/80",
    activeTextColor: "text-blue-100",
  },
  {
    tag: "spiritual",
    label: "Spiritual",
    icon: Sparkles,
    gradient: "from-violet-500/80 to-purple-600/80",
    activeTextColor: "text-violet-100",
  },
  {
    tag: "creative",
    label: "Creative",
    icon: Palette,
    gradient: "from-pink-500/80 to-rose-600/80",
    activeTextColor: "text-pink-100",
  },
  {
    tag: "restful",
    label: "Restful",
    icon: Moon,
    gradient: "from-indigo-500/80 to-blue-700/80",
    activeTextColor: "text-indigo-100",
  },
  {
    tag: "stressful",
    label: "Stressful",
    icon: AlertTriangle,
    gradient: "from-orange-500/80 to-red-600/80",
    activeTextColor: "text-orange-100",
  },
  {
    tag: "anxious",
    label: "Anxious",
    icon: Brain,
    gradient: "from-amber-500/80 to-yellow-600/80",
    activeTextColor: "text-amber-100",
  },
  {
    tag: "grateful",
    label: "Grateful",
    icon: Heart,
    gradient: "from-rose-400/80 to-pink-500/80",
    activeTextColor: "text-rose-100",
  },
];

/**
 * QuickTagSelector - Multi-select animated pill buttons for daily check-in tags.
 *
 * Features:
 * - 8 tag options with Lucide icons and gradient fills on selection
 * - Scale bounce animation on toggle
 * - Multi-select: clicking adds/removes from selection array
 * - Dark unselected state with subtle border
 * - Accessible with proper aria-pressed and role attributes
 */
export function QuickTagSelector({
  selected,
  onChange,
}: QuickTagSelectorProps) {
  const toggleTag = useCallback(
    (tag: CheckinTag) => {
      const isSelected = selected.includes(tag);
      if (isSelected) {
        onChange(selected.filter((t) => t !== tag));
      } else {
        onChange([...selected, tag]);
      }
    },
    [selected, onChange]
  );

  return (
    <div className="space-y-3">
      {/* Selected count */}
      <div className="text-center">
        <AnimatePresence mode="wait">
          <motion.span
            key={selected.length}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="text-xs text-slate-500"
          >
            {selected.length === 0
              ? "Select tags that describe your day"
              : `${selected.length} tag${selected.length > 1 ? "s" : ""} selected`}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Tag grid */}
      <div
        role="group"
        aria-label="Day tags"
        className="flex flex-wrap justify-center gap-2"
      >
        {TAG_CONFIG.map(({ tag, label, icon: Icon, gradient, activeTextColor }) => {
          const isActive = selected.includes(tag);

          return (
            <motion.button
              key={tag}
              type="button"
              role="checkbox"
              aria-checked={isActive}
              aria-label={`${label} tag`}
              onClick={() => toggleTag(tag)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-2.5 rounded-full",
                "text-sm font-medium transition-colors duration-200",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
                "focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
                "cursor-pointer select-none",
                isActive
                  ? cn("bg-gradient-to-r", gradient, activeTextColor)
                  : "bg-slate-800/60 text-slate-400 border border-slate-700/60 hover:bg-slate-700/50 hover:text-slate-300"
              )}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              animate={
                isActive
                  ? {
                      scale: [1, 1.08, 1],
                    }
                  : { scale: 1 }
              }
              transition={{
                scale: { duration: 0.3, ease: "easeOut" },
              }}
            >
              <Icon
                className={cn(
                  "w-4 h-4 flex-shrink-0",
                  isActive ? "opacity-100" : "opacity-60"
                )}
              />
              <span>{label}</span>

              {/* Check indicator */}
              <AnimatePresence>
                {isActive && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="w-1.5 h-1.5 rounded-full bg-white/80"
                  />
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
