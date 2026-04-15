"use client";

import { motion } from "framer-motion";
import { Trash2, CheckCircle, XCircle, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExerciseBulkActionsToolbarProps {
  selectedCount: number;
  onBulkDelete: () => void;
  onBulkActivate: () => void;
  onBulkDeactivate: () => void;
  isLoading: boolean;
  onClearSelection: () => void;
}

export function ExerciseBulkActionsToolbar({
  selectedCount,
  onBulkDelete,
  onBulkActivate,
  onBulkDeactivate,
  isLoading,
  onClearSelection,
}: ExerciseBulkActionsToolbarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      className="rounded-xl bg-violet-500/5 border border-violet-500/20 backdrop-blur-sm p-3 px-4 flex items-center justify-between gap-4"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/20 text-violet-300 text-xs font-bold">
          {selectedCount}
        </div>
        <span className="text-sm font-medium text-violet-200">
          exercise{selectedCount !== 1 ? "s" : ""} selected
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          disabled={isLoading}
          className="text-slate-400 hover:text-white h-8 rounded-lg text-xs"
        >
          <X className="w-3.5 h-3.5 mr-1" />
          Clear
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onBulkActivate}
          disabled={isLoading}
          className="bg-emerald-500/10 border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20 h-8 rounded-lg text-xs"
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
          )}
          Activate
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onBulkDeactivate}
          disabled={isLoading}
          className="bg-slate-800/60 border-slate-700/50 text-slate-300 hover:bg-slate-700/60 h-8 rounded-lg text-xs"
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <XCircle className="w-3.5 h-3.5 mr-1.5" />
          )}
          Deactivate
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={onBulkDelete}
          disabled={isLoading}
          className="bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 h-8 rounded-lg text-xs"
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
          )}
          Delete
        </Button>
      </div>
    </motion.div>
  );
}
