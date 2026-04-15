"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Edit,
  Trash2,
  MoreVertical,
  AlertCircle,
  Grid3x3,
  List,
  ArrowUpDown,
  Dumbbell,
  RefreshCw,
  Target,
  Zap,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  Clock,
  Flame,
  ListOrdered,
  Lightbulb,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { formatDistanceToNow } from "date-fns";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";
import type { ExerciseListItem, ExerciseDetail } from "@/src/shared/services/exercises.service";
import {
  adminExercisesService,
  type AdminExerciseStats,
} from "@/src/shared/services/admin-exercises.service";
import { ExerciseSearchFilters } from "./components/ExerciseSearchFilters";
import { ExerciseBulkActionsToolbar } from "./components/ExerciseBulkActionsToolbar";
import { CreateEditExerciseModal } from "./components/CreateEditExerciseModal";
import { SyncExercisesModal } from "./components/SyncExercisesModal";

const difficultyColors: Record<string, { bg: string; text: string }> = {
  beginner: { bg: "bg-emerald-500/15", text: "text-emerald-400" },
  intermediate: { bg: "bg-amber-500/15", text: "text-amber-400" },
  advanced: { bg: "bg-red-500/15", text: "text-red-400" },
};

const sourceColors: Record<string, { bg: string; text: string }> = {
  exercisedb: { bg: "bg-blue-500/15", text: "text-blue-400" },
  musclewiki: { bg: "bg-purple-500/15", text: "text-purple-400" },
  manual: { bg: "bg-cyan-500/15", text: "text-cyan-400" },
  rapidapi: { bg: "bg-orange-500/15", text: "text-orange-400" },
};

// Stagger animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.1 },
  },
};

const rowVariants = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0, transition: { type: "spring" as const, stiffness: 300, damping: 30 } },
  exit: { opacity: 0, x: 20, transition: { duration: 0.2 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 260, damping: 24 } },
  exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } },
};

