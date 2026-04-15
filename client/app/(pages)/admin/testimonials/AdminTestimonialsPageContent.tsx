"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  RefreshCw,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  Star,
  MessageSquare,
  BarChart3,
  Search,
  Filter,
  CheckCircle,
  Quote,
  Award,
  User,
  ChevronDown,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";
import {
  adminTestimonialsService,
  type TestimonialItem,
  type AdminTestimonialStats,
  type CreateTestimonialPayload,
  type UpdateTestimonialPayload,
} from "@/src/shared/services/admin-testimonials.service";

// ============================================
// CONSTANTS & CONFIG
// ============================================

const pillarConfig: Record<string, { bg: string; text: string; label: string }> = {
  fitness: { bg: "bg-cyan-500/15", text: "text-cyan-400", label: "Fitness" },
  nutrition: { bg: "bg-purple-500/15", text: "text-purple-400", label: "Nutrition" },
  wellbeing: { bg: "bg-pink-500/15", text: "text-pink-400", label: "Wellbeing" },
};

const ratingColors: Record<number, string> = {
  5: "text-amber-400",
  4: "text-amber-400",
  3: "text-yellow-400",
  2: "text-orange-400",
  1: "text-red-400",
};

const sortOptions = [
  { value: "created_at", label: "Date Created" },
  { value: "updated_at", label: "Last Updated" },
  { value: "name", label: "Name" },
  { value: "rating", label: "Rating" },
  { value: "display_order", label: "Display Order" },
];

// ============================================
// ANIMATION VARIANTS
// ============================================

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.1 },
  },
};

const rowVariants = {
  hidden: { opacity: 0, x: -20 },
  show: {
    opacity: 1,
    x: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
  exit: { opacity: 0, x: 20, transition: { duration: 0.2 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring" as const, stiffness: 260, damping: 24 },
  },
  exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } },
};

const sidebarOverlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const sidebarPanelVariants = {
  hidden: { x: "100%" },
  visible: {
    x: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
  exit: {
    x: "100%",
    transition: { duration: 0.25, ease: "easeIn" as const },
  },
};

const modalOverlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const modalContentVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 30 },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 20,
    transition: { duration: 0.2 },
  },
};

// ============================================
// HELPERS
// ============================================

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "...";
}

