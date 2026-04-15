"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Search,
  Filter,
  LayoutGrid,
  LayoutList,
  Loader2,
  AlertCircle,
  Inbox,
  Trash2,
  Eye,
  Clock,
  CheckCircle2,
  Archive,
  Mail,
  Phone,
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Flag,
  Send,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";

// ============================================
// TYPES
// ============================================

interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  status: "new" | "read" | "in_progress" | "resolved" | "archived";
  priority: "low" | "normal" | "high" | "urgent";
  assigned_to: string | null;
  admin_notes: string | null;
  ip_address: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  assigned_first_name: string | null;
  assigned_last_name: string | null;
  resolved_first_name: string | null;
  resolved_last_name: string | null;
  created_at: string;
  updated_at: string;
}

interface ContactStats {
  total: number;
  new: number;
  read: number;
  in_progress: number;
  resolved: number;
  archived: number;
  by_priority: Record<string, number>;
  by_subject: Array<{ subject: string; count: number }>;
  avg_resolution_hours: number | null;
}

type SortField = "created_at" | "updated_at" | "priority" | "status" | "name" | "email";
type SortOrder = "asc" | "desc";
type ViewMode = "table" | "grid";

// ============================================
// CONSTANTS
// ============================================

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: typeof Inbox }> = {
  new: { label: "New", color: "text-blue-400", bgColor: "bg-blue-500/10 border-blue-500/20", icon: Inbox },
  read: { label: "Read", color: "text-slate-400", bgColor: "bg-slate-500/10 border-slate-500/20", icon: Eye },
  in_progress: { label: "In Progress", color: "text-amber-400", bgColor: "bg-amber-500/10 border-amber-500/20", icon: Clock },
  resolved: { label: "Resolved", color: "text-emerald-400", bgColor: "bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle2 },
  archived: { label: "Archived", color: "text-slate-500", bgColor: "bg-slate-600/10 border-slate-600/20", icon: Archive },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  low: { label: "Low", color: "text-slate-400", bgColor: "bg-slate-500/10" },
  normal: { label: "Normal", color: "text-blue-400", bgColor: "bg-blue-500/10" },
  high: { label: "High", color: "text-amber-400", bgColor: "bg-amber-500/10" },
  urgent: { label: "Urgent", color: "text-red-400", bgColor: "bg-red-500/10" },
};

// ============================================
// MAIN PAGE
// ============================================

export default function AdminContactsPageContent() {
  // Data state
  const [contacts, setContacts] = useState<ContactSubmission[]>([]);
  const [stats, setStats] = useState<ContactStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  // Sorting
  const [sortBy, setSortBy] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Detail view
  const [selectedContact, setSelectedContact] = useState<ContactSubmission | null>(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);

  // Modals
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; id?: string; bulk?: boolean }>({ open: false });
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [replyModal, setReplyModal] = useState<{ open: boolean; contact: ContactSubmission | null }>({ open: false, contact: null });
  const [replyMessage, setReplyMessage] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchContacts = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);

      const params: Record<string, string> = {
        page: page.toString(),
        limit: limit.toString(),
        sort_by: sortBy,
        sort_order: sortOrder,
      };

      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;

      const response = await api.get<ContactSubmission[]>("/admin/contacts", { params });

      if (response.success && response.data) {
        setContacts(response.data);
        if (response.meta) {
          setTotalPages(response.meta.totalPages);
          setTotal(response.meta.total);
        }
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load contact submissions");
      }
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, sortBy, sortOrder, debouncedSearch, statusFilter, priorityFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get<ContactStats>("/admin/contacts/stats");
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch {
      // Stats are non-critical
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Debounce search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [search]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setShowDetailPanel(false);
        setSelectedContact(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ============================================
  // ACTIONS
  // ============================================

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setPage(1);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(contacts.map((c) => c.id)));
    }
    setSelectAll(!selectAll);
  };

  const handleSelectOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
    setSelectAll(newSet.size === contacts.length);
  };

  const handleViewContact = async (contact: ContactSubmission) => {
    setSelectedContact(contact);
    setShowDetailPanel(true);

    // Mark as read if new
    if (contact.status === "new") {
      try {
        await api.patch(`/admin/contacts/${contact.id}`, { status: "read" });
        setContacts((prev) =>
          prev.map((c) => (c.id === contact.id ? { ...c, status: "read" as const } : c))
        );
        fetchStats();
      } catch {
        // Non-critical
      }
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/admin/contacts/${id}`, { status });
      setContacts((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: status as ContactSubmission["status"] } : c))
      );
      if (selectedContact?.id === id) {
        setSelectedContact((prev) => prev ? { ...prev, status: status as ContactSubmission["status"] } : null);
      }
      fetchStats();
    } catch {
      // Handle error silently
    }
  };

  const handleUpdatePriority = async (id: string, priority: string) => {
    try {
      await api.patch(`/admin/contacts/${id}`, { priority });
      setContacts((prev) =>
        prev.map((c) => (c.id === id ? { ...c, priority: priority as ContactSubmission["priority"] } : c))
      );
      if (selectedContact?.id === id) {
        setSelectedContact((prev) => prev ? { ...prev, priority: priority as ContactSubmission["priority"] } : null);
      }
    } catch {
      // Handle error silently
    }
  };

  const handleSendReply = async () => {
    if (!replyModal.contact || !replyMessage.trim()) {
      return;
    }

    setIsSendingReply(true);
    try {
      await api.post(`/admin/contacts/${replyModal.contact.id}/reply`, {
        message: replyMessage.trim(),
      });
      setReplyModal({ open: false, contact: null });
      setReplyMessage("");
      // Refresh contacts to update status
      fetchContacts();
      if (selectedContact?.id === replyModal.contact.id) {
        fetchContacts(); // Refresh selected contact
      }
      // Show success message (you can add a toast notification here)
    } catch (error) {
      console.error("Failed to send reply:", error);
      // Handle error (you can add error toast here)
    } finally {
      setIsSendingReply(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      if (deleteModal.bulk) {
        await api.post("/admin/contacts/bulk-delete", { ids: Array.from(selectedIds) });
        setSelectedIds(new Set());
        setSelectAll(false);
      } else if (deleteModal.id) {
        await api.delete(`/admin/contacts/${deleteModal.id}`);
        if (selectedContact?.id === deleteModal.id) {
          setShowDetailPanel(false);
          setSelectedContact(null);
        }
      }
      setDeleteModal({ open: false });
      fetchContacts();
      fetchStats();
    } catch {
      // Handle error
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkUpdateStatus = async (status: string) => {
    setIsBulkUpdating(true);
    try {
      await api.post("/admin/contacts/bulk-status", {
        ids: Array.from(selectedIds),
        status,
      });
      setSelectedIds(new Set());
      setSelectAll(false);
      fetchContacts();
      fetchStats();
    } catch {
      // Handle error
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ["Name", "Email", "Phone", "Subject", "Status", "Priority", "Message", "Created At"];
    const rows = contacts.map((c) => [
      c.name,
      c.email,
      c.phone || "",
      c.subject,
      c.status,
      c.priority,
      `"${c.message.replace(/"/g, '""')}"`,
      new Date(c.created_at).toLocaleString(),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contacts-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeFilterCount = [statusFilter, priorityFilter].filter(Boolean).length;

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-8">
      {/* ============================================ */}
      {/* HERO HEADER WITH GRADIENT */}
      {/* ============================================ */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-500 to-sky-600 p-8 md:p-10"
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
                <MessageSquare className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                  Contact Submissions
                </h1>
                <p className="text-emerald-100/80 text-sm md:text-base mt-1">
                  Manage and respond to user inquiries
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 text-sm text-white hover:bg-white/20 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={() => { fetchContacts(); fetchStats(); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-emerald-700 hover:bg-white/90 shadow-lg shadow-black/10 font-semibold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mt-8">
          {[
            { label: "Total", value: stats?.total ?? 0, icon: MessageSquare },
            { label: "New", value: stats?.new ?? 0, icon: Inbox },
            { label: "Read", value: stats?.read ?? 0, icon: Eye },
            { label: "In Progress", value: stats?.in_progress ?? 0, icon: Clock },
            { label: "Resolved", value: stats?.resolved ?? 0, icon: CheckCircle2 },
            { label: "Archived", value: stats?.archived ?? 0, icon: Archive },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="flex items-center gap-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 px-4 py-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20">
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

      {/* ============================================ */}
      {/* SEARCH & FILTERS BAR */}
      {/* ============================================ */}
      <div className="px-6 py-4 border-b border-white/5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts... (Ctrl+K)"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm transition-all ${
              showFilters || activeFilterCount > 0
                ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-cyan-500 text-white text-xs flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* View toggle */}
          <div className="flex items-center rounded-xl border border-white/10 overflow-hidden">
            <button
              onClick={() => setViewMode("table")}
              className={`p-2.5 transition-colors ${
                viewMode === "table" ? "bg-cyan-500/20 text-cyan-400" : "text-slate-500 hover:text-white"
              }`}
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2.5 transition-colors ${
                viewMode === "grid" ? "bg-cyan-500/20 text-cyan-400" : "text-slate-500 hover:text-white"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Advanced Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-white/5">
                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer"
                >
                  <option value="" className="bg-slate-900">All Statuses</option>
                  <option value="new" className="bg-slate-900">New</option>
                  <option value="read" className="bg-slate-900">Read</option>
                  <option value="in_progress" className="bg-slate-900">In Progress</option>
                  <option value="resolved" className="bg-slate-900">Resolved</option>
                  <option value="archived" className="bg-slate-900">Archived</option>
                </select>

                {/* Priority Filter */}
                <select
                  value={priorityFilter}
                  onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
                  className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer"
                >
                  <option value="" className="bg-slate-900">All Priorities</option>
                  <option value="low" className="bg-slate-900">Low</option>
                  <option value="normal" className="bg-slate-900">Normal</option>
                  <option value="high" className="bg-slate-900">High</option>
                  <option value="urgent" className="bg-slate-900">Urgent</option>
                </select>

                {/* Reset */}
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => { setStatusFilter(""); setPriorityFilter(""); setPage(1); }}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Reset filters
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ============================================ */}
      {/* BULK ACTIONS */}
      {/* ============================================ */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-white/5"
          >
            <div className="px-6 py-3 bg-cyan-500/5 flex items-center gap-3 flex-wrap">
              <span className="text-sm text-cyan-400 font-medium">
                {selectedIds.size} selected
              </span>
              <div className="h-4 w-px bg-white/10" />
              <button
                onClick={() => handleBulkUpdateStatus("read")}
                disabled={isBulkUpdating}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-500/10 text-slate-300 hover:bg-slate-500/20 transition-colors disabled:opacity-50"
              >
                Mark Read
              </button>
              <button
                onClick={() => handleBulkUpdateStatus("in_progress")}
                disabled={isBulkUpdating}
                className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
              >
                In Progress
              </button>
              <button
                onClick={() => handleBulkUpdateStatus("resolved")}
                disabled={isBulkUpdating}
                className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
              >
                Resolve
              </button>
              <button
                onClick={() => handleBulkUpdateStatus("archived")}
                disabled={isBulkUpdating}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-600/10 text-slate-400 hover:bg-slate-600/20 transition-colors disabled:opacity-50"
              >
                Archive
              </button>
              <button
                onClick={() => setDeleteModal({ open: true, bulk: true })}
                disabled={isBulkUpdating}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3 h-3 inline mr-1" />
                Delete
              </button>
              <div className="h-4 w-px bg-white/10" />
              <button
                onClick={() => { setSelectedIds(new Set()); setSelectAll(false); }}
                className="text-xs text-slate-500 hover:text-white transition-colors"
              >
                Clear selection
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================ */}
      {/* CONTENT AREA */}
      {/* ============================================ */}
      <div className="flex">
        {/* Main List */}
        <div className={`flex-1 ${showDetailPanel ? "lg:mr-[420px]" : ""} transition-all duration-300`}>
          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <p className="text-slate-400">{error}</p>
              <button
                onClick={fetchContacts}
                className="px-4 py-2 rounded-lg bg-white/5 text-sm text-white hover:bg-white/10 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-500/10 flex items-center justify-center">
                <Inbox className="w-8 h-8 text-slate-500" />
              </div>
              <p className="text-slate-400">
                {debouncedSearch || statusFilter || priorityFilter
                  ? "No contacts match your filters"
                  : "No contact submissions yet"}
              </p>
            </div>
          ) : viewMode === "table" ? (
            /* TABLE VIEW */
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-6 py-3">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        className="rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/20"
                      />
                    </th>
                    <th className="text-left px-4 py-3">
                      <button onClick={() => handleSort("name")} className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-white transition-colors">
                        Contact
                        {sortBy === "name" && (sortOrder === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Subject</span>
                    </th>
                    <th className="text-left px-4 py-3">
                      <button onClick={() => handleSort("status")} className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-white transition-colors">
                        Status
                        {sortBy === "status" && (sortOrder === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">
                      <button onClick={() => handleSort("priority")} className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-white transition-colors">
                        Priority
                        {sortBy === "priority" && (sortOrder === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 hidden xl:table-cell">
                      <button onClick={() => handleSort("created_at")} className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:text-white transition-colors">
                        Date
                        {sortBy === "created_at" && (sortOrder === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                      </button>
                    </th>
                    <th className="text-right px-6 py-3">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence mode="popLayout">
                    {contacts.map((contact) => {
                      const statusConf = STATUS_CONFIG[contact.status] || STATUS_CONFIG.new;
                      const priorityConf = PRIORITY_CONFIG[contact.priority] || PRIORITY_CONFIG.normal;
                      const isSelected = selectedIds.has(contact.id);

                      return (
                        <motion.tr
                          key={contact.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          onClick={() => handleViewContact(contact)}
                          className={`border-b border-white/5 cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-cyan-500/5"
                              : selectedContact?.id === contact.id
                                ? "bg-white/5"
                                : "hover:bg-white/[0.02]"
                          } ${contact.status === "new" ? "font-medium" : ""}`}
                        >
                          <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleSelectOne(contact.id)}
                              className="rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/20"
                            />
                          </td>
                          <td className="px-4 py-4">
                            <div>
                              <p className="text-sm text-white">{contact.name}</p>
                              <p className="text-xs text-slate-500">{contact.email}</p>
                            </div>
                          </td>
                          <td className="px-4 py-4 hidden md:table-cell">
                            <p className="text-sm text-slate-300 max-w-[200px] truncate">{contact.subject}</p>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${statusConf.bgColor} ${statusConf.color}`}>
                              <statusConf.icon className="w-3 h-3" />
                              {statusConf.label}
                            </span>
                          </td>
                          <td className="px-4 py-4 hidden lg:table-cell">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs ${priorityConf.bgColor} ${priorityConf.color}`}>
                              <Flag className="w-3 h-3" />
                              {priorityConf.label}
                            </span>
                          </td>
                          <td className="px-4 py-4 hidden xl:table-cell">
                            <p className="text-xs text-slate-500">
                              {new Date(contact.created_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </p>
                          </td>
                          <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleViewContact(contact)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
                                title="View details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeleteModal({ open: true, id: contact.id })}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          ) : (
            /* GRID VIEW */
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 p-6">
              <AnimatePresence mode="popLayout">
                {contacts.map((contact) => {
                  const statusConf = STATUS_CONFIG[contact.status] || STATUS_CONFIG.new;
                  const priorityConf = PRIORITY_CONFIG[contact.priority] || PRIORITY_CONFIG.normal;
                  const isSelected = selectedIds.has(contact.id);

                  return (
                    <motion.div
                      key={contact.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      onClick={() => handleViewContact(contact)}
                      className={`relative p-5 rounded-2xl border cursor-pointer transition-all hover:border-white/20 ${
                        isSelected
                          ? "bg-cyan-500/5 border-cyan-500/30"
                          : selectedContact?.id === contact.id
                            ? "bg-white/5 border-white/20"
                            : "bg-white/[0.02] border-white/10"
                      }`}
                    >
                      {/* Checkbox */}
                      <div className="absolute top-4 right-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectOne(contact.id)}
                          className="rounded border-white/20 bg-white/5 text-cyan-500 focus:ring-cyan-500/20"
                        />
                      </div>

                      {/* Status + Priority badges */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${statusConf.bgColor} ${statusConf.color}`}>
                          <statusConf.icon className="w-3 h-3" />
                          {statusConf.label}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs ${priorityConf.bgColor} ${priorityConf.color}`}>
                          {priorityConf.label}
                        </span>
                      </div>

                      {/* Name + Email */}
                      <div className="mb-2">
                        <p className={`text-sm text-white ${contact.status === "new" ? "font-semibold" : ""}`}>
                          {contact.name}
                        </p>
                        <p className="text-xs text-slate-500">{contact.email}</p>
                      </div>

                      {/* Subject */}
                      <p className="text-sm text-slate-300 font-medium mb-2">{contact.subject}</p>

                      {/* Message preview */}
                      <p className="text-xs text-slate-500 line-clamp-2 mb-3">
                        {contact.message}
                      </p>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-3 border-t border-white/5">
                        <p className="text-xs text-slate-600">
                          {new Date(contact.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleViewContact(contact)}
                            className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteModal({ open: true, id: contact.id })}
                            className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}

          {/* ============================================ */}
          {/* PAGINATION */}
          {/* ============================================ */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-slate-500">
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} submissions
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                        page === pageNum
                          ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/20"
                          : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Per page selector */}
                <select
                  value={limit}
                  onChange={(e) => { setLimit(parseInt(e.target.value)); setPage(1); }}
                  className="ml-2 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white focus:outline-none appearance-none cursor-pointer"
                >
                  <option value="10" className="bg-slate-900">10/page</option>
                  <option value="20" className="bg-slate-900">20/page</option>
                  <option value="50" className="bg-slate-900">50/page</option>
                  <option value="100" className="bg-slate-900">100/page</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* ============================================ */}
        {/* DETAIL PANEL (Slide-in) */}
        {/* ============================================ */}
        <AnimatePresence>
          {showDetailPanel && selectedContact && (
            <motion.div
              initial={{ x: 420, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 420, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed right-0 top-0 bottom-0 w-[420px] bg-slate-900/95 backdrop-blur-xl border-l border-white/10 z-40 overflow-y-auto"
            >
              {/* Header */}
              <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-xl border-b border-white/10 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white">Contact Details</h3>
                  <button
                    onClick={() => { setShowDetailPanel(false); setSelectedContact(null); }}
                    className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Contact Info */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-sky-600 flex items-center justify-center text-white font-bold text-lg">
                      {selectedContact.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white font-semibold">{selectedContact.name}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(selectedContact.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 mt-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-slate-500" />
                      <a href={`mailto:${selectedContact.email}`} className="text-cyan-400 hover:underline">
                        {selectedContact.email}
                      </a>
                    </div>
                    {selectedContact.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-slate-500" />
                        <span className="text-slate-300">{selectedContact.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status & Priority Controls */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1.5">Status</label>
                    <select
                      value={selectedContact.status}
                      onChange={(e) => handleUpdateStatus(selectedContact.id, e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer"
                    >
                      <option value="new" className="bg-slate-900">New</option>
                      <option value="read" className="bg-slate-900">Read</option>
                      <option value="in_progress" className="bg-slate-900">In Progress</option>
                      <option value="resolved" className="bg-slate-900">Resolved</option>
                      <option value="archived" className="bg-slate-900">Archived</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1.5">Priority</label>
                    <select
                      value={selectedContact.priority}
                      onChange={(e) => handleUpdatePriority(selectedContact.id, e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer"
                    >
                      <option value="low" className="bg-slate-900">Low</option>
                      <option value="normal" className="bg-slate-900">Normal</option>
                      <option value="high" className="bg-slate-900">High</option>
                      <option value="urgent" className="bg-slate-900">Urgent</option>
                    </select>
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1.5">Subject</label>
                  <p className="text-sm text-white bg-white/5 px-3 py-2 rounded-lg border border-white/10">
                    {selectedContact.subject}
                  </p>
                </div>

                {/* Message */}
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1.5">Message</label>
                  <div className="text-sm text-slate-300 bg-white/5 px-4 py-3 rounded-lg border border-white/10 whitespace-pre-wrap max-h-60 overflow-y-auto">
                    {selectedContact.message}
                  </div>
                </div>

                {/* Admin Notes */}
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1.5">Admin Notes</label>
                  <textarea
                    defaultValue={selectedContact.admin_notes || ""}
                    placeholder="Add internal notes..."
                    onBlur={async (e) => {
                      const notes = e.target.value;
                      if (notes !== (selectedContact.admin_notes || "")) {
                        try {
                          await api.patch(`/admin/contacts/${selectedContact.id}`, { admin_notes: notes || null });
                          setSelectedContact((prev) => prev ? { ...prev, admin_notes: notes || null } : null);
                        } catch {
                          // Handle error silently
                        }
                      }
                    }}
                    rows={3}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 resize-none"
                  />
                </div>

                {/* Meta info */}
                <div className="text-xs text-slate-600 space-y-1 pt-3 border-t border-white/5">
                  {selectedContact.ip_address && (
                    <p>IP: {selectedContact.ip_address}</p>
                  )}
                  {selectedContact.resolved_at && (
                    <p>
                      Resolved: {new Date(selectedContact.resolved_at).toLocaleString()}
                      {selectedContact.resolved_first_name && (
                        <span> by {selectedContact.resolved_first_name} {selectedContact.resolved_last_name}</span>
                      )}
                    </p>
                  )}
                  {selectedContact.assigned_first_name && (
                    <p>Assigned to: {selectedContact.assigned_first_name} {selectedContact.assigned_last_name}</p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setReplyModal({ open: true, contact: selectedContact });
                      setReplyMessage("");
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-sky-500 text-white text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    <Send className="w-4 h-4" />
                    Reply via Email
                  </button>
                  <button
                    onClick={() => setDeleteModal({ open: true, id: selectedContact.id })}
                    className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ============================================ */}
      {/* REPLY EMAIL MODAL */}
      {/* ============================================ */}
      <AnimatePresence>
        {replyModal.open && replyModal.contact && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setReplyModal({ open: false, contact: null })}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 rounded-2xl border border-slate-800 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-800">
                <div>
                  <h2 className="text-xl font-semibold text-white">Send Reply Email</h2>
                  <p className="text-sm text-slate-400 mt-1">
                    To: {replyModal.contact.name} ({replyModal.contact.email})
                  </p>
                  <p className="text-sm text-slate-400">
                    Re: {replyModal.contact.subject}
                  </p>
                </div>
                <button
                  onClick={() => setReplyModal({ open: false, contact: null })}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Your Message
                  </label>
                  <textarea
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Type your reply message here..."
                    className="w-full h-64 px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    {replyMessage.length}/5000 characters
                  </p>
                </div>

                {/* Original Message Preview */}
                <div className="mt-4 p-4 bg-slate-800/30 rounded-xl border border-slate-700">
                  <p className="text-xs font-medium text-slate-400 mb-2">Original Message:</p>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{replyModal.contact.message}</p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-800">
                <button
                  onClick={() => setReplyModal({ open: false, contact: null })}
                  className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
                  disabled={isSendingReply}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendReply}
                  disabled={!replyMessage.trim() || isSendingReply}
                  className="px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-sky-500 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSendingReply ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Email
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================ */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ============================================ */}
      <ConfirmationModal
        open={deleteModal.open}
        onOpenChange={(open) => setDeleteModal({ ...deleteModal, open })}
        title={deleteModal.bulk ? `Delete ${selectedIds.size} submission(s)?` : "Delete submission?"}
        description={
          deleteModal.bulk
            ? `This will permanently delete ${selectedIds.size} contact submission(s). This action cannot be undone.`
            : "This will permanently delete this contact submission. This action cannot be undone."
        }
        confirmLabel="Delete"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
