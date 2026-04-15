"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { PhoneOff, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { voiceCallService, type CallStatus } from "@/src/shared/services/voice-call.service";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";

interface ActiveCallViewProps {
  callId: string;
  onEnd: () => void;
  className?: string;
}

export function ActiveCallView({ callId, onEnd, className = "" }: ActiveCallViewProps) {
  const [status, setStatus] = useState<CallStatus>("initiating");
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [_connectionDuration, setConnectionDuration] = useState(0);
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Poll call status
  useEffect(() => {
    const pollStatus = async () => {
      try {
        const response = await voiceCallService.getStatus(callId);
        if (response.success && response.data) {
          setStatus(response.data.status);
          if (response.data.connectionDuration) {
            setConnectionDuration(response.data.connectionDuration);
          }
          if (response.data.callDuration) {
            setCallDuration(response.data.callDuration);
          }
          if (response.data.error) {
            setError(response.data.error.message);
          }
        }
      } catch (err) {
        console.error("Error polling call status:", err);
      }
    };

    pollStatus();
    statusIntervalRef.current = setInterval(pollStatus, 2000); // Poll every 2 seconds

    return () => {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
      }
    };
  }, [callId]);

  // Update call duration timer
  useEffect(() => {
    if (status === "active") {
      durationIntervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [status]);

  // Initialize WebRTC connection
  useEffect(() => {
    const initWebRTC = async () => {
      try {
        // Get user media
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        localStreamRef.current = stream;

        // Get ICE servers
        const iceResponse = await voiceCallService.getIceServers(callId);
        if (!iceResponse.success || !iceResponse.data) {
          throw new Error("Failed to get ICE servers");
        }

        // Create peer connection
        const pc = new RTCPeerConnection({
          iceServers: iceResponse.data.iceServers,
        });

        // Add local stream tracks
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // Handle ICE candidates
        pc.onicecandidate = async (event) => {
          if (event.candidate) {
            await voiceCallService.handleIceCandidate(callId, {
              candidate: event.candidate.candidate,
              sdpMLineIndex: event.candidate.sdpMLineIndex,
              sdpMid: event.candidate.sdpMid,
            });
          }
        };

        // Handle connection state changes
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "connected") {
            voiceCallService.markActive(callId);
            setStatus("active");
          } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
            setError("Connection lost");
            setStatus("failed");
          }
        };

        // Create offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Send offer to server
        const answerResponse = await voiceCallService.handleOffer(callId, {
          sdp: offer.sdp || "",
          type: "offer",
        });

        if (answerResponse.success && answerResponse.data) {
          await pc.setRemoteDescription(
            new RTCSessionDescription(answerResponse.data.answer)
          );
        }

        peerConnectionRef.current = pc;
      } catch (err: unknown) {
        console.error("Error initializing WebRTC:", err);
        setError((err as Error).message || "Failed to initialize call");
        setStatus("failed");
      }
    };

    if (status === "initiating" || status === "connecting") {
      initWebRTC();
    }

    return () => {
      // Cleanup
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, [callId, status]);

  const handleEndCall = async () => {
    try {
      await voiceCallService.endCall(callId);
      toast.success("Call ended");
      onEnd();
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to end call");
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const statusMessages = {
    initiating: "Connecting...",
    connecting: "Establishing connection...",
    ringing: "Ringing...",
    active: formatDuration(callDuration),
    ended: "Call ended",
    failed: "Call failed",
    timeout: "Connection timeout",
    cancelled: "Call cancelled",
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm ${className}`}
    >
      <motion.div
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl"
      >
        {/* Status */}
        <div className="text-center mb-6">
          <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-16 h-16 rounded-full bg-white/20"
            />
          </div>
          <h3 className="text-xl font-semibold mb-2">AI Coach</h3>
          <p className="text-gray-600 dark:text-gray-400">
            {statusMessages[status]}
          </p>
          {error && (
            <p className="text-red-500 text-sm mt-2">{error}</p>
          )}
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4 mb-6">
          <Button
            onClick={toggleMute}
            variant="outline"
            size="icon"
            className="w-12 h-12 rounded-full"
          >
            {isMuted ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </Button>

          <Button
            onClick={() => setIsSpeakerOn(!isSpeakerOn)}
            variant="outline"
            size="icon"
            className="w-12 h-12 rounded-full"
          >
            {isSpeakerOn ? (
              <Volume2 className="w-5 h-5" />
            ) : (
              <VolumeX className="w-5 h-5" />
            )}
          </Button>

          <Button
            onClick={handleEndCall}
            variant="destructive"
            size="icon"
            className="w-12 h-12 rounded-full"
          >
            <PhoneOff className="w-5 h-5" />
          </Button>
        </div>

        {/* Connection quality indicator */}
        {status === "active" && (
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Connected
              </span>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

