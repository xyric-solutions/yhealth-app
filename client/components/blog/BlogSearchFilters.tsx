"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,

  Calendar,
  User,
  Tag,
  Eye,
  SlidersHorizontal,
} from "lucide-react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";

interface BlogSearchFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: string;
  onStatusChange: (status: string) => void;
  authorFilter?: string;
  onAuthorChange?: (author: string) => void;
  dateRange?: { from?: Date; to?: Date };
  onDateRangeChange?: (range: { from?: Date; to?: Date }) => void;
  categoryFilter?: string;
  onCategoryChange?: (category: string) => void;
  tagsFilter?: string[];
  onTagsChange?: (tags: string[]) => void;
  viewsRange?: { min?: number; max?: number };
  onViewsRangeChange?: (range: { min?: number; max?: number }) => void;
  onReset?: () => void;
  className?: string;
}

export function BlogSearchFilters({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  authorFilter,
  onAuthorChange,
  dateRange,
  onDateRangeChange,
  categoryFilter,
  onCategoryChange,
  tagsFilter,
  onTagsChange,
  viewsRange,
  onViewsRangeChange,
  onReset,
  className,
}: BlogSearchFiltersProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Debounce search
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
    (statusFilter !== "all" ? 1 : 0) +
    (authorFilter ? 1 : 0) +
    (dateRange?.from || dateRange?.to ? 1 : 0) +
    (categoryFilter ? 1 : 0) +
    (tagsFilter && tagsFilter.length > 0 ? 1 : 0) +
    (viewsRange?.min || viewsRange?.max ? 1 : 0);

  const handleReset = () => {
    setLocalSearch("");
    onSearchChange("");
    onStatusChange("all");
    onAuthorChange?.("");
    onDateRangeChange?.({});
    onCategoryChange?.("");
    onTagsChange?.([]);
    onViewsRangeChange?.({});
    onReset?.();
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search Bar */}
      <div className="relative group">
        <div className="absolute inset-0 rounded-xl bg-linear-to-r from-emerald-500/20 to-sky-500/20 blur-sm opacity-0 group-focus-within:opacity-100 transition-opacity duration-300" />
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-emerald-400 transition-colors" />
          <Input
            id="blog-search"
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search blogs by title, content, or author..."
            className="pl-11 pr-10 h-12 bg-slate-800/60 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-emerald-500/50 focus:ring-emerald-500/20 rounded-xl backdrop-blur-sm text-sm"
          />
          {localSearch && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => {
                setLocalSearch("");
                onSearchChange("");
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </motion.button>
          )}
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger className="w-[150px] h-10 bg-slate-800/60 border-slate-700/50 text-white rounded-xl backdrop-blur-sm hover:border-slate-600 transition-colors">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent
            position="popper"
            sideOffset={4}
            className="bg-slate-900 border-slate-700/60 rounded-xl shadow-xl shadow-black/20 text-white z-60"
          >
            <SelectItem value="all" className="text-slate-200 focus:bg-slate-800 focus:text-white rounded-lg cursor-pointer">All Status</SelectItem>
            <SelectItem value="draft" className="text-slate-200 focus:bg-slate-800 focus:text-white rounded-lg cursor-pointer">Draft</SelectItem>
            <SelectItem value="published" className="text-slate-200 focus:bg-slate-800 focus:text-white rounded-lg cursor-pointer">Published</SelectItem>
            <SelectItem value="archived" className="text-slate-200 focus:bg-slate-800 focus:text-white rounded-lg cursor-pointer">Archived</SelectItem>
          </SelectContent>
        </Select>

        {/* Advanced Filters Button */}
        <Popover open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "h-10 bg-slate-800/60 border-slate-700/50 text-white hover:bg-slate-700/60 rounded-xl backdrop-blur-sm transition-all",
                activeFiltersCount > 0 &&
                  "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
              )}
            >
              <SlidersHorizontal className="w-4 h-4 mr-2" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge className="ml-2 bg-linear-to-r from-emerald-500 to-sky-500 text-white text-[10px] px-1.5 py-0">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            sideOffset={4}
            className="w-80 bg-slate-900/95 border-slate-700/60 backdrop-blur-xl p-5 rounded-xl shadow-xl shadow-black/20 z-60"
            align="start"
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white text-sm">Advanced Filters</h3>
                {activeFiltersCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="text-xs text-emerald-400 hover:text-emerald-300 h-7"
                  >
                    Reset all
                  </Button>
                )}
              </div>

              {/* Author Filter */}
              {onAuthorChange && (
                <div className="space-y-2">
                  <Label className="text-xs text-slate-400 flex items-center gap-2 uppercase tracking-wider font-semibold">
                    <User className="w-3.5 h-3.5" />
                    Author
                  </Label>
                  <Input
                    value={authorFilter || ""}
                    onChange={(e) => onAuthorChange(e.target.value)}
                    placeholder="Filter by author..."
                    className="bg-slate-800/60 border-slate-700/50 text-white rounded-lg h-9 text-sm"
                  />
                </div>
              )}

              {/* Date Range */}
              {onDateRangeChange && (
                <div className="space-y-2">
                  <Label className="text-xs text-slate-400 flex items-center gap-2 uppercase tracking-wider font-semibold">
                    <Calendar className="w-3.5 h-3.5" />
                    Date Range
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start bg-slate-800/60 border-slate-700/50 text-white rounded-lg h-9 text-sm"
                      >
                        {dateRange?.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, "LLL dd, y")} -{" "}
                              {format(dateRange.to, "LLL dd, y")}
                            </>
                          ) : (
                            format(dateRange.from, "LLL dd, y")
                          )
                        ) : (
                          <span className="text-slate-500">Pick a date range</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0 bg-slate-900 border-slate-700/60 rounded-xl shadow-xl"
                      align="start"
                    >
                      <CalendarComponent
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={{
                          from: dateRange?.from,
                          to: dateRange?.to,
                        }}
                        onSelect={(range) =>
                          onDateRangeChange({
                            from: range?.from,
                            to: range?.to,
                          })
                        }
                        numberOfMonths={2}
                        className="bg-slate-900"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {/* Category Filter */}
              {onCategoryChange && (
                <div className="space-y-2">
                  <Label className="text-xs text-slate-400 flex items-center gap-2 uppercase tracking-wider font-semibold">
                    <Tag className="w-3.5 h-3.5" />
                    Category
                  </Label>
                  <Input
                    value={categoryFilter || ""}
                    onChange={(e) => onCategoryChange(e.target.value)}
                    placeholder="Filter by category..."
                    className="bg-slate-800/60 border-slate-700/50 text-white rounded-lg h-9 text-sm"
                  />
                </div>
              )}

              {/* Views Range */}
              {onViewsRangeChange && (
                <div className="space-y-2">
                  <Label className="text-xs text-slate-400 flex items-center gap-2 uppercase tracking-wider font-semibold">
                    <Eye className="w-3.5 h-3.5" />
                    Views Range
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={viewsRange?.min || ""}
                      onChange={(e) =>
                        onViewsRangeChange({
                          min: e.target.value ? parseInt(e.target.value) : undefined,
                          max: viewsRange?.max,
                        })
                      }
                      placeholder="Min"
                      className="bg-slate-800/60 border-slate-700/50 text-white rounded-lg h-9 text-sm"
                    />
                    <span className="text-slate-500 text-xs">to</span>
                    <Input
                      type="number"
                      value={viewsRange?.max || ""}
                      onChange={(e) =>
                        onViewsRangeChange({
                          min: viewsRange?.min,
                          max: e.target.value ? parseInt(e.target.value) : undefined,
                        })
                      }
                      placeholder="Max"
                      className="bg-slate-800/60 border-slate-700/50 text-white rounded-lg h-9 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Reset Button */}
        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-slate-400 hover:text-white h-10 rounded-xl"
          >
            <X className="w-4 h-4 mr-1" />
            Clear all
          </Button>
        )}
      </div>

      {/* Active Filter Badges */}
      <AnimatePresence>
        {activeFiltersCount > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-2"
          >
            {statusFilter !== "all" && (
              <Badge
                variant="secondary"
                className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-lg px-3 py-1"
              >
                Status: {statusFilter}
                <button
                  onClick={() => onStatusChange("all")}
                  className="ml-2 hover:text-white transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
            {authorFilter && (
              <Badge
                variant="secondary"
                className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-lg px-3 py-1"
              >
                Author: {authorFilter}
                <button
                  onClick={() => onAuthorChange?.("")}
                  className="ml-2 hover:text-white transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
            {(dateRange?.from || dateRange?.to) && (
              <Badge
                variant="secondary"
                className="bg-sky-500/10 text-sky-300 border border-sky-500/20 rounded-lg px-3 py-1"
              >
                Date: {dateRange.from && format(dateRange.from, "MMM dd")}
                {dateRange.to && ` - ${format(dateRange.to, "MMM dd")}`}
                <button
                  onClick={() => onDateRangeChange?.({})}
                  className="ml-2 hover:text-white transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
            {categoryFilter && (
              <Badge
                variant="secondary"
                className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-lg px-3 py-1"
              >
                Category: {categoryFilter}
                <button
                  onClick={() => onCategoryChange?.("")}
                  className="ml-2 hover:text-white transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
            {(viewsRange?.min || viewsRange?.max) && (
              <Badge
                variant="secondary"
                className="bg-sky-500/10 text-sky-300 border border-sky-500/20 rounded-lg px-3 py-1"
              >
                Views: {viewsRange.min || 0} - {viewsRange.max || "\u221e"}
                <button
                  onClick={() => onViewsRangeChange?.({})}
                  className="ml-2 hover:text-white transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

