"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { sanitizeHtml } from "@/lib/sanitize";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  MoreVertical,
  AlertCircle,
  Grid3x3,
  List,
  ArrowUpDown,
  FileText,
  TrendingUp,
  FileEdit,
  Archive,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/app/context/AuthContext";
import { BulkActionsToolbar } from "./components/BulkActionsToolbar";
import { BlogSearchFilters } from "@/components/blog/BlogSearchFilters";
import { BlogPagination } from "@/components/blog/BlogPagination";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { AdminDetailSidebar } from "@/components/admin/AdminDetailSidebar";
import { Loader2 } from "lucide-react";

interface Blog {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published" | "archived";
  author_first_name: string;
  author_last_name: string;
  published_at: Date | null;
  created_at: Date;
  views: number;
  reading_time: number;
}

interface BlogDetail extends Blog {
  excerpt: string | null;
  content: string;
  markdown_content: string | null;
  featured_image: string | null;
  meta_title: string | null;
  meta_description: string | null;
  meta_keywords: string | null;
  author_email: string;
  author_avatar: string | null;
  updated_at: Date;
}

// Backend returns: { success: true, data: Blog[], meta: { page, limit, total, totalPages, ... } }

export default function AdminBlogsPageContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [sortBy, setSortBy] = useState<"created_at" | "published_at" | "title" | "views">("published_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [detailBlog, setDetailBlog] = useState<BlogDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    variant: "danger" | "warning" | "info" | "success";
    onConfirm: () => void;
    isLoading?: boolean;
  }>({
    open: false,
    title: "",
    description: "",
    confirmLabel: "Confirm",
    variant: "danger",
    onConfirm: () => {},
  });

  // Check if user is admin
  useEffect(() => {
    if (user && user.role !== "admin") {
      router.push("/dashboard");
    }
  }, [user, router]);

  const fetchBlogs = useCallback(
    async (
      pageNum: number = 1,
      search: string = "",
      status: string = "all",
      itemsPerPage: number = 20
    ) => {
      try {
        setLoading(true);
        setError(null);

        const params: Record<string, string> = {
          page: pageNum.toString(),
          limit: itemsPerPage.toString(),
          sortBy: sortBy,
          sortOrder: sortOrder,
        };

        if (search) {
          params.search = search;
        }

        if (status !== "all") {
          params.status = status;
        }

        const response = await api.get<Blog[]>("/admin/blogs", { params });

        if (response.success && response.data) {
          // Backend returns: { success: true, data: Blog[], meta: { page, limit, total, totalPages, ... } }
          const blogs = Array.isArray(response.data) ? response.data : [];
          const meta = response.meta;

          setBlogs(blogs);
          setTotalPages(meta?.totalPages || 1);
          setTotal(meta?.total || 0);
        } else {
          throw new Error("Failed to fetch blogs");
        }
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Failed to load blogs. Please try again later.");
        }
      } finally {
        setLoading(false);
      }
    },
    [sortBy, sortOrder]
  );

  useEffect(() => {
    if (user?.role === "admin") {
      fetchBlogs(page, searchQuery, statusFilter, limit);
    }
  }, [page, searchQuery, statusFilter, limit, user, fetchBlogs, sortBy, sortOrder]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPage(1);
  };

  const handleViewDetails = async (blogId: string) => {
    setSidebarOpen(true);
    setDetailLoading(true);
    setDetailBlog(null);
    try {
      const response = await api.get<BlogDetail>(`/admin/blogs/${blogId}`);
      if (response.success && response.data) {
        setDetailBlog(response.data);
      } else {
        throw new Error("Failed to fetch blog details");
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load blog details");
      setSidebarOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    const blog = blogs.find((b) => b.id === id);
    setConfirmModal({
      open: true,
      title: "Delete Blog Post",
      description: blog
        ? `"${blog.title}" will be permanently deleted. This action cannot be undone.`
        : "This blog post will be permanently deleted. This action cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isLoading: true }));
        try {
          await api.delete(`/admin/blogs/${id}`);
          toast.success("Blog deleted successfully");
          setConfirmModal((prev) => ({ ...prev, open: false, isLoading: false }));
          await fetchBlogs(page, searchQuery, statusFilter, limit);
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : "Failed to delete blog");
          setConfirmModal((prev) => ({ ...prev, isLoading: false }));
        }
      },
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setConfirmModal({
      open: true,
      title: "Delete Multiple Blogs",
      description: `You are about to delete ${selectedIds.size} blog post${selectedIds.size !== 1 ? "s" : ""}. This action cannot be undone.`,
      confirmLabel: `Delete ${selectedIds.size} Blog${selectedIds.size !== 1 ? "s" : ""}`,
      variant: "danger",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isLoading: true }));
        setIsBulkActionLoading(true);
        try {
          await api.post("/admin/blogs/bulk-delete", {
            ids: Array.from(selectedIds),
          });
          toast.success(`${selectedIds.size} blog(s) deleted successfully`);
          setSelectedIds(new Set());
          setConfirmModal((prev) => ({ ...prev, open: false, isLoading: false }));
          await fetchBlogs(page, searchQuery, statusFilter, limit);
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : "Failed to delete blogs");
          setConfirmModal((prev) => ({ ...prev, isLoading: false }));
        } finally {
          setIsBulkActionLoading(false);
        }
      },
    });
  };

  const handleBulkPublish = async (status: "published" | "draft") => {
    if (selectedIds.size === 0) return;

    setIsBulkActionLoading(true);
    try {
      await api.post("/admin/blogs/bulk-status", {
        ids: Array.from(selectedIds),
        status,
      });
      setSelectedIds(new Set());
      await fetchBlogs(page, searchQuery, statusFilter, limit);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update blogs";
      alert(message);
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === blogs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(blogs.map((b) => b.id)));
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className: string; dot: string }> = {
      published: {
        variant: "default",
        className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        dot: "bg-emerald-400",
      },
      draft: {
        variant: "secondary",
        className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        dot: "bg-amber-400",
      },
      archived: {
        variant: "outline",
        className: "bg-slate-500/10 text-slate-400 border-slate-500/20",
        dot: "bg-slate-400",
      },
    };

    const config = variants[status] || variants.draft;

    return (
      <Badge
        variant={config.variant}
        className={cn(
          "capitalize rounded-lg px-2.5 py-0.5 text-xs font-medium border gap-1.5",
          config.className
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
        {status}
      </Badge>
    );
  };

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        router.push("/admin/blogs/create");
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        // Focus search input
        document.getElementById("blog-search")?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  // Compute stats from current data
  const publishedCount = blogs.filter((b) => b.status === "published").length;
  const draftCount = blogs.filter((b) => b.status === "draft").length;
  const archivedCount = blogs.filter((b) => b.status === "archived").length;

  if (user?.role !== "admin") {
    return null;
  }

  return (
    <div className="space-y-8">
      {/* Hero Header with Gradient */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl bg-linear-to-br from-emerald-600 via-emerald-500 to-sky-600 p-8 md:p-10"
      >
        {/* Decorative background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-sky-400/20 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />
          {/* Subtle grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
              backgroundSize: "32px 32px",
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                  Blog Management
                </h1>
                <p className="text-emerald-100/80 text-sm md:text-base mt-1">
                  Create, manage, and track your content performance
                </p>
              </div>
            </div>
          </div>
          <Button
            onClick={() => router.push("/admin/blogs/create")}
            size="lg"
            className="bg-white text-emerald-700 hover:bg-white/90 shadow-lg shadow-black/10 font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Blog
          </Button>
        </div>

        {/* Stats Row */}
        <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          {[
            {
              label: "Total Posts",
              value: total || blogs.length,
              icon: FileText,
              color: "bg-white/20",
            },
            {
              label: "Published",
              value: publishedCount,
              icon: TrendingUp,
              color: "bg-white/20",
            },
            {
              label: "Drafts",
              value: draftCount,
              icon: FileEdit,
              color: "bg-white/20",
            },
            {
              label: "Archived",
              value: archivedCount,
              icon: Archive,
              color: "bg-white/20",
            },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="flex items-center gap-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 px-4 py-3"
            >
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", stat.color)}>
                <stat.icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-emerald-100/70">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Search and Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <BlogSearchFilters
          searchQuery={searchQuery}
          onSearchChange={handleSearch}
          statusFilter={statusFilter}
          onStatusChange={(status) => {
            setStatusFilter(status);
            setPage(1);
          }}
        />
      </motion.div>

      {/* View Toggle and Bulk Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-800/60 border border-slate-700/50">
          <button
            onClick={() => setViewMode("table")}
            className={cn(
              "flex items-center justify-center h-9 w-9 rounded-lg transition-all duration-200",
              viewMode === "table"
                ? "bg-linear-to-r from-emerald-500 to-sky-500 text-white shadow-md shadow-emerald-500/20"
                : "text-slate-400 hover:text-white hover:bg-slate-700/50"
            )}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={cn(
              "flex items-center justify-center h-9 w-9 rounded-lg transition-all duration-200",
              viewMode === "grid"
                ? "bg-linear-to-r from-emerald-500 to-sky-500 text-white shadow-md shadow-emerald-500/20"
                : "text-slate-400 hover:text-white hover:bg-slate-700/50"
            )}
          >
            <Grid3x3 className="w-4 h-4" />
          </button>
        </div>

        {selectedIds.size > 0 && (
          <BulkActionsToolbar
            selectedCount={selectedIds.size}
            onBulkDelete={handleBulkDelete}
            onBulkPublish={() => handleBulkPublish("published")}
            onBulkUnpublish={() => handleBulkPublish("draft")}
            isLoading={isBulkActionLoading}
            onClearSelection={() => setSelectedIds(new Set())}
          />
        )}
      </motion.div>

      {/* Loading State */}
      {loading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl p-5 bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm"
            >
              <div className="flex items-center gap-4">
                <Skeleton className="h-5 w-5 rounded bg-slate-800" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3 bg-slate-800" />
                  <Skeleton className="h-3 w-1/3 bg-slate-800/60" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full bg-slate-800" />
                <Skeleton className="h-4 w-24 bg-slate-800/60" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-20 rounded-2xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 mb-5">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <p className="text-lg text-slate-300 font-medium mb-2">Something went wrong</p>
          <p className="text-sm text-slate-500 mb-6">{error}</p>
          <Button
            onClick={() => fetchBlogs(page, searchQuery, statusFilter, limit)}
            className="bg-linear-to-r from-emerald-500 to-sky-500 hover:from-emerald-600 hover:to-sky-600 text-white shadow-lg shadow-emerald-500/20"
          >
            Try Again
          </Button>
        </motion.div>
      )}

      {/* Blog Content */}
      {!loading && !error && (
        <>
          {/* Empty State */}
          {blogs.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="flex flex-col items-center justify-center py-20 rounded-2xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-500/10 to-sky-500/10 border border-emerald-500/20">
                <FileText className="w-10 h-10 text-emerald-400/60" />
              </div>
              <div className="text-center mt-5">
                <p className="text-slate-200 font-semibold text-lg">
                  No blogs found
                </p>
                <p className="text-slate-500 text-sm mt-1.5">
                  {searchQuery || statusFilter !== "all"
                    ? "Try adjusting your search or filters"
                    : "Start creating your first blog post"}
                </p>
              </div>
              {!searchQuery && statusFilter === "all" && (
                <Button
                  onClick={() => router.push("/admin/blogs/create")}
                  className="bg-linear-to-r from-emerald-500 to-sky-500 hover:from-emerald-600 hover:to-sky-600 text-white shadow-lg shadow-emerald-500/20 mt-6"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Blog
                </Button>
              )}
            </motion.div>
          )}

          {/* Table View */}
          {blogs.length > 0 && viewMode === "table" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="rounded-2xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm overflow-hidden shadow-xl shadow-black/10"
            >
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800/60 bg-slate-800/30 hover:bg-slate-800/40">
                    <TableHead className="w-12 pl-5">
                      <Checkbox
                        checked={selectedIds.size === blogs.length && blogs.length > 0}
                        onCheckedChange={toggleSelectAll}
                        className="border-slate-600 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                      />
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort("title")}
                        className="flex items-center gap-2 text-slate-300 hover:text-emerald-400 transition-colors font-semibold text-xs uppercase tracking-wider"
                      >
                        Title
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </button>
                    </TableHead>
                    <TableHead className="text-slate-300 font-semibold text-xs uppercase tracking-wider">
                      Author
                    </TableHead>
                    <TableHead className="text-slate-300 font-semibold text-xs uppercase tracking-wider">
                      Status
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort("published_at")}
                        className="flex items-center gap-2 text-slate-300 hover:text-emerald-400 transition-colors font-semibold text-xs uppercase tracking-wider"
                      >
                        Published
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort("views")}
                        className="flex items-center gap-2 text-slate-300 hover:text-emerald-400 transition-colors font-semibold text-xs uppercase tracking-wider"
                      >
                        Views
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort("created_at")}
                        className="flex items-center gap-2 text-slate-300 hover:text-emerald-400 transition-colors font-semibold text-xs uppercase tracking-wider"
                      >
                        Created
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </button>
                    </TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence mode="popLayout">
                    {blogs.map((blog, index) => (
                      <motion.tr
                        key={blog.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ delay: index * 0.03 }}
                        className={cn(
                          "border-slate-800/40 transition-all duration-200 cursor-pointer group/row",
                          selectedIds.has(blog.id)
                            ? "bg-emerald-500/5"
                            : "hover:bg-slate-800/40"
                        )}
                        onClick={() => handleViewDetails(blog.id)}
                      >
                        <TableCell className="pl-5" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(blog.id)}
                            onCheckedChange={() => toggleSelect(blog.id)}
                            className="border-slate-600 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-white group-hover/row:text-emerald-300 transition-colors line-clamp-1">
                              {blog.title}
                            </div>
                            <div className="text-xs text-slate-500 font-mono">
                              /{blog.slug}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-linear-to-br from-emerald-500/20 to-sky-500/20 text-xs font-semibold text-emerald-300">
                              {blog.author_first_name?.[0]}{blog.author_last_name?.[0]}
                            </div>
                            <span className="text-slate-300 text-sm">
                              {blog.author_first_name} {blog.author_last_name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(blog.status)}</TableCell>
                        <TableCell className="text-slate-400 text-sm">
                          {blog.published_at
                            ? formatDistanceToNow(new Date(blog.published_at), {
                                addSuffix: true,
                              })
                            : <span className="text-slate-600">--</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                            <span className="text-sm font-medium">{blog.views}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-400 text-sm">
                          {formatDistanceToNow(new Date(blog.created_at), {
                            addSuffix: true,
                          })}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 hover:text-white opacity-0 group-hover/row:opacity-100 transition-all"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="bg-slate-900 border-slate-700/60 shadow-xl shadow-black/20 rounded-xl p-1"
                            >
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewDetails(blog.id);
                                }}
                                className="text-slate-300 hover:bg-slate-800 rounded-lg cursor-pointer"
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/blogs/${blog.slug}`);
                                }}
                                className="text-slate-300 hover:bg-slate-800 rounded-lg cursor-pointer"
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View Live
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/admin/blogs/${blog.id}/edit`);
                                }}
                                className="text-slate-300 hover:bg-slate-800 rounded-lg cursor-pointer"
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(blog.id);
                                }}
                                className="text-red-400 hover:bg-red-500/10 rounded-lg cursor-pointer"
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
          )}

          {/* Grid View */}
          {blogs.length > 0 && viewMode === "grid" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              <AnimatePresence mode="popLayout">
                {blogs.map((blog, index) => (
                  <motion.div
                    key={blog.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.04 }}
                    className={cn(
                      "group/card relative rounded-2xl bg-slate-900/40 border backdrop-blur-sm overflow-hidden shadow-lg shadow-black/10 cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/5 hover:-translate-y-1",
                      selectedIds.has(blog.id)
                        ? "border-emerald-500/40 bg-emerald-500/5"
                        : "border-slate-800/60 hover:border-slate-700/60"
                    )}
                    onClick={() => handleViewDetails(blog.id)}
                  >
                    {/* Card Header with gradient accent */}
                    <div className="h-1.5 bg-linear-to-r from-emerald-500 to-sky-500 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300" />

                    <div className="p-5">
                      {/* Top Row: Checkbox + Status + Actions */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(blog.id)}
                            onCheckedChange={() => toggleSelect(blog.id)}
                            className="border-slate-600 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                          />
                          {getStatusBadge(blog.status)}
                        </div>
                        <div onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 hover:text-white opacity-0 group-hover/card:opacity-100 transition-all"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="bg-slate-900 border-slate-700/60 shadow-xl shadow-black/20 rounded-xl p-1"
                            >
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewDetails(blog.id);
                                }}
                                className="text-slate-300 hover:bg-slate-800 rounded-lg cursor-pointer"
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/blogs/${blog.slug}`);
                                }}
                                className="text-slate-300 hover:bg-slate-800 rounded-lg cursor-pointer"
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View Live
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/admin/blogs/${blog.id}/edit`);
                                }}
                                className="text-slate-300 hover:bg-slate-800 rounded-lg cursor-pointer"
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(blog.id);
                                }}
                                className="text-red-400 hover:bg-red-500/10 rounded-lg cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {/* Title & Slug */}
                      <div className="mb-4">
                        <h3 className="font-semibold text-white text-base leading-snug line-clamp-2 group-hover/card:text-emerald-300 transition-colors">
                          {blog.title}
                        </h3>
                        <p className="text-xs text-slate-500 font-mono mt-1.5 truncate">
                          /{blog.slug}
                        </p>
                      </div>

                      {/* Divider */}
                      <div className="h-px bg-slate-800/60 mb-4" />

                      {/* Meta Row */}
                      <div className="flex items-center justify-between">
                        {/* Author */}
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-linear-to-br from-emerald-500/20 to-sky-500/20 text-[10px] font-bold text-emerald-300">
                            {blog.author_first_name?.[0]}{blog.author_last_name?.[0]}
                          </div>
                          <span className="text-slate-400 text-xs truncate max-w-25">
                            {blog.author_first_name} {blog.author_last_name}
                          </span>
                        </div>

                        {/* Views */}
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Eye className="w-3.5 h-3.5" />
                          <span className="text-xs font-medium">{blog.views}</span>
                        </div>
                      </div>

                      {/* Date Row */}
                      <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
                        <span>
                          {blog.published_at
                            ? `Published ${formatDistanceToNow(new Date(blog.published_at), { addSuffix: true })}`
                            : "Not published"}
                        </span>
                        <span>
                          {formatDistanceToNow(new Date(blog.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </>
      )}

      {/* Pagination */}
      {!loading && !error && totalPages > 1 && (
        <BlogPagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          itemsPerPage={limit}
          onPageChange={(newPage) => {
            setPage(newPage);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onItemsPerPageChange={(newLimit) => {
            setLimit(newLimit);
            setPage(1);
          }}
        />
      )}

      {/* Blog Detail Sidebar */}
      <AdminDetailSidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        title={detailBlog?.title || "Blog Details"}
        onEdit={detailBlog ? () => router.push(`/admin/blogs/${detailBlog.id}/edit`) : undefined}
        onDelete={detailBlog ? () => handleDelete(detailBlog.id) : undefined}
      >
        {detailLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          </div>
        ) : detailBlog ? (
          <div className="space-y-6">
            {/* Status */}
            <div>
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Status</label>
              <div className="mt-1">{getStatusBadge(detailBlog.status)}</div>
            </div>

            {/* Slug */}
            <div>
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">URL Slug</label>
              <p className="text-xs text-slate-300 mt-1 font-mono break-all">{detailBlog.slug}</p>
            </div>

            {/* Author */}
            <div>
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Author</label>
              <div className="flex items-center gap-2 mt-1">
                {detailBlog.author_avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={detailBlog.author_avatar}
                    alt={`${detailBlog.author_first_name} ${detailBlog.author_last_name}`}
                    className="h-8 w-8 rounded-full"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/20 to-sky-500/20 text-xs font-semibold text-emerald-300">
                    {detailBlog.author_first_name?.[0]}{detailBlog.author_last_name?.[0]}
                  </div>
                )}
                <div>
                  <p className="text-sm text-white">
                    {detailBlog.author_first_name} {detailBlog.author_last_name}
                  </p>
                  <p className="text-xs text-slate-500">{detailBlog.author_email}</p>
                </div>
              </div>
            </div>

            {/* Excerpt */}
            {detailBlog.excerpt && (
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Excerpt</label>
                <p className="text-sm text-slate-300 mt-1">{detailBlog.excerpt}</p>
              </div>
            )}

            {/* Featured Image */}
            {detailBlog.featured_image && (
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Featured Image</label>
                <div className="mt-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={detailBlog.featured_image}
                    alt={detailBlog.title}
                    className="w-full h-48 object-cover rounded-lg border border-slate-800"
                  />
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Views</label>
                <p className="text-lg font-semibold text-white mt-1">{detailBlog.views.toLocaleString()}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Reading Time</label>
                <p className="text-lg font-semibold text-white mt-1">{detailBlog.reading_time} min</p>
              </div>
            </div>

            {/* Dates */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Created</label>
                <p className="text-sm text-slate-300 mt-1">
                  {format(new Date(detailBlog.created_at), "PPpp")}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {formatDistanceToNow(new Date(detailBlog.created_at), { addSuffix: true })}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Updated</label>
                <p className="text-sm text-slate-300 mt-1">
                  {format(new Date(detailBlog.updated_at), "PPpp")}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {formatDistanceToNow(new Date(detailBlog.updated_at), { addSuffix: true })}
                </p>
              </div>
              {detailBlog.published_at && (
                <div>
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Published</label>
                  <p className="text-sm text-slate-300 mt-1">
                    {format(new Date(detailBlog.published_at), "PPpp")}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatDistanceToNow(new Date(detailBlog.published_at), { addSuffix: true })}
                  </p>
                </div>
              )}
            </div>

            {/* SEO Meta */}
            {(detailBlog.meta_title || detailBlog.meta_description || detailBlog.meta_keywords) && (
              <div className="space-y-3 pt-4 border-t border-slate-800">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">SEO Information</label>
                {detailBlog.meta_title && (
                  <div>
                    <label className="text-xs text-slate-500">Meta Title</label>
                    <p className="text-sm text-slate-300 mt-0.5">{detailBlog.meta_title}</p>
                  </div>
                )}
                {detailBlog.meta_description && (
                  <div>
                    <label className="text-xs text-slate-500">Meta Description</label>
                    <p className="text-sm text-slate-300 mt-0.5">{detailBlog.meta_description}</p>
                  </div>
                )}
                {detailBlog.meta_keywords && (
                  <div>
                    <label className="text-xs text-slate-500">Meta Keywords</label>
                    <p className="text-sm text-slate-300 mt-0.5">{detailBlog.meta_keywords}</p>
                  </div>
                )}
              </div>
            )}

            {/* Content Preview */}
            <div className="pt-4 border-t border-slate-800">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Content Preview</label>
              <div className="mt-2 p-3 rounded-lg bg-slate-900/50 border border-slate-800 max-h-60 overflow-y-auto">
                <div
                  className="text-sm text-slate-300 prose prose-invert prose-sm max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(detailBlog.content.substring(0, 500) + (detailBlog.content.length > 500 ? "..." : "")),
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="w-12 h-12 text-slate-500 mb-4" />
            <p className="text-slate-400">Failed to load blog details</p>
          </div>
        )}
      </AdminDetailSidebar>

      {/* Confirmation Modal */}
      <ConfirmationModal
        open={confirmModal.open}
        onOpenChange={(open) => setConfirmModal((prev) => ({ ...prev, open }))}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmLabel={confirmModal.confirmLabel}
        variant={confirmModal.variant}
        isLoading={confirmModal.isLoading}
        onConfirm={confirmModal.onConfirm}
      />
    </div>
  );
}
