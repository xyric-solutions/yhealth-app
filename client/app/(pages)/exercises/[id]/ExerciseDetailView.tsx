"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Dumbbell,
  Target,
  Zap,
  Clock,
  Flame,
  ListOrdered,
  Lightbulb,
  AlertTriangle,
  ChevronRight,
  Brain,
  Activity,
} from "lucide-react";
import {
  exercisesService,
  type ExerciseDetail,
} from "@/src/shared/services/exercises.service";
import { RelatedExercisesCarousel } from "./RelatedExercisesCarousel";

const difficultyConfig: Record<string, { label: string; gradient: string; shadow: string; ring: string }> = {
  beginner: { label: "Beginner", gradient: "from-emerald-500 to-green-500", shadow: "shadow-emerald-500/20", ring: "#34d399" },
  intermediate: { label: "Intermediate", gradient: "from-amber-500 to-orange-500", shadow: "shadow-amber-500/20", ring: "#fbbf24" },
  advanced: { label: "Advanced", gradient: "from-red-500 to-rose-500", shadow: "shadow-red-500/20", ring: "#f87171" },
  expert: { label: "Expert", gradient: "from-purple-500 to-violet-500", shadow: "shadow-purple-500/20", ring: "#a78bfa" },
};

function ProgressRing({ progress, size = 56, strokeWidth = 3.5, color }: { progress: number; size?: number; strokeWidth?: number; color: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" className="text-white/[0.06]" strokeWidth={strokeWidth} fill="none" />
      <motion.circle
        cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round"
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: circumference - (progress / 100) * circumference }}
        transition={{ duration: 1.5, delay: 0.5, ease: "easeOut" }}
        strokeDasharray={circumference}
      />
    </svg>
  );
}

function AIStatCard({ icon: Icon, label, value, color, ringProgress, ringColor }: {
  icon: typeof Activity;
  label: string;
  value: string;
  color: string;
  ringProgress?: number;
  ringColor?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative flex flex-col items-center gap-2 p-4 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-white/[0.06] group hover:border-white/[0.12] transition-all duration-300"
    >
      {ringProgress !== undefined && ringColor ? (
        <div className="relative">
          <ProgressRing progress={ringProgress} color={ringColor} size={52} />
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon className={`w-4.5 h-4.5 ${color}`} />
          </div>
        </div>
      ) : (
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
      )}
      <span className="text-lg font-bold text-white">{value}</span>
      <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">{label}</span>
    </motion.div>
  );
}

function InstructionStep({ step, index }: { step: string; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.1 + index * 0.06 }}
      className="flex gap-4 group"
    >
      <div className="flex flex-col items-center">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform">
          <span className="text-sm font-bold text-white">{index + 1}</span>
        </div>
        <div className="w-0.5 flex-1 bg-gradient-to-b from-emerald-500/30 to-transparent mt-2 min-h-[12px]" />
      </div>
      <div className="pb-6">
        <p className="text-sm sm:text-base text-slate-300 leading-relaxed pt-1.5">{step}</p>
      </div>
    </motion.div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: typeof Target; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="w-8 h-8 rounded-lg bg-emerald-600/20 flex items-center justify-center">
        <Icon className="w-4 h-4 text-emerald-400" />
      </div>
      <h3 className="text-base font-semibold text-white">{title}</h3>
    </div>
  );
}

