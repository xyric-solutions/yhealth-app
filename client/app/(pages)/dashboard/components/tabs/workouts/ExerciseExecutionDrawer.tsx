"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowLeft,
  Dumbbell,
  Target,
  Zap,
  Clock,
  ListOrdered,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Play,
  Pause,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Loader2,
  Minimize2,
  SkipForward,
  Timer,
  TrendingUp,
  Hash,
  Weight,
} from "lucide-react";
import {
  exercisesService,
  type ExerciseListItem,
} from "@/src/shared/services/exercises.service";
import { type Exercise } from "./types";
import { formatTime } from "./utils";
import { PlateCalculator } from "./PlateCalculator";
import { api } from "@/lib/api-client";
import YouTubeEmbed from "@/app/(pages)/yoga/components/YouTubeEmbed";
import { DashboardUnderlineTabs } from "../../DashboardUnderlineTabs";

// Difficulty badge config
const difficultyConfig: Record<string, { label: string; bg: string; text: string; glow: string }> = {
  beginner: { label: "Beginner", bg: "bg-emerald-500/15", text: "text-emerald-400", glow: "shadow-emerald-500/20" },
  intermediate: { label: "Intermediate", bg: "bg-amber-500/15", text: "text-amber-400", glow: "shadow-amber-500/20" },
  advanced: { label: "Advanced", bg: "bg-red-500/15", text: "text-red-400", glow: "shadow-red-500/20" },
  expert: { label: "Expert", bg: "bg-purple-500/15", text: "text-purple-400", glow: "shadow-purple-500/20" },
};

interface ExerciseExecutionDrawerProps {
  exercise: Exercise | null;
  isOpen: boolean;
  onClose: () => void;
  onToggleComplete: (exerciseId: string) => void;
  onUpdateWeight: (exerciseId: string, weight: string) => void;
}

interface SetState {
  reps: number;
  weight: number;
  completed: boolean;
}

