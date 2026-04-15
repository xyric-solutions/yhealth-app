"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, CheckCheck, Sparkles, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/use-notifications";
import {
  NotificationToast,
  NOTIFICATION_CONFIG,
  PRIORITY_BORDER,
} from "./NotificationToast";
import type { NotificationEvent } from "@/lib/socket-client";

// Relative time helper
function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const {
    unreadCount,
    urgentCount,
    recentNotifications,
    isLoading,
    markAsRead,
    markAllAsRead,
    setToastHandler,
  } = useNotifications();

  // Register toast handler to show NotificationToast
  useEffect(() => {
    setToastHandler((notification: NotificationEvent) => {
      toast.custom(
        (t) => (
          <NotificationToast
            notification={notification}
            onDismiss={() => toast.dismiss(t.id)}
            onClick={() => {
              toast.dismiss(t.id);
              if (notification.actionUrl) {
                router.push(notification.actionUrl);
              }
            }}
          />
        ),
        { duration: 5000, position: "top-right" }
      );
    });
  }, [setToastHandler, router]);

  const handleNotificationClick = useCallback(
    (notification: NotificationEvent) => {
      markAsRead(notification.id);
      setOpen(false);
      if (notification.actionUrl) {
        router.push(notification.actionUrl);
      }
    },
    [markAsRead, router]
  );

  const handleMarkAllRead = useCallback(() => {
    markAllAsRead();
  }, [markAllAsRead]);

  const displayCount = unreadCount > 99 ? "99+" : unreadCount;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full hover:bg-primary/10 transition-colors"
        >
          <Bell className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />

          {/* Unread badge */}
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                key={unreadCount}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className={`
                  absolute -top-0.5 -right-0.5
                  flex items-center justify-center
                  min-w-[18px] h-[18px] px-1
                  text-[10px] font-bold text-white
                  bg-cyan-500 rounded-full
                  ${urgentCount > 0 ? "ring-2 ring-red-500/60 animate-pulse" : ""}
                `}
              >
                {displayCount}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[400px] p-0 bg-background/95 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/20 rounded-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <h3 className="text-sm font-semibold text-white">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              className="text-xs text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 h-7 px-2"
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {/* List */}
        <ScrollArea className="max-h-[420px]">
          {isLoading ? (
            <div className="p-3 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-3 p-3">
                  <Skeleton className="w-9 h-9 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center mb-3">
                <Sparkles className="w-6 h-6 text-cyan-400" />
              </div>
              <p className="text-sm font-medium text-white">All caught up!</p>
              <p className="text-xs text-slate-500 mt-1">
                No new notifications
              </p>
            </div>
          ) : (
            <div className="py-1">
              <AnimatePresence initial={false}>
                {recentNotifications.map((notification, index) => {
                  const config =
                    NOTIFICATION_CONFIG[notification.type] ||
                    NOTIFICATION_CONFIG.system;
                  const Icon = config.icon;
                  const borderLeft =
                    PRIORITY_BORDER[notification.priority] ||
                    PRIORITY_BORDER.normal;

                  return (
                    <motion.button
                      key={notification.id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => handleNotificationClick(notification)}
                      className={`
                        w-full flex items-start gap-3 px-4 py-3
                        border-l-[3px] ${borderLeft}
                        hover:bg-white/5 transition-colors
                        text-left
                      `}
                    >
                      {/* Icon */}
                      <div
                        className={`flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center`}
                      >
                        <Icon className="w-4 h-4 text-white" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {notification.title}
                        </p>
                        <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                          {notification.message}
                        </p>
                      </div>

                      {/* Time */}
                      <span className="text-[10px] text-slate-500 flex-shrink-0 mt-0.5">
                        {timeAgo(notification.createdAt)}
                      </span>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="border-t border-white/5 px-4 py-2.5">
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1.5 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            View All Notifications
            <ExternalLink className="w-3 h-3" />
            {unreadCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-cyan-500/20 text-cyan-400 rounded-full">
                {displayCount}
              </span>
            )}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
