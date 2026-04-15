"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  ChevronRight,
  ChevronLeft,
  Filter,
  Loader2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Archive,
  ArchiveRestore,
  Trophy,
  Target,
  Flame,
  Heart,
  MessageSquare,
  Settings,
  Link2,
  Sparkles,
  AlertTriangle,
  Lightbulb,
  Gift,
  Clock,
  MoreVertical,
  X,
  CheckSquare,
  Square,
  Search,
  Eye,
  EyeOff,
  Calendar,
  TrendingUp,
} from "lucide-react";
import { api, ApiError } from "@/lib/api-client";

// Types
interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  icon?: string;
  imageUrl?: string;
  actionUrl?: string;
  actionLabel?: string;
  category?: string;
  priority: "low" | "normal" | "high" | "urgent";
  isRead: boolean;
  readAt?: string;
  isArchived: boolean;
  relatedEntityType?: string;
  relatedEntityId?: string;
  metadata?: Record<string, unknown>;
  expiresAt?: string;
  createdAt: string;
}

interface NotificationStats {
  total: number;
  unread: number;
  read: number;
  archived: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
}

interface UnreadCount {
  unreadCount: number;
  urgentCount: number;
  highCount: number;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// Type config
const notificationTypeConfig: Record<
  string,
  { icon: React.ReactNode; color: string; bgColor: string }
> = {
  achievement: {
    icon: <Trophy className="w-5 h-5" />,
    color: "text-amber-400",
    bgColor: "from-amber-500/20 to-orange-500/20",
  },
  goal_progress: {
    icon: <TrendingUp className="w-5 h-5" />,
    color: "text-blue-400",
    bgColor: "from-blue-500/20 to-cyan-500/20",
  },
  goal_completed: {
    icon: <Target className="w-5 h-5" />,
    color: "text-green-400",
    bgColor: "from-green-500/20 to-emerald-500/20",
  },
  streak: {
    icon: <Flame className="w-5 h-5" />,
    color: "text-orange-400",
    bgColor: "from-orange-500/20 to-red-500/20",
  },
  reminder: {
    icon: <Clock className="w-5 h-5" />,
    color: "text-purple-400",
    bgColor: "from-purple-500/20 to-violet-500/20",
  },
  plan_update: {
    icon: <Calendar className="w-5 h-5" />,
    color: "text-cyan-400",
    bgColor: "from-cyan-500/20 to-blue-500/20",
  },
  system: {
    icon: <Settings className="w-5 h-5" />,
    color: "text-slate-400",
    bgColor: "from-slate-500/20 to-gray-500/20",
  },
  social: {
    icon: <Heart className="w-5 h-5" />,
    color: "text-pink-400",
    bgColor: "from-pink-500/20 to-rose-500/20",
  },
  integration: {
    icon: <Link2 className="w-5 h-5" />,
    color: "text-indigo-400",
    bgColor: "from-indigo-500/20 to-purple-500/20",
  },
  coaching: {
    icon: <MessageSquare className="w-5 h-5" />,
    color: "text-teal-400",
    bgColor: "from-teal-500/20 to-cyan-500/20",
  },
  celebration: {
    icon: <Gift className="w-5 h-5" />,
    color: "text-yellow-400",
    bgColor: "from-yellow-500/20 to-amber-500/20",
  },
  warning: {
    icon: <AlertTriangle className="w-5 h-5" />,
    color: "text-red-400",
    bgColor: "from-red-500/20 to-orange-500/20",
  },
  tip: {
    icon: <Lightbulb className="w-5 h-5" />,
    color: "text-lime-400",
    bgColor: "from-lime-500/20 to-green-500/20",
  },
};

// Priority config
const priorityConfig: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  urgent: { label: "Urgent", color: "text-red-400", bgColor: "bg-red-500/20" },
  high: { label: "High", color: "text-orange-400", bgColor: "bg-orange-500/20" },
  normal: { label: "Normal", color: "text-slate-400", bgColor: "bg-slate-500/20" },
  low: { label: "Low", color: "text-slate-500", bgColor: "bg-slate-600/20" },
};

