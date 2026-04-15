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

interface UserSearchFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  roleFilter: string;
  onRoleChange: (role: string) => void;
  statusFilter: string;
  onStatusChange: (status: string) => void;
  verifiedFilter: string;
  onVerifiedChange: (verified: string) => void;
  className?: string;
}

export function UserSearchFilters({
  searchQuery,
  onSearchChange,
  roleFilter,
  onRoleChange,
  statusFilter,
  onStatusChange,
  verifiedFilter,
  onVerifiedChange,
  className,
}: UserSearchFiltersProps) {
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
    (roleFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (verifiedFilter !== "all" ? 1 : 0);

  const handleReset = () => {
    setLocalSearch("");
    onSearchChange("");
    onRoleChange("all");
    onStatusChange("all");
    onVerifiedChange("all");
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            id="user-search"
            type="text"
            placeholder="Search users by name, email, or phone..."
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

      {/* Advanced Filters */}
      <motion.div
        initial={false}
        animate={{
          height: isFiltersOpen ? "auto" : 0,
          opacity: isFiltersOpen ? 1 : 0,
        }}
        transition={{ duration: 0.2 }}
        className="overflow-hidden"
      >
        {isFiltersOpen && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm">
            {/* Role Filter */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Role
              </label>
              <Select value={roleFilter} onValueChange={onRoleChange}>
                <SelectTrigger className="w-full bg-slate-800/60 border-slate-700/50 text-white">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="doctor">Doctor</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="patient">Patient</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Status
              </label>
              <Select value={statusFilter} onValueChange={onStatusChange}>
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

            {/* Verified Filter */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Email Verified
              </label>
              <Select value={verifiedFilter} onValueChange={onVerifiedChange}>
                <SelectTrigger className="w-full bg-slate-800/60 border-slate-700/50 text-white">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                  <SelectItem value="unverified">Unverified</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
