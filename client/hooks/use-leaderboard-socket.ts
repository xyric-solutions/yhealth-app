'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { initSocket } from '@/lib/socket-client';
import { toast } from 'sonner';
import type { Socket } from 'socket.io-client';

interface RankUpdateData {
  user_id: string;
  rank: number;
  previous_rank?: number;
  total_score: number;
  board_type: 'global' | 'country' | 'friends' | 'competition';
  competition_id?: string;
}

interface ScoreUpdateData {
  user_id: string;
  date: string;
  total_score: number;
  component_scores: {
    workout: number;
    nutrition: number;
    wellbeing: number;
    biometrics: number;
    engagement: number;
    consistency: number;
  };
}

interface CompetitionRankUpdateData {
  competition_id: string;
  user_id: string;
  rank: number;
  previous_rank?: number;
  current_score: number;
}

interface UseLeaderboardSocketOptions {
  userId?: string;
  onRankUpdate?: (data: RankUpdateData) => void;
  onScoreUpdate?: (data: ScoreUpdateData) => void;
  onCompetitionRankUpdate?: (data: CompetitionRankUpdateData) => void;
  enabled?: boolean;
}

interface UseLeaderboardSocketReturn {
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
}

export function useLeaderboardSocket({
  userId,
  onRankUpdate,
  onScoreUpdate,
  onCompetitionRankUpdate,
  enabled = true,
}: UseLeaderboardSocketOptions = {}): UseLeaderboardSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef({ onRankUpdate, onScoreUpdate, onCompetitionRankUpdate });

  // Update handlers ref when they change
  useEffect(() => {
    handlersRef.current = { onRankUpdate, onScoreUpdate, onCompetitionRankUpdate };
  }, [onRankUpdate, onScoreUpdate, onCompetitionRankUpdate]);

  // Handle rank update with notification
  const handleRankUpdate = useCallback((data: RankUpdateData) => {
    // Only show notification for current user
    if (userId && data.user_id === userId) {
      const rankChange = data.previous_rank 
        ? data.previous_rank - data.rank 
        : null;
      
      if (rankChange && rankChange > 0) {
        toast.success(`🎉 You moved up ${rankChange} rank${rankChange > 1 ? 's' : ''}!`, {
          description: `You're now ranked #${data.rank} on the ${data.board_type} leaderboard`,
        });
      } else if (rankChange && rankChange < 0) {
        toast.info(`Rank update: You're now #${data.rank}`, {
          description: `You moved ${Math.abs(rankChange)} rank${Math.abs(rankChange) > 1 ? 's' : ''} down`,
        });
      }
    }

    handlersRef.current.onRankUpdate?.(data);
  }, [userId]);

  // Handle score update
  const handleScoreUpdate = useCallback((data: ScoreUpdateData) => {
    if (userId && data.user_id === userId) {
      toast.success('Your daily score has been updated!', {
        description: `New score: ${Number(data.total_score).toFixed(1)}/100`,
      });
    }

    handlersRef.current.onScoreUpdate?.(data);
  }, [userId]);

  // Handle competition rank update
  const handleCompetitionRankUpdate = useCallback((data: CompetitionRankUpdateData) => {
    if (userId && data.user_id === userId) {
      const rankChange = data.previous_rank 
        ? data.previous_rank - data.rank 
        : null;
      
      if (rankChange && rankChange > 0) {
        toast.success(`🏆 Competition rank up!`, {
          description: `You moved up ${rankChange} rank${rankChange > 1 ? 's' : ''} to #${data.rank}`,
        });
      }
    }

    handlersRef.current.onCompetitionRankUpdate?.(data);
  }, [userId]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Initialize socket
    const socket = initSocket();
    if (!socket) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConnectionStatus('error');
      return;
    }

    socketRef.current = socket;
    setConnectionStatus('connecting');

    // Connection handlers — called asynchronously by socket events
    const handleConnect = () => {
      setIsConnected(true);
      setConnectionStatus('connected');
      console.log('[LeaderboardSocket] Connected');
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      setConnectionStatus('disconnected');
      console.log('[LeaderboardSocket] Disconnected');
    };

    const handleConnectError = (error: Error) => {
      setConnectionStatus('error');
      console.error('[LeaderboardSocket] Connection error:', error);
    };

    // Event handlers
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    // Leaderboard events
    socket.on('leaderboard:rank-update', handleRankUpdate);
    socket.on('score:updated', handleScoreUpdate);
    socket.on('competition:rank-update', handleCompetitionRankUpdate);

    // Set connected state if already connected
    if (socket.connected) {
      handleConnect();
    }

    // Cleanup
    return () => {
      if (socket) {
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        socket.off('connect_error', handleConnectError);
        socket.off('leaderboard:rank-update', handleRankUpdate);
        socket.off('score:updated', handleScoreUpdate);
        socket.off('competition:rank-update', handleCompetitionRankUpdate);
      }
    };
  }, [enabled, handleRankUpdate, handleScoreUpdate, handleCompetitionRankUpdate]);

  return {
    isConnected,
    connectionStatus,
  };
}