// Format relative time
function formatRelativeTime(dateString: string): string {
  // Handle invalid or empty dates
  if (!dateString) {
    return "Unknown";
  }

  // Parse the date - PostgreSQL TIMESTAMP without timezone is stored as local time
  // but JSON serialization sends it without timezone info.
  // We need to parse it correctly based on whether it has timezone info.
  let date: Date;
  const hasTimezoneInfo = dateString.endsWith('Z') ||
    /[+-]\d{2}:\d{2}$/.test(dateString) ||
    /[+-]\d{4}$/.test(dateString);

  if (hasTimezoneInfo) {
    // Already has timezone info - parse directly
    date = new Date(dateString);
  } else {
    // No timezone info - the timestamp is in server's local time (likely UTC)
    // Append 'Z' to treat as UTC since PostgreSQL sends UTC timestamps
    date = new Date(dateString + 'Z');
  }

  // Handle invalid dates
  if (isNaN(date.getTime())) {
    return "Unknown";
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  // Handle future dates (server time mismatch)
  if (diffMs < 0) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Confirmation Modal Component
const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  isLoading = false,
  variant = "danger",
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  isLoading?: boolean;
  variant?: "danger" | "warning" | "info";
}) => {
  const variantColors = {
    danger: { bg: "bg-red-500", hover: "hover:bg-red-600", icon: "text-red-400" },
    warning: { bg: "bg-amber-500", hover: "hover:bg-amber-600", icon: "text-amber-400" },
    info: { bg: "bg-blue-500", hover: "hover:bg-blue-600", icon: "text-blue-400" },
  };
  const colors = variantColors[variant];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-12 h-12 rounded-full ${colors.bg}/20 flex items-center justify-center`}>
                <AlertTriangle className={`w-6 h-6 ${colors.icon}`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{title}</h3>
                <p className="text-sm text-slate-400">{message}</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={isLoading}
                className={`flex-1 px-4 py-2.5 rounded-xl ${colors.bg} text-white ${colors.hover} transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer`}
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Notification Detail Modal
const NotificationDetailModal = ({
  notification,
  onClose,
  onMarkRead,
  onDelete,
}: {
  notification: Notification | null;
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}) => {
  if (!notification) return null;

  const config = notificationTypeConfig[notification.type] || notificationTypeConfig.system;
  const priority = priorityConfig[notification.priority];

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className={`bg-gradient-to-br ${config.bgColor} border border-white/10 rounded-3xl p-6 max-w-lg w-full shadow-2xl`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center ${config.color}`}>
                  {notification.icon ? (
                    <span className="text-2xl">{notification.icon}</span>
                  ) : (
                    config.icon
                  )}
                </div>
                <div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${priority.bgColor} ${priority.color}`}>
                    {priority.label}
                  </span>
                  <p className="text-xs text-slate-400 mt-1">
                    {formatRelativeTime(notification.createdAt)}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Content */}
            <h2 className="text-xl font-bold text-white mb-2">{notification.title}</h2>
            <p className="text-slate-300 mb-4 leading-relaxed">{notification.message}</p>

            {/* Image */}
            {notification.imageUrl && (
              <div className="mb-4 rounded-xl overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={notification.imageUrl}
                  alt=""
                  className="w-full h-48 object-cover"
                />
              </div>
            )}

            {/* Metadata */}
            {notification.metadata && Object.keys(notification.metadata).length > 0 && (
              <div className="mb-4 p-3 rounded-xl bg-white/5 border border-white/10">
                <p className="text-xs text-slate-400 mb-2">Additional Details</p>
                <div className="space-y-1">
                  {Object.entries(notification.metadata).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-slate-400 capitalize">{key.replace(/_/g, " ")}</span>
                      <span className="text-white">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Status */}
            <div className="flex items-center gap-2 mb-4 text-sm">
              {notification.isRead ? (
                <span className="flex items-center gap-1 text-green-400">
                  <CheckCheck className="w-4 h-4" />
                  Read
                </span>
              ) : (
                <span className="flex items-center gap-1 text-slate-400">
                  <Eye className="w-4 h-4" />
                  Unread
                </span>
              )}
              <span className="text-slate-600">|</span>
              <span className="text-slate-400 capitalize">
                {notification.type.replace(/_/g, " ")}
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              {notification.actionUrl && (
                <a
                  href={notification.actionUrl}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium text-center hover:opacity-90 transition-opacity"
                >
                  {notification.actionLabel || "View Details"}
                </a>
              )}
              {!notification.isRead && (
                <button
                  onClick={() => {
                    onMarkRead(notification.id);
                    onClose();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-white/10 text-white border border-white/10 hover:bg-white/20 transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  Mark Read
                </button>
              )}
              <button
                onClick={() => {
                  onDelete(notification.id);
                  onClose();
                }}
                className="px-4 py-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Empty State Component
const EmptyState = ({ filter, showArchived }: { filter: string; showArchived: boolean }) => {
  const content = showArchived
    ? {
        icon: <Archive className="w-12 h-12" />,
        title: "No Archived Notifications",
        description: "Archived notifications will appear here.",
      }
    : filter === "unread"
    ? {
        icon: <CheckCheck className="w-12 h-12" />,
        title: "All Caught Up!",
        description: "You have no unread notifications. Great job staying on top of things!",
      }
    : {
        icon: <Bell className="w-12 h-12" />,
        title: "No Notifications Yet",
        description: "When you receive notifications, they will appear here.",
      };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center py-16 rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/5"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", delay: 0.1 }}
        className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-slate-700/50 to-slate-800/50 flex items-center justify-center relative overflow-hidden"
      >
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-blue-500/10"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="text-slate-500 relative z-10">{content.icon}</div>
      </motion.div>
      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-xl font-semibold text-white mb-2"
      >
        {content.title}
      </motion.h3>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-slate-400 max-w-sm mx-auto"
      >
        {content.description}
      </motion.p>
    </motion.div>
  );
};

const ITEMS_PER_PAGE = 15;

export function NotificationsTab() {
  // State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [unreadCount, setUnreadCount] = useState<UnreadCount | null>(null);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Modals
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; ids: string[] }>({
    isOpen: false,
    ids: [],
  });
  const [markAllReadModal, setMarkAllReadModal] = useState(false);

  // Actions
  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const [isActioning, setIsActioning] = useState(false);

  // Fetch notifications
  const fetchNotifications = useCallback(async (page = currentPage) => {
    setIsLoading(true);
    setError(null);

    try {
      const params: Record<string, string> = {
        isArchived: showArchived.toString(),
        limit: ITEMS_PER_PAGE.toString(),
        page: page.toString(),
      };

      if (filter === "unread") {
        params.isRead = "false";
      }

      if (typeFilter !== "all") {
        params.type = typeFilter;
      }

      if (priorityFilter !== "all") {
        params.priority = priorityFilter;
      }

      const [notificationsRes, statsRes, countRes] = await Promise.all([
        api.get<Notification[]>("/notifications", { params }),
        api.get<NotificationStats>("/notifications/stats"),
        api.get<UnreadCount>("/notifications/unread-count"),
      ]);

      if (notificationsRes.success && notificationsRes.data) {
        // API returns array directly in data field
        setNotifications(Array.isArray(notificationsRes.data) ? notificationsRes.data : []);
        // Extract pagination meta from response (meta is at the top level of the response)
        if (notificationsRes.meta) {
          setPagination({
            page: notificationsRes.meta.page,
            limit: notificationsRes.meta.limit,
            total: notificationsRes.meta.total,
            totalPages: notificationsRes.meta.totalPages,
            hasNextPage: notificationsRes.meta.hasNextPage,
            hasPrevPage: notificationsRes.meta.hasPrevPage,
          });
        }
      }
      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }
      if (countRes.success && countRes.data) {
        setUnreadCount(countRes.data);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load notifications");
      }
    } finally {
      setIsLoading(false);
    }
  }, [filter, typeFilter, priorityFilter, showArchived, currentPage]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, typeFilter, priorityFilter, showArchived]);

  // Page change handler
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchNotifications(page);
  };

  // Filter notifications by search
  const filteredNotifications = useMemo(() => {
    if (!searchQuery) return notifications;
    const query = searchQuery.toLowerCase();
    return notifications.filter(
      (n) =>
        n.title.toLowerCase().includes(query) ||
        n.message.toLowerCase().includes(query)
    );
  }, [notifications, searchQuery]);

  // Selection handlers
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredNotifications.map((n) => n.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  // Mark as read
  const markAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      if (unreadCount) {
        setUnreadCount({ ...unreadCount, unreadCount: unreadCount.unreadCount - 1 });
      }
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  const markAsUnread = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/unread`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: false } : n))
      );
      if (unreadCount) {
        setUnreadCount({ ...unreadCount, unreadCount: unreadCount.unreadCount + 1 });
      }
    } catch (err) {
      console.error("Failed to mark as unread:", err);
    }
  };

  const markSelectedAsRead = async () => {
    if (selectedIds.size === 0) return;
    setIsActioning(true);

    try {
      await api.post("/notifications/mark-read", {
        notificationIds: Array.from(selectedIds),
      });
      setNotifications((prev) =>
        prev.map((n) => (selectedIds.has(n.id) ? { ...n, isRead: true } : n))
      );
      clearSelection();
      fetchNotifications();
    } catch (err) {
      console.error("Failed to mark as read:", err);
    } finally {
      setIsActioning(false);
    }
  };

  const markAllAsRead = async () => {
    setIsActioning(true);

    try {
      await api.post("/notifications/mark-all-read", {});
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setMarkAllReadModal(false);
      fetchNotifications();
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    } finally {
      setIsActioning(false);
    }
  };

  // Delete single notification (used by modal)
  const _deleteNotification = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      fetchNotifications();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };
  // Expose for potential future use
  void _deleteNotification;

  const deleteSelected = async () => {
    if (deleteModal.ids.length === 0) return;
    setIsActioning(true);

    try {
      await api.post("/notifications/delete-multiple", {
        notificationIds: deleteModal.ids,
      });
      setNotifications((prev) =>
        prev.filter((n) => !deleteModal.ids.includes(n.id))
      );
      setDeleteModal({ isOpen: false, ids: [] });
      clearSelection();
      fetchNotifications();
    } catch (err) {
      console.error("Failed to delete:", err);
    } finally {
      setIsActioning(false);
    }
  };

  // Archive
  const archiveNotification = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/archive`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      fetchNotifications();
    } catch (err) {
      console.error("Failed to archive:", err);
    }
  };

  const unarchiveNotification = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/unarchive`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      fetchNotifications();
    } catch (err) {
      console.error("Failed to unarchive:", err);
    }
  };

  // Loading state
  if (isLoading && notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="w-10 h-10 text-cyan-500" />
        </motion.div>
        <p className="text-slate-400">Loading notifications...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-20"
      >
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={() => fetchNotifications()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-4"
      >
        {[
          {
            label: "Unread",
            value: unreadCount?.unreadCount || 0,
            icon: Bell,
            color: "cyan",
            urgent: unreadCount?.urgentCount || 0,
          },
          {
            label: "Total",
            value: stats?.total || 0,
            icon: Sparkles,
            color: "purple",
          },
          {
            label: "Read",
            value: stats?.read || 0,
            icon: CheckCheck,
            color: "green",
          },
          {
            label: "Archived",
            value: stats?.archived || 0,
            icon: Archive,
            color: "slate",
          },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`p-4 rounded-2xl bg-gradient-to-br from-${stat.color}-500/10 to-${stat.color}-600/5 border border-white/10 hover:border-white/20 transition-all`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`p-2 rounded-lg bg-${stat.color}-500/20`}>
                <stat.icon className={`w-4 h-4 text-${stat.color}-400`} />
              </div>
              {stat.urgent && stat.urgent > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">
                  {stat.urgent} urgent
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-sm text-slate-400">{stat.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Filters Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-4"
      >
        {/* Search and main filters */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notifications..."
              className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
            />
          </div>

          {/* Read/Unread filter */}
          <div className="flex items-center gap-2 p-1 rounded-xl bg-white/5 border border-white/10">
            {(["all", "unread"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  filter === f
                    ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/25"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {f === "all" ? "All" : "Unread"}
              </button>
            ))}
          </div>

          {/* Archive toggle */}
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 cursor-pointer ${
              showArchived
                ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
            }`}
          >
            <Archive className="w-4 h-4" />
            {showArchived ? "Showing Archived" : "Show Archived"}
          </button>
        </div>

        {/* Type and Priority filters */}
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10 overflow-x-auto">
            <Filter className="w-4 h-4 text-slate-500 ml-2 flex-shrink-0" />
            {["all", "achievement", "goal_progress", "streak", "reminder", "coaching", "system"].map((type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                  typeFilter === type
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {type === "all" ? "All Types" : type.replace(/_/g, " ")}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10">
            {["all", "urgent", "high", "normal", "low"].map((priority) => (
              <button
                key={priority}
                onClick={() => setPriorityFilter(priority)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  priorityFilter === priority
                    ? priority === "urgent"
                      ? "bg-red-500/20 text-red-400"
                      : priority === "high"
                      ? "bg-orange-500/20 text-orange-400"
                      : "bg-white/10 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {priority === "all" ? "All Priority" : priority}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Actions Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (isSelectionMode) {
                clearSelection();
              } else {
                setIsSelectionMode(true);
              }
            }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 cursor-pointer ${
              isSelectionMode
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
            }`}
          >
            {isSelectionMode ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            {isSelectionMode ? "Cancel" : "Select"}
          </button>

          <AnimatePresence>
            {isSelectionMode && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-2"
              >
                <button
                  onClick={selectAll}
                  className="px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Select All
                </button>
                {selectedIds.size > 0 && (
                  <>
                    <span className="text-sm text-slate-500">{selectedIds.size} selected</span>
                    <button
                      onClick={markSelectedAsRead}
                      disabled={isActioning}
                      className="px-3 py-2 rounded-lg text-sm font-medium text-cyan-400 hover:bg-cyan-500/10 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      Mark Read
                    </button>
                    <button
                      onClick={() => setDeleteModal({ isOpen: true, ids: Array.from(selectedIds) })}
                      className="px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount && unreadCount.unreadCount > 0 && (
            <button
              onClick={() => setMarkAllReadModal(true)}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <CheckCheck className="w-4 h-4" />
              Mark All Read
            </button>
          )}
          <button
            onClick={() => fetchNotifications()}
            disabled={isLoading}
            className="p-2 rounded-xl bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </motion.div>

      {/* Notifications List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-3"
      >
        <AnimatePresence mode="popLayout">
          {filteredNotifications.length === 0 ? (
            <EmptyState filter={filter} showArchived={showArchived} />
          ) : (
            filteredNotifications.map((notification, index) => {
              const config = notificationTypeConfig[notification.type] || notificationTypeConfig.system;
              const priority = priorityConfig[notification.priority];
              const isSelected = selectedIds.has(notification.id);

              return (
                <motion.div
                  key={notification.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -10 }}
                  transition={{ delay: index * 0.02 }}
                  className={`p-4 rounded-2xl border transition-all group relative ${
                    isSelected
                      ? "bg-cyan-500/10 border-cyan-500/30"
                      : notification.isRead
                      ? "bg-white/3 border-white/5 hover:border-white/10"
                      : `bg-gradient-to-br ${config.bgColor} border-white/10 hover:border-white/20`
                  }`}
                >
                  {/* Unread indicator */}
                  {!notification.isRead && (
                    <div className="absolute top-4 left-4 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  )}

                  <div className="flex items-start gap-4">
                    {/* Selection Checkbox */}
                    {isSelectionMode && (
                      <motion.button
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        onClick={() => toggleSelection(notification.id)}
                        className={`mt-1 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all cursor-pointer ${
                          isSelected
                            ? "bg-cyan-500 border-cyan-500"
                            : "border-white/30 hover:border-cyan-500"
                        }`}
                      >
                        {isSelected && <Check className="w-4 h-4 text-white" />}
                      </motion.button>
                    )}

                    {/* Icon */}
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                        notification.isRead
                          ? "bg-white/5"
                          : `bg-gradient-to-br ${config.bgColor}`
                      } ${config.color}`}
                    >
                      {notification.icon ? (
                        <span className="text-xl">{notification.icon}</span>
                      ) : (
                        config.icon
                      )}
                    </div>

                    {/* Content */}
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => setSelectedNotification(notification)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3
                          className={`font-semibold truncate ${
                            notification.isRead ? "text-slate-300" : "text-white"
                          }`}
                        >
                          {notification.title}
                        </h3>
                        <div className="flex items-center gap-2 shrink-0">
                          {notification.priority !== "normal" && (
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${priority.bgColor} ${priority.color}`}
                            >
                              {priority.label}
                            </span>
                          )}
                          <span className="text-xs text-slate-500">
                            {formatRelativeTime(notification.createdAt)}
                          </span>
                        </div>
                      </div>
                      <p
                        className={`text-sm line-clamp-2 ${
                          notification.isRead ? "text-slate-500" : "text-slate-400"
                        }`}
                      >
                        {notification.message}
                      </p>

                      {/* Action button */}
                      {notification.actionUrl && (
                        <a
                          href={notification.actionUrl}
                          className="inline-flex items-center gap-1 mt-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {notification.actionLabel || "View Details"}
                          <ChevronRight className="w-4 h-4" />
                        </a>
                      )}
                    </div>

                    {/* Actions Menu */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActionMenu(actionMenu === notification.id ? null : notification.id);
                        }}
                        className="p-2 rounded-lg bg-white/5 opacity-0 group-hover:opacity-100 transition-all hover:bg-white/10 cursor-pointer"
                      >
                        <MoreVertical className="w-4 h-4 text-slate-400" />
                      </button>

                      <AnimatePresence>
                        {actionMenu === notification.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            className="absolute right-0 top-full mt-1 w-44 py-1 rounded-xl bg-slate-800 border border-white/10 shadow-xl z-10"
                          >
                            {notification.isRead ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsUnread(notification.id);
                                  setActionMenu(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-white/5 transition-colors flex items-center gap-2 cursor-pointer"
                              >
                                <EyeOff className="w-4 h-4" />
                                Mark Unread
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsRead(notification.id);
                                  setActionMenu(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-white/5 transition-colors flex items-center gap-2 cursor-pointer"
                              >
                                <Eye className="w-4 h-4" />
                                Mark Read
                              </button>
                            )}

                            {showArchived ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  unarchiveNotification(notification.id);
                                  setActionMenu(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-purple-400 hover:bg-purple-500/10 transition-colors flex items-center gap-2 cursor-pointer"
                              >
                                <ArchiveRestore className="w-4 h-4" />
                                Unarchive
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  archiveNotification(notification.id);
                                  setActionMenu(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-purple-400 hover:bg-purple-500/10 transition-colors flex items-center gap-2 cursor-pointer"
                              >
                                <Archive className="w-4 h-4" />
                                Archive
                              </button>
                            )}

                            <div className="my-1 border-t border-white/10" />

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteModal({ isOpen: true, ids: [notification.id] });
                                setActionMenu(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </motion.div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-2 pt-4"
        >
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={!pagination.hasPrevPage || isLoading}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-1">
            {/* Simple pagination: show all pages if <= 7, otherwise show smart range */}
            {pagination.totalPages <= 7 ? (
              // Show all pages for small page counts
              Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  className={`w-10 h-10 rounded-lg border transition-colors ${
                    page === currentPage
                      ? "bg-cyan-500 border-cyan-500 text-white"
                      : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {page}
                </button>
              ))
            ) : (
              // Smart pagination for larger page counts
              <>
                {/* First page */}
                <button
                  onClick={() => handlePageChange(1)}
                  className={`w-10 h-10 rounded-lg border transition-colors ${
                    currentPage === 1
                      ? "bg-cyan-500 border-cyan-500 text-white"
                      : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  1
                </button>

                {/* Ellipsis before current range */}
                {currentPage > 3 && <span className="px-2 text-slate-500">...</span>}

                {/* Pages around current */}
                {Array.from({ length: 3 }, (_, i) => currentPage - 1 + i)
                  .filter((page) => page > 1 && page < pagination.totalPages)
                  .map((page) => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`w-10 h-10 rounded-lg border transition-colors ${
                        page === currentPage
                          ? "bg-cyan-500 border-cyan-500 text-white"
                          : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {page}
                    </button>
                  ))}

                {/* Ellipsis after current range */}
                {currentPage < pagination.totalPages - 2 && <span className="px-2 text-slate-500">...</span>}

                {/* Last page */}
                <button
                  onClick={() => handlePageChange(pagination.totalPages)}
                  className={`w-10 h-10 rounded-lg border transition-colors ${
                    currentPage === pagination.totalPages
                      ? "bg-cyan-500 border-cyan-500 text-white"
                      : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {pagination.totalPages}
                </button>
              </>
            )}
          </div>

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={!pagination.hasNextPage || isLoading}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <span className="ml-4 text-sm text-slate-500">
            Page {currentPage} of {pagination.totalPages} ({pagination.total} total)
          </span>
        </motion.div>
      )}

      {/* Notification Detail Modal */}
      <NotificationDetailModal
        notification={selectedNotification}
        onClose={() => setSelectedNotification(null)}
        onMarkRead={markAsRead}
        onDelete={(id) => {
          setDeleteModal({ isOpen: true, ids: [id] });
        }}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, ids: [] })}
        onConfirm={deleteSelected}
        title={deleteModal.ids.length > 1 ? "Delete Notifications" : "Delete Notification"}
        message={
          deleteModal.ids.length > 1
            ? `Are you sure you want to delete ${deleteModal.ids.length} notifications? This cannot be undone.`
            : "Are you sure you want to delete this notification? This cannot be undone."
        }
        confirmText="Delete"
        isLoading={isActioning}
        variant="danger"
      />

      {/* Mark All Read Confirmation Modal */}
      <ConfirmModal
        isOpen={markAllReadModal}
        onClose={() => setMarkAllReadModal(false)}
        onConfirm={markAllAsRead}
        title="Mark All as Read"
        message={`Mark all ${unreadCount?.unreadCount || 0} unread notifications as read?`}
        confirmText="Mark All Read"
        isLoading={isActioning}
        variant="info"
      />

      {/* Click outside to close action menu */}
      {actionMenu && (
        <div className="fixed inset-0 z-0" onClick={() => setActionMenu(null)} />
      )}
    </div>
  );
}
