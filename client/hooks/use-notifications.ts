"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api-client";
import {
  initSocket,
  subscribeToNotificationEvents,
  type NotificationEvent,
  type NotificationCountEvent,
} from "@/lib/socket-client";
import { useAuth } from "@/app/context/AuthContext";
import toast from "react-hot-toast";

const MAX_RECENT = 8;

/**
 * Hook to track notification counts and recent notifications in real-time.
 * Updates via Socket.IO when notifications arrive or counts change.
 */
export function useNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [urgentCount, setUrgentCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState<
    NotificationEvent[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();
  const toastHandlerRef = useRef<((n: NotificationEvent) => void) | null>(null);

  // Allow external registration of a toast handler (set by NotificationDropdown)
  const setToastHandler = useCallback(
    (handler: (n: NotificationEvent) => void) => {
      toastHandlerRef.current = handler;
    },
    []
  );

  // Fetch initial counts
  const fetchCounts = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      setUrgentCount(0);
      return;
    }
    try {
      const response = await api.get<{
        unreadCount: number;
        urgentCount: number;
        highCount: number;
      }>("/notifications/unread-count");
      setUnreadCount(response.data?.unreadCount ?? 0);
      setUrgentCount(response.data?.urgentCount ?? 0);
    } catch {
      // Silently fail — counts will update via socket
    }
  }, [isAuthenticated]);

  // Fetch recent notifications for dropdown
  const fetchRecent = useCallback(async () => {
    if (!isAuthenticated) {
      setRecentNotifications([]);
      return;
    }
    try {
      setIsLoading(true);
      const response = await api.get<NotificationEvent[]>("/notifications", {
        params: { limit: MAX_RECENT.toString(), sort_order: "desc" },
      });
      const items = Array.isArray(response.data) ? response.data : [];
      setRecentNotifications(
        items.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          priority: n.priority,
          icon: n.icon,
          actionUrl: n.actionUrl,
          createdAt: n.createdAt,
        }))
      );
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Mark single notification as read
  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!isAuthenticated) return;
      try {
        await api.patch(`/notifications/${notificationId}/read`);
        setRecentNotifications((prev) =>
          prev.filter((n) => n.id !== notificationId)
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // Silently fail
      }
    },
    [isAuthenticated]
  );

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      await api.post("/notifications/mark-all-read");
      setRecentNotifications([]);
      setUnreadCount(0);
      setUrgentCount(0);
    } catch {
      // Silently fail
    }
  }, [isAuthenticated]);

  // Socket subscription + initial fetch
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    fetchCounts();
    fetchRecent();

    const socket = initSocket();
    if (!socket) return;

    const unsubscribe = subscribeToNotificationEvents({
      onNew: (data: NotificationEvent) => {
        // Prepend to recent (cap at MAX_RECENT)
        setRecentNotifications((prev) => [data, ...prev].slice(0, MAX_RECENT));
        setUnreadCount((prev) => prev + 1);
        if (data.priority === "urgent") {
          setUrgentCount((prev) => prev + 1);
        }

        // Show toast notification
        if (toastHandlerRef.current) {
          toastHandlerRef.current(data);
        } else {
          // Default toast fallback
          toast(data.title, {
            duration: 5000,
            icon: "🔔",
          });
        }
      },
      onCount: (data: NotificationCountEvent) => {
        setUnreadCount(data.unreadCount);
        setUrgentCount(data.urgentCount);
      },
    });

    // Refetch on tab focus
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchCounts();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isAuthenticated, user, fetchCounts, fetchRecent]);

  return {
    unreadCount,
    urgentCount,
    recentNotifications,
    isLoading,
    markAsRead,
    markAllAsRead,
    refetch: fetchRecent,
    setToastHandler,
  };
}
