"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Database,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  adminExercisesService,
  type SyncResult,
} from "@/src/shared/services/admin-exercises.service";
import { toast } from "react-hot-toast";

// ============================================
// TYPES
// ============================================

interface SyncExercisesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSyncComplete: () => void;
}

type SyncSource = "exercisedb" | "musclewiki";

interface SourceOption {
  id: SyncSource;
  name: string;
  description: string;
  icon: React.ReactNode;
}

// ============================================
// CONSTANTS
// ============================================

const SYNC_SOURCES: SourceOption[] = [
  {
    id: "exercisedb",
    name: "ExerciseDB",
    description: "Comprehensive exercise database with 1300+ exercises",
    icon: <Database className="w-5 h-5" />,
  },
  {
    id: "musclewiki",
    name: "MuscleWiki",
    description: "Community-driven muscle and exercise reference",
    icon: <RefreshCw className="w-5 h-5" />,
  },
];

// ============================================
// HELPERS
// ============================================

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}

// ============================================
// COMPONENT
// ============================================

export function SyncExercisesModal({
  open,
  onOpenChange,
  onSyncComplete,
}: SyncExercisesModalProps) {
  const [source, setSource] = useState<SyncSource>("exercisedb");
  const [dryRun, setDryRun] = useState(false);
  const [limit, setLimit] = useState<string>("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);

  const handleStartSync = async () => {
    setIsSyncing(true);
    setResult(null);

    try {
      const options: { dryRun?: boolean; limit?: number } = {};
      if (dryRun) options.dryRun = true;
      const parsedLimit = parseInt(limit);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        options.limit = parsedLimit;
      }

      const response = await adminExercisesService.sync(source, options);

      if (response.data) {
        setResult(response.data);
        if (dryRun) {
          toast.success("Dry run completed -- no changes were made");
        } else {
          toast.success(
            `Sync complete: ${response.data.inserted} inserted, ${response.data.updated} updated`
          );
        }
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Sync failed";
      toast.error(message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClose = (isOpen: boolean) => {
    if (!isSyncing) {
      if (!isOpen && result && !dryRun) {
        onSyncComplete();
      }
      setResult(null);
      setDryRun(false);
      setLimit("");
      onOpenChange(isOpen);
    }
  };

  const selectedSource = SYNC_SOURCES.find((s) => s.id === source);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg bg-slate-900 border-white/10">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-violet-400" />
            Sync Exercises
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          {/* -------------------------------- */}
          {/* Source Selection                 */}
          {/* -------------------------------- */}
          <div className="space-y-3">
            <Label className="text-white text-sm font-medium">Source</Label>
            <div className="grid grid-cols-2 gap-3">
              {SYNC_SOURCES.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={isSyncing}
                  onClick={() => setSource(opt.id)}
                  className={`relative flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all ${
                    source === opt.id
                      ? "border-violet-500/50 bg-violet-500/10 text-violet-300"
                      : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:bg-white/10"
                  } ${isSyncing ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                >
                  {source === opt.id && (
                    <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-violet-400" />
                  )}
                  <div
                    className={
                      source === opt.id ? "text-violet-400" : "text-slate-500"
                    }
                  >
                    {opt.icon}
                  </div>
                  <span className="text-sm font-medium">{opt.name}</span>
                  <span className="text-xs text-slate-500 leading-tight">
                    {opt.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* -------------------------------- */}
          {/* Options                          */}
          {/* -------------------------------- */}
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-4">
              <div>
                <Label
                  htmlFor="sync-dry-run"
                  className="text-white font-medium"
                >
                  Dry Run
                </Label>
                <p className="text-xs text-slate-400 mt-0.5">
                  Preview changes without writing to the database
                </p>
              </div>
              <Switch
                id="sync-dry-run"
                checked={dryRun}
                onCheckedChange={setDryRun}
                disabled={isSyncing}
              />
            </div>

            <div>
              <Label htmlFor="sync-limit" className="text-white">
                Limit (optional)
              </Label>
              <Input
                id="sync-limit"
                type="number"
                min={1}
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                disabled={isSyncing}
                placeholder="No limit -- sync all exercises"
                className="bg-white/5 border-white/10 text-white mt-1"
              />
              <p className="text-xs text-slate-500 mt-1">
                Maximum number of exercises to fetch from the API
              </p>
            </div>
          </div>

          {/* -------------------------------- */}
          {/* Sync Action                      */}
          {/* -------------------------------- */}
          {!result && (
            <Button
              onClick={handleStartSync}
              disabled={isSyncing}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white h-11"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Syncing from {selectedSource?.name}...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Start Sync
                </>
              )}
            </Button>
          )}

          {/* -------------------------------- */}
          {/* Result Card                      */}
          {/* -------------------------------- */}
          {result && (
            <div className="rounded-xl border border-white/10 bg-slate-800/60 p-5 space-y-4">
              <div className="flex items-center gap-2">
                {result.failed > 0 ? (
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                )}
                <span className="text-sm font-semibold text-white">
                  {dryRun ? "Dry Run Results" : "Sync Complete"}
                </span>
                <span className="text-xs text-slate-500 ml-auto">
                  {formatDuration(result.durationMs)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
                  <p className="text-xl font-bold text-emerald-300">
                    {result.inserted}
                  </p>
                  <p className="text-xs text-emerald-400/70">Inserted</p>
                </div>
                <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3 text-center">
                  <p className="text-xl font-bold text-blue-300">
                    {result.updated}
                  </p>
                  <p className="text-xs text-blue-400/70">Updated</p>
                </div>
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-center">
                  <p className="text-xl font-bold text-red-300">
                    {result.failed}
                  </p>
                  <p className="text-xs text-red-400/70">Failed</p>
                </div>
                <div className="rounded-lg bg-slate-500/10 border border-slate-500/20 p-3 text-center">
                  <p className="text-xl font-bold text-slate-300">
                    {result.totalFetched}
                  </p>
                  <p className="text-xs text-slate-400/70">Total Fetched</p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-red-400">
                    Errors ({result.errors.length})
                  </p>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {result.errors.map((err, i) => (
                      <div
                        key={i}
                        className="text-xs text-red-300/80 bg-red-500/5 rounded px-2 py-1"
                      >
                        <span className="font-medium">
                          {err.exerciseName}:
                        </span>{" "}
                        {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={() => handleClose(false)}
                className="w-full bg-violet-600 hover:bg-violet-700 text-white"
              >
                Done
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