export default function AdminExercisesPage() {
  const [exercises, setExercises] = useState<ExerciseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [stats, setStats] = useState<AdminExerciseStats | null>(null);

  // Detail sidebar
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);

  // Modals
  const [createEditModalOpen, setCreateEditModalOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<ExerciseListItem | null>(null);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    variant: "danger" | "warning" | "info" | "success";
    onConfirm: () => void;
  }>({
    open: false,
    title: "",
    description: "",
    confirmLabel: "Confirm",
    variant: "danger",
    onConfirm: () => {},
  });

  const fetchExercises = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params: Record<string, string | number> = {
        page,
        limit,
        sort_by: sortBy,
        sort_order: sortOrder,
      };

      if (searchQuery) params.search = searchQuery;
      if (categoryFilter !== "all") params.category = categoryFilter;
      if (difficultyFilter !== "all") params.difficulty = difficultyFilter;
      if (sourceFilter !== "all") params.source = sourceFilter;
      if (activeFilter !== "all") params.is_active = activeFilter === "active" ? "true" : "false";

      const response = await adminExercisesService.list(params);

      if (response.success && response.data) {
        setExercises(response.data);
        if (response.meta) {
          setTotal(response.meta.total);
          setTotalPages(response.meta.totalPages);
        }
      } else {
        setError("Failed to load exercises");
      }
    } catch {
      setError("Failed to load exercises");
    } finally {
      setLoading(false);
    }
  }, [page, limit, searchQuery, categoryFilter, difficultyFilter, sourceFilter, activeFilter, sortBy, sortOrder]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await adminExercisesService.getStats();
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch {
      // Stats are non-critical
    }
  }, []);

  useEffect(() => {
    fetchExercises();
  }, [fetchExercises]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [searchQuery, categoryFilter, difficultyFilter, sourceFilter, activeFilter]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === exercises.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(exercises.map((e) => e.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleToggleActive = async (id: string) => {
    try {
      const response = await adminExercisesService.toggleActive(id);
      if (response.success) {
        toast.success("Status updated");
        fetchExercises();
        fetchStats();
      }
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleDelete = (exercise: ExerciseListItem) => {
    setConfirmModal({
      open: true,
      title: "Delete Exercise",
      description: `Are you sure you want to delete "${exercise.name}"? This action can be undone by an administrator.`,
      confirmLabel: "Delete",
      variant: "danger",
      onConfirm: async () => {
        try {
          await adminExercisesService.delete(exercise.id);
          toast.success("Exercise deleted");
          setConfirmModal((prev) => ({ ...prev, open: false }));
          fetchExercises();
          fetchStats();
        } catch {
          toast.error("Failed to delete exercise");
        }
      },
    });
  };

  const handleBulkDelete = () => {
    const count = selectedIds.size;
    setConfirmModal({
      open: true,
      title: "Bulk Delete Exercises",
      description: `Are you sure you want to delete ${count} exercise${count > 1 ? "s" : ""}?`,
      confirmLabel: `Delete ${count}`,
      variant: "danger",
      onConfirm: async () => {
        setIsBulkActionLoading(true);
        try {
          const response = await adminExercisesService.bulkDelete(Array.from(selectedIds));
          if (response.success) {
            toast.success(`${response.data?.deletedCount || count} exercises deleted`);
            setSelectedIds(new Set());
            fetchExercises();
            fetchStats();
          }
        } catch {
          toast.error("Failed to delete exercises");
        } finally {
          setIsBulkActionLoading(false);
          setConfirmModal((prev) => ({ ...prev, open: false }));
        }
      },
    });
  };

  const handleBulkToggleActive = async (isActive: boolean) => {
    setIsBulkActionLoading(true);
    try {
      const response = await adminExercisesService.bulkToggleActive(Array.from(selectedIds), isActive);
      if (response.success) {
        toast.success(`${response.data?.updatedCount || selectedIds.size} exercises ${isActive ? "activated" : "deactivated"}`);
        setSelectedIds(new Set());
        fetchExercises();
        fetchStats();
      }
    } catch {
      toast.error("Failed to update exercises");
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const handleEdit = (exercise: ExerciseListItem) => {
    setEditingExercise(exercise);
    setCreateEditModalOpen(true);
  };

  const handleCreateSuccess = () => {
    setCreateEditModalOpen(false);
    setEditingExercise(null);
    fetchExercises();
    fetchStats();
  };

  const SortableHeader = ({ column, label }: { column: string; label: string }) => (
    <TableHead
      className="cursor-pointer hover:text-white transition-colors select-none"
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-1.5">
        {label}
        <ArrowUpDown className={cn("w-3.5 h-3.5", sortBy === column ? "text-emerald-400" : "text-slate-600")} />
      </div>
    </TableHead>
  );

  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-600 p-6 sm:p-8"
      >
        {/* Animated decorative elements */}
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.05, 0.1, 0.05] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-0 right-0 w-72 h-72 bg-white rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"
        />
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.08, 0.15, 0.08] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-0 left-0 w-56 h-56 bg-teal-300 rounded-full translate-y-1/2 -translate-x-1/4 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 w-40 h-40 bg-emerald-300/10 rounded-full blur-2xl"
        />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <motion.div
              whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
              transition={{ duration: 0.5 }}
              className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center shadow-lg shadow-emerald-900/20"
            >
              <Dumbbell className="w-7 h-7 text-white" />
            </motion.div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Exercise Library</h1>
              <p className="text-emerald-100/70 text-sm mt-0.5">Manage exercises, sync from APIs, and curate your library</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Button
                variant="outline"
                onClick={() => setSyncModalOpen(true)}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white backdrop-blur-sm"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync APIs
              </Button>
            </motion.div>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Button
                onClick={() => { setEditingExercise(null); setCreateEditModalOpen(true); }}
                className="bg-white text-emerald-700 hover:bg-white/90 font-semibold shadow-lg shadow-emerald-900/20"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Exercise
              </Button>
            </motion.div>
          </div>
        </div>

        {/* Stats Row */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 20 }}
            className="relative grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mt-6"
          >
            <StatCard label="Total" value={stats.totalExercises} delay={0} />
            <StatCard label="Active" value={stats.activeCount} delay={0.05} />
            <StatCard label="Inactive" value={stats.inactiveCount} delay={0.1} />
            <StatCard label="ExerciseDB" value={stats.bySource?.exercisedb || 0} delay={0.15} />
            <StatCard label="MuscleWiki" value={stats.bySource?.musclewiki || 0} delay={0.2} />
          </motion.div>
        )}
      </motion.div>

      {/* Search & Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <ExerciseSearchFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          difficultyFilter={difficultyFilter}
          onDifficultyChange={setDifficultyFilter}
          sourceFilter={sourceFilter}
          onSourceChange={setSourceFilter}
          activeFilter={activeFilter}
          onActiveChange={setActiveFilter}
        />
      </motion.div>

      {/* View Toggle */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900/60 border border-white/[0.06]">
          <button
            onClick={() => setViewMode("table")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
              viewMode === "table"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/25"
                : "text-slate-500 hover:text-slate-300"
            )}
          >
            <List className="w-4 h-4" />
            Table
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200",
              viewMode === "grid"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/25"
                : "text-slate-500 hover:text-slate-300"
            )}
          >
            <Grid3x3 className="w-4 h-4" />
            Grid
          </button>
        </div>
        <span className="text-sm text-slate-500">{total.toLocaleString()} exercises</span>
      </motion.div>

      {/* Bulk Actions Toolbar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <ExerciseBulkActionsToolbar
            selectedCount={selectedIds.size}
            onBulkDelete={handleBulkDelete}
            onBulkActivate={() => handleBulkToggleActive(true)}
            onBulkDeactivate={() => handleBulkToggleActive(false)}
            isLoading={isBulkActionLoading}
            onClearSelection={() => setSelectedIds(new Set())}
          />
        )}
      </AnimatePresence>

      {/* Content */}
      {loading ? (
        <LoadingSkeleton viewMode={viewMode} />
      ) : error ? (
        <ErrorState error={error} onRetry={fetchExercises} />
      ) : exercises.length === 0 ? (
        <EmptyState
          hasFilters={searchQuery !== "" || categoryFilter !== "all" || difficultyFilter !== "all" || sourceFilter !== "all" || activeFilter !== "all"}
        />
      ) : viewMode === "table" ? (
        /* TABLE VIEW */
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 25 }}
          className="rounded-xl border border-white/[0.06] bg-slate-900/60 backdrop-blur-sm overflow-hidden"
        >
          <Table>
            <TableHeader>
              <TableRow className="border-white/[0.06] hover:bg-transparent">
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedIds.size === exercises.length && exercises.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <SortableHeader column="name" label="Exercise" />
                <TableHead>Muscle Group</TableHead>
                <SortableHeader column="difficulty_level" label="Difficulty" />
                <SortableHeader column="source" label="Source" />
                <TableHead>Active</TableHead>
                <SortableHeader column="updated_at" label="Updated" />
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence mode="popLayout">
                {exercises.map((exercise, index) => (
                  <motion.tr
                    key={exercise.id}
                    variants={rowVariants}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    custom={index}
                    layout
                    onClick={() => setSelectedExerciseId(exercise.id)}
                    className="group border-white/[0.04] hover:bg-emerald-600/[0.04] cursor-pointer transition-colors duration-200"
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(exercise.id)}
                        onCheckedChange={() => toggleSelect(exercise.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0 ring-1 ring-white/[0.06] group-hover:ring-emerald-600/30 transition-all duration-300">
                          <ExerciseMedia
                            exercise={exercise}
                            alt=""
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate max-w-[200px] group-hover:text-emerald-300 transition-colors duration-200">{exercise.name}</p>
                          <p className="text-xs text-slate-500 truncate max-w-[200px]">{exercise.category}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm text-slate-400">
                        <Target className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        <span className="truncate max-w-[120px]">{exercise.primary_muscle_group || exercise.body_part || "\u2014"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const dc = difficultyColors[exercise.difficulty_level] || difficultyColors.beginner;
                        return (
                          <Badge variant="outline" className={cn("text-[11px] font-medium border-0", dc.bg, dc.text)}>
                            {exercise.difficulty_level}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const sc = sourceColors[exercise.source] || sourceColors.manual;
                        return (
                          <Badge variant="outline" className={cn("text-[11px] font-medium border-0", sc.bg, sc.text)}>
                            {exercise.source}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={exercise.is_active}
                        onCheckedChange={() => handleToggleActive(exercise.id)}
                        className="data-[state=checked]:bg-emerald-600"
                      />
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-slate-500">
                        {formatDistanceToNow(new Date(exercise.updated_at), { addSuffix: true })}
                      </span>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-slate-900 border-white/10">
                          <DropdownMenuItem onClick={() => window.open(`/exercises/${exercise.id}`, "_blank")} className="text-slate-300 focus:bg-emerald-600/10 focus:text-emerald-300">
                            <Eye className="w-4 h-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(exercise)} className="text-slate-300 focus:bg-emerald-600/10 focus:text-emerald-300">
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-white/[0.06]" />
                          <DropdownMenuItem onClick={() => handleDelete(exercise)} className="text-red-400 focus:bg-red-500/10">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        </motion.div>
      ) : (
        /* GRID VIEW */
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          <AnimatePresence mode="popLayout">
            {exercises.map((exercise) => (
              <motion.div
                key={exercise.id}
                variants={cardVariants}
                exit="exit"
                layout
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                onClick={() => setSelectedExerciseId(exercise.id)}
                className="group relative rounded-xl bg-slate-900/80 border border-white/[0.06] hover:border-emerald-600/30 overflow-hidden cursor-pointer transition-shadow duration-300 hover:shadow-lg hover:shadow-emerald-600/5"
              >
                {/* Checkbox */}
                <div className="absolute top-3 left-3 z-10" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIds.has(exercise.id)}
                    onCheckedChange={() => toggleSelect(exercise.id)}
                    className="border-white/20"
                  />
                </div>

                {/* Image */}
                <div className="relative aspect-[4/3] bg-slate-800/50 overflow-hidden">
                  <div className="group-hover:scale-105 transition-transform duration-500 w-full h-full">
                    <ExerciseMedia
                      exercise={exercise}
                      alt={exercise.name}
                      iconSize="w-10 h-10"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent" />

                  {/* Badges on image */}
                  <div className="absolute top-3 right-3 flex gap-1.5">
                    {(() => {
                      const dc = difficultyColors[exercise.difficulty_level] || difficultyColors.beginner;
                      return (
                        <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-semibold backdrop-blur-sm border border-white/10", dc.bg, dc.text)}>
                          {exercise.difficulty_level}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Source badge bottom-left */}
                  <div className="absolute bottom-3 left-3">
                    {(() => {
                      const sc = sourceColors[exercise.source] || sourceColors.manual;
                      return (
                        <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-semibold backdrop-blur-sm border border-white/10", sc.bg, sc.text)}>
                          {exercise.source}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                {/* Content */}
                <div className="p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-white truncate flex-1 group-hover:text-emerald-300 transition-colors duration-200">{exercise.name}</h3>
                    <div onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={exercise.is_active}
                        onCheckedChange={() => handleToggleActive(exercise.id)}
                        className="data-[state=checked]:bg-emerald-600 scale-75"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Target className="w-3 h-3 text-emerald-500" />
                    <span className="truncate">{exercise.primary_muscle_group || exercise.body_part || "Full Body"}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Zap className="w-3 h-3 text-emerald-500" />
                    <span>{exercise.default_sets}x{exercise.default_reps}</span>
                    {exercise.calories_per_minute && (
                      <span className="text-amber-400/70">{Math.round(exercise.calories_per_minute)} cal/min</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-white/[0.04]" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-400 hover:text-emerald-300 hover:bg-emerald-600/10" onClick={() => window.open(`/exercises/${exercise.id}`, "_blank")}>
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      View
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-400 hover:text-emerald-300 hover:bg-emerald-600/10" onClick={() => handleEdit(exercise)}>
                      <Edit className="w-3.5 h-3.5 mr-1" />
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => handleDelete(exercise)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          startItem={startItem}
          endItem={endItem}
          onPageChange={setPage}
        />
      )}

      {/* Modals */}
      <CreateEditExerciseModal
        open={createEditModalOpen}
        onOpenChange={(open) => {
          setCreateEditModalOpen(open);
          if (!open) setEditingExercise(null);
        }}
        exercise={editingExercise as ExerciseDetail | null}
        onSuccess={handleCreateSuccess}
      />

      <SyncExercisesModal
        open={syncModalOpen}
        onOpenChange={setSyncModalOpen}
        onSyncComplete={() => {
          fetchExercises();
          fetchStats();
        }}
      />

      <ConfirmationModal
        open={confirmModal.open}
        onOpenChange={(open) => setConfirmModal((prev) => ({ ...prev, open }))}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmLabel={confirmModal.confirmLabel}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
      />

      {/* Exercise Detail Sidebar */}
      <ExerciseDetailSidebar
        exerciseId={selectedExerciseId}
        onClose={() => setSelectedExerciseId(null)}
        onEdit={(exercise) => { setSelectedExerciseId(null); handleEdit(exercise as ExerciseListItem); }}
      />
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function ExerciseMedia({
  exercise,
  alt,
  iconSize = "w-4 h-4",
  className: extraClassName,
}: {
  exercise: { thumbnail_url: string | null; animation_url: string | null };
  alt: string;
  iconSize?: string;
  className?: string;
}) {
  const [error, setError] = useState(false);

  const isVideo = exercise.animation_url?.endsWith(".mp4");
  const videoSrc = isVideo ? exercise.animation_url : null;
  const imageSrc = isVideo ? exercise.thumbnail_url : (exercise.animation_url || exercise.thumbnail_url);

  // Nothing at all
  if (error || (!imageSrc && !videoSrc)) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
        <Dumbbell className={cn(iconSize, "text-slate-600")} />
      </div>
    );
  }

  // Video (.mp4) — always autoPlay muted
  if (videoSrc) {
    return (
      <video
        src={videoSrc}
        poster={exercise.thumbnail_url || undefined}
        autoPlay
        muted
        loop
        playsInline
        onError={() => setError(true)}
        className={cn("w-full h-full object-cover", extraClassName)}
      />
    );
  }

  // Static image (gif from ExerciseDB, or thumbnail)
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageSrc!}
      alt={alt}
      className={cn("w-full h-full object-cover", extraClassName)}
      loading="lazy"
      onError={() => setError(true)}
    />
  );
}

function StatCard({ label, value, delay = 0 }: { label: string; value: number; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3 + delay, type: "spring", stiffness: 300, damping: 25 }}
      whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
      className="rounded-xl bg-white/10 backdrop-blur-sm px-4 py-3 text-center border border-white/[0.06] hover:bg-white/15 transition-colors duration-200"
    >
      <motion.p
        className="text-xl sm:text-2xl font-bold text-white"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 + delay }}
      >
        {value.toLocaleString()}
      </motion.p>
      <p className="text-xs text-emerald-100/60 mt-0.5">{label}</p>
    </motion.div>
  );
}

function generatePageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

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

function Pagination({
  page, totalPages, total, startItem, endItem, onPageChange,
}: {
  page: number; totalPages: number; total: number; startItem: number; endItem: number; onPageChange: (p: number) => void;
}) {
  const pages = generatePageNumbers(page, totalPages);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl bg-slate-900/60 backdrop-blur-sm border border-white/[0.06] px-4 py-3"
    >
      {/* Info */}
      <p className="text-sm text-slate-500">
        Showing <span className="text-slate-300 font-medium">{startItem}</span>
        {" - "}
        <span className="text-slate-300 font-medium">{endItem}</span>
        {" of "}
        <span className="text-emerald-400 font-medium">{total.toLocaleString()}</span>
      </p>

      {/* Page buttons */}
      <div className="flex items-center gap-1">
        {/* First page */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          className="flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
        >
          <ChevronsLeft className="w-4 h-4" />
        </motion.button>

        {/* Previous */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
        >
          <ChevronLeft className="w-4 h-4" />
        </motion.button>

        {/* Page numbers */}
        <div className="flex items-center gap-1 mx-1">
          {pages.map((p, i) =>
            p === "..." ? (
              <span key={`dots-${i}`} className="w-9 h-9 flex items-center justify-center text-slate-600 text-sm">
                ...
              </span>
            ) : (
              <motion.button
                key={p}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => onPageChange(p as number)}
                className={cn(
                  "relative w-9 h-9 rounded-lg text-sm font-medium transition-all duration-200",
                  p === page
                    ? "text-white"
                    : "text-slate-500 hover:text-white hover:bg-white/[0.06]"
                )}
              >
                {p === page && (
                  <motion.div
                    layoutId="activePage"
                    className="absolute inset-0 rounded-lg bg-emerald-600 shadow-lg shadow-emerald-600/30"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{p}</span>
              </motion.button>
            )
          )}
        </div>

        {/* Next */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
        >
          <ChevronRight className="w-4 h-4" />
        </motion.button>

        {/* Last page */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => onPageChange(totalPages)}
          disabled={page >= totalPages}
          className="flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
        >
          <ChevronsRight className="w-4 h-4" />
        </motion.button>
      </div>
    </motion.div>
  );
}

function LoadingSkeleton({ viewMode }: { viewMode: "table" | "grid" }) {
  if (viewMode === "grid") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl bg-slate-900/60 border border-white/[0.06] overflow-hidden"
          >
            <Skeleton className="aspect-[4/3] bg-slate-800/50" />
            <div className="p-3.5 space-y-2">
              <Skeleton className="h-4 w-3/4 bg-slate-800" />
              <Skeleton className="h-3 w-1/2 bg-slate-800" />
            </div>
          </motion.div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-slate-900/60 overflow-hidden">
      <div className="space-y-0">
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className="flex items-center gap-4 p-4 border-b border-white/[0.04]"
          >
            <Skeleton className="w-10 h-10 rounded-lg bg-slate-800" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40 bg-slate-800" />
              <Skeleton className="h-3 w-24 bg-slate-800" />
            </div>
            <Skeleton className="h-5 w-16 bg-slate-800" />
            <Skeleton className="h-5 w-16 bg-slate-800" />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-20"
    >
      <motion.div
        animate={{ rotate: [0, 5, -5, 0] }}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
        className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4"
      >
        <AlertCircle className="w-8 h-8 text-red-400" />
      </motion.div>
      <h3 className="text-lg font-semibold text-white mb-1">Failed to load exercises</h3>
      <p className="text-sm text-slate-500 mb-4">{error}</p>
      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        <Button onClick={onRetry} variant="outline" className="border-emerald-600/30 text-emerald-300 hover:bg-emerald-600/10">
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </motion.div>
    </motion.div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-20"
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="w-16 h-16 rounded-2xl bg-emerald-600/10 flex items-center justify-center mb-4"
      >
        <Dumbbell className="w-8 h-8 text-emerald-400" />
      </motion.div>
      <h3 className="text-lg font-semibold text-white mb-1">
        {hasFilters ? "No exercises match your filters" : "No exercises yet"}
      </h3>
      <p className="text-sm text-slate-500">
        {hasFilters ? "Try adjusting your search or filters" : "Create your first exercise or sync from an API"}
      </p>
    </motion.div>
  );
}

// ============================================
// EXERCISE DETAIL SIDEBAR
// ============================================

const sidebarOverlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const sidebarPanelVariants = {
  hidden: { x: "100%" },
  visible: { x: 0, transition: { type: "spring" as const, stiffness: 300, damping: 30 } },
  exit: { x: "100%", transition: { duration: 0.25, ease: "easeIn" as const } },
};

function ExerciseDetailSidebar({
  exerciseId,
  onClose,
  onEdit,
}: {
  exerciseId: string | null;
  onClose: () => void;
  onEdit: (exercise: ExerciseDetail) => void;
}) {
  const [exercise, setExercise] = useState<ExerciseDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"instructions" | "tips" | "mistakes">("instructions");

  useEffect(() => {
    if (!exerciseId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExercise(null);
      return;
    }

    setLoading(true);
    setError(null);
    setActiveTab("instructions");

    adminExercisesService
      .getById(exerciseId)
      .then((res) => {
        if (res.success && res.data) {
          setExercise(res.data);
        } else {
          setError("Exercise not found");
        }
      })
      .catch(() => setError("Failed to load exercise"))
      .finally(() => setLoading(false));
  }, [exerciseId]);

  // Close on Escape key
  useEffect(() => {
    if (!exerciseId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [exerciseId, onClose]);

  const isOpen = exerciseId !== null;

  const difficultyConfig: Record<string, { label: string; gradient: string; text: string }> = {
    beginner: { label: "Beginner", gradient: "from-emerald-500 to-green-500", text: "text-emerald-300" },
    intermediate: { label: "Intermediate", gradient: "from-amber-500 to-orange-500", text: "text-amber-300" },
    advanced: { label: "Advanced", gradient: "from-red-500 to-rose-500", text: "text-red-300" },
    expert: { label: "Expert", gradient: "from-purple-500 to-violet-500", text: "text-purple-300" },
  };

  const instructions = exercise && Array.isArray(exercise.instructions) ? exercise.instructions as string[] : [];
  const tips = exercise && Array.isArray(exercise.tips) ? exercise.tips as string[] : [];
  const commonMistakes = exercise && Array.isArray(exercise.common_mistakes) ? exercise.common_mistakes as string[] : [];
  const hasTabContent = instructions.length > 0 || tips.length > 0 || commonMistakes.length > 0;
  const difficulty = exercise ? (difficultyConfig[exercise.difficulty_level] || difficultyConfig.beginner) : difficultyConfig.beginner;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <motion.div
            key="sidebar-overlay"
            variants={sidebarOverlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          />

          {/* Sidebar panel */}
          <motion.div
            key="sidebar-panel"
            variants={sidebarPanelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed top-0 right-0 h-full w-full sm:w-[480px] lg:w-[540px] bg-slate-950 border-l border-white/[0.08] z-50 flex flex-col shadow-2xl shadow-black/50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] bg-slate-900/60 backdrop-blur-xl flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600/20 flex items-center justify-center">
                  <Dumbbell className="w-4 h-4 text-emerald-400" />
                </div>
                <h2 className="text-sm font-semibold text-white">Exercise Details</h2>
              </div>
              <div className="flex items-center gap-1.5">
                {exercise && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5 text-xs text-slate-400 hover:text-emerald-300 hover:bg-emerald-600/10"
                      onClick={() => window.open(`/exercises/${exercise.id}`, "_blank")}
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1" />
                      Public
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5 text-xs text-slate-400 hover:text-emerald-300 hover:bg-emerald-600/10"
                      onClick={() => onEdit(exercise)}
                    >
                      <Edit className="w-3.5 h-3.5 mr-1" />
                      Edit
                    </Button>
                  </>
                )}
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {loading && (
                <div className="flex flex-col items-center justify-center py-20">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    className="w-10 h-10 rounded-full border-2 border-transparent border-t-emerald-500 border-r-teal-500"
                  />
                  <p className="text-sm text-slate-500 mt-4">Loading exercise...</p>
                </div>
              )}

              {error && !loading && (
                <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                  <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mb-3">
                    <AlertCircle className="w-7 h-7 text-red-400" />
                  </div>
                  <p className="text-sm text-slate-400">{error}</p>
                </div>
              )}

              {exercise && !loading && !error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="space-y-0"
                >
                  {/* Hero media */}
                  <div className="relative aspect-[16/10] bg-slate-800 overflow-hidden">
                    <ExerciseMedia
                      exercise={exercise}
                      alt={exercise.name}
                      iconSize="w-16 h-16"
                      className="object-contain"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />

                    {/* Floating badges */}
                    <div className="absolute top-3 left-3 flex gap-2">
                      <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold bg-gradient-to-r ${difficulty.gradient} text-white shadow-lg`}>
                        {difficulty.label}
                      </span>
                      <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-900/80 text-slate-400 backdrop-blur-sm border border-white/10 uppercase">
                        {exercise.source}
                      </span>
                    </div>

                    {/* Active status */}
                    <div className="absolute top-3 right-3">
                      <span className={cn(
                        "px-2.5 py-1 rounded-lg text-[11px] font-semibold backdrop-blur-sm border",
                        exercise.is_active
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                          : "bg-red-500/20 text-red-300 border-red-500/30"
                      )}>
                        {exercise.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>

                  {/* Info section */}
                  <div className="px-5 py-4 space-y-5">
                    {/* Title + Category */}
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        {exercise.category && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-600/20 text-emerald-300 uppercase tracking-wider">
                            {exercise.category}
                          </span>
                        )}
                        {exercise.body_part && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-400 uppercase tracking-wider">
                            {exercise.body_part}
                          </span>
                        )}
                      </div>
                      <h3 className="text-lg font-bold text-white capitalize leading-tight">
                        {exercise.name}
                      </h3>
                      {exercise.description && (
                        <p className="text-sm text-slate-400 mt-2 leading-relaxed">{exercise.description}</p>
                      )}
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-slate-900/80 border border-white/[0.06]">
                        <Dumbbell className="w-4 h-4 text-emerald-400" />
                        <span className="text-base font-bold text-white">{exercise.default_sets}</span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">Sets</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-slate-900/80 border border-white/[0.06]">
                        <Zap className="w-4 h-4 text-emerald-400" />
                        <span className="text-base font-bold text-white">{exercise.default_reps}</span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">Reps</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-slate-900/80 border border-white/[0.06]">
                        <Clock className="w-4 h-4 text-cyan-400" />
                        <span className="text-base font-bold text-white">{exercise.default_rest_seconds}s</span>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">Rest</span>
                      </div>
                    </div>

                    {/* Calories */}
                    {exercise.calories_per_minute && (
                      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20">
                        <Flame className="w-4 h-4 text-orange-400" />
                        <span className="text-sm font-semibold text-white">{Math.round(exercise.calories_per_minute)} cal/min</span>
                        <span className="text-xs text-slate-500">estimated burn rate</span>
                      </div>
                    )}

                    {/* Target Muscles */}
                    <div>
                      <div className="flex items-center gap-2 mb-2.5">
                        <Target className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-semibold text-white uppercase tracking-wider">Target Muscles</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {exercise.primary_muscle_group && (
                          <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/20">
                            {exercise.primary_muscle_group}
                          </span>
                        )}
                        {exercise.target_muscles?.map((m) => (
                          <span key={m} className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-800/60 text-slate-300 border border-white/[0.06]">
                            {m}
                          </span>
                        ))}
                        {exercise.secondary_muscle_groups?.map((m) => (
                          <span key={m} className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-800/40 text-slate-500 border border-white/[0.04]">
                            {m}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Equipment */}
                    {exercise.equipment_required && exercise.equipment_required.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2.5">
                          <Dumbbell className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs font-semibold text-white uppercase tracking-wider">Equipment</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {exercise.equipment_required.map((eq) => (
                            <span key={eq} className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-800/60 text-slate-300 border border-white/[0.06] capitalize">
                              {eq}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tags */}
                    {exercise.tags && exercise.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {exercise.tags.map((tag) => (
                          <span key={tag} className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800/40 text-slate-500 border border-white/[0.04]">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Instructions / Tips / Mistakes Tabs */}
                    {hasTabContent && (
                      <div className="rounded-xl bg-slate-900/60 border border-white/[0.06] overflow-hidden">
                        {/* Tab header */}
                        <div className="flex items-center border-b border-white/[0.06] bg-slate-900/40">
                          {instructions.length > 0 && (
                            <button
                              onClick={() => setActiveTab("instructions")}
                              className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-medium transition-all relative",
                                activeTab === "instructions" ? "text-emerald-300" : "text-slate-500 hover:text-slate-300"
                              )}
                            >
                              <ListOrdered className="w-3.5 h-3.5" />
                              Steps
                              {activeTab === "instructions" && (
                                <motion.div
                                  layoutId="sidebarTab"
                                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500"
                                  transition={{ type: "spring" as const, bounce: 0.2, duration: 0.5 }}
                                />
                              )}
                            </button>
                          )}
                          {tips.length > 0 && (
                            <button
                              onClick={() => setActiveTab("tips")}
                              className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-medium transition-all relative",
                                activeTab === "tips" ? "text-emerald-300" : "text-slate-500 hover:text-slate-300"
                              )}
                            >
                              <Lightbulb className="w-3.5 h-3.5" />
                              Tips
                              {activeTab === "tips" && (
                                <motion.div
                                  layoutId="sidebarTab"
                                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500"
                                  transition={{ type: "spring" as const, bounce: 0.2, duration: 0.5 }}
                                />
                              )}
                            </button>
                          )}
                          {commonMistakes.length > 0 && (
                            <button
                              onClick={() => setActiveTab("mistakes")}
                              className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-medium transition-all relative",
                                activeTab === "mistakes" ? "text-emerald-300" : "text-slate-500 hover:text-slate-300"
                              )}
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Mistakes
                              {activeTab === "mistakes" && (
                                <motion.div
                                  layoutId="sidebarTab"
                                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500"
                                  transition={{ type: "spring" as const, bounce: 0.2, duration: 0.5 }}
                                />
                              )}
                            </button>
                          )}
                        </div>

                        {/* Tab content */}
                        <div className="p-4 max-h-[300px] overflow-y-auto">
                          {activeTab === "instructions" && instructions.length > 0 && (
                            <div className="space-y-3">
                              {instructions.map((step, i) => (
                                <motion.div
                                  key={i}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: i * 0.04 }}
                                  className="flex gap-3"
                                >
                                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-sm shadow-emerald-500/20">
                                    <span className="text-[10px] font-bold text-white">{i + 1}</span>
                                  </div>
                                  <p className="text-xs text-slate-300 leading-relaxed pt-0.5">{step}</p>
                                </motion.div>
                              ))}
                            </div>
                          )}

                          {activeTab === "tips" && tips.length > 0 && (
                            <div className="space-y-2.5">
                              {tips.map((tip, i) => (
                                <motion.div
                                  key={i}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: i * 0.04 }}
                                  className="flex gap-2.5 items-start p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10"
                                >
                                  <Lightbulb className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                                  <p className="text-xs text-slate-300 leading-relaxed">{tip}</p>
                                </motion.div>
                              ))}
                            </div>
                          )}

                          {activeTab === "mistakes" && commonMistakes.length > 0 && (
                            <div className="space-y-2.5">
                              {commonMistakes.map((mistake, i) => (
                                <motion.div
                                  key={i}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: i * 0.04 }}
                                  className="flex gap-2.5 items-start p-2.5 rounded-lg bg-red-500/5 border border-red-500/10"
                                >
                                  <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                                  <p className="text-xs text-slate-300 leading-relaxed">{mistake}</p>
                                </motion.div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Metadata footer */}
                    <div className="flex items-center justify-between text-[11px] text-slate-600 pt-2 border-t border-white/[0.04]">
                      <span>Source: {exercise.source} {exercise.source_id ? `(${exercise.source_id})` : ""}</span>
                      <span>v{exercise.version}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
