"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, Star } from "lucide-react";
import { getSocket } from "@/lib/socket-client";
import type { Achievement } from "./types";
import { rarityGradients, rarityBorderColors } from "./constants";

interface ToastItem {
  id: string;
  achievement: Achievement;
  timestamp: number;
}

interface AchievementToastProps {
  onAchievementClick?: (achievement: Achievement) => void;
}

export function AchievementToast({ onAchievementClick }: AchievementToastProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const prefersReducedMotion = useReducedMotion();

  const addToast = useCallback((achievement: Achievement) => {
    const id = `${achievement.id}-${Date.now()}`;
    setToasts((prev) => {
      // Max 3 visible toasts
      const updated = [...prev, { id, achievement, timestamp: Date.now() }];
      return updated.slice(-3);
    });

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Listen for Socket.IO achievement events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleUnlock = (data: { achievement: Achievement }) => {
      addToast(data.achievement);
    };

    const handleMicroWin = (data: { microWin: { title: string; description: string; rarity: string; xpReward: number } }) => {
      addToast({
        id: `mw-${Date.now()}`,
        title: data.microWin.title,
        description: data.microWin.description,
        icon: "✨",
        category: "micro-win",
        rarity: (data.microWin.rarity as Achievement["rarity"]) || "common",
        xpReward: data.microWin.xpReward,
        unlocked: true,
        progress: 1,
        maxProgress: 1,
        progressPercentage: 100,
        aiGenerated: true,
      });
    };

    socket.on("achievement:unlocked", handleUnlock);
    socket.on("micro-win:detected", handleMicroWin);

    return () => {
      socket.off("achievement:unlocked", handleUnlock);
      socket.off("micro-win:detected", handleMicroWin);
    };
  }, [addToast]);

  return (
    <div className="fixed top-4 right-4 z-[90] flex flex-col gap-3 pointer-events-none max-w-sm w-full">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 100, scale: 0.9 }}
            transition={
              prefersReducedMotion
                ? { duration: 0.15 }
                : { type: "spring", stiffness: 300, damping: 25 }
            }
            className={`
              pointer-events-auto flex items-center gap-3 p-4 rounded-2xl
              bg-[#0F1419]/95 backdrop-blur-xl
              border ${rarityBorderColors[toast.achievement.rarity]}
              shadow-lg cursor-pointer
            `}
            onClick={() => {
              onAchievementClick?.(toast.achievement);
              dismissToast(toast.id);
            }}
          >
            {/* Rarity accent line */}
            <div
              className={`absolute left-0 top-3 bottom-3 w-1 rounded-full bg-gradient-to-b ${
                rarityGradients[toast.achievement.rarity]
              }`}
            />

            {/* Icon */}
            <div className="text-3xl ml-2 flex-shrink-0">{toast.achievement.icon}</div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-emerald-400 font-medium uppercase tracking-wider mb-0.5">
                {toast.achievement.category === "micro-win"
                  ? "Micro-Win!"
                  : "Achievement Unlocked!"}
              </p>
              <p className="text-sm font-semibold text-white truncate">
                {toast.achievement.title}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <Star className="w-3 h-3 text-amber-400" />
                <span className="text-xs text-amber-300 font-medium">
                  +{toast.achievement.xpReward} XP
                </span>
              </div>
            </div>

            {/* Dismiss */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                dismissToast(toast.id);
              }}
              className="flex-shrink-0 p-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
