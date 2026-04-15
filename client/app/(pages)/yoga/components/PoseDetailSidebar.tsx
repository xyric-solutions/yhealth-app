"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Dumbbell,
  Info,
  AlertTriangle,
  Wind,
  Clock,
  ChevronRight,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { api } from "@/lib/api-client";
import type { YogaPose } from "@shared/types/domain/yoga";
import YouTubeEmbed from "./YouTubeEmbed";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface YouTubeVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
}

interface PoseDetailSidebarProps {
  pose: YogaPose | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const categoryIcons: Record<string, string> = {
  standing: "🧍",
  seated: "🧘",
  supine: "🛌",
  prone: "🤸",
  inversion: "🙃",
  balance: "⚖️",
  twist: "🔄",
  backbend: "🌊",
  forward_fold: "🙇",
  hip_opener: "🦋",
  restorative: "🌿",
};

const categoryLabel: Record<string, string> = {
  standing: "Standing",
  seated: "Seated",
  supine: "Supine",
  prone: "Prone",
  inversion: "Inversion",
  balance: "Balance",
  twist: "Twist",
  backbend: "Backbend",
  forward_fold: "Forward Fold",
  hip_opener: "Hip Opener",
  restorative: "Restorative",
};

const difficultyConfig: Record<
  string,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    accent: string;
    dotColor: string;
  }
> = {
  beginner: {
    label: "Beginner",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    accent: "from-emerald-500/30 to-emerald-500/0",
    dotColor: "bg-emerald-400",
  },
  intermediate: {
    label: "Intermediate",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    accent: "from-amber-500/30 to-amber-500/0",
    dotColor: "bg-amber-400",
  },
  advanced: {
    label: "Advanced",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    accent: "from-red-500/30 to-red-500/0",
    dotColor: "bg-red-400",
  },
};

const breathDirectionIcons: Record<string, { icon: string; color: string; bg: string }> = {
  inhale: { icon: "↑", color: "text-cyan-400", bg: "bg-cyan-400/10" },
  exhale: { icon: "↓", color: "text-orange-400", bg: "bg-orange-400/10" },
  natural: { icon: "~", color: "text-zinc-500", bg: "bg-zinc-500/10" },
};

const EASE_OUT_EXPO: [number, number, number, number] = [0.22, 1, 0.36, 1];

const sectionVariants = {
  hidden: { opacity: 0, y: 16, filter: "blur(4px)" },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      delay: 0.15 + i * 0.08,
      duration: 0.45,
      ease: EASE_OUT_EXPO,
    },
  }),
};

// ---------------------------------------------------------------------------
// Glass Section wrapper
// ---------------------------------------------------------------------------

function GlassSection({
  children,
  className,
  index = 0,
}: {
  children: React.ReactNode;
  className?: string;
  index?: number;
}) {
  return (
    <motion.div
      custom={index}
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        "relative p-4 rounded-2xl overflow-hidden",
        "bg-linear-to-b from-white/[0.04] to-white/[0.01]",
        "backdrop-blur-2xl",
        "border border-white/[0.06]",
        "transition-all duration-300",
        "hover:border-white/[0.1] hover:shadow-lg hover:shadow-black/10",
        className
      )}
    >
      {/* Subtle hover gradient */}
      <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-linear-to-br from-white/[0.02] via-transparent to-transparent rounded-2xl" />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Section Header
// ---------------------------------------------------------------------------