function generatePageNumbers(
  current: number,
  total: number
): (number | "...")[] {
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

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export default function AdminTestimonialsPageContent() {
  // Data
  const [testimonials, setTestimonials] = useState<TestimonialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminTestimonialStats | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [pillarFilter, setPillarFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);

  // View
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Modals & Sidebar
  const [createEditModalOpen, setCreateEditModalOpen] = useState(false);
  const [editingTestimonial, setEditingTestimonial] =
    useState<TestimonialItem | null>(null);
  const [selectedTestimonialId, setSelectedTestimonialId] = useState<
    string | null
  >(null);
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

  // ----------------------------------------
  // DATA FETCHING
  // ----------------------------------------

  const fetchTestimonials = useCallback(async () => {
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
      if (pillarFilter !== "all") params.pillar = pillarFilter;
      if (ratingFilter !== "all") params.rating = Number(ratingFilter);
      if (activeFilter !== "all")
        params.is_active = activeFilter === "active" ? "true" : "false";

      const response = await adminTestimonialsService.list(params);

      if (response.success && response.data) {
        setTestimonials(response.data);
        if (response.meta) {
          setTotal(response.meta.total);
          setTotalPages(response.meta.totalPages);
        }
      } else {
        setError("Failed to load testimonials");
      }
    } catch {
      setError("Failed to load testimonials");
    } finally {
      setLoading(false);
    }
  }, [
    page,
    limit,
    searchQuery,
    pillarFilter,
    ratingFilter,
    activeFilter,
    sortBy,
    sortOrder,
  ]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await adminTestimonialsService.getStats();
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch {
      // Stats are non-critical
    }
  }, []);

  useEffect(() => {
    fetchTestimonials();
  }, [fetchTestimonials]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [searchQuery, pillarFilter, ratingFilter, activeFilter]);

  // ----------------------------------------
  // HANDLERS
  // ----------------------------------------

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === testimonials.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(testimonials.map((t) => t.id)));
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
      const response = await adminTestimonialsService.toggleActive(id);
      if (response.success) {
        toast.success("Status updated");
        fetchTestimonials();
        fetchStats();
      }
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleToggleFeatured = async (id: string) => {
    try {
      const response = await adminTestimonialsService.toggleFeatured(id);
      if (response.success) {
        toast.success("Featured status updated");
        fetchTestimonials();
        fetchStats();
      }
    } catch {
      toast.error("Failed to update featured status");
    }
  };

  const handleDelete = (testimonial: TestimonialItem) => {
    setConfirmModal({
      open: true,
      title: "Delete Testimonial",
      description: `Are you sure you want to delete the review from "${testimonial.name}"? This action cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
      onConfirm: async () => {
        try {
          await adminTestimonialsService.delete(testimonial.id);
          toast.success("Testimonial deleted");
          setConfirmModal((prev) => ({ ...prev, open: false }));
          fetchTestimonials();
          fetchStats();
        } catch {
          toast.error("Failed to delete testimonial");
        }
      },
    });
  };

  const handleBulkDelete = () => {
    const count = selectedIds.size;
    setConfirmModal({
      open: true,
      title: "Bulk Delete Testimonials",
      description: `Are you sure you want to delete ${count} testimonial${count > 1 ? "s" : ""}? This action cannot be undone.`,
      confirmLabel: `Delete ${count}`,
      variant: "danger",
      onConfirm: async () => {
        setIsBulkActionLoading(true);
        try {
          const response = await adminTestimonialsService.bulkDelete(
            Array.from(selectedIds)
          );
          if (response.success) {
            toast.success(
              `${response.data?.deletedCount || count} testimonials deleted`
            );
            setSelectedIds(new Set());
            fetchTestimonials();
            fetchStats();
          }
        } catch {
          toast.error("Failed to delete testimonials");
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
      const response = await adminTestimonialsService.bulkToggleActive(
        Array.from(selectedIds),
        isActive
      );
      if (response.success) {
        toast.success(
          `${response.data?.updatedCount || selectedIds.size} testimonials ${isActive ? "activated" : "deactivated"}`
        );
        setSelectedIds(new Set());
        fetchTestimonials();
        fetchStats();
      }
    } catch {
      toast.error("Failed to update testimonials");
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const handleEdit = (testimonial: TestimonialItem) => {
    setEditingTestimonial(testimonial);
    setCreateEditModalOpen(true);
  };

  const handleCreateEditSuccess = () => {
    setCreateEditModalOpen(false);
    setEditingTestimonial(null);
    fetchTestimonials();
    fetchStats();
  };

  // ----------------------------------------
  // INLINE COMPONENTS
  // ----------------------------------------

  const SortableHeader = ({
    column,
    label,
  }: {
    column: string;
    label: string;
  }) => (
    <TableHead
      className="cursor-pointer hover:text-white transition-colors select-none"
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-1.5">
        {label}
        <ArrowUpDown
          className={cn(
            "w-3.5 h-3.5",
            sortBy === column ? "text-amber-400" : "text-slate-600"
          )}
        />
      </div>
    </TableHead>
  );

  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  const hasFilters =
    searchQuery !== "" ||
    pillarFilter !== "all" ||
    ratingFilter !== "all" ||
    activeFilter !== "all";

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6">
      {/* ==================== HERO HEADER ==================== */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-600 via-orange-500 to-rose-600 p-6 sm:p-8"
      >
        {/* Gradient accent bar at top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-300 via-orange-300 to-rose-300" />

        {/* Animated decorative elements */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.05, 0.1, 0.05],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-0 right-0 w-72 h-72 bg-white rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.08, 0.15, 0.08],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
          className="absolute bottom-0 left-0 w-56 h-56 bg-rose-300 rounded-full translate-y-1/2 -translate-x-1/4 blur-3xl"
        />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <motion.div
              whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
              transition={{ duration: 0.5 }}
              className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center shadow-lg shadow-orange-900/20"
            >
              <Star className="w-7 h-7 text-white fill-white/30" />
            </motion.div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Testimonial Management
              </h1>
              <p className="text-orange-100/70 text-sm mt-0.5">
                Manage customer reviews and testimonials
              </p>
            </div>
          </div>

          <motion.div
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <Button
              onClick={() => {
                setEditingTestimonial(null);
                setCreateEditModalOpen(true);
              }}
              className="bg-white text-orange-700 hover:bg-white/90 font-semibold shadow-lg shadow-orange-900/20"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Review
            </Button>
          </motion.div>
        </div>

        {/* Stats Row */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.2,
              type: "spring",
              stiffness: 200,
              damping: 20,
            }}
            className="relative grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6"
          >
            <StatsCard
              icon={<MessageSquare className="w-4 h-4" />}
              value={stats.totalTestimonials}
              label="Total Reviews"
              delay={0}
            />
            <StatsCard
              icon={<Eye className="w-4 h-4" />}
              value={stats.activeCount}
              label="Active Reviews"
              delay={0.05}
            />
            <StatsCard
              icon={<Star className="w-4 h-4" />}
              value={stats.featuredCount}
              label="Featured Reviews"
              delay={0.1}
            />
            <StatsCard
              icon={<BarChart3 className="w-4 h-4" />}
              value={stats.averageRating}
              label="Average Rating"
              isDecimal
              delay={0.15}
            />
          </motion.div>
        )}
      </motion.div>

      {/* ==================== SEARCH & FILTERS ==================== */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col lg:flex-row gap-3"
      >
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by name, role, or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/60 border border-white/[0.06] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/30 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Pillar Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-10 bg-slate-900/60 border-white/[0.06] text-slate-300 hover:bg-slate-800 hover:text-white",
                  pillarFilter !== "all" && "border-amber-500/30 text-amber-300"
                )}
              >
                <Filter className="w-3.5 h-3.5 mr-1.5" />
                Pillar:{" "}
                {pillarFilter === "all"
                  ? "All"
                  : pillarConfig[pillarFilter]?.label || pillarFilter}
                <ChevronDown className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="bg-slate-900 border-white/10"
            >
              <DropdownMenuItem
                onClick={() => setPillarFilter("all")}
                className={cn(
                  "text-slate-300 focus:bg-amber-600/10 focus:text-amber-300",
                  pillarFilter === "all" && "text-amber-300"
                )}
              >
                All Pillars
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/[0.06]" />
              {Object.entries(pillarConfig).map(([key, config]) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => setPillarFilter(key)}
                  className={cn(
                    "text-slate-300 focus:bg-amber-600/10 focus:text-amber-300",
                    pillarFilter === key && "text-amber-300"
                  )}
                >
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full mr-2",
                      config.bg,
                      config.text
                    )}
                  />
                  {config.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Rating Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-10 bg-slate-900/60 border-white/[0.06] text-slate-300 hover:bg-slate-800 hover:text-white",
                  ratingFilter !== "all" &&
                    "border-amber-500/30 text-amber-300"
                )}
              >
                <Star className="w-3.5 h-3.5 mr-1.5" />
                Rating:{" "}
                {ratingFilter === "all" ? "All" : `${ratingFilter} Stars`}
                <ChevronDown className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="bg-slate-900 border-white/10"
            >
              <DropdownMenuItem
                onClick={() => setRatingFilter("all")}
                className={cn(
                  "text-slate-300 focus:bg-amber-600/10 focus:text-amber-300",
                  ratingFilter === "all" && "text-amber-300"
                )}
              >
                All Ratings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/[0.06]" />
              {[5, 4, 3, 2, 1].map((r) => (
                <DropdownMenuItem
                  key={r}
                  onClick={() => setRatingFilter(String(r))}
                  className={cn(
                    "text-slate-300 focus:bg-amber-600/10 focus:text-amber-300",
                    ratingFilter === String(r) && "text-amber-300"
                  )}
                >
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "w-3 h-3",
                          i < r
                            ? "text-amber-400 fill-amber-400"
                            : "text-slate-600"
                        )}
                      />
                    ))}
                    <span className="ml-1.5 text-xs text-slate-500">
                      ({r})
                    </span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Status Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-10 bg-slate-900/60 border-white/[0.06] text-slate-300 hover:bg-slate-800 hover:text-white",
                  activeFilter !== "all" &&
                    "border-amber-500/30 text-amber-300"
                )}
              >
                <Eye className="w-3.5 h-3.5 mr-1.5" />
                Status:{" "}
                {activeFilter === "all"
                  ? "All"
                  : activeFilter === "active"
                    ? "Active"
                    : "Inactive"}
                <ChevronDown className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="bg-slate-900 border-white/10"
            >
              {["all", "active", "inactive"].map((val) => (
                <DropdownMenuItem
                  key={val}
                  onClick={() => setActiveFilter(val)}
                  className={cn(
                    "text-slate-300 focus:bg-amber-600/10 focus:text-amber-300 capitalize",
                    activeFilter === val && "text-amber-300"
                  )}
                >
                  {val === "all" ? "All Status" : val}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-10 bg-slate-900/60 border-white/[0.06] text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                <ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />
                Sort
                <ChevronDown className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-slate-900 border-white/10"
            >
              {sortOptions.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => {
                    if (sortBy === opt.value) {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy(opt.value);
                      setSortOrder("desc");
                    }
                  }}
                  className={cn(
                    "text-slate-300 focus:bg-amber-600/10 focus:text-amber-300",
                    sortBy === opt.value && "text-amber-300"
                  )}
                >
                  {opt.label}
                  {sortBy === opt.value && (
                    <span className="ml-auto text-xs text-slate-500">
                      {sortOrder === "asc" ? "ASC" : "DESC"}
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.div>

      {/* ==================== VIEW TOGGLE ==================== */}
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
                ? "bg-amber-600 text-white shadow-md shadow-amber-600/25"
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
                ? "bg-amber-600 text-white shadow-md shadow-amber-600/25"
                : "text-slate-500 hover:text-slate-300"
            )}
          >
            <Grid3x3 className="w-4 h-4" />
            Grid
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">
            {total.toLocaleString()} review{total !== 1 ? "s" : ""}
          </span>
          {/* Items per page selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 bg-slate-900/60 border-white/[0.06] text-slate-400 hover:bg-slate-800 hover:text-white text-xs"
              >
                {limit} / page
                <ChevronDown className="w-3 h-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-slate-900 border-white/10"
            >
              {[10, 20, 50, 100].map((n) => (
                <DropdownMenuItem
                  key={n}
                  onClick={() => {
                    setLimit(n);
                    setPage(1);
                  }}
                  className={cn(
                    "text-slate-300 focus:bg-amber-600/10 focus:text-amber-300",
                    limit === n && "text-amber-300"
                  )}
                >
                  {n} per page
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </motion.div>

      {/* ==================== BULK ACTIONS BAR ==================== */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 backdrop-blur-sm">
              <span className="text-sm font-medium text-amber-300">
                {selectedIds.size} selected
              </span>

              <div className="flex items-center gap-2 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkToggleActive(true)}
                  disabled={isBulkActionLoading}
                  className="h-8 bg-emerald-500/10 border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200"
                >
                  <Eye className="w-3.5 h-3.5 mr-1.5" />
                  Enable All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkToggleActive(false)}
                  disabled={isBulkActionLoading}
                  className="h-8 bg-slate-500/10 border-slate-500/20 text-slate-300 hover:bg-slate-500/20 hover:text-slate-200"
                >
                  <EyeOff className="w-3.5 h-3.5 mr-1.5" />
                  Disable All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={isBulkActionLoading}
                  className="h-8 bg-red-500/10 border-red-500/20 text-red-300 hover:bg-red-500/20 hover:text-red-200"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Delete All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                  className="h-8 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Clear
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================== CONTENT ==================== */}
      {loading ? (
        <LoadingSkeleton viewMode={viewMode} />
      ) : error ? (
        <ErrorState error={error} onRetry={fetchTestimonials} />
      ) : testimonials.length === 0 ? (
        <EmptyState hasFilters={hasFilters} />
      ) : viewMode === "table" ? (
        /* ==================== TABLE VIEW ==================== */
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
                    checked={
                      selectedIds.size === testimonials.length &&
                      testimonials.length > 0
                    }
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <SortableHeader column="name" label="Reviewer" />
                <TableHead className="min-w-[240px]">Content</TableHead>
                <SortableHeader column="rating" label="Rating" />
                <TableHead>Pillar</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Featured</TableHead>
                <SortableHeader column="created_at" label="Created" />
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence mode="popLayout">
                {testimonials.map((testimonial, index) => (
                  <motion.tr
                    key={testimonial.id}
                    variants={rowVariants}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    custom={index}
                    layout
                    onClick={() =>
                      setSelectedTestimonialId(testimonial.id)
                    }
                    className="group border-white/[0.04] hover:bg-amber-600/[0.04] cursor-pointer transition-colors duration-200"
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(testimonial.id)}
                        onCheckedChange={() => toggleSelect(testimonial.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-9 h-9 ring-1 ring-white/[0.06] group-hover:ring-amber-600/30 transition-all duration-300">
                          {testimonial.avatar_url && (
                            <AvatarImage
                              src={testimonial.avatar_url}
                              alt={testimonial.name}
                            />
                          )}
                          <AvatarFallback className="bg-gradient-to-br from-amber-600/20 to-orange-600/20 text-amber-300 text-xs font-semibold">
                            {getInitials(testimonial.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-white truncate max-w-[150px] group-hover:text-amber-300 transition-colors duration-200">
                              {testimonial.name}
                            </p>
                            {testimonial.verified && (
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-slate-500 truncate max-w-[150px]">
                            {testimonial.role}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-slate-400 leading-relaxed line-clamp-2 max-w-[280px]">
                        {truncateText(testimonial.content, 80)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={cn(
                              "w-3.5 h-3.5",
                              i < testimonial.rating
                                ? cn(
                                    "fill-current",
                                    ratingColors[testimonial.rating] ||
                                      "text-amber-400"
                                  )
                                : "text-slate-700"
                            )}
                          />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {testimonial.pillar ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[11px] font-medium border-0",
                            pillarConfig[testimonial.pillar]?.bg,
                            pillarConfig[testimonial.pillar]?.text
                          )}
                        >
                          {pillarConfig[testimonial.pillar]?.label ||
                            testimonial.pillar}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-600">--</span>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={testimonial.is_active}
                        onCheckedChange={() =>
                          handleToggleActive(testimonial.id)
                        }
                        className="data-[state=checked]:bg-amber-600"
                      />
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {testimonial.is_featured ? (
                        <Badge
                          variant="outline"
                          className="text-[11px] font-medium border-0 bg-amber-500/15 text-amber-400"
                        >
                          <Star className="w-3 h-3 mr-1 fill-current" />
                          Featured
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-600">--</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-slate-500">
                        {formatDistanceToNow(
                          new Date(testimonial.created_at),
                          { addSuffix: true }
                        )}
                      </span>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="bg-slate-900 border-white/10"
                        >
                          <DropdownMenuItem
                            onClick={() => handleEdit(testimonial)}
                            className="text-slate-300 focus:bg-amber-600/10 focus:text-amber-300"
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              handleToggleFeatured(testimonial.id)
                            }
                            className="text-slate-300 focus:bg-amber-600/10 focus:text-amber-300"
                          >
                            <Star className="w-4 h-4 mr-2" />
                            {testimonial.is_featured
                              ? "Remove Featured"
                              : "Set Featured"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-white/[0.06]" />
                          <DropdownMenuItem
                            onClick={() => handleDelete(testimonial)}
                            className="text-red-400 focus:bg-red-500/10"
                          >
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
        /* ==================== GRID VIEW ==================== */
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          <AnimatePresence mode="popLayout">
            {testimonials.map((testimonial) => (
              <motion.div
                key={testimonial.id}
                variants={cardVariants}
                exit="exit"
                layout
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                onClick={() => setSelectedTestimonialId(testimonial.id)}
                className="group relative rounded-xl bg-slate-900/80 border border-white/[0.06] hover:border-amber-600/30 overflow-hidden cursor-pointer transition-shadow duration-300 hover:shadow-lg hover:shadow-amber-600/5"
              >
                {/* Checkbox */}
                <div
                  className="absolute top-3 left-3 z-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={selectedIds.has(testimonial.id)}
                    onCheckedChange={() => toggleSelect(testimonial.id)}
                    className="border-white/20"
                  />
                </div>

                {/* Featured indicator */}
                {testimonial.is_featured && (
                  <div className="absolute top-3 right-3 z-10">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 backdrop-blur-sm flex items-center justify-center border border-amber-500/30">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    </div>
                  </div>
                )}

                {/* Top gradient accent */}
                <div className="h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 opacity-60 group-hover:opacity-100 transition-opacity" />

                {/* Content */}
                <div className="p-4 space-y-3">
                  {/* Avatar + Name + Role */}
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10 ring-1 ring-white/[0.06] group-hover:ring-amber-600/30 transition-all duration-300">
                      {testimonial.avatar_url && (
                        <AvatarImage
                          src={testimonial.avatar_url}
                          alt={testimonial.name}
                        />
                      )}
                      <AvatarFallback className="bg-gradient-to-br from-amber-600/20 to-orange-600/20 text-amber-300 text-xs font-semibold">
                        {getInitials(testimonial.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-white truncate group-hover:text-amber-300 transition-colors duration-200">
                          {testimonial.name}
                        </p>
                        {testimonial.verified && (
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {testimonial.role}
                      </p>
                    </div>
                  </div>

                  {/* Rating */}
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "w-3.5 h-3.5",
                          i < testimonial.rating
                            ? cn(
                                "fill-current",
                                ratingColors[testimonial.rating] ||
                                  "text-amber-400"
                              )
                            : "text-slate-700"
                        )}
                      />
                    ))}
                  </div>

                  {/* Content */}
                  <p className="text-sm text-slate-400 leading-relaxed line-clamp-3">
                    {truncateText(testimonial.content, 120)}
                  </p>

                  {/* Pillar badge */}
                  <div className="flex items-center gap-2">
                    {testimonial.pillar && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-medium border-0",
                          pillarConfig[testimonial.pillar]?.bg,
                          pillarConfig[testimonial.pillar]?.text
                        )}
                      >
                        {pillarConfig[testimonial.pillar]?.label}
                      </Badge>
                    )}
                    {!testimonial.is_active && (
                      <Badge
                        variant="outline"
                        className="text-[10px] font-medium border-0 bg-red-500/15 text-red-400"
                      >
                        Inactive
                      </Badge>
                    )}
                  </div>

                  {/* Actions */}
                  <div
                    className="flex items-center justify-between pt-2.5 border-t border-white/[0.04]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-600 mr-1">
                        Active
                      </span>
                      <Switch
                        checked={testimonial.is_active}
                        onCheckedChange={() =>
                          handleToggleActive(testimonial.id)
                        }
                        className="data-[state=checked]:bg-amber-600 scale-75"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-slate-400 hover:text-amber-300 hover:bg-amber-600/10"
                        onClick={() => handleEdit(testimonial)}
                      >
                        <Edit className="w-3.5 h-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        onClick={() => handleDelete(testimonial)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ==================== PAGINATION ==================== */}
      {!loading && totalPages > 1 && (
        <PaginationBar
          page={page}
          totalPages={totalPages}
          total={total}
          startItem={startItem}
          endItem={endItem}
          onPageChange={setPage}
        />
      )}

      {/* ==================== MODALS ==================== */}
      <CreateEditTestimonialModal
        open={createEditModalOpen}
        onOpenChange={(open) => {
          setCreateEditModalOpen(open);
          if (!open) setEditingTestimonial(null);
        }}
        testimonial={editingTestimonial}
        onSuccess={handleCreateEditSuccess}
      />

      <ConfirmationModal
        open={confirmModal.open}
        onOpenChange={(open) =>
          setConfirmModal((prev) => ({ ...prev, open }))
        }
        title={confirmModal.title}
        description={confirmModal.description}
        confirmLabel={confirmModal.confirmLabel}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
      />

      {/* ==================== DETAIL SIDEBAR ==================== */}
      <TestimonialDetailSidebar
        testimonialId={selectedTestimonialId}
        onClose={() => setSelectedTestimonialId(null)}
        onEdit={(testimonial) => {
          setSelectedTestimonialId(null);
          handleEdit(testimonial);
        }}
        onToggleFeatured={handleToggleFeatured}
        onToggleActive={handleToggleActive}
        onDelete={(testimonial) => {
          setSelectedTestimonialId(null);
          handleDelete(testimonial);
        }}
      />
    </div>
  );
}

// ============================================
// STATS CARD
// ============================================

function StatsCard({
  icon,
  value,
  label,
  isDecimal = false,
  delay = 0,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  isDecimal?: boolean;
  delay?: number;
}) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const target = value;
    const duration = 800;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(eased * target);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    const timer = setTimeout(() => {
      requestAnimationFrame(animate);
    }, (0.3 + delay) * 1000);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        delay: 0.3 + delay,
        type: "spring",
        stiffness: 300,
        damping: 25,
      }}
      whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
      className="rounded-xl bg-white/10 backdrop-blur-sm px-4 py-3 border border-white/[0.06] hover:bg-white/15 transition-colors duration-200"
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="text-white/70">{icon}</div>
      </div>
      <motion.p
        className="text-xl sm:text-2xl font-bold text-white"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 + delay }}
      >
        {isDecimal
          ? displayValue.toFixed(1)
          : Math.round(displayValue).toLocaleString()}
      </motion.p>
      <p className="text-xs text-orange-100/60 mt-0.5">{label}</p>
    </motion.div>
  );
}

// ============================================
// STAR RATING INPUT
// ============================================

function StarRatingInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (rating: number) => void;
}) {
  const [hoverValue, setHoverValue] = useState(0);

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHoverValue(star)}
          onMouseLeave={() => setHoverValue(0)}
          onClick={() => onChange(star)}
          className="p-0.5 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-amber-500/30 rounded"
          aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
        >
          <Star
            className={cn(
              "w-6 h-6 transition-colors",
              (hoverValue || value) >= star
                ? "text-amber-400 fill-amber-400"
                : "text-slate-600"
            )}
          />
        </button>
      ))}
      <span className="ml-2 text-sm text-slate-400">
        {hoverValue || value || 0}/5
      </span>
    </div>
  );
}

// ============================================
// CREATE / EDIT MODAL
// ============================================

function CreateEditTestimonialModal({
  open,
  onOpenChange,
  testimonial,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  testimonial: TestimonialItem | null;
  onSuccess: () => void;
}) {
  const isEditing = testimonial !== null;

  const [formData, setFormData] = useState<CreateTestimonialPayload>({
    name: "",
    role: "",
    avatar_url: null,
    rating: 5,
    content: "",
    verified: false,
    pillar: null,
    is_active: true,
    is_featured: false,
    display_order: 0,
  });

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const nameRef = useRef<HTMLInputElement>(null);

  // Populate form when editing
  useEffect(() => {
    if (open) {
      if (testimonial) {
        setFormData({
          name: testimonial.name,
          role: testimonial.role,
          avatar_url: testimonial.avatar_url,
          rating: testimonial.rating,
          content: testimonial.content,
          verified: testimonial.verified,
          pillar: testimonial.pillar,
          is_active: testimonial.is_active,
          is_featured: testimonial.is_featured,
          display_order: testimonial.display_order,
        });
      } else {
        setFormData({
          name: "",
          role: "",
          avatar_url: null,
          rating: 5,
          content: "",
          verified: false,
          pillar: null,
          is_active: true,
          is_featured: false,
          display_order: 0,
        });
      }
      setErrors({});
      // Auto-focus name field
      setTimeout(() => nameRef.current?.focus(), 100);
    }
  }, [open, testimonial]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = "Name is required";
    if (!formData.role.trim()) newErrors.role = "Role is required";
    if (!formData.content.trim()) newErrors.content = "Content is required";
    if (formData.rating < 1 || formData.rating > 5)
      newErrors.rating = "Rating must be 1-5";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      const payload: CreateTestimonialPayload = {
        ...formData,
        avatar_url: formData.avatar_url || null,
      };

      let response;
      if (isEditing && testimonial) {
        response = await adminTestimonialsService.update(
          testimonial.id,
          payload as UpdateTestimonialPayload
        );
      } else {
        response = await adminTestimonialsService.create(payload);
      }

      if (response.success) {
        toast.success(
          isEditing
            ? "Testimonial updated successfully"
            : "Testimonial created successfully"
        );
        onSuccess();
      } else {
        toast.error("Failed to save testimonial");
      }
    } catch {
      toast.error("Failed to save testimonial");
    } finally {
      setSaving(false);
    }
  };

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onOpenChange(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, saving, onOpenChange]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            key="modal-overlay"
            variants={modalOverlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={() => !saving && onOpenChange(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal Content */}
          <motion.div
            key="modal-content"
            variants={modalContentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-slate-900/80 backdrop-blur-xl flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                    {isEditing ? (
                      <Edit className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Plus className="w-4 h-4 text-amber-400" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {isEditing ? "Edit Testimonial" : "Create Testimonial"}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {isEditing
                        ? "Update testimonial details"
                        : "Add a new customer testimonial"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => !saving && onOpenChange(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Name + Role row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      ref={nameRef}
                      type="text"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData((f) => ({ ...f, name: e.target.value }))
                      }
                      placeholder="John Doe"
                      className={cn(
                        "w-full px-3 py-2.5 rounded-xl bg-slate-800/60 border text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all",
                        errors.name
                          ? "border-red-500/50 focus:ring-red-500/30"
                          : "border-white/[0.06] focus:ring-amber-500/30 focus:border-amber-500/30"
                      )}
                    />
                    {errors.name && (
                      <p className="text-xs text-red-400 mt-1">
                        {errors.name}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      Role <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.role}
                      onChange={(e) =>
                        setFormData((f) => ({ ...f, role: e.target.value }))
                      }
                      placeholder="Fitness Enthusiast"
                      className={cn(
                        "w-full px-3 py-2.5 rounded-xl bg-slate-800/60 border text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all",
                        errors.role
                          ? "border-red-500/50 focus:ring-red-500/30"
                          : "border-white/[0.06] focus:ring-amber-500/30 focus:border-amber-500/30"
                      )}
                    />
                    {errors.role && (
                      <p className="text-xs text-red-400 mt-1">
                        {errors.role}
                      </p>
                    )}
                  </div>
                </div>

                {/* Avatar URL */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Avatar URL
                  </label>
                  <input
                    type="url"
                    value={formData.avatar_url || ""}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        avatar_url: e.target.value || null,
                      }))
                    }
                    placeholder="https://example.com/avatar.jpg"
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-800/60 border border-white/[0.06] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/30 transition-all"
                  />
                </div>

                {/* Rating */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Rating <span className="text-red-400">*</span>
                  </label>
                  <StarRatingInput
                    value={formData.rating}
                    onChange={(rating) =>
                      setFormData((f) => ({ ...f, rating }))
                    }
                  />
                  {errors.rating && (
                    <p className="text-xs text-red-400 mt-1">
                      {errors.rating}
                    </p>
                  )}
                </div>

                {/* Content */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Content <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, content: e.target.value }))
                    }
                    placeholder="Write the testimonial content..."
                    rows={4}
                    className={cn(
                      "w-full px-3 py-2.5 rounded-xl bg-slate-800/60 border text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 transition-all resize-none",
                      errors.content
                        ? "border-red-500/50 focus:ring-red-500/30"
                        : "border-white/[0.06] focus:ring-amber-500/30 focus:border-amber-500/30"
                    )}
                  />
                  {errors.content && (
                    <p className="text-xs text-red-400 mt-1">
                      {errors.content}
                    </p>
                  )}
                  <p className="text-xs text-slate-500 mt-1">
                    {formData.content.length} characters
                  </p>
                </div>

                {/* Pillar + Display Order row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      Pillar
                    </label>
                    <select
                      value={formData.pillar || ""}
                      onChange={(e) =>
                        setFormData((f) => ({
                          ...f,
                          pillar:
                            (e.target.value as
                              | "fitness"
                              | "nutrition"
                              | "wellbeing") || null,
                        }))
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-800/60 border border-white/[0.06] text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/30 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">None</option>
                      <option value="fitness">Fitness</option>
                      <option value="nutrition">Nutrition</option>
                      <option value="wellbeing">Wellbeing</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      Display Order
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formData.display_order || 0}
                      onChange={(e) =>
                        setFormData((f) => ({
                          ...f,
                          display_order: parseInt(e.target.value) || 0,
                        }))
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-800/60 border border-white/[0.06] text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/30 transition-all"
                    />
                  </div>
                </div>

                {/* Toggles row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-800/30 border border-white/[0.04]">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={formData.verified}
                      onCheckedChange={(checked) =>
                        setFormData((f) => ({
                          ...f,
                          verified: checked === true,
                        }))
                      }
                    />
                    <div>
                      <span className="text-sm font-medium text-white">
                        Verified
                      </span>
                      <p className="text-xs text-slate-500">
                        Mark as verified reviewer
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={formData.is_featured}
                      onCheckedChange={(checked) =>
                        setFormData((f) => ({
                          ...f,
                          is_featured: checked === true,
                        }))
                      }
                    />
                    <div>
                      <span className="text-sm font-medium text-white">
                        Featured
                      </span>
                      <p className="text-xs text-slate-500">
                        Show in featured section
                      </p>
                    </div>
                  </label>

                  <div className="flex items-center gap-3">
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(checked) =>
                        setFormData((f) => ({
                          ...f,
                          is_active: checked,
                        }))
                      }
                      className="data-[state=checked]:bg-amber-600"
                    />
                    <div>
                      <span className="text-sm font-medium text-white">
                        Active
                      </span>
                      <p className="text-xs text-slate-500">
                        Visible on website
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.06] bg-slate-900/80 flex-shrink-0">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={saving}
                  className="bg-slate-800/60 border-slate-700/50 text-slate-300 hover:bg-slate-700/60 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-500 hover:to-orange-500 shadow-lg shadow-amber-600/20 font-semibold"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : isEditing ? (
                    "Update Testimonial"
                  ) : (
                    "Create Testimonial"
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================
// TESTIMONIAL DETAIL SIDEBAR
// ============================================

function TestimonialDetailSidebar({
  testimonialId,
  onClose,
  onEdit,
  onToggleFeatured,
  onToggleActive,
  onDelete,
}: {
  testimonialId: string | null;
  onClose: () => void;
  onEdit: (testimonial: TestimonialItem) => void;
  onToggleFeatured: (id: string) => void;
  onToggleActive: (id: string) => void;
  onDelete: (testimonial: TestimonialItem) => void;
}) {
  const [testimonial, setTestimonial] = useState<TestimonialItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!testimonialId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTestimonial(null);
      return;
    }

    setLoading(true);
    setError(null);

    adminTestimonialsService
      .getById(testimonialId)
      .then((res) => {
        if (res.success && res.data) {
          setTestimonial(res.data);
        } else {
          setError("Testimonial not found");
        }
      })
      .catch(() => setError("Failed to load testimonial"))
      .finally(() => setLoading(false));
  }, [testimonialId]);

  // Close on Escape key
  useEffect(() => {
    if (!testimonialId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [testimonialId, onClose]);

  const isOpen = testimonialId !== null;

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
                <div className="w-8 h-8 rounded-lg bg-amber-600/20 flex items-center justify-center">
                  <Quote className="w-4 h-4 text-amber-400" />
                </div>
                <h2 className="text-sm font-semibold text-white">
                  Testimonial Details
                </h2>
              </div>
              <div className="flex items-center gap-1.5">
                {testimonial && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5 text-xs text-slate-400 hover:text-amber-300 hover:bg-amber-600/10"
                      onClick={() => onEdit(testimonial)}
                    >
                      <Edit className="w-3.5 h-3.5 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => onDelete(testimonial)}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Delete
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
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className="w-10 h-10 rounded-full border-2 border-transparent border-t-amber-500 border-r-orange-500"
                  />
                  <p className="text-sm text-slate-500 mt-4">
                    Loading testimonial...
                  </p>
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

              {testimonial && !loading && !error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="space-y-0"
                >
                  {/* Hero section with gradient */}
                  <div className="relative bg-gradient-to-br from-amber-600/10 via-orange-500/5 to-transparent px-5 py-6">
                    <div className="flex items-center gap-4">
                      <Avatar className="w-16 h-16 ring-2 ring-amber-500/20">
                        {testimonial.avatar_url && (
                          <AvatarImage
                            src={testimonial.avatar_url}
                            alt={testimonial.name}
                          />
                        )}
                        <AvatarFallback className="bg-gradient-to-br from-amber-600/30 to-orange-600/30 text-amber-300 text-lg font-bold">
                          {getInitials(testimonial.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-white">
                            {testimonial.name}
                          </h3>
                          {testimonial.verified && (
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                          )}
                        </div>
                        <p className="text-sm text-slate-400">
                          {testimonial.role}
                        </p>
                        <div className="flex items-center gap-1 mt-1.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={cn(
                                "w-4 h-4",
                                i < testimonial.rating
                                  ? cn(
                                      "fill-current",
                                      ratingColors[testimonial.rating] ||
                                        "text-amber-400"
                                    )
                                  : "text-slate-700"
                              )}
                            />
                          ))}
                          <span className="ml-1.5 text-sm text-slate-500">
                            {testimonial.rating}.0
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-2 mt-4">
                      <span
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[11px] font-semibold backdrop-blur-sm border",
                          testimonial.is_active
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                            : "bg-red-500/20 text-red-300 border-red-500/30"
                        )}
                      >
                        {testimonial.is_active ? "Active" : "Inactive"}
                      </span>
                      {testimonial.is_featured && (
                        <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          <Star className="w-3 h-3 inline mr-1 fill-current" />
                          Featured
                        </span>
                      )}
                      {testimonial.pillar && (
                        <span
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-white/10",
                            pillarConfig[testimonial.pillar]?.bg,
                            pillarConfig[testimonial.pillar]?.text
                          )}
                        >
                          {pillarConfig[testimonial.pillar]?.label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Full content */}
                  <div className="px-5 py-5 space-y-5">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Quote className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-semibold text-white uppercase tracking-wider">
                          Testimonial
                        </span>
                      </div>
                      <div className="relative p-4 rounded-xl bg-slate-900/60 border border-white/[0.06]">
                        <Quote className="w-8 h-8 text-amber-500/10 absolute top-3 left-3" />
                        <p className="text-sm text-slate-300 leading-relaxed relative z-10 pl-4">
                          {testimonial.content}
                        </p>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Award className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-semibold text-white uppercase tracking-wider">
                          Quick Actions
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => onToggleActive(testimonial.id)}
                          className={cn(
                            "flex items-center gap-2 p-3 rounded-xl border transition-all",
                            testimonial.is_active
                              ? "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20"
                              : "bg-slate-800/60 border-white/[0.06] hover:bg-slate-800"
                          )}
                        >
                          {testimonial.is_active ? (
                            <Eye className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <EyeOff className="w-4 h-4 text-slate-400" />
                          )}
                          <span className="text-xs font-medium text-white">
                            {testimonial.is_active
                              ? "Deactivate"
                              : "Activate"}
                          </span>
                        </button>
                        <button
                          onClick={() => onToggleFeatured(testimonial.id)}
                          className={cn(
                            "flex items-center gap-2 p-3 rounded-xl border transition-all",
                            testimonial.is_featured
                              ? "bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20"
                              : "bg-slate-800/60 border-white/[0.06] hover:bg-slate-800"
                          )}
                        >
                          <Star
                            className={cn(
                              "w-4 h-4",
                              testimonial.is_featured
                                ? "text-amber-400 fill-amber-400"
                                : "text-slate-400"
                            )}
                          />
                          <span className="text-xs font-medium text-white">
                            {testimonial.is_featured
                              ? "Unfeature"
                              : "Feature"}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Metadata */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <User className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-semibold text-white uppercase tracking-wider">
                          Metadata
                        </span>
                      </div>
                      <div className="space-y-2">
                        {[
                          {
                            label: "Display Order",
                            value: String(testimonial.display_order),
                          },
                          {
                            label: "Verified",
                            value: testimonial.verified ? "Yes" : "No",
                          },
                          {
                            label: "Created",
                            value: new Date(
                              testimonial.created_at
                            ).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }),
                          },
                          {
                            label: "Updated",
                            value: formatDistanceToNow(
                              new Date(testimonial.updated_at),
                              { addSuffix: true }
                            ),
                          },
                          {
                            label: "ID",
                            value: testimonial.id,
                          },
                        ].map((item) => (
                          <div
                            key={item.label}
                            className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-900/40 border border-white/[0.03]"
                          >
                            <span className="text-xs text-slate-500">
                              {item.label}
                            </span>
                            <span className="text-xs text-slate-300 font-medium text-right max-w-[200px] truncate">
                              {item.value}
                            </span>
                          </div>
                        ))}
                      </div>
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

// ============================================
// PAGINATION BAR
// ============================================

function PaginationBar({
  page,
  totalPages,
  total,
  startItem,
  endItem,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  startItem: number;
  endItem: number;
  onPageChange: (p: number) => void;
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
        Showing{" "}
        <span className="text-slate-300 font-medium">{startItem}</span>
        {" - "}
        <span className="text-slate-300 font-medium">{endItem}</span>
        {" of "}
        <span className="text-amber-400 font-medium">
          {total.toLocaleString()}
        </span>
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
              <span
                key={`dots-${i}`}
                className="w-9 h-9 flex items-center justify-center text-slate-600 text-sm"
              >
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
                    layoutId="activeTestimonialPage"
                    className="absolute inset-0 rounded-lg bg-amber-600 shadow-lg shadow-amber-600/30"
                    transition={{
                      type: "spring",
                      stiffness: 350,
                      damping: 30,
                    }}
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

// ============================================
// LOADING SKELETON
// ============================================

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
            <div className="h-1 bg-slate-800" />
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-full bg-slate-800" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-24 bg-slate-800" />
                  <Skeleton className="h-3 w-16 bg-slate-800" />
                </div>
              </div>
              <Skeleton className="h-3 w-20 bg-slate-800" />
              <Skeleton className="h-12 w-full bg-slate-800" />
              <Skeleton className="h-5 w-16 bg-slate-800" />
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
            <Skeleton className="w-4 h-4 rounded bg-slate-800" />
            <Skeleton className="w-9 h-9 rounded-full bg-slate-800" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-32 bg-slate-800" />
              <Skeleton className="h-3 w-20 bg-slate-800" />
            </div>
            <Skeleton className="h-4 w-48 bg-slate-800" />
            <Skeleton className="h-4 w-16 bg-slate-800" />
            <Skeleton className="h-5 w-14 bg-slate-800" />
            <Skeleton className="h-5 w-10 bg-slate-800" />
            <Skeleton className="h-5 w-14 bg-slate-800" />
            <Skeleton className="h-4 w-16 bg-slate-800" />
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// ERROR STATE
// ============================================

function ErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
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
      <h3 className="text-lg font-semibold text-white mb-1">
        Failed to load testimonials
      </h3>
      <p className="text-sm text-slate-500 mb-4">{error}</p>
      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        <Button
          onClick={onRetry}
          variant="outline"
          className="border-amber-600/30 text-amber-300 hover:bg-amber-600/10"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </motion.div>
    </motion.div>
  );
}

// ============================================
// EMPTY STATE
// ============================================

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
        className="w-16 h-16 rounded-2xl bg-amber-600/10 flex items-center justify-center mb-4"
      >
        <MessageSquare className="w-8 h-8 text-amber-400" />
      </motion.div>
      <h3 className="text-lg font-semibold text-white mb-1">
        {hasFilters
          ? "No reviews match your filters"
          : "No reviews yet"}
      </h3>
      <p className="text-sm text-slate-500">
        {hasFilters
          ? "Try adjusting your search or filters"
          : "Create your first testimonial to get started"}
      </p>
    </motion.div>
  );
}
