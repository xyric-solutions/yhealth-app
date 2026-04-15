"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Square,
  Clock,
  ImageIcon,
  Loader2,
  Zap,
} from "lucide-react";

interface SessionControlsProps {
  isRunning: boolean;
  elapsedTime: string;
  hasPose: boolean;
  isAnalysing: boolean;
  snapshots: string[];
  onStart: () => void;
  onStop: () => void;
  onAnalyseNow: () => void;
}

export default function SessionControls({
  isRunning,
  elapsedTime,
  hasPose,
  isAnalysing,
  snapshots,
  onStart,
  onStop,
  onAnalyseNow,
}: SessionControlsProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Main controls */}
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
        {/* Timer */}
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-white/40" />
          <span className="font-mono text-lg font-semibold text-white">
            {elapsedTime}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Analyse now button */}
          {isRunning && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={onAnalyseNow}
              disabled={isAnalysing}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-400 transition-all hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {isAnalysing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5" />
              )}
              Analyse Now
            </motion.button>
          )}

          {/* Start / Stop */}
          {!isRunning ? (
            <button
              onClick={onStart}
              disabled={!hasPose}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-sky-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all hover:from-emerald-500 hover:to-sky-500 disabled:opacity-50 disabled:shadow-none"
            >
              <Play className="h-4 w-4" />
              Start Session
            </button>
          ) : (
            <button
              onClick={onStop}
              className="flex items-center gap-2 rounded-xl bg-red-500/20 px-6 py-2.5 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/30"
            >
              <Square className="h-4 w-4" />
              End Session
            </button>
          )}
        </div>
      </div>

      {/* Snapshot gallery */}
      <AnimatePresence>
        {snapshots.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
              <ImageIcon className="h-4 w-4 shrink-0 text-white/40" />
              <span className="text-xs text-white/40">Snapshots</span>
              <div className="flex gap-2 overflow-x-auto">
                {snapshots.map((snap, i) => (
                  <motion.img
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    src={`data:image/jpeg;base64,${snap}`}
                    alt={`Session snapshot ${i + 1}`}
                    className="h-14 w-20 shrink-0 rounded-lg border border-white/10 object-cover"
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
