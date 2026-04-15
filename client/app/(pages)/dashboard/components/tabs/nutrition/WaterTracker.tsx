"use client";

import { motion } from "framer-motion";
import { Droplets, Plus, Minus, Loader2 } from "lucide-react";
import { WaterIntakeLog } from "./types";

interface WaterTrackerProps {
  waterLog: WaterIntakeLog | null;
  isLoading: boolean;
  isUpdating: boolean;
  onAddGlass: () => void;
  onRemoveGlass: () => void;
}

export function WaterTracker({
  waterLog,
  isLoading,
  isUpdating,
  onAddGlass,
  onRemoveGlass,
}: WaterTrackerProps) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-500/5 border border-cyan-500/20 p-4 sm:p-5">
      <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
        <Droplets className="w-4 h-4 text-cyan-400 shrink-0" />
        Water Intake
      </h4>
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
        </div>
      ) : waterLog ? (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: waterLog.targetGlasses }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className={`w-5 sm:w-6 h-7 sm:h-8 rounded-md sm:rounded-lg ${
                    i < waterLog.glassesConsumed
                      ? "bg-gradient-to-t from-cyan-500 to-cyan-400"
                      : "bg-slate-700/50"
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-slate-400">
                {waterLog.glassesConsumed} / {waterLog.targetGlasses} glasses
              </span>
              <p className="text-xs text-slate-500">
                {waterLog.mlConsumed}ml / {waterLog.targetMl}ml
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onRemoveGlass}
                disabled={isUpdating || waterLog.glassesConsumed <= 0}
                className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Minus className="w-4 h-4" />}
              </button>
              <button
                onClick={onAddGlass}
                disabled={isUpdating}
                className="p-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 transition-colors disabled:opacity-50"
              >
                {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {waterLog.goalAchieved && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 p-2 bg-cyan-500/20 rounded-lg text-center"
            >
              <span className="text-xs text-cyan-400 font-medium">Goal Achieved!</span>
            </motion.div>
          )}
        </>
      ) : (
        <p className="text-sm text-slate-400">Unable to load water data</p>
      )}
    </div>
  );
}
