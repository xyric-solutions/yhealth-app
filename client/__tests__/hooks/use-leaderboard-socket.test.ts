/**
 * @file useLeaderboardSocket hook tests
 *
 * Tests for the leaderboard WebSocket hook covering:
 * - Connection lifecycle (connect, disconnect, error states)
 * - Rank update notifications and callbacks
 * - Score update notifications and callbacks
 * - Competition rank update notifications and callbacks
 * - Cleanup on unmount
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useLeaderboardSocket } from '@/hooks/use-leaderboard-socket';

// ---------------------------------------------------------------------------
// Mock socket-client
// ---------------------------------------------------------------------------
const mockInitSocket = jest.fn();
const mockGetSocket = jest.fn();
jest.mock('@/lib/socket-client', () => ({
  initSocket: (...args: unknown[]) => mockInitSocket(...args),
  getSocket: (...args: unknown[]) => mockGetSocket(...args),
}));

// ---------------------------------------------------------------------------
// Mock sonner toast
// ---------------------------------------------------------------------------
const mockToastSuccess = jest.fn();
const mockToastInfo = jest.fn();
jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    info: (...args: unknown[]) => mockToastInfo(...args),
  },
}));

// ---------------------------------------------------------------------------
// Mock socket helper
// ---------------------------------------------------------------------------
type EventHandler = (...args: unknown[]) => void;
type ListenerMap = Map<string, Set<EventHandler>>;

function createMockSocket(connected = false) {
  const listeners: ListenerMap = new Map();
  return {
    connected,
    on: jest.fn((event: string, handler: EventHandler) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);
    }),
    off: jest.fn((event: string, handler: EventHandler) => {
      listeners.get(event)?.delete(handler);
    }),
    /** Helper to emit events in tests -- not part of real Socket API */
    emit: (event: string, data?: unknown) => {
      listeners.get(event)?.forEach((fn) => fn(data));
    },
    /** Expose listeners for assertions */
    _listeners: listeners,
  };
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------
const USER_ID = 'user-123';
const OTHER_USER_ID = 'user-456';

function rankUpdateFixture(overrides: Record<string, unknown> = {}) {
  return {
    user_id: USER_ID,
    rank: 5,
    previous_rank: 8,
    total_score: 82.3,
    board_type: 'global' as const,
    ...overrides,
  };
}

function scoreUpdateFixture(overrides: Record<string, unknown> = {}) {
  return {
    user_id: USER_ID,
    date: '2026-02-16',
    total_score: 75.5,
    component_scores: {
      workout: 20,
      nutrition: 18,
      wellbeing: 22,
      participation: 15.5,
    },
    ...overrides,
  };
}

