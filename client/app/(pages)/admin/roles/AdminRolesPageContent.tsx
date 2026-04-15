"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Edit,
  Trash2,
  Grid3x3,
  List,
  ArrowUpDown,
  Shield,
  ShieldCheck,
  Users,
  AlertCircle,
  MoreVertical,
  Archive,
  ArchiveRestore,
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
import { RoleSearchFilters } from "./components/RoleSearchFilters";
import { RoleBulkActionsToolbar } from "./components/RoleBulkActionsToolbar";
import { RolePagination } from "./components/RolePagination";

interface Role {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  is_archived: boolean;
  user_count: number;
  created_at: string;
  updated_at: string;
}

interface RoleStats {
  total: number;
  by_role: Record<string, number>;
}

export default function AdminRolesPageContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSystemFilter, setIsSystemFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkActionLoading, setIsBulkActionLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [sortBy, setSortBy] = useState<"name" | "slug" | "created_at" | "user_count">("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [stats, setStats] = useState<RoleStats>({ total: 0, by_role: {} });
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

  useEffect(() => {
    if (user && user.role !== "admin") {
      router.push("/dashboard");
    }
  }, [user, router]);

  const fetchRoles = useCallback(
    async (
      pageNum: number = 1,
      search: string = "",
      isSystem: string = "all",
      itemsPerPage: number = 20
    ) => {
      try {
        setLoading(true);
        setError(null);

        const params: Record<string, string> = {
          page: pageNum.toString(),
          limit: itemsPerPage.toString(),
          sort_by: sortBy,
          sort_order: sortOrder,
        };

        if (search) params.search = search;
        if (isSystem !== "all") params.is_system = isSystem === "system" ? "true" : "false";

        const [rolesResponse, statsResponse] = await Promise.all([
          api.get<Role[]>("/admin/roles", { params }),
          api.get<RoleStats>("/admin/roles/stats"),
        ]);

        if (rolesResponse.success && rolesResponse.data) {
          const rolesList = Array.isArray(rolesResponse.data) ? rolesResponse.data : [];
          const meta = rolesResponse.meta;
          setRoles(rolesList);
          setTotalPages(meta?.totalPages || 1);
          setTotal(meta?.total || 0);
        } else {
          throw new Error("Failed to fetch roles");
        }

        if (statsResponse.success && statsResponse.data) {
          setStats(statsResponse.data);
        }
      } catch (err: unknown) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Failed to load roles. Please try again later.");
        }
      } finally {
        setLoading(false);
      }
    },
    [sortBy, sortOrder]
  );

  useEffect(() => {
    if (user?.role === "admin") {
      fetchRoles(page, searchQuery, isSystemFilter, limit);
    }
  }, [page, searchQuery, isSystemFilter, limit, user, fetchRoles, sortBy, sortOrder]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPage(1);
  };

  const handleDelete = (roleId: string) => {
    setConfirmModal({
      open: true,
      title: "Delete Role",
      description: "Are you sure you want to delete this role? This action cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isLoading: true }));
        try {
          await api.delete(`/admin/roles/${roleId}`);
          toast.success("Role deleted successfully");
          setConfirmModal((prev) => ({ ...prev, open: false, isLoading: false }));
          await fetchRoles(page, searchQuery, isSystemFilter, limit);
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : "Failed to delete role");
          setConfirmModal((prev) => ({ ...prev, isLoading: false }));
        }
      },
    });
  };

  const handleToggleStatus = async (roleId: string) => {
    try {
      await api.post(`/admin/roles/${roleId}/toggle-status`);
      toast.success("Role status updated successfully");
      await fetchRoles(page, searchQuery, isSystemFilter, limit);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update role status");
    }
  };

  const handleArchive = (roleId: string) => {
    setConfirmModal({
      open: true,
      title: "Archive Role",
      description: "Are you sure you want to archive this role? It will be deactivated and hidden from the main list.",
      confirmLabel: "Archive",
      variant: "warning",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isLoading: true }));
        try {
          await api.post(`/admin/roles/${roleId}/archive`);
          toast.success("Role archived successfully");
          setConfirmModal((prev) => ({ ...prev, open: false, isLoading: false }));
          await fetchRoles(page, searchQuery, isSystemFilter, limit);
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : "Failed to archive role");
          setConfirmModal((prev) => ({ ...prev, isLoading: false }));
        }
      },
    });
  };

  const handleUnarchive = async (roleId: string) => {
    try {
      await api.post(`/admin/roles/${roleId}/unarchive`);
      toast.success("Role unarchived successfully");
      await fetchRoles(page, searchQuery, isSystemFilter, limit);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to unarchive role");
    }
  };

  const handleBulkArchive = () => {
    if (selectedIds.size === 0) return;

    setConfirmModal({
      open: true,
      title: "Archive Roles",
      description: `Are you sure you want to archive ${selectedIds.size} role(s)? They will be deactivated and hidden from the main list.`,
      confirmLabel: "Archive",
      variant: "warning",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isLoading: true }));
        setIsBulkActionLoading(true);
        try {
          await api.post("/admin/roles/bulk-archive", { ids: Array.from(selectedIds) });
          toast.success(`${selectedIds.size} role(s) archived successfully`);
          setSelectedIds(new Set());
          setConfirmModal((prev) => ({ ...prev, open: false, isLoading: false }));
          await fetchRoles(page, searchQuery, isSystemFilter, limit);
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : "Failed to archive roles");
          setConfirmModal((prev) => ({ ...prev, isLoading: false }));
        } finally {
          setIsBulkActionLoading(false);
        }
      },
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;

    setConfirmModal({
      open: true,
      title: "Delete Roles",
      description: `Are you sure you want to delete ${selectedIds.size} role(s)? This action cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isLoading: true }));
        setIsBulkActionLoading(true);
        try {
          await api.post("/admin/roles/bulk-delete", { ids: Array.from(selectedIds) });
          toast.success(`${selectedIds.size} role(s) deleted successfully`);
          setSelectedIds(new Set());
          setConfirmModal((prev) => ({ ...prev, open: false, isLoading: false }));
          await fetchRoles(page, searchQuery, isSystemFilter, limit);
        } catch (err) {
          toast.error(err instanceof ApiError ? err.message : "Failed to delete roles");
          setConfirmModal((prev) => ({ ...prev, isLoading: false }));
        } finally {
          setIsBulkActionLoading(false);
        }
      },
    });
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  const getRoleBadge = (role: Role) => (
    <Badge
      variant="outline"
      className={cn(
        "capitalize rounded-lg px-2.5 py-0.5 text-xs font-medium border gap-1.5",
        role.is_system
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
          : "bg-slate-500/10 text-slate-400 border-slate-500/20"
      )}
    >
      {role.is_system ? (
        <ShieldCheck className="h-3 w-3" />
      ) : (
        <Shield className="h-3 w-3" />
      )}
      {role.slug}
    </Badge>
  );

  if (user?.role !== "admin") return null;

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-sky-600 p-8 md:p-10"
      >
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-sky-400/20 blur-3xl" />
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
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                  Role Management
                </h1>
                <p className="text-emerald-100/80 text-sm md:text-base mt-1">
                  Manage roles and permission access
                </p>
              </div>
            </div>
          </div>
          <Button
            onClick={() => router.push("/admin/roles/create")}
            size="lg"
            className="bg-white text-emerald-700 hover:bg-white/90 shadow-lg shadow-black/10 font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Role
          </Button>
        </div>

        <div className="relative z-10 grid grid-cols-2 md:grid-cols-3 gap-4 mt-8">
          {[
            { label: "Total Roles", value: stats.total || total, icon: Shield, color: "bg-white/20" },
            { label: "System Roles", value: roles.filter((r) => r.is_system).length, icon: ShieldCheck, color: "bg-white/20" },
            { label: "Custom Roles", value: roles.filter((r) => !r.is_system).length, icon: Users, color: "bg-white/20" },
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

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <RoleSearchFilters
          searchQuery={searchQuery}
          onSearchChange={handleSearch}
          isSystemFilter={isSystemFilter}
          onIsSystemChange={(v) => {
            setIsSystemFilter(v);
            setPage(1);
          }}
        />
      </motion.div>

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
                ? "bg-gradient-to-r from-emerald-500 to-sky-500 text-white shadow-md shadow-emerald-500/20"
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
                ? "bg-gradient-to-r from-emerald-500 to-sky-500 text-white shadow-md shadow-emerald-500/20"
                : "text-slate-400 hover:text-white hover:bg-slate-700/50"
            )}
          >
            <Grid3x3 className="w-4 h-4" />
          </button>
        </div>

        {selectedIds.size > 0 && (
          <RoleBulkActionsToolbar
            selectedCount={selectedIds.size}
            onBulkDelete={handleBulkDelete}
            onBulkArchive={handleBulkArchive}
            isLoading={isBulkActionLoading}
            onClearSelection={() => setSelectedIds(new Set())}
          />
        )}
      </motion.div>

      {loading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-xl p-5 bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm">
              <div className="flex items-center gap-4">
                <Skeleton className="h-5 w-5 rounded bg-slate-800" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3 bg-slate-800" />
                  <Skeleton className="h-3 w-1/3 bg-slate-800/60" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full bg-slate-800" />
              </div>
            </div>
          ))}
        </div>
      )}

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
            onClick={() => fetchRoles(page, searchQuery, isSystemFilter, limit)}
            className="bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-600 hover:to-sky-600 text-white shadow-lg shadow-emerald-500/20"
          >
            Try Again
          </Button>
        </motion.div>
      )}

      {!loading && !error && (
        <>
          {roles.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="flex flex-col items-center justify-center py-20 rounded-2xl bg-slate-900/40 border border-slate-800/60 backdrop-blur-sm"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/10 to-sky-500/10 border border-emerald-500/20">
                <Shield className="w-10 h-10 text-emerald-400/60" />
              </div>
              <div className="text-center mt-5">
                <p className="text-slate-200 font-semibold text-lg">No roles found</p>
                <p className="text-slate-500 text-sm mt-1.5">
                  {searchQuery || isSystemFilter !== "all"
                    ? "Try adjusting your search or filters"
                    : "Start by creating your first role"}
                </p>
              </div>
              {!searchQuery && isSystemFilter === "all" && (
                <Button
                  onClick={() => router.push("/admin/roles/create")}
                  className="bg-gradient-to-r from-emerald-500 to-sky-500 hover:from-emerald-600 hover:to-sky-600 text-white shadow-lg shadow-emerald-500/20 mt-6"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Role
                </Button>
              )}
            </motion.div>
          )}

          {roles.length > 0 && viewMode === "grid" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            >
              <AnimatePresence mode="popLayout">
                {roles.map((role, index) => (
                  <motion.div
                    key={role.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.04 }}
                    className={cn(
                      "group/card relative rounded-2xl bg-slate-900/40 border backdrop-blur-sm overflow-hidden shadow-lg shadow-black/10 cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/5 hover:-translate-y-1",
                      selectedIds.has(role.id)
                        ? "border-emerald-500/40 bg-emerald-500/5"
                        : "border-slate-800/60 hover:border-slate-700/60"
                    )}
                    onClick={() => router.push(`/admin/roles/${role.id}/edit`)}
                  >
                    <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-sky-500 opacity-0 group-hover/card:opacity-100 transition-opacity duration-300" />
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(role.id)}
                            onCheckedChange={() => toggleSelect(role.id)}
                            disabled={false}
                            className="border-slate-600 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                          />
                          {getRoleBadge(role)}
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
                                onClick={() => router.push(`/admin/roles/${role.id}/edit`)}
                                className="text-slate-300 hover:bg-slate-800 rounded-lg cursor-pointer"
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              {role.is_archived ? (
                                <DropdownMenuItem
                                  onClick={() => handleUnarchive(role.id)}
                                  className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg cursor-pointer"
                                >
                                  <ArchiveRestore className="w-4 h-4 mr-2" />
                                  Unarchive
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => handleArchive(role.id)}
                                  className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg cursor-pointer"
                                >
                                  <Archive className="w-4 h-4 mr-2" />
                                  Archive
                                </DropdownMenuItem>
                              )}
                              {!role.is_system || (role.is_system && role.user_count === 0) ? (
                                <>
                                  <DropdownMenuSeparator className="bg-slate-800" />
                                  <DropdownMenuItem
                                    onClick={() => handleDelete(role.id)}
                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <h3 className="font-semibold text-white group-hover:text-emerald-300 transition-colors truncate">
                        {role.name}
                      </h3>
                      {role.description && (
                        <p className="text-xs text-slate-400 truncate mt-1">{role.description}</p>
                      )}
                      <div className="pt-3 border-t border-slate-800/60 mt-4 flex items-center justify-between text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {role.user_count} user{role.user_count !== 1 ? "s" : ""}
                        </span>
                        <span>{formatDistanceToNow(new Date(role.created_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}

          {roles.length > 0 && viewMode === "table" && (
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
                        checked={selectedIds.size === roles.length && roles.length > 0}
                        onCheckedChange={() => {
                          if (selectedIds.size === roles.length) setSelectedIds(new Set());
                          else setSelectedIds(new Set(roles.map((r) => r.id)));
                        }}
                        className="border-slate-600 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                      />
                    </TableHead>
                    <TableHead className="text-slate-300 font-semibold text-xs uppercase tracking-wider">
                      Role
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort("slug")}
                        className="flex items-center gap-2 text-slate-300 hover:text-emerald-400 transition-colors font-semibold text-xs uppercase tracking-wider"
                      >
                        Slug
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        onClick={() => handleSort("user_count")}
                        className="flex items-center gap-2 text-slate-300 hover:text-emerald-400 transition-colors font-semibold text-xs uppercase tracking-wider"
                      >
                        Users
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
                    <TableHead className="text-slate-300 font-semibold text-xs uppercase tracking-wider">
                      Status
                    </TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence mode="popLayout">
                    {roles.map((role, index) => (
                      <motion.tr
                        key={role.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ delay: index * 0.03 }}
                        className={cn(
                          "border-slate-800/40 transition-all duration-200 cursor-pointer group/row",
                          selectedIds.has(role.id) ? "bg-emerald-500/5" : "hover:bg-slate-800/40"
                        )}
                        onClick={() => router.push(`/admin/roles/${role.id}/edit`)}
                      >
                        <TableCell className="pl-5" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(role.id)}
                            onCheckedChange={() => toggleSelect(role.id)}
                            disabled={false}
                            className="border-slate-600 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/20 to-sky-500/20 text-emerald-300">
                              <Shield className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="font-medium text-white group-hover:text-emerald-300 transition-colors">
                                {role.name}
                              </div>
                              {role.description && (
                                <div className="text-xs text-slate-500 truncate max-w-[200px]">
                                  {role.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getRoleBadge(role)}</TableCell>
                        <TableCell>
                          <span className="text-slate-400 text-sm flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {role.user_count}
                          </span>
                        </TableCell>
                        <TableCell className="text-slate-400 text-sm">
                          {formatDistanceToNow(new Date(role.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-3">
                            <Switch
                              checked={role.is_active}
                              onCheckedChange={() => handleToggleStatus(role.id)}
                              disabled={false}
                              className="data-[state=checked]:bg-emerald-500"
                            />
                            <span className={cn(
                              "text-xs font-medium",
                              role.is_active ? "text-emerald-400" : "text-red-400"
                            )}>
                              {role.is_active ? "Active" : "Inactive"}
                            </span>
                            {role.is_archived && (
                              <Badge
                                variant="outline"
                                className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs"
                              >
                                <Archive className="w-3 h-3 mr-1" />
                                Archived
                              </Badge>
                            )}
                          </div>
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
                                onClick={() => router.push(`/admin/roles/${role.id}/edit`)}
                                className="text-slate-300 hover:text-white hover:bg-slate-800"
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              {!role.is_system && (
                                <>
                                  <DropdownMenuSeparator className="bg-slate-800" />
                                  {role.is_archived ? (
                                    <DropdownMenuItem
                                      onClick={() => handleUnarchive(role.id)}
                                      className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                                    >
                                      <ArchiveRestore className="w-4 h-4 mr-2" />
                                      Unarchive
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem
                                      onClick={() => handleArchive(role.id)}
                                      className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10"
                                    >
                                      <Archive className="w-4 h-4 mr-2" />
                                      Archive
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() => handleDelete(role.id)}
                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              )}
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

          {roles.length > 0 && totalPages > 1 && (
            <RolePagination
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
