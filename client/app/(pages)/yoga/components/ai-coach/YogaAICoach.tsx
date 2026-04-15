"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import type { YogaPose, PoseTargets } from "@shared/types/domain/yoga";
import { useCamera } from "../../hooks/useCamera";
import { useMediaPipe } from "../../hooks/useMediaPipe";
import { usePoseScorer } from "../../hooks/usePoseScorer";
import { useGeminiCoach } from "../../hooks/useGeminiCoach";
import { useSessionTimer } from "../../hooks/useSessionTimer";
import { captureFrame } from "../../utils/captureFrame";
import { FALLBACK_POSE_TARGETS } from "../../utils/poses";
import { coachService } from "@/src/shared/services/yoga.service";
import CameraViewport from "./CameraViewport";
import CoachingPanel from "./CoachingPanel";
import PoseSelector from "./PoseSelector";
import SessionControls from "./SessionControls";

// Auto-capture at 25%, 50%, 75% of session (based on elapsed time thresholds)
const SNAPSHOT_INTERVALS = [15, 30, 45]; // seconds

export default function YogaAICoach() {
  const [selectedPose, setSelectedPose] = useState<YogaPose | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [snapshots, setSnapshots] = useState<string[]>([]);
  const snapshotsTakenRef = useRef<Set<number>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionLogIdRef = useRef<string | null>(null);
  const scoresRef = useRef<number[]>([]);

  // Hooks
  const camera = useCamera();
  const mediaPipe = useMediaPipe(camera.videoRef, camera.isActive);
  const timer = useSessionTimer();

  // Resolve pose targets: DB data or client-side fallback
  const poseTargets: PoseTargets | null =
    selectedPose?.jointTargets ??
    (selectedPose?.slug ? FALLBACK_POSE_TARGETS[selectedPose.slug] ?? null : null);

  const scorer = usePoseScorer(mediaPipe.landmarks, poseTargets);

  const coach = useGeminiCoach({
    poseSlug: selectedPose?.slug ?? "",
    currentAngles: scorer.currentAngles,
    elapsedSeconds: timer.elapsedSeconds,
    videoRef: camera.videoRef,
    isActive: timer.isRunning,
  });

  // TTS voice coaching
  const speakCoaching = useCallback(
    async (text: string) => {
      if (isMuted || !text) return;

      // Try server TTS first
      try {
        const response = await fetch("/api/tts/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voiceGender: "female" }),
        });

        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          if (audioRef.current) {
            audioRef.current.pause();
            URL.revokeObjectURL(audioRef.current.src);
          }
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.play().catch(() => {});
          return;
        }
      } catch {
        // Fall through to browser TTS
      }

      // Fallback: browser SpeechSynthesis
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    },
    [isMuted]
  );

  // Speak when new coaching arrives + track scores for progress
  useEffect(() => {
    if (coach.ttsText && timer.isRunning) {
      speakCoaching(coach.ttsText);
    }
    if (coach.coaching?.overallScore !== undefined && timer.isRunning) {
      scoresRef.current.push(coach.coaching.overallScore);
    }
  }, [coach.ttsText, coach.coaching?.overallScore, timer.isRunning, speakCoaching]);

  // Auto-capture snapshots at intervals
  useEffect(() => {
    if (!timer.isRunning || !camera.videoRef.current) return;

    for (const threshold of SNAPSHOT_INTERVALS) {
      if (
        timer.elapsedSeconds >= threshold &&
        !snapshotsTakenRef.current.has(threshold)
      ) {
        snapshotsTakenRef.current.add(threshold);
        const frame = captureFrame(camera.videoRef.current);
        if (frame) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- callback inside interval, not synchronous
          setSnapshots((prev) => [...prev.slice(-3), frame]); // Keep max 4
        }
      }
    }
  }, [timer.elapsedSeconds, timer.isRunning, camera.videoRef]);

  // Start session
  const handleStart = useCallback(async () => {
    if (!selectedPose) return;
    setSnapshots([]);
    snapshotsTakenRef.current.clear();
    scoresRef.current = [];
    sessionLogIdRef.current = null;
    coach.reset();
    await camera.startCamera();
    timer.start();

    // Create session log in DB for progress tracking
    try {
      const res = await coachService.startAISession(selectedPose.slug, selectedPose.englishName);
      if (res.success && res.data?.log?.id) {
        sessionLogIdRef.current = res.data.log.id;
      }
    } catch {
      // Non-critical — session still works without persistence
    }
  }, [selectedPose, camera, timer, coach]);

  // Stop session
  const handleStop = useCallback(() => {
    // Final snapshot
    if (camera.videoRef.current) {
      const frame = captureFrame(camera.videoRef.current);
      if (frame) {
        setSnapshots((prev) => [...prev.slice(-3), frame]);
      }
    }

    // Save session to DB for progress tracking
    const logId = sessionLogIdRef.current;
    const elapsed = timer.elapsedSeconds;
    const scores = scoresRef.current;
    if (logId && selectedPose) {
      const avgScore = scores.length > 0
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;
      coachService.completeAISession(logId, {
        durationSeconds: elapsed,
        averageScore: avgScore,
        poseName: selectedPose.englishName,
      }).catch(() => { /* non-critical */ });
    }
    sessionLogIdRef.current = null;
    scoresRef.current = [];

    timer.reset();
    camera.stopCamera();
    coach.reset();

    // Stop any TTS
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }, [camera, timer, coach, selectedPose]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col gap-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">AI Yoga Coach</h2>
          <p className="text-sm text-white/50">
            Real-time pose analysis powered by Gemini Vision
          </p>
        </div>
      </div>

      {/* Pose selector */}
      <PoseSelector
        selectedPose={selectedPose}
        onSelect={setSelectedPose}
        disabled={timer.isRunning}
      />

      {/* Main layout: Camera + Coaching */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Camera viewport — 2/3 */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <CameraViewport
            videoRef={camera.videoRef}
            isActive={camera.isActive}
            isMediaPipeLoaded={mediaPipe.isLoaded}
            isMediaPipeLoading={mediaPipe.isLoading}
            mediaPipeError={mediaPipe.error}
            onRetryMediaPipe={mediaPipe.retry}
            landmarks={mediaPipe.landmarks}
            jointScores={scorer.jointScores}
            overallScore={scorer.overallScore}
            cameraError={camera.error}
            onStartCamera={camera.startCamera}
            onStopCamera={camera.stopCamera}
          />

          <SessionControls
            isRunning={timer.isRunning}
            elapsedTime={timer.formatTime()}
            hasPose={!!selectedPose}
            isAnalysing={coach.isAnalysing}
            snapshots={snapshots}
            onStart={handleStart}
            onStop={handleStop}
            onAnalyseNow={coach.triggerAnalysis}
          />
        </div>

        {/* Coaching panel — 1/3 */}
        <div className="lg:col-span-1">
          <CoachingPanel
            coaching={coach.coaching}
            isAnalysing={coach.isAnalysing}
            isMuted={isMuted}
            onToggleMute={() => setIsMuted((m) => !m)}
            error={coach.error}
          />
        </div>
      </div>
    </motion.div>
  );
}
