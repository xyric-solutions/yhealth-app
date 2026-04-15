"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Wind,
  Zap,
  Loader2,
  Volume2,
  VolumeX,
  Target,
  Flame,
  Heart,
  ShieldAlert,
  Sparkles,
  PartyPopper,
  Smile,
  Swords,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CoachingResult, CoachEmotion } from "@shared/types/domain/yoga";
import ScoreRing from "./ScoreRing";
import BodyPartCard from "./BodyPartCard";

interface CoachingPanelProps {
  coaching: CoachingResult | null;
  isAnalysing: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  error?: string | null;
}

const emotionConfig: Record<
  CoachEmotion,
  {
    label: string;
    icon: typeof Heart;
    color: string;
    bg: string;
    border: string;
    glow: string;
    correctionBorder: string;
    correctionBg: string;
    correctionIcon: string;
  }
> = {
  proud: {
    label: "Proud",
    icon: Sparkles,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    glow: "shadow-[0_0_20px_rgba(245,158,11,0.15)]",
    correctionBorder: "border-amber-500/30",
    correctionBg: "bg-amber-500/10",
    correctionIcon: "text-amber-400",
  },
  encouraging: {
    label: "Encouraging",
    icon: Heart,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    glow: "shadow-[0_0_20px_rgba(16,185,129,0.15)]",
    correctionBorder: "border-emerald-500/30",
    correctionBg: "bg-emerald-500/10",
    correctionIcon: "text-emerald-400",
  },
  calm: {
    label: "Calm",
    icon: Wind,
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/20",
    glow: "shadow-[0_0_20px_rgba(14,165,233,0.15)]",
    correctionBorder: "border-sky-500/30",
    correctionBg: "bg-sky-500/10",
    correctionIcon: "text-sky-400",
  },
  strict: {
    label: "Strict",
    icon: ShieldAlert,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    glow: "shadow-[0_0_20px_rgba(249,115,22,0.2)]",
    correctionBorder: "border-orange-500/40",
    correctionBg: "bg-orange-500/15",
    correctionIcon: "text-orange-400",
  },
  concerned: {
    label: "Concerned",
    icon: ShieldAlert,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    glow: "shadow-[0_0_20px_rgba(239,68,68,0.2)]",
    correctionBorder: "border-red-500/40",
    correctionBg: "bg-red-500/15",
    correctionIcon: "text-red-400",
  },
  celebratory: {
    label: "Celebrating!",
    icon: PartyPopper,
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
    glow: "shadow-[0_0_25px_rgba(234,179,8,0.2)]",
    correctionBorder: "border-yellow-500/30",
    correctionBg: "bg-yellow-500/10",
    correctionIcon: "text-yellow-400",
  },
  playful: {
    label: "Playful",
    icon: Smile,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    glow: "shadow-[0_0_20px_rgba(168,85,247,0.15)]",
    correctionBorder: "border-purple-500/30",
    correctionBg: "bg-purple-500/10",
    correctionIcon: "text-purple-400",
  },
  intense: {
    label: "Intense",
    icon: Flame,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    glow: "shadow-[0_0_20px_rgba(244,63,94,0.2)]",
    correctionBorder: "border-rose-500/40",
    correctionBg: "bg-rose-500/15",
    correctionIcon: "text-rose-400",
  },
};

export default function CoachingPanel({
  coaching,
  isAnalysing,
  isMuted,
  onToggleMute,
  error,
}: CoachingPanelProps) {
  const emotion = coaching?.coachEmotion
    ? emotionConfig[coaching.coachEmotion]
    : emotionConfig.encouraging;
  const EmotionIcon = emotion.icon;

  return (
    <div
      className={cn(
        "flex h-full flex-col gap-4 overflow-y-auto rounded-2xl border bg-white/5 p-4 backdrop-blur-xl transition-all duration-500",
        coaching ? cn(emotion.border, emotion.glow) : "border-white/10"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Coach Maya</h3>
          {isAnalysing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-1"
            >
              <Loader2 className="h-3 w-3 animate-spin text-emerald-400" />
              <span className="text-[10px] text-emerald-400">Analysing...</span>
            </motion.div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Emotion badge */}
          {coaching?.coachEmotion && (
            <motion.div
              key={coaching.coachEmotion}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={cn(
                "flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold",
                emotion.bg,
                emotion.color,
                emotion.border,
                "border"
              )}
            >
              <EmotionIcon className="h-3 w-3" />
              {emotion.label}
            </motion.div>
          )}
          <button
            onClick={onToggleMute}
            className="rounded-lg p-2 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
            title={isMuted ? "Unmute voice coaching" : "Mute voice coaching"}
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* No coaching yet */}
      {!coaching && !error && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
          <div className="rounded-full bg-emerald-500/10 p-4">
            <Target className="h-8 w-8 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-white/70">
              Select a pose & start your session
            </p>
            <p className="mt-1 text-xs text-white/40">
              Coach Maya will analyse your form automatically
            </p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !coaching && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Coaching content */}
      <AnimatePresence mode="wait">
        {coaching && (
          <motion.div
            key={`coaching-${coaching.coachEmotion}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-4"
          >
            {/* Score ring */}
            <div className="flex justify-center">
              <ScoreRing
                score={coaching.overallScore}
                size={100}
                strokeWidth={6}
              />
            </div>

            {/* Overall feedback — speech bubble style */}
            <motion.div
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={cn(
                "rounded-xl border p-3",
                emotion.border,
                emotion.bg
              )}
            >
              <p
                className={cn(
                  "text-sm font-medium leading-relaxed italic text-white/90"
                )}
              >
                &ldquo;{coaching.overallFeedback}&rdquo;
              </p>
            </motion.div>

            {/* Primary correction — highlighted */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className={cn(
                "rounded-xl border p-3",
                emotion.correctionBorder,
                emotion.correctionBg
              )}
            >
              <div className="mb-1 flex items-center gap-1.5">
                <Zap className={cn("h-3.5 w-3.5", emotion.correctionIcon)} />
                <span
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-wider",
                    emotion.correctionIcon
                  )}
                >
                  Focus on this
                </span>
              </div>
              <p className="text-sm font-medium text-white">
                {coaching.primaryCorrection}
              </p>
            </motion.div>

            {/* Body part cards */}
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-white/40">
                Body Check
              </h4>
              {coaching.bodyParts.map((bp, i) => (
                <BodyPartCard
                  key={`${bp.part}-${i}`}
                  bodyPart={bp}
                  index={i}
                />
              ))}
            </div>

            {/* Breathing cue */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex items-center gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3"
            >
              <Wind className="h-4 w-4 shrink-0 text-cyan-400" />
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400">
                  Breathing
                </span>
                <p className="text-sm text-white/80">{coaching.breathingCue}</p>
              </div>
            </motion.div>

            {/* Encouragement */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className={cn(
                "text-center text-sm font-medium",
                emotion.color,
                "opacity-80"
              )}
            >
              {coaching.encouragement}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
