"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, X, Dumbbell, Target, Zap } from "lucide-react";
import {
  exercisesService,
  type ExerciseListItem,
} from "@/src/shared/services/exercises.service";

interface ExerciseSearchInputProps {
  value: string;
  onChange: (name: string) => void;
  onExerciseSelect: (exercise: ExerciseListItem) => void;
  placeholder?: string;
}

const difficultyColors: Record<string, string> = {
  beginner: "text-emerald-400 bg-emerald-500/15",
  intermediate: "text-amber-400 bg-amber-500/15",
  advanced: "text-red-400 bg-red-500/15",
  expert: "text-purple-400 bg-purple-500/15",
};

export function ExerciseSearchInput({
  value,
  onChange,
  onExerciseSelect,
  placeholder = "Search exercises or type custom...",
}: ExerciseSearchInputProps) {
  const [results, setResults] = useState<ExerciseListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const query = value.trim();
    if (query.length < 2) {
      setResults([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const response = await exercisesService.search({ q: query, limit: 8 });
        if (response.success && response.data) {
          setResults(response.data);
          setIsOpen(response.data.length > 0);
          setActiveIndex(-1);
        }
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectExercise = useCallback(
    (exercise: ExerciseListItem) => {
      onExerciseSelect(exercise);
      setIsOpen(false);
      setResults([]);
      setActiveIndex(-1);
    },
    [onExerciseSelect]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || results.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) =>
          prev > 0 ? prev - 1 : results.length - 1
        );
      } else if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault();
        selectExercise(results[activeIndex]);
      } else if (e.key === "Escape") {
        setIsOpen(false);
      }
    },
    [isOpen, results, activeIndex, selectExercise]
  );

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          className="w-full pl-9 pr-8 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-orange-500"
          placeholder={placeholder}
        />
        {isLoading ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 animate-spin" />
        ) : value ? (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setResults([]);
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-slate-700 transition-colors"
          >
            <X className="w-3.5 h-3.5 text-slate-500" />
          </button>
        ) : null}
      </div>

      {/* Dropdown results */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 z-40 max-h-64 overflow-y-auto rounded-xl bg-slate-900 border border-slate-700 shadow-2xl shadow-black/50">
          {results.map((exercise, index) => {
            const thumbnailSrc =
              exercise.thumbnail_url || exercise.animation_url;
            const difficulty = difficultyColors[exercise.difficulty_level] || "";

            return (
              <button
                key={exercise.id}
                type="button"
                onClick={() => selectExercise(exercise)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                  index === activeIndex
                    ? "bg-orange-500/15"
                    : "hover:bg-slate-800"
                }`}
              >
                {/* Thumbnail */}
                <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-slate-800">
                  {thumbnailSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumbnailSrc}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Dumbbell className="w-4 h-4 text-slate-600" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {exercise.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-1 text-[11px] text-slate-500">
                      <Target className="w-2.5 h-2.5" />
                      {exercise.primary_muscle_group || exercise.body_part || "Full Body"}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-slate-500">
                      <Zap className="w-2.5 h-2.5" />
                      {exercise.default_sets}x{exercise.default_reps}
                    </span>
                  </div>
                </div>

                {/* Difficulty badge */}
                {exercise.difficulty_level && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 ${difficulty}`}
                  >
                    {exercise.difficulty_level}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