function SectionLabel({
  icon: Icon,
  label,
  iconColor = "text-zinc-400",
}: {
  icon: typeof Info;
  label: string;
  iconColor?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <div
        className={cn(
          "flex items-center justify-center h-7 w-7 rounded-lg",
          "bg-white/[0.04] border border-white/[0.06]"
        )}
      >
        <Icon className={cn("h-3.5 w-3.5", iconColor)} />
      </div>
      <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PoseDetailSidebar({
  pose,
  open,
  onOpenChange,
}: PoseDetailSidebarProps) {
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoCache = useRef<Map<string, YouTubeVideo>>(new Map());

  // Fetch YouTube video when pose changes
  useEffect(() => {
    if (!pose || !open) return;

    const cacheKey = pose.id;
    const cached = videoCache.current.get(cacheKey);

    if (cached) {
      setVideoId(cached.videoId);
      return;
    }

    let cancelled = false;
    setVideoLoading(true);
    setVideoId(null);

    async function fetchVideo() {
      try {
        const res = await api.get<{ videos: YouTubeVideo[] }>(
          "/youtube/search",
          {
            params: {
              q: `${pose!.englishName} yoga tutorial beginner`,
            },
          }
        );
        if (!cancelled && res.data?.videos?.length) {
          const video = res.data.videos[0];
          videoCache.current.set(cacheKey, video);
          setVideoId(video.videoId);
        } else if (!cancelled) {
          setVideoId(null);
        }
      } catch {
        if (!cancelled) setVideoId(null);
      } finally {
        if (!cancelled) setVideoLoading(false);
      }
    }

    fetchVideo();
    return () => {
      cancelled = true;
    };
  }, [pose, open]);

  const diff = pose ? difficultyConfig[pose.difficulty] : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          "w-full transition-all duration-300",
          isFullscreen ? "sm:max-w-full" : "sm:max-w-lg",
          "bg-zinc-950/95 backdrop-blur-3xl",
          "border-white/[0.06]",
          "overflow-y-auto"
        )}
      >
        {pose && (
          <>
            <SheetHeader className="px-6 pt-6 pb-0">
              <div className="flex items-center justify-between">
                <SheetTitle className="sr-only">{pose.englishName}</SheetTitle>
                <SheetDescription className="sr-only">
                  Details and tutorial for {pose.englishName} yoga pose
                </SheetDescription>
                <button
                  onClick={() => setIsFullscreen((f) => !f)}
                  className={cn(
                    "p-2 rounded-xl transition-colors",
                    "hover:bg-white/[0.06] text-zinc-400 hover:text-white"
                  )}
                  title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </SheetHeader>

            {/* Top gradient accent based on difficulty */}
            {diff && (
              <div
                className={cn(
                  "absolute top-0 left-0 right-0 h-32 pointer-events-none",
                  "bg-gradient-to-b",
                  diff.accent
                )}
              />
            )}

            <div className="relative px-6 pb-8 space-y-5">
              {/* YouTube Video */}
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
                className="rounded-2xl overflow-hidden ring-1 ring-white/[0.06]"
              >
                <YouTubeEmbed videoId={videoId} isLoading={videoLoading} />
              </motion.div>

              {/* Pose Header */}
              <motion.div
                custom={0}
                variants={sectionVariants}
                initial="hidden"
                animate="visible"
                className="space-y-3"
              >
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    {pose.englishName}
                  </h2>
                  {pose.sanskritName && (
                    <p className="text-[13px] text-zinc-500 italic tracking-wide font-light">
                      {pose.sanskritName}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Category badge */}
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-xl",
                      "bg-white/[0.04] text-zinc-300 border border-white/[0.06]",
                      "transition-colors duration-200 hover:bg-white/[0.06]"
                    )}
                  >
                    <span className="text-sm leading-none">
                      {categoryIcons[pose.category] || "🧘"}
                    </span>
                    {categoryLabel[pose.category] || pose.category}
                  </span>

                  {/* Difficulty badge */}
                  {diff && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-xl border",
                        diff.bg,
                        diff.color,
                        diff.border
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          diff.dotColor,
                          "ring-2 ring-current/20"
                        )}
                      />
                      {diff.label}
                    </span>
                  )}

                  {/* Hold time inline badge */}
                  {pose.holdSecondsDefault > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500 font-medium">
                      <Clock className="h-3 w-3" />
                      {pose.holdSecondsDefault}s hold
                    </span>
                  )}
                </div>

                {/* Gradient divider */}
                <div className="h-px w-full bg-gradient-to-r from-white/[0.08] via-white/[0.04] to-transparent" />
              </motion.div>

              {/* Description */}
              {pose.description && (
                <GlassSection index={1}>
                  <SectionLabel icon={Info} label="About this pose" iconColor="text-zinc-400" />
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    {pose.description}
                  </p>
                </GlassSection>
              )}

              {/* Benefits */}
              {pose.benefits.length > 0 && (
                <GlassSection index={2}>
                  <SectionLabel icon={Sparkles} label="Benefits" iconColor="text-emerald-400" />
                  <div className="flex flex-wrap gap-2">
                    {pose.benefits.map((benefit, i) => (
                      <motion.span
                        key={i}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 + i * 0.04, duration: 0.3 }}
                        className={cn(
                          "text-[11px] font-medium px-3 py-1.5 rounded-xl",
                          "bg-emerald-500/8 text-emerald-300/90 border border-emerald-500/15",
                          "transition-colors duration-200 hover:bg-emerald-500/12"
                        )}
                      >
                        {benefit}
                      </motion.span>
                    ))}
                  </div>
                </GlassSection>
              )}

              {/* Muscle Groups */}
              {pose.muscleGroups.length > 0 && (
                <GlassSection index={3}>
                  <SectionLabel icon={Dumbbell} label="Target Muscles" iconColor="text-blue-400" />
                  <div className="flex flex-wrap gap-2">
                    {pose.muscleGroups.map((muscle, i) => (
                      <motion.span
                        key={i}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 + i * 0.04, duration: 0.3 }}
                        className={cn(
                          "text-[11px] font-medium px-3 py-1.5 rounded-xl",
                          "bg-blue-500/6 text-blue-300/80 border border-blue-500/15",
                          "transition-colors duration-200 hover:bg-blue-500/10"
                        )}
                      >
                        {muscle}
                      </motion.span>
                    ))}
                  </div>
                </GlassSection>
              )}

              {/* Step-by-Step Cues */}
              {pose.cues.length > 0 && (
                <GlassSection index={4}>
                  <SectionLabel icon={ChevronRight} label="Step-by-Step" iconColor="text-emerald-400" />
                  <ol className="space-y-3">
                    {pose.cues.map((cue, i) => {
                      const breath = breathDirectionIcons[cue.breathDirection];
                      return (
                        <motion.li
                          key={cue.step}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 + i * 0.06, duration: 0.35 }}
                          className="flex gap-3 text-sm group"
                        >
                          <span
                            className={cn(
                              "flex items-center justify-center h-6 w-6 rounded-lg shrink-0",
                              "bg-white/[0.04] border border-white/[0.06]",
                              "text-[11px] font-bold text-zinc-500 tabular-nums",
                              "group-hover:bg-emerald-500/10 group-hover:text-emerald-400 group-hover:border-emerald-500/20",
                              "transition-all duration-200"
                            )}
                          >
                            {cue.step}
                          </span>
                          <span className="text-zinc-400 leading-relaxed flex-1 pt-0.5">
                            {cue.instruction}
                          </span>
                          {breath && (
                            <span
                              className={cn(
                                "shrink-0 flex items-center justify-center h-6 w-6 rounded-lg text-xs font-bold",
                                breath.bg,
                                breath.color
                              )}
                              aria-label={`Breath: ${cue.breathDirection}`}
                            >
                              {breath.icon}
                            </span>
                          )}
                        </motion.li>
                      );
                    })}
                  </ol>
                </GlassSection>
              )}

              {/* Breathing Cue */}
              {pose.breathingCue && (
                <motion.div
                  custom={5}
                  variants={sectionVariants}
                  initial="hidden"
                  animate="visible"
                  className={cn(
                    "relative p-4 rounded-2xl overflow-hidden",
                    "bg-linear-to-br from-cyan-500/[0.06] to-cyan-500/[0.02]",
                    "border border-cyan-500/[0.1]"
                  )}
                >
                  {/* Animated breathing pulse */}
                  <motion.div
                    animate={{ scale: [1, 1.3, 1], opacity: [0.15, 0.05, 0.15] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-4 right-4 h-20 w-20 rounded-full bg-cyan-400/20 blur-xl pointer-events-none"
                  />
                  <div className="relative z-10 flex items-start gap-3">
                    <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-cyan-500/10 border border-cyan-500/15 shrink-0">
                      <Wind className="h-4 w-4 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-cyan-400 uppercase tracking-widest mb-1">
                        Breathing
                      </p>
                      <p className="text-sm text-cyan-300/70 leading-relaxed">
                        {pose.breathingCue}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Hold Time */}
              {pose.holdSecondsDefault > 0 && (
                <motion.div
                  custom={6}
                  variants={sectionVariants}
                  initial="hidden"
                  animate="visible"
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-2xl",
                    "bg-linear-to-b from-white/[0.04] to-white/[0.01]",
                    "border border-white/[0.06]"
                  )}
                >
                  <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                    <Clock className="h-5 w-5 text-zinc-400" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
                      Recommended Hold
                    </p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-white tabular-nums">
                        {pose.holdSecondsDefault}
                      </span>
                      <span className="text-sm text-zinc-500 font-medium">seconds</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Contraindications */}
              {pose.contraindications.length > 0 && (
                <motion.div
                  custom={7}
                  variants={sectionVariants}
                  initial="hidden"
                  animate="visible"
                  className={cn(
                    "relative p-4 rounded-2xl overflow-hidden",
                    "bg-linear-to-br from-red-500/[0.05] to-red-500/[0.02]",
                    "border border-red-500/[0.1]"
                  )}
                >
                  {/* Left accent bar */}
                  <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-red-400/60 via-red-400/30 to-transparent rounded-l-2xl" />

                  <div className="relative z-10">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-red-500/10 border border-red-500/15">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                      </div>
                      <span className="text-[11px] font-semibold text-red-400 uppercase tracking-widest">
                        Cautions
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {pose.contraindications.map((item, i) => (
                        <motion.li
                          key={i}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.5 + i * 0.05, duration: 0.3 }}
                          className="flex items-start gap-2.5 text-sm text-red-300/60"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-red-400/40 shrink-0 mt-[7px]" />
                          {item}
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
