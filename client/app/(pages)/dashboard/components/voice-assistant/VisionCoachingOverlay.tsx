"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Eye, Activity, AlertTriangle, Info, X } from "lucide-react";
import type { VisionStateEvent, VisionCoachingEvent } from "@/lib/socket-client";

interface VisionCoachingOverlayProps {
  visionState: VisionStateEvent | null;
  coaching: VisionCoachingEvent | null;
  isActive: boolean;
  onStop: () => void;
}

export function VisionCoachingOverlay({
  visionState,
  coaching,
  isActive,
  onStop,
}: VisionCoachingOverlayProps) {
  if (!isActive) return null;

  return (
    <div className="absolute top-28 left-4 z-40 flex flex-col gap-2 max-w-xs">
      {/* Vision State Badge */}
      {visionState && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-black/70 backdrop-blur-md rounded-xl border border-teal-500/30 p-3 text-white"
        >
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-4 h-4 text-teal-400" aria-hidden="true" />
            <span className="text-xs font-semibold text-teal-300 uppercase tracking-wider">
              Vision Active
            </span>
            <button
              onClick={onStop}
              className="ml-auto p-1 rounded-full hover:bg-white/10 transition-colors"
              aria-label="Stop vision coaching"
            >
              <X className="w-3 h-3 text-white/60" />
            </button>
          </div>

          {visionState.exerciseDetected && (
            <div className="flex items-center gap-2 text-sm">
              <Activity className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
              <span className="text-white/90">{visionState.exerciseDetected}</span>
              {visionState.repCount > 0 && (
                <span className="ml-auto text-cyan-300 font-mono font-bold text-base tabular-nums">
                  {visionState.repCount}
                </span>
              )}
            </div>
          )}

          {visionState.attentionState !== "unknown" && (
            <div className="flex items-center gap-2 text-xs mt-1.5">
              <div
                className={`w-2 h-2 rounded-full ${
                  visionState.attentionState === "focused"
                    ? "bg-green-400"
                    : "bg-amber-400"
                }`}
                aria-hidden="true"
              />
              <span className="text-white/70 capitalize">
                {visionState.attentionState}
              </span>
              {visionState.confidence > 0 && (
                <span className="text-white/40 ml-auto">
                  {Math.round(visionState.confidence * 100)}%
                </span>
              )}
            </div>
          )}
        </motion.div>
      )}

      {/* Coaching Toast */}
      <AnimatePresence>
        {coaching && (
          <motion.div
            key={coaching.timestamp}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className={`rounded-xl border p-3 backdrop-blur-md ${
              coaching.severity === "warning"
                ? "bg-amber-900/70 border-amber-500/40"
                : "bg-slate-800/70 border-slate-500/30"
            }`}
          >
            <div className="flex items-start gap-2">
              {coaching.severity === "warning" ? (
                <AlertTriangle
                  className="w-4 h-4 text-amber-400 mt-0.5 shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <Info
                  className="w-4 h-4 text-blue-400 mt-0.5 shrink-0"
                  aria-hidden="true"
                />
              )}
              <p className="text-sm text-white/90 leading-snug">
                {coaching.message}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
