"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Sparkles, Search } from "lucide-react";
import type { YogaPose } from "@shared/types/domain/yoga";
import { poseService } from "@/src/shared/services/yoga.service";

const DIFFICULTY_COLOURS: Record<string, string> = {
  beginner: "bg-green-500/20 text-green-400",
  intermediate: "bg-amber-500/20 text-amber-400",
  advanced: "bg-red-500/20 text-red-400",
};

const DIFFICULTY_ORDER: Record<string, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

interface PoseSelectorProps {
  selectedPose: YogaPose | null;
  onSelect: (pose: YogaPose) => void;
  disabled?: boolean;
}

export default function PoseSelector({
  selectedPose,
  onSelect,
  disabled = false,
}: PoseSelectorProps) {
  const [poses, setPoses] = useState<YogaPose[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchPoses() {
      try {
        const res = await poseService.listPoses({ limit: 100 });
        if (res.success && res.data) {
          // Show ALL poses — Gemini Vision can coach any pose visually,
          // and client has FALLBACK_POSE_TARGETS for scoring
          const sorted = [...res.data.poses].sort((a, b) => {
            const da = DIFFICULTY_ORDER[a.difficulty] ?? 1;
            const db = DIFFICULTY_ORDER[b.difficulty] ?? 1;
            if (da !== db) return da - db;
            return a.englishName.localeCompare(b.englishName);
          });
          setPoses(sorted);
        }
      } catch {
        // Fallback — will use client-side targets
      } finally {
        setLoading(false);
      }
    }
    fetchPoses();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return poses;
    const q = search.toLowerCase();
    return poses.filter(
      (p) =>
        p.englishName.toLowerCase().includes(q) ||
        p.sanskritName?.toLowerCase().includes(q) ||
        p.difficulty.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
    );
  }, [poses, search]);

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left backdrop-blur-sm transition-all hover:border-emerald-500/30 hover:bg-white/8 disabled:opacity-50"
      >
        <div className="flex items-center gap-3">
          <Sparkles className="h-4 w-4 text-emerald-400" />
          {selectedPose ? (
            <div>
              <p className="text-sm font-medium text-white">
                {selectedPose.englishName}
              </p>
              {selectedPose.sanskritName && (
                <p className="text-xs text-white/40">{selectedPose.sanskritName}</p>
              )}
            </div>
          ) : (
            <span className="text-sm text-white/50">
              {loading ? "Loading poses..." : "Select a pose to practice"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {poses.length > 0 && (
            <span className="text-[10px] text-white/30">{poses.length} poses</span>
          )}
          <ChevronDown
            className={`h-4 w-4 text-white/40 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scaleY: 0.95 }}
            animate={{ opacity: 1, y: 0, scaleY: 1 }}
            exit={{ opacity: 0, y: -8, scaleY: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur-xl"
          >
            {/* Search */}
            <div className="sticky top-0 z-10 border-b border-white/5 bg-zinc-900/95 p-2">
              <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                <Search className="h-3.5 w-3.5 text-white/30" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search poses..."
                  className="w-full bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
                  autoFocus
                />
              </div>
            </div>

            {/* Pose list */}
            <div className="max-h-72 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-white/40">
                  No poses found
                </div>
              ) : (
                filtered.map((pose) => (
                  <button
                    key={pose.id}
                    onClick={() => {
                      onSelect(pose);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5 ${
                      selectedPose?.id === pose.id ? "bg-emerald-500/10" : ""
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-white">
                        {pose.englishName}
                      </p>
                      {pose.sanskritName && (
                        <p className="text-xs text-white/40">{pose.sanskritName}</p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        DIFFICULTY_COLOURS[pose.difficulty] || "bg-white/10 text-white/60"
                      }`}
                    >
                      {pose.difficulty}
                    </span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
