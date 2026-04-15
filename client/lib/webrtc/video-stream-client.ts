/**
 * WebRTC Mesh Room Client
 *
 * Manages N-to-N WebRTC peer connections for a shared video room.
 * Every participant runs the same code — when a new user joins the room,
 * they create offers to all existing participants who respond with answers.
 * Uses Socket.IO for signaling (offer/answer/ICE relay).
 */

import { getSocket } from '@/lib/socket-client';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const MEDIA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30, max: 30 },
    facingMode: 'user',
  },
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
};

// ---------------------------------------------------------------------------
// MeshRoomClient
// ---------------------------------------------------------------------------

export class MeshRoomClient {
  private localStream: MediaStream | null = null;
  private peerConnections = new Map<string, RTCPeerConnection>();
  private competitionId: string;
  private iceServers: RTCIceServer[];
  private onRemoteStream: (userId: string, stream: MediaStream) => void;
  private onRemoteStreamRemoved: (userId: string) => void;

  constructor(
    competitionId: string,
    callbacks: {
      onRemoteStream: (userId: string, stream: MediaStream) => void;
      onRemoteStreamRemoved: (userId: string) => void;
    },
    iceServers?: RTCIceServer[],
  ) {
    this.competitionId = competitionId;
    this.onRemoteStream = callbacks.onRemoteStream;
    this.onRemoteStreamRemoved = callbacks.onRemoteStreamRemoved;
    this.iceServers = iceServers ?? DEFAULT_ICE_SERVERS;
  }

  /**
   * Capture camera + mic. Returns the local MediaStream.
   */
  async start(): Promise<MediaStream> {
    this.localStream = await navigator.mediaDevices.getUserMedia(
      MEDIA_CONSTRAINTS,
    );
    return this.localStream;
  }

  /**
   * Create a peer connection to another participant and send them an offer.
   * Called when we join and the server tells us who is already in the room.
   */
  async connectToPeer(peerId: string): Promise<void> {
    if (!this.localStream) return;
    if (this.peerConnections.has(peerId)) return;

    const pc = this.createPeerConnection(peerId);

    // Create and send offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const socket = getSocket();
    socket?.emit('room:offer', {
      targetUserId: peerId,
      competitionId: this.competitionId,
      sdp: offer.sdp,
    });
  }

  /**
   * Handle an incoming offer from another participant (they joined and are
   * initiating a connection to us). Create answer and send it back.
   */
  async handleOffer(fromUserId: string, sdp: string): Promise<void> {
    if (!this.localStream) return;

    // If we already have a connection to this user, close it first
    if (this.peerConnections.has(fromUserId)) {
      this.peerConnections.get(fromUserId)?.close();
      this.peerConnections.delete(fromUserId);
    }

    const pc = this.createPeerConnection(fromUserId);

    await pc.setRemoteDescription(
      new RTCSessionDescription({ type: 'offer', sdp }),
    );
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    const socket = getSocket();
    socket?.emit('room:answer', {
      targetUserId: fromUserId,
      competitionId: this.competitionId,
      sdp: answer.sdp,
    });
  }

  /**
   * Handle an answer from a peer we sent an offer to.
   */
  async handleAnswer(fromUserId: string, sdp: string): Promise<void> {
    const pc = this.peerConnections.get(fromUserId);
    if (!pc) return;
    await pc.setRemoteDescription(
      new RTCSessionDescription({ type: 'answer', sdp }),
    );
  }

  /**
   * Handle an ICE candidate from any peer.
   */
  async handleIceCandidate(
    fromUserId: string,
    candidate: {
      candidate: string;
      sdpMLineIndex: number | null;
      sdpMid: string | null;
    },
  ): Promise<void> {
    const pc = this.peerConnections.get(fromUserId);
    if (!pc) return;
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  }

  /**
   * Remove a specific peer (they left the room).
   */
  removePeer(peerId: string): void {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }
    this.onRemoteStreamRemoved(peerId);
  }

  /**
   * Toggle audio tracks on/off.
   */
  setAudioEnabled(enabled: boolean): void {
    this.localStream?.getAudioTracks().forEach((t) => {
      t.enabled = enabled;
    });
  }

  /**
   * Toggle video tracks on/off.
   */
  setVideoEnabled(enabled: boolean): void {
    this.localStream?.getVideoTracks().forEach((t) => {
      t.enabled = enabled;
    });
  }

  /**
   * Stop everything — close all peer connections and release media.
   */
  stop(): void {
    // Notify server
    const socket = getSocket();
    socket?.emit('room:leave', { competitionId: this.competitionId });

    // Close all peer connections
    for (const [id, pc] of this.peerConnections) {
      pc.close();
      this.peerConnections.delete(id);
    }

    // Stop media tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  // -----------------------------------------------------------------------
  // Internal helper
  // -----------------------------------------------------------------------

  private createPeerConnection(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    this.peerConnections.set(peerId, pc);

    // Add our local tracks so the peer receives our media
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Relay ICE candidates to the peer
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const socket = getSocket();
        socket?.emit('room:ice-candidate', {
          targetUserId: peerId,
          competitionId: this.competitionId,
          candidate: {
            candidate: event.candidate.candidate,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            sdpMid: event.candidate.sdpMid,
          },
        });
      }
    };

    // Receive remote tracks
    pc.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      this.onRemoteStream(peerId, stream);
    };

    // Handle connection failures
    pc.onconnectionstatechange = () => {
      if (
        pc.connectionState === 'failed' ||
        pc.connectionState === 'disconnected'
      ) {
        this.removePeer(peerId);
      }
    };

    return pc;
  }
}
