"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api-client";
import { initSocket, subscribeToUnreadCountUpdates } from "@/lib/socket-client";
import { useAuth } from "@/app/context/AuthContext";

interface UnreadCountResponse {
  unreadCount: number;
}

/**
 * Hook to track total unread message count across all chats
 * Updates in real-time via WebSocket when messages arrive or are read
 */
export function useUnreadCount() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user, isAuthenticated } = useAuth();

  // Fetch initial unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await api.get<UnreadCountResponse>("/chats/unread-count");
      setUnreadCount(response.data?.unreadCount ?? 0);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch unread count:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch unread count"));
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Initialize socket and subscribe to updates
  useEffect(() => {
    if (!isAuthenticated || !user) {
      return;
    }

    // Fetch initial count
    fetchUnreadCount();

    // Initialize socket connection
    const socket = initSocket();
    if (!socket) {
      return;
    }

    // Subscribe to unread count updates via socket (real-time)
    const unsubscribe = subscribeToUnreadCountUpdates((data) => {
      setUnreadCount(data.totalUnread);
    });

    return () => {
      unsubscribe();
    };
  }, [isAuthenticated, user, fetchUnreadCount]);

  return {
    unreadCount,
    isLoading,
    error,
    refetch: fetchUnreadCount,
  };
}
