/**
 * @file useVoiceRecorder Hook
 * @description Manages MediaRecorder lifecycle, permissions, and audio blob capture
 */

"use client";

import { useState, useRef, useCallback } from "react";

export type RecorderState = "idle" | "requesting" | "recording" | "stopped";
export type PermissionState = "prompt" | "granted" | "denied" | "unsupported";

interface UseVoiceRecorderReturn {
  state: RecorderState;
  permission: PermissionState;
  audioBlob: Blob | null;
  durationMs: number;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  resetRecording: () => void;
}

export function useVoiceRecorder(): UseVoiceRecorderReturn {
  const [state, setState] = useState<RecorderState>("idle");
  const [permission, setPermission] = useState<PermissionState>("prompt");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [durationMs, setDurationMs] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setPermission("unsupported");
      return;
    }

    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setPermission("granted");

      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setDurationMs(Date.now() - startTimeRef.current);
        setState("stopped");

        // Stop all tracks to release the mic
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      startTimeRef.current = Date.now();
      recorder.start(250); // Collect data every 250ms
      setState("recording");
    } catch (err) {
      const error = err as DOMException;
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        setPermission("denied");
      }
      setState("idle");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const resetRecording = useCallback(() => {
    setAudioBlob(null);
    setDurationMs(0);
    setState("idle");
    chunksRef.current = [];

    // Clean up any lingering stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  return {
    state,
    permission,
    audioBlob,
    durationMs,
    startRecording,
    stopRecording,
    resetRecording,
  };
}
