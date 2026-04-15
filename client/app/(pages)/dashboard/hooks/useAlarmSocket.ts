'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import type { AlarmModalData } from '../components/alarms/AlarmModal';
import { api } from '@/lib/api-client';
import { env } from '@/config/env';

/**
 * Get Socket.IO server URL from API URL
 */
function getSocketUrl(): string {
  const apiUrl = env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
  // Remove /api suffix and use the base URL for Socket.IO
  const baseUrl = apiUrl.replace(/\/api$/, '');
  return baseUrl;
}

function getToken(): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; balencia_access_token=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}

interface UseAlarmSocketReturn {
  isConnected: boolean;
  activeAlarm: AlarmModalData | null;
  dismissAlarm: () => void;
  snoozeAlarm: (alarmId: string, snoozeMinutes: number) => Promise<void>;
}

export function useAlarmSocket(
  _onNavigateToWorkout?: (workoutPlanId: string) => void
): UseAlarmSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [activeAlarm, setActiveAlarm] = useState<AlarmModalData | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(async () => {
    if (socketRef.current?.connected) {
      return; // Already connected
    }

    // Only run on client side
    if (typeof window === 'undefined') {
      return;
    }

    const token = getToken();
    if (!token) {
      console.warn('[AlarmSocket] No token found, skipping connection');
      console.warn('[AlarmSocket] Available cookies:', document.cookie);
      return;
    }

    const socketUrl = getSocketUrl();
    console.log('[AlarmSocket] Attempting to connect...', {
      socketUrl,
      apiUrl: env.NEXT_PUBLIC_API_URL,
      hasToken: !!token,
      tokenPreview: token.substring(0, 20) + '...',
    });

    // Disconnect existing socket if any
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    // Dynamically import socket.io-client only on client side
    const { io } = await import('socket.io-client');

    // Create new socket connection
    const socket = io(socketUrl, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 20000, // 20 second timeout
      forceNew: true, // Force a new connection
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[AlarmSocket] ✅ Connected to server', {
        socketUrl,
        socketId: socket.id,
        transport: socket.io.engine?.transport?.name,
      });
      setIsConnected(true);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    });

    socket.on('disconnect', (reason) => {
      console.warn('[AlarmSocket] ❌ Disconnected', {
        reason,
        socketId: socket.id,
        willReconnect: reason !== 'io client disconnect',
      });
      setIsConnected(false);

      // Attempt reconnection after a delay if not manually disconnected
      if (reason !== 'io client disconnect') {
        console.log('[AlarmSocket] Scheduling reconnection in 5 seconds...');
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[AlarmSocket] Attempting reconnection...');
          connect();
        }, 5000);
      }
    });

    socket.on('connected', (data) => {
      console.log('[AlarmSocket] ✅ Server confirmed connection', {
        socketId: data.socketId,
        userId: data.userId,
        connectedAt: data.connectedAt,
      });
      setIsConnected(true);
    });
    
    // Handle authentication errors specifically
    socket.on('unauthorized', (error) => {
      console.error('[AlarmSocket] ❌ Unauthorized', {
        error,
        message: 'Token may be invalid or expired',
      });
      setIsConnected(false);
    });

    socket.on('alarm:triggered', (data: AlarmModalData) => {
      try {
        console.log('[AlarmSocket] Alarm triggered event received:', data);
        
        // Validate alarm data
        if (!data || !data.alarmId || !data.title) {
          console.error('[AlarmSocket] Invalid alarm data received', { data });
          return;
        }
        
        console.log('[AlarmSocket] Setting activeAlarm to:', data);
        setActiveAlarm(data);
        
        // Log state change for debugging
        setTimeout(() => {
          console.log('[AlarmSocket] Active alarm state after set:', data);
        }, 100);
      } catch (error) {
        console.error('[AlarmSocket] Error handling alarm:triggered event', {
          error: error instanceof Error ? error.message : 'Unknown error',
          data,
        });
      }
    });

    socket.on('error', (error: Error) => {
      console.error('[AlarmSocket] ⚠️ Socket error', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
        socketId: socket.id,
      });
    });

    socket.on('connect_error', (error: Error & { type?: string; description?: string; context?: unknown }) => {
      console.error('[AlarmSocket] ⚠️ Connection error', {
        message: error?.message || 'Unknown error',
        type: error?.type || 'unknown',
        description: error?.description || 'No description',
        name: error?.name || 'Error',
        stack: error?.stack || 'No stack trace',
        url: socketUrl,
        hasToken: !!token,
        tokenLength: token?.length || 0,
      });
      
      // Don't set disconnected state on connect_error - let it retry
      // Socket.IO will automatically attempt reconnection
    });
  }, []);

  const dismissAlarm = useCallback(async () => {
    if (!activeAlarm) {
      console.warn('[AlarmSocket] No active alarm to dismiss');
      return;
    }

    const alarmId = activeAlarm.alarmId;
    console.log('[AlarmSocket] Dismissing alarm:', alarmId);

    try {
      // Call dismiss endpoint to update nextTriggerAt on server
      await api.patch(`/alarms/${alarmId}/dismiss`);
      console.log('[AlarmSocket] Alarm dismissed successfully on server');
    } catch (error) {
      console.error('[AlarmSocket] Failed to dismiss alarm on server:', error);
      // Still dismiss the modal even if API call fails
    } finally {
      // Always close the modal
      setActiveAlarm(null);
    }
  }, [activeAlarm]);

  const snoozeAlarm = useCallback(async (alarmId: string, snoozeMinutes: number) => {
    try {
      // Call snooze endpoint
      await api.patch(`/alarms/${alarmId}/snooze`, {
        minutes: snoozeMinutes,
      });

      setActiveAlarm(null);
    } catch (error) {
      console.error('[AlarmSocket] Failed to snooze alarm:', error);
      // Still dismiss the modal even if API call fails
      setActiveAlarm(null);
    }
  }, []);

  useEffect(() => {
    // Only initialize on client side
    if (typeof window === 'undefined') {
      return;
    }

    // Initialize connection on mount
    connect().catch((error) => {
      console.error('[AlarmSocket] Failed to connect:', error);
    });

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [connect]);

  return {
    isConnected,
    activeAlarm,
    dismissAlarm,
    snoozeAlarm,
  };
}

