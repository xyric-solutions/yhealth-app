"use client";

/**
 * @file useLipSync Hook
 * @description Connects audio sources to WebAudio AnalyserNode, computes smoothed
 * mouth-open value each frame, and writes to a shared ref that the RAF loop reads.
 *
 * Supports MediaStream, HTMLAudioElement, and AudioBuffer inputs.
 * AudioContext is lazy-created on first use to satisfy user-gesture requirements.
 */

import { useRef, useState, useCallback, useEffect, type MutableRefObject } from "react";
import { computeRMS, attackRelease, clamp, lerp } from "@/lib/avatar/smoothing";
import {
  VRM_VISEMES,
  VISEME_CYCLE_PROFILES,
  VISEME_CYCLE_PERIOD,
} from "@/lib/avatar/vrmMappings";

// ============================================
// TYPES
// ============================================

export interface UseLipSyncOptions {
  mouthValueRef: MutableRefObject<number>;
  /** Per-viseme weight output for multi-viseme lip-sync. */
  visemeValuesRef: MutableRefObject<Record<string, number>>;
  fftSize?: number;
  smoothingTimeConstant?: number;
  attackSpeed?: number;
  releaseSpeed?: number;
  gainMultiplier?: number;
}

export interface UseLipSyncReturn {
  startFromMediaStream: (stream: MediaStream) => void;
  startFromAudioElement: (el: HTMLAudioElement) => void;
  startFromAudioBuffer: (buffer: AudioBuffer) => void;
  stop: () => void;
  isActive: boolean;
  /** Register this as the lip-sync tick function in the RAF loop. */
  tick: () => void;
  /** Whether the analyser is connected and receiving audio data. */
  isAnalyserActive: () => boolean;
}

// ============================================
// HOOK
// ============================================

