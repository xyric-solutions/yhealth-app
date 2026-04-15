"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  SlidersHorizontal,
  X,
  ChevronDown,
  LayoutGrid,
  List,
  Brain,
} from "lucide-react";
import { exercisesService, type ExerciseFilterOptions } from "@/src/shared/services/exercises.service";

export interface ActiveFilters {
  search: string;
  category: string;
  muscle: string;
  equipment: string;
  difficulty: string;
  bodyPart: string;
}

interface ExerciseFiltersProps {
  filters: ActiveFilters;
  onFilterChange: (filters: ActiveFilters) => void;
  totalResults: number;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
}

function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (val: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayValue = value || label;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition-all duration-300 whitespace-nowrap ${
          value
            ? "bg-emerald-600/15 border-emerald-500/30 text-emerald-300 shadow-sm shadow-emerald-500/10"
            : "bg-slate-800/80 border-white/[0.06] text-slate-400 hover:text-white hover:border-white/10 hover:bg-slate-800"
        }`}
      >
        <span className="capitalize">{displayValue}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full mt-2 left-0 z-50 min-w-[200px] max-h-64 overflow-y-auto rounded-xl bg-slate-900/95 backdrop-blur-2xl border border-white/[0.08] shadow-2xl shadow-black/50 scrollbar-thin scrollbar-thumb-slate-700"
          >
            {/* Gradient top accent */}
            <div className="h-[1px] bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />

            <div className="p-1.5">
              <button
                onClick={() => { onChange(""); setIsOpen(false); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                  !value ? "bg-emerald-600/15 text-emerald-300" : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                All {label}s
              </button>
              {options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => { onChange(opt); setIsOpen(false); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm capitalize transition-all duration-200 ${
                    value === opt
                      ? "bg-emerald-600/15 text-emerald-300"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ExerciseFilters({
  filters,
  onFilterChange,
  totalResults,
  viewMode,
  onViewModeChange,
}: ExerciseFiltersProps) {
  const [filterOptions, setFilterOptions] = useState<ExerciseFilterOptions | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    exercisesService.getFilters().then((res) => {
      if (res.success && res.data) {
        setFilterOptions(res.data);
      }
    });
  }, []);

  const handleSearchChange = useCallback(
    (value: string) => {
      onFilterChange({ ...filters, search: value });
    },
    [filters, onFilterChange]
  );

  const handleFilterChange = useCallback(
    (key: keyof ActiveFilters, value: string) => {
      onFilterChange({ ...filters, [key]: value });
    },
    [filters, onFilterChange]
  );

  const clearAllFilters = () => {
    onFilterChange({
      search: "",
      category: "",
      muscle: "",
      equipment: "",
      difficulty: "",
      bodyPart: "",
    });
  };

  const hasActiveFilters =
    filters.category || filters.muscle || filters.equipment || filters.difficulty || filters.bodyPart;

  const activeFilterCount = [filters.category, filters.muscle, filters.equipment, filters.difficulty, filters.bodyPart].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Top row: Search + Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Premium Search Input */}
        <div className="relative flex-1 group">
          {/* Gradient glow behind search on focus */}
          <motion.div
            animate={{ opacity: isFocused ? 0.15 : 0 }}
            transition={{ duration: 0.3 }}
            className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 blur-xl pointer-events-none"
          />

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
            <input
              ref={searchInputRef}
              type="text"
              value={filters.search}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Search 1,500+ exercises with AI..."
              className="w-full pl-11 pr-10 py-3 rounded-xl bg-slate-900/90 backdrop-blur-xl border border-white/[0.08] text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/30 transition-all duration-300"
            />
            {filters.search ? (
              <button
                onClick={() => handleSearchChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            ) : (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-md bg-slate-800 border border-white/[0.06] text-[10px] text-slate-500 font-mono">
                AI
              </div>
            )}
          </div>
        </div>

        {/* Filter toggle + View mode */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border transition-all duration-300 ${
              showFilters || hasActiveFilters
                ? "bg-emerald-600/15 border-emerald-500/30 text-emerald-300 shadow-sm shadow-emerald-500/10"
                : "bg-slate-900/80 border-white/[0.06] text-slate-400 hover:text-white hover:border-white/10"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-[10px] font-bold shadow-sm shadow-emerald-500/30">
                {activeFilterCount}
              </span>
            )}
          </button>

          <div className="flex items-center rounded-xl bg-slate-900/80 border border-white/[0.06] p-1">
            <button
              onClick={() => onViewModeChange("grid")}
              className={`p-2 rounded-lg transition-all duration-300 ${
                viewMode === "grid"
                  ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm shadow-emerald-500/30"
                  : "text-slate-500 hover:text-white"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewModeChange("list")}
              className={`p-2 rounded-lg transition-all duration-300 ${
                viewMode === "list"
                  ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm shadow-emerald-500/30"
                  : "text-slate-500 hover:text-white"
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter dropdowns row */}
      <AnimatePresence>
        {showFilters && filterOptions && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex flex-wrap items-center gap-2 pb-2">
              <FilterDropdown
                label="Category"
                value={filters.category}
                options={filterOptions.categories}
                onChange={(v) => handleFilterChange("category", v)}
              />
              <FilterDropdown
                label="Muscle"
                value={filters.muscle}
                options={filterOptions.muscles}
                onChange={(v) => handleFilterChange("muscle", v)}
              />
              <FilterDropdown
                label="Equipment"
                value={filters.equipment}
                options={filterOptions.equipment}
                onChange={(v) => handleFilterChange("equipment", v)}
              />
              <FilterDropdown
                label="Difficulty"
                value={filters.difficulty}
                options={filterOptions.difficulties}
                onChange={(v) => handleFilterChange("difficulty", v)}
              />
              <FilterDropdown
                label="Body Part"
                value={filters.bodyPart}
                options={filterOptions.bodyParts}
                onChange={(v) => handleFilterChange("bodyPart", v)}
              />

              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear all
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results count */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Brain className="w-3.5 h-3.5 text-emerald-400" />
        <span>
          <span className="text-white font-medium">{totalResults.toLocaleString()}</span> exercises found
        </span>
        {hasActiveFilters && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            filtered
          </span>
        )}
      </div>
    </div>
  );
}