export function ExerciseExecutionDrawer({
  exercise,
  isOpen,
  onClose,
  onToggleComplete,
  onUpdateWeight,
}: ExerciseExecutionDrawerProps) {
  // Library exercise data
  const [libraryExercise, setLibraryExercise] = useState<ExerciseListItem | null>(null);
  const [loadingLibrary, setLoadingLibrary] = useState(false);

  // YouTube video
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const videoCache = useRef<Map<string, string | null>>(new Map());

  // Tabs
  const [activeTab, setActiveTab] = useState<"instructions" | "tips" | "mistakes">("instructions");

  // Set tracker
  const [sets, setSets] = useState<SetState[]>([]);

  // Rest timer
  const [restTimer, setRestTimer] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stopwatch
  const [stopwatch, setStopwatch] = useState(0);
  const [isStopwatchRunning, setIsStopwatchRunning] = useState(false);
  const stopwatchRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Plate calculator
  const [showPlateCalc, setShowPlateCalc] = useState(false);
  const [plateWeight, setPlateWeight] = useState(0);
  const [plateUnit] = useState<"kg" | "lbs">("kg");

  // Fetch library exercise on open
  useEffect(() => {
    if (!isOpen || !exercise) {
      setLibraryExercise(null);
      return;
    }

    setLoadingLibrary(true);
    setActiveTab("instructions");

    exercisesService
      .search({ q: exercise.name, limit: 1 })
      .then((res) => {
        if (res.success && res.data && res.data.length > 0) {
          const match = res.data.find(
            (e) => e.name.toLowerCase() === exercise.name.toLowerCase()
          ) || res.data[0];
          setLibraryExercise(match);
        } else {
          setLibraryExercise(null);
        }
      })
      .catch(() => setLibraryExercise(null))
      .finally(() => setLoadingLibrary(false));
  }, [isOpen, exercise]);

  // Fetch YouTube video when exercise changes
  useEffect(() => {
    if (!isOpen || !exercise) return;

    const cacheKey = exercise.name;
    const cached = videoCache.current.get(cacheKey);

    if (cached !== undefined) {
      setVideoId(cached);
      return;
    }

    let cancelled = false;
    setVideoLoading(true);
    setVideoId(null);

    async function fetchVideo() {
      try {
        const res = await api.get<{ videos: { videoId: string; title: string; thumbnail: string; channelTitle: string }[] }>(
          "/youtube/search",
          { params: { q: `${exercise!.name} exercise tutorial form` } }
        );
        if (!cancelled && res.data?.videos?.length) {
          const vid = res.data.videos[0].videoId;
          videoCache.current.set(cacheKey, vid);
          setVideoId(vid);
        } else if (!cancelled) {
          videoCache.current.set(cacheKey, null);
          setVideoId(null);
        }
      } catch {
        if (!cancelled) setVideoId(null);
      } finally {
        if (!cancelled) setVideoLoading(false);
      }
    }

    fetchVideo();
    return () => { cancelled = true; };
  }, [isOpen, exercise]);

  // Initialize sets from exercise data
  useEffect(() => {
    if (!exercise) return;
    const repsStr = exercise.reps || "10";
    const repsNum = parseInt(repsStr.split("-")[0]) || 10;
    const weightStr = exercise.weight || "0";
    const weightNum = parseFloat(weightStr.replace(/[^0-9.]/g, "")) || 0;

    const newSets: SetState[] = Array.from({ length: exercise.sets || 3 }, () => ({
      reps: repsNum,
      weight: weightNum,
      completed: exercise.completed || false,
    }));
    setSets(newSets);
    setPlateWeight(weightNum);
    setShowPlateCalc(false);
    if (!exercise.completed) {
      setRestTimer(0);
      setIsResting(false);
      setStopwatch(0);
      setIsStopwatchRunning(false);
    }
  }, [exercise]);

  // Rest timer countdown
  useEffect(() => {
    if (isResting && restTimer > 0) {
      restIntervalRef.current = setInterval(() => {
        setRestTimer((prev) => {
          if (prev <= 1) {
            setIsResting(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResting, restTimer > 0]);

  // Stopwatch
  useEffect(() => {
    if (isStopwatchRunning) {
      stopwatchRef.current = setInterval(() => {
        setStopwatch((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (stopwatchRef.current) clearInterval(stopwatchRef.current);
    };
  }, [isStopwatchRunning]);

  // Cleanup on close
  useEffect(() => {
    if (!isOpen) {
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
      if (stopwatchRef.current) clearInterval(stopwatchRef.current);
      setIsResting(false);
      setIsStopwatchRunning(false);
    }
  }, [isOpen]);

  const toggleSetComplete = useCallback((index: number) => {
    setSets((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], completed: !updated[index].completed };

      if (updated[index].completed && exercise?.restSeconds) {
        setRestTimer(exercise.restSeconds);
        setIsResting(true);
      }

      return updated;
    });
  }, [exercise]);

  const skipRest = useCallback(() => {
    setIsResting(false);
    setRestTimer(0);
  }, []);

  const toggleStopwatch = useCallback(() => {
    setIsStopwatchRunning((prev) => !prev);
  }, []);

  const resetStopwatch = useCallback(() => {
    setIsStopwatchRunning(false);
    setStopwatch(0);
  }, []);

  const handleMarkComplete = useCallback(() => {
    if (!exercise) return;
    onToggleComplete(exercise.id);
    onClose();
  }, [exercise, onToggleComplete, onClose]);

  const handlePlateWeightChange = useCallback(
    (weight: number) => {
      setPlateWeight(weight);
      if (exercise) {
        onUpdateWeight(exercise.id, `${weight}kg`);
      }
    },
    [exercise, onUpdateWeight]
  );

  if (!exercise) return null;

  // Library data
  const instructions = libraryExercise?.instructions as string[] || [];
  const tips = libraryExercise?.tips as string[] || [];
  const commonMistakes = libraryExercise?.common_mistakes as string[] || [];
  const hasTabContent = instructions.length > 0 || tips.length > 0 || commonMistakes.length > 0;
  const drawerTabItems = [
    ...(instructions.length > 0
      ? [{ id: "instructions" as const, label: "How To", icon: ListOrdered }]
      : []),
    ...(tips.length > 0 ? [{ id: "tips" as const, label: "Pro Tips", icon: Lightbulb }] : []),
    ...(commonMistakes.length > 0
      ? [{ id: "mistakes" as const, label: "Avoid", icon: AlertTriangle }]
      : []),
  ];
  const difficulty = libraryExercise
    ? difficultyConfig[libraryExercise.difficulty_level] || difficultyConfig.beginner
    : null;
  const isVideo = libraryExercise?.animation_url?.endsWith(".mp4");
  const hasImage = libraryExercise?.animation_url || libraryExercise?.thumbnail_url;
  const completedSets = sets.filter((s) => s.completed).length;
  const allSetsCompleted = sets.length > 0 && completedSets === sets.length;
  const progressPercent = sets.length > 0 ? (completedSets / sets.length) * 100 : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-40"
          />

          {/* Fullscreen overlay */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto"
          >
            <div className="w-full max-w-8xl mx-auto min-h-screen lg:min-h-0 lg:my-2">
              <div className="bg-slate-950 lg:rounded-3xl border-0 lg:border border-white/[0.06] shadow-2xl shadow-black/40 flex flex-col min-h-screen lg:min-h-0 lg:max-h-[calc(100vh-48px)] overflow-hidden">

                {/* ── Header ─────────────────────────────────────────── */}
                <div className="relative flex-shrink-0">
                  {/* Progress bar across top */}
                  <div className="absolute top-0 left-0 right-0 h-1 bg-slate-800/50 z-10">
                    <motion.div
                      className="h-full bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercent}%` }}
                      transition={{ type: "spring", damping: 20 }}
                    />
                  </div>

                  <div className="flex items-center gap-4 px-5 sm:px-8 pt-5 pb-4">
                    <button
                      onClick={onClose}
                      className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group"
                    >
                      <ArrowLeft className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
                    </button>

                    <div className="flex-1 min-w-0">
                      <h1 className="text-xl sm:text-2xl font-bold text-white truncate tracking-tight">
                        {exercise.name}
                      </h1>
                      <div className="flex items-center gap-2.5 mt-1">
                        <span className="text-sm text-slate-500">{exercise.muscleGroup}</span>
                        {difficulty && (
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${difficulty.bg} ${difficulty.text} shadow-sm ${difficulty.glow}`}>
                            {difficulty.label}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stopwatch - desktop */}
                    <div className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800/50">
                      <Timer className="w-4 h-4 text-slate-500" />
                      <span className="text-base font-mono text-white tabular-nums tracking-wider">
                        {formatTime(stopwatch)}
                      </span>
                      <div className="flex items-center gap-1 ml-1">
                        <button
                          onClick={toggleStopwatch}
                          className={`p-1.5 rounded-lg transition-all ${
                            isStopwatchRunning
                              ? "bg-orange-500/20 text-orange-400 shadow-inner"
                              : "bg-white/5 text-slate-500 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          {isStopwatchRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        </button>
                        {stopwatch > 0 && (
                          <button
                            onClick={resetStopwatch}
                            className="p-1.5 rounded-lg bg-white/5 text-slate-500 hover:text-white hover:bg-white/10 transition-all"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={onClose}
                      className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group hidden sm:flex"
                    >
                      <Minimize2 className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
                    </button>
                  </div>
                </div>

                {/* ── Content ────────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700/50 scrollbar-track-transparent">
                  <div className="px-5 sm:px-8 pb-6 space-y-6">

                    {/* Two-column layout on large screens */}
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

                      {/* ── Left: Video + Instructions (3 cols) ── */}
                      <div className="lg:col-span-3 space-y-5">

                        {/* Video / Media */}
                        <div className="rounded-2xl overflow-hidden ring-1 ring-white/[0.08] bg-slate-900/40">
                          {(videoId || videoLoading) ? (
                            <div className="aspect-video">
                              <YouTubeEmbed videoId={videoId} isLoading={videoLoading} />
                            </div>
                          ) : hasImage ? (
                            <div className="relative bg-slate-900 aspect-video">
                              {isVideo ? (
                                <video
                                  src={libraryExercise?.animation_url || ""}
                                  poster={libraryExercise?.thumbnail_url || undefined}
                                  autoPlay
                                  muted
                                  loop
                                  playsInline
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={libraryExercise?.animation_url || libraryExercise?.thumbnail_url || ""}
                                  alt={exercise.name}
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                          ) : loadingLibrary ? (
                            <div className="flex items-center justify-center aspect-video bg-slate-900/50">
                              <Loader2 className="w-8 h-8 text-slate-600 animate-spin" />
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center aspect-video bg-gradient-to-br from-slate-900/60 to-slate-900/30">
                              <Dumbbell className="w-12 h-12 text-slate-700/60" />
                              <span className="text-xs text-slate-600 mt-2">No video available</span>
                            </div>
                          )}
                        </div>

                        {/* Quick Stats — horizontal cards */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="relative group flex flex-col items-center p-4 rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-900/40 border border-slate-800/40 hover:border-orange-500/20 transition-all">
                            <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center mb-2 group-hover:bg-orange-500/20 transition-colors">
                              <Hash className="w-4.5 h-4.5 text-orange-400" />
                            </div>
                            <span className="text-2xl font-bold text-white tracking-tight">{exercise.sets}</span>
                            <span className="text-[11px] text-slate-500 uppercase tracking-widest mt-0.5">Sets</span>
                          </div>
                          <div className="relative group flex flex-col items-center p-4 rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-900/40 border border-slate-800/40 hover:border-amber-500/20 transition-all">
                            <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center mb-2 group-hover:bg-amber-500/20 transition-colors">
                              <Zap className="w-4.5 h-4.5 text-amber-400" />
                            </div>
                            <span className="text-2xl font-bold text-white tracking-tight">{exercise.reps}</span>
                            <span className="text-[11px] text-slate-500 uppercase tracking-widest mt-0.5">Reps</span>
                          </div>
                          <div className="relative group flex flex-col items-center p-4 rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-900/40 border border-slate-800/40 hover:border-cyan-500/20 transition-all">
                            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-2 group-hover:bg-cyan-500/20 transition-colors">
                              <Clock className="w-4.5 h-4.5 text-cyan-400" />
                            </div>
                            <span className="text-2xl font-bold text-white tracking-tight">{exercise.restSeconds || 60}s</span>
                            <span className="text-[11px] text-slate-500 uppercase tracking-widest mt-0.5">Rest</span>
                          </div>
                        </div>

                        {/* Instructions / Tips / Mistakes */}
                        {hasTabContent && (
                          <div className="rounded-2xl bg-slate-900/30 border border-slate-800/40 overflow-hidden">
                            <DashboardUnderlineTabs
                              equalWidth
                              layoutId="execDrawerTabUnderline"
                              activeId={activeTab}
                              onTabChange={(id) =>
                                setActiveTab(id as "instructions" | "tips" | "mistakes")
                              }
                              tabs={drawerTabItems}
                              className="border-slate-800/40 bg-slate-900/20"
                            />

                            {/* Tab content */}
                            <div className="p-5 max-h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700/50">
                              <AnimatePresence mode="wait">
                                {activeTab === "instructions" && instructions.length > 0 && (
                                  <motion.div
                                    key="instructions"
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    className="space-y-4"
                                  >
                                    {instructions.map((step, i) => (
                                      <div key={i} className="flex gap-4 group">
                                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/10 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:from-orange-500/30 group-hover:to-amber-500/20 transition-colors">
                                          <span className="text-xs font-bold text-orange-400">{i + 1}</span>
                                        </div>
                                        <p className="text-sm text-slate-300 leading-relaxed">{step}</p>
                                      </div>
                                    ))}
                                  </motion.div>
                                )}

                                {activeTab === "tips" && tips.length > 0 && (
                                  <motion.div
                                    key="tips"
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    className="space-y-3"
                                  >
                                    {tips.map((tip, i) => (
                                      <div key={i} className="flex gap-3 items-start p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 hover:border-amber-500/20 transition-colors">
                                        <Lightbulb className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                                        <p className="text-sm text-slate-300 leading-relaxed">{tip}</p>
                                      </div>
                                    ))}
                                  </motion.div>
                                )}

                                {activeTab === "mistakes" && commonMistakes.length > 0 && (
                                  <motion.div
                                    key="mistakes"
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    className="space-y-3"
                                  >
                                    {commonMistakes.map((mistake, i) => (
                                      <div key={i} className="flex gap-3 items-start p-3 rounded-xl bg-red-500/5 border border-red-500/10 hover:border-red-500/20 transition-colors">
                                        <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                                        <p className="text-sm text-slate-300 leading-relaxed">{mistake}</p>
                                      </div>
                                    ))}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* ── Right: Set Tracker + Rest Timer + Plate Calc (2 cols) ── */}
                      <div className="lg:col-span-2 space-y-5">

                        {/* Mobile stopwatch */}
                        <div className="sm:hidden flex items-center justify-center gap-3 p-3 rounded-2xl bg-slate-900/60 border border-slate-800/40">
                          <Timer className="w-4 h-4 text-slate-500" />
                          <span className="text-lg font-mono text-white tabular-nums tracking-wider">
                            {formatTime(stopwatch)}
                          </span>
                          <button
                            onClick={toggleStopwatch}
                            className={`p-2 rounded-lg transition-all ${
                              isStopwatchRunning
                                ? "bg-orange-500/20 text-orange-400"
                                : "bg-white/5 text-slate-500 hover:text-white"
                            }`}
                          >
                            {isStopwatchRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>
                          {stopwatch > 0 && (
                            <button
                              onClick={resetStopwatch}
                              className="p-2 rounded-lg bg-white/5 text-slate-500 hover:text-white transition-all"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Rest Timer */}
                        <AnimatePresence>
                          {isResting && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="rounded-2xl bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-transparent border border-cyan-500/20 p-6 text-center"
                            >
                              <motion.div
                                animate={{ scale: [1, 1.08, 1] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 flex items-center justify-center"
                              >
                                <span className="text-3xl font-mono font-bold text-cyan-400 tabular-nums">
                                  {restTimer}
                                </span>
                              </motion.div>
                              <p className="text-sm text-slate-400 mb-4">Rest between sets</p>
                              {/* Rest progress ring */}
                              <div className="w-full h-1.5 rounded-full bg-slate-800/60 mb-4 overflow-hidden">
                                <motion.div
                                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
                                  initial={{ width: "100%" }}
                                  animate={{ width: "0%" }}
                                  transition={{ duration: restTimer, ease: "linear" }}
                                />
                              </div>
                              <button
                                onClick={skipRest}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500/15 text-cyan-400 text-sm font-semibold hover:bg-cyan-500/25 transition-all"
                              >
                                <SkipForward className="w-4 h-4" />
                                Skip Rest
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Set Tracker */}
                        <div className="rounded-2xl bg-slate-900/30 border border-slate-800/40 overflow-hidden">
                          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/40">
                            <div className="flex items-center gap-2.5">
                              <Target className="w-4.5 h-4.5 text-orange-400" />
                              <span className="text-sm font-semibold text-white">Set Tracker</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex gap-1">
                                {sets.map((s, i) => (
                                  <div
                                    key={i}
                                    className={`w-2 h-2 rounded-full transition-all ${
                                      s.completed ? "bg-emerald-400 shadow-sm shadow-emerald-400/40" : "bg-slate-700"
                                    }`}
                                  />
                                ))}
                              </div>
                              <span className="text-xs text-slate-500 ml-1">
                                {completedSets}/{sets.length}
                              </span>
                            </div>
                          </div>

                          <div className="divide-y divide-slate-800/20">
                            {sets.map((set, i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.04 }}
                                className={`flex items-center gap-4 px-5 py-3.5 transition-all cursor-pointer group ${
                                  set.completed
                                    ? "bg-emerald-500/[0.04]"
                                    : "hover:bg-white/[0.02]"
                                }`}
                                onClick={() => toggleSetComplete(i)}
                              >
                                <div className="flex-shrink-0">
                                  {set.completed ? (
                                    <motion.div
                                      initial={{ scale: 0.5 }}
                                      animate={{ scale: 1 }}
                                      transition={{ type: "spring", bounce: 0.5 }}
                                    >
                                      <CheckCircle2 className="w-5.5 h-5.5 text-emerald-400" />
                                    </motion.div>
                                  ) : (
                                    <Circle className="w-5.5 h-5.5 text-slate-600 group-hover:text-orange-400/60 transition-colors" />
                                  )}
                                </div>
                                <span className={`text-sm font-medium flex-1 transition-colors ${
                                  set.completed ? "text-emerald-400/80" : "text-white"
                                }`}>
                                  Set {i + 1}
                                </span>
                                <div className="flex items-center gap-3 text-xs">
                                  <span className={`flex items-center gap-1 ${set.completed ? "text-emerald-400/50" : "text-slate-500"}`}>
                                    <TrendingUp className="w-3 h-3" />
                                    {set.reps} reps
                                  </span>
                                  {set.weight > 0 && (
                                    <span className={`flex items-center gap-1 ${set.completed ? "text-emerald-400/50" : "text-slate-500"}`}>
                                      <Weight className="w-3 h-3" />
                                      {set.weight}kg
                                    </span>
                                  )}
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>

                        {/* Weight & Plate Calculator */}
                        <div className="rounded-2xl bg-slate-900/30 border border-slate-800/40 overflow-hidden">
                          <button
                            onClick={() => setShowPlateCalc(!showPlateCalc)}
                            className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
                          >
                            <div className="flex items-center gap-2.5">
                              <Dumbbell className="w-4.5 h-4.5 text-orange-400" />
                              <span className="text-sm font-semibold text-white">Weight & Plates</span>
                            </div>
                            <div className="flex items-center gap-2.5">
                              {exercise.weight && (
                                <span className="text-xs text-slate-500 px-2 py-0.5 rounded-md bg-slate-800/40">{exercise.weight}</span>
                              )}
                              {showPlateCalc ? (
                                <ChevronUp className="w-4 h-4 text-slate-500" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-slate-500" />
                              )}
                            </div>
                          </button>

                          <AnimatePresence>
                            {showPlateCalc && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <div className="px-5 pb-5 border-t border-slate-800/40 pt-4">
                                  <PlateCalculator
                                    targetWeight={plateWeight}
                                    unit={plateUnit}
                                    onWeightChange={handlePlateWeightChange}
                                  />
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Bottom Action Bar ───────────────────────────────── */}
                <div className="flex-shrink-0 px-5 sm:px-8 py-4 border-t border-white/[0.06] bg-slate-950/95 backdrop-blur-xl">
                  <button
                    onClick={handleMarkComplete}
                    className={`w-full py-3.5 rounded-2xl font-semibold text-sm transition-all active:scale-[0.98] ${
                      allSetsCompleted || exercise.completed
                        ? "bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30"
                        : "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30"
                    }`}
                  >
                    {exercise.completed
                      ? "Undo Complete"
                      : allSetsCompleted
                        ? "All Sets Done — Mark Complete"
                        : `Mark Complete (${completedSets}/${sets.length} sets)`}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
