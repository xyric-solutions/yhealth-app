"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Target,
  Zap,
  Play,
  Brain,
} from "lucide-react";
import {
  exercisesService,
  type ExerciseListItem,
} from "@/src/shared/services/exercises.service";

interface RelatedExercisesCarouselProps {
  category: string;
  currentExerciseId: string;
}

function CarouselCard({ exercise }: { exercise: ExerciseListItem }) {
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isVideo = exercise.animation_url?.endsWith(".mp4");
  const thumbnailSrc = isVideo ? (exercise.thumbnail_url || exercise.animation_url) : (exercise.animation_url || exercise.thumbnail_url);
  const hasImage = !imageError && (exercise.animation_url || exercise.thumbnail_url);

  const difficultyColors: Record<string, string> = {
    beginner: "bg-emerald-500/20 text-emerald-400",
    intermediate: "bg-amber-500/20 text-amber-400",
    advanced: "bg-red-500/20 text-red-400",
    expert: "bg-purple-500/20 text-purple-400",
  };

  return (
    <Link href={`/exercises/${exercise.id}`} className="block flex-shrink-0 w-[220px] sm:w-[260px]">
      <motion.div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        whileHover={{ y: -4, scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="group relative"
      >
        {/* Glow effect */}
        <motion.div
          animate={{ opacity: isHovered ? 0.08 : 0 }}
          transition={{ duration: 0.3 }}
          className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-emerald-500 to-teal-600 blur-2xl pointer-events-none"
        />

        <div className="relative rounded-2xl overflow-hidden bg-slate-900/90 backdrop-blur-xl border border-white/[0.06] hover:border-emerald-500/20 transition-all duration-300 shadow-lg hover:shadow-emerald-500/10">
          {/* Image */}
          <div className="relative aspect-[4/3] overflow-hidden bg-slate-800">
            {hasImage ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbnailSrc || ""}
                  alt={exercise.name}
                  loading="lazy"
                  onError={() => setImageError(true)}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent" />

                {/* Play overlay */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: isHovered ? 1 : 0, scale: isHovered ? 1 : 0.8 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-xl shadow-emerald-600/30">
                    <Play className="w-5 h-5 text-white ml-0.5" />
                  </div>
                </motion.div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                <Dumbbell className="w-10 h-10 text-slate-600" />
              </div>
            )}

            {/* Difficulty badge */}
            <div className={`absolute top-2.5 left-2.5 px-2 py-0.5 rounded-lg text-[10px] font-semibold ${difficultyColors[exercise.difficulty_level] || difficultyColors.beginner} backdrop-blur-sm`}>
              {exercise.difficulty_level}
            </div>
          </div>

          {/* Content */}
          <div className="p-3.5 space-y-2">
            <h4 className="text-sm font-semibold text-white truncate group-hover:text-emerald-300 transition-colors duration-300">
              {exercise.name}
            </h4>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1 truncate">
                <Target className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                {exercise.primary_muscle_group || exercise.body_part || "Full Body"}
              </span>
              <span className="flex items-center gap-1 flex-shrink-0">
                <Zap className="w-3 h-3 text-emerald-400" />
                {exercise.default_sets}x{exercise.default_reps}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

export function RelatedExercisesCarousel({
  category,
  currentExerciseId,
}: RelatedExercisesCarouselProps) {
  const [exercises, setExercises] = useState<ExerciseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    if (!category) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    exercisesService
      .list({ category, limit: 20, sort: "name", order: "asc" })
      .then((res) => {
        if (res.success && res.data) {
          const related = res.data.filter((e) => e.id !== currentExerciseId);
          setExercises(related);
        }
      })
      .finally(() => setLoading(false));
  }, [category, currentExerciseId]);

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollButtons();
    el.addEventListener("scroll", updateScrollButtons, { passive: true });
    return () => el.removeEventListener("scroll", updateScrollButtons);
  }, [exercises, updateScrollButtons]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = 300;
    el.scrollBy({ left: direction === "left" ? -distance : distance, behavior: "smooth" });
  };

  if (loading || exercises.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="space-y-5"
    >
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Brain className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">More {category} Exercises</h2>
            <p className="text-xs text-slate-500">{exercises.length} related exercises</p>
          </div>
        </div>

        {/* Scroll arrows */}
        <div className="hidden sm:flex items-center gap-2">
          <button
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            className="p-2 rounded-xl bg-slate-900/80 border border-white/[0.06] text-slate-500 hover:text-white hover:border-emerald-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
            className="p-2 rounded-xl bg-slate-900/80 border border-white/[0.06] text-slate-500 hover:text-white hover:border-emerald-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Carousel */}
      <div className="relative -mx-3 sm:-mx-6 lg:-mx-8">
        {/* Left fade */}
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent z-10 pointer-events-none" />
        )}

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto px-3 sm:px-6 lg:px-8 pb-4 scrollbar-none scroll-smooth"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {exercises.map((exercise) => (
            <CarouselCard key={exercise.id} exercise={exercise} />
          ))}
        </div>

        {/* Right fade */}
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-slate-950 via-slate-950/80 to-transparent z-10 pointer-events-none" />
        )}
      </div>
    </motion.div>
  );
}
