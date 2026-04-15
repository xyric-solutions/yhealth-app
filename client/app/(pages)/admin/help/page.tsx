"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  HelpCircle,
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  FileText,
  ThumbsUp,
  BarChart3,
  Loader2,
  ChevronLeft,
  ChevronRight,
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
import { AIHelpGenerator, type GeneratedHelpData } from "@/components/help/AIHelpGenerator";
import { RichTextEditor } from "@/components/editor/RichTextEditor";

interface HelpArticle {
  id: string;
  title: string;
  slug: string;
  category: string;
  status: string;
  views: number;
  helpful_yes: number;
  helpful_no: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  content?: string;
  excerpt?: string;
  meta_title?: string;
  meta_description?: string;
}

interface HelpStats {
  total: number;
  published: number;
  draft: number;
  totalViews: number;
  categories: number;
}

export default function AdminHelpPage() {
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [stats, setStats] = useState<HelpStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Detail sidebar
  const [detailArticle, setDetailArticle] = useState<HelpArticle | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string | null>(null);

  // --- Create / Edit modal state ---
  const [showForm, setShowForm] = useState(false);
  const [editingArticle, setEditingArticle] = useState<HelpArticle | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    excerpt: "",
    category: "general",
    status: "draft" as string,
    sort_order: 0,
    meta_title: "",
    meta_description: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchArticles = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const response = await api.get<HelpArticle[]>(`/admin/help?${params.toString()}`);
      setArticles(response.data || []);
      setTotal(response.meta?.total || 0);
      setTotalPages(response.meta?.totalPages || 1);
    } catch {
      setArticles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get<HelpStats>("/admin/help/stats");
      setStats(response.data || null);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    fetchArticles();
    fetchStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, statusFilter]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this article?")) return;
    try {
      await api.delete(`/admin/help/${id}`);
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      if (detailArticle?.id === id) setSidebarOpen(false);
      fetchArticles();
      fetchStats();
    } catch {
      /* ignore */
    }
  };

  const openDetailView = async (article: HelpArticle, e?: React.MouseEvent) => {
    if ((e?.target as HTMLElement)?.closest?.('button, [role="checkbox"], a')) return;
    setDetailLoading(true);
    setSidebarOpen(true);
    try {
      const response = await api.get<Partial<HelpArticle>>(`/admin/help/${article.id}`);
      setDetailArticle({ ...article, ...(response.data as Partial<HelpArticle>) });
    } catch {
      setDetailArticle(article);
    } finally {
      setDetailLoading(false);
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
    if (selectedIds.size === articles.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(articles.map((a) => a.id)));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || !confirm(`Delete ${selectedIds.size} article(s)?`)) return;
    try {
      await api.post("/admin/help/bulk-delete", { ids: Array.from(selectedIds) });
      setSelectedIds(new Set());
      setSidebarOpen(false);
      fetchArticles();
      fetchStats();
    } catch {
      /* ignore */
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (selectedIds.size === 0 || !bulkStatus) return;
    try {
      for (const id of selectedIds) {
        await api.patch(`/admin/help/${id}`, { status: bulkStatus });
      }
      setSelectedIds(new Set());
      setBulkStatus(null);
      fetchArticles();
      fetchStats();
    } catch {
      /* ignore */
    }
  };

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      setFormError("Title and content are required");
      return;
    }
    setIsSaving(true);
    setFormError("");
    try {
      if (editingArticle) {
        await api.put(`/admin/help/${editingArticle.id}`, formData);
      } else {
        await api.post("/admin/help", formData);
      }
      setShowForm(false);
      setEditingArticle(null);
      setFormData({ title: "", content: "", excerpt: "", category: "general", status: "draft", sort_order: 0, meta_title: "", meta_description: "" });
      fetchArticles();
      fetchStats();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const openEdit = async (article: HelpArticle) => {
    setSidebarOpen(false);
    try {
      const response = await api.get<Partial<HelpArticle>>(`/admin/help/${article.id}`);
      const full = response.data;
      setEditingArticle(article);
      setFormData({
        title: full?.title || "",
        content: full?.content || "",
        excerpt: full?.excerpt || "",
        category: full?.category || "general",
        status: full?.status || "draft",
        sort_order: full?.sort_order || 0,
        meta_title: full?.meta_title || "",
        meta_description: full?.meta_description || "",
      });
      setShowForm(true);
    } catch {
      /* ignore */
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published": return "bg-emerald-400/10 text-emerald-400";
      case "draft": return "bg-amber-400/10 text-amber-400";
      case "archived": return "bg-slate-400/10 text-slate-400";
      default: return "bg-white/10 text-muted-foreground";
    }
  };

  return (
    <div className="max-w-8xl mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Page Header with Gradient */}
      <AdminPageHeader
        title="Help Center Management"
        subtitle="Create and manage help articles for users"
        icon={HelpCircle}
        stats={stats ? [
          { label: "Total", value: stats.total, icon: FileText },
          { label: "Published", value: stats.published, icon: Eye },
          { label: "Drafts", value: stats.draft, icon: Pencil },
          { label: "Total Views", value: stats.totalViews, icon: BarChart3 },
          { label: "Categories", value: stats.categories, icon: HelpCircle },
        ] : []}
        actions={
          <div className="flex items-center gap-2">
            <AIHelpGenerator
              onGenerate={(data: GeneratedHelpData) => {
                setEditingArticle(null);
                setFormData({
                  title: data.title,
                  content: data.content,
                  excerpt: data.excerpt || "",
                  category: data.category || "general",
                  status: "draft",
                  sort_order: 0,
                  meta_title: data.meta_title || "",
                  meta_description: data.meta_description || "",
                });
                setShowForm(true);
              }}
            />
            <Button
              onClick={() => {
                setEditingArticle(null);
                setFormData({ title: "", content: "", excerpt: "", category: "general", status: "draft", sort_order: 0, meta_title: "", meta_description: "" });
                setShowForm(true);
              }}
              className="bg-white text-blue-700 hover:bg-white/90 shadow-lg shadow-black/10 font-semibold"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Article
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
            placeholder="Search articles..."
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
            <SelectItem value="published" className="text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer">Published</SelectItem>
            <SelectItem value="draft" className="text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer">Draft</SelectItem>
            <SelectItem value="archived" className="text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Create/Edit Form Modal */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 rounded-2xl border border-primary/20"
        >
          <h3 className="text-lg font-semibold mb-4">
            {editingArticle ? "Edit Article" : "Create New Article"}
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
                  placeholder="Article title"
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
                      <SelectItem value="archived" className="text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Excerpt</label>
              <input
                type="text"
                value={formData.excerpt}
                onChange={(e) => setFormData((p) => ({ ...p, excerpt: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-foreground text-sm focus:outline-none focus:border-primary/50"
                placeholder="Short summary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Content *</label>
              <RichTextEditor
                value={formData.content}
                onChange={(content) => setFormData((p) => ({ ...p, content }))}
                placeholder="Start writing your help article..."
                minHeight="300px"
              />
            </div>
            {formError && (
              <p className="text-sm text-red-400">{formError}</p>
            )}
            <div className="flex items-center gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => { setShowForm(false); setEditingArticle(null); }}
                className="border-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-gradient-to-r from-emerald-500 to-sky-500"
              >
                {isSaving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                ) : (
                  editingArticle ? "Update Article" : "Create Article"
                )}
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

      {/* Articles Table */}
      <Card className="bg-white/5 border-white/10 rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center py-16">
              <HelpCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No help articles found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02]">
                    <th className="w-12 px-4 py-3">
                      <Checkbox
                        checked={selectedIds.size === articles.length && articles.length > 0}
                        onCheckedChange={selectAll}
                        className="border-white/30"
                      />
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Title</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Views</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Helpful</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {articles.map((article, i) => (
                    <motion.tr
                      key={article.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      onClick={(e) => openDetailView(article, e)}
                      className={`border-b border-white/5 hover:bg-white/5 transition-all duration-200 cursor-pointer group ${selectedIds.has(article.id) ? "bg-primary/5" : ""}`}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(article.id)}
                          onCheckedChange={() => toggleSelect(article.id)}
                          className="border-white/30"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-foreground line-clamp-1 group-hover:text-primary/90 transition-colors">{article.title}</p>
                        <p className="text-xs text-muted-foreground">{article.slug}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground capitalize">
                          {article.category.replace(/-/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${getStatusColor(article.status)}`}>
                          {article.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{article.views}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="text-emerald-400">{article.helpful_yes}</span>
                          <span>/</span>
                          <span className="text-red-400">{article.helpful_no}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(article)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-primary transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(article.id)}
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
              <p className="text-xs text-muted-foreground">
                Showing {articles.length} of {total} articles
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
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
        title={detailArticle?.title || "Article Details"}
        onEdit={detailArticle ? () => openEdit(detailArticle) : undefined}
        onDelete={detailArticle ? () => handleDelete(detailArticle.id) : undefined}
      >
        {detailLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : detailArticle ? (
          <div className="space-y-6">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Category</label>
              <p className="text-sm text-foreground mt-1 capitalize">{detailArticle.category.replace(/-/g, " ")}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</label>
              <span className={`inline-block mt-1 text-xs font-medium px-2.5 py-1 rounded-full capitalize ${getStatusColor(detailArticle.status)}`}>
                {detailArticle.status}
              </span>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Slug</label>
              <p className="text-xs text-muted-foreground mt-1 font-mono">{detailArticle.slug}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Engagement</label>
              <div className="flex gap-4 mt-1 text-sm">
                <span className="flex items-center gap-1 text-muted-foreground"><Eye className="w-3 h-3" /> {detailArticle.views} views</span>
                <span className="flex items-center gap-1 text-emerald-400"><ThumbsUp className="w-3 h-3" /> {detailArticle.helpful_yes} yes</span>
                <span className="flex items-center gap-1 text-red-400">{detailArticle.helpful_no} no</span>
              </div>
            </div>
            {detailArticle.excerpt && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Excerpt</label>
                <p className="text-sm text-foreground mt-1">{detailArticle.excerpt}</p>
              </div>
            )}
            {detailArticle.content && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Content</label>
                <p className="text-sm text-foreground mt-1 line-clamp-6">{detailArticle.content.replace(/<[^>]*>/g, " ").trim().slice(0, 400)}{detailArticle.content.length > 400 ? "…" : ""}</p>
              </div>
            )}
          </div>
        ) : null}
      </AdminDetailSidebar>
    </div>
  );
}
