"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video,
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  Users,
  Calendar,
  Loader2,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Star,
  X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminDetailSidebar } from "@/components/admin/AdminDetailSidebar";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { api, ApiError } from "@/lib/api-client";
import { AIWebinarGenerator, type GeneratedWebinarData } from "@/components/webinar/AIWebinarGenerator";
import { RichTextEditor } from "@/components/editor/RichTextEditor";

interface Webinar {
  id: string;
  title: string;
  slug: string;
  host_name: string | null;
  host_title: string | null;
  category: string;
  status: string;
  scheduled_at: string | null;
  duration_minutes: number | null;
  registration_count: number;
  views: number;
  is_featured: boolean;
  created_at: string;
  description?: string;
  content?: string;
}

interface WebinarStats {
  total: number;
  published: number;
  upcoming: number;
  completed: number;
  totalRegistrations: number;
}

export default function AdminWebinarsPage() {
  const [webinars, setWebinars] = useState<Webinar[]>([]);
  const [stats, setStats] = useState<WebinarStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Detail sidebar
  const [detailWebinar, setDetailWebinar] = useState<Webinar | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingWebinar, setEditingWebinar] = useState<Webinar | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    content: "",
    host_name: "",
    host_title: "",
    category: "general",
    status: "draft" as string,
    duration_minutes: "",
    scheduled_at: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchWebinars = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const response = await api.get<Webinar[]>(`/admin/webinars?${params.toString()}`);
      setWebinars(response.data || []);
      setTotal(response.meta?.total || 0);
      setTotalPages(response.meta?.totalPages || 1);
    } catch {
      setWebinars([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get<WebinarStats>("/admin/webinars/stats");
      setStats(response.data || null);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    fetchWebinars();
    fetchStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, statusFilter]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this webinar?")) return;
    try {
      await api.delete(`/admin/webinars/${id}`);
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      if (detailWebinar?.id === id) setSidebarOpen(false);
      fetchWebinars();
      fetchStats();
    } catch {
      /* ignore */
    }
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      setFormError("Title and description are required");
      return;
    }
    setIsSaving(true);
    setFormError("");
    try {
      const payload: Record<string, unknown> = {
        ...formData,
        duration_minutes: formData.duration_minutes ? parseInt(formData.duration_minutes) : null,
        scheduled_at: formData.scheduled_at || null,
      };
      if (editingWebinar) {
        await api.put(`/admin/webinars/${editingWebinar.id}`, payload);
      } else {
        await api.post("/admin/webinars", payload);
      }
      setShowForm(false);
      setEditingWebinar(null);
      setFormData({ title: "", description: "", content: "", host_name: "", host_title: "", category: "general", status: "draft", duration_minutes: "", scheduled_at: "" });
      fetchWebinars();
      fetchStats();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const openDetailView = async (webinar: Webinar, e?: React.MouseEvent) => {
    if ((e?.target as HTMLElement)?.closest?.('button, [role="checkbox"], a')) return;
    setDetailLoading(true);
    setSidebarOpen(true);
    try {
      const response = await api.get<Partial<Webinar>>(`/admin/webinars/${webinar.id}`);
      setDetailWebinar({ ...webinar, ...(response.data as Partial<Webinar>) });
    } catch {
      setDetailWebinar(webinar);
    } finally {
      setDetailLoading(false);
    }
  };

  const openEdit = async (webinar: Webinar) => {
    setSidebarOpen(false);
    try {
      const response = await api.get<Partial<Webinar>>(`/admin/webinars/${webinar.id}`);
      const full = response.data;
      setEditingWebinar(webinar);
      setFormData({
        title: full?.title || "",
        description: full?.description || "",
        content: full?.content || "",
        host_name: full?.host_name || "",
        host_title: full?.host_title || "",
        category: full?.category || "general",
        status: full?.status || "draft",
        duration_minutes: full?.duration_minutes ? String(full.duration_minutes) : "",
        scheduled_at: full?.scheduled_at ? new Date(full.scheduled_at).toISOString().slice(0, 16) : "",
      });
      setShowForm(true);
    } catch {
      /* ignore */
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === webinars.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(webinars.map((w) => w.id)));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || !confirm(`Delete ${selectedIds.size} webinar(s)?`)) return;
    try {
      await api.post("/admin/webinars/bulk-delete", { ids: Array.from(selectedIds) });
      setSelectedIds(new Set());
      setSidebarOpen(false);
      fetchWebinars();
      fetchStats();
    } catch {
      /* ignore */
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (selectedIds.size === 0 || !bulkStatus) return;
    try {
      for (const id of selectedIds) {
        await api.patch(`/admin/webinars/${id}`, { status: bulkStatus });
      }
      setSelectedIds(new Set());
      setBulkStatus(null);
      fetchWebinars();
      fetchStats();
    } catch {
      /* ignore */
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published": return "bg-cyan-400/10 text-cyan-400";
      case "completed": return "bg-emerald-400/10 text-emerald-400";
      case "draft": return "bg-amber-400/10 text-amber-400";
      case "cancelled": return "bg-red-400/10 text-red-400";
      case "archived": return "bg-slate-400/10 text-slate-400";
      default: return "bg-white/10 text-muted-foreground";
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "TBA";
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="max-w-8xl mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Page Header with Gradient */}
      <AdminPageHeader
        title="Webinar Management"
        subtitle="Create and manage webinars and events"
        icon={Video}
        stats={stats ? [
          { label: "Total", value: stats.total, icon: Video },
          { label: "Published", value: stats.published, icon: Eye },
          { label: "Upcoming", value: stats.upcoming, icon: Calendar },
          { label: "Completed", value: stats.completed, icon: BarChart3 },
          { label: "Registrations", value: stats.totalRegistrations, icon: Users },
        ] : []}
        actions={
          <div className="flex items-center gap-2">
            <AIWebinarGenerator
              onGenerate={(data: GeneratedWebinarData) => {
                setEditingWebinar(null);
                setFormData({
                  title: data.title,
                  description: data.description || "",
                  content: data.content || "",
                  host_name: data.host_name || "",
                  host_title: data.host_title || "",
                  category: data.category || "general",
                  status: "draft",
                  duration_minutes: data.duration_minutes ? String(data.duration_minutes) : "60",
                  scheduled_at: "",
                });
                setShowForm(true);
              }}
            />
            <Button
              onClick={() => {
                setEditingWebinar(null);
                setFormData({ title: "", description: "", content: "", host_name: "", host_title: "", category: "general", status: "draft", duration_minutes: "", scheduled_at: "" });
                setShowForm(true);
              }}
              className="bg-white text-blue-700 hover:bg-white/90 shadow-lg shadow-black/10 font-semibold"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Webinar
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search webinars..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
          />
        </div>
        <Select value={statusFilter || "all"} onValueChange={(v) => { setStatusFilter(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-[140px] px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-foreground text-sm focus:outline-none focus:border-primary/50">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-slate-700 text-slate-100 rounded-xl shadow-xl z-50">
            <SelectItem value="all" className="text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer">All Status</SelectItem>
            <SelectItem value="draft" className="text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer">Draft</SelectItem>
            <SelectItem value="published" className="text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer">Published</SelectItem>
            <SelectItem value="completed" className="text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer">Completed</SelectItem>
            <SelectItem value="cancelled" className="text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer">Cancelled</SelectItem>
            <SelectItem value="archived" className="text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 rounded-2xl border border-primary/20"
        >
          <h3 className="text-lg font-semibold mb-4">
            {editingWebinar ? "Edit Webinar" : "Create New Webinar"}
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-foreground text-sm focus:outline-none focus:border-primary/50"
                  placeholder="Webinar title"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-foreground text-sm focus:outline-none focus:border-primary/50"
                    placeholder="general"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <Select value={formData.status} onValueChange={(v) => setFormData((p) => ({ ...p, status: v }))}>
                    <SelectTrigger className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-foreground text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700 text-slate-100 rounded-xl shadow-xl z-50">
                      <SelectItem value="draft" className="text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer">Draft</SelectItem>
                      <SelectItem value="published" className="text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer">Published</SelectItem>
                      <SelectItem value="completed" className="text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer">Completed</SelectItem>
                      <SelectItem value="cancelled" className="text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer">Cancelled</SelectItem>
                      <SelectItem value="archived" className="text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Host Name</label>
                <input
                  type="text"
                  value={formData.host_name}
                  onChange={(e) => setFormData((p) => ({ ...p, host_name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-foreground text-sm focus:outline-none focus:border-primary/50"
                  placeholder="Dr. Jane Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Host Title</label>
                <input
                  type="text"
                  value={formData.host_title}
                  onChange={(e) => setFormData((p) => ({ ...p, host_title: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-foreground text-sm focus:outline-none focus:border-primary/50"
                  placeholder="Certified Nutritionist"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Scheduled At</label>
                <input
                  type="datetime-local"
                  value={formData.scheduled_at}
                  onChange={(e) => setFormData((p) => ({ ...p, scheduled_at: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-foreground text-sm focus:outline-none focus:border-primary/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData((p) => ({ ...p, duration_minutes: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-foreground text-sm focus:outline-none focus:border-primary/50"
                  placeholder="60"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description *</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-foreground text-sm focus:outline-none focus:border-primary/50 resize-none"
                placeholder="Brief webinar description"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Content</label>
              <RichTextEditor
                value={formData.content}
                onChange={(content) => setFormData((p) => ({ ...p, content }))}
                placeholder="Start writing your webinar content..."
                minHeight="300px"
              />
            </div>
            {formError && <p className="text-sm text-red-400">{formError}</p>}
            <div className="flex items-center gap-3 justify-end">
              <Button variant="outline" onClick={() => { setShowForm(false); setEditingWebinar(null); }} className="border-white/10">
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="bg-gradient-to-r from-emerald-500 to-sky-500">
                {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : editingWebinar ? "Update Webinar" : "Create Webinar"}
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-4 p-4 rounded-xl bg-primary/10 border border-primary/20"
          >
            <span className="text-sm text-foreground">{selectedIds.size} selected</span>
            <div className="flex items-center gap-2">
              <Select value={bulkStatus || ""} onValueChange={setBulkStatus}>
                <SelectTrigger className="w-[130px] h-9 bg-white/5 border-white/10">
                  <SelectValue placeholder="Update status" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="draft" className="text-slate-200">Draft</SelectItem>
                  <SelectItem value="published" className="text-slate-200">Published</SelectItem>
                  <SelectItem value="completed" className="text-slate-200">Completed</SelectItem>
                  <SelectItem value="cancelled" className="text-slate-200">Cancelled</SelectItem>
                  <SelectItem value="archived" className="text-slate-200">Archived</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={handleBulkStatusUpdate} disabled={!bulkStatus} className="border-white/10">
                Update
              </Button>
            </div>
            <Button size="sm" variant="outline" onClick={handleBulkDelete} className="border-red-500/30 text-red-400 hover:bg-red-500/10">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              <X className="w-4 h-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Webinars Table */}
      <Card className="bg-white/5 border-white/10 rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : webinars.length === 0 ? (
            <div className="text-center py-16">
              <Video className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No webinars found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02]">
                    <th className="w-12 px-4 py-3">
                      <Checkbox
                        checked={selectedIds.size === webinars.length && webinars.length > 0}
                        onCheckedChange={selectAll}
                        className="border-white/30"
                      />
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Webinar</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Host</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Registrations</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {webinars.map((webinar, i) => (
                    <motion.tr
                      key={webinar.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      onClick={(e) => openDetailView(webinar, e)}
                      className={`border-b border-white/5 hover:bg-white/5 transition-all duration-200 cursor-pointer group ${selectedIds.has(webinar.id) ? "bg-primary/5" : ""}`}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(webinar.id)}
                          onCheckedChange={() => toggleSelect(webinar.id)}
                          className="border-white/30"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {webinar.is_featured && <Star className="w-3 h-3 text-primary shrink-0" />}
                          <div>
                            <p className="text-sm font-medium text-foreground line-clamp-1 group-hover:text-primary/90 transition-colors">{webinar.title}</p>
                            <p className="text-xs text-muted-foreground capitalize">{webinar.category.replace(/-/g, " ")}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-foreground">{webinar.host_name || "—"}</p>
                        {webinar.host_title && (
                          <p className="text-xs text-muted-foreground">{webinar.host_title}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${getStatusColor(webinar.status)}`}>
                          {webinar.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDate(webinar.scheduled_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Users className="w-3 h-3" />
                          {webinar.registration_count}
                        </div>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(webinar)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-primary transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(webinar.id)}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
              <p className="text-xs text-muted-foreground">Showing {webinars.length} of {total} webinars</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-50">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-50">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Sidebar */}
      <AdminDetailSidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        title={detailWebinar?.title || "Webinar Details"}
        onEdit={detailWebinar ? () => openEdit(detailWebinar) : undefined}
        onDelete={detailWebinar ? () => handleDelete(detailWebinar.id) : undefined}
      >
        {detailLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : detailWebinar ? (
          <div className="space-y-6">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</label>
              <p className="text-sm text-foreground mt-1 capitalize">{detailWebinar.category.replace(/-/g, " ")}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</label>
              <span className={`inline-block mt-1 text-xs font-medium px-2.5 py-1 rounded-full capitalize ${getStatusColor(detailWebinar.status)}`}>
                {detailWebinar.status}
              </span>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Host</label>
              <p className="text-sm text-foreground mt-1">{detailWebinar.host_name || "—"}</p>
              {detailWebinar.host_title && <p className="text-xs text-muted-foreground">{detailWebinar.host_title}</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Scheduled</label>
              <p className="text-sm text-foreground mt-1">{formatDate(detailWebinar.scheduled_at)}</p>
              {detailWebinar.duration_minutes && <p className="text-xs text-muted-foreground">{detailWebinar.duration_minutes} min</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Engagement</label>
              <div className="flex gap-4 mt-1 text-sm">
                <span className="flex items-center gap-1 text-muted-foreground"><Users className="w-3 h-3" /> {detailWebinar.registration_count} registrations</span>
                <span className="flex items-center gap-1 text-muted-foreground"><Eye className="w-3 h-3" /> {detailWebinar.views} views</span>
              </div>
            </div>
            {detailWebinar.description && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</label>
                <p className="text-sm text-foreground mt-1 line-clamp-4">{detailWebinar.description}</p>
              </div>
            )}
          </div>
        ) : null}
      </AdminDetailSidebar>
    </div>
  );
}
