"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Trash2,
  Eye,
  Loader2,
  Mail,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";
import { ConfirmationModal } from "@/components/ui/confirmation-modal";

interface NewsletterSubscription {
  id: string;
  email: string;
  interests: string[];
  source: string;
  created_at: string;
}

export default function AdminNewsletterPageContent() {
  const [subscriptions, setSubscriptions] = useState<NewsletterSubscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedItem, setSelectedItem] = useState<NewsletterSubscription | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; id?: string; bulk?: boolean }>({ open: false });
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchList = useCallback(async () => {
    try {
      setError(null);
      setIsLoading(true);
      const params: Record<string, string> = {
        page: page.toString(),
        limit: limit.toString(),
        sort_by: "created_at",
        sort_order: "desc",
      };
      if (debouncedSearch) params.search = debouncedSearch;
      const res = await api.get<NewsletterSubscription[]>("/admin/newsletter", { params });
      const data = Array.isArray(res.data) ? res.data : [];
      setSubscriptions(data);
      if (res.meta) {
        setTotal(res.meta.total ?? 0);
        setTotalPages(res.meta.totalPages ?? 0);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load subscriptions");
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, debouncedSearch]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleView = (item: NewsletterSubscription) => {
    setSelectedItem(item);
    setShowDetail(true);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      if (deleteModal.bulk && selectedIds.size > 0) {
        await api.post("/admin/newsletter/bulk-delete", { ids: Array.from(selectedIds) });
        setSelectedIds(new Set());
      } else if (deleteModal.id) {
        await api.delete(`/admin/newsletter/${deleteModal.id}`);
      }
      setDeleteModal({ open: false });
      setShowDetail(false);
      setSelectedItem(null);
      fetchList();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === subscriptions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(subscriptions.map((s) => s.id)));
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString(undefined, {
        dateStyle: "short",
        timeStyle: "short",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Newsletter Subscriptions</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Email signups from footer and lead magnet. View, delete, or bulk delete.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-4 rounded-lg border border-input bg-background text-sm"
          />
        </div>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
            <button
              type="button"
              onClick={() => setDeleteModal({ open: true, bulk: true })}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-destructive/50 text-destructive hover:bg-destructive/10 text-sm"
            >
              <Trash2 className="w-4 h-4" />
              Delete selected
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Mail className="w-12 h-12 mb-4 opacity-50" />
            <p>No subscriptions yet.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-4 w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === subscriptions.length && subscriptions.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="text-left p-4 font-medium">Email</th>
                    <th className="text-left p-4 font-medium">Interests</th>
                    <th className="text-left p-4 font-medium">Source</th>
                    <th className="text-left p-4 font-medium">Created</th>
                    <th className="text-right p-4 font-medium w-28">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((item) => (
                    <tr key={item.id} className="border-b border-border hover:bg-muted/30">
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="p-4 font-medium">{item.email}</td>
                      <td className="p-4">
                        {item.interests?.length
                          ? item.interests.join(", ")
                          : "—"}
                      </td>
                      <td className="p-4">{item.source || "footer"}</td>
                      <td className="p-4 text-muted-foreground">{formatDate(item.created_at)}</td>
                      <td className="p-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleView(item)}
                          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteModal({ open: true, id: item.id })}
                          className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages} ({total} total)
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="h-9 px-3 rounded-lg border border-border disabled:opacity-50 flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" /> Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="h-9 px-3 rounded-lg border border-border disabled:opacity-50 flex items-center gap-1"
                  >
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showDetail && selectedItem && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDetail(false)} aria-hidden />
          <div className="relative w-full max-w-md bg-card border-l border-border shadow-xl flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold">Subscription details</h2>
              <button
                type="button"
                onClick={() => setShowDetail(false)}
                className="p-2 rounded-lg hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Email</p>
                <p className="font-medium">{selectedItem.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Interests</p>
                <p className="font-medium">
                  {selectedItem.interests?.length ? selectedItem.interests.join(", ") : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Source</p>
                <p className="font-medium">{selectedItem.source || "footer"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Created</p>
                <p className="font-medium">{formatDate(selectedItem.created_at)}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDeleteModal({ open: true, id: selectedItem.id });
                }}
                className="w-full h-10 rounded-lg border border-destructive/50 text-destructive hover:bg-destructive/10 flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        open={deleteModal.open}
        onOpenChange={(open) => setDeleteModal((prev) => ({ ...prev, open }))}
        onConfirm={handleDeleteConfirm}
        title={deleteModal.bulk ? "Delete selected subscriptions?" : "Delete subscription?"}
        description={
          deleteModal.bulk
            ? `This will permanently delete ${selectedIds.size} subscription(s).`
            : "This subscription will be permanently removed."
        }
        confirmLabel="Delete"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
}
