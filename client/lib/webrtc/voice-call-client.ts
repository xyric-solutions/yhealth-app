/**
 * WebRTC Voice Call Client
 * Handles WebRTC peer connection for voice calls
 */

import { voiceCallService } from "@/src/shared/services/voice-call.service";
import { logger } from "./logger";

export interface VoiceCallClientConfig {
  callId: string;
  iceServers: RTCIceServer[];
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onError?: (error: Error) => void;
}

export class VoiceCallClient {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private callId: string;
  private config: VoiceCallClientConfig;

  constructor(config: VoiceCallClientConfig) {
    this.callId = config.callId;
    this.config = config;
  }

  /**
   * Initialize the call connection
   */
  async initialize(): Promise<void> {
    try {
      // Get user media (microphone)
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      // Create peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: this.config.iceServers,
      });

      // Add local stream tracks
      this.localStream.getTracks().forEach((track) => {
        if (this.peerConnection) {
          this.peerConnection.addTrack(track, this.localStream!);
        }
      });

      // Handle remote stream
      this.peerConnection.ontrack = (event) => {
        this.remoteStream = event.streams[0];
        // Play remote audio
        const audio = new Audio();
        audio.srcObject = this.remoteStream;
        audio.play().catch((err) => {
          console.error("Error playing remote audio:", err);
        });
      };

      // Handle ICE candidates
      this.peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
          await voiceCallService.handleIceCandidate(this.callId, {
            candidate: event.candidate.candidate,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            sdpMid: event.candidate.sdpMid,
          });
        }
      };

      // Handle connection state changes
      this.peerConnection.onconnectionstatechange = () => {
        if (this.peerConnection) {
          const state = this.peerConnection.connectionState;
          this.config.onConnectionStateChange?.(state);

          if (state === "connected") {
            voiceCallService.markActive(this.callId);
          } else if (state === "failed" || state === "disconnected") {
            this.config.onError?.(new Error(`Connection ${state}`));
          }
        }
      };

      // Create and send offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      const answerResponse = await voiceCallService.handleOffer(this.callId, {
        sdp: offer.sdp || "",
        type: "offer",
      });

      if (answerResponse.success && answerResponse.data) {
        await this.peerConnection.setRemoteDescription(
          new RTCSessionDescription(answerResponse.data.answer)
        );
      }
    } catch (error) {
      logger.error("Error initializing voice call client", error);
      throw error;
    }
  }

  /**
   * Mute/unmute microphone
   */
  setMuted(muted: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  /**
   * Check if microphone is muted
   */
  isMuted(): boolean {
    if (!this.localStream) return true;
    return this.localStream.getAudioTracks().some((track) => !track.enabled);
  }

  /**
   * Get connection state
   */
  getConnectionState(): RTCPeerConnectionState | null {
    return this.peerConnection?.connectionState || null;
  }

  /**
   * Cleanup and close connection
   */
  async cleanup(): Promise<void> {
    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // End call on server
    try {
      await voiceCallService.endCall(this.callId);
    } catch (error) {
      logger.error("Error ending call on server", error);
    }
  }
}

