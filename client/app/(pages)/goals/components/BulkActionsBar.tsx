"use client";

import { motion } from "framer-motion";
import { Trash2, CheckCircle2, Pause, Play, X } from "lucide-react";

interface BulkActionsBarProps {
  selectedCount: number;
  onBulkDelete: () => void;
  onBulkUpdateStatus: (status: string) => void;
  onClearSelection: () => void;
  isProcessing?: boolean;
}

export function BulkActionsBar({
  selectedCount,
  onBulkDelete,
  onBulkUpdateStatus,
  onClearSelection,
  isProcessing = false,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <motion.div
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -20, opacity: 0 }}
      className="sticky top-0 z-40 mb-4 p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 border border-cyan-500/20 backdrop-blur-xl shadow-lg"
    >
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <p className="font-semibold text-white">
              {selectedCount} {selectedCount === 1 ? "goal" : "goals"} selected
            </p>
            <p className="text-xs text-slate-400">Bulk actions available</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onBulkUpdateStatus("active")}
            disabled={isProcessing}
            className="px-3 py-2 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm font-medium cursor-pointer"
          >
            <Play className="w-4 h-4" />
            Activate
          </button>
          <button
            onClick={() => onBulkUpdateStatus("paused")}
            disabled={isProcessing}
            className="px-3 py-2 rounded-lg bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm font-medium cursor-pointer"
          >
            <Pause className="w-4 h-4" />
            Pause
          </button>
          <button
            onClick={() => onBulkUpdateStatus("completed")}
            disabled={isProcessing}
            className="px-3 py-2 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm font-medium cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            Complete
          </button>
          <div className="w-px h-6 bg-white/10" />
          <button
            onClick={onBulkDelete}
            disabled={isProcessing}
            className="px-3 py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm font-medium cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
          <button
            onClick={onClearSelection}
            disabled={isProcessing}
            className="px-3 py-2 rounded-lg bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

