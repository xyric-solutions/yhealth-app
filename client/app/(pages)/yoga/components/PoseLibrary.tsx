"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { Search, Filter, Loader2, X, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { poseService } from "@/src/shared/services/yoga.service";
import type {
  YogaPose,
  PoseCategory,
  PoseDifficulty,
} from "@shared/types/domain/yoga";
import PoseCard from "./PoseCard";
import PoseDetailSidebar from "./PoseDetailSidebar";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES: { value: PoseCategory; label: string; icon: string }[] = [
  { value: "standing", label: "Standing", icon: "🧍" },
  { value: "seated", label: "Seated", icon: "🧘" },
  { value: "supine", label: "Supine", icon: "🛌" },
  { value: "prone", label: "Prone", icon: "🤸" },
  { value: "inversion", label: "Inversion", icon: "🙃" },
  { value: "balance", label: "Balance", icon: "⚖️" },
  { value: "twist", label: "Twist", icon: "🔄" },
  { value: "backbend", label: "Backbend", icon: "🌊" },
  { value: "forward_fold", label: "Forward Fold", icon: "🙇" },
  { value: "hip_opener", label: "Hip Opener", icon: "🦋" },
  { value: "restorative", label: "Restorative", icon: "🌿" },
];

const DIFFICULTIES: {
  value: PoseDifficulty;
  label: string;
  activeClasses: string;
  dot: string;
}[] = [
  {
    value: "beginner",
    label: "Beginner",
    activeClasses:
      "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-emerald-500/10 shadow-md",
    dot: "bg-emerald-400",
  },
  {
    value: "intermediate",
    label: "Intermediate",
    activeClasses:
      "bg-amber-500/15 text-amber-300 border-amber-500/30 shadow-amber-500/10 shadow-md",
    dot: "bg-amber-400",
  },
  {
    value: "advanced",
    label: "Advanced",
    activeClasses:
      "bg-red-500/15 text-red-300 border-red-500/30 shadow-red-500/10 shadow-md",
    dot: "bg-red-400",
  },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ResultCounter({
  count,
  loading,
}: {
  count: number;
  loading: boolean;
}) {
  return (
    <motion.div
      layout
      className="flex items-center gap-2 text-[13px] text-zinc-500"
    >
      <AnimatePresence mode="popLayout">
        <motion.span
          key={count}
          initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="tabular-nums font-semibold text-zinc-300"
        >
          {loading ? "--" : count}
        </motion.span>
      </AnimatePresence>
      <span className="text-zinc-600">
        {count === 1 ? "pose" : "poses"} found
      </span>
    </motion.div>
  );
}

function EmptyState({
  hasFilters,
  onClear,
}: {
  hasFilters: boolean;
  onClear: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center py-20 sm:py-28"
    >
      {/* Decorative circles */}
      <div className="relative mb-6">
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.15, 0.25, 0.15],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 -m-8 rounded-full bg-emerald-500/10 blur-2xl"
        />
        <div className="relative flex items-center justify-center h-20 w-20 rounded-full bg-white/3 border border-white/6">
          <Search className="h-8 w-8 text-zinc-600" />
        </div>
      </div>

      <h3 className="text-[15px] font-semibold text-zinc-300 mb-1">
        No poses found
      </h3>
      <p className="text-[13px] text-zinc-600 text-center max-w-70 mb-4">
        Try adjusting your search or filters to discover more poses.
      </p>

      {hasFilters && (
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onClear}
          className={cn(
            "text-[12px] font-medium px-4 py-2 rounded-xl",
            "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20",
            "hover:bg-emerald-500/20 transition-colors duration-200"
          )}
        >
          Clear all filters
        </motion.button>
      )}
    </motion.div>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.05, duration: 0.4 }}
          className="rounded-2xl border border-white/4 bg-white/2 overflow-hidden"
        >
          <div className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <div className="h-4 w-3/4 rounded-lg bg-white/4 animate-pulse" />
                <div className="h-3 w-1/2 rounded-md bg-white/3 animate-pulse" />
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <div className="h-6 w-16 rounded-lg bg-white/4 animate-pulse" />
              <div className="h-6 w-20 rounded-lg bg-white/3 animate-pulse" />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function PoseLibrary() {
  const [poses, setPoses] = useState<YogaPose[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<PoseCategory | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] =
    useState<PoseDifficulty | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sidebar state
  const [selectedPose, setSelectedPose] = useState<YogaPose | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSelectPose = useCallback((pose: YogaPose) => {
    setSelectedPose(pose);
    setSidebarOpen(true);
  }, []);

  // Debounce search
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
  }, []);

  // Fetch poses
  useEffect(() => {
    let cancelled = false;
    async function fetchPoses() {
      setLoading(true);
      try {
        const res = await poseService.listPoses({
          category: selectedCategory ?? undefined,
          difficulty: selectedDifficulty ?? undefined,
          search: debouncedSearch || undefined,
        });
        if (!cancelled && res.data?.poses) {
          setPoses(res.data.poses);
        }
      } catch {
        // Silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchPoses();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, selectedCategory, selectedDifficulty]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const hasFilters =
    selectedCategory !== null ||
    selectedDifficulty !== null ||
    searchQuery.length > 0;

  const clearFilters = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setSelectedCategory(null);
    setSelectedDifficulty(null);
    searchInputRef.current?.focus();
  };

  return (
    <div className="space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* Search bar                                                        */}
      {/* ----------------------------------------------------------------- */}
      <div className="relative group/search">
        {/* Glow ring on focus */}
        <motion.div
          animate={{
            opacity: searchFocused ? 1 : 0,
            scale: searchFocused ? 1 : 0.98,
          }}
          transition={{ duration: 0.3 }}
          className="absolute -inset-px rounded-2xl bg-linear-to-r from-emerald-500/20 via-sky-500/20 to-emerald-500/20 blur-sm pointer-events-none"
        />

        <div
          className={cn(
            "relative flex items-center rounded-2xl overflow-hidden transition-all duration-300",
            "bg-white/3 backdrop-blur-xl",
            "border",
            searchFocused
              ? "border-emerald-500/30 shadow-lg shadow-emerald-500/5"
              : "border-white/6 hover:border-white/10"
          )}
        >
          <Search
            className={cn(
              "ml-4 h-4 w-4 shrink-0 transition-colors duration-200",
              searchFocused ? "text-emerald-400" : "text-zinc-600"
            )}
          />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search poses by name, Sanskrit, or keyword..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className={cn(
              "flex-1 bg-transparent px-3 py-3 text-[14px] text-white/90 placeholder-zinc-600",
              "focus:outline-none"
            )}
            aria-label="Search yoga poses"
          />

          {/* Loading spinner in search */}
          <AnimatePresence>
            {loading && debouncedSearch && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="mr-2"
              >
                <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Clear button */}
          <AnimatePresence>
            {searchQuery && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                onClick={() => handleSearchChange("")}
                className="mr-3 p-1 rounded-lg hover:bg-white/6 text-zinc-500 hover:text-zinc-300 transition-colors"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Filters                                                           */}
      {/* ----------------------------------------------------------------- */}
      <div className="space-y-3">
        {/* Category filter row */}
        <div className="flex items-start gap-3">
          <div className="flex items-center gap-1.5 shrink-0 pt-1">
            <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-600" />
            <span className="text-[11px] font-medium text-zinc-600 uppercase tracking-wider hidden sm:inline">
              Category
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.value;
              return (
                <motion.button
                  key={cat.value}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() =>
                    setSelectedCategory(isActive ? null : cat.value)
                  }
                  className={cn(
                    "px-2.5 py-1.5 rounded-xl text-[11px] font-medium border transition-all duration-200",
                    isActive
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-md shadow-emerald-500/10"
                      : "bg-white/3 text-zinc-500 border-white/6 hover:text-zinc-300 hover:border-white/10 hover:bg-white/5"
                  )}
                  aria-pressed={isActive}
                  aria-label={`Filter by ${cat.label} category`}
                >
                  <span className="mr-1 text-xs">{cat.icon}</span>
                  {cat.label}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Difficulty filter row + controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 shrink-0">
            <Filter className="h-3.5 w-3.5 text-zinc-600" />
            <span className="text-[11px] font-medium text-zinc-600 uppercase tracking-wider hidden sm:inline">
              Level
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {DIFFICULTIES.map((diff) => {
              const isActive = selectedDifficulty === diff.value;
              return (
                <motion.button
                  key={diff.value}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() =>
                    setSelectedDifficulty(isActive ? null : diff.value)
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium border transition-all duration-200",
                    isActive
                      ? diff.activeClasses
                      : "bg-white/3 text-zinc-500 border-white/6 hover:text-zinc-300 hover:border-white/10 hover:bg-white/5"
                  )}
                  aria-pressed={isActive}
                  aria-label={`Filter by ${diff.label} difficulty`}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full transition-colors",
                      isActive ? diff.dot : "bg-zinc-600"
                    )}
                  />
                  {diff.label}
                </motion.button>
              );
            })}

            {/* Clear all */}
            <AnimatePresence>
              {hasFilters && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9, width: 0 }}
                  animate={{ opacity: 1, scale: 1, width: "auto" }}
                  exit={{ opacity: 0, scale: 0.9, width: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={clearFilters}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-medium",
                    "text-zinc-600 hover:text-zinc-300 hover:bg-white/4",
                    "transition-colors duration-200 overflow-hidden whitespace-nowrap"
                  )}
                >
                  <X className="h-3 w-3" />
                  Clear all
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Result counter                                                    */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex items-center justify-between">
        <ResultCounter count={poses.length} loading={loading} />
        {loading && (
          <Loader2 className="h-4 w-4 animate-spin text-zinc-600" />
        )}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Results grid                                                      */}
      {/* ----------------------------------------------------------------- */}
      {loading && poses.length === 0 ? (
        <LoadingGrid />
      ) : poses.length === 0 ? (
        <EmptyState hasFilters={hasFilters} onClear={clearFilters} />
      ) : (
        <LayoutGroup>
          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          >
            <AnimatePresence mode="popLayout">
              {poses.map((pose, i) => (
                <PoseCard
                  key={pose.id}
                  pose={pose}
                  index={i}
                  isSelected={selectedPose?.id === pose.id}
                  onSelect={handleSelectPose}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        </LayoutGroup>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Pose Detail Sidebar                                               */}
      {/* ----------------------------------------------------------------- */}
      <PoseDetailSidebar
        pose={selectedPose}
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
      />
    </div>
  );
}
