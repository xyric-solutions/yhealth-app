/**
 * @file LessonsLearned Component
 * @description Card list view of AI-extracted and user-entered lessons with filtering
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Pencil, Moon, Check, X, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { lessonsService } from "@/src/shared/services/wellbeing.service";
import type { LessonLearned, LessonDomain } from "@shared/types/domain/wellbeing";

const DOMAIN_COLORS: Record<LessonDomain, { bg: string; text: string }> = {
  health: { bg: "bg-green-500/20", text: "text-green-400" },
  work: { bg: "bg-blue-500/20", text: "text-blue-400" },
  relationships: { bg: "bg-pink-500/20", text: "text-pink-400" },
  personal: { bg: "bg-purple-500/20", text: "text-purple-400" },
  spiritual: { bg: "bg-amber-500/20", text: "text-amber-400" },
  productivity: { bg: "bg-cyan-500/20", text: "text-cyan-400" },
  other: { bg: "bg-slate-500/20", text: "text-slate-400" },
};

const SOURCE_ICONS = {
  ai_extracted: { icon: Brain, label: "AI extracted" },
  user_entered: { icon: Pencil, label: "User entered" },
  evening_review: { icon: Moon, label: "Evening review" },
};

const ALL_DOMAINS: LessonDomain[] = [
  "health", "work", "relationships", "personal", "spiritual", "productivity", "other",
];

export function LessonsLearned() {
  const [lessons, setLessons] = useState<LessonLearned[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [domainFilter, setDomainFilter] = useState<LessonDomain | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const loadLessons = useCallback(async () => {
    setLoading(true);
    try {
      const res = await lessonsService.getAll({
        domain: domainFilter || undefined,
        page,
        limit: 20,
      });
      if (res.success && res.data) {
        setLessons((prev) => page === 1 ? res.data!.lessons : [...prev, ...res.data!.lessons]);
        setTotal(res.data.total);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [domainFilter, page]);

  useEffect(() => {
    if (!searchQuery) loadLessons();
  }, [loadLessons, searchQuery]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadLessons();
      return;
    }
    setIsSearching(true);
    try {
      const res = await lessonsService.search(searchQuery.trim());
      if (res.success && res.data) {
        setLessons(res.data.lessons);
        setTotal(res.data.lessons.length);
      }
    } catch {
      // Silent fail
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirm = async (id: string) => {
    try {
      const res = await lessonsService.confirm(id);
      if (res.success && res.data) {
        setLessons((prev) =>
          prev.map((l) => (l.id === id ? { ...l, isConfirmed: true } : l))
        );
      }
    } catch {}
  };

  const handleDismiss = async (id: string) => {
    try {
      await lessonsService.dismiss(id);
      setLessons((prev) => prev.filter((l) => l.id !== id));
      setTotal((t) => t - 1);
    } catch {}
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search lessons..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-slate-500"
          />
        </div>
        {searchQuery && (
          <button
            onClick={() => { setSearchQuery(""); loadLessons(); }}
            className="px-3 text-slate-500 hover:text-slate-300"
          >
            Clear
          </button>
        )}
      </div>

      {/* Domain filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setDomainFilter(null); setPage(1); }}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
            !domainFilter
              ? "bg-emerald-500/30 text-emerald-300 border border-emerald-500/50"
              : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
          }`}
        >
          All
        </button>
        {ALL_DOMAINS.map((domain) => (
          <button
            key={domain}
            onClick={() => { setDomainFilter(domain); setPage(1); }}
            className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-all ${
              domainFilter === domain
                ? `${DOMAIN_COLORS[domain].bg} ${DOMAIN_COLORS[domain].text} border border-current opacity-90`
                : "bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10"
            }`}
          >
            {domain}
          </button>
        ))}
      </div>

      {/* Lessons list */}
      {loading || isSearching ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
        </div>
      ) : lessons.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-500">
          {searchQuery ? "No lessons match your search" : "No lessons yet"}
        </div>
      ) : (
        <AnimatePresence>
          <div className="space-y-3">
            {lessons.map((lesson) => {
              const domainStyle = DOMAIN_COLORS[lesson.domain] || DOMAIN_COLORS.other;
              const sourceConfig = SOURCE_ICONS[lesson.source] || SOURCE_ICONS.user_entered;
              const SourceIcon = sourceConfig.icon;

              return (
                <motion.div
                  key={lesson.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  className="p-4 rounded-xl bg-white/5 border border-white/10"
                >
                  <div className="flex items-start gap-3">
                    <SourceIcon className="w-4 h-4 mt-1 text-slate-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 leading-relaxed">
                        {lesson.lessonText}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${domainStyle.bg} ${domainStyle.text}`}
                        >
                          {lesson.domain}
                        </span>
                        <span className="text-[10px] text-slate-600">
                          {new Date(lesson.createdAt).toLocaleDateString()}
                        </span>
                        {lesson.isConfirmed && (
                          <span className="text-[10px] text-emerald-500 flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5" /> Confirmed
                          </span>
                        )}
                      </div>
                    </div>
                    {!lesson.isConfirmed && lesson.source === "ai_extracted" && (
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => handleConfirm(lesson.id)}
                          className="p-1.5 rounded-lg hover:bg-emerald-500/20 text-slate-500 hover:text-emerald-400 transition-colors"
                          title="Confirm"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDismiss(lesson.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
                          title="Dismiss"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      )}

      {/* Load more */}
      {total > lessons.length && !searchQuery && (
        <button
          onClick={() => setPage((p) => p + 1)}
          className="w-full py-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          Load more ({total - lessons.length} remaining)
        </button>
      )}
    </div>
  );
}