export function useLipSync({
  mouthValueRef,
  visemeValuesRef,
  fftSize = 256,
  smoothingTimeConstant = 0.5,
  attackSpeed = 0.4,
  releaseSpeed = 0.12,
  gainMultiplier = 4.0,
}: UseLipSyncOptions): UseLipSyncReturn {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<AudioNode | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const freqDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const connectedElementsRef = useRef<WeakSet<HTMLAudioElement>>(new WeakSet());

  const [isActive, setIsActive] = useState(false);

  // ---- AudioContext management ----

  const ensureAudioContext = useCallback(async (): Promise<AudioContext> => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const createAnalyser = useCallback(
    (ctx: AudioContext): AnalyserNode => {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = fftSize;
      analyser.smoothingTimeConstant = smoothingTimeConstant;
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.fftSize);
      freqDataRef.current = new Uint8Array(analyser.frequencyBinCount);
      return analyser;
    },
    [fftSize, smoothingTimeConstant]
  );

  const cleanupSource = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.disconnect();
      } catch {
        /* already disconnected */
      }
      sourceNodeRef.current = null;
    }
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch {
        /* already disconnected */
      }
      analyserRef.current = null;
    }
    dataArrayRef.current = null;
    freqDataRef.current = null;
    mouthValueRef.current = 0;
    setIsActive(false);
  }, [mouthValueRef]);

  // ---- Start from HTMLAudioElement (primary path for TTS) ----

  const startFromAudioElement = useCallback(
    (el: HTMLAudioElement) => {
      cleanupSource();

      // Async IIFE — ensure AudioContext is running before connecting
      (async () => {
        try {
          const ctx = await ensureAudioContext();
          const analyser = createAnalyser(ctx);

          // createMediaElementSource can only be called once per element
          if (connectedElementsRef.current.has(el)) {
            console.warn("[useLipSync] Audio element already connected, skipping source creation");
            return;
          }

          const source = ctx.createMediaElementSource(el);
          connectedElementsRef.current.add(el);

          // Wire: source -> analyser -> destination (so audio still plays through speakers)
          source.connect(analyser);
          analyser.connect(ctx.destination);
          sourceNodeRef.current = source;

          setIsActive(true);
        } catch (err) {
          console.error("[useLipSync] Failed to connect audio element:", err);
        }
      })();
    },
    [cleanupSource, ensureAudioContext, createAnalyser]
  );

  // ---- Start from MediaStream ----

  const startFromMediaStream = useCallback(
    (stream: MediaStream) => {
      cleanupSource();

      (async () => {
        try {
          const ctx = await ensureAudioContext();
          const analyser = createAnalyser(ctx);

          const source = ctx.createMediaStreamSource(stream);
          // Don't connect to destination — we don't want to hear ourselves
          source.connect(analyser);
          sourceNodeRef.current = source;

          setIsActive(true);
        } catch (err) {
          console.error("[useLipSync] Failed to connect media stream:", err);
        }
      })();
    },
    [cleanupSource, ensureAudioContext, createAnalyser]
  );

  // ---- Start from AudioBuffer ----

  const startFromAudioBuffer = useCallback(
    (buffer: AudioBuffer) => {
      cleanupSource();

      (async () => {
        try {
          const ctx = await ensureAudioContext();
          const analyser = createAnalyser(ctx);

          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(analyser);
          analyser.connect(ctx.destination);
          source.start();
          sourceNodeRef.current = source;

          // Auto-stop when buffer finishes
          source.onended = () => {
            cleanupSource();
          };

          setIsActive(true);
        } catch (err) {
          console.error("[useLipSync] Failed to play audio buffer:", err);
        }
      })();
    },
    [cleanupSource, ensureAudioContext, createAnalyser]
  );

  // ---- Stop ----

  const stop = useCallback(() => {
    cleanupSource();
  }, [cleanupSource]);

  // ---- Tick (called each frame from RAF loop) ----

  const tick = useCallback(() => {
    const analyser = analyserRef.current;
    const data = dataArrayRef.current;
    if (!analyser || !data) return;

    // Time-domain for amplitude
    analyser.getByteTimeDomainData(data);
    const rawVolume = computeRMS(data);
    const amplified = clamp(rawVolume * gainMultiplier, 0, 1);
    const smoothed = attackRelease(
      mouthValueRef.current,
      amplified,
      attackSpeed,
      releaseSpeed
    );
    mouthValueRef.current = smoothed;

    if (smoothed < 0.05) {
      // Mouth basically closed — zero all visemes
      for (const v of VRM_VISEMES) {
        visemeValuesRef.current[v] = 0;
      }
      return;
    }

    // Frequency-domain for viseme weighting
    const freqData = freqDataRef.current;
    if (freqData && audioContextRef.current) {
      analyser.getByteFrequencyData(freqData);
      const binCount = analyser.frequencyBinCount;
      const binHz = audioContextRef.current.sampleRate / analyser.fftSize;

      // Compute energy in 3 frequency bands
      let lowEnergy = 0;  // 80-400 Hz → open vowels (aa, oh)
      let midEnergy = 0;  // 400-2000 Hz → rounded (ou)
      let highEnergy = 0; // 2000-6000 Hz → narrow (ee, ih)

      for (let i = 0; i < binCount; i++) {
        const freq = i * binHz;
        const val = freqData[i] / 255;
        if (freq >= 80 && freq < 400) lowEnergy += val;
        else if (freq >= 400 && freq < 2000) midEnergy += val;
        else if (freq >= 2000 && freq < 6000) highEnergy += val;
      }

      // Normalize to ratios
      const total = lowEnergy + midEnergy + highEnergy + 0.001;
      const lowR = lowEnergy / total;
      const midR = midEnergy / total;
      const highR = highEnergy / total;

      // Map frequency bands to viseme weights — heavily boosted for full-body visibility
      const boost = Math.min(1.0, smoothed * 1.8); // amplify mouth opening
      visemeValuesRef.current.aa = clamp(lowR * 1.5 * boost, 0, 1);
      visemeValuesRef.current.oh = clamp((lowR * 0.9 + midR * 0.5) * boost, 0, 1);
      visemeValuesRef.current.ou = clamp(midR * 1.1 * boost, 0, 1);
      visemeValuesRef.current.ee = clamp(highR * 1.2 * boost, 0, 1);
      visemeValuesRef.current.ih = clamp((highR * 0.9 + midR * 0.4) * boost, 0, 1);
    } else {
      // Fallback: time-based cycling (if freqData not available)
      const elapsed = performance.now() / 1000;
      const cyclePos =
        (elapsed / VISEME_CYCLE_PERIOD) % VISEME_CYCLE_PROFILES.length;
      const profileIdx = Math.floor(cyclePos);
      const nextIdx = (profileIdx + 1) % VISEME_CYCLE_PROFILES.length;
      const t = cyclePos - profileIdx;

      const currentProfile = VISEME_CYCLE_PROFILES[profileIdx];
      const nextProfile = VISEME_CYCLE_PROFILES[nextIdx];

      for (const v of VRM_VISEMES) {
        const blended = lerp(currentProfile[v], nextProfile[v], t);
        visemeValuesRef.current[v] = blended * smoothed;
      }
    }
  }, [mouthValueRef, visemeValuesRef, gainMultiplier, attackSpeed, releaseSpeed]);

  // ---- Cleanup on unmount ----

  useEffect(() => {
    return () => {
      cleanupSource();
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAnalyserActive = useCallback(() => {
    return !!(analyserRef.current && dataArrayRef.current);
  }, []);

  return {
    startFromMediaStream,
    startFromAudioElement,
    startFromAudioBuffer,
    stop,
    isActive,
    tick,
    isAnalyserActive,
  };
}
