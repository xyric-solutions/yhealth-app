"use client";

/**
 * @file AvatarLayer Component
 * @description Main 3D avatar component. Wires useThreeVrm, useLipSync, and
 * useExpressions hooks together via shared refs. Exposes an imperative handle
 * for external control (setExpression, setState, speakFrom*, stopSpeaking).
 */

import {
  forwardRef,
  useRef,
  useEffect,
  useImperativeHandle,
} from "react";
import { useThreeVrm } from "@/hooks/useThreeVrm";
import { useLipSync } from "@/hooks/useLipSync";
import { useExpressions } from "@/hooks/useExpressions";
import { useEyeMovement } from "@/hooks/useEyeMovement";
import { useVoiceAssistant } from "@/app/context/VoiceAssistantContext";
import {
  type AvatarExpression,
  type AvatarState,
  MOOD_TO_EXPRESSION,
  EMOTION_TO_EXPRESSION,
} from "@/lib/avatar/vrmMappings";
import type { GestureType } from "@/lib/avatar/gestureSystem";
import { AvatarCard } from "./AvatarCard";

// ============================================
// PUBLIC API TYPE
// ============================================

export interface AvatarLayerHandle {
  load: (vrmUrl?: string) => Promise<void>;
  setExpression: (
    name: AvatarExpression,
    intensity?: number,
    fadeMs?: number
  ) => void;
  setState: (state: AvatarState) => void;
  speakFromMediaStream: (stream: MediaStream) => void;
  speakFromAudioElement: (el: HTMLAudioElement) => void;
  speakFromAudioBuffer: (buffer: AudioBuffer) => void;
  stopSpeaking: () => void;
  /** Drive avatar expression + body language from backend AI emotion detection. */
  setEmotionFromBackend: (emotion: string, confidence: number) => void;
  /** Queue a named discrete gesture (wave, point, shrug, etc.). */
  queueGesture: (type: GestureType) => void;
}

// ============================================
// PROPS
// ============================================

interface AvatarLayerProps {
  vrmUrl?: string;
  className?: string;
  /** Auto-subscribe to VoiceAssistantContext mood changes. Default: true. */
  autoMapVoiceState?: boolean;
  onLoaded?: () => void;
}

// ============================================
// COMPONENT
// ============================================

export const AvatarLayer = forwardRef<AvatarLayerHandle, AvatarLayerProps>(
  function AvatarLayerInner(
    { vrmUrl, className, autoMapVoiceState = true, onLoaded },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Shared refs — the communication bus between hooks
    const mouthValueRef = useRef(0);
    const expressionValuesRef = useRef<Record<string, number>>({});
    const visemeValuesRef = useRef<Record<string, number>>({});
    const avatarStateRef = useRef<string>("idle");
    const eyeValuesRef = useRef<Record<string, number>>({});
    const emotionModRef = useRef<string>("neutral");
    /** Tracks whether a backend emotion is active (prevents state override). */
    const backendEmotionActiveRef = useRef(false);

    // Tick function refs — hooks register their per-frame update functions here
    const lipSyncTickRef = useRef<(() => void) | null>(null);
    const expressionsTickRef = useRef<(() => void) | null>(null);
    const eyeMovementTickRef = useRef<(() => void) | null>(null);

    // ---- Hooks ----

    const { vrmRef, loadVrm, isLoading, error, queueGesture } = useThreeVrm({
      canvasRef,
      vrmUrl,
      mouthValueRef,
      expressionValuesRef,
      visemeValuesRef,
      avatarStateRef,
      lipSyncTickRef,
      expressionsTickRef,
      eyeMovementTickRef,
      eyeValuesRef,
      emotionModRef,
    });

    const lipSync = useLipSync({ mouthValueRef, visemeValuesRef });
    const expressions = useExpressions({ expressionValuesRef });
    const eyeMovement = useEyeMovement({ eyeValuesRef, emotionModRef, avatarStateRef });

    // Register tick functions
    useEffect(() => {
      lipSyncTickRef.current = lipSync.tick;
      return () => {
        lipSyncTickRef.current = null;
      };
    }, [lipSync.tick]);

    useEffect(() => {
      expressionsTickRef.current = expressions.tick;
      return () => {
        expressionsTickRef.current = null;
      };
    }, [expressions.tick]);

    useEffect(() => {
      eyeMovementTickRef.current = eyeMovement.tick;
      return () => {
        eyeMovementTickRef.current = null;
      };
    }, [eyeMovement.tick]);

    // Sync expression state → avatarStateRef (drives body pose blending)
    useEffect(() => {
      avatarStateRef.current = expressions.currentState;
    }, [expressions.currentState]);

    // ---- Voice Assistant Context Integration ----

    const { userMood, assistantName } = useVoiceAssistant();

    useEffect(() => {
      if (!autoMapVoiceState) return;
      const expr = MOOD_TO_EXPRESSION[userMood] || "neutral";
      expressions.setExpression(expr, 0.6, 300);
      emotionModRef.current = expr; // drives animation modulation
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userMood, autoMapVoiceState, expressions.setExpression]);

    // Notify on VRM loaded
    useEffect(() => {
      if (vrmRef.current && !isLoading && !error && onLoaded) {
        onLoaded();
      }
    }, [isLoading, error, onLoaded, vrmRef]);

    // ---- Imperative Handle ----

    useImperativeHandle(
      ref,
      () => ({
        load: async (url?: string) => {
          const targetUrl = url || vrmUrl;
          if (targetUrl) await loadVrm(targetUrl);
        },
        setExpression: expressions.setExpression,
        setState: (state: AvatarState) => {
          if (backendEmotionActiveRef.current && (state === "speaking" || state === "thinking")) {
            // Backend emotion is active — update body pose without overriding facial expression
            expressions.setStateWithoutExpression(state);
          } else {
            expressions.setState(state);
          }
          // Clear backend emotion flag when returning to idle
          if (state === "idle") {
            backendEmotionActiveRef.current = false;
          }
        },
        speakFromMediaStream: (stream: MediaStream) => {
          lipSync.startFromMediaStream(stream);
        },
        speakFromAudioElement: (el: HTMLAudioElement) => {
          lipSync.startFromAudioElement(el);
        },
        speakFromAudioBuffer: (buffer: AudioBuffer) => {
          lipSync.startFromAudioBuffer(buffer);
        },
        stopSpeaking: () => {
          lipSync.stop();
        },
        setEmotionFromBackend: (emotion: string, confidence: number) => {
          backendEmotionActiveRef.current = true;
          const expr = EMOTION_TO_EXPRESSION[emotion] || "neutral";
          const intensity = Math.min(1.0, (confidence / 100) * 1.4);
          expressions.setExpression(expr, intensity, 400);
          emotionModRef.current = expr; // drives full-body animation modulation
        },
        queueGesture,
      }),
      [loadVrm, vrmUrl, expressions, lipSync, queueGesture]
    );

    // ---- Render ----

    return (
      <AvatarCard
        currentState={expressions.currentState}
        currentExpression={expressions.currentExpression}
        assistantName={assistantName}
        isSpeaking={lipSync.isActive}
        className={className}
      >
        {/* Loading spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-30">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-30 p-4">
            <p className="text-xs text-red-400 text-center">{error}</p>
          </div>
        )}

        {/* Three.js canvas */}
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
        />
      </AvatarCard>
    );
  }
);
