"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useRef } from "react";
import { Dumbbell, AlertCircle, ChevronLeft, ChevronRight, Brain, Sparkles } from "lucide-react";
import {
  exercisesService,
  type ExerciseListItem,
} from "@/src/shared/services/exercises.service";
import {
  ExerciseCard,
  ExerciseFilters,
  ExerciseListRow,
  ExerciseStatsHeader,
  type ActiveFilters,
} from "./components";

const ITEMS_PER_PAGE = 24;

export function ExercisesView() {
  const [exercises, setExercises] = useState<ExerciseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const [filters, setFilters] = useState<ActiveFilters>({
    search: "",
    category: "",
    muscle: "",
    equipment: "",
    difficulty: "",
    bodyPart: "",
  });

  const fetchExercises = useCallback(async (currentFilters: ActiveFilters, currentPage: number) => {
    setLoading(true);
    setError(null);

    try {
      let response;

      if (currentFilters.search.trim()) {
        response = await exercisesService.search({
          q: currentFilters.search.trim(),
          page: currentPage,
          limit: ITEMS_PER_PAGE,
          category: currentFilters.category || undefined,
          muscle: currentFilters.muscle || undefined,
          difficulty: currentFilters.difficulty || undefined,
        });
      } else {
        response = await exercisesService.list({
          page: currentPage,
          limit: ITEMS_PER_PAGE,
          category: currentFilters.category || undefined,
          muscle: currentFilters.muscle || undefined,
          equipment: currentFilters.equipment || undefined,
          difficulty: currentFilters.difficulty || undefined,
          bodyPart: currentFilters.bodyPart || undefined,
          sort: "name",
          order: "asc",
        });
      }

      if (response.success && response.data) {
        setExercises(response.data);
        if (response.meta) {
          setTotalPages(response.meta.totalPages);
          setTotalResults(response.meta.total);
        }
      } else {
        setError("Failed to load exercises");
      }
    } catch (_err) {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchExercises(filters, page);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced filter changes
  const handleFilterChange = useCallback(
    (newFilters: ActiveFilters) => {
      setFilters(newFilters);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(() => {
        setPage(1);
        fetchExercises(newFilters, 1);
      }, newFilters.search !== filters.search ? 400 : 100);
    },
    [fetchExercises, filters.search]
  );

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div ref={topRef} className="relative space-y-6">
      {/* Background mesh gradient decorations */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/[0.03] rounded-full blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-80 h-80 bg-teal-500/[0.03] rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-72 h-72 bg-emerald-500/[0.02] rounded-full blur-3xl" />
      </div>

      {/* Premium Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="space-y-3"
      >
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <Brain className="w-6 h-6 text-white" />
            </div>
            {/* Pulse dot */}
            <motion.div
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-950"
            />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Exercise Library
            </h1>
            <p className="text-sm text-slate-500 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              AI-powered exercise database with animated demos
            </p>
          </div>
        </div>
      </motion.div>

      {/* Stats Header */}
      <ExerciseStatsHeader />

      {/* Filters */}
      <ExerciseFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        totalResults={totalResults}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="relative">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-12 h-12 rounded-full border-2 border-transparent border-t-emerald-500 border-r-teal-500"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <Brain className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-4">Loading exercises...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <p className="text-sm text-slate-400 mb-4">{error}</p>
          <button
            onClick={() => fetchExercises(filters, page)}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-300"
          >
            Try Again
          </button>
        </motion.div>
      )}

      {/* Empty State */}
      {!loading && !error && exercises.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mb-4">
            <Dumbbell className="w-8 h-8 text-slate-600" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No exercises found</h3>
          <p className="text-sm text-slate-500 max-w-sm">
            Try adjusting your filters or search query to find exercises.
          </p>
        </motion.div>
      )}

      {/* Exercise Grid */}
      {!loading && !error && exercises.length > 0 && (
        <>
          <AnimatePresence mode="wait">
            {viewMode === "grid" ? (
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4"
              >
                {exercises.map((exercise, index) => (
                  <ExerciseCard
                    key={exercise.id}
                    exercise={exercise}
                    index={index}
                  />
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2"
              >
                {exercises.map((exercise, index) => (
                  <ExerciseListRow
                    key={exercise.id}
                    exercise={exercise}
                    index={index}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Premium Pagination */}
          {totalPages > 1 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center gap-2 pt-4"
            >
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-900/80 backdrop-blur-sm border border-white/[0.06] text-slate-400 hover:text-white hover:border-emerald-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300"
              >
                <ChevronLeft className="w-4 h-4" />
                Prev
              </button>

              <div className="flex items-center gap-1">
                {generatePageNumbers(page, totalPages).map((p, i) =>
                  p === "..." ? (
                    <span key={`dots-${i}`} className="px-2 text-slate-600">
                      ...
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => handlePageChange(p as number)}
                      className={`w-10 h-10 rounded-xl text-sm font-medium transition-all duration-300 ${
                        page === p
                          ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-600/30"
                          : "bg-slate-900/60 text-slate-500 hover:text-white hover:bg-slate-800 border border-white/[0.04]"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
              </div>

              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
                className="flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-slate-900/80 backdrop-blur-sm border border-white/[0.06] text-slate-400 hover:text-white hover:border-emerald-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}

function generatePageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [];

  if (current <= 3) {
    pages.push(1, 2, 3, 4, "...", total);
  } else if (current >= total - 2) {
    pages.push(1, "...", total - 3, total - 2, total - 1, total);
  } else {
    pages.push(1, "...", current - 1, current, current + 1, "...", total);
  }

  return pages;
}
