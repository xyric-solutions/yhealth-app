"use client";

import { motion } from "framer-motion";
import { Trash2, UserCheck, UserX, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UserBulkActionsToolbarProps {
  selectedCount: number;
  onBulkDelete: () => void;
  onBulkActivate: () => void;
  onBulkDeactivate: () => void;
  isLoading: boolean;
  onClearSelection: () => void;
}

export function UserBulkActionsToolbar({
  selectedCount,
  onBulkDelete,
  onBulkActivate,
  onBulkDeactivate,
  isLoading,
  onClearSelection,
}: UserBulkActionsToolbarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 backdrop-blur-sm p-3 px-4 flex items-center justify-between gap-4"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-bold">
          {selectedCount}
        </div>
        <span className="text-sm font-medium text-emerald-200">
          user{selectedCount !== 1 ? "s" : ""} selected
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
            <UserCheck className="w-3.5 h-3.5 mr-1.5" />
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
            <UserX className="w-3.5 h-3.5 mr-1.5" />
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
