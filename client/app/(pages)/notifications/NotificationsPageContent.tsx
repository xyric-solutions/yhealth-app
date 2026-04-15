"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Trash2,
  Archive,
  Filter,
  Search,
  Clock,
  Trophy,
  Target,
  Flame,
  Settings,
  AlertTriangle,
  Lightbulb,
  MessageSquare,
  Link2,
  PartyPopper,
  Calendar,
  ArrowLeft,
  MoreVertical,
  RefreshCw,
  X,
  Inbox,
  CheckCircle2,
  Circle,
  ArchiveRestore,
  Sparkles,
  Zap,
  Star,
  TrendingUp,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DashboardLayout } from "@/components/layout";
import { useAuth } from "@/app/context/AuthContext";
import { api } from "@/lib/api-client";
import { initSocket, subscribeToNotificationEvents, type NotificationEvent } from "@/lib/socket-client";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import toast from "react-hot-toast";
import Link from "next/link";

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
  archivedAt?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  metadata?: Record<string, unknown>;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface NotificationStats {
  total: number;
  unread: number;
  read: number;
  archived: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
}

// Notification type icons and colors
const NOTIFICATION_CONFIG: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; bg: string; gradient: string }
> = {
  achievement: {
    icon: Trophy,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    gradient: "from-amber-500 to-orange-500",
  },
  goal_progress: {
    icon: Target,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    gradient: "from-blue-500 to-cyan-500",
  },
  goal_completed: {
    icon: CheckCircle2,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    gradient: "from-emerald-500 to-teal-500",
  },
  streak: {
    icon: Flame,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    gradient: "from-orange-500 to-red-500",
  },
  reminder: {
    icon: Clock,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    gradient: "from-purple-500 to-pink-500",
  },
  plan_update: {
    icon: Calendar,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    gradient: "from-cyan-500 to-blue-500",
  },
  system: {
    icon: Settings,
    color: "text-slate-400",
    bg: "bg-slate-500/10",
    gradient: "from-slate-500 to-zinc-500",
  },
  social: {
    icon: MessageSquare,
    color: "text-pink-400",
    bg: "bg-pink-500/10",
    gradient: "from-pink-500 to-rose-500",
  },
  integration: {
    icon: Link2,
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
    gradient: "from-indigo-500 to-violet-500",
  },
  coaching: {
    icon: Sparkles,
    color: "text-teal-400",
    bg: "bg-teal-500/10",
    gradient: "from-teal-500 to-emerald-500",
  },
  celebration: {
    icon: PartyPopper,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    gradient: "from-yellow-500 to-amber-500",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-red-400",
    bg: "bg-red-500/10",
    gradient: "from-red-500 to-rose-500",
  },
  tip: {
    icon: Lightbulb,
    color: "text-green-400",
    bg: "bg-green-500/10",
    gradient: "from-green-500 to-emerald-500",
  },
  activity: {
    icon: Activity,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    gradient: "from-violet-500 to-purple-500",
  },
  milestone: {
    icon: Star,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    gradient: "from-yellow-500 to-orange-500",
  },
  progress: {
    icon: TrendingUp,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    gradient: "from-cyan-500 to-teal-500",
  },
};

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  low: { color: "text-slate-400", bg: "bg-slate-500/20", label: "Low" },
  normal: { color: "text-blue-400", bg: "bg-blue-500/20", label: "Normal" },
  high: { color: "text-orange-400", bg: "bg-orange-500/20", label: "High" },
  urgent: { color: "text-red-400", bg: "bg-red-500/20", label: "Urgent" },
};

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.03 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, x: -50, transition: { duration: 0.2 } },
};

// Format date with smart grouping
function formatNotificationDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) {
    return formatDistanceToNow(date, { addSuffix: true });
  }
  if (isYesterday(date)) {
    return "Yesterday at " + format(date, "h:mm a");
  }
  return format(date, "MMM d 'at' h:mm a");
}

function NotificationSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="flex items-start gap-4 p-5 rounded-2xl bg-slate-800/50"
        >
          <Skeleton className="w-12 h-12 rounded-2xl flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  type,
  searchQuery,
}: {
  type: string;
  searchQuery: string;
}) {
  const messages: Record<string, { title: string; description: string; icon: React.ComponentType<{ className?: string }> }> = {
    all: {
      title: "No notifications yet",
      description:
        "When you receive notifications, they will appear here. Start your health journey to get updates!",
      icon: Inbox,
    },
    unread: {
      title: "All caught up!",
      description:
        "You have no unread notifications. Great job staying on top of things!",
      icon: CheckCheck,
    },
    archived: {
      title: "No archived notifications",
      description:
        "Notifications you archive will be stored here for reference.",
      icon: Archive,
    },
    search: {
      title: "No results found",
      description: `No notifications match "${searchQuery}". Try a different search term.`,
      icon: Search,
    },
  };

  const { title, description, icon: Icon } =
    messages[searchQuery ? "search" : type] || messages.all;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", delay: 0.1, stiffness: 200 }}
        className="relative mb-8"
      >
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
          <Icon className="w-12 h-12 text-slate-400" />
        </div>
        <motion.div
          className="absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-500/10 to-purple-500/10"
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </motion.div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-400 max-w-md">{description}</p>
    </motion.div>
  );
}

