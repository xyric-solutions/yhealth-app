"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  MessageCircle,
  ThumbsUp,
  Pin,
  Star,
  Flag,
  Loader2,
  ChevronLeft,
  ChevronRight,
  BarChart3,
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
import { AICommunityGenerator, type GeneratedCommunityData } from "@/components/community/AICommunityGenerator";
import { RichTextEditor } from "@/components/editor/RichTextEditor";

interface CommunityPost {
  id: string;
  title: string;
  slug: string;
  category: string;
  post_type: string;
  status: string;
  views: number;
  likes: number;
  replies_count: number;
  is_pinned: boolean;
  is_featured: boolean;
  author_first_name: string | null;
  author_last_name: string | null;
  created_at: string;
  content?: string;
}

interface CommunityStats {
  total: number;
  published: number;
  flagged: number;
  totalReplies: number;
  totalViews: number;
}

export default function AdminCommunityPage() {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Detail sidebar
  const [detailPost, setDetailPost] = useState<CommunityPost | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingPost, setEditingPost] = useState<CommunityPost | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "general",
    post_type: "discussion" as string,
    status: "published" as string,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchPosts = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const response = await api.get<CommunityPost[]>(`/admin/community?${params.toString()}`);
      setPosts(response.data || []);
      setTotal(response.meta?.total || 0);
      setTotalPages(response.meta?.totalPages || 1);
    } catch {
      setPosts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get<CommunityStats>("/admin/community/stats");
      setStats(response.data || null);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    fetchPosts();
    fetchStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, statusFilter]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this community post?")) return;
    try {
      await api.delete(`/admin/community/${id}`);
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      if (detailPost?.id === id) setSidebarOpen(false);
      fetchPosts();
      fetchStats();
    } catch {
      /* ignore */
    }
  };

  const openDetailView = async (post: CommunityPost, e?: React.MouseEvent) => {
    if ((e?.target as HTMLElement)?.closest?.('button, [role="checkbox"], a')) return;
    setDetailLoading(true);
    setSidebarOpen(true);
    try {
      const response = await api.get<Partial<CommunityPost>>(`/admin/community/${post.id}`);
      setDetailPost({ ...post, ...(response.data as Partial<CommunityPost>) });
    } catch {
      setDetailPost(post);
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
    if (selectedIds.size === posts.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(posts.map((p) => p.id)));
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || !confirm(`Delete ${selectedIds.size} post(s)?`)) return;
    try {
      await api.post("/admin/community/bulk-delete", { ids: Array.from(selectedIds) });
      setSelectedIds(new Set());
      setSidebarOpen(false);
      fetchPosts();
      fetchStats();
    } catch {
      /* ignore */
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (selectedIds.size === 0 || !bulkStatus) return;
    try {
      for (const id of selectedIds) {
        await api.patch(`/admin/community/${id}`, { status: bulkStatus });
      }
      setSelectedIds(new Set());
      setBulkStatus(null);
      fetchPosts();
      fetchStats();
    } catch {
      /* ignore */
    }
  };

  const handleTogglePin = async (post: CommunityPost) => {
    try {
      await api.patch(`/admin/community/${post.id}`, { is_pinned: !post.is_pinned });
      fetchPosts();
    } catch {
      /* ignore */
    }
  };

  const handleToggleFeatured = async (post: CommunityPost) => {
    try {
      await api.patch(`/admin/community/${post.id}`, { is_featured: !post.is_featured });
      fetchPosts();
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
      if (editingPost) {
        await api.patch(`/admin/community/${editingPost.id}`, formData);
      } else {
        await api.post("/admin/community", formData);
      }
      setShowForm(false);
      setEditingPost(null);
      setFormData({ title: "", content: "", category: "general", post_type: "discussion", status: "published" });
      fetchPosts();
      fetchStats();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const openEdit = async (post: CommunityPost) => {
    setSidebarOpen(false);
    try {
      const response = await api.get<Partial<CommunityPost>>(`/admin/community/${post.id}`);
      const full = response.data;
      setEditingPost(post);
      setFormData({
        title: full?.title || "",
        content: full?.content || "",
        category: full?.category || "general",
        post_type: full?.post_type || "discussion",
        status: full?.status || "published",
      });
      setShowForm(true);
    } catch {
      /* ignore */
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      await api.patch(`/admin/community/${id}`, { status });
      fetchPosts();
      fetchStats();
    } catch {
      /* ignore */
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published": return "bg-emerald-400/10 text-emerald-400";
      case "draft": return "bg-amber-400/10 text-amber-400";
      case "flagged": return "bg-red-400/10 text-red-400";
      case "archived": return "bg-slate-400/10 text-slate-400";
      default: return "bg-white/10 text-muted-foreground";
    }
  };

  const getPostTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      discussion: "text-cyan-400",
      question: "text-amber-400",
      tip: "text-emerald-400",
      success_story: "text-purple-400",
      challenge: "text-pink-400",
      announcement: "text-orange-400",
    };
    return colors[type] || "text-muted-foreground";
  };

  return (
    <div className="max-w-8xl mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Page Header with Gradient */}
      <AdminPageHeader
        title="Community Management"
        subtitle="Manage community posts, discussions, and moderation"
        icon={Users}
        stats={stats ? [
          { label: "Total Posts", value: stats.total, icon: MessageCircle },
          { label: "Published", value: stats.published, icon: Eye },
          { label: "Flagged", value: stats.flagged, icon: Flag },
          { label: "Replies", value: stats.totalReplies, icon: MessageCircle },
          { label: "Views", value: stats.totalViews, icon: BarChart3 },
        ] : []}
        actions={
          <div className="flex items-center gap-2">
            <AICommunityGenerator
              onGenerate={(data: GeneratedCommunityData) => {
                setEditingPost(null);
                setFormData({
                  title: data.title,
                  content: data.content,
                  category: data.category || "general",
                  post_type: data.post_type || "discussion",
                  status: "published",
                });
                setShowForm(true);
              }}
            />
            <Button
              onClick={() => {
                setEditingPost(null);
                setFormData({ title: "", content: "", category: "general", post_type: "discussion", status: "published" });
                setShowForm(true);
              }}
              className="bg-white text-blue-700 hover:bg-white/90 shadow-lg shadow-black/10 font-semibold"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Post
            </Button>
          </div>
        }
      />

      {/* Create/Edit Form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 rounded-2xl border border-primary/20"
        >
          <h3 className="text-lg font-semibold mb-4">
            {editingPost ? "Edit Post" : "Create New Post"}
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
                  placeholder="Post title"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
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
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <Select value={formData.post_type} onValueChange={(v) => setFormData((p) => ({ ...p, post_type: v }))}>
                    <SelectTrigger className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-foreground text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700 text-slate-100 rounded-xl shadow-xl z-50">
                      <SelectItem value="discussion" className="text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer">Discussion</SelectItem>
                      <SelectItem value="question" className="text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer">Question</SelectItem>
                      <SelectItem value="tip" className="text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer">Tip</SelectItem>
                      <SelectItem value="success_story" className="text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer">Success Story</SelectItem>
                      <SelectItem value="challenge" className="text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer">Challenge</SelectItem>
                      <SelectItem value="announcement" className="text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer">Announcement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <Select value={formData.status} onValueChange={(v) => setFormData((p) => ({ ...p, status: v }))}>
                    <SelectTrigger className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-foreground text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-700 text-slate-100 rounded-xl shadow-xl z-50">
                      <SelectItem value="published" className="text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer">Published</SelectItem>
                      <SelectItem value="draft" className="text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer">Draft</SelectItem>
                      <SelectItem value="archived" className="text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Content *</label>
              <RichTextEditor
                value={formData.content}
                onChange={(content) => setFormData((p) => ({ ...p, content }))}
                placeholder="Start writing your community post..."
                minHeight="250px"
              />
            </div>
            {formError && (
              <p className="text-sm text-red-400">{formError}</p>
            )}
            <div className="flex items-center gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => { setShowForm(false); setEditingPost(null); }}
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
                  editingPost ? "Update Post" : "Create Post"
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search posts..."
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
            <SelectItem value="flagged" className="text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer">Flagged</SelectItem>
            <SelectItem value="archived" className="text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

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
                  <SelectItem value="published" className="text-slate-200">Published</SelectItem>
                  <SelectItem value="draft" className="text-slate-200">Draft</SelectItem>
                  <SelectItem value="flagged" className="text-slate-200">Flagged</SelectItem>
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

      {/* Posts Table */}
      <Card className="bg-white/5 border-white/10 rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16">
              <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No community posts found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02]">
                    <th className="w-12 px-4 py-3">
                      <Checkbox
                        checked={selectedIds.size === posts.length && posts.length > 0}
                        onCheckedChange={selectAll}
                        className="border-white/30"
                      />
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Post</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Engagement</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Author</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post, i) => (
                    <motion.tr
                      key={post.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      onClick={(e) => openDetailView(post, e)}
                      className={`border-b border-white/5 hover:bg-white/5 transition-all duration-200 cursor-pointer group ${selectedIds.has(post.id) ? "bg-primary/5" : ""}`}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(post.id)}
                          onCheckedChange={() => toggleSelect(post.id)}
                          className="border-white/30"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {post.is_pinned && <Pin className="w-3 h-3 text-amber-400 shrink-0" />}
                          {post.is_featured && <Star className="w-3 h-3 text-primary shrink-0" />}
                          <p className="text-sm font-medium text-foreground line-clamp-1 group-hover:text-primary/90 transition-colors">{post.title}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium capitalize ${getPostTypeColor(post.post_type)}`}>
                          {post.post_type.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <Select value={post.status} onValueChange={(v) => handleUpdateStatus(post.id, v)}>
                          <SelectTrigger className={`h-7 min-w-[90px] text-xs font-medium px-2 py-0.5 rounded-full border-0 cursor-pointer ${getStatusColor(post.status)}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-slate-900 border-slate-700 text-slate-100 rounded-xl shadow-xl z-50">
                            <SelectItem value="published" className="text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer">Published</SelectItem>
                            <SelectItem value="draft" className="text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer">Draft</SelectItem>
                            <SelectItem value="flagged" className="text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer">Flagged</SelectItem>
                            <SelectItem value="archived" className="text-slate-200 focus:bg-slate-800 focus:text-white cursor-pointer">Archived</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{post.views}</span>
                          <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{post.likes}</span>
                          <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{post.replies_count}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {post.author_first_name ? `${post.author_first_name} ${post.author_last_name?.charAt(0) || ""}.` : "Anonymous"}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleTogglePin(post)}
                            className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors ${post.is_pinned ? "text-amber-400" : "text-muted-foreground"}`}
                            title={post.is_pinned ? "Unpin" : "Pin"}
                          >
                            <Pin className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleFeatured(post)}
                            className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors ${post.is_featured ? "text-primary" : "text-muted-foreground"}`}
                            title={post.is_featured ? "Unfeature" : "Feature"}
                          >
                            <Star className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEdit(post)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-primary transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(post.id)}
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
              <p className="text-xs text-muted-foreground">
                Showing {posts.length} of {total} posts
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
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
        title={detailPost?.title || "Post Details"}
        onEdit={detailPost ? () => openEdit(detailPost) : undefined}
        onDelete={detailPost ? () => handleDelete(detailPost.id) : undefined}
      >
        {detailLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : detailPost ? (
          <div className="space-y-6">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Category & Type</label>
              <div className="flex gap-2 mt-1">
                <span className="text-sm text-foreground capitalize">{detailPost.category.replace(/-/g, " ")}</span>
                <span className="text-muted-foreground">·</span>
                <span className={`text-sm capitalize ${getPostTypeColor(detailPost.post_type)}`}>{detailPost.post_type.replace(/_/g, " ")}</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</label>
              <span className={`inline-block mt-1 text-xs font-medium px-2.5 py-1 rounded-full capitalize ${getStatusColor(detailPost.status)}`}>
                {detailPost.status}
              </span>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Author</label>
              <p className="text-sm text-foreground mt-1">
                {detailPost.author_first_name ? `${detailPost.author_first_name} ${detailPost.author_last_name ?? ""}` : "Anonymous"}
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Engagement</label>
              <div className="flex gap-4 mt-1 text-sm">
                <span className="flex items-center gap-1 text-muted-foreground"><Eye className="w-3 h-3" /> {detailPost.views} views</span>
                <span className="flex items-center gap-1 text-muted-foreground"><ThumbsUp className="w-3 h-3" /> {detailPost.likes} likes</span>
                <span className="flex items-center gap-1 text-muted-foreground"><MessageCircle className="w-3 h-3" /> {detailPost.replies_count} replies</span>
              </div>
            </div>
            {detailPost.content && (
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Content</label>
                <p className="text-sm text-foreground mt-1 line-clamp-6">{detailPost.content.replace(/<[^>]*>/g, " ").trim().slice(0, 400)}{detailPost.content.length > 400 ? "…" : ""}</p>
              </div>
            )}
          </div>
        ) : null}
      </AdminDetailSidebar>
    </div>
  );
}
