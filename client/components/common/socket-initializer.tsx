'use client';

import { useEffect } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { initSocket, disconnectSocket } from '@/lib/socket-client';

/**
 * Socket Initializer Component
 * Initializes WebSocket connection when user is authenticated
 */
export function SocketInitializer() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // Only initialize socket when user is authenticated and not loading
    if (!isLoading && isAuthenticated) {
      console.log('[SocketInitializer] User authenticated, initializing socket...');
      const socket = initSocket();

      if (!socket) {
        console.warn('[SocketInitializer] Socket initialization failed');
      }

      // Cleanup on unmount
      return () => {
        console.log('[SocketInitializer] Cleaning up socket connection');
        disconnectSocket();
      };
    } else if (!isLoading && !isAuthenticated) {
      // Disconnect socket if user logs out
      console.log('[SocketInitializer] User not authenticated, disconnecting socket');
      disconnectSocket();
    }
  }, [isAuthenticated, isLoading]);

  return null; // This component doesn't render anything
}

