/**
 * @file useVideoRoom
 * @description React hook for the shared N-to-N video room in a competition.
 *
 * - Fetches initial room participants via REST
 * - Subscribes to Socket.IO events for real-time updates
 * - Orchestrates MeshRoomClient for WebRTC peer connections
 * - Provides joinRoom/leaveRoom/toggleAudio/toggleVideo actions
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from '@/lib/socket-client';
import { api } from '@/lib/api-client';
import { MeshRoomClient } from '@/lib/webrtc/video-stream-client';

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

export interface UseVideoRoomReturn {
  /** All participants currently in the room */
  participants: RoomParticipant[];
  /** Whether the current user is in the room */
  isInRoom: boolean;
  /** The local camera+mic stream */
  localStream: MediaStream | null;
  /** Remote streams keyed by participant userId */
  remoteStreams: Map<string, MediaStream>;
  /** Whether local audio is enabled */
  audioEnabled: boolean;
  /** Whether local video is enabled */
  videoEnabled: boolean;
  /** Join the shared video room */
  joinRoom: () => Promise<void>;
  /** Leave the video room */
  leaveRoom: () => void;
  /** Toggle microphone */
  toggleAudio: () => void;
  /** Toggle camera */
  toggleVideo: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useVideoRoom(competitionId: string): UseVideoRoomReturn {
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [isInRoom, setIsInRoom] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(
    new Map(),
  );
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);

  const meshClientRef = useRef<MeshRoomClient | null>(null);

  // -----------------------------------------------------------------------
  // Fetch initial participants
  // -----------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;
    async function fetchParticipants() {
      try {
        const res = await api.get<{ participants: RoomParticipant[] }>(
          `/v1/competitions/${competitionId}/streams`,
        );
        if (!cancelled && res.data?.participants) {
          setParticipants(res.data.participants);
        }
      } catch {
        // Non-critical — socket events will hydrate the list
      }
    }

    fetchParticipants();
    return () => {
      cancelled = true;
    };
  }, [competitionId]);

  // -----------------------------------------------------------------------
  // Socket.IO subscriptions
  // -----------------------------------------------------------------------

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Join the socket room so we receive room broadcasts even before joining the video room
    socket.emit('join:room', `stream:competition:${competitionId}`);

    // --- Room lifecycle events ---

    const handleParticipantJoined = (data: {
      competitionId: string;
      participant: RoomParticipant;
    }) => {
      if (data.competitionId !== competitionId) return;
      setParticipants((prev) => {
        if (prev.some((p) => p.userId === data.participant.userId)) return prev;
        return [...prev, data.participant];
      });

      // If we are in the room, the new participant will send us an offer —
      // we don't need to initiate (they call connectToPeer for each existing user)
    };

    const handleParticipantLeft = (data: {
      competitionId: string;
      userId: string;
    }) => {
      if (data.competitionId !== competitionId) return;
      setParticipants((prev) => prev.filter((p) => p.userId !== data.userId));

      // Clean up their peer connection
      meshClientRef.current?.removePeer(data.userId);
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.delete(data.userId);
        return next;
      });
    };

    const handleMediaStateChanged = (data: {
      competitionId: string;
      userId: string;
      audioEnabled: boolean;
      videoEnabled: boolean;
    }) => {
      if (data.competitionId !== competitionId) return;
      setParticipants((prev) =>
        prev.map((p) =>
          p.userId === data.userId
            ? {
                ...p,
                audioEnabled: data.audioEnabled,
                videoEnabled: data.videoEnabled,
              }
            : p,
        ),
      );
    };

    // --- WebRTC signaling events ---

    const handleOffer = (data: {
      fromUserId: string;
      competitionId: string;
      sdp: string;
    }) => {
      if (data.competitionId !== competitionId) return;
      meshClientRef.current?.handleOffer(data.fromUserId, data.sdp);
    };

    const handleAnswer = (data: {
      fromUserId: string;
      competitionId: string;
      sdp: string;
    }) => {
      if (data.competitionId !== competitionId) return;
      meshClientRef.current?.handleAnswer(data.fromUserId, data.sdp);
    };

    const handleIceCandidate = (data: {
      fromUserId: string;
      competitionId: string;
      candidate: {
        candidate: string;
        sdpMLineIndex: number | null;
        sdpMid: string | null;
      };
    }) => {
      if (data.competitionId !== competitionId) return;
      meshClientRef.current?.handleIceCandidate(
        data.fromUserId,
        data.candidate,
      );
    };

    socket.on('room:participant-joined', handleParticipantJoined);
    socket.on('room:participant-left', handleParticipantLeft);
    socket.on('room:media-state-changed', handleMediaStateChanged);
    socket.on('room:offer', handleOffer);
    socket.on('room:answer', handleAnswer);
    socket.on('room:ice-candidate', handleIceCandidate);

    return () => {
      socket.off('room:participant-joined', handleParticipantJoined);
      socket.off('room:participant-left', handleParticipantLeft);
      socket.off('room:media-state-changed', handleMediaStateChanged);
      socket.off('room:offer', handleOffer);
      socket.off('room:answer', handleAnswer);
      socket.off('room:ice-candidate', handleIceCandidate);

      socket.emit('leave:room', `stream:competition:${competitionId}`);
    };
  }, [competitionId]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const joinRoom = useCallback(async () => {
    if (meshClientRef.current) return; // Already in room

    const client = new MeshRoomClient(competitionId, {
      onRemoteStream: (userId, stream) => {
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.set(userId, stream);
          return next;
        });
      },
      onRemoteStreamRemoved: (userId) => {
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.delete(userId);
          return next;
        });
      },
    });

    meshClientRef.current = client;

    try {
      // Start local camera + mic
      const stream = await client.start();
      setLocalStream(stream);
      setIsInRoom(true);
      setAudioEnabled(true);
      setVideoEnabled(true);

      // Tell the server we're joining
      const socket = getSocket();
      if (!socket) return;

      // Listen for the participants list response (one-time)
      socket.once(
        'room:participants-list',
        (data: {
          competitionId: string;
          participants: RoomParticipant[];
          self: RoomParticipant;
        }) => {
          if (data.competitionId !== competitionId) return;

          // Connect to each existing participant (create offers)
          for (const p of data.participants) {
            client.connectToPeer(p.userId);
          }
        },
      );

      socket.emit('room:join', { competitionId });
    } catch (error) {
      meshClientRef.current = null;
      setIsInRoom(false);
      setLocalStream(null);
      throw error;
    }
  }, [competitionId]);

  const leaveRoom = useCallback(() => {
    if (!meshClientRef.current) return;
    meshClientRef.current.stop();
    meshClientRef.current = null;
    setLocalStream(null);
    setIsInRoom(false);
    setRemoteStreams(new Map());
    setAudioEnabled(true);
    setVideoEnabled(true);
  }, []);

  const toggleAudio = useCallback(() => {
    if (!meshClientRef.current) return;
    const newState = !audioEnabled;
    meshClientRef.current.setAudioEnabled(newState);
    setAudioEnabled(newState);

    // Notify server so other participants can show the mic state
    const socket = getSocket();
    socket?.emit('room:media-state', {
      competitionId,
      audioEnabled: newState,
      videoEnabled,
    });
  }, [audioEnabled, videoEnabled, competitionId]);

  const toggleVideo = useCallback(() => {
    if (!meshClientRef.current) return;
    const newState = !videoEnabled;
    meshClientRef.current.setVideoEnabled(newState);
    setVideoEnabled(newState);

    // Notify server
    const socket = getSocket();
    socket?.emit('room:media-state', {
      competitionId,
      audioEnabled,
      videoEnabled: newState,
    });
  }, [audioEnabled, videoEnabled, competitionId]);

  // -----------------------------------------------------------------------
  // Cleanup on unmount
  // -----------------------------------------------------------------------

  useEffect(() => {
    return () => {
      if (meshClientRef.current) {
        meshClientRef.current.stop();
        meshClientRef.current = null;
      }
    };
  }, []);

  return {
    participants,
    isInRoom,
    localStream,
    remoteStreams,
    audioEnabled,
    videoEnabled,
    joinRoom,
    leaveRoom,
    toggleAudio,
    toggleVideo,
  };
}