export function ExerciseDetailView() {
  const params = useParams();
  const exerciseId = params.id as string;

  const [exercise, setExercise] = useState<ExerciseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [activeTab, setActiveTab] = useState<"instructions" | "tips" | "mistakes">("instructions");

  useEffect(() => {
    if (!exerciseId) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);
    setImageError(false);
    setActiveTab("instructions");

    exercisesService
      .getById(exerciseId)
      .then((res) => {
        if (res.success && res.data) {
          setExercise(res.data);
        } else {
          setError("Exercise not found");
        }
      })
      .catch(() => setError("Failed to load exercise"))
      .finally(() => setLoading(false));
  }, [exerciseId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-12 h-12 rounded-full border-2 border-transparent border-t-emerald-500 border-r-teal-500"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Brain className="w-5 h-5 text-emerald-400" />
          </div>
        </div>
        <p className="text-sm text-slate-500 mt-4">Loading exercise...</p>
      </div>
    );
  }

  if (error || !exercise) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mb-4">
          <Dumbbell className="w-8 h-8 text-slate-600" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">{error || "Exercise not found"}</h2>
        <p className="text-sm text-slate-500 mb-6">The exercise you&apos;re looking for doesn&apos;t exist or has been removed.</p>
        <Link
          href="/exercises"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-300"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Library
        </Link>
      </div>
    );
  }

  const difficulty = difficultyConfig[exercise.difficulty_level] || difficultyConfig.beginner;
  const instructions = Array.isArray(exercise.instructions) ? exercise.instructions as string[] : [];
  const tips = Array.isArray(exercise.tips) ? exercise.tips as string[] : [];
  const commonMistakes = Array.isArray(exercise.common_mistakes) ? exercise.common_mistakes as string[] : [];
  const isVideo = exercise.animation_url?.endsWith(".mp4");
  const hasImage = !imageError && (exercise.animation_url || exercise.thumbnail_url);
  const hasTabContent = instructions.length > 0 || tips.length > 0 || commonMistakes.length > 0;

  return (
    <div className="max-w-8xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-8 relative">
      {/* Background mesh gradient */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-emerald-500/[0.03] rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-1/4 w-80 h-80 bg-teal-500/[0.03] rounded-full blur-3xl" />
      </div>

      {/* Breadcrumb / Back */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-2 text-sm"
      >
        <Link
          href="/exercises"
          className="flex items-center gap-1.5 text-slate-500 hover:text-emerald-400 transition-colors duration-300"
        >
          <ArrowLeft className="w-4 h-4" />
          Exercise Library
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-700" />
        <span className="text-slate-400 truncate max-w-[200px]">{exercise.name}</span>
      </motion.div>

      {/* Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Image / Animation */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative lg:aspect-[4/3] rounded-3xl overflow-hidden bg-slate-800 border border-white/[0.06] group"
        >
          {hasImage ? (
            <>
              {isVideo ? (
                <video
                  src={exercise.animation_url || ""}
                  poster={exercise.thumbnail_url || undefined}
                  autoPlay
                  muted
                  loop
                  playsInline
                  onError={() => setImageError(true)}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={exercise.animation_url || exercise.thumbnail_url || ""}
                  alt={exercise.name}
                  onError={() => setImageError(true)}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
              <Dumbbell className="w-24 h-24 text-slate-700" />
            </div>
          )}

          {/* Floating badges on image */}
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <span className={`px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r ${difficulty.gradient} text-white shadow-lg ${difficulty.shadow}`}>
              {difficulty.label}
            </span>
            {exercise.source && (
              <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900/80 text-slate-400 backdrop-blur-sm border border-white/10 uppercase">
                {exercise.source}
              </span>
            )}
          </div>

          {/* AI Coach Insight — floating card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="absolute bottom-4 left-4 right-4 p-3 rounded-xl bg-slate-900/80 backdrop-blur-xl border border-white/[0.08]"
          >
            <div className="flex items-center gap-2 mb-1">
              <Brain className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">AI Coach Insight</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {exercise.difficulty_level === "beginner"
                ? "Great for building foundational strength. Focus on form over weight."
                : exercise.difficulty_level === "intermediate"
                  ? "Solid compound movement. Control the eccentric phase for maximum gains."
                  : exercise.difficulty_level === "advanced"
                    ? "Advanced technique required. Ensure proper warm-up and progressive overload."
                    : "Elite-level exercise. Master prerequisites before attempting."}
            </p>
          </motion.div>
        </motion.div>

        {/* Info Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="space-y-6"
        >
          {/* Title + Category */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              {exercise.category && (
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-600/20 text-emerald-300 uppercase tracking-wider">
                  {exercise.category}
                </span>
              )}
              {exercise.body_part && (
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 text-slate-400 uppercase tracking-wider">
                  {exercise.body_part}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white capitalize leading-tight tracking-tight">
              {exercise.name}
            </h1>
            {exercise.description && (
              <p className="text-sm text-slate-400 mt-3 leading-relaxed">{exercise.description}</p>
            )}
          </div>

          {/* AI Performance Stats */}
          <div className="grid grid-cols-3 gap-3">
            <AIStatCard
              icon={Dumbbell}
              label="Sets"
              value={String(exercise.default_sets)}
              color="text-emerald-400"
              ringProgress={75}
              ringColor="#34d399"
            />
            <AIStatCard
              icon={Zap}
              label="Reps"
              value={String(exercise.default_reps)}
              color="text-emerald-400"
              ringProgress={85}
              ringColor="#2dd4bf"
            />
            <AIStatCard
              icon={Clock}
              label="Rest"
              value={`${exercise.default_rest_seconds}s`}
              color="text-cyan-400"
              ringProgress={60}
              ringColor="#22d3ee"
            />
          </div>

          {exercise.calories_per_minute && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20"
            >
              <Flame className="w-5 h-5 text-orange-400" />
              <div>
                <span className="text-sm font-semibold text-white">{Math.round(exercise.calories_per_minute)} cal/min</span>
                <span className="text-xs text-slate-500 ml-2">estimated burn rate</span>
              </div>
            </motion.div>
          )}

          {/* Target Muscles */}
          <div>
            <SectionTitle icon={Target} title="Target Muscles" />
            <div className="flex flex-wrap gap-2">
              {exercise.primary_muscle_group && (
                <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600/20 text-emerald-300 border border-emerald-500/20 shadow-sm shadow-emerald-500/10">
                  {exercise.primary_muscle_group}
                </span>
              )}
              {exercise.target_muscles?.map((m) => (
                <span
                  key={m}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800/60 text-slate-300 border border-white/[0.06]"
                >
                  {m}
                </span>
              ))}
              {exercise.secondary_muscle_groups?.map((m) => (
                <span
                  key={m}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800/40 text-slate-500 border border-white/[0.04]"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>

          {/* Equipment */}
          {exercise.equipment_required && exercise.equipment_required.length > 0 && (
            <div>
              <SectionTitle icon={Dumbbell} title="Equipment Required" />
              <div className="flex flex-wrap gap-2">
                {exercise.equipment_required.map((eq) => (
                  <span
                    key={eq}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800/60 text-slate-300 border border-white/[0.06] capitalize"
                  >
                    {eq}
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Instructions / Tips / Common Mistakes */}
      {hasTabContent && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-3xl bg-slate-900/60 backdrop-blur-sm border border-white/[0.06] overflow-hidden"
        >
          {/* Tab header */}
          <div className="flex items-center border-b border-white/[0.06] bg-slate-900/40">
            {instructions.length > 0 && (
              <button
                onClick={() => setActiveTab("instructions")}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 text-sm font-medium transition-all relative ${
                  activeTab === "instructions" ? "text-emerald-300" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <ListOrdered className="w-4 h-4" />
                <span>Instructions</span>
                {activeTab === "instructions" && (
                  <motion.div
                    layoutId="activeDetailTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
              </button>
            )}
            {tips.length > 0 && (
              <button
                onClick={() => setActiveTab("tips")}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 text-sm font-medium transition-all relative ${
                  activeTab === "tips" ? "text-emerald-300" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <Lightbulb className="w-4 h-4" />
                <span>Pro Tips</span>
                {activeTab === "tips" && (
                  <motion.div
                    layoutId="activeDetailTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
              </button>
            )}
            {commonMistakes.length > 0 && (
              <button
                onClick={() => setActiveTab("mistakes")}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 text-sm font-medium transition-all relative ${
                  activeTab === "mistakes" ? "text-emerald-300" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Common Mistakes</span>
                {activeTab === "mistakes" && (
                  <motion.div
                    layoutId="activeDetailTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
              </button>
            )}
          </div>

          {/* Tab content */}
          <div className="p-5 sm:p-8">
            {activeTab === "instructions" && instructions.length > 0 && (
              <div className="space-y-0">
                {instructions.map((step, i) => (
                  <InstructionStep key={i} step={step} index={i} />
                ))}
              </div>
            )}

            {activeTab === "tips" && tips.length > 0 && (
              <div className="space-y-4">
                {tips.map((tip, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex gap-3 items-start p-3 rounded-xl bg-amber-500/5 border border-amber-500/10"
                  >
                    <Lightbulb className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-300 leading-relaxed">{tip}</p>
                  </motion.div>
                ))}
              </div>
            )}

            {activeTab === "mistakes" && commonMistakes.length > 0 && (
              <div className="space-y-4">
                {commonMistakes.map((mistake, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex gap-3 items-start p-3 rounded-xl bg-red-500/5 border border-red-500/10"
                  >
                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-300 leading-relaxed">{mistake}</p>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Tags */}
      {exercise.tags && exercise.tags.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap gap-2"
        >
          {exercise.tags.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-800/40 text-slate-500 border border-white/[0.04] hover:border-emerald-500/20 hover:text-emerald-400 transition-all duration-300 cursor-default"
            >
              #{tag}
            </span>
          ))}
        </motion.div>
      )}

      {/* Related Exercises Carousel */}
      <RelatedExercisesCarousel
        category={exercise.category}
        currentExerciseId={exercise.id}
      />
    </div>
  );
}
