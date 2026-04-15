"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, X, SlidersHorizontal } from "lucide-react";
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

interface RoleSearchFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isSystemFilter: string;
  onIsSystemChange: (value: string) => void;
  className?: string;
}

export function RoleSearchFilters({
  searchQuery,
  onSearchChange,
  isSystemFilter,
  onIsSystemChange,
  className,
}: RoleSearchFiltersProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, onSearchChange]);

  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  const activeFiltersCount = isSystemFilter !== "all" ? 1 : 0;

  const handleReset = () => {
    setLocalSearch("");
    onSearchChange("");
    onIsSystemChange("all");
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            id="role-search"
            type="text"
            placeholder="Search roles by name or slug..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-10 bg-slate-900/40 border-slate-800/60 text-white placeholder:text-slate-500 focus:border-emerald-500/50"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setIsFiltersOpen(!isFiltersOpen)}
          className={cn(
            "bg-slate-900/40 border-slate-800/60 text-slate-300 hover:bg-slate-800/60 hover:text-white",
            isFiltersOpen && "bg-emerald-500/10 border-emerald-500/50 text-emerald-300"
          )}
        >
          <SlidersHorizontal className="w-4 h-4 mr-2" />
          Filters
          {activeFiltersCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-2 bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
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

      <motion.div
        initial={false}
        animate={{ height: isFiltersOpen ? "auto" : 0, opacity: isFiltersOpen ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden"
      >
        {isFiltersOpen && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Type
              </label>
              <Select value={isSystemFilter} onValueChange={onIsSystemChange}>
                <SelectTrigger className="w-full bg-slate-800/60 border-slate-700/50 text-white">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="system">System Roles</SelectItem>
                  <SelectItem value="custom">Custom Roles</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
