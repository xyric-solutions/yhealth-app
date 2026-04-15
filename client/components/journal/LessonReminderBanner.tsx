/**
 * @file LessonReminderBanner Component
 * @description Inline banner showing old lessons for reflection/reminder
 */

"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, X, Check } from "lucide-react";
import { lessonsService } from "@/src/shared/services/wellbeing.service";
import type { LessonLearned } from "@shared/types/domain/wellbeing";

export function LessonReminderBanner() {
  const [lessons, setLessons] = useState<LessonLearned[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    lessonsService.getReminders().then((res) => {
      if (res.success && res.data?.lessons) {
        setLessons(res.data.lessons);
      }
    }).catch(() => {});
  }, []);

  const handleAcknowledge = (id: string) => {
    setDismissed((prev) => new Set([...prev, id]));
    lessonsService.markReminded(id).catch(() => {});
  };

  const handleDismiss = (id: string) => {
    setDismissed((prev) => new Set([...prev, id]));
    lessonsService.dismiss(id).catch(() => {});
  };

  const visibleLessons = lessons.filter((l) => !dismissed.has(l.id));
  const lesson = visibleLessons[0] ?? null;

  const weeksAgo = lesson ? Math.floor(
    (Date.now() - new Date(lesson.createdAt).getTime()) / (7 * 24 * 60 * 60 * 1000) // eslint-disable-line react-hooks/purity -- intentional for relative time
  ) : 0;

  if (!lesson) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={lesson.id}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20"
      >
        <div className="flex items-start gap-3">
          <Lightbulb className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-amber-400/70 mb-1">
              {weeksAgo} week{weeksAgo !== 1 ? "s" : ""} ago you learned:
            </p>
            <p className="text-sm text-slate-200 leading-relaxed">
              &ldquo;{lesson.lessonText}&rdquo;
            </p>
            <p className="text-xs text-slate-500 mt-2">Did that hold true?</p>
          </div>
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => handleAcknowledge(lesson.id)}
              className="p-1.5 rounded-lg hover:bg-emerald-500/20 text-slate-500 hover:text-emerald-400 transition-colors"
              title="Still relevant"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDismiss(lesson.id)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-slate-300 transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
