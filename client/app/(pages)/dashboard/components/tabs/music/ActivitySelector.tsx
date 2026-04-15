"use client";

import { motion } from "framer-motion";
import {
  Dumbbell,
  PersonStanding,
  Brain,
  Moon,
  Focus,
  Heart,
  Waves,
  Flower2,
} from "lucide-react";
import type { SpotifyActivityCategory } from "./types";

const ACTIVITIES: {
  id: SpotifyActivityCategory;
  label: string;
  icon: React.ReactNode;
  gradient: string;
  activeText: string;
}[] = [
  { id: "workout", label: "Workout", icon: <Dumbbell className="w-4 h-4" />, gradient: "from-red-500 to-orange-500", activeText: "text-white" },
  { id: "running", label: "Running", icon: <PersonStanding className="w-4 h-4" />, gradient: "from-blue-500 to-cyan-500", activeText: "text-white" },
  { id: "meditation", label: "Meditate", icon: <Brain className="w-4 h-4" />, gradient: "from-purple-500 to-violet-500", activeText: "text-white" },
  { id: "sleep", label: "Sleep", icon: <Moon className="w-4 h-4" />, gradient: "from-indigo-500 to-blue-500", activeText: "text-white" },
  { id: "focus", label: "Focus", icon: <Focus className="w-4 h-4" />, gradient: "from-amber-500 to-yellow-500", activeText: "text-white" },
  { id: "recovery", label: "Recovery", icon: <Heart className="w-4 h-4" />, gradient: "from-green-500 to-emerald-500", activeText: "text-white" },
  { id: "stretching", label: "Stretch", icon: <Waves className="w-4 h-4" />, gradient: "from-teal-500 to-cyan-500", activeText: "text-white" },
  { id: "yoga", label: "Yoga", icon: <Flower2 className="w-4 h-4" />, gradient: "from-pink-500 to-rose-500", activeText: "text-white" },
];

interface ActivitySelectorProps {
  selected: SpotifyActivityCategory;
  onSelect: (category: SpotifyActivityCategory) => void;
}

export function ActivitySelector({ selected, onSelect }: ActivitySelectorProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
      {ACTIVITIES.map((activity) => {
        const isActive = selected === activity.id;
        return (
          <motion.button
            key={activity.id}
            onClick={() => onSelect(activity.id)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              isActive
                ? "text-white shadow-lg"
                : "text-slate-400 hover:text-slate-200 bg-white/[0.04] hover:bg-white/[0.08]"
            }`}
          >
            {isActive && (
              <motion.div
                layoutId="activity-pill"
                className={`absolute inset-0 rounded-full bg-gradient-to-r ${activity.gradient}`}
                transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {activity.icon}
              {activity.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
