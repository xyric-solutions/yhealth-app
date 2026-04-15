"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
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
  Users,
  UserCheck,
  UserX,
  Mail,
  MailCheck,
  Download,
  Phone,
  FileText,
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
import { api, ApiError } from "@/lib/api-client";
import { useAuth } from "@/app/context/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import Image from "next/image";
import { UserSearchFilters } from "./components/UserSearchFilters";
import { UserBulkActionsToolbar } from "./components/UserBulkActionsToolbar";
import { UserPagination } from "./components/UserPagination";

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  is_email_verified: boolean;
  avatar: string | null;
  phone: string | null;
  date_of_birth: Date | null;
  gender: string | null;
  last_login: Date | null;
  created_at: Date;
  updated_at: Date;
  blog_count?: number;
}

export default function AdminUsersPageContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [verifiedFilter, setVerifiedFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [sortBy, setSortBy] = useState<"created_at" | "updated_at" | "last_login" | "email" | "first_name" | "last_name" | "role">("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    verified: 0,
    unverified: 0,
    by_role: {} as Record<string, number>,
  });
  const hasLoadedOnce = useRef(false);

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

  const fetchUsers = useCallback(
    async (
      pageNum: number = 1,
      search: string = "",
      role: string = "all",
      status: string = "all",
      verified: string = "all",
      itemsPerPage: number = 20
    ) => {
      const isInitialLoad = !hasLoadedOnce.current;
      try {
        if (isInitialLoad) {
          setLoading(true);
        }
        setFetching(true);
        setError(null);

        const params: Record<string, string> = {
          page: pageNum.toString(),
          limit: itemsPerPage.toString(),
          sort_by: sortBy,
          sort_order: sortOrder,
        };

        if (search) {
          params.search = search;
        }

        if (role !== "all") {
          params.role = role;
        }

        if (status !== "all") {
          params.is_active = status === "active" ? "true" : "false";
        }

        if (verified !== "all") {
          params.is_email_verified = verified === "verified" ? "true" : "false";
        }

        const [usersResponse, statsResponse] = await Promise.all([
          api.get<User[]>("/admin/users", { params }),
          api.get<typeof stats>("/admin/users/stats"),
        ]);

        if (usersResponse.success && usersResponse.data) {
          const fetchedUsers = Array.isArray(usersResponse.data) ? usersResponse.data : [];
          const meta = usersResponse.meta;

          setUsers(fetchedUsers);
          setTotalPages(meta?.totalPages || 1);
          setTotal(meta?.total || 0);
          hasLoadedOnce.current = true;
        } else {
          throw new Error("Failed to fetch users");
        }

        if (statsResponse.success && statsResponse.data) {
          setStats(statsResponse.data);
        }
      } catch (err: unknown) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Failed to load users. Please try again later.");
        }
      } finally {
        setLoading(false);
        setFetching(false);
      }
    },
    [sortBy, sortOrder]
  );

  useEffect(() => {
    if (user?.role === "admin") {
      fetchUsers(page, searchQuery, roleFilter, statusFilter, verifiedFilter, limit);
    }
  }, [page, searchQuery, roleFilter, statusFilter, verifiedFilter, limit, user, fetchUsers, sortBy, sortOrder]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setPage(1);
  }, []);

  const handleDelete = (userId: string) => {
    setConfirmModal({
      open: true,
      title: "Delete User",
      description: "Are you sure you want to delete this user? This action cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isLoading: true }));
        try {
          await api.delete(`/admin/users/${userId}`);
          toast.success("User deleted successfully");
          setConfirmModal((prev) => ({ ...prev, open: false, isLoading: false }));
          await fetchUsers(page, searchQuery, roleFilter, statusFilter, verifiedFilter, limit);
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : "Failed to delete user");
          setConfirmModal((prev) => ({ ...prev, isLoading: false }));
        }
      },
    });
  };

  const handleToggleStatus = async (userId: string) => {
    try {
      await api.post(`/admin/users/${userId}/toggle-status`);
      toast.success("User status updated successfully");
      await fetchUsers(page, searchQuery, roleFilter, statusFilter, verifiedFilter, limit);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update user status");
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;

    setConfirmModal({
      open: true,
      title: "Delete Users",
      description: `Are you sure you want to delete ${selectedIds.size} user(s)? This action cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isLoading: true }));
        setIsBulkActionLoading(true);
        try {
          await api.post("/admin/users/bulk-delete", {
            ids: Array.from(selectedIds),
          });
          toast.success(`${selectedIds.size} user(s) deleted successfully`);
          setSelectedIds(new Set());
          setConfirmModal((prev) => ({ ...prev, open: false, isLoading: false }));
          await fetchUsers(page, searchQuery, roleFilter, statusFilter, verifiedFilter, limit);
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : "Failed to delete users");
          setConfirmModal((prev) => ({ ...prev, isLoading: false }));
        } finally {
          setIsBulkActionLoading(false);
        }
      },
    });
  };

  const handleBulkStatus = async (is_active: boolean) => {
    if (selectedIds.size === 0) return;

    setIsBulkActionLoading(true);
    try {
      await api.post("/admin/users/bulk-status", {
        ids: Array.from(selectedIds),
        is_active,
      });
      toast.success(`${selectedIds.size} user(s) ${is_active ? "activated" : "deactivated"} successfully`);
      setSelectedIds(new Set());
      await fetchUsers(page, searchQuery, roleFilter, statusFilter, verifiedFilter, limit);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update users");
    } finally {
      setIsBulkActionLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await api.get<User[]>("/admin/users", {
        params: {
          page: "1",
          limit: "10000", // Get all users
          sort_by: sortBy,
          sort_order: sortOrder,
        },
      });

      if (response.success && response.data) {
        const users = Array.isArray(response.data) ? response.data : [];
        const csv = convertToCSV(users);
        const blob = new Blob([csv], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `users-export-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success("Users exported successfully");
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to export users");
    }
  };

  const convertToCSV = (users: User[]): string => {
    const headers = [
      "ID",
      "Email",
      "First Name",
      "Last Name",
      "Role",
      "Active",
      "Email Verified",
      "Phone",
      "Date of Birth",
      "Gender",
      "Last Login",
      "Created At",
      "Blog Count",
    ];

    const rows = users.map((user) => [
      user.id,
      user.email,
      user.first_name,
      user.last_name,
      user.role,
      user.is_active ? "Yes" : "No",
      user.is_email_verified ? "Yes" : "No",
      user.phone || "",
      user.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString() : "",
      user.gender || "",
      user.last_login ? new Date(user.last_login).toLocaleString() : "",
      new Date(user.created_at).toLocaleString(),
      user.blog_count || 0,
    ]);

    return [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
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
    if (selectedIds.size === users.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(users.map((u) => u.id)));
    }
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, { className: string; dot: string }> = {
      admin: {
        className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        dot: "bg-emerald-400",
      },
      moderator: {
        className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
        dot: "bg-blue-400",
      },
      doctor: {
        className: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
        dot: "bg-cyan-400",
      },
      user: {
        className: "bg-slate-500/10 text-slate-400 border-slate-500/20",
        dot: "bg-slate-400",
      },
      patient: {
        className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        dot: "bg-emerald-400",
      },
    };

    const config = variants[role] || variants.user;

    return (
      <Badge
        variant="outline"
        className={cn(
          "capitalize rounded-lg px-2.5 py-0.5 text-xs font-medium border gap-1.5",
          config.className
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
        {role}
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
        router.push("/admin/users/create");
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("user-search")?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

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
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
              backgroundSize: "32px 32px",
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                  User Management
                </h1>
                <p className="text-emerald-100/80 text-sm md:text-base mt-1">
                  Manage users, roles, and permissions
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleExport}
              variant="outline"
              size="lg"
              className="bg-white/10 text-white border-white/20 hover:bg-white/20 backdrop-blur-sm"
            >
              <Download className="w-5 h-5 mr-2" />
              Export
            </Button>
            <Button
              onClick={() => router.push("/admin/users/create")}
              size="lg"
              className="bg-white text-emerald-700 hover:bg-white/90 shadow-lg shadow-black/10 font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create User
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="relative z-10 grid grid-cols-2 md:grid-cols-5 gap-4 mt-8">
          {[
            {
              label: "Total Users",
              value: stats.total || total,
              icon: Users,
              color: "bg-white/20",
            },
            {
              label: "Active",
              value: stats.active || 0,
              icon: UserCheck,
              color: "bg-white/20",
            },
            {
              label: "Inactive",
              value: stats.inactive || 0,
              icon: UserX,
              color: "bg-white/20",
            },
            {
              label: "Verified",
              value: stats.verified || 0,
              icon: MailCheck,
              color: "bg-white/20",
            },
            {
              label: "Unverified",
              value: stats.unverified || 0,
              icon: Mail,
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
        <UserSearchFilters
          searchQuery={searchQuery}
          onSearchChange={handleSearch}
          roleFilter={roleFilter}
          onRoleChange={(role) => {
            setRoleFilter(role);
            setPage(1);
          }}
          statusFilter={statusFilter}
          onStatusChange={(status) => {
            setStatusFilter(status);
            setPage(1);
          }}
          verifiedFilter={verifiedFilter}
          onVerifiedChange={(verified) => {
            setVerifiedFilter(verified);
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
          <UserBulkActionsToolbar
            selectedCount={selectedIds.size}
            onBulkDelete={handleBulkDelete}
            onBulkActivate={() => handleBulkStatus(true)}
            onBulkDeactivate={() => handleBulkStatus(false)}
            isLoading={isBulkActionLoading}
            onClearSelection={() => setSelectedIds(new Set())}
          />
        )}
      </motion.div>

      {/* Initial Loading State — only on first load when no data yet */}
      {loading && users.length === 0 && (
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
            onClick={() => fetchUsers(page, searchQuery, roleFilter, statusFilter, verifiedFilter, limit)}
            className="bg-linear-to-r from-emerald-500 to-sky-500 hover:from-emerald-600 hover:to-sky-600 text-white shadow-lg shadow-emerald-500/20"
          >
            Try Again
          </Button>
        </motion.div>
      )}

      {/* User Content — stays visible during pagination (dimmed while fetching) */}
      {!(loading && users.length === 0) && !error && (
        <>
          {/* Empty State */}
          {users.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="flex flex-col items-center justify-center py-20 rounded-2xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-500/10 to-sky-500/10 border border-emerald-500/20">
                <Users className="w-10 h-10 text-emerald-400/60" />
              </div>
              <div className="text-center mt-5">
                <p className="text-slate-200 font-semibold text-lg">No users found</p>
                <p className="text-slate-500 text-sm mt-1.5">
                  {searchQuery || roleFilter !== "all" || statusFilter !== "all"
                    ? "Try adjusting your search or filters"
                    : "Start creating your first user"}
                </p>
              </div>
              {!searchQuery && roleFilter === "all" && statusFilter === "all" && (
                <Button
                  onClick={() => router.push("/admin/users/create")}
                  className="bg-linear-to-r from-emerald-500 to-sky-500 hover:from-emerald-600 hover:to-sky-600 text-white shadow-lg shadow-emerald-500/20 mt-6"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First User
                </Button>
              )}
            </motion.div>
          )}

          {/* Fetching overlay — subtle indicator while paginating */}
          {fetching && users.length > 0 && (
            <div className="flex items-center justify-center py-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/40">
                <div className="h-3 w-3 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
                <span className="text-xs text-slate-400">Loading...</span>
              </div>
            </div>
          )}

          {/* Grid View */}
          {users.length > 0 && viewMode === "grid" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className={cn(
                "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 transition-opacity duration-200",
                fetching && "opacity-50 pointer-events-none"
              )}
            >
              <AnimatePresence mode="popLayout">
                {users.map((user, index) => (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.04 }}
                    className={cn(
                      "group/card relative rounded-2xl bg-slate-900/40 border backdrop-blur-sm overflow-hidden shadow-lg shadow-black/10 cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/5 hover:-translate-y-1",
                      selectedIds.has(user.id)
                        ? "border-emerald-500/40 bg-emerald-500/5"
                        : "border-slate-800/60 hover:border-slate-700/60"
                    )}
                    onClick={() => router.push(`/admin/users/${user.id}/edit`)}
                  >
                    {/* Card Header with gradient accent */}
                    <div className="h-1.5 bg-linear-to-r from-emerald-500 to-sky-500 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300" />

                    <div className="p-5">
                      {/* Top Row: Checkbox + Status + Actions */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(user.id)}
                            onCheckedChange={() => toggleSelect(user.id)}
                            className="border-slate-600 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                          />
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={user.is_active}
                              onCheckedChange={() => handleToggleStatus(user.id)}
                              className="data-[state=checked]:bg-emerald-500"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className={cn(
                              "text-xs font-medium",
                              user.is_active ? "text-emerald-400" : "text-red-400"
                            )}>
                              {user.is_active ? "Active" : "Blocked"}
                            </span>
                          </div>
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
                                onClick={() => router.push(`/admin/users/${user.id}/edit`)}
                                className="text-slate-300 hover:bg-slate-800 rounded-lg cursor-pointer"
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleToggleStatus(user.id)}
                                className="text-slate-300 hover:bg-slate-800 rounded-lg cursor-pointer"
                              >
                                {user.is_active ? (
                                  <>
                                    <UserX className="w-4 h-4 mr-2" />
                                    Deactivate
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="w-4 h-4 mr-2" />
                                    Activate
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-slate-800" />
                              <DropdownMenuItem
                                onClick={() => handleDelete(user.id)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {/* User Avatar and Name */}
                      <div className="flex items-center gap-3 mb-4">
                        {user.avatar ? (
                          <div className="relative h-16 w-16 rounded-full overflow-hidden border-2 border-slate-700">
                            <Image
                              src={user.avatar}
                              alt={`${user.first_name} ${user.last_name}`}
                              width={64}
                              height={64}
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-emerald-500/20 to-sky-500/20 text-lg font-semibold text-emerald-300 border-2 border-slate-700">
                            {user.first_name?.[0]}{user.last_name?.[0]}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-white group-hover/card:text-emerald-300 transition-colors truncate">
                            {user.first_name} {user.last_name}
                          </h3>
                          <p className="text-xs text-slate-400 truncate">{user.email}</p>
                        </div>
                      </div>

                      {/* User Details */}
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Role</span>
                          {getRoleBadge(user.role)}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Status</span>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={user.is_active}
                              onCheckedChange={() => handleToggleStatus(user.id)}
                              className="data-[state=checked]:bg-emerald-500"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className={cn(
                              "text-xs font-medium",
                              user.is_active ? "text-emerald-400" : "text-red-400"
                            )}>
                              {user.is_active ? "Active" : "Blocked"}
                            </span>
                          </div>
                        </div>
                        {user.phone && (
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <Phone className="w-3 h-3" />
                            <span className="truncate">{user.phone}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          {user.is_email_verified ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs"
                            >
                              <MailCheck className="w-3 h-3 mr-1" />
                              Verified
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs"
                            >
                              <Mail className="w-3 h-3 mr-1" />
                              Unverified
                            </Badge>
                          )}
                          {user.blog_count !== undefined && user.blog_count > 0 && (
                            <Badge
                              variant="outline"
                              className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs"
                            >
                              <FileText className="w-3 h-3 mr-1" />
                              {user.blog_count} blog{user.blog_count !== 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Footer Info */}
                      <div className="pt-3 border-t border-slate-800/60">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>
                            {user.last_login
                              ? formatDistanceToNow(new Date(user.last_login), { addSuffix: true })
                              : "Never logged in"}
                          </span>
                          <span>
                            {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}

          {/* Table View */}
          {users.length > 0 && viewMode === "table" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className={cn(
                "rounded-2xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm overflow-hidden shadow-xl shadow-black/10 transition-opacity duration-200",
                fetching && "opacity-50 pointer-events-none"
              )}
            >
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800/60 bg-slate-800/30 hover:bg-slate-800/40">
                    <TableHead className="w-12 pl-5">
                      <Checkbox
                        checked={selectedIds.size === users.length && users.length > 0}
                        onCheckedChange={toggleSelectAll}
                        className="border-slate-600 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                      />
                    </TableHead>
                    <TableHead className="text-slate-300 font-semibold text-xs uppercase tracking-wider">
                      User
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort("email")}
                        className="flex items-center gap-2 text-slate-300 hover:text-emerald-400 transition-colors font-semibold text-xs uppercase tracking-wider"
                      >
                        Email
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort("role")}
                        className="flex items-center gap-2 text-slate-300 hover:text-emerald-400 transition-colors font-semibold text-xs uppercase tracking-wider"
                      >
                        Role
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </button>
                    </TableHead>
                    <TableHead className="text-slate-300 font-semibold text-xs uppercase tracking-wider">
                      Status
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort("last_login")}
                        className="flex items-center gap-2 text-slate-300 hover:text-emerald-400 transition-colors font-semibold text-xs uppercase tracking-wider"
                      >
                        Last Login
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
                    {users.map((user, index) => (
                      <motion.tr
                        key={user.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ delay: index * 0.03 }}
                        className={cn(
                          "border-slate-800/40 transition-all duration-200 cursor-pointer group/row",
                          selectedIds.has(user.id)
                            ? "bg-emerald-500/5"
                            : "hover:bg-slate-800/40"
                        )}
                        onClick={() => router.push(`/admin/users/${user.id}/edit`)}
                      >
                        <TableCell className="pl-5" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(user.id)}
                            onCheckedChange={() => toggleSelect(user.id)}
                            className="border-slate-600 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {user.avatar ? (
                              <div className="relative h-10 w-10 rounded-full overflow-hidden border-2 border-slate-700">
                                <Image
                                  src={user.avatar}
                                  alt={`${user.first_name} ${user.last_name}`}
                                  width={40}
                                  height={40}
                                  className="object-cover"
                                />
                              </div>
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-emerald-500/20 to-sky-500/20 text-sm font-semibold text-emerald-300">
                                {user.first_name?.[0]}{user.last_name?.[0]}
                              </div>
                            )}
                            <div>
                              <div className="font-medium text-white group-hover/row:text-emerald-300 transition-colors">
                                {user.first_name} {user.last_name}
                              </div>
                              {user.phone && (
                                <div className="text-xs text-slate-500 flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {user.phone}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-slate-300 text-sm">{user.email}</div>
                            <div className="flex items-center gap-2">
                              {user.is_email_verified ? (
                                <Badge
                                  variant="outline"
                                  className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs px-1.5 py-0"
                                >
                                  <MailCheck className="w-3 h-3 mr-1" />
                                  Verified
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs px-1.5 py-0"
                                >
                                  <Mail className="w-3 h-3 mr-1" />
                                  Unverified
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getRoleBadge(user.role)}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-3">
                            <Switch
                              checked={user.is_active}
                              onCheckedChange={() => handleToggleStatus(user.id)}
                              className="data-[state=checked]:bg-emerald-500"
                            />
                            <span className={cn(
                              "text-xs font-medium",
                              user.is_active ? "text-emerald-400" : "text-red-400"
                            )}>
                              {user.is_active ? "Active" : "Blocked"}
                            </span>
                            {user.blog_count !== undefined && user.blog_count > 0 && (
                              <Badge
                                variant="outline"
                                className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs ml-2"
                              >
                                <FileText className="w-3 h-3 mr-1" />
                                {user.blog_count}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-400 text-sm">
                          {user.last_login
                            ? formatDistanceToNow(new Date(user.last_login), {
                                addSuffix: true,
                              })
                            : <span className="text-slate-600">Never</span>}
                        </TableCell>
                        <TableCell className="text-slate-400 text-sm">
                          {formatDistanceToNow(new Date(user.created_at), {
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
                            <DropdownMenuContent align="end" className="bg-slate-900 border-slate-800">
                              <DropdownMenuItem
                                onClick={() => router.push(`/admin/users/${user.id}/edit`)}
                                className="text-slate-300 hover:text-white hover:bg-slate-800"
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleToggleStatus(user.id)}
                                className="text-slate-300 hover:text-white hover:bg-slate-800"
                              >
                                {user.is_active ? (
                                  <>
                                    <UserX className="w-4 h-4 mr-2" />
                                    Deactivate
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="w-4 h-4 mr-2" />
                                    Activate
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-slate-800" />
                              <DropdownMenuItem
                                onClick={() => handleDelete(user.id)}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
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

          {/* Pagination */}
          {users.length > 0 && totalPages > 1 && (
            <UserPagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={total}
              itemsPerPage={limit}
              onPageChange={setPage}
              onItemsPerPageChange={(newLimit) => {
                setLimit(newLimit);
                setPage(1);
              }}
            />
          )}
        </>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        open={confirmModal.open}
        onOpenChange={(open) => setConfirmModal((prev) => ({ ...prev, open }))}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmLabel={confirmModal.confirmLabel}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
        isLoading={confirmModal.isLoading}
      />
    </div>
  );
}
