/**
 * @file Competition Stream Service
 * @description In-memory shared video room state for competition streams.
 *
 * Implements an N-to-N mesh model: every participant in a competition room
 * connects to every other participant via WebRTC peer connections.
 * Room state is volatile (in-memory) since it only matters while the server
 * is running.
 */

import { socketService } from './socket.service.js';
import { query } from '../database/pg.js';
import { logger } from './logger.service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoomParticipant {
  userId: string;
  userName: string;
  userAvatar?: string;
  joinedAt: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVENTS = {
  /** Sent to room when a new participant joins */
  PARTICIPANT_JOINED: 'room:participant-joined',
  /** Sent to room when a participant leaves */
  PARTICIPANT_LEFT: 'room:participant-left',
  /** Sent back to the joining user with the list of existing participants */
  PARTICIPANTS_LIST: 'room:participants-list',
  /** Broadcast when a participant toggles audio/video */
  MEDIA_STATE_CHANGED: 'room:media-state-changed',
  /** WebRTC signaling: offer relay */
  OFFER: 'room:offer',
  /** WebRTC signaling: answer relay */
  ANSWER: 'room:answer',
  /** WebRTC signaling: ICE candidate relay */
  ICE_CANDIDATE: 'room:ice-candidate',
} as const;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class CompetitionStreamService {
  /** competitionId → Map<userId, RoomParticipant> */
  private roomParticipants = new Map<string, Map<string, RoomParticipant>>();

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  roomName(competitionId: string): string {
    return `stream:competition:${competitionId}`;
  }

  private async fetchUser(
    userId: string,
  ): Promise<{ name: string; avatar?: string }> {
    try {
      const result = await query<{
        first_name: string;
        last_name: string;
        avatar: string | null;
      }>(
        'SELECT first_name, last_name, avatar FROM users WHERE id = $1',
        [userId],
      );

      if (result.rows.length === 0) {
        return { name: 'Unknown User' };
      }

      const row = result.rows[0];
      return {
        name: `${row.first_name} ${row.last_name}`.trim(),
        ...(row.avatar ? { avatar: row.avatar } : {}),
      };
    } catch (error) {
      logger.warn('[CompetitionStream] Failed to fetch user', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { name: 'Unknown User' };
    }
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Join a competition's video room.
   * Returns the list of participants already in the room so the new user
   * can initiate WebRTC peer connections with each of them.
   */
  async joinRoom(
    competitionId: string,
    userId: string,
  ): Promise<{ participant: RoomParticipant; existingParticipants: RoomParticipant[] }> {
    if (!this.roomParticipants.has(competitionId)) {
      this.roomParticipants.set(competitionId, new Map());
    }

    const room = this.roomParticipants.get(competitionId)!;

    // Already in the room? Return current state
    if (room.has(userId)) {
      return {
        participant: room.get(userId)!,
        existingParticipants: Array.from(room.values()).filter(
          (p) => p.userId !== userId,
        ),
      };
    }

    const user = await this.fetchUser(userId);

    const participant: RoomParticipant = {
      userId,
      userName: user.name,
      userAvatar: user.avatar,
      joinedAt: new Date().toISOString(),
      audioEnabled: true,
      videoEnabled: true,
    };

    // Snapshot existing participants BEFORE adding the new one
    const existingParticipants = Array.from(room.values());

    room.set(userId, participant);

    // Broadcast to everyone in the room that a new participant joined
    socketService.emitToRoom(
      this.roomName(competitionId),
      EVENTS.PARTICIPANT_JOINED,
      { competitionId, participant },
    );

    logger.info('[CompetitionStream] Participant joined room', {
      competitionId,
      userId,
      userName: user.name,
      roomSize: room.size,
    });

    return { participant, existingParticipants };
  }

  /**
   * Leave a competition's video room.
   */
  leaveRoom(competitionId: string, userId: string): void {
    const room = this.roomParticipants.get(competitionId);
    if (!room) return;

    if (!room.has(userId)) return;

    room.delete(userId);
    if (room.size === 0) {
      this.roomParticipants.delete(competitionId);
    }

    // Broadcast to everyone remaining
    socketService.emitToRoom(
      this.roomName(competitionId),
      EVENTS.PARTICIPANT_LEFT,
      { competitionId, userId },
    );

    logger.info('[CompetitionStream] Participant left room', {
      competitionId,
      userId,
    });
  }

  /**
   * Update a participant's media state (audio/video toggles).
   */
  updateMediaState(
    competitionId: string,
    userId: string,
    state: { audioEnabled?: boolean; videoEnabled?: boolean },
  ): void {
    const room = this.roomParticipants.get(competitionId);
    if (!room) return;

    const participant = room.get(userId);
    if (!participant) return;

    if (state.audioEnabled !== undefined) {
      participant.audioEnabled = state.audioEnabled;
    }
    if (state.videoEnabled !== undefined) {
      participant.videoEnabled = state.videoEnabled;
    }

    // Broadcast the change
    socketService.emitToRoom(
      this.roomName(competitionId),
      EVENTS.MEDIA_STATE_CHANGED,
      {
        competitionId,
        userId,
        audioEnabled: participant.audioEnabled,
        videoEnabled: participant.videoEnabled,
      },
    );

    logger.debug('[CompetitionStream] Media state updated', {
      competitionId,
      userId,
      audioEnabled: participant.audioEnabled,
      videoEnabled: participant.videoEnabled,
    });
  }

  /**
   * Get all participants in a competition's video room.
   */
  getRoomParticipants(competitionId: string): RoomParticipant[] {
    const room = this.roomParticipants.get(competitionId);
    if (!room) return [];
    return Array.from(room.values());
  }

  /**
   * Clean up everything for a disconnected user.
   * Removes them from all rooms they were in.
   */
  handleDisconnect(userId: string): void {
    // Collect rooms to leave first to avoid mutating during iteration
    const toLeave: string[] = [];
    for (const [competitionId, room] of this.roomParticipants) {
      if (room.has(userId)) {
        toLeave.push(competitionId);
      }
    }

    for (const competitionId of toLeave) {
      this.leaveRoom(competitionId, userId);
    }

    logger.debug('[CompetitionStream] User disconnected, cleaned up', {
      userId,
      roomsLeft: toLeave.length,
    });
  }

  /**
   * Relay a WebRTC offer between two peers.
   */
  relayOffer(
    targetUserId: string,
    fromUserId: string,
    competitionId: string,
    sdp: string,
  ): void {
    socketService.emitToUser(targetUserId, EVENTS.OFFER, {
      fromUserId,
      competitionId,
      sdp,
    });
  }

  /**
   * Relay a WebRTC answer between two peers.
   */
  relayAnswer(
    targetUserId: string,
    fromUserId: string,
    competitionId: string,
    sdp: string,
  ): void {
    socketService.emitToUser(targetUserId, EVENTS.ANSWER, {
      fromUserId,
      competitionId,
      sdp,
    });
  }

  /**
   * Relay an ICE candidate between two peers.
   */
  relayIceCandidate(
    targetUserId: string,
    fromUserId: string,
    competitionId: string,
    candidate: { candidate: string; sdpMLineIndex: number | null; sdpMid: string | null },
  ): void {
    socketService.emitToUser(targetUserId, EVENTS.ICE_CANDIDATE, {
      fromUserId,
      competitionId,
      candidate,
    });
  }
}

export const competitionStreamService = new CompetitionStreamService();
export default competitionStreamService;