function competitionRankUpdateFixture(overrides: Record<string, unknown> = {}) {
  return {
    competition_id: 'comp-001',
    user_id: USER_ID,
    rank: 3,
    previous_rank: 7,
    current_score: 91.0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('useLeaderboardSocket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Connection lifecycle
  // -------------------------------------------------------------------------
  describe('connection lifecycle', () => {
    it('should return disconnected default state when enabled is false', () => {
      const { result } = renderHook(() =>
        useLeaderboardSocket({ enabled: false })
      );

      expect(result.current.isConnected).toBe(false);
      expect(result.current.connectionStatus).toBe('disconnected');
    });

    it('should NOT call initSocket when enabled is false', () => {
      renderHook(() => useLeaderboardSocket({ enabled: false }));

      expect(mockInitSocket).not.toHaveBeenCalled();
    });

    it('should set connectionStatus to error when initSocket returns null', async () => {
      mockInitSocket.mockReturnValue(null);

      const { result } = renderHook(() =>
        useLeaderboardSocket({ enabled: true })
      );

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('error');
      });
      expect(result.current.isConnected).toBe(false);
    });

    it('should immediately set connected state when socket is already connected', () => {
      const mockSocket = createMockSocket(true);
      mockInitSocket.mockReturnValue(mockSocket);

      const { result } = renderHook(() =>
        useLeaderboardSocket({ enabled: true })
      );

      expect(result.current.isConnected).toBe(true);
      expect(result.current.connectionStatus).toBe('connected');
    });

    it('should update to connected state on socket connect event', async () => {
      const mockSocket = createMockSocket(false);
      mockInitSocket.mockReturnValue(mockSocket);

      const { result } = renderHook(() =>
        useLeaderboardSocket({ enabled: true })
      );

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('connecting');
      });
      expect(result.current.isConnected).toBe(false);

      act(() => {
        mockSocket.emit('connect');
      });

      expect(result.current.isConnected).toBe(true);
      expect(result.current.connectionStatus).toBe('connected');
    });

    it('should update to disconnected state on socket disconnect event', () => {
      const mockSocket = createMockSocket(true);
      mockInitSocket.mockReturnValue(mockSocket);

      const { result } = renderHook(() =>
        useLeaderboardSocket({ enabled: true })
      );

      // Initially connected
      expect(result.current.isConnected).toBe(true);

      act(() => {
        mockSocket.emit('disconnect');
      });

      expect(result.current.isConnected).toBe(false);
      expect(result.current.connectionStatus).toBe('disconnected');
    });

    it('should set connectionStatus to error on connect_error event', () => {
      const mockSocket = createMockSocket(false);
      mockInitSocket.mockReturnValue(mockSocket);

      const { result } = renderHook(() =>
        useLeaderboardSocket({ enabled: true })
      );

      act(() => {
        mockSocket.emit('connect_error', new Error('Connection refused'));
      });

      expect(result.current.connectionStatus).toBe('error');
    });
  });

  // -------------------------------------------------------------------------
  // Rank updates
  // -------------------------------------------------------------------------
  describe('rank updates', () => {
    it('should show success toast and call onRankUpdate when current user ranks up', () => {
      const mockSocket = createMockSocket(false);
      mockInitSocket.mockReturnValue(mockSocket);
      const onRankUpdate = jest.fn();

      renderHook(() =>
        useLeaderboardSocket({
          userId: USER_ID,
          onRankUpdate,
          enabled: true,
        })
      );

      const data = rankUpdateFixture({ rank: 5, previous_rank: 8 });

      act(() => {
        mockSocket.emit('leaderboard:rank-update', data);
      });

      expect(mockToastSuccess).toHaveBeenCalledTimes(1);
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringContaining('moved up 3 ranks'),
        expect.objectContaining({
          description: expect.stringContaining('#5'),
        })
      );
      expect(onRankUpdate).toHaveBeenCalledWith(data);
    });

    it('should show info toast when current user ranks down', () => {
      const mockSocket = createMockSocket(false);
      mockInitSocket.mockReturnValue(mockSocket);
      const onRankUpdate = jest.fn();

      renderHook(() =>
        useLeaderboardSocket({
          userId: USER_ID,
          onRankUpdate,
          enabled: true,
        })
      );

      const data = rankUpdateFixture({ rank: 10, previous_rank: 8 });

      act(() => {
        mockSocket.emit('leaderboard:rank-update', data);
      });

      expect(mockToastInfo).toHaveBeenCalledTimes(1);
      expect(mockToastInfo).toHaveBeenCalledWith(
        expect.stringContaining('#10'),
        expect.objectContaining({
          description: expect.stringContaining('2 ranks'),
        })
      );
      expect(mockToastSuccess).not.toHaveBeenCalled();
      expect(onRankUpdate).toHaveBeenCalledWith(data);
    });

    it('should not show toast for a different user but still call onRankUpdate', () => {
      const mockSocket = createMockSocket(false);
      mockInitSocket.mockReturnValue(mockSocket);
      const onRankUpdate = jest.fn();

      renderHook(() =>
        useLeaderboardSocket({
          userId: USER_ID,
          onRankUpdate,
          enabled: true,
        })
      );

      const data = rankUpdateFixture({ user_id: OTHER_USER_ID });

      act(() => {
        mockSocket.emit('leaderboard:rank-update', data);
      });

      expect(mockToastSuccess).not.toHaveBeenCalled();
      expect(mockToastInfo).not.toHaveBeenCalled();
      expect(onRankUpdate).toHaveBeenCalledWith(data);
    });

    it('should not show toast when previous_rank is missing (rankChange is null)', () => {
      const mockSocket = createMockSocket(false);
      mockInitSocket.mockReturnValue(mockSocket);
      const onRankUpdate = jest.fn();

      renderHook(() =>
        useLeaderboardSocket({
          userId: USER_ID,
          onRankUpdate,
          enabled: true,
        })
      );

      const data = rankUpdateFixture({ previous_rank: undefined });

      act(() => {
        mockSocket.emit('leaderboard:rank-update', data);
      });

      expect(mockToastSuccess).not.toHaveBeenCalled();
      expect(mockToastInfo).not.toHaveBeenCalled();
      expect(onRankUpdate).toHaveBeenCalledWith(data);
    });

    it('should use singular "rank" when moving up by exactly 1', () => {
      const mockSocket = createMockSocket(false);
      mockInitSocket.mockReturnValue(mockSocket);

      renderHook(() =>
        useLeaderboardSocket({
          userId: USER_ID,
          enabled: true,
        })
      );

      const data = rankUpdateFixture({ rank: 4, previous_rank: 5 });

      act(() => {
        mockSocket.emit('leaderboard:rank-update', data);
      });

      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringContaining('1 rank!'),
        expect.any(Object)
      );
    });
  });

  // -------------------------------------------------------------------------
  // Score updates
  // -------------------------------------------------------------------------
  describe('score updates', () => {
    it('should show success toast and call onScoreUpdate for current user', () => {
      const mockSocket = createMockSocket(false);
      mockInitSocket.mockReturnValue(mockSocket);
      const onScoreUpdate = jest.fn();

      renderHook(() =>
        useLeaderboardSocket({
          userId: USER_ID,
          onScoreUpdate,
          enabled: true,
        })
      );

      const data = scoreUpdateFixture({ total_score: 75.5 });

      act(() => {
        mockSocket.emit('score:updated', data);
      });

      expect(mockToastSuccess).toHaveBeenCalledTimes(1);
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Your daily score has been updated!',
        expect.objectContaining({
          description: expect.stringContaining('75.5'),
        })
      );
      expect(onScoreUpdate).toHaveBeenCalledWith(data);
    });

    it('should not show toast for a different user but still call onScoreUpdate', () => {
      const mockSocket = createMockSocket(false);
      mockInitSocket.mockReturnValue(mockSocket);
      const onScoreUpdate = jest.fn();

      renderHook(() =>
        useLeaderboardSocket({
          userId: USER_ID,
          onScoreUpdate,
          enabled: true,
        })
      );

      const data = scoreUpdateFixture({ user_id: OTHER_USER_ID });

      act(() => {
        mockSocket.emit('score:updated', data);
      });

      expect(mockToastSuccess).not.toHaveBeenCalled();
      expect(onScoreUpdate).toHaveBeenCalledWith(data);
    });
  });

  // -------------------------------------------------------------------------
  // Competition rank updates
  // -------------------------------------------------------------------------
  describe('competition rank updates', () => {
    it('should show success toast and call onCompetitionRankUpdate when user ranks up', () => {
      const mockSocket = createMockSocket(false);
      mockInitSocket.mockReturnValue(mockSocket);
      const onCompetitionRankUpdate = jest.fn();

      renderHook(() =>
        useLeaderboardSocket({
          userId: USER_ID,
          onCompetitionRankUpdate,
          enabled: true,
        })
      );

      const data = competitionRankUpdateFixture({ rank: 3, previous_rank: 7 });

      act(() => {
        mockSocket.emit('competition:rank-update', data);
      });

      expect(mockToastSuccess).toHaveBeenCalledTimes(1);
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringContaining('Competition rank up'),
        expect.objectContaining({
          description: expect.stringContaining('4 ranks'),
        })
      );
      expect(onCompetitionRankUpdate).toHaveBeenCalledWith(data);
    });

    it('should not show toast when previous_rank is missing but still call callback', () => {
      const mockSocket = createMockSocket(false);
      mockInitSocket.mockReturnValue(mockSocket);
      const onCompetitionRankUpdate = jest.fn();

      renderHook(() =>
        useLeaderboardSocket({
          userId: USER_ID,
          onCompetitionRankUpdate,
          enabled: true,
        })
      );

      const data = competitionRankUpdateFixture({ previous_rank: undefined });

      act(() => {
        mockSocket.emit('competition:rank-update', data);
      });

      expect(mockToastSuccess).not.toHaveBeenCalled();
      expect(onCompetitionRankUpdate).toHaveBeenCalledWith(data);
    });

    it('should not show toast for competition rank down (only rank up triggers toast)', () => {
      const mockSocket = createMockSocket(false);
      mockInitSocket.mockReturnValue(mockSocket);
      const onCompetitionRankUpdate = jest.fn();

      renderHook(() =>
        useLeaderboardSocket({
          userId: USER_ID,
          onCompetitionRankUpdate,
          enabled: true,
        })
      );

      // rank went from 3 to 7 (down)
      const data = competitionRankUpdateFixture({ rank: 7, previous_rank: 3 });

      act(() => {
        mockSocket.emit('competition:rank-update', data);
      });

      expect(mockToastSuccess).not.toHaveBeenCalled();
      expect(mockToastInfo).not.toHaveBeenCalled();
      expect(onCompetitionRankUpdate).toHaveBeenCalledWith(data);
    });
  });

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------
  describe('cleanup on unmount', () => {
    it('should call socket.off for all 6 event listeners', () => {
      const mockSocket = createMockSocket(false);
      mockInitSocket.mockReturnValue(mockSocket);

      const { unmount } = renderHook(() =>
        useLeaderboardSocket({ enabled: true })
      );

      unmount();

      const offCalls = mockSocket.off.mock.calls.map(
        (call: unknown[]) => call[0]
      );

      expect(offCalls).toContain('connect');
      expect(offCalls).toContain('disconnect');
      expect(offCalls).toContain('connect_error');
      expect(offCalls).toContain('leaderboard:rank-update');
      expect(offCalls).toContain('score:updated');
      expect(offCalls).toContain('competition:rank-update');
      expect(mockSocket.off).toHaveBeenCalledTimes(6);
    });
  });

  // -------------------------------------------------------------------------
  // Default options
  // -------------------------------------------------------------------------
  describe('default options', () => {
    it('should default enabled to true and initialize socket', () => {
      const mockSocket = createMockSocket(false);
      mockInitSocket.mockReturnValue(mockSocket);

      renderHook(() => useLeaderboardSocket());

      expect(mockInitSocket).toHaveBeenCalledTimes(1);
    });
  });
});
