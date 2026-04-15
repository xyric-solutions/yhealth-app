"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ExerciseSearchFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  categoryFilter: string;
  onCategoryChange: (val: string) => void;
  difficultyFilter: string;
  onDifficultyChange: (val: string) => void;
  sourceFilter: string;
  onSourceChange: (val: string) => void;
  activeFilter: string;
  onActiveChange: (val: string) => void;
  className?: string;
}

export function ExerciseSearchFilters({
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  difficultyFilter,
  onDifficultyChange,
  sourceFilter,
  onSourceChange,
  activeFilter,
  onActiveChange,
  className,
}: ExerciseSearchFiltersProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localSearch);
    }, 300);

    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange]);

  // Sync with external search query
  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  const activeFiltersCount =
    (categoryFilter !== "all" ? 1 : 0) +
    (difficultyFilter !== "all" ? 1 : 0) +
    (sourceFilter !== "all" ? 1 : 0) +
    (activeFilter !== "all" ? 1 : 0);

  const handleReset = () => {
    setLocalSearch("");
    onSearchChange("");
    onCategoryChange("all");
    onDifficultyChange("all");
    onSourceChange("all");
    onActiveChange("all");
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            id="exercise-search"
            type="text"
            placeholder="Search exercises..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-10 bg-slate-900/40 border-slate-800/60 text-white placeholder:text-slate-500 focus:border-violet-500/50"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setIsFiltersOpen(!isFiltersOpen)}
          className={cn(
            "bg-slate-900/40 border-slate-800/60 text-slate-300 hover:bg-slate-800/60 hover:text-white",
            isFiltersOpen &&
              "bg-violet-500/10 border-violet-500/50 text-violet-300"
          )}
        >
          <SlidersHorizontal className="w-4 h-4 mr-2" />
          Filters
          {activeFiltersCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-2 bg-violet-500/20 text-violet-300 border-violet-500/30"
            >
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4 mr-1" />
            Reset
          </Button>
        )}
      </div>

      {/* Advanced Filters */}
      <AnimatePresence initial={false}>
        {isFiltersOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm">
              {/* Category Filter */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Category
                </label>
                <Select
                  value={categoryFilter}
                  onValueChange={onCategoryChange}
                >
                  <SelectTrigger className="w-full bg-slate-800/60 border-slate-700/50 text-white">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="strength">Strength</SelectItem>
                    <SelectItem value="cardio">Cardio</SelectItem>
                    <SelectItem value="flexibility">Flexibility</SelectItem>
                    <SelectItem value="balance">Balance</SelectItem>
                    <SelectItem value="plyometric">Plyometric</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Difficulty Filter */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Difficulty
                </label>
                <Select
                  value={difficultyFilter}
                  onValueChange={onDifficultyChange}
                >
                  <SelectTrigger className="w-full bg-slate-800/60 border-slate-700/50 text-white">
                    <SelectValue placeholder="All Difficulties" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    <SelectItem value="all">All Difficulties</SelectItem>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Source Filter */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Source
                </label>
                <Select value={sourceFilter} onValueChange={onSourceChange}>
                  <SelectTrigger className="w-full bg-slate-800/60 border-slate-700/50 text-white">
                    <SelectValue placeholder="All Sources" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="exercisedb">ExerciseDB</SelectItem>
                    <SelectItem value="musclewiki">MuscleWiki</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Status
                </label>
                <Select value={activeFilter} onValueChange={onActiveChange}>
                  <SelectTrigger className="w-full bg-slate-800/60 border-slate-700/50 text-white">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-800">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