function NotificationItem({
  notification,
  isSelected,
  onSelect,
  onMarkRead,
  onMarkUnread,
  onArchive,
  onUnarchive,
  onDelete,
  selectionMode,
}: {
  notification: Notification;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onMarkRead: (id: string) => void;
  onMarkUnread: (id: string) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onDelete: (id: string) => void;
  selectionMode: boolean;
}) {
  const router = useRouter();
  const config = NOTIFICATION_CONFIG[notification.type] || {
    icon: Bell,
    color: "text-slate-400",
    bg: "bg-slate-500/10",
    gradient: "from-slate-500 to-zinc-500",
  };
  const Icon = config.icon;
  const priorityConfig = PRIORITY_CONFIG[notification.priority] || PRIORITY_CONFIG.normal;

  const handleClick = () => {
    if (selectionMode) {
      onSelect(notification.id);
      return;
    }

    if (!notification.isRead) {
      onMarkRead(notification.id);
    }

    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

  return (
    <motion.div
      variants={itemVariants}
      layout
      className={cn(
        "group relative flex items-start gap-4 p-5 rounded-2xl transition-all duration-300",
        "border border-white/5 hover:border-cyan-500/20",
        notification.isRead
          ? "bg-slate-800/30 hover:bg-slate-800/50"
          : "bg-slate-800/60 hover:bg-slate-800/80 shadow-lg shadow-cyan-500/5",
        isSelected && "ring-2 ring-cyan-500/50 bg-cyan-500/10",
        notification.actionUrl && "cursor-pointer"
      )}
      onClick={handleClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      {/* Selection Checkbox */}
      <AnimatePresence>
        {selectionMode && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onSelect(notification.id)}
              className="data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500 border-slate-600"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unread Indicator */}
      {!notification.isRead && !selectionMode && (
        <motion.div
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 rounded-r-full bg-gradient-to-b from-cyan-400 to-teal-400"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ type: "spring", stiffness: 300 }}
        />
      )}

      {/* Icon */}
      <motion.div
        className={cn(
          "relative w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden",
          config.bg
        )}
        whileHover={{ scale: 1.1, rotate: 5 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <div className={cn("absolute inset-0 opacity-50 bg-gradient-to-br", config.gradient)} />
        {notification.icon ? (
          <span className="text-2xl relative z-10">{notification.icon}</span>
        ) : (
          <Icon className={cn("w-6 h-6 relative z-10", config.color)} />
        )}
      </motion.div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h4
            className={cn(
              "text-sm font-semibold line-clamp-1 transition-colors",
              !notification.isRead ? "text-white" : "text-slate-300"
            )}
          >
            {notification.title}
          </h4>
          <div className="flex items-center gap-2 flex-shrink-0">
            {notification.priority !== "normal" && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide",
                  priorityConfig.bg,
                  priorityConfig.color
                )}
              >
                {priorityConfig.label}
              </motion.span>
            )}
          </div>
        </div>

        <p
          className={cn(
            "text-sm line-clamp-2 mb-3 leading-relaxed",
            !notification.isRead ? "text-slate-300" : "text-slate-400"
          )}
        >
          {notification.message}
        </p>

        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-500 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {formatNotificationDate(notification.createdAt)}
          </span>

          {notification.actionUrl && notification.actionLabel && (
            <motion.span
              className="text-xs text-cyan-400 font-medium flex items-center gap-1 group-hover:gap-2 transition-all"
              whileHover={{ x: 2 }}
            >
              {notification.actionLabel}
              <Zap className="w-3 h-3" />
            </motion.span>
          )}
        </div>
      </div>

      {/* Actions Menu */}
      {!selectionMode && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="w-4 h-4 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-slate-800 border-slate-700">
            {notification.isRead ? (
              <DropdownMenuItem
                onClick={() => onMarkUnread(notification.id)}
                className="text-slate-300 focus:text-white focus:bg-slate-700"
              >
                <Circle className="w-4 h-4 mr-2" />
                Mark as unread
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => onMarkRead(notification.id)}
                className="text-slate-300 focus:text-white focus:bg-slate-700"
              >
                <Check className="w-4 h-4 mr-2" />
                Mark as read
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-slate-700" />
            {notification.isArchived ? (
              <DropdownMenuItem
                onClick={() => onUnarchive(notification.id)}
                className="text-slate-300 focus:text-white focus:bg-slate-700"
              >
                <ArchiveRestore className="w-4 h-4 mr-2" />
                Unarchive
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => onArchive(notification.id)}
                className="text-slate-300 focus:text-white focus:bg-slate-700"
              >
                <Archive className="w-4 h-4 mr-2" />
                Archive
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator className="bg-slate-700" />
            <DropdownMenuItem
              onClick={() => onDelete(notification.id)}
              className="text-red-400 focus:text-red-300 focus:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </motion.div>
  );
}

// Stats Card Component
function StatsCard({
  label,
  value,
  icon: Icon,
  gradient,
  isActive,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  isActive?: boolean;
  onClick?: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      className={cn(
        "relative p-4 rounded-2xl border transition-all duration-300 text-left w-full",
        "bg-slate-800/50 hover:bg-slate-800/70",
        isActive
          ? "border-cyan-500/50 ring-2 ring-cyan-500/20"
          : "border-white/5 hover:border-white/10"
      )}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">
          {label}
        </span>
        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br", gradient)}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      <motion.p
        className="text-3xl font-bold text-white"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        key={value}
      >
        {value}
      </motion.p>
    </motion.button>
  );
}

export default function NotificationsPageContent() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const ITEMS_PER_PAGE = 20;

  const [activeTab, setActiveTab] = useState<"all" | "unread" | "archived">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | "selected" | null>(null);

  // Fetch notifications with pagination
  const fetchNotifications = useCallback(async (showRefreshing = false, page = currentPage) => {
    if (showRefreshing) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      // Build query params
      const params: Record<string, string> = {
        page: page.toString(),
        limit: ITEMS_PER_PAGE.toString(),
        isArchived: activeTab === "archived" ? "true" : "false",
      };

      // Add filters
      if (activeTab === "unread") {
        params.isRead = "false";
      }

      if (typeFilter !== "all") {
        params.type = typeFilter;
      }

      if (priorityFilter !== "all") {
        params.priority = priorityFilter;
      }

      // Fetch notifications and stats in parallel
      const [notifResponse, statsResponse] = await Promise.all([
        api.get<Notification[]>("/notifications", { params }),
        api.get<NotificationStats>("/notifications/stats"),
      ]);

      if (notifResponse.success && notifResponse.data) {
        setNotifications(Array.isArray(notifResponse.data) ? notifResponse.data : []);
        
        // Extract pagination metadata from response
        if (notifResponse.meta) {
          setTotalPages(notifResponse.meta.totalPages || 1);
          setTotal(notifResponse.meta.total || 0);
        } else {
          // Fallback: calculate from data length
          const dataLength = Array.isArray(notifResponse.data) ? notifResponse.data.length : 0;
          setTotalPages(Math.max(1, Math.ceil(dataLength / ITEMS_PER_PAGE)));
          setTotal(dataLength);
        }
      }

      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      toast.error("Failed to load notifications");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentPage, activeTab, typeFilter, priorityFilter, ITEMS_PER_PAGE]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, typeFilter, priorityFilter, searchQuery]);

  useEffect(() => {
    if (user) {
      fetchNotifications(false, currentPage);
    }
  }, [user, currentPage, fetchNotifications]);

  // Real-time socket updates
  useEffect(() => {
    if (!user) return;

    const socket = initSocket();
    if (!socket) return;

    const unsubscribe = subscribeToNotificationEvents({
      onNew: (data: NotificationEvent) => {
        // If on page 1 and not in archived tab, prepend the new notification
        if (currentPage === 1 && activeTab !== "archived") {
          const newNotification: Notification = {
            id: data.id,
            type: data.type,
            title: data.title,
            message: data.message,
            priority: (data.priority as Notification["priority"]) || "normal",
            icon: data.icon,
            actionUrl: data.actionUrl,
            isRead: false,
            isArchived: false,
            createdAt: data.createdAt,
            updatedAt: data.createdAt,
          };
          setNotifications((prev) => [newNotification, ...prev]);
          setTotal((prev) => prev + 1);
        }
        // Update stats
        setStats((prev) =>
          prev
            ? { ...prev, total: prev.total + 1, unread: prev.unread + 1 }
            : prev
        );
      },
      onCount: (data) => {
        setStats((prev) =>
          prev ? { ...prev, unread: data.unreadCount } : prev
        );
      },
    });

    return () => {
      unsubscribe();
    };
  }, [user, currentPage, activeTab]);

  // Filtered notifications (backend handles most filtering, only client-side search)
  const filteredNotifications = useMemo(() => {
    let result = notifications;

    // Only apply client-side search filter (backend handles tab, type, priority)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(query) ||
          n.message.toLowerCase().includes(query)
      );
    }

    // Sort by date descending (backend already sorts, but keep for consistency)
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications, activeTab, typeFilter, priorityFilter, searchQuery]);

  // Handlers
  const handleMarkRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
        )
      );
      setStats((prev) =>
        prev ? { ...prev, unread: Math.max(0, prev.unread - 1), read: prev.read + 1 } : prev
      );
    } catch (_error) {
      toast.error("Failed to mark as read");
    }
  };

  const handleMarkUnread = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/unread`);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, isRead: false, readAt: undefined } : n
        )
      );
      setStats((prev) =>
        prev ? { ...prev, unread: prev.unread + 1, read: Math.max(0, prev.read - 1) } : prev
      );
    } catch (_error) {
      toast.error("Failed to mark as unread");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post("/notifications/mark-all-read");
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      );
      setStats((prev) =>
        prev
          ? { ...prev, unread: 0, read: prev.total - prev.archived }
          : prev
      );
      toast.success("All notifications marked as read");
    } catch (_error) {
      toast.error("Failed to mark all as read");
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/archive`);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id
            ? { ...n, isArchived: true, archivedAt: new Date().toISOString() }
            : n
        )
      );
      setStats((prev) =>
        prev ? { ...prev, archived: prev.archived + 1 } : prev
      );
      toast.success("Notification archived");
    } catch (_error) {
      toast.error("Failed to archive");
    }
  };

  const handleUnarchive = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/unarchive`);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, isArchived: false, archivedAt: undefined } : n
        )
      );
      setStats((prev) =>
        prev ? { ...prev, archived: Math.max(0, prev.archived - 1) } : prev
      );
      toast.success("Notification restored");
    } catch (_error) {
      toast.error("Failed to restore");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setStats((prev) =>
        prev ? { ...prev, total: Math.max(0, prev.total - 1) } : prev
      );
      toast.success("Notification deleted");
    } catch (_error) {
      toast.error("Failed to delete");
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;

    try {
      await api.post("/notifications/delete-multiple", {
        notificationIds: Array.from(selectedIds),
      });
      const deletedCount = selectedIds.size;
      setNotifications((prev) =>
        prev.filter((n) => !selectedIds.has(n.id))
      );
      setStats((prev) =>
        prev ? { ...prev, total: Math.max(0, prev.total - deletedCount) } : prev
      );
      setSelectedIds(new Set());
      setSelectionMode(false);
      toast.success(`${deletedCount} notifications deleted`);
    } catch (_error) {
      toast.error("Failed to delete notifications");
    }
  };

  const handleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredNotifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredNotifications.map((n) => n.id)));
    }
  };

  const confirmDelete = () => {
    if (deleteTarget === "selected") {
      handleDeleteSelected();
    } else if (deleteTarget) {
      handleDelete(deleteTarget);
    }
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  // Get unique types for filter
  const uniqueTypes = useMemo(() => {
    const types = new Set(notifications.map((n) => n.type));
    return Array.from(types);
  }, [notifications]);

  if (authLoading || (!user && isLoading)) {
    return (
      <DashboardLayout activeTab="goals">
        <div className="min-h-screen bg-[#0a0a0f]">
          <div className="container mx-auto px-4 py-8 max-w-4xl">
            <Skeleton className="h-12 w-64 mb-8 bg-slate-800" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 rounded-2xl bg-slate-800" />
              ))}
            </div>
            <NotificationSkeleton />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return (
      <DashboardLayout activeTab="goals">
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-6"
          >
            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
              <BellOff className="w-10 h-10 text-slate-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white mb-2">Sign in required</h2>
              <p className="text-slate-400 mb-6">
                Please sign in to view your notifications.
              </p>
            </div>
            <Button asChild className="bg-cyan-500 hover:bg-cyan-600">
              <Link href="/auth/signin">Sign In</Link>
            </Button>
          </motion.div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout activeTab="goals">
      <div className="min-h-screen bg-[#0a0a0f]">
        {/* Animated Background */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-gradient-to-br from-cyan-500/8 to-purple-500/8 rounded-full blur-3xl" />
          <div className="absolute top-1/3 -left-40 w-[400px] h-[400px] bg-gradient-to-br from-blue-500/8 to-teal-500/8 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/3 w-[300px] h-[300px] bg-gradient-to-br from-purple-500/8 to-pink-500/8 rounded-full blur-3xl" />
        </div>

        <div className="relative container mx-auto px-4 py-8 max-w-8xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-8"
          >
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.back()}
                className="rounded-xl hover:bg-white/5 text-slate-400 hover:text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                    <Bell className="w-5 h-5 text-white" />
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold text-white">
                    Notifications
                  </h1>
                  {stats && stats.unread > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-400 text-sm font-medium"
                    >
                      {stats.unread} new
                    </motion.span>
                  )}
                </div>
                <p className="text-sm text-slate-400">
                  Stay updated with your health journey
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <motion.button
                onClick={() => fetchNotifications(true)}
                disabled={isRefreshing}
                className="p-2.5 rounded-xl bg-slate-800/50 border border-white/5 text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <RefreshCw
                  className={cn("w-4 h-4", isRefreshing && "animate-spin")}
                />
              </motion.button>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link
                  href="/settings"
                  className="p-2.5 rounded-xl bg-slate-800/50 border border-white/5 text-slate-400 hover:text-white hover:bg-slate-800 transition-all flex items-center justify-center"
                >
                  <Settings className="w-4 h-4" />
                </Link>
              </motion.div>
            </div>
          </motion.div>

          {/* Stats Cards */}
          {stats && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
            >
              <StatsCard
                label="Total"
                value={stats.total}
                icon={Inbox}
                gradient="from-slate-500 to-zinc-600"
                isActive={activeTab === "all"}
                onClick={() => setActiveTab("all")}
              />
              <StatsCard
                label="Unread"
                value={stats.unread}
                icon={Bell}
                gradient="from-cyan-500 to-teal-500"
                isActive={activeTab === "unread"}
                onClick={() => setActiveTab("unread")}
              />
              <StatsCard
                label="Read"
                value={stats.read}
                icon={CheckCircle2}
                gradient="from-emerald-500 to-green-500"
              />
              <StatsCard
                label="Archived"
                value={stats.archived}
                icon={Archive}
                gradient="from-orange-500 to-amber-500"
                isActive={activeTab === "archived"}
                onClick={() => setActiveTab("archived")}
              />
            </motion.div>
          )}

          {/* Tab Pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex items-center gap-2 mb-6"
          >
            {(["all", "unread", "archived"] as const).map((tab) => (
              <motion.button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                  activeTab === tab
                    ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/30"
                    : "bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-800"
                )}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === "unread" && stats && stats.unread > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 rounded-md bg-white/20 text-xs">
                    {stats.unread}
                  </span>
                )}
              </motion.button>
            ))}
          </motion.div>

          {/* Search and Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-3 mb-6"
          >
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-11 h-11 bg-slate-800/50 border-white/5 rounded-xl text-white placeholder:text-slate-500 focus:border-cyan-500/50 focus:ring-cyan-500/20"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 text-slate-400 hover:text-white"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px] h-11 bg-slate-800/50 border-white/5 rounded-xl text-slate-300">
                  <Filter className="w-4 h-4 mr-2 text-slate-500" />
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all" className="text-slate-300">All Types</SelectItem>
                  {uniqueTypes.map((type) => (
                    <SelectItem key={type} value={type} className="capitalize text-slate-300">
                      {type.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[140px] h-11 bg-slate-800/50 border-white/5 rounded-xl text-slate-300">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="all" className="text-slate-300">All Priority</SelectItem>
                  <SelectItem value="urgent" className="text-red-400">Urgent</SelectItem>
                  <SelectItem value="high" className="text-orange-400">High</SelectItem>
                  <SelectItem value="normal" className="text-blue-400">Normal</SelectItem>
                  <SelectItem value="low" className="text-slate-400">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </motion.div>

          {/* Bulk Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="flex items-center justify-between mb-6"
          >
            <div className="flex items-center gap-2">
              <motion.button
                onClick={() => {
                  setSelectionMode(!selectionMode);
                  setSelectedIds(new Set());
                }}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2",
                  selectionMode
                    ? "bg-cyan-500 text-white"
                    : "bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-800 border border-white/5"
                )}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {selectionMode ? (
                  <>
                    <X className="w-4 h-4" />
                    Cancel
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Select
                  </>
                )}
              </motion.button>

              <AnimatePresence>
                {selectionMode && (
                  <>
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      onClick={handleSelectAll}
                      className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-800 border border-white/5 transition-all"
                    >
                      {selectedIds.size === filteredNotifications.length
                        ? "Deselect All"
                        : "Select All"}
                    </motion.button>

                    {selectedIds.size > 0 && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        onClick={() => {
                          setDeleteTarget("selected");
                          setDeleteDialogOpen(true);
                        }}
                        className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 transition-all flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete ({selectedIds.size})
                      </motion.button>
                    )}
                  </>
                )}
              </AnimatePresence>
            </div>

            {stats && stats.unread > 0 && !selectionMode && (
              <motion.button
                onClick={handleMarkAllRead}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-800 border border-white/5 transition-all flex items-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <CheckCheck className="w-4 h-4" />
                Mark all read
              </motion.button>
            )}
          </motion.div>

          {/* Notifications List */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {isLoading ? (
              <NotificationSkeleton />
            ) : filteredNotifications.length === 0 ? (
              <EmptyState type={activeTab} searchQuery={searchQuery} />
            ) : (
              <>
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="space-y-3"
                >
                  <AnimatePresence mode="popLayout">
                    {filteredNotifications.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        isSelected={selectedIds.has(notification.id)}
                        onSelect={handleSelect}
                        onMarkRead={handleMarkRead}
                        onMarkUnread={handleMarkUnread}
                        onArchive={handleArchive}
                        onUnarchive={handleUnarchive}
                        onDelete={(id) => {
                          setDeleteTarget(id);
                          setDeleteDialogOpen(true);
                        }}
                        selectionMode={selectionMode}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                    className="flex items-center justify-between mt-6 pt-6 border-t border-white/10"
                  >
                    <div className="text-sm text-slate-400">
                      Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, total)} of {total} notifications
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1 || isLoading}
                        className="bg-slate-800/50 border-white/10 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-50"
                      >
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum: number;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(pageNum)}
                              disabled={isLoading}
                              className={cn(
                                "min-w-[40px]",
                                currentPage === pageNum
                                  ? "bg-cyan-500 text-white hover:bg-cyan-600"
                                  : "bg-slate-800/50 border-white/10 text-slate-300 hover:bg-slate-800 hover:text-white"
                              )}
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages || isLoading}
                        className="bg-slate-800/50 border-white/10 text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-50"
                      >
                        Next
                        <ArrowLeft className="w-4 h-4 ml-1 rotate-180" />
                      </Button>
                    </div>
                  </motion.div>
                )}
              </>
            )}
          </motion.div>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="bg-slate-900 border-slate-800">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">Delete Notification(s)</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-400">
                {deleteTarget === "selected"
                  ? `Are you sure you want to delete ${selectedIds.size} notification(s)? This action cannot be undone.`
                  : "Are you sure you want to delete this notification? This action cannot be undone."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-red-500 text-white hover:bg-red-600"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
