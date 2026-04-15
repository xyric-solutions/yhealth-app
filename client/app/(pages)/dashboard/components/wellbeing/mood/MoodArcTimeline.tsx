/**
 * @file MoodArcTimeline Component
 * @description Horizontal timeline showing mood transitions through a single day
 */

"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { moodService } from "@/src/shared/services/wellbeing.service";
import type { MoodLog } from "@shared/types/domain/wellbeing";

const EMOJI_COLORS: Record<string, string> = {
  "😌": "#60a5fa", // blue
  "😎": "#4ade80", // green
  "🎯": "#a78bfa", // purple
  "😐": "#94a3b8", // gray
  "🤔": "#facc15", // yellow
  "🤩": "#f472b6", // pink
  "😰": "#fb923c", // orange
  "😤": "#f87171", // red
  "😨": "#be123c", // dark red
  "😊": "#34d399", // emerald
  "😟": "#f59e0b", // amber
  "😡": "#ef4444", // red
  "😴": "#818cf8", // indigo
};

interface MoodArcTimelineProps {
  date?: string; // YYYY-MM-DD, defaults to today
}

export function MoodArcTimeline({ date }: MoodArcTimelineProps) {
  const [logs, setLogs] = useState<MoodLog[]>([]);
  const [loading, setLoading] = useState(true);

  const targetDate = date || new Date().toISOString().split("T")[0];

  useEffect(() => {
    moodService.getTransitions(targetDate).then((res) => {
      if (res.success && res.data?.transitions) {
        setLogs(res.data.transitions);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [targetDate]);

  if (loading) {
    return (
      <div className="h-24 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="h-24 flex items-center justify-center text-sm text-slate-500">
        No mood logs for this day
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-slate-400">Mood Arc</h4>
      <div className="relative overflow-x-auto py-4">
        <div className="flex items-center gap-0 min-w-max px-4">
          {logs.map((log, idx) => {
            const color = EMOJI_COLORS[log.moodEmoji || ""] || "#94a3b8";
            const time = new Date(log.loggedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div key={log.id} className="flex items-center">
                {/* Node */}
                <motion.div
                  className="flex flex-col items-center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                >
                  {/* Emoji circle */}
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-2xl border-2"
                    style={{
                      borderColor: color,
                      backgroundColor: `${color}20`,
                    }}
                  >
                    {log.moodEmoji}
                  </div>
                  {/* Time */}
                  <span className="text-[10px] text-slate-500 mt-1">{time}</span>
                  {/* Trigger */}
                  {log.transitionTrigger && (
                    <span className="text-[10px] text-slate-600 mt-0.5 max-w-[80px] truncate text-center">
                      {log.transitionTrigger}
                    </span>
                  )}
                </motion.div>

                {/* Connecting line */}
                {idx < logs.length - 1 && (
                  <div className="relative flex items-center mx-1">
                    <motion.div
                      className="h-0.5 w-8 rounded-full"
                      style={{
                        background: `linear-gradient(to right, ${color}, ${
                          EMOJI_COLORS[logs[idx + 1].moodEmoji || ""] || "#94a3b8"
                        })`,
                      }}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: idx * 0.1 + 0.05 }}
                    />
                    {logs[idx + 1].triggerCategory && (
                      <span className="text-[9px] text-slate-600 absolute -top-4 left-0">
                        {logs[idx + 1].triggerCategory}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
